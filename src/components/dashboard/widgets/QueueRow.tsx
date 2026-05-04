interface QueueRowProps {
  item: string;
  name: string;
  cards: number;
  due: string;
  hot?: boolean;
  done?: boolean;
}

export function QueueRow({ item, name, cards, due, hot, done }: QueueRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 4px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--edn-accent-fg)",
          background: "var(--edn-accent-bg)",
          padding: "2px 7px",
          borderRadius: 4,
          fontWeight: 600,
        }}
      >
        {item}
      </span>
      <div
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 500,
          color: done ? "var(--fg-3)" : "var(--fg-1)",
          textDecoration: done ? "line-through" : "none",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </div>
      <span style={{ fontSize: 12, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{cards} cartes</span>
      <span
        style={{
          fontSize: 12,
          color: hot ? "var(--danger-fg)" : "var(--fg-3)",
          width: 70,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {due}
      </span>
    </div>
  );
}
