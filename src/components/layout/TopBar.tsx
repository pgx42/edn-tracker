import { useState, useEffect, useMemo } from "react";
import { Search, Bell, Plus } from "lucide-react";
import { useLocation } from "react-router-dom";
import { GlobalSearch } from "@/components/GlobalSearch";
import { usePreferences } from "@/stores/preferences";

interface HeaderMeta {
  eyebrow?: string;
  title: string;
  dateLabel?: string;
}

const ROUTE_META: Record<string, HeaderMeta> = {
  "/pdfs":     { eyebrow: "Bibliothèque",      title: "PDFs & polys" },
  "/items":    { eyebrow: "Items EDN",         title: "Tous les items" },
  "/matieres": { eyebrow: "Items EDN",         title: "Progression" },
  "/errors":   { eyebrow: "Items EDN",         title: "Carnet d'erreurs" },
  "/diagrams": { eyebrow: "Réviser",            title: "Mindmaps" },
  "/planning": { eyebrow: "Aujourd'hui",       title: "Agenda" },
  "/anki":     { eyebrow: "Réviser",            title: "Anki" },
  "/settings": { eyebrow: "Réglages",          title: "Préférences" },
};

const DASHBOARD_META: Record<string, HeaderMeta> = {
  cockpit: { eyebrow: "Cockpit · focus aujourd'hui", title: "Bonjour Anaïs.", dateLabel: "mardi 5 mai · J-187" },
  bureau:  { eyebrow: "Bureau d'étudiant",            title: "Cahier du jour", dateLabel: "mardi 5 mai" },
  notion:  { eyebrow: "Modulaire",                    title: "Tableau de bord", dateLabel: "mardi 5 mai · J-187" },
};

function deriveHeader(pathname: string, layout: string): HeaderMeta {
  if (pathname === "/") return DASHBOARD_META[layout] ?? DASHBOARD_META.cockpit;
  // exact match first, then prefix
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  for (const [prefix, meta] of Object.entries(ROUTE_META)) {
    if (pathname.startsWith(prefix + "/")) return meta;
  }
  return { title: "EDN Tracker" };
}

const headerStyle: React.CSSProperties = {
  height: 64,
  padding: "0 24px",
  display: "flex",
  alignItems: "center",
  gap: 14,
  borderBottom: "1px solid var(--border-subtle)",
  background: "var(--bg-canvas)",
  flexShrink: 0,
  minWidth: 0,
  fontFamily: "var(--font-ui)",
  color: "var(--fg-1)",
};

export function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const layout = usePreferences((s) => s.layout);
  const meta = useMemo(() => deriveHeader(location.pathname, layout), [location.pathname, layout]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header style={headerStyle}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {meta.eyebrow && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--fg-3)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {meta.eyebrow}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              color: "var(--fg-1)",
            }}
          >
            {meta.title}
          </h1>
          {meta.dateLabel && (
            <span style={{ fontSize: 12, color: "var(--fg-3)", whiteSpace: "nowrap", flexShrink: 0 }}>
              {meta.dateLabel}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => setSearchOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 32,
          padding: "0 12px",
          background: "var(--bg-sunken)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          color: "var(--fg-3)",
          fontSize: 12,
          width: 220,
          flexShrink: 1,
          minWidth: 100,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Search size={14} />
        <span style={{ flex: 1, textAlign: "left" }}>Rechercher</span>
        <span
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            padding: "1px 5px",
            border: "1px solid var(--border-subtle)",
            borderRadius: 4,
          }}
        >
          ⌘K
        </span>
      </button>

      <button
        type="button"
        aria-label="Notifications"
        style={{
          width: 32,
          height: 32,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: 0,
          borderRadius: 6,
          cursor: "pointer",
          color: "var(--fg-2)",
        }}
      >
        <Bell size={16} />
      </button>

      <button
        type="button"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 12px",
          background: "var(--edn-accent)",
          color: "#fff",
          border: 0,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <Plus size={13} strokeWidth={2.2} />
        Nouvelle session
      </button>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
