import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Check, ChevronsUpDown, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Specialty {
  id: string;
  name: string;
}

interface ItemFormData {
  id?: number;
  title: string;
  code: string;
  description: string;
  specialty_ids: string[];
}

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  specialties: Specialty[];
  /** If provided, the form is in edit mode */
  initialData?: Partial<ItemFormData> & { id: number };
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  open,
  onClose,
  onSaved,
  specialties,
  initialData,
}) => {
  const isEdit = initialData !== undefined;

  const [title, setTitle] = React.useState(initialData?.title ?? "");
  const [code, setCode] = React.useState(initialData?.code ?? "");
  const [description, setDescription] = React.useState(initialData?.description ?? "");
  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = React.useState<string[]>(
    initialData?.specialty_ids ?? []
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [specSearch, setSpecSearch] = React.useState("");
  const [specDropdownOpen, setSpecDropdownOpen] = React.useState(false);

  // Reset form when modal opens with new data
  React.useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? "");
      setCode(initialData?.code ?? "");
      setDescription(initialData?.description ?? "");
      setSelectedSpecialtyIds(initialData?.specialty_ids ?? []);
      setError(null);
      setSpecSearch("");
      setSpecDropdownOpen(false);
    }
  }, [open, initialData?.id]);

  const filteredSpecialties = specialties.filter((s) =>
    s.name.toLowerCase().includes(specSearch.toLowerCase())
  );

  const toggleSpecialty = (id: string) => {
    setSelectedSpecialtyIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!title.trim() || !code.trim()) {
      setError("Le titre et le code sont requis.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (isEdit && initialData) {
        await invoke("update_item_db", {
          id: initialData.id,
          title: title.trim(),
          code: code.trim(),
          description: description.trim() || null,
          specialtyIds: selectedSpecialtyIds,
        });
      } else {
        await invoke("create_item_db", {
          title: title.trim(),
          code: code.trim(),
          description: description.trim() || null,
          specialtyIds: selectedSpecialtyIds,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'item" : "Nouvel item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>
          )}

          {/* Code */}
          <div className="space-y-1.5">
            <Label htmlFor="item-code">Code</Label>
            <Input
              id="item-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: CARDIO-001"
              className="font-mono"
            />
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="item-title">Titre</Label>
            <Input
              id="item-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'item"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Description <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
            <Textarea
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mots-clés, concepts clés..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Specialties multi-select */}
          <div className="space-y-1.5">
            <Label>Matières</Label>

            {/* Selected badges */}
            {selectedSpecialtyIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {selectedSpecialtyIds.map((id) => {
                  const spec = specialties.find((s) => s.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1">
                      {spec?.name ?? id}
                      <button
                        onClick={() => toggleSpecialty(id)}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Dropdown trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSpecDropdownOpen((o) => !o)}
                className="w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <span className="text-muted-foreground">
                  {selectedSpecialtyIds.length === 0
                    ? "Sélectionner des matières..."
                    : `${selectedSpecialtyIds.length} matière(s) sélectionnée(s)`}
                </span>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {specDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg overflow-hidden">
                  <div className="p-2 border-b">
                    <Input
                      value={specSearch}
                      onChange={(e) => setSpecSearch(e.target.value)}
                      placeholder="Rechercher..."
                      className="h-7 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredSpecialties.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">Aucun résultat</p>
                    ) : (
                      filteredSpecialties.map((s) => {
                        const selected = selectedSpecialtyIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSpecialty(s.id)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors",
                              selected && "bg-accent/50"
                            )}
                          >
                            <Check
                              className={cn("h-3.5 w-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")}
                            />
                            {s.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim() || !code.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ItemFormModal;
