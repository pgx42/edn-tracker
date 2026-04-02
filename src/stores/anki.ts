import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnkiNoteRecord, AnkiDeck } from "@/lib/types";

interface AnkiState {
  // Connection
  collectionPath: string | null;
  isCollectionConnected: boolean;

  // Decks loaded from the local anki_decks table
  decks: AnkiDeck[];
  isLoadingDecks: boolean;

  // Notes created from this app (from anki_notes table)
  cards: AnkiNoteRecord[];
  isLoadingCards: boolean;

  // Export queue
  pendingExport: string[];
  isExporting: boolean;

  // Highlighted card (from backlink navigation)
  highlightedCardId: string | null;

  // Error
  error: string | null;

  // Actions
  setCollectionPath: (path: string | null) => void;
  setDecks: (decks: AnkiDeck[]) => void;
  setCards: (cards: AnkiNoteRecord[]) => void;
  addCard: (card: AnkiNoteRecord) => void;
  setLoadingDecks: (loading: boolean) => void;
  setLoadingCards: (loading: boolean) => void;
  togglePendingExport: (cardId: string) => void;
  clearPendingExport: () => void;
  setExporting: (exporting: boolean) => void;
  setHighlightedCardId: (id: string | null) => void;
  setError: (error: string | null) => void;
}

export const useAnkiStore = create<AnkiState>()(
  persist(
    (set) => ({
      collectionPath: null,
      isCollectionConnected: false,
      decks: [],
      isLoadingDecks: false,
      cards: [],
      isLoadingCards: false,
      pendingExport: [],
      isExporting: false,
      highlightedCardId: null,
      error: null,

      setCollectionPath: (path) =>
        set({ collectionPath: path, isCollectionConnected: path !== null }),
      setDecks: (decks) => set({ decks }),
      setCards: (cards) => set({ cards }),
      addCard: (card) => set((s) => ({ cards: [...s.cards, card] })),
      setLoadingDecks: (loading) => set({ isLoadingDecks: loading }),
      setLoadingCards: (loading) => set({ isLoadingCards: loading }),
      togglePendingExport: (cardId) =>
        set((s) => ({
          pendingExport: s.pendingExport.includes(cardId)
            ? s.pendingExport.filter((id) => id !== cardId)
            : [...s.pendingExport, cardId],
        })),
      clearPendingExport: () => set({ pendingExport: [] }),
      setExporting: (exporting) => set({ isExporting: exporting }),
      setHighlightedCardId: (id) => set({ highlightedCardId: id }),
      setError: (error) => set({ error }),
    }),
    {
      name: "edn-anki-storage",
      partialize: (state) => ({ collectionPath: state.collectionPath }),
    }
  )
);
