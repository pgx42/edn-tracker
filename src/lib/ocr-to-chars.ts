import { PdfChar, normalizedToPdfRect } from './pdf-coords';

/**
 * OCR line as returned by the Tauri backend.
 * bbox is normalized [x, y, w, h] in 0-1 range, top-left origin.
 */
export interface OcrLine {
  text: string;
  confidence: number;
  bbox: [number, number, number, number];
}

/**
 * Convert OCR lines into PdfChar[] suitable for text-selection overlay.
 *
 * Each line's normalized bbox is converted to PDF space (bottom-left origin,
 * Y grows up) via normalizedToPdfRect(), then characters are distributed
 * uniformly across the horizontal extent of the resulting PDF rect.
 *
 * @param lines - OCR lines from the backend
 * @param pdfWidth - PDF page width in points
 * @param pdfHeight - PDF page height in points
 * @returns Array of PdfChar in PDF coordinate space
 */
export function ocrLinesToChars(
  lines: Array<OcrLine>,
  pdfWidth: number,
  pdfHeight: number,
): PdfChar[] {
  const chars: PdfChar[] = [];

  for (const line of lines) {
    if (line.text.length === 0) continue;

    // Convert normalized bbox [x, y, w, h] (top-left origin, 0-1)
    // to PDF rect [x1, y1, x2, y2] (bottom-left origin, points).
    // normalizedToPdfRect handles the Y-axis flip:
    //   pdfY2 = (1 - ny) * pdfHeight        (top of bbox in PDF space)
    //   pdfY1 = (1 - (ny + nh)) * pdfHeight  (bottom of bbox in PDF space)
    const [pdfX1, pdfY1, pdfX2, pdfY2] = normalizedToPdfRect(
      line.bbox,
      pdfWidth,
      pdfHeight,
    );

    const charWidth = (pdfX2 - pdfX1) / line.text.length;

    for (let i = 0; i < line.text.length; i++) {
      const c = line.text[i];

      chars.push({
        c,
        rect: [
          pdfX1 + i * charWidth,
          pdfY1,
          pdfX1 + (i + 1) * charWidth,
          pdfY2,
        ],
        rotation: 0,
        lineBreakAfter: i === line.text.length - 1,
        paragraphBreakAfter: false,
        spaceAfter: c === ' ',
        ignorable: line.confidence < 0.2,
      });
    }
  }

  return chars;
}
