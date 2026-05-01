import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import DOMPurify from "dompurify";
import { Plus, X, Image as ImageIcon } from "lucide-react";
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
  { id: "Image Occlusion Enhanced", label: "Image Occlusion" },
];

// ─── Image Occlusion rect drawing ────────────────────────────────────────────

interface OcclusionRect {
  id: number;
  x: number; // 0-1 (relative to image dimensions)
  y: number;
  w: number;
  h: number;
}

const OCCLUSION_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

interface OcclusionCanvasProps {
  imageUrl: string;
  rects: OcclusionRect[];
  onRectsChange: (rects: OcclusionRect[]) => void;
}

function OcclusionCanvas({ imageUrl, rects, onRectsChange }: OcclusionCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = React.useState<{
    startX: number; startY: number; currentX: number; currentY: number;
  } | null>(null);
  const nextId = React.useRef(rects.length + 1);

  const getRelativePos = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const { x, y } = getRelativePos(e);
    setDrawing({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const { x, y } = getRelativePos(e);
    setDrawing((d) => d ? { ...d, currentX: x, currentY: y } : null);
  };

  const handleMouseUp = () => {
    if (!drawing) return;
    const x = Math.min(drawing.startX, drawing.currentX);
    const y = Math.min(drawing.startY, drawing.currentY);
    const w = Math.abs(drawing.currentX - drawing.startX);
    const h = Math.abs(drawing.currentY - drawing.startY);
    if (w > 0.01 && h > 0.01) {
      const id = nextId.current++;
      onRectsChange([...rects, { id, x, y, w, h }]);
    }
    setDrawing(null);
  };

  const removeRect = (id: number) => {
    onRectsChange(rects.filter((r) => r.id !== id));
  };

  return (
    <div
      ref={containerRef}
      className="relative select-none cursor-crosshair overflow-hidden rounded-md border"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setDrawing(null)}
    >
      <img src={imageUrl} alt="occlusion base" className="block w-full" draggable={false} />

      {rects.map((r, i) => {
        const color = OCCLUSION_COLORS[i % OCCLUSION_COLORS.length];
        return (
          <div
            key={r.id}
            style={{
              position: "absolute",
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
              background: `${color}99`,
              border: `2px solid ${color}`,
              borderRadius: "3px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              color: "#fff",
              pointerEvents: "all",
            }}
          >
            <span style={{ textShadow: "0 1px 2px #0008", userSelect: "none" }}>{i + 1}</span>
            <button
              type="button"
              onMouseDown={(e) => { e.stopPropagation(); removeRect(r.id); }}
              style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                width: "16px",
                height: "16px",
                background: "#1e293b",
                border: `1px solid ${color}`,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X style={{ width: "10px", height: "10px", color: "#fff" }} />
            </button>
          </div>
        );
      })}

      {drawing && (() => {
        const x = Math.min(drawing.startX, drawing.currentX);
        const y = Math.min(drawing.startY, drawing.currentY);
        const w = Math.abs(drawing.currentX - drawing.startX);
        const h = Math.abs(drawing.currentY - drawing.startY);
        const color = OCCLUSION_COLORS[rects.length % OCCLUSION_COLORS.length];
        return (
          <div
            style={{
              position: "absolute",
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${w * 100}%`,
              height: `${h * 100}%`,
              background: `${color}66`,
              border: `2px dashed ${color}`,
              borderRadius: "3px",
              pointerEvents: "none",
            }}
          />
        );
      })()}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  const [showNewDeck, setShowNewDeck] = React.useState(false);
  const [newDeckName, setNewDeckName] = React.useState("");
  const [isCreatingDeck, setIsCreatingDeck] = React.useState(false);

  // Image Occlusion state
  const [occlusionImageUrl, setOcclusionImageUrl] = React.useState<string | null>(null);
  const [occlusionImageBase64, setOcclusionImageBase64] = React.useState<string | null>(null);
  const [occlusionImageFilename, setOcclusionImageFilename] = React.useState<string | null>(null);
  const [occlusionRects, setOcclusionRects] = React.useState<OcclusionRect[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const formRef = React.useRef<HTMLFormElement>(null);

  const isCloze = noteType === "Cloze";
  const isImageOcclusion = noteType === "Image Occlusion Enhanced";
  const questionLabel = isCloze ? "Texte" : "Question";

  const existingTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    for (const card of cards) {
      (card.tags ?? "").split(/\s+/).filter(Boolean).forEach((t) => {
        if (t !== "edn-tracker") tagSet.add(t);
      });
    }
    return Array.from(tagSet).sort();
  }, [cards]);

  React.useEffect(() => { setDecks(propDecks); }, [propDecks]);

  React.useEffect(() => {
    if (open && propDecks.length === 0) {
      setIsLoadingDecks(true);
      invoke<AnkiDeck[]>("list_anki_decks")
        .then((d) => setDecks(d))
        .catch(() => {})
        .finally(() => setIsLoadingDecks(false));
    }
  }, [open, propDecks.length]);

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
      setOcclusionImageUrl(null);
      setOcclusionImageBase64(null);
      setOcclusionImageFilename(null);
      setOcclusionRects([]);
    }
  }, [open, context]);

  React.useEffect(() => {
    if (decks.length > 0 && !deckId) {
      setDeckId(decks[0].id);
    }
  }, [decks, deckId]);

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
      question.substring(0, start) + prefix + selected + "}}" + question.substring(end);
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

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const base64 = result.split(",")[1];
      setOcclusionImageBase64(base64);
      setOcclusionImageFilename(file.name);
      setOcclusionRects([]);
      setOcclusionImageUrl(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckId) return;

    if (isImageOcclusion) {
      if (!occlusionImageBase64 || !occlusionImageFilename) {
        setError("Veuillez choisir une image.");
        return;
      }
      if (occlusionRects.length === 0) {
        setError("Dessinez au moins une zone d'occlusion sur l'image.");
        return;
      }
    } else if (!question.trim() || (!isCloze && !answer.trim())) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let finalQuestion = question.trim();
      let finalExtra = extra.trim() || null;

      if (isImageOcclusion) {
        const storedFilename = await invoke<string>("store_anki_media", {
          filename: occlusionImageFilename,
          data: occlusionImageBase64,
        });
        finalQuestion = `<img src="${storedFilename}">`;
        finalExtra = JSON.stringify(occlusionRects);
      }

      const card = await invoke<AnkiNoteRecord>("create_anki_card", {
        question: finalQuestion,
        answer: answer.trim(),
        deck_id: deckId,
        note_type: noteType,
        extra_field: finalExtra,
        source_pdf_ref: context?.sourcePdfTitle ?? null,
        tags: tags.trim() || null,
        source_anchor_id: context?.sourceAnchorId ?? null,
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
    !deckId ||
    isSubmitting ||
    (isImageOcclusion
      ? !occlusionImageBase64 || occlusionRects.length === 0
      : !question.trim() || (!isCloze && !answer.trim()));

  const safeHtml = (raw: string) =>
    DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ["b", "i", "em", "strong", "u", "s", "p", "br", "ul", "ol", "li", "code", "pre", "span", "div"],
      ALLOWED_ATTR: ["class", "style"],
    } as Parameters<typeof DOMPurify.sanitize>[1]);

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

        {/* Note type selector */}
        <div className="space-y-1.5 mt-2">
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

        {/* Edition / Preview toggle — text-based cards only */}
        {!isImageOcclusion && (
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
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* ── Image Occlusion Enhanced ──────────────────────────────── */}
          {isImageOcclusion && (
            <>
              <div className="space-y-1.5">
                <Label>Image *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
                {occlusionImageUrl ? (
                  <div className="space-y-2">
                    <OcclusionCanvas
                      imageUrl={occlusionImageUrl}
                      rects={occlusionRects}
                      onRectsChange={setOcclusionRects}
                    />
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground flex-1">
                        {occlusionRects.length === 0
                          ? "Cliquez et glissez sur l'image pour masquer des zones."
                          : `${occlusionRects.length} zone${occlusionRects.length > 1 ? "s" : ""} masquée${occlusionRects.length > 1 ? "s" : ""}`}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Changer l'image
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-border rounded-md text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                  >
                    <ImageIcon className="h-8 w-8 opacity-40" />
                    <span className="text-sm">Cliquer pour choisir une image</span>
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="anki-header">En-tête (optionnel)</Label>
                <Input
                  id="anki-header"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Contexte de la carte (ex : Anatomie du cœur)"
                />
              </div>
            </>
          )}

          {/* ── Text-based cards ─────────────────────────────────────── */}
          {!isImageOcclusion && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="anki-question">{questionLabel} *</Label>
                  {isCloze && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs font-mono text-primary border border-primary/40"
                      onClick={handleClozeWrap}
                      title="Entourer la sélection avec la syntaxe cloze"
                    >
                      {"{{"}<span>c1::</span>{"}}"}
                    </Button>
                  )}
                </div>
                {previewMode ? (
                  <div
                    className="border rounded-md p-3 min-h-[80px] text-sm prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: safeHtml(question) }}
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

              {!isCloze && (
                <div className="space-y-1.5">
                  <Label htmlFor="anki-answer">Réponse *</Label>
                  {previewMode ? (
                    <div
                      className="border rounded-md p-3 min-h-[80px] text-sm prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: safeHtml(answer) }}
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

              <div className="space-y-1.5">
                <Label htmlFor="anki-extra">Champ supplémentaire</Label>
                {previewMode ? (
                  <div
                    className="border rounded-md p-3 min-h-[48px] text-sm prose prose-invert max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: safeHtml(extra) || "<em>Vide</em>" }}
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
            </>
          )}

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
                <Button type="button" size="sm" onClick={handleCreateDeck} disabled={!newDeckName.trim() || isCreatingDeck}>
                  {isCreatingDeck ? "..." : "Créer"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewDeck(false); setNewDeckName(""); }}>
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
                <Button type="button" size="icon" variant="outline" onClick={() => setShowNewDeck(true)} title="Nouveau paquet">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
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

          {isImageOcclusion && (
            <p className="text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-md px-3 py-2">
              Image Occlusion nécessite Anki ouvert avec le plugin AnkiConnect.
            </p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

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
