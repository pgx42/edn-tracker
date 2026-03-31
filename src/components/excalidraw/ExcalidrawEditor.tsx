import { useCallback, useEffect, useRef } from "react";
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import type { ExcalidrawDiagram } from "@/lib/types";

interface ExcalidrawEditorProps {
  diagram: ExcalidrawDiagram;
  onSave: (diagramJson: string) => void;
}

export function ExcalidrawEditor({ diagram, onSave }: ExcalidrawEditorProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Parse the stored JSON when diagram loads
  const initialData = useCallback(() => {
    try {
      const data = JSON.parse(diagram.diagram_json);
      // Remove collaborators from persisted state — Excalidraw expects a Map,
      // but JSON serializes Maps as plain objects. Let Excalidraw initialize it.
      if (data.appState) {
        delete data.appState.collaborators;
      }
      return data;
    } catch {
      return { elements: [], appState: {}, files: {} };
    }
  }, [diagram.diagram_json]);

  // Autosave with debounce (2 seconds)
  const handleChange = useCallback(
    (elements: any, appState: any) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        // Create a full Excalidraw state object, omitting collaborators
        // (it's a Map which cannot be JSON serialized)
        const { collaborators, ...appStateWithoutCollaborators } = appState;
        const fullState = {
          elements,
          appState: appStateWithoutCollaborators,
          files: appState.files || {},
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

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Excalidraw
        initialData={initialData()}
        onChange={(elements, appState) => handleChange(elements, appState)}
      >
        <MainMenu />
      </Excalidraw>
    </div>
  );
}
