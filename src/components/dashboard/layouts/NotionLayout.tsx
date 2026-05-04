import { GripVertical, Flame, Target, AlertTriangle, Play, Plus } from "lucide-react";
import { Heatmap } from "../widgets/Heatmap";
import { StatCard } from "../widgets/StatCard";
import { QueueRow } from "../widgets/QueueRow";
import { MOCK_QUEUE, MOCK_ERRORS_BRIEF } from "../widgets/mockData";

type Block = "cta" | "cols" | "queue" | "heatmap" | "errors" | "add";

const wrap: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 8,
  padding: 18,
};

function NotionBlock({ kind }: { kind: Block }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 4, padding: "6px 0", position: "relative" }}>
      <div
        style={{
          width: 24,
          paddingTop: 18,
          color: "var(--fg-muted)",
          display: "flex",
          justifyContent: "center",
          cursor: "grab",
          opacity: 0.5,
          flexShrink: 0,
        }}
      >
        <GripVertical size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{renderBlock(kind)}</div>
    </div>
  );
}

function renderBlock(kind: Block) {
  if (kind === "cta") {
    return (
      <div style={{ ...wrap, padding: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div
          style={{
            width: 56,
            height: 56,
            background: "var(--edn-accent-bg)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--edn-accent-fg)",
            flexShrink: 0,
          }}
        >
          <Flame size={26} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>42 cartes t'attendent</div>
          <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>cardio · endo · ≈ 18 min</div>
        </div>
        <button
          style={{
            height: 32,
            padding: "0 14px",
            background: "var(--edn-accent)",
            color: "#fff",
            border: 0,
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Play size={12} fill="currentColor" />
          Réviser
        </button>
        <button
          style={{
            height: 32,
            padding: "0 14px",
            background: "transparent",
            color: "var(--fg-2)",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Plus tard
        </button>
      </div>
    );
  }
  if (kind === "cols") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <StatCard label="Série" value="14" sub="jours" tone="success" icon={Flame} />
        <StatCard label="Précision" value="78 %" sub="+4 vs sem." tone="success" icon={Target} />
        <StatCard label="Erreurs" value="7" sub="à reprendre" tone="danger" icon={AlertTriangle} />
      </div>
    );
  }
  if (kind === "queue") {
    return (
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)" }}>/file-aujourdhui</span>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginLeft: 4 }}>File du jour</h3>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--fg-3)" }}>5 items</span>
        </div>
        {MOCK_QUEUE.map((q) => (
          <QueueRow key={q.item} {...q} />
        ))}
      </div>
    );
  }
  if (kind === "heatmap") {
    return (
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)" }}>/heatmap</span>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Activité 26 sem.</h3>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--fg-3)" }}>moy. 38 min/j</span>
        </div>
        <Heatmap weeks={26} cellSize={12} />
      </div>
    );
  }
  if (kind === "errors") {
    return (
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)" }}>/erreurs</span>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Carnet d'erreurs</h3>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontSize: 12,
              color: "var(--danger-fg)",
              background: "var(--danger-bg)",
              padding: "2px 8px",
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            7 ouvertes
          </span>
        </div>
        {MOCK_ERRORS_BRIEF.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
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
            <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{e.txt}</span>
            <span style={{ fontSize: 12, color: "var(--fg-3)", flexShrink: 0 }}>{e.d}</span>
          </div>
        ))}
      </div>
    );
  }
  // add
  return (
    <div
      style={{
        border: "1px dashed var(--border-default)",
        borderRadius: 8,
        padding: 16,
        color: "var(--fg-3)",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Plus size={14} />
      <span>
        tape{" "}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            background: "var(--edn-accent-bg)",
            color: "var(--edn-accent-fg)",
            padding: "0 5px",
            borderRadius: 4,
          }}
        >
          /
        </span>{" "}
        pour ajouter un bloc — anki, pdf, mindmap, citation…
      </span>
    </div>
  );
}

export function NotionLayout() {
  const blocks: Block[] = ["cta", "cols", "queue", "heatmap", "errors", "add"];
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 40px 60px" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ marginBottom: 20, paddingLeft: 28 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--fg-3)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            5 mai 2026 · J-187
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: 40,
              fontWeight: 400,
              margin: "6px 0 0",
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            Salut Anaïs <span style={{ color: "var(--fg-3)" }}>—</span> reprends là où tu t'étais arrêtée.
          </h1>
        </div>
        {blocks.map((k, i) => (
          <NotionBlock key={i} kind={k} />
        ))}
      </div>
    </div>
  );
}
