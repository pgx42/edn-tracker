import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, WifiOff, BookOpen, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeckReviewStats {
  deck_id: string;
  deck_name: string;
  new_count: number;
  learn_count: number;
  review_count: number;
  total_in_deck: number;
}

interface Props {
  selectedDeckName: string | null; // null = afficher les stats globales
  ankiConnectAvailable: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DeckStatsCard({ stats }: { stats: DeckReviewStats }) {
  const total = stats.new_count + stats.learn_count + stats.review_count;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Deck name */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight break-all">
          {stats.deck_name.split("::").pop()}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {stats.total_in_deck} cartes
        </span>
      </div>

      {/* A réviser aujourd'hui */}
      {total > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            À réviser aujourd'hui
          </p>
          <StatBar
            label="Nouvelles"
            value={stats.new_count}
            total={total}
            colorClass="bg-blue-500"
          />
          <StatBar
            label="Apprentissage"
            value={stats.learn_count}
            total={total}
            colorClass="bg-orange-500"
          />
          <StatBar
            label="Révision"
            value={stats.review_count}
            total={total}
            colorClass="bg-green-500"
          />
          {/* Summary badge */}
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            {stats.new_count > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                {stats.new_count} nouv.
              </span>
            )}
            {stats.learn_count > 0 && (
              <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500">
                {stats.learn_count} appr.
              </span>
            )}
            {stats.review_count > 0 && (
              <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                {stats.review_count} rév.
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Aucune carte à réviser aujourd'hui</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnkiDeckStatsPanel({ selectedDeckName, ankiConnectAvailable }: Props) {
  const [stats, setStats] = React.useState<DeckReviewStats[]>([]);
  const [reviewsToday, setReviewsToday] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadStats = React.useCallback(async () => {
    if (!ankiConnectAvailable) return;
    setIsLoading(true);
    setError(null);
    try {
      const [today, deckStats] = await Promise.all([
        invoke<number>("anki_get_reviews_today").catch(() => 0),
        selectedDeckName
          ? invoke<DeckReviewStats[]>("anki_get_deck_review_stats", {
              deckNames: [selectedDeckName],
            })
          : invoke<DeckReviewStats[]>("anki_get_deck_review_stats", {
              deckNames: [] as string[],
            }).catch(async () => {
              // Fallback: pass an empty list - AnkiConnect may return all decks
              // If that fails, return empty array
              return [] as DeckReviewStats[];
            }),
      ]);
      setReviewsToday(today);
      setStats(deckStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeckName, ankiConnectAvailable]);

  React.useEffect(() => {
    if (!ankiConnectAvailable) return;
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats, selectedDeckName, ankiConnectAvailable]);

  // ── Placeholder when AnkiConnect is unavailable ───────────────────────────
  if (!ankiConnectAvailable) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6 text-center">
        <WifiOff className="h-10 w-10 opacity-20" />
        <p className="text-sm font-medium">AnkiConnect requis pour les statistiques</p>
        <p className="text-xs opacity-60">
          Ouvrez Anki et activez le plugin AnkiConnect (port 8765)
        </p>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading && stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin opacity-40" />
        <p className="text-sm">Chargement des statistiques...</p>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error && stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6 text-center">
        <BarChart2 className="h-10 w-10 opacity-20" />
        <p className="text-sm">Impossible de charger les statistiques</p>
        <p className="text-xs opacity-60">{error}</p>
        <button
          onClick={loadStats}
          className="mt-1 text-xs underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!isLoading && stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6 text-center">
        <BookOpen className="h-10 w-10 opacity-20" />
        <p className="text-sm">
          {selectedDeckName
            ? `Aucune statistique pour « ${selectedDeckName.split("::").pop()} »`
            : "Aucun paquet trouvé"}
        </p>
      </div>
    );
  }

  // ── Main content ──────────────────────────────────────────────────────────
  const totalToReview = stats.reduce(
    (acc, s) => acc + s.new_count + s.learn_count + s.review_count,
    0
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b bg-card/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              {selectedDeckName ? selectedDeckName.split("::").pop() : "Statistiques globales"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {reviewsToday > 0 ? (
                <>
                  <span className="font-medium text-foreground">{reviewsToday}</span> carte
                  {reviewsToday !== 1 ? "s" : ""} révisée{reviewsToday !== 1 ? "s" : ""} aujourd'hui
                </>
              ) : (
                "Aucune révision aujourd'hui"
              )}
            </p>
          </div>
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
            title="Actualiser"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </button>
        </div>

        {/* Today's summary bar */}
        {totalToReview > 0 && (
          <div className="mt-3 rounded-lg border p-3 bg-muted/30 space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Total à réviser
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
                {stats.reduce((acc, s) => acc + s.new_count, 0) > 0 && (
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${(stats.reduce((a, s) => a + s.new_count, 0) / totalToReview) * 100}%`,
                    }}
                  />
                )}
                {stats.reduce((acc, s) => acc + s.learn_count, 0) > 0 && (
                  <div
                    className="h-full bg-orange-500"
                    style={{
                      width: `${(stats.reduce((a, s) => a + s.learn_count, 0) / totalToReview) * 100}%`,
                    }}
                  />
                )}
                {stats.reduce((acc, s) => acc + s.review_count, 0) > 0 && (
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${(stats.reduce((a, s) => a + s.review_count, 0) / totalToReview) * 100}%`,
                    }}
                  />
                )}
              </div>
              <span className="text-xs font-semibold tabular-nums shrink-0">{totalToReview}</span>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                {stats.reduce((a, s) => a + s.new_count, 0)} nouv.
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                {stats.reduce((a, s) => a + s.learn_count, 0)} appr.
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                {stats.reduce((a, s) => a + s.review_count, 0)} rév.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Deck list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {stats
          .slice()
          .sort((a, b) => {
            const ta = a.new_count + a.learn_count + a.review_count;
            const tb = b.new_count + b.learn_count + b.review_count;
            return tb - ta;
          })
          .map((s) => (
            <DeckStatsCard key={s.deck_id} stats={s} />
          ))}
      </div>
    </div>
  );
}
