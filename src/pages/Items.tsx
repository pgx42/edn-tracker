import * as React from "react";
import { Search, Filter, SortAsc } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemDetailModal } from "@/components/ItemDetailModal";
import { mockItems, SPECIALTIES } from "@/lib/mockData";
import type { EdnItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const rankColors: Record<string, string> = {
  A: "bg-red-500/20 text-red-400 border-red-500/30",
  B: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  C: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  not_started: { label: "Non commencé", color: "text-muted-foreground" },
  in_progress: { label: "En cours", color: "text-yellow-400" },
  mastered: { label: "Maîtrisé", color: "text-green-400" },
};

export function Items() {
  const [search, setSearch] = React.useState("");
  const [specialty, setSpecialty] = React.useState("all");
  const [rank, setRank] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [selectedItem, setSelectedItem] = React.useState<EdnItem | null>(null);
  const [sortField, setSortField] = React.useState<"code" | "rank" | "specialty">("code");

  const filtered = React.useMemo(() => {
    return mockItems
      .filter((item) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.specialty.toLowerCase().includes(q);
        const matchSpecialty = specialty === "all" || item.specialty === specialty;
        const matchRank = rank === "all" || item.rank === rank;
        const matchStatus = status === "all" || item.status === status;
        return matchSearch && matchSpecialty && matchRank && matchStatus;
      })
      .sort((a, b) => {
        if (sortField === "rank") return a.rank.localeCompare(b.rank);
        if (sortField === "specialty") return a.specialty.localeCompare(b.specialty);
        return a.code.localeCompare(b.code);
      });
  }, [search, specialty, rank, status, sortField]);

  const masteredCount = filtered.filter((i) => i.status === "mastered").length;
  const inProgressCount = filtered.filter((i) => i.status === "in_progress").length;

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
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
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
              {SPECIALTIES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={rank} onValueChange={setRank}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Rang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rangs</SelectItem>
              <SelectItem value="A">Rang A</SelectItem>
              <SelectItem value="B">Rang B</SelectItem>
              <SelectItem value="C">Rang C</SelectItem>
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
            onClick={() => setSortField((p) => p === "code" ? "rank" : p === "rank" ? "specialty" : "code")}
            className="gap-1.5"
          >
            <SortAsc className="h-4 w-4" />
            Tri: {sortField === "code" ? "Code" : sortField === "rank" ? "Rang" : "Spécialité"}
          </Button>
          {(search || specialty !== "all" || rank !== "all" || status !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(""); setSpecialty("all"); setRank("all"); setStatus("all"); }}
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
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setSpecialty("all"); setRank("all"); setStatus("all"); }}>
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Code</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead className="w-40">Spécialité</TableHead>
                <TableHead className="w-24">Rang</TableHead>
                <TableHead className="w-36">Statut</TableHead>
                <TableHead className="w-24">Erreurs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const st = statusConfig[item.status];
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.code}</TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">{item.title}</span>
                      {item.notes && (
                        <span className="ml-2 text-yellow-400 text-xs">★</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {item.specialty.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border text-xs", rankColors[item.rank])}>
                        Rang {item.rank}
                      </Badge>
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
    </div>
  );
}
