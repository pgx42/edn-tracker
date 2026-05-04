import { useState } from "react";
import { Sparkles } from "lucide-react";

interface ErrorEntry {
  item: string;
  txt: string;
  d: string;
  spec: string;
  stale?: boolean;
}

const ERRORS_RECENT: ErrorEntry[] = [
  { item: "334", txt: "Confondu STEMI postérieur et inférieur", d: "il y a 2 j", spec: "Cardio" },
  { item: "232", txt: "Critères ADA vs OMS", d: "il y a 4 j", spec: "Endo" },
  { item: "226", txt: "Score Wells: cut-off à 4 ou 5 ?", d: "1 sem", spec: "Pneumo" },
];

const ERRORS_OLD: ErrorEntry[] = [
  { item: "215", txt: "Phase folliculaire vs lutéale — durée variable", d: "il y a 8 sem", spec: "Gynéco", stale: true },
  { item: "189", txt: "Critères ACR du lupus — j'oublie le 3e", d: "il y a 6 sem", spec: "Rhumato", stale: true },
  { item: "263", txt: "Protéinurie: seuils néphrotique vs glomérulaire", d: "il y a 5 sem", spec: "Néphro" },
  { item: "208", txt: "Hyperthyroïdie: TSH effondrée OU élevée ?", d: "il y a 4 sem", spec: "Endo" },
];

const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: 0 };

export function ErrorsCard() {
  const [tab, setTab] = useState<"recent" | "old">("recent");
  const list = tab === "recent" ? ERRORS_RECENT : ERRORS_OLD;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h3 style={cardTitle}>Carnet d'erreurs</h3>
        <span
          style={{
            fontSize: 12,
            color: "var(--danger-fg)",
            background: "var(--danger-bg)",
            padding: "2px 8px",
            borderRadius: 999,
            fontWeight: 500,
            marginLeft: "auto",
          }}
        >
          7 ouvertes
        </span>
      </div>
      <div style={{ display: "flex", gap: 4, padding: 2, background: "var(--bg-sunken)", borderRadius: 6, marginBottom: 6 }}>
        {(["recent", "old"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              height: 26,
              border: 0,
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              background: tab === id ? "var(--bg-surface)" : "transparent",
              color: tab === id ? "var(--fg-1)" : "var(--fg-3)",
              boxShadow: tab === id ? "var(--shadow-sm)" : "none",
              fontFamily: "inherit",
            }}
          >
            {id === "recent" ? "Récentes" : "À revoir"}
          </button>
        ))}
      </div>
      {tab === "old" && (
        <div
          style={{
            fontSize: 12,
            color: "var(--warning-fg)",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning-border)",
            borderRadius: 6,
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Sparkles size={12} />
          <span>Suggestions — pas retravaillées depuis ≥ 3 semaines</span>
        </div>
      )}
      <div>
        {list.map((e, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "8px 0",
              borderBottom: i < list.length - 1 ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--danger-fg)",
                background: "var(--danger-bg)",
                padding: "2px 7px",
                borderRadius: 4,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              #{e.item}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--fg-1)" }}>{e.txt}</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--fg-3)",
                  marginTop: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>{e.spec}</span>
                <span style={{ width: 2, height: 2, borderRadius: 4, background: "var(--fg-muted)" }} />
                <span>ajoutée {e.d}</span>
                {e.stale && <span style={{ color: "var(--warning-fg)", fontWeight: 500 }}>· jamais revue</span>}
              </div>
            </div>
            {tab === "old" && (
              <button
                style={{
                  height: 24,
                  padding: "0 9px",
                  background: "var(--edn-accent-bg)",
                  color: "var(--edn-accent-fg)",
                  border: "1px solid var(--edn-accent-border)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flexShrink: 0,
                }}
              >
                Revoir
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
