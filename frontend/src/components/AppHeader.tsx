import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

interface AppHeaderProps {
  role?: "Patient" | "Doctor";
  name?: string;
  subtitle?: string;
}

function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5C7.5 2.5 4 6 4 10.5c0 3.6 2.6 6.4 6 9.4 1.1 1 2 1.6 2 1.6s.9-.6 2-1.6c3.4-3 6-5.8 6-9.4 0-4.5-3.5-8-8-8Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M9 11.2h2.1V8.8h1.8v2.4H15v1.8h-2.1V15h-1.8v-2H9v-1.8Z" fill="currentColor" />
    </svg>
  );
}

export function AppHeader({ role = "Patient", name = "User", subtitle }: AppHeaderProps) {
  const isDoctor = role === "Doctor";

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_user");
    // Hard reload so App.tsx re-reads localStorage and user state resets to null
    window.location.href = "/auth";
  }

  return (
    <header
      style={{
        height: 64,
        padding: "0 32px",
        borderBottom: "1px solid var(--c-border)",
        background: "var(--c-card)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <div className="row gap-3">
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "linear-gradient(135deg, var(--c-primary), var(--c-primary-2))",
            color: "#fff",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Logo size={20} />
        </div>
        <div className="col">
          <span style={{ font: "600 15px/1 var(--f-sans)", letterSpacing: "-.01em" }}>
            AI HealthCare{" "}
            <span style={{ color: "var(--c-muted)", fontWeight: 500 }}>Portal</span>
          </span>
          <span
            className="mono"
            style={{
              font: "500 10px/1.2 var(--f-mono)",
              color: "var(--c-ai-ink)",
              letterSpacing: ".08em",
              marginTop: 3,
            }}
          >
            ✦ POWERED BY AI AGENTS
          </span>
        </div>
      </div>

      <div className="row gap-4">
        <span className={`chip ${isDoctor ? "chip--ai" : "chip--primary"}`}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isDoctor ? "var(--c-ai)" : "var(--c-primary)",
            }}
          />
          {role}
        </span>
        <div className="row gap-2">
          <Avatar name={name} tone={isDoctor ? "ai" : "primary"} size={32} />
          <div className="col" style={{ lineHeight: 1.15 }}>
            <span style={{ font: "500 13px/1.2 var(--f-sans)" }}>{name}</span>
            <span style={{ font: "400 11px/1.2 var(--f-sans)", color: "var(--c-muted)" }}>
              {subtitle ?? (isDoctor ? "Clinician" : "Patient")}
            </span>
          </div>
        </div>
        <button className="btn btn--ghost btn--sm" style={{ height: 34 }} onClick={handleLogout}>
          <Icon name="logout" size={14} /> Logout
        </button>
      </div>
    </header>
  );
}
