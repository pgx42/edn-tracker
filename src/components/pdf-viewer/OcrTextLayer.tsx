import * as React from "react";

export interface OcrLine {
  text: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height] normalized 0-1
}

interface OcrTextLayerProps {
  lines: OcrLine[];
  pageWidth: number;
  pageHeight: number;
}

/**
 * Renders an invisible but selectable text layer for OCR results.
 * Each line is positioned using its bounding box, with transparent text
 * so users can select and copy OCR'd text without seeing the actual glyphs.
 */
export const OcrTextLayer: React.FC<OcrTextLayerProps> = ({
  lines,
  pageWidth,
  pageHeight,
}) => {
  return (
    <div className="ocr-text-layer">
      {lines.map((line, i) => {
        const x = line.bbox[0] * pageWidth;
        const y = line.bbox[1] * pageHeight;
        const w = line.bbox[2] * pageWidth;
        const h = line.bbox[3] * pageHeight;
        const fontSize = Math.max(8, h * 0.85);

        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: h,
              fontSize: `${fontSize}px`,
              color: "transparent",
              whiteSpace: "nowrap",
              overflow: "hidden",
              lineHeight: 1,
              transformOrigin: "top left",
            }}
          >
            {line.text}
          </span>
        );
      })}
    </div>
  );
};
