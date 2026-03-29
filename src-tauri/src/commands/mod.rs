pub mod ocr;
pub mod items;

use serde::Serialize;
use tauri::State;

use crate::db::DbPool;

// Re-export item commands for registration
pub use items::{get_specialties, get_items, get_item, count_items};

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
}

/// Basic IPC health check — returns "ok".
#[tauri::command]
pub async fn health_check() -> Result<HealthResponse, String> {
    Ok(HealthResponse { status: "ok" })
}

/// Returns the schema version stored in app_settings.
#[tauri::command]
pub async fn get_db_version(pool: State<'_, DbPool>) -> Result<String, String> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_settings WHERE key = 'db_version'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| format!("DB error: {e}"))?;

    match row {
        Some((version,)) => Ok(version),
        None => Err("db_version key not found in app_settings".into()),
    }
}
