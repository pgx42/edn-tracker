use std::path::Path;
use serde::Serialize;
use tauri::State;
use crate::db::DbPool;
use super::anki::{ankiconnect_invoke, get_collection_path};

// ─── Inline base64 encoder (no extra dep) ────────────────────────────────────

fn b64_encode(data: &[u8]) -> String {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let n = match chunk.len() {
            3 => (chunk[0] as u32) << 16 | (chunk[1] as u32) << 8 | chunk[2] as u32,
            2 => (chunk[0] as u32) << 16 | (chunk[1] as u32) << 8,
            _ => (chunk[0] as u32) << 16,
        };
        out.push(T[(n >> 18) as usize] as char);
        out.push(T[(n >> 12 & 0x3f) as usize] as char);
        out.push(if chunk.len() > 1 { T[(n >> 6 & 0x3f) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { T[(n & 0x3f) as usize] as char } else { '=' });
    }
    out
}

fn mime_for_ext(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png"          => "image/png",
        "gif"          => "image/gif",
        "webp"         => "image/webp",
        "svg"          => "image/svg+xml",
        "avif"         => "image/avif",
        _              => "image/jpeg",
    }
}

// ─── Command ──────────────────────────────────────────────────────────────────

/// Return a `data:<mime>;base64,<...>` URL for a file in collection.media.
/// Tries AnkiConnect `retrieveMediaFile` first (works whenever Anki is open),
/// then falls back to direct file system access if a collection path is configured.
#[tauri::command]
pub async fn anki_get_media_file(
    filename: String,
    db: State<'_, DbPool>,
) -> Result<String, String> {
    // Reject any path traversal attempt
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid filename".to_string());
    }

    let ext = Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = mime_for_ext(&ext);

    // ── 1. Try AnkiConnect retrieveMediaFile (Anki must be open) ─────────────
    #[derive(Serialize)]
    struct RetrieveParams { filename: String }

    if let Ok(b64) = ankiconnect_invoke::<_, serde_json::Value>(
        "retrieveMediaFile",
        RetrieveParams { filename: filename.clone() },
    ).await {
        if let Some(s) = b64.as_str() {
            if !s.is_empty() {
                return Ok(format!("data:{mime};base64,{s}"));
            }
        }
    }

    // ── 2. Fall back to direct file system (collection path must be set) ─────
    let col_path = get_collection_path(db.inner())
        .await
        .ok_or_else(|| format!("Media file not found via AnkiConnect and no collection configured: {filename}"))?;

    let media_dir = Path::new(&col_path)
        .parent()
        .ok_or_else(|| "Invalid collection path".to_string())?
        .join("collection.media");

    let file_path = media_dir.join(&filename);

    let canonical = file_path
        .canonicalize()
        .map_err(|_| format!("Media file not found: {filename}"))?;
    let media_canonical = media_dir
        .canonicalize()
        .map_err(|_| "collection.media folder not found".to_string())?;

    if !canonical.starts_with(&media_canonical) {
        return Err("Access denied".to_string());
    }

    let bytes = std::fs::read(&canonical).map_err(|e| format!("Read error: {e}"))?;
    Ok(format!("data:{mime};base64,{}", b64_encode(&bytes)))
}

/// Store a media file in Anki's collection via AnkiConnect `storeMediaFile`.
/// `data` must be a base64-encoded string (without data URL prefix).
/// Returns the filename as stored by Anki (may differ if a file with the same name already exists).
#[tauri::command]
pub async fn store_anki_media(filename: String, data: String) -> Result<String, String> {
    use super::anki::ankiconnect_invoke;

    #[derive(serde::Serialize)]
    struct Params {
        filename: String,
        data: String,
    }

    let stored: String = ankiconnect_invoke(
        "storeMediaFile",
        Params { filename, data },
    )
    .await
    .map_err(|e| format!("AnkiConnect storeMediaFile failed (Anki doit être ouvert) : {e}"))?;

    Ok(stored)
}

/// Return the absolute path to the collection.media folder (for diagnostics).
#[tauri::command]
pub async fn anki_get_media_dir(db: State<'_, DbPool>) -> Result<String, String> {
    let col_path = get_collection_path(db.inner())
        .await
        .ok_or_else(|| "No Anki collection configured".to_string())?;

    let media_dir = Path::new(&col_path)
        .parent()
        .ok_or_else(|| "Invalid collection path".to_string())?
        .join("collection.media");

    Ok(media_dir.to_string_lossy().to_string())
}
