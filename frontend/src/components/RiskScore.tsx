interface RiskScoreProps {
  value: number;
  label?: string;
}

type Tier = "high" | "med" | "low";

const colors: Record<Tier, [string, string, string]> = {
  low:  ["oklch(0.95 0.03 155)", "var(--c-success)", "oklch(0.38 0.10 155)"],
  med:  ["oklch(0.96 0.045 90)", "var(--c-warn)",    "oklch(0.45 0.13 75)"],
  high: ["oklch(0.96 0.025 25)", "var(--c-danger)",  "oklch(0.46 0.16 25)"],
};

const tierLabel: Record<Tier, string> = {
  low: "Low",
  med: "Medium",
  high: "High",
};

export function RiskScore({ value, label }: RiskScoreProps) {
  const tier: Tier = value >= 70 ? "high" : value >= 35 ? "med" : "low";
  const [bg, accent, fg] = colors[tier];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "4px 10px 4px 6px",
        borderRadius: 999,
        background: bg,
        color: fg,
        border: `1px solid ${accent}`,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "#fff",
          display: "grid",
          placeItems: "center",
          font: "600 10px/1 var(--f-mono)",
          color: fg,
          border: `1.5px solid ${accent}`,
        }}
      >
        {value}
      </span>
      <span style={{ font: "500 12px/1 var(--f-sans)" }}>
        {label ?? tierLabel[tier]}
      </span>
    </div>
  );
}
