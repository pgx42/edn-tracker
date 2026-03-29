# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EDN Tracker** is a desktop application for medical students to build knowledge graphs linking PDFs, Anki flashcards, annotations, and diagrams. The app is built with:
- **Desktop Framework**: Tauri 2 (macOS Intel/Silicon)
- **Frontend**: React + TypeScript + Vite + shadcn/ui (Radix UI)
- **Backend**: Rust with Tauri commands
- **Database**: SQLite with FTS5 (full-text search)
- **Key Features**: PDF viewer with OCR (Apple Vision + Tesseract.js fallback), Anki integration, link system, error notebook, Excalidraw diagrams

See memory `project_edn_tracker.md` for detailed feature breakdown by phase.

## Common Development Commands

### Build & Run

```bash
# Development: Start both frontend (Vite) and Tauri
npm run tauri dev

# Frontend-only dev (http://localhost:5173)
npm run dev

# Build frontend
npm run build

# Build and bundle desktop app
npm run tauri build

# Preview production build
npm run preview
```

### Backend (Rust)

```bash
# Build Rust backend
cargo build

# Build release (optimized for size, LTO enabled)
cargo build --release

# Run tests
cargo test

# Format code
cargo fmt

# Lint
cargo clippy
```

### Frontend (TypeScript/React)

```bash
# Type check
npm run build  # runs `tsc && vite build`

# Format/lint (if configured)
# Currently not set up - consider adding Prettier/ESLint
```

## Architecture

### Directory Structure

```
EDNtracker/
├── src/                          # Frontend (React + TypeScript)
│   ├── App.tsx                  # Routes (React Router)
│   ├── main.tsx                 # React entry point
│   ├── components/
│   │   ├── layout/              # AppShell (sidebar, topbar), structural components
│   │   ├── pdf-viewer/          # PDF.js integration, annotation layer
│   │   └── ui/                  # shadcn/ui components (button, input, dialog, etc.)
│   └── pages/                   # Route pages (Dashboard, PDFs, Items, Errors, Planning, Settings)
│
├── src-tauri/                   # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── lib.rs              # Tauri setup, command handler registration, DB init
│   │   ├── main.rs             # Binary entry point (delegates to lib.rs)
│   │   ├── commands/           # Tauri commands (OCR, health checks, DB queries)
│   │   ├── db/                 # SQLx database layer, migrations
│   │   └── ocr/                # OCR logic (Apple Vision macOS native, Tesseract.js fallback)
│   ├── tauri.conf.json         # Tauri config (window size, dev URL, bundle settings)
│   └── Cargo.toml              # Rust dependencies
│
├── Cargo.toml                   # Workspace root (just src-tauri member)
├── package.json                 # Frontend dependencies, npm scripts
├── vite.config.ts              # Vite config (port 5173, Tauri preset)
├── tsconfig.json               # TypeScript config
├── tailwind.config.js          # Tailwind CSS config
├── postcss.config.js           # PostCSS config (Tailwind)
└── schema.sql                  # SQLite schema (PDF, items, specialties, links, etc.)
```

### Data Flow

1. **Frontend → Backend**: React components invoke Tauri commands via `@tauri-apps/api`
2. **Backend → Database**: Rust commands use `sqlx` async/await to query SQLite
3. **OCR Pipeline**: PDF page → native Apple Vision (macOS) or Tesseract.js → text + bounding boxes
4. **PDF Viewer**: pdf.js renders pages; annotation layer captures user selections/links

### Key Module Responsibilities

- **lib.rs**: Tauri app initialization, DB pool setup, logging, command handler registration
- **db module**: Database initialization, connection pooling, schema setup
- **commands module**: Tauri command implementations (handlers between frontend and DB)
- **ocr module**: Page-level OCR detection (native vs. scanned), extraction via Apple Vision or Tesseract
- **App.tsx**: Route definitions (React Router BrowserRouter wrapper)
- **AppShell.tsx**: Layout wrapper with Sidebar and TopBar; outlet for route content
- **PdfViewer.tsx**: pdf.js integration; page render and annotation layer mounting

## Key Technical Details

### Database (SQLite)

- **WAL mode** enabled for concurrent access (`PRAGMA journal_mode = WAL`)
- **Foreign key constraints** enabled
- **Main tables**:
  - `pdf_documents`: PDF metadata, OCR status, text extraction state
  - `pages`: Individual page content and native text
  - `items`: 362 medical items across 13 specialties
  - `specialties`: Referential data (anatomy, pathology, etc.)
  - `links`, `errors`, `annotations`: User-created content (schema in schema.sql)

### Tauri Configuration

- **Window**: 1200×800 (min: 900×600)
- **Dev URL**: http://localhost:5173 (Vite frontend)
- **Build**: Runs `npm run build` before packaging
- **macOS**: Private API enabled for native integrations
- **Bundle**: Supports macOS (dmg) and cross-platform builds

### Frontend Stack

- **Routing**: React Router v6 (BrowserRouter, Routes, Route)
- **UI Components**: shadcn/ui (Radix UI primitives + Tailwind)
- **State**: Zustand (if initialized; currently pages are functional)
- **Styling**: Tailwind CSS + PostCSS
- **PDF**: pdfjs-dist v4.7.76
- **OCR (Client-side fallback)**: tesseract.js v5.1.1

### Backend Stack

- **Runtime**: Tokio (async)
- **Web Framework**: Tauri 2 (custom command invocation)
- **Database**: sqlx 0.8 (async SQLite)
- **Serialization**: serde/serde_json
- **macOS Native**: objc2 (Vision framework for OCR)
- **PDF Text Extraction**: pdf-extract 0.7 (native text layer)
- **Logging**: tracing/tracing-subscriber (env filter default: `edn_tracker=debug`)

### Build Optimization

- **Release profile**: LTO enabled, panic=abort, codegen-units=1, opt-level="s", strip=true
- **Target**: Safari 13 (macOS) / Chrome 105 (Windows)
- **Minification**: Disabled in debug builds, esbuild in release
- **Sourcemaps**: Enabled only in debug builds

## Development Workflow

### Adding a New Page

1. Create file in `src/pages/YourPage.tsx`
2. Add route in `src/App.tsx` under the AppShell outlet
3. Add nav item in `src/components/layout/Sidebar.tsx`

### Adding a Tauri Command

1. Implement in `src-tauri/src/commands/` (or `commands/submodule.rs`)
2. Register in `src-tauri/src/lib.rs` invoke_handler: `tauri::generate_handler![commands::your_command]`
3. Call from frontend via `invoke('your_command', { arg1, arg2 })`

### Adding Database Functionality

1. Update `schema.sql` if schema changes
2. Add migration/table creation in `src-tauri/src/db/` if needed
3. Use `sqlx::query!` macros for compile-time checked queries (requires `sqlx-cli`)

### Running Tests

Currently **no test suite configured**. Consider adding:
- Rust: `#[cfg(test)]` modules in src-tauri (cargo test)
- Frontend: Vitest for React components (npm test)

## Notes

- **macOS-only** in current version (v0.1.0)
- **Offline-first**: All core features work without network
- **Target app size**: < 30 MB (models downloaded separately)
- **Design system**: shadcn/ui (no custom design tokens yet)
- **Logging**: Set `RUST_LOG=edn_tracker=debug` or higher for backend
- The workspace root Cargo.toml only lists `src-tauri` member; both npm and cargo are required
