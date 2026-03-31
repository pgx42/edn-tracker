import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, MessageCircle, Loader2, Trash2 } from "lucide-react";

export interface AnchorComment {
  id: string;
  anchor_id: string;
  author: string;
  content: string;
  created_at?: string;
}

interface AnchorCommentThreadProps {
  anchorId: string;
}

export const AnchorCommentThread: React.FC<AnchorCommentThreadProps> = ({
  anchorId,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [comments, setComments] = React.useState<AnchorComment[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [newComment, setNewComment] = React.useState("");
  const [isPosting, setIsPosting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadComments = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await invoke<AnchorComment[]>("get_anchor_comments", {
        anchorId,
      });
      setComments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [anchorId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setIsPosting(true);
      setError(null);
      const comment = await invoke<AnchorComment>("add_anchor_comment", {
        anchorId,
        author: "me",
        content: newComment.trim(),
      });
      setComments((prev) => [...prev, comment]);
      setNewComment("");
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

  // Auto-refresh comments when expanded (poll every 2 seconds)
  React.useEffect(() => {
    if (!isExpanded) return;

    // Load immediately
    loadComments();

    // Set up polling
    const interval = setInterval(() => {
      loadComments();
    }, 2000);

    return () => clearInterval(interval);
  }, [isExpanded, loadComments]);

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

  return (
    <div className="mt-2 space-y-2 border-t pt-2">
      <button
        onClick={() => {
          if (!isExpanded) {
            loadComments();
          }
          setIsExpanded(!isExpanded);
        }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <MessageCircle className="h-3 w-3" />
        <span className="font-medium">Discussion ({comments.length})</span>
      </button>

      {isExpanded && (
        <div className="pl-4 space-y-2">
          {/* Comments list */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {!isLoading && comments.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Pas encore de messages. Soyez le premier!
            </p>
          )}

          <div className="space-y-1.5">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="text-xs bg-muted/30 rounded p-2 group"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">
                      {comment.author}
                    </p>
                    <p className="text-muted-foreground">
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
                <p className="mt-1 text-foreground break-words">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>

          {/* Add comment form */}
          <div className="space-y-1.5 pt-2 border-t">
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
                placeholder="Ajouter un message..."
                className="h-7 text-xs"
              />
              <Button
                onClick={handleAddComment}
                disabled={isPosting || !newComment.trim()}
                size="sm"
                className="h-7 px-2"
              >
                {isPosting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Envoyer"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnchorCommentThread;
