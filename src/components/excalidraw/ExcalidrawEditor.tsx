import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw, Sidebar, Footer } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { invoke } from "@tauri-apps/api/core";
import { LinkCreationModal } from "@/components/LinkCreationModal";
import { useNavigateToResource } from "@/hooks/useNavigateToResource";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink } from "lucide-react";
import type { ExcalidrawDiagram } from "@/lib/types";

interface LinkResult {
  id: string;
  source_anchor_id: string;
  target_anchor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  link_type: string;
  bidirectional: boolean | null;
  created_by: string | null;
  created_at: string | null;
}

interface ExcalidrawEditorProps {
  diagram: ExcalidrawDiagram;
  onSave: (diagramJson: string) => void;
}

export function ExcalidrawEditor({ diagram, onSave }: ExcalidrawEditorProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [diagramLinks, setDiagramLinks] = useState<LinkResult[]>([]);
  const [linkModalAnchorId, setLinkModalAnchorId] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [sidebarDocked, setSidebarDocked] = useState(false);
  const navigateTo = useNavigateToResource();

  // Parse the stored JSON when diagram changes
  useEffect(() => {
    try {
      const data = JSON.parse(diagram.diagram_json);
      // Ensure proper structure
      const initialDataObj = {
        elements: data.elements || [],
        appState: data.appState || {
          viewBackgroundColor: "#ffffff",
          zoom: { value: 1 },
        },
        scrollToContent: true,
      };
      // Remove collaborators (it's a Map, can't be serialized)
      if (initialDataObj.appState) {
        delete initialDataObj.appState.collaborators;
      }
      setInitialData(initialDataObj);
    } catch (e) {
      console.error("Failed to parse diagram JSON:", e);
      setInitialData({
        elements: [],
        appState: {
          viewBackgroundColor: "#ffffff",
          zoom: { value: 1 },
        },
        scrollToContent: true,
      });
    }
  }, [diagram.diagram_json]);

  // Load diagram links on mount
  useEffect(() => {
    const loadDiagramLinks = async () => {
      try {
        const links = await invoke<LinkResult[]>("get_diagram_links", {
          diagramId: diagram.id,
        });
        setDiagramLinks(links);
      } catch (e) {
        console.error("Failed to load diagram links:", e);
        setDiagramLinks([]);
      }
    };
    loadDiagramLinks();
  }, [diagram.id]);

  // Open link creation modal for the diagram
  const handleAddLink = useCallback(async () => {
    try {
      const anchorId = await invoke<string>("create_diagram_anchor", {
        diagramId: diagram.id,
      });

      setLinkModalAnchorId(anchorId);
      setLinkModalOpen(true);
    } catch (e) {
      console.error("Failed to create anchor:", e);
    }
  }, [diagram.id]);

  // Autosave with debounce (2 seconds)
  const handleChange = useCallback(
    (elements: any, appState: any) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        // Create a full Excalidraw state object, omitting non-serializable fields
        const { collaborators, ...appStateWithoutCollaborators } = appState;
        const fullState = {
          elements,
          appState: appStateWithoutCollaborators,
        };

        onSave(JSON.stringify(fullState));
      }, 2000);
    },
    [onSave]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!initialData) {
    return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      Chargement du schéma...
    </div>;
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Excalidraw
        initialData={initialData}
        onChange={handleChange}
        UIOptions={{
          dockedSidebarBreakpoint: 0,
        }}
      >
        <Sidebar name="edn-links" docked={sidebarDocked} onDock={setSidebarDocked}>
          <Sidebar.Header>Liens du diagramme</Sidebar.Header>
          <Sidebar.Tabs>
            <Sidebar.Tab tab="links">
              <div className="p-4 text-sm space-y-4">
                {/* Links list */}
                <div className="space-y-2">
                  {diagramLinks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun lien</p>
                  ) : (
                    <ul className="space-y-2">
                      {diagramLinks.map((link) => (
                        <li
                          key={link.id}
                          className="text-xs bg-muted p-2 rounded flex items-center justify-between group hover:bg-muted/80"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-foreground">
                              {link.target_id || "Unknown"}
                            </div>
                            <div className="text-muted-foreground">
                              {link.link_type}
                            </div>
                          </div>
                          {link.target_type && link.target_id && (
                            <button
                              onClick={() =>
                                navigateTo({
                                  type: (link.target_type as any) || "item",
                                  id: link.target_id!,
                                })
                              }
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-1 hover:bg-accent rounded"
                              title="Naviguer"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Add link button */}
                <Button
                  size="sm"
                  onClick={handleAddLink}
                  className="w-full gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un lien
                </Button>
              </div>
            </Sidebar.Tab>
            <Sidebar.TabTriggers>
              <Sidebar.TabTrigger tab="links">Liens</Sidebar.TabTrigger>
            </Sidebar.TabTriggers>
          </Sidebar.Tabs>
        </Sidebar>

        <Footer>
          <Sidebar.Trigger
            name="edn-links"
            tab="links"
            className="gap-1.5"
          >
            Liens EDN ({diagramLinks.length})
          </Sidebar.Trigger>
        </Footer>
      </Excalidraw>

      <LinkCreationModal
        open={linkModalOpen}
        sourceAnchorId={linkModalAnchorId || ""}
        onClose={() => {
          setLinkModalOpen(false);
          // Reload links after creation
          const reloadLinks = async () => {
            try {
              const links = await invoke<LinkResult[]>("get_diagram_links", {
                diagramId: diagram.id,
              });
              setDiagramLinks(links);
            } catch (e) {
              console.error("Failed to reload diagram links:", e);
            }
          };
          reloadLinks();
        }}
      />
    </div>
  );
}
