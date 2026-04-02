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
    pub created_at: Option<String>,
    pub anki_created_at: Option<String>,
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async fn get_collection_path(pool: &SqlitePool) -> Option<String> {
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

    // Try to find Basic or De base model
    if let Some(obj) = models.as_object() {
        // First pass: look for Basic or De base
        for (id_str, model) in obj.iter() {
            let name = model["name"].as_str().unwrap_or("");
            if name == "Basic" || name == "De base" || name.starts_with("Basic") {
                if let Ok(id) = id_str.parse::<i64>() {
                    return Ok(id);
                }
            }
        }
        // Fallback: first model
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
    // 10-char base91 string from UUID bytes
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

// ─── Tauri commands ───────────────────────────────────────────────────────────

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

/// List all Anki decks by parsing the collection JSON + counting cards per deck.
#[tauri::command]
pub async fn list_anki_decks(db: State<'_, DbPool>) -> Result<Vec<AnkiDeck>, String> {
    let path = match get_collection_path(db.inner()).await {
        Some(p) => p,
        None => return Ok(vec![]),
    };

    let anki_pool = open_anki_pool(&path, true).await?;

    let row: Option<(String,)> = sqlx::query_as("SELECT decks FROM col LIMIT 1")
        .fetch_optional(&anki_pool)
        .await
        .map_err(|e| format!("Failed to read decks: {}", e))?;

    let decks_json = match row {
        Some((json,)) => json,
        None => return Ok(vec![]),
    };

    let decks_value: serde_json::Value =
        serde_json::from_str(&decks_json).map_err(|e| format!("Failed to parse decks: {}", e))?;

    let mut result = Vec::new();

    if let Some(obj) = decks_value.as_object() {
        for (id_str, deck) in obj.iter() {
            // Skip the special deck id "1" (default deck with name "Default" - often empty)
            let name = deck["name"].as_str().unwrap_or("").to_string();
            if name.is_empty() {
                continue;
            }

            let deck_id: i64 = match id_str.parse() {
                Ok(v) => v,
                Err(_) => continue,
            };

            // Count cards in this deck
            let count_row: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM cards WHERE did = ?")
                    .bind(deck_id)
                    .fetch_one(&anki_pool)
                    .await
                    .unwrap_or((0,));

            result.push(AnkiDeck {
                id: id_str.clone(),
                name,
                card_count: count_row.0,
            });
        }
    }

    anki_pool.close().await;
    Ok(result)
}

/// Create a new Anki card: writes to collection.anki2 AND local anki_notes table.
#[tauri::command]
pub async fn create_anki_card(
    front: String,
    back: String,
    deck_id: String,
    tags: Option<String>,
    source_anchor_id: Option<String>,
    db: State<'_, DbPool>,
) -> Result<AnkiNoteRecord, String> {
    let path = match get_collection_path(db.inner()).await {
        Some(p) => p,
        None => return Err("Anki collection non configurée. Sélectionnez d'abord une collection.".to_string()),
    };

    let deck_id_i64: i64 = deck_id
        .parse()
        .map_err(|_| format!("Invalid deck_id: {}", deck_id))?;

    // Write to Anki collection
    {
        let anki_pool = open_anki_pool(&path, false).await?;
        let model_id = find_basic_model_id(&anki_pool).await?;

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let note_id = now_ms;
        let card_id = now_ms + 1;
        let flds = format!("{}\x1f{}", front, back);
        let sfld = front.clone();
        let csum = compute_csum(&sfld) as i64;
        let guid = random_guid();
        let tags_str = tags.clone().unwrap_or_default();

        // Insert note into Anki DB
        sqlx::query(
            "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
             VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')",
        )
        .bind(note_id)
        .bind(&guid)
        .bind(model_id)
        .bind(now_ms / 1000) // mod is seconds
        .bind(&tags_str)
        .bind(&flds)
        .bind(&sfld)
        .bind(csum)
        .execute(&anki_pool)
        .await
        .map_err(|e| format!("Failed to insert Anki note: {}", e))?;

        // Insert card into Anki DB
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
    }

    // Look up deck name from local table
    let deck_name: Option<String> = sqlx::query_as::<_, (String,)>(
        "SELECT name FROM anki_decks WHERE id = ?",
    )
    .bind(&deck_id)
    .fetch_optional(db.inner())
    .await
    .ok()
    .flatten()
    .map(|(n,)| n);

    // Write to local anki_notes table
    let local_id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO anki_notes (id, deck_id, note_type, question, answer, source_anchor_id, tags, created_at, anki_created_at)
         VALUES (?, ?, 'Basic', ?, ?, ?, ?, datetime('now'), datetime('now'))",
    )
    .bind(&local_id)
    .bind(&deck_id)
    .bind(&front)
    .bind(&back)
    .bind(&source_anchor_id)
    .bind(&tags)
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
        created_at: None,
        anki_created_at: None,
    })
}

/// Return all local anki notes (for LinkCreationModal).
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
        sqlx::query_as::<_, (String, String, Option<String>, Option<String>, String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
            "SELECT n.id, n.deck_id, d.name, n.note_type, n.question, n.answer,
                    n.extra_field, n.source_anchor_id, n.tags, n.created_at, n.anki_created_at
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
        sqlx::query_as::<_, (String, String, Option<String>, Option<String>, String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
            "SELECT n.id, n.deck_id, d.name, n.note_type, n.question, n.answer,
                    n.extra_field, n.source_anchor_id, n.tags, n.created_at, n.anki_created_at
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
        .map(|(id, did, deck_name, note_type, question, answer, extra_field, source_anchor_id, tags, created_at, anki_created_at)| {
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
                created_at,
                anki_created_at,
            }
        })
        .collect();

    Ok(notes)
}

/// Create a deck in the local anki_decks table only (no write to collection.anki2).
#[tauri::command]
pub async fn create_anki_deck(
    name: String,
    description: Option<String>,
    db: State<'_, DbPool>,
) -> Result<AnkiDeck, String> {
    // Use current timestamp as Anki-compatible deck ID (13-digit ms)
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let deck_id = now_ms.to_string();

    sqlx::query(
        "INSERT INTO anki_decks (id, name, description) VALUES (?, ?, ?)",
    )
    .bind(&deck_id)
    .bind(&name)
    .bind(&description)
    .execute(db.inner())
    .await
    .map_err(|e| format!("Failed to create deck: {}", e))?;

    Ok(AnkiDeck {
        id: deck_id,
        name,
        card_count: 0,
    })
}
