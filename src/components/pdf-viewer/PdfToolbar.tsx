import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlignJustify,
  Anchor as AnchorIcon,
  PanelRight,
  PanelRightOpen,
  ArrowLeft,
  Eye,
  EyeOff,
  CreditCard,
} from "lucide-react";

export type ZoomMode = "fit-page" | "fit-width" | "custom";

export interface PdfToolbarProps {
  currentPage: number;
  pageCount: number;
  zoomMode: ZoomMode;
  customZoom: number;
  displayZoom: number;
  selectionMode: boolean;
  showBacklinks: boolean;
  showThumbnails: boolean;
  showAnchors: boolean;
  hasPdfId: boolean;
  goToPageInput: string;
  onPageInputChange: (v: string) => void;
  onPageInputSubmit: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleSelection: () => void;
  onToggleBacklinks: () => void;
  onToggleThumbnails: () => void;
  onToggleAnchors: () => void;
  onBackToLibrary?: () => void;
  onCreateAnkiCard?: () => void;
  hasSelectedAnchor?: boolean;
}

export const PdfToolbar: React.FC<PdfToolbarProps> = ({
  currentPage,
  pageCount,
  displayZoom,
  selectionMode,
  showBacklinks,
  showThumbnails,
  showAnchors,
  hasPdfId,
  goToPageInput,
  onPageInputChange,
  onPageInputSubmit,
  onPrev,
  onNext,
  onFitPage,
  onFitWidth,
  onZoomIn,
  onZoomOut,
  onToggleSelection,
  onToggleBacklinks,
  onToggleThumbnails,
  onToggleAnchors,
  onBackToLibrary,
  onCreateAnkiCard,
  hasSelectedAnchor,
}) => {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0 flex-wrap">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBackToLibrary}
        title="Bibliothèque"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="border-l mx-1 h-6" />

      <Button variant="outline" size="sm" onClick={onPrev} disabled={currentPage <= 1}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1">
        <span className="text-xs font-mono">{currentPage}</span>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs font-mono">{pageCount}</span>
      </div>

      <input
        type="number"
        min="1"
        max={pageCount}
        value={goToPageInput}
        onChange={(e) => onPageInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onPageInputSubmit();
          }
        }}
        placeholder="Go to..."
        className="w-12 h-7 text-xs border rounded px-1 py-0.5"
      />

      <Button variant="outline" size="sm" onClick={onNext} disabled={currentPage >= pageCount}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div className="border-l mx-1 h-6" />

      <Button variant="outline" size="sm" onClick={onFitPage} title="Fit page">
        <Maximize2 className="h-4 w-4" />
      </Button>

      <Button variant="outline" size="sm" onClick={onFitWidth} title="Fit width">
        <AlignJustify className="h-4 w-4" />
      </Button>

      <Button variant="outline" size="sm" onClick={onZoomOut} title="Zoom out">
        <ZoomOut className="h-4 w-4" />
      </Button>

      <span className="text-xs font-mono w-8 text-center">{Math.round(displayZoom * 100)}%</span>

      <Button variant="outline" size="sm" onClick={onZoomIn} title="Zoom in">
        <ZoomIn className="h-4 w-4" />
      </Button>

      <div className="border-l mx-1 h-6" />

      <Button
        variant="outline"
        size="sm"
        onClick={onToggleThumbnails}
        className={showThumbnails ? "bg-primary text-primary-foreground" : ""}
        title="Toggle thumbnails"
      >
        <PanelRightOpen className="h-4 w-4" />
      </Button>

      <div className="border-l mx-1 h-6" />

      {hasPdfId && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSelection}
            className={selectionMode ? "bg-primary text-primary-foreground" : ""}
            title="Mark anchor"
          >
            <AnchorIcon className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAnchors}
            className={showAnchors ? "bg-primary text-primary-foreground" : ""}
            title="Show anchor highlights"
          >
            {showAnchors ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onToggleBacklinks}
            className={showBacklinks ? "bg-primary text-primary-foreground" : ""}
            title="Show backlinks"
          >
            <PanelRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onCreateAnkiCard}
            title={hasSelectedAnchor ? "Créer une carte depuis cet ancrage" : "Créer une carte Anki"}
          >
            <CreditCard className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
};
