type Status = "Booked" | "Admitted" | "Discharged" | "No Show" | "Pending" | "Sent" | "Responded";

interface StatusPillProps {
  status: string;
}

const statusMap: Record<Status, { cls: string; dot: string }> = {
  Booked:     { cls: "chip--info",    dot: "var(--c-info)" },
  Admitted:   { cls: "chip--warn",    dot: "var(--c-warn)" },
  Discharged: { cls: "chip--success", dot: "var(--c-success)" },
  "No Show":  { cls: "chip--danger",  dot: "var(--c-danger)" },
  Pending:    { cls: "",              dot: "var(--c-faint)" },
  Sent:       { cls: "chip--ai",      dot: "var(--c-ai)" },
  Responded:  { cls: "chip--success", dot: "var(--c-success)" },
};

export function StatusPill({ status }: StatusPillProps) {
  const normalized = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const c = statusMap[normalized as Status] ?? statusMap.Pending;
  return (
    <span className={`chip ${c.cls}`}>
      <span
        style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }}
      />
      {normalized === "No show" ? "No Show" : normalized}
    </span>
  );
}
