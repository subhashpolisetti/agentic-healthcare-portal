import { Link, Outlet, useLocation } from "react-router-dom";
import type { AuthUser } from "../types";

type Props = {
  user: AuthUser | null;
  onLogout: () => void;
};

export function Layout({ user, onLogout }: Props) {
  const location = useLocation();
  const isDoctor = (user?.role || "").toLowerCase() === "doctor";
  const isPatient = Boolean(user && !isDoctor);
  const isEmergencyVitals = location.pathname === "/emergency-vitals";

  const doctorTabs = [
    { to: "/", label: "Clinical Decision" },
  ];
  const patientTabs = [
    { to: "/", label: "Find Doctor" },
    { to: "/appointments", label: "My Appointments" },
  ];

  const roleLabel = isDoctor ? "Doctor Portal" : isPatient ? "Patient Portal" : "";
  const roleColor = isDoctor ? "#2a9d62" : "#e04444";

  return (
    <div className="shell">
      <header className={`topbar ${isEmergencyVitals && isPatient ? "topbar--emergency" : ""}`} style={{ padding: 0, overflow: "hidden" }}>

        {/* ── Top brand row ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10, padding: "14px 18px",
          borderBottom: "1px solid rgba(167,225,196,0.35)",
        }}>
          {/* Brand left */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "linear-gradient(135deg,#2a9d62,#34c77b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, flexShrink: 0,
              boxShadow: "0 3px 10px rgba(42,157,98,0.3)",
            }}>
              ⚕️
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: "clamp(1rem, 3vw, 1.25rem)", color: "#1a3c2e", letterSpacing: "-0.01em" }}>
                  {isEmergencyVitals ? "Emergency Vitals" : "AI HealthCare Portal"}
                </span>
                {roleLabel && (
                  <span style={{
                    fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 20,
                    background: `${roleColor}18`, color: roleColor,
                    border: `1px solid ${roleColor}40`,
                  }}>
                    {roleLabel}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#e04444", fontWeight: 600, letterSpacing: "0.05em", marginTop: 1 }}>
                {isEmergencyVitals
                  ? "Live vitals monitoring"
                  : "✦ Powered by AI Agents"}
              </div>
            </div>
          </div>

          {/* Right — user info + logout */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user && (
              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1a3c2e" }}>
                  {user.full_name || user.email}
                </span>
                <span style={{ fontSize: "0.7rem", color: "#5a8a72", textTransform: "capitalize" }}>
                  {user.role}
                </span>
              </div>
            )}
            {isPatient && !isEmergencyVitals && (
              <Link
                to="/emergency-vitals"
                className="stealthEmergencyLink"
                title="Emergency vitals"
                aria-label="Open emergency vitals monitoring"
              >
                ·
              </Link>
            )}
            {!user ? (
              <Link className={location.pathname === "/auth" ? "tab active" : "tab"} to="/auth"
                style={{ minHeight: 36, padding: "6px 16px", fontSize: "0.85rem" }}>
                Login
              </Link>
            ) : (
              <button className="tab" onClick={onLogout} type="button"
                style={{ minHeight: 36, padding: "6px 16px", fontSize: "0.85rem", color: "#e04444", borderColor: "#fca5a5" }}>
                Logout
              </button>
            )}
          </div>
        </div>

        {/* ── Nav tabs row ── */}
        {user && (
          <nav style={{ display: "flex", gap: 4, padding: "8px 14px", flexWrap: "wrap", alignItems: "center" }}>
            {isDoctor && doctorTabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={location.pathname === tab.to ? "tab active" : "tab"}
                style={{ minHeight: 34, padding: "5px 14px", fontSize: "0.85rem" }}
              >
                {tab.label}
              </Link>
            ))}
            {isPatient && isEmergencyVitals && (
              <Link className="tab tab-emergencyHome" to="/"
                style={{ minHeight: 34, padding: "5px 14px", fontSize: "0.85rem" }}>
                ← Back to Home
              </Link>
            )}
            {isPatient && !isEmergencyVitals && patientTabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={location.pathname === tab.to ? "tab active" : "tab"}
                style={{ minHeight: 34, padding: "5px 14px", fontSize: "0.85rem" }}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}

      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
