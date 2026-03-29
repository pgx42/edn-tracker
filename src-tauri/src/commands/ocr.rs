/// Tauri IPC commands exposed to the frontend for the OCR pipeline.
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

use crate::db::DbPool;
use crate::ocr::{
    detect_scan_type, extract_pdf_text, ocr_page_with_vision, OcrResult, PdfTextResult,
    ScanDetection, TextSource,
};

// ─── Response Types ───────────────────────────────────────────────────────────

/// Returned by `extract_pdf_text` command — mirrors `PdfTextResult` with
/// string discriminants matching the frontend's expectations.
#[derive(Serialize, Deserialize, Debug)]
pub struct ExtractPdfTextResponse {
    pub pages: Vec<PageResponse>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PageResponse {
    pub page: u32,
    pub text: String,
    /// "native" | "apple_vision" | "tesseract"
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f32>,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Extract text from every page of a PDF.
///
/// For each page:
/// - Returns extracted text with `source = "native"` if the PDF has an
///   embedded text layer.
/// - Returns `source = "apple_vision"` if Apple Vision OCR was run.
/// - Returns `source = "tesseract"` with an empty `text` when Vision is
///   unavailable — the frontend should invoke the Tesseract.js worker in
///   that case.
#[tauri::command]
pub async fn extract_pdf_text_cmd(path: String) -> Result<ExtractPdfTextResponse, String> {
    let pdf_path = Path::new(&path);

    let result: PdfTextResult = extract_pdf_text(pdf_path)
        .await
        .map_err(|e| format!("extract_pdf_text failed: {e}"))?;

    let pages = result
        .pages
        .into_iter()
        .map(|p| PageResponse {
            page: p.page,
            text: p.text,
            source: source_to_str(&p.source).to_owned(),
            confidence: p.confidence,
        })
        .collect();

    Ok(ExtractPdfTextResponse { pages })
}

/// Detect whether a PDF is scanned (lacks a native text layer).
#[tauri::command]
pub async fn detect_scan_type_cmd(path: String) -> Result<ScanDetection, String> {
    let pdf_path = Path::new(&path);

    detect_scan_type(pdf_path).map_err(|e| format!("detect_scan_type failed: {e}"))
}

/// OCR a single page using Apple Vision (macOS) and return the result.
///
/// `pdf_id` is the UUID of the PDF document in the database; the caller is
/// responsible for persisting the returned text to `pdf_pages`.
#[tauri::command]
pub async fn ocr_page_cmd(
    pdf_id: String,
    page: u32,
    pool: State<'_, DbPool>,
) -> Result<OcrPageResponse, String> {
    // Resolve the file path from the database.
    let file_path: Option<(String,)> =
        sqlx::query_as("SELECT file_path FROM pdf_documents WHERE id = ?")
            .bind(&pdf_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| format!("DB error resolving PDF path: {e}"))?;

    let (file_path,) = file_path
        .ok_or_else(|| format!("No PDF document found with id: {pdf_id}"))?;

    let pdf_path = Path::new(&file_path);

    // Attempt Apple Vision OCR.
    let ocr: OcrResult = ocr_page_with_vision(pdf_path, page)
        .await
        .map_err(|e| format!("OCR failed: {e}"))?;

    // Persist to database (upsert into pdf_pages).
    persist_page_text(pool.inner(), &pdf_id, page, &ocr).await?;

    Ok(OcrPageResponse {
        text: ocr.text,
        confidence: ocr.confidence,
        source: source_to_str(&ocr.source).to_owned(),
    })
}

/// Persist OCR results for a single page to the database.
///
/// Does an INSERT OR REPLACE so re-running OCR always updates stale rows.
async fn persist_page_text(
    pool: &DbPool,
    pdf_id: &str,
    page: u32,
    ocr: &OcrResult,
) -> Result<(), String> {
    let page_id = format!("{pdf_id}:{page}");
    let text_source = source_to_str(&ocr.source);

    sqlx::query(
        r#"
        INSERT INTO pdf_pages (id, pdf_document_id, page_number, text_content, text_source, ocr_confidence)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(pdf_document_id, page_number)
        DO UPDATE SET
            text_content    = excluded.text_content,
            text_source     = excluded.text_source,
            ocr_confidence  = excluded.ocr_confidence
        "#,
    )
    .bind(&page_id)
    .bind(pdf_id)
    .bind(page)
    .bind(&ocr.text)
    .bind(text_source)
    .bind(ocr.confidence)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to persist page text: {e}"))?;

    Ok(())
}

/// Response type for `ocr_page` command.
#[derive(Serialize, Deserialize, Debug)]
pub struct OcrPageResponse {
    pub text: String,
    pub confidence: f32,
    /// "apple_vision" | "tesseract"
    pub source: String,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn source_to_str(source: &TextSource) -> &'static str {
    match source {
        TextSource::Native => "native",
        TextSource::AppleVision => "apple_vision",
        TextSource::Tesseract => "tesseract",
    }
}
