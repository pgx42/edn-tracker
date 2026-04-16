import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/useToast";

interface Specialty { id: string; name: string; }

interface AnnaleCreationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AnnaleCreationModal({ open, onClose, onCreated }: AnnaleCreationModalProps) {
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [specialtyId, setSpecialtyId] = useState<string>("none");
  const [totalQuestions, setTotalQuestions] = useState("30");
  const [notes, setNotes] = useState("");
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      invoke<Specialty[]>("get_specialties").then(setSpecialties).catch(() => {});
      setTitle("");
      setYear(new Date().getFullYear().toString());
      setSpecialtyId("none");
      setTotalQuestions("30");
      setNotes("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const q = parseInt(totalQuestions, 10);
    if (isNaN(q) || q < 1) return;

    setSubmitting(true);
    try {
      await invoke("create_annale_session", {
        title: title.trim(),
        year: parseInt(year, 10),
        specialtyId: specialtyId === "none" ? null : specialtyId,
        pdfDocumentId: null,
        totalQuestions: q,
        notes: notes.trim() || null,
      });
      toast({ title: "Session d'annale créée" });
      onCreated();
      onClose();
    } catch (e) {
      toast({ title: "Erreur", description: String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle session d'annale</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Titre</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Annale Cardio 2024 - Session 1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Année</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nombre de questions</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Spécialité (optionnel)</Label>
            <Select value={specialtyId} onValueChange={setSpecialtyId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Toutes spécialités</SelectItem>
                {specialties.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes (optionnel)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions, durée, remarques..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || submitting}>
            Créer la session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
