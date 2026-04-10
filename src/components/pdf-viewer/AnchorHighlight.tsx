import * as React from "react";
import { MessageCircle } from "lucide-react";
import type { Anchor } from "./AnchorCreationModal";

interface AnchorHighlightProps {
  anchors: Anchor[];
  pageNumber: number;
  /** CSS pixel dimensions of the rendered page */
  pageWidth: number;
  pageHeight: number;
  onAnchorClick?: (anchor: Anchor) => void;
  onAnchorDoubleClick?: (anchor: Anchor, x: number, y: number) => void;
}

/** An anchor is a "pin" (point comment) when its rendered width/height is negligible. */
function isPin(anchor: Anchor, pageWidth: number): boolean {
  return (anchor.w ?? 0) * pageWidth < 8;
}

/**
 * Renders anchor overlays on a PDF page.
 * - Point anchors (w≈0, h≈0) → small comment pin icon
 * - Zone anchors (w>0, h>0)  → semi-transparent blue rectangle (legacy)
 */
export const AnchorHighlight: React.FC<AnchorHighlightProps> = ({
  anchors,
  pageNumber,
  pageWidth,
  pageHeight,
  onAnchorClick,
  onAnchorDoubleClick,
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
      {pageAnchors.map((anchor) => {
        const left = (anchor.x ?? 0) * pageWidth;
        const top = (anchor.y ?? 0) * pageHeight;
        const pin = isPin(anchor, pageWidth);

        if (pin) {
          // ── Pin icon ──────────────────────────────────────────────────────
          return (
            <button
              key={anchor.id}
              title={anchor.label || "Commentaire"}
              onClick={() => onAnchorClick?.(anchor)}
              onDoubleClick={() => onAnchorDoubleClick?.(anchor, left, top)}
              style={{
                position: "absolute",
                left: left - 9,
                top: top - 9,
                width: 22,
                height: 22,
                pointerEvents: "auto",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "rgba(59, 130, 246, 0.15)",
                border: "1.5px solid rgba(59, 130, 246, 0.6)",
                transition: "background 0.15s, transform 0.1s",
                zIndex: 16,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(59, 130, 246, 0.35)";
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(59, 130, 246, 0.15)";
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              <MessageCircle
                style={{ width: 12, height: 12, color: "rgba(59, 130, 246, 0.9)" }}
              />
            </button>
          );
        }

        // ── Zone rectangle (legacy) ───────────────────────────────────────
        return (
          <div
            key={anchor.id}
            title={anchor.label}
            onClick={() => onAnchorClick?.(anchor)}
            onDoubleClick={() => onAnchorDoubleClick?.(anchor, left, top)}
            style={{
              position: "absolute",
              left,
              top,
              width: (anchor.w ?? 0) * pageWidth,
              height: (anchor.h ?? 0) * pageHeight,
              backgroundColor: "rgba(59, 130, 246, 0.18)",
              border: "1.5px solid rgba(59, 130, 246, 0.55)",
              borderRadius: 2,
              cursor: onAnchorClick || onAnchorDoubleClick ? "pointer" : "default",
              pointerEvents: onAnchorClick || onAnchorDoubleClick ? "auto" : "none",
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
        );
      })}
    </div>
  );
};

export default AnchorHighlight;
