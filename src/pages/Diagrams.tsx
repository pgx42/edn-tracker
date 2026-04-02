import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExcalidrawEditor } from "@/components/excalidraw/ExcalidrawEditor";
import { useDiagramsStore } from "@/stores/diagrams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, PenTool, Plus, ArrowLeft } from "lucide-react";
import type { ExcalidrawDiagram } from "@/lib/types";

export function Diagrams() {
  const { diagrams, activeDiagramId, setDiagrams, setActiveDiagram, setLoading, setError } =
    useDiagramsStore();
  const [search, setSearch] = useState("");
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [error, setLocalError] = useState<string | null>(null);

  // Load diagrams on mount
  useEffect(() => {
    loadDiagrams();
  }, []);

  const loadDiagrams = async () => {
    try {
      setLoading(true);
      const result = await invoke<ExcalidrawDiagram[]>("list_diagrams");
      setDiagrams(result);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLocalError(msg);
    } finally {
      setLoading(false);
    }
  };

  const activeDiagram = diagrams.find((d) => d.id === activeDiagramId) ?? null;

  const filteredDiagrams = diagrams.filter((diagram) => {
    const q = search.toLowerCase();
    return !q || diagram.title.toLowerCase().includes(q);
  });

  const handleCreateDiagram = async () => {
    try {
      // Create an empty Excalidraw state
      // Note: collaborators is not persisted (it's a Map which can't be JSON serialized)
      // Excalidraw will initialize it on load
      const emptyState = JSON.stringify({
        elements: [],
        appState: {
          theme: "light",
          viewBackgroundColor: "#ffffff",
          zoom: { value: 1 },
        },
        files: {},
      });

      const diagramId = await invoke<string>("create_diagram", {
        title: "Nouveau schéma",
        diagramJson: emptyState,
        itemIds: null,
      });

      // Reload and open the new diagram
      await loadDiagrams();
      setActiveDiagram(diagramId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(msg);
    }
  };

  const handleSaveDiagram = async (diagramJson: string) => {
    if (!activeDiagram) return;

    try {
      await invoke("update_diagram", {
        id: activeDiagram.id,
        title: activeDiagram.title,
        diagramJson: diagramJson,
      });
      // Silently update the local store
      const updated = diagrams.map((d) =>
        d.id === activeDiagram.id ? { ...d, diagram_json: diagramJson } : d
      );
      setDiagrams(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(msg);
    }
  };

  const handleRenameStart = (id: string, title: string) => {
    setIsRenaming(id);
    setRenamingValue(title);
  };

  const handleRenameSave = async (id: string) => {
    const diagram = diagrams.find((d) => d.id === id);
    if (!diagram) return;

    try {
      await invoke("update_diagram", {
        id,
        title: renamingValue,
        diagramJson: diagram.diagram_json,
      });

      const updated = diagrams.map((d) =>
        d.id === id ? { ...d, title: renamingValue } : d
      );
      setDiagrams(updated);
      setIsRenaming(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(msg);
    }
  };

  const handleDeleteDiagram = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce schéma ?")) return;

    try {
      await invoke("delete_diagram", { id });
      const updated = diagrams.filter((d) => d.id !== id);
      setDiagrams(updated);
      if (activeDiagramId === id) {
        setActiveDiagram(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(msg);
    }
  };

  return !activeDiagram ? (
    // List view
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Schémas Excalidraw</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {diagrams.length} schéma{diagrams.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={handleCreateDiagram} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouveau schéma
        </Button>
      </div>

      {/* Search bar */}
      <div className="px-6 py-3 border-b flex gap-3 items-center shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive px-6 py-3">{error}</p>
      )}

      {/* Diagrams list */}
      <div className="flex-1 overflow-y-auto">
        {filteredDiagrams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <PenTool className="h-12 w-12 opacity-20" />
            <p className="text-sm">
              {diagrams.length === 0
                ? "Aucun schéma créé."
                : "Aucun schéma correspondant."}
            </p>
            {diagrams.length === 0 && (
              <Button variant="outline" onClick={handleCreateDiagram} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Créer un schéma
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {filteredDiagrams.map((diagram) => (
              <li key={diagram.id}>
                <div className="w-full px-6 py-3 hover:bg-accent transition-colors flex items-start gap-3">
                  <PenTool className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    {isRenaming === diagram.id ? (
                      <div className="flex gap-2 items-center mb-2">
                        <Input
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleRenameSave(diagram.id)}
                        >
                          Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsRenaming(null)}
                        >
                          Annuler
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveDiagram(diagram.id)}
                        className="font-medium truncate hover:underline text-left"
                      >
                        {diagram.title}
                      </button>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                      <span>{new Date(diagram.modified_at).toLocaleDateString()}</span>
                      <div className="flex gap-2">
                        {isRenaming !== diagram.id && (
                          <>
                            <button
                              onClick={() => handleRenameStart(diagram.id, diagram.title)}
                              className="hover:text-foreground"
                            >
                              Renommer
                            </button>
                            <button
                              onClick={() => handleDeleteDiagram(diagram.id)}
                              className="hover:text-destructive"
                            >
                              Supprimer
                            </button>
                            <button
                              onClick={() => setActiveDiagram(diagram.id)}
                              className="hover:text-foreground font-medium"
                            >
                              Ouvrir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  ) : (
    // Editor view
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveDiagram(null)}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">{activeDiagram.title}</h1>
          <Badge variant="secondary" className="text-xs">
            Autosauvegarde activée
          </Badge>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        <ExcalidrawEditor
          diagram={activeDiagram}
          onSave={handleSaveDiagram}
        />
      </div>
    </div>
  );
}
