import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ErrorCreationModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (error: { title: string; description: string; error_type: string; severity: string; item_id?: number | null }) => void;
}

export function ErrorCreationModal({ open, onClose, onCreate }: ErrorCreationModalProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [errorType, setErrorType] = React.useState<string>("knowledge_gap");
  const [severity, setSeverity] = React.useState<string>("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      error_type: errorType,
      severity,
      item_id: null,
    });
    // reset
    setTitle("");
    setDescription("");
    setErrorType("knowledge_gap");
    setSeverity("medium");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle erreur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="err-title">Titre *</Label>
            <Input
              id="err-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Résumé bref de l'erreur..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type d'erreur</Label>
              <Select value={errorType} onValueChange={setErrorType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concept_confusion">Confusion conceptuelle</SelectItem>
                  <SelectItem value="knowledge_gap">Lacune de connaissance</SelectItem>
                  <SelectItem value="calculation">Erreur de calcul</SelectItem>
                  <SelectItem value="recall">Erreur de mémorisation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sévérité</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Mineure</SelectItem>
                  <SelectItem value="medium">Modérée</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="err-desc">Description *</Label>
            <Textarea
              id="err-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez l'erreur commise..."
              rows={3}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!title.trim() || !description.trim()}>
              Créer l'erreur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
