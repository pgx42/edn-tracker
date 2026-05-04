import { NavLink, useLocation } from "react-router-dom";
import {
  Calendar,
  Search,
  Clock,
  Grid,
  Target,
  AlertCircle,
  Layers,
  Network,
  FileText,
  Video,
  BookOpen,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { APP_NAME } from "@/lib/constants";

function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="EDN Tracker" role="img">
      <rect x="6" y="14" width="40" height="44" rx="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <rect x="18" y="6" width="40" height="44" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M27 28 L34 35 L48 21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

interface NavEntry {
  to: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  meta?: string;
  kbd?: string;
  hot?: boolean;
  tone?: "danger";
  exact?: boolean;
  // If true, doesn't navigate — used for ⌘K search trigger
  onActivate?: () => void;
}

const pinned: NavEntry[] = [
  { to: "/", icon: Clock, label: "Aujourd'hui", count: 42, hot: true, exact: true },
  { to: "/planning", icon: Calendar, label: "Agenda" },
  { to: "/search", icon: Search, label: "Recherche", kbd: "⌘K" },
];

const sections: Array<{ group: string; list: NavEntry[] }> = [
  {
    group: "Items EDN",
    list: [
      { to: "/items", icon: Grid, label: "Tous les items" },
      { to: "/matieres", icon: Target, label: "Progression", meta: "100/362" },
      { to: "/errors", icon: AlertCircle, label: "Carnet d'erreurs", count: 7, tone: "danger" },
    ],
  },
  {
    group: "Réviser",
    list: [
      { to: "/anki", icon: Layers, label: "Anki", count: 128 },
      { to: "/diagrams", icon: Network, label: "Mindmaps" },
    ],
  },
  {
    group: "Ressources",
    list: [
      { to: "/pdfs", icon: FileText, label: "PDFs & polys" },
      { to: "/videos", icon: Video, label: "Cours vidéo" },
      { to: "/library", icon: BookOpen, label: "Bibliothèque" },
    ],
  },
];

const sidebarStyle: React.CSSProperties = {
  width: 240,
  height: "100%",
  flexShrink: 0,
  background: "var(--bg-canvas)",
  borderRight: "1px solid var(--border-subtle)",
  display: "flex",
  flexDirection: "column",
  fontFamily: "var(--font-ui)",
  color: "var(--fg-1)",
};

const brand: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "14px 16px",
  borderBottom: "1px solid var(--border-subtle)",
};

const brandMark: React.CSSProperties = {
  width: 26,
  height: 26,
  color: "var(--edn-accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const groupLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--fg-3)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  padding: "4px 8px 6px",
};

const navItemBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 8px",
  height: 30,
  fontSize: 13,
  color: "var(--fg-2)",
  background: "transparent",
  border: 0,
  borderRadius: 6,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  textDecoration: "none",
  width: "100%",
};

const navItemActive: React.CSSProperties = {
  background: "var(--bg-selected)",
  color: "var(--edn-accent-fg)",
  fontWeight: 500,
};

function NavRow({ entry, isActive }: { entry: NavEntry; isActive: boolean }) {
  const Icon = entry.icon;
  const content = (
    <>
      <Icon size={15} strokeWidth={1.75} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, textAlign: "left" }}>{entry.label}</span>
      {entry.meta && (
        <span style={{ fontSize: 12, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>
          {entry.meta}
        </span>
      )}
      {entry.count != null && (
        <span
          style={
            entry.tone === "danger" || entry.hot
              ? {
                  fontSize: 12,
                  color: "var(--danger-fg)",
                  background: "var(--danger-bg)",
                  padding: "1px 7px",
                  borderRadius: 999,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                }
              : {
                  fontSize: 12,
                  color: "var(--fg-3)",
                  fontVariantNumeric: "tabular-nums",
                  background: "var(--bg-sunken)",
                  padding: "1px 7px",
                  borderRadius: 999,
                }
          }
        >
          {entry.count}
        </span>
      )}
      {entry.kbd && <span style={{ fontSize: 12, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{entry.kbd}</span>}
    </>
  );

  // Pseudo-route entries (search) are rendered as buttons that trigger ⌘K via global handler
  if (entry.to === "/search") {
    return (
      <button
        type="button"
        style={navItemBase}
        onClick={() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <NavLink to={entry.to} end={entry.exact} style={{ textDecoration: "none" }}>
      {() => (
        <div style={isActive ? { ...navItemBase, ...navItemActive } : navItemBase}>{content}</div>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const location = useLocation();
  const isActive = (entry: NavEntry) =>
    entry.exact ? location.pathname === entry.to : location.pathname.startsWith(entry.to);

  return (
    <aside style={sidebarStyle}>
      <div style={brand}>
        <div style={brandMark}>
          <BrandMark />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--fg-1)" }}>
          {APP_NAME}
        </div>
      </div>

      <nav style={{ padding: "12px 8px", display: "flex", flexDirection: "column", gap: 16, flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {pinned.map((entry) => (
            <NavRow key={entry.to} entry={entry} isActive={isActive(entry)} />
          ))}
        </div>
        {sections.map((g) => (
          <div key={g.group} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div style={groupLabel}>{g.group}</div>
            {g.list.map((entry) => (
              <NavRow key={entry.to} entry={entry} isActive={isActive(entry)} />
            ))}
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "var(--edn-accent)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          AL
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: "var(--fg-1)",
            }}
          >
            Anaïs L.
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>DFASM2 · Paris</div>
        </div>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <NavLink
              to="/settings"
              style={{
                width: 26,
                height: 26,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: 0,
                borderRadius: 6,
                cursor: "pointer",
                color: "var(--fg-3)",
              }}
              aria-label="Réglages"
            >
              <SettingsIcon size={14} />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">Réglages</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
