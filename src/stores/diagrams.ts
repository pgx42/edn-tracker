import { create } from "zustand";
import type { ExcalidrawDiagram } from "@/lib/types";

interface DiagramsState {
  diagrams: ExcalidrawDiagram[];
  activeDiagramId: string | null;
  isLoading: boolean;
  error: string | null;

  setDiagrams: (diagrams: ExcalidrawDiagram[]) => void;
  setActiveDiagram: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDiagramsStore = create<DiagramsState>()((set) => ({
  diagrams: [],
  activeDiagramId: null,
  isLoading: false,
  error: null,

  setDiagrams: (diagrams) => set({ diagrams }),
  setActiveDiagram: (id) => set({ activeDiagramId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
