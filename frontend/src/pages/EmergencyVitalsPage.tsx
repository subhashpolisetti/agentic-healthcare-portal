import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getVitalsWebSocketUrl } from "../api/client";
import { AppHeader, Icon, Sparkline } from "../components";

// ── Types ───────────────────────────────────────────────────
type MonitoringPatient = {
  patient_email: string;
  appointment_id: number;
  doctor_name: string;
  speciality: string;
  appointment_date: string;
  slot_start_time: string;
};

type VitalsPayload = {
  ts: number;
  vitals: {
    heart_rate_bpm: number;
    spo2_pct: number;
    blood_pressure: { systolic: number; diastolic: number };
    respiratory_rate: number;
    temperature_f: number;
  };
  urgency: "normal" | "high" | "critical";
  alert: boolean;
  message: string | null;
};

type AiAssessment = {
  status: string;
  abnormal_flags: { vital: string; value: string; concern: string }[];
  alert_message: string;
};

type ConnState = "connecting" | "live" | "closed" | "error";
type AlertRecord = { ts: number; urgency: string; message: string };

// ── VitalCard ────────────────────────────────────────────────
function VitalCard({
  name, value, unit, range, data, color, icon, critical, alert, ring,
}: {
  name: string;
  value: string;
  unit: string;
  range: string;
  data: number[];
  color: string;
  icon: Parameters<typeof Icon>[0]["name"];
  critical?: boolean;
  alert?: string;
  ring?: number;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "18px 20px",
        position: "relative",
        overflow: "hidden",
        border: critical ? "1px solid oklch(0.78 0.16 25)" : "1px solid var(--c-border)",
        background: critical
          ? "linear-gradient(180deg, oklch(0.985 0.018 25), var(--c-card))"
          : "var(--c-card)",
        boxShadow: critical ? "0 0 0 4px oklch(0.78 0.14 25 / .15)" : "var(--sh-1)",
      }}
    >
      {critical && (
        <div
          className="pulse"
          style={{
            position: "absolute", top: 14, right: 14,
            width: 10, height: 10, borderRadius: "50%", background: "var(--c-danger)",
            boxShadow: "0 0 0 5px oklch(0.78 0.16 25 / .25)",
          }}
        />
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row gap-2">
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: critical ? "var(--c-danger-soft)" : "var(--c-surface)",
            color: critical ? "var(--c-danger)" : color,
            display: "grid", placeItems: "center",
          }}>
            <Icon name={icon} size={15} />
          </span>
          <div className="col">
            <span style={{ font: "500 13px/1 var(--f-sans)", color: "var(--c-ink)" }}>{name}</span>
            <span style={{ font: "500 11px/1.1 var(--f-mono)", color: "var(--c-muted)", marginTop: 3 }}>{range}</span>
          </div>
        </div>
        {alert && (
          <span className="chip chip--danger" style={{ height: 20 }}>
            <Icon name="alert" size={9} color="var(--c-danger)" stroke={2.4} /> {alert}
          </span>
        )}
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginTop: 14 }}>
        <div className="col">
          <span
            className="tab-num"
            style={{
              font: `500 ${value.length > 5 ? 36 : 44}px/1 var(--f-serif)`,
              letterSpacing: "-.02em",
              color: critical ? "var(--c-danger)" : "var(--c-ink)",
            }}
          >
            {value}
            <span style={{ font: "500 14px/1 var(--f-sans)", color: "var(--c-muted)", marginLeft: 6 }}>{unit}</span>
          </span>
          <span style={{
            font: "500 11px/1 var(--f-mono)",
            color: critical ? "var(--c-danger)" : "var(--c-muted)",
            letterSpacing: ".04em", marginTop: 6,
          }}>
            {critical ? "● CRITICAL" : "● in range"}
          </span>
        </div>

        {typeof ring === "number" && (
          <div style={{ width: 64, height: 64, position: "relative" }}>
            <svg width={64} height={64}>
              <circle cx="32" cy="32" r="26" stroke="var(--c-surface)" strokeWidth="6" fill="none" />
              <circle
                cx="32" cy="32" r="26"
                stroke={critical ? "var(--c-danger)" : color}
                strokeWidth="6" fill="none"
                strokeLinecap="round"
                strokeDasharray={`${ring * 1.63} 200`}
                transform="rotate(-90 32 32)"
              />
            </svg>
            <span
              className="tab-num"
              style={{
                position: "absolute", inset: 0, display: "grid", placeItems: "center",
                font: "500 14px/1 var(--f-mono)",
                color: critical ? "var(--c-danger)" : color,
              }}
            >
              {ring}%
            </span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <Sparkline data={data} color={critical ? "var(--c-danger)" : color} width={260} height={42} />
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export function EmergencyVitalsPage() {
  const navigate = useNavigate();
  const [conn, setConn] = useState<ConnState>("connecting");
  const [latest, setLatest] = useState<VitalsPayload | null>(null);
  const [lastAlerts, setLastAlerts] = useState<AlertRecord[]>([]);
  const [aiAssessment, setAiAssessment] = useState<AiAssessment | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString("en-US", { hour12: true }));

  const wsRef = useRef<WebSocket | null>(null);
  const lastAiCallRef = useRef<number>(0);
  const AI_DEBOUNCE_MS = 30_000;

  const monitoringPatient: MonitoringPatient | null = (() => {
    try {
      const raw = localStorage.getItem("monitoring_patient");
      return raw ? (JSON.parse(raw) as MonitoringPatient) : null;
    } catch { return null; }
  })();

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-US", { hour12: true })), 1000);
    return () => clearInterval(t);
  }, []);

  // Sparkline history per vital (rolling 12 values)
  const [hrHistory, setHrHistory]   = useState<number[]>([72, 74, 73, 75, 74, 76, 75, 74, 73, 75, 74, 75]);
  const [spo2History, setSpo2History] = useState<number[]>([97, 97, 96, 97, 97, 96, 97, 97, 96, 97, 97, 97]);
  const [bpHistory, setBpHistory]   = useState<number[]>([120, 122, 121, 120, 123, 122, 121, 122, 120, 121, 122, 122]);
  const [rrHistory, setRrHistory]   = useState<number[]>([16, 17, 16, 17, 18, 17, 16, 17, 16, 16, 17, 16]);
  const [tmpHistory, setTmpHistory] = useState<number[]>([98.4, 98.5, 98.4, 98.5, 98.6, 98.5, 98.6, 98.5, 98.6, 98.5, 98.6, 98.6]);

  const attachHandlers = useCallback((ws: WebSocket) => {
    ws.onopen  = () => setConn("live");
    ws.onclose = () => setConn("closed");
    ws.onerror = () => setConn("error");
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as VitalsPayload;
        setLatest(data);

        const v = data.vitals;
        setHrHistory  ((p) => [...p.slice(-11), v.heart_rate_bpm]);
        setSpo2History((p) => [...p.slice(-11), v.spo2_pct]);
        setBpHistory  ((p) => [...p.slice(-11), v.blood_pressure.systolic]);
        setRrHistory  ((p) => [...p.slice(-11), v.respiratory_rate]);
        setTmpHistory ((p) => [...p.slice(-11), v.temperature_f]);

        if (data.alert && data.message) {
          setLastAlerts((prev) =>
            [{ ts: data.ts, urgency: data.urgency, message: data.message! }, ...prev].slice(0, 8),
          );
        }

        if (data.urgency !== "normal" && Date.now() - lastAiCallRef.current > AI_DEBOUNCE_MS) {
          lastAiCallRef.current = Date.now();
          setAiLoading(true);
          apiFetch<AiAssessment>("/agents/emergency/assess", {
            method: "POST",
            body: JSON.stringify({
              patient_name:  monitoringPatient?.patient_email ?? "Patient",
              heart_rate:    v.heart_rate_bpm,
              spo2:          v.spo2_pct,
              bp_systolic:   v.blood_pressure.systolic,
              bp_diastolic:  v.blood_pressure.diastolic,
              temperature_f: v.temperature_f,
            }),
          })
            .then((res) => { setAiAssessment(res); setAiLoading(false); })
            .catch(() => setAiLoading(false));
        }
      } catch { /* ignore malformed */ }
    };
  }, [monitoringPatient?.patient_email]);

  useEffect(() => {
    const url = getVitalsWebSocketUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;
    attachHandlers(ws);
    return () => { ws.close(); wsRef.current = null; };
  }, [attachHandlers]);

  function reconnect() {
    setConn("connecting");
    wsRef.current?.close();
    const ws = new WebSocket(getVitalsWebSocketUrl());
    wsRef.current = ws;
    attachHandlers(ws);
  }

  const v = latest?.vitals;
  const urgency = latest?.urgency ?? "normal";
  const isCritical = urgency === "critical";

  const hrCrit   = isCritical && (v?.heart_rate_bpm ?? 0) > 110;
  const bpCrit   = isCritical && (v?.blood_pressure.systolic ?? 0) > 160;
  const spo2Crit = isCritical && (v?.spo2_pct ?? 100) < 94;
  const tmpCrit  = (v?.temperature_f ?? 0) > 100;
  const rrCrit   = (v?.respiratory_rate ?? 0) > 20;

  return (
    <div className="col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <AppHeader role="Doctor" name={monitoringPatient?.doctor_name ?? "Doctor"} />

      {/* sub-header */}
      <div style={{
        padding: "14px 32px",
        background: "var(--c-card)",
        borderBottom: "1px solid var(--c-border)",
        display: "flex", alignItems: "center", gap: 24,
        flexShrink: 0,
      }}>
        {/* WS status */}
        <span className="row gap-2" style={{
          padding: "4px 10px 4px 6px", borderRadius: 999,
          background: conn === "live" ? "var(--c-success-soft)" : conn === "connecting" ? "var(--c-warn-soft)" : "var(--c-danger-soft)",
          color: conn === "live" ? "oklch(0.38 0.10 155)" : conn === "connecting" ? "oklch(0.45 0.13 75)" : "var(--c-danger)",
          border: `1px solid ${conn === "live" ? "oklch(0.86 0.06 155)" : conn === "connecting" ? "oklch(0.86 0.08 75)" : "oklch(0.84 0.08 25)"}`,
        }}>
          <span className={conn === "live" ? "pulse" : undefined} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: conn === "live" ? "var(--c-success)" : conn === "connecting" ? "var(--c-warn)" : "var(--c-danger)",
          }} />
          <span style={{ font: "500 11px/1 var(--f-mono)", letterSpacing: ".06em" }}>
            {conn === "live" ? "WEBSOCKET · LIVE" : conn === "connecting" ? "CONNECTING…" : conn === "closed" ? "DISCONNECTED" : "ERROR"}
          </span>
        </span>

        <span style={{ height: 18, width: 1, background: "var(--c-border)" }} />

        {monitoringPatient ? (
          <div className="col">
            <span style={{ font: "600 15px/1 var(--f-sans)" }}>
              Emergency Vitals · {monitoringPatient.patient_email}
            </span>
            <span style={{ font: "400 11.5px/1.2 var(--f-sans)", color: "var(--c-muted)", marginTop: 3 }}>
              {monitoringPatient.speciality} · {monitoringPatient.appointment_date} · Dr. {monitoringPatient.doctor_name}
            </span>
          </div>
        ) : (
          <div className="col">
            <span style={{ font: "600 15px/1 var(--f-sans)" }}>Emergency Vitals Monitor</span>
            <span style={{ font: "400 11.5px/1.2 var(--f-sans)", color: "var(--c-muted)", marginTop: 3 }}>
              Live telemetry stream · not for clinical diagnosis
            </span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <span className="mono tab-num" style={{ font: "500 13px/1 var(--f-mono)", color: "var(--c-muted)" }}>
          {time}
        </span>

        {(conn === "closed" || conn === "error") && (
          <button className="btn btn--brand btn--sm" onClick={reconnect}>
            <Icon name="refresh" size={13} /> Reconnect
          </button>
        )}

        <button className="btn btn--ghost btn--sm" onClick={() => {
          localStorage.removeItem("monitoring_patient");
          navigate("/");
        }}>
          <Icon name="chev_right" size={13} color="var(--c-muted)" stroke={2} /> Back to patients
        </button>
      </div>

      {/* main grid */}
      <div style={{ flex: 1, padding: "20px 32px", overflow: "auto", background: "var(--c-bg)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, maxWidth: 1400, margin: "0 auto" }}>

          {/* left: agent banner + vitals grid */}
          <div className="col gap-3" style={{ minWidth: 0 }}>
            {/* Agent 4 banner */}
            {(aiLoading || aiAssessment) && (
              <div
                className="card"
                style={{
                  padding: "16px 18px",
                  background: aiAssessment?.status === "critical"
                    ? "linear-gradient(180deg, oklch(0.97 0.022 25), var(--c-card))"
                    : "linear-gradient(180deg, oklch(0.98 0.014 295), var(--c-card))",
                  border: aiAssessment?.status === "critical"
                    ? "1px solid oklch(0.84 0.10 25)"
                    : "1px solid oklch(0.88 0.04 295)",
                  display: "flex", gap: 14, alignItems: "flex-start",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: aiAssessment?.status === "critical" ? "var(--c-danger)" : "linear-gradient(135deg, var(--c-ai-2), var(--c-ai))",
                  color: "#fff", display: "grid", placeItems: "center",
                  boxShadow: aiAssessment?.status === "critical" ? "0 0 0 4px oklch(0.78 0.16 25 / .15)" : "var(--sh-glow-ai)",
                }}>
                  {aiAssessment?.status === "critical" ? <Icon name="alert" size={20} /> : <Icon name="sparkle" size={20} />}
                </div>
                <div className="grow">
                  <div className="row gap-2" style={{ marginBottom: 4 }}>
                    <span className={`kicker ${aiAssessment?.status === "critical" ? "" : "kicker--ai"}`}
                      style={{ color: aiAssessment?.status === "critical" ? "var(--c-danger)" : undefined }}>
                      {aiAssessment?.status === "critical" ? "⚠ Agent 04 · Emergency Monitor" : "Agent 04 · Emergency Monitor"}
                    </span>
                  </div>
                  {aiLoading && (
                    <div className="row gap-2" style={{ color: "var(--c-ai-ink)", font: "400 13px/1 var(--f-sans)" }}>
                      <span className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-ai)" }} />
                      Analyzing vitals…
                    </div>
                  )}
                  {aiAssessment && !aiLoading && (
                    <>
                      {aiAssessment.abnormal_flags.length > 0 && (
                        <div className="row gap-2" style={{ flexWrap: "wrap", marginBottom: 6 }}>
                          {aiAssessment.abnormal_flags.map((f, i) => (
                            <span key={i} className={`chip ${f.concern === "critical" ? "chip--danger" : "chip--warn"}`} style={{ height: 22 }}>
                              {f.vital}: {f.value}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ font: "500 15px/1.35 var(--f-sans)", color: "var(--c-ink)" }}>
                        {aiAssessment.alert_message}
                      </div>
                    </>
                  )}
                </div>
                {aiAssessment && (
                  <div className="col gap-2">
                    <button className="btn btn--brand btn--sm">Acknowledge</button>
                    <button className="btn btn--ghost btn--sm">Page resident</button>
                  </div>
                )}
              </div>
            )}

            {/* 2×3 vitals grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              <VitalCard
                name="Heart Rate" icon="heart"
                value={v ? String(v.heart_rate_bpm) : "—"}
                unit="bpm" range="60–100 bpm"
                data={hrHistory} color="var(--c-primary)"
                critical={hrCrit}
                alert={hrCrit ? "HIGH" : undefined}
              />
              <VitalCard
                name="Blood Pressure" icon="activity"
                value={v ? `${v.blood_pressure.systolic}/${v.blood_pressure.diastolic}` : "—"}
                unit="mmHg" range="< 130/80"
                data={bpHistory} color="var(--c-warn)"
                critical={bpCrit}
              />
              <VitalCard
                name="SpO₂" icon="droplet"
                value={v ? String(v.spo2_pct) : "—"}
                unit="%" range="≥ 95%"
                data={spo2History} color="var(--c-info)"
                critical={spo2Crit}
                alert={spo2Crit ? "LOW" : undefined}
                ring={v ? v.spo2_pct : undefined}
              />
              <VitalCard
                name="Temperature" icon="thermo"
                value={v ? String(v.temperature_f) : "—"}
                unit="°F" range="97.8–99.1"
                data={tmpHistory} color="var(--c-warn)"
                critical={tmpCrit}
              />
              <VitalCard
                name="Respiratory Rate" icon="lungs"
                value={v ? String(v.respiratory_rate) : "—"}
                unit="/min" range="12–20"
                data={rrHistory} color="var(--c-info)"
                critical={rrCrit}
              />
              <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span className="kicker">Overall status</span>
                <div className="col" style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
                  <span style={{
                    font: "600 18px/1 var(--f-sans)",
                    color: urgency === "critical" ? "var(--c-danger)" : urgency === "high" ? "var(--c-warn)" : "var(--c-success)",
                    textTransform: "uppercase", letterSpacing: ".04em",
                  }}>
                    {urgency}
                  </span>
                  <span style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--c-muted)", marginTop: 8, textAlign: "center" }}>
                    {urgency === "normal" ? "All vitals within range" : urgency === "high" ? "Monitor closely" : "Immediate attention required"}
                  </span>
                </div>
                <span className="mono" style={{ font: "500 10px/1 var(--f-mono)", color: "var(--c-faint)", textAlign: "center" }}>
                  updated live
                </span>
              </div>
            </div>

            {/* session timeline */}
            <div className="card" style={{ padding: "14px 18px" }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <span className="kicker">Session timeline · alerts</span>
                <div className="row gap-2">
                  <span className="row gap-1" style={{ font: "500 11px/1 var(--f-mono)", color: "var(--c-muted)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-danger)" }} /> alerts
                  </span>
                  <span className="row gap-1" style={{ font: "500 11px/1 var(--f-mono)", color: "var(--c-muted)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-warn)" }} /> warnings
                  </span>
                </div>
              </div>
              <div style={{ position: "relative", height: 24, background: "var(--c-surface)", borderRadius: 6 }}>
                {lastAlerts.slice(0, 5).map((a, i, arr) => (
                  <div
                    key={a.ts}
                    style={{
                      position: "absolute",
                      left: `${((arr.length - i) / arr.length) * 80 + 10}%`,
                      top: 0, bottom: 0, width: i === 0 ? 3 : 2,
                      background: a.urgency === "critical" ? "var(--c-danger)" : "var(--c-warn)",
                      boxShadow: i === 0 ? "0 0 0 4px oklch(0.78 0.16 25 / .2)" : "none",
                    }}
                  />
                ))}
                {lastAlerts.length === 0 && (
                  <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", font: "500 11px/1 var(--f-mono)", color: "var(--c-faint)" }}>
                    no alerts yet
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* right sidebar */}
          <div className="col gap-3">
            {/* alert history */}
            <div className="card" style={{ padding: "16px 18px" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="kicker">Alert history · this session</span>
                {lastAlerts.length > 0 && (
                  <span className="chip chip--danger" style={{ height: 20 }}>{lastAlerts.length}</span>
                )}
              </div>

              {lastAlerts.length === 0 && (
                <p style={{ margin: "12px 0 0", font: "400 13px/1.5 var(--f-sans)", color: "var(--c-muted)" }}>
                  No alerts yet. All vitals within range.
                </p>
              )}

              <div className="col" style={{ marginTop: 12 }}>
                {lastAlerts.map((a, i, arr) => (
                  <div
                    key={a.ts}
                    style={{
                      position: "relative", paddingLeft: 18,
                      paddingBottom: i === arr.length - 1 ? 0 : 14,
                      borderLeft: i === arr.length - 1 ? "none" : "1px dashed var(--c-border)",
                      marginLeft: 6,
                    }}
                  >
                    <span style={{
                      position: "absolute", left: -7, top: 0,
                      width: 14, height: 14, borderRadius: "50%",
                      background: a.urgency === "critical" ? "var(--c-danger)" : "var(--c-warn)",
                      border: "3px solid var(--c-card)",
                      boxShadow: i === 0 ? "0 0 0 3px oklch(0.78 0.16 25 / .2)" : "none",
                    }} />
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span style={{ font: "500 11px/1 var(--f-mono)", color: "var(--c-muted)" }}>
                        {new Date(a.ts * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                        {" · Agent 04"}
                      </span>
                      {i === 0 ? (
                        <span className="chip chip--danger" style={{ height: 18, fontSize: 9.5 }}>ACTIVE</span>
                      ) : (
                        <span style={{ font: "500 10px/1 var(--f-mono)", color: "var(--c-faint)" }}>ACK</span>
                      )}
                    </div>
                    <div style={{ font: "500 13px/1.3 var(--f-sans)", marginTop: 5, color: "var(--c-ink)" }}>
                      {a.urgency === "critical" ? "Critical vital detected" : "High urgency warning"}
                    </div>
                    <div style={{ font: "400 12px/1.45 var(--f-sans)", color: "var(--c-muted)", marginTop: 3 }}>
                      {a.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* active monitoring info */}
            <div className="card" style={{ padding: "16px 18px" }}>
              <span className="kicker">Monitoring session</span>
              <div className="col gap-2" style={{ marginTop: 10 }}>
                {[
                  { l: "WebSocket", v: conn === "live" ? "Connected" : conn },
                  { l: "Stream", v: "Simulation · live" },
                  { l: "Agent 04", v: aiAssessment ? "Active" : "Waiting" },
                  { l: "AI interval", v: "30s debounce" },
                ].map((m) => (
                  <div key={m.l} className="row" style={{ justifyContent: "space-between", font: "400 13px/1.3 var(--f-sans)" }}>
                    <span style={{ color: "var(--c-muted)" }}>{m.l}</span>
                    <span className="mono" style={{ font: "500 12px/1 var(--f-mono)", color: "var(--c-ink-2)" }}>{m.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn btn--brand btn--lg" style={{ width: "100%" }}>
              <Icon name="bell" size={15} /> Escalate to rapid response
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
