use anyhow::{Context, Result};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tracing::{debug, info};

pub type DbPool = SqlitePool;

/// Returns the path for the application's SQLite database.
/// Creates parent directories if they don't exist.
fn get_db_path(app: &AppHandle) -> Result<PathBuf> {
    let data_dir = app
        .path()
        .app_data_dir()
        .context("Failed to resolve app data directory")?;

    std::fs::create_dir_all(&data_dir)
        .with_context(|| format!("Failed to create data directory: {data_dir:?}"))?;

    Ok(data_dir.join("edn_tracker.db"))
}

/// Initialize the SQLite connection pool and run schema migrations.
pub async fn init_db(app: &AppHandle) -> Result<DbPool> {
    let db_path = get_db_path(app)?;
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    info!("Opening database at {db_path:?}");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .with_context(|| format!("Failed to connect to SQLite at {db_url}"))?;

    run_schema(&pool).await?;
    verify_tables(&pool).await?;

    Ok(pool)
}

/// Execute all schema statements to create tables (idempotent).
async fn run_schema(pool: &SqlitePool) -> Result<()> {
    debug!("Running schema migrations");

    // Enable WAL and foreign keys
    sqlx::query("PRAGMA journal_mode = WAL")
        .execute(pool)
        .await
        .context("Failed to set journal_mode")?;

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await
        .context("Failed to enable foreign_keys")?;

    // Create tables directly (avoids SQL parsing issues with multi-line statements)
    let statements = vec![
        // Specialties
        "CREATE TABLE IF NOT EXISTS specialties (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",

        // Items
        "CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY,
            specialty_id TEXT NOT NULL,
            code TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            rank TEXT CHECK (rank IN ('A', 'B', 'C')) DEFAULT 'B',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (specialty_id) REFERENCES specialties(id),
            UNIQUE(specialty_id, code)
        )",
        "CREATE INDEX IF NOT EXISTS idx_items_specialty ON items(specialty_id)",
        "CREATE INDEX IF NOT EXISTS idx_items_rank ON items(rank)",

        // PDF Documents
        "CREATE TABLE IF NOT EXISTS pdf_documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            file_path TEXT NOT NULL,
            doc_type TEXT CHECK (doc_type IN ('college', 'poly', 'lca', 'annale', 'other')) DEFAULT 'other',
            num_pages INTEGER NOT NULL,
            has_native_text BOOLEAN DEFAULT TRUE,
            is_scanned BOOLEAN DEFAULT FALSE,
            text_extraction_complete BOOLEAN DEFAULT FALSE,
            ocr_complete BOOLEAN DEFAULT FALSE,
            file_size_bytes INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE INDEX IF NOT EXISTS idx_pdf_documents_doc_type ON pdf_documents(doc_type)",

        // PDF Pages
        "CREATE TABLE IF NOT EXISTS pdf_pages (
            id TEXT PRIMARY KEY,
            pdf_document_id TEXT NOT NULL,
            page_number INTEGER NOT NULL,
            text_content TEXT,
            text_source TEXT CHECK (text_source IN ('native', 'ocr_apple', 'ocr_tesseract')) DEFAULT 'native',
            ocr_confidence REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pdf_document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE,
            UNIQUE(pdf_document_id, page_number)
        )",
        "CREATE INDEX IF NOT EXISTS idx_pdf_pages_document ON pdf_pages(pdf_document_id)",

        // FTS5 Virtual table for full-text search
        "CREATE VIRTUAL TABLE IF NOT EXISTS pdf_pages_fts USING fts5(
            page_id, pdf_id,
            content='pdf_pages',
            content_rowid='rowid'
        )",

        // Anchors
        "CREATE TABLE IF NOT EXISTS anchors (
            id TEXT PRIMARY KEY,
            type TEXT CHECK (type IN ('pdf_zone', 'pdf_text', 'excalidraw_node', 'anki_card')) DEFAULT 'pdf_zone',
            source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'excalidraw', 'anki')),
            source_id TEXT NOT NULL,
            pdf_document_id TEXT,
            page_number INTEGER,
            x REAL, y REAL, w REAL, h REAL,
            text_snippet TEXT,
            label TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pdf_document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
        )",
        "CREATE INDEX IF NOT EXISTS idx_anchors_source ON anchors(source_type, source_id)",
        "CREATE INDEX IF NOT EXISTS idx_anchors_pdf ON anchors(pdf_document_id, page_number)",

        // Links
        "CREATE TABLE IF NOT EXISTS links (
            id TEXT PRIMARY KEY,
            source_anchor_id TEXT NOT NULL,
            target_anchor_id TEXT,
            target_type TEXT CHECK (target_type IN ('anchor', 'item', 'error', 'anki_card', 'excalidraw')) DEFAULT 'anchor',
            target_id TEXT,
            link_type TEXT CHECK (link_type IN ('related', 'definition', 'example', 'counterexample', 'comparison', 'mechanism')) DEFAULT 'related',
            bidirectional BOOLEAN DEFAULT TRUE,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_anchor_id) REFERENCES anchors(id) ON DELETE CASCADE,
            FOREIGN KEY (target_anchor_id) REFERENCES anchors(id) ON DELETE CASCADE
        )",
        "CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_anchor_id)",
        "CREATE INDEX IF NOT EXISTS idx_links_target_anchor ON links(target_anchor_id)",
        "CREATE INDEX IF NOT EXISTS idx_links_target_type ON links(target_type, target_id)",

        // Anchor Comments (Discussion thread on anchors)
        "CREATE TABLE IF NOT EXISTS anchor_comments (
            id TEXT PRIMARY KEY,
            anchor_id TEXT NOT NULL,
            author TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (anchor_id) REFERENCES anchors(id) ON DELETE CASCADE
        )",
        "CREATE INDEX IF NOT EXISTS idx_anchor_comments_anchor ON anchor_comments(anchor_id, created_at)",

        // Anki
        "CREATE TABLE IF NOT EXISTS anki_decks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_exported_at TIMESTAMP
        )",

        "CREATE TABLE IF NOT EXISTS anki_notes (
            id TEXT PRIMARY KEY,
            deck_id TEXT NOT NULL,
            note_type TEXT DEFAULT 'EDN_Custom',
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            extra_field TEXT,
            source_pdf_ref TEXT,
            source_anchor_id TEXT,
            tags TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            anki_created_at TIMESTAMP,
            FOREIGN KEY (deck_id) REFERENCES anki_decks(id),
            FOREIGN KEY (source_anchor_id) REFERENCES anchors(id) ON DELETE SET NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_anki_notes_deck ON anki_notes(deck_id)",
        "CREATE INDEX IF NOT EXISTS idx_anki_notes_source_anchor ON anki_notes(source_anchor_id)",

        // Errors
        "CREATE TABLE IF NOT EXISTS errors (
            id TEXT PRIMARY KEY,
            item_id INTEGER,
            title TEXT NOT NULL,
            description TEXT,
            source_anchor_id TEXT,
            error_type TEXT CHECK (error_type IN ('concept_confusion', 'knowledge_gap', 'calculation', 'recall')) DEFAULT 'knowledge_gap',
            severity TEXT CHECK (severity IN ('minor', 'medium', 'critical')) DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL,
            FOREIGN KEY (source_anchor_id) REFERENCES anchors(id) ON DELETE SET NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_errors_item ON errors(item_id)",
        "CREATE INDEX IF NOT EXISTS idx_errors_created ON errors(created_at DESC)",

        // Excalidraw
        "CREATE TABLE IF NOT EXISTS excalidraw_diagrams (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            file_path TEXT NOT NULL,
            diagram_json TEXT NOT NULL,
            item_ids TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE INDEX IF NOT EXISTS idx_excalidraw_created ON excalidraw_diagrams(created_at DESC)",

        // Resources
        "CREATE TABLE IF NOT EXISTS resources (
            id TEXT PRIMARY KEY,
            type TEXT CHECK (type IN ('markdown_note', 'article', 'annale_qcm', 'video_link')) DEFAULT 'markdown_note',
            title TEXT NOT NULL,
            content TEXT,
            item_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_resources_item ON resources(item_id)",

        // Embeddings (Phase 6+)
        "CREATE TABLE IF NOT EXISTS pdf_embeddings (
            id TEXT PRIMARY KEY,
            pdf_document_id TEXT NOT NULL,
            page_number INTEGER NOT NULL,
            chunk_number INTEGER,
            chunk_text TEXT NOT NULL,
            embedding BLOB NOT NULL,
            model_name TEXT DEFAULT 'all-MiniLM-L6-v2',
            embedding_dim INTEGER DEFAULT 384,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pdf_document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
        )",
        "CREATE INDEX IF NOT EXISTS idx_pdf_embeddings_document ON pdf_embeddings(pdf_document_id)",

        // Activity Tracking
        "CREATE TABLE IF NOT EXISTS pdf_page_views (
            id TEXT PRIMARY KEY,
            pdf_document_id TEXT NOT NULL,
            page_number INTEGER NOT NULL,
            session_id TEXT NOT NULL,
            duration_seconds INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pdf_document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
        )",
        "CREATE INDEX IF NOT EXISTS idx_pdf_page_views_session ON pdf_page_views(session_id)",
        "CREATE INDEX IF NOT EXISTS idx_pdf_page_views_page ON pdf_page_views(pdf_document_id, page_number)",

        // Planning
        "CREATE TABLE IF NOT EXISTS study_sessions (
            id TEXT PRIMARY KEY,
            title TEXT,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            duration_minutes INTEGER,
            item_ids TEXT,
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE INDEX IF NOT EXISTS idx_study_sessions_start ON study_sessions(start_time DESC)",

        "CREATE TABLE IF NOT EXISTS study_goals (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            target_date DATE NOT NULL,
            item_ids TEXT,
            progress_percent INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )",

        // Settings
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",

        // Backups
        "CREATE TABLE IF NOT EXISTS backups (
            id TEXT PRIMARY KEY,
            backup_path TEXT NOT NULL,
            backup_size_bytes INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            note TEXT
        )",
    ];

    for (idx, stmt) in statements.iter().enumerate() {
        debug!("Creating: {}", &stmt[..std::cmp::min(60, stmt.len())]);
        sqlx::query(stmt)
            .execute(pool)
            .await
            .with_context(|| format!("Failed at statement #{}: {}", idx + 1, stmt))?;
    }

    // Insert default data
    sqlx::query(
        "INSERT OR IGNORE INTO specialties (id, name) VALUES
        ('cardio', 'Cardiologie'),
        ('pneumo', 'Pneumologie'),
        ('gastro', 'Gastroentérologie'),
        ('neuro', 'Neurologie'),
        ('nephro', 'Néphrologie'),
        ('hemato', 'Hématologie'),
        ('onco', 'Oncologie'),
        ('rheum', 'Rhumatologie'),
        ('endo', 'Endocrinologie'),
        ('hepato', 'Hépatologie'),
        ('ortho', 'Orthopédie'),
        ('ophthalmo', 'Ophtalmologie'),
        ('orl', 'ORL')"
    )
    .execute(pool)
    .await
    .context("Failed to insert specialties")?;

    sqlx::query(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES
        ('app_version', '1.0.0'),
        ('db_version', '1.0'),
        ('theme', 'dark'),
        ('ai_mode', 'disabled')"
    )
    .execute(pool)
    .await
    .context("Failed to insert settings")?;

    info!("Schema applied successfully");
    Ok(())
}

/// Verify that key tables were created and log a quick summary.
async fn verify_tables(pool: &SqlitePool) -> Result<()> {
    let tables: Vec<(String,)> =
        sqlx::query_as("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .fetch_all(pool)
            .await
            .context("Failed to query sqlite_master")?;

    let names: Vec<&str> = tables.iter().map(|(n,)| n.as_str()).collect();
    info!("Tables present: {}", names.join(", "));

    // Spot-check a few expected tables
    for expected in &["items", "specialties", "pdf_documents", "anchors", "app_settings"] {
        if !names.contains(expected) {
            anyhow::bail!("Expected table '{expected}' was not created");
        }
    }

    Ok(())
}
