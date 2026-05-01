// Deck statistics commands
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;
use crate::db::DbPool;
use crate::scheduler;
use super::anki::ankiconnect_invoke;

// ─── Public structs ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeckReviewStats {
    pub deck_id: String,
    pub deck_name: String,
    pub new_count: i64,
    pub learn_count: i64,
    pub review_count: i64,
    pub total_in_deck: i64,
}

#[derive(Debug, Serialize)]
pub struct LocalAnkiStats {
    pub total_cards: i64,
    pub new_count: i64,
    pub learning_count: i64,
    pub review_count: i64,
    pub mature_count: i64,    // interval_days >= 21
    pub young_count: i64,     // 1 <= interval_days < 21
    pub avg_ease: f64,        // avg ease_factor/1000 for reviewed cards
    pub avg_interval: f64,    // avg interval_days for review cards
    pub retention_rate: f64,  // avg(1 - lapses/reps) for reviewed cards
    pub due_forecast: Vec<i64>, // due card count per day for next 7 days (day 0 = today)
}

// ─── AnkiConnect response shapes ─────────────────────────────────────────────

#[derive(Deserialize)]
struct DeckStatRaw {
    deck_id: i64,
    name: String,
    new_count: i64,
    learn_count: i64,
    review_count: i64,
    total_in_deck: i64,
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

/// Fetch review statistics for the given deck names via AnkiConnect `getDeckStats`.
/// Returns stats keyed by deck_id (as string).
#[tauri::command]
pub async fn anki_get_deck_review_stats(
    deck_names: Vec<String>,
) -> Result<Vec<DeckReviewStats>, String> {
    #[derive(Serialize)]
    struct Params {
        decks: Vec<String>,
    }

    let raw: HashMap<String, DeckStatRaw> =
        ankiconnect_invoke("getDeckStats", Params { decks: deck_names }).await?;

    let stats = raw
        .into_values()
        .map(|s| DeckReviewStats {
            deck_id: s.deck_id.to_string(),
            deck_name: s.name,
            new_count: s.new_count,
            learn_count: s.learn_count,
            review_count: s.review_count,
            total_in_deck: s.total_in_deck,
        })
        .collect();

    Ok(stats)
}

/// Return the number of cards reviewed today via AnkiConnect `getNumCardsReviewedToday`.
#[tauri::command]
pub async fn anki_get_reviews_today() -> Result<i64, String> {
    #[derive(Serialize)]
    struct Empty {}

    let count: i64 = ankiconnect_invoke("getNumCardsReviewedToday", Empty {}).await?;
    Ok(count)
}

/// Return the collection stats HTML via AnkiConnect `getCollectionStatsHTML`.
/// The HTML is returned as-is without any processing.
#[tauri::command]
pub async fn anki_get_collection_stats_html() -> Result<String, String> {
    #[derive(Serialize)]
    struct Params {
        period: u8,
    }

    let html: String =
        ankiconnect_invoke("getCollectionStatsHTML", Params { period: 1 }).await?;
    Ok(html)
}

// ─── Local stats ─────────────────────────────────────────────────────────────

/// Compute statistics from the local `anki_sched` table.
/// Works offline (no AnkiConnect needed). Optionally filtered by deck name.
#[tauri::command]
pub async fn anki_get_local_stats(
    pool: State<'_, DbPool>,
    deck_name: Option<String>,
) -> Result<LocalAnkiStats, String> {
    let db = pool.inner();

    // Build the optional WHERE clause fragment
    let deck_clause = if deck_name.is_some() {
        "AND deck_name = ?"
    } else {
        ""
    };

    // ── Counts by card_type ──────────────────────────────────────────────────
    let counts_sql = format!(
        r#"SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN card_type = 0 THEN 1 ELSE 0 END) AS new_c,
            SUM(CASE WHEN card_type IN (1,3) THEN 1 ELSE 0 END) AS learning_c,
            SUM(CASE WHEN card_type = 2 THEN 1 ELSE 0 END) AS review_c,
            SUM(CASE WHEN interval_days >= 21 THEN 1 ELSE 0 END) AS mature_c,
            SUM(CASE WHEN interval_days >= 1 AND interval_days < 21 THEN 1 ELSE 0 END) AS young_c,
            COALESCE(AVG(CASE WHEN reps > 0 THEN CAST(ease_factor AS REAL) END), 0.0) AS avg_ease,
            COALESCE(AVG(CASE WHEN card_type = 2 THEN CAST(interval_days AS REAL) END), 0.0) AS avg_interval,
            COALESCE(AVG(CASE WHEN reps > 0 THEN 1.0 - CAST(lapses AS REAL) / CAST(reps AS REAL) END), 0.0) AS retention
        FROM anki_sched WHERE 1=1 {deck_clause}"#
    );

    let row: (i64, i64, i64, i64, i64, i64, f64, f64, f64) = if let Some(ref name) = deck_name {
        sqlx::query_as(&counts_sql)
            .bind(name)
            .fetch_one(db)
            .await
            .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as(&counts_sql)
            .fetch_one(db)
            .await
            .map_err(|e| e.to_string())?
    };

    let (total_cards, new_count, learning_count, review_count, mature_count, young_count, avg_ease_raw, avg_interval, retention_rate) = row;
    let avg_ease = avg_ease_raw / 1000.0;

    // ── Due forecast (next 7 days) ─────────────────────────────────────────
    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let today = scheduler::unix_day(now_secs);

    let mut due_forecast = Vec::with_capacity(7);
    for i in 0i64..7 {
        let day = today + i;
        let forecast_sql = format!(
            r#"SELECT COUNT(*) FROM anki_sched
            WHERE (
                (card_type = 2 AND due = ?)
                OR (card_type IN (1,3) AND due / 86400 = ?)
            ) {deck_clause}"#
        );
        let count: i64 = if let Some(ref name) = deck_name {
            sqlx::query_scalar(&forecast_sql)
                .bind(day)
                .bind(day)
                .bind(name)
                .fetch_one(db)
                .await
                .unwrap_or(0)
        } else {
            sqlx::query_scalar(&forecast_sql)
                .bind(day)
                .bind(day)
                .fetch_one(db)
                .await
                .unwrap_or(0)
        };
        due_forecast.push(count);
    }

    Ok(LocalAnkiStats {
        total_cards,
        new_count,
        learning_count,
        review_count,
        mature_count,
        young_count,
        avg_ease,
        avg_interval,
        retention_rate,
        due_forecast,
    })
}
