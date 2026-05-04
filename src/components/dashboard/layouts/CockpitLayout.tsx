import { Play, Flame, AlertTriangle, Target, Calendar } from "lucide-react";
import { ActivityCard } from "../widgets/ActivityCard";
import { StatCard } from "../widgets/StatCard";
import { Radar } from "../widgets/Radar";
import { QueueRow } from "../widgets/QueueRow";
import { MasteryRow } from "../widgets/MasteryRow";
import { ErrorsCard } from "../widgets/ErrorsCard";
import { MOCK_QUEUE, MOCK_RECENT, MASTERY_RADAR, MASTERY_TOP, MASTERY_BOTTOM } from "../widgets/mockData";

const card: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 8,
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minWidth: 0,
};
const cardHead: React.CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "space-between" };
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: 0 };
const meta: React.CSSProperties = { fontSize: 12, color: "var(--fg-3)" };

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 34,
  padding: "0 14px",
  background: "var(--edn-accent)",
  color: "#fff",
  border: 0,
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
};
const btnSecondary: React.CSSProperties = {
  height: 34,
  padding: "0 14px",
  background: "var(--bg-surface)",
  color: "var(--fg-1)",
  border: "1px solid var(--border-default)",
  borderRadius: 6,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
};

export function CockpitLayout() {
  return (
    <div
      className="cockpit-root"
      style={{ flex: 1, overflow: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}
    >
      <style>{`
        .cockpit-root { container-type: inline-size; }
        .ck-hero { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
        .ck-row2 { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }
        .ck-mastery { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 16px; }
        @container (max-width: 980px) {
          .ck-mastery { grid-template-columns: 1fr 1fr; }
          .ck-mastery > :first-child { grid-column: 1 / -1; }
        }
        @container (max-width: 760px) {
          .ck-hero, .ck-row2, .ck-mastery { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Hero */}
      <div className="ck-hero">
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at top right, var(--edn-accent-bg), transparent 60%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--fg-3)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              À faire maintenant
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
              <div
                style={{
                  fontSize: 72,
                  fontWeight: 600,
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  color: "var(--danger-fg)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                42
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 500, whiteSpace: "nowrap" }}>cartes en retard</div>
                <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2, whiteSpace: "nowrap" }}>
                  ≈ 18 min · cardio + endo
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
              <button style={btnPrimary}>
                <Play size={14} fill="currentColor" />
                Réviser maintenant
              </button>
              <button style={btnSecondary}>Plus tard</button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <StatCard label="Série" value="14" sub="jours d'affilée" tone="success" icon={Flame} />
            <StatCard label="Erreurs" value="7" sub="à retravailler" tone="danger" icon={AlertTriangle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <StatCard label="Précision" value="78 %" sub="+4 vs sem. dernière" tone="success" icon={Target} />
            <StatCard label="EDN" value="J-187" sub="100 / 362 items" icon={Calendar} />
          </div>
        </div>
      </div>

      {/* Queue + recent */}
      <div className="ck-row2">
        <div style={card}>
          <div style={cardHead}>
            <h3 style={cardTitle}>File du jour</h3>
            <span style={meta}>5 items · ≈ 1 h 20</span>
          </div>
          <div>
            {MOCK_QUEUE.map((q) => (
              <QueueRow key={q.item} {...q} />
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={cardHead}>
            <h3 style={cardTitle}>Activité récente</h3>
            <span style={meta}>7 derniers jours</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MOCK_RECENT.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: "var(--bg-sunken)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--fg-2)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={14} />
                  </span>
                  <span style={{ flex: 1, fontSize: 13, minWidth: 0 }}>{a.txt}</span>
                  <span style={{ fontSize: 12, color: "var(--fg-3)", flexShrink: 0 }}>{a.t}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mastery */}
      <div className="ck-mastery">
        <div style={card}>
          <div style={cardHead}>
            <h3 style={cardTitle}>Maîtrise par spécialité</h3>
            <span style={meta}>moyenne 64 %</span>
          </div>
          <Radar data={MASTERY_RADAR} />
        </div>
        <div style={card}>
          <div style={cardHead}>
            <h3 style={cardTitle}>Items les mieux maîtrisés</h3>
            <span style={{ fontSize: 12, color: "var(--success-fg)" }}>↑ top 5</span>
          </div>
          <div>
            {MASTERY_TOP.map((it, i) => (
              <MasteryRow key={it.n} {...it} rank={i + 1} isLast={i === MASTERY_TOP.length - 1} />
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={cardHead}>
            <h3 style={cardTitle}>Items à retravailler</h3>
            <span style={{ fontSize: 12, color: "var(--danger-fg)" }}>↓ bottom 5</span>
          </div>
          <div>
            {MASTERY_BOTTOM.map((it, i) => (
              <MasteryRow key={it.n} {...it} rank={i + 1} weak isLast={i === MASTERY_BOTTOM.length - 1} />
            ))}
          </div>
        </div>
      </div>

      {/* Activity (full width, Anki-style) */}
      <ActivityCard
        title="38 cartes en 24 min aujourd'hui (38 s/carte)"
        weeks={52}
        cellSize={11}
        today={{ week: 30, day: 1 }}
        yearLabel="2026"
        stats={[
          { label: "Moyenne quotidienne", value: "88 cartes", accent: true },
          { label: "Jours révisés", value: "20 %", accent: true },
          { label: "Plus longue série", value: "28 jours", accent: true },
          { label: "Série actuelle", value: "14 jours", accent: true },
        ]}
      />

      {/* Errors */}
      <div style={card}>
        <ErrorsCard />
      </div>
    </div>
  );
}
