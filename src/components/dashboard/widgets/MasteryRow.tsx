interface MasteryRowProps {
  rank: number;
  n: string;
  name: string;
  spec: string;
  mastery: number;
  weak?: boolean;
  isLast?: boolean;
}

export function MasteryRow({ rank, n, name, spec, mastery, weak, isLast }: MasteryRowProps) {
  const tone = weak ? "var(--danger-fg)" : "var(--success-fg)";
  const toneBg = weak ? "var(--danger-bg)" : "var(--success-bg)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)", width: 14 }}>{rank}.</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: tone,
          background: toneBg,
          padding: "2px 6px",
          borderRadius: 4,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        #{n}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--fg-1)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 1 }}>{spec}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 36, height: 4, background: "var(--bg-sunken)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${mastery * 100}%`, height: "100%", background: tone }} />
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--fg-2)",
            fontVariantNumeric: "tabular-nums",
            width: 30,
            textAlign: "right",
            fontWeight: 500,
          }}
        >
          {Math.round(mastery * 100)}%
        </span>
      </div>
    </div>
  );
}
