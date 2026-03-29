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
import type { StudyGoal } from "@/lib/types";

interface GoalCreationModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (goal: Omit<StudyGoal, "id" | "completedItemIds">) => void;
}

export function GoalCreationModal({ open, onClose, onCreate }: GoalCreationModalProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [targetDate, setTargetDate] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate) return;
    onCreate({
      title: title.trim(),
      description: description.trim() || null,
      targetDate,
      itemIds: [],
    });
    setTitle("");
    setDescription("");
    setTargetDate("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvel objectif</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="goal-title">Titre *</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Maîtriser la cardiologie..."
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-date">Date cible *</Label>
            <Input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-desc">Description</Label>
            <Textarea
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails de l'objectif..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!title.trim() || !targetDate}>
              Créer l'objectif
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
