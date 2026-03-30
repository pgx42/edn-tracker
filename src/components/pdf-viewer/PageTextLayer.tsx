import * as React from "react";
import * as pdfjs from "pdfjs-dist";
import { TextLayer as PdfTextLayerRenderer } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

interface TextLayerProps {
  page: PDFPageProxy;
  viewport: pdfjs.PageViewport;
}

const DPI_SCALE = 150 / 96;

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

      while (div.firstChild) {
        div.removeChild(div.firstChild);
      }

      // Create a text-specific viewport scaled to CSS (visual) size, not canvas size
      // The canvas viewport includes DPI_SCALE, making it too large relative to the page div
      // We need to render text at the visual/CSS scale
      const textViewport = page.getViewport({ scale: viewport.scale / DPI_SCALE });

      textLayerInstance = new PdfTextLayerRenderer({
        textContentSource: textContent,
        container: div,
        viewport: textViewport,
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
        width: viewport.width / DPI_SCALE,
        height: viewport.height / DPI_SCALE,
        lineHeight: 1,
        overflow: "hidden",
        opacity: 1,
        userSelect: "text",
        transformOrigin: "0 0",
      }}
    />
  );
};

interface PageTextLayerWrapperProps {
  pdfDoc: PDFDocumentProxy;
  pageNum: number;
  scale: number;
}

export const PageTextLayerWrapper: React.FC<PageTextLayerWrapperProps> = ({
  pdfDoc,
  pageNum,
  scale,
}) => {
  const [page, setPage] = React.useState<PDFPageProxy | null>(null);
  const [viewport, setViewport] = React.useState<pdfjs.PageViewport | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const p = await pdfDoc.getPage(pageNum);
      if (cancelled) {
        p.cleanup();
        return;
      }
      const vp = p.getViewport({ scale });
      setPage(p);
      setViewport(vp);
    };

    load();
    return () => {
      cancelled = true;
      page?.cleanup();
    };
  }, [pdfDoc, pageNum, scale]);

  if (!page || !viewport) return null;
  return <TextLayer page={page} viewport={viewport} />;
};
