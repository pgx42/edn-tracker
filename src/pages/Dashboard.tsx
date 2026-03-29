import { FileText, List, AlertCircle, BookOpen, CheckCircle, Calendar, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/StatsCard";
import { CoverageHeatmap } from "@/components/CoverageHeatmap";
import { SpecialtyRadar } from "@/components/SpecialtyRadar";
import { mockItems, mockErrors, mockPdfs } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const masteredItems = mockItems.filter((i) => i.status === "mastered");
const inProgressItems = mockItems.filter((i) => i.status === "in_progress");
const openErrors = mockErrors.filter((e) => !e.resolved);
const completionPct = Math.round((masteredItems.length / mockItems.length) * 100);

const problematicItems = mockItems
  .filter((i) => i.linkedErrorIds && i.linkedErrorIds.length > 0)
  .sort((a, b) => (b.linkedErrorIds?.length ?? 0) - (a.linkedErrorIds?.length ?? 0))
  .slice(0, 5);

const recentErrors = mockErrors.slice(0, 5);
const recentPdfs = mockPdfs.slice(0, 5);

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
  return (
    <div className="p-6 space-y-6">
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
          value={mockItems.length}
          icon={List}
          iconColor="text-blue-400"
          subtitle="sur 362 EDN"
        />
        <StatsCard
          label="Complétés"
          value={`${completionPct}%`}
          icon={CheckCircle}
          iconColor="text-green-400"
          change={8}
          subtitle="ce mois"
        />
        <StatsCard
          label="Erreurs ouvertes"
          value={openErrors.length}
          icon={AlertCircle}
          iconColor="text-red-400"
          change={-3}
          subtitle="vs semaine passée"
        />
        <StatsCard
          label="PDFs importés"
          value={mockPdfs.length}
          icon={FileText}
          iconColor="text-purple-400"
          subtitle={`${mockPdfs.filter((p) => p.processed).length} traités`}
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
          label="Étudiés aujourd'hui"
          value="4"
          icon={BookOpen}
          iconColor="text-cyan-400"
          subtitle="items"
        />
        <StatsCard
          label="Dernière session"
          value="Hier"
          icon={Calendar}
          iconColor="text-orange-400"
          subtitle="120 min"
        />
      </div>

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
                      {item.linkedErrorIds?.length} erreur{(item.linkedErrorIds?.length ?? 0) > 1 ? "s" : ""}
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
              Derniers PDFs ouverts
            </p>
            {recentPdfs.map((pdf) => (
              <div key={pdf.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                <FileText className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="text-sm truncate">{pdf.filename}</span>
                <Badge variant="secondary" className="text-xs ml-auto shrink-0">
                  {pdf.docType}
                </Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-4 mb-2">
              Dernières erreurs
            </p>
            {recentErrors.map((err) => (
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
