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
import type { ErrorEntry } from "@/lib/types";

interface ErrorCreationModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (error: Omit<ErrorEntry, "id" | "createdAt">) => void;
}

export function ErrorCreationModal({ open, onClose, onCreate }: ErrorCreationModalProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [errorType, setErrorType] = React.useState<ErrorEntry["errorType"]>("knowledge_gap");
  const [severity, setSeverity] = React.useState<ErrorEntry["severity"]>("medium");
  const [context, setContext] = React.useState("");
  const [suggestion, setSuggestion] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      errorType,
      severity,
      context: context.trim() || null,
      suggestion: suggestion.trim() || null,
      itemId: null,
      pdfId: null,
      resolved: false,
    });
    // reset
    setTitle("");
    setDescription("");
    setErrorType("knowledge_gap");
    setSeverity("medium");
    setContext("");
    setSuggestion("");
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
              <Select value={errorType} onValueChange={(v) => setErrorType(v as ErrorEntry["errorType"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concept_confusion">Confusion conceptuelle</SelectItem>
                  <SelectItem value="knowledge_gap">Lacune de connaissance</SelectItem>
                  <SelectItem value="calculation_error">Erreur de calcul</SelectItem>
                  <SelectItem value="application_error">Erreur d'application</SelectItem>
                  <SelectItem value="memory_error">Erreur de mémorisation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sévérité</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as ErrorEntry["severity"])}>
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

          <div className="space-y-1.5">
            <Label htmlFor="err-context">Contexte</Label>
            <Textarea
              id="err-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Dans quel contexte (dossier, QCM, révision)..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="err-suggestion">Suggestion de correction</Label>
            <Textarea
              id="err-suggestion"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Comment corriger ou retenir la bonne réponse..."
              rows={2}
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
