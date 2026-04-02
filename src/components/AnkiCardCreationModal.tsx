import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AnkiDeck, AnkiNoteRecord, AnkiCardCreationContext } from "@/lib/types";
import { useAnkiStore } from "@/stores/anki";

interface AnkiCardCreationModalProps {
  open: boolean;
  onClose: () => void;
  onCardCreated?: (card: AnkiNoteRecord) => void;
  decks?: AnkiDeck[];
  context?: AnkiCardCreationContext;
  onDeckCreated?: (deck: AnkiDeck) => void;
}

export function AnkiCardCreationModal({
  open,
  onClose,
  onCardCreated,
  decks: propDecks = [],
  context,
  onDeckCreated,
}: AnkiCardCreationModalProps) {
  const { addCard } = useAnkiStore();

  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [extra, setExtra] = React.useState("");
  const [deckId, setDeckId] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [decks, setDecks] = React.useState<AnkiDeck[]>(propDecks);
  const [isLoadingDecks, setIsLoadingDecks] = React.useState(false);

  // Inline deck creation
  const [showNewDeck, setShowNewDeck] = React.useState(false);
  const [newDeckName, setNewDeckName] = React.useState("");
  const [isCreatingDeck, setIsCreatingDeck] = React.useState(false);

  // Sync propDecks changes
  React.useEffect(() => {
    setDecks(propDecks);
  }, [propDecks]);

  // Auto-load decks if none provided
  React.useEffect(() => {
    if (open && propDecks.length === 0) {
      setIsLoadingDecks(true);
      invoke<AnkiDeck[]>("list_anki_decks")
        .then((d) => setDecks(d))
        .catch(() => {})
        .finally(() => setIsLoadingDecks(false));
    }
  }, [open, propDecks.length]);

  // Pre-fill from context
  React.useEffect(() => {
    if (open) {
      setQuestion(context?.prefillQuestion ?? "");
      setAnswer(context?.prefillAnswer ?? "");
      setExtra("");
      setTags("");
      setError(null);
      setShowNewDeck(false);
      setNewDeckName("");
    }
  }, [open, context]);

  // Auto-select first deck if none selected
  React.useEffect(() => {
    if (decks.length > 0 && !deckId) {
      setDeckId(decks[0].id);
    }
  }, [decks, deckId]);

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) return;
    setIsCreatingDeck(true);
    try {
      const deck = await invoke<AnkiDeck>("create_anki_deck", { name: newDeckName.trim() });
      setDecks((prev) => [...prev, deck]);
      setDeckId(deck.id);
      onDeckCreated?.(deck);
      setShowNewDeck(false);
      setNewDeckName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreatingDeck(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim() || !deckId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const card = await invoke<AnkiNoteRecord>("create_anki_card", {
        deck_id: deckId,
        question: question.trim(),
        answer: answer.trim(),
        extra_field: extra.trim() || null,
        tags: tags.trim() || null,
        source_anchor_id: context?.sourceAnchorId ?? null,
        source_pdf_ref: context?.sourcePdfTitle ?? null,
      });
      addCard(card);
      onCardCreated?.(card);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle carte Anki</DialogTitle>
        </DialogHeader>

        {context?.sourceLabel && (
          <div className="mt-1">
            <Badge variant="secondary" className="text-xs">
              Source : {context.sourceLabel}
            </Badge>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="anki-question">Question *</Label>
            <Textarea
              id="anki-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Question de la carte..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="anki-answer">Réponse *</Label>
            <Textarea
              id="anki-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Réponse de la carte..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="anki-extra">Champ supplémentaire</Label>
            <Textarea
              id="anki-extra"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Informations complémentaires (optionnel)..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Paquet *</Label>
            {showNewDeck ? (
              <div className="flex gap-2">
                <Input
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="Nom du nouveau paquet..."
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleCreateDeck(); }
                    if (e.key === "Escape") { setShowNewDeck(false); setNewDeckName(""); }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateDeck}
                  disabled={!newDeckName.trim() || isCreatingDeck}
                >
                  {isCreatingDeck ? "..." : "Créer"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowNewDeck(false); setNewDeckName(""); }}
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={deckId} onValueChange={setDeckId} disabled={isLoadingDecks}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={isLoadingDecks ? "Chargement..." : "Choisir un paquet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {decks.map((deck) => (
                      <SelectItem key={deck.id} value={deck.id}>
                        {deck.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setShowNewDeck(true)}
                  title="Nouveau paquet"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="anki-tags">Tags</Label>
            <Input
              id="anki-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1 tag2 tag3 (séparés par des espaces)"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!question.trim() || !answer.trim() || !deckId || isSubmitting}
            >
              {isSubmitting ? "Création..." : "Créer la carte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
