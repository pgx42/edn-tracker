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
    if (!div) {
      console.log(`[TextLayer] divRef is null!`);
      return;
    }

    console.log(`[TextLayer] mounted, div element:`, div, "div.offsetWidth:", div.offsetWidth);

    let cancelled = false;
    let textLayerInstance: InstanceType<typeof PdfTextLayerRenderer> | null = null;

    const render = async () => {
      const textContent = await page.getTextContent();
      console.log(`[TextLayer] Got ${textContent.items.length} text items, viewport:`, {
        width: viewport.width,
        height: viewport.height,
        scale: viewport.scale,
      });

      if (cancelled || !div) return;

      while (div.firstChild) {
        div.removeChild(div.firstChild);
      }

      console.log(`[TextLayer] Creating TextLayerRenderer instance...`);
      textLayerInstance = new PdfTextLayerRenderer({
        textContentSource: textContent,
        container: div,
        viewport,
      });
      console.log(`[TextLayer] Starting render()...`);
      try {
        await textLayerInstance.render();
        console.log(`[TextLayer] Render complete, div now has ${div.children.length} children`);
        if (div.children.length === 0) {
          console.warn(`[TextLayer] WARNING: No children rendered even though render() succeeded!`);
        }
      } catch (err) {
        console.error(`[TextLayer] Render error:`, err);
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
        width: "100%",
        height: "100%",
        lineHeight: 1,
        overflow: "visible",
        opacity: 1,
        userSelect: "text",
        WebkitUserSelect: "text",
        transformOrigin: "0 0",
        zIndex: 2,
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
      // Use CSS scale (logical pixels) to match canvas coordinate space
      // Canvas renders at scale/DPI_SCALE, so TextLayer spans position correctly
      const vp = p.getViewport({ scale: scale / DPI_SCALE });
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
