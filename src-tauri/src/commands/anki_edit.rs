use serde::Serialize;
use tauri::State;
use crate::db::DbPool;
use super::anki::{ankiconnect_invoke, AnkiNoteRecord};

// ─── anki_update_note ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn anki_update_note(
    note_id: String,
    question: String,
    answer: String,
    extra_field: Option<String>,
    tags: Option<String>,
    db: State<'_, DbPool>,
) -> Result<AnkiNoteRecord, String> {
    // 1. Fetch the note from local DB to get anki_note_id
    let row: Option<(String, String, Option<String>, Option<String>, Option<i64>)> =
        sqlx::query_as(
            "SELECT n.id, n.deck_id, d.name, n.note_type, n.anki_note_id
             FROM anki_notes n
             LEFT JOIN anki_decks d ON d.id = n.deck_id
             WHERE n.id = ?",
        )
        .bind(&note_id)
        .fetch_optional(db.inner())
        .await
        .map_err(|e| format!("DB error: {}", e))?;

    let (id, deck_id, deck_name, note_type, anki_note_id) = row
        .ok_or_else(|| format!("Note not found: {}", note_id))?;

    // 2. If anki_note_id exists → update in Anki via AnkiConnect
    if let Some(anki_id) = anki_note_id {
        // Update fields
        #[derive(Serialize)]
        struct UpdateNoteFieldsParams {
            note: UpdateNoteFields,
        }
        #[derive(Serialize)]
        struct UpdateNoteFields {
            id: i64,
            fields: std::collections::HashMap<String, String>,
        }

        let mut fields = std::collections::HashMap::new();
        fields.insert("Front".to_string(), question.clone());
        fields.insert("Back".to_string(), answer.clone());

        let fields_params = UpdateNoteFieldsParams {
            note: UpdateNoteFields {
                id: anki_id,
                fields,
            },
        };

        // We attempt but don't fail if AnkiConnect is unavailable
        let _ = ankiconnect_invoke::<_, serde_json::Value>("updateNoteFields", fields_params).await;

        // Update tags
        if let Some(ref tags_str) = tags {
            #[derive(Serialize)]
            struct UpdateNoteTagsParams {
                note: i64,
                tags: Vec<String>,
            }

            let tag_list: Vec<String> = tags_str
                .split_whitespace()
                .filter(|t| !t.is_empty())
                .map(String::from)
                .collect();

            let tags_params = UpdateNoteTagsParams {
                note: anki_id,
                tags: tag_list,
            };

            let _ = ankiconnect_invoke::<_, serde_json::Value>("updateNoteTags", tags_params).await;
        }
    }

    // 3. Update local DB
    sqlx::query(
        "UPDATE anki_notes SET question = ?, answer = ?, extra_field = ?, tags = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(&question)
    .bind(&answer)
    .bind(&extra_field)
    .bind(&tags)
    .bind(&note_id)
    .execute(db.inner())
    .await
    .map_err(|e| format!("Failed to update note: {}", e))?;

    // 4. Return updated note
    Ok(AnkiNoteRecord {
        id,
        deck_id,
        deck_name,
        note_type,
        question,
        answer,
        extra_field,
        source_anchor_id: None,
        tags,
        anki_note_id,
        created_at: None,
        anki_created_at: None,
    })
}

// ─── anki_update_note_fields_direct ──────────────────────────────────────────
// Used during study: we only have the Anki note ID, no local UUID.

#[tauri::command]
pub async fn anki_update_note_fields_direct(
    anki_note_id: i64,
    question: String,
    answer: String,
) -> Result<(), String> {
    #[derive(Serialize)]
    struct Params { note: NoteFields }
    #[derive(Serialize)]
    struct NoteFields {
        id: i64,
        fields: std::collections::HashMap<String, String>,
    }

    let mut fields = std::collections::HashMap::new();
    fields.insert("Front".to_string(), question);
    fields.insert("Back".to_string(), answer);

    ankiconnect_invoke::<_, serde_json::Value>(
        "updateNoteFields",
        Params { note: NoteFields { id: anki_note_id, fields } },
    )
    .await
    .map_err(|e| format!("AnkiConnect error: {e}"))?;

    Ok(())
}

// ─── anki_delete_note ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn anki_delete_note(
    note_id: String,
    db: State<'_, DbPool>,
) -> Result<(), String> {
    // 1. Fetch anki_note_id from local DB
    let row: Option<(Option<i64>,)> =
        sqlx::query_as("SELECT anki_note_id FROM anki_notes WHERE id = ?")
            .bind(&note_id)
            .fetch_optional(db.inner())
            .await
            .map_err(|e| format!("DB error: {}", e))?;

    let (anki_note_id,) = row.ok_or_else(|| format!("Note not found: {}", note_id))?;

    // 2. If anki_note_id exists → delete from Anki via AnkiConnect
    if let Some(anki_id) = anki_note_id {
        #[derive(Serialize)]
        struct DeleteNotesParams {
            notes: Vec<i64>,
        }

        let params = DeleteNotesParams {
            notes: vec![anki_id],
        };

        // Attempt but don't fail if AnkiConnect is unavailable
        let _ = ankiconnect_invoke::<_, serde_json::Value>("deleteNotes", params).await;
    }

    // 3. Delete from local DB
    sqlx::query("DELETE FROM anki_notes WHERE id = ?")
        .bind(&note_id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("Failed to delete note: {}", e))?;

    Ok(())
}
