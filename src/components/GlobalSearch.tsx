import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, List, AlertCircle, CreditCard, PenTool, Search, Loader2, BookOpen } from "lucide-react";

interface SearchResult {
  id: string;
  result_type: "specialty" | "pdf_doc" | "pdf_page" | "item" | "error" | "anki" | "diagram";
  title: string;
  subtitle?: string;
  snippet?: string;
  route: string;
}

interface Group {
  label: string;
  results: SearchResult[];
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  specialty: BookOpen,
  pdf_doc: FileText,
  pdf_page: FileText,
  item: List,
  error: AlertCircle,
  anki: CreditCard,
  diagram: PenTool,
};

const GROUP_LABELS: Record<string, string> = {
  specialty: "Matières",
  pdf_doc: "Documents PDF",
  pdf_page: "Contenu PDF",
  item: "Items EDN",
  error: "Carnet d'erreurs",
  anki: "Cartes Anki",
  diagram: "Schémas",
};

const GROUP_ORDER = ["specialty", "item", "pdf_doc", "pdf_page", "error", "anki", "diagram"];

function groupResults(results: SearchResult[]): Group[] {
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    const key = r.result_type;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return GROUP_ORDER.filter((k) => map.has(k)).map((k) => ({
    label: GROUP_LABELS[k] ?? k,
    results: map.get(k)!,
  }));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await invoke<SearchResult[]>("global_search", { query: q });
      setResults(res);
      setFocusedIndex(0);
    } catch (e) {
      console.error("global_search error:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setFocusedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const flatResults = results;

  function handleSelect(result: SearchResult) {
    navigate(result.route);
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (flatResults[focusedIndex]) handleSelect(flatResults[focusedIndex]);
    }
  }

  const groups = groupResults(results);
  let itemCounter = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-2xl gap-0 overflow-hidden" onKeyDown={handleKeyDown}>
        <DialogTitle className="sr-only">Recherche globale</DialogTitle>
        <DialogDescription className="sr-only">
          Rechercher dans les items, PDFs, erreurs et cartes Anki
        </DialogDescription>
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          {loading ? (
            <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher items, PDFs, erreurs, cartes…"
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-base"
          />
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[420px]">
          {query.trim().length >= 2 && !loading && results.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucun résultat pour «&nbsp;{query}&nbsp;»
            </div>
          )}

          {query.trim().length < 2 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Tapez au moins 2 caractères pour rechercher
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                {group.label}
              </div>
              {group.results.map((result) => {
                const index = itemCounter++;
                const isFocused = index === focusedIndex;
                const Icon = TYPE_ICONS[result.result_type] ?? Search;
                return (
                  <button
                    key={result.id + result.result_type}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                      isFocused ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    }`}
                  >
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium truncate">{result.title}</span>
                        {result.subtitle && (
                          <span className="text-xs text-muted-foreground shrink-0">{result.subtitle}</span>
                        )}
                      </div>
                      {result.snippet && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{result.snippet}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </ScrollArea>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-t border-border text-xs text-muted-foreground">
            <span><kbd className="bg-muted px-1 rounded">↑↓</kbd> naviguer</span>
            <span><kbd className="bg-muted px-1 rounded">↵</kbd> ouvrir</span>
            <span><kbd className="bg-muted px-1 rounded">Esc</kbd> fermer</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
