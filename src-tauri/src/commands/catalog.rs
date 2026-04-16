use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SpecialtyWithCount {
    pub id: String,
    pub name: String,
    pub item_count: i64,
}

// ─── Specialty Commands ───────────────────────────────────────────────────────

/// Create a new specialty. Returns the generated ID.
#[tauri::command]
pub async fn create_specialty(
    name: String,
    db: tauri::State<'_, DbPool>,
) -> Result<String, String> {
    let slug = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect::<String>();
    let id = format!("{}_{}", slug.trim_matches('_'), &Uuid::new_v4().to_string()[..8]);

    sqlx::query("INSERT INTO specialties (id, name) VALUES (?, ?)")
        .bind(&id)
        .bind(&name)
        .execute(db.inner())
        .await
        .map_err(|e| format!("create_specialty error: {e}"))?;

    Ok(id)
}

/// Rename an existing specialty.
#[tauri::command]
pub async fn update_specialty(
    id: String,
    name: String,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    let rows = sqlx::query("UPDATE specialties SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("update_specialty error: {e}"))?;

    Ok(rows.rows_affected() > 0)
}

/// Delete a specialty. Returns an error if any items are still linked to it.
#[tauri::command]
pub async fn delete_specialty(
    id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    let (count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM item_specialties WHERE specialty_id = ?")
            .bind(&id)
            .fetch_one(db.inner())
            .await
            .map_err(|e| format!("delete_specialty check error: {e}"))?;

    if count > 0 {
        return Err(format!(
            "Impossible de supprimer : {} item(s) sont liés à cette matière.",
            count
        ));
    }

    let rows = sqlx::query("DELETE FROM specialties WHERE id = ?")
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("delete_specialty error: {e}"))?;

    Ok(rows.rows_affected() > 0)
}

/// List all specialties with their item count.
#[tauri::command]
pub async fn get_specialties_with_count(
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<SpecialtyWithCount>, String> {
    sqlx::query_as::<_, SpecialtyWithCount>(
        "SELECT s.id, s.name, COUNT(iss.item_id) as item_count
         FROM specialties s
         LEFT JOIN item_specialties iss ON iss.specialty_id = s.id
         GROUP BY s.id, s.name
         ORDER BY s.name",
    )
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("get_specialties_with_count error: {e}"))
}

// ─── Item Commands ────────────────────────────────────────────────────────────

/// Create a new item and associate it with the given specialties.
#[tauri::command]
pub async fn create_item_db(
    title: String,
    code: String,
    description: Option<String>,
    specialty_ids: Vec<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<i64, String> {
    let pool = db.inner();
    let primary_specialty = specialty_ids.first().cloned().unwrap_or_default();

    let result = sqlx::query(
        "INSERT INTO items (specialty_id, code, title, description) VALUES (?, ?, ?, ?)",
    )
    .bind(&primary_specialty)
    .bind(&code)
    .bind(&title)
    .bind(&description)
    .execute(pool)
    .await
    .map_err(|e| format!("create_item_db error: {e}"))?;

    let item_id = result.last_insert_rowid();

    for spec_id in &specialty_ids {
        sqlx::query(
            "INSERT OR IGNORE INTO item_specialties (item_id, specialty_id) VALUES (?, ?)",
        )
        .bind(item_id)
        .bind(spec_id)
        .execute(pool)
        .await
        .map_err(|e| format!("create_item_db junction error: {e}"))?;
    }

    Ok(item_id)
}

/// Update an existing item and replace its specialty associations.
#[tauri::command]
pub async fn update_item_db(
    id: i64,
    title: String,
    code: String,
    description: Option<String>,
    specialty_ids: Vec<String>,
    status: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    let pool = db.inner();
    let primary_specialty = specialty_ids.first().cloned().unwrap_or_default();

    let rows = sqlx::query(
        "UPDATE items SET title = ?, code = ?, description = ?, specialty_id = ?, status = ? WHERE id = ?",
    )
    .bind(&title)
    .bind(&code)
    .bind(&description)
    .bind(&primary_specialty)
    .bind(&status)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| format!("update_item_db error: {e}"))?;

    sqlx::query("DELETE FROM item_specialties WHERE item_id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("update_item_db junction delete error: {e}"))?;

    for spec_id in &specialty_ids {
        sqlx::query(
            "INSERT OR IGNORE INTO item_specialties (item_id, specialty_id) VALUES (?, ?)",
        )
        .bind(id)
        .bind(spec_id)
        .execute(pool)
        .await
        .map_err(|e| format!("update_item_db junction insert error: {e}"))?;
    }

    Ok(rows.rows_affected() > 0)
}

// ─── Specialty & Item Detail ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ItemSummary {
    pub id: i32,
    pub code: String,
    pub title: String,
    pub description: Option<String>,
    pub rank: String,
    pub error_count: i64,
    pub specialty_ids: Option<String>,
}

/// Return all items belonging to a specialty, with per-item error count.
#[tauri::command]
pub async fn get_specialty_items(
    specialty_id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<ItemSummary>, String> {
    sqlx::query_as::<_, ItemSummary>(
        "SELECT i.id, i.code, i.title, i.description, i.rank,
                COUNT(DISTINCT e.id) AS error_count,
                GROUP_CONCAT(DISTINCT iss.specialty_id) AS specialty_ids
         FROM items i
         LEFT JOIN item_specialties iss ON iss.item_id = i.id
         LEFT JOIN errors e ON e.item_id = i.id
         WHERE i.id IN (SELECT item_id FROM item_specialties WHERE specialty_id = ?)
            OR i.specialty_id = ?
         GROUP BY i.id
         ORDER BY i.code",
    )
    .bind(&specialty_id)
    .bind(&specialty_id)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("get_specialty_items error: {e}"))
}

// ─── Item Full Detail ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ItemLinkedPdf {
    pub pdf_id: String,
    pub pdf_title: String,
    pub doc_type: Option<String>,
    pub anchor_id: String,
    pub anchor_label: Option<String>,
    pub page_number: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ItemError {
    pub id: String,
    pub title: String,
    pub error_type: String,
    pub severity: String,
    pub description: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemFullDetail {
    pub errors: Vec<ItemError>,
    pub linked_pdfs: Vec<ItemLinkedPdf>,
    pub anki_count: i64,
}

/// Return errors, linked PDFs and Anki card count for a single item.
#[tauri::command]
pub async fn get_item_full_detail(
    item_id: i64,
    item_code: String,
    db: tauri::State<'_, DbPool>,
) -> Result<ItemFullDetail, String> {
    let pool = db.inner();

    let errors: Vec<ItemError> = sqlx::query_as::<_, ItemError>(
        "SELECT id, title, error_type, severity, description, created_at
         FROM errors WHERE item_id = ? ORDER BY created_at DESC",
    )
    .bind(item_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("get_item_full_detail errors: {e}"))?;

    let linked_pdfs: Vec<ItemLinkedPdf> = sqlx::query_as::<_, ItemLinkedPdf>(
        "SELECT DISTINCT pd.id AS pdf_id, pd.title AS pdf_title, pd.doc_type,
                a.id AS anchor_id, a.label AS anchor_label, a.page_number
         FROM links l
         JOIN anchors a ON a.id = l.source_anchor_id
         JOIN pdf_documents pd ON pd.id = a.pdf_document_id
         WHERE l.target_type = 'item' AND l.target_id = ?
         ORDER BY pd.title, a.page_number",
    )
    .bind(item_id.to_string())
    .fetch_all(pool)
    .await
    .map_err(|e| format!("get_item_full_detail pdfs: {e}"))?;

    let like_pattern = format!("%{}%", item_code);
    let (anki_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM anki_notes WHERE tags LIKE ?")
            .bind(&like_pattern)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("get_item_full_detail anki: {e}"))?;

    Ok(ItemFullDetail { errors, linked_pdfs, anki_count })
}

/// Delete an item by ID.
#[tauri::command]
pub async fn delete_item_db(
    id: i64,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    let rows = sqlx::query("DELETE FROM items WHERE id = ?")
        .bind(id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("delete_item_db error: {e}"))?;

    Ok(rows.rows_affected() > 0)
}
