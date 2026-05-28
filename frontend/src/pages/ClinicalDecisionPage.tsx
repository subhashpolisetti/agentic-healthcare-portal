import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { AuthUser } from "../types";
import {
  AppHeader, AgentsStrip, TabStrip, Avatar,
  AIBanner, RiskScore, StatusPill, Icon,
} from "../components";
import type { TabItem } from "../components";

// ── Types ────────────────────────────────────────────────────
type DoctorAppointment = {
  appointment_id: number;
  doctor_name: string;
  speciality: string;
  patient_email: string;
  patient_name: string;
  appointment_date: string;
  slot_start_time: string;
  status: string;
  chief_complaint: string | null;
  soap_notes: string | null;
  discharge_summary: string | null;
  noshow_risk?: number | null;
  risk_level?: "high" | "medium" | "low" | null;
  analysis_status?: "PENDING" | "IN_PROGRESS" | "READY" | "FAILED" | "STALE" | null;
  cancel_reason?: string | null;
  followup_sent_at?: string | null;
  followup_days?: number | null;
  intervention_message?: string | null;
};

type DischargePanel = {
  step: "input" | "review";
  chiefComplaint: string;
  soapNotes: string;
  dischargeSummary: string;
  followupDays: number;
  followupRecommendation: string;
};

type ClinicalResult = {
  similar_cases: { document: string; similarity: number }[];
  analysis: string;
  is_critical: boolean;
  critical_flags: string[];
};

type Props = { user: AuthUser | null };

// ── Helpers ──────────────────────────────────────────────────
const todayStr = new Date().toISOString().slice(0, 10);

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function apptDay(d: string): "past" | "today" | "upcoming" {
  return d === todayStr ? "today" : d > todayStr ? "upcoming" : "past";
}
function riskFromScore(score: number | null | undefined): number {
  if (!score) return 0;
  return Math.round(score * 100);
}

const DOCTOR_TABS: TabItem[] = [
  { key: "clinical",   label: "Clinical Analysis", icon: "file_text" },
  { key: "schedule",   label: "Patient Schedule",  icon: "calendar" },
  { key: "admitted",   label: "Admitted",          icon: "bed" },
  { key: "discharged", label: "Discharged",        icon: "check" },
  { key: "noshow",     label: "No-Show Risk",      icon: "alert" },
];

// ── Main component ───────────────────────────────────────────
export function ClinicalDecisionPage({ user }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("clinical");
  const [dischargedSubTab, setDischargedSubTab] = useState<"today" | "history">("today");
  const [noShowSubTab, setNoShowSubTab] = useState<"at-risk" | "history">("at-risk");

  // #3: discharge draft autosave — tracks current etag+version per appointment (ref only — not rendered)
  const draftEtags = useRef<Record<number, { version: number; etag: string }>>({});
  const autosaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Clinical analysis
  const [symptoms, setSymptoms] = useState("");
  const [numCases, setNumCases] = useState(5);

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [nsFromDate, setNsFromDate] = useState("");
  const [nsToDate, setNsToDate] = useState("");

  // Per-appointment state
  const [dischargePanel, setDischargePanel] = useState<Record<number, DischargePanel>>({});
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [clinicalResults, setClinicalResults] = useState<Record<number, ClinicalResult>>({});
  const [clinicalInput] = useState<Record<number, string>>({});

  // ── Queries ──────────────────────────────────────────────
  const searchMutation = useMutation({
    mutationFn: async () => {
      const caseResult = await apiFetch<{ cases: { id: string; document: string; similarity_score: number }[] }>(
        `/cases/similar?symptoms=${encodeURIComponent(symptoms)}&top_k=${numCases}`,
      );
      const docs = (caseResult.cases || []).slice(0, 3).map((c) => c.document);
      const ar = await apiFetch<{ analysis: string }>("/clinical/analysis", {
        method: "POST",
        body: JSON.stringify({ symptoms, case_documents: docs }),
      });
      return { cases: caseResult.cases || [], analysis: ar.analysis || "" };
    },
  });

  // Backend returns raw arrays — not wrapped in { appointments: [] }
  const appointmentsQuery = useQuery({
    queryKey: ["doctor-appointments"],
    queryFn:  () => apiFetch<DoctorAppointment[]>("/appointments/doctor"),
    enabled:  activeTab === "schedule",
  });

  const admittedQuery = useQuery({
    queryKey: ["admitted-patients"],
    queryFn:  () => apiFetch<DoctorAppointment[]>("/appointments/doctor/admitted"),
    enabled:  activeTab === "admitted",
    refetchInterval: activeTab === "admitted" ? 30_000 : false,
  });

  const dischargedQuery = useQuery({
    queryKey: ["discharged-patients", dischargedSubTab, fromDate, toDate],
    queryFn: () => {
      const p = new URLSearchParams();
      if (dischargedSubTab === "today") { p.append("from_date", todayStr); p.append("to_date", todayStr); }
      else { if (fromDate) p.append("from_date", fromDate); if (toDate) p.append("to_date", toDate); }
      const qs = p.toString();
      return apiFetch<DoctorAppointment[]>(`/appointments/doctor/discharged${qs ? `?${qs}` : ""}`);
    },
    enabled: activeTab === "discharged",
  });

  // Dedicated no-show endpoint — returns appointments whose date has passed without attendance
  const noShowQuery = useQuery({
    queryKey: ["noshow-appointments"],
    queryFn:  () => apiFetch<DoctorAppointment[]>("/appointments/doctor/noshow"),
    enabled:  activeTab === "noshow" && noShowSubTab === "history",
  });

  // Agent 6: real follow-up funnel stats (last 30 days)
  const followupStatsQuery = useQuery({
    queryKey: ["followup-stats"],
    queryFn:  () => apiFetch<{ discharged_30d: number; followup_sent: number; followup_pending: number }>(
      "/appointments/doctor/followup-stats",
    ),
    enabled: activeTab === "discharged",
  });

  const sendFollowupMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/appointments/${id}/send-followup`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discharged-patients"] });
      queryClient.invalidateQueries({ queryKey: ["followup-stats"] });
    },
  });

  // #9: At Risk tab — upcoming BOOKED with high noshow_risk
  const atRiskQuery = useQuery({
    queryKey: ["at-risk-appointments"],
    queryFn:  () => apiFetch<DoctorAppointment[]>("/appointments/doctor/at-risk"),
    enabled:  activeTab === "noshow" && noShowSubTab === "at-risk",
    refetchInterval: activeTab === "noshow" && noShowSubTab === "at-risk" ? 30_000 : false,
  });

  // #4: patient-initiated cancel with reason — explicitly typed so variables.id is safe without casts
  const cancelMutation = useMutation<unknown, Error, { id: number; reason: string }>({
    mutationFn: ({ id, reason }) =>
      apiFetch(`/appointments/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/appointments/${id}/status?status=${status}`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admitted-patients"] });
      queryClient.invalidateQueries({ queryKey: ["discharged-patients"] });
      queryClient.invalidateQueries({ queryKey: ["noshow-appointments"] });
    },
  });

  const generateNotesMutation = useMutation({
    mutationFn: (appt: DoctorAppointment) =>
      apiFetch<{ soap_notes: string; discharge_summary: string; followup_days: number; followup_recommendation: string }>(
        "/agents/discharge/generate",
        {
          method: "POST",
          body: JSON.stringify({
            appointment_id:   appt.appointment_id,
            patient_name:     appt.patient_name,
            doctor_name:      appt.doctor_name,
            specialty:        appt.speciality,
            chief_complaint:  dischargePanel[appt.appointment_id]?.chiefComplaint ?? "",
            appointment_date: appt.appointment_date,
          }),
        },
      ),
    onSuccess: (data, appt) => {
      setDischargePanel((prev) => ({
        ...prev,
        [appt.appointment_id]: { ...prev[appt.appointment_id], step: "review", soapNotes: data.soap_notes, dischargeSummary: data.discharge_summary, followupDays: data.followup_days, followupRecommendation: data.followup_recommendation },
      }));
      // #3: create initial discharge draft so autosave has an etag to work with
      apiFetch<{ id: number; version: number; etag: string }>(
        `/appointments/${appt.appointment_id}/discharge-draft`,
        { method: "POST", body: JSON.stringify({ content: data.soap_notes ?? "", updated_by: "ai-service" }) },
      ).then((draft) => { draftEtags.current[appt.appointment_id] = { version: draft.version, etag: draft.etag }; })
       .catch(() => {});
    },
  });

  // #3: autosave discharge draft 2s after the doctor stops typing
  // draftEtags is a ref (not state) — excluded from deps to prevent infinite autosave loop
  useEffect(() => {
    const timers = autosaveTimers.current;
    Object.entries(dischargePanel).forEach(([id, panel]) => {
      const apptId = Number(id);
      if (panel.step !== "review") return;
      const meta = draftEtags.current[apptId];
      if (!meta) return;
      clearTimeout(timers[apptId]);
      timers[apptId] = setTimeout(() => {
        delete timers[apptId]; // clear reference after firing so button is no longer blocked
        const currentMeta = draftEtags.current[apptId];
        if (!currentMeta) return;
        apiFetch<{ version: number; etag: string }>(
          `/appointments/${apptId}/discharge-draft/${currentMeta.version}`,
          { method: "PUT", body: JSON.stringify({ content: `${panel.soapNotes}\n\n---SUMMARY---\n${panel.dischargeSummary}`, etag: currentMeta.etag, updated_by: user?.email ?? "doctor" }) },
        ).then((draft) => { draftEtags.current[apptId] = { version: draft.version, etag: draft.etag }; })
         .catch(() => {});
      }, 2000);
    });
    return () => Object.values(timers).forEach(clearTimeout);
  }, [dischargePanel, user]); // draftEtags intentionally excluded — it's a ref

  const confirmDischargeMutation = useMutation({
    mutationFn: (appt: DoctorAppointment) => {
      // Cancel any pending autosave for this appointment before finalising discharge.
      // Prevents a race where autosave PUT arrives after the discharge POST and overwrites state.
      const timers = autosaveTimers.current;
      clearTimeout(timers[appt.appointment_id]);
      delete timers[appt.appointment_id];

      const panel = dischargePanel[appt.appointment_id];
      return apiFetch(`/appointments/${appt.appointment_id}/discharge`, {
        method: "POST",
        body: JSON.stringify({ chief_complaint: panel.chiefComplaint, soap_notes: panel.soapNotes, discharge_summary: panel.dischargeSummary }),
      });
    },
    onSuccess: (_data, appt) => {
      setDischargePanel((prev) => { const n = { ...prev }; delete n[appt.appointment_id]; return n; });
      queryClient.invalidateQueries({ queryKey: ["admitted-patients"] });
      queryClient.invalidateQueries({ queryKey: ["discharged-patients"] });
    },
  });

  const clinicalMutation = useMutation({
    mutationFn: (appt: DoctorAppointment) =>
      apiFetch<ClinicalResult>("/agents/clinical/analyze", {
        method: "POST",
        body: JSON.stringify({
          appointment_id:  appt.appointment_id,
          patient_name:    appt.patient_name,
          specialty:       appt.speciality,
          chief_complaint: clinicalInput[appt.appointment_id] ?? appt.speciality,
        }),
      }),
    onSuccess: (data, appt) => setClinicalResults((prev) => ({ ...prev, [appt.appointment_id]: data })),
  });

  // ── Derived (backend returns arrays directly) ─────────────
  const bookedAppts   = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
  const todayAppts    = useMemo(() => bookedAppts.filter((a) => apptDay(a.appointment_date) === "today"),    [bookedAppts]);
  const upcomingAppts = useMemo(() => bookedAppts.filter((a) => apptDay(a.appointment_date) === "upcoming"), [bookedAppts]);

  const noShowAppts = useMemo(() => noShowQuery.data ?? [], [noShowQuery.data]);

  const filteredNoShow = useMemo(() => noShowAppts.filter((a) => {
    if (nsFromDate && a.appointment_date < nsFromDate) return false;
    if (nsToDate   && a.appointment_date > nsToDate)   return false;
    return true;
  }), [noShowAppts, nsFromDate, nsToDate]);

  const admittedPatients = useMemo(() => admittedQuery.data ?? [], [admittedQuery.data]);

  const dischargedPatients = useMemo(() => {
    const list = dischargedQuery.data ?? [];
    return list.filter((a) => searchEmail ? a.patient_email.toLowerCase().includes(searchEmail.toLowerCase()) : true);
  }, [dischargedQuery.data, searchEmail]);

  // ── Navigation from vitals button ────────────────────────
  function handleMonitorVitals(appt: DoctorAppointment) {
    localStorage.setItem("monitoring_patient", JSON.stringify({
      patient_email: appt.patient_email,
      appointment_id: appt.appointment_id,
      doctor_name: appt.doctor_name,
      speciality: appt.speciality,
      appointment_date: appt.appointment_date,
      slot_start_time: appt.slot_start_time,
    }));
    navigate("/emergency-vitals");
  }

  // ── Tabs with counts ─────────────────────────────────────
  const tabsWithCounts: TabItem[] = DOCTOR_TABS.map((t) => {
    if (t.key === "schedule")   return { ...t, count: bookedAppts.length    || undefined };
    if (t.key === "admitted")   return { ...t, count: admittedPatients.length || undefined };
    if (t.key === "noshow")     return { ...t, count: noShowAppts.length    || undefined };
    return t;
  });

  return (
    <div className="col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <AppHeader role="Doctor" name={user?.full_name ?? "Doctor"} />
      <AgentsStrip activeIds={[1, 2, 3, 4, 5, 6]} />
      <TabStrip items={tabsWithCounts} active={activeTab} onChange={setActiveTab} />

      <div style={{ flex: 1, overflow: "auto", background: "var(--c-bg)" }}>

        {/* ══ TAB: Clinical Analysis ════════════════════════════ */}
        {activeTab === "clinical" && (
          <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
              <div className="col">
                <span className="kicker">Agent 02 · Clinical Decision Support</span>
                <h2 style={{ font: "600 26px/1.15 var(--f-sans)", margin: "6px 0 0", letterSpacing: "-.01em" }}>
                  Clinical Analysis
                </h2>
              </div>
            </div>

            <div className="col gap-4">
                <div className="card" style={{ padding: 24 }}>
                  <label className="label">Clinical presentation / symptoms</label>
                  <textarea
                    className="textarea"
                    rows={5}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="e.g. 58 y/o male with 4-day history of retrosternal chest pain, worse on exertion, mild dyspnoea…"
                    style={{ marginBottom: 16 }}
                  />
                  <div className="row gap-3" style={{ justifyContent: "space-between" }}>
                    <div className="row gap-2">
                      <label className="label" style={{ marginBottom: 0, lineHeight: 2 }}>Cases</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={10}
                        value={numCases}
                        onChange={(e) => setNumCases(Number(e.target.value || 5))}
                        style={{ width: 72, height: 36 }}
                      />
                    </div>
                    <button
                      className="btn btn--ai"
                      disabled={searchMutation.isPending || !symptoms.trim()}
                      onClick={() => searchMutation.mutate()}
                    >
                      {searchMutation.isPending ? (
                        <><span className="pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} /> Analyzing…</>
                      ) : (
                        <><Icon name="sparkle" size={15} /> Run AI Analysis</>
                      )}
                    </button>
                  </div>
                </div>

                {searchMutation.isError && (
                  <p style={{ color: "var(--c-danger)", font: "400 13px/1.5 var(--f-sans)" }}>
                    Analysis failed. Please try again.
                  </p>
                )}

                {searchMutation.data?.analysis && (
                  <AIBanner
                    agent="Agent 02 · Clinical Decision"
                    title="Analysis complete"
                    confidence={89}
                  >
                    <div style={{ marginTop: 8, whiteSpace: "pre-wrap", font: "400 13px/1.6 var(--f-sans)" }}>
                      {searchMutation.data.analysis}
                    </div>
                  </AIBanner>
                )}

                {(searchMutation.data?.cases?.length ?? 0) > 0 && (
                  <div className="card" style={{ padding: 20 }}>
                    <span className="kicker">Similar cases · {searchMutation.data!.cases.length} found</span>
                    <div className="col gap-3" style={{ marginTop: 12 }}>
                      {searchMutation.data!.cases.map((c) => (
                        <div key={c.id} style={{ padding: "12px 14px", background: "var(--c-surface)", borderRadius: 10, borderLeft: "3px solid var(--c-ai)" }}>
                          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ font: "600 13px/1 var(--f-sans)" }}>Case {c.id}</span>
                            <span className="chip chip--ai" style={{ height: 20 }}>
                              {(c.similarity_score * 100).toFixed(1)}% match
                            </span>
                          </div>
                          <p style={{ margin: 0, font: "400 12.5px/1.55 var(--f-sans)", color: "var(--c-ink-2)" }}>
                            {c.document}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* ══ TAB: Patient Schedule ═════════════════════════════ */}
        {activeTab === "schedule" && (
          <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24 }}>
              <div className="col gap-3">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div className="col">
                    <span className="kicker">
                      {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </span>
                    <h2 style={{ font: "600 26px/1.15 var(--f-sans)", margin: "6px 0 0", letterSpacing: "-.01em" }}>
                      Today's schedule
                      {todayAppts.length > 0 && (
                        <span style={{ color: "var(--c-muted)", fontWeight: 500 }}> · {todayAppts.length} patients</span>
                      )}
                    </h2>
                  </div>
                </div>

                {appointmentsQuery.isLoading && <SkeletonList />}
                {appointmentsQuery.isError && <ErrorMsg msg={(appointmentsQuery.error as Error).message} />}

                {todayAppts.length === 0 && appointmentsQuery.isSuccess && (
                  <EmptyState icon="calendar" title="No appointments today" sub="Upcoming appointments appear below." />
                )}

                {todayAppts.map((appt) => (
                  <ScheduleRow
                    key={appt.appointment_id}
                    appt={appt}
                    showAdmit
                    onAdmit={() => statusMutation.mutate({ id: appt.appointment_id, status: "admitted" })}
                    isPending={statusMutation.isPending}
                    onCancel={(reason) => cancelMutation.mutate({ id: appt.appointment_id, reason })}
                    isCancelling={cancelMutation.isPending && cancelMutation.variables?.id === appt.appointment_id}
                  />
                ))}

                {upcomingAppts.length > 0 && (
                  <>
                    <div style={{ height: 1, background: "var(--c-hairline)", margin: "8px 0" }} />
                    <span className="kicker" style={{ paddingLeft: 4 }}>Upcoming</span>
                    {upcomingAppts.map((appt) => (
                      <ScheduleRow
                        key={appt.appointment_id}
                        appt={appt}
                        showAdmit={false}
                        onAdmit={() => {}}
                        isPending={false}
                        onCancel={(reason) => cancelMutation.mutate({ id: appt.appointment_id, reason })}
                        isCancelling={cancelMutation.isPending && cancelMutation.variables?.id === appt.appointment_id}
                      />
                    ))}
                  </>
                )}
              </div>

              {/* sidebar */}
              <div className="col gap-3">
<div className="card" style={{ padding: "16px 18px" }}>
                  <span className="kicker">At a glance</span>
                  <div className="col gap-3" style={{ marginTop: 12 }}>
                    {[
                      { l: "Booked today",     v: todayAppts.length,    c: "var(--c-info)" },
                      { l: "Admitted",         v: admittedPatients.length, c: "var(--c-warn)" },
                      { l: "Upcoming",         v: upcomingAppts.length,  c: "var(--c-primary)" },
                      { l: "High-risk slots",  v: bookedAppts.filter((a) => (a.noshow_risk ?? 0) > 0.65).length, c: "var(--c-danger)" },
                    ].map((s) => (
                      <div key={s.l} className="row" style={{ justifyContent: "space-between" }}>
                        <span className="row gap-2" style={{ font: "400 13px/1 var(--f-sans)", color: "var(--c-ink-2)" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.c }} />
                          {s.l}
                        </span>
                        <span className="tab-num" style={{ font: "500 15px/1 var(--f-sans)" }}>{s.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: Admitted ════════════════════════════════════ */}
        {activeTab === "admitted" && (
          <div style={{ padding: "24px 32px", maxWidth: 1300, margin: "0 auto" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
              <div className="col">
                <span className="kicker">In your care · live</span>
                <h2 style={{ font: "600 26px/1.15 var(--f-sans)", margin: "6px 0 0", letterSpacing: "-.01em" }}>
                  Admitted patients
                  {admittedPatients.length > 0 && (
                    <span style={{ color: "var(--c-muted)", fontWeight: 500 }}> · {admittedPatients.length} currently</span>
                  )}
                </h2>
              </div>
              <div className="row gap-2">
                <span className="row gap-2" style={{ font: "500 12px/1 var(--f-mono)", color: "var(--c-muted)" }}>
                  <span className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-success)" }} />
                  Auto-refreshing · 30s
                </span>
                <button className="btn btn--ghost btn--sm" onClick={() => navigate("/emergency-vitals")}>
                  <Icon name="activity" size={13} /> Vitals wall
                </button>
              </div>
            </div>

            {admittedQuery.isLoading && <SkeletonList />}
            {admittedQuery.isError && <ErrorMsg msg={(admittedQuery.error as Error).message} />}

            {admittedQuery.isSuccess && admittedPatients.length === 0 && (
              <EmptyState icon="bed" title="No admitted patients" sub="Admit a patient from the Patient Schedule tab." />
            )}

            {admittedPatients.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "start" }}>
                {/* patient cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {admittedPatients.map((appt) => {
                  const panel = dischargePanel[appt.appointment_id];
                  const isGenerating = generateNotesMutation.isPending && generateNotesMutation.variables?.appointment_id === appt.appointment_id;
                  const isConfirming = confirmDischargeMutation.isPending && confirmDischargeMutation.variables?.appointment_id === appt.appointment_id;
                  const cr = clinicalResults[appt.appointment_id];
                  const riskPct = riskFromScore(appt.noshow_risk);

                  return (
                    <div
                      key={appt.appointment_id}
                      className="card"
                      style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
                    >
                      {/* patient header */}
                      <div className="row gap-3" style={{ padding: "16px 18px", borderBottom: "1px solid var(--c-border)" }}>
                        <Avatar name={appt.patient_name} tone="warm" size={42} />
                        <div className="col grow">
                          <div className="row gap-2">
                            <span style={{ font: "600 14.5px/1.2 var(--f-sans)" }}>{appt.patient_name}</span>
                            <StatusPill status="Admitted" />
                          </div>
                          <span style={{ font: "400 12px/1.3 var(--f-sans)", color: "var(--c-muted)", marginTop: 3 }}>
                            {appt.speciality} · {formatDate(appt.appointment_date)}
                          </span>
                        </div>
                      </div>

                      {/* info rows */}
                      <div className="col gap-2" style={{ padding: "14px 18px" }}>
                        <div className="row" style={{ justifyContent: "space-between", font: "400 12px/1.3 var(--f-sans)" }}>
                          <span style={{ color: "var(--c-muted)" }}>Time</span>
                          <span style={{ color: "var(--c-ink-2)" }}>{formatTime(appt.slot_start_time)}</span>
                        </div>
                        <div className="row" style={{ justifyContent: "space-between", font: "400 12px/1.3 var(--f-sans)" }}>
                          <span style={{ color: "var(--c-muted)" }}>Email</span>
                          <span style={{ color: "var(--c-ink-2)", fontSize: 11 }}>{appt.patient_email}</span>
                        </div>
                        {riskPct > 0 && (
                          <div className="row" style={{ justifyContent: "space-between", font: "400 12px/1.3 var(--f-sans)" }}>
                            <span style={{ color: "var(--c-muted)" }}>No-show risk</span>
                            <RiskScore value={riskPct} />
                          </div>
                        )}
                      </div>

                      {/* patient intake Q&A — shown to doctor before they see the patient */}
                      {appt.chief_complaint && (() => {
                        const { initial, qa } = parseChiefComplaint(appt.chief_complaint);
                        return (
                          <div style={{ margin: "0 18px 14px", padding: "12px 14px", borderRadius: 10, background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
                            <span className="kicker kicker--ai" style={{ display: "block", marginBottom: 8 }}>Patient intake · AI collected</span>
                            <p style={{ margin: "0 0 10px", font: "500 13px/1.5 var(--f-sans)", color: "var(--c-ink)" }}>{initial}</p>
                            {qa.map((pair, i) => (
                              <div key={i} style={{ paddingLeft: 10, borderLeft: "2px solid var(--c-ai)", marginBottom: 8 }}>
                                <div style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--c-ai-ink)", marginBottom: 2 }}>{pair.q}</div>
                                <div style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--c-ink-2)" }}>{pair.a}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Agent 2 results */}
                      {cr && (
                        <div style={{ margin: "0 18px 14px", padding: "12px 14px", borderRadius: 10, background: cr.is_critical ? "var(--c-danger-soft)" : "var(--c-ai-soft)", border: `1px solid ${cr.is_critical ? "oklch(0.84 0.08 25)" : "oklch(0.88 0.04 295)"}` }}>
                          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ font: "600 12px/1 var(--f-sans)", color: cr.is_critical ? "var(--c-danger)" : "var(--c-ai-ink)" }}>
                              {cr.is_critical ? "Critical findings" : "AI Clinical Analysis"}
                            </span>
                            <button
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-muted)" }}
                              onClick={() => setClinicalResults((p) => { const n = { ...p }; delete n[appt.appointment_id]; return n; })}
                            >
                              <Icon name="x" size={12} />
                            </button>
                          </div>
                          {cr.is_critical && cr.critical_flags.map((f, i) => (
                            <span key={i} className="chip chip--danger" style={{ marginBottom: 6, marginRight: 4 }}>{f}</span>
                          ))}
                          <p style={{ margin: 0, font: "400 12.5px/1.55 var(--f-sans)", color: "var(--c-ink-2)", whiteSpace: "pre-wrap" }}>
                            {cr.analysis}
                          </p>
                        </div>
                      )}

                      {/* Discharge panel: step 1 */}
                      {panel?.step === "input" && (
                        <div style={{ margin: "0 18px 14px", padding: "14px 16px", borderRadius: 10, background: "var(--c-warn-soft)", border: "1px solid oklch(0.86 0.08 75)" }}>
                          <span style={{ font: "600 13px/1 var(--f-sans)", color: "oklch(0.45 0.13 75)" }}>
                            Initiate Discharge — Agent 05
                          </span>
                          <label className="label" style={{ marginTop: 12, marginBottom: 6 }}>Chief Complaint</label>
                          <textarea
                            className="textarea"
                            rows={3}
                            value={panel.chiefComplaint}
                            placeholder="e.g. Chest pain radiating to left arm, onset 2h ago…"
                            onChange={(e) => setDischargePanel((prev) => ({ ...prev, [appt.appointment_id]: { ...prev[appt.appointment_id], chiefComplaint: e.target.value } }))}
                          />
                          <div className="row gap-2" style={{ marginTop: 10 }}>
                            <button
                              className="btn btn--ai btn--sm"
                              disabled={!panel.chiefComplaint.trim() || isGenerating}
                              onClick={() => generateNotesMutation.mutate(appt)}
                            >
                              {isGenerating ? "Generating…" : <><Icon name="sparkle" size={13} /> Generate AI notes</>}
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => setDischargePanel((prev) => { const n = { ...prev }; delete n[appt.appointment_id]; return n; })}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Discharge panel: step 2 — review */}
                      {panel?.step === "review" && (
                        <div style={{ margin: "0 18px 14px", padding: "14px 16px", borderRadius: 10, background: "var(--c-success-soft)", border: "1px solid oklch(0.86 0.06 155)" }}>
                          <span style={{ font: "600 13px/1 var(--f-sans)", color: "oklch(0.38 0.10 155)" }}>
                            Review & approve discharge
                          </span>
                          <label className="label" style={{ marginTop: 12, marginBottom: 4 }}>SOAP Notes</label>
                          <textarea
                            className="textarea"
                            rows={6}
                            value={panel.soapNotes}
                            onChange={(e) => setDischargePanel((prev) => ({ ...prev, [appt.appointment_id]: { ...prev[appt.appointment_id], soapNotes: e.target.value } }))}
                            style={{ fontFamily: "var(--f-mono)", fontSize: 12, marginBottom: 10 }}
                          />
                          <label className="label" style={{ marginBottom: 4 }}>Discharge Summary</label>
                          <textarea
                            className="textarea"
                            rows={4}
                            value={panel.dischargeSummary}
                            onChange={(e) => setDischargePanel((prev) => ({ ...prev, [appt.appointment_id]: { ...prev[appt.appointment_id], dischargeSummary: e.target.value } }))}
                            style={{ marginBottom: 10 }}
                          />
                          {panel.followupDays > 0 && (
                            <div className="row gap-2" style={{ padding: "8px 12px", background: "var(--c-ai-soft)", borderRadius: 8, marginBottom: 10 }}>
                              <Icon name="calendar" size={13} color="var(--c-ai-ink)" />
                              <span style={{ font: "400 12.5px/1.4 var(--f-sans)", color: "var(--c-ai-ink)" }}>
                                {panel.followupRecommendation}
                              </span>
                            </div>
                          )}
                          <div className="row gap-2">
                            <button
                              className="btn btn--brand btn--sm"
                              disabled={isConfirming}
                              onClick={() => confirmDischargeMutation.mutate(appt)}
                            >
                              <Icon name="check" size={13} stroke={2.4} />
                              {isConfirming ? "Discharging…" : "Approve & discharge"}
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => setDischargePanel((prev) => ({ ...prev, [appt.appointment_id]: { ...prev[appt.appointment_id], step: "input" } }))}
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      )}

                      {/* action buttons */}
                      <div className="col gap-2" style={{ padding: "14px 18px", borderTop: "1px solid var(--c-border)", marginTop: "auto" }}>
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ width: "100%" }}
                          onClick={() => handleMonitorVitals(appt)}
                        >
                          <Icon name="activity" size={13} /> Monitor vitals
                        </button>
                        {/* #2: analysis status badge — shown above the analysis button */}
                        {appt.analysis_status && appt.analysis_status !== "PENDING" && (() => {
                          const cfg = {
                            IN_PROGRESS: { label: "Analyzing…",      color: "var(--c-ai)",      pulse: true  },
                            READY:       { label: "Analysis ready",   color: "var(--c-success)", pulse: false },
                            FAILED:      { label: "Analysis failed",  color: "var(--c-danger)",  pulse: false },
                            STALE:       { label: "Analysis stale",   color: "var(--c-muted)",   pulse: false },
                          }[appt.analysis_status];
                          if (!cfg) return null;
                          return (
                            <div className="row gap-2" style={{ padding: "4px 0", fontSize: 11, color: cfg.color }}>
                              <span className={cfg.pulse ? "pulse" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                              {cfg.label}
                            </div>
                          );
                        })()}
                        <button
                          className="btn btn--soft btn--sm"
                          style={{ width: "100%" }}
                          disabled={clinicalMutation.isPending && clinicalMutation.variables?.appointment_id === appt.appointment_id}
                          onClick={() => clinicalMutation.mutate(appt)}
                        >
                          <Icon name="sparkle" size={13} />
                          {clinicalMutation.isPending && clinicalMutation.variables?.appointment_id === appt.appointment_id
                            ? "Analyzing…" : "AI Clinical Analysis"}
                        </button>
                        {!panel && (
                          <button
                            className="btn btn--ai btn--sm"
                            style={{ width: "100%" }}
                            onClick={() => setDischargePanel((prev) => ({
                              ...prev,
                              [appt.appointment_id]: { step: "input", chiefComplaint: "", soapNotes: "", dischargeSummary: "", followupDays: 0, followupRecommendation: "" },
                            }))}
                          >
                            <Icon name="file_text" size={13} /> Initiate discharge
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>

                {/* sidebar */}
                <div className="col gap-3" style={{ position: "sticky", top: 24 }}>
                  <div className="ai-surface" style={{ padding: "16px 18px" }}>
                    <span className="kicker kicker--ai">Agent 05 · Discharge Planning</span>
                    <p style={{ margin: "10px 0 14px", font: "400 13px/1.5 var(--f-sans)", color: "var(--c-ai-ink)" }}>
                      AI generates SOAP notes + discharge summary from the patient's intake answers. Click <strong>Initiate discharge</strong> on any patient card to start.
                    </p>
                    <div className="col gap-2" style={{ marginTop: 4 }}>
                      {[
                        { l: "Admitted now",       v: admittedPatients.length },
                        { l: "Pending discharge",  v: admittedPatients.filter((a) => !!dischargePanel[a.appointment_id]).length },
                        { l: "Analysis ready",     v: admittedPatients.filter((a) => a.analysis_status === "READY").length },
                      ].map((s) => (
                        <div key={s.l} className="row" style={{ justifyContent: "space-between", font: "400 13px/1 var(--f-sans)" }}>
                          <span style={{ color: "var(--c-ai-ink)" }}>{s.l}</span>
                          <span style={{ font: "600 14px/1 var(--f-sans)", color: "var(--c-ai-ink)" }}>{s.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card" style={{ padding: "16px 18px" }}>
                    <span className="kicker">Agent 04 · Emergency Monitor</span>
                    <p style={{ margin: "10px 0 14px", font: "400 13px/1.5 var(--f-sans)", color: "var(--c-ink-2)" }}>
                      Stream live vitals from any admitted patient. Alerts fire if HR, BP, or SpO₂ cross critical thresholds.
                    </p>
                    <button className="btn btn--ghost btn--sm" style={{ width: "100%" }} onClick={() => navigate("/emergency-vitals")}>
                      <Icon name="activity" size={13} /> Open vitals wall
                    </button>
                  </div>

                  <div className="card" style={{ padding: "16px 18px" }}>
                    <span className="kicker">Agent 02 · Clinical Decision</span>
                    <p style={{ margin: "10px 0 14px", font: "400 13px/1.5 var(--f-sans)", color: "var(--c-ink-2)" }}>
                      Run AI clinical analysis on any patient to cross-reference similar cases and flag critical findings before discharge.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: Discharged ══════════════════════════════════ */}
        {activeTab === "discharged" && (
          <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
              <div className="col">
                <span className="kicker">Recently discharged</span>
                <h2 style={{ font: "600 26px/1.15 var(--f-sans)", margin: "6px 0 0", letterSpacing: "-.01em" }}>
                  Discharged patients
                </h2>
              </div>
              <div className="row gap-2">
                <div style={{ display: "inline-flex", padding: 3, background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: 10 }}>
                  {(["today", "history"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setDischargedSubTab(st)}
                      className={dischargedSubTab === st ? "btn btn--soft btn--xs" : "btn btn--ghost btn--xs"}
                      style={{ borderRadius: 7 }}
                    >
                      {st === "today" ? "Today" : "History"}
                    </button>
                  ))}
                </div>
                <button className="btn btn--ghost btn--sm"><Icon name="download" size={13} /> Export</button>
              </div>
            </div>

            {/* Agent 06 follow-up stats */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: 20 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
                <span className="kicker kicker--ai">Agent 06 · Post-Visit follow-up · last 30 days</span>
                {followupStatsQuery.isLoading && (
                  <span style={{ font: "400 12px/1 var(--f-sans)", color: "var(--c-muted)" }}>Loading…</span>
                )}
              </div>
              {(() => {
                const s = followupStatsQuery.data;
                const discharged = s?.discharged_30d ?? 0;
                const sent       = s?.followup_sent   ?? 0;
                const pending    = s?.followup_pending ?? 0;
                const pct = (v: number) => discharged > 0 ? Math.round((v / discharged) * 100) : 0;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    {[
                      { l: "Discharged (30d)", v: discharged, sub: "total",                       c: "var(--c-info)",    bar: 100 },
                      { l: "Follow-up sent",   v: sent,       sub: `${pct(sent)}% coverage`,      c: "var(--c-success)", bar: pct(sent) },
                      { l: "Pending",          v: pending,    sub: "awaiting scheduled send",      c: "var(--c-warn)",    bar: discharged > 0 ? pct(pending) : 0 },
                    ].map((f) => (
                      <div key={f.l} className="col gap-2" style={{ padding: "12px 14px", background: "var(--c-surface)", borderRadius: 10 }}>
                        <span style={{ font: "500 11px/1 var(--f-mono)", color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>{f.l}</span>
                        <span style={{ font: "600 28px/1 var(--f-sans)", color: f.c }}>{f.v}</span>
                        <div style={{ height: 4, background: "var(--c-hairline)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${f.bar}%`, background: f.c, borderRadius: 2 }} />
                        </div>
                        <span style={{ font: "400 11px/1.2 var(--f-sans)", color: "var(--c-muted)" }}>{f.sub}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* history filters */}
            {dischargedSubTab === "history" && (
              <div className="row gap-2" style={{ marginBottom: 16, padding: "10px 14px", background: "var(--c-card)", borderRadius: 10, border: "1px solid var(--c-border)", flexWrap: "wrap" }}>
                <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: 160, height: 36 }} />
                <span style={{ color: "var(--c-muted)", font: "400 13px/1 var(--f-sans)", alignSelf: "center" }}>to</span>
                <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: 160, height: 36 }} />
                <input className="input" type="text" placeholder="Search by email…" value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} style={{ flex: 1, height: 36, minWidth: 160 }} />
                {(fromDate || toDate || searchEmail) && (
                  <button className="btn btn--ghost btn--sm" onClick={() => { setFromDate(""); setToDate(""); setSearchEmail(""); }}>Clear</button>
                )}
              </div>
            )}

            {dischargedQuery.isLoading && <SkeletonList />}
            {dischargedQuery.isError && <ErrorMsg msg={(dischargedQuery.error as Error).message} />}

            {dischargedQuery.isSuccess && dischargedPatients.length === 0 && (
              <EmptyState icon="check" title={dischargedSubTab === "today" ? "No discharges today" : "No records found"} sub="Try adjusting the date range." />
            )}

            <div className="col gap-3">
              {dischargedPatients.map((appt) => {
                const notesOpen = expandedNotes.has(appt.appointment_id);
                const hasNotes = appt.soap_notes || appt.discharge_summary;
                return (
                  <div key={appt.appointment_id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div className="row gap-4" style={{ padding: "16px 20px", alignItems: "center" }}>
                      <Avatar name={appt.patient_name} tone="sage" size={40} />
                      <div className="col grow">
                        <div className="row gap-2">
                          <span style={{ font: "600 14.5px/1.2 var(--f-sans)" }}>{appt.patient_name}</span>
                          <span style={{ font: "400 12px/1 var(--f-sans)", color: "var(--c-muted)" }}>· {appt.speciality}</span>
                        </div>
                        <span style={{ font: "400 13px/1.3 var(--f-sans)", color: "var(--c-ink-2)", marginTop: 3 }}>
                          {formatDate(appt.appointment_date)} · {formatTime(appt.slot_start_time)}
                        </span>
                      </div>
                      <StatusPill status="Discharged" />
                      {/* Agent 6: follow-up status */}
                      {appt.followup_sent_at ? (
                        <span className="chip" style={{ background: "var(--c-success-soft)", color: "oklch(0.38 0.10 155)", fontSize: 11, whiteSpace: "nowrap" }}>
                          <Icon name="check" size={10} color="oklch(0.38 0.10 155)" /> Follow-up sent
                        </span>
                      ) : appt.discharge_summary ? (
                        <button
                          className="btn btn--soft btn--xs"
                          disabled={sendFollowupMutation.isPending && sendFollowupMutation.variables === appt.appointment_id}
                          onClick={() => sendFollowupMutation.mutate(appt.appointment_id)}
                          title="Send AI-personalized follow-up email to patient"
                        >
                          {sendFollowupMutation.isPending && sendFollowupMutation.variables === appt.appointment_id
                            ? "Sending…"
                            : <><Icon name="send" size={11} /> Send follow-up</>}
                        </button>
                      ) : null}
                      {hasNotes && (
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setExpandedNotes((prev) => {
                            const n = new Set(prev);
                            notesOpen ? n.delete(appt.appointment_id) : n.add(appt.appointment_id);
                            return n;
                          })}
                        >
                          {notesOpen ? <Icon name="chev_up" size={13} /> : <Icon name="chev_down" size={13} />}
                          {notesOpen ? "Hide notes" : "View notes"}
                        </button>
                      )}
                    </div>

                    {notesOpen && hasNotes && (
                      <div style={{ padding: "16px 20px 20px 76px", background: "var(--c-surface)", borderTop: "1px solid var(--c-border)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                          {appt.soap_notes && (
                            <div>
                              <span className="kicker">SOAP notes</span>
                              <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", font: "400 12px/1.6 var(--f-mono)", color: "var(--c-ink-2)" }}>
                                {appt.soap_notes}
                              </pre>
                            </div>
                          )}
                          {appt.discharge_summary && (
                            <div>
                              <span className="kicker kicker--ai">AI discharge summary</span>
                              <p style={{ margin: "8px 0 0", font: "400 13px/1.55 var(--f-sans)", color: "var(--c-ink-2)" }}>
                                {appt.discharge_summary}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ TAB: No-Show Risk ════════════════════════════════ */}
        {activeTab === "noshow" && (
          <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
              <div className="col">
                <span className="kicker">Predicted misses · Agent 03</span>
                <h2 style={{ font: "600 26px/1.15 var(--f-sans)", margin: "6px 0 0", letterSpacing: "-.01em" }}>
                  No-show risk
                </h2>
              </div>
              {/* #9: At Risk / History sub-tab toggle */}
              <div className="row gap-2">
                <div style={{ display: "inline-flex", padding: 3, background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: 10 }}>
                  {(["at-risk", "history"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setNoShowSubTab(st)}
                      className={noShowSubTab === st ? "btn btn--soft btn--xs" : "btn btn--ghost btn--xs"}
                      style={{ borderRadius: 7 }}
                    >
                      {st === "at-risk" ? "At Risk" : "History"}
                    </button>
                  ))}
                </div>
                {noShowSubTab === "history" && (
                  <>
                    <input className="input" type="date" value={nsFromDate} onChange={(e) => setNsFromDate(e.target.value)} style={{ width: 150, height: 36 }} />
                    <span style={{ color: "var(--c-muted)", alignSelf: "center" }}>to</span>
                    <input className="input" type="date" value={nsToDate} onChange={(e) => setNsToDate(e.target.value)} style={{ width: 150, height: 36 }} />
                    {(nsFromDate || nsToDate) && <button className="btn btn--ghost btn--sm" onClick={() => { setNsFromDate(""); setNsToDate(""); }}>Clear</button>}
                  </>
                )}
              </div>
            </div>

            {/* #9: At Risk sub-tab — upcoming BOOKED appointments with high noshow_risk */}
            {noShowSubTab === "at-risk" && (
              <>
                {atRiskQuery.isLoading && <SkeletonList />}
                {atRiskQuery.isError && <ErrorMsg msg={(atRiskQuery.error as Error).message} />}
                {atRiskQuery.isSuccess && (atRiskQuery.data ?? []).length === 0 && (
                  <EmptyState icon="check" title="No high-risk upcoming appointments" sub="High-risk patients appear here when no-show probability exceeds 65%." />
                )}
                {(atRiskQuery.data ?? []).length > 0 && (
                  <>
                    <AIBanner agent="Agent 03 · No-Show Manager" title={`${atRiskQuery.data!.length} upcoming appointments at high risk`}>
                      Send AI-personalized reminders now to reduce expected misses by 61%. Risk factors: commute distance, prior missed visits, self-pay status.
                    </AIBanner>
                    <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: 16 }}>
                      <div style={{
                        display: "grid", gridTemplateColumns: "2fr 1.4fr 0.9fr 2fr 0.8fr",
                        padding: "12px 20px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)",
                        font: "500 11px/1 var(--f-mono)", color: "var(--c-muted)", letterSpacing: ".08em", textTransform: "uppercase",
                      }}>
                        <span>Patient</span><span>Date / Time</span><span>Specialty</span><span>Risk score</span><span style={{ textAlign: "right" }}>Action</span>
                      </div>
                      {atRiskQuery.data!.map((appt, i) => {
                        const riskPct = riskFromScore(appt.noshow_risk);
                        return (
                          <div key={appt.appointment_id} style={{
                            display: "grid", gridTemplateColumns: "2fr 1.4fr 0.9fr 2fr 0.8fr",
                            padding: "14px 20px", borderBottom: i < atRiskQuery.data!.length - 1 ? "1px solid var(--c-hairline)" : "none",
                            alignItems: "center", background: "oklch(0.99 0.01 25)",
                          }}>
                            <div className="row gap-3" style={{ minWidth: 0 }}>
                              <Avatar name={appt.patient_name} tone="rose" size={32} />
                              <div className="col" style={{ minWidth: 0 }}>
                                <span style={{ font: "600 13.5px/1.2 var(--f-sans)" }}>{appt.patient_name}</span>
                                <span style={{ font: "400 11.5px/1.2 var(--f-sans)", color: "var(--c-muted)", marginTop: 2 }}>{appt.patient_email}</span>
                              </div>
                            </div>
                            <div className="col" style={{ gap: 2 }}>
                              <span style={{ font: "500 13px/1 var(--f-mono)" }}>{formatDate(appt.appointment_date)}</span>
                              <span style={{ font: "400 11px/1 var(--f-sans)", color: "var(--c-muted)" }}>{formatTime(appt.slot_start_time)}</span>
                            </div>
                            <span style={{ font: "400 12.5px/1.4 var(--f-sans)", color: "var(--c-ink-2)" }}>{appt.speciality}</span>
                            <div className="col gap-1">
                              <div style={{ height: 8, background: "var(--c-surface)", borderRadius: 4, overflow: "hidden", maxWidth: 140 }}>
                                <div style={{ height: "100%", width: `${riskPct}%`, background: "var(--c-danger)", borderRadius: 4 }} />
                              </div>
                              <span style={{ font: "500 11px/1 var(--f-mono)", color: "var(--c-danger)" }}>{riskPct}% risk</span>
                            </div>
                            <div className="row gap-1" style={{ justifyContent: "flex-end" }}>
                              <button className="btn btn--brand btn--xs"><Icon name="send" size={11} /> Remind</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {/* History sub-tab — confirmed NO_SHOW records */}
            {noShowSubTab === "history" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
                  {[
                    { l: "Filtered records",    v: filteredNoShow.length.toString(),  k: "matching date range", c: "var(--c-danger)" },
                    { l: "Total no-shows",      v: noShowAppts.length.toString(),     k: "all time",            c: "var(--c-ink)" },
                    { l: "High-risk no-shows",  v: noShowAppts.filter((a) => (a.noshow_risk ?? 0) > 0.65).length.toString(), k: "risk > 65%", c: "var(--c-warn)" },
                  ].map((s) => (
                    <div key={s.l} className="card" style={{ padding: "16px 18px" }}>
                      <span className="kicker">{s.l}</span>
                      <span className="serif tab-num" style={{ font: "500 32px/1 var(--f-serif)", display: "block", marginTop: 6, color: s.c }}>{s.v}</span>
                      <span style={{ font: "400 12px/1.3 var(--f-sans)", color: "var(--c-muted)", marginTop: 4, display: "block" }}>{s.k}</span>
                    </div>
                  ))}
                </div>

                {noShowQuery.isLoading && <SkeletonList />}
                {noShowQuery.isError && <ErrorMsg msg={(noShowQuery.error as Error).message} />}
                {noShowQuery.isSuccess && filteredNoShow.length === 0 && (
                  <EmptyState icon="check" title={noShowAppts.length === 0 ? "No missed appointments" : "No records for selected dates"} sub="Adjust the date range or check back later." />
                )}

                {filteredNoShow.length > 0 && (
                  <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{
                      display: "grid", gridTemplateColumns: "2fr 1.4fr 0.9fr 2fr 0.8fr",
                      padding: "12px 20px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)",
                      font: "500 11px/1 var(--f-mono)", color: "var(--c-muted)", letterSpacing: ".08em", textTransform: "uppercase",
                    }}>
                      <span>Patient</span><span>Appointment</span><span>Specialty</span><span>Risk score</span><span style={{ textAlign: "right" }}>Action</span>
                    </div>
                    {filteredNoShow.map((appt, i) => {
                      const riskPct = riskFromScore(appt.noshow_risk);
                      const isHigh = riskPct >= 65;
                      return (
                        <div key={appt.appointment_id} style={{
                          display: "grid", gridTemplateColumns: "2fr 1.4fr 0.9fr 2fr 0.8fr",
                          padding: "14px 20px", borderBottom: i < filteredNoShow.length - 1 ? "1px solid var(--c-hairline)" : "none",
                          alignItems: "center", background: isHigh ? "oklch(0.99 0.01 25)" : "transparent",
                        }}>
                          <div className="row gap-3" style={{ minWidth: 0 }}>
                            <Avatar name={appt.patient_name} tone={isHigh ? "rose" : "sand"} size={32} />
                            <div className="col" style={{ minWidth: 0 }}>
                              <span style={{ font: "600 13.5px/1.2 var(--f-sans)" }}>{appt.patient_name}</span>
                              <span style={{ font: "400 11.5px/1.2 var(--f-sans)", color: "var(--c-muted)", marginTop: 2 }}>{appt.patient_email}</span>
                            </div>
                          </div>
                          <span style={{ font: "500 13px/1 var(--f-mono)", color: "var(--c-ink)" }}>{formatDate(appt.appointment_date)}</span>
                          <span style={{ font: "400 12.5px/1.4 var(--f-sans)", color: "var(--c-ink-2)" }}>{appt.speciality}</span>
                          <div>
                            {riskPct > 0 ? (
                              <div className="col gap-1">
                                <div style={{ height: 8, background: "var(--c-surface)", borderRadius: 4, overflow: "hidden", maxWidth: 140 }}>
                                  <div style={{ height: "100%", width: `${riskPct}%`, background: riskPct >= 65 ? "var(--c-danger)" : riskPct >= 40 ? "var(--c-warn)" : "var(--c-success)", borderRadius: 4 }} />
                                </div>
                                <span style={{ font: "500 11px/1 var(--f-mono)", color: riskPct >= 65 ? "var(--c-danger)" : riskPct >= 40 ? "oklch(0.45 0.13 75)" : "oklch(0.40 0.10 155)" }}>
                                  {riskPct}% risk
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: "var(--c-faint)", font: "400 12px/1 var(--f-sans)" }}>No data</span>
                            )}
                          </div>
                          <div className="row gap-1" style={{ justifyContent: "flex-end" }}>
                            {isHigh ? <button className="btn btn--brand btn--xs">Contact</button> : <button className="btn btn--soft btn--xs">Remind</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small shared sub-components ──────────────────────────────
function SkeletonList() {
  return (
    <div className="col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "center" }}>
          <div className="shimmer-bg" style={{ width: 44, height: 44, borderRadius: "50%" }} />
          <div className="col gap-2" style={{ flex: 1 }}>
            <div className="shimmer-bg" style={{ height: 14, width: "40%", borderRadius: 4 }} />
            <div className="shimmer-bg" style={{ height: 12, width: "60%", borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="card" style={{ padding: "14px 18px", border: "1.5px solid var(--c-danger)", background: "var(--c-danger-soft)" }}>
      <span style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--c-danger)" }}>{msg}</span>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; sub: string }) {
  return (
    <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--c-muted)" }}>
      <Icon name={icon} size={32} color="var(--c-faint)" />
      <p style={{ margin: "16px 0 4px", font: "600 15px/1.3 var(--f-sans)", color: "var(--c-ink-2)" }}>{title}</p>
      <p style={{ margin: 0, font: "400 13px/1.5 var(--f-sans)" }}>{sub}</p>
    </div>
  );
}

// ── Chief complaint parser ────────────────────────────────────────────────────

function parseChiefComplaint(cc: string | null) {
  if (!cc) return { initial: "", qa: [] as { q: string; a: string }[] };
  const parts = cc.split("\n\nPatient intake answers:\n");
  const initial = parts[0].trim();
  if (parts.length < 2) return { initial, qa: [] };
  const qa = parts[1]
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n");
      const q = lines.find((l) => l.startsWith("Q: "))?.slice(3) ?? "";
      const a = lines.find((l) => l.startsWith("A: "))?.slice(3) ?? "";
      return { q, a };
    })
    .filter((p) => p.q && p.a);
  return { initial, qa };
}

// ── ScheduleRow ───────────────────────────────────────────────────────────────

const CANCEL_REASONS = ["PATIENT_REQUEST", "EMERGENCY", "RESCHEDULED", "OTHER"] as const;

function ScheduleRow({
  appt, showAdmit, onAdmit, isPending, onCancel, isCancelling,
}: {
  appt: DoctorAppointment;
  showAdmit: boolean;
  onAdmit: () => void;
  isPending: boolean;
  onCancel?: (reason: string) => void;
  isCancelling?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<typeof CANCEL_REASONS[number]>("PATIENT_REQUEST");
  const riskPct   = riskFromScore(appt.noshow_risk);
  const { initial, qa } = parseChiefComplaint(appt.chief_complaint);
  const hasComplaint = !!appt.chief_complaint;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* main row */}
      <div style={{ padding: "14px 18px", display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ width: 74, flexShrink: 0 }}>
          <div className="mono" style={{ font: "500 13px/1 var(--f-mono)", letterSpacing: ".02em" }}>
            {formatTime(appt.slot_start_time)}
          </div>
          <div style={{ font: "500 11px/1.2 var(--f-sans)", color: "var(--c-muted)", marginTop: 3 }}>
            {new Date(appt.appointment_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        </div>
        <div className="divider-v" />
        <Avatar name={appt.patient_name} tone={riskPct >= 70 ? "rose" : riskPct >= 40 ? "warm" : "primary"} size={40} />
        <div className="col grow" style={{ minWidth: 0 }}>
          <span style={{ font: "600 14px/1.2 var(--f-sans)" }}>{appt.patient_name}</span>
          <div className="row gap-2" style={{ marginTop: 2, flexWrap: "wrap" }}>
            <span style={{ font: "400 12px/1.3 var(--f-sans)", color: "var(--c-ink-2)" }}>{appt.speciality}</span>
            {appt.intervention_message && (
              <span className="chip" style={{ fontSize: 10, height: 18, background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 4 }}>
                ✓ Reminder sent
              </span>
            )}
          </div>
          {/* chief complaint preview */}
          {initial && (
            <span style={{
              font: "400 11.5px/1.3 var(--f-sans)", color: "var(--c-muted)",
              marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              💬 {initial}
            </span>
          )}
        </div>
        {riskPct > 0 && <RiskScore value={riskPct} />}
        {hasComplaint && (
          <button
            className="btn btn--ghost btn--sm"
            style={{ flexShrink: 0, fontSize: 11 }}
            onClick={() => setExpanded((v) => !v)}
          >
            <Icon name={expanded ? "chev_up" : "chev_down"} size={12} />
            {expanded ? "Hide" : "Intake"}
          </button>
        )}
        {showAdmit && (
          <button
            className="btn btn--brand btn--sm"
            style={{ minWidth: 88, flexShrink: 0 }}
            disabled={isPending}
            onClick={onAdmit}
          >
            <Icon name="plus" size={12} stroke={2.4} /> Admit
          </button>
        )}
        {/* #4: cancel button — only for BOOKED appointments */}
        {onCancel && appt.status === "booked" && (
          <button
            className="btn btn--ghost btn--sm"
            style={{ flexShrink: 0, color: "var(--c-danger)" }}
            onClick={() => setShowCancel((v) => !v)}
          >
            <Icon name="x" size={12} />
          </button>
        )}
      </div>

      {/* #4: cancel reason picker */}
      {showCancel && onCancel && (
        <div className="row gap-2" style={{ padding: "10px 18px", background: "var(--c-danger-soft)", borderTop: "1px solid oklch(0.88 0.06 25)" }}>
          <select
            className="input"
            style={{ height: 32, fontSize: 12 }}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value as typeof CANCEL_REASONS[number])}
          >
            {CANCEL_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
          <button
            className="btn btn--sm"
            style={{ background: "var(--c-danger)", color: "#fff", flexShrink: 0 }}
            disabled={isCancelling}
            onClick={() => { onCancel(cancelReason); setShowCancel(false); }}
          >
            {isCancelling ? "Cancelling…" : "Confirm cancel"}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setShowCancel(false)}>Dismiss</button>
        </div>
      )}

      {/* expandable intake Q&A */}
      {expanded && hasComplaint && (
        <div style={{ padding: "14px 18px 18px", background: "var(--c-surface)", borderTop: "1px solid var(--c-border)" }}>
          <span className="kicker kicker--ai" style={{ display: "block", marginBottom: 10 }}>
            Patient intake · AI collected
          </span>
          <p style={{ margin: "0 0 12px", font: "500 13px/1.5 var(--f-sans)", color: "var(--c-ink)" }}>
            {initial}
          </p>
          {qa.length > 0 && (
            <div className="col gap-3">
              {qa.map((pair, i) => (
                <div key={i} style={{ paddingLeft: 12, borderLeft: "2px solid var(--c-ai)" }}>
                  <div style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--c-ai-ink)", marginBottom: 2 }}>
                    {pair.q}
                  </div>
                  <div style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--c-ink-2)" }}>
                    {pair.a}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {false && <StatusPill status="Booked" />}
    </div>
  );
}
