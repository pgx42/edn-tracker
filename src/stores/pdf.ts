import { create } from "zustand";
import type { PdfDocument } from "@/lib/types";

interface PdfState {
  documents: PdfDocument[];
  activePdfId: number | null;
  currentPage: number;
  zoom: number;
  isLoading: boolean;
  error: string | null;

  setDocuments: (docs: PdfDocument[]) => void;
  setActivePdf: (id: number | null) => void;
  setCurrentPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePdfStore = create<PdfState>()((set) => ({
  documents: [],
  activePdfId: null,
  currentPage: 1,
  zoom: 1.0,
  isLoading: false,
  error: null,

  setDocuments: (docs) => set({ documents: docs }),
  setActivePdf: (id) => set({ activePdfId: id, currentPage: 1 }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setZoom: (zoom) => set({ zoom }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
