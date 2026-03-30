use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AnchorComment {
    pub id: String,
    pub anchor_id: String,
    pub author: String,
    pub content: String,
    pub created_at: Option<String>,
    pub modified_at: Option<String>,
}

/// Add a comment to an anchor
#[tauri::command]
pub async fn add_anchor_comment(
    anchor_id: String,
    author: String,
    content: String,
    db: tauri::State<'_, DbPool>,
) -> Result<AnchorComment, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO anchor_comments (id, anchor_id, author, content, created_at, modified_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
    )
    .bind(&id)
    .bind(&anchor_id)
    .bind(&author)
    .bind(&content)
    .execute(db.inner())
    .await
    .map_err(|e| format!("add_anchor_comment error: {e}"))?;

    // Fetch and return the created comment
    sqlx::query_as::<_, AnchorComment>(
        "SELECT id, anchor_id, author, content, created_at, modified_at FROM anchor_comments WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(db.inner())
    .await
    .map_err(|e| format!("Failed to fetch created comment: {e}"))
}

/// Get all comments for an anchor
#[tauri::command]
pub async fn get_anchor_comments(
    anchor_id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<AnchorComment>, String> {
    sqlx::query_as::<_, AnchorComment>(
        "SELECT id, anchor_id, author, content, created_at, modified_at FROM anchor_comments
         WHERE anchor_id = ? ORDER BY created_at ASC",
    )
    .bind(&anchor_id)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("get_anchor_comments error: {e}"))
}

/// Delete a comment
#[tauri::command]
pub async fn delete_anchor_comment(
    id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    let rows = sqlx::query("DELETE FROM anchor_comments WHERE id = ?")
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("delete_anchor_comment error: {e}"))?;

    Ok(rows.rows_affected() > 0)
}
