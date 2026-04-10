import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  AlertCircle,
  AlertTriangle,
  FileText,
  CreditCard,
  ChevronRight,
  BarChart2,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 224;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpecialtyWithCount {
  id: string;
  name: string;
  item_count: number;
}

interface ItemSummary {
  id: number;
  code: string;
  title: string;
  description: string | null;
  rank: string;
  error_count: number;
  specialty_ids: string | null;
}

interface ItemLinkedPdf {
  pdf_id: string;
  pdf_title: string;
  doc_type: string | null;
  anchor_id: string;
  anchor_label: string | null;
  page_number: number | null;
}

interface ItemError {
  id: string;
  title: string;
  error_type: string;
  severity: string;
  description: string | null;
  created_at: string | null;
}

interface ItemFullDetail {
  errors: ItemError[];
  linked_pdfs: ItemLinkedPdf[];
  anki_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const severityColors: Record<string, string> = {
  minor: "text-yellow-400 border-yellow-400/30",
  medium: "text-orange-400 border-orange-400/30",
  critical: "text-red-400 border-red-400/30",
};

const docTypeLabels: Record<string, string> = {
  college: "Collège",
  poly: "Poly",
  lca: "LCA",
  annale: "Annale",
  lisa: "LISA",
  other: "Autre",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function MatiereDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [specialty, setSpecialty] = React.useState<SpecialtyWithCount | null>(null);
  const [items, setItems] = React.useState<ItemSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedItem, setSelectedItem] = React.useState<ItemSummary | null>(null);
  const [detail, setDetail] = React.useState<ItemFullDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [sidebarWidth, setSidebarWidth] = React.useState(SIDEBAR_DEFAULT);
  const [search, setSearch] = React.useState("");
  const isDragging = React.useRef(false);

  // Load specialty + items list
  React.useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([
      invoke<SpecialtyWithCount[]>("get_specialties_with_count"),
      invoke<ItemSummary[]>("get_specialty_items", { specialtyId: id }),
    ])
      .then(([specs, its]) => {
        setSpecialty(specs.find((s) => s.id === id) ?? null);
        setItems(its);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setIsLoading(false));
  }, [id]);

  // Sidebar resize
  const startResize = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - startX;
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  // Load item detail when selection changes
  React.useEffect(() => {
    if (!selectedItem) { setDetail(null); return; }
    setDetailLoading(true);
    invoke<ItemFullDetail>("get_item_full_detail", {
      itemId: selectedItem.id,
      itemCode: selectedItem.code,
    })
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedItem]);

  const filteredItems = React.useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.title.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    );
  }, [items, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 flex items-center gap-2 text-red-400 text-sm p-3 bg-red-500/10 rounded-md border border-red-500/30">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }

  const specName = specialty?.name ?? id ?? "";
  const totalErrors = items.reduce((s, i) => s + i.error_count, 0);
  const itemsWithErrors = items.filter((i) => i.error_count > 0).length;
  const itemsNoDesc = items.filter((i) => !i.description).length;

  return (
    <div className="flex h-full min-h-0">
      {/* ── Sommaire sidebar ─────────────────────────────── */}
      <aside
        style={{ width: sidebarWidth }}
        className="shrink-0 flex flex-col h-full bg-sidebar border-r border-sidebar-border overflow-hidden relative"
      >
        {/* Back + title */}
        <div className="px-3 py-3 border-b border-sidebar-border shrink-0">
          <button
            onClick={() => navigate("/matieres")}
            className="flex items-center gap-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground text-xs mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Matières
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-sidebar-foreground/70 shrink-0" />
            <span className="text-sm font-semibold text-sidebar-foreground leading-tight line-clamp-2">
              {specName}
            </span>
          </div>
          <p className="text-[11px] text-sidebar-foreground/50 mt-1">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Search */}
        <div className="px-2 pt-2 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-sidebar-foreground/40 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className={cn(
                "w-full bg-sidebar-accent/40 border border-sidebar-border rounded-md",
                "pl-6 pr-2 py-1.5 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40",
                "focus:outline-none focus:ring-1 focus:ring-sidebar-primary/50"
              )}
            />
          </div>
        </div>

        {/* Overview entry */}
        <div className="px-2 pt-1 shrink-0">
          <button
            onClick={() => setSelectedItem(null)}
            className={cn(
              "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              !selectedItem && "bg-sidebar-accent text-sidebar-primary"
            )}
          >
            <BarChart2 className="h-4 w-4 shrink-0" />
            <span>Vue d'ensemble</span>
          </button>
        </div>

        <div className="px-3 py-2 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            {search ? `${filteredItems.length} résultat${filteredItems.length !== 1 ? "s" : ""}` : "Items"}
          </p>
        </div>

        {/* Item list */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={cn(
                "w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors flex items-start gap-2",
                "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                selectedItem?.id === item.id && "bg-sidebar-accent text-sidebar-primary"
              )}
            >
              <span className="font-mono text-[10px] opacity-60 mt-0.5 shrink-0">{item.code}</span>
              <span className="flex-1 leading-tight line-clamp-2">{item.title}</span>
              {item.error_count > 0 && (
                <span className="shrink-0 text-orange-400 font-semibold text-[10px] mt-0.5">
                  {item.error_count}
                </span>
              )}
            </button>
          ))}
          {filteredItems.length === 0 && search && (
            <p className="text-[11px] text-sidebar-foreground/40 px-2 py-3 text-center">Aucun résultat</p>
          )}
        </nav>

        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-sidebar-primary/40 transition-colors group"
        >
          <div className="w-px h-full bg-sidebar-border group-hover:bg-sidebar-primary/60 transition-colors" />
        </div>
      </aside>

      {/* ── Right panel ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {selectedItem === null ? (
          <OverviewPanel
            specName={specName}
            items={items}
            totalErrors={totalErrors}
            itemsWithErrors={itemsWithErrors}
            itemsNoDesc={itemsNoDesc}
            onSelectItem={setSelectedItem}
          />
        ) : (
          <ItemDetailPanel
            item={selectedItem}
            detail={detail}
            loading={detailLoading}
            onBack={() => setSelectedItem(null)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────

interface OverviewPanelProps {
  specName: string;
  items: ItemSummary[];
  totalErrors: number;
  itemsWithErrors: number;
  itemsNoDesc: number;
  onSelectItem: (item: ItemSummary) => void;
}

function OverviewPanel({ specName, items, totalErrors, itemsWithErrors, itemsNoDesc, onSelectItem }: OverviewPanelProps) {
  const errorItems = items.filter((i) => i.error_count > 0).sort((a, b) => b.error_count - a.error_count);
  const withDesc = items.filter((i) => i.description).length;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">{specName}</h1>
      <p className="text-muted-foreground text-sm mb-8">Vue d'ensemble de la matière</p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <StatCard
          label="Items"
          value={items.length}
          icon={<BookOpen className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Erreurs enregistrées"
          value={totalErrors}
          sub={itemsWithErrors > 0 ? `sur ${itemsWithErrors} item${itemsWithErrors !== 1 ? "s" : ""}` : undefined}
          icon={<AlertTriangle className="h-5 w-5 text-orange-400" />}
          accent={totalErrors > 0 ? "orange" : undefined}
        />
        <StatCard
          label="Items avec description"
          value={withDesc}
          sub={items.length > 0 ? `${Math.round((withDesc / items.length) * 100)} %` : undefined}
          icon={<FileText className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Items sans description"
          value={itemsNoDesc}
          icon={<FileText className="h-5 w-5 text-muted-foreground opacity-40" />}
          accent={itemsNoDesc > 0 ? "muted" : undefined}
        />
      </div>

      {/* Items with errors */}
      {errorItems.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Items avec erreurs
          </h2>
          <div className="flex flex-col gap-2">
            {errorItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
              >
                <span className="font-mono text-xs text-muted-foreground shrink-0">{item.code}</span>
                <span className="flex-1 text-sm font-medium">{item.title}</span>
                <Badge variant="outline" className="text-orange-400 border-orange-400/30 text-xs shrink-0">
                  {item.error_count} erreur{item.error_count !== 1 ? "s" : ""}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* All items quick list */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Tous les items
        </h2>
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectItem(item)}
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left group"
            >
              <span className="font-mono text-xs text-muted-foreground shrink-0 w-24">{item.code}</span>
              <span className="flex-1 text-sm">{item.title}</span>
              {item.error_count > 0 && (
                <span className="text-orange-400 text-xs font-medium">{item.error_count}</span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  accent?: "orange" | "muted";
}) {
  return (
    <div className="rounded-lg border bg-card px-5 py-4 flex items-center gap-4">
      {icon}
      <div>
        <p
          className={cn(
            "text-2xl font-bold",
            accent === "orange" && "text-orange-400",
            accent === "muted" && "text-muted-foreground"
          )}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/60">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Item Detail Panel ────────────────────────────────────────────────────────

interface ItemDetailPanelProps {
  item: ItemSummary;
  detail: ItemFullDetail | null;
  loading: boolean;
  onBack: () => void;
}

function ItemDetailPanel({ item, detail, loading, onBack }: ItemDetailPanelProps) {
  return (
    <div className="p-8 max-w-3xl">
      {/* Breadcrumb */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Vue d'ensemble
      </button>

      {/* Item header */}
      <div className="flex items-start gap-3 mb-6">
        <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1.5 rounded shrink-0 mt-0.5">
          {item.code}
        </span>
        <h1 className="text-xl font-bold leading-snug">{item.title}</h1>
      </div>

      {/* Description */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Description</h2>
        {item.description ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">Aucune description.</p>
        )}
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des ressources…
        </div>
      ) : detail ? (
        <>
          {/* Stats row */}
          <div className="flex items-center gap-4 mb-8 flex-wrap">
            <ResourceChip
              icon={<AlertTriangle className="h-3.5 w-3.5 text-orange-400" />}
              count={detail.errors.length}
              label="erreur"
              colorClass="text-orange-400"
            />
            <ResourceChip
              icon={<FileText className="h-3.5 w-3.5 text-blue-400" />}
              count={detail.linked_pdfs.length}
              label="PDF lié"
              colorClass="text-blue-400"
            />
            <ResourceChip
              icon={<CreditCard className="h-3.5 w-3.5 text-purple-400" />}
              count={detail.anki_count}
              label="carte Anki"
              colorClass="text-purple-400"
            />
          </div>

          {/* Errors */}
          {detail.errors.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Erreurs</h2>
              <div className="flex flex-col gap-2">
                {detail.errors.map((err) => (
                  <div key={err.id} className="rounded-lg border bg-card px-4 py-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <span className="text-sm font-medium">{err.title}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-xs shrink-0", severityColors[err.severity])}
                      >
                        {err.severity}
                      </Badge>
                    </div>
                    {err.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{err.description}</p>
                    )}
                    {err.created_at && (
                      <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                        {new Date(err.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Linked PDFs */}
          {detail.linked_pdfs.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">PDFs liés</h2>
              <div className="flex flex-col gap-2">
                {detail.linked_pdfs.map((pdf) => (
                  <div key={pdf.anchor_id} className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{pdf.pdf_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {pdf.anchor_label && <span>{pdf.anchor_label} · </span>}
                        {pdf.page_number != null && <span>p. {pdf.page_number}</span>}
                      </p>
                    </div>
                    {pdf.doc_type && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {docTypeLabels[pdf.doc_type] ?? pdf.doc_type}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Anki */}
          {detail.anki_count > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Cartes Anki</h2>
              <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-purple-400 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{detail.anki_count}</span> carte
                  {detail.anki_count !== 1 ? "s" : ""} taguée{detail.anki_count !== 1 ? "s" : ""}{" "}
                  avec le code <span className="font-mono">{item.code}</span>
                </p>
              </div>
            </section>
          )}

          {detail.errors.length === 0 && detail.linked_pdfs.length === 0 && detail.anki_count === 0 && (
            <p className="text-sm text-muted-foreground/50 italic">
              Aucune ressource liée à cet item pour le moment.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

// ─── Resource chip ────────────────────────────────────────────────────────────

function ResourceChip({
  icon,
  count,
  label,
  colorClass,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {icon}
      <span className={cn("font-semibold", colorClass)}>{count}</span>
      <span className="text-muted-foreground">
        {label}{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
