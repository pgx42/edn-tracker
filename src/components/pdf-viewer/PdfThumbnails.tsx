import * as React from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Loader2 } from "lucide-react";

interface ThumbnailProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  isCurrent: boolean;
  onClick: () => void;
}

export const Thumbnail: React.FC<ThumbnailProps> = ({ pdfDoc, pageNumber, isCurrent, onClick }) => {
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
        // cancelled or error
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
      className={`flex flex-col items-center gap-1 p-1.5 rounded cursor-pointer transition-all hover:bg-accent border-2 ${
        isCurrent ? "border-primary bg-accent/50" : "border-transparent"
      }`}
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

export interface ThumbnailListProps {
  pdfDoc: PDFDocumentProxy;
  pageCount: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
}

export const ThumbnailList: React.FC<ThumbnailListProps> = ({
  pdfDoc,
  pageCount,
  currentPage,
  onPageSelect,
}) => {
  const [visibleEnd, setVisibleEnd] = React.useState(Math.min(20, pageCount));
  const containerRef = React.useRef<HTMLDivElement>(null);
  const currentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = currentRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const containerScrollTop = container.scrollTop;
    const containerBottom = containerScrollTop + container.clientHeight;

    if (elTop < containerScrollTop) {
      container.scrollTop = elTop;
    } else if (elBottom > containerBottom) {
      container.scrollTop = elBottom - container.clientHeight;
    }
  }, [currentPage]);

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
    <div ref={containerRef} onScroll={handleScroll} className="flex flex-col items-center gap-1 overflow-y-auto h-full p-2">
      {pages.map((n) => (
        <div key={n} ref={n === currentPage ? currentRef : undefined}>
          <Thumbnail pdfDoc={pdfDoc} pageNumber={n} isCurrent={n === currentPage} onClick={() => onPageSelect(n)} />
        </div>
      ))}
      {visibleEnd < pageCount && (
        <div className="py-4 text-xs text-muted-foreground">Scroll for more...</div>
      )}
    </div>
  );
};
