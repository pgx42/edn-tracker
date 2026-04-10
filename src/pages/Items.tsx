import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Filter, Loader2, AlertCircle, Plus, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemDetailModal } from "@/components/ItemDetailModal";
import { ItemFormModal } from "@/components/ItemFormModal";
import type { EdnItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string }> = {
  not_started: { label: "Non commencé", color: "text-muted-foreground" },
  in_progress: { label: "En cours", color: "text-yellow-400" },
  mastered: { label: "Maîtrisé", color: "text-green-400" },
};

interface Specialty {
  id: string;
  name: string;
}

interface ItemRow {
  id: number;
  specialty_id: string;
  specialty_ids: string | null;
  code: string;
  title: string;
  description: string | null;
  rank: string;
}

export function Items() {
  const [items, setItems] = React.useState<EdnItem[]>([]);
  const [rawItems, setRawItems] = React.useState<ItemRow[]>([]);
  const [specialties, setSpecialties] = React.useState<Specialty[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [specialty, setSpecialty] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [selectedItem, setSelectedItem] = React.useState<EdnItem | null>(null);
  const [sortField, setSortField] = React.useState<"code" | "specialty">("code");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<ItemRow | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [loadedItems, loadedSpecialties] = await Promise.all([
        invoke<ItemRow[]>("get_items", {}),
        invoke<Specialty[]>("get_specialties"),
      ]);

      setRawItems(loadedItems);
      setSpecialties(loadedSpecialties);

      const specialtyMap = Object.fromEntries(loadedSpecialties.map((s) => [s.id, s.name]));

      const mappedItems: EdnItem[] = loadedItems.map((item) => {
        // Gather specialty names from junction table (specialty_ids = comma-separated)
        const specIds = item.specialty_ids
          ? item.specialty_ids.split(",").filter(Boolean)
          : item.specialty_id
          ? [item.specialty_id]
          : [];
        const specNames = specIds.map((id) => specialtyMap[id] ?? id);
        const primarySpec = specNames[0] ?? "Unknown";

        return {
          id: item.id,
          code: item.code,
          title: item.title,
          description: item.description ?? null,
          specialty: primarySpec,
          specialtyNames: specNames,
          specialtyIds: specIds,
          rank: (item.rank ?? "B") as "A" | "B" | "C",
          status: "not_started" as const,
          category: null,
          subcategory: null,
          difficulty: 3,
          notes: null,
          linkedPdfIds: [],
          linkedErrorIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      setItems(mappedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const filtered = React.useMemo(() => {
    return items
      .filter((item) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.specialty.toLowerCase().includes(q);
        const matchSpecialty = specialty === "all" || (item as any).specialtyNames?.includes(specialty) || item.specialty === specialty;
        const matchStatus = status === "all" || item.status === status;
        return matchSearch && matchSpecialty && matchStatus;
      })
      .sort((a, b) => {
        if (sortField === "specialty") return a.specialty.localeCompare(b.specialty);
        return a.code.localeCompare(b.code);
      });
  }, [items, search, specialty, status, sortField]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer cet item ?")) return;
    try {
      await invoke("delete_item_db", { id });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleEdit = (raw: ItemRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(raw);
    setFormOpen(true);
  };

  const masteredCount = filtered.filter((i) => i.status === "mastered").length;
  const inProgressCount = filtered.filter((i) => i.status === "in_progress").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Chargement des items...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b bg-card/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Items EDN</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""} affichés &mdash;{" "}
              <span className="text-green-400">{masteredCount} maîtrisés</span>,{" "}
              <span className="text-yellow-400">{inProgressCount} en cours</span>
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => { setEditingItem(null); setFormOpen(true); }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {error && (
            <div className="w-full flex items-center gap-2 text-red-400 text-sm p-3 bg-red-500/10 rounded-md border border-red-500/30">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un item..."
              className="pl-9"
            />
          </div>
          <Select value={specialty} onValueChange={setSpecialty}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Spécialité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les spécialités</SelectItem>
              {specialties.map((s) => (
                <SelectItem key={s.id} value={s.name} className="capitalize">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="not_started">Non commencé</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="mastered">Maîtrisé</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortField((p) => p === "code" ? "specialty" : "code")}
            className="gap-1.5"
          >
            <Filter className="h-4 w-4" />
            Tri: {sortField === "code" ? "Code" : "Spécialité"}
          </Button>
          {(search || specialty !== "all" || status !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(""); setSpecialty("all"); setStatus("all"); }}
            >
              <Filter className="h-4 w-4 mr-1" />
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <Search className="h-10 w-10 opacity-30" />
            <p className="text-sm">Aucun item ne correspond aux filtres</p>
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setSpecialty("all"); setStatus("all"); }}>
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Code</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead className="w-48">Matière(s)</TableHead>
                <TableHead className="w-36">Statut</TableHead>
                <TableHead className="w-24">Erreurs</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const raw = rawItems.find((r) => r.id === item.id);
                const st = statusConfig[item.status];
                const specNames = (item as any).specialtyNames as string[] | undefined;
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer group"
                    onClick={() => setSelectedItem(item)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.code}</TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">{item.title}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {specNames && specNames.length > 0 ? (
                          specNames.map((name) => (
                            <Badge key={name} variant="secondary" className="text-xs capitalize">
                              {name}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {item.specialty}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-sm", st.color)}>{st.label}</span>
                    </TableCell>
                    <TableCell>
                      {item.linkedErrorIds && item.linkedErrorIds.length > 0 ? (
                        <span className="text-red-400 text-sm font-medium">
                          {item.linkedErrorIds.length}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => raw && handleEdit(raw, e)}
                          className="p-1 hover:text-primary transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(item.id as number, e)}
                          className="p-1 hover:text-destructive transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ItemDetailModal
        item={selectedItem}
        open={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
      />

      <ItemFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingItem(null); }}
        onSaved={loadData}
        specialties={specialties}
        initialData={editingItem ? {
          id: editingItem.id,
          title: editingItem.title,
          code: editingItem.code,
          description: editingItem.description ?? "",
          specialty_ids: editingItem.specialty_ids
            ? editingItem.specialty_ids.split(",").filter(Boolean)
            : editingItem.specialty_id
            ? [editingItem.specialty_id]
            : [],
        } : undefined}
      />
    </div>
  );
}
