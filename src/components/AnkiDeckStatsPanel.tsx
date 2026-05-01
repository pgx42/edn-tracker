import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, WifiOff, BookOpen } from "lucide-react";
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

interface LocalAnkiStats {
  total_cards: number;
  new_count: number;
  learning_count: number;
  review_count: number;
  mature_count: number;
  young_count: number;
  avg_ease: number;
  avg_interval: number;
  retention_rate: number;
  due_forecast: number[];
}

interface Props {
  selectedDeckName: string | null;
  ankiConnectAvailable: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3 space-y-0.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold tabular-nums leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

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
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight break-all">
          {stats.deck_name.split("::").pop()}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {stats.total_in_deck} cartes
        </span>
      </div>
      {total > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            À réviser aujourd'hui
          </p>
          <StatBar label="Nouvelles" value={stats.new_count} total={total} colorClass="bg-blue-500" />
          <StatBar label="Apprentissage" value={stats.learn_count} total={total} colorClass="bg-orange-500" />
          <StatBar label="Révision" value={stats.review_count} total={total} colorClass="bg-green-500" />
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

function MaturityBar({ local }: { local: LocalAnkiStats }) {
  const total = local.total_cards;
  if (total === 0) return null;

  const newPct = Math.round((local.new_count / total) * 100);
  const youngPct = Math.round((local.young_count / total) * 100);
  const maturePct = Math.round((local.mature_count / total) * 100);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Maturité des cartes
      </p>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
        {newPct > 0 && <div className="h-full bg-blue-500" style={{ width: `${newPct}%` }} />}
        {youngPct > 0 && <div className="h-full bg-orange-400" style={{ width: `${youngPct}%` }} />}
        {maturePct > 0 && <div className="h-full bg-emerald-500" style={{ width: `${maturePct}%` }} />}
      </div>
      <div className="grid grid-cols-3 gap-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          <span className="text-muted-foreground truncate">Nouv. </span>
          <span className="font-medium tabular-nums ml-auto">{local.new_count}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-400 shrink-0" />
          <span className="text-muted-foreground truncate">Jeunes</span>
          <span className="font-medium tabular-nums ml-auto">{local.young_count}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-muted-foreground truncate">Matures</span>
          <span className="font-medium tabular-nums ml-auto">{local.mature_count}</span>
        </div>
      </div>
    </div>
  );
}

function DueForecastChart({ forecast }: { forecast: number[] }) {
  const max = Math.max(...forecast, 1);
  const days = ["Auj.", "D+1", "D+2", "D+3", "D+4", "D+5", "D+6"];

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Prévision — 7 prochains jours
      </p>
      <div className="flex items-end gap-1 h-16">
        {forecast.map((count, i) => {
          const heightPct = max > 0 ? (count / max) * 100 : 0;
          const isToday = i === 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground tabular-nums leading-none">
                {count > 0 ? count : ""}
              </span>
              <div className="w-full flex items-end" style={{ height: "40px" }}>
                <div
                  className={cn(
                    "w-full rounded-sm transition-all duration-500",
                    isToday ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                  style={{ height: `${Math.max(heightPct, count > 0 ? 8 : 2)}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-[9px] leading-none",
                  isToday ? "text-primary font-semibold" : "text-muted-foreground"
                )}
              >
                {days[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnkiDeckStatsPanel({ selectedDeckName, ankiConnectAvailable }: Props) {
  const [deckStats, setDeckStats] = React.useState<DeckReviewStats[]>([]);
  const [reviewsToday, setReviewsToday] = React.useState<number>(0);
  const [local, setLocal] = React.useState<LocalAnkiStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadStats = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Local stats always available
      const localStats = await invoke<LocalAnkiStats>("anki_get_local_stats", {
        deckName: selectedDeckName,
      }).catch(() => null);
      setLocal(localStats);

      if (ankiConnectAvailable) {
        const [today, ds] = await Promise.all([
          invoke<number>("anki_get_reviews_today").catch(() => 0),
          selectedDeckName
            ? invoke<DeckReviewStats[]>("anki_get_deck_review_stats", { deckNames: [selectedDeckName] })
            : invoke<DeckReviewStats[]>("anki_get_deck_review_stats", { deckNames: [] as string[] }).catch(() => [] as DeckReviewStats[]),
        ]);
        setReviewsToday(today);
        setDeckStats(ds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeckName, ankiConnectAvailable]);

  React.useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading && !local && deckStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin opacity-40" />
        <p className="text-sm">Chargement des statistiques...</p>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  const hasAnyData = local !== null || deckStats.length > 0;
  if (!isLoading && !hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6 text-center">
        <BookOpen className="h-10 w-10 opacity-20" />
        <p className="text-sm">Aucune donnée disponible</p>
        <p className="text-xs opacity-60">
          {ankiConnectAvailable
            ? "Synchronisez vos cartes depuis Anki"
            : "Lancez une sync locale pour voir les statistiques"}
        </p>
      </div>
    );
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const totalToReview = deckStats.reduce(
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
              {selectedDeckName ? selectedDeckName.split("::").pop() : "Statistiques"}
            </h2>
            {ankiConnectAvailable ? (
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
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Mode hors-ligne
              </p>
            )}
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

        {/* Today's queue (AnkiConnect) */}
        {ankiConnectAvailable && totalToReview > 0 && (
          <div className="mt-3 rounded-lg border p-3 bg-muted/30 space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Total à réviser
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
                {deckStats.reduce((a, s) => a + s.new_count, 0) > 0 && (
                  <div className="h-full bg-blue-500" style={{ width: `${(deckStats.reduce((a, s) => a + s.new_count, 0) / totalToReview) * 100}%` }} />
                )}
                {deckStats.reduce((a, s) => a + s.learn_count, 0) > 0 && (
                  <div className="h-full bg-orange-500" style={{ width: `${(deckStats.reduce((a, s) => a + s.learn_count, 0) / totalToReview) * 100}%` }} />
                )}
                {deckStats.reduce((a, s) => a + s.review_count, 0) > 0 && (
                  <div className="h-full bg-green-500" style={{ width: `${(deckStats.reduce((a, s) => a + s.review_count, 0) / totalToReview) * 100}%` }} />
                )}
              </div>
              <span className="text-xs font-semibold tabular-nums shrink-0">{totalToReview}</span>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                {deckStats.reduce((a, s) => a + s.new_count, 0)} nouv.
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                {deckStats.reduce((a, s) => a + s.learn_count, 0)} appr.
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                {deckStats.reduce((a, s) => a + s.review_count, 0)} rév.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* KPIs */}
        {local && local.total_cards > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <KpiCard
              label="Total (local)"
              value={local.total_cards.toString()}
              sub={`${local.new_count} nouv. · ${local.learning_count} appr.`}
            />
            <KpiCard
              label="Rétention"
              value={`${Math.round(local.retention_rate * 100)}%`}
              sub={local.retention_rate > 0 ? "moyenne" : "aucune donnée"}
            />
            <KpiCard
              label="Ease moyen"
              value={local.avg_ease > 0 ? local.avg_ease.toFixed(2) : "—"}
              sub="facteur de difficulté"
            />
            <KpiCard
              label="Intervalle moyen"
              value={local.avg_interval > 0 ? `${Math.round(local.avg_interval)}j` : "—"}
              sub="cartes en révision"
            />
          </div>
        )}

        {/* Maturity */}
        {local && local.total_cards > 0 && <MaturityBar local={local} />}

        {/* Due forecast */}
        {local && local.due_forecast.some((v) => v > 0) && (
          <DueForecastChart forecast={local.due_forecast} />
        )}

        {/* Per-deck breakdown (AnkiConnect) */}
        {ankiConnectAvailable && deckStats.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-0.5">
              Par paquet
            </p>
            {deckStats
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
        )}

        {/* No local data nudge */}
        {local && local.total_cards === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-center space-y-1">
            <p className="text-xs text-muted-foreground">Aucune donnée locale</p>
            <p className="text-[11px] text-muted-foreground/60">
              {ankiConnectAvailable
                ? "Lancez « Sync locale » depuis la page d'étude"
                : "Connectez AnkiConnect ou effectuez une sync locale"}
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 px-0.5">{error}</p>
        )}
      </div>
    </div>
  );
}
