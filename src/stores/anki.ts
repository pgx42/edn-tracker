import { create } from "zustand";
import type { AnkiCard } from "@/lib/types";

interface AnkiState {
  cards: AnkiCard[];
  pendingExport: number[];
  isExporting: boolean;
  error: string | null;

  setCards: (cards: AnkiCard[]) => void;
  addCard: (card: AnkiCard) => void;
  togglePendingExport: (cardId: number) => void;
  clearPendingExport: () => void;
  setExporting: (exporting: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAnkiStore = create<AnkiState>()((set) => ({
  cards: [],
  pendingExport: [],
  isExporting: false,
  error: null,

  setCards: (cards) => set({ cards }),
  addCard: (card) => set((state) => ({ cards: [...state.cards, card] })),
  togglePendingExport: (cardId) =>
    set((state) => ({
      pendingExport: state.pendingExport.includes(cardId)
        ? state.pendingExport.filter((id) => id !== cardId)
        : [...state.pendingExport, cardId],
    })),
  clearPendingExport: () => set({ pendingExport: [] }),
  setExporting: (exporting) => set({ isExporting: exporting }),
  setError: (error) => set({ error }),
}));
