import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { AuthUser } from "../types";
import { Icon } from "../components";

type Props = { onLogin: (user: AuthUser) => void };

function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5C7.5 2.5 4 6 4 10.5c0 3.6 2.6 6.4 6 9.4 1.1 1 2 1.6 2 1.6s.9-.6 2-1.6c3.4-3 6-5.8 6-9.4 0-4.5-3.5-8-8-8Z"
        stroke="currentColor" strokeWidth="1.4"
      />
      <path d="M9 11.2h2.1V8.8h1.8v2.4H15v1.8h-2.1V15h-1.8v-2H9v-1.8Z" fill="currentColor" />
    </svg>
  );
}


export function AuthPage({ onLogin }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [npi, setNpi] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(m: "signin" | "signup") {
    setMode(m);
    setMessage("");
  }

  type AuthResponse = { token: string; email: string; full_name: string; role: string };

  async function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          setMessage("Passwords do not match.");
          return;
        }
        const res = await apiFetch<AuthResponse>("/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password, full_name: fullName, role, npi: role === "doctor" ? npi : undefined }),
        });
        localStorage.setItem("token", res.token);
        onLogin({ id: 0, email: res.email, full_name: res.full_name, role: res.role });
        navigate("/", { replace: true });
      } else {
        const res = await apiFetch<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        localStorage.setItem("token", res.token);
        onLogin({ id: 0, email: res.email, full_name: res.full_name, role: res.role });
        navigate("/", { replace: true });
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isSuccess = message.toLowerCase().includes("success");
  const isSignUp = mode === "signup";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "var(--f-sans)" }}>

      {/* ── LEFT: problem → solution ─────────────────── */}
      <div
        style={{
          width: "46%", height: "100%", position: "relative", flexShrink: 0,
          background: "linear-gradient(160deg, oklch(0.17 0.04 222) 0%, oklch(0.12 0.03 212) 100%)",
          color: "#fff", padding: "44px 52px",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* subtle grid */}
        <svg style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none" }} aria-hidden="true">
          <defs>
            <pattern id="ag" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M0 32V0M32 0H0" stroke="currentColor" strokeWidth=".4" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ag)" />
        </svg>
        <div style={{ position: "absolute", right: -80, top: -80, width: 320, height: 320, background: "radial-gradient(circle, oklch(0.55 0.18 265 / .18), transparent 70%)", pointerEvents: "none" }} />

        {/* logo */}
        <div className="row gap-3" style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.15)",
            display: "grid", placeItems: "center",
          }}>
            <Logo size={20} />
          </div>
          <div className="col">
            <span style={{ font: "600 15px/1 var(--f-sans)", letterSpacing: "-.01em" }}>
              AI HealthCare Portal
            </span>
            <span className="mono" style={{ font: "500 9px/1.2 var(--f-mono)", opacity: 0.5, letterSpacing: ".12em", marginTop: 3 }}>
              ✦ POWERED BY AI AGENTS
            </span>
          </div>
        </div>

        {/* problem stats — the whole story */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", gap: 0 }}>
          {[
            { num: "30%",  line1: "of appointments are",    line2: "no-shows."             },
            { num: "83M",  line1: "people lack access to",    line2: "a nearby doctor."       },
            { num: "50%",  line1: "of a doctor's day",      line2: "is paperwork."          },
          ].map((item, i) => (
            <div key={item.num}>
              <div style={{ paddingBottom: 28 }}>
                <div style={{
                  font: "800 56px/1 var(--f-sans)",
                  letterSpacing: "-.035em",
                  color: "rgba(255,255,255,.95)",
                  marginBottom: 6,
                }}>
                  {item.num}
                </div>
                <div style={{ font: "400 16px/1.45 var(--f-sans)", color: "rgba(255,255,255,.50)" }}>
                  {item.line1}<br />
                  <span style={{ color: "rgba(255,255,255,.75)", fontWeight: 500 }}>{item.line2}</span>
                </div>
              </div>
              {i < 2 && (
                <div style={{ height: 1, background: "rgba(255,255,255,.08)", marginBottom: 28 }} />
              )}
            </div>
          ))}

        </div>

      </div>

      {/* ── RIGHT: auth panel ─────────────────────────── */}
      <div
        style={{
          flex: 1, height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 32, background: "var(--c-bg)", overflowY: "auto",
        }}
      >
        <div style={{ width: 420, maxWidth: "100%" }}>

          {/* mode toggle pill */}
          <div
            style={{
              display: "inline-flex", padding: 4, gap: 4,
              background: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: 999, marginBottom: 32,
            }}
          >
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  padding: "8px 18px", borderRadius: 999, border: "none", cursor: "pointer",
                  font: "500 13px/1 var(--f-sans)",
                  background: mode === m ? "var(--c-card)" : "transparent",
                  color: mode === m ? "var(--c-ink)" : "var(--c-muted)",
                  boxShadow: mode === m ? "var(--sh-1)" : "none",
                  transition: "all .15s",
                }}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <h2 style={{ font: "600 28px/1.15 var(--f-sans)", letterSpacing: "-.02em", margin: "0 0 8px" }}>
            {isSignUp ? "Create your account" : "Welcome back."}
          </h2>
          <p style={{ font: "400 14px/1.5 var(--f-sans)", color: "var(--c-muted)", margin: "0 0 28px" }}>
            {isSignUp
              ? "Pick your role to get started."
              : "Sign in to your portal. Your agents are waiting."}
          </p>

          <form onSubmit={onSubmit} className="col gap-4">
            {isSignUp && (
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input" type="text" required
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                />
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                className="input" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="input" type={showPass ? "text" : "password"} required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••" style={{ paddingRight: 44 }}
                />
                <button
                  type="button" onClick={() => setShowPass((p) => !p)}
                  style={{
                    position: "absolute", right: 6, top: 6, height: 32, width: 32,
                    display: "grid", placeItems: "center",
                    border: "none", borderRadius: 8, background: "transparent",
                    color: "var(--c-muted)", cursor: "pointer",
                  }}
                >
                  <Icon name={showPass ? "eye_off" : "eye"} size={16} />
                </button>
              </div>
            </div>

            {isSignUp && (
              <>
                <div>
                  <label className="label">Confirm Password</label>
                  <input
                    className="input" type="password" required
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                </div>

                <div>
                  <label className="label">I am a…</label>
                  <div className="row gap-3">
                    {(
                      [
                        { key: "patient", label: "Patient",   desc: "Book care",        icon: "user"   as const },
                        { key: "doctor",  label: "Clinician", desc: "Manage patients",  icon: "stetho" as const },
                      ] as const
                    ).map((r) => {
                      const active = role === r.key;
                      return (
                        <button
                          key={r.key} type="button"
                          onClick={() => { setRole(r.key); setNpi(""); }}
                          style={{
                            flex: 1, padding: "14px", borderRadius: 12, cursor: "pointer",
                            border: `1.5px solid ${active ? "var(--c-primary)" : "var(--c-border-2)"}`,
                            background: active ? "var(--c-primary-soft)" : "var(--c-card)",
                            textAlign: "left",
                          }}
                        >
                          <div className="row gap-2" style={{ marginBottom: 6 }}>
                            <Icon name={r.icon} size={18} color={active ? "var(--c-primary)" : "var(--c-muted)"} />
                            <span style={{ font: "600 14px/1 var(--f-sans)", color: active ? "var(--c-primary-ink)" : "var(--c-ink)" }}>
                              {r.label}
                            </span>
                            {active && (
                              <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "var(--c-primary)", display: "grid", placeItems: "center" }}>
                                <Icon name="check" size={12} color="#fff" stroke={2.4} />
                              </span>
                            )}
                          </div>
                          <div style={{ font: "400 12px/1.3 var(--f-sans)", color: active ? "var(--c-primary-ink)" : "var(--c-muted)" }}>
                            {r.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {role === "doctor" && (
                  <div>
                    <label className="label">
                      NPI Number
                      <span style={{ fontWeight: 400, color: "var(--c-muted)", marginLeft: 6 }}>
                        — 10-digit National Provider Identifier
                      </span>
                    </label>
                    <input
                      className="input" type="text" inputMode="numeric"
                      pattern="[0-9]{10}" maxLength={10} required
                      value={npi}
                      onChange={(e) => setNpi(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="1234567890"
                    />
                  </div>
                )}
              </>
            )}

            <button
              type="submit" disabled={busy}
              className="btn btn--brand btn--lg"
              style={{ marginTop: 4, width: "100%" }}
            >
              {busy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
              {!busy && <Icon name="arrow_right" size={16} stroke={2} />}
            </button>
          </form>

          {message && (
            <div
              style={{
                marginTop: 16, padding: "10px 14px", borderRadius: 10,
                font: "500 13px/1.5 var(--f-sans)", textAlign: "center",
                background: isSuccess ? "var(--c-success-soft)" : "var(--c-danger-soft)",
                color: isSuccess ? "oklch(0.38 0.10 155)" : "oklch(0.46 0.16 25)",
                border: `1px solid ${isSuccess ? "oklch(0.86 0.06 155)" : "oklch(0.84 0.08 25)"}`,
              }}
            >
              {message}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
