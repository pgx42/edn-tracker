import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Loader2, MessageCircle, Trash2 } from "lucide-react";
import type { Anchor } from "./AnchorCreationModal";

export interface AnchorComment {
  id: string;
  anchor_id: string;
  author: string;
  content: string;
  created_at?: string;
}

interface FloatingCommentPanelProps {
  anchor: Anchor | null;
  position?: { x: number; y: number };
  onClose: () => void;
}

export const FloatingCommentPanel: React.FC<FloatingCommentPanelProps> = ({
  anchor,
  position,
  onClose,
}) => {
  const [comments, setComments] = React.useState<AnchorComment[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [newComment, setNewComment] = React.useState("");
  const [isPosting, setIsPosting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [panelPos, setPanelPos] = React.useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Initialize position from prop
  React.useEffect(() => {
    if (position && !panelPos) {
      setPanelPos({
        x: position.x + 10,
        y: position.y - 40,
      });
    }
  }, [position, panelPos]);

  React.useEffect(() => {
    if (anchor) {
      loadComments();
    }
  }, [anchor?.id]);

  // Handle drag
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return; // Don't drag when clicking buttons

    setIsDragging(true);
    if (panelPos && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPanelPos({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const loadComments = async () => {
    if (!anchor) return;
    try {
      setIsLoading(true);
      setError(null);
      const result = await invoke<AnchorComment[]>("get_anchor_comments", {
        anchorId: anchor.id,
      });
      setComments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Failed to load comments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !anchor) return;

    try {
      setIsPosting(true);
      setError(null);
      const comment = await invoke<AnchorComment>("add_anchor_comment", {
        anchorId: anchor.id,
        author: "me",
        content: newComment.trim(),
      });
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Failed to add comment:", err);
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await invoke("delete_anchor_comment", { id: commentId });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("fr-FR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (!anchor || !panelPos) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        left: `${panelPos.x}px`,
        top: `${panelPos.y}px`,
        zIndex: 1000,
        pointerEvents: "auto",
        transform: "translateZ(0)",
      }}
      className="w-80 bg-white border border-border rounded-lg shadow-lg overflow-hidden"
    >
      {/* Header - draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2 shrink-0 cursor-move select-none hover:bg-muted/70 transition-colors">
        <div className="flex items-center gap-1.5 min-w-0">
          <MessageCircle className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">
            {anchor.label || "Ancrage"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Comments list */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        {!isLoading && error && (
          <p className="text-xs text-destructive px-3 py-2">{error}</p>
        )}

        {!isLoading && comments.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-3 py-3">
            Pas encore de messages.
          </p>
        )}

        {!isLoading && comments.length > 0 && (
          <div className="space-y-1.5 p-2">
            {comments.map((comment) => (
              <div key={comment.id} className="text-xs bg-muted/30 rounded p-2 group">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">
                      {comment.author}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {formatDate(comment.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3 w-3 text-destructive hover:text-destructive/80" />
                  </button>
                </div>
                <p className="mt-1 text-foreground break-words whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add comment form */}
      <div className="border-t bg-muted/50 p-2 shrink-0 space-y-1.5">
        <div className="flex gap-1.5">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
            placeholder="Message..."
            className="h-7 text-xs"
          />
          <Button
            onClick={handleAddComment}
            disabled={isPosting || !newComment.trim()}
            size="sm"
            className="h-7 px-2 shrink-0"
          >
            {isPosting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Go"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FloatingCommentPanel;
