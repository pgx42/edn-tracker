import * as React from "react";

export interface Annotation {
  id: string;
  type: "highlight" | "note" | "zone" | "drawing";
  pageNumber: number;
  // Normalized coords (0-1) relative to page
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  content?: string;
}

interface AnnotationLayerProps {
  pageNumber: number;
  annotations: Annotation[];
  // Called when user draws a new zone
  onAnnotationCreate?: (annotation: Omit<Annotation, "id">) => void;
  // Called when clicking existing annotation
  onAnnotationClick?: (annotation: Annotation) => void;
  // Scale factor matching the PDF canvas
  scale: number;
  pageWidth: number;
  pageHeight: number;
}

/**
 * AnnotationLayer - Phase 4 skeleton.
 *
 * Currently renders existing annotations as transparent overlays.
 * Interaction and creation UI will be implemented in Phase 4.
 */
export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  pageNumber,
  annotations,
  onAnnotationClick,
  scale,
  pageWidth,
  pageHeight,
}) => {
  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  const annotationColorMap: Record<Annotation["type"], string> = {
    highlight: "rgba(255, 230, 0, 0.3)",
    note: "rgba(59, 130, 246, 0.2)",
    zone: "rgba(239, 68, 68, 0.2)",
    drawing: "rgba(139, 92, 246, 0.2)",
  };

  return (
    <div
      className="annotation-layer"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: pageWidth * scale,
        height: pageHeight * scale,
        pointerEvents: "none",
      }}
    >
      {pageAnnotations.map((annotation) => (
        <div
          key={annotation.id}
          onClick={() => onAnnotationClick?.(annotation)}
          style={{
            position: "absolute",
            left: annotation.x * pageWidth * scale,
            top: annotation.y * pageHeight * scale,
            width: annotation.width * pageWidth * scale,
            height: annotation.height * pageHeight * scale,
            backgroundColor: annotationColorMap[annotation.type],
            border: `1px solid ${annotationColorMap[annotation.type].replace("0.", "0.6")}`,
            cursor: onAnnotationClick ? "pointer" : "default",
            pointerEvents: onAnnotationClick ? "auto" : "none",
            borderRadius: 2,
          }}
          title={annotation.content}
        />
      ))}
    </div>
  );
};

export default AnnotationLayer;
