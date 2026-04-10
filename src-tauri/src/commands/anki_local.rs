/// Local Anki scheduler — stores cards in SQLite and computes intervals using
/// our SM-2 implementation so the app can study offline (no AnkiConnect needed).
///
/// Workflow:
///   1. `anki_sync_to_local`  — import cards from AnkiConnect into `anki_sched`
///   2. `anki_get_due_local`  — query due/new cards from local DB
///   3. `anki_answer_card_local` — apply scheduler, mark as needs_sync=1
///   4. `anki_push_to_anki`  — push unsynced answers to AnkiConnect & clear flag
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::debug;

use crate::db::DbPool;
use crate::scheduler::{self, CardSchedule, CardType, DeckConfig, Ease};
use super::anki::ankiconnect_invoke;

// ─── DB row ───────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct SchedRow {
    card_id: i64,
    note_id: i64,
    deck_name: String,
    deck_id: String,
    question: String,
    answer: String,
    card_type: i64,
    due: i64,
    interval_days: i64,
    ease_factor: i64,      // × 1000
    reps: i64,
    lapses: i64,
    remaining_steps: i64,
    last_review_day: Option<i64>,
}

impl SchedRow {
    fn to_schedule(&self) -> CardSchedule {
        CardSchedule {
            card_type: CardType::try_from(self.card_type).unwrap_or(CardType::New),
            due: self.due,
            interval: self.interval_days as u32,
            ease_factor: self.ease_factor as f32 / 1000.0,
            remaining_steps: self.remaining_steps as u8,
            lapses: self.lapses as u32,
            reps: self.reps as u32,
            last_review_day: self.last_review_day,
        }
    }
}

// ─── Frontend-facing card type (matches anki_study::StudyCard) ───────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalStudyCard {
    pub card_id: i64,
    pub note_id: i64,
    pub deck_name: String,
    pub question: String,
    pub answer: String,
    pub card_type: u8,
    pub interval: i64,
    pub ease_factor: i64,
    pub due: i64,
    pub reps: i64,
    pub lapses: i64,
}

// ─── AnkiConnect shapes ───────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct AcCardInfo {
    #[serde(rename = "cardId")]
    card_id: i64,
    #[serde(rename = "note")]
    note_id: i64,
    #[serde(rename = "deckName")]
    deck_name: String,
    question: String,
    answer: String,
    #[serde(default)]
    css: String,
    #[serde(rename = "type")]
    card_type: u8,
    interval: i64,
    factor: i64,
    due: i64,
    reps: i64,
    lapses: i64,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async fn deck_id_for(deck_name: &str) -> String {
    #[derive(serde::Serialize)]
    struct Empty {}
    let ids: std::collections::HashMap<String, i64> =
        ankiconnect_invoke("deckNamesAndIds", Empty {})
            .await
            .unwrap_or_default();
    ids.get(deck_name)
        .map(|id| id.to_string())
        .unwrap_or_else(|| deck_name.to_string())
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Sync all due + new cards for a deck from AnkiConnect into the local `anki_sched` table.
/// Returns the number of cards stored.
#[tauri::command]
pub async fn anki_sync_to_local(
    deck_name: Option<String>,
    db: State<'_, DbPool>,
) -> Result<usize, String> {
    #[derive(serde::Serialize)]
    struct FindParams { query: String }
    #[derive(serde::Serialize)]
    struct InfoParams { cards: Vec<i64> }

    let due_query = match &deck_name {
        Some(n) => format!("deck:\"{}\" (is:due OR is:learn OR is:new)", n),
        None => "(is:due OR is:learn OR is:new)".to_string(),
    };

    let card_ids: Vec<i64> = ankiconnect_invoke("findCards", FindParams { query: due_query })
        .await
        .map_err(|e| format!("findCards failed: {e}"))?;

    if card_ids.is_empty() {
        return Ok(0);
    }

    let now = now_secs();
    let today = scheduler::unix_day(now);
    let mut stored = 0usize;

    for chunk in card_ids.chunks(50) {
        let infos: Vec<AcCardInfo> = ankiconnect_invoke(
            "cardsInfo",
            InfoParams { cards: chunk.to_vec() },
        )
        .await
        .map_err(|e| format!("cardsInfo failed: {e}"))?;

        let pool = db.inner();
        for info in infos {
            let style_block = if info.css.is_empty() {
                String::new()
            } else {
                format!("<style>{}</style>", info.css)
            };
            let question = format!("{}{}", style_block, info.question);
            let answer = format!("{}{}", style_block, info.answer);

            let deck_id = deck_id_for(&info.deck_name).await;

            // Convert Anki's due to our day-based format for review cards.
            // For learning (type 1,3) Anki's due is already a Unix timestamp.
            // For review (type 2) Anki's due is an Anki day ordinal — we treat
            // cards fetched as "due" as due today (is:due query ensures this).
            let local_due = match info.card_type {
                2 => today, // review card returned by is:due → mark due today
                0 => today, // new card → mark due today
                _ => {
                    // Learning / relearning — due is Unix timestamp
                    // If it's in the past, it's due now
                    if info.due < now { now } else { info.due }
                }
            };

            let card_type = info.card_type as i64;
            let interval = info.interval.max(0);
            let ease = info.factor; // already × 1000
            let remaining_steps = match info.card_type {
                1 => 1i64, // learning — assume 1 step remaining
                3 => 1i64, // relearning
                _ => 0i64,
            };

            sqlx::query(
                "INSERT OR REPLACE INTO anki_sched (
                    card_id, note_id, deck_name, deck_id,
                    question, answer,
                    card_type, due, interval_days,
                    ease_factor, reps, lapses,
                    remaining_steps, last_review_day,
                    needs_sync, last_synced_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)"
            )
            .bind(info.card_id)
            .bind(info.note_id)
            .bind(&info.deck_name)
            .bind(&deck_id)
            .bind(&question)
            .bind(&answer)
            .bind(card_type)
            .bind(local_due)
            .bind(interval)
            .bind(ease)
            .bind(info.reps)
            .bind(info.lapses)
            .bind(remaining_steps)
            .bind(Option::<i64>::None) // last_review_day unknown at import
            .bind(now)
            .execute(pool)
            .await
            .map_err(|e| format!("DB insert failed: {e}"))?;

            stored += 1;
        }
    }

    debug!("anki_sync_to_local: stored {stored} cards");
    Ok(stored)
}

/// Return due + new cards from the local DB, sorted by type (review first, then learning, then new).
#[tauri::command]
pub async fn anki_get_due_local(
    deck_name: Option<String>,
    db: State<'_, DbPool>,
) -> Result<Vec<LocalStudyCard>, String> {
    let now = now_secs();
    let today = scheduler::unix_day(now);

    let rows: Vec<SchedRow> = match &deck_name {
        Some(name) => sqlx::query_as(
            "SELECT card_id, note_id, deck_name, deck_id, question, answer,
                    card_type, due, interval_days, ease_factor, reps, lapses,
                    remaining_steps, last_review_day
             FROM anki_sched
             WHERE deck_name = ?
               AND (
                 (card_type = 2 AND due <= ?)       -- review due today
                 OR (card_type IN (1,3) AND due <= ?)  -- learning/relearning due now
                 OR card_type = 0                    -- new cards always available
               )
             ORDER BY
               CASE card_type WHEN 1 THEN 0 WHEN 3 THEN 0 WHEN 2 THEN 1 ELSE 2 END,
               due ASC
             LIMIT 200"
        )
        .bind(name)
        .bind(today)
        .bind(now)
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("DB error: {e}"))?,

        None => sqlx::query_as(
            "SELECT card_id, note_id, deck_name, deck_id, question, answer,
                    card_type, due, interval_days, ease_factor, reps, lapses,
                    remaining_steps, last_review_day
             FROM anki_sched
             WHERE (card_type = 2 AND due <= ?)
                OR (card_type IN (1,3) AND due <= ?)
                OR card_type = 0
             ORDER BY
               CASE card_type WHEN 1 THEN 0 WHEN 3 THEN 0 WHEN 2 THEN 1 ELSE 2 END,
               due ASC
             LIMIT 200"
        )
        .bind(today)
        .bind(now)
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("DB error: {e}"))?,
    };

    Ok(rows.iter().map(|r| LocalStudyCard {
        card_id: r.card_id,
        note_id: r.note_id,
        deck_name: r.deck_name.clone(),
        question: r.question.clone(),
        answer: r.answer.clone(),
        card_type: r.card_type as u8,
        interval: r.interval_days,
        ease_factor: r.ease_factor,
        due: r.due,
        reps: r.reps,
        lapses: r.lapses,
    }).collect())
}

/// Apply the scheduler to a card answer and update the local DB.
/// Also attempts to push the answer to AnkiConnect immediately (best-effort).
#[tauri::command]
pub async fn anki_answer_card_local(
    card_id: i64,
    ease: u8,
    db: State<'_, DbPool>,
) -> Result<(), String> {
    let ease = Ease::try_from(ease)?;
    let pool = db.inner();

    // Fetch current card state
    let row: Option<SchedRow> = sqlx::query_as(
        "SELECT card_id, note_id, deck_name, deck_id, question, answer,
                card_type, due, interval_days, ease_factor, reps, lapses,
                remaining_steps, last_review_day
         FROM anki_sched WHERE card_id = ?"
    )
    .bind(card_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DB fetch: {e}"))?;

    let row = row.ok_or_else(|| format!("Card {card_id} not found in local DB"))?;
    let schedule = row.to_schedule();
    let config = DeckConfig::default();
    let now = now_secs();

    let next = scheduler::answer_card(&schedule, ease, &config, now, card_id);

    // Persist updated schedule
    sqlx::query(
        "UPDATE anki_sched SET
            card_type = ?, due = ?, interval_days = ?,
            ease_factor = ?, reps = ?, lapses = ?,
            remaining_steps = ?, last_review_day = ?,
            needs_sync = 1, pending_ease = ?
         WHERE card_id = ?"
    )
    .bind(next.card_type as i64)
    .bind(next.due)
    .bind(next.interval as i64)
    .bind((next.ease_factor * 1000.0).round() as i64)
    .bind(next.reps as i64)
    .bind(next.lapses as i64)
    .bind(next.remaining_steps as i64)
    .bind(next.last_review_day)
    .bind(ease as u8)
    .bind(card_id)
    .execute(pool)
    .await
    .map_err(|e| format!("DB update: {e}"))?;

    // Best-effort immediate sync to Anki
    let _ = push_one_answer(card_id, ease as u8, pool).await;

    Ok(())
}

/// Preview the 4 next intervals for a card (Again/Hard/Good/Easy).
/// Returns values in same format as `anki_get_card_intervals`:
///   - negative = learning delay in seconds
///   - positive = review interval in days
#[tauri::command]
pub async fn anki_get_intervals_local(
    card_id: i64,
    db: State<'_, DbPool>,
) -> Result<Vec<i64>, String> {
    let row: Option<SchedRow> = sqlx::query_as(
        "SELECT card_id, note_id, deck_name, deck_id, question, answer,
                card_type, due, interval_days, ease_factor, reps, lapses,
                remaining_steps, last_review_day
         FROM anki_sched WHERE card_id = ?"
    )
    .bind(card_id)
    .fetch_optional(db.inner())
    .await
    .map_err(|e| format!("DB fetch: {e}"))?;

    let row = row.ok_or_else(|| format!("Card {card_id} not found in local DB"))?;
    let schedule = row.to_schedule();
    let config = DeckConfig::default();
    let now = now_secs();

    let intervals = scheduler::preview_intervals(&schedule, &config, now, card_id);
    Ok(intervals.to_vec())
}

/// Push all locally-answered cards (needs_sync=1) to AnkiConnect, then clear the flag.
/// Returns the number of cards successfully synced.
#[tauri::command]
pub async fn anki_push_to_anki(db: State<'_, DbPool>) -> Result<u32, String> {
    let pool = db.inner();

    let pending: Vec<(i64, Option<i64>)> = sqlx::query_as(
        "SELECT card_id, pending_ease FROM anki_sched WHERE needs_sync = 1"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("DB fetch: {e}"))?;

    let mut synced = 0u32;
    for (card_id, pending_ease) in pending {
        let ease = pending_ease.unwrap_or(3) as u8;
        if push_one_answer(card_id, ease, pool).await.is_ok() {
            sqlx::query("UPDATE anki_sched SET needs_sync = 0, pending_ease = NULL WHERE card_id = ?")
                .bind(card_id)
                .execute(pool)
                .await
                .ok();
            synced += 1;
        }
    }

    Ok(synced)
}

async fn push_one_answer(card_id: i64, ease: u8, _pool: &crate::db::DbPool) -> Result<(), String> {
    #[derive(serde::Serialize)]
    struct CardAnswer {
        #[serde(rename = "cardId")]
        card_id: i64,
        ease: u8,
    }
    #[derive(serde::Serialize)]
    struct Params { cards: Vec<CardAnswer> }

    let _: bool = ankiconnect_invoke(
        "answerCards",
        Params { cards: vec![CardAnswer { card_id, ease }] },
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
