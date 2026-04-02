import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Layers,
  FolderOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AnkiCardCreationModal } from "@/components/AnkiCardCreationModal";
import type { AnkiNoteRecord, AnkiDeck } from "@/lib/types";
import { useAnkiStore } from "@/stores/anki";
import { cn } from "@/lib/utils";

export function Anki() {
  const {
    collectionPath,
    isCollectionConnected,
    decks,
    cards,
    isLoadingDecks,
    isLoadingCards,
    highlightedCardId,
    setDecks,
    setCards,
    setLoadingDecks,
    setLoadingCards,
    setCollectionPath,
    setHighlightedCardId,
    addCard,
    error: storeError,
    setError: setStoreError,
  } = useAnkiStore();

  const [search, setSearch] = React.useState("");
  const [deckFilter, setDeckFilter] = React.useState("all");
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [expandedCards, setExpandedCards] = React.useState<Set<string>>(new Set());

  const highlightedRef = React.useRef<HTMLDivElement | null>(null);

  // Load decks and cards on mount
  React.useEffect(() => {
    const load = async () => {
      setLoadingDecks(true);
      setLoadingCards(true);
      setStoreError(null);
      try {
        const [loadedDecks, loadedCards] = await Promise.all([
          invoke<AnkiDeck[]>("list_anki_decks"),
          invoke<AnkiNoteRecord[]>("get_anki_cards"),
        ]);
        setDecks(loadedDecks);
        setCards(loadedCards);
      } catch (err) {
        setStoreError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingDecks(false);
        setLoadingCards(false);
      }
    };
    load();
  }, []);

  // Auto-scroll and clear highlighted card
  React.useEffect(() => {
    if (highlightedCardId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = setTimeout(() => setHighlightedCardId(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightedCardId, setHighlightedCardId]);

  const handleSelectCollection = async () => {
    try {
      const path = await invoke<string>("select_anki_collection");
      if (path) {
        setCollectionPath(path);
      }
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCardCreated = (card: AnkiNoteRecord) => {
    addCard(card);
  };

  const handleDeckCreated = (deck: AnkiDeck) => {
    setDecks([...decks, deck]);
  };

  const toggleCardExpanded = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = React.useMemo(() => {
    return cards.filter((card) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        card.question.toLowerCase().includes(q) ||
        card.answer.toLowerCase().includes(q) ||
        (card.tags ?? "").toLowerCase().includes(q);
      const matchDeck = deckFilter === "all" || card.deck_id === deckFilter;
      return matchSearch && matchDeck;
    });
  }, [cards, search, deckFilter]);

  const deckCardCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of cards) {
      counts[card.deck_id] = (counts[card.deck_id] ?? 0) + 1;
    }
    return counts;
  }, [cards]);

  const isLoading = isLoadingDecks || isLoadingCards;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="flex flex-col w-full lg:w-[460px] shrink-0 border-r overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b bg-card/50 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Anki</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-medium">{cards.length} carte{cards.length !== 1 ? "s" : ""}</span>
                {" · "}
                <span className="font-medium">{decks.length} paquet{decks.length !== 1 ? "s" : ""}</span>
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nouvelle carte
            </Button>
          </div>

          {/* Collection status */}
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            {isCollectionConnected ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                <span className="flex-1 truncate text-xs text-muted-foreground" title={collectionPath ?? ""}>
                  {collectionPath ?? "Collection connectée"}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="flex-1 text-xs text-muted-foreground">Aucune collection connectée</span>
                <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={handleSelectCollection}>
                  <FolderOpen className="h-3.5 w-3.5 mr-1" />
                  Sélectionner
                </Button>
              </>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une carte..."
              className="pl-9 h-8 text-sm"
            />
          </div>

          <Select value={deckFilter} onValueChange={setDeckFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tous les paquets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les paquets</SelectItem>
              {decks.map((deck) => (
                <SelectItem key={deck.id} value={deck.id}>
                  {deck.name} ({deckCardCounts[deck.id] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Deck summary */}
        {decks.length > 0 && !isLoading && (
          <div className="px-4 py-2 border-b bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Paquets</p>
            <div className="flex flex-wrap gap-1.5">
              {decks.map((deck) => (
                <button
                  key={deck.id}
                  onClick={() => setDeckFilter(deckFilter === deck.id ? "all" : deck.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors",
                    deckFilter === deck.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-accent"
                  )}
                >
                  <Layers className="h-3 w-3" />
                  {deck.name}
                  <span className="opacity-70">({deckCardCounts[deck.id] ?? 0})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Card list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Chargement des cartes...</p>
            </div>
          ) : storeError ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-red-400">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">{storeError}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">Aucune carte trouvée</p>
            </div>
          ) : (
            filtered.map((card) => {
              const isExpanded = expandedCards.has(card.id);
              const isHighlighted = highlightedCardId === card.id;
              const deckName = decks.find((d) => d.id === card.deck_id)?.name ?? card.deck_name ?? card.deck_id;
              const tagList = card.tags ? card.tags.split(/\s+/).filter(Boolean) : [];

              return (
                <div
                  key={card.id}
                  ref={isHighlighted ? highlightedRef : undefined}
                  className={cn(
                    "border-b transition-colors",
                    isHighlighted && "ring-2 ring-purple-400 ring-inset"
                  )}
                >
                  <button
                    onClick={() => toggleCardExpanded(card.id)}
                    className="w-full text-left p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-1 shrink-0 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{card.question}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <Badge variant="outline" className="text-xs py-0 px-1.5">
                            {deckName}
                          </Badge>
                          {tagList.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs py-0 px-1.5"
                            >
                              {tag}
                            </Badge>
                          ))}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {card.created_at ? new Date(card.created_at).toLocaleDateString("fr-FR") : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-2 bg-muted/20">
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Réponse
                        </p>
                        <p className="text-sm leading-relaxed">{card.answer}</p>
                      </div>
                      {card.extra_field && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                            Complément
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{card.extra_field}</p>
                        </div>
                      )}
                      {card.source_pdf_ref && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                            Source
                          </p>
                          <Badge variant="outline" className="text-xs">{card.source_pdf_ref}</Badge>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel: placeholder */}
      <div className="flex-1 hidden lg:flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Layers className="h-12 w-12 opacity-20" />
        <p className="text-sm">Sélectionnez une carte pour voir les détails</p>
      </div>

      <AnkiCardCreationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCardCreated={handleCardCreated}
        decks={decks}
        onDeckCreated={handleDeckCreated}
      />
    </div>
  );
}
