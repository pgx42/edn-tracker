/**
 * PdfViewer — built on pdfjs-dist PDFViewer (the same engine as Firefox).
 * All page rendering, virtual scrolling and zoom are handled by PDF.js itself.
 * EDN-specific features (anchors, annotations, OCR) are injected as React
 * overlays via createPortal into each PDF.js page div.
 */
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
// @ts-ignore — types live in types/web/pdf_viewer.d.ts; classes in web/pdf_viewer.mjs
import { PDFViewer, EventBus, PDFLinkService } from "pdfjs-dist/web/pdf_viewer";
import "pdfjs-dist/web/pdf_viewer.css";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, AlertCircle } from "lucide-react";

import { AnnotationLayer, type Annotation } from "./AnnotationLayer";
import { AnchorSelectionLayer, type SelectionRect } from "./AnchorSelectionLayer";
import { HighlightCanvas } from "./HighlightCanvas";
import { OcrTextLayer, type OcrLine } from "./OcrTextLayer";
import { AnchorCreationModal, type Anchor } from "./AnchorCreationModal";
import { BacklinksPanel } from "@/components/BacklinksPanel";
import { LinkCreationModal } from "@/components/LinkCreationModal";
import { AnkiCardCreationModal } from "@/components/AnkiCardCreationModal";
import { FloatingCommentPanel } from "./FloatingCommentPanel";
import { ThumbnailList } from "./PdfThumbnails";
import { PdfToolbar, type ZoomMode } from "./PdfToolbar";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizablePanelResizeHandle,
  usePanelRef,
} from "@/components/ui/resizable";
import type { PdfViewport } from "@/lib/pdf-coords";
import type { AnkiCardCreationContext } from "@/lib/types";

// Polyfill requestIdleCallback for Tauri WebView
if (typeof (globalThis as any).requestIdleCallback === "undefined") {
  (globalThis as any).requestIdleCallback = (cb: IdleRequestCallback) =>
    setTimeout(cb, 0) as unknown as number;
  (globalThis as any).cancelIdleCallback = (id: number) => clearTimeout(id);
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ─── Public props ──────────────────────────────────────────────────────────────

export interface PdfViewerProps {
  pdfPath: string | null;
  pdfId?: string | null;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  annotations?: Annotation[];
  onAnnotationClick?: (annotation: Annotation) => void;
  onBackToLibrary?: () => void;
}

// ─── Per-page overlay ──────────────────────────────────────────────────────────

interface RenderedPageInfo {
  /** The div element PDF.js created for this page — portal target */
  div: Element;
  viewport: PdfViewport;
}

interface PageOverlayProps {
  pageNum: number;
  viewport: PdfViewport;
  pdfId: string | null;
  anchors: Anchor[];
  annotations: Annotation[];
  selectionMode: boolean;
  showAnchors: boolean;
  ocrLines?: OcrLine[];
  onSelectionComplete: (rect: SelectionRect, page: number) => void;
  onAnchorDoubleClick?: (anchor: Anchor, x: number, y: number) => void;
  onAnnotationClick?: (annotation: Annotation) => void;
}

const PageOverlay: React.FC<PageOverlayProps> = ({
  pageNum,
  viewport,
  pdfId,
  anchors,
  annotations,
  selectionMode,
  showAnchors,
  ocrLines,
  onSelectionComplete,
  onAnchorDoubleClick,
  onAnnotationClick,
}) => (
  <>
    {ocrLines && ocrLines.length > 0 && (
      <OcrTextLayer
        lines={ocrLines}
        pageWidth={viewport.width}
        pageHeight={viewport.height}
      />
    )}
    <AnnotationLayer
      pageNumber={pageNum}
      annotations={annotations}
      onAnnotationClick={onAnnotationClick}
      scale={1}
      pageWidth={viewport.width}
      pageHeight={viewport.height}
    />
    {pdfId !== null && showAnchors && (
      <HighlightCanvas
        anchors={anchors}
        annotations={annotations}
        pageNumber={pageNum}
        viewport={viewport}
        dpr={window.devicePixelRatio ?? 1}
        showAnchors={showAnchors}
        onAnchorDoubleClick={onAnchorDoubleClick}
        onAnnotationClick={onAnnotationClick}
      />
    )}
    {pdfId !== null && viewport.width > 0 && viewport.height > 0 && (
      <AnchorSelectionLayer
        active={selectionMode}
        pageWidth={viewport.width}
        pageHeight={viewport.height}
        onSelectionComplete={(rect) => onSelectionComplete(rect, pageNum)}
      />
    )}
  </>
);

// ─── Main component ────────────────────────────────────────────────────────────

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfPath,
  pdfId = null,
  onPageChange,
  currentPage: externalPage,
  annotations = [],
  onAnnotationClick,
  onBackToLibrary,
}) => {
  // DOM
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewerDivRef = React.useRef<HTMLDivElement>(null);

  // PDF.js instances (not in state — mutations don't need re-renders)
  const pdfViewerRef = React.useRef<any>(null);
  const pdfDocRef = React.useRef<PDFDocumentProxy | null>(null);

  // Panel collapse handles
  const thumbPanelRef = usePanelRef();
  const backlinksPanelRef = usePanelRef();

  // Keep onPageChange stable in a ref so the eventbus closure never goes stale
  const onPageChangeRef = React.useRef(onPageChange);
  React.useEffect(() => { onPageChangeRef.current = onPageChange; }, [onPageChange]);

  // ── Loading state ──
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ── PDF state ──
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null); // for ThumbnailList
  const [pageCount, setPageCount] = React.useState(0);
  const [internalPage, setInternalPage] = React.useState(1);
  const [displayScale, setDisplayScale] = React.useState(1.0);

  // ── Zoom ──
  const [zoomMode, setZoomMode] = React.useState<ZoomMode>("fit-width");
  const [customZoom, setCustomZoom] = React.useState(1.0);
  const [goToPageInput, setGoToPageInput] = React.useState("");

  // ── Overlay portals: page number → { div, viewport } ──
  const [renderedPages, setRenderedPages] = React.useState<Map<number, RenderedPageInfo>>(new Map());

  // ── OCR ──
  const [isScanned, setIsScanned] = React.useState(false);
  const [ocrLines, setOcrLines] = React.useState<Map<number, OcrLine[]>>(new Map());
  const processedOcrPages = React.useRef<Set<number>>(new Set());

  // ── Anchors & selection ──
  const [anchors, setAnchors] = React.useState<Anchor[]>([]);
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [pendingSelection, setPendingSelection] = React.useState<SelectionRect | null>(null);
  const [pendingPage, setPendingPage] = React.useState(1);
  const [anchorModalOpen, setAnchorModalOpen] = React.useState(false);
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const [createdAnchorId, setCreatedAnchorId] = React.useState<string | null>(null);
  const [selectedAnchor, setSelectedAnchor] = React.useState<Anchor | null>(null);
  const [selectedAnchorPos, setSelectedAnchorPos] = React.useState<{ x: number; y: number } | null>(null);

  // ── UI panels ──
  const [showBacklinks, setShowBacklinks] = React.useState(false);
  const [showThumbnails, setShowThumbnails] = React.useState(false);
  const [showAnchors, setShowAnchors] = React.useState(true);

  // ── Anki ──
  const [ankiModalOpen, setAnkiModalOpen] = React.useState(false);
  const [ankiContext, setAnkiContext] = React.useState<AnkiCardCreationContext | undefined>(undefined);

  const currentPage = externalPage ?? internalPage;

  // ── Initialize PDFViewer once (runs after first render, DOM is ready) ──────
  React.useEffect(() => {
    const container = containerRef.current;
    const viewerDiv = viewerDivRef.current;
    if (!container || !viewerDiv) return;

    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus });

    const viewer = new PDFViewer({
      container,
      viewer: viewerDiv,
      eventBus,
      linkService,
      textLayerMode: 1,       // ENABLE: PDF.js renders native text layer
      removePageBorders: false,
    });

    linkService.setViewer(viewer);
    pdfViewerRef.current = viewer;

    // Record each rendered page so we can portal our overlays into it
    eventBus.on("pagerendered", ({ pageNumber, source }: any) => {
      const vp = source.viewport;
      const pdfViewport: PdfViewport = {
        width: vp.width,
        height: vp.height,
        scale: vp.scale,
        pdfWidth: Math.round(vp.width / vp.scale),
        pdfHeight: Math.round(vp.height / vp.scale),
      };
      setRenderedPages((prev) => new Map(prev).set(pageNumber, { div: source.div, viewport: pdfViewport }));
    });

    // Current page tracking (scrolling through the document)
    eventBus.on("pagechanging", ({ pageNumber }: any) => {
      setInternalPage(pageNumber);
      onPageChangeRef.current?.(pageNumber);
    });

    // Keep displayScale in sync (for toolbar %)
    eventBus.on("scalechanging", ({ scale }: any) => {
      setDisplayScale(scale);
    });

    return () => {
      viewer.cleanup?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally once

  // ── Load PDF when path changes ─────────────────────────────────────────────
  React.useEffect(() => {
    if (!pdfPath) {
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
      setPdfDoc(null);
      setPageCount(0);
      setInternalPage(1);
      setRenderedPages(new Map());
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setRenderedPages(new Map());
    setIsScanned(false);
    setOcrLines(new Map());
    processedOcrPages.current = new Set();

    const load = async () => {
      try {
        let src: string | { data: Uint8Array };
        if (pdfPath.startsWith("http://") || pdfPath.startsWith("https://")) {
          src = pdfPath;
        } else {
          const bytes = await invoke<number[]>("get_pdf_bytes", { path: pdfPath });
          if (cancelled) return;
          src = { data: new Uint8Array(bytes) };
        }

        const doc = await pdfjs.getDocument(src).promise;
        if (cancelled) { doc.destroy(); return; }

        pdfDocRef.current?.destroy();
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setInternalPage(1);

        const v = pdfViewerRef.current;
        if (v) {
          v.setDocument(doc);
          v.linkService?.setDocument(doc);
        }

        // Detect scanned PDF (background, non-blocking)
        if (!pdfPath.startsWith("http")) {
          invoke<{ is_scanned: boolean }>("detect_scan_type_cmd", { path: pdfPath })
            .then((r) => { if (!cancelled) setIsScanned(r.is_scanned); })
            .catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setError((err as any)?.message ?? String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [pdfPath]);

  // ── Load anchors for current page ─────────────────────────────────────────
  React.useEffect(() => {
    if (!pdfId) { setAnchors([]); return; }
    invoke<Anchor[]>("list_anchors", { pdf_id: pdfId, page: currentPage })
      .then(setAnchors)
      .catch(() => setAnchors([]));
  }, [pdfId, currentPage]);

  // ── OCR: trigger for each newly rendered page (scanned PDFs only) ──────────
  React.useEffect(() => {
    if (!isScanned || !pdfId) return;
    renderedPages.forEach((_, pageNum) => {
      if (processedOcrPages.current.has(pageNum)) return;
      processedOcrPages.current.add(pageNum);
      invoke<{ lines: OcrLine[] }>("ocr_page_cmd", { pdf_id: pdfId, page: pageNum })
        .then((r) => setOcrLines((prev) => new Map(prev).set(pageNum, r.lines)))
        .catch(() => processedOcrPages.current.delete(pageNum));
    });
  }, [isScanned, pdfId, renderedPages]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigateTo = React.useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(pageCount, page));
      if (pdfViewerRef.current) pdfViewerRef.current.currentPageNumber = clamped;
    },
    [pageCount]
  );

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const applyScale = (mode: ZoomMode, value?: number) => {
    const v = pdfViewerRef.current;
    if (!v) return;
    if (mode === "fit-width") v.currentScaleValue = "page-width";
    else if (mode === "fit-page") v.currentScaleValue = "page-fit";
    else v.currentScale = value ?? customZoom;
  };

  const handleFitWidth = () => { setZoomMode("fit-width"); applyScale("fit-width"); };
  const handleFitPage  = () => { setZoomMode("fit-page");  applyScale("fit-page"); };

  const handleZoomIn = () => {
    const next = Math.min(3, (pdfViewerRef.current?.currentScale ?? displayScale) + 0.1);
    setZoomMode("custom"); setCustomZoom(next); applyScale("custom", next);
  };
  const handleZoomOut = () => {
    const next = Math.max(0.25, (pdfViewerRef.current?.currentScale ?? displayScale) - 0.1);
    setZoomMode("custom"); setCustomZoom(next); applyScale("custom", next);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
        <p className="text-destructive font-medium">Failed to load PDF</p>
        <p className="text-sm mt-1 max-w-xs text-muted-foreground">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      <PdfToolbar
        currentPage={currentPage}
        pageCount={pageCount}
        zoomMode={zoomMode}
        customZoom={customZoom}
        displayZoom={displayScale}
        selectionMode={selectionMode}
        showBacklinks={showBacklinks}
        showThumbnails={showThumbnails}
        showAnchors={showAnchors}
        hasPdfId={pdfId !== null}
        goToPageInput={goToPageInput}
        onPageInputChange={setGoToPageInput}
        onPageInputSubmit={() => {
          const p = parseInt(goToPageInput);
          if (!isNaN(p)) { navigateTo(p); setGoToPageInput(""); }
        }}
        onPrev={() => navigateTo(currentPage - 1)}
        onNext={() => navigateTo(currentPage + 1)}
        onFitPage={handleFitPage}
        onFitWidth={handleFitWidth}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleSelection={() => setSelectionMode((s) => !s)}
        onToggleBacklinks={() => setShowBacklinks((s) => !s)}
        onToggleThumbnails={() => setShowThumbnails((s) => !s)}
        onToggleAnchors={() => setShowAnchors((s) => !s)}
        onBackToLibrary={onBackToLibrary}
        onCreateAnkiCard={() => {
          setAnkiContext({});
          setAnkiModalOpen(true);
        }}
        hasSelectedAnchor={selectedAnchor !== null}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 overflow-hidden">

        {/* ── Thumbnails ── */}
        <ResizablePanel
          panelRef={thumbPanelRef}
          collapsible
          collapsedSize="0%"
          defaultSize="6%"
          minSize="5%"
          maxSize="40%"
        >
          <div className="h-full border-r bg-muted/30 overflow-hidden">
            {pdfDoc && pageCount > 0 && (
              <ThumbnailList
                pdfDoc={pdfDoc}
                pageCount={pageCount}
                currentPage={currentPage}
                onPageSelect={navigateTo}
              />
            )}
          </div>
        </ResizablePanel>

        <ResizablePanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />

        {/* ── Main PDF area ── */}
        <ResizablePanel defaultSize={80} minSize={15}>
          <div className="relative h-full">

            {/* Loading spinner (centered over the panel) */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-50 bg-background/60">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Selection mode hint */}
            {selectionMode && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg pointer-events-none">
                Dessinez un rectangle sur la page
              </div>
            )}

            {/* Floating comment panel */}
            {selectedAnchor && (
              <FloatingCommentPanel
                anchor={selectedAnchor}
                position={selectedAnchorPos || undefined}
                onClose={() => { setSelectedAnchor(null); setSelectedAnchorPos(null); }}
              />
            )}

            {/* PDF.js scroll container — absolute inset-0 gives it a hard bounded height */}
            <div
              ref={containerRef}
              className="absolute inset-0 overflow-auto"
              style={{ backgroundColor: "#525659" }}
            >
              <div ref={viewerDivRef} className="pdfViewer" />

              {/* Inject our React overlays into each PDF.js page div */}
              {Array.from(renderedPages.entries()).map(([pageNum, { div, viewport }]) =>
                ReactDOM.createPortal(
                  <PageOverlay
                    pageNum={pageNum}
                    viewport={viewport}
                    pdfId={pdfId}
                    anchors={anchors.filter((a) => a.page_number === pageNum)}
                    annotations={annotations.filter((a) => a.pageNumber === pageNum)}
                    selectionMode={selectionMode}
                    showAnchors={showAnchors}
                    ocrLines={ocrLines.get(pageNum)}
                    onSelectionComplete={(rect, page) => {
                      setPendingSelection(rect);
                      setPendingPage(page);
                      setAnchorModalOpen(true);
                      setSelectionMode(false);
                    }}
                    onAnchorDoubleClick={(anchor, x, y) => {
                      setSelectedAnchor(anchor);
                      setSelectedAnchorPos({ x, y });
                    }}
                    onAnnotationClick={onAnnotationClick}
                  />,
                  div
                )
              )}
            </div>

          </div>
        </ResizablePanel>

        <ResizablePanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />

        {/* ── Backlinks ── */}
        <ResizablePanel
          panelRef={backlinksPanelRef}
          collapsible
          collapsedSize="0%"
          defaultSize="10%"
          minSize="5%"
          maxSize="50%"
        >
          {pdfId !== null && (
            <BacklinksPanel pdfId={pdfId} pageNumber={currentPage} />
          )}
        </ResizablePanel>

      </ResizablePanelGroup>

      {/* ── Modals ── */}
      {pdfId !== null && (
        <>
          <AnchorCreationModal
            open={anchorModalOpen}
            onClose={() => setAnchorModalOpen(false)}
            pdfId={pdfId}
            page={pendingPage}
            selection={pendingSelection}
            onAnchorCreated={(anchorId) => {
              setCreatedAnchorId(anchorId);
              setLinkModalOpen(true);
            }}
          />
          {createdAnchorId && (
            <LinkCreationModal
              open={linkModalOpen}
              onClose={() => { setLinkModalOpen(false); setCreatedAnchorId(null); }}
              sourceAnchorId={createdAnchorId}
            />
          )}
        </>
      )}

      <AnkiCardCreationModal
        open={ankiModalOpen}
        onClose={() => { setAnkiModalOpen(false); setAnkiContext(undefined); }}
        context={ankiContext}
      />

    </div>
  );
};
