use crate::db::DbPool;
use serde::Serialize;
use sqlx::sqlite::SqlitePoolOptions;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub result_type: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub snippet: Option<String>,
    pub route: String,
}

/// Extract a short snippet of `max_len` chars around the first match of `query` in `text`.
fn extract_snippet(text: &str, query: &str, max_len: usize) -> String {
    let lower_text = text.to_lowercase();
    let lower_query = query.to_lowercase();
    let pos = lower_text.find(&lower_query).unwrap_or(0);
    let start = pos.saturating_sub(60);
    let end = (start + max_len).min(text.len());
    // Clamp to char boundaries
    let start = text
        .char_indices()
        .map(|(i, _)| i)
        .filter(|&i| i <= start)
        .last()
        .unwrap_or(0);
    let end = text
        .char_indices()
        .map(|(i, _)| i)
        .filter(|&i| i <= end)
        .last()
        .unwrap_or(text.len());
    let mut s = text[start..end].replace('\n', " ");
    if start > 0 {
        s = format!("…{s}");
    }
    if end < text.len() {
        s = format!("{s}…");
    }
    s
}

/// Strip simple HTML tags.
fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.trim().to_string()
}

/// Open the Anki collection file in read-only mode and search notes.
async fn search_anki_collection(
    collection_path: &str,
    like_pattern: &str,
    query: &str,
) -> Vec<SearchResult> {
    let url = format!("sqlite://{}?mode=ro", collection_path);
    let pool = match SqlitePoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(2))
        .connect(&url)
        .await
    {
        Ok(p) => p,
        Err(_) => return vec![],
    };

    // Try schema 18+ (decks table) first, fall back to col.decks JSON
    let deck_name_query = try_get_deck_names_map(&pool).await;

    // Search notes: sfld is the sort field (typically the "Front"), flds contains all fields
    let rows: Vec<(i64, String, String, Option<String>)> = match sqlx::query_as(
        "SELECT n.id, n.sfld, n.flds, n.tags
         FROM notes n
         WHERE lower(n.flds) LIKE lower(?)
         LIMIT 8",
    )
    .bind(like_pattern)
    .fetch_all(&pool)
    .await
    {
        Ok(r) => r,
        Err(_) => {
            pool.close().await;
            return vec![];
        }
    };

    let mut results = Vec::new();
    for (note_id, sfld, flds, tags) in rows {
        // Split fields on the Anki separator \x1f
        let fields: Vec<&str> = flds.split('\x1f').collect();
        let question = strip_html(fields.first().copied().unwrap_or(&sfld));
        let answer_raw = fields.get(1).copied().unwrap_or("");
        let answer = strip_html(answer_raw);

        // Find deck name: look for a card linked to this note
        let deck_name = get_deck_name_for_note(&pool, note_id, &deck_name_query).await;

        let title = if question.len() > 90 {
            format!("{}…", &question[..question.floor_char_boundary(90)])
        } else {
            question.clone()
        };

        let snippet = if !answer.is_empty() {
            Some(extract_snippet(&answer, query, 120))
        } else {
            tags.as_deref().filter(|t| !t.is_empty()).map(|t| t.to_string())
        };

        results.push(SearchResult {
            id: note_id.to_string(),
            result_type: "anki".into(),
            title,
            subtitle: deck_name,
            snippet,
            route: "/anki".into(),
        });
    }

    pool.close().await;
    results
}

/// Returns a map of deck_id → deck_name from the Anki collection.
async fn try_get_deck_names_map(pool: &sqlx::SqlitePool) -> std::collections::HashMap<i64, String> {
    // Schema 18+: decks table
    if let Ok(rows) = sqlx::query_as::<_, (i64, String)>("SELECT id, name FROM decks")
        .fetch_all(pool)
        .await
    {
        return rows.into_iter().collect();
    }

    // Schema <18: col.decks JSON
    if let Ok(Some((json,))) =
        sqlx::query_as::<_, (String,)>("SELECT decks FROM col LIMIT 1")
            .fetch_optional(pool)
            .await
    {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json) {
            if let Some(obj) = val.as_object() {
                return obj
                    .iter()
                    .filter_map(|(k, v)| {
                        let id = k.parse::<i64>().ok()?;
                        let name = v["name"].as_str()?.to_string();
                        Some((id, name))
                    })
                    .collect();
            }
        }
    }

    std::collections::HashMap::new()
}

/// Get deck name for a note by looking at its cards.
async fn get_deck_name_for_note(
    pool: &sqlx::SqlitePool,
    note_id: i64,
    deck_map: &std::collections::HashMap<i64, String>,
) -> Option<String> {
    let row: Option<(i64,)> = sqlx::query_as("SELECT did FROM cards WHERE nid = ? LIMIT 1")
        .bind(note_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

    row.and_then(|(did,)| deck_map.get(&did).cloned())
}

/// Global search across specialties, PDFs, EDN items, errors, and Anki notes.
#[tauri::command]
pub async fn global_search(
    query: String,
    db: State<'_, DbPool>,
) -> Result<Vec<SearchResult>, String> {
    let q = query.trim().to_string();
    if q.len() < 2 {
        return Ok(vec![]);
    }

    let like_pattern = format!("%{}%", q);
    let mut results: Vec<SearchResult> = Vec::new();

    // 1. Specialties (matières)
    let specialties = sqlx::query_as::<_, (String, String)>(
        "SELECT id, name FROM specialties WHERE lower(name) LIKE lower(?) LIMIT 6",
    )
    .bind(&like_pattern)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("search specialties: {e}"))?;

    for (id, name) in specialties {
        results.push(SearchResult {
            id: id.clone(),
            result_type: "specialty".into(),
            title: name,
            subtitle: Some("Matière".into()),
            snippet: None,
            route: format!("/items?specialty={id}"),
        });
    }

    // 2. EDN items (title or code)
    let items = sqlx::query_as::<_, (i64, String, String, String)>(
        "SELECT id, code, title, specialty_id FROM items
         WHERE lower(title) LIKE lower(?) OR lower(code) LIKE lower(?)
         LIMIT 8",
    )
    .bind(&like_pattern)
    .bind(&like_pattern)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("search items: {e}"))?;

    for (id, code, title, specialty_id) in items {
        results.push(SearchResult {
            id: id.to_string(),
            result_type: "item".into(),
            title,
            subtitle: Some(format!("{code} — {specialty_id}")),
            snippet: None,
            route: "/items".into(),
        });
    }

    // 3. PDF documents (by title)
    let pdf_docs = sqlx::query_as::<_, (String, String)>(
        "SELECT id, title FROM pdf_documents WHERE lower(title) LIKE lower(?) LIMIT 5",
    )
    .bind(&like_pattern)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("search pdf_documents: {e}"))?;

    for (id, title) in pdf_docs {
        results.push(SearchResult {
            id,
            result_type: "pdf_doc".into(),
            title,
            subtitle: Some("Document PDF".into()),
            snippet: None,
            route: "/pdfs".into(),
        });
    }

    // 4. PDF pages — FTS5 first (fast), fallback to LIKE if index is empty or query fails
    let fts_term = q
        .split_whitespace()
        .map(|w| format!("\"{}\"*", w.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" ");

    let pdf_pages_fts = sqlx::query_as::<_, (String, String, i64, Option<String>)>(
        "SELECT pp.id, d.title, pp.page_number, pp.text_content
         FROM pdf_pages_fts fts
         JOIN pdf_pages pp ON pp.rowid = fts.rowid
         JOIN pdf_documents d ON d.id = pp.pdf_document_id
         WHERE pdf_pages_fts MATCH ?
         ORDER BY fts.rank
         LIMIT 5",
    )
    .bind(&fts_term)
    .fetch_all(db.inner())
    .await;

    let pdf_pages: Vec<(String, String, i64, Option<String>)> = match pdf_pages_fts {
        Ok(rows) if !rows.is_empty() => rows,
        // FTS5 empty or failed — fall back to LIKE scan
        _ => sqlx::query_as::<_, (String, String, i64, Option<String>)>(
            "SELECT pp.id, d.title, pp.page_number, pp.text_content
             FROM pdf_pages pp
             JOIN pdf_documents d ON d.id = pp.pdf_document_id
             WHERE lower(pp.text_content) LIKE lower(?)
             ORDER BY pp.pdf_document_id, pp.page_number
             LIMIT 5",
        )
        .bind(&like_pattern)
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("search pdf_pages fallback: {e}"))?,
    };

    for (id, doc_title, page_num, text_content) in pdf_pages {
        let snippet = text_content
            .as_deref()
            .map(|t| extract_snippet(t, &q, 150));
        results.push(SearchResult {
            id,
            result_type: "pdf_page".into(),
            title: doc_title,
            subtitle: Some(format!("Page {page_num}")),
            snippet,
            route: "/pdfs".into(),
        });
    }

    // 5. Errors
    let errors = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT id, title, description FROM errors
         WHERE lower(title) LIKE lower(?) OR lower(description) LIKE lower(?)
         LIMIT 5",
    )
    .bind(&like_pattern)
    .bind(&like_pattern)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("search errors: {e}"))?;

    for (id, title, description) in errors {
        let snippet = description
            .as_deref()
            .map(|d| extract_snippet(d, &q, 120));
        results.push(SearchResult {
            id,
            result_type: "error".into(),
            title,
            subtitle: Some("Carnet d'erreurs".into()),
            snippet,
            route: "/errors".into(),
        });
    }

    // 6a. Anki — local anki_notes table (created via app or synced from AnkiConnect)
    let local_anki = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT n.id, n.question, n.answer, COALESCE(d.name, n.deck_id)
         FROM anki_notes n
         LEFT JOIN anki_decks d ON d.id = n.deck_id
         WHERE lower(n.question) LIKE lower(?)
            OR lower(n.answer) LIKE lower(?)
            OR lower(COALESCE(n.tags, '')) LIKE lower(?)
         LIMIT 5",
    )
    .bind(&like_pattern)
    .bind(&like_pattern)
    .bind(&like_pattern)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("search anki_notes: {e}"))?;

    for (id, question, answer, deck_name) in local_anki {
        let clean_q = strip_html(&question);
        let clean_a = strip_html(&answer);
        let title = if clean_q.len() > 90 {
            format!("{}…", &clean_q[..clean_q.floor_char_boundary(90)])
        } else {
            clean_q.clone()
        };
        results.push(SearchResult {
            id,
            result_type: "anki".into(),
            title,
            subtitle: Some(deck_name),
            snippet: if clean_a.is_empty() { None } else { Some(extract_snippet(&clean_a, &q, 100)) },
            route: "/anki".into(),
        });
    }

    // 6b. Anki — external collection file (if configured and local returned nothing)
    let local_anki_count = results.iter().filter(|r| r.result_type == "anki").count();
    if local_anki_count == 0 {
        if let Some(path) = get_collection_path(db.inner()).await {
            let collection_results = search_anki_collection(&path, &like_pattern, &q).await;
            results.extend(collection_results);
        }
    }

    Ok(results)
}

/// Retrieve Anki collection path from app_settings.
async fn get_collection_path(pool: &sqlx::SqlitePool) -> Option<String> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_settings WHERE key = 'anki_collection_path'")
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    row.map(|(v,)| v)
}
