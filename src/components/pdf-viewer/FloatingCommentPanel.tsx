import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { X, Loader2, MessageCircle, Trash2, Hash } from "lucide-react";
import type { Anchor } from "./AnchorCreationModal";
import { useHashtagSuggestions } from "@/hooks/useHashtagSuggestions";

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
  const [cursorPos, setCursorPos] = React.useState(0);
  const [isPosting, setIsPosting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [panelPos, setPanelPos] = React.useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Data for hashtag suggestions
  const [specialties, setSpecialties] = React.useState<Array<{ id: string; name: string }>>([]);
  const [items, setItems] = React.useState<Array<{ id: number; code: string; title: string }>>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = React.useState(0);

  const { hashtagQuery, suggestions, insertSuggestion } = useHashtagSuggestions(
    newComment,
    cursorPos,
    { specialties, items }
  );

  // Load specialties and items for hashtag suggestions (once on mount)
  React.useEffect(() => {
    invoke<Array<{ id: string; name: string }>>("get_specialties")
      .then(setSpecialties)
      .catch(() => {});
    invoke<Array<any>>("get_items", {})
      .then((data) =>
        setItems(data.map((i: any) => ({ id: i.id, code: i.code, title: i.title })))
      )
      .catch(() => {});
  }, []);

  // Reset suggestion selection when query changes
  React.useEffect(() => {
    setSelectedSuggestionIdx(0);
  }, [hashtagQuery]);

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
    if (anchor) loadComments();
  }, [anchor?.id]);

  // Handle drag
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    if (panelPos && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  React.useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPanelPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    };
    const handleMouseUp = () => setIsDragging(false);
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
      const result = await invoke<AnchorComment[]>("get_anchor_comments", { anchorId: anchor.id });
      setComments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      setCursorPos(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

  const applySuggestion = (idx: number) => {
    const suggestion = suggestions[idx];
    if (!suggestion) return;
    const { newValue, newCursorPos } = insertSuggestion(newComment, cursorPos, suggestion);
    setNewComment(newValue);
    setCursorPos(newCursorPos);
    // Restore focus and cursor
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && suggestions.length > 0 && hashtagQuery !== null)) {
        e.preventDefault();
        applySuggestion(selectedSuggestionIdx);
        return;
      }
      if (e.key === "Escape") {
        setNewComment((v) => v); // close suggestions by losing query
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", {
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
        className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2 shrink-0 cursor-move select-none hover:bg-muted/70 transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <MessageCircle className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">
            {anchor.label || "Commentaire"}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
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
          <div className="space-y-1 p-2">
            {comments.map((comment) => (
              <div key={comment.id} className="text-xs bg-muted/30 rounded px-2 py-1.5 group">
                <div className="flex items-start justify-between gap-1">
                  <p className="flex-1 text-foreground break-words whitespace-pre-wrap leading-snug">
                    {comment.content}
                  </p>
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3 w-3 text-destructive hover:text-destructive/80" />
                  </button>
                </div>
                <p className="text-muted-foreground text-[10px] mt-0.5">
                  {formatDate(comment.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add comment form */}
      <div className="border-t bg-muted/50 p-2 shrink-0">
        {/* Hashtag suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="mb-1.5 bg-popover border border-border rounded shadow-md overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySuggestion(i);
                }}
                className={`w-full text-left px-2 py-1 text-xs flex items-center gap-1.5 hover:bg-accent hover:text-accent-foreground ${
                  i === selectedSuggestionIdx ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <Hash className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.label}</span>
                {s.type === "specialty" && (
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">Matière</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
              setCursorPos(e.target.selectionStart ?? e.target.value.length);
            }}
            onSelect={(e) => {
              const t = e.target as HTMLInputElement;
              setCursorPos(t.selectionStart ?? t.value.length);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message... (# pour tags)"
            className="flex-1 h-7 text-xs px-2 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            onClick={handleAddComment}
            disabled={isPosting || !newComment.trim()}
            size="sm"
            className="h-7 px-2 shrink-0"
          >
            {isPosting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Go"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FloatingCommentPanel;
