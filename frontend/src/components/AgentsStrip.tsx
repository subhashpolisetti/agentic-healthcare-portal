const AGENTS = [
  { id: 1, name: "Intake" },
  { id: 2, name: "Clinical" },
  { id: 3, name: "No-Show" },
  { id: 4, name: "Emergency" },
  { id: 5, name: "Discharge" },
  { id: 6, name: "Follow-up" },
] as const;

interface AgentsStripProps {
  activeIds?: number[];
}

export function AgentsStrip({ activeIds = [1, 2, 3, 4, 5, 6] }: AgentsStripProps) {
  return (
    <div
      style={{
        padding: "10px 32px",
        borderBottom: "1px solid var(--c-border)",
        background: "linear-gradient(180deg, oklch(0.985 0.012 295), var(--c-card))",
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexShrink: 0,
      }}
    >
      <span className="kicker kicker--ai">✦ AI Agents</span>
      <div className="row gap-4" style={{ flex: 1 }}>
        {AGENTS.map((a) => {
          const active = activeIds.includes(a.id);
          return (
            <div
              key={a.id}
              className="row gap-2"
              style={{
                font: "500 12px/1 var(--f-mono)",
                letterSpacing: ".04em",
                color: active ? "var(--c-ink)" : "var(--c-faint)",
              }}
            >
              <span className={`ai-dot ${active ? "" : "ai-dot--idle"}`} />
              <span style={{ color: "var(--c-muted)", marginRight: 2 }}>
                0{a.id}
              </span>
              {a.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
