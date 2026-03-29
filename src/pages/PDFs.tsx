import * as React from "react";
import { PdfViewer } from "@/components/pdf-viewer";
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
};

const docTypeLabels: Record<string, string> = {
  college: "Collège",
  poly: "Polycopié",
  lca: "LCA",
  annale: "Annale",
};

export function PDFs() {
  const { documents, activePdfId, currentPage, setActivePdf, setCurrentPage, setDocuments } =
    usePdfStore();

  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [specialtyFilter, setSpecialtyFilter] = React.useState("all");

  // Load document list from backend on mount; fall back to mock data
  React.useEffect(() => {
    invoke<PdfDocument[]>("list_pdfs")
      .then((docs) => setDocuments(docs.length > 0 ? docs : mockPdfs))
      .catch(() => setDocuments(mockPdfs));
  }, [setDocuments]);

  const activeDoc = documents.find((d) => d.id === activePdfId) ?? null;

  const specialties = Array.from(new Set(documents.map((d) => d.specialty).filter(Boolean)));

  const filteredDocs = documents.filter((doc) => {
    const q = search.toLowerCase();
    const matchSearch = !q || doc.filename.toLowerCase().includes(q);
    const matchType = typeFilter === "all" || doc.docType === typeFilter;
    const matchSpecialty = specialtyFilter === "all" || doc.specialty === specialtyFilter;
    return matchSearch && matchType && matchSpecialty;
  });

  const handleImport = async () => {
    try {
      const path = await invoke<string>("open_pdf_dialog");
      const doc = await invoke<PdfDocument>("import_pdf", { path });
      setDocuments([...documents, doc]);
      setActivePdf(doc.id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: document list */}
      <div className="w-72 shrink-0 border-r flex flex-col bg-card/50">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Documents</span>
            <Button
              variant="default"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={handleImport}
            >
              <Upload className="h-3.5 w-3.5" />
              Importer
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-8 h-7 text-xs"
            />
          </div>

          <div className="flex gap-1.5">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="college">Collège</SelectItem>
                <SelectItem value="poly">Polycopié</SelectItem>
                <SelectItem value="lca">LCA</SelectItem>
                <SelectItem value="annale">Annale</SelectItem>
              </SelectContent>
            </Select>
            {specialties.length > 0 && (
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Spécialité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {specialties.map((s) => (
                    <SelectItem key={s} value={s!} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {loadError && (
          <p className="text-xs text-destructive px-3 py-2">{loadError}</p>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-4 text-center">
              <FileText className="w-8 h-8 opacity-30" />
              <p className="text-xs">
                {documents.length === 0
                  ? "Aucun PDF importé."
                  : "Aucun document correspondant."}
              </p>
              {documents.length === 0 && (
                <Button variant="outline" size="sm" onClick={handleImport}>
                  Importer PDF
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y">
              {filteredDocs.map((doc) => (
                <li key={doc.id}>
                  <button
                    onClick={() => setActivePdf(doc.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-accent transition-colors",
                      doc.id === activePdfId && "bg-accent"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        doc.id === activePdfId ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate leading-snug">{doc.filename}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {doc.docType && (
                            <Badge className={cn("text-xs py-0 border h-4", docTypeColors[doc.docType] ?? "")}>
                              {docTypeLabels[doc.docType] ?? doc.docType}
                            </Badge>
                          )}
                          {doc.pageCount != null && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <BookOpen className="h-2.5 w-2.5" />
                              {doc.pageCount}p
                            </span>
                          )}
                          {!doc.processed && (
                            <Badge variant="secondary" className="text-xs py-0 h-4">
                              OCR
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
        <div className="px-3 py-2 border-t">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{documents.length} document{documents.length !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1">
              <Filter className="h-3 w-3" />
              {filteredDocs.length} affiché{filteredDocs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Right panel: PDF viewer */}
      <div className="flex-1 flex overflow-hidden">
        {activeDoc ? (
          <PdfViewer
            pdfPath={activeDoc.path}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <FileText className="h-16 w-16 opacity-10" />
            <div className="text-center">
              <p className="font-medium">Aucun document sélectionné</p>
              <p className="text-sm mt-1">Sélectionnez un document dans la liste ou importez un PDF</p>
            </div>
            <Button variant="outline" onClick={handleImport} className="gap-1.5">
              <Upload className="h-4 w-4" />
              Importer un PDF
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
