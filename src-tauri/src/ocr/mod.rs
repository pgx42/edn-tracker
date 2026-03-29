/// OCR pipeline: native PDF text extraction + Apple Vision + Tesseract.js fallback.
///
/// Architecture:
///   1. Try to extract text natively via `pdf-extract` (fast, no OCR needed).
///   2. If a page has fewer than 50 chars, classify the PDF as scanned.
///   3. For scanned pages: call Apple Vision (VNRecognizeTextRequest) via objc2.
///   4. If Vision is unavailable, the frontend falls back to Tesseract.js.
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

// ─── Public Types ────────────────────────────────────────────────────────────

/// A single page of extracted text.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageText {
    pub page: u32,
    pub text: String,
    /// Where the text came from.
    pub source: TextSource,
    /// Confidence score (0.0–1.0). Only meaningful for OCR sources.
    pub confidence: Option<f32>,
}

/// Where a piece of extracted text originated.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextSource {
    /// Text layer embedded in the PDF.
    Native,
    /// Apple Vision OCR (macOS).
    AppleVision,
    /// Tesseract.js (frontend fallback).
    Tesseract,
}

/// Result of extracting text from an entire PDF.
#[derive(Debug, Serialize, Deserialize)]
pub struct PdfTextResult {
    pub pages: Vec<PageText>,
}

/// Whether a PDF is scanned or has a native text layer.
#[derive(Debug, Serialize, Deserialize)]
pub struct ScanDetection {
    pub is_scanned: bool,
    pub avg_chars_per_page: u32,
}

/// Result of running OCR on a single page.
#[derive(Debug, Serialize, Deserialize)]
pub struct OcrResult {
    pub text: String,
    pub confidence: f32,
    pub source: TextSource,
}

// Threshold: pages with fewer characters than this are considered scanned.
const SCAN_THRESHOLD_CHARS: usize = 50;

// ─── Public API ──────────────────────────────────────────────────────────────

/// Extract text from all pages of a PDF.
///
/// For each page:
/// - If native text is present (≥ threshold), returns `TextSource::Native`.
/// - Otherwise, attempts Apple Vision OCR (macOS only).
/// - Pages that cannot be OCR'd return an empty string; the frontend
///   can invoke the Tesseract.js worker for those.
pub async fn extract_pdf_text(path: &Path) -> Result<PdfTextResult> {
    let native_pages = extract_native_text(path)?;

    let mut result_pages: Vec<PageText> = Vec::with_capacity(native_pages.len());

    for (idx, native_text) in native_pages.into_iter().enumerate() {
        let page_num = (idx + 1) as u32;

        if native_text.len() >= SCAN_THRESHOLD_CHARS {
            result_pages.push(PageText {
                page: page_num,
                text: native_text,
                source: TextSource::Native,
                confidence: None,
            });
        } else {
            // Try Apple Vision on this page.
            match ocr_page_with_vision(path, page_num).await {
                Ok(ocr) => result_pages.push(PageText {
                    page: page_num,
                    text: ocr.text,
                    source: TextSource::AppleVision,
                    confidence: Some(ocr.confidence),
                }),
                Err(_) => {
                    // Vision unavailable or failed; return empty so frontend
                    // can invoke Tesseract.js as fallback.
                    result_pages.push(PageText {
                        page: page_num,
                        text: String::new(),
                        source: TextSource::Tesseract,
                        confidence: None,
                    });
                }
            }
        }
    }

    Ok(PdfTextResult { pages: result_pages })
}

/// Determine whether a PDF is primarily scanned (lacking native text).
pub fn detect_scan_type(path: &Path) -> Result<ScanDetection> {
    let pages = extract_native_text(path)?;

    if pages.is_empty() {
        return Ok(ScanDetection {
            is_scanned: false,
            avg_chars_per_page: 0,
        });
    }

    let total_chars: usize = pages.iter().map(|p| p.len()).sum();
    let avg = (total_chars / pages.len()) as u32;

    Ok(ScanDetection {
        is_scanned: avg < SCAN_THRESHOLD_CHARS as u32,
        avg_chars_per_page: avg,
    })
}

/// OCR a single PDF page using Apple Vision (macOS) or error if unavailable.
pub async fn ocr_page_with_vision(path: &Path, page: u32) -> Result<OcrResult> {
    #[cfg(target_os = "macos")]
    {
        vision::recognize_text(path, page).await
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (path, page);
        Err(anyhow::anyhow!("Apple Vision is only available on macOS"))
    }
}

// ─── Native Text Extraction ──────────────────────────────────────────────────

/// Use `pdf-extract` to pull the embedded text layer from every page.
/// Returns one String per page (may be empty for scanned pages).
fn extract_native_text(path: &Path) -> Result<Vec<String>> {
    let bytes = std::fs::read(path)
        .with_context(|| format!("Cannot read PDF: {}", path.display()))?;

    // pdf-extract provides OutputDev implementations; PlainTextOutput is the
    // simplest — it returns all text in document order, one block per page.
    let pages = pdf_extract::extract_text_from_mem(&bytes)
        .with_context(|| format!("pdf-extract failed for: {}", path.display()))?;

    // pdf-extract returns a single concatenated string with form-feed (\x0C)
    // separating pages.
    let page_texts: Vec<String> = pages
        .split('\x0C')
        .map(|s| s.trim().to_owned())
        .collect();

    Ok(page_texts)
}

// ─── Apple Vision (macOS) ────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod vision {
    use super::OcrResult;
    use super::TextSource;
    use anyhow::{Context, Result};
    use std::path::Path;

    /// Recognize text on a single PDF page using Apple Vision Framework.
    ///
    /// Workflow:
    ///   1. Render the target page to a CGImage via PDFKit / Core Graphics.
    ///   2. Create a `VNRecognizeTextRequest` with `.accurate` revision.
    ///   3. Submit via `VNImageRequestHandler`.
    ///   4. Collect recognized strings + confidence and return them.
    ///
    /// All Objective-C calls are dispatched on the main thread via
    /// `dispatch_sync(dispatch_get_main_queue(), …)` as required by UIKit/AppKit
    /// image APIs, but since `dispatch_sync` from a non-main thread would
    /// deadlock we use `tokio::task::spawn_blocking` to run the entire call on a
    /// dedicated OS thread that can safely call `dispatch_sync`.
    pub async fn recognize_text(path: &Path, page: u32) -> Result<OcrResult> {
        let path_buf = path.to_path_buf();

        // Run the blocking Objective-C work on a dedicated thread pool thread
        // (not inside the async executor) so that dispatch_sync is safe.
        let result = tokio::task::spawn_blocking(move || {
            recognize_text_blocking(&path_buf, page)
        })
        .await
        .context("Vision thread panicked")??;

        Ok(result)
    }

    /// Blocking implementation that talks directly to the macOS Vision framework.
    ///
    /// Uses raw `objc_msgSend` via the `objc2` crate (0.6 API).
    /// All ObjC objects allocated via `alloc/init` are released via `objc2::rc::autoreleasepool`.
    fn recognize_text_blocking(path: &std::path::Path, page: u32) -> Result<OcrResult> {
        use objc2::rc::autoreleasepool;
        // SAFETY: All Objective-C calls follow Apple's documented API contracts.
        // Vision Framework is thread-safe for VNImageRequestHandler.
        unsafe { autoreleasepool(|_pool| recognize_text_inner(path, page)) }
    }

    unsafe fn recognize_text_inner(path: &std::path::Path, page: u32) -> Result<OcrResult> {
        use objc2::runtime::AnyObject;
        use objc2::{class, msg_send};
        use objc2_foundation::NSString;

        // ── 1. Open the PDF ───────────────────────────────────────────────
        let path_str = path.to_str().context("PDF path is not valid UTF-8")?;
        let ns_path = NSString::from_str(path_str);

        let url: *mut AnyObject = msg_send![
            class!(NSURL),
            fileURLWithPath: &*ns_path as *const NSString
        ];
        anyhow::ensure!(!url.is_null(), "NSURL returned nil for path: {path_str}");

        let alloc_doc: *mut AnyObject = msg_send![class!(PDFDocument), alloc];
        let pdf_doc: *mut AnyObject = msg_send![alloc_doc, initWithURL: url];
        anyhow::ensure!(!pdf_doc.is_null(), "PDFDocument could not open: {path_str}");

        // ── 2. Get the target page (0-indexed) ───────────────────────────
        let page_index: usize = (page as usize).saturating_sub(1);
        let pdf_page: *mut AnyObject = msg_send![pdf_doc, pageAtIndex: page_index];
        anyhow::ensure!(
            !pdf_page.is_null(),
            "Page {page} not found in PDF (0-indexed={page_index})"
        );

        // ── 3. Render page to CGImage ─────────────────────────────────────
        let media_box: u32 = 0; // kPDFDisplayBoxMediaBox

        use objc2_foundation::NSRect;
        let bounds: NSRect = msg_send![pdf_page, boundsForBox: media_box];
        let scale: f64 = 2.0;
        let width = (bounds.size.width * scale) as usize;
        let height = (bounds.size.height * scale) as usize;

        // CGColorSpace / CGContext via C functions (not ObjC)
        use std::ffi::c_void;

        extern "C" {
            fn CGColorSpaceCreateDeviceRGB() -> *mut c_void;
            fn CGBitmapContextCreate(
                data: *mut c_void, width: usize, height: usize,
                bpc: usize, bpr: usize, cs: *mut c_void, info: u32,
            ) -> *mut c_void;
            fn CGBitmapContextCreateImage(ctx: *mut c_void) -> *mut c_void;
            fn CGContextScaleCTM(ctx: *mut c_void, sx: f64, sy: f64);
            fn CGContextTranslateCTM(ctx: *mut c_void, tx: f64, ty: f64);
            fn CGImageRelease(img: *mut c_void);
            fn CGContextRelease(ctx: *mut c_void);
            fn CGColorSpaceRelease(cs: *mut c_void);
        }

        let color_space = CGColorSpaceCreateDeviceRGB();
        let bitmap_info: u32 = 0x0002 | 0x0100; // kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Host
        let ctx = CGBitmapContextCreate(
            std::ptr::null_mut(), width, height, 8, width * 4, color_space, bitmap_info,
        );
        anyhow::ensure!(!ctx.is_null(), "Failed to create CGBitmapContext");

        CGContextScaleCTM(ctx, scale, -scale);
        CGContextTranslateCTM(ctx, 0.0, -bounds.size.height);

        let _: () = msg_send![pdf_page, drawWithBox: media_box, toContext: ctx as *mut AnyObject];

        let cg_image = CGBitmapContextCreateImage(ctx);
        anyhow::ensure!(!cg_image.is_null(), "CGBitmapContextCreateImage returned nil");

        // ── 4. Run Vision ─────────────────────────────────────────────────
        let alloc_req: *mut AnyObject = msg_send![class!(VNRecognizeTextRequest), alloc];
        let request: *mut AnyObject = msg_send![alloc_req, init];
        let accurate: i64 = 1;
        let _: () = msg_send![request, setRecognitionLevel: accurate];
        let _: () = msg_send![request, setUsesLanguageCorrection: true];

        let alloc_dict: *mut AnyObject = msg_send![class!(NSDictionary), alloc];
        let ns_dict: *mut AnyObject = msg_send![alloc_dict, init];

        // NSArray with single element via arrayWithObjects:count:
        let mut req_ptr: *mut AnyObject = request;
        let requests: *mut AnyObject = msg_send![
            class!(NSArray),
            arrayWithObjects: &mut req_ptr as *mut *mut AnyObject,
            count: 1usize
        ];

        let alloc_handler: *mut AnyObject = msg_send![class!(VNImageRequestHandler), alloc];
        let handler: *mut AnyObject = msg_send![
            alloc_handler,
            initWithCGImage: cg_image as *mut AnyObject,
            options: ns_dict
        ];

        let mut error: *mut AnyObject = std::ptr::null_mut();
        let _success: bool = msg_send![
            handler,
            performRequests: requests,
            error: &mut error
        ];

        if !error.is_null() {
            let desc: *mut AnyObject = msg_send![error, localizedDescription];
            let c_str: *const std::os::raw::c_char = msg_send![desc, UTF8String];
            let err_msg = std::ffi::CStr::from_ptr(c_str).to_string_lossy().into_owned();
            CGImageRelease(cg_image);
            CGContextRelease(ctx);
            CGColorSpaceRelease(color_space);
            anyhow::bail!("VNImageRequestHandler error: {err_msg}");
        }

        // ── 5. Collect results ────────────────────────────────────────────
        let observations: *mut AnyObject = msg_send![request, results];
        let count: usize = if observations.is_null() { 0 } else { msg_send![observations, count] };

        let mut texts: Vec<String> = Vec::with_capacity(count);
        let mut total_confidence: f32 = 0.0;
        let mut confidence_count: u32 = 0;

        for i in 0..count {
            let obs: *mut AnyObject = msg_send![observations, objectAtIndex: i];
            let candidates: *mut AnyObject = msg_send![obs, topCandidates: 1usize];
            let cand_count: usize = msg_send![candidates, count];
            if cand_count == 0 { continue; }

            let top: *mut AnyObject = msg_send![candidates, objectAtIndex: 0usize];
            let ns_string: *mut AnyObject = msg_send![top, string];
            let c_str: *const std::os::raw::c_char = msg_send![ns_string, UTF8String];
            let text = std::ffi::CStr::from_ptr(c_str).to_string_lossy().into_owned();
            texts.push(text);

            let conf: f32 = msg_send![top, confidence];
            total_confidence += conf;
            confidence_count += 1;
        }

        let avg_confidence = if confidence_count > 0 {
            total_confidence / confidence_count as f32
        } else {
            0.0
        };

        // ── 6. Cleanup CG objects ────────────────────────────────────────
        CGImageRelease(cg_image);
        CGContextRelease(ctx);
        CGColorSpaceRelease(color_space);

        Ok(OcrResult {
            text: texts.join("\n"),
            confidence: avg_confidence,
            source: TextSource::AppleVision,
        })
    }
}
