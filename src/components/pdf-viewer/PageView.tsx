import * as React from "react";
import { useState, useEffect } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { PdfViewport, PdfChar } from "@/lib/pdf-coords";
import { AnnotationLayer, type Annotation } from "./AnnotationLayer";
import { AnchorSelectionLayer, type SelectionRect } from "./AnchorSelectionLayer";
import UnifiedTextLayer from "./UnifiedTextLayer";
import { HighlightCanvas } from "./HighlightCanvas";
import type { OcrLine } from "./OcrTextLayer";
import type { Anchor } from "./AnchorCreationModal";

export interface PageViewProps {
  pageNum: number;
  viewport: PdfViewport;
  isVisible: boolean;
  isCurrent: boolean;
  pdfDoc: PDFDocumentProxy | null;
  pdfId: string | null;
  anchors: Anchor[];
  annotations: Annotation[];
  selectionMode: boolean;
  showAnchors: boolean;
  ocrLines?: OcrLine[];
  canvasRef: (el: HTMLCanvasElement | null) => void;
  onAnnotationClick?: (annotation: Annotation) => void;
  onSelectionComplete: (rect: SelectionRect, pageNum: number) => void;
  onAnchorDoubleClick?: (anchor: Anchor, x: number, y: number) => void;
}

export const PageView: React.FC<PageViewProps> = ({
  pageNum,
  viewport,
  isVisible,
  isCurrent,
  pdfDoc,
  pdfId,
  anchors,
  annotations,
  selectionMode,
  showAnchors,
  ocrLines,
  canvasRef,
  onAnnotationClick,
  onSelectionComplete,
  onAnchorDoubleClick,
}) => {
  const { width: cssWidth, height: cssHeight } = viewport;

  const [pdfPage, setPdfPage] = useState<PDFPageProxy | null>(null);
  const [_pageChars, setPageChars] = useState<PdfChar[]>([]);

  // Resolve PDFPageProxy from the document
  useEffect(() => {
    if (!pdfDoc || !isVisible) {
      setPdfPage(null);
      return;
    }

    let cancelled = false;
    pdfDoc.getPage(pageNum).then((page) => {
      if (!cancelled) setPdfPage(page);
    });
    return () => { cancelled = true; };
  }, [pdfDoc, pageNum, isVisible]);

  return (
    <div
      key={pageNum}
      data-page={pageNum}
      id={`pdf-page-${pageNum}`}
      className={`relative shadow-md bg-white overflow-hidden ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}
      style={{ width: cssWidth, height: cssHeight, position: "relative" }}
    >
      {isVisible ? (
        <>
          <canvas
            ref={canvasRef}
            style={{
              display: "block",
              position: "absolute",
              top: 0,
              left: 0,
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
          {pdfPage && (
            <UnifiedTextLayer
              mode={ocrLines && ocrLines.length > 0 ? 'ocr' : 'native'}
              pdfPage={pdfPage}
              pageNum={pageNum}
              ocrLines={ocrLines}
              viewport={viewport}
              cssScale={viewport.scale}
              isVisible={isVisible}
              onCharsReady={setPageChars}
            />
          )}
          {/* Fallback message if no text layer loaded */}
          {pdfPage && !_pageChars.length && ocrLines && ocrLines.length === 0 && (
            <div className="absolute inset-0 text-xs text-muted-foreground/50 flex items-center justify-center pointer-events-none">
              Loading text layer...
            </div>
          )}
          <AnnotationLayer
            pageNumber={pageNum}
            annotations={annotations}
            onAnnotationClick={onAnnotationClick}
            scale={1}
            pageWidth={cssWidth}
            pageHeight={cssHeight}
          />
          {pdfId !== null && showAnchors && (
            <HighlightCanvas
              anchors={anchors}
              annotations={annotations}
              pageNumber={pageNum}
              viewport={viewport}
              dpr={window.devicePixelRatio ?? 1.0}
              showAnchors={showAnchors}
              onAnchorDoubleClick={onAnchorDoubleClick}
              onAnnotationClick={onAnnotationClick}
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
