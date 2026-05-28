import type { IconName } from "./Icon";
import { Icon } from "./Icon";

export interface TabItem {
  key: string;
  label: string;
  icon?: IconName;
  count?: number;
}

interface TabStripProps {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

export function TabStrip({ items, active, onChange }: TabStripProps) {
  return (
    <div
      style={{
        padding: "0 32px",
        borderBottom: "1px solid var(--c-border)",
        background: "var(--c-card)",
        display: "flex",
        gap: 4,
        alignItems: "flex-end",
        height: 48,
        flexShrink: 0,
      }}
    >
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            style={{
              position: "relative",
              padding: "0 14px",
              height: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: isActive
                ? "600 13.5px/1 var(--f-sans)"
                : "500 13.5px/1 var(--f-sans)",
              color: isActive ? "var(--c-ink)" : "var(--c-muted)",
              cursor: "pointer",
              background: "transparent",
              border: "none",
              borderRadius: 0,
              whiteSpace: "nowrap",
            }}
          >
            {it.icon && (
              <Icon
                name={it.icon}
                size={15}
                color={isActive ? "var(--c-primary)" : "currentColor"}
              />
            )}
            {it.label}
            {typeof it.count === "number" && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: "0 6px",
                  borderRadius: 9,
                  background: isActive ? "var(--c-ink)" : "var(--c-surface)",
                  color: isActive ? "#fff" : "var(--c-muted)",
                  font: "600 11px/18px var(--f-mono)",
                  textAlign: "center",
                }}
              >
                {it.count}
              </span>
            )}
            {isActive && (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -1,
                  height: 2,
                  background: "var(--c-ink)",
                  borderRadius: 2,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
