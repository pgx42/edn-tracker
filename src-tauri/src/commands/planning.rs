use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Row types ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StudySessionRow {
    pub id: String,
    pub title: Option<String>,
    pub start_time: String,
    pub end_time: Option<String>,
    pub item_ids: Option<String>,   // JSON array
    pub note: Option<String>,
    pub completed: i32,
    pub calendar_event_id: Option<String>,
    pub item_id: Option<i64>,
    pub specialty_id: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSessionInput {
    pub title: String,
    pub start_time: String,
    pub end_time: String,
    pub item_id: Option<i64>,
    pub specialty_id: Option<String>,
    pub item_ids: Option<Vec<i32>>,
    pub notes: Option<String>,
}

// ── Info types (for planning detail panel) ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemPlanningInfo {
    pub item_id: i64,
    pub code: String,
    pub title: String,
    pub specialty_id: String,
    pub rank: String,
    pub description: Option<String>,
    pub linked_pdf_count: i64,
    pub linked_pdfs: Vec<LinkedPdf>,
    pub anki_note_count: i64,
    pub anki_notes: Vec<AnkiNoteSummary>,
    pub error_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedPdf {
    pub id: String,
    pub title: String,
    pub doc_type: Option<String>,
    pub num_pages: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnkiNoteSummary {
    pub id: String,
    pub question: String,
    pub deck_name: Option<String>,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// List sessions, optionally filtered by date range
#[tauri::command]
pub async fn get_sessions(
    date_from: Option<String>,
    date_to: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<StudySessionRow>, String> {
    let mut q = "SELECT id, title, start_time, end_time, item_ids, note, completed, \
                 calendar_event_id, item_id, specialty_id, created_at \
                 FROM study_sessions WHERE 1=1"
        .to_string();

    if date_from.is_some() {
        q.push_str(" AND start_time >= ?");
    }
    if date_to.is_some() {
        q.push_str(" AND start_time <= ?");
    }
    q.push_str(" ORDER BY start_time ASC");

    let mut query = sqlx::query_as::<_, StudySessionRow>(&q);
    if let Some(from) = &date_from {
        query = query.bind(from);
    }
    if let Some(to) = &date_to {
        query = query.bind(to);
    }

    query
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("get_sessions error: {e}"))
}

/// Create a new study session
#[tauri::command]
pub async fn create_session(
    input: CreateSessionInput,
    db: tauri::State<'_, DbPool>,
) -> Result<StudySessionRow, String> {
    let id = Uuid::new_v4().to_string();
    let item_ids_json = input
        .item_ids
        .as_ref()
        .map(|ids| serde_json::to_string(ids).unwrap_or_default());
    let duration_minutes = compute_duration_minutes(&input.start_time, &input.end_time);

    sqlx::query(
        "INSERT INTO study_sessions \
         (id, title, start_time, end_time, duration_minutes, item_ids, note, completed, \
          calendar_event_id, item_id, specialty_id) \
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)",
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&input.start_time)
    .bind(&input.end_time)
    .bind(duration_minutes)
    .bind(&item_ids_json)
    .bind(&input.notes)
    .bind(input.item_id)
    .bind(&input.specialty_id)
    .execute(db.inner())
    .await
    .map_err(|e| format!("create_session error: {e}"))?;

    Ok(StudySessionRow {
        id,
        title: Some(input.title),
        start_time: input.start_time,
        end_time: Some(input.end_time),
        item_ids: item_ids_json,
        note: input.notes,
        completed: 0,
        calendar_event_id: None,
        item_id: input.item_id,
        specialty_id: input.specialty_id,
        created_at: None,
    })
}

/// Toggle or update session completion
#[tauri::command]
pub async fn update_session(
    id: String,
    completed: bool,
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    sqlx::query("UPDATE study_sessions SET completed = ? WHERE id = ?")
        .bind(completed as i32)
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("update_session error: {e}"))?;
    Ok(())
}

/// Reschedule a session (drag & drop)
#[tauri::command]
pub async fn update_session_time(
    id: String,
    start_time: String,
    end_time: String,
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    let duration = compute_duration_minutes(&start_time, &end_time);
    sqlx::query(
        "UPDATE study_sessions SET start_time = ?, end_time = ?, duration_minutes = ? WHERE id = ?",
    )
    .bind(&start_time)
    .bind(&end_time)
    .bind(duration)
    .bind(&id)
    .execute(db.inner())
    .await
    .map_err(|e| format!("update_session_time error: {e}"))?;
    Ok(())
}

/// Update the Apple Calendar event ID after export
#[tauri::command]
pub async fn update_session_calendar_id(
    id: String,
    calendar_event_id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    sqlx::query("UPDATE study_sessions SET calendar_event_id = ? WHERE id = ?")
        .bind(&calendar_event_id)
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("update_session_calendar_id error: {e}"))?;
    Ok(())
}

/// Delete a session
#[tauri::command]
pub async fn delete_session(
    id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    let result = sqlx::query("DELETE FROM study_sessions WHERE id = ?")
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("delete_session error: {e}"))?;
    Ok(result.rows_affected() > 0)
}

/// Get rich planning info for an item (linked PDFs, Anki notes count, errors)
#[tauri::command]
pub async fn get_item_planning_info(
    item_id: i64,
    db: tauri::State<'_, DbPool>,
) -> Result<ItemPlanningInfo, String> {
    // Item base info
    let item = sqlx::query_as::<_, (i64, String, String, String, String, Option<String>)>(
        "SELECT id, specialty_id, code, title, rank, description FROM items WHERE id = ?",
    )
    .bind(item_id)
    .fetch_optional(db.inner())
    .await
    .map_err(|e| format!("item query error: {e}"))?
    .ok_or_else(|| format!("Item {item_id} not found"))?;

    let (iid, specialty_id, code, title, rank, description) = item;

    // PDFs linked to this item (via anchors → links)
    let linked_pdfs = sqlx::query_as::<_, (String, String, Option<String>, i64)>(
        "SELECT DISTINCT pd.id, pd.title, pd.doc_type, pd.num_pages \
         FROM pdf_documents pd \
         JOIN anchors a ON a.pdf_document_id = pd.id \
         JOIN links l ON l.source_anchor_id = a.id \
         WHERE l.target_type = 'item' AND l.target_id = ? \
         LIMIT 10",
    )
    .bind(item_id.to_string())
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("linked_pdfs query error: {e}"))?;

    let linked_pdf_count = linked_pdfs.len() as i64;
    let linked_pdfs: Vec<LinkedPdf> = linked_pdfs
        .into_iter()
        .map(|(id, title, doc_type, num_pages)| LinkedPdf { id, title, doc_type, num_pages })
        .collect();

    // Anki notes linked to this item
    let anki_notes = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT DISTINCT an.id, an.question, ad.name \
         FROM anki_notes an \
         LEFT JOIN anki_decks ad ON ad.id = an.deck_id \
         JOIN anchors a ON a.id = an.source_anchor_id \
         JOIN links l ON l.source_anchor_id = a.id \
         WHERE l.target_type = 'item' AND l.target_id = ? \
         LIMIT 10",
    )
    .bind(item_id.to_string())
    .fetch_all(db.inner())
    .await
    .unwrap_or_default();

    let anki_note_count = anki_notes.len() as i64;
    let anki_notes: Vec<AnkiNoteSummary> = anki_notes
        .into_iter()
        .map(|(id, question, deck_name)| AnkiNoteSummary { id, question, deck_name })
        .collect();

    // Error count for this item
    let (error_count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM errors WHERE item_id = ? AND resolved_at IS NULL",
    )
    .bind(item_id)
    .fetch_one(db.inner())
    .await
    .unwrap_or((0,));

    Ok(ItemPlanningInfo {
        item_id: iid,
        code,
        title,
        specialty_id,
        rank,
        description,
        linked_pdf_count,
        linked_pdfs,
        anki_note_count,
        anki_notes,
        error_count,
    })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn compute_duration_minutes(start: &str, end: &str) -> Option<i32> {
    let parse = |s: &str| -> Option<i64> {
        let s = s.trim_end_matches('Z');
        chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
            .or_else(|_| chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M"))
            .ok()
            .map(|dt| dt.and_utc().timestamp())
    };
    let diff = (parse(end)? - parse(start)?) / 60;
    if diff > 0 { Some(diff as i32) } else { None }
}
