import { useState } from "react";
import { apiFetch } from "../api/client";
import type { AuthUser } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────────

type NppesDoctorResult = {
  npi: string;
  doctor_name: string;
  specialty: string;
  credential: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  score?: number;
};

type PortalDoctor = {
  id: number;
  npi: string | null;
  doctor_name: string;
  speciality: string;
  email: string | null;
  city: string | null;
  state: string | null;
  linked: boolean;
  created_at: string;
};

type PortalUser = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
};

type Stats = {
  total_doctors: number;
  total_users: number;
  total_appointments: number;
};

// ── Component ──────────────────────────────────────────────────────────────────

export function AdminPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  // search state
  const [searchMode, setSearchMode] = useState<"npi" | "name">("npi");
  const [npiInput, setNpiInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [stateInput, setStateInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [searchResults, setSearchResults] = useState<NppesDoctorResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // management tab
  const [mgmtTab, setMgmtTab] = useState<"doctors" | "users">("doctors");
  const [portalDoctors, setPortalDoctors] = useState<PortalDoctor[] | null>(null);
  const [portalUsers, setPortalUsers] = useState<PortalUser[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mgmtLoading, setMgmtLoading] = useState(false);

  // import state: npi → "importing" | "done" | "error"
  const [importState, setImportState] = useState<Record<string, string>>({});

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleSearch() {
    setSearchError("");
    setSearchResults([]);
    setSearchLoading(true);
    try {
      if (searchMode === "npi") {
        const result = await apiFetch<NppesDoctorResult>(
          `/admin/doctors/nppes/lookup?npi=${encodeURIComponent(npiInput.trim())}`,
        );
        setSearchResults([result]);
      } else {
        const params = new URLSearchParams();
        if (nameInput.trim()) params.set("name", nameInput.trim());
        if (stateInput.trim()) params.set("state", stateInput.trim());
        if (cityInput.trim()) params.set("city", cityInput.trim());
        if (specialtyInput.trim()) params.set("specialty", specialtyInput.trim());
        params.set("top_k", "15");
        const result = await apiFetch<{ doctors: NppesDoctorResult[] }>(
          `/admin/doctors/nppes/search?${params.toString()}`,
        );
        setSearchResults(result.doctors);
      }
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleImport(doc: NppesDoctorResult) {
    setImportState((s) => ({ ...s, [doc.npi]: "importing" }));
    try {
      await apiFetch("/admin/doctors/import", {
        method: "POST",
        body: JSON.stringify({
          npi: doc.npi,
          doctor_name: doc.doctor_name,
          specialty: doc.specialty,
          city: doc.city,
          state: doc.state,
          zip: doc.zip,
          phone: doc.phone,
        }),
      });
      setImportState((s) => ({ ...s, [doc.npi]: "done" }));
      // refresh portal doctors if tab is open
      if (portalDoctors !== null) loadPortalDoctors();
    } catch {
      setImportState((s) => ({ ...s, [doc.npi]: "error" }));
    }
  }

  async function loadStats() {
    const s = await apiFetch<Stats>("/admin/stats");
    setStats(s);
  }

  async function loadPortalDoctors() {
    setMgmtLoading(true);
    try {
      const [doctors, s] = await Promise.all([
        apiFetch<PortalDoctor[]>("/admin/doctors"),
        apiFetch<Stats>("/admin/stats"),
      ]);
      setPortalDoctors(doctors);
      setStats(s);
    } finally {
      setMgmtLoading(false);
    }
  }

  async function loadPortalUsers() {
    setMgmtLoading(true);
    try {
      const [users, s] = await Promise.all([
        apiFetch<PortalUser[]>("/admin/users"),
        apiFetch<Stats>("/admin/stats"),
      ]);
      setPortalUsers(users);
      setStats(s);
    } finally {
      setMgmtLoading(false);
    }
  }

  function handleMgmtTabClick(tab: "doctors" | "users") {
    setMgmtTab(tab);
    if (tab === "doctors" && portalDoctors === null) loadPortalDoctors();
    if (tab === "users" && portalUsers === null) loadPortalUsers();
    if (stats === null) loadStats();
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <span style={styles.logo}>AI Healthcare Portal</span>
            <span className="chip chip--warn" style={{ marginLeft: 12 }}>Admin</span>
          </div>
          <div className="row gap-3">
            <span style={{ font: "var(--t-small)", color: "var(--c-muted)" }}>{user.email}</span>
            <button className="btn btn--ghost btn--sm" onClick={onLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* Stats bar */}
        <StatsBar stats={stats} onLoad={loadStats} />

        {/* NPPES Doctor Search */}
        <section className="card card--padded" style={{ marginBottom: 24 }}>
          <div className="row gap-3" style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, font: "var(--t-h3)" }}>NPPES Doctor Search</h2>
            <div className="row gap-2" style={{ marginLeft: "auto" }}>
              <button
                className={`btn btn--sm ${searchMode === "npi" ? "btn--primary" : "btn--ghost"}`}
                onClick={() => { setSearchMode("npi"); setSearchResults([]); setSearchError(""); }}
              >
                NPI Lookup
              </button>
              <button
                className={`btn btn--sm ${searchMode === "name" ? "btn--primary" : "btn--ghost"}`}
                onClick={() => { setSearchMode("name"); setSearchResults([]); setSearchError(""); }}
              >
                Name / Location
              </button>
            </div>
          </div>

          {searchMode === "npi" ? (
            <div className="row gap-3" style={{ marginBottom: 16 }}>
              <input
                className="input"
                style={{ maxWidth: 260 }}
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit NPI"
                value={npiInput}
                onChange={(e) => setNpiInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
              <button
                className="btn btn--brand"
                disabled={npiInput.length !== 10 || searchLoading}
                onClick={handleSearch}
              >
                {searchLoading ? "Looking up…" : "Lookup"}
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, marginBottom: 16 }}>
              <input className="input" placeholder="Doctor name" value={nameInput}
                onChange={(e) => setNameInput(e.target.value)} />
              <input className="input" placeholder="Specialty" value={specialtyInput}
                onChange={(e) => setSpecialtyInput(e.target.value)} />
              <input className="input" placeholder="State (e.g. TX)" maxLength={2} value={stateInput}
                onChange={(e) => setStateInput(e.target.value.toUpperCase())} />
              <input className="input" placeholder="City" value={cityInput}
                onChange={(e) => setCityInput(e.target.value)} />
              <button className="btn btn--brand" disabled={searchLoading} onClick={handleSearch}>
                {searchLoading ? "Searching…" : "Search"}
              </button>
            </div>
          )}

          {searchError && (
            <p className="chip chip--danger" style={{ display: "block", marginBottom: 12 }}>{searchError}</p>
          )}

          {searchResults.length > 0 && (
            <SearchResultsTable
              results={searchResults}
              importState={importState}
              onImport={handleImport}
            />
          )}
          {!searchLoading && searchResults.length === 0 && !searchError && (
            <p style={{ color: "var(--c-muted)", font: "var(--t-small)", margin: 0 }}>
              Search NPPES to find and import doctors into the portal.
            </p>
          )}
        </section>

        {/* Portal Management */}
        <section className="card" style={{ marginBottom: 24 }}>
          <div className="row gap-0" style={{ borderBottom: "1px solid var(--c-border)", padding: "0 24px" }}>
            {(["doctors", "users"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleMgmtTabClick(tab)}
                style={{
                  ...styles.tab,
                  ...(mgmtTab === tab ? styles.tabActive : {}),
                }}
              >
                {tab === "doctors" ? "Portal Doctors" : "All Users"}
              </button>
            ))}
          </div>

          <div style={{ padding: 24 }}>
            {mgmtLoading && (
              <p style={{ color: "var(--c-muted)", font: "var(--t-small)" }}>Loading…</p>
            )}

            {mgmtTab === "doctors" && !mgmtLoading && portalDoctors !== null && (
              <PortalDoctorsTable doctors={portalDoctors} />
            )}

            {mgmtTab === "users" && !mgmtLoading && portalUsers !== null && (
              <PortalUsersTable users={portalUsers} />
            )}

            {!mgmtLoading && mgmtTab === "doctors" && portalDoctors === null && (
              <button className="btn btn--ghost btn--sm" onClick={loadPortalDoctors}>Load portal doctors</button>
            )}
            {!mgmtLoading && mgmtTab === "users" && portalUsers === null && (
              <button className="btn btn--ghost btn--sm" onClick={loadPortalUsers}>Load users</button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatsBar({ stats, onLoad }: { stats: Stats | null; onLoad: () => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
      {[
        { label: "Portal Doctors", value: stats?.total_doctors, color: "var(--c-primary)" },
        { label: "Registered Users", value: stats?.total_users, color: "var(--c-ai)" },
        { label: "Total Appointments", value: stats?.total_appointments, color: "var(--c-success)" },
      ].map(({ label, value, color }) => (
        <div
          key={label}
          className="card card--padded"
          style={{ cursor: value === undefined ? "pointer" : "default" }}
          onClick={value === undefined ? onLoad : undefined}
        >
          <div style={{ font: "var(--t-caption)", color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ font: "600 32px/1 var(--f-sans)", color }}>
            {value !== undefined ? value.toLocaleString() : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchResultsTable({
  results,
  importState,
  onImport,
}: {
  results: NppesDoctorResult[];
  importState: Record<string, string>;
  onImport: (d: NppesDoctorResult) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {["NPI", "Name", "Specialty", "Credential", "City", "State", "Phone", "Match", ""].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((d) => {
            const state = importState[d.npi];
            return (
              <tr key={d.npi} style={styles.tr}>
                <td style={{ ...styles.td, fontFamily: "var(--f-mono)", fontSize: 12 }}>{d.npi || "—"}</td>
                <td style={{ ...styles.td, fontWeight: 500 }}>{d.doctor_name}</td>
                <td style={styles.td}>{d.specialty || "—"}</td>
                <td style={styles.td}>{d.credential || "—"}</td>
                <td style={styles.td}>{d.city || "—"}</td>
                <td style={styles.td}>{d.state || "—"}</td>
                <td style={{ ...styles.td, fontFamily: "var(--f-mono)", fontSize: 12 }}>{d.phone || "—"}</td>
                <td style={styles.td}>
                  {d.score !== undefined ? (
                    <span style={{ color: d.score > 0.7 ? "var(--c-success)" : "var(--c-muted)" }}>
                      {Math.round(d.score * 100)}%
                    </span>
                  ) : "—"}
                </td>
                <td style={styles.td}>
                  {state === "done" ? (
                    <span className="chip chip--success">Imported</span>
                  ) : state === "error" ? (
                    <span className="chip chip--danger">Failed</span>
                  ) : (
                    <button
                      className="btn btn--brand btn--xs"
                      disabled={state === "importing"}
                      onClick={() => onImport(d)}
                    >
                      {state === "importing" ? "…" : "Import"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PortalDoctorsTable({ doctors }: { doctors: PortalDoctor[] }) {
  if (doctors.length === 0) {
    return <p style={{ color: "var(--c-muted)", font: "var(--t-small)" }}>No doctors in portal yet. Import from NPPES above.</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {["NPI", "Name", "Specialty", "Email", "City", "State", "Account"].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doctors.map((d) => (
            <tr key={d.id} style={styles.tr}>
              <td style={{ ...styles.td, fontFamily: "var(--f-mono)", fontSize: 12 }}>{d.npi || "—"}</td>
              <td style={{ ...styles.td, fontWeight: 500 }}>{d.doctor_name}</td>
              <td style={styles.td}>{d.speciality}</td>
              <td style={{ ...styles.td, color: "var(--c-muted)" }}>{d.email || "—"}</td>
              <td style={styles.td}>{d.city || "—"}</td>
              <td style={styles.td}>{d.state || "—"}</td>
              <td style={styles.td}>
                <span className={`chip ${d.linked ? "chip--success" : "chip--warn"}`}>
                  {d.linked ? "Linked" : "Unlinked"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortalUsersTable({ users }: { users: PortalUser[] }) {
  const roleColor: Record<string, string> = {
    admin: "chip--danger",
    doctor: "chip--primary",
    patient: "chip--info",
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {["ID", "Name", "Email", "Role", "Joined"].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={styles.tr}>
              <td style={{ ...styles.td, color: "var(--c-muted)" }}>{u.id}</td>
              <td style={{ ...styles.td, fontWeight: 500 }}>{u.full_name}</td>
              <td style={{ ...styles.td, color: "var(--c-muted)" }}>{u.email}</td>
              <td style={styles.td}>
                <span className={`chip ${roleColor[u.role] ?? ""}`}>{u.role}</span>
              </td>
              <td style={{ ...styles.td, color: "var(--c-muted)", fontSize: 12 }}>
                {new Date(u.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--c-bg)",
  },
  header: {
    background: "var(--c-card)",
    borderBottom: "1px solid var(--c-border)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 24px",
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    font: "600 16px/1 var(--f-sans)",
    color: "var(--c-ink)",
  },
  main: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 24px",
  },
  tab: {
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "12px 20px",
    cursor: "pointer",
    font: "var(--t-body-strong)",
    color: "var(--c-muted)",
    marginBottom: -1,
  },
  tabActive: {
    color: "var(--c-ink)",
    borderBottomColor: "var(--c-primary)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    font: "var(--t-small)",
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 12px",
    font: "var(--t-caption)",
    letterSpacing: ".08em",
    textTransform: "uppercase" as const,
    color: "var(--c-muted)",
    borderBottom: "1px solid var(--c-border)",
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid var(--c-hairline)",
    verticalAlign: "middle" as const,
  },
  tr: {
    transition: "background .1s",
  },
};
