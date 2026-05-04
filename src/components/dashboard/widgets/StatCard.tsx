import type { LucideIcon } from "lucide-react";

type Tone = "danger" | "success" | "warning" | "accent" | "neutral";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
  icon?: LucideIcon;
}

function toneColor(t: Tone | undefined): string {
  switch (t) {
    case "danger":  return "var(--danger-fg)";
    case "success": return "var(--success-fg)";
    case "warning": return "var(--warning-fg)";
    case "accent":  return "var(--edn-accent-fg)";
    default:        return "var(--fg-3)";
  }
}

export function StatCard({ label, value, sub, tone, icon: Icon }: StatCardProps) {
  const c = toneColor(tone);
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 12,
            color: "var(--fg-3)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 600,
            flex: 1,
          }}
        >
          {label}
        </span>
        {Icon && (
          <span style={{ color: c, display: "inline-flex" }}>
            <Icon size={14} strokeWidth={1.75} />
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
          color: "var(--fg-1)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: c }}>{sub}</div>}
    </div>
  );
}
