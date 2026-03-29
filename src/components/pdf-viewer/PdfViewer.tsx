import * as React from "react";
import * as pdfjs from "pdfjs-dist";
import { TextLayer as PdfTextLayerRenderer } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { AnnotationLayer, type Annotation } from "./AnnotationLayer";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlignJustify,
  Loader2,
  AlertCircle,
} from "lucide-react";

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// DPI target: 150 DPI (96 is CSS default)
const DPI_SCALE = 150 / 96;

// How many pages to keep rendered around the current page
const RENDER_WINDOW = 2;

// Load timeout in ms
const LOAD_TIMEOUT_MS = 15000;

export interface PdfViewerProps {
  /** Absolute file path or URL to the PDF */
  pdfPath: string | null;
  /** Fires when the visible page changes */
  onPageChange?: (page: number) => void;
  /** Externally-controlled current page (1-based) */
  currentPage?: number;
  /** Annotations overlay */
  annotations?: Annotation[];
  /** Fires when annotation is clicked */
  onAnnotationClick?: (annotation: Annotation) => void;
}

type ZoomMode = "fit-page" | "fit-width" | "custom";

interface PageState {
  rendered: boolean;
  rendering: boolean;
}

// ---- Thumbnail component ----

interface ThumbnailProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  isCurrent: boolean;
  onClick: () => void;
}

const Thumbnail: React.FC<ThumbnailProps> = ({ pdfDoc, pageNumber, isCurrent, onClick }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const render = async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 0.2 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderTask = page.render({ canvasContext: ctx, viewport });
      try {
        await renderTask.promise;
        if (!cancelled) setRendered(true);
      } catch {
        // cancelled or error - ignore
      }
    };

    render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber]);

  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-1 p-1.5 rounded cursor-pointer transition-all
        hover:bg-accent border-2
        ${isCurrent ? "border-primary bg-accent/50" : "border-transparent"}
      `}
      title={`Page ${pageNumber}`}
    >
      <div className="relative bg-white shadow-sm overflow-hidden" style={{ minHeight: 60 }}>
        {!rendered && (
          <div className="w-14 h-20 flex items-center justify-center bg-muted">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <canvas ref={canvasRef} className={rendered ? "" : "hidden"} />
      </div>
      <span className="text-xs text-muted-foreground font-mono">{pageNumber}</span>
    </button>
  );
};

// ---- Lazy thumbnail list ----

interface ThumbnailListProps {
  pdfDoc: PDFDocumentProxy;
  pageCount: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
}

const ThumbnailList: React.FC<ThumbnailListProps> = ({
  pdfDoc,
  pageCount,
  currentPage,
  onPageSelect,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const currentRef = React.useRef<HTMLDivElement>(null);
  const [visibleEnd, setVisibleEnd] = React.useState(Math.min(20, pageCount));

  // Scroll current page into view
  React.useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentPage]);

  // Extend visible range when user scrolls near the bottom
  const handleScroll = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      setVisibleEnd((prev) => Math.min(pageCount, prev + 10));
    }
  }, [pageCount]);

  const pages = Array.from({ length: visibleEnd }, (_, i) => i + 1);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex flex-col items-center gap-1 overflow-y-auto h-full p-2"
    >
      {pages.map((n) => (
        <div key={n} ref={n === currentPage ? currentRef : undefined} className="w-full flex justify-center">
          <Thumbnail
            pdfDoc={pdfDoc}
            pageNumber={n}
            isCurrent={n === currentPage}
            onClick={() => onPageSelect(n)}
          />
        </div>
      ))}
      {visibleEnd < pageCount && (
        <div className="py-4 text-xs text-muted-foreground">Scroll for more...</div>
      )}
    </div>
  );
};

// ---- Text layer ----

interface TextLayerProps {
  page: PDFPageProxy;
  viewport: pdfjs.PageViewport;
}

const TextLayer: React.FC<TextLayerProps> = ({ page, viewport }) => {
  const divRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const div = divRef.current;
    if (!div) return;

    let cancelled = false;

    let textLayerInstance: InstanceType<typeof PdfTextLayerRenderer> | null = null;

    const render = async () => {
      const textContent = await page.getTextContent();
      if (cancelled || !div) return;

      // Clear previous children using DOM API
      while (div.firstChild) {
        div.removeChild(div.firstChild);
      }

      textLayerInstance = new PdfTextLayerRenderer({
        textContentSource: textContent,
        container: div,
        viewport,
      });
      try {
        await textLayerInstance.render();
      } catch {
        // cancelled or error
      }
    };

    render();
    return () => {
      cancelled = true;
      textLayerInstance?.cancel();
      // Clear children on unmount
      if (div) {
        while (div.firstChild) {
          div.removeChild(div.firstChild);
        }
      }
    };
  }, [page, viewport]);

  return (
    <div
      ref={divRef}
      className="textLayer"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: viewport.width,
        height: viewport.height,
        lineHeight: 1,
        overflow: "hidden",
        opacity: 1,
        userSelect: "text",
        transformOrigin: "0 0",
      }}
    />
  );
};

// ---- Main PdfViewer ----

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfPath,
  onPageChange,
  currentPage: externalPage,
  annotations = [],
  onAnnotationClick,
}) => {
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [internalPage, setInternalPage] = React.useState(1);
  const [zoomMode, setZoomMode] = React.useState<ZoomMode>("fit-page");
  const [customZoom, setCustomZoom] = React.useState(1.0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [timedOut, setTimedOut] = React.useState(false);
  const [goToPageInput, setGoToPageInput] = React.useState("");
  const [containerSize, setContainerSize] = React.useState({ width: 800, height: 600 });
  const [renderedPages, setRenderedPages] = React.useState<Map<number, PageState>>(new Map());
  const [pageViewport, setPageViewport] = React.useState<pdfjs.PageViewport | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRefs = React.useRef<Map<number, HTMLCanvasElement>>(new Map());
  const activeRenderTasks = React.useRef<Map<number, RenderTask>>(new Map());
  const loadTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPage = externalPage ?? internalPage;

  // Observe container size for fit-page / fit-width calculations
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
    setRenderedPages(new Map());

    loadTimeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        setTimedOut(true);
        setIsLoading(false);
      }
    }, LOAD_TIMEOUT_MS);

    const load = async () => {
      try {
        const loadingTask = pdfjs.getDocument(pdfPath);
        const doc = await loadingTask.promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        clearTimeout(loadTimeoutRef.current!);
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setInternalPage(1);
      } catch (err) {
        if (!cancelled) {
          clearTimeout(loadTimeoutRef.current!);
          setError(err instanceof Error ? err.message : "Failed to load PDF");
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

  // Calculate effective scale based on zoom mode + page viewport
  const effectiveScale = React.useMemo(() => {
    if (!pageViewport) return DPI_SCALE;
    const naturalWidth = pageViewport.width / pageViewport.scale;
    const naturalHeight = pageViewport.height / pageViewport.scale;

    switch (zoomMode) {
      case "fit-page": {
        const scaleX = containerSize.width / naturalWidth;
        const scaleY = containerSize.height / naturalHeight;
        return Math.min(scaleX, scaleY) * DPI_SCALE;
      }
      case "fit-width":
        return (containerSize.width / naturalWidth) * DPI_SCALE;
      case "custom":
        return customZoom * DPI_SCALE;
    }
  }, [zoomMode, customZoom, containerSize, pageViewport]);

  // Render a single page to its canvas
  const renderPage = React.useCallback(
    async (pageNum: number) => {
      if (!pdfDoc) return;
      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas) return;

      // Cancel existing render for this page
      const existing = activeRenderTasks.current.get(pageNum);
      if (existing) {
        existing.cancel();
        activeRenderTasks.current.delete(pageNum);
      }

      setRenderedPages((prev) => {
        const next = new Map(prev);
        next.set(pageNum, { rendered: false, rendering: true });
        return next;
      });

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: effectiveScale });

        if (pageNum === 1) setPageViewport(viewport);

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / DPI_SCALE}px`;
        canvas.style.height = `${viewport.height / DPI_SCALE}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const renderTask = page.render({ canvasContext: ctx, viewport });
        activeRenderTasks.current.set(pageNum, renderTask);

        await renderTask.promise;
        activeRenderTasks.current.delete(pageNum);

        setRenderedPages((prev) => {
          const next = new Map(prev);
          next.set(pageNum, { rendered: true, rendering: false });
          return next;
        });

        page.cleanup();
      } catch (err) {
        if (err instanceof Error && err.name !== "RenderingCancelledException") {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
        setRenderedPages((prev) => {
          const next = new Map(prev);
          next.delete(pageNum);
          return next;
        });
      }
    },
    [pdfDoc, effectiveScale]
  );

  // Pages to keep in memory
  const pagesInWindow = React.useMemo(() => {
    if (!pageCount) return [];
    const pages: number[] = [];
    for (
      let i = Math.max(1, currentPage - RENDER_WINDOW);
      i <= Math.min(pageCount, currentPage + RENDER_WINDOW);
      i++
    ) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, pageCount]);

  // Evict pages outside the window
  React.useEffect(() => {
    setRenderedPages((prev) => {
      const next = new Map(prev);
      for (const pageNum of prev.keys()) {
        if (!pagesInWindow.includes(pageNum)) {
          const task = activeRenderTasks.current.get(pageNum);
          if (task) {
            task.cancel();
            activeRenderTasks.current.delete(pageNum);
          }
          next.delete(pageNum);
        }
      }
      return next;
    });
  }, [pagesInWindow]);

  // Schedule rendering via requestIdleCallback for neighbor pages
  React.useEffect(() => {
    if (!pdfDoc) return;

    renderPage(currentPage);

    const neighbors = pagesInWindow.filter((p) => p !== currentPage);
    const ids: number[] = [];

    neighbors.forEach((pageNum) => {
      if (renderedPages.get(pageNum)?.rendered) return;
      const id = requestIdleCallback(() => renderPage(pageNum), { timeout: 2000 });
      ids.push(id);
    });

    return () => ids.forEach((id) => cancelIdleCallback(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, currentPage, effectiveScale]);

  // Re-render on scale changes
  React.useEffect(() => {
    if (!pdfDoc) return;
    pagesInWindow.forEach((pageNum) => renderPage(pageNum));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScale]);

  const navigateTo = React.useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(pageCount, page));
      setInternalPage(clamped);
      onPageChange?.(clamped);
    },
    [pageCount, onPageChange]
  );

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        navigateTo(currentPage + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        navigateTo(currentPage - 1);
      }
    },
    [currentPage, navigateTo]
  );

  React.useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleGoToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(goToPageInput, 10);
    if (!isNaN(num)) {
      navigateTo(num);
      setGoToPageInput("");
    }
  };

  const zoomPercent = Math.round((effectiveScale / DPI_SCALE) * 100);

  // ---- Render states ----

  if (!pdfPath) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <AlignJustify className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No PDF selected</p>
        </div>
      </div>
    );
  }

  if (isLoading || timedOut) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          {timedOut ? (
            <>
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
              <p className="text-destructive">Load timed out</p>
              <p className="text-sm mt-1">The PDF took too long to load.</p>
            </>
          ) : (
            <>
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin" />
              <p>Loading PDF...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
          <p className="text-destructive font-medium">Failed to load PDF</p>
          <p className="text-sm mt-1 max-w-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!pdfDoc) return null;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0 flex-wrap">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateTo(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page (ArrowLeft)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <form onSubmit={handleGoToPage} className="flex items-center gap-1">
            <input
              type="text"
              value={goToPageInput || String(currentPage)}
              onChange={(e) => setGoToPageInput(e.target.value)}
              onFocus={(e) => {
                setGoToPageInput(String(currentPage));
                e.target.select();
              }}
              className="w-12 text-center text-sm h-8 rounded border border-input bg-background px-1 font-mono"
              aria-label="Current page"
            />
          </form>

          <span className="text-sm text-muted-foreground">/ {pageCount}</span>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateTo(currentPage + 1)}
            disabled={currentPage >= pageCount}
            title="Next page (ArrowRight)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            variant={zoomMode === "fit-page" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs px-2"
            onClick={() => setZoomMode("fit-page")}
            title="Fit Page"
          >
            <Maximize2 className="h-3.5 w-3.5 mr-1" />
            Fit Page
          </Button>

          <Button
            variant={zoomMode === "fit-width" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs px-2"
            onClick={() => setZoomMode("fit-width")}
            title="Fit Width"
          >
            <AlignJustify className="h-3.5 w-3.5 mr-1" />
            Fit Width
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setZoomMode("custom");
              setCustomZoom((z) => Math.max(0.5, z - 0.1));
            }}
            title="Zoom Out"
            disabled={zoomMode === "custom" && customZoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <input
            type="range"
            min={50}
            max={300}
            step={10}
            value={zoomPercent}
            onChange={(e) => {
              setZoomMode("custom");
              setCustomZoom(Number(e.target.value) / 100);
            }}
            className="w-24 h-1 accent-primary"
            title="Zoom level"
          />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setZoomMode("custom");
              setCustomZoom((z) => Math.min(3.0, z + 0.1));
            }}
            title="Zoom In"
            disabled={zoomMode === "custom" && customZoom >= 3.0}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <span className="text-sm text-muted-foreground font-mono w-12 text-right">
            {zoomPercent}%
          </span>
        </div>
      </div>

      {/* Body: thumbnails + main view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnail sidebar */}
        <div className="w-24 shrink-0 border-r bg-muted/30 overflow-hidden">
          <ThumbnailList
            pdfDoc={pdfDoc}
            pageCount={pageCount}
            currentPage={currentPage}
            onPageSelect={navigateTo}
          />
        </div>

        {/* Main page canvas area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex flex-col items-center gap-4 py-4 px-2 bg-muted/10"
        >
          {pagesInWindow.map((pageNum) => {
            const state = renderedPages.get(pageNum);
            const isCurrentVisible = pageNum === currentPage;

            return (
              <div
                key={pageNum}
                id={`pdf-page-${pageNum}`}
                className={`
                  relative shadow-md bg-white
                  ${isCurrentVisible ? "ring-2 ring-primary ring-offset-2" : ""}
                `}
                style={{ display: "inline-block" }}
              >
                {(!state || state.rendering) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(pageNum, el);
                    else canvasRefs.current.delete(pageNum);
                  }}
                />

                {state?.rendered && pdfDoc && (
                  <PageTextLayer
                    pdfDoc={pdfDoc}
                    pageNumber={pageNum}
                    scale={effectiveScale}
                  />
                )}

                {pageViewport && (
                  <AnnotationLayer
                    pageNumber={pageNum}
                    annotations={annotations}
                    onAnnotationClick={onAnnotationClick}
                    scale={1 / DPI_SCALE}
                    pageWidth={pageViewport.width}
                    pageHeight={pageViewport.height}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---- Lazy text layer per page ----

interface PageTextLayerProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

const PageTextLayer: React.FC<PageTextLayerProps> = ({ pdfDoc, pageNumber, scale }) => {
  const [page, setPage] = React.useState<PDFPageProxy | null>(null);
  const [viewport, setViewport] = React.useState<pdfjs.PageViewport | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    pdfDoc.getPage(pageNumber).then((p) => {
      if (cancelled) return;
      setPage(p);
      setViewport(p.getViewport({ scale }));
    });
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber, scale]);

  if (!page || !viewport) return null;
  return <TextLayer page={page} viewport={viewport} />;
};

export default PdfViewer;
