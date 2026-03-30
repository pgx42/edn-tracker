import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink, Trash2, Loader2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useNavigateToResource,
  type ResourceType,
} from "@/hooks/useNavigateToResource";

// ─── Types mirroring the Tauri Link struct ────────────────────────────────────

export interface TauriLink {
  id: string;
  source_anchor_id: string;
  target_anchor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  link_type: string;
  bidirectional: boolean | null;
  created_by: string | null;
  created_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const linkTypeLabels: Record<string, string> = {
  related: "Lié à",
  definition: "Définition",
  example: "Exemple",
  counterexample: "Contre-exemple",
  comparison: "Comparaison",
  mechanism: "Mécanisme",
};

const targetTypeLabels: Record<string, string> = {
  pdf: "PDF",
  item: "Item EDN",
  error: "Erreur",
  anki_card: "Anki",
  excalidraw: "Schéma",
};

const targetTypeColors: Record<string, string> = {
  pdf: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  item: "bg-green-500/20 text-green-400 border-green-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  anki_card: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  excalidraw: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface LinkNavigatorProps {
  /** The anchor whose links we display. Pass null to render empty state. */
  anchorId: string | null;
  /** Direction to show: "outgoing", "incoming", or "both" */
  direction?: "outgoing" | "incoming" | "both";
  /** Called when a link is deleted so the parent can refresh */
  onLinkDeleted?: (linkId: string) => void;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LinkNavigator: React.FC<LinkNavigatorProps> = ({
  anchorId,
  direction = "both",
  onLinkDeleted,
  className,
}) => {
  const [links, setLinks] = React.useState<TauriLink[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const navigateTo = useNavigateToResource();

  // Load links whenever anchorId changes
  React.useEffect(() => {
    if (!anchorId) {
      setLinks([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    invoke<TauriLink[]>("get_links", { anchorId, direction })
      .then((data) => {
        if (!cancelled) setLinks(data);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anchorId, direction]);

  const handleNavigate = (link: TauriLink) => {
    const type = (link.target_type ?? "pdf") as ResourceType;
    const id = link.target_id ?? "";
    if (id) {
      navigateTo({ type, id });
    }
  };

  const handleDelete = async (linkId: string) => {
    setDeletingId(linkId);
    try {
      await invoke<boolean>("delete_link", { id: linkId });
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      onLinkDeleted?.(linkId);
    } catch {
      // Silently fail; in production we'd surface this
    } finally {
      setDeletingId(null);
    }
  };

  if (!anchorId) {
    return null;
  }

  return (
    <div className={cn("space-y-1", className)}>
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Chargement des liens…</span>
        </div>
      ) : links.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground py-2">
          <Link2Off className="h-3.5 w-3.5" />
          <span className="text-xs">Aucun lien pour cet ancre</span>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1">
            {links.length} lien{links.length !== 1 ? "s" : ""}
          </p>
          <Separator className="mb-2" />
          {links.map((link) => {
            const tType = link.target_type ?? "pdf";
            const typeLabel = targetTypeLabels[tType] ?? tType;
            const typeColor = targetTypeColors[tType] ?? "";
            const ltLabel = linkTypeLabels[link.link_type] ?? link.link_type;

            return (
              <div
                key={link.id}
                className="flex items-center gap-2 p-2 rounded-md border hover:bg-accent/50 group"
              >
                <Badge
                  variant="outline"
                  className={cn("text-xs shrink-0 border", typeColor)}
                >
                  {typeLabel}
                </Badge>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="font-medium text-foreground">{ltLabel}</span>
                    {link.target_id && (
                      <span className="ml-1 opacity-60">#{link.target_id}</span>
                    )}
                  </p>
                  {link.created_at && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {new Date(link.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleNavigate(link)}
                    title="Naviguer vers la ressource"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(link.id)}
                    disabled={deletingId === link.id}
                    title="Supprimer ce lien"
                  >
                    {deletingId === link.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default LinkNavigator;
