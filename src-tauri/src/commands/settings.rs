use crate::db::DbPool;

/// Export a backup of the database to the user's Desktop
#[tauri::command]
pub async fn export_backup(
    db: tauri::State<'_, DbPool>,
) -> Result<String, String> {
    // Get the database file path from the pool connection string
    let row: Option<(String,)> =
        sqlx::query_as("PRAGMA database_list")
            .fetch_optional(db.inner())
            .await
            .map_err(|e| format!("Failed to get DB path: {e}"))?;

    let db_path = row
        .and_then(|r| {
            // PRAGMA database_list returns (seq, name, file)
            // but query_as with single column only gets the first
            None::<String>
        })
        .unwrap_or_default();

    // Use a simpler approach: get path via dirs crate
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let desktop = home.join("Desktop");

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let backup_name = format!("edn_tracker_backup_{}.db", timestamp);
    let backup_path = desktop.join(&backup_name);

    // Find the actual DB file
    let data_dir = dirs::data_dir()
        .ok_or("Cannot find data directory")?
        .join("com.edn-tracker")
        .join("edn_tracker.db");

    if !data_dir.exists() {
        return Err("Base de données introuvable".to_string());
    }

    std::fs::copy(&data_dir, &backup_path)
        .map_err(|e| format!("Erreur lors de la copie: {e}"))?;

    Ok(backup_path.display().to_string())
}

/// Reset the database by deleting all user data
#[tauri::command]
pub async fn reset_database(
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    let tables = vec![
        "anki_sched",
        "anki_notes",
        "anki_decks",
        "anchor_comments",
        "links",
        "anchors",
        "errors",
        "pdf_pages",
        "pdf_documents",
        "excalidraw_diagrams",
        "study_sessions",
        "study_goals",
        "item_specialties",
        "items",
        "resources",
        "pdf_page_views",
        "pdf_embeddings",
        "backups",
    ];

    for table in tables {
        sqlx::query(&format!("DELETE FROM {}", table))
            .execute(db.inner())
            .await
            .map_err(|e| format!("Erreur suppression {}: {e}", table))?;
    }

    Ok(())
}
