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

const EMPTY_DECKS: AnkiDeck[] = [];

const NOTE_TYPES = [
  { id: "Basic", label: "Basique (Recto/Verso)" },
  { id: "Basic (and reversed card)", label: "Basique + inversé" },
  { id: "Cloze", label: "Texte à trous" },
];

/**
 * Lightweight sanitizer for user-supplied HTML preview.
 * Strips <script>, <style>, <iframe> tags and inline event handlers.
 * Content comes exclusively from the user's own local input — this is a
 * defense-in-depth measure, not a trust boundary.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, "");
}

export function AnkiCardCreationModal({
  open,
  onClose,
  onCardCreated,
  decks: propDecks = EMPTY_DECKS,
  context,
  onDeckCreated,
}: AnkiCardCreationModalProps) {
  const { addCard, cards } = useAnkiStore();

  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [extra, setExtra] = React.useState("");
  const [deckId, setDeckId] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [noteType, setNoteType] = React.useState("Basic");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewMode, setPreviewMode] = React.useState(false);

  const [decks, setDecks] = React.useState<AnkiDeck[]>(propDecks);
  const [isLoadingDecks, setIsLoadingDecks] = React.useState(false);

  // Inline deck creation
  const [showNewDeck, setShowNewDeck] = React.useState(false);
  const [newDeckName, setNewDeckName] = React.useState("");
  const [isCreatingDeck, setIsCreatingDeck] = React.useState(false);

  const formRef = React.useRef<HTMLFormElement>(null);

  // Derived state
  const isCloze = noteType === "Cloze";
  const questionLabel = isCloze ? "Texte" : "Question";

  // Collect existing tags from store
  const existingTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    for (const card of cards) {
      (card.tags ?? "").split(/\s+/).filter(Boolean).forEach((t) => {
        if (t !== "edn-tracker") tagSet.add(t);
      });
    }
    return Array.from(tagSet).sort();
  }, [cards]);

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
      setNoteType("Basic");
      setPreviewMode(false);
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

  // Keyboard shortcuts: Cmd/Ctrl+Enter to submit
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

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

  const handleClozeWrap = () => {
    const textarea = document.getElementById("anki-question") as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = question.substring(start, end);
    const clozeNum = (question.match(/\{\{c(\d+)::/g) ?? []).length + 1;
    const prefix = `{{c${clozeNum}::`;
    const newText =
      question.substring(0, start) +
      prefix +
      selected +
      "}}" +
      question.substring(end);
    setQuestion(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      const newCursor = start + prefix.length + selected.length + 2;
      textarea.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleAddTag = (tag: string) => {
    const current = tags.split(/\s+/).filter(Boolean);
    if (!current.includes(tag)) {
      setTags(current.concat(tag).join(" "));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || (!isCloze && !answer.trim()) || !deckId) return;
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
        note_type: noteType,
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

  const isSubmitDisabled =
    !question.trim() ||
    (!isCloze && !answer.trim()) ||
    !deckId ||
    isSubmitting;

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

        {/* Edition / Preview toggle */}
        <div className="flex gap-1 mt-2 border-b border-border pb-2">
          <button
            type="button"
            onClick={() => setPreviewMode(false)}
            className={`text-xs px-3 py-1 rounded transition-colors ${
              !previewMode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Édition
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode(true)}
            className={`text-xs px-3 py-1 rounded transition-colors ${
              previewMode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Aperçu
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Question / Texte field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="anki-question">{questionLabel} *</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`h-6 text-xs font-mono ${isCloze ? "text-primary border border-primary/40" : ""}`}
                onClick={handleClozeWrap}
                title="Entourer la sélection avec la syntaxe cloze"
              >
                {"{{"}<span>c1::</span>{"}}"}
              </Button>
            </div>
            {previewMode ? (
              <div
                className="border rounded-md p-3 min-h-[80px] text-sm prose prose-invert max-w-none"
                // Content is user-supplied local data (SQLite). Sanitized above.
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(question) }}
              />
            ) : (
              <Textarea
                id="anki-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  isCloze
                    ? "Texte avec {{c1::mots à cacher}}..."
                    : "Question de la carte..."
                }
                rows={3}
                required
              />
            )}
          </div>

          {/* Answer field — hidden for Cloze */}
          {!isCloze && (
            <div className="space-y-1.5">
              <Label htmlFor="anki-answer">Réponse *</Label>
              {previewMode ? (
                <div
                  className="border rounded-md p-3 min-h-[80px] text-sm prose prose-invert max-w-none"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(answer) }}
                />
              ) : (
                <Textarea
                  id="anki-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Réponse de la carte..."
                  rows={3}
                  required
                />
              )}
            </div>
          )}

          {/* Extra field */}
          <div className="space-y-1.5">
            <Label htmlFor="anki-extra">Champ supplémentaire</Label>
            {previewMode ? (
              <div
                className="border rounded-md p-3 min-h-[48px] text-sm prose prose-invert max-w-none text-muted-foreground"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(extra) || "<em>Vide</em>" }}
              />
            ) : (
              <Textarea
                id="anki-extra"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="Informations complémentaires (optionnel)..."
                rows={2}
              />
            )}
          </div>

          {/* Deck selector */}
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

          {/* Note type selector */}
          <div className="space-y-1.5">
            <Label>Type de carte</Label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map((nt) => (
                  <SelectItem key={nt.id} value={nt.id}>
                    {nt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="anki-tags">Tags</Label>
            <Input
              id="anki-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1 tag2 tag3 (séparés par des espaces)"
            />
            {existingTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {existingTags.slice(0, 15).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="text-[11px] px-1.5 py-0.5 rounded border border-muted text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                    onClick={() => handleAddTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <DialogFooter>
            <p className="text-xs text-muted-foreground mr-auto self-center hidden sm:block">
              ⌘↵ pour soumettre
            </p>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {isSubmitting ? "Création..." : "Créer la carte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
