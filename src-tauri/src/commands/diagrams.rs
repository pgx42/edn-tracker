use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ExcalidrawDiagram {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub diagram_json: String,
    pub item_ids: Option<String>,
    pub created_at: String,
    pub modified_at: String,
}

/// List all diagrams, optionally filtered by item_id
#[tauri::command]
pub async fn list_diagrams(
    item_id: Option<String>,
    db: tauri::State<'_, crate::db::DbPool>,
) -> Result<Vec<ExcalidrawDiagram>, String> {
    let diagrams: Vec<ExcalidrawDiagram> = if let Some(item) = item_id {
        sqlx::query_as::<_, ExcalidrawDiagram>(
            "SELECT id, title, file_path, diagram_json, item_ids, created_at, modified_at
             FROM excalidraw_diagrams
             WHERE item_ids LIKE ?
             ORDER BY modified_at DESC",
        )
        .bind(format!("%{}%", item))
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, ExcalidrawDiagram>(
            "SELECT id, title, file_path, diagram_json, item_ids, created_at, modified_at
             FROM excalidraw_diagrams
             ORDER BY modified_at DESC",
        )
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(diagrams)
}

/// Get a single diagram by ID
#[tauri::command]
pub async fn get_diagram(
    id: String,
    db: tauri::State<'_, crate::db::DbPool>,
) -> Result<ExcalidrawDiagram, String> {
    sqlx::query_as::<_, ExcalidrawDiagram>(
        "SELECT id, title, file_path, diagram_json, item_ids, created_at, modified_at
         FROM excalidraw_diagrams
         WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(db.inner())
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Diagram {} not found", id))
}

/// Create a new diagram
#[tauri::command]
pub async fn create_diagram(
    title: String,
    diagram_json: String,
    item_ids: Option<String>,
    db: tauri::State<'_, crate::db::DbPool>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let file_path = format!("excalidraw/{}.excalidraw", id);

    sqlx::query(
        "INSERT INTO excalidraw_diagrams (id, title, file_path, diagram_json, item_ids, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
    )
    .bind(&id)
    .bind(&title)
    .bind(&file_path)
    .bind(&diagram_json)
    .bind(&item_ids)
    .execute(db.inner())
    .await
    .map_err(|e| format!("Failed to create diagram: {}", e))?;

    Ok(id)
}

/// Update an existing diagram
#[tauri::command]
pub async fn update_diagram(
    id: String,
    title: String,
    diagram_json: String,
    db: tauri::State<'_, crate::db::DbPool>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE excalidraw_diagrams
         SET title = ?, diagram_json = ?, modified_at = datetime('now')
         WHERE id = ?",
    )
    .bind(&title)
    .bind(&diagram_json)
    .bind(&id)
    .execute(db.inner())
    .await
    .map_err(|e| format!("Failed to update diagram: {}", e))?;

    Ok(())
}

/// Delete a diagram
#[tauri::command]
pub async fn delete_diagram(
    id: String,
    db: tauri::State<'_, crate::db::DbPool>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM excalidraw_diagrams WHERE id = ?")
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("Failed to delete diagram: {}", e))?;

    Ok(())
}

// ─── Anchor Commands (Excalidraw diagrams) ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LinkResult {
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

/// Create an anchor for the entire Excalidraw diagram (idempotent).
/// Returns the anchor ID (existing or newly created).
#[tauri::command]
pub async fn create_diagram_anchor(
    diagram_id: String,
    db: tauri::State<'_, crate::db::DbPool>,
) -> Result<String, String> {
    // Check if anchor already exists for this diagram
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM anchors
         WHERE source_type = 'excalidraw' AND source_id = ?
         LIMIT 1",
    )
    .bind(&diagram_id)
    .fetch_optional(db.inner())
    .await
    .map_err(|e| format!("Failed to check existing anchor: {}", e))?;

    if let Some((anchor_id,)) = existing {
        return Ok(anchor_id);
    }

    // Create new anchor
    let anchor_id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO anchors (id, type, source_type, source_id, label)
         VALUES (?, 'excalidraw_diagram', 'excalidraw', ?, ?)",
    )
    .bind(&anchor_id)
    .bind(&diagram_id)
    .bind("Diagramme")
    .execute(db.inner())
    .await
    .map_err(|e| format!("Failed to create anchor: {}", e))?;

    Ok(anchor_id)
}

/// Get all links for an Excalidraw diagram.
#[tauri::command]
pub async fn get_diagram_links(
    diagram_id: String,
    db: tauri::State<'_, crate::db::DbPool>,
) -> Result<Vec<LinkResult>, String> {
    // Get the anchor ID for this diagram
    let anchor_row: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM anchors
         WHERE source_type = 'excalidraw' AND source_id = ?
         LIMIT 1",
    )
    .bind(&diagram_id)
    .fetch_optional(db.inner())
    .await
    .map_err(|e| format!("Failed to fetch anchor: {}", e))?;

    let anchor_id = match anchor_row {
        Some((id,)) => id,
        None => return Ok(Vec::new()),
    };

    // Get all outgoing links from this anchor
    let links: Vec<LinkResult> = sqlx::query_as(
        "SELECT id, source_anchor_id, target_anchor_id, target_type, target_id,
                link_type, bidirectional, created_by, created_at
         FROM links WHERE source_anchor_id = ?
         ORDER BY created_at DESC",
    )
    .bind(&anchor_id)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("Failed to fetch links: {}", e))?;

    Ok(links)
}
