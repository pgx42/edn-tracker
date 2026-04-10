use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::debug;

use super::anki::ankiconnect_invoke;
use crate::scheduler::{self, CardSchedule, CardType, DeckConfig};

// ─── Public structs ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StudyCard {
    pub card_id: i64,
    pub note_id: i64,
    pub deck_name: String,
    pub question: String,
    pub answer: String,
    pub card_type: u8,  // 0=new, 1=learning, 2=review
    pub interval: i64,
    pub ease_factor: i64, // divide by 1000 to get real factor
    pub due: i64,
    pub reps: i64,
    pub lapses: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StudySummary {
    pub new_count: i64,
    pub learn_count: i64,
    pub review_count: i64,
    pub total_in_deck: i64,
}

// ─── AnkiConnect response shapes ─────────────────────────────────────────────

#[derive(Deserialize)]
struct CardInfo {
    #[serde(rename = "cardId")]
    card_id: i64,
    #[serde(rename = "note")]
    note_id: i64,
    #[serde(rename = "deckName")]
    deck_name: String,
    /// Fully rendered question HTML (template applied — works for all note types incl. image occlusion)
    question: String,
    /// Fully rendered answer HTML
    answer: String,
    /// Note-type CSS (separate from rendered HTML; must be injected as <style> block)
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

#[derive(Deserialize)]
struct DeckStats {
    #[serde(rename = "new_count")]
    new_count: i64,
    #[serde(rename = "learn_count")]
    learn_count: i64,
    #[serde(rename = "review_count")]
    review_count: i64,
    #[serde(rename = "total_in_deck")]
    total_in_deck: i64,
}


async fn fetch_cards_info(card_ids: Vec<i64>) -> Result<Vec<StudyCard>, String> {
    if card_ids.is_empty() {
        return Ok(vec![]);
    }

    let mut all_cards: Vec<StudyCard> = Vec::new();

    // Process in batches of 50 to avoid overwhelming AnkiConnect
    for chunk in card_ids.chunks(50) {
        #[derive(Serialize)]
        struct CardsInfoParams {
            cards: Vec<i64>,
        }

        let infos: Vec<CardInfo> = ankiconnect_invoke(
            "cardsInfo",
            CardsInfoParams {
                cards: chunk.to_vec(),
            },
        )
        .await?;

        for info in infos {
            debug!(
                card_id = info.card_id,
                css_len = info.css.len(),
                question_len = info.question.len(),
                question_preview = %&info.question[..info.question.len().min(200)],
                css_preview = %&info.css[..info.css.len().min(300)],
                "cardsInfo card"
            );

            // Prepend note-type CSS so positioning/layout rules apply (e.g. image occlusion)
            let style_block = if info.css.is_empty() {
                String::new()
            } else {
                format!("<style>{}</style>", info.css)
            };
            all_cards.push(StudyCard {
                card_id: info.card_id,
                note_id: info.note_id,
                deck_name: info.deck_name,
                question: format!("{}{}", style_block, info.question),
                answer: format!("{}{}", style_block, info.answer),
                card_type: info.card_type,
                interval: info.interval,
                ease_factor: info.factor,
                due: info.due,
                reps: info.reps,
                lapses: info.lapses,
            });
        }
    }

    Ok(all_cards)
}

async fn find_card_ids(query: &str) -> Result<Vec<i64>, String> {
    #[derive(Serialize)]
    struct FindCardsParams {
        query: String,
    }

    ankiconnect_invoke(
        "findCards",
        FindCardsParams {
            query: query.to_string(),
        },
    )
    .await
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn anki_get_due_cards(deck_name: Option<String>) -> Result<Vec<StudyCard>, String> {
    let query = match &deck_name {
        Some(name) => format!("deck:\"{}\" is:due", name),
        None => "is:due".to_string(),
    };

    let card_ids = find_card_ids(&query).await?;
    fetch_cards_info(card_ids).await
}

#[tauri::command]
pub async fn anki_get_new_cards(deck_name: Option<String>) -> Result<Vec<StudyCard>, String> {
    let query = match &deck_name {
        Some(name) => format!("deck:\"{}\" is:new", name),
        None => "is:new".to_string(),
    };

    let card_ids = find_card_ids(&query).await?;
    fetch_cards_info(card_ids).await
}

#[tauri::command]
pub async fn anki_answer_card(card_id: i64, ease: u8) -> Result<(), String> {
    #[derive(Serialize)]
    struct CardAnswer {
        #[serde(rename = "cardId")]
        card_id: i64,
        ease: u8,
    }

    #[derive(Serialize)]
    struct AnswerCardsParams {
        cards: Vec<CardAnswer>,
    }

    // AnkiConnect returns bool (true on success)
    let _success: bool = ankiconnect_invoke(
        "answerCards",
        AnswerCardsParams {
            cards: vec![CardAnswer { card_id, ease }],
        },
    )
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn anki_get_study_summary(deck_name: Option<String>) -> Result<StudySummary, String> {
    #[derive(Serialize)]
    struct GetDeckStatsParams {
        decks: Vec<String>,
    }

    // We need the deck name; if none, use a special marker and aggregate
    let deck_query = match &deck_name {
        Some(name) => name.clone(),
        None => "Default".to_string(), // will be replaced by aggregation path
    };

    if deck_name.is_none() {
        // Get all decks first, then sum stats
        #[derive(Serialize)]
        struct Empty {}

        let all_deck_names: Vec<String> =
            ankiconnect_invoke("deckNames", Empty {}).await?;

        if all_deck_names.is_empty() {
            return Ok(StudySummary {
                new_count: 0,
                learn_count: 0,
                review_count: 0,
                total_in_deck: 0,
            });
        }

        let stats_map: HashMap<String, DeckStats> = ankiconnect_invoke(
            "getDeckStats",
            GetDeckStatsParams {
                decks: all_deck_names,
            },
        )
        .await?;

        let summary = stats_map.values().fold(
            StudySummary {
                new_count: 0,
                learn_count: 0,
                review_count: 0,
                total_in_deck: 0,
            },
            |mut acc, s| {
                acc.new_count += s.new_count;
                acc.learn_count += s.learn_count;
                acc.review_count += s.review_count;
                acc.total_in_deck += s.total_in_deck;
                acc
            },
        );

        return Ok(summary);
    }

    let stats_map: HashMap<String, DeckStats> = ankiconnect_invoke(
        "getDeckStats",
        GetDeckStatsParams {
            decks: vec![deck_query],
        },
    )
    .await?;

    let summary = stats_map.values().fold(
        StudySummary {
            new_count: 0,
            learn_count: 0,
            review_count: 0,
            total_in_deck: 0,
        },
        |mut acc, s| {
            acc.new_count += s.new_count;
            acc.learn_count += s.learn_count;
            acc.review_count += s.review_count;
            acc.total_in_deck += s.total_in_deck;
            acc
        },
    );

    Ok(summary)
}

/// Return [again, hard, good, easy] projected intervals for a card.
///
/// Computed locally using our SM-2 scheduler so we always return exactly 4 values
/// regardless of card type. (AnkiConnect's `getIntervals` returns only 2–3 values
/// for new/learning cards which don't have a Hard button in Anki's native UI.)
///
/// Positive value = review interval in days.
/// Negative value = learning delay in seconds (absolute value).
#[tauri::command]
pub async fn anki_get_card_intervals(card_id: i64) -> Result<Vec<i64>, String> {
    // Fetch card info from AnkiConnect to build the current schedule
    #[derive(Serialize)]
    struct InfoParams { cards: Vec<i64> }

    #[derive(Deserialize)]
    struct RawCard {
        #[serde(rename = "type")]
        card_type: u8,
        interval: i64,
        factor: i64,
        due: i64,
        reps: i64,
        lapses: i64,
    }

    let infos: Vec<RawCard> = ankiconnect_invoke(
        "cardsInfo",
        InfoParams { cards: vec![card_id] },
    )
    .await?;

    let info = infos.into_iter().next()
        .ok_or_else(|| format!("Card {card_id} not found"))?;

    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let today = scheduler::unix_day(now_secs);

    // Convert to our CardSchedule
    let card_type = CardType::try_from(info.card_type as i64).unwrap_or(CardType::New);
    let interval = info.interval.max(0) as u32;

    // Reconstruct due in our format:
    //  - review cards: due was an Anki day ordinal; estimate from today
    //  - learning: due is already a unix timestamp from Anki
    let due = match card_type {
        CardType::Review => today,   // compute relative to today for preview purposes
        CardType::New => today,
        _ => {
            // learning/relearning: Anki due is a unix timestamp
            if info.due > 0 { info.due } else { now_secs }
        }
    };

    let card = CardSchedule {
        card_type,
        due,
        interval,
        ease_factor: info.factor as f32 / 1000.0,
        remaining_steps: match card_type {
            CardType::Learning | CardType::Relearning => 1,
            _ => 0,
        },
        lapses: info.lapses as u32,
        reps: info.reps as u32,
        last_review_day: None,
    };

    let config = DeckConfig::default();
    let intervals = scheduler::preview_intervals(&card, &config, now_secs, card_id);
    Ok(intervals.to_vec())
}
