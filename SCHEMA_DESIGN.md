# EDN Tracker - Database Schema Design

## Overview

The schema is designed for a **medical knowledge graph** application with the following principles:

1. **Offline-first**: All data stored locally in SQLite
2. **Bidirectional linking**: Anchors and links track relationships between PDFs, items, errors, and Anki cards
3. **Extensible**: Supports future modules (AI embeddings, planning, analytics)
4. **Performance**: Indexed for FTS5 search, page views, and link traversal
5. **Referential integrity**: Foreign keys with cascading deletes

---

## Key Design Decisions

### 1. Anchors as First-Class Objects

**Why separate `anchors` table?**

Instead of storing links directly on PDFs, we use anchors as **intermediate nodes**. This allows:
- Multiple types of sources (PDF zones, text passages, Excalidraw nodes, Anki cards)
- Flexible linking to multiple targets (another PDF passage, an EDN item, an error, etc.)
- Easy visualization in the UI (show anchor labels and counts)

**Example workflow:**
```
PDF page 42 (cardio) → [Anchor: "Definition HTA résistante"] → [Link] → [Item: #224]
                                                         ↓
                                                   [Link] → [Anchor in nephro PDF page 15]
```

### 2. Bidirectional Links

Links table stores:
- `source_anchor_id`: where the link originates
- `target_anchor_id` OR `(target_type, target_id)`: where it points

The `bidirectional` flag indicates if the link should appear in reverse direction automatically.

**Query example:** Find all anchors linked FROM a specific item:
```sql
SELECT a.* FROM anchors a
JOIN links l ON (l.source_anchor_id = a.id AND l.target_type = 'item' AND l.target_id = ?)
OR (l.target_anchor_id = a.id AND l.source_anchor_id IN (
  SELECT source_anchor_id FROM links WHERE target_type = 'item' AND target_id = ?
));
```

### 3. FTS5 Virtual Table for PDF Text

The `pdf_pages_fts` table is a **virtual FTS5 table** that mirrors `pdf_pages.text_content`.

- Triggers keep FTS5 in sync on INSERT/DELETE
- Supports phrase search, boolean operators, fuzzy matching
- No UPDATE trigger needed (we DELETE and re-INSERT)

**Query example:** Find all PDF pages mentioning "hypertension"
```sql
SELECT pdf_id, page_number, snippet(pdf_pages_fts, 1, '...', '...', -60) as context
FROM pdf_pages_fts
WHERE pdf_pages_fts MATCH 'hypertension'
LIMIT 20;
```

### 4. PDF Source in Anki Cards

Anki cards store `source_pdf_ref` as JSON:
```json
{
  "pdf_id": "uuid-123",
  "page": 42,
  "x": 0.1,
  "y": 0.2,
  "w": 0.8,
  "h": 0.3
}
```

This enables:
- **Deep linking** from Anki plugin: `edn-tracker://pdf/{pdf_id}/page/{page}?x={x}&y={y}...`
- **Bidirectional sync**: When user modifies Anki card in EDN Tracker, update both local and Anki
- **Source tracking**: Always know where a card came from

### 5. Anchors Link to Anki & Errors

Instead of storing anki_note_id directly in PDF annotations, we:
1. Create an anchor for the PDF passage
2. Create a link from that anchor to the anki_note (via `target_type='anki_card'` and `target_id`)

This allows:
- **One PDF passage → multiple Anki cards** (same passage can generate multiple cards)
- **Multiple PDF passages → one Anki card** (one card can reference multiple sources)
- **Consistent backlinks panel** (errors, cards, diagrams all show up the same way)

### 6. Page Views for Activity Tracking

`pdf_page_views` tracks:
- Which pages were viewed
- How long (duration_seconds)
- When (created_at)
- Which session (session_id groups a study session)

Used to calculate:
- **Coverage heatmap**: color pages based on time spent + annotations + linked cards
- **Activity graph**: daily study activity
- **Priority algorithm**: recent errors + low page view count = high priority

### 7. Embeddings for Phase 6+ (AI)

`pdf_embeddings` stores:
- `chunk_text`: ~256 tokens per chunk (with 64-token overlap)
- `embedding`: BLOB of float32 vector (384 dims for all-MiniLM-L6-v2)
- `model_name`: lets us re-embed if model changes

The embedding is stored as BLOB for efficiency (no JSON overhead).

**Query example:** Semantic search for similar passages
```sql
-- Compute similarity between query embedding and all stored embeddings
SELECT id, chunk_text, pdf_document_id, page_number,
       (dot_product(?, embedding) / (norm(?) * norm(embedding))) as similarity
FROM pdf_embeddings
WHERE similarity > 0.7
ORDER BY similarity DESC
LIMIT 10;
```

### 8. Link Suggestions (AI-Generated)

`link_suggestions` table stores:
- Suggested links from the AI module
- Status: pending, accepted, rejected
- Confidence score

When user accepts a suggestion:
1. Create a link in the links table
2. Mark suggestion as 'accepted'
3. (Optional) Learn from acceptance to improve future suggestions

---

## Important Constraints

### Foreign Keys

All foreign keys have `ON DELETE CASCADE` or `ON DELETE SET NULL`:
- **CASCADE**: If a PDF is deleted, all its pages, anchors, annotations are deleted
- **SET NULL**: If an anchor is deleted, links to that anchor become NULL (preserves history)

### Unique Constraints

- `pdf_documents.file_path`: Only one doc per file
- `pdf_pages(pdf_document_id, page_number)`: Only one page record per page
- `items(specialty_id, code)`: No duplicate items within a specialty
- `anki_decks.name`: Deck names are unique

### Check Constraints

Types are constrained with CHECK:
- `doc_type IN ('college', 'poly', 'lca', 'annale', 'other')`
- `link_type IN ('related', 'definition', 'example', ...)`
- `error_type IN ('concept_confusion', 'knowledge_gap', ...)`

This prevents invalid data at the database level.

---

## Query Patterns (Common Operations)

### 1. Get all backlinks for a PDF page

```sql
-- Find all anchors linked TO this PDF page
WITH page_anchors AS (
  SELECT id FROM anchors WHERE pdf_document_id = ? AND page_number = ?
)
SELECT DISTINCT
  l.id, l.link_type,
  CASE
    WHEN l.target_anchor_id IS NOT NULL THEN 'anchor'
    ELSE l.target_type
  END as target_type,
  CASE
    WHEN l.target_anchor_id IS NOT NULL THEN l.target_anchor_id
    ELSE l.target_id
  END as target_id
FROM links l
WHERE l.source_anchor_id IN (SELECT id FROM page_anchors)
   OR l.target_anchor_id IN (SELECT id FROM page_anchors);
```

### 2. Search across PDFs (FTS5 + item links)

```sql
-- Full-text search for "HTA" in PDFs, then find linked items
SELECT DISTINCT
  fpf.pdf_id, fpf.page_number,
  snippet(fpf, -60) as excerpt,
  i.id as item_id, i.title as item_title
FROM pdf_pages_fts fpf
LEFT JOIN pdf_documents pd ON fpf.pdf_id = pd.id
LEFT JOIN anchors a ON a.pdf_document_id = pd.id AND a.page_number = fpf.page_number
LEFT JOIN links l ON a.id = l.source_anchor_id AND l.target_type = 'item'
LEFT JOIN items i ON l.target_id = i.id
WHERE pdf_pages_fts MATCH 'HTA*'  -- prefix search
ORDER BY fpf.pdf_id, fpf.page_number;
```

### 3. Coverage heatmap for a PDF

```sql
-- Calculate coverage score for each page (combined metrics)
SELECT
  p.page_number,
  COALESCE(COUNT(DISTINCT a.id), 0) as anchor_count,
  COALESCE(COUNT(DISTINCT an.id), 0) as annotation_count,
  COALESCE(SUM(pv.duration_seconds) / 60.0, 0) as time_spent_minutes,
  COALESCE(COUNT(DISTINCT l.id), 0) as link_count,
  -- Coverage score (0-100)
  (
    COALESCE(COUNT(DISTINCT a.id), 0) * 0.25 +
    COALESCE(COUNT(DISTINCT an.id), 0) * 0.25 +
    MIN(COALESCE(SUM(pv.duration_seconds) / 600.0, 0), 25) +  -- cap time at 25
    COALESCE(COUNT(DISTINCT l.id), 0) * 0.25
  ) as coverage_score
FROM pdf_pages p
LEFT JOIN anchors a ON p.pdf_document_id = a.pdf_document_id AND p.page_number = a.page_number
LEFT JOIN pdf_annotations an ON p.pdf_document_id = an.pdf_document_id AND p.page_number = an.page_number
LEFT JOIN pdf_page_views pv ON p.pdf_document_id = pv.pdf_document_id AND p.page_number = pv.page_number
LEFT JOIN links l ON a.id = l.source_anchor_id
WHERE p.pdf_document_id = ?
GROUP BY p.page_number
ORDER BY p.page_number;
```

### 4. Get Anki cards linked to a PDF page

```sql
SELECT an.* FROM anki_notes an
WHERE json_extract(an.source_pdf_ref, '$.pdf_id') = ?
  AND json_extract(an.source_pdf_ref, '$.page') = ?;
```

### 5. Find errors related to an item

```sql
SELECT e.* FROM errors e
LEFT JOIN anchors a ON e.source_anchor_id = a.id
WHERE e.item_id = ? OR (a.pdf_document_id IS NOT NULL)
ORDER BY e.created_at DESC;
```

### 6. Semantic search (Phase 6+)

```sql
-- Find PDF chunks similar to a query embedding
-- (Assuming UDF: cosine_similarity(blob, blob) -> REAL)
SELECT
  pe.id, pe.pdf_document_id, pe.page_number, pe.chunk_number,
  pe.chunk_text,
  cosine_similarity(?, pe.embedding) as similarity
FROM pdf_embeddings pe
WHERE cosine_similarity(?, pe.embedding) > 0.7
ORDER BY similarity DESC
LIMIT 10;
```

---

## Migration Strategy

Since SQLite doesn't support traditional migrations well, we use:

1. **Version table**: `app_settings(key='db_version', value='1.0')`
2. **One-time schema file**: `schema.sql` (idempotent, all creates use `IF NOT EXISTS`)
3. **For future versions**: Create `schema_v2.sql`, then:
   - Dump data from v1
   - Create new tables
   - Migrate data
   - Update version

---

## Performance Considerations

### Indexes

- `anchors(source_type, source_id)`: Fast lookup by source
- `pdf_pages(pdf_document_id, page_number)`: Fast page access
- `links(source_anchor_id, target_type)`: Fast link traversal
- `anki_notes(source_anchor_id)`: Fast card→PDF lookup
- `pdf_page_views(session_id, pdf_document_id)`: Fast activity query

### FTS5 Search Performance

For 50 PDFs × 200 pages × ~2000 chars/page = 20M characters:
- **FTS5 query**: ~50-200ms (exact term)
- **Prefix search** (`term*`): ~100-300ms (more work, but no wildcard)
- **Phrase search** (`"exact phrase"`): ~50ms (faster)

### Pagination

For large result sets, use LIMIT/OFFSET:
```sql
SELECT * FROM pdf_pages_fts
WHERE pdf_pages_fts MATCH 'hypertension'
LIMIT 20 OFFSET 0;  -- first page
```

### Vacuum & Optimize

Periodically run:
```sql
PRAGMA optimize;       -- Analyze and update statistics
VACUUM;               -- Reclaim space
PRAGMA analysis_limit = 1000;  -- Limit analysis to 1000 rows
```

---

## Future Extensions

### Planned (Phase 6+)

1. **AI Embeddings**: `pdf_embeddings` table ready
2. **Planning**: `study_sessions`, `study_goals` tables ready
3. **Analytics**: All tracking data in place (`pdf_page_views`, `activity_log`)
4. **Sync**: Add `sync_metadata` table for cloud sync (future)

### Not Included (Out of Scope v1)

- User accounts (single-user desktop app)
- Cloud sync (local SQLite only)
- Multi-device support (macOS-only initially)
- Full-text search across metadata (only PDF content)

---

## Testing the Schema

### Load the schema:
```bash
sqlite3 ~/Library/Application\ Support/com.edn-tracker/edn_tracker.db < schema.sql
```

### Verify structure:
```bash
sqlite3 edn_tracker.db ".tables"
sqlite3 edn_tracker.db ".schema pdf_documents"
sqlite3 edn_tracker.db "PRAGMA foreign_keys;"
```

### Insert sample data:
```sql
INSERT INTO pdf_documents (id, title, file_path, num_pages)
VALUES ('pdf-1', 'Cardio Collège', 'college/cardio.pdf', 300);

INSERT INTO pdf_pages (id, pdf_document_id, page_number, text_content)
VALUES ('pdf-1-page-1', 'pdf-1', 1, 'Hypertension definition...');

INSERT INTO anchors (id, type, source_type, source_id, pdf_document_id, page_number, label)
VALUES ('anchor-1', 'pdf_zone', 'pdf', 'pdf-1', 'pdf-1', 1, 'Definition HTA');
```

---

## Notes

- **PRAGMA foreign_keys = ON**: Enable referential integrity
- **PRAGMA journal_mode = WAL**: Write-Ahead Logging for concurrent reads while writing
- **PRAGMA synchronous = NORMAL**: Balance speed and durability
- **Timestamps**: All `CURRENT_TIMESTAMP` are UTC; convert in app as needed
