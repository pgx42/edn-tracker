import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  ChevronDown, ChevronRight, Loader2,
  ArrowLeft, RotateCcw, CheckCircle2, BookOpen, RefreshCw, Minus, Eye,
} from "lucide-react";
import DOMPurify from "dompurify";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAnkiCardHtml } from "@/hooks/useAnkiCardHtml";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudyCard_T {
  card_id: number;
  note_id: number;
  deck_name: string;
  question: string;
  answer: string;
  card_type: number;
  interval: number;
  ease_factor: number;
  due: number;
  reps: number;
  lapses: number;
}
type StudyCard = StudyCard_T;

interface AnkiDeck {
  id: string;
  name: string;
  card_count: number;
}

interface DeckReviewStats {
  deck_id: string;
  deck_name: string;
  new_count: number;
  learn_count: number;
  review_count: number;
  total_in_deck: number;
}

interface LearningEntry {
  card: StudyCard;
  dueAt: number;
}

interface SessionStats {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

type CardSource = "review" | "learning" | "new";

interface HistoryEntry {
  card: StudyCard;
  ease: 1 | 2 | 3 | 4;
  source: CardSource;
}

// ─── Deck tree ────────────────────────────────────────────────────────────────

interface DeckNode {
  deck: AnkiDeck;
  shortName: string;
  depth: number;
  children: DeckNode[];
}

function buildDeckTree(decks: AnkiDeck[]): DeckNode[] {
  const sorted = [...decks].sort((a, b) => a.name.localeCompare(b.name));
  const byName = new Map<string, DeckNode>();
  const roots: DeckNode[] = [];

  for (const deck of sorted) {
    const parts = deck.name.split("::");
    const node: DeckNode = {
      deck,
      shortName: parts[parts.length - 1],
      depth: parts.length - 1,
      children: [],
    };
    byName.set(deck.name, node);

    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parentName = parts.slice(0, -1).join("::");
      const parent = byName.get(parentName);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }
  return roots;
}

function flattenTree(nodes: DeckNode[], expanded: Set<string>): DeckNode[] {
  const result: DeckNode[] = [];
  function walk(list: DeckNode[]) {
    for (const n of list) {
      result.push(n);
      if (n.children.length > 0 && expanded.has(n.deck.name)) {
        walk(n.children);
      }
    }
  }
  walk(nodes);
  return result;
}

// ─── Cloze helpers ────────────────────────────────────────────────────────────

const CLOZE_RE = /\{\{c(\d+)::([^:}]+)(?:::([^}]*))?\}\}/g;
function isCloze(text: string) { return /\{\{c\d+::/.test(text); }

function renderClozeMasked(html: string): string {
  return DOMPurify.sanitize(
    html.replace(CLOZE_RE, (_m, _o, _w, hint) =>
      `<span style="display:inline-block;padding:1px 8px;border-radius:4px;background:rgba(59,130,246,.2);color:#93c5fd;font-weight:600">[${hint?.trim() || "..."}]</span>`
    ),
    { USE_PROFILES: { html: true } }
  );
}

function renderClozeRevealed(html: string): string {
  return DOMPurify.sanitize(
    html.replace(CLOZE_RE, (_m, _o, word) =>
      `<mark style="background:rgba(34,197,94,.22);color:#86efac;padding:1px 8px;border-radius:4px;font-weight:600">${word}</mark>`
    ),
    { USE_PROFILES: { html: true } }
  );
}

// ─── Interval formatting ──────────────────────────────────────────────────────

function fmtInterval(v: number | undefined): string {
  if (v === undefined) return "";
  if (v < 0) {
    const s = Math.abs(v);
    if (s < 60) return `<${s}s`;
    if (s < 3600) return `<${Math.round(s / 60)}m`;
    return `<${Math.round(s / 3600)}h`;
  }
  if (v === 0) return "<1j";
  if (v < 31) return `${v}j`;
  if (v < 365) return `${(v / 30).toFixed(1)}mo`;
  return `${(v / 365).toFixed(1)}a`;
}

// ─── Queue helpers ────────────────────────────────────────────────────────────

function pickNext(review: StudyCard[], learning: LearningEntry[], newCards: StudyCard[]) {
  const now = Date.now();
  const due = learning.filter((l) => l.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
  if (due.length) return { card: due[0].card, source: "learning" as CardSource };
  if (review.length) return { card: review[0], source: "review" as CardSource };
  if (newCards.length) return { card: newCards[0], source: "new" as CardSource };
  if (learning.length) {
    const earliest = [...learning].sort((a, b) => a.dueAt - b.dueAt)[0];
    return { card: earliest.card, source: "learning" as CardSource };
  }
  return null;
}

// ─── Pill button ──────────────────────────────────────────────────────────────

function AnkiPill({
  children, onClick, disabled, className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm
        bg-zinc-700/80 text-zinc-200 hover:bg-zinc-600/80 active:bg-zinc-500/80
        disabled:opacity-40 transition-colors select-none whitespace-nowrap ${className}`}
    >
      {children}
    </button>
  );
}

// ─── HTML renderer ────────────────────────────────────────────────────────────

function CardHtml({ html, align = "left", revealOcclusion = false }: {
  html: string;
  align?: "left" | "center";
  revealOcclusion?: boolean;
}) {
  return (
    <div
      className={`anki-card-content text-[hsl(var(--foreground))] text-lg leading-relaxed ${align === "center" ? "text-center" : "text-left"}${revealOcclusion ? " anki-io-revealed" : ""}`}
      dangerouslySetInnerHTML={{ __html: html }} // nosec: DOMPurify-sanitized
    />
  );
}

// ─── View types ───────────────────────────────────────────────────────────────

type View = "select" | "study" | "done";

// ─── Top nav bar ──────────────────────────────────────────────────────────────

function AnkiTopNav({ onHome, onAdd, onStats, syncing, onSync, onBrowse }: {
  onHome: () => void;
  onAdd?: () => void;
  onStats?: () => void;
  syncing?: boolean;
  onSync?: () => void;
  onBrowse?: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-8 py-3 border-b border-white/[.06] shrink-0">
      <button onClick={onHome} className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">Paquets</button>
      {onAdd && <button onClick={onAdd} className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">Ajouter</button>}
      <button onClick={onBrowse} className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">Parcourir</button>
      <button onClick={onStats} className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">Statistiques</button>
      {onSync && (
        <button onClick={onSync} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          Synchronisation
        </button>
      )}
    </div>
  );
}

// ─── Deck overview (Anki home screen style) ───────────────────────────────────

function DeckOverview({
  decks, onStudy, onHome, onBrowse,
}: {
  decks: AnkiDeck[];
  onStudy: (deckName: string | null) => void;
  onHome: () => void;
  onBrowse?: () => void;
}) {
  // Keyed by deck_id (string) — more reliable than name matching
  const [deckStats, setDeckStats] = useState<Map<string, DeckReviewStats>>(new Map());
  const [reviewsToday, setReviewsToday] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildDeckTree(decks), [decks]);

  // Expand all root nodes by default
  useEffect(() => {
    const roots = tree.map((n) => n.deck.name);
    setExpanded(new Set(roots));
  }, [tree]);

  // Load per-deck stats
  useEffect(() => {
    if (decks.length === 0) return;
    setLoadingStats(true);
    invoke<DeckReviewStats[]>("anki_get_deck_review_stats", {
      deckNames: decks.map((d) => d.name),
    })
      .then((stats) => {
        // Index by deck_id (stable) — name format from AnkiConnect may differ from list_anki_decks
        setDeckStats(new Map(stats.map((s) => [s.deck_id, s])));
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));

    invoke<number>("anki_get_reviews_today")
      .then(setReviewsToday)
      .catch(() => {});
  }, [decks]);

  const flat = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  function toggleExpanded(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function Num({ n, color }: { n: number; color: string }) {
    if (n === 0) return <span className="text-zinc-600 tabular-nums">0</span>;
    return <span className={`${color} tabular-nums font-medium`}>{n}</span>;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <AnkiTopNav
        onHome={onHome}
        onAdd={() => {}}
        onSync={() => {}}
        onBrowse={onBrowse}
      />

      <div className="flex-1 overflow-auto py-6 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Deck table */}
          <div className="rounded-lg border border-white/[.08] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_6rem_6rem_6rem] px-4 py-2.5 border-b border-white/[.06] bg-white/[.03]">
              <span className="text-sm font-semibold text-zinc-300">Paquet</span>
              <span className="text-sm font-semibold text-blue-400 text-right">Nouvelles</span>
              <span className="text-sm font-semibold text-orange-400 text-right">En cours</span>
              <span className="text-sm font-semibold text-green-400 text-right">À réviser</span>
            </div>

            {/* Rows */}
            {loadingStats && decks.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              </div>
            ) : (
              flat.map((node) => {
                const stats = deckStats.get(node.deck.id);
                const hasChildren = node.children.length > 0;
                const isExpanded = expanded.has(node.deck.name);

                return (
                  <div
                    key={node.deck.id}
                    className="group grid grid-cols-[1fr_6rem_6rem_6rem] px-4 py-2 border-b border-white/[.04] hover:bg-white/[.04] transition-colors items-center"
                  >
                    {/* Name cell */}
                    <div className="flex items-center min-w-0" style={{ paddingLeft: `${node.depth * 1.25}rem` }}>
                      {/* Expand/collapse toggle */}
                      {hasChildren ? (
                        <button
                          onClick={() => toggleExpanded(node.deck.name)}
                          className="mr-1.5 text-zinc-500 hover:text-zinc-300 shrink-0"
                        >
                          {isExpanded
                            ? <Minus className="h-3 w-3" />
                            : <ChevronRight className="h-3 w-3" />}
                        </button>
                      ) : (
                        <span className="mr-1.5 w-3 shrink-0" />
                      )}
                      <button
                        onClick={() => onStudy(node.deck.name)}
                        className={`text-sm truncate hover:underline text-left transition-colors ${
                          node.depth === 0 ? "text-zinc-200 font-medium" : "text-zinc-300"
                        }`}
                      >
                        {node.shortName}
                      </button>
                    </div>

                    <div className="text-right text-sm">
                      <Num n={stats?.new_count ?? 0} color="text-blue-400" />
                    </div>
                    <div className="text-right text-sm">
                      <Num n={stats?.learn_count ?? 0} color="text-orange-400" />
                    </div>
                    <div className="text-right text-sm">
                      <Num n={stats?.review_count ?? 0} color="text-green-400" />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Stats line */}
          {reviewsToday !== null && (
            <p className="text-center text-sm text-zinc-500 mt-5">
              {reviewsToday === 0
                ? "Aucune carte révisée aujourd'hui"
                : `${reviewsToday} carte${reviewsToday !== 1 ? "s" : ""} révisée${reviewsToday !== 1 ? "s" : ""} aujourd'hui`}
            </p>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnkiStudy() {
  const navigate = useNavigate();

  const [decks, setDecks] = useState<AnkiDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [deckError, setDeckError] = useState<string | null>(null);

  const [view, setView] = useState<View>("select");
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<StudyCard[]>([]);
  const [learningQueue, setLearningQueue] = useState<LearningEntry[]>([]);
  const [newQueue, setNewQueue] = useState<StudyCard[]>([]);
  const [currentCard, setCurrentCard] = useState<StudyCard | null>(null);
  const [currentSource, setCurrentSource] = useState<CardSource>("review");
  const [showAnswer, setShowAnswer] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [intervals, setIntervals] = useState<number[]>([]);
  const [loadingIntervals, setLoadingIntervals] = useState(false);
  const [studyError, setStudyError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingDecks(true);
    invoke<AnkiDeck[]>("list_anki_decks")
      .then(setDecks)
      .catch((e: unknown) => setDeckError(String(e)))
      .finally(() => setLoadingDecks(false));
  }, []);

  useEffect(() => {
    if (!showAnswer || !currentCard) { setIntervals([]); return; }
    setLoadingIntervals(true);
    invoke<number[]>("anki_get_card_intervals", { cardId: currentCard.card_id })
      .then(setIntervals)
      .catch(() => setIntervals([]))
      .finally(() => setLoadingIntervals(false));
  }, [showAnswer, currentCard]);

  const startSession = useCallback(async (deckName: string | null) => {
    setSelectedDeck(deckName);
    setStudyError(null);
    setSessionStats({ again: 0, hard: 0, good: 0, easy: 0 });
    setHistory([]);
    try {
      const [due, newCards] = await Promise.all([
        invoke<StudyCard[]>("anki_get_due_cards", { deckName }),
        invoke<StudyCard[]>("anki_get_new_cards", { deckName }),
      ]);
      const next = pickNext(due, [], newCards);
      if (!next) { setView("done"); return; }
      setReviewQueue(due);
      setLearningQueue([]);
      setNewQueue(newCards);
      setCurrentCard(next.card);
      setCurrentSource(next.source);
      setShowAnswer(false);
      setIntervals([]);
      setView("study");
    } catch (e: unknown) {
      setStudyError(String(e));
    }
  }, []);

  const answerCard = useCallback(async (ease: 1 | 2 | 3 | 4) => {
    if (answering || !currentCard) return;
    setAnswering(true);
    try { await invoke("anki_answer_card", { cardId: currentCard.card_id, ease }); } catch { /**/ }
    finally { setAnswering(false); }

    const card = currentCard, src = currentSource;
    let nr = reviewQueue.filter((c) => c.card_id !== card.card_id);
    let nl = learningQueue.filter((l) => l.card.card_id !== card.card_id);
    let nn = newQueue.filter((c) => c.card_id !== card.card_id);
    if (ease === 1) nl = [...nl, { card, dueAt: Date.now() + 60_000 }];
    setReviewQueue(nr); setLearningQueue(nl); setNewQueue(nn);
    setHistory((h) => [...h, { card, ease, source: src }]);
    setSessionStats((s) => {
      const n = { ...s };
      if (ease === 1) n.again++; else if (ease === 2) n.hard++;
      else if (ease === 3) n.good++; else n.easy++;
      return n;
    });
    const next = pickNext(nr, nl, nn);
    if (next) { setCurrentCard(next.card); setCurrentSource(next.source); setShowAnswer(false); setIntervals([]); }
    else { setCurrentCard(null); setView("done"); }
  }, [answering, currentCard, currentSource, reviewQueue, learningQueue, newQueue]);

  const undoLast = useCallback(() => {
    if (!history.length) return;
    const last = history[history.length - 1];
    let nr = [...reviewQueue], nl = [...learningQueue], nn = [...newQueue];
    if (last.ease === 1) nl = nl.filter((l) => l.card.card_id !== last.card.card_id);
    if (last.source === "review") nr = [last.card, ...nr];
    else if (last.source === "new") nn = [last.card, ...nn];
    else nl = [{ card: last.card, dueAt: 0 }, ...nl];
    setReviewQueue(nr); setLearningQueue(nl); setNewQueue(nn);
    setHistory((h) => h.slice(0, -1));
    setSessionStats((s) => {
      const n = { ...s };
      if (last.ease === 1) n.again = Math.max(0, n.again - 1);
      else if (last.ease === 2) n.hard = Math.max(0, n.hard - 1);
      else if (last.ease === 3) n.good = Math.max(0, n.good - 1);
      else n.easy = Math.max(0, n.easy - 1);
      return n;
    });
    setCurrentCard(last.card); setCurrentSource(last.source);
    setShowAnswer(false); setIntervals([]);
    if (view === "done") setView("study");
  }, [history, reviewQueue, learningQueue, newQueue, view]);

  const buryCard = useCallback(() => {
    if (!currentCard) return;
    const id = currentCard.card_id;
    const nr = reviewQueue.filter((c) => c.card_id !== id);
    const nl = learningQueue.filter((l) => l.card.card_id !== id);
    const nn = newQueue.filter((c) => c.card_id !== id);
    setReviewQueue(nr); setLearningQueue(nl); setNewQueue(nn);
    const next = pickNext(nr, nl, nn);
    if (next) { setCurrentCard(next.card); setCurrentSource(next.source); setShowAnswer(false); setIntervals([]); }
    else { setCurrentCard(null); setView("done"); }
  }, [currentCard, reviewQueue, learningQueue, newQueue]);

  useEffect(() => {
    if (view !== "study") return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" && !showAnswer) { e.preventDefault(); setShowAnswer(true); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); undoLast(); return; }
      if (showAnswer) {
        if (e.key === "1") void answerCard(1); else if (e.key === "2") void answerCard(2);
        else if (e.key === "3") void answerCard(3); else if (e.key === "4") void answerCard(4);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, showAnswer, answerCard, undoLast]);

  // ─── SELECT VIEW ──────────────────────────────────────────────────────────

  if (view === "select") {
    if (loadingDecks) {
      return (
        <div className="flex h-full items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      );
    }
    if (deckError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8">
          <p className="text-sm text-red-400 text-center">
            Impossible de contacter Anki.<br />Assurez-vous qu'Anki est ouvert et qu'AnkiConnect est installé.
          </p>
          {studyError && <p className="text-xs text-red-400">{studyError}</p>}
          <AnkiPill onClick={() => { setDeckError(null); setLoadingDecks(false); }}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Réessayer
          </AnkiPill>
        </div>
      );
    }
    return (
      <DeckOverview
        decks={decks}
        onStudy={(name) => void startSession(name)}
        onHome={() => {}}
        onBrowse={() => navigate("/anki/parcourir")}
      />
    );
  }

  // ─── DONE VIEW ────────────────────────────────────────────────────────────

  if (view === "done") {
    const total = sessionStats.again + sessionStats.hard + sessionStats.good + sessionStats.easy;
    return (
      <div className="flex flex-col h-full bg-background">
        <AnkiTopNav onHome={() => setView("select")} onBrowse={() => navigate("/anki/parcourir")} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <CheckCircle2 className="h-14 w-14 text-green-400" />
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-1">
              {total > 0 ? "Félicitations !" : "Aucune carte à réviser"}
            </h2>
            {total > 0 && (
              <p className="text-sm text-zinc-400">
                {total} carte{total !== 1 ? "s" : ""} révisée{total !== 1 ? "s" : ""}
                {selectedDeck ? ` — ${selectedDeck}` : ""}
              </p>
            )}
          </div>

          {total > 0 && (
            <div className="flex gap-5 text-sm">
              {sessionStats.again > 0 && <span className="text-red-400">{sessionStats.again} À revoir</span>}
              {sessionStats.hard > 0 && <span className="text-orange-400">{sessionStats.hard} Difficile</span>}
              {sessionStats.good > 0 && <span className="text-green-400">{sessionStats.good} Correct</span>}
              {sessionStats.easy > 0 && <span className="text-blue-400">{sessionStats.easy} Facile</span>}
            </div>
          )}

          <div className="flex gap-3">
            {history.length > 0 && <AnkiPill onClick={undoLast}>Annuler dernière</AnkiPill>}
            <AnkiPill onClick={() => setView("select")}>
              <RotateCcw className="h-3.5 w-3.5" />
              Changer de paquet
            </AnkiPill>
            {selectedDeck && (
              <AnkiPill onClick={() => void startSession(selectedDeck)}>
                <BookOpen className="h-3.5 w-3.5" />
                Recommencer
              </AnkiPill>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── STUDY VIEW ───────────────────────────────────────────────────────────

  if (!currentCard) return null;

  const cloze = isCloze(currentCard.question) || isCloze(currentCard.answer);
  const rawQ = cloze ? renderClozeMasked(currentCard.question) : currentCard.question;
  const rawA = cloze ? renderClozeRevealed(currentCard.answer || currentCard.question) : currentCard.answer;

  return (
    <StudyView
      card={currentCard}
      rawQuestion={rawQ}
      rawAnswer={rawA}
      showAnswer={showAnswer}
      onShowAnswer={() => setShowAnswer(true)}
      onAnswer={(e) => void answerCard(e)}
      onUndo={history.length > 0 ? undoLast : undefined}
      onBury={buryCard}
      onNav={() => setView("select")}
      onBack={() => setView("select")}
      onBrowse={() => navigate("/anki/parcourir")}
      answering={answering}
      intervals={intervals}
      loadingIntervals={loadingIntervals}
      newCount={newQueue.length}
      learnCount={learningQueue.length}
      dueCount={reviewQueue.length}
    />
  );
}

// ─── Study view component ─────────────────────────────────────────────────────

function StudyView({
  card, rawQuestion, rawAnswer, showAnswer,
  onShowAnswer, onAnswer, onUndo, onBury, onNav, onBack, onBrowse,
  answering, intervals, loadingIntervals,
  newCount, learnCount, dueCount,
}: {
  card: StudyCard_T;
  rawQuestion: string;
  rawAnswer: string;
  showAnswer: boolean;
  onShowAnswer: () => void;
  onAnswer: (ease: 1 | 2 | 3 | 4) => void;
  onUndo?: () => void;
  onBury: () => void;
  onNav: () => void;
  onBack: () => void;
  onBrowse?: () => void;
  answering: boolean;
  intervals: number[];
  loadingIntervals: boolean;
  newCount: number;
  learnCount: number;
  dueCount: number;
}) {
  const { questionHtml, answerHtml, loading: mediaLoading } = useAnkiCardHtml(
    rawQuestion, rawAnswer, card.card_id
  );

  // Image Occlusion cards (IO Enhanced or built-in Anki 23+):
  // The "reveal" switches to answerHtml (which has tested shapes as ashape = transparent),
  // leaving other shapes masked. The eye button then hides all remaining overlays.
  const isImageOcclusion = !mediaLoading && (
    questionHtml.includes('id="io-wrapper"') ||
    questionHtml.includes("id='io-wrapper'") ||
    questionHtml.includes('id="image-occlusion-container"')
  );
  const [ioRevealAll, setIoRevealAll] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editQ, setEditQ] = useState(card.question);
  const [editA, setEditA] = useState(card.answer);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditQ(card.question);
    setEditA(card.answer);
    setIoRevealAll(false);
  }, [card.card_id]);

  async function saveEdit() {
    setSaving(true);
    try {
      await invoke("anki_update_note_fields_direct", { ankiNoteId: card.note_id, question: editQ, answer: editA });
      setEditOpen(false);
    } catch (e) { alert(String(e)); }
    finally { setSaving(false); }
  }

  const ratings = [
    { ease: 1 as const, label: "À revoir", col: "text-red-400" },
    { ease: 2 as const, label: "Difficile", col: "text-orange-300" },
    { ease: 3 as const, label: "Correct",   col: "text-green-400" },
    { ease: 4 as const, label: "Facile",    col: "text-blue-400" },
  ] as const;

  // Detect if question is simple text (no HTML tags) → center it
  const questionIsSimple = !/<[a-z]/i.test(card.question);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top nav */}
      <AnkiTopNav onHome={onNav} onAdd={() => {}} onBrowse={onBrowse} />

      {/* Card content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Card image / question */}
        <div className="flex-1 flex justify-center overflow-auto pt-8 px-16 pb-6 items-start">
          {mediaLoading
            ? <Loader2 className="h-5 w-5 animate-spin text-zinc-600 mt-10" />
            : <div className="relative max-w-3xl w-full">
                <CardHtml
                  html={isImageOcclusion && showAnswer ? answerHtml : questionHtml}
                  align={questionIsSimple ? "center" : "left"}
                  revealOcclusion={isImageOcclusion && ioRevealAll}
                />
                {/* Eye button — reveal all remaining masks */}
                {isImageOcclusion && showAnswer && (
                  <button
                    onClick={() => setIoRevealAll((v) => !v)}
                    title={ioRevealAll ? "Masquer les caches" : "Tout révéler"}
                    className={`absolute bottom-2 right-2 p-1.5 rounded-full transition-colors
                      ${ioRevealAll
                        ? "bg-blue-500/30 text-blue-300 hover:bg-blue-500/50"
                        : "bg-zinc-700/80 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200"}`}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </div>
          }
        </div>

        {/* Separator + Answer text — not shown for IO occlusion (reveal is inline above) */}
        {showAnswer && !isImageOcclusion && (
          <>
            <div className="h-px bg-white/[.08] shrink-0" />
            <div className="flex justify-center overflow-auto pt-6 px-16 pb-4 max-h-[45vh]">
              <div className="max-w-3xl w-full">
                <CardHtml html={answerHtml} align="left" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-white/[.06]">
        {/* Counts */}
        <div className="flex justify-center items-center gap-1.5 pt-2 pb-1 text-sm font-semibold">
          <span className="text-red-400 tabular-nums">{newCount}</span>
          <span className="text-zinc-600">+</span>
          <span className="text-orange-400 tabular-nums">{learnCount}</span>
          <span className="text-zinc-600">+</span>
          <span className="text-green-400 tabular-nums">{dueCount}</span>
        </div>

        {!showAnswer ? (
          /* ─ Question side ─ */
          <div className="flex items-center justify-between px-8 pb-4 pt-1">
            <AnkiPill onClick={() => setEditOpen(true)}>Modifier</AnkiPill>

            <AnkiPill onClick={onShowAnswer} disabled={mediaLoading}
              className="px-8 text-zinc-100 bg-zinc-600/80 hover:bg-zinc-500/80">
              Afficher la réponse
            </AnkiPill>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span><AnkiPill>Autres choix <ChevronDown className="h-3.5 w-3.5" /></AnkiPill></span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onBury}>Ignorer pour cette session</DropdownMenuItem>
                {onUndo && <DropdownMenuItem onClick={onUndo}>Annuler (⌘Z)</DropdownMenuItem>}
                <DropdownMenuItem onClick={onBack}>Changer de paquet</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          /* ─ Answer side ─ */
          <div className="flex items-center justify-between px-8 pb-4 pt-1 gap-4">
            <AnkiPill onClick={() => setEditOpen(true)} className="text-xs px-3 shrink-0">
              Modifier
            </AnkiPill>

            {/* Intervals + rating buttons, centered */}
            <div className="flex flex-col items-center gap-1.5">
              {/* Interval row */}
              <div className="flex gap-2">
                {ratings.map(({ ease }, idx) => (
                  <span key={ease} className="text-xs text-zinc-400 tabular-nums text-center w-[4.5rem]">
                    {loadingIntervals ? "…" : fmtInterval(intervals[idx])}
                  </span>
                ))}
              </div>
              {/* Button row */}
              <div className="flex gap-2">
                {ratings.map(({ ease, label, col }) => (
                  <button
                    key={ease}
                    onClick={() => onAnswer(ease)}
                    disabled={answering}
                    className={`w-[4.5rem] py-1.5 rounded-full text-sm font-medium ${col}
                      bg-zinc-700/80 hover:bg-zinc-600/80 active:bg-zinc-500/80
                      disabled:opacity-40 transition-colors`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span><AnkiPill className="text-xs px-3 shrink-0">Autres choix <ChevronDown className="h-3 w-3" /></AnkiPill></span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onBury}>Ignorer pour cette session</DropdownMenuItem>
                {onUndo && <DropdownMenuItem onClick={onUndo}>Annuler (⌘Z)</DropdownMenuItem>}
                <DropdownMenuItem onClick={onBack}>Changer de paquet</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier la carte</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Recto</Label>
              <Textarea value={editQ} onChange={(e) => setEditQ(e.target.value)} rows={3} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Verso</Label>
              <Textarea value={editA} onChange={(e) => setEditA(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={() => void saveEdit()} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
