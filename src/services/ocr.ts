/**
 * OCR service — coordinates Apple Vision (via Tauri IPC) and Tesseract.js
 * (Web Worker fallback) for EDN Tracker.
 *
 * Usage:
 *   const result = await ocrService.extractPdfText("/path/to/doc.pdf");
 *   // Each page whose source === "tesseract" had empty text from the backend
 *   // and needs to be re-submitted through the Tesseract worker.
 */

import { invoke } from "@tauri-apps/api/core";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TextSource = "native" | "apple_vision" | "tesseract";

export interface PageResult {
  page: number;
  text: string;
  source: TextSource;
  confidence?: number;
}

export interface PdfTextResult {
  pages: PageResult[];
}

export interface ScanDetection {
  is_scanned: boolean;
  avg_chars_per_page: number;
}

export interface OcrProgress {
  currentPage: number;
  totalPages: number;
  /** 0–100 */
  percent: number;
}

// ─── Internal worker management ───────────────────────────────────────────────

let _ocrWorker: Worker | null = null;

function getOcrWorker(): Worker {
  if (!_ocrWorker) {
    // Vite's `?worker` suffix ensures the file is bundled as a separate chunk
    // and executed in a Web Worker context.
    _ocrWorker = new Worker(new URL("../workers/ocr.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return _ocrWorker;
}

/** Terminate the Tesseract.js worker (call on app teardown). */
export function terminateOcrWorker(): void {
  if (_ocrWorker) {
    _ocrWorker.postMessage({ type: "TERMINATE" });
    _ocrWorker = null;
  }
}

// ─── Tesseract.js fallback ────────────────────────────────────────────────────

interface OcrWorkerResult {
  type: "OCR_RESULT" | "OCR_ERROR" | "OCR_PROGRESS";
  jobId: string;
  text?: string;
  confidence?: number;
  progress?: number;
  error?: string;
}

/**
 * Send an image to the Tesseract.js worker and wait for the result.
 *
 * @param imageSource  URL string or ImageBitmap of the page image.
 * @param onProgress   Optional callback with 0-100 progress.
 */
function runTesseract(
  imageSource: string | ImageBitmap,
  jobId: string,
  onProgress?: (pct: number) => void,
): Promise<{ text: string; confidence: number }> {
  return new Promise((resolve, reject) => {
    const worker = getOcrWorker();

    const handler = (event: MessageEvent<OcrWorkerResult>) => {
      const msg = event.data;
      if (msg.jobId !== jobId) return;

      if (msg.type === "OCR_PROGRESS" && onProgress) {
        onProgress(msg.progress ?? 0);
      } else if (msg.type === "OCR_RESULT") {
        worker.removeEventListener("message", handler);
        resolve({ text: msg.text ?? "", confidence: msg.confidence ?? 0 });
      } else if (msg.type === "OCR_ERROR") {
        worker.removeEventListener("message", handler);
        reject(new Error(msg.error ?? "Tesseract OCR failed"));
      }
    };

    worker.addEventListener("message", handler);
    worker.postMessage({ type: "OCR_PAGE", jobId, imageData: imageSource });
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Determine whether a PDF is primarily scanned (lacks a native text layer).
 */
export async function detectScanType(filePath: string): Promise<ScanDetection> {
  return invoke<ScanDetection>("detect_scan_type_cmd", { path: filePath });
}

/**
 * Extract text from every page of a PDF.
 *
 * Apple Vision (via Rust) handles the heavy lifting.  Pages for which the
 * backend returns `source === "tesseract"` (Vision unavailable or failed)
 * are automatically retried through the Tesseract.js Web Worker if an
 * `imageUrlForPage` resolver is supplied.
 *
 * @param filePath          Absolute path to the PDF on the local filesystem.
 * @param imageUrlForPage   Optional: given a 1-indexed page number, returns
 *                          a URL (or ImageBitmap) for Tesseract to use.
 *                          Required for Tesseract fallback to work.
 * @param onProgress        Optional progress callback.
 */
export async function extractPdfText(
  filePath: string,
  imageUrlForPage?: (page: number) => string | ImageBitmap | Promise<string | ImageBitmap>,
  onProgress?: (progress: OcrProgress) => void,
): Promise<PdfTextResult> {
  // Step 1: invoke Rust backend (Apple Vision / native extraction).
  const backendResult = await invoke<PdfTextResult>("extract_pdf_text_cmd", {
    path: filePath,
  });

  const pages = backendResult.pages;

  // Step 2: identify pages that need Tesseract fallback.
  const tesseractPages = pages.filter(
    (p) => p.source === "tesseract" && !p.text && imageUrlForPage,
  );

  if (tesseractPages.length === 0) {
    return backendResult;
  }

  // Step 3: run Tesseract on each fallback page sequentially (simpler than
  // parallel for now; can be made concurrent if needed).
  for (let i = 0; i < tesseractPages.length; i++) {
    const pageResult = tesseractPages[i];

    if (onProgress) {
      onProgress({
        currentPage: pageResult.page,
        totalPages: tesseractPages.length,
        percent: Math.round((i / tesseractPages.length) * 100),
      });
    }

    try {
      const imageSource = await imageUrlForPage!(pageResult.page);
      const jobId = `${filePath}:${pageResult.page}`;

      const { text, confidence } = await runTesseract(
        imageSource,
        jobId,
        (pct) =>
          onProgress?.({
            currentPage: pageResult.page,
            totalPages: tesseractPages.length,
            percent: Math.round(((i + pct / 100) / tesseractPages.length) * 100),
          }),
      );

      // Update the matching entry in-place.
      const idx = pages.findIndex((p) => p.page === pageResult.page);
      if (idx !== -1) {
        pages[idx] = { ...pages[idx], text, confidence, source: "tesseract" };
      }
    } catch (err) {
      console.error(`Tesseract fallback failed for page ${pageResult.page}:`, err);
      // Leave the page with empty text — caller can decide how to handle.
    }
  }

  if (onProgress) {
    onProgress({
      currentPage: tesseractPages[tesseractPages.length - 1].page,
      totalPages: tesseractPages.length,
      percent: 100,
    });
  }

  return { pages };
}

/**
 * OCR a single page using Apple Vision (via Rust).
 * Throws if Vision is unavailable — caller should fall back to Tesseract.
 */
export async function ocrPage(
  pdfId: string,
  page: number,
): Promise<{ text: string; confidence: number; source: TextSource }> {
  return invoke("ocr_page_cmd", { pdfId, page });
}
