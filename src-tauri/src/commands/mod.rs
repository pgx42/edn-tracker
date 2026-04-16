pub mod ocr;
pub mod search;
pub mod items;
pub mod catalog;
pub mod pdf;
pub mod links;
pub mod errors;
pub mod comments;
pub mod diagrams;
pub mod anki;
pub mod anki_study;
pub mod anki_edit;
pub mod anki_stats;
pub mod anki_manage;
pub mod anki_media;
pub mod anki_local;
pub mod planning;
pub mod calendar;
pub mod settings;
pub mod j_method;
pub mod annales;
pub mod tracking;

use serde::Serialize;
use tauri::State;

use crate::db::DbPool;

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
