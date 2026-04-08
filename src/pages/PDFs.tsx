import * as React from "react";
import { PdfViewer } from "@/components/pdf-viewer";
import { PdfImportModal } from "@/components/PdfImportModal";
import { usePdfStore } from "@/stores/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Upload, Search, BookOpen, Filter } from "lucide-react";
import type { PdfDocument } from "@/lib/types";
import { mockPdfs } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const docTypeColors: Record<string, string> = {
  college: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  poly: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  lca: "bg-green-500/20 text-green-400 border-green-500/30",
  annale: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  lisa: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  other: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const docTypeLabels: Record<string, string> = {
  college: "Collège",
  poly: "Polycopié",
  lca: "LCA",
  annale: "Annale",
  lisa: "Fiche LISA",
  other: "Autre",
};

export function PDFs() {
  const { documents, activePdfId, currentPage, setActivePdf, setCurrentPage, setDocuments } =
    usePdfStore();

  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [categorizationModalOpen, setCategorizationModalOpen] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);

  // Load document list from backend on mount; fall back to mock data
  React.useEffect(() => {
    invoke<PdfDocument[]>("list_pdfs")
      .then((docs) => setDocuments(docs.length > 0 ? docs : mockPdfs))
      .catch(() => setDocuments(mockPdfs));
  }, [setDocuments]);

  const activeDoc = documents.find((d) => d.id === activePdfId) ?? null;

  const filteredDocs = documents.filter((doc) => {
    const q = search.toLowerCase();
    const matchSearch = !q || doc.title.toLowerCase().includes(q);
    const matchType = typeFilter === "all" || doc.doc_type === typeFilter;
    return matchSearch && matchType;
  });

  const handleImport = () => {
    setCategorizationModalOpen(true);
  };

  const handleImportConfirm = async (docType: string, _specialtyId?: string, _itemId?: number) => {
    try {
      setCategorizationModalOpen(false);
      setIsImporting(true);

      const path = await invoke<string | null>("open_pdf_dialog");
      if (!path) {
        setIsImporting(false);
        return; // User cancelled the dialog
      }

      await invoke<PdfDocument>("import_pdf", {
        path,
        doc_type: docType,
      });

      // Refresh the complete list from backend
      const updatedDocs = await invoke<PdfDocument[]>("list_pdfs");
      setDocuments(updatedDocs);

      // Set active to the most recently created document
      if (updatedDocs.length > 0) {
        setActivePdf(updatedDocs[0].id);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportCancel = () => {
    setCategorizationModalOpen(false);
  };

  return !activeDoc ? (
    // Library view (full page)
    <div className="h-full flex flex-col bg-background">
      <PdfImportModal
        open={categorizationModalOpen}
        onCancel={handleImportCancel}
        onConfirm={handleImportConfirm}
        isLoading={isImporting}
      />
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Bibliothèque PDF</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={handleImport} className="gap-1.5">
          <Upload className="h-4 w-4" />
          Importer un PDF
        </Button>
      </div>

      {/* Search + filters bar */}
      <div className="px-6 py-3 border-b flex gap-3 items-center shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="college">Collège</SelectItem>
            <SelectItem value="poly">Polycopié</SelectItem>
            <SelectItem value="lca">LCA</SelectItem>
            <SelectItem value="annale">Annale</SelectItem>
            <SelectItem value="lisa">Fiche LISA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {loadError && (
          <p className="text-sm text-destructive px-6 py-3">{loadError}</p>
        )}

        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <FileText className="h-12 w-12 opacity-20" />
            <p className="text-sm">
              {documents.length === 0 ? "Aucun PDF importé." : "Aucun document correspondant."}
            </p>
            {documents.length === 0 && (
              <Button variant="outline" onClick={handleImport} className="gap-1.5">
                <Upload className="h-4 w-4" />
                Importer un PDF
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {filteredDocs.map((doc) => (
              <li key={doc.id}>
                <button
                  onClick={() => setActivePdf(doc.id)}
                  className="w-full text-left px-6 py-3 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {doc.doc_type && (
                          <Badge className={cn("text-xs py-0 border", docTypeColors[doc.doc_type] ?? "")}>
                            {docTypeLabels[doc.doc_type] ?? doc.doc_type}
                          </Badge>
                        )}
                        {doc.num_pages > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {doc.num_pages} pages
                          </span>
                        )}
                        {!doc.text_extraction_complete && (
                          <Badge variant="secondary" className="text-xs py-0">
                            OCR en cours
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Stats footer */}
      {documents.length > 0 && (
        <div className="px-6 py-3 border-t text-xs text-muted-foreground bg-muted/50 shrink-0">
          <div className="flex justify-between">
            <span>{documents.length} document{documents.length !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1">
              <Filter className="h-3 w-3" />
              {filteredDocs.length} affiché{filteredDocs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  ) : (
    // Viewer view (full page)
    <PdfViewer
      pdfPath={activeDoc.file_path}
      pdfId={activeDoc.id}
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      onBackToLibrary={() => setActivePdf(null)}
    />
  );
}
