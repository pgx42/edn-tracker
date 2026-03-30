-- ============================================================================
-- EDN TRACKER - SCHEMA SQLite3
-- Medical knowledge graph: PDF linking, Anki sync, annotations, OCR
-- Version: 1.0 (Phase 1-2)
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;  -- Write-Ahead Log for concurrent access

-- ============================================================================
-- 1. REFERENTIAL DATA - EDN Item Catalog
-- ============================================================================

-- Medical specialties (13 total)
CREATE TABLE IF NOT EXISTS specialties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Core EDN items (362 items across specialties)
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    specialty_id TEXT NOT NULL,
    code TEXT NOT NULL,          -- e.g., "HTA-001"
    title TEXT NOT NULL,
    description TEXT,
    rank TEXT CHECK (rank IN ('A', 'B', 'C')) DEFAULT 'B',  -- priority rank
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (specialty_id) REFERENCES specialties(id),
    UNIQUE(specialty_id, code)
);

CREATE INDEX idx_items_specialty ON items(specialty_id);
CREATE INDEX idx_items_rank ON items(rank);

-- ============================================================================
-- 2. PDF DOCUMENTS & PAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS pdf_documents (
    id TEXT PRIMARY KEY,          -- UUID
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,      -- relative to ~/Library/Application Support/com.edn-tracker/resources/pdf/
    doc_type TEXT CHECK (doc_type IN ('college', 'poly', 'lca', 'annale', 'other')) DEFAULT 'other',
    num_pages INTEGER NOT NULL,
    has_native_text BOOLEAN DEFAULT TRUE,  -- true if PDF has extractable text
    is_scanned BOOLEAN DEFAULT FALSE,      -- true if text/page ratio indicates scan
    text_extraction_complete BOOLEAN DEFAULT FALSE,
    ocr_complete BOOLEAN DEFAULT FALSE,
    file_size_bytes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pdf_documents_doc_type ON pdf_documents(doc_type);

-- PDF pages: text content, FTS index
CREATE TABLE IF NOT EXISTS pdf_pages (
    id TEXT PRIMARY KEY,          -- UUID or "{pdf_id}:{page_num}"
    pdf_document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    text_content TEXT,            -- extracted or OCR'd text
    text_source TEXT CHECK (text_source IN ('native', 'ocr_apple', 'ocr_tesseract')) DEFAULT 'native',
    ocr_confidence REAL,          -- 0.0-1.0, Apple Vision or Tesseract confidence
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pdf_document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE,
    UNIQUE(pdf_document_id, page_number)
);

CREATE INDEX idx_pdf_pages_document ON pdf_pages(pdf_document_id);

-- FTS5 full-text search on PDF pages
CREATE VIRTUAL TABLE IF NOT EXISTS pdf_pages_fts USING fts5(
    page_id,
    pdf_id,
    content='pdf_pages',
    content_rowid='rowid'
);

-- Trigger to keep FTS5 in sync
CREATE TRIGGER IF NOT EXISTS pdf_pages_fts_insert AFTER INSERT ON pdf_pages BEGIN
  INSERT INTO pdf_pages_fts(rowid, page_id, pdf_id, content)
  VALUES (new.rowid, new.id, new.pdf_document_id, new.text_content);
END;

CREATE TRIGGER IF NOT EXISTS pdf_pages_fts_delete AFTER DELETE ON pdf_pages BEGIN
  DELETE FROM pdf_pages_fts WHERE page_id = old.id;
END;

-- Thumbnails cache (page previews for fast UI rendering)
CREATE TABLE IF NOT EXISTS pdf_thumbnails (
    id TEXT PRIMARY KEY,
    pdf_page_id TEXT NOT NULL UNIQUE,
    thumbnail_path TEXT NOT NULL,  -- relative path to thumbnail image
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pdf_page_id) REFERENCES pdf_pages(id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. KNOWLEDGE GRAPH - ANCHORS & LINKS
-- ============================================================================

-- Anchors: specific locations in documents (PDF zones, text passages, etc.)
CREATE TABLE IF NOT EXISTS anchors (
    id TEXT PRIMARY KEY,          -- UUID
    type TEXT CHECK (type IN ('pdf_zone', 'pdf_text', 'excalidraw_node', 'anki_card')) DEFAULT 'pdf_zone',
    source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'excalidraw', 'anki')),
    source_id TEXT NOT NULL,      -- pdf_document_id, excalidraw_id, or anki_note_id

    -- PDF-specific fields
    pdf_document_id TEXT,
    page_number INTEGER,
    x REAL,                        -- top-left x coordinate (0-1 normalized or pixel)
    y REAL,                        -- top-left y coordinate
    w REAL,                        -- width
    h REAL,                        -- height
    text_snippet TEXT,             -- for text anchors: the selected text

    -- Metadata
    label TEXT,                    -- user-friendly name: "Definition HTA résistante"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (pdf_document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES pdf_documents(id)
);

CREATE INDEX idx_anchors_source ON anchors(source_type, source_id);
CREATE INDEX idx_anchors_pdf ON anchors(pdf_document_id, page_number);

-- Links: bidirectional relationships between anchors and objects
CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,          -- UUID
    source_anchor_id TEXT NOT NULL,
    target_anchor_id TEXT,        -- NULL if link target is item/error/card (see target_type)

    target_type TEXT CHECK (target_type IN ('anchor', 'item', 'error', 'anki_card', 'excalidraw')) DEFAULT 'anchor',
    target_id TEXT,               -- item_id, error_id, anki_note_id, or excalidraw_id if not anchor

    link_type TEXT CHECK (link_type IN ('related', 'definition', 'example', 'counterexample', 'comparison', 'mechanism')) DEFAULT 'related',

    bidirectional BOOLEAN DEFAULT TRUE,
    created_by TEXT,              -- 'user', 'ai_suggestion'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (source_anchor_id) REFERENCES anchors(id) ON DELETE CASCADE,
    FOREIGN KEY (target_anchor_id) REFERENCES anchors(id) ON DELETE CASCADE
);

CREATE INDEX idx_links_source ON links(source_anchor_id);
CREATE INDEX idx_links_target_anchor ON links(target_anchor_id);
CREATE INDEX idx_links_target_type ON links(target_type, target_id);

-- Link suggestions from AI (not yet accepted/rejected)
CREATE TABLE IF NOT EXISTS link_suggestions (
    id TEXT PRIMARY KEY,
    source_anchor_id TEXT NOT NULL,
    suggested_target_anchor_id TEXT,
    target_type TEXT,
    target_id TEXT,
    confidence REAL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    reason TEXT,                  -- why suggestion was made
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_anchor_id) REFERENCES anchors(id) ON DELETE CASCADE
);

-- Anchor discussion: thread of comments on an anchor
CREATE TABLE IF NOT EXISTS anchor_comments (
    id TEXT PRIMARY KEY,          -- UUID
    anchor_id TEXT NOT NULL,
    author TEXT NOT NULL,         -- username or 'Anonymous'
    content TEXT NOT NULL,        -- comment text
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (anchor_id) REFERENCES anchors(id) ON DELETE CASCADE
);

CREATE INDEX idx_anchor_comments_anchor ON anchor_comments(anchor_id, created_at);

-- ============================================================================
-- 4. PDF ANNOTATIONS & MARKUP
-- ============================================================================

CREATE TABLE IF NOT EXISTS pdf_annotations (
    id TEXT PRIMARY KEY,          -- UUID
    pdf_document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,

    annotation_type TEXT CHECK (annotation_type IN ('highlight', 'underline', 'strikethrough', 'note', 'drawing', 'arrow')) DEFAULT 'highlight',

    -- Geometry
    x REAL, y REAL, w REAL, h REAL,

    -- Content
    text_content TEXT,            -- for notes
    color TEXT DEFAULT '#FFFF00',  -- hex color
    line_width REAL DEFAULT 2.0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (pdf_document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_pdf_annotations_page ON pdf_annotations(pdf_document_id, page_number);

-- ============================================================================
-- 5. ANKI CARDS & INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS anki_decks (
    id TEXT PRIMARY KEY,          -- UUID
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_exported_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS anki_notes (
    id TEXT PRIMARY KEY,          -- Anki note ID (int64 as string to preserve fidelity)
    deck_id TEXT NOT NULL,
    note_type TEXT DEFAULT 'EDN_Custom',  -- custom note type for EDN

    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    extra_field TEXT,             -- additional content

    source_pdf_ref TEXT,          -- JSON: {pdf_id, page, x, y, w, h} for deep linking
    source_anchor_id TEXT,        -- link to local anchor

    tags TEXT,                    -- space-separated tags for Anki
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    anki_created_at TIMESTAMP,    -- timestamp from Anki database

    FOREIGN KEY (deck_id) REFERENCES anki_decks(id),
    FOREIGN KEY (source_anchor_id) REFERENCES anchors(id) ON DELETE SET NULL
);

CREATE INDEX idx_anki_notes_deck ON anki_notes(deck_id);
CREATE INDEX idx_anki_notes_source_anchor ON anki_notes(source_anchor_id);

-- Anki card stats (from Anki database sync)
CREATE TABLE IF NOT EXISTS anki_card_stats (
    id TEXT PRIMARY KEY,          -- UUID
    anki_note_id TEXT NOT NULL,

    reviews INTEGER DEFAULT 0,
    lapses INTEGER DEFAULT 0,
    ease REAL DEFAULT 2.5,        -- ease factor (1.3-4.0)
    interval INTEGER DEFAULT 0,   -- days
    due_date DATE,
    last_review_at TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (anki_note_id) REFERENCES anki_notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_anki_card_stats_note ON anki_card_stats(anki_note_id);

-- ============================================================================
-- 6. ERROR TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS errors (
    id TEXT PRIMARY KEY,          -- UUID
    item_id INTEGER,              -- related EDN item (optional)
    title TEXT NOT NULL,
    description TEXT,

    source_anchor_id TEXT,        -- linked to PDF passage
    error_type TEXT CHECK (error_type IN ('concept_confusion', 'knowledge_gap', 'calculation', 'recall')) DEFAULT 'knowledge_gap',
    severity TEXT CHECK (severity IN ('minor', 'medium', 'critical')) DEFAULT 'medium',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,

    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL,
    FOREIGN KEY (source_anchor_id) REFERENCES anchors(id) ON DELETE SET NULL
);

CREATE INDEX idx_errors_item ON errors(item_id);
CREATE INDEX idx_errors_created ON errors(created_at DESC);

CREATE TABLE IF NOT EXISTS error_tags (
    error_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY (error_id) REFERENCES errors(id) ON DELETE CASCADE,
    PRIMARY KEY (error_id, tag)
);

-- ============================================================================
-- 7. EXCALIDRAW DIAGRAMS & INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS excalidraw_diagrams (
    id TEXT PRIMARY KEY,          -- UUID
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,      -- relative to resources/excalidraw/

    diagram_json TEXT NOT NULL,   -- Excalidraw full JSON state (encrypted at rest)

    item_ids TEXT,                -- JSON array of related item IDs

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_excalidraw_created ON excalidraw_diagrams(created_at DESC);

-- Excalidraw nodes linked to PDF anchors
CREATE TABLE IF NOT EXISTS excalidraw_anchors (
    id TEXT PRIMARY KEY,          -- UUID
    excalidraw_diagram_id TEXT NOT NULL,
    excalidraw_element_id TEXT NOT NULL,  -- element ID within Excalidraw

    linked_anchor_id TEXT,        -- PDF anchor or other resource anchor

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (excalidraw_diagram_id) REFERENCES excalidraw_diagrams(id) ON DELETE CASCADE,
    FOREIGN KEY (linked_anchor_id) REFERENCES anchors(id) ON DELETE SET NULL
);

-- ============================================================================
-- 8. RESOURCES (Notes, Articles, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,          -- UUID
    type TEXT CHECK (type IN ('markdown_note', 'article', 'annale_qcm', 'video_link')) DEFAULT 'markdown_note',

    title TEXT NOT NULL,
    content TEXT,                 -- Markdown or text

    item_id INTEGER,              -- link to EDN item

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
);

CREATE INDEX idx_resources_item ON resources(item_id);

-- ============================================================================
-- 9. AI MODULE - EMBEDDINGS & VECTORS (Phase 6+)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pdf_embeddings (
    id TEXT PRIMARY KEY,          -- UUID
    pdf_document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,

    chunk_number INTEGER,         -- sequential chunk within page
    chunk_text TEXT NOT NULL,     -- original text (~256 tokens)
    embedding BLOB NOT NULL,      -- float32 vector (ONNX output)

    model_name TEXT DEFAULT 'all-MiniLM-L6-v2',
    embedding_dim INTEGER DEFAULT 384,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (pdf_document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_pdf_embeddings_document ON pdf_embeddings(pdf_document_id);

-- Cached semantic search results
CREATE TABLE IF NOT EXISTS semantic_search_cache (
    id TEXT PRIMARY KEY,
    query_text TEXT NOT NULL,
    top_k INTEGER DEFAULT 5,
    results TEXT NOT NULL,  -- JSON: [{embedding_id, chunk_text, similarity_score, pdf_id, page}]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- ============================================================================
-- 10. ACTIVITY & PROGRESS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS pdf_page_views (
    id TEXT PRIMARY KEY,          -- UUID
    pdf_document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    session_id TEXT NOT NULL,     -- ties multiple page views to one session
    duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pdf_document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_pdf_page_views_session ON pdf_page_views(session_id);
CREATE INDEX idx_pdf_page_views_page ON pdf_page_views(pdf_document_id, page_number);

-- Daily activity heatmap
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    activity_count INTEGER DEFAULT 1,
    PRIMARY KEY (date)
);

-- ============================================================================
-- 11. PLANNING & CALENDAR
-- ============================================================================

CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,          -- UUID
    title TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INTEGER,

    item_ids TEXT,                -- JSON array of items studied
    note TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_study_sessions_start ON study_sessions(start_time DESC);

CREATE TABLE IF NOT EXISTS study_goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    target_date DATE NOT NULL,
    item_ids TEXT,                -- JSON array of items to master
    progress_percent INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ============================================================================
-- 12. SETTINGS & METADATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT OR IGNORE INTO app_settings (key, value) VALUES
('app_version', '1.0.0'),
('db_version', '1.0'),
('last_backup', ''),
('theme', 'dark'),
('ai_mode', 'disabled'),  -- 'disabled', 'local', 'api', 'hybrid'
('ai_model_local', 'all-MiniLM-L6-v2');

-- ============================================================================
-- 13. BACKUP METADATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    backup_path TEXT NOT NULL,
    backup_size_bytes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT
);

-- ============================================================================
-- INITIAL DATA: Specialties
-- ============================================================================

INSERT OR IGNORE INTO specialties (id, name) VALUES
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
('orl', 'ORL');

-- ============================================================================
-- INDEXES FOR COMMON QUERIES (Optimized)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_anchors_label ON anchors(label);
CREATE INDEX IF NOT EXISTS idx_links_created ON links(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anki_notes_tags ON anki_notes(tags);
CREATE INDEX IF NOT EXISTS idx_errors_resolved ON errors(resolved_at);
CREATE INDEX IF NOT EXISTS idx_items_code ON items(code);
