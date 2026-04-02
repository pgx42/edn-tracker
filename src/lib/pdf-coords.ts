/**
 * PDF Viewer Coordinate System Management
 *
 * Handles transformations between:
 * - PDF space: points (1/72 inch), origin at bottom-left, Y grows up
 * - Viewport space: CSS pixels, origin at top-left, Y grows down
 * - Normalized space: 0-1 range with origin at top-left (OCR backend format)
 *
 * Inspired by Zotero's pdf-worker coordinate handling.
 */

/**
 * A single character extracted from a PDF
 * Used by both native text layer and OCR layer
 */
export interface PdfChar {
  /** The character itself */
  c: string;

  /** Bounding box in PDF coordinates [x1, y1, x2, y2]
   * origin = bottom-left, units = points (1/72 inch)
   * y1 = bottom edge, y2 = top edge (y grows upward in PDF space)
   */
  rect: [number, number, number, number];

  /** Text rotation: 0, 90, 180, or 270 degrees */
  rotation: 0 | 90 | 180 | 270;

  /** True if a line break follows this character */
  lineBreakAfter: boolean;

  /** True if a paragraph break follows this character */
  paragraphBreakAfter: boolean;

  /** True if a space follows this character */
  spaceAfter: boolean;

  /** True if this character should be ignored (e.g., low-confidence OCR) */
  ignorable: boolean;

  /** Font name, if available */
  fontName?: string;
}

/**
 * Normalized viewport for PDF rendering
 * Separates CSS scaling from device pixel ratio
 */
export interface PdfViewport {
  /** Width in CSS pixels (not physical pixels) */
  width: number;

  /** Height in CSS pixels (not physical pixels) */
  height: number;

  /** CSS scale factor: CSS pixels per PDF point
   * Example: if PDFPage is 612pt wide and viewport is 900px wide, scale = 900/612 ≈ 1.47
   * Does NOT include devicePixelRatio
   */
  scale: number;

  /** PDF page width in points (e.g., 612 for US Letter) */
  pdfWidth: number;

  /** PDF page height in points (e.g., 792 for US Letter) */
  pdfHeight: number;
}

/** Rectangle in PDF coordinates [x1, y1, x2, y2]
 * origin = bottom-left, units = points
 */
export type PdfRect = readonly [number, number, number, number];

/** Rectangle in viewport coordinates [left, top, right, bottom]
 * origin = top-left, units = CSS pixels
 */
export type ViewportRect = readonly [number, number, number, number];

/** Rectangle in normalized coordinates [x, y, width, height]
 * origin = top-left, range = 0-1 (used by OCR backend)
 */
export type NormalizedRect = readonly [number, number, number, number];

/**
 * Get the device pixel ratio with fallback
 * On Retina displays: typically 2.0
 * On standard displays: typically 1.0
 * In Tauri WebView: returns the actual display's DPI ratio
 */
export function getDevicePixelRatio(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio ?? 1.0 : 1.0;
}

/**
 * Build a normalized viewport from CSS scale and PDF dimensions
 *
 * @param cssScale - CSS scale factor (CSS pixels per PDF point)
 * @param pdfWidth - PDF page width in points
 * @param pdfHeight - PDF page height in points
 * @returns Normalized viewport
 */
export function buildPdfViewport(
  cssScale: number,
  pdfWidth: number,
  pdfHeight: number,
): PdfViewport {
  return {
    width: pdfWidth * cssScale,
    height: pdfHeight * cssScale,
    scale: cssScale,
    pdfWidth,
    pdfHeight,
  };
}

/**
 * Convert a rectangle from PDF space to viewport space
 *
 * PDF coordinates have origin at bottom-left with Y growing upward.
 * Viewport coordinates have origin at top-left with Y growing downward.
 * This function handles the axis swap and scaling.
 *
 * @param pdfRect - Rectangle in PDF space [x1, y1, x2, y2]
 * @param viewport - Target viewport
 * @returns Rectangle in viewport space [left, top, right, bottom]
 */
export function p2v(pdfRect: PdfRect, viewport: PdfViewport): ViewportRect {
  const [x1, y1, x2, y2] = pdfRect;
  const { scale, height } = viewport;

  // X-axis: scale directly (both left-to-right)
  const left = x1 * scale;
  const right = x2 * scale;

  // Y-axis: flip and scale
  // PDF: y1 = bottom, y2 = top
  // Viewport: top = height - (y2 * scale), bottom = height - (y1 * scale)
  const top = height - y2 * scale;
  const bottom = height - y1 * scale;

  return [left, top, right, bottom];
}

/**
 * Convert a rectangle from viewport space to PDF space
 * Inverse of p2v
 *
 * @param viewportRect - Rectangle in viewport space [left, top, right, bottom]
 * @param viewport - Source viewport
 * @returns Rectangle in PDF space [x1, y1, x2, y2]
 */
export function v2p(viewportRect: ViewportRect, viewport: PdfViewport): PdfRect {
  const [left, top, right, bottom] = viewportRect;
  const { scale, height } = viewport;

  // Reverse the scaling and flip
  const x1 = left / scale;
  const x2 = right / scale;
  const y2 = (height - top) / scale;
  const y1 = (height - bottom) / scale;

  return [x1, y1, x2, y2];
}

/**
 * Convert a normalized rectangle (0-1 range, top-left origin) to PDF space
 *
 * Used for OCR backend results which return bboxes as [x, y, width, height]
 * in normalized coordinates with origin at top-left.
 *
 * @param normRect - Normalized rectangle [x, y, width, height]
 * @param pdfWidth - PDF page width in points
 * @param pdfHeight - PDF page height in points
 * @returns Rectangle in PDF space [x1, y1, x2, y2]
 */
export function normalizedToPdfRect(
  normRect: NormalizedRect,
  pdfWidth: number,
  pdfHeight: number,
): PdfRect {
  const [nx, ny, nw, nh] = normRect;

  // Convert from normalized to PDF points
  const pdfX1 = nx * pdfWidth;
  const pdfX2 = (nx + nw) * pdfWidth;

  // Flip Y-axis: normalized has origin at top, PDF has origin at bottom
  // In normalized space: ny=0 is top, ny+nh is bottom
  // In PDF space: y1 must be bottom, y2 must be top
  const pdfY2 = (1 - ny) * pdfHeight;     // top of bbox
  const pdfY1 = (1 - (ny + nh)) * pdfHeight; // bottom of bbox

  return [pdfX1, pdfY1, pdfX2, pdfY2];
}

/**
 * Anchor object with normalized coordinates
 * This is the format stored in the database
 */
export interface AnchorWithNormalizedCoords {
  x: number;  // 0-1
  y: number;  // 0-1
  w: number;  // 0-1
  h: number;  // 0-1
}

/**
 * Convert an anchor with normalized coordinates to PDF space
 *
 * @param anchor - Anchor with x, y, w, h in 0-1 range
 * @param pdfWidth - PDF page width in points
 * @param pdfHeight - PDF page height in points
 * @returns Rectangle in PDF space [x1, y1, x2, y2]
 */
export function anchorNormalizedToPdfRect(
  anchor: AnchorWithNormalizedCoords,
  pdfWidth: number,
  pdfHeight: number,
): PdfRect {
  return normalizedToPdfRect(
    [anchor.x, anchor.y, anchor.w, anchor.h],
    pdfWidth,
    pdfHeight,
  );
}

/**
 * Get rectangle width
 */
export function getRectWidth(rect: ViewportRect | PdfRect): number {
  return rect[2] - rect[0];
}

/**
 * Get rectangle height
 */
export function getRectHeight(rect: ViewportRect | PdfRect): number {
  return rect[3] - rect[1];
}

/**
 * Check if a point is inside a rectangle
 *
 * @param x - Point x coordinate
 * @param y - Point y coordinate
 * @param rect - Rectangle [x1, y1, x2, y2]
 * @returns True if point is inside rectangle
 */
export function pointInRect(x: number, y: number, rect: ViewportRect | PdfRect): boolean {
  return x >= rect[0] && x <= rect[2] && y >= rect[1] && y <= rect[3];
}

/**
 * Calculate distance between two rectangles
 * Returns 0 if they overlap, or the shortest distance between their edges
 *
 * @param rect1 - First rectangle
 * @param rect2 - Second rectangle
 * @returns Distance in same units as input rectangles
 */
export function rectDistance(
  rect1: ViewportRect | PdfRect,
  rect2: ViewportRect | PdfRect,
): number {
  const dx = Math.max(
    rect1[0] - rect2[2],
    rect2[0] - rect1[2],
    0,
  );
  const dy = Math.max(
    rect1[1] - rect2[3],
    rect2[1] - rect1[3],
    0,
  );
  return Math.hypot(dx, dy);
}

/**
 * Check if two rectangles overlap
 */
export function rectsIntersect(
  rect1: ViewportRect | PdfRect,
  rect2: ViewportRect | PdfRect,
): boolean {
  return !(
    rect1[2] < rect2[0] ||
    rect1[0] > rect2[2] ||
    rect1[3] < rect2[1] ||
    rect1[1] > rect2[3]
  );
}
