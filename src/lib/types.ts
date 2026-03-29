// Core domain types for EDN Tracker

export interface PdfDocument {
  id: number;
  filename: string;
  path: string;
  pageCount: number | null;
  importedAt: string;
  processed: boolean;
  docType?: "college" | "poly" | "lca" | "annale";
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
  id: number;
  title: string;
  itemId: number | null;
  pdfId: number | null;
  errorType: "concept_confusion" | "knowledge_gap" | "calculation_error" | "application_error" | "memory_error";
  severity: "minor" | "medium" | "critical";
  description: string;
  context: string | null;
  suggestion: string | null;
  resolved: boolean;
  createdAt: string;
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
