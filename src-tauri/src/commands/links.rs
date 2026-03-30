use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Anchor {
    pub id: String,
    #[sqlx(rename = "type")]
    pub anchor_type: String,
    pub source_type: String,
    pub source_id: String,
    pub pdf_document_id: Option<String>,
    pub page_number: Option<i32>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub w: Option<f64>,
    pub h: Option<f64>,
    pub text_snippet: Option<String>,
    pub label: Option<String>,
    pub created_at: Option<String>,
    pub modified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Link {
    pub id: String,
    pub source_anchor_id: String,
    pub target_anchor_id: Option<String>,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub link_type: String,
    pub bidirectional: Option<bool>,
    pub created_by: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacklinkResult {
    pub resource_type: String,
    pub resource_id: String,
    pub resource_name: Option<String>,
    pub link_type: String,
    pub link_id: String,
}

// ─── Anchor Commands ──────────────────────────────────────────────────────────

/// Create a new anchor on a PDF page zone and return its generated ID.
#[tauri::command]
pub async fn create_anchor(
    pdf_id: String,
    page: i32,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    label: String,
    text_snippet: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO anchors (id, type, source_type, source_id, pdf_document_id, page_number, x, y, w, h, label, text_snippet)
         VALUES (?, 'pdf_zone', 'pdf', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&pdf_id)
    .bind(&pdf_id)
    .bind(page)
    .bind(x)
    .bind(y)
    .bind(w)
    .bind(h)
    .bind(&label)
    .bind(&text_snippet)
    .execute(db.inner())
    .await
    .map_err(|e| format!("create_anchor error: {e}"))?;

    Ok(id)
}

/// Fetch a single anchor by ID.
#[tauri::command]
pub async fn get_anchor(
    id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<Option<Anchor>, String> {
    sqlx::query_as::<_, Anchor>(
        "SELECT id, type, source_type, source_id, pdf_document_id, page_number,
                x, y, w, h, text_snippet, label, created_at, modified_at
         FROM anchors WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(db.inner())
    .await
    .map_err(|e| format!("get_anchor error: {e}"))
}

/// Update the label of an existing anchor.
#[tauri::command]
pub async fn update_anchor(
    id: String,
    label: String,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    let rows = sqlx::query(
        "UPDATE anchors SET label = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(&label)
    .bind(&id)
    .execute(db.inner())
    .await
    .map_err(|e| format!("update_anchor error: {e}"))?;

    Ok(rows.rows_affected() > 0)
}

/// Delete an anchor (cascade deletes its links).
#[tauri::command]
pub async fn delete_anchor(
    id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    let rows = sqlx::query("DELETE FROM anchors WHERE id = ?")
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("delete_anchor error: {e}"))?;

    Ok(rows.rows_affected() > 0)
}

/// List anchors, optionally filtered by pdf_document_id and/or page_number.
#[tauri::command]
pub async fn list_anchors(
    pdf_id: Option<String>,
    page: Option<i32>,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<Anchor>, String> {
    let anchors = match (pdf_id, page) {
        (Some(pid), Some(pg)) => {
            sqlx::query_as::<_, Anchor>(
                "SELECT id, type, source_type, source_id, pdf_document_id, page_number,
                        x, y, w, h, text_snippet, label, created_at, modified_at
                 FROM anchors WHERE pdf_document_id = ? AND page_number = ?
                 ORDER BY created_at",
            )
            .bind(pid)
            .bind(pg)
            .fetch_all(db.inner())
            .await
        }
        (Some(pid), None) => {
            sqlx::query_as::<_, Anchor>(
                "SELECT id, type, source_type, source_id, pdf_document_id, page_number,
                        x, y, w, h, text_snippet, label, created_at, modified_at
                 FROM anchors WHERE pdf_document_id = ?
                 ORDER BY page_number, created_at",
            )
            .bind(pid)
            .fetch_all(db.inner())
            .await
        }
        _ => {
            sqlx::query_as::<_, Anchor>(
                "SELECT id, type, source_type, source_id, pdf_document_id, page_number,
                        x, y, w, h, text_snippet, label, created_at, modified_at
                 FROM anchors ORDER BY created_at",
            )
            .fetch_all(db.inner())
            .await
        }
    };

    anchors.map_err(|e| format!("list_anchors error: {e}"))
}

// ─── Link Commands ────────────────────────────────────────────────────────────

/// Create a link between two anchors (or from an anchor to an external resource).
#[tauri::command]
pub async fn create_link(
    source_anchor_id: String,
    target_anchor_id: Option<String>,
    target_type: Option<String>,
    target_id: Option<String>,
    link_type: String,
    db: tauri::State<'_, DbPool>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO links (id, source_anchor_id, target_anchor_id, target_type, target_id, link_type)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&source_anchor_id)
    .bind(&target_anchor_id)
    .bind(&target_type)
    .bind(&target_id)
    .bind(&link_type)
    .execute(db.inner())
    .await
    .map_err(|e| format!("create_link error: {e}"))?;

    Ok(id)
}

/// Get links for a given anchor. direction: "outgoing", "incoming", or "both".
#[tauri::command]
pub async fn get_links(
    anchor_id: String,
    direction: String,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<Link>, String> {
    let links = match direction.as_str() {
        "outgoing" => {
            sqlx::query_as::<_, Link>(
                "SELECT id, source_anchor_id, target_anchor_id, target_type, target_id,
                        link_type, bidirectional, created_by, created_at
                 FROM links WHERE source_anchor_id = ? ORDER BY created_at",
            )
            .bind(&anchor_id)
            .fetch_all(db.inner())
            .await
        }
        "incoming" => {
            sqlx::query_as::<_, Link>(
                "SELECT id, source_anchor_id, target_anchor_id, target_type, target_id,
                        link_type, bidirectional, created_by, created_at
                 FROM links WHERE target_anchor_id = ? ORDER BY created_at",
            )
            .bind(&anchor_id)
            .fetch_all(db.inner())
            .await
        }
        _ => {
            // "both" or any other value
            sqlx::query_as::<_, Link>(
                "SELECT id, source_anchor_id, target_anchor_id, target_type, target_id,
                        link_type, bidirectional, created_by, created_at
                 FROM links WHERE source_anchor_id = ? OR target_anchor_id = ?
                 ORDER BY created_at",
            )
            .bind(&anchor_id)
            .bind(&anchor_id)
            .fetch_all(db.inner())
            .await
        }
    };

    links.map_err(|e| format!("get_links error: {e}"))
}

/// Delete a link by ID.
#[tauri::command]
pub async fn delete_link(
    id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    let rows = sqlx::query("DELETE FROM links WHERE id = ?")
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("delete_link error: {e}"))?;

    Ok(rows.rows_affected() > 0)
}

/// Get all backlinks pointing to resources associated with a PDF page or item.
///
/// Filters by pdf_document_id, page_number, or item_id. Returns a flat list of
/// BacklinkResult describing each linked resource.
#[tauri::command]
pub async fn get_backlinks(
    pdf_id: Option<String>,
    page: Option<i32>,
    item_id: Option<i32>,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<BacklinkResult>, String> {
    // Collect anchor IDs matching the given scope, then gather all links referencing them.
    let anchor_ids: Vec<String> = match (pdf_id.as_deref(), page) {
        (Some(pid), Some(pg)) => {
            sqlx::query_as::<_, (String,)>(
                "SELECT id FROM anchors WHERE pdf_document_id = ? AND page_number = ?",
            )
            .bind(pid)
            .bind(pg)
            .fetch_all(db.inner())
            .await
            .map_err(|e| format!("get_backlinks anchors error: {e}"))?
            .into_iter()
            .map(|(id,)| id)
            .collect()
        }
        (Some(pid), None) => {
            sqlx::query_as::<_, (String,)>(
                "SELECT id FROM anchors WHERE pdf_document_id = ?",
            )
            .bind(pid)
            .fetch_all(db.inner())
            .await
            .map_err(|e| format!("get_backlinks anchors error: {e}"))?
            .into_iter()
            .map(|(id,)| id)
            .collect()
        }
        _ => Vec::new(),
    };

    let mut results: Vec<BacklinkResult> = Vec::new();

    // Links where these anchors are the target (incoming links from other resources)
    for aid in &anchor_ids {
        let rows = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, String)>(
            "SELECT l.id, l.link_type, l.target_type, l.target_id, a.pdf_document_id
             FROM links l
             JOIN anchors a ON a.id = l.source_anchor_id
             WHERE l.target_anchor_id = ?",
        )
        .bind(aid)
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("get_backlinks links error: {e}"))?;

        for (link_id, link_type, target_type, target_id, src_pdf_id) in rows {
            results.push(BacklinkResult {
                resource_type: "pdf".to_string(),
                resource_id: src_pdf_id.clone(),
                resource_name: Some(src_pdf_id),
                link_type,
                link_id,
            });
            let _ = (target_type, target_id); // may be used for richer resolution later
        }
    }

    // Links pointing to this item by target_type/target_id
    if let Some(iid) = item_id {
        let rows = sqlx::query_as::<_, (String, String, String)>(
            "SELECT l.id, l.link_type, a.pdf_document_id
             FROM links l
             JOIN anchors a ON a.id = l.source_anchor_id
             WHERE l.target_type = 'item' AND l.target_id = ?",
        )
        .bind(iid.to_string())
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("get_backlinks item links error: {e}"))?;

        for (link_id, link_type, src_pdf_id) in rows {
            results.push(BacklinkResult {
                resource_type: "item".to_string(),
                resource_id: iid.to_string(),
                resource_name: Some(src_pdf_id),
                link_type,
                link_id,
            });
        }
    }

    Ok(results)
}
