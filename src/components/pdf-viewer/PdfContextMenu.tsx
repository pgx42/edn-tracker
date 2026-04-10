import * as React from "react";
import { MessageSquarePlus } from "lucide-react";

interface PdfContextMenuProps {
  x: number;
  y: number;
  onAddComment: () => void;
  onClose: () => void;
}

/**
 * Context menu shown on right-click over a PDF page.
 * Positioned absolutely at (x, y) within the PDF scroll container.
 */
export const PdfContextMenu: React.FC<PdfContextMenuProps> = ({
  x,
  y,
  onAddComment,
  onClose,
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 9000,
        pointerEvents: "auto",
      }}
      className="bg-popover border border-border rounded-md shadow-lg py-1 min-w-[180px] text-sm"
    >
      <button
        onClick={() => {
          onAddComment();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors text-left"
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>Ajouter un commentaire</span>
      </button>
    </div>
  );
};

export default PdfContextMenu;
