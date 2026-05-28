import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { cleanDoctorName } from "../utils/cleanName";
import { apiFetch, ssePost } from "../api/client";
import type { AuthUser, DoctorMatch, IntakeAnalysis } from "../types";
import {
  AppHeader, TabStrip, AIBanner, Avatar, Icon, StatusPill,
} from "../components";
import type { TabItem } from "../components";

const PATIENT_TABS: TabItem[] = [
  { key: "book",  label: "Book Appointment", icon: "plus" },
  { key: "appts", label: "My Appointments",  icon: "calendar" },
];

const QUICK_CHIPS = [
  "Sinus pressure", "Sleep trouble", "Lower back pain",
  "Anxiety check-in", "Skin rash", "Telehealth follow-up",
];

const TRUST_STATS = [
  { n: "1.6M", l: "NPI-verified providers" },
  { n: "Top 5", l: "specialists matched per search" },
  { n: "< 3s", l: "AI analysis time" },
];

const ANALYSIS_STEPS = [
  "Parsing symptom timeline and onset pattern",
  "Cross-referencing against 4,966 similar presentations",
  "Filtering specialists by location and availability",
  "Ranking by match score and no-show risk",
];

type ChatMsg = { role: "agent" | "user"; text: string };
type QAPair  = { question: string; answer: string };

function buildEnrichedSymptoms(symptoms: string, qa: QAPair[]): string {
  if (!qa.length) return symptoms;
  const answers = qa.map((p) => `Q: ${p.question}\nA: ${p.answer}`).join("\n\n");
  return `${symptoms}\n\nPatient intake answers:\n\n${answers}`;
}

type Props = { user: AuthUser | null };

const INTAKE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function clearIntakeSession() {
  ["intake_symptoms", "intake_chat", "intake_qa", "intake_done", "intake_ts"].forEach(
    (k) => sessionStorage.removeItem(k),
  );
}

function intakeSessionFresh(): boolean {
  const ts = sessionStorage.getItem("intake_ts");
  if (!ts) return false;
  return Date.now() - Number(ts) < INTAKE_TTL_MS;
}

export function BookingPage({ user }: Props) {
  const [symptoms, setSymptoms] = useState(() => {
    if (!intakeSessionFresh()) { clearIntakeSession(); return ""; }
    return sessionStorage.getItem("intake_symptoms") ?? "";
  });
  const [patientAge, setPatientAge]       = useState<number>(27);
  const [patientGender, setPatientGender] = useState("female");
  const [patientZip, setPatientZip]       = useState("");
  const [searchRadius, setSearchRadius]   = useState(75);
  const [zipStatus, setZipStatus]         = useState("Detecting ZIP…");
  const [zipError, setZipError]           = useState(false);
  const [zipEditable, setZipEditable]     = useState(false);

  // sequential chat — restored from sessionStorage on refresh
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("intake_chat") ?? "[]"); } catch { return []; }
  });
  const [qaHistory, setQaHistory] = useState<QAPair[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("intake_qa") ?? "[]"); } catch { return []; }
  });
  const [currentInput, setCurrentInput] = useState("");
  const [chatDone, setChatDone] = useState(() => sessionStorage.getItem("intake_done") === "1");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // persist entire intake session to sessionStorage
  useEffect(() => { sessionStorage.setItem("intake_symptoms", symptoms); sessionStorage.setItem("intake_ts", String(Date.now())); }, [symptoms]);
  useEffect(() => { sessionStorage.setItem("intake_chat",     JSON.stringify(chatHistory)); }, [chatHistory]);
  useEffect(() => { sessionStorage.setItem("intake_qa",       JSON.stringify(qaHistory));   }, [qaHistory]);
  useEffect(() => { sessionStorage.setItem("intake_done",     chatDone ? "1" : "0");        }, [chatDone]);

  const [insightOpen, setInsightOpen] = useState(false);

  // booking
  const [selected, setSelected]       = useState<DoctorMatch | null>(null);
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10));
  const [slot, setSlot]               = useState("");
  const [bookMessage, setBookMessage] = useState("");

  // calendar (step 4)
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());

  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // auto-scroll chat to bottom whenever a new message appears
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // ── Geolocation ZIP detect ────────────────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setZipStatus("Location not supported — enter ZIP manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await apiFetch<{ zip_code: string }>(
            `/location/reverse-zip?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
            { method: "POST" },
          );
          if (res?.zip_code) {
            setPatientZip((prev) => prev || res.zip_code);
            setZipError(false);
            setZipStatus(`ZIP auto-detected: ${res.zip_code}`);
          } else {
            setZipStatus("Could not detect ZIP — enter manually.");
            setZipEditable(true);
          }
        } catch {
          setZipStatus("Could not detect ZIP — enter manually.");
          setZipEditable(true);
        }
      },
      () => { setZipStatus("Location denied — enter ZIP manually."); setZipEditable(true); },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }, []);

  // ── SSE streaming state ───────────────────────────────────
  const [isStreaming, setIsStreaming]     = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [sseError, setSseError]           = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const streamNextQuestion = useCallback(async (history: QAPair[], isFirst = false) => {
    // Cancel any in-flight SSE
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsStreaming(true);
    setStreamingText("");
    setSseError(false);

    if (isFirst) {
      setChatHistory((prev) => [
        ...prev,
        { role: "agent", text: "Thanks for sharing that. I have a few quick questions to help me find the right specialist for you." },
      ]);
    }

    let accumulated = "";

    try {
      for await (const { event, data } of ssePost("/agents/intake/stream-question", { symptoms, history })) {
        if (event === "status") {
          const parsed = JSON.parse(data) as { done: boolean; question_number: number };
          if (parsed.done) {
            setChatDone(true);
            setChatHistory((prev) => [
              ...prev,
              { role: "agent", text: "Thank you! I have everything I need. Let me find the best specialists for you." },
            ]);
            setIsStreaming(false);
            setStreamingText("");
            return;
          }
        } else if (event === "token") {
          const token = JSON.parse(data) as string;
          accumulated += token;
          setStreamingText(accumulated);   // live update — user sees text appear
        } else if (event === "end") {
          const question = accumulated.trim();
          if (question) {
            setChatHistory((prev) => [...prev, { role: "agent", text: question }]);
          }
          setStreamingText("");
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[SSE] stream failed:", err);
      setSseError(true);
    } finally {
      setIsStreaming(false);
      setStreamingText("");
    }
  }, [symptoms]);

  // ── Intake analyze ────────────────────────────────────────
  const intakeMutation = useMutation({
    mutationFn: () => {
      const enriched = buildEnrichedSymptoms(symptoms, qaHistory);
      return apiFetch<IntakeAnalysis>("/agents/intake/analyze", {
        method: "POST",
        body: JSON.stringify({
          symptoms:       enriched,
          patient_zip:    patientZip,
          patient_age:    patientAge,
          patient_gender: patientGender,
          radius_miles:   searchRadius,
        }),
      });
    },
    onSuccess: () => { setSelected(null); setSlot(""); setBookMessage(""); },
  });

  // ── Slots ─────────────────────────────────────────────────
  const slotsMutation = useMutation({
    mutationFn: (npi: string) =>
      apiFetch<{ available_slots: string[] }>(`/doctors/${npi}/slots?appointment_date=${date}`),
  });

  // ── Book ──────────────────────────────────────────────────
  const bookMutation = useMutation({
    mutationFn: () => {
      const chiefComplaint = buildEnrichedSymptoms(symptoms, qaHistory);
      return apiFetch<{ message: string }>("/appointments", {
        method: "POST",
        body: JSON.stringify({
          doctor_name:      selected ? cleanDoctorName(selected.doctor_name) : "",
          npi:              selected?.npi ?? "",
          speciality:       selected?.speciality ?? "",
          city:             selected?.city ?? "",
          state:            selected?.state ?? "",
          zip:              selected?.zip ?? "",
          phone:            selected?.phone ?? "",
          appointment_date: date,
          slot_start_time:  slot,
          chief_complaint:  chiefComplaint,
        }),
      });
    },
    onSuccess: () => {
      clearIntakeSession();
      navigate("/appointments?filter=upcoming");
    },
    onError: (err) => setBookMessage((err as Error).message),
  });

  // ── User sends a chat reply ───────────────────────────────
  function sendAnswer() {
    const text = currentInput.trim();
    if (!text || isStreaming) return;

    const agentMessages = chatHistory.filter((m) => m.role === "agent");
    const lastQuestion  = agentMessages[agentMessages.length - 1]?.text ?? "";

    setChatHistory((prev) => [...prev, { role: "user", text }]);
    setCurrentInput("");

    const updatedQA = [...qaHistory, { question: lastQuestion, answer: text }];
    setQaHistory(updatedQA);

    void streamNextQuestion(updatedQA);
  }

  // ── Start conversation ────────────────────────────────────
  function startChat() {
    setChatHistory([{ role: "user", text: symptoms }]);
    setQaHistory([]);
    setChatDone(false);
    setCurrentInput("");
    void streamNextQuestion([], true);
  }

  // ── Reset everything ──────────────────────────────────────
  function resetAll() {
    abortRef.current?.abort();
    intakeMutation.reset();
    setChatHistory([]);
    setQaHistory([]);
    setChatDone(false);
    setCurrentInput("");
    setStreamingText("");
    sessionStorage.removeItem("intake_symptoms");
    sessionStorage.removeItem("intake_chat");
    sessionStorage.removeItem("intake_qa");
    sessionStorage.removeItem("intake_done");
  }

  const intake  = intakeMutation.data;
  const doctors: DoctorMatch[] = intake?.doctors ?? [];

  const chatStarted = chatHistory.length > 0;
  const step = selected ? 4
    : intake ? 3
    : intakeMutation.isPending ? 2
    : chatStarted ? 1.6
    : 1;

  // ── Step 1 — symptom input ────────────────────────────────
  if (step === 1) return (
    <div className="col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <AppHeader role="Patient" name={user?.full_name ?? "Patient"} />
      <TabStrip items={PATIENT_TABS} active="book" onChange={(key) => key === "appts" && navigate("/appointments")} />
      <div style={{ flex: 1, padding: "40px 64px", overflow: "auto" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <span className="kicker">Step 1 of 4 · Symptom Assessment</span>
          <h1 style={{ font: "600 28px/1.3 var(--f-sans)", margin: "10px 0 8px", letterSpacing: "-.01em", color: "var(--c-ink)" }}>
            Describe your symptoms
          </h1>
          <p style={{ font: "400 14px/1.6 var(--f-sans)", color: "var(--c-muted)", margin: "0 0 24px", maxWidth: 560 }}>
            Our AI intake agent assesses urgency, interprets clinical context, and matches you with the right specialist from 1.6M NPI-verified US providers — in seconds.
          </p>

          <div className="card" style={{ padding: 16, position: "relative" }}>
            <textarea
              ref={textareaRef}
              className="textarea"
              rows={5}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && symptoms.trim()) {
                  e.preventDefault();
                  startChat();
                }
              }}
              placeholder="e.g. For the past 3 days I've had tight chest pressure that comes and goes after climbing stairs…"
              style={{ font: "400 16px/1.55 var(--f-sans)", border: "none", padding: "0 0 48px 0", minHeight: 120, width: "100%", resize: "none", outline: "none" }}
            />

            {/* bottom toolbar */}
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="row gap-2">
                {zipEditable ? (
                  <div className="row gap-1" style={{ alignItems: "center", height: 30, border: "1.5px solid var(--c-warn, #f59e0b)", borderRadius: 8, padding: "0 8px", background: "var(--c-card)" }}>
                    <Icon name="pin" size={13} color="var(--c-warn, #f59e0b)" />
                    <input
                      type="text"
                      value={patientZip}
                      maxLength={5}
                      placeholder="ZIP"
                      onChange={(e) => setPatientZip(e.target.value.replace(/\D/g, ""))}
                      style={{ width: 56, border: "none", outline: "none", font: "500 13px/1 var(--f-sans)", background: "transparent", color: "var(--c-ink)" }}
                    />
                  </div>
                ) : (
                  <button className="btn btn--ghost btn--sm" style={{ height: 30 }} onClick={() => setZipEditable(true)}>
                    <Icon name="pin" size={13} /> {patientZip || "Detecting ZIP…"}
                  </button>
                )}
                <select
                  value={searchRadius}
                  onChange={(e) => setSearchRadius(Number(e.target.value))}
                  style={{ height: 30, borderRadius: 8, border: "1px solid var(--c-border-2)", background: "transparent", font: "500 13px/1 var(--f-sans)", padding: "0 8px", color: "var(--c-ink-2)", cursor: "pointer" }}
                >
                  <option value={10}>Within 10 mi</option>
                  <option value={25}>Within 25 mi</option>
                  <option value={50}>Within 50 mi</option>
                  <option value={75}>Within 75 mi</option>
                  <option value={100}>Within 100 mi</option>
                  <option value={200}>Within 200 mi</option>
                  <option value={500}>Any distance</option>
                </select>
                <select
                  value={patientAge}
                  onChange={(e) => setPatientAge(Number(e.target.value))}
                  style={{ height: 30, borderRadius: 8, border: "1px solid var(--c-border-2)", background: "transparent", font: "500 13px/1 var(--f-sans)", padding: "0 8px", color: "var(--c-ink-2)", cursor: "pointer" }}
                >
                  {Array.from({ length: 100 }, (_, i) => i + 1).map((a) => (
                    <option key={a} value={a}>{a} yrs</option>
                  ))}
                </select>
                <select
                  value={patientGender}
                  onChange={(e) => setPatientGender(e.target.value)}
                  style={{ height: 30, borderRadius: 8, border: "1px solid var(--c-border-2)", background: "transparent", font: "500 13px/1 var(--f-sans)", padding: "0 8px", color: "var(--c-ink-2)", cursor: "pointer" }}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
                <span className="mono" style={{ font: "500 11px/1 var(--f-mono)", color: "var(--c-faint)", marginLeft: 4 }}>
                  {symptoms.length}/1000
                </span>
              </div>

              {/* ChatGPT-style up-arrow send button */}
              <button
                onClick={startChat}
                disabled={!symptoms.trim()}
                title="Start intake (Enter)"
                style={{
                  width: 36, height: 36, borderRadius: "50%", border: "none",
                  background: symptoms.trim() ? "var(--c-ink)" : "var(--c-border-2)",
                  color: "#fff", cursor: symptoms.trim() ? "pointer" : "default",
                  display: "grid", placeItems: "center", flexShrink: 0,
                  transition: "background .15s, transform .1s",
                }}
                onMouseEnter={(e) => { if (symptoms.trim()) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              >
                {/* up-arrow SVG */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>

          {zipStatus && (
            <p style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--c-muted)", marginTop: 8 }}>
              {zipStatus}
            </p>
          )}

          <div className="col gap-2" style={{ marginTop: 20 }}>
            <span className="kicker">Common right now</span>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {QUICK_CHIPS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setSymptoms(t); textareaRef.current?.focus(); }}
                  style={{ padding: "8px 14px", borderRadius: 999, background: "var(--c-card)", border: "1px solid var(--c-border)", font: "500 13px/1 var(--f-sans)", color: "var(--c-ink-2)", cursor: "pointer" }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid var(--c-hairline)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
            {TRUST_STATS.map((s, i) => (
              <div key={s.l} style={{ padding: "0 20px 0 0", borderRight: i < 2 ? "1px solid var(--c-hairline)" : "none", marginRight: i < 2 ? 20 : 0 }}>
                <div style={{ font: "700 20px/1 var(--f-sans)", color: "var(--c-ink)", letterSpacing: "-.02em" }}>{s.n}</div>
                <div style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--c-muted)", marginTop: 5 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Step 1.6 — sequential AI chat ────────────────────────
  if (step === 1.6) return (
    <div className="col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <AppHeader role="Patient" name={user?.full_name ?? "Patient"} />
      <TabStrip items={PATIENT_TABS} active="book" onChange={(key) => key === "appts" && navigate("/appointments")} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* chat header */}
        <div className="row gap-3" style={{ padding: "16px 40px", borderBottom: "1px solid var(--c-border)", alignItems: "center" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, var(--c-ai-2), var(--c-ai))",
            display: "grid", placeItems: "center", boxShadow: "var(--sh-glow-ai)",
          }}>
            <Icon name="sparkle" size={18} color="#fff" />
          </div>
          <div className="col">
            <span className="kicker kicker--ai">Agent 01 · Patient Intake</span>
            <span style={{ font: "500 14px/1.2 var(--f-sans)", marginTop: 2 }}>
              {chatDone ? "Ready to find your specialist" : `Question ${qaHistory.length + 1} · up to 5`}
            </span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {/* progress dots — grow up to 5 as questions are asked */}
            {Array.from({ length: Math.max(qaHistory.length + (chatDone ? 0 : 1), 2) }).map((_, i) => (
              <span key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: i < qaHistory.length ? "var(--c-ai)" : "var(--c-surface)",
                border: i === qaHistory.length && !chatDone ? "2px solid var(--c-ai)" : "1px solid var(--c-border-2)",
                transition: "background .3s",
              }} />
            ))}
            <button className="btn btn--ghost btn--sm" onClick={resetAll} style={{ marginLeft: 8 }}>
              ← Start over
            </button>
          </div>
        </div>

        {/* chat messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 40px", maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {chatHistory.map((msg, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              gap: 10, marginBottom: 14,
              alignItems: "flex-end",
            }}>
              {/* agent avatar */}
              {msg.role === "agent" && (
                <div style={{
                  width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                  background: "linear-gradient(135deg, var(--c-ai-2), var(--c-ai))",
                  display: "grid", placeItems: "center",
                }}>
                  <Icon name="sparkle" size={12} color="#fff" />
                </div>
              )}

              {/* bubble */}
              <div style={{
                maxWidth: "72%",
                padding: "11px 16px",
                borderRadius: msg.role === "agent" ? "4px 18px 18px 18px" : "18px 18px 4px 18px",
                background: msg.role === "agent" ? "var(--c-ai-soft)" : "var(--c-primary)",
                border: msg.role === "agent" ? "1px solid oklch(0.88 0.05 295)" : "none",
                color: msg.role === "agent" ? "var(--c-ink)" : "#fff",
                font: `${msg.role === "agent" ? "500" : "400"} 14px/1.55 var(--f-sans)`,
              }}>
                {msg.text}
              </div>
            </div>
          ))}

          {/* streaming bubble — shows question tokens as they arrive from Groq */}
          {isStreaming && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: "linear-gradient(135deg, var(--c-ai-2), var(--c-ai))", display: "grid", placeItems: "center" }}>
                <Icon name="sparkle" size={12} color="#fff" />
              </div>
              <div style={{ padding: "12px 16px", borderRadius: "4px 18px 18px 18px", background: "var(--c-ai-soft)", border: "1px solid oklch(0.88 0.05 295)", font: "500 14px/1.55 var(--f-sans)", color: "var(--c-ink)", maxWidth: "72%" }}>
                {streamingText
                  ? <>{streamingText}<span style={{ display: "inline-block", width: 2, height: "1em", background: "var(--c-ai)", marginLeft: 2, verticalAlign: "text-bottom", animation: "pulse 1s infinite" }} /></>
                  : <span style={{ display: "flex", gap: 5, alignItems: "center" }}>{[0, 0.15, 0.3].map((d, j) => <span key={j} className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c-ai)", animationDelay: `${d}s` }} />)}</span>
                }
              </div>
            </div>
          )}
          {sseError && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "var(--c-warn-soft, #fff8e1)", border: "1.5px solid var(--c-warn, #f59e0b)", marginBottom: 12, font: "400 13px/1.4 var(--f-sans)", color: "var(--c-ink)" }}>
              <Icon name="alert" size={15} color="var(--c-warn, #f59e0b)" />
              <span>Connection lost. <button style={{ all: "unset", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }} onClick={() => { setSseError(false); streamNextQuestion(qaHistory); }}>Retry</button></span>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* input bar */}
        <div style={{
          borderTop: "1px solid var(--c-border)",
          padding: "16px 40px",
          background: "var(--c-card)",
        }}>
          {chatDone ? (
            <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "flex-end" }}>
              <div className="col" style={{ alignItems: "flex-end", gap: 6 }}>
                {zipError && (
                  <span style={{ font: "400 12px/1 var(--f-sans)", color: "var(--c-error, #c0392b)" }}>
                    Please enter your ZIP code so we can find nearby specialists.
                  </span>
                )}
                <button
                  className="btn btn--brand btn--lg"
                  style={{ minWidth: 240 }}
                  onClick={() => {
                    if (!patientZip.trim()) { setZipError(true); return; }
                    setZipError(false);
                    intakeMutation.mutate();
                  }}
                >
                  Find best doctors <Icon name="arrow_right" size={16} stroke={2} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: 10, alignItems: "center" }}>
              <input
                className="input"
                type="text"
                placeholder="Type your reply…"
                value={currentInput}
                disabled={isStreaming}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAnswer(); } }}
                style={{ flex: 1, borderRadius: 999, font: "400 14px/1.4 var(--f-sans)" }}
                autoFocus
              />
              <button
                className="btn btn--brand"
                disabled={!currentInput.trim() || isStreaming}
                onClick={sendAnswer}
                style={{ borderRadius: 999, padding: "0 20px", height: 42, flexShrink: 0 }}
              >
                <Icon name="arrow_right" size={16} stroke={2} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Step 2 — analysing ────────────────────────────────────
  if (step === 2) return (
    <div className="col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <AppHeader role="Patient" name={user?.full_name ?? "Patient"} />
      <TabStrip items={PATIENT_TABS} active="book" onChange={(key) => key === "appts" && navigate("/appointments")} />
      <div style={{ flex: 1, padding: "40px 64px", overflow: "auto" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <span className="kicker">Step 2 of 4 · Analysing</span>
          <div className="card" style={{ padding: "14px 18px", marginBottom: 24, marginTop: 16, background: "var(--c-surface)", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Icon name="chat" size={16} color="var(--c-muted)" />
            <p style={{ margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--c-ink-2)" }}>"{symptoms}"</p>
            <button onClick={resetAll} style={{ border: "none", background: "transparent", color: "var(--c-muted)", cursor: "pointer", font: "500 12px/1 var(--f-sans)", whiteSpace: "nowrap" }}>Edit</button>
          </div>
          <div className="ai-surface" style={{ padding: "28px 28px" }}>
            <div className="row gap-3" style={{ marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, var(--c-ai-2), var(--c-ai))", color: "#fff", display: "grid", placeItems: "center", boxShadow: "var(--sh-glow-ai)" }}>
                <Icon name="sparkle" size={22} />
              </div>
              <div className="col">
                <span className="kicker kicker--ai">Agent 01 · Patient Intake</span>
                <span style={{ font: "500 17px/1.3 var(--f-sans)", marginTop: 4 }}>Analysing your symptoms…</span>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <span key={i} className="pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-ai)", animationDelay: `${delay}s` }} />
                ))}
              </div>
            </div>
            <div className="col gap-3">
              {ANALYSIS_STEPS.map((label, i) => {
                const s = i === 0 ? "done" : i === 1 ? "done" : i === 2 ? "loading" : "queued";
                return (
                  <div key={i} className="row gap-3">
                    <span style={{ width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, background: s === "done" ? "var(--c-success)" : s === "loading" ? "var(--c-ai)" : "var(--c-surface)", border: s === "queued" ? "1.5px dashed var(--c-faint)" : "none" }}>
                      {s === "done" && <Icon name="check" size={11} color="#fff" stroke={2.5} />}
                      {s === "loading" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                    </span>
                    <span style={{ font: `${s === "queued" ? "400" : "500"} 14px/1.4 var(--f-sans)`, color: s === "queued" ? "var(--c-muted)" : "var(--c-ink)" }}>{label}</span>
                    {s === "loading" && <span className="mono" style={{ font: "500 11px/1 var(--f-mono)", color: "var(--c-ai-ink)", marginLeft: "auto" }}>~2.4s</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="col gap-3" style={{ marginTop: 24 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "center" }}>
                <div className="shimmer-bg" style={{ width: 56, height: 56, borderRadius: "50%" }} />
                <div className="col gap-2" style={{ flex: 1 }}>
                  <div className="shimmer-bg" style={{ height: 14, width: "40%", borderRadius: 4 }} />
                  <div className="shimmer-bg" style={{ height: 12, width: "60%", borderRadius: 4 }} />
                </div>
                <div className="shimmer-bg" style={{ height: 32, width: 88, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Step 3 — results ──────────────────────────────────────
  if (step === 3 && intake) return (
    <div className="col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <AppHeader role="Patient" name={user?.full_name ?? "Patient"} />
      <TabStrip items={PATIENT_TABS} active="book" onChange={(key) => key === "appts" && navigate("/appointments")} />
      <div style={{ flex: 1, padding: "32px 64px", overflow: "auto" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
            <div className="col">
              <span className="kicker">Step 3 of 4 · Choose your doctor</span>
              <h2 style={{ font: "600 24px/1.2 var(--f-sans)", margin: "6px 0 0", letterSpacing: "-.01em" }}>
                {doctors.length} doctors matched{" "}
                <span style={{ color: "var(--c-muted)", fontWeight: 500 }}>from nearby providers</span>
              </h2>
            </div>
            <div className="row gap-2">
              <button className="btn btn--ghost btn--sm"><Icon name="filter" size={13} /> Filters</button>
              <button className="btn btn--ghost btn--sm"><Icon name="sliders" size={13} /> Sort: Match score</button>
              <button className="btn btn--ghost btn--sm" onClick={resetAll}>← New search</button>
            </div>
          </div>

          {intake.urgency === "emergency" && (
            <div className="card" style={{ padding: "14px 18px", marginBottom: 16, border: "1.5px solid var(--c-danger)", background: "var(--c-danger-soft)" }}>
              <div className="row gap-3">
                <Icon name="alert" size={20} color="var(--c-danger)" />
                <div className="col">
                  <span style={{ font: "600 14px/1 var(--f-sans)", color: "var(--c-danger)" }}>Emergency — {intake.urgency_reason}</span>
                  <span style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--c-danger)", marginTop: 4 }}>If life-threatening, call 911 immediately.</span>
                </div>
              </div>
            </div>
          )}
          {intake.urgency === "urgent" && (
            <div className="card" style={{ padding: "14px 18px", marginBottom: 16, border: "1.5px solid var(--c-warn)", background: "var(--c-warn-soft)" }}>
              <div className="row gap-3">
                <Icon name="alert" size={18} color="var(--c-warn)" />
                <span style={{ font: "500 14px/1.35 var(--f-sans)", color: "oklch(0.45 0.13 75)" }}>Urgent — {intake.urgency_reason}</span>
              </div>
            </div>
          )}
          {intake.is_shortage_area && (
            <div className="card" style={{ padding: "14px 18px", marginBottom: 16, border: "1.5px solid var(--c-warn)", background: "var(--c-warn-soft)" }}>
              <div className="row gap-3">
                <Icon name="flag" size={18} color="var(--c-warn)" />
                <div className="col">
                  <span style={{ font: "600 14px/1 var(--f-sans)", color: "oklch(0.45 0.13 75)" }}>Health Professional Shortage Area Detected</span>
                  <span style={{ font: "400 13px/1.4 var(--f-sans)", color: "oklch(0.45 0.13 75)", marginTop: 3 }}>{intake.shortage_description}</span>
                </div>
              </div>
            </div>
          )}

          <AIBanner
            agent="Agent 01 · Patient Intake"
            title={`Based on your symptoms, we recommend a ${doctors[0]?.speciality ?? "specialist"}.`}
            confidence={intake.confidence}
            action={<span className="chip chip--ai">AI matched</span>}
          >
            {intake.urgency_reason}
          </AIBanner>

          {/* ── Match Insight Panel ───────────────────────────── */}
          <div className="card" style={{ padding: "16px 24px", marginTop: 14, border: "1px solid var(--c-border-2)" }}>
            <button
              onClick={() => setInsightOpen(o => !o)}
              style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
            >
              <span className="kicker">How we matched you</span>
              <Icon name={insightOpen ? "chev_up" : "chev_down"} size={14} color="var(--c-muted)" stroke={2} />
            </button>
            {insightOpen && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginTop: 16 }}>

              {/* Column 1 — Patient intake answers */}
              <div>
                <div style={{ font: "600 12px/1 var(--f-sans)", color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Your intake answers</div>
                <div className="col gap-3">
                  <div>
                    <div style={{ font: "500 12px/1 var(--f-sans)", color: "var(--c-muted)", marginBottom: 2 }}>Chief complaint</div>
                    <div style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--c-ink)" }}>{symptoms}</div>
                  </div>
                  {qaHistory.map((qa, i) => (
                    <div key={i}>
                      <div style={{ font: "500 12px/1 var(--f-sans)", color: "var(--c-muted)", marginBottom: 2 }}>{qa.question}</div>
                      <div style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--c-ink)" }}>{qa.answer}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2 — Clinical reasoning */}
              <div style={{ borderLeft: "1px solid var(--c-border-2)", paddingLeft: 24 }}>
                <div style={{ font: "600 12px/1 var(--f-sans)", color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Clinical reasoning</div>
                <div style={{ font: "400 13px/1.55 var(--f-sans)", color: "var(--c-ink-2)" }}>{intake.urgency_reason}</div>
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "var(--c-ai-soft)", border: "1px solid oklch(0.88 0.05 295)" }}>
                  <div style={{ font: "500 12px/1 var(--f-sans)", color: "var(--c-ai-ink)", marginBottom: 4 }}>Recommended specialty</div>
                  <div style={{ font: "600 14px/1.3 var(--f-sans)", color: "var(--c-ink)" }}>{doctors[0]?.speciality ?? "Specialist"}</div>
                  {doctors[0]?.credential && (
                    <div style={{ font: "400 12px/1 var(--f-sans)", color: "var(--c-muted)", marginTop: 3 }}>{doctors[0].credential}</div>
                  )}
                </div>
              </div>

              {/* Column 3 — Location & provider match */}
              <div style={{ borderLeft: "1px solid var(--c-border-2)", paddingLeft: 24 }}>
                <div style={{ font: "600 12px/1 var(--f-sans)", color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Location match</div>
                <div className="col gap-3">
                  <div>
                    <div style={{ font: "500 12px/1 var(--f-sans)", color: "var(--c-muted)", marginBottom: 2 }}>Your location</div>
                    <div style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--c-ink)" }}>{patientZip ? `ZIP ${patientZip}` : "Location not provided"}</div>
                  </div>
                  <div>
                    <div style={{ font: "500 12px/1 var(--f-sans)", color: "var(--c-muted)", marginBottom: 2 }}>Search radius</div>
                    <div style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--c-ink)" }}>{searchRadius >= 500 ? "Any distance" : `${searchRadius} miles`}</div>
                  </div>
                  {doctors.length > 0 && (
                    <div>
                      <div style={{ font: "500 12px/1 var(--f-sans)", color: "var(--c-muted)", marginBottom: 6 }}>Nearest matched provider</div>
                      {doctors.slice(0, 3).map((d, i) => (
                        <div key={i} className="row gap-2" style={{ marginBottom: 6, alignItems: "flex-start" }}>
                          <span style={{ font: "600 12px/1.2 var(--f-mono)", color: "var(--c-ai-ink)", minWidth: 16 }}>#{i + 1}</span>
                          <div>
                            <div style={{ font: "500 13px/1.2 var(--f-sans)", color: "var(--c-ink)" }}>{cleanDoctorName(d.doctor_name)}</div>
                            <div style={{ font: "400 12px/1.3 var(--f-sans)", color: "var(--c-muted)", marginTop: 2 }}>
                              {[d.city, d.state].filter(Boolean).join(", ")}
                              {d.distance_miles != null && ` · ${d.distance_miles} mi away`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>}
          </div>

          {doctors.length > 0 && searchRadius < 500 && doctors.every(d => (d.distance_miles ?? 9999) > searchRadius) && (
            <div className="card" style={{ padding: "12px 16px", marginTop: 14, border: "1.5px solid var(--c-warn)", background: "var(--c-warn-soft)", display: "flex", gap: 10, alignItems: "center" }}>
              <Icon name="alert" size={16} color="var(--c-warn)" />
              <span style={{ font: "400 13px/1.4 var(--f-sans)", color: "oklch(0.45 0.13 75)" }}>
                No verified providers found within {searchRadius} miles of ZIP {patientZip}. Showing the nearest available specialists instead.
              </span>
            </div>
          )}

          <div className="col gap-3" style={{ marginTop: 18 }}>
            {doctors.length === 0 && (
              <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--c-muted)" }}>
                No doctors found. Try a different symptom description or ZIP code.
              </div>
            )}
            {doctors.map((doc) => (
              <DoctorCard
                key={doc.npi}
                doc={doc}
                onBook={() => { setSelected(doc); setSlot(""); slotsMutation.mutate(doc.npi); }}
              />
            ))}
          </div>

          {intakeMutation.isError && (
            <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--c-danger)", marginTop: 16 }}>
              Analysis failed. Please try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // ── Step 4 — booking modal (per wireframe) ───────────────
  {
    const today = new Date();
    const monthLabel = new Date(calYear, calMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const firstDay   = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    // Shift: Mon=0 … Sun=6
    const offset = (firstDay + 6) % 7;

    const selectedDate = new Date(date + "T00:00:00");
    const isSelectedDay = (d: number) =>
      selectedDate.getFullYear() === calYear &&
      selectedDate.getMonth()    === calMonth &&
      selectedDate.getDate()     === d;
    const isPastDay = (d: number) => new Date(calYear, calMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

    function pickDay(d: number) {
      if (isPastDay(d)) return;
      const mm = String(calMonth + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const picked = `${calYear}-${mm}-${dd}`;
      setDate(picked);
      setSlot("");
      if (selected) slotsMutation.mutate(selected.npi);
    }

    // Filter out past slots when today is selected
    const isToday = date === new Date().toISOString().slice(0, 10);
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const allSlots = (slotsMutation.data?.available_slots ?? []).filter((t) => {
      if (!isToday) return true;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m > nowMinutes;
    });
    const grouped = {
      morning:   allSlots.filter((t) => { const h = parseInt(t); return h < 12; }),
      afternoon: allSlots.filter((t) => { const h = parseInt(t); return h >= 12 && h < 17; }),
      evening:   allSlots.filter((t) => { const h = parseInt(t); return h >= 17; }),
    };

    const confirmLabel = slot
      ? `Confirm booking · ${new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })} ${slot}`
      : "Confirm booking";

    return (
      <div className="col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
        <AppHeader role="Patient" name={user?.full_name ?? "Patient"} />
        <TabStrip items={PATIENT_TABS} active="book" onChange={(key) => key === "appts" && navigate("/appointments")} />
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* blurred bg */}
          <div style={{ padding: "32px 64px", filter: "blur(2px)", opacity: 0.6 }}>
            <div style={{ maxWidth: 920, margin: "0 auto" }}>
              <div className="ai-surface" style={{ padding: 18, marginBottom: 18, height: 80 }} />
              {[1, 2, 3].map((i) => <div key={i} className="card" style={{ padding: 20, height: 120, marginBottom: 12 }} />)}
            </div>
          </div>
          <div style={{ position: "absolute", inset: 0, background: "oklch(0.20 0.012 240 / .35)" }} />

          {/* modal */}
          <div style={{
            position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
            width: 720, maxWidth: "94vw", maxHeight: "94vh",
            background: "var(--c-card)", borderRadius: 18,
            boxShadow: "var(--sh-3)", overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            {/* ── modal header ── */}
            <div className="row gap-4" style={{ padding: "20px 24px", borderBottom: "1px solid var(--c-border)" }}>
              <Avatar name={cleanDoctorName(selected?.doctor_name ?? "")} tone="primary" size={48} />
              <div className="col grow">
                <div className="row gap-2">
                  <span style={{ font: "600 17px/1 var(--f-sans)" }}>
                    {cleanDoctorName(selected?.doctor_name ?? "")}
                  </span>
                </div>
                <span style={{ font: "400 13px/1.3 var(--f-sans)", color: "var(--c-muted)", marginTop: 4 }}>
                  {selected?.speciality}
                  {selected?.city ? ` · ${selected.city}, ${selected.state}` : ""}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "var(--c-surface)", display: "grid", placeItems: "center", cursor: "pointer" }}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            {/* ── modal body: calendar left + slots right ── */}
            <div className="row" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

              {/* calendar panel */}
              <div style={{ width: 300, flexShrink: 0, padding: "20px 22px", borderRight: "1px solid var(--c-border)", overflowY: "auto" }}>
                {/* month nav */}
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ font: "600 14px/1 var(--f-sans)" }}>{monthLabel}</span>
                  <div className="row gap-1">
                    <button
                      onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                      style={{ width: 26, height: 26, border: "none", borderRadius: 6, background: "var(--c-surface)", cursor: "pointer", display: "grid", placeItems: "center" }}
                    >
                      <span style={{ display: "grid", placeItems: "center", transform: "rotate(180deg)" }}>
                        <Icon name="chev_right" size={12} stroke={2} />
                      </span>
                    </button>
                    <button
                      onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                      style={{ width: 26, height: 26, border: "none", borderRadius: 6, background: "var(--c-surface)", cursor: "pointer", display: "grid", placeItems: "center" }}
                    >
                      <Icon name="chev_right" size={12} stroke={2} />
                    </button>
                  </div>
                </div>

                {/* day-of-week headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6, textAlign: "center", font: "500 11px/1 var(--f-mono)", color: "var(--c-muted)" }}>
                  {["M","T","W","T","F","S","S"].map((d, i) => <span key={i}>{d}</span>)}
                </div>

                {/* day grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                  {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                    const past = isPastDay(d);
                    const sel  = isSelectedDay(d);
                    return (
                      <div
                        key={d}
                        onClick={() => pickDay(d)}
                        style={{
                          height: 36, display: "grid", placeItems: "center", borderRadius: 8,
                          cursor: past ? "default" : "pointer",
                          background: sel ? "var(--c-ink)" : "transparent",
                          color: sel ? "#fff" : past ? "var(--c-faint)" : "var(--c-ink)",
                          font: `${sel ? "600" : "500"} 13px/1 var(--f-sans)`,
                          position: "relative",
                        }}
                      >
                        {d}
                        {/* availability dot */}
                        {!past && !sel && (
                          <span style={{ position: "absolute", bottom: 4, width: 4, height: 4, borderRadius: "50%", background: "var(--c-primary)" }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* selected date summary */}
                <div className="col gap-1" style={{ marginTop: 18, padding: "12px 14px", background: "var(--c-surface)", borderRadius: 10 }}>
                  <span className="kicker">Selected</span>
                  <span style={{ font: "500 15px/1.2 var(--f-sans)" }}>
                    {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="row gap-1" style={{ font: "400 12px/1.3 var(--f-sans)", color: "var(--c-muted)" }}>
                    <Icon name="info" size={12} /> In-person · 30 min
                  </span>
                </div>
              </div>

              {/* slots panel */}
              <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
                {slotsMutation.isPending && (
                  <div className="row gap-2" style={{ color: "var(--c-muted)", font: "400 13px/1 var(--f-sans)" }}>
                    <span className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-ai)" }} />
                    Loading available slots…
                  </div>
                )}

                {!slotsMutation.isPending && allSlots.length === 0 && slotsMutation.isSuccess && (
                  <p style={{ margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--c-muted)" }}>
                    No slots available for this date. Try another.
                  </p>
                )}

                {!slotsMutation.data && !slotsMutation.isPending && (
                  <p style={{ margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--c-muted)" }}>
                    Pick a date to see available times.
                  </p>
                )}

                <div className="col gap-5">
                  {(["morning", "afternoon", "evening"] as const).map((part) => {
                    const list = grouped[part];
                    if (!list.length) return null;
                    const icons = { morning: "sun", afternoon: "sun", evening: "moon" } as const;
                    return (
                      <div key={part} className="col gap-2">
                        <div className="row gap-2">
                          <Icon name={icons[part]} size={14} color="var(--c-muted)" />
                          <span className="kicker">{part}</span>
                          <span style={{ font: "500 11px/1 var(--f-mono)", color: "var(--c-faint)" }}>
                            · {list.length} available
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                          {list.map((t) => (
                            <button
                              key={t}
                              onClick={() => setSlot(t)}
                              style={{
                                padding: "10px 0", borderRadius: 8, cursor: "pointer",
                                background: slot === t ? "var(--c-primary)" : "var(--c-card)",
                                color: slot === t ? "#fff" : "var(--c-ink)",
                                border: `1px solid ${slot === t ? "var(--c-primary)" : "var(--c-border-2)"}`,
                                font: "500 13px/1 var(--f-mono)",
                                boxShadow: slot === t ? "0 4px 12px -4px oklch(0.40 0.06 180 / .35)" : "none",
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── modal footer ── */}
            <div className="row gap-3" style={{
              padding: "16px 24px", borderTop: "1px solid var(--c-border)",
              background: "var(--c-surface)", justifyContent: "space-between", alignItems: "center",
            }}>
              <div className="row gap-2" style={{ font: "500 13px/1.3 var(--f-sans)", color: "var(--c-ink-2)" }}>
                <Icon name="shield" size={14} color="var(--c-success)" />
                <span>No-show risk monitoring will activate on confirmation.</span>
              </div>
              <div className="row gap-2">
                <button className="btn btn--ghost" onClick={() => setSelected(null)}>Back</button>
                <button
                  className="btn btn--brand"
                  disabled={!slot || bookMutation.isPending || !user}
                  onClick={() => bookMutation.mutate()}
                >
                  {bookMutation.isPending ? "Booking…" : user ? confirmLabel : "Login to book"}
                </button>
              </div>
            </div>

            {bookMessage && (
              <div style={{
                padding: "12px 24px", font: "500 13px/1.4 var(--f-sans)", textAlign: "center",
                background: bookMessage.toLowerCase().includes("success") || bookMessage.toLowerCase().includes("booked")
                  ? "var(--c-success-soft)" : "var(--c-danger-soft)",
                color: bookMessage.toLowerCase().includes("success") || bookMessage.toLowerCase().includes("booked")
                  ? "oklch(0.38 0.10 155)" : "oklch(0.46 0.16 25)",
              }}>
                {bookMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

// ── DoctorCard ─────────────────────────────────────────────
function DoctorCard({ doc, onBook }: { doc: DoctorMatch; onBook: () => void }) {
  const location  = [doc.city, doc.state].filter(Boolean).join(", ");

  return (
    <div className="card card--lift" style={{ padding: 20, display: "flex", gap: 18, alignItems: "flex-start", position: "relative" }}>
      <Avatar name={cleanDoctorName(doc.doctor_name)} tone="primary" size={64} />

      <div className="col gap-1" style={{ flex: 1, minWidth: 0, paddingRight: 130 }}>
        <div className="row gap-2">
          <span style={{ font: "600 16px/1.2 var(--f-sans)" }}>{cleanDoctorName(doc.doctor_name)}</span>
          {doc.credential && <span style={{ font: "500 12px/1 var(--f-sans)", color: "var(--c-muted)" }}>· {doc.credential}</span>}
        </div>
        <div className="row gap-3" style={{ color: "var(--c-ink-2)" }}>
          <span style={{ font: "500 13px/1.3 var(--f-sans)", color: "var(--c-primary)" }}>{doc.speciality}</span>
          {location && <><span style={{ color: "var(--c-faint)" }}>·</span><span style={{ font: "400 13px/1.3 var(--f-sans)" }}>{location}</span></>}
        </div>
        <div className="row gap-2" style={{ marginTop: 10, flexWrap: "wrap" }}>
          {doc.zip && <span className="chip"><Icon name="pin" size={11} color="var(--c-info)" stroke={2} /> {doc.zip}</span>}
          {doc.phone && <span className="chip"><Icon name="user" size={11} color="var(--c-muted)" stroke={2} /> {doc.phone}</span>}
        </div>
      </div>

      <div className="col gap-2" style={{ alignSelf: "flex-end", marginLeft: "auto" }}>
        <button className="btn btn--brand" onClick={onBook}>Book <Icon name="arrow_right" size={14} stroke={2} /></button>
      </div>
    </div>
  );
}

void StatusPill;
