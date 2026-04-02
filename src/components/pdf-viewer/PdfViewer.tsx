import * as React from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { Annotation } from "./AnnotationLayer";
import type { SelectionRect } from "./AnchorSelectionLayer";
import { AnchorCreationModal, type Anchor } from "./AnchorCreationModal";
import { BacklinksPanel } from "@/components/BacklinksPanel";
import { LinkCreationModal } from "@/components/LinkCreationModal";
import { AnkiCardCreationModal } from "@/components/AnkiCardCreationModal";
import { FloatingCommentPanel } from "./FloatingCommentPanel";
import { ThumbnailList } from "./PdfThumbnails";
import { PdfToolbar, type ZoomMode } from "./PdfToolbar";
import { PageView } from "./PageView";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizablePanelResizeHandle,
  usePanelRef,
} from "@/components/ui/resizable";
import { buildPdfViewport, type PdfViewport } from "@/lib/pdf-coords";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, AlertCircle } from "lucide-react";
import { useAnkiStore } from "@/stores/anki";
import type { AnkiCardCreationContext } from "@/lib/types";

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
  const [dpr, setDpr] = React.useState(() => window.devicePixelRatio ?? 1.0);

  // New state for scroll-based rendering
  const [pageSize, setPageSize] = React.useState<{ width: number; height: number } | null>(null);
  const [visiblePages, setVisiblePages] = React.useState<Set<number>>(new Set());

  // OCR state
  const [isScanned, setIsScanned] = React.useState(false);
  const [ocrLines, setOcrLines] = React.useState<Map<number, any[]>>(new Map());

  // Anchor & backlinks state
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [pendingSelection, setPendingSelection] = React.useState<SelectionRect | null>(null);
  const [pendingPage, setPendingPage] = React.useState(1);
  const [anchorModalOpen, setAnchorModalOpen] = React.useState(false);
  const [anchors, setAnchors] = React.useState<Anchor[]>([]);
  const [showBacklinks, setShowBacklinks] = React.useState(false);
  const [showThumbnails, setShowThumbnails] = React.useState(false);
  const [showAnchors, setShowAnchors] = React.useState(true);
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const [createdAnchorId, setCreatedAnchorId] = React.useState<string | null>(null);
  const [selectedAnchor, setSelectedAnchor] = React.useState<Anchor | null>(null);
  const [selectedAnchorPos, setSelectedAnchorPos] = React.useState<{ x: number; y: number } | null>(null);
  const [ankiModalOpen, setAnkiModalOpen] = React.useState(false);
  const [ankiContext, setAnkiContext] = React.useState<AnkiCardCreationContext | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const thumbPanelRef = usePanelRef();
  const backlinksPanelRef = usePanelRef();
  const canvasRefs = React.useRef<Map<number, HTMLCanvasElement>>(new Map());
  const activeRenderTasks = React.useRef<Map<number, RenderTask>>(new Map());
  const loadTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderingPages = React.useRef<Set<number>>(new Set());
  const internalPageRef = React.useRef(internalPage);
  const processedOcrPages = React.useRef<Set<number>>(new Set());

  const currentPage = externalPage ?? internalPage;

  // Load anchors for the current page
  React.useEffect(() => {
    if (pdfId === null) {
      setAnchors([]);
      return;
    }
    invoke<Anchor[]>("list_anchors", { pdf_id: pdfId, page: currentPage })
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

  // Track device pixel ratio changes (e.g. moving window between Retina and non-Retina displays)
  React.useEffect(() => {
    const updateDpr = () => setDpr(window.devicePixelRatio ?? 1.0);
    const mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mql.addEventListener("change", updateDpr);
    return () => mql.removeEventListener("change", updateDpr);
  }, [dpr]); // re-subscribe when dpr changes so the media query stays in sync

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

        // Detect if PDF is scanned (background task)
        if (pdfPath && !pdfPath.startsWith("http")) {
          invoke<{ is_scanned: boolean; avg_chars_per_page: number }>("detect_scan_type_cmd", {
            path: pdfPath,
          })
            .then((result) => {
              console.log("Scan detection:", result);
              setIsScanned(result.is_scanned);
            })
            .catch((err) => {
              console.error("Error detecting scan type:", err);
              setIsScanned(false);
            });
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

  // Calculate CSS scale (CSS pixels per PDF point, no DPI multiplier)
  const cssScale = React.useMemo(() => {
    if (!pageSize) return 1.0;

    switch (zoomMode) {
      case "fit-page": {
        if (containerSize.height === 0) return 1.0;
        const scaleX = containerSize.width / pageSize.width;
        const scaleY = containerSize.height / pageSize.height;
        return Math.min(scaleX, scaleY);
      }
      case "fit-width":
        return containerSize.width / pageSize.width;
      case "custom":
        return customZoom;
    }
  }, [zoomMode, customZoom, containerSize, pageSize]);

  // Build a PdfViewport for child components
  const viewport: PdfViewport | null = React.useMemo(() => {
    if (!pageSize) return null;
    return buildPdfViewport(cssScale, pageSize.width, pageSize.height);
  }, [cssScale, pageSize]);

  // Refs for wheel handler — avoid re-attaching on every zoom change
  const zoomModeRef = React.useRef(zoomMode);
  const cssScaleRef = React.useRef(cssScale);
  const renderPageRef = React.useRef<(pageNum: number) => Promise<void>>(async () => {});
  React.useEffect(() => { zoomModeRef.current = zoomMode; }, [zoomMode]);
  React.useEffect(() => { cssScaleRef.current = cssScale; }, [cssScale]);
  React.useEffect(() => { internalPageRef.current = internalPage; }, [internalPage]);

  // Trackpad/wheel zoom (pinch-to-zoom on macOS via ctrlKey)
  // Attached once to avoid the re-attach lag at every zoom step
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Only intercept pinch-to-zoom (ctrlKey) or explicit ctrl+scroll
      if (!e.ctrlKey) return;

      e.preventDefault();

      const sensitivity = 0.005;
      const delta = -e.deltaY * sensitivity;

      setCustomZoom((prev) => {
        const base = zoomModeRef.current === "custom" ? prev : cssScaleRef.current;
        return Math.min(3, Math.max(0.5, base + delta));
      });
      setZoomMode("custom");
    };

    // Must use { passive: false } to allow preventDefault()
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // attach once, reads fresh values via refs

  // Render a page to canvas
  const renderPage = React.useCallback(
    async (pageNum: number) => {
      console.log(`[renderPage ${pageNum}] Starting`, { pdfDoc: !!pdfDoc, cssScale, dpr, alreadyRendering: renderingPages.current.has(pageNum) });

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
        const vp = page.getViewport({ scale: cssScale });

        // Physical canvas dimensions: CSS size * devicePixelRatio for sharp rendering
        canvas.width = Math.round(vp.width * dpr);
        canvas.height = Math.round(vp.height * dpr);
        // CSS size matches the viewport exactly
        canvas.style.width = vp.width + "px";
        canvas.style.height = vp.height + "px";

        console.log(`[renderPage ${pageNum}] Canvas size set to`, {
          physical: { w: canvas.width, h: canvas.height },
          css: { w: vp.width, h: vp.height },
          dpr,
        });

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.log(`[renderPage ${pageNum}] Could not get canvas context`);
          renderingPages.current.delete(pageNum);
          return;
        }

        // Scale context so pdf.js draws at physical resolution
        ctx.scale(dpr, dpr);

        const renderTask = page.render({ canvasContext: ctx, viewport: vp });
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
    [pdfDoc, cssScale, dpr]
  );

  // Keep ref in sync with renderPage callback
  React.useEffect(() => {
    renderPageRef.current = renderPage;
  }, [renderPage]);

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


  // Reset OCR tracking when PDF changes
  React.useEffect(() => {
    processedOcrPages.current = new Set();
  }, [pdfId]);

  // Auto-OCR for visible scanned pages
  React.useEffect(() => {
    if (!isScanned || !pdfId) return;

    visiblePages.forEach((pageNum) => {
      // Skip if already processed
      if (processedOcrPages.current.has(pageNum)) return;

      processedOcrPages.current.add(pageNum);
      console.log(`[OCR effect] Triggering OCR for page ${pageNum}`);

      invoke<{ text: string; confidence: number; source: string; lines: any[] }>("ocr_page_cmd", {
        pdf_id: pdfId,
        page: pageNum,
      })
        .then((result) => {
          console.log(`[OCR effect] OCR complete for page ${pageNum}:`, result.lines.length, "lines");
          setOcrLines((prev) => new Map(prev).set(pageNum, result.lines));
        })
        .catch((err) => {
          console.error(`[OCR effect] OCR failed for page ${pageNum}:`, err);
          processedOcrPages.current.delete(pageNum); // allow retry on error
        });
    });
  }, [isScanned, pdfId, visiblePages]);

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

        if (visible.length > 0 && visible[0] !== internalPageRef.current) {
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
  }, [cssScale, dpr, renderPage, visiblePages]);

  const navigateTo = React.useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(pageCount, page));
      // TEMP: Comment scrollIntoView to debug auto-scroll issue
      // const el = document.getElementById(`pdf-page-${clamped}`);
      // el?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      setCustomZoom(Math.min(3, cssScale + 0.1));
    }
  };

  const handleZoomOut = () => {
    if (zoomMode === "custom") {
      setCustomZoom((prev) => Math.max(0.5, prev - 0.1));
    } else {
      setZoomMode("custom");
      setCustomZoom(Math.max(0.5, cssScale - 0.1));
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
        displayZoom={cssScale}
        selectionMode={selectionMode}
        showBacklinks={showBacklinks}
        showThumbnails={showThumbnails}
        showAnchors={showAnchors}
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
        onToggleAnchors={() => setShowAnchors(!showAnchors)}
        onToggleBacklinks={() => {
          const p = backlinksPanelRef.current;
          if (!p) return;
          if (p.isCollapsed()) { p.expand(); setShowBacklinks(true); }
          else { p.collapse(); setShowBacklinks(false); }
        }}
        onToggleThumbnails={() => {
          const p = thumbPanelRef.current;
          if (!p) return;
          if (p.isCollapsed()) { p.expand(); setShowThumbnails(true); }
          else { p.collapse(); setShowThumbnails(false); }
        }}
        onBackToLibrary={onBackToLibrary}
        hasSelectedAnchor={selectedAnchor !== null}
        onCreateAnkiCard={() => {
          const context: AnkiCardCreationContext = selectedAnchor
            ? {
                sourceAnchorId: selectedAnchor.id,
                sourceLabel: selectedAnchor.label,
                prefillQuestion: selectedAnchor.text_snippet ?? undefined,
              }
            : {};
          setAnkiContext(context);
          setAnkiModalOpen(true);
        }}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* Thumbnail sidebar */}
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

        {/* Main scroll container with all page placeholders */}
        <ResizablePanel defaultSize={100} minSize={15}>
          <div className="relative h-full">
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
                onClose={() => {
                  setSelectedAnchor(null);
                  setSelectedAnchorPos(null);
                }}
              />
            )}

            <div
              ref={containerRef}
              className="h-full overflow-auto flex flex-col items-center gap-4 py-4 px-2 bg-muted/10"
            >
            {pageCount > 0 && viewport ? (
              <>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
                    <PageView
                      key={pageNum}
                      pageNum={pageNum}
                      viewport={viewport}
                      isVisible={visiblePages.has(pageNum)}
                      isCurrent={pageNum === currentPage}
                      pdfDoc={pdfDoc}
                      pdfId={pdfId}
                      anchors={anchors}
                      annotations={annotations}
                      selectionMode={selectionMode}
                      showAnchors={showAnchors}
                      ocrLines={ocrLines.get(pageNum)}
                      canvasRef={(el) => {
                        if (el) canvasRefs.current.set(pageNum, el);
                        else canvasRefs.current.delete(pageNum);
                      }}
                      onAnnotationClick={onAnnotationClick}
                      onSelectionComplete={(rect, pageNum) => {
                        setPendingSelection(rect);
                        setPendingPage(pageNum);
                        setAnchorModalOpen(true);
                        setSelectionMode(false);
                      }}
                      onAnchorDoubleClick={(anchor, x, y) => {
                        setSelectedAnchor(anchor);
                        setSelectedAnchorPos({ x, y });
                      }}
                    />
                ))}
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Loading PDF...
              </div>
            )}
            </div>
          </div>
        </ResizablePanel>

        <ResizablePanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />

        {/* Backlinks panel */}
        <ResizablePanel
          panelRef={backlinksPanelRef}
          collapsible
          collapsedSize="0%"
          defaultSize="10%"
          minSize="5%"
          maxSize="50%"
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
            page={pendingPage}
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

      {ankiModalOpen && (
        <AnkiCardCreationModal
          open={ankiModalOpen}
          onClose={() => {
            setAnkiModalOpen(false);
            setAnkiContext(null);
          }}
          context={ankiContext ?? undefined}
          onCardCreated={(card) => {
            useAnkiStore.getState().addCard(card);
            setAnkiModalOpen(false);
            setAnkiContext(null);
          }}
        />
      )}
    </div>
  );
};
