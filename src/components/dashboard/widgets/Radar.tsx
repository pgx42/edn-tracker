interface RadarPoint {
  k: string;
  v: number; // 0..1
}

interface RadarProps {
  data: RadarPoint[];
  size?: number;
}

export function Radar({ data, size = 240 }: RadarProps) {
  const pad = 38;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - pad;
  const N = data.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const point = (i: number, v: number): [number, number] => {
    const r = R * v;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  const polyPoints = data.map((d, i) => point(i, d.v).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div style={{ display: "flex", justifyContent: "center", minWidth: 0, width: "100%" }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        style={{ maxWidth: size, display: "block" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {rings.map((r) => (
          <polygon
            key={r}
            points={data.map((_, i) => point(i, r).join(",")).join(" ")}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={r === 1 ? 1 : 0.75}
          />
        ))}
        {data.map((_, i) => {
          const [x, y] = point(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border-subtle)" strokeWidth="0.75" />;
        })}
        <polygon
          points={polyPoints}
          fill="color-mix(in oklab, var(--edn-accent) 22%, transparent)"
          stroke="var(--edn-accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {data.map((d, i) => {
          const [x, y] = point(i, d.v);
          return <circle key={i} cx={x} cy={y} r="3" fill="var(--edn-accent)" />;
        })}
        {data.map((d, i) => {
          const a = angle(i);
          const lr = R + 16;
          const lx = cx + lr * Math.cos(a);
          const ly = cy + lr * Math.sin(a);
          return (
            <g key={`l-${i}`}>
              <text
                x={lx}
                y={ly - 3}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="500"
                fill="var(--fg-2)"
                style={{ fontFamily: "var(--font-ui)" }}
              >
                {d.k}
              </text>
              <text
                x={lx}
                y={ly + 10}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fill="var(--fg-3)"
                style={{ fontFamily: "var(--font-ui)", fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(d.v * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
