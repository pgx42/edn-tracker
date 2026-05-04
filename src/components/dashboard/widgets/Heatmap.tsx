import { useRef, useState, type CSSProperties, type MouseEvent as RMouseEvent } from "react";

interface HeatmapProps {
  weeks?: number;
  cellSize?: number;
  cellGap?: number;
  /** 0-indexed cell to outline as "today" — also serves as the date anchor. */
  today?: { week: number; day: number };
  /** Date to anchor the grid on (defaults to current system date). */
  anchorDate?: Date;
  /** Optional [week][day] activity matrix in 0..1; falls back to a stable mock. */
  data?: number[][];
  /** Optional [week][day] explicit card counts; defaults to scaled intensity. */
  counts?: number[][];
  showLabels?: boolean;
  monthLabels?: boolean;
}

const days = ["L", "M", "M", "J", "V", "S", "D"];
const months = ["Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr"];

function mockValue(w: number, d: number): number {
  const v = (Math.sin(w * 0.7 + d * 1.1) + Math.cos(w * 0.3 - d * 0.5)) * 0.5 + 0.5;
  return v < 0.45 ? 0 : Math.max(0, Math.min(1, (v - 0.45) / 0.55));
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function cellDateFor(
  w: number,
  d: number,
  today: { week: number; day: number },
  anchor: Date
): Date {
  const dayDelta = (today.week - w) * 7 + (today.day - d);
  const date = new Date(anchor);
  date.setDate(date.getDate() - dayDelta);
  return date;
}

interface Tip {
  x: number;
  y: number;
  text: string;
}

export function Heatmap({
  weeks = 52,
  cellSize = 11,
  cellGap = 3,
  today = { week: 0, day: 0 },
  anchorDate,
  data,
  counts,
  showLabels = false,
  monthLabels = false,
}: HeatmapProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchor = anchorDate ?? new Date();

  const handleEnter = (w: number, d: number, e: RMouseEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const v = data?.[w]?.[d] ?? mockValue(w, d);
    const count = counts?.[w]?.[d] ?? Math.round(v * 150);
    const date = cellDateFor(w, d, today, anchor);
    const dateStr = dateFmt.format(date);
    const cardLabel = count === 0 ? "aucune carte" : count === 1 ? "1 carte" : `${count} cartes`;
    const rootRect = root.getBoundingClientRect();
    const cellRect = e.currentTarget.getBoundingClientRect();
    setTip({
      x: cellRect.left - rootRect.left + cellRect.width / 2,
      y: cellRect.top - rootRect.top,
      text: `${dateStr} — ${cardLabel}`,
    });
  };

  const handleLeaveGrid = () => setTip(null);

  const cells: JSX.Element[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const v = data?.[w]?.[d] ?? mockValue(w, d);
      const isToday = today.week === w && today.day === d;
      const bg =
        v <= 0
          ? "var(--bg-sunken)"
          : `color-mix(in oklab, var(--edn-accent) ${Math.round(20 + v * 75)}%, transparent)`;
      cells.push(
        <div
          key={`${w}-${d}`}
          onMouseEnter={(e) => handleEnter(w, d, e)}
          style={{
            width: cellSize,
            height: cellSize,
            background: bg,
            borderRadius: 2,
            outline: isToday ? "1.5px solid var(--fg-1)" : undefined,
            outlineOffset: isToday ? -0.5 : undefined,
            cursor: "pointer",
          }}
        />
      );
    }
  }

  const grid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${weeks}, ${cellSize}px)`,
    gridAutoRows: `${cellSize}px`,
    gap: cellGap,
    gridAutoFlow: "column",
  };

  return (
    <div
      ref={rootRef}
      style={{ display: "flex", alignItems: "flex-start", minWidth: 0, position: "relative", overflow: "visible" }}
      onMouseLeave={handleLeaveGrid}
    >
      {showLabels && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: `repeat(7, ${cellSize}px)`,
            gap: cellGap,
            marginRight: 6,
            paddingTop: monthLabels ? 16 : 0,
            flexShrink: 0,
          }}
        >
          {days.map((d, i) => (
            <div
              key={i}
              style={{
                fontSize: 10,
                color: "var(--fg-3)",
                height: cellSize,
                lineHeight: `${cellSize}px`,
                fontFamily: "var(--font-mono)",
                opacity: i % 2 === 1 ? 1 : 0,
              }}
            >
              {d}
            </div>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {monthLabels && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
              height: 12,
              fontSize: 10,
              color: "var(--fg-3)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {months.slice(0, Math.min(months.length, Math.max(2, Math.ceil(weeks / 4)))).map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
        )}
        <div style={grid}>{cells}</div>
      </div>

      {tip && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            left: tip.x,
            top: tip.y,
            transform: "translate(-50%, calc(-100% - 8px))",
            background: "var(--fg-1)",
            color: "var(--bg-canvas)",
            fontSize: 12,
            fontWeight: 500,
            padding: "5px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "var(--shadow-md)",
            fontVariantNumeric: "tabular-nums",
            textTransform: "capitalize",
            zIndex: 10,
          }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
