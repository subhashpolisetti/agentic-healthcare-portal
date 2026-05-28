import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import type { Appointment, AuthUser } from "../types";
import { AppHeader, TabStrip, Icon, StatusPill } from "../components";
import type { TabItem } from "../components";

const PATIENT_TABS: TabItem[] = [
  { key: "book",  label: "Book Appointment", icon: "plus" },
  { key: "appts", label: "My Appointments",  icon: "calendar" },
];

type Filter = "all" | "upcoming" | "in-care" | "completed" | "missed";

function icsDate(dateStr: string, timeStr: string, offsetMinutes = 0): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min]  = timeStr.split(":").map(Number);
  const dt = new Date(y, m - 1, d, h, min + offsetMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

function downloadIcs(appointments: Appointment[]) {
  const upcoming = appointments.filter((a) => a.status.toLowerCase() === "booked");
  if (!upcoming.length) return;

  const events = upcoming.map((a) => [
    "BEGIN:VEVENT",
    `UID:appt-${a.appointment_id}@healthcare.portal`,
    `DTSTART:${icsDate(a.appointment_date, a.slot_start_time)}`,
    `DTEND:${icsDate(a.appointment_date, a.slot_start_time, 30)}`,
    `SUMMARY:Appointment with ${a.doctor_name}`,
    `DESCRIPTION:${a.speciality} consultation via AI HealthCare Portal`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
  ].join("\r\n")).join("\r\n");

  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AI HealthCare Portal//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", events, "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a   = document.createElement("a");
  a.href = url;
  a.download = "appointments.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const STATUS_ACCENT: Record<string, string> = {
  booked:     "var(--c-info)",
  admitted:   "var(--c-warn)",
  discharged: "var(--c-success)",
  "no show":  "var(--c-danger)",
  "no_show":  "var(--c-danger)",
};

const STATUS_TONE: Record<string, string> = {
  booked:     "primary",
  admitted:   "warm",
  discharged: "sage",
  "no show":  "rose",
  "no_show":  "rose",
};

function matchesFilter(appt: Appointment, filter: Filter): boolean {
  const s = appt.status.toLowerCase();
  if (filter === "all") return true;
  if (filter === "upcoming") return s === "booked";
  if (filter === "in-care") return s === "admitted";
  if (filter === "completed") return s === "discharged";
  if (filter === "missed") return s === "no show" || s === "no_show";
  return true;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    day:   d.getDate().toString().padStart(2, "0"),
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
  };
}

type Props = { user: AuthUser | null };

export function AppointmentsPage({ user }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>((searchParams.get("filter") as Filter) ?? "all");
  const [followupExpanded, setFollowupExpanded] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  function toggleNotes(id: number) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const [syncMsg, setSyncMsg] = useState("");

  const query = useQuery({
    queryKey: ["appointments-me"],
    queryFn:  () => apiFetch<Appointment[]>("/appointments/me"),
    enabled:  Boolean(user),
  });

  if (!user) return (
    <div className="col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <AppHeader role="Patient" name="Patient" />
      <div style={{ padding: 64, textAlign: "center", color: "var(--c-muted)" }}>
        Please log in to view your appointments.
      </div>
    </div>
  );

  const rawData = query.data as Appointment[] | { appointments?: Appointment[] } | undefined;
  const appointments: Appointment[] = Array.isArray(rawData)
    ? rawData
    : (rawData as { appointments?: Appointment[] } | undefined)?.appointments ?? [];

  const filtered = appointments.filter((a) => matchesFilter(a, filter));

  const counts = {
    all:       appointments.length,
    upcoming:  appointments.filter((a) => a.status.toLowerCase() === "booked").length,
    "in-care": appointments.filter((a) => a.status.toLowerCase() === "admitted").length,
    completed: appointments.filter((a) => a.status.toLowerCase() === "discharged").length,
    missed:    appointments.filter((a) => ["no show", "no_show"].includes(a.status.toLowerCase())).length,
  };

  const pendingFollowup = appointments.find(
    (a) => a.status.toLowerCase() === "discharged" && !a.followup_sent_at
  );
  const sentFollowup = appointments.find((a) => a.followup_sent_at);

  const filterLabels: Array<{ key: Filter; label: string }> = [
    { key: "all",       label: "All" },
    { key: "upcoming",  label: "Upcoming" },
    { key: "in-care",   label: "In-care" },
    { key: "completed", label: "Completed" },
    { key: "missed",    label: "Missed" },
  ];

  return (
    <div className="col" style={{ minHeight: "100vh", background: "var(--c-bg)" }}>
      <AppHeader role="Patient" name={user.full_name} />
      <TabStrip items={PATIENT_TABS} active="appts" onChange={(key) => key === "book" && navigate("/")} />

      <div style={{ flex: 1, padding: "32px 64px", overflow: "auto" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          {/* page header */}
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div className="col">
              <h1 style={{ font: "600 24px/1.1 var(--f-sans)", letterSpacing: "-.02em", margin: 0 }}>
                Appointments
              </h1>
              <span style={{ font: "400 13px/1 var(--f-sans)", color: "var(--c-muted)", marginTop: 4 }}>
                {counts.all} total · {counts.upcoming} upcoming
              </span>
            </div>
            <div className="row gap-2">
              <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    const upcoming = appointments.filter((a) => a.status.toLowerCase() === "booked");
                    if (!upcoming.length) {
                      setSyncMsg("No upcoming appointments to sync.");
                      setTimeout(() => setSyncMsg(""), 3000);
                      return;
                    }
                    downloadIcs(appointments);
                    setSyncMsg(`${upcoming.length} appointment${upcoming.length > 1 ? "s" : ""} downloaded — open the .ics file to import.`);
                    setTimeout(() => setSyncMsg(""), 4000);
                  }}
                >
                  <Icon name="calendar" size={13} /> Sync calendar
                </button>
                {syncMsg && (
                  <span style={{ font: "400 11px/1.3 var(--f-sans)", color: "var(--c-muted)", textAlign: "right", maxWidth: 220 }}>
                    {syncMsg}
                  </span>
                )}
              </div>
              <a
                href="/"
                className="btn btn--brand btn--sm"
                style={{ textDecoration: "none" }}
              >
                <Icon name="plus" size={13} /> Book new
              </a>
            </div>
          </div>

          {/* filter pills */}
          <div className="row gap-2" style={{ marginBottom: 18, flexWrap: "wrap" }}>
            {filterLabels.map(({ key, label }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                    font: `${active ? "600" : "500"} 13px/1 var(--f-sans)`,
                    background: active ? "var(--c-ink)" : "var(--c-card)",
                    color: active ? "#fff" : "var(--c-ink-2)",
                    border: "1px solid var(--c-border)",
                    display: "inline-flex", alignItems: "center", gap: 8,
                  }}
                >
                  {label}
                  <span style={{
                    font: "500 11px/1 var(--f-mono)",
                    color: active ? "rgba(255,255,255,.7)" : "var(--c-muted)",
                  }}>
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* loading / error */}
          {query.isLoading && (
            <div className="col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card" style={{ padding: 0, overflow: "hidden", display: "flex", height: 96 }}>
                  <div className="shimmer-bg" style={{ width: 6, alignSelf: "stretch" }} />
                  <div className="row gap-4" style={{ flex: 1, padding: "18px 22px" }}>
                    <div className="shimmer-bg" style={{ width: 78, height: 48, borderRadius: 8 }} />
                    <div className="shimmer-bg" style={{ width: 44, height: 44, borderRadius: "50%" }} />
                    <div className="col gap-2" style={{ flex: 1 }}>
                      <div className="shimmer-bg" style={{ height: 14, width: "40%", borderRadius: 4 }} />
                      <div className="shimmer-bg" style={{ height: 12, width: "60%", borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {query.isError && (
            <p style={{ color: "var(--c-danger)", font: "400 13px/1.5 var(--f-sans)" }}>
              Failed to load appointments. Please try again.
            </p>
          )}

          {/* appointment cards */}
          {!query.isLoading && (
            <div className="col gap-3">
              {filtered.length === 0 && (
                <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--c-muted)", font: "400 14px/1.5 var(--f-sans)" }}>
                  No appointments in this category yet.
                </div>
              )}
              {filtered.map((appt) => {
                const s = appt.status.toLowerCase();
                const accent = STATUS_ACCENT[s] ?? "var(--c-border)";
                const tone   = STATUS_TONE[s] ?? "sand";
                const { day, month } = formatDate(appt.appointment_date);
                const followupLabel = appt.followup_sent_at
                  ? `Follow-up sent ${new Date(appt.followup_sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : null;

                return (
                  <div key={appt.appointment_id} className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex" }}>
                    <div style={{ width: 6, alignSelf: "stretch", background: accent, flexShrink: 0 }} />
                    <div style={{ padding: "18px 22px", display: "flex", gap: 18, alignItems: "center", flex: 1 }}>
                      {/* date block */}
                      <div className="col" style={{ width: 78, textAlign: "center", flexShrink: 0 }}>
                        <span className="mono" style={{ font: "500 11px/1 var(--f-mono)", color: "var(--c-muted)", letterSpacing: ".08em" }}>
                          {month}
                        </span>
                        <span className="serif" style={{ font: "500 32px/1 var(--f-serif)", marginTop: 2 }}>
                          {day}
                        </span>
                        <span style={{ font: "500 12px/1.2 var(--f-sans)", color: "var(--c-muted)", marginTop: 4 }}>
                          {appt.slot_start_time}
                        </span>
                      </div>

                      <div className="divider-v" />

                      <Avatar name={appt.doctor_name} tone={tone as Parameters<typeof Avatar>[0]["tone"]} size={44} />

                      <div className="col grow">
                        <div className="row gap-2">
                          <span style={{ font: "600 15px/1.2 var(--f-sans)" }}>{appt.doctor_name}</span>
                          <span style={{ font: "400 13px/1 var(--f-sans)", color: "var(--c-muted)" }}>
                            · {appt.speciality}
                          </span>
                        </div>
                        <span style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--c-ink-2)", marginTop: 3 }}>
                          {s === "admitted" ? "Currently being seen" : s === "discharged" ? "Discharged" : s === "booked" ? "Upcoming appointment" : "Missed appointment"}
                        </span>
                        {followupLabel && (
                          <div className="row gap-2" style={{ marginTop: 8 }}>
                            <span style={{ width: 14, height: 14, borderRadius: 4, background: "var(--c-ai-soft)", display: "grid", placeItems: "center" }}>
                              <Icon name="sparkle" size={9} color="var(--c-ai-ink)" stroke={2} />
                            </span>
                            <span className="mono" style={{ font: "500 11px/1 var(--f-mono)", color: "var(--c-ai-ink)", letterSpacing: ".04em" }}>
                              AI FOLLOW-UP · {followupLabel}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="col gap-2" style={{ alignItems: "flex-end" }}>
                        <StatusPill status={appt.status} />
                        {s === "discharged" && appt.discharge_summary && (
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => toggleNotes(appt.appointment_id)}
                          >
                            {expandedNotes.has(appt.appointment_id) ? "Hide notes" : "View notes"}
                            <span style={{ transform: expandedNotes.has(appt.appointment_id) ? "rotate(90deg)" : "none", transition: "transform .2s", display: "inline-flex" }}><Icon name="chev_right" size={12} /></span>
                          </button>
                        )}
                      </div>
                    </div>
                    </div>

                    {/* expanded notes */}
                    {s === "discharged" && expandedNotes.has(appt.appointment_id) && (
                      <div style={{ borderTop: "1px solid var(--c-border)", padding: "16px 22px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                        {appt.discharge_summary && (
                          <div>
                            <span className="kicker" style={{ marginBottom: 6, display: "block" }}>Discharge summary</span>
                            <p style={{ font: "400 13px/1.6 var(--f-sans)", color: "var(--c-ink-2)", margin: 0, whiteSpace: "pre-wrap" }}>
                              {appt.discharge_summary}
                            </p>
                          </div>
                        )}
                        {!appt.discharge_summary && (
                          <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--c-muted)", margin: 0 }}>
                            No notes available for this visit.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* AI follow-up nudge — only relevant on all/completed tabs */}
          {(sentFollowup || pendingFollowup) && !query.isLoading && (filter === "all" || filter === "completed") && (
            <div style={{ marginTop: 28 }}>
              <span className="kicker" style={{ marginBottom: 10, display: "block" }}>Post-visit follow-up</span>
              <div
                style={{
                  borderRadius: 12, overflow: "hidden",
                  border: "1px solid var(--c-ai-border, oklch(0.88 0.06 295))",
                  background: "var(--c-ai-soft)",
                }}
              >
                {/* header row */}
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 18px", cursor: sentFollowup ? "pointer" : "default",
                  }}
                  onClick={() => sentFollowup && setFollowupExpanded((v) => !v)}
                >
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--c-ai-soft)", border: "1px solid var(--c-ai-border, oklch(0.88 0.06 295))", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name="sparkle" size={12} color="var(--c-ai-ink)" stroke={2} />
                  </span>
                  <div className="col" style={{ flex: 1 }}>
                    <span className="mono" style={{ font: "500 10px/1 var(--f-mono)", color: "var(--c-ai-ink)", letterSpacing: ".08em" }}>
                      AGENT 06 · POST-VISIT
                    </span>
                    <span style={{ font: "500 13px/1.4 var(--f-sans)", color: "var(--c-ink)", marginTop: 3 }}>
                      {sentFollowup
                        ? `A follow-up was sent for your visit with ${sentFollowup.doctor_name} — check your email.`
                        : `You have a recent discharge from ${pendingFollowup?.doctor_name}. A follow-up will be sent soon.`}
                    </span>
                  </div>
                  {sentFollowup && (
                    <span style={{ transform: followupExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s", display: "inline-flex" }}>
                      <Icon name="chev_right" size={14} color="var(--c-ai-ink)" />
                    </span>
                  )}
                </div>

                {/* expanded details */}
                {sentFollowup && followupExpanded && (
                  <div
                    style={{
                      padding: "0 18px 16px 52px",
                      display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px",
                      borderTop: "1px solid var(--c-ai-border, oklch(0.88 0.06 295))",
                      paddingTop: 14,
                    }}
                  >
                    {[
                      { label: "Doctor",      value: sentFollowup.doctor_name },
                      { label: "Speciality",  value: sentFollowup.speciality },
                      { label: "Visit date",  value: new Date(sentFollowup.appointment_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
                      { label: "Follow-up sent", value: new Date(sentFollowup.followup_sent_at!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
                    ].map(({ label, value }) => (
                      <div key={label} className="col" style={{ gap: 2 }}>
                        <span style={{ font: "500 10px/1 var(--f-mono)", color: "var(--c-muted)", letterSpacing: ".06em" }}>
                          {label.toUpperCase()}
                        </span>
                        <span style={{ font: "500 13px/1.3 var(--f-sans)", color: "var(--c-ink)" }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Avatar with correct tone type
function Avatar({
  name = "?", tone = "primary", size = 36,
}: {
  name?: string; tone?: string; size?: number;
}) {
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0] ?? "").join("").toUpperCase();
  const palette: Record<string, [string, string]> = {
    primary: ["oklch(0.92 0.04 180)", "oklch(0.30 0.05 180)"],
    ai:      ["oklch(0.94 0.04 295)", "oklch(0.40 0.13 295)"],
    warm:    ["oklch(0.92 0.05 60)",  "oklch(0.40 0.08 60)"],
    rose:    ["oklch(0.92 0.05 20)",  "oklch(0.42 0.10 20)"],
    sage:    ["oklch(0.92 0.04 145)", "oklch(0.40 0.06 145)"],
    sky:     ["oklch(0.92 0.04 230)", "oklch(0.40 0.08 230)"],
    sand:    ["oklch(0.94 0.025 85)", "oklch(0.40 0.04 85)"],
  };
  const [bg, fg] = palette[tone] ?? palette.sand;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--f-sans)", fontWeight: 600, fontSize: size * 0.36,
      letterSpacing: ".02em", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
