import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2 } from "lucide-react";
import type { AnkiNoteRecord } from "@/lib/types";

interface Props {
  open: boolean;
  card: AnkiNoteRecord | null;
  onClose: () => void;
  onUpdated: (card: AnkiNoteRecord) => void;
  onDeleted: (cardId: string) => void;
}

export function AnkiCardEditModal({ open, card, onClose, onUpdated, onDeleted }: Props) {
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [extra, setExtra] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);

  // Pre-fill fields when the card changes
  React.useEffect(() => {
    if (card) {
      setQuestion(card.question);
      setAnswer(card.answer);
      setExtra(card.extra_field ?? "");
      setTags(card.tags ?? "");
      setError(null);
      setDeleteConfirm(false);
    }
  }, [card]);

  // Reset delete confirm state when modal closes
  React.useEffect(() => {
    if (!open) {
      setDeleteConfirm(false);
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!card) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await invoke<AnkiNoteRecord>("anki_update_note", {
        noteId: card.id,
        question,
        answer,
        extraField: extra.trim() || null,
        tags: tags.trim() || null,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    handleDeleteConfirmed();
  };

  const handleDeleteConfirmed = async () => {
    if (!card) return;
    setIsDeleting(true);
    setError(null);
    try {
      await invoke<void>("anki_delete_note", { noteId: card.id });
      onDeleted(card.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la carte</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-question">Question (Recto)</Label>
            <Textarea
              id="edit-question"
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Question..."
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-answer">Réponse (Verso)</Label>
            <Textarea
              id="edit-answer"
              rows={4}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Réponse..."
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-extra">Complément</Label>
            <Textarea
              id="edit-extra"
              rows={2}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Informations supplémentaires..."
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-tags">Tags (séparés par des espaces)</Label>
            <Input
              id="edit-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1 tag2 tag3"
              className="text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-md px-3 py-2">{error}</p>
          )}
        </div>

        <DialogFooter className="flex items-center gap-2 sm:justify-between">
          {/* Delete button — left side */}
          <div className="flex items-center gap-2 mr-auto">
            <Button
              variant="outline"
              size="sm"
              className={
                deleteConfirm
                  ? "text-red-400 border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
                  : "text-red-400 hover:text-red-300"
              }
              onClick={handleDeleteClick}
              disabled={isDeleting || isSaving}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              {deleteConfirm ? "Cliquez pour confirmer" : "Supprimer"}
            </Button>
            {deleteConfirm && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Annuler
              </Button>
            )}
          </div>

          {/* Save / Cancel — right side */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving || isDeleting}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || isDeleting || !question.trim() || !answer.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
