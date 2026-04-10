import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
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
  RefreshCw,
  Wifi,
  WifiOff,
  Folder,
  FolderOpen as FolderOpenIcon,
  Pencil,
  Trash2,
  EyeOff,
  MoveRight,
  BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AnkiCardCreationModal } from "@/components/AnkiCardCreationModal";
import { AnkiCardEditModal } from "@/components/AnkiCardEditModal";
import { AnkiDeckStatsPanel } from "@/components/AnkiDeckStatsPanel";
import type { AnkiNoteRecord, AnkiDeck } from "@/lib/types";
import { useAnkiStore } from "@/stores/anki";
import { cn } from "@/lib/utils";

// ─── Deck tree ────────────────────────────────────────────────────────────────

interface DeckTreeNode {
  deck: AnkiDeck;
  shortName: string;
  children: DeckTreeNode[];
}

function buildDeckTree(decks: AnkiDeck[]): DeckTreeNode[] {
  const sorted = [...decks].sort((a, b) => a.name.localeCompare(b.name));
  const byName = new Map<string, DeckTreeNode>();
  const roots: DeckTreeNode[] = [];

  for (const deck of sorted) {
    const parts = deck.name.split("::");
    const node: DeckTreeNode = {
      deck,
      shortName: parts[parts.length - 1],
      children: [],
    };
    byName.set(deck.name, node);

    const parentName = parts.slice(0, -1).join("::");
    const parent = parentName ? byName.get(parentName) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function DeckTreeNodes({
  nodes,
  deckFilter,
  setDeckFilter,
  expandedDecks,
  toggleExpanded,
  depth = 0,
}: {
  nodes: DeckTreeNode[];
  deckFilter: string;
  setDeckFilter: (id: string) => void;
  expandedDecks: Set<string>;
  toggleExpanded: (id: string) => void;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isSelected = deckFilter === node.deck.id;
        const isExpanded = expandedDecks.has(node.deck.id);
        const hasChildren = node.children.length > 0;

        return (
          <div key={node.deck.id}>
            <div
              className={cn(
                "flex items-center gap-1 rounded-md px-1 py-0.5 text-xs transition-colors cursor-pointer select-none",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              style={{ paddingLeft: `${4 + depth * 14}px` }}
            >
              {/* Expand/collapse toggle */}
              <span
                className="shrink-0 w-4 flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) toggleExpanded(node.deck.id);
                }}
              >
                {hasChildren ? (
                  isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )
                ) : null}
              </span>

              {/* Deck name */}
              <span
                className="flex items-center gap-1 flex-1 min-w-0"
                onClick={() => setDeckFilter(isSelected ? "all" : node.deck.id)}
              >
                {hasChildren ? (
                  isExpanded ? (
                    <FolderOpenIcon className="h-3 w-3 shrink-0" />
                  ) : (
                    <Folder className="h-3 w-3 shrink-0" />
                  )
                ) : (
                  <Layers className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">{node.shortName}</span>
                <span className={cn("ml-auto shrink-0", isSelected ? "opacity-80" : "opacity-50")}>
                  {node.deck.card_count > 0 ? node.deck.card_count : ""}
                </span>
              </span>
            </div>

            {hasChildren && isExpanded && (
              <DeckTreeNodes
                nodes={node.children}
                deckFilter={deckFilter}
                setDeckFilter={setDeckFilter}
                expandedDecks={expandedDecks}
                toggleExpanded={toggleExpanded}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Anki() {
  const navigate = useNavigate();
  const {
    collectionPath,
    isCollectionConnected,
    ankiConnectAvailable,
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
    setAnkiConnectAvailable,
    addCard,
    error: storeError,
    setError: setStoreError,
  } = useAnkiStore();

  const [search, setSearch] = React.useState("");
  const [deckFilter, setDeckFilter] = React.useState("all");
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [editingCard, setEditingCard] = React.useState<AnkiNoteRecord | null>(null);
  const [expandedCards, setExpandedCards] = React.useState<Set<string>>(new Set());
  const [expandedDecks, setExpandedDecks] = React.useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = React.useState(false);

  const highlightedRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const load = async () => {
      setLoadingDecks(true);
      setLoadingCards(true);
      setStoreError(null);
      try {
        const connected = await invoke<boolean>("anki_check_connection");
        setAnkiConnectAvailable(connected);

        const [loadedDecks, loadedCards] = await Promise.all([
          invoke<AnkiDeck[]>("list_anki_decks"),
          invoke<AnkiNoteRecord[]>("get_anki_cards"),
        ]);
        setDecks(loadedDecks);
        setCards(loadedCards);

        // Auto-expand top-level decks that have children
        const tree = buildDeckTree(loadedDecks);
        const toExpand = new Set<string>();
        for (const node of tree) {
          if (node.children.length > 0) toExpand.add(node.deck.id);
        }
        setExpandedDecks(toExpand);
      } catch (err) {
        setStoreError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingDecks(false);
        setLoadingCards(false);
      }
    };
    load();
  }, []);

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
        const loadedDecks = await invoke<AnkiDeck[]>("list_anki_decks");
        setDecks(loadedDecks);
      }
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setStoreError(null);
    try {
      const loadedDecks = await invoke<AnkiDeck[]>("list_anki_decks");
      setDecks(loadedDecks);
      await invoke<AnkiNoteRecord[]>("anki_sync_notes", { deckName: null });
      const loadedCards = await invoke<AnkiNoteRecord[]>("get_anki_cards");
      setCards(loadedCards);
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedDecks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCardExpanded = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deckTree = React.useMemo(() => buildDeckTree(decks), [decks]);

  // Collect all deck IDs in the selected subtree (for filtering cards by parent deck)
  const activeDeckIds = React.useMemo(() => {
    if (deckFilter === "all") return null;

    const ids = new Set<string>();
    const collect = (nodes: DeckTreeNode[]) => {
      for (const node of nodes) {
        if (node.deck.id === deckFilter || ids.size > 0) {
          ids.add(node.deck.id);
          collect(node.children);
        } else {
          // Check if this node is the target
          const findAndCollect = (n: DeckTreeNode): boolean => {
            if (n.deck.id === deckFilter) {
              ids.add(n.deck.id);
              const addAll = (children: DeckTreeNode[]) => {
                for (const c of children) {
                  ids.add(c.deck.id);
                  addAll(c.children);
                }
              };
              addAll(n.children);
              return true;
            }
            return n.children.some(findAndCollect);
          };
          findAndCollect(node);
        }
      }
    };
    collect(deckTree);
    return ids;
  }, [deckFilter, deckTree]);

  const filtered = React.useMemo(() => {
    return cards.filter((card) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        card.question.toLowerCase().includes(q) ||
        card.answer.toLowerCase().includes(q) ||
        (card.tags ?? "").toLowerCase().includes(q);
      const matchDeck = !activeDeckIds || activeDeckIds.has(card.deck_id);
      return matchSearch && matchDeck;
    });
  }, [cards, search, activeDeckIds]);

  const isLoading = isLoadingDecks || isLoadingCards;

  // Flat list for the Select dropdown (with indentation prefix)
  const flatDecksForSelect = React.useMemo(() => {
    const flat: { deck: AnkiDeck; indent: number }[] = [];
    const walk = (nodes: DeckTreeNode[], depth: number) => {
      for (const node of nodes) {
        flat.push({ deck: node.deck, indent: depth });
        walk(node.children, depth + 1);
      }
    };
    walk(deckTree, 0);
    return flat;
  }, [deckTree]);

  const handleSuspendCard = async (card: AnkiNoteRecord) => {
    try {
      await invoke("anki_suspend_notes", { noteIds: [card.id] });
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleMoveCard = async (card: AnkiNoteRecord, targetDeckId: string) => {
    const targetDeck = decks.find((d) => d.id === targetDeckId);
    if (!targetDeck) return;
    try {
      await invoke("anki_move_notes_to_deck", { noteIds: [card.id], targetDeckName: targetDeck.name });
      setCards(cards.map((c) => c.id === card.id ? { ...c, deck_id: targetDeckId } : c));
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : String(err));
    }
  };

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
            <div className="flex items-center gap-2">
              {ankiConnectAvailable && (
                <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing} className="gap-1.5">
                  <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                  Sync
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => navigate("/anki/study")} className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Réviser
              </Button>
              <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Nouvelle carte
              </Button>
            </div>
          </div>

          {/* Connection status */}
          <div className="flex flex-col gap-1.5">
            <div className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs",
              ankiConnectAvailable ? "border-green-500/30 bg-green-500/5" : "border-muted"
            )}>
              {ankiConnectAvailable ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  <span className="text-green-400 font-medium">AnkiConnect actif</span>
                  <span className="text-muted-foreground ml-auto">port 8765</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">AnkiConnect indisponible</span>
                  <span className="text-muted-foreground/60 ml-auto text-[11px]">ouvrez Anki + plugin</span>
                </>
              )}
            </div>

            {!ankiConnectAvailable && (
              <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
                {isCollectionConnected ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="flex-1 truncate text-muted-foreground" title={collectionPath ?? ""}>
                      {collectionPath ?? "Collection connectée"}
                    </span>
                    <span className="text-amber-400/80 shrink-0">lecture seule</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="flex-1 text-muted-foreground">Aucune collection</span>
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={handleSelectCollection}>
                      <FolderOpen className="h-3 w-3 mr-1" />
                      Sélectionner
                    </Button>
                  </>
                )}
              </div>
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
              {flatDecksForSelect.map(({ deck, indent }) => (
                <SelectItem key={deck.id} value={deck.id}>
                  {"\u00a0\u00a0".repeat(indent * 2)}{deck.name.split("::").pop()}
                  {deck.card_count > 0 ? ` (${deck.card_count})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Deck tree */}
        {deckTree.length > 0 && !isLoading && (
          <div className="px-3 py-2 border-b bg-muted/30">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide px-1">
              Paquets
            </p>
            <div className="space-y-0.5">
              <div
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors cursor-pointer",
                  deckFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                onClick={() => setDeckFilter("all")}
              >
                <Layers className="h-3 w-3 shrink-0" />
                <span>Tous</span>
                <span className={cn("ml-auto", deckFilter === "all" ? "opacity-80" : "opacity-50")}>
                  {cards.length}
                </span>
              </div>
              <DeckTreeNodes
                nodes={deckTree}
                deckFilter={deckFilter}
                setDeckFilter={setDeckFilter}
                expandedDecks={expandedDecks}
                toggleExpanded={toggleExpanded}
              />
            </div>
          </div>
        )}

        {/* Card list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Chargement...</p>
            </div>
          ) : storeError ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-red-400 px-4 text-center">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">{storeError}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">
                {cards.length === 0
                  ? ankiConnectAvailable
                    ? "Appuyez sur Sync pour importer vos cartes"
                    : "Créez une carte ou connectez AnkiConnect"
                  : "Aucune carte trouvée"}
              </p>
            </div>
          ) : (
            filtered.map((card) => {
              const isExpanded = expandedCards.has(card.id);
              const isHighlighted = highlightedCardId === card.id;
              const deckName = decks.find((d) => d.id === card.deck_id)?.name ?? card.deck_name ?? card.deck_id;
              const tagList = (card.tags ?? "").split(/\s+/).filter((t) => t && t !== "edn-tracker");
              const isSynced = card.anki_note_id != null;

              return (
                <div
                  key={card.id}
                  ref={isHighlighted ? highlightedRef : undefined}
                  className={cn("border-b transition-colors", isHighlighted && "ring-2 ring-purple-400 ring-inset")}
                >
                  <button
                    onClick={() => toggleCardExpanded(card.id)}
                    className="w-full text-left p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-1 shrink-0 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{card.question}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <Badge variant="outline" className="text-xs py-0 px-1.5">
                            {deckName.split("::").pop()}
                          </Badge>
                          {isSynced && (
                            <Badge variant="secondary" className="text-xs py-0 px-1.5 text-green-400 border-green-500/30">
                              Anki
                            </Badge>
                          )}
                          {tagList.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs py-0 px-1.5">
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
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Réponse</p>
                        <p className="text-sm leading-relaxed">{card.answer}</p>
                      </div>
                      {card.extra_field && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Complément</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{card.extra_field}</p>
                        </div>
                      )}
                      {card.source_pdf_ref && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Source</p>
                          <Badge variant="outline" className="text-xs">{card.source_pdf_ref}</Badge>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => { e.stopPropagation(); setEditingCard(card); }}
                        >
                          <Pencil className="h-3 w-3" /> Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-red-400 hover:text-red-300"
                          onClick={(e) => { e.stopPropagation(); setEditingCard(card); }}
                        >
                          <Trash2 className="h-3 w-3" /> Supprimer
                        </Button>
                        {ankiConnectAvailable && card.anki_note_id != null && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={(e) => { e.stopPropagation(); handleSuspendCard(card); }}
                            >
                              <EyeOff className="h-3 w-3" /> Suspendre
                            </Button>
                            <Select onValueChange={(targetDeckId) => handleMoveCard(card, targetDeckId)}>
                              <SelectTrigger className="h-7 text-xs w-auto gap-1" onClick={(e) => e.stopPropagation()}>
                                <MoveRight className="h-3 w-3" />
                                <span>Déplacer</span>
                              </SelectTrigger>
                              <SelectContent>
                                {decks.filter((d) => d.id !== card.deck_id).map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.name.split("::").pop()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 hidden lg:flex flex-col overflow-hidden">
        <AnkiDeckStatsPanel
          selectedDeckName={deckFilter !== "all" ? (decks.find(d => d.id === deckFilter)?.name ?? null) : null}
          ankiConnectAvailable={ankiConnectAvailable}
        />
      </div>

      <AnkiCardCreationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCardCreated={handleCardCreated}
        decks={decks}
        onDeckCreated={handleDeckCreated}
      />

      <AnkiCardEditModal
        open={editingCard !== null}
        card={editingCard}
        onClose={() => setEditingCard(null)}
        onUpdated={(updated) => {
          setCards(cards.map((c) => c.id === updated.id ? updated : c));
          setEditingCard(null);
        }}
        onDeleted={(deletedId) => {
          setCards(cards.filter((c) => c.id !== deletedId));
          setEditingCard(null);
        }}
      />
    </div>
  );

  function handleCardCreated(card: AnkiNoteRecord) {
    addCard(card);
  }

  function handleDeckCreated(deck: AnkiDeck) {
    setDecks([...decks, deck]);
  }
}
