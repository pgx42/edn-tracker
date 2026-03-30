import * as React from "react";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AnchorSelectionLayerProps {
  /** Whether selection mode is active */
  active: boolean;
  /** Page dimensions in CSS pixels */
  pageWidth: number;
  pageHeight: number;
  /** Called when a drag-selection completes */
  onSelectionComplete: (rect: SelectionRect) => void;
}

/**
 * Transparent overlay that captures click-drag to select a region.
 * Coordinates are normalized (0-1) relative to the page.
 */
export const AnchorSelectionLayer: React.FC<AnchorSelectionLayerProps> = ({
  active,
  pageWidth,
  pageHeight,
  onSelectionComplete,
}) => {
  const [dragging, setDragging] = React.useState(false);
  const [startPos, setStartPos] = React.useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = React.useState({ x: 0, y: 0 });
  const layerRef = React.useRef<HTMLDivElement>(null);

  const toNormalized = (clientX: number, clientY: number) => {
    const el = layerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!active) return;
    e.preventDefault();
    const pos = toNormalized(e.clientX, e.clientY);
    setStartPos(pos);
    setCurrentPos(pos);
    setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    e.preventDefault();
    setCurrentPos(toNormalized(e.clientX, e.clientY));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragging) return;
    e.preventDefault();
    const end = toNormalized(e.clientX, e.clientY);
    setDragging(false);

    const x = Math.min(startPos.x, end.x);
    const y = Math.min(startPos.y, end.y);
    const width = Math.abs(end.x - startPos.x);
    const height = Math.abs(end.y - startPos.y);

    // Ignore tiny accidental clicks
    if (width > 0.01 && height > 0.01) {
      onSelectionComplete({ x, y, width, height });
    }
  };

  // Selection preview rect in CSS pixels
  const previewStyle = React.useMemo(() => {
    if (!dragging) return null;
    const x = Math.min(startPos.x, currentPos.x) * pageWidth;
    const y = Math.min(startPos.y, currentPos.y) * pageHeight;
    const w = Math.abs(currentPos.x - startPos.x) * pageWidth;
    const h = Math.abs(currentPos.y - startPos.y) * pageHeight;
    return { left: x, top: y, width: w, height: h };
  }, [dragging, startPos, currentPos, pageWidth, pageHeight]);

  return (
    <div
      ref={layerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: pageWidth,
        height: pageHeight,
        cursor: active ? "crosshair" : "default",
        zIndex: 20,
        pointerEvents: active ? "auto" : "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {previewStyle && (
        <div
          style={{
            position: "absolute",
            left: previewStyle.left,
            top: previewStyle.top,
            width: previewStyle.width,
            height: previewStyle.height,
            backgroundColor: "rgba(59, 130, 246, 0.25)",
            border: "2px dashed rgba(59, 130, 246, 0.8)",
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

export default AnchorSelectionLayer;
