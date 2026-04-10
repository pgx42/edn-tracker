import * as React from "react";
import { useRef, useEffect } from "react";
import type { Anchor } from "./AnchorCreationModal";
import type { Annotation } from "./AnnotationLayer";
import {
  type PdfViewport,
  type ViewportRect,
  anchorNormalizedToPdfRect,
  normalizedToPdfRect,
  p2v,
  getRectWidth,
  getRectHeight,
} from "@/lib/pdf-coords";

interface HighlightCanvasProps {
  anchors: Anchor[];
  annotations: Annotation[];
  pageNumber: number;
  viewport: PdfViewport;
  dpr: number;
  showAnchors: boolean;
  onAnchorClick?: (anchor: Anchor, x: number, y: number) => void;
  onAnchorDoubleClick?: (anchor: Anchor, x: number, y: number) => void;
  onAnnotationClick?: (annotation: Annotation) => void;
}

const ANNOTATION_COLORS: Record<Annotation["type"], string> = {
  highlight: "rgba(255, 230, 0, 0.3)",
  note: "rgba(59, 130, 246, 0.2)",
  zone: "rgba(239, 68, 68, 0.2)",
  drawing: "rgba(139, 92, 246, 0.2)",
};

const ANNOTATION_STROKE_COLORS: Record<Annotation["type"], string> = {
  highlight: "rgba(255, 230, 0, 0.6)",
  note: "rgba(59, 130, 246, 0.6)",
  zone: "rgba(239, 68, 68, 0.6)",
  drawing: "rgba(139, 92, 246, 0.6)",
};

export const HighlightCanvas: React.FC<HighlightCanvasProps> = ({
  anchors,
  annotations,
  pageNumber,
  viewport,
  dpr,
  showAnchors,
  onAnchorClick,
  onAnchorDoubleClick,
  onAnnotationClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pageAnchors = anchors.filter((a) => a.page_number === pageNumber);
  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  // Compute viewport rects for all items — used for both drawing and hit-div positioning
  const anchorRects: { anchor: Anchor; rect: ViewportRect }[] = showAnchors
    ? pageAnchors.map((anchor) => ({
        anchor,
        rect: p2v(anchorNormalizedToPdfRect(anchor, viewport.pdfWidth, viewport.pdfHeight), viewport),
      }))
    : [];

  const annotationRects: { annotation: Annotation; rect: ViewportRect }[] = pageAnnotations.map(
    (annotation) => ({
      annotation,
      rect: p2v(
        normalizedToPdfRect(
          [annotation.x, annotation.y, annotation.width, annotation.height],
          viewport.pdfWidth,
          viewport.pdfHeight,
        ),
        viewport,
      ),
    }),
  );

  // Signature for canvas redraw
  const signature = `${anchorRects.map((a) => a.anchor.id).join(",")}|${annotationRects.map((a) => a.annotation.id).join(",")}|${viewport.scale}|${dpr}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (const { rect } of anchorRects) {
      const w = getRectWidth(rect);
      const h = getRectHeight(rect);
      const isPin = w < 8 && h < 8;

      if (isPin) {
        // Draw a small circle icon for point annotations
        const cx = rect[0];
        const cy = rect[1];
        const r = 9;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
        ctx.fill();
        ctx.strokeStyle = "rgba(59, 130, 246, 0.65)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Small message icon lines
        ctx.strokeStyle = "rgba(59, 130, 246, 0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy - 2);
        ctx.lineTo(cx + 4, cy - 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy + 1);
        ctx.lineTo(cx + 2, cy + 1);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
        ctx.fillRect(rect[0], rect[1], w, h);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1;
        ctx.strokeRect(rect[0], rect[1], w, h);
      }
    }

    for (const { annotation, rect } of annotationRects) {
      const w = getRectWidth(rect);
      const h = getRectHeight(rect);
      ctx.fillStyle = ANNOTATION_COLORS[annotation.type];
      ctx.fillRect(rect[0], rect[1], w, h);
      ctx.strokeStyle = ANNOTATION_STROKE_COLORS[annotation.type];
      ctx.lineWidth = 1;
      ctx.strokeRect(rect[0], rect[1], w, h);
    }
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Drawing canvas — pointer-events: none so it never blocks text selection */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: viewport.width,
          height: viewport.height,
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* DOM hit areas for anchors — sit above the text layer (z-index: 0) only in their bbox */}
      {anchorRects.map(({ anchor, rect }) => {
        const w = getRectWidth(rect);
        const h = getRectHeight(rect);
        const isPin = w < 8 && h < 8;
        const PIN_SIZE = 22;
        return (
          <div
            key={anchor.id}
            onClick={onAnchorClick ? (e) => {
              const el = e.currentTarget.getBoundingClientRect();
              onAnchorClick(anchor, e.clientX - el.left + rect[0], e.clientY - el.top + rect[1]);
            } : undefined}
            onDoubleClick={onAnchorDoubleClick ? (e) => {
              const el = e.currentTarget.getBoundingClientRect();
              onAnchorDoubleClick(anchor, e.clientX - el.left + rect[0], e.clientY - el.top + rect[1]);
            } : undefined}
            style={{
              position: "absolute",
              left: isPin ? rect[0] - PIN_SIZE / 2 : rect[0],
              top: isPin ? rect[1] - PIN_SIZE / 2 : rect[1],
              width: isPin ? PIN_SIZE : w,
              height: isPin ? PIN_SIZE : h,
              cursor: "pointer",
              zIndex: 5,
              borderRadius: isPin ? "50%" : undefined,
            }}
          />
        );
      })}

      {/* DOM hit areas for annotations */}
      {annotationRects.map(({ annotation, rect }) => (
        <div
          key={annotation.id}
          onClick={onAnnotationClick ? () => onAnnotationClick(annotation) : undefined}
          style={{
            position: "absolute",
            left: rect[0],
            top: rect[1],
            width: getRectWidth(rect),
            height: getRectHeight(rect),
            cursor: onAnnotationClick ? "pointer" : "default",
            zIndex: 5,
          }}
        />
      ))}
    </>
  );
};

export default HighlightCanvas;
