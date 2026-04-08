use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfDocument {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub doc_type: Option<String>,
    pub num_pages: i32,
    pub created_at: Option<String>,
    pub has_native_text: Option<bool>,
    pub is_scanned: Option<bool>,
    pub text_extraction_complete: Option<bool>,
    pub ocr_complete: Option<bool>,
}

/// Open a file picker dialog to select a PDF file
#[tauri::command]
pub async fn open_pdf_dialog() -> Result<Option<String>, String> {
    let path = tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("PDF", &["pdf"])
            .add_filter("Tous les fichiers", &["*"])
            .pick_file()
    })
    .await
    .map_err(|e| format!("Dialog spawn error: {}", e))?;

    Ok(path.map(|p| p.to_string_lossy().to_string()))
}

/// Import a PDF document with metadata
#[tauri::command]
pub async fn import_pdf(
    path: String,
    doc_type: Option<String>,
    db: tauri::State<'_, crate::db::DbPool>,
) -> Result<PdfDocument, String> {
    let p = Path::new(&path);
    let title = p
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.pdf")
        .to_string();

    let pdf_id = uuid::Uuid::new_v4().to_string();

    // Verify PDF exists and is readable
    fs::read(&path)
        .map_err(|e| format!("Failed to read PDF file: {}", e))?;

    // Validate doc_type if provided
    let validated_type = match &doc_type {
        Some(t) if matches!(t.as_str(), "college" | "poly" | "lca" | "annale" | "lisa" | "other") => Some(t.clone()),
        None => None,
        _ => return Err("Invalid doc_type. Must be one of: college, poly, lca, annale, lisa, other".to_string()),
    };

    // Insert into database
    sqlx::query(
        "INSERT INTO pdf_documents (id, title, file_path, doc_type, num_pages, has_native_text, is_scanned, text_extraction_complete, ocr_complete, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    )
    .bind(&pdf_id)
    .bind(&title)
    .bind(&path) // Store original path for reference
    .bind(&validated_type)
    .bind(0) // num_pages will be populated after OCR/text extraction
    .bind(true) // assume has_native_text initially
    .bind(false)
    .bind(false)
    .bind(false)
    .execute(db.inner())
    .await
    .map_err(|e| format!("Failed to import PDF: {}", e))?;

    // Fetch the created document to get the created_at timestamp
    let created_doc = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT created_at FROM pdf_documents WHERE id = ?"
    )
    .bind(&pdf_id)
    .fetch_optional(db.inner())
    .await
    .map_err(|e| format!("Failed to fetch created document: {}", e))?
    .map(|row| row.0)
    .flatten();

    Ok(PdfDocument {
        id: pdf_id,
        title,
        file_path: path.clone(), // Store path as-is
        doc_type: validated_type,
        num_pages: 0,
        created_at: created_doc,
        has_native_text: Some(true),
        is_scanned: Some(false),
        text_extraction_complete: Some(false),
        ocr_complete: Some(false),
    })
}

/// Get PDF file as bytes (for loading in browser)
#[tauri::command]
pub async fn get_pdf_bytes(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path)
        .map_err(|e| format!("Failed to read PDF: {}", e))
}

/// Simple base64 encoding
fn base64_encode(data: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();

    for chunk in data.chunks(3) {
        let b1 = chunk[0];
        let b2 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b3 = if chunk.len() > 2 { chunk[2] } else { 0 };

        let n = ((b1 as u32) << 16) | ((b2 as u32) << 8) | (b3 as u32);

        result.push(CHARSET[((n >> 18) & 63) as usize] as char);
        result.push(CHARSET[((n >> 12) & 63) as usize] as char);

        if chunk.len() > 1 {
            result.push(CHARSET[((n >> 6) & 63) as usize] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(CHARSET[(n & 63) as usize] as char);
        } else {
            result.push('=');
        }
    }

    result
}

/// List all imported PDFs
#[tauri::command]
pub async fn list_pdfs(
    db: tauri::State<'_, crate::db::DbPool>,
) -> Result<Vec<PdfDocument>, String> {
    use sqlx::FromRow;

    #[derive(FromRow)]
    struct DbPdf {
        id: String,
        title: String,
        file_path: String,
        doc_type: Option<String>,
        num_pages: i32,
        created_at: Option<String>,
        has_native_text: Option<bool>,
        is_scanned: Option<bool>,
        text_extraction_complete: Option<bool>,
        ocr_complete: Option<bool>,
    }

    let pdfs: Vec<DbPdf> = sqlx::query_as::<_, DbPdf>(
        "SELECT id, title, file_path, doc_type, num_pages, created_at, has_native_text, is_scanned, text_extraction_complete, ocr_complete FROM pdf_documents ORDER BY created_at DESC",
    )
    .fetch_all(db.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(pdfs
        .into_iter()
        .map(|p| PdfDocument {
            id: p.id,
            title: p.title,
            file_path: p.file_path,
            doc_type: p.doc_type,
            num_pages: p.num_pages,
            created_at: p.created_at,
            has_native_text: p.has_native_text,
            is_scanned: p.is_scanned,
            text_extraction_complete: p.text_extraction_complete,
            ocr_complete: p.ocr_complete,
        })
        .collect())
}
