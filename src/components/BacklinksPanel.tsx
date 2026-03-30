import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  BookOpen,
  AlertTriangle,
  CreditCard,
  PenTool,
  Loader2,
  Trash2,
  Link2,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { useNavigateToResource, type ResourceType as NavResourceType } from "@/hooks/useNavigateToResource";
import type { Anchor } from "./pdf-viewer/AnchorCreationModal";

export interface BackLink {
  id: number;
  source_resource_type: string;
  source_resource_id: number;
  source_resource_name: string;
  target_resource_type: string;
  target_resource_id: number;
  target_resource_name: string;
  link_type: string;
  created_at: string;
}

interface BacklinksPanelProps {
  pdfId: string | null;
  pageNumber: number;
  /** Called when user clicks a link to navigate */
  onNavigate?: (link: BackLink) => void;
}

type ResourceType = "pdf" | "item" | "error" | "anki" | "diagram" | "unknown";

const RESOURCE_META: Record<
  ResourceType,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  pdf: { label: "PDFs", icon: FileText, colorClass: "text-blue-400" },
  item: { label: "Items EDN", icon: BookOpen, colorClass: "text-green-400" },
  error: { label: "Erreurs", icon: AlertTriangle, colorClass: "text-red-400" },
  anki: { label: "Anki", icon: CreditCard, colorClass: "text-purple-400" },
  diagram: { label: "Diagrammes", icon: PenTool, colorClass: "text-orange-400" },
  unknown: { label: "Autres", icon: Link2, colorClass: "text-muted-foreground" },
};

function resourceType(raw: string): ResourceType {
  const lower = raw.toLowerCase();
  if (lower === "pdf") return "pdf";
  if (lower === "item" || lower === "edn_item") return "item";
  if (lower === "error" || lower === "error_entry") return "error";
  if (lower === "anki" || lower === "anki_card") return "anki";
  if (lower === "diagram" || lower === "excalidraw") return "diagram";
  return "unknown";
}

function linkTypeBadgeVariant(linkType: string): "default" | "secondary" | "outline" {
  if (linkType === "definition") return "default";
  if (linkType === "related") return "secondary";
  return "outline";
}

const LINK_TYPE_LABELS: Record<string, string> = {
  definition: "Définition",
  related: "Lié",
  example: "Exemple",
  reference: "Référence",
  source: "Source",
};

function formatLinkType(t: string) {
  return LINK_TYPE_LABELS[t] ?? t;
}

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  pdfId,
  pageNumber,
  onNavigate,
}) => {
  const [links, setLinks] = React.useState<BackLink[]>([]);
  const [anchors, setAnchors] = React.useState<Anchor[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<BackLink | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const navigateTo = useNavigateToResource();

  const fetchLinks = React.useCallback(async () => {
    if (pdfId === null) {
      setLinks([]);
      setAnchors([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [linksResult, anchorsResult] = await Promise.all([
        invoke<BackLink[]>("get_backlinks", {
          pdf_id: pdfId,
          page: pageNumber,
        }),
        invoke<Anchor[]>("list_anchors", {
          pdfId,
          page: pageNumber,
        }),
      ]);
      setLinks(linksResult);
      setAnchors(anchorsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [pdfId, pageNumber]);

  React.useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await invoke("delete_link", { id: deleteTarget.id });
      setLinks((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // Group links by the "other" resource type
  const grouped = React.useMemo(() => {
    const map = new Map<ResourceType, BackLink[]>();
    for (const link of links) {
      // Determine which side is "other" (not this pdf)
      const otherType = resourceType(
        link.source_resource_type === "pdf" && link.source_resource_id === pdfId
          ? link.target_resource_type
          : link.source_resource_type
      );
      const arr = map.get(otherType) ?? [];
      arr.push(link);
      map.set(otherType, arr);
    }
    // Sort groups by label
    return Array.from(map.entries()).sort((a, b) =>
      RESOURCE_META[a[0]].label.localeCompare(RESOURCE_META[b[0]].label)
    );
  }, [links, pdfId]);

  return (
    <div className="flex flex-col h-full bg-card/50 border-l">
      <div className="px-3 py-2.5 border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Backlinks</span>
        </div>
        {links.length > 0 && (
          <Badge variant="secondary" className="text-xs h-5 px-1.5">
            {links.length}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!isLoading && error && (
            <p className="text-xs text-destructive px-2 py-4">{error}</p>
          )}

          {!isLoading && !error && links.length === 0 && anchors.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground text-center">
              <Link2 className="h-8 w-8 opacity-20" />
              <p className="text-xs">Aucun lien ou ancrage pour cette page</p>
            </div>
          )}

          {/* Anchors section */}
          {!isLoading && anchors.length > 0 && (
            <div className="mb-4 pb-4 border-b last:border-b-0">
              <div className="flex items-center gap-1.5 px-1 mb-2">
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ancrages
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {anchors.length}
                </span>
              </div>
              <ul className="space-y-0.5">
                {anchors.map((anchor) => (
                  <li key={anchor.id}>
                    <div className="flex items-center gap-1.5 rounded px-1.5 py-1.5 hover:bg-accent transition-colors">
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-xs font-medium truncate leading-snug">
                          {anchor.label || "Sans label"}
                        </p>
                        {anchor.text_snippet && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            "{anchor.text_snippet}"
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isLoading &&
            grouped.map(([type, groupLinks]) => {
              const meta = RESOURCE_META[type];
              const Icon = meta.icon;
              return (
                <div key={type} className="mb-3">
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${meta.colorClass}`} />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {groupLinks.length}
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {groupLinks.map((link) => {
                      const isSource =
                        link.source_resource_type === "pdf" &&
                        link.source_resource_id === pdfId;
                      const otherName = isSource
                        ? link.target_resource_name
                        : link.source_resource_name;

                      return (
                        <li key={link.id}>
                          <div className="group flex items-center gap-1.5 rounded px-1.5 py-1.5 hover:bg-accent transition-colors">
                            <button
                              className="flex-1 text-left min-w-0"
                              onClick={() => {
                                onNavigate?.(link);
                                // Determine the other resource for navigation
                                const isSource =
                                  link.source_resource_type === "pdf" &&
                                  link.source_resource_id === pdfId;
                                const navType = resourceType(
                                  isSource
                                    ? link.target_resource_type
                                    : link.source_resource_type
                                );
                                const navId = isSource
                                  ? String(link.target_resource_id)
                                  : String(link.source_resource_id);
                                const navTypeMap: Record<string, NavResourceType> = {
                                  pdf: "pdf",
                                  item: "item",
                                  error: "error",
                                  anki: "anki_card",
                                  diagram: "excalidraw",
                                  unknown: "pdf",
                                };
                                navigateTo({ type: navTypeMap[navType] ?? "pdf", id: navId });
                              }}
                            >
                              <p className="text-xs font-medium truncate leading-snug">
                                {otherName}
                              </p>
                              <Badge
                                variant={linkTypeBadgeVariant(link.link_type)}
                                className="text-xs py-0 h-4 mt-0.5"
                              >
                                {formatLinkType(link.link_type)}
                              </Badge>
                            </button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                const isSource =
                                  link.source_resource_type === "pdf" &&
                                  link.source_resource_id === pdfId;
                                const navType = resourceType(
                                  isSource
                                    ? link.target_resource_type
                                    : link.source_resource_type
                                );
                                const navId = isSource
                                  ? String(link.target_resource_id)
                                  : String(link.source_resource_id);
                                const navTypeMap: Record<string, NavResourceType> = {
                                  pdf: "pdf",
                                  item: "item",
                                  error: "error",
                                  anki: "anki_card",
                                  diagram: "excalidraw",
                                  unknown: "pdf",
                                };
                                navigateTo({ type: navTypeMap[navType] ?? "pdf", id: navId });
                              }}
                              title="Naviguer vers la ressource"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(link)}
                              title="Supprimer ce lien"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
        </div>
      </ScrollArea>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le lien</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Supprimer ce lien entre{" "}
            <strong>{deleteTarget?.source_resource_name}</strong> et{" "}
            <strong>{deleteTarget?.target_resource_name}</strong> ?
            Cette action est irréversible.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BacklinksPanel;
