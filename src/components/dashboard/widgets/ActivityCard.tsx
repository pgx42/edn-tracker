import { Heatmap } from "./Heatmap";

interface Stat {
  label: string;
  value: string;
  /** When true, paints the value with the EDN accent. */
  accent?: boolean;
  /** When true, paints the value muted (e.g. zero / disabled). */
  muted?: boolean;
}

interface ActivityCardProps {
  /** Title above the grid (e.g. "X cartes en Y min aujourd'hui"). */
  title: string;
  weeks?: number;
  cellSize?: number;
  /** Where today's cell lives — outlined on the grid. */
  today?: { week: number; day: number };
  /** Year label rendered under the grid. */
  yearLabel?: string;
  /** Bottom stats row. Empty array hides the row. */
  stats?: Stat[];
}

export function ActivityCard({
  title,
  weeks = 52,
  cellSize = 11,
  today = { week: 30, day: 1 },
  yearLabel = "2026",
  stats = [],
}: ActivityCardProps) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minWidth: 0,
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontSize: 14,
          color: "var(--fg-1)",
          fontWeight: 500,
        }}
      >
        {title}
      </div>

      <div style={{ display: "flex", justifyContent: "center", overflow: "visible" }}>
        <Heatmap weeks={weeks} cellSize={cellSize} today={today} />
      </div>

      {yearLabel && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "var(--fg-3)",
            fontVariantNumeric: "tabular-nums",
            marginTop: -4,
          }}
        >
          {yearLabel}
        </div>
      )}

      {stats.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
            gap: 12,
            paddingTop: 6,
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          {stats.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 500 }}>{s.label}:</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: s.muted
                    ? "var(--fg-muted)"
                    : s.accent
                    ? "var(--edn-accent-fg)"
                    : "var(--fg-1)",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
