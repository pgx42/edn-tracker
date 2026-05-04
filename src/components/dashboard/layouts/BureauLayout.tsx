import { Play, Flame, Pin, FileText } from "lucide-react";
import { Heatmap } from "../widgets/Heatmap";

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--fg-3)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};
const postEyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--slate-900)",
  textTransform: "uppercase",
  letterSpacing: "0.10em",
};
const metaStyle: React.CSSProperties = { fontSize: 12, color: "var(--fg-3)" };
const postit: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 4,
  boxShadow: "2px 4px 0 rgba(15,23,42,0.10), 0 1px 2px rgba(15,23,42,0.06)",
};

export function BureauLayout() {
  const items: Array<{ n: string; t: string; sub: string; tag?: string; done?: boolean }> = [
    { n: "①", t: "Anki retard — 42 cartes", sub: "cardio + endo · ≈ 18 min", tag: "urgent" },
    { n: "②", t: "Relire SCA (#334)", sub: "p. 38–42 du polycopié" },
    { n: "③", t: "Reprendre 3 erreurs ouvertes", sub: "STEMI, ADA, Wells" },
    { n: "④", t: "Mindmap cycle ovarien", sub: "compléter axe HPO" },
    { n: "⑤", t: "Vidéo D4 — embolie pulmonaire", sub: "24 min" },
    { n: "⑥", t: "Bilan du jour", sub: "5 min", done: true },
  ];

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24, background: "var(--bg-canvas)" }}>
      <div
        style={{
          position: "relative",
          minHeight: "100%",
          padding: 28,
          background: "var(--paper, #faf7f2)",
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent, transparent 31px, color-mix(in oklab, var(--fg-3) 18%, transparent) 31px, color-mix(in oklab, var(--fg-3) 18%, transparent) 32px)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 28,
        }}
      >
        {/* LEFT — cahier */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              borderBottom: "1px dashed color-mix(in oklab, var(--fg-3) 50%, transparent)",
              paddingBottom: 8,
              marginBottom: 16,
            }}
          >
            <div>
              <div style={eyebrow}>Cahier · mardi 5 mai</div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontSize: 40,
                  fontWeight: 400,
                  margin: "4px 0 0",
                  letterSpacing: "-0.01em",
                }}
              >
                Au programme
              </h2>
            </div>
            <span style={metaStyle}>page 47</span>
          </div>

          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((it, i) => (
              <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 14, lineHeight: "32px" }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic",
                    fontSize: 24,
                    color: "var(--edn-accent-fg)",
                    width: 28,
                    fontWeight: 400,
                  }}
                >
                  {it.n}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: it.done ? "var(--fg-3)" : "var(--fg-1)",
                      textDecoration: it.done ? "line-through" : "none",
                    }}
                  >
                    {it.t}
                  </span>
                  {it.tag && (
                    <span
                      style={{
                        marginLeft: 10,
                        fontSize: 12,
                        color: "var(--danger-fg)",
                        background: "var(--danger-bg)",
                        padding: "2px 7px",
                        borderRadius: 999,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        fontWeight: 600,
                      }}
                    >
                      {it.tag}
                    </span>
                  )}
                  <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: -4 }}>{it.sub}</div>
                </div>
              </li>
            ))}
          </ol>

          <div
            style={{
              marginTop: 22,
              paddingTop: 14,
              borderTop: "1px dashed color-mix(in oklab, var(--fg-3) 50%, transparent)",
            }}
          >
            <div style={eyebrow}>Notes en marge</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-2)", marginTop: 8 }}>
              Ne pas oublier de relire les{" "}
              <span style={{ background: "var(--hl-yellow)", padding: "0 3px", color: "var(--slate-900)" }}>
                critères de Wells
              </span>{" "}
              avant le QCM blanc de samedi. Réviser en priorité{" "}
              <strong style={{ color: "var(--edn-accent-fg)" }}>cardio</strong> — c'est ce qui rapporte le plus.
            </p>
          </div>
        </div>

        {/* RIGHT — post-its */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ ...postit, background: "var(--hl-yellow)", transform: "rotate(-1.5deg)" }}>
            <div style={postEyebrow}>Anki</div>
            <div
              style={{
                fontSize: 56,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--rose-700)",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              42
            </div>
            <div style={{ fontSize: 13, color: "var(--slate-900)", marginTop: 4 }}>cartes en retard</div>
            <button
              style={{
                marginTop: 10,
                height: 28,
                padding: "0 12px",
                background: "var(--slate-900)",
                color: "#fff",
                border: 0,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "inherit",
              }}
            >
              <Play size={11} fill="currentColor" />
              Réviser
            </button>
          </div>

          <div style={{ ...postit, background: "var(--bg-surface)", transform: "rotate(0.6deg)", boxShadow: "var(--shadow-md)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Flame size={16} />
              <div style={eyebrow}>Série</div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 600 }}>14</span>
              <span style={{ fontSize: 12, color: "var(--fg-3)" }}>jours · meilleur 21</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <Heatmap weeks={14} cellSize={11} showLabels={false} monthLabels={false} />
            </div>
          </div>

          <div style={{ ...postit, background: "var(--hl-rose)", transform: "rotate(1.4deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Pin size={12} color="var(--rose-700)" />
              <div style={{ ...postEyebrow, color: "var(--rose-700)" }}>Erreurs ouvertes</div>
            </div>
            <ul
              style={{
                margin: 0,
                padding: "0 0 0 18px",
                fontSize: 13,
                color: "var(--slate-900)",
                lineHeight: 1.55,
              }}
            >
              <li>STEMI postérieur ≠ inférieur</li>
              <li>Critères ADA / OMS</li>
              <li>Score Wells, cut-off</li>
            </ul>
            <div style={{ fontSize: 12, color: "var(--rose-700)", marginTop: 6 }}>+ 4 autres</div>
          </div>

          <div style={{ ...postit, background: "var(--hl-blue)", transform: "rotate(-0.8deg)" }}>
            <div style={{ ...postEyebrow, color: "var(--blue-900)" }}>Reprendre</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <FileText size={16} color="var(--blue-900)" />
              <div style={{ fontSize: 13, fontWeight: 600, flex: 1, color: "var(--blue-900)" }}>Endocrino.pdf</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--blue-800)", marginTop: 4 }}>page 38 / 54</div>
          </div>

          <div style={{ ...postit, background: "var(--bg-surface)", transform: "rotate(0.4deg)", boxShadow: "var(--shadow-md)" }}>
            <div style={eyebrow}>Objectif EDN</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 600 }}>J-187</span>
              <span style={{ fontSize: 12, color: "var(--fg-3)" }}>· 27 %</span>
            </div>
            <div
              style={{
                height: 6,
                background: "var(--bg-sunken)",
                borderRadius: 999,
                marginTop: 8,
                overflow: "hidden",
              }}
            >
              <div style={{ width: "27%", height: "100%", background: "var(--edn-accent)" }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>100 / 362 items</div>
          </div>
        </div>
      </div>
    </div>
  );
}
