import React, { useEffect } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { TextLayer as PdfTextLayerRenderer } from 'pdfjs-dist';
import type { PdfChar, PdfViewport } from '@/lib/pdf-coords';

export interface UnifiedTextLayerProps {
  mode: 'native' | 'ocr';
  pdfPage?: PDFPageProxy;
  pageNum?: number;
  ocrLines?: Array<{ text: string; confidence: number; bbox: [number, number, number, number] }>;
  viewport: PdfViewport;
  cssScale: number;
  isVisible: boolean;
  onCharsReady?: (chars: PdfChar[]) => void;
}

const UnifiedTextLayer: React.FC<UnifiedTextLayerProps> = ({
  mode,
  pdfPage,
  pageNum,
  ocrLines,
  viewport,
  cssScale,
  isVisible,
  onCharsReady,
}) => {
  const nativeDivRef = React.useRef<HTMLDivElement>(null);
  const ocrDivRef = React.useRef<HTMLDivElement>(null);

  // ============ MODE NATIF — déléguer à PdfTextLayerRenderer =============
  useEffect(() => {
    if (mode !== 'native' || !pdfPage || !isVisible) return;

    const div = nativeDivRef.current;
    if (!div) return;

    let cancelled = false;
    let textLayerInstance: InstanceType<typeof PdfTextLayerRenderer> | null = null;

    (async () => {
      try {
        const textContent = await pdfPage.getTextContent();
        if (cancelled) return;

        // Créer le viewport pdfjs avec le CSS scale (sans DPI)
        const pdfjsViewport = pdfPage.getViewport({ scale: cssScale });

        // Nettoyer le container
        while (div.firstChild) {
          div.removeChild(div.firstChild);
        }

        // Instancier et rendre le TextLayer natif de pdfjs
        // C'est le code correct de pdfjs qui gère :
        // - fontAscent (top position correction)
        // - scaleX (mesure canvas pour aligner largeur)
        // - positions en % (indépendantes du scale)
        // - white-space: pre
        // - transform matrix complet
        textLayerInstance = new PdfTextLayerRenderer({
          textContentSource: textContent,
          container: div,
          viewport: pdfjsViewport,
        });

        await textLayerInstance.render();

        // Callback optionnel — on peut extraire les chars si nécessaire
        // Pour maintenant, juste notifier que c'est prêt
        onCharsReady?.([]);
      } catch (err) {
        console.error(`[UnifiedTextLayer] Native mode error:`, err);
      }
    })();

    return () => {
      cancelled = true;
      textLayerInstance?.cancel();
      if (div) {
        while (div.firstChild) {
          div.removeChild(div.firstChild);
        }
      }
    };
  }, [pdfPage, pageNum, cssScale, isVisible]);

  // ============ MODE OCR — spans transparents en pourcentages =============
  useEffect(() => {
    if (mode !== 'ocr' || !ocrLines || ocrLines.length === 0 || !isVisible) return;

    const div = ocrDivRef.current;
    if (!div) return;

    // Nettoyer le container
    while (div.firstChild) {
      div.removeChild(div.firstChild);
    }

    // Créer les spans
    let globalCharIndex = 0;
    const fragment = document.createDocumentFragment();

    for (let lineIdx = 0; lineIdx < ocrLines.length; lineIdx++) {
      const line = ocrLines[lineIdx];
      const [normX, normY, normW, normH] = line.bbox; // [x, y, w, h] normalisé 0-1

      for (let charIdx = 0; charIdx < line.text.length; charIdx++) {
        const c = line.text[charIdx];
        const charFrac = 1 / line.text.length;

        // Positions en pourcentages (indépendantes du scale)
        const left = (normX + charIdx * charFrac * normW) * 100;
        const top = normY * 100;
        const width = (charFrac * normW) * 100;
        const height = normH * 100;

        // Font size en CSS pixels
        const fontSize = normH * viewport.height * 0.9;

        const span = document.createElement('span');
        span.className = 'ocr-char';
        span.textContent = c;
        span.setAttribute('data-char-index', String(globalCharIndex++));
        span.setAttribute('tabindex', '-1');
        span.style.cssText = `
          position: absolute;
          left: ${left.toFixed(2)}%;
          top: ${top.toFixed(2)}%;
          width: ${width.toFixed(2)}%;
          height: ${height.toFixed(2)}%;
          font-size: ${fontSize.toFixed(1)}px;
          color: transparent;
          white-space: pre;
          cursor: text;
          transform-origin: 0% 0%;
          user-select: text;
          -webkit-user-select: text;
        `;
        fragment.appendChild(span);
      }
    }

    div.appendChild(fragment);
    onCharsReady?.([]);
  }, [ocrLines, viewport.height, isVisible, pageNum]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!isVisible) return null;

  return (
    <>
      {mode === 'native' && (
        <div
          ref={nativeDivRef}
          className="textLayer"
          onMouseDown={handleMouseDown}
          tabIndex={-1}
        />
      )}
      {mode === 'ocr' && (
        <div
          ref={ocrDivRef}
          className="unified-text-layer"
          onMouseDown={handleMouseDown}
          tabIndex={-1}
        />
      )}
    </>
  );
};

export default React.memo(UnifiedTextLayer);
