mod commands;
mod db;
mod ocr;
mod scheduler;

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
            commands::catalog::create_specialty,
            commands::catalog::update_specialty,
            commands::catalog::delete_specialty,
            commands::catalog::get_specialties_with_count,
            commands::catalog::create_item_db,
            commands::catalog::update_item_db,
            commands::catalog::delete_item_db,
            commands::catalog::get_specialty_items,
            commands::catalog::get_item_full_detail,
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
            commands::comments::add_anchor_comment,
            commands::comments::get_anchor_comments,
            commands::comments::delete_anchor_comment,
            commands::diagrams::list_diagrams,
            commands::diagrams::get_diagram,
            commands::diagrams::create_diagram,
            commands::diagrams::update_diagram,
            commands::diagrams::delete_diagram,
            commands::diagrams::create_diagram_anchor,
            commands::diagrams::get_diagram_links,
            commands::anki::anki_check_connection,
            commands::anki::select_anki_collection,
            commands::anki::get_anki_collection_path,
            commands::anki::list_anki_decks,
            commands::anki::create_anki_card,
            commands::anki::get_anki_cards,
            commands::anki::list_anki_notes,
            commands::anki::create_anki_deck,
            commands::anki::anki_sync_notes,
            commands::anki_edit::anki_update_note,
            commands::anki_edit::anki_update_note_fields_direct,
            commands::anki_edit::anki_delete_note,
            commands::anki_stats::anki_get_deck_review_stats,
            commands::anki_stats::anki_get_reviews_today,
            commands::anki_stats::anki_get_collection_stats_html,
            commands::anki_study::anki_get_due_cards,
            commands::anki_study::anki_get_new_cards,
            commands::anki_study::anki_answer_card,
            commands::anki_study::anki_get_study_summary,
            commands::anki_study::anki_get_card_intervals,
            commands::anki_media::anki_get_media_file,
            commands::anki_media::anki_get_media_dir,
            commands::anki_local::anki_sync_to_local,
            commands::anki_local::anki_get_due_local,
            commands::anki_local::anki_answer_card_local,
            commands::anki_local::anki_get_intervals_local,
            commands::anki_local::anki_push_to_anki,
            commands::anki_manage::anki_suspend_notes,
            commands::anki_manage::anki_unsuspend_notes,
            commands::anki_manage::anki_is_card_suspended,
            commands::anki_manage::anki_move_notes_to_deck,
            // Planning / sessions
            commands::planning::get_sessions,
            commands::planning::create_session,
            commands::planning::update_session,
            commands::planning::update_session_time,
            commands::planning::update_session_calendar_id,
            commands::planning::delete_session,
            commands::planning::get_item_planning_info,
            // Global search
            commands::search::global_search,
            // Apple Calendar sync
            commands::calendar::get_calendar_auth_status,
            commands::calendar::request_calendar_permission,
            commands::calendar::export_session_to_apple_calendar,
            commands::calendar::import_apple_calendar_events,
            commands::calendar::delete_apple_calendar_event,
            // Settings
            commands::settings::export_backup,
            commands::settings::reset_database,
            // Méthode des J
            commands::j_method::get_j_method_config,
            commands::j_method::update_j_method_config,
            commands::j_method::start_item_review,
            commands::j_method::complete_review,
            commands::j_method::get_due_items,
            commands::j_method::get_item_review_history,
            commands::j_method::get_review_calendar,
            commands::j_method::get_item_schedule,
            commands::j_method::reset_item_review,
            // Annales
            commands::annales::create_annale_session,
            commands::annales::list_annale_sessions,
            commands::annales::get_annale_session_detail,
            commands::annales::update_annale_session,
            commands::annales::delete_annale_session,
            commands::annales::update_annale_question,
            commands::annales::submit_annale_answer,
            commands::annales::calculate_annale_score,
            commands::annales::get_annale_stats,
            commands::annales::create_annale_error,
            commands::annales::get_annale_errors,
            // Tracking
            commands::tracking::get_items_tracking,
            commands::tracking::update_item_tracking,
            commands::tracking::get_dashboard_stats,
            commands::tracking::get_specialty_progress,
            commands::tracking::get_heatmap_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
