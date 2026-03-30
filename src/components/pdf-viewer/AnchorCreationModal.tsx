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
import { Loader2 } from "lucide-react";
import type { SelectionRect } from "./AnchorSelectionLayer";

export interface Anchor {
  id: string;
  pdf_document_id: string;
  page_number: number;
  label: string;
  text_snippet: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  created_at: string;
}

interface AnchorCreationModalProps {
  open: boolean;
  pdfId: string;
  page: number;
  selection: SelectionRect | null;
  onClose: () => void;
  onAnchorCreated: (anchorId: string) => void;
}

export const AnchorCreationModal: React.FC<AnchorCreationModalProps> = ({
  open,
  pdfId,
  page,
  selection,
  onClose,
  onAnchorCreated,
}) => {
  const [label, setLabel] = React.useState("");
  const [textSnippet, setTextSnippet] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setLabel("");
      setTextSnippet("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selection || !label.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const trimmedSnippet = textSnippet.trim();
      const params: Record<string, any> = {
        pdf_id: pdfId,
        page: page,
        x: selection.x,
        y: selection.y,
        w: selection.width,
        h: selection.height,
        label: label.trim(),
      };
      if (trimmedSnippet) {
        params.text_snippet = trimmedSnippet;
      }
      const anchorId = await invoke<string>("create_anchor", params);
      onAnchorCreated(anchorId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un ancrage</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="anchor-label">Label *</Label>
            <Input
              id="anchor-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex: Définition, Figure 3, Formule..."
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="anchor-snippet">Extrait de texte</Label>
            <Textarea
              id="anchor-snippet"
              value={textSnippet}
              onChange={(e) => setTextSnippet(e.target.value)}
              placeholder="Texte extrait ou note contextuelle (optionnel)"
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          {selection && (
            <p className="text-xs text-muted-foreground">
              Zone: x={Math.round(selection.x * 100)}% y={Math.round(selection.y * 100)}%
              {" "}({Math.round(selection.width * 100)}% × {Math.round(selection.height * 100)}%)
              &mdash; page {page}
            </p>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting || !label.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer l'ancrage
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AnchorCreationModal;
