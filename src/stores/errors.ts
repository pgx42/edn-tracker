import { create } from "zustand";
import type { ErrorEntry } from "@/lib/types";

interface ErrorsState {
  entries: ErrorEntry[];
  filter: "all" | "unresolved" | "resolved";
  isLoading: boolean;
  error: string | null;

  setEntries: (entries: ErrorEntry[]) => void;
  addEntry: (entry: ErrorEntry) => void;
  updateEntry: (id: number, patch: Partial<ErrorEntry>) => void;
  setFilter: (filter: "all" | "unresolved" | "resolved") => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useErrorsStore = create<ErrorsState>()((set) => ({
  entries: [],
  filter: "all",
  isLoading: false,
  error: null,

  setEntries: (entries) => set({ entries }),
  addEntry: (entry) =>
    set((state) => ({ entries: [...state.entries, entry] })),
  updateEntry: (id, patch) =>
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),
  setFilter: (filter) => set({ filter }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
