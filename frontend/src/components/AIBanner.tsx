import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface AIBannerProps {
  agent: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  confidence?: number;
}

export function AIBanner({ agent, title, children, action }: AIBannerProps) {
  return (
    <div
      className="ai-surface"
      style={{ padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          flexShrink: 0,
          background: "linear-gradient(135deg, var(--c-ai-2), var(--c-ai))",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          boxShadow: "var(--sh-glow-ai)",
        }}
      >
        <Icon name="sparkle" size={18} stroke={1.8} />
      </div>

      <div className="grow">
        <div className="row gap-2" style={{ marginBottom: 4 }}>
          <span className="kicker kicker--ai">{agent}</span>
        </div>
        <div style={{ font: "500 15px/1.35 var(--f-sans)", color: "var(--c-ink)" }}>{title}</div>
        {children && (
          <div
            style={{
              font: "400 13px/1.5 var(--f-sans)",
              color: "var(--c-ink-2)",
              marginTop: 4,
            }}
          >
            {children}
          </div>
        )}
      </div>

      {action}
    </div>
  );
}
