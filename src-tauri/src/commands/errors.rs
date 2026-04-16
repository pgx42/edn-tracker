use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ErrorEntry {
    pub id: String,
    pub item_id: Option<i32>,
    pub title: String,
    pub description: Option<String>,
    pub source_anchor_id: Option<String>,
    pub error_type: String,
    pub severity: String,
    pub created_at: Option<String>,
    pub resolved_at: Option<String>,
    pub annale_session_id: Option<String>,
}

/// List all errors, optionally filtered
#[tauri::command]
pub async fn list_errors(
    item_id: Option<i32>,
    resolved_only: Option<bool>,
    annale_only: Option<bool>,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<ErrorEntry>, String> {
    let mut query_str = "SELECT id, item_id, title, description, source_anchor_id, error_type, severity, created_at, resolved_at, annale_session_id FROM errors WHERE 1=1".to_string();

    if item_id.is_some() {
        query_str.push_str(" AND item_id = ?");
    }

    if let Some(resolved) = resolved_only {
        if resolved {
            query_str.push_str(" AND resolved_at IS NOT NULL");
        } else {
            query_str.push_str(" AND resolved_at IS NULL");
        }
    }

    if let Some(true) = annale_only {
        query_str.push_str(" AND annale_session_id IS NOT NULL");
    }

    query_str.push_str(" ORDER BY created_at DESC");

    let mut q = sqlx::query_as::<_, ErrorEntry>(&query_str);
    if let Some(item_id_val) = item_id {
        q = q.bind(item_id_val);
    }

    let errors = q
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("list_errors error: {e}"))?;

    Ok(errors)
}

/// Create a new error entry
#[tauri::command]
pub async fn create_error(
    title: String,
    description: Option<String>,
    error_type: String,
    severity: String,
    item_id: Option<i32>,
    source_anchor_id: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<ErrorEntry, String> {
    let id = Uuid::new_v4().to_string();

    // Map frontend severity (minor/medium/critical) to DB (minor/medium/critical)
    let db_severity = match severity.as_str() {
        "medium" => "medium",
        "minor" => "minor",
        "critical" => "critical",
        _ => "medium", // default
    };

    sqlx::query(
        "INSERT INTO errors (id, title, description, error_type, severity, item_id, source_anchor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&title)
    .bind(&description)
    .bind(&error_type)
    .bind(db_severity)
    .bind(item_id)
    .bind(&source_anchor_id)
    .execute(db.inner())
    .await
    .map_err(|e| format!("create_error error: {e}"))?;

    Ok(ErrorEntry {
        id,
        item_id,
        title,
        description,
        source_anchor_id,
        error_type,
        severity: db_severity.to_string(),
        created_at: None,
        resolved_at: None,
        annale_session_id: None,
    })
}

/// Update an error entry (toggle resolution or update fields)
#[tauri::command]
pub async fn update_error(
    id: String,
    title: Option<String>,
    description: Option<String>,
    error_type: Option<String>,
    severity: Option<String>,
    resolved: Option<bool>,
    db: tauri::State<'_, DbPool>,
) -> Result<ErrorEntry, String> {
    // Fetch current error
    let current = sqlx::query_as::<_, ErrorEntry>(
        "SELECT id, item_id, title, description, source_anchor_id, error_type, severity, created_at, resolved_at, annale_session_id FROM errors WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(db.inner())
    .await
    .map_err(|e| format!("update_error fetch error: {e}"))?
    .ok_or("Error not found")?;

    let new_title = title.unwrap_or(current.title.clone());
    let new_description = description.or(current.description.clone());
    let new_error_type = error_type.unwrap_or(current.error_type.clone());
    let new_severity = severity.unwrap_or(current.severity.clone());
    match resolved {
        Some(true) => {
            sqlx::query(
                "UPDATE errors SET title = ?, description = ?, error_type = ?, severity = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?",
            )
            .bind(&new_title)
            .bind(&new_description)
            .bind(&new_error_type)
            .bind(&new_severity)
            .bind(&id)
            .execute(db.inner())
            .await
            .map_err(|e| format!("update_error error: {e}"))?;
        }
        Some(false) => {
            sqlx::query(
                "UPDATE errors SET title = ?, description = ?, error_type = ?, severity = ?, resolved_at = NULL WHERE id = ?",
            )
            .bind(&new_title)
            .bind(&new_description)
            .bind(&new_error_type)
            .bind(&new_severity)
            .bind(&id)
            .execute(db.inner())
            .await
            .map_err(|e| format!("update_error error: {e}"))?;
        }
        None => {
            sqlx::query(
                "UPDATE errors SET title = ?, description = ?, error_type = ?, severity = ? WHERE id = ?",
            )
            .bind(&new_title)
            .bind(&new_description)
            .bind(&new_error_type)
            .bind(&new_severity)
            .bind(&id)
            .execute(db.inner())
            .await
            .map_err(|e| format!("update_error error: {e}"))?;
        }
    }

    // Fetch updated entry to return with correct resolved_at timestamp
    let updated = sqlx::query_as::<_, ErrorEntry>(
        "SELECT id, item_id, title, description, source_anchor_id, error_type, severity, created_at, resolved_at, annale_session_id FROM errors WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(db.inner())
    .await
    .map_err(|e| format!("update_error fetch error: {e}"))?;

    Ok(updated)
}

/// Delete an error entry
#[tauri::command]
pub async fn delete_error(
    id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    let result = sqlx::query("DELETE FROM errors WHERE id = ?")
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("delete_error error: {e}"))?;

    Ok(result.rows_affected() > 0)
}
