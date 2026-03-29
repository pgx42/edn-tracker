import { create } from "zustand";
import type { EdnItem, GraphLink } from "@/lib/types";

interface LinksState {
  nodes: EdnItem[];
  edges: GraphLink[];
  selectedNodeId: number | null;
  isLoading: boolean;
  error: string | null;

  setNodes: (nodes: EdnItem[]) => void;
  setEdges: (edges: GraphLink[]) => void;
  setSelectedNode: (id: number | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useLinksStore = create<LinksState>()((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isLoading: false,
  error: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
