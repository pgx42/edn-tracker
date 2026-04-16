import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Plus, CheckCircle, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ErrorCreationModal } from "@/components/ErrorCreationModal";
import type { ErrorEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const severityConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  minor: { label: "Mineure", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: AlertCircle },
  medium: { label: "Modérée", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertTriangle },
  critical: { label: "Critique", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertCircle },
};

const errorTypeLabels: Record<string, string> = {
  concept_confusion: "Confusion conceptuelle",
  knowledge_gap: "Lacune de connaissance",
  calculation: "Erreur de calcul",
  recall: "Erreur de mémorisation",
};

export function Errors() {
  const [errors, setErrors] = React.useState<ErrorEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [severityFilter, setSeverityFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all"); // "all" | "annale" | "manual"
  const [selectedError, setSelectedError] = React.useState<ErrorEntry | null>(null);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // Load errors from backend
  React.useEffect(() => {
    const loadErrors = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await invoke<ErrorEntry[]>("list_errors");
        setErrors(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };
    loadErrors();
  }, []);

  const filtered = React.useMemo(() => {
    return errors.filter((err) => {
      const q = search.toLowerCase();
      const descText = err.description ?? "";
      const matchSearch = !q || err.title.toLowerCase().includes(q) || descText.toLowerCase().includes(q);
      const matchType = typeFilter === "all" || err.error_type === typeFilter;
      const matchSeverity = severityFilter === "all" || err.severity === severityFilter;
      const isResolved = err.resolved_at !== null;
      const matchStatus = statusFilter === "all"
        ? true
        : statusFilter === "open" ? !isResolved : isResolved;
      const matchSource = sourceFilter === "all"
        ? true
        : sourceFilter === "annale" ? !!(err as any).annale_session_id : !(err as any).annale_session_id;
      return matchSearch && matchType && matchSeverity && matchStatus && matchSource;
    });
  }, [errors, search, typeFilter, severityFilter, statusFilter, sourceFilter]);

  const openCount = errors.filter((e) => e.resolved_at === null).length;
  const criticalCount = errors.filter((e) => e.severity === "critical" && e.resolved_at === null).length;

  const handleResolve = async (id: string) => {
    try {
      const current = errors.find((e) => e.id === id);
      if (!current) return;
      const isResolved = current.resolved_at !== null;
      const updated = await invoke<ErrorEntry>("update_error", {
        id,
        resolved: !isResolved,
      });
      setErrors((prev) => prev.map((e) => e.id === id ? updated : e));
      if (selectedError?.id === id) {
        setSelectedError(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreate = async (err: { title: string; description: string; error_type: string; severity: string; item_id?: number | null }) => {
    try {
      const newErr = await invoke<ErrorEntry>("create_error", {
        title: err.title,
        description: err.description,
        error_type: err.error_type,
        severity: err.severity,
        item_id: err.item_id || null,
      });
      setErrors((prev) => [newErr, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: list */}
      <div className="flex flex-col w-full lg:w-[420px] shrink-0 border-r overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b bg-card/50 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Carnet d'erreurs</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="text-red-400 font-medium">{openCount} ouvertes</span>
                {criticalCount > 0 && (
                  <span className="text-red-400 font-medium"> · {criticalCount} critiques</span>
                )}
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nouvelle
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9 h-8 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Sévérité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="minor">Mineure</SelectItem>
                <SelectItem value="medium">Modérée</SelectItem>
                <SelectItem value="critical">Critique</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="concept_confusion">Confusion</SelectItem>
                <SelectItem value="knowledge_gap">Lacune</SelectItem>
                <SelectItem value="calculation">Calcul</SelectItem>
                <SelectItem value="recall">Mémorisation</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="open">Ouverts</SelectItem>
                <SelectItem value="resolved">Résolus</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sources</SelectItem>
                <SelectItem value="annale">Annales</SelectItem>
                <SelectItem value="manual">Manuelles</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Chargement des erreurs...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-red-400">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">Aucune erreur trouvée</p>
            </div>
          ) : (
            filtered.map((err) => {
              const sev = severityConfig[err.severity];
              const SevIcon = sev.icon;
              const isSelected = selectedError?.id === err.id;
              return (
                <div
                  key={err.id}
                  onClick={() => setSelectedError(isSelected ? null : err)}
                  className={cn(
                    "p-3 border-b cursor-pointer hover:bg-accent/50 transition-colors",
                    isSelected && "bg-accent"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <SevIcon className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      err.severity === "critical" ? "text-red-400" :
                      err.severity === "medium" ? "text-yellow-400" : "text-blue-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 justify-between">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          err.resolved_at !== null && "line-through text-muted-foreground"
                        )}>
                          {err.title}
                        </p>
                        {err.resolved_at !== null && <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={cn("border text-xs py-0", sev.color)}>
                          {sev.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {errorTypeLabels[err.error_type]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {err.created_at ? new Date(err.created_at).toLocaleDateString("fr-FR") : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel: detail */}
      <div className="flex-1 hidden lg:flex flex-col overflow-y-auto">
        {selectedError ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{selectedError.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedError.created_at ? new Date(selectedError.created_at).toLocaleDateString("fr-FR") : ""}
                </p>
              </div>
              <Button
                variant={selectedError.resolved_at !== null ? "outline" : "default"}
                size="sm"
                onClick={() => handleResolve(selectedError.id)}
                className="gap-1.5 shrink-0"
              >
                <CheckCircle className="h-4 w-4" />
                {selectedError.resolved_at !== null ? "Ré-ouvrir" : "Marquer résolu"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={cn("border", severityConfig[selectedError.severity].color)}>
                {severityConfig[selectedError.severity].label}
              </Badge>
              <Badge variant="secondary">
                {errorTypeLabels[selectedError.error_type]}
              </Badge>
              {selectedError.resolved_at !== null && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
                  Résolu
                </Badge>
              )}
            </div>

            <Separator />

            {selectedError.description && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedError.description}</p>
              </div>
            )}

            {selectedError.item_id && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Références</h3>
                <div className="flex gap-2">
                  <Badge variant="outline">Item #{selectedError.item_id}</Badge>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <AlertCircle className="h-12 w-12 opacity-20" />
            <p className="text-sm">Sélectionnez une erreur pour voir les détails</p>
          </div>
        )}
      </div>

      <ErrorCreationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
