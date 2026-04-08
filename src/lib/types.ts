// Core domain types for EDN Tracker

export interface PdfDocument {
  id: string;
  title: string;
  file_path: string;
  doc_type?: "college" | "poly" | "lca" | "annale" | "lisa" | "other";
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

export interface AnkiDeck {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  last_exported_at: string | null;
}

export interface AnkiNoteRecord {
  id: string;
  deck_id: string;
  deck_name?: string;
  note_type: string;
  question: string;
  answer: string;
  extra_field: string | null;
  source_pdf_ref: string | null;
  source_anchor_id: string | null;
  tags: string | null;
  anki_note_id: number | null;
  created_at: string;
  modified_at: string;
  anki_created_at: string | null;
}

export interface CreateAnkiCardInput {
  deck_id: string;
  question: string;
  answer: string;
  extra_field?: string | null;
  source_anchor_id?: string | null;
  source_pdf_ref?: string | null;
  tags?: string | null;
  note_type?: string;
}

export type AnkiCard = AnkiNoteRecord;

export interface AnkiCardCreationContext {
  prefillQuestion?: string;
  prefillAnswer?: string;
  sourceAnchorId?: string;
  sourceLabel?: string;
  sourcePdfTitle?: string;
}

export interface GraphLink {
  source: number;
  target: number;
  weight: number;
  linkType: string;
}

export interface ExcalidrawDiagram {
  id: string;
  title: string;
  file_path: string;
  diagram_json: string;
  item_ids: string | null;
  created_at: string;
  modified_at: string;
}

export type NavPage = "dashboard" | "pdfs" | "items" | "errors" | "diagrams" | "planning" | "anki" | "settings";
