use serde::{Deserialize, Serialize};
use sqlx::FromRow;

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
