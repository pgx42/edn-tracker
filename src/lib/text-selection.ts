import type { PdfChar, PdfRect } from './pdf-coords';

/**
 * Extract selected text snippet from a browser Selection and char list.
 * Returns the concatenated text of all selected chars.
 */
export function getSelectionSnippet(
  selection: Selection,
  chars: PdfChar[],
): string | null {
  if (!selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  const selectedIndices = new Set<number>();

  // Walk the DOM nodes covered by the range
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_ELEMENT,
    null,
  );

  let node;
  while (node = walker.nextNode()) {
    if (node instanceof HTMLSpanElement && node.hasAttribute('data-char-index')) {
      const idx = parseInt(node.getAttribute('data-char-index') || '-1', 10);
      if (idx >= 0 && idx < chars.length) {
        // Check if this span is within the selection range
        const spanRange = document.createRange();
        spanRange.selectNode(node);
        if (range.compareBoundaryPoints(Range.START_TO_END, spanRange) >= 0 &&
            range.compareBoundaryPoints(Range.END_TO_START, spanRange) <= 0) {
          selectedIndices.add(idx);
        }
      }
    }
  }

  // Build text from selected char indices
  if (selectedIndices.size === 0) return null;

  const indices = Array.from(selectedIndices).sort((a, b) => a - b);
  return indices.map(i => chars[i].c).join('');
}

/**
 * Get the bounding PDF rectangle for a list of char indices.
 * Returns [x1, y1, x2, y2] in PDF space.
 */
export function getSelectionRect(
  charIndices: number[],
  chars: PdfChar[],
): PdfRect | null {
  if (charIndices.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const idx of charIndices) {
    if (idx < 0 || idx >= chars.length) continue;
    const [x1, y1, x2, y2] = chars[idx].rect;
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }

  if (!isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}
