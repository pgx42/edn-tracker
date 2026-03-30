import * as React from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { Annotation } from "./AnnotationLayer";
import type { SelectionRect } from "./AnchorSelectionLayer";
import { AnchorCreationModal, type Anchor } from "./AnchorCreationModal";
import { BacklinksPanel } from "@/components/BacklinksPanel";
import { LinkCreationModal } from "@/components/LinkCreationModal";
import { ThumbnailList } from "./PdfThumbnails";
import { PdfToolbar, type ZoomMode } from "./PdfToolbar";
import { PageView } from "./PageView";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizablePanelResizeHandle,
  type PanelImperativeHandle,
} from "@/components/ui/resizable";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, AlertCircle } from "lucide-react";

// Polyfill requestIdleCallback for Tauri WebView
if (typeof (globalThis as any).requestIdleCallback === "undefined") {
  (globalThis as any).requestIdleCallback = (callback: IdleRequestCallback) => {
    return setTimeout(callback, 0) as unknown as number;
  };
  (globalThis as any).cancelIdleCallback = (id: number) => {
    clearTimeout(id);
  };
}

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const DPI_SCALE = 150 / 96;
const LOAD_TIMEOUT_MS = 30000;

export interface PdfViewerProps {
  pdfPath: string | null;
  pdfId?: string | null;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  annotations?: Annotation[];
  onAnnotationClick?: (annotation: Annotation) => void;
  onBackToLibrary?: () => void;
}

// ---- Main PdfViewer ----

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfPath,
  pdfId = null,
  onPageChange,
  currentPage: externalPage,
  annotations = [],
  onAnnotationClick,
  onBackToLibrary,
}) => {
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [internalPage, setInternalPage] = React.useState(1);
  const [zoomMode, setZoomMode] = React.useState<ZoomMode>("fit-width");
  const [customZoom, setCustomZoom] = React.useState(1.0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [timedOut, setTimedOut] = React.useState(false);
  const [goToPageInput, setGoToPageInput] = React.useState("");
  const [containerSize, setContainerSize] = React.useState({ width: 800, height: 600 });

  // New state for scroll-based rendering
  const [pageSize, setPageSize] = React.useState<{ width: number; height: number } | null>(null);
  const [visiblePages, setVisiblePages] = React.useState<Set<number>>(new Set());

  // Anchor & backlinks state
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [pendingSelection, setPendingSelection] = React.useState<SelectionRect | null>(null);
  const [anchorModalOpen, setAnchorModalOpen] = React.useState(false);
  const [anchors, setAnchors] = React.useState<Anchor[]>([]);
  const [showBacklinks, setShowBacklinks] = React.useState(false);
  const [showThumbnails, setShowThumbnails] = React.useState(false);
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const [createdAnchorId, setCreatedAnchorId] = React.useState<string | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const thumbPanelRef = React.useRef<PanelImperativeHandle>(null);
  const backlinksPanelRef = React.useRef<PanelImperativeHandle>(null);
  const canvasRefs = React.useRef<Map<number, HTMLCanvasElement>>(new Map());
  const activeRenderTasks = React.useRef<Map<number, RenderTask>>(new Map());
  const loadTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderingPages = React.useRef<Set<number>>(new Set());

  const currentPage = externalPage ?? internalPage;

  // Load anchors for the current page
  React.useEffect(() => {
    if (pdfId === null) {
      setAnchors([]);
      return;
    }
    invoke<Anchor[]>("list_anchors", { pdfId, page: currentPage })
      .then(setAnchors)
      .catch(() => setAnchors([]));
  }, [pdfId, currentPage]);

  // Observe container size
  React.useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load PDF
  React.useEffect(() => {
    if (!pdfPath) {
      setPdfDoc(null);
      setPageCount(0);
      setError(null);
      setTimedOut(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setTimedOut(false);

    loadTimeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        setTimedOut(true);
        setIsLoading(false);
      }
    }, LOAD_TIMEOUT_MS);

    const load = async () => {
      try {
        let pdfSource: string | { data: Uint8Array };

        if (pdfPath.startsWith("http://") || pdfPath.startsWith("https://")) {
          pdfSource = pdfPath;
          console.log("Loading PDF from URL:", pdfPath);
        } else {
          console.log("Loading PDF from filesystem:", pdfPath);
          const bytes = await invoke<number[]>("get_pdf_bytes", { path: pdfPath });
          pdfSource = { data: new Uint8Array(bytes) };
          console.log("PDF bytes loaded:", bytes.length, "bytes");
        }

        const loadingTask = pdfjs.getDocument(pdfSource);
        const doc = await loadingTask.promise;
        if (cancelled) {
          doc.destroy();
          return;
        }

        clearTimeout(loadTimeoutRef.current!);
        console.log("PDF loaded successfully:", { numPages: doc.numPages });
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setInternalPage(1);

        // Get dimensions of page 1 for placeholder sizing
        try {
          const page1 = await doc.getPage(1);
          const vp = page1.getViewport({ scale: 1 });
          console.log("Page 1 dimensions:", { width: vp.width, height: vp.height });
          setPageSize({ width: vp.width, height: vp.height });
          page1.cleanup();
        } catch (err) {
          console.error("Error getting page 1 dimensions:", err);
        }
      } catch (err) {
        if (!cancelled) {
          clearTimeout(loadTimeoutRef.current!);
          const errorMsg = (err as any)?.message ?? String(err);
          const errorName = (err as any)?.name ?? "Error";
          console.error("PDF loading error:", { name: errorName, message: errorMsg, error: err });
          setError(`[${errorName}] ${errorMsg}`);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      clearTimeout(loadTimeoutRef.current!);
    };
  }, [pdfPath]);

  // Calculate effective scale
  const effectiveScale = React.useMemo(() => {
    if (!pageSize) return DPI_SCALE;

    switch (zoomMode) {
      case "fit-page": {
        if (containerSize.height === 0) return DPI_SCALE; // not measured yet
        const scaleX = containerSize.width / pageSize.width;
        const scaleY = containerSize.height / pageSize.height;
        return Math.min(scaleX, scaleY) * DPI_SCALE;
      }
      case "fit-width":
        return (containerSize.width / pageSize.width) * DPI_SCALE;
      case "custom":
        return customZoom * DPI_SCALE;
    }
  }, [zoomMode, customZoom, containerSize, pageSize]);

  // Render a page to canvas
  const renderPage = React.useCallback(
    async (pageNum: number) => {
      console.log(`[renderPage ${pageNum}] Starting`, { pdfDoc: !!pdfDoc, scale: effectiveScale, alreadyRendering: renderingPages.current.has(pageNum) });

      if (!pdfDoc) {
        console.log(`[renderPage ${pageNum}] No pdfDoc`);
        return;
      }

      // Skip if already rendering this page
      if (renderingPages.current.has(pageNum)) {
        console.log(`[renderPage ${pageNum}] Already rendering, skipping`);
        return;
      }

      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas) {
        console.log(`[renderPage ${pageNum}] No canvas ref`);
        return;
      }

      console.log(`[renderPage ${pageNum}] Canvas found, rendering...`);

      // Cancel existing render task
      const existing = activeRenderTasks.current.get(pageNum);
      if (existing) {
        console.log(`[renderPage ${pageNum}] Cancelling previous render`);
        existing.cancel();
        activeRenderTasks.current.delete(pageNum);
      }

      renderingPages.current.add(pageNum);

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: effectiveScale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        console.log(`[renderPage ${pageNum}] Canvas size set to`, { width: canvas.width, height: canvas.height });

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.log(`[renderPage ${pageNum}] Could not get canvas context`);
          renderingPages.current.delete(pageNum);
          return;
        }

        const renderTask = page.render({ canvasContext: ctx, viewport });
        activeRenderTasks.current.set(pageNum, renderTask);

        await renderTask.promise;
        activeRenderTasks.current.delete(pageNum);
        page.cleanup();
        console.log(`[renderPage ${pageNum}] Render complete`);
      } catch (err) {
        if (err instanceof Error && err.name !== "RenderingCancelledException") {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      } finally {
        renderingPages.current.delete(pageNum);
      }
    },
    [pdfDoc, effectiveScale]
  );

  // IntersectionObserver for rendering visible pages
  React.useEffect(() => {
    if (!pdfDoc || !pageSize || !containerRef.current) {
      console.log("[IntersectionObserver setup] Skipped:", { pdfDoc: !!pdfDoc, pageSize: !!pageSize, container: !!containerRef.current });
      return;
    }

    const elements = containerRef.current.querySelectorAll("[data-page]");
    console.log("[IntersectionObserver setup] Found", elements.length, "elements to observe");

    let pendingUpdate: ReturnType<typeof setTimeout> | null = null;
    const pendingEntries: IntersectionObserverEntry[] = [];

    const observer = new IntersectionObserver(
      (entries) => {
        console.log("[IntersectionObserver callback] Entries:", entries.map(e => ({ page: e.target.getAttribute("data-page"), intersecting: e.isIntersecting })));

        // Accumulate entries and debounce the state update
        entries.forEach(e => {
          const idx = pendingEntries.findIndex(pe => pe.target === e.target);
          if (idx >= 0) {
            pendingEntries[idx] = e;
          } else {
            pendingEntries.push(e);
          }
        });

        if (pendingUpdate) clearTimeout(pendingUpdate);

        pendingUpdate = setTimeout(() => {
          setVisiblePages((prev) => {
            const next = new Set(prev);
            pendingEntries.forEach((e) => {
              const num = parseInt(e.target.getAttribute("data-page") ?? "0");
              if (e.isIntersecting) {
                next.add(num);
              } else {
                next.delete(num);
              }
            });
            console.log("[IntersectionObserver] Updated visiblePages:", Array.from(next).sort((a,b) => a-b));
            pendingEntries.length = 0;
            return next;
          });
          pendingUpdate = null;
        }, 100);
      },
      {
        root: containerRef.current,
        rootMargin: "300px 0px",
      }
    );

    elements.forEach((el) => {
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
      if (pendingUpdate) clearTimeout(pendingUpdate);
    };
  }, [pdfDoc, pageSize]);

  // Render visible pages
  React.useEffect(() => {
    console.log("[renderPage effect] Rendering pages:", Array.from(visiblePages).sort((a,b) => a-b));
    visiblePages.forEach((pageNum) => {
      renderPage(pageNum);
    });
  }, [visiblePages, renderPage]);

  // IntersectionObserver for tracking current page (topmost visible)
  React.useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;

    const topObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => parseInt(e.target.getAttribute("data-page") ?? "0"))
          .filter(Boolean)
          .sort((a, b) => a - b);

        if (visible.length > 0) {
          setInternalPage(visible[0]);
          onPageChange?.(visible[0]);
        }
      },
      {
        root: containerRef.current,
        threshold: 0.3,
      }
    );

    containerRef.current?.querySelectorAll("[data-page]").forEach((el) => {
      topObserver.observe(el);
    });

    return () => topObserver.disconnect();
  }, [pdfDoc, pageCount, onPageChange]);

  // Re-render all visible pages on scale change
  React.useEffect(() => {
    visiblePages.forEach((pageNum) => {
      renderPage(pageNum);
    });
  }, [effectiveScale, renderPage, visiblePages]);

  const navigateTo = React.useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(pageCount, page));
      const el = document.getElementById(`pdf-page-${clamped}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      setInternalPage(clamped);
      onPageChange?.(clamped);
    },
    [pageCount, onPageChange]
  );

  const handleZoomIn = () => {
    if (zoomMode === "custom") {
      setCustomZoom((prev) => Math.min(3, prev + 0.1));
    } else {
      setZoomMode("custom");
      setCustomZoom(1.2);
    }
  };

  const handleZoomOut = () => {
    if (zoomMode === "custom") {
      setCustomZoom((prev) => Math.max(0.5, prev - 0.1));
    } else {
      setZoomMode("custom");
      setCustomZoom(0.8);
    }
  };

  // Render errors
  if (error || timedOut) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
          <p className="text-destructive font-medium">Failed to load PDF</p>
          <p className="text-sm mt-1 max-w-xs">{error || "PDF took too long to load"}</p>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pdfDoc || pageCount === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        No PDF loaded
      </div>
    );
  }

  // Main toolbar
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <PdfToolbar
        currentPage={currentPage}
        pageCount={pageCount}
        zoomMode={zoomMode}
        customZoom={customZoom}
        selectionMode={selectionMode}
        showBacklinks={showBacklinks}
        showThumbnails={showThumbnails}
        hasPdfId={pdfId !== null}
        goToPageInput={goToPageInput}
        onPageInputChange={setGoToPageInput}
        onPageInputSubmit={() => {
          const page = parseInt(goToPageInput);
          if (!isNaN(page)) {
            navigateTo(page);
            setGoToPageInput("");
          }
        }}
        onPrev={() => navigateTo(currentPage - 1)}
        onNext={() => navigateTo(currentPage + 1)}
        onFitPage={() => setZoomMode("fit-page")}
        onFitWidth={() => setZoomMode("fit-width")}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleSelection={() => setSelectionMode(!selectionMode)}
        onToggleBacklinks={() => {
          if (backlinksPanelRef.current?.isCollapsed()) {
            backlinksPanelRef.current?.expand();
            setShowBacklinks(true);
          } else {
            backlinksPanelRef.current?.collapse();
            setShowBacklinks(false);
          }
        }}
        onToggleThumbnails={() => {
          if (thumbPanelRef.current?.isCollapsed()) {
            thumbPanelRef.current?.expand();
            setShowThumbnails(true);
          } else {
            thumbPanelRef.current?.collapse();
            setShowThumbnails(false);
          }
        }}
        onBackToLibrary={onBackToLibrary}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* Thumbnail sidebar */}
        <ResizablePanel
          panelRef={thumbPanelRef}
          collapsible
          collapsedSize={0}
          defaultSize={0}
          minSize={7}
          maxSize={20}
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

        {/* Main scroll container with all page placeholders */}
        <ResizablePanel defaultSize={100}>
          <div
            ref={containerRef}
            className="h-full overflow-auto flex flex-col items-center gap-4 py-4 px-2 bg-muted/10"
          >
            {pageCount > 0 && pageSize ? (
              <>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => {
                  const cssWidth = (pageSize.width * effectiveScale) / DPI_SCALE;
                  const cssHeight = (pageSize.height * effectiveScale) / DPI_SCALE;

                  return (
                    <PageView
                      key={pageNum}
                      pageNum={pageNum}
                      cssWidth={cssWidth}
                      cssHeight={cssHeight}
                      isVisible={visiblePages.has(pageNum)}
                      isCurrent={pageNum === currentPage}
                      pdfDoc={pdfDoc}
                      effectiveScale={effectiveScale}
                      pdfId={pdfId}
                      anchors={anchors}
                      annotations={annotations}
                      selectionMode={selectionMode}
                      canvasRef={(el) => {
                        if (el) canvasRefs.current.set(pageNum, el);
                        else canvasRefs.current.delete(pageNum);
                      }}
                      onAnnotationClick={onAnnotationClick}
                      onSelectionComplete={(rect) => {
                        setPendingSelection(rect);
                        setAnchorModalOpen(true);
                        setSelectionMode(false);
                      }}
                    />
                  );
                })}
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Loading PDF...
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizablePanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />

        {/* Backlinks panel */}
        <ResizablePanel
          panelRef={backlinksPanelRef}
          collapsible
          collapsedSize={0}
          defaultSize={0}
          minSize={14}
          maxSize={35}
        >
          {pdfId !== null && <BacklinksPanel pdfId={pdfId} pageNumber={currentPage} />}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Modals */}
      {pdfId !== null && (
        <>
          <AnchorCreationModal
            open={anchorModalOpen}
            onClose={() => setAnchorModalOpen(false)}
            pdfId={pdfId}
            page={currentPage}
            selection={pendingSelection}
            onAnchorCreated={(anchorId: string) => {
              setCreatedAnchorId(anchorId);
              setLinkModalOpen(true);
            }}
          />

          {createdAnchorId && (
            <LinkCreationModal
              open={linkModalOpen}
              onClose={() => {
                setLinkModalOpen(false);
                setCreatedAnchorId(null);
              }}
              sourceAnchorId={createdAnchorId}
            />
          )}
        </>
      )}
    </div>
  );
};
