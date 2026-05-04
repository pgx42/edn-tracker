import { useState } from "react";
import { ArrowRight, Check, Layers } from "lucide-react";
import { usePreferences, type StudentYear, type DashboardLayout } from "@/stores/preferences";

interface Step {
  eyebrow: string;
  title: string;
  sub: string;
  illu: "welcome" | "year" | "anki" | "layout";
}

const steps: Step[] = [
  {
    eyebrow: "1 / 4",
    title: "Bienvenue sur EDN Tracker.",
    sub: "Ton second cerveau pour préparer les EDN. PDFs, Anki, mindmaps, carnet d'erreurs — tout relié, rien à rouvrir.",
    illu: "welcome",
  },
  {
    eyebrow: "2 / 4",
    title: "Quelle année tu prépares ?",
    sub: "Pour calibrer ton compte à rebours et ta progression.",
    illu: "year",
  },
  {
    eyebrow: "3 / 4",
    title: "Connecte ton Anki.",
    sub: "On synchronise tes decks. Tu réviseras dans EDN Tracker — Anki reste la source.",
    illu: "anki",
  },
  {
    eyebrow: "4 / 4",
    title: "Choisis ton dashboard.",
    sub: "Tu pourras en changer à tout moment dans les réglages.",
    illu: "layout",
  },
];

const yearOptions: Array<{ name: StudentYear; alias: string }> = [
  { name: "DFGSM2", alias: "P2 — 2ᵉ année" },
  { name: "DFGSM3", alias: "D1 — 3ᵉ année" },
  { name: "DFASM1", alias: "D2 — 4ᵉ année" },
  { name: "DFASM2", alias: "D3 — 5ᵉ année" },
  { name: "DFASM3", alias: "D4 — concours" },
];

const layoutOptions: Array<{ id: DashboardLayout; name: string; sub: string }> = [
  { id: "cockpit", name: "Cockpit", sub: "focus aujourd'hui" },
  { id: "bureau", name: "Bureau", sub: "cahier + notes" },
  { id: "notion", name: "Modulaire", sub: "blocs réordonnables" },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const studentYear = usePreferences((s) => s.studentYear);
  const setStudentYear = usePreferences((s) => s.setStudentYear);
  const layout = usePreferences((s) => s.layout);
  const setLayout = usePreferences((s) => s.setLayout);

  const cur = steps[step];

  return (
    <div
      className="edn-root"
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-canvas)",
        padding: 24,
        fontFamily: "var(--font-ui)",
        color: "var(--fg-1)",
      }}
    >
      <div
        style={{
          width: 720,
          maxWidth: "100%",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1.1fr",
          minHeight: 480,
        }}
      >
        {/* LEFT — copy + interactive */}
        <div style={{ padding: 36, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
            <div
              style={{
                width: 22,
                height: 22,
                background: "var(--edn-accent)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={14} strokeWidth={2.2} color="white" />
            </div>
            <div style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>EDN Tracker</div>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--fg-3)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 600,
            }}
          >
            {cur.eyebrow}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.2,
              margin: "8px 0 12px",
              letterSpacing: "-0.01em",
              color: "var(--fg-1)",
            }}
          >
            {cur.title}
          </h1>
          <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.55, margin: 0 }}>{cur.sub}</p>

          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 18 }}>
              {yearOptions.map((y) => {
                const sel = studentYear === y.name;
                return (
                  <button
                    key={y.name}
                    onClick={() => setStudentYear(y.name)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      background: sel ? "var(--edn-accent-bg)" : "var(--bg-surface)",
                      border: `1px solid ${sel ? "var(--edn-accent-border)" : "var(--border-default)"}`,
                      borderRadius: 6,
                      fontSize: 13,
                      color: sel ? "var(--edn-accent-fg)" : "var(--fg-1)",
                      fontWeight: sel ? 500 : 400,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "baseline",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontWeight: 600, minWidth: 56 }}>{y.name}</span>
                    <span style={{ color: sel ? "var(--edn-accent-fg)" : "var(--fg-3)", fontSize: 12 }}>{y.alias}</span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                background: "var(--bg-sunken)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: "var(--bg-surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <Layers size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>AnkiWeb</div>
                  <div style={{ fontSize: 12, color: "var(--fg-3)" }}>OAuth · lecture/écriture</div>
                </div>
                <button
                  style={{
                    height: 28,
                    padding: "0 12px",
                    background: "var(--edn-accent)",
                    color: "#fff",
                    border: 0,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Connecter
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 18 }}>
              {layoutOptions.map((p) => {
                const sel = layout === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setLayout(p.id)}
                    style={{
                      padding: 12,
                      background: sel ? "var(--edn-accent-bg)" : "var(--bg-surface)",
                      border: `1px solid ${sel ? "var(--edn-accent-border)" : "var(--border-default)"}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <div
                      style={{
                        height: 56,
                        background: "var(--bg-sunken)",
                        borderRadius: 4,
                        marginBottom: 8,
                        display: "grid",
                        gridTemplateRows: "1fr 1fr",
                        gap: 2,
                        padding: 4,
                      }}
                    >
                      <div
                        style={{
                          background: sel ? "var(--edn-accent)" : "var(--border-default)",
                          borderRadius: 2,
                          opacity: 0.6,
                        }}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                        <div style={{ background: "var(--border-default)", borderRadius: 2, opacity: 0.4 }} />
                        <div style={{ background: "var(--border-default)", borderRadius: 2, opacity: 0.4 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{p.sub}</div>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
            <div style={{ display: "flex", gap: 4, flex: 1 }}>
              {steps.map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: i <= step ? "var(--edn-accent)" : "var(--bg-sunken)",
                  }}
                />
              ))}
            </div>
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                style={{
                  height: 34,
                  padding: "0 14px",
                  background: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: "pointer",
                  color: "var(--fg-2)",
                  fontFamily: "inherit",
                }}
              >
                Retour
              </button>
            )}
            <button
              onClick={() => (step < steps.length - 1 ? setStep((s) => s + 1) : onDone())}
              style={{
                height: 34,
                padding: "0 16px",
                background: "var(--edn-accent)",
                color: "#fff",
                border: 0,
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "inherit",
              }}
            >
              {step < steps.length - 1 ? "Suivant" : "C'est parti"}
              <ArrowRight size={12} color="white" />
            </button>
          </div>
        </div>

        {/* RIGHT — illustration */}
        <div
          style={{
            background: "var(--bg-sunken)",
            padding: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at center, var(--edn-accent-bg), transparent 70%)",
              opacity: 0.6,
            }}
          />
          {cur.illu === "welcome" && <WelcomeIllu />}
          {cur.illu === "year" && <YearIllu />}
          {cur.illu === "anki" && <AnkiIllu />}
          {cur.illu === "layout" && <LayoutIllu />}
        </div>
      </div>
    </div>
  );
}

function WelcomeIllu() {
  const stickies: Array<{ bg: string; color: string; rotate: string; x: number; text: string; size: number }> = [
    { bg: "var(--hl-yellow)", color: "var(--slate-900)", rotate: "rotate(-3deg)", x: 0, text: "42 cartes en retard", size: 18 },
    { bg: "var(--hl-blue)", color: "var(--blue-900)", rotate: "rotate(2deg) translateX(40px)", x: 40, text: "+ 7 erreurs ouvertes", size: 16 },
    { bg: "var(--hl-rose)", color: "var(--rose-700)", rotate: "rotate(-1.5deg) translateX(-10px)", x: -10, text: "Endocrino.pdf p.38", size: 16 },
  ];
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, transform: "rotate(-2deg)" }}>
      {stickies.map((s, i) => (
        <div
          key={i}
          style={{
            background: s.bg,
            padding: "12px 14px",
            borderRadius: 4,
            boxShadow: "2px 4px 0 rgba(15,23,42,0.10)",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: s.size,
            color: s.color,
            transform: s.rotate,
            width: 180,
          }}
        >
          {s.text}
        </div>
      ))}
    </div>
  );
}

function YearIllu() {
  return (
    <div style={{ position: "relative", textAlign: "center" }}>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: 88,
          fontWeight: 400,
          color: "var(--edn-accent-fg)",
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}
      >
        J-187
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 10, fontWeight: 500 }}>EDN · 15 octobre 2026</div>
      <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>fin de D4</div>
    </div>
  );
}

function AnkiIllu() {
  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "repeat(20, 8px)",
        gridAutoRows: 8,
        gap: 2,
        transform: "rotate(-3deg)",
        padding: 12,
        background: "var(--bg-surface)",
        borderRadius: 8,
        boxShadow: "var(--shadow-md)",
      }}
    >
      {Array.from({ length: 140 }).map((_, i) => {
        const v = (Math.sin(i * 0.7) + Math.cos(i * 0.3)) * 0.5 + 0.5;
        return (
          <div
            key={i}
            style={{
              background:
                v < 0.3
                  ? "var(--bg-sunken)"
                  : `color-mix(in oklab, var(--edn-accent) ${Math.round(v * 85 + 15)}%, transparent)`,
              borderRadius: 4,
            }}
          />
        );
      })}
    </div>
  );
}

function LayoutIllu() {
  return (
    <div style={{ position: "relative", display: "flex", gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 80,
            height: 110,
            background: "var(--bg-surface)",
            border: `1px solid ${i === 0 ? "var(--edn-accent)" : "var(--border-default)"}`,
            borderRadius: 6,
            padding: 6,
            display: "grid",
            gridTemplateRows: "1fr 1fr 1fr",
            gap: 3,
            boxShadow: i === 0 ? "var(--shadow-md)" : "none",
          }}
        >
          <div
            style={{
              background: i === 0 ? "var(--edn-accent)" : "var(--border-subtle)",
              opacity: 0.6,
              borderRadius: 2,
            }}
          />
          <div style={{ background: "var(--border-subtle)", borderRadius: 2 }} />
          <div style={{ background: "var(--border-subtle)", borderRadius: 2 }} />
        </div>
      ))}
    </div>
  );
}
