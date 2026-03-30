import * as React from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AnnotationLayer, type Annotation } from "./AnnotationLayer";
import { AnchorHighlight } from "./AnchorHighlight";
import { AnchorSelectionLayer, type SelectionRect } from "./AnchorSelectionLayer";
import { PageTextLayerWrapper } from "./PageTextLayer";
import type { Anchor } from "./AnchorCreationModal";

const DPI_SCALE = 150 / 96;

export interface PageViewProps {
  pageNum: number;
  cssWidth: number;
  cssHeight: number;
  isVisible: boolean;
  isCurrent: boolean;
  pdfDoc: PDFDocumentProxy | null;
  effectiveScale: number;
  pdfId: string | null;
  anchors: Anchor[];
  annotations: Annotation[];
  selectionMode: boolean;
  canvasRef: (el: HTMLCanvasElement | null) => void;
  onAnnotationClick?: (annotation: Annotation) => void;
  onSelectionComplete: (rect: SelectionRect, pageNum: number) => void;
}

export const PageView: React.FC<PageViewProps> = ({
  pageNum,
  cssWidth,
  cssHeight,
  isVisible,
  isCurrent,
  pdfDoc,
  effectiveScale,
  pdfId,
  anchors,
  annotations,
  selectionMode,
  canvasRef,
  onAnnotationClick,
  onSelectionComplete,
}) => {
  return (
    <div
      key={pageNum}
      data-page={pageNum}
      id={`pdf-page-${pageNum}`}
      className={`relative shadow-md bg-white ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}
      style={{ width: cssWidth, height: cssHeight }}
    >
      {isVisible ? (
        <>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />
          {pdfDoc && <PageTextLayerWrapper pdfDoc={pdfDoc} pageNum={pageNum} scale={effectiveScale} />}
          <AnnotationLayer
            pageNumber={pageNum}
            annotations={annotations}
            onAnnotationClick={onAnnotationClick}
            scale={1 / DPI_SCALE}
            pageWidth={cssWidth}
            pageHeight={cssHeight}
          />
          {pdfId !== null && (
            <AnchorHighlight
              anchors={anchors}
              pageNumber={pageNum}
              pageWidth={cssWidth}
              pageHeight={cssHeight}
            />
          )}
          {pdfId !== null && cssWidth > 0 && cssHeight > 0 && isVisible && (
            <AnchorSelectionLayer
              active={selectionMode}
              pageWidth={cssWidth}
              pageHeight={cssHeight}
              onSelectionComplete={(rect) => onSelectionComplete(rect, pageNum)}
            />
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground/30">
          {pageNum}
        </div>
      )}
    </div>
  );
};
