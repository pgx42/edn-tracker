import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Link2, ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PdfDocument, EdnItem, ErrorEntry } from "@/lib/types";
import { mockPdfs, mockItems } from "@/lib/mockData";

// ─── Link types ───────────────────────────────────────────────────────────────

const LINK_TYPES = [
  { value: "related", label: "Lié à" },
  { value: "definition", label: "Définition" },
  { value: "example", label: "Exemple" },
  { value: "counterexample", label: "Contre-exemple" },
  { value: "comparison", label: "Comparaison" },
  { value: "mechanism", label: "Mécanisme" },
] as const;

export type LinkType = (typeof LINK_TYPES)[number]["value"];

// ─── Resource result union ────────────────────────────────────────────────────

type ResourceKind = "pdf" | "item" | "error" | "anki_card";

interface SearchResult {
  kind: ResourceKind;
  id: string;
  label: string;
  sublabel?: string;
}

// ─── Debounce helper ──────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Backend search helpers ───────────────────────────────────────────────────

async function getAnchorsForPdf(pdfId: string): Promise<SearchResult[]> {
  try {
    interface Anchor {
      id: string;
      label?: string;
      page_number?: number;
      text_snippet?: string;
    }
    const anchors = await invoke<Anchor[]>("list_anchors", {
      pdf_id: pdfId,
    });
    return anchors.map((a) => ({
      kind: "pdf" as ResourceKind,
      id: a.id,
      label: a.label || `Page ${a.page_number}`,
      sublabel: a.text_snippet ? `"${a.text_snippet.slice(0, 30)}..."` : "Zone",
    }));
  } catch {
    return [];
  }
}

async function searchPdfs(query: string): Promise<SearchResult[]> {
  try {
    const docs = await invoke<PdfDocument[]>("list_pdfs");
    const q = query.toLowerCase();
    return docs
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          (d.doc_type ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((d) => ({
        kind: "pdf" as ResourceKind,
        id: String(d.id),
        label: d.title,
        sublabel: d.doc_type,
      }));
  } catch {
    // Fall back to mock data when backend is unavailable
    const q = query.toLowerCase();
    return mockPdfs
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          (d.doc_type ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((d) => ({
        kind: "pdf" as ResourceKind,
        id: String(d.id),
        label: d.title,
        sublabel: d.doc_type,
      }));
  }
}

async function searchItems(query: string): Promise<SearchResult[]> {
  try {
    interface BackendItem {
      id: number;
      code: string;
      title: string;
      specialty_id?: string;
      rank?: string;
    }
    const items = await invoke<BackendItem[]>("get_items", {});
    const q = query.toLowerCase();
    return items
      .filter(
        (i) =>
          !q ||
          i.code.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((i) => ({
        kind: "item" as ResourceKind,
        id: String(i.id),
        label: i.title,
        sublabel: i.code,
      }));
  } catch {
    const q = query.toLowerCase();
    return (mockItems as EdnItem[])
      .filter(
        (i) =>
          !q ||
          i.code.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((i) => ({
        kind: "item" as ResourceKind,
        id: String(i.id),
        label: i.title,
        sublabel: i.code,
      }));
  }
}

async function searchErrors(query: string): Promise<SearchResult[]> {
  try {
    const errors = await invoke<ErrorEntry[]>("list_errors");
    const q = query.toLowerCase();
    return errors
      .filter((e) => !q || e.title.toLowerCase().includes(q))
      .slice(0, 8)
      .map((e) => ({
        kind: "error" as ResourceKind,
        id: String(e.id),
        label: e.title,
        sublabel: e.error_type.replace(/_/g, " "),
      }));
  } catch {
    // Fall back to empty list
    return [];
  }
}

async function searchCards(query: string): Promise<SearchResult[]> {
  try {
    interface BackendCard {
      id: string;
      question: string;
      deck_name?: string;
    }
    const cards = await invoke<BackendCard[]>("get_anki_cards", {});
    const q = query.toLowerCase();
    return cards
      .filter((c) => !q || c.question.toLowerCase().includes(q))
      .slice(0, 8)
      .map((c) => ({
        kind: "anki_card" as ResourceKind,
        id: c.id,
        label: c.question,
        sublabel: c.deck_name,
      }));
  } catch {
    return [];
  }
}

const kindConfig: Record<
  ResourceKind,
  { label: string; color: string }
> = {
  pdf: { label: "PDF", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  item: { label: "Item", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  error: { label: "Erreur", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  anki_card: { label: "Anki", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LinkCreationModalProps {
  open: boolean;
  /** The anchor ID that is the source of the link */
  sourceAnchorId: string;
  onClose: () => void;
  /** Called after a link has been successfully created */
  onLinkCreated?: (linkId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LinkCreationModal: React.FC<LinkCreationModalProps> = ({
  open,
  sourceAnchorId,
  onClose,
  onLinkCreated,
}) => {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [selected, setSelected] = React.useState<SearchResult | null>(null);
  const [linkType, setLinkType] = React.useState<LinkType>("related");
  const [bidirectional, setBidirectional] = React.useState(true);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPdfAnchors, setSelectedPdfAnchors] = React.useState<SearchResult[]>([]);

  const debouncedQuery = useDebounce(query, 250);

  // Run search when debounced query changes
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsSearching(true);
    Promise.all([
      searchPdfs(debouncedQuery),
      searchItems(debouncedQuery),
      searchErrors(debouncedQuery),
      searchCards(debouncedQuery),
    ]).then(([pdfs, items, errors, cards]) => {
      if (!cancelled) {
        setResults([...pdfs, ...items, ...errors, ...cards]);
        setIsSearching(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(null);
      setLinkType("related");
      setBidirectional(true);
      setError(null);
      setSelectedPdfAnchors([]);
    }
  }, [open]);

  // Load anchors when PDF is selected and bidirectional is enabled
  React.useEffect(() => {
    if (selected?.kind === "pdf" && bidirectional) {
      getAnchorsForPdf(selected.id).then(setSelectedPdfAnchors);
    }
  }, [selected, bidirectional]);

  const handleCreate = async () => {
    if (!selected || !sourceAnchorId) return;
    setIsCreating(true);
    setError(null);
    try {
      // Map resource kind to target_type (pdf resources link to anchors)
      const targetTypeMap: Record<string, string> = {
        pdf: "anchor",
        item: "item",
        error: "error",
        anki_card: "anki_card",
      };
      const mappedTargetType = targetTypeMap[selected.kind] || selected.kind;

      const linkId = await invoke<string>("create_link", {
        sourceAnchorId,
        targetAnchorId: selected.kind === "pdf" ? selected.id : null,
        targetType: mappedTargetType,
        targetId: selected.kind === "pdf" ? null : selected.id,
        linkType,
      });

      // If bidirectional and PDF target, create reverse link from selected anchor to source
      if (bidirectional && selected.kind === "pdf") {
        try {
          await invoke<string>("create_link", {
            sourceAnchorId: selected.id,
            targetAnchorId: sourceAnchorId,
            targetType: "anchor",
            targetId: null,
            linkType,
          });
        } catch {
          // Non-fatal: forward link was created
        }
      }

      onLinkCreated?.(linkId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Créer un lien
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Search input */}
          <div className="space-y-1.5">
            <Label htmlFor="link-search">Ressource cible</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="link-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                }}
                placeholder="Rechercher PDF, item, erreur, carte Anki…"
                className="pl-9"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Results list */}
          {!selected && results.length > 0 && (
            <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
              {results.map((r) => {
                const cfg = kindConfig[r.kind];
                return (
                  <button
                    key={`${r.kind}-${r.id}`}
                    onClick={() => setSelected(r)}
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2 text-sm border-b last:border-b-0"
                  >
                    <Badge
                      variant="outline"
                      className={cn("text-xs shrink-0 border", cfg.color)}
                    >
                      {cfg.label}
                    </Badge>
                    <span className="font-medium truncate flex-1">{r.label}</span>
                    {r.sublabel && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {r.sublabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected resource pill */}
          {selected && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-accent border">
              <Badge
                variant="outline"
                className={cn("text-xs border", kindConfig[selected.kind].color)}
              >
                {kindConfig[selected.kind].label}
              </Badge>
              <span className="text-sm font-medium flex-1 truncate">{selected.label}</span>
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-muted-foreground hover:text-foreground ml-1"
              >
                Changer
              </button>
            </div>
          )}

          {/* Link type */}
          <div className="space-y-1.5">
            <Label>Type de lien</Label>
            <Select
              value={linkType}
              onValueChange={(v) => setLinkType(v as LinkType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type de lien" />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPES.map((lt) => (
                  <SelectItem key={lt.value} value={lt.value}>
                    {lt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bidirectional toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="bidirectional-toggle" className="flex items-center gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                Lien bidirectionnel
              </Label>
              <p className="text-xs text-muted-foreground">
                {selected?.kind === "pdf"
                  ? "Crée un lien retour depuis une ancrage du PDF"
                  : "Crée un lien retour automatique"}
              </p>
            </div>
            <Switch
              id="bidirectional-toggle"
              checked={bidirectional}
              onCheckedChange={setBidirectional}
            />
          </div>

          {/* Show anchors when PDF is selected and bidirectional is enabled */}
          {selected?.kind === "pdf" && bidirectional && selectedPdfAnchors.length > 0 && (
            <div className="space-y-1.5 border rounded-md p-2 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">
                Sélectionner l'ancrage pour le lien retour:
              </p>
              <div className="space-y-1">
                {selectedPdfAnchors.map((anchor) => (
                  <button
                    key={anchor.id}
                    onClick={() => setSelected(anchor)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                      selected.id === anchor.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent border border-transparent"
                    )}
                  >
                    <p className="font-medium">{anchor.label}</p>
                    {anchor.sublabel && (
                      <p className="text-xs opacity-70">{anchor.sublabel}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected?.kind === "pdf" && bidirectional && selectedPdfAnchors.length === 0 && (
            <div className="border rounded-md p-2 bg-yellow-500/10 border-yellow-500/30">
              <p className="text-xs text-yellow-700 dark:text-yellow-600">
                Ce PDF n'a pas d'ancrages. Créez d'abord un ancrage dans le PDF pour un lien bidirectionnel.
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selected || isCreating}
            className="gap-1.5"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Créer le lien
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LinkCreationModal;
