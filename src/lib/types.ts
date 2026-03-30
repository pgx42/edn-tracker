// Core domain types for EDN Tracker

export interface PdfDocument {
  id: string;
  title: string;
  file_path: string;
  doc_type?: "college" | "poly" | "lca" | "annale" | "other";
  num_pages: number;
  created_at?: string;
  has_native_text?: boolean;
  is_scanned?: boolean;
  text_extraction_complete?: boolean;
  ocr_complete?: boolean;
}

// Frontend display version (alias for compatibility)
export interface PdfDocumentDisplay extends PdfDocument {
  filename?: string; // alias for title
  path?: string; // alias for file_path
  pageCount?: number; // alias for num_pages
  importedAt?: string; // alias for created_at
  processed?: boolean; // alias for text_extraction_complete
  specialty?: string;
  thumbnailUrl?: string;
}

export interface EdnItem {
  id: number;
  code: string;
  title: string;
  description: string | null;
  specialty: string;
  rank: "A" | "B" | "C";
  status: "not_started" | "in_progress" | "mastered";
  category: string | null;
  subcategory: string | null;
  difficulty: number | null;
  notes: string | null;
  linkedPdfIds?: number[];
  linkedErrorIds?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ErrorEntry {
  id: string;
  title: string;
  item_id: number | null;
  source_anchor_id: string | null;
  error_type: "concept_confusion" | "knowledge_gap" | "calculation" | "recall";
  severity: "minor" | "medium" | "critical";
  description: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

export interface StudyGoal {
  id: number;
  title: string;
  targetDate: string;
  itemIds: number[];
  completedItemIds: number[];
  description: string | null;
}

export interface StudySession {
  id: number;
  date: string;
  duration: number; // minutes
  itemIds: number[];
  notes: string | null;
  completed: boolean;
}

export interface AnkiCard {
  id: number;
  itemId: number;
  front: string;
  back: string;
  deckName: string;
  exported: boolean;
  createdAt: string;
}

export interface GraphLink {
  source: number;
  target: number;
  weight: number;
  linkType: string;
}

export type NavPage = "dashboard" | "pdfs" | "items" | "errors" | "planning" | "settings";
