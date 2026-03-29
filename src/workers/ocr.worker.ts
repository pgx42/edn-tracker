/**
 * OCR Web Worker — Tesseract.js fallback for EDN Tracker.
 *
 * Used only when Apple Vision OCR is unavailable (non-macOS builds or
 * when the Rust backend returns source="tesseract" with empty text).
 *
 * Message protocol:
 *
 *   Incoming (from main thread):
 *     { type: "OCR_PAGE"; jobId: string; imageData: ImageBitmap | string; lang?: string }
 *     { type: "TERMINATE" }
 *
 *   Outgoing (to main thread):
 *     { type: "OCR_PROGRESS"; jobId: string; progress: number }   // 0–100
 *     { type: "OCR_RESULT";   jobId: string; text: string; confidence: number }
 *     { type: "OCR_ERROR";    jobId: string; error: string }
 */

import Tesseract, { createWorker, Worker as TesseractWorker } from "tesseract.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type IncomingMessage =
  | { type: "OCR_PAGE"; jobId: string; imageData: ImageBitmap | string; lang?: string }
  | { type: "TERMINATE" };

type OutgoingMessage =
  | { type: "OCR_PROGRESS"; jobId: string; progress: number }
  | { type: "OCR_RESULT"; jobId: string; text: string; confidence: number }
  | { type: "OCR_ERROR"; jobId: string; error: string };

// ─── Worker singleton ─────────────────────────────────────────────────────────

/** Lazily-initialized Tesseract worker (shared across OCR jobs in this worker thread). */
let tesseractWorker: TesseractWorker | null = null;

/**
 * Return (or create) the shared Tesseract worker.
 * Loads French + English recognition models on first call.
 */
async function getOrCreateWorker(lang: string): Promise<TesseractWorker> {
  if (tesseractWorker) {
    return tesseractWorker;
  }

  tesseractWorker = await createWorker(lang, Tesseract.OEM.LSTM_ONLY, {
    // Tesseract.js v5 — models are resolved relative to the Vite asset base.
    // The traineddata files must be present in `public/tessdata/`.
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/tesseract-core-simd.wasm.js",
    langPath: "/tessdata",
    // Disable internal logger — we send progress ourselves.
    logger: () => undefined,
  });

  return tesseractWorker;
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.addEventListener("message", async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;

  if (msg.type === "TERMINATE") {
    if (tesseractWorker) {
      await tesseractWorker.terminate();
      tesseractWorker = null;
    }
    self.close();
    return;
  }

  if (msg.type === "OCR_PAGE") {
    const { jobId, imageData, lang = "fra+eng" } = msg;

    try {
      // Report 0% immediately so the UI can show the spinner.
      postProgress(jobId, 0);

      const worker = await getOrCreateWorker(lang);

      // Convert ImageBitmap to canvas if needed (Tesseract.js expects HTMLImageElement | HTMLCanvasElement | ImageData, not ImageBitmap)
      let ocrInput: HTMLCanvasElement | ImageData | string = imageData;
      if (imageData instanceof ImageBitmap) {
        const canvas = new OffscreenCanvas(imageData.width, imageData.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");
        ctx.drawImage(imageData, 0, 0);
        ocrInput = canvas;
      }

      // Run recognition.
      const { data } = await worker.recognize(ocrInput, undefined, {
        // Progress callback — fires multiple times during recognition.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // Compute aggregate confidence: average of per-word confidences.
      const words = data.words ?? [];
      const avgConfidence =
        words.length > 0
          ? words.reduce((sum, w) => sum + (w.confidence ?? 0), 0) / words.length / 100
          : 0;

      postProgress(jobId, 100);

      const result: OutgoingMessage = {
        type: "OCR_RESULT",
        jobId,
        text: data.text.trim(),
        confidence: avgConfidence,
      };
      self.postMessage(result);
    } catch (err) {
      const error: OutgoingMessage = {
        type: "OCR_ERROR",
        jobId,
        error: err instanceof Error ? err.message : String(err),
      };
      self.postMessage(error);
    }
  }
});

function postProgress(jobId: string, progress: number): void {
  const msg: OutgoingMessage = { type: "OCR_PROGRESS", jobId, progress };
  self.postMessage(msg);
}
