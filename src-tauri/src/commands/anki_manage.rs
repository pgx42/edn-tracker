// Card management commands
use serde::Serialize;
use tauri::State;
use crate::db::DbPool;
use super::anki::ankiconnect_invoke;

// ─── AnkiConnect param structs ────────────────────────────────────────────────

#[derive(Serialize)]
struct FindCardsParams {
    query: String,
}

#[derive(Serialize)]
struct SuspendParams {
    cards: Vec<i64>,
}

#[derive(Serialize)]
struct IsSuspendedParams {
    card: i64,
}

#[derive(Serialize)]
struct ChangeDeckParams {
    cards: Vec<i64>,
    deck: String,
}

// ─── Helper: collect all Anki card IDs for a list of local note UUIDs ─────────

async fn find_cards_for_notes(
    note_ids: &[String],
    pool: &sqlx::SqlitePool,
) -> Result<Vec<i64>, String> {
    let mut all_card_ids: Vec<i64> = Vec::new();

    for note_id in note_ids {
        // Fetch anki_note_id from local DB
        let row: Option<(Option<i64>,)> =
            sqlx::query_as("SELECT anki_note_id FROM anki_notes WHERE id = ?")
                .bind(note_id)
                .fetch_optional(pool)
                .await
                .map_err(|e| format!("DB error: {e}"))?;

        let anki_note_id = match row {
            Some((Some(id),)) => id,
            _ => continue, // no anki_note_id, skip silently
        };

        let query = format!("nid:{anki_note_id}");
        let card_ids: Vec<i64> = ankiconnect_invoke("findCards", FindCardsParams { query })
            .await
            .map_err(|e| format!("findCards failed for note {note_id}: {e}"))?;

        all_card_ids.extend(card_ids);
    }

    Ok(all_card_ids)
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn anki_suspend_notes(
    note_ids: Vec<String>,
    db: State<'_, DbPool>,
) -> Result<(), String> {
    let card_ids = find_cards_for_notes(&note_ids, db.inner()).await?;
    if card_ids.is_empty() {
        return Ok(());
    }
    let _: bool = ankiconnect_invoke("suspend", SuspendParams { cards: card_ids })
        .await
        .map_err(|e| format!("suspend failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn anki_unsuspend_notes(
    note_ids: Vec<String>,
    db: State<'_, DbPool>,
) -> Result<(), String> {
    let card_ids = find_cards_for_notes(&note_ids, db.inner()).await?;
    if card_ids.is_empty() {
        return Ok(());
    }
    let _: bool = ankiconnect_invoke("unsuspend", SuspendParams { cards: card_ids })
        .await
        .map_err(|e| format!("unsuspend failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn anki_is_card_suspended(
    note_id: String,
    db: State<'_, DbPool>,
) -> Result<Option<bool>, String> {
    let row: Option<(Option<i64>,)> =
        sqlx::query_as("SELECT anki_note_id FROM anki_notes WHERE id = ?")
            .bind(&note_id)
            .fetch_optional(db.inner())
            .await
            .map_err(|e| format!("DB error: {e}"))?;

    let anki_note_id = match row {
        Some((Some(id),)) => id,
        _ => return Ok(None),
    };

    let query = format!("nid:{anki_note_id}");
    let card_ids: Vec<i64> = match ankiconnect_invoke("findCards", FindCardsParams { query }).await {
        Ok(ids) => ids,
        Err(_) => return Ok(None),
    };

    let first_card = match card_ids.into_iter().next() {
        Some(id) => id,
        None => return Ok(None),
    };

    let suspended: bool =
        match ankiconnect_invoke("suspended", IsSuspendedParams { card: first_card }).await {
            Ok(v) => v,
            Err(_) => return Ok(None),
        };

    Ok(Some(suspended))
}

#[tauri::command]
pub async fn anki_move_notes_to_deck(
    note_ids: Vec<String>,
    target_deck_name: String,
    db: State<'_, DbPool>,
) -> Result<(), String> {
    let card_ids = find_cards_for_notes(&note_ids, db.inner()).await?;
    if card_ids.is_empty() {
        return Ok(());
    }

    // Move cards in Anki
    ankiconnect_invoke::<_, serde_json::Value>(
        "changeDeck",
        ChangeDeckParams {
            cards: card_ids,
            deck: target_deck_name.clone(),
        },
    )
    .await
    .map_err(|e| format!("changeDeck failed: {e}"))?;

    // Update deck_id in local DB (look up by name)
    let deck_row: Option<(String,)> =
        sqlx::query_as("SELECT id FROM anki_decks WHERE name = ?")
            .bind(&target_deck_name)
            .fetch_optional(db.inner())
            .await
            .map_err(|e| format!("DB error looking up deck: {e}"))?;

    if let Some((deck_id,)) = deck_row {
        for note_id in &note_ids {
            sqlx::query("UPDATE anki_notes SET deck_id = ? WHERE id = ?")
                .bind(&deck_id)
                .bind(note_id)
                .execute(db.inner())
                .await
                .map_err(|e| format!("DB update error: {e}"))?;
        }
    }

    Ok(())
}
