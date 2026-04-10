import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { CreateSessionInput, EdnItem } from "@/lib/types";
import { SPECIALTIES_LIST, SPECIALTY_CONFIG } from "@/lib/specialties";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateSessionInput) => Promise<void>;
  defaultDate?: string;
  defaultStartHour?: number;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDatetimeValue(date: string, hour: number, minute = 0) {
  return `${date}T${pad2(hour)}:${pad2(minute)}`;
}

const RANK_COLORS: Record<string, string> = {
  A: "bg-red-500/20 text-red-400 border-red-500/30",
  B: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  C: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export function SessionCreationModal({
  open,
  onClose,
  onCreate,
  defaultDate,
  defaultStartHour,
}: Props) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  const startH = defaultStartHour ?? 8;
  const endH = Math.min(startH + 1, 23);

  const [title, setTitle] = React.useState("");
  const [startTime, setStartTime] = React.useState(toLocalDatetimeValue(defaultDate ?? todayStr, startH));
  const [endTime, setEndTime] = React.useState(toLocalDatetimeValue(defaultDate ?? todayStr, endH));
  const [notes, setNotes] = React.useState("");
  const [selectedSpecialtyId, setSelectedSpecialtyId] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<EdnItem[]>([]);
  const [itemSearch, setItemSearch] = React.useState("");
  const [selectedItem, setSelectedItem] = React.useState<EdnItem | null>(null);
  const [loadingItems, setLoadingItems] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      const h = defaultStartHour ?? 8;
      const d = defaultDate ?? todayStr;
      setTitle("");
      setStartTime(toLocalDatetimeValue(d, h));
      setEndTime(toLocalDatetimeValue(d, Math.min(h + 1, 23)));
      setNotes("");
      setSelectedSpecialtyId(null);
      setSelectedItem(null);
      setItemSearch("");
      setItems([]);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load items when specialty selected
  React.useEffect(() => {
    if (!selectedSpecialtyId) {
      setItems([]);
      setSelectedItem(null);
      return;
    }
    setLoadingItems(true);
    invoke<Array<Record<string, unknown>>>("get_items", { specialtyId: selectedSpecialtyId })
      .then((raw) => {
        const mapped: EdnItem[] = raw.map((r) => ({
          id: r.id as number,
          code: r.code as string,
          title: r.title as string,
          description: (r.description as string | null) ?? null,
          specialty: (r.specialty ?? selectedSpecialtyId) as string,
          rank: (r.rank as "A" | "B" | "C") ?? "B",
          status: "not_started",
          category: null,
          subcategory: null,
          difficulty: null,
          notes: null,
          createdAt: "",
          updatedAt: "",
        }));
        setItems(mapped);
      })
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false));
  }, [selectedSpecialtyId]);

  // Auto-fill title from selected item
  React.useEffect(() => {
    if (selectedItem && !title) {
      setTitle(`Révision ${selectedItem.code} – ${selectedItem.title}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem]);

  const filteredItems = React.useMemo(() => {
    const q = itemSearch.toLowerCase();
    if (!q) return items.slice(0, 30);
    return items.filter(
      (it) =>
        it.code.toLowerCase().includes(q) ||
        it.title.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [items, itemSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Le titre est requis."); return; }
    if (endTime <= startTime) { setError("L'heure de fin doit être après le début."); return; }
    setError(null);
    setLoading(true);
    try {
      await onCreate({
        title: title.trim(),
        startTime: startTime + ":00",
        endTime: endTime + ":00",
        itemId: selectedItem?.id,
        specialtyId: selectedSpecialtyId ?? undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const selectedSpecialty = selectedSpecialtyId ? SPECIALTY_CONFIG[selectedSpecialtyId] : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle session</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Specialty selector */}
          <div className="space-y-2">
            <Label>Spécialité</Label>
            <div className="flex flex-wrap gap-1.5">
              {SPECIALTIES_LIST.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => setSelectedSpecialtyId(sp.id === selectedSpecialtyId ? null : sp.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                    selectedSpecialtyId === sp.id
                      ? sp.blockClass + " border-opacity-80 scale-105"
                      : "border-border text-muted-foreground hover:border-border/80"
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sp.color }}
                  />
                  {sp.name}
                </button>
              ))}
            </div>
          </div>

          {/* Item selector (only when specialty selected) */}
          {selectedSpecialtyId && (
            <div className="space-y-2">
              <Label>Item EDN</Label>
              {selectedItem ? (
                <div
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer",
                    selectedSpecialty?.blockClass
                  )}
                  onClick={() => setSelectedItem(null)}
                >
                  <div>
                    <span className="font-mono text-xs font-bold">{selectedItem.code}</span>
                    <span className="text-xs ml-2">{selectedItem.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={cn("text-[10px] h-4 px-1 border", RANK_COLORS[selectedItem.rank])}>
                      {selectedItem.rank}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">✕ changer</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par code ou titre..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                      autoFocus={false}
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border bg-popover">
                    {loadingItems ? (
                      <p className="text-xs text-muted-foreground p-3">Chargement...</p>
                    ) : filteredItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">Aucun item trouvé</p>
                    ) : (
                      filteredItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent transition-colors text-xs border-b last:border-0"
                          onClick={() => setSelectedItem(item)}
                        >
                          <span className="font-mono font-bold text-muted-foreground w-14 flex-shrink-0">
                            {item.code}
                          </span>
                          <span className="truncate flex-1">{item.title}</span>
                          <Badge className={cn("text-[10px] h-4 px-1 border flex-shrink-0", RANK_COLORS[item.rank])}>
                            {item.rank}
                          </Badge>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="session-title">Titre</Label>
            <Input
              id="session-title"
              placeholder="Ex: Révision Cardiologie"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="session-start">Début</Label>
              <Input
                id="session-start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-end">Fin</Label>
              <Input
                id="session-end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="session-notes">Notes (optionnel)</Label>
            <Textarea
              id="session-notes"
              placeholder="Objectifs, pages à revoir..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              style={selectedSpecialty ? { backgroundColor: selectedSpecialty.color + "33", borderColor: selectedSpecialty.color + "80", color: "white" } : {}}
            >
              {loading ? "Création..." : "Créer la session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
