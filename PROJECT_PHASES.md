# EDN Tracker - Development Phases

## Phase 1: Core Infrastructure (S1-4)
- [ ] Tauri 2 scaffold + build pipeline
- [ ] SQLite schema + WAL mode setup
- [ ] PDF viewer (pdf.js) integration
- [ ] OCR pipeline skeleton (Apple Vision + Tesseract.js)

## Phase 2: Link System (S5-7)
- [ ] Anchor/link model (PDF page selection → link creation)
- [ ] Bidirectional links + backlinks panel
- [ ] Link navigation between PDFs
- [ ] Full-text search (FTS5)

## Phase 3: Error Notebook & Anki Sync (S8-11)
- [ ] Error notebook UI (capture mistakes during study)
- [ ] Anki .apkg export format
- [ ] Anki plugin (Python addon) with deep linking back to app
- [ ] Bidirectional sync (app ↔ Anki)

## Phase 4: PDF Annotations (S12-15)
- [ ] Native PDF annotation layer (highlights, notes, underlines)
- [ ] Item workspace (link specific items to PDFs)
- [ ] Selective OCR (user can OCR specific pages)
- [ ] Annotation persistence to database

## Phase 5: Excalidraw Diagrams (S16-18)
- [ ] Embedded Excalidraw editor
- [ ] Diagram library (decision trees, schemas)
- [ ] Link diagrams to PDFs and items
- [ ] Diagram versioning

## Phase 6: AI Module (S19-22)
- [ ] ONNX embeddings (local)
- [ ] Semantic search across PDFs
- [ ] AI card generation from highlighted text
- [ ] llama.cpp / MLX integration for local LLM

## Phase 7: Analytics & Planning (S23-25)
- [ ] Coverage heatmap (green=studied, red=not)
- [ ] Dashboard with statistics
- [ ] Study planner / calendar
- [ ] Performance analytics

## Phase 8: Polish & Release (S26-28)
- [ ] Performance optimization
- [ ] Dark/light theme
- [ ] First-run wizard
- [ ] Release builds for macOS Intel/Silicon
- [ ] Documentation

---

## Critical Success Test Case
Compare two PDFs (cardiology vs nephrology) on same topic (hypertension) in split-view → see linked passages synchronized → switch to coverage heatmap → click red zone → click "See source" in Anki card → arrive at exact passage with all backlinks.
