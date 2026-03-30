mod commands;
mod db;
mod ocr;

use tauri::Manager;
use tracing::info;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("edn_tracker=debug".parse().unwrap()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::block_on(async move {
                let pool = db::init_db(&app_handle).await.expect("Failed to initialize database");

                // Seed 362 items if table is empty
                commands::items::seed_items_if_empty(&pool)
                    .await
                    .expect("Failed to seed items");

                app_handle.manage(pool);
                info!("Database initialized successfully");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
            commands::get_db_version,
            commands::items::get_specialties,
            commands::items::get_items,
            commands::items::get_item,
            commands::items::count_items,
            commands::pdf::open_pdf_dialog,
            commands::pdf::import_pdf,
            commands::pdf::list_pdfs,
            commands::pdf::get_pdf_bytes,
            commands::ocr::extract_pdf_text_cmd,
            commands::ocr::detect_scan_type_cmd,
            commands::ocr::ocr_page_cmd,
            commands::links::create_anchor,
            commands::links::get_anchor,
            commands::links::update_anchor,
            commands::links::delete_anchor,
            commands::links::list_anchors,
            commands::links::create_link,
            commands::links::get_links,
            commands::links::delete_link,
            commands::links::get_backlinks,
            commands::errors::list_errors,
            commands::errors::create_error,
            commands::errors::update_error,
            commands::errors::delete_error,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
