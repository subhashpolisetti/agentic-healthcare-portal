type AvatarTone = "primary" | "ai" | "warm" | "rose" | "sage" | "sky" | "sand";

interface AvatarProps {
  name?: string;
  tone?: AvatarTone;
  size?: number;
  src?: string;
}

const palette: Record<AvatarTone, [string, string]> = {
  primary: ["oklch(0.92 0.04 180)", "oklch(0.30 0.05 180)"],
  ai:      ["oklch(0.94 0.04 295)", "oklch(0.40 0.13 295)"],
  warm:    ["oklch(0.92 0.05 60)",  "oklch(0.40 0.08 60)"],
  rose:    ["oklch(0.92 0.05 20)",  "oklch(0.42 0.10 20)"],
  sage:    ["oklch(0.92 0.04 145)", "oklch(0.40 0.06 145)"],
  sky:     ["oklch(0.92 0.04 230)", "oklch(0.40 0.08 230)"],
  sand:    ["oklch(0.94 0.025 85)", "oklch(0.40 0.04 85)"],
};

export function Avatar({ name = "?", tone = "primary", size = 36, src }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase();

  const [bg, fg] = palette[tone] ?? palette.sand;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: src ? `center/cover url(${src})` : bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--f-sans)",
        fontWeight: 600,
        fontSize: size * 0.36,
        letterSpacing: ".02em",
        flexShrink: 0,
      }}
    >
      {!src && initials}
    </div>
  );
}
