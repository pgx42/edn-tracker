import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, List, AlertCircle, BookOpen, CheckCircle, Calendar, TrendingUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/StatsCard";
import { CoverageHeatmap } from "@/components/CoverageHeatmap";
import { SpecialtyRadar } from "@/components/SpecialtyRadar";
import { DueItemsWidget } from "@/components/DueItemsWidget";
import { cn } from "@/lib/utils";

interface DashboardItem {
  id: number;
  code: string;
  title: string;
  rank: string;
  status: string | null;
  specialty_id: string;
  specialty_ids: string | null;
}

interface DashboardError {
  id: string;
  title: string;
  item_id: number | null;
  error_type: string;
  severity: string;
  created_at: string | null;
  resolved_at: string | null;
}

interface DashboardPdf {
  id: string;
  title: string;
  doc_type: string | null;
  num_pages: number;
  created_at: string | null;
}

const rankColors: Record<string, string> = {
  A: "bg-red-500/20 text-red-400 border-red-500/30",
  B: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  C: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const severityColors: Record<string, string> = {
  minor: "bg-blue-500/20 text-blue-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  critical: "bg-red-500/20 text-red-400",
};

export function Dashboard() {
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [errors, setErrors] = useState<DashboardError[]>([]);
  const [pdfs, setPdfs] = useState<DashboardPdf[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [loadedItems, loadedErrors, loadedPdfs] = await Promise.all([
          invoke<DashboardItem[]>("get_items", {}),
          invoke<DashboardError[]>("list_errors", {}),
          invoke<DashboardPdf[]>("list_pdfs", {}),
        ]);
        setItems(loadedItems);
        setErrors(loadedErrors);
        setPdfs(loadedPdfs);
      } catch {
        // silently fall back to empty arrays
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const masteredItems = useMemo(() => items.filter((i) => i.status === "mastered"), [items]);
  const inProgressItems = useMemo(() => items.filter((i) => i.status === "in_progress"), [items]);
  const openErrors = useMemo(() => errors.filter((e) => !e.resolved_at), [errors]);
  const completionPct = useMemo(
    () => (items.length > 0 ? Math.round((masteredItems.length / items.length) * 100) : 0),
    [items, masteredItems]
  );

  // Items with most errors
  const problematicItems = useMemo(() => {
    const errorCountMap = new Map<number, number>();
    for (const err of errors) {
      if (err.item_id != null) {
        errorCountMap.set(err.item_id, (errorCountMap.get(err.item_id) ?? 0) + 1);
      }
    }
    return items
      .filter((i) => (errorCountMap.get(i.id) ?? 0) > 0)
      .map((i) => ({ ...i, errorCount: errorCountMap.get(i.id) ?? 0 }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 5);
  }, [items, errors]);

  const recentErrors = useMemo(() => [...errors].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  ).slice(0, 5), [errors]);

  const recentPdfs = useMemo(() => [...pdfs].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  ).slice(0, 5), [pdfs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vue d'ensemble de votre progression EDN
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Items totaux"
          value={items.length}
          icon={List}
          iconColor="text-blue-400"
          subtitle="sur 362 EDN"
        />
        <StatsCard
          label="Progression"
          value={`${completionPct}%`}
          icon={CheckCircle}
          iconColor="text-green-400"
          subtitle={`${masteredItems.length} maîtrisés`}
        />
        <StatsCard
          label="Erreurs ouvertes"
          value={openErrors.length}
          icon={AlertCircle}
          iconColor="text-red-400"
          subtitle={`${errors.length} total`}
        />
        <StatsCard
          label="PDFs importés"
          value={pdfs.length}
          icon={FileText}
          iconColor="text-purple-400"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="En cours"
          value={inProgressItems.length}
          icon={TrendingUp}
          iconColor="text-yellow-400"
        />
        <StatsCard
          label="Maîtrisés"
          value={masteredItems.length}
          icon={CheckCircle}
          iconColor="text-green-400"
        />
        <StatsCard
          label="Non commencés"
          value={items.filter((i) => !i.status || i.status === "not_started").length}
          icon={BookOpen}
          iconColor="text-cyan-400"
          subtitle="items"
        />
        <StatsCard
          label="Spécialités"
          value={new Set(items.map((i) => i.specialty_id)).size}
          icon={Calendar}
          iconColor="text-orange-400"
          subtitle="actives"
        />
      </div>

      {/* J-Method widget */}
      <DueItemsWidget />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap */}
        <div className="lg:col-span-2 rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sm">Activité de révision</h2>
              <p className="text-xs text-muted-foreground">12 derniers mois</p>
            </div>
            <Badge variant="secondary">365 jours</Badge>
          </div>
          <CoverageHeatmap />
        </div>

        {/* Radar */}
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-sm">Maîtrise par spécialité</h2>
            <p className="text-xs text-muted-foreground">Score de couverture estimé</p>
          </div>
          <SpecialtyRadar />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Problematic items */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Items les plus problématiques</h2>
            <Badge variant="secondary">{problematicItems.length} items</Badge>
          </div>
          {problematicItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun item problématique</p>
          ) : (
            <div className="space-y-2">
              {problematicItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.code}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Badge className={cn("border text-xs", rankColors[item.rank])}>
                      {item.rank}
                    </Badge>
                    <span className="text-xs text-red-400">
                      {item.errorCount} erreur{item.errorCount > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold text-sm mb-4">Activité récente</h2>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
              Derniers PDFs importés
            </p>
            {recentPdfs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun PDF importé</p>
            ) : (
              recentPdfs.map((pdf) => (
                <div key={pdf.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                  <FileText className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span className="text-sm truncate">{pdf.title}</span>
                  {pdf.doc_type && (
                    <Badge variant="secondary" className="text-xs ml-auto shrink-0">
                      {pdf.doc_type}
                    </Badge>
                  )}
                </div>
              ))
            )}
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-4 mb-2">
              Dernières erreurs
            </p>
            {recentErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune erreur enregistrée</p>
            ) : (
              recentErrors.map((err) => (
                <div key={err.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                  <AlertCircle className={cn("h-3.5 w-3.5 shrink-0",
                    err.severity === "critical" ? "text-red-400" :
                    err.severity === "medium" ? "text-yellow-400" : "text-blue-400"
                  )} />
                  <span className="text-sm truncate">{err.title}</span>
                  <Badge className={cn("text-xs ml-auto shrink-0 border-0", severityColors[err.severity])}>
                    {err.severity}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
