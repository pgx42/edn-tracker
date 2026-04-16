import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ItemReviewModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (quality: number, notes?: string) => Promise<void>;
  itemTitle: string;
  jLabel: string;
}

const qualityOptions = [
  { value: 1, label: "Oublié", description: "Je ne me souvenais de rien", color: "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30" },
  { value: 2, label: "Difficile", description: "Très laborieux, beaucoup d'hésitations", color: "bg-orange-500/20 text-orange-400 border-orange-500/40 hover:bg-orange-500/30" },
  { value: 3, label: "Moyen", description: "Quelques erreurs mais l'essentiel est là", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/30" },
  { value: 4, label: "Bien", description: "Bonne maîtrise avec quelques hésitations", color: "bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30" },
  { value: 5, label: "Parfait", description: "Aucune hésitation, maîtrise totale", color: "bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/30" },
];

export function ItemReviewModal({ open, onClose, onSubmit, itemTitle, jLabel }: ItemReviewModalProps) {
  const [quality, setQuality] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (quality === null) return;
    setSubmitting(true);
    try {
      await onSubmit(quality, notes || undefined);
      setQuality(null);
      setNotes("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Révision terminée</DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground truncate">{itemTitle}</span>
            <Badge variant="outline" className="text-xs font-mono shrink-0">{jLabel}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium mb-3">Comment s'est passée cette révision ?</p>
            <div className="space-y-2">
              {qualityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setQuality(opt.value)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                    quality === opt.value ? opt.color : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className={cn(
                    "text-lg font-bold w-8 text-center",
                    quality === opt.value ? "" : "text-muted-foreground"
                  )}>
                    {opt.value}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-1.5">Notes (optionnel)</p>
            <Textarea
              placeholder="Points à revoir, erreurs commises..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={quality === null || submitting}>
            Valider la révision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
