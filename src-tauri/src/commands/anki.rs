use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use tauri::State;

use crate::db::DbPool;

// ─── Public structs ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnkiDeck {
    pub id: String,
    pub name: String,
    pub card_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnkiNoteRecord {
    pub id: String,
    pub deck_id: String,
    pub deck_name: Option<String>,
    pub note_type: Option<String>,
    pub question: String,
    pub answer: String,
    pub extra_field: Option<String>,
    pub source_anchor_id: Option<String>,
    pub tags: Option<String>,
    pub anki_note_id: Option<i64>,
    pub created_at: Option<String>,
    pub anki_created_at: Option<String>,
}

// ─── AnkiConnect HTTP client ─────────────────────────────────────────────────

const ANKICONNECT_URL: &str = "http://127.0.0.1:8765";

#[derive(Serialize)]
struct AnkiConnectRequest<P: Serialize> {
    action: &'static str,
    version: u8,
    params: P,
}

#[derive(Deserialize)]
struct AnkiConnectResponse<T> {
    result: Option<T>,
    error: Option<String>,
}

/// Invoke an AnkiConnect action. Returns Err if the HTTP call fails or AnkiConnect returns an error.
pub async fn ankiconnect_invoke<P: Serialize, T: serde::de::DeserializeOwned>(
    action: &'static str,
    params: P,
) -> Result<T, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let body = AnkiConnectRequest {
        action,
        version: 6,
        params,
    };

    let resp = client
        .post(ANKICONNECT_URL)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AnkiConnect unreachable: {}", e))?;

    let parsed: AnkiConnectResponse<T> = resp
        .json()
        .await
        .map_err(|e| format!("AnkiConnect response parse error: {}", e))?;

    match (parsed.result, parsed.error) {
        (Some(r), None) => Ok(r),
        (Some(r), Some(e)) if e.is_empty() || e == "null" => Ok(r),
        (_, Some(e)) => Err(format!("AnkiConnect error: {}", e)),
        (None, None) => Err("AnkiConnect returned empty response".to_string()),
    }
}

// ─── Private helpers ─────────────────────────────────────────────────────────

pub(crate) async fn get_collection_path(pool: &SqlitePool) -> Option<String> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_settings WHERE key = 'anki_collection_path'")
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    row.map(|(v,)| v)
}

async fn open_anki_pool(path: &str, readonly: bool) -> Result<SqlitePool, String> {
    let mode = if readonly { "ro" } else { "rwc" };
    let url = format!("sqlite://{}?mode={}", path, mode);

    SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&url)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("SQLITE_BUSY") || msg.contains("database is locked") {
                "Fermez Anki avant d'utiliser cette fonctionnalité".to_string()
            } else {
                format!("Failed to open Anki collection: {}", msg)
            }
        })
}

async fn find_basic_model_id(anki_pool: &SqlitePool) -> Result<i64, String> {
    // Schema 15+: notetypes table
    let row: Option<(i64, String)> =
        sqlx::query_as("SELECT id, name FROM notetypes LIMIT 100")
            .fetch_optional(anki_pool)
            .await
            .ok()
            .flatten();

    if row.is_some() {
        // notetypes table exists — query it properly
        let rows: Vec<(i64, String)> =
            sqlx::query_as("SELECT id, name FROM notetypes")
                .fetch_all(anki_pool)
                .await
                .map_err(|e| format!("Failed to read notetypes: {}", e))?;

        for (id, name) in &rows {
            if name == "Basic" || name == "De base" || name.starts_with("Basic") || name == "Basique" {
                return Ok(*id);
            }
        }
        if let Some((id, _)) = rows.first() {
            return Ok(*id);
        }
    }

    // Schema < 15: fallback to col.models JSON
    let row: Option<(String,)> = sqlx::query_as("SELECT models FROM col LIMIT 1")
        .fetch_optional(anki_pool)
        .await
        .map_err(|e| format!("Failed to read col: {}", e))?;

    let models_json = match row {
        Some((json,)) => json,
        None => return Err("No col row found in Anki collection".to_string()),
    };

    let models: serde_json::Value =
        serde_json::from_str(&models_json).map_err(|e| format!("Failed to parse models: {}", e))?;

    if let Some(obj) = models.as_object() {
        for (id_str, model) in obj.iter() {
            let name = model["name"].as_str().unwrap_or("");
            if name == "Basic" || name == "De base" || name.starts_with("Basic") || name == "Basique" {
                if let Ok(id) = id_str.parse::<i64>() {
                    return Ok(id);
                }
            }
        }
        if let Some((id_str, _)) = obj.iter().next() {
            if let Ok(id) = id_str.parse::<i64>() {
                return Ok(id);
            }
        }
    }

    Err("No model found in Anki collection".to_string())
}

fn compute_csum(sfld: &str) -> u32 {
    let mut hasher = Sha1::new();
    hasher.update(sfld.as_bytes());
    let result = hasher.finalize();
    u32::from_be_bytes([result[0], result[1], result[2], result[3]])
}

fn random_guid() -> String {
    const BASE91_CHARS: &[u8] =
        b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"";

    let uuid_bytes = uuid::Uuid::new_v4().as_bytes().to_vec();
    let mut out = String::with_capacity(10);
    let mut n: u64 = 0;
    for i in 0..8 {
        n = (n << 8) | (uuid_bytes[i] as u64);
    }
    for _ in 0..10 {
        out.push(BASE91_CHARS[(n % 91) as usize] as char);
        n /= 91;
    }
    out
}

/// Ensure a deck with the given (Anki) id and name exists in the local anki_decks table.
async fn upsert_local_deck(pool: &SqlitePool, id: &str, name: &str) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO anki_decks (id, name) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name",
    )
    .bind(id)
    .bind(name)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to upsert deck: {}", e))?;
    Ok(())
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

/// Ping AnkiConnect and return true if it's available (version >= 6).
#[tauri::command]
pub async fn anki_check_connection() -> Result<bool, String> {
    #[derive(Serialize)]
    struct Empty {}

    match ankiconnect_invoke::<_, serde_json::Value>("version", Empty {}).await {
        Ok(v) => Ok(v.as_u64().unwrap_or(0) >= 6),
        Err(_) => Ok(false),
    }
}

/// Open a file dialog to select an Anki collection (.anki2) and save the path.
#[tauri::command]
pub async fn select_anki_collection(
    db: State<'_, DbPool>,
) -> Result<Option<String>, String> {
    let path = tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("Anki Collection", &["anki2"])
            .pick_file()
    })
    .await
    .map_err(|e| format!("Dialog spawn error: {}", e))?;

    let path_str = match path {
        Some(p) => p.to_string_lossy().to_string(),
        None => return Ok(None),
    };

    sqlx::query(
        "INSERT INTO app_settings (key, value) VALUES ('anki_collection_path', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(&path_str)
    .execute(db.inner())
    .await
    .map_err(|e| format!("Failed to save collection path: {}", e))?;

    Ok(Some(path_str))
}

/// Return the stored Anki collection path from app_settings.
#[tauri::command]
pub async fn get_anki_collection_path(
    db: State<'_, DbPool>,
) -> Result<Option<String>, String> {
    Ok(get_collection_path(db.inner()).await)
}

/// List all Anki decks.
/// Priority: AnkiConnect (Anki must be open) → direct SQLite read-only (Anki must be closed).
/// Also syncs deck names to the local anki_decks table.
#[tauri::command]
pub async fn list_anki_decks(db: State<'_, DbPool>) -> Result<Vec<AnkiDeck>, String> {
    // ── 1. Try AnkiConnect ────────────────────────────────────────────────────
    #[derive(Serialize)]
    struct Empty {}

    if let Ok(map) =
        ankiconnect_invoke::<_, std::collections::HashMap<String, i64>>("deckNamesAndIds", Empty {}).await
    {
        let mut result = Vec::new();
        let mut deck_names_for_stats: Vec<String> = Vec::new();

        for (name, id) in &map {
            if name == "Default" || name == "Défaut" {
                continue;
            }
            let id_str = id.to_string();
            let _ = upsert_local_deck(db.inner(), &id_str, name).await;
            deck_names_for_stats.push(name.clone());
            result.push(AnkiDeck {
                id: id_str,
                name: name.clone(),
                card_count: 0,
            });
        }

        // Fetch real card counts from getDeckStats
        // Returns: { "deck_id_str": { "total_in_deck": N, ... } }
        #[derive(Deserialize)]
        struct DeckStat {
            total_in_deck: i64,
        }
        #[derive(Serialize)]
        struct GetDeckStatsParams {
            decks: Vec<String>,
        }
        if let Ok(stats) = ankiconnect_invoke::<_, std::collections::HashMap<String, DeckStat>>(
            "getDeckStats",
            GetDeckStatsParams { decks: deck_names_for_stats },
        )
        .await
        {
            for deck in &mut result {
                if let Some(stat) = stats.get(&deck.id) {
                    deck.card_count = stat.total_in_deck;
                }
            }
        }

        result.sort_by(|a, b| a.name.cmp(&b.name));
        return Ok(result);
    }

    // ── 2. Fall back to direct SQLite (Anki must be closed) ──────────────────
    let path = match get_collection_path(db.inner()).await {
        Some(p) => p,
        None => return Ok(vec![]),
    };

    let anki_pool = open_anki_pool(&path, true).await?;

    // Try schema 15+: dedicated decks table
    let schema15_rows: Vec<(i64, String)> =
        sqlx::query_as("SELECT id, name FROM decks WHERE id != 1")
            .fetch_all(&anki_pool)
            .await
            .unwrap_or_default();

    if !schema15_rows.is_empty() {
        let mut result = Vec::new();
        for (id, name) in schema15_rows {
            let id_str = id.to_string();
            let count_row: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM cards WHERE did = ?")
                    .bind(id)
                    .fetch_one(&anki_pool)
                    .await
                    .unwrap_or((0,));
            let _ = upsert_local_deck(db.inner(), &id_str, &name).await;
            result.push(AnkiDeck {
                id: id_str,
                name,
                card_count: count_row.0,
            });
        }
        anki_pool.close().await;
        result.sort_by(|a, b| a.name.cmp(&b.name));
        return Ok(result);
    }

    // Try schema < 15: col.decks JSON
    let row: Option<(String,)> = sqlx::query_as("SELECT decks FROM col LIMIT 1")
        .fetch_optional(&anki_pool)
        .await
        .map_err(|e| format!("Failed to read decks: {}", e))?;

    let decks_json = match row {
        Some((json,)) => json,
        None => {
            anki_pool.close().await;
            return Ok(vec![]);
        }
    };

    let decks_value: serde_json::Value =
        serde_json::from_str(&decks_json).map_err(|e| format!("Failed to parse decks: {}", e))?;

    let mut result = Vec::new();
    if let Some(obj) = decks_value.as_object() {
        for (id_str, deck) in obj.iter() {
            let name = deck["name"].as_str().unwrap_or("").to_string();
            if name.is_empty() {
                continue;
            }
            let deck_id: i64 = match id_str.parse() {
                Ok(v) => v,
                Err(_) => continue,
            };
            let count_row: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM cards WHERE did = ?")
                    .bind(deck_id)
                    .fetch_one(&anki_pool)
                    .await
                    .unwrap_or((0,));
            let _ = upsert_local_deck(db.inner(), id_str, &name).await;
            result.push(AnkiDeck {
                id: id_str.clone(),
                name,
                card_count: count_row.0,
            });
        }
    }

    anki_pool.close().await;
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

/// Sync notes from Anki into the local anki_notes table via AnkiConnect.
/// Returns all notes found (not just new ones).
#[tauri::command]
pub async fn anki_sync_notes(
    deck_name: Option<String>,
    db: State<'_, DbPool>,
) -> Result<Vec<AnkiNoteRecord>, String> {
    // Build search query
    let query = match &deck_name {
        Some(name) => format!("deck:\"{}\"", name),
        None => "deck:*".to_string(),
    };

    // Find note IDs
    #[derive(Serialize)]
    struct FindNotesParams {
        query: String,
    }
    let note_ids: Vec<i64> =
        ankiconnect_invoke("findNotes", FindNotesParams { query }).await?;

    if note_ids.is_empty() {
        return list_anki_notes(deck_name.as_ref().map(|_| {
            // find deck_id for this name — skip for now and return all
            String::new()
        }), db).await;
    }

    // Fetch full note info in batches of 100
    #[derive(Serialize)]
    struct NotesInfoParams {
        notes: Vec<i64>,
    }

    #[derive(Deserialize, Debug)]
    struct AnkiConnectNoteField {
        value: String,
    }

    #[derive(Deserialize, Debug)]
    #[serde(rename_all = "camelCase")]
    struct AnkiConnectNote {
        note_id: i64,
        #[serde(rename = "deckName")]
        deck_name: String,
        #[serde(rename = "modelName")]
        model_name: String,
        fields: std::collections::HashMap<String, AnkiConnectNoteField>,
        tags: Vec<String>,
    }

    let chunk_size = 100;
    let mut all_notes: Vec<AnkiConnectNote> = Vec::new();

    for chunk in note_ids.chunks(chunk_size) {
        let notes: Vec<AnkiConnectNote> =
            ankiconnect_invoke("notesInfo", NotesInfoParams { notes: chunk.to_vec() }).await?;
        all_notes.extend(notes);
    }

    // Upsert into local DB
    let mut records = Vec::new();

    for note in &all_notes {
        // Extract question (first field) and answer (second field) by order
        let mut fields_by_order: Vec<(String, String)> = note
            .fields
            .iter()
            .map(|(name, f)| (name.clone(), f.value.clone()))
            .collect();
        // Sort by field name heuristic: Front/Recto first, Back/Verso second
        fields_by_order.sort_by_key(|(name, _)| match name.as_str() {
            "Front" | "Recto" | "Question" => 0,
            "Back" | "Verso" | "Réponse" | "Answer" => 1,
            _ => 2,
        });

        let question = fields_by_order.first().map(|(_, v)| v.clone()).unwrap_or_default();
        let answer = fields_by_order.get(1).map(|(_, v)| v.clone()).unwrap_or_default();
        let extra = fields_by_order.get(2).map(|(_, v)| v.clone()).filter(|v| !v.is_empty());
        let tags_str = note.tags.join(" ");

        // Deck: use name to look up or create local deck entry
        // AnkiConnect doesn't give us deck IDs in notesInfo, look it up from our local table
        let deck_id_row: Option<(String,)> =
            sqlx::query_as("SELECT id FROM anki_decks WHERE name = ?")
                .bind(&note.deck_name)
                .fetch_optional(db.inner())
                .await
                .ok()
                .flatten();

        let deck_id = match deck_id_row {
            Some((id,)) => id,
            None => {
                // Create the deck locally with a placeholder ID
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64;
                let id = now_ms.to_string();
                let _ = upsert_local_deck(db.inner(), &id, &note.deck_name).await;
                id
            }
        };

        // Use Anki note ID as local ID (string) to allow upsert
        let local_id = note.note_id.to_string();

        sqlx::query(
            "INSERT INTO anki_notes (id, deck_id, note_type, question, answer, extra_field, tags, anki_note_id, anki_created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
               question = excluded.question,
               answer = excluded.answer,
               extra_field = excluded.extra_field,
               tags = excluded.tags,
               note_type = excluded.note_type,
               modified_at = CURRENT_TIMESTAMP",
        )
        .bind(&local_id)
        .bind(&deck_id)
        .bind(&note.model_name)
        .bind(&question)
        .bind(&answer)
        .bind(&extra)
        .bind(if tags_str.is_empty() { None } else { Some(tags_str.clone()) })
        .bind(note.note_id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("Failed to upsert note {}: {}", note.note_id, e))?;

        records.push(AnkiNoteRecord {
            id: local_id,
            deck_id,
            deck_name: Some(note.deck_name.clone()),
            note_type: Some(note.model_name.clone()),
            question,
            answer,
            extra_field: extra,
            source_anchor_id: None,
            tags: if tags_str.is_empty() { None } else { Some(tags_str) },
            anki_note_id: Some(note.note_id),
            created_at: None,
            anki_created_at: None,
        });
    }

    Ok(records)
}

/// Create a new Anki card.
/// Priority: AnkiConnect (safe, works while Anki is open) → direct SQLite write (Anki must be closed).
/// Always writes to local anki_notes table.
#[tauri::command]
pub async fn create_anki_card(
    front: String,
    back: String,
    deck_id: String,
    tags: Option<String>,
    source_anchor_id: Option<String>,
    db: State<'_, DbPool>,
) -> Result<AnkiNoteRecord, String> {
    // Look up deck name for AnkiConnect (which needs the name, not the numeric ID)
    let deck_name: Option<String> = sqlx::query_as::<_, (String,)>(
        "SELECT name FROM anki_decks WHERE id = ?",
    )
    .bind(&deck_id)
    .fetch_optional(db.inner())
    .await
    .ok()
    .flatten()
    .map(|(n,)| n);

    let tags_str = tags.clone().unwrap_or_default();
    let mut anki_note_id: Option<i64> = None;

    // ── 1. Try AnkiConnect ────────────────────────────────────────────────────
    if let Some(ref name) = deck_name {
        #[derive(Serialize)]
        struct AddNoteParams {
            note: AddNote,
        }
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct AddNote {
            deck_name: String,
            model_name: String,
            fields: std::collections::HashMap<String, String>,
            tags: Vec<String>,
            options: AddNoteOptions,
        }
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct AddNoteOptions {
            allow_duplicate: bool,
        }

        let mut fields = std::collections::HashMap::new();
        fields.insert("Front".to_string(), front.clone());
        fields.insert("Back".to_string(), back.clone());

        let tag_list: Vec<String> = {
            let mut v: Vec<String> = tags_str.split_whitespace().map(String::from).collect();
            if !v.contains(&"edn-tracker".to_string()) {
                v.push("edn-tracker".to_string());
            }
            v
        };

        let params = AddNoteParams {
            note: AddNote {
                deck_name: name.clone(),
                model_name: "Basic".to_string(),
                fields,
                tags: tag_list,
                options: AddNoteOptions { allow_duplicate: false },
            },
        };

        match ankiconnect_invoke::<_, serde_json::Value>("addNote", params).await {
            Ok(v) => {
                anki_note_id = v.as_i64();
            }
            Err(_) => {
                // AnkiConnect failed — fall through to direct SQLite write
            }
        }
    }

    // ── 2. Fall back to direct SQLite write (if AnkiConnect unavailable) ─────
    if anki_note_id.is_none() {
        let path = match get_collection_path(db.inner()).await {
            Some(p) => p,
            None => {
                return Err("Anki collection non configurée. Ouvrez Anki avec AnkiConnect ou sélectionnez une collection.".to_string())
            }
        };

        let deck_id_i64: i64 = deck_id
            .parse()
            .map_err(|_| format!("Invalid deck_id: {}", deck_id))?;

        let anki_pool = open_anki_pool(&path, false).await?;
        let model_id = find_basic_model_id(&anki_pool).await?;

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let note_id = now_ms;
        let card_id = now_ms + 1;
        let flds = format!("{}\x1f{}", front, back);
        let csum = compute_csum(&front) as i64;
        let guid = random_guid();

        sqlx::query(
            "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
             VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')",
        )
        .bind(note_id)
        .bind(&guid)
        .bind(model_id)
        .bind(now_ms / 1000)
        .bind(&tags_str)
        .bind(&flds)
        .bind(&front)
        .bind(csum)
        .execute(&anki_pool)
        .await
        .map_err(|e| format!("Failed to insert Anki note: {}", e))?;

        sqlx::query(
            "INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
             VALUES (?, ?, ?, 0, ?, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '')",
        )
        .bind(card_id)
        .bind(note_id)
        .bind(deck_id_i64)
        .bind(now_ms / 1000)
        .execute(&anki_pool)
        .await
        .map_err(|e| format!("Failed to insert Anki card: {}", e))?;

        anki_pool.close().await;
        anki_note_id = Some(note_id);
    }

    // ── 3. Write to local anki_notes table ────────────────────────────────────
    let local_id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO anki_notes (id, deck_id, note_type, question, answer, source_anchor_id, tags, anki_note_id, created_at, anki_created_at)
         VALUES (?, ?, 'Basic', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
    )
    .bind(&local_id)
    .bind(&deck_id)
    .bind(&front)
    .bind(&back)
    .bind(&source_anchor_id)
    .bind(&tags)
    .bind(anki_note_id)
    .execute(db.inner())
    .await
    .map_err(|e| format!("Failed to insert local anki note: {}", e))?;

    Ok(AnkiNoteRecord {
        id: local_id,
        deck_id,
        deck_name,
        note_type: Some("Basic".to_string()),
        question: front,
        answer: back,
        extra_field: None,
        source_anchor_id,
        tags,
        anki_note_id,
        created_at: None,
        anki_created_at: None,
    })
}

/// Return all local anki notes.
#[tauri::command]
pub async fn get_anki_cards(db: State<'_, DbPool>) -> Result<Vec<AnkiNoteRecord>, String> {
    list_anki_notes(None, db).await
}

/// List local anki notes with optional deck filter.
#[tauri::command]
pub async fn list_anki_notes(
    deck_id: Option<String>,
    db: State<'_, DbPool>,
) -> Result<Vec<AnkiNoteRecord>, String> {
    let rows = if let Some(ref did) = deck_id {
        sqlx::query_as::<_, (String, String, Option<String>, Option<String>, String, String, Option<String>, Option<String>, Option<String>, Option<i64>, Option<String>, Option<String>)>(
            "SELECT n.id, n.deck_id, d.name, n.note_type, n.question, n.answer,
                    n.extra_field, n.source_anchor_id, n.tags, n.anki_note_id, n.created_at, n.anki_created_at
             FROM anki_notes n
             LEFT JOIN anki_decks d ON d.id = n.deck_id
             WHERE n.deck_id = ?
             ORDER BY n.created_at DESC",
        )
        .bind(did)
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("DB error: {}", e))?
    } else {
        sqlx::query_as::<_, (String, String, Option<String>, Option<String>, String, String, Option<String>, Option<String>, Option<String>, Option<i64>, Option<String>, Option<String>)>(
            "SELECT n.id, n.deck_id, d.name, n.note_type, n.question, n.answer,
                    n.extra_field, n.source_anchor_id, n.tags, n.anki_note_id, n.created_at, n.anki_created_at
             FROM anki_notes n
             LEFT JOIN anki_decks d ON d.id = n.deck_id
             ORDER BY n.created_at DESC",
        )
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("DB error: {}", e))?
    };

    let notes = rows
        .into_iter()
        .map(|(id, did, deck_name, note_type, question, answer, extra_field, source_anchor_id, tags, anki_note_id, created_at, anki_created_at)| {
            AnkiNoteRecord {
                id,
                deck_id: did,
                deck_name,
                note_type,
                question,
                answer,
                extra_field,
                source_anchor_id,
                tags,
                anki_note_id,
                created_at,
                anki_created_at,
            }
        })
        .collect();

    Ok(notes)
}

/// Create a deck in the local anki_decks table.
/// If AnkiConnect is available, also creates the deck in Anki.
#[tauri::command]
pub async fn create_anki_deck(
    name: String,
    description: Option<String>,
    db: State<'_, DbPool>,
) -> Result<AnkiDeck, String> {
    let mut deck_id: Option<String> = None;

    // Try AnkiConnect first
    #[derive(Serialize)]
    struct CreateDeckParams {
        deck: String,
    }
    if let Ok(anki_id) =
        ankiconnect_invoke::<_, i64>("createDeck", CreateDeckParams { deck: name.clone() }).await
    {
        deck_id = Some(anki_id.to_string());
    }

    // Fall back to timestamp-based ID
    let id = deck_id.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            .to_string()
    });

    sqlx::query(
        "INSERT INTO anki_decks (id, name, description) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name",
    )
    .bind(&id)
    .bind(&name)
    .bind(&description)
    .execute(db.inner())
    .await
    .map_err(|e| format!("Failed to create deck: {}", e))?;

    Ok(AnkiDeck {
        id,
        name,
        card_count: 0,
    })
}
