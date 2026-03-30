import * as React from "react";
import type { Anchor } from "./AnchorCreationModal";

interface AnchorHighlightProps {
  anchors: Anchor[];
  pageNumber: number;
  /** CSS pixel dimensions of the rendered page */
  pageWidth: number;
  pageHeight: number;
  onAnchorClick?: (anchor: Anchor) => void;
}

/**
 * Renders semi-transparent highlight overlays for anchors on a page.
 * Coordinates stored as normalized (0-1); multiplied by page dimensions for display.
 */
export const AnchorHighlight: React.FC<AnchorHighlightProps> = ({
  anchors,
  pageNumber,
  pageWidth,
  pageHeight,
  onAnchorClick,
}) => {
  const pageAnchors = anchors.filter((a) => a.page_number === pageNumber);
  if (pageAnchors.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: pageWidth,
        height: pageHeight,
        pointerEvents: "none",
        zIndex: 15,
      }}
    >
      {pageAnchors.map((anchor) => (
        <div
          key={anchor.id}
          title={anchor.label}
          onClick={() => onAnchorClick?.(anchor)}
          style={{
            position: "absolute",
            left: (anchor.x ?? 0) * pageWidth,
            top: (anchor.y ?? 0) * pageHeight,
            width: (anchor.w ?? 0) * pageWidth,
            height: (anchor.h ?? 0) * pageHeight,
            backgroundColor: "rgba(59, 130, 246, 0.18)",
            border: "1.5px solid rgba(59, 130, 246, 0.55)",
            borderRadius: 2,
            cursor: onAnchorClick ? "pointer" : "default",
            pointerEvents: onAnchorClick ? "auto" : "none",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.backgroundColor =
              "rgba(59, 130, 246, 0.32)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.backgroundColor =
              "rgba(59, 130, 246, 0.18)";
          }}
        >
          {/* Label chip at top-left of zone */}
          <span
            style={{
              position: "absolute",
              top: -1,
              left: 0,
              fontSize: 9,
              lineHeight: "14px",
              padding: "0 4px",
              backgroundColor: "rgba(59, 130, 246, 0.85)",
              color: "#fff",
              borderRadius: "2px 2px 2px 0",
              whiteSpace: "nowrap",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {anchor.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default AnchorHighlight;
