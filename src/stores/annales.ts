import { create } from "zustand";

export interface AnnaleSession {
  id: string;
  title: string;
  year: number;
  specialty_id: string | null;
  pdf_document_id: string | null;
  total_questions: number;
  score: number | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string | null;
}

interface AnnalesState {
  sessions: AnnaleSession[];
  selectedId: string | null;
  filter: { year: string; specialty: string };

  setSessions: (s: AnnaleSession[]) => void;
  setSelectedId: (id: string | null) => void;
  setFilter: (f: Partial<{ year: string; specialty: string }>) => void;
}

export const useAnnalesStore = create<AnnalesState>()((set) => ({
  sessions: [],
  selectedId: null,
  filter: { year: "all", specialty: "all" },

  setSessions: (sessions) => set({ sessions }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
}));
