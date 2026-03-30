# Backend Development Roadmap

## Phase 1-2: Core Infrastructure ✅ COMPLETE

### Database & Schema
- [x] SQLite initialization with WAL mode
- [x] Schema creation (specialties, items, PDFs, pages, links, anchors)
- [x] Foreign key constraints + indexes
- [x] FTS5 setup for full-text search

### PDF Handling
- [x] `open_pdf_dialog()` - file picker dialog
- [x] `import_pdf()` - import PDF to app storage
- [x] `list_pdfs()` - list all imported PDFs with metadata
- [x] `get_pdf_bytes()` - serve PDF bytes to frontend
- [x] Extract native text from PDFs (pdf-extract crate)
- [x] Detect scan type (native vs scanned)

### Items & Specialties
- [x] `get_specialties()` - list 13 medical specialties
- [x] `get_items()` - list items (filtered by specialty/rank)
- [x] `get_item(id)` - fetch single item details
- [x] `count_items()` - total item count
- [x] `seed_items_if_empty()` - populate 362 items on first run

### OCR Pipeline
- [x] `extract_pdf_text_cmd()` - native text extraction
- [x] `detect_scan_type_cmd()` - detect if page is scanned
- [x] `ocr_page_cmd()` - OCR via Apple Vision (macOS) or Tesseract.js
- [x] Apple Vision integration (objc2)
- [x] Tesseract.js fallback for unsupported pages

### Link System (Anchors & Links)
- [x] `create_anchor()` - create link reference (page selection)
- [x] `get_anchor()` - fetch anchor details
- [x] `update_anchor()` - modify anchor (e.g., update text/coordinates)
- [x] `delete_anchor()` - remove anchor
- [x] `list_anchors()` - list all anchors on a PDF
- [x] `create_link()` - link anchor to item/PDF/error/diagram
- [x] `get_links()` - fetch links for anchor
- [x] `delete_link()` - remove link
- [x] `get_backlinks()` - find all links pointing to anchor

---

## Phase 3: Error Notebook & Anki Sync ⏳ TODO

### Error Management
- [ ] `create_error()` - record study mistake with context
- [ ] `get_errors()` - list errors (filtered by date/severity/item)
- [ ] `update_error()` - modify error record
- [ ] `delete_error()` - remove error
- [ ] `get_error_stats()` - count errors per item/specialty

### Anki Integration
- [ ] `export_anki_apkg()` - generate .apkg file from links/items
- [ ] `sync_anki_cards()` - bidirectional sync (app ↔ Anki collection)
- [ ] Parse Anki collection.anki2 (SQLite format)
- [ ] Deep link format for Anki plugin (e.g., `edn://pdf/abc/page/3/anchor/xyz`)

---

## Phase 4: PDF Annotations 🔲 TODO

### Native Annotations
- [ ] `create_annotation()` - store highlight/note/underline
- [ ] `get_annotations()` - list annotations on PDF/page
- [ ] `update_annotation()` - modify annotation text/color
- [ ] `delete_annotation()` - remove annotation
- [ ] Persist annotations to database

### Item Workspace
- [ ] `link_item_to_pdf()` - associate item with PDF region
- [ ] `get_items_for_pdf()` - list items linked to PDF
- [ ] `unlink_item_from_pdf()` - remove item association

### Selective OCR
- [ ] `ocr_page_range()` - OCR specific pages (user selection)
- [ ] `cancel_ocr()` - stop in-progress OCR job
- [ ] Track OCR progress (page N of M)

---

## Phase 5: Excalidraw Diagrams 🔲 TODO

### Diagram Management
- [ ] `create_diagram()` - save new diagram
- [ ] `get_diagram()` - fetch diagram data (JSON)
- [ ] `update_diagram()` - modify diagram
- [ ] `delete_diagram()` - remove diagram
- [ ] `list_diagrams()` - list all diagrams

### Diagram Linking
- [ ] `link_diagram_to_pdf()` - associate diagram with PDF anchor
- [ ] `get_diagrams_for_pdf()` - diagrams linked to PDF
- [ ] `link_diagram_to_item()` - associate diagram with item

### Versioning
- [ ] `get_diagram_versions()` - diagram history
- [ ] `restore_diagram_version()` - revert to prior version

---

## Phase 6: AI Module 🤖 TODO

### Embeddings
- [ ] ONNX embedding model initialization
- [ ] `embed_text()` - generate embeddings for PDF text
- [ ] Store embeddings in database (blob)
- [ ] `semantic_search()` - find similar passages

### LLM Integration
- [ ] llama.cpp / MLX model initialization
- [ ] `generate_anki_card()` - AI card generation from highlighted text
- [ ] `summarize_pdf()` - generate summary from PDF content
- [ ] Streaming response support

---

## Phase 7: Analytics & Planning 📊 TODO

### Coverage Heatmap
- [ ] `get_coverage_heatmap()` - calculate studied % per specialty
- [ ] `get_pdf_coverage()` - studied % per PDF/page
- [ ] Return heatmap data (red/yellow/green zones)

### Dashboard Stats
- [ ] `get_study_stats()` - total items, studied %, time spent
- [ ] `get_item_stats()` - per-item coverage/error count
- [ ] `get_error_trends()` - errors over time

### Planning
- [ ] `create_goal()` - set study goal (X items by date)
- [ ] `get_goals()` - list active/completed goals
- [ ] `update_goal()` - modify goal
- [ ] `get_calendar_data()` - study activity calendar

---

## Phase 8: Polish & Release 📦 TODO

### Performance
- [ ] Database query optimization (EXPLAIN QUERY PLAN)
- [ ] Index tuning for common queries
- [ ] Connection pool sizing
- [ ] Caching layer (hot items/PDFs)

### Release Build
- [ ] Release binary optimization (already configured in Cargo.toml)
- [ ] Notarization for macOS (signing identity)
- [ ] Update mechanism

### Testing
- [ ] Unit tests for core logic (db, ocr, links)
- [ ] Integration tests (end-to-end flows)
- [ ] Cargo test suite

---

## Current Status Summary

| Phase | Status | Coverage |
|-------|--------|----------|
| Phase 1-2 | ✅ Complete | 100% |
| Phase 3 | ⏳ Not Started | 0% |
| Phase 4 | 🔲 Not Started | 0% |
| Phase 5 | 🔲 Not Started | 0% |
| Phase 6 | 🤖 Not Started | 0% |
| Phase 7 | 📊 Not Started | 0% |
| Phase 8 | 📦 Not Started | 0% |

### Next Priority: Phase 3 (Error Notebook)
1. Database schema for errors table
2. Error CRUD commands
3. Anki .apkg export format
4. Anki sync logic
