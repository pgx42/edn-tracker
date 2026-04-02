import * as React from "react";
import { useRef, useEffect, useCallback } from "react";
import type { Anchor } from "./AnchorCreationModal";
import type { Annotation } from "./AnnotationLayer";
import {
  type PdfViewport,
  type ViewportRect,
  anchorNormalizedToPdfRect,
  normalizedToPdfRect,
  p2v,
  pointInRect,
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

interface HitTarget {
  type: "anchor" | "annotation";
  anchor?: Anchor;
  annotation?: Annotation;
  rect: ViewportRect;
}

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
  const hitTargetsRef = useRef<HitTarget[]>([]);

  const pageAnchors = anchors.filter((a) => a.page_number === pageNumber);
  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  // Signature for change detection
  const signature = `${pageAnchors.map((a) => a.id).join(",")}|${pageAnnotations.map((a) => a.id).join(",")}|${viewport.scale}|${viewport.width}|${viewport.height}|${showAnchors}|${dpr}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set physical canvas size
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;

    // Clear and scale for HiDPI
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const targets: HitTarget[] = [];

    // Draw anchors
    if (showAnchors) {
      for (const anchor of pageAnchors) {
        const pdfRect = anchorNormalizedToPdfRect(
          anchor,
          viewport.pdfWidth,
          viewport.pdfHeight,
        );
        const vRect = p2v(pdfRect, viewport);
        const w = getRectWidth(vRect);
        const h = getRectHeight(vRect);

        ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
        ctx.fillRect(vRect[0], vRect[1], w, h);

        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1;
        ctx.strokeRect(vRect[0], vRect[1], w, h);

        targets.push({ type: "anchor", anchor, rect: vRect });
      }
    }

    // Draw annotations
    for (const annotation of pageAnnotations) {
      const pdfRect = normalizedToPdfRect(
        [annotation.x, annotation.y, annotation.width, annotation.height],
        viewport.pdfWidth,
        viewport.pdfHeight,
      );
      const vRect = p2v(pdfRect, viewport);
      const w = getRectWidth(vRect);
      const h = getRectHeight(vRect);

      ctx.fillStyle = ANNOTATION_COLORS[annotation.type];
      ctx.fillRect(vRect[0], vRect[1], w, h);

      ctx.strokeStyle = ANNOTATION_STROKE_COLORS[annotation.type];
      ctx.lineWidth = 1;
      ctx.strokeRect(vRect[0], vRect[1], w, h);

      targets.push({ type: "annotation", annotation, rect: vRect });
    }

    hitTargetsRef.current = targets;
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  const findHitTarget = useCallback(
    (clientX: number, clientY: number): HitTarget | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Iterate in reverse so topmost drawn items are hit first
      for (let i = hitTargetsRef.current.length - 1; i >= 0; i--) {
        const target = hitTargetsRef.current[i];
        if (pointInRect(x, y, target.rect)) {
          return target;
        }
      }
      return null;
    },
    [],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const target = findHitTarget(e.clientX, e.clientY);
      if (!target) return;

      if (target.type === "anchor" && target.anchor && onAnchorClick) {
        const rect = canvasRef.current!.getBoundingClientRect();
        onAnchorClick(target.anchor, e.clientX - rect.left, e.clientY - rect.top);
      } else if (target.type === "annotation" && target.annotation && onAnnotationClick) {
        onAnnotationClick(target.annotation);
      }
    },
    [findHitTarget, onAnchorClick, onAnnotationClick],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const target = findHitTarget(e.clientX, e.clientY);
      if (!target) return;

      if (target.type === "anchor" && target.anchor && onAnchorDoubleClick) {
        const rect = canvasRef.current!.getBoundingClientRect();
        onAnchorDoubleClick(target.anchor, e.clientX - rect.left, e.clientY - rect.top);
      }
    },
    [findHitTarget, onAnchorDoubleClick],
  );

  const hasClickHandlers = !!(onAnchorClick || onAnchorDoubleClick || onAnnotationClick);

  return (
    <canvas
      ref={canvasRef}
      onClick={hasClickHandlers ? handleClick : undefined}
      onDoubleClick={onAnchorDoubleClick ? handleDoubleClick : undefined}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: viewport.width,
        height: viewport.height,
        pointerEvents: hasClickHandlers ? "auto" : "none",
        zIndex: 11,
        cursor: hasClickHandlers ? "pointer" : "default",
      }}
    />
  );
};

export default HighlightCanvas;
