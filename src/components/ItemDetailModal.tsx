import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, AlertCircle, BookOpen, Star } from "lucide-react";
import type { EdnItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ItemDetailModalProps {
  item: EdnItem | null;
  open: boolean;
  onClose: () => void;
}

const rankColors: Record<string, string> = {
  A: "bg-red-500/20 text-red-400 border-red-500/30",
  B: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  C: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  not_started: { label: "Non commencé", color: "text-muted-foreground" },
  in_progress: { label: "En cours", color: "text-yellow-400" },
  mastered: { label: "Maîtrisé", color: "text-green-400" },
};

export function ItemDetailModal({ item, open, onClose }: ItemDetailModalProps) {
  if (!item) return null;

  const status = statusLabels[item.status];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div>
              <DialogTitle className="text-xl">{item.title}</DialogTitle>
              <DialogDescription className="font-mono text-sm mt-1">{item.code}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 mt-2">
          <Badge className={cn("border", rankColors[item.rank])}>
            Rang {item.rank}
          </Badge>
          <Badge variant="secondary" className="capitalize">
            {item.specialty.replace(/_/g, " ")}
          </Badge>
          <span className={cn("text-sm font-medium", status.color)}>
            {status.label}
          </span>
        </div>

        <Separator />

        {item.description && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Description</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          </div>
        )}

        {item.notes && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-yellow-400" />
              Notes personnelles
            </h4>
            <p className="text-sm text-yellow-200/80 bg-yellow-500/10 rounded-md p-3 border border-yellow-500/20">
              {item.notes}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-blue-400" />
              PDFs liés
            </h4>
            {item.linkedPdfIds && item.linkedPdfIds.length > 0 ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {item.linkedPdfIds.map((id) => (
                  <li key={id} className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    PDF #{id}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun PDF lié</p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              Erreurs liées
            </h4>
            {item.linkedErrorIds && item.linkedErrorIds.length > 0 ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {item.linkedErrorIds.map((id) => (
                  <li key={id} className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-red-400" />
                    Erreur #{id}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune erreur</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          {item.difficulty && (
            <div className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              Difficulté: {item.difficulty}/5
            </div>
          )}
          <div>Créé: {item.createdAt}</div>
          <div>Modifié: {item.updatedAt}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
