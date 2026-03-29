import { cn } from "@/lib/utils";

interface SpecialtyScore {
  name: string;
  score: number; // 0-100
  shortName: string;
}

const specialtyData: SpecialtyScore[] = [
  { name: "Cardiologie", shortName: "Cardio", score: 72 },
  { name: "Pneumologie", shortName: "Pneumo", score: 85 },
  { name: "Gastroentérologie", shortName: "Gastro", score: 45 },
  { name: "Neurologie", shortName: "Neuro", score: 38 },
  { name: "Endocrinologie", shortName: "Endo", score: 68 },
  { name: "Rhumatologie", shortName: "Rhum", score: 22 },
  { name: "Infectiologie", shortName: "Infect", score: 55 },
  { name: "Urgences", shortName: "Urg", score: 60 },
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angle = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

export function SpecialtyRadar() {
  const cx = 120;
  const cy = 120;
  const maxR = 90;
  const n = specialtyData.length;
  const levels = [20, 40, 60, 80, 100];

  const angleStep = 360 / n;

  // Grid rings
  const rings = levels.map((pct) => {
    const r = (pct / 100) * maxR;
    const points = Array.from({ length: n }, (_, i) => {
      const pt = polarToCartesian(cx, cy, r, i * angleStep);
      return `${pt.x},${pt.y}`;
    }).join(" ");
    return { pct, points };
  });

  // Axis lines
  const axes = Array.from({ length: n }, (_, i) => {
    const outer = polarToCartesian(cx, cy, maxR, i * angleStep);
    return { x1: cx, y1: cy, x2: outer.x, y2: outer.y };
  });

  // Data polygon
  const dataPoints = specialtyData.map((s, i) => {
    const r = (s.score / 100) * maxR;
    return polarToCartesian(cx, cy, r, i * angleStep);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Labels
  const labels = specialtyData.map((s, i) => {
    const r = maxR + 18;
    const pt = polarToCartesian(cx, cy, r, i * angleStep);
    const angle = i * angleStep;
    const anchor: "middle" | "start" | "end" = angle < 10 || angle > 350 ? "middle" : angle < 180 ? "start" : "end";
    return { ...pt, text: s.shortName, score: s.score, anchor };
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={240} height={240} viewBox="0 0 240 240">
        {/* Grid rings */}
        {rings.map(({ pct, points }) => (
          <polygon
            key={pct}
            points={points}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={0.8}
          />
        ))}

        {/* Axis lines */}
        {axes.map((ax, i) => (
          <line
            key={i}
            x1={ax.x1} y1={ax.y1}
            x2={ax.x2} y2={ax.y2}
            stroke="hsl(var(--border))"
            strokeWidth={0.8}
          />
        ))}

        {/* Data polygon */}
        <polygon
          points={dataPolygon}
          fill="hsl(var(--primary) / 0.25)"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
        />

        {/* Data points */}
        {dataPoints.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={3} fill="hsl(var(--primary))" />
        ))}

        {/* Labels */}
        {labels.map((lb, i) => (
          <text
            key={i}
            x={lb.x}
            y={lb.y}
            textAnchor={lb.anchor}
            dominantBaseline="middle"
            fontSize={9}
            fill="hsl(var(--muted-foreground))"
          >
            {lb.text}
          </text>
        ))}

        {/* Pct labels on right axis */}
        {levels.map((pct) => {
          const pt = polarToCartesian(cx, cy, (pct / 100) * maxR, 0);
          return (
            <text key={pct} x={pt.x + 3} y={pt.y} fontSize={7} fill="hsl(var(--muted-foreground))">
              {pct}%
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs w-full max-w-xs">
        {specialtyData.map((s) => (
          <div key={s.name} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground truncate">{s.shortName}</span>
            <span
              className={cn(
                "font-mono font-semibold",
                s.score >= 70 ? "text-green-400" : s.score >= 40 ? "text-yellow-400" : "text-red-400"
              )}
            >
              {s.score}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
