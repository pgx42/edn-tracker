import * as React from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface SpecialtyWithCount {
  id: string;
  name: string;
  item_count: number;
}

export function Matieres() {
  const navigate = useNavigate();
  const [specialties, setSpecialties] = React.useState<SpecialtyWithCount[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Form dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingSpec, setEditingSpec] = React.useState<SpecialtyWithCount | null>(null);
  const [formName, setFormName] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await invoke<SpecialtyWithCount[]>("get_specialties_with_count");
      setSpecialties(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditingSpec(null);
    setFormName("");
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (spec: SpecialtyWithCount) => {
    setEditingSpec(spec);
    setFormName(spec.name);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { setFormError("Le nom est requis."); return; }
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingSpec) {
        await invoke("update_specialty", { id: editingSpec.id, name: formName.trim() });
      } else {
        await invoke("create_specialty", { name: formName.trim() });
      }
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await invoke("delete_specialty", { id });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b bg-card/50">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Matières
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {specialties.length} matière{specialties.length !== 1 ? "s" : ""} —{" "}
              relation many-to-many avec les items
            </p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Chargement...</p>
          </div>
        ) : error ? (
          <div className="m-6 flex items-center gap-2 text-red-400 text-sm p-3 bg-red-500/10 rounded-md border border-red-500/30">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : specialties.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-30" />
            <p className="text-sm">Aucune matière. Commencez par en créer une.</p>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Créer une matière
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="w-32">Items liés</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {specialties.map((spec) => (
                <TableRow
                  key={spec.id}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/matieres/${spec.id}`)}
                >
                  <TableCell className="font-medium flex items-center gap-1.5">
                    {spec.name}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {spec.item_count} item{spec.item_count !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(spec)}
                        className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
                        title="Renommer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(spec.id)}
                        disabled={deletingId === spec.id}
                        className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        {deletingId === spec.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSpec ? "Renommer la matière" : "Nouvelle matière"}</DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{formError}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="spec-name">Nom</Label>
              <Input
                id="spec-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Cardiologie"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formName.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingSpec ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
