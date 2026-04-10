// Deck statistics commands
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
