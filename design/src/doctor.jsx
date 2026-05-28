/* Doctor dashboard — 5 tabs */

const DOCTOR_NAV = [
  { key:"clinical",   label:"Clinical Analysis", icon:"file_text" },
  { key:"schedule",   label:"Patient Schedule",  icon:"calendar", count:14 },
  { key:"admitted",   label:"Admitted",          icon:"bed",      count:3 },
  { key:"discharged", label:"Discharged",        icon:"check" },
  { key:"noshow",     label:"No-Show Risk",      icon:"alert",    count:5 },
];

const DoctorShell = ({ active, children, activeAgents = [1,2,3,4,5,6] }) => (
  <div className="frame app col" style={{height:"100%"}}>
    <AppHeader role="Doctor" name="Dr. Aisha Rahman" roleColor="ai"/>
    <AgentsStrip activeIds={activeAgents}/>
    <TabStrip items={DOCTOR_NAV} active={active}/>
    <div style={{flex:1, overflow:"hidden", background:"var(--c-bg)"}}>{children}</div>
  </div>
);

/* ── TAB 1 · Clinical Analysis (SOAP) ─────────────────────── */
const Doctor_Tab1_Clinical = () => {
  const PatientStrip = () => (
    <div className="card" style={{padding:"14px 18px", display:"flex", gap:14, alignItems:"center"}}>
      <Avatar name="James Tanaka" tone="sand" size={48}/>
      <div className="col">
        <div className="row gap-2">
          <span style={{font:"600 15px/1.2 var(--f-sans)"}}>James Tanaka</span>
          <span className="chip chip--warn" style={{height:20}}>Admitted</span>
          <span style={{font:"500 12px/1 var(--f-mono)", color:"var(--c-muted)"}}>MRN 81-274-558</span>
        </div>
        <div className="row gap-3" style={{marginTop:6, font:"400 12.5px/1.3 var(--f-sans)", color:"var(--c-muted)"}}>
          <span>Male · 58 yrs</span>
          <span style={{color:"var(--c-faint)"}}>·</span>
          <span>Hypertension, Type 2 DM</span>
          <span style={{color:"var(--c-faint)"}}>·</span>
          <span>Admitted 7:32 AM today</span>
        </div>
      </div>
      <div style={{marginLeft:"auto", display:"flex", gap:8}}>
        <button className="btn btn--ghost btn--sm"><Icon name="user" size={13}/> Switch patient</button>
        <button className="btn btn--ghost btn--sm"><Icon name="file_text" size={13}/> History</button>
      </div>
    </div>
  );

  const SoapField = ({ label, agentLabel, content, suggestion }) => (
    <div className="card" style={{padding:"18px 20px"}}>
      <div className="row" style={{justifyContent:"space-between", marginBottom:10}}>
        <div className="row gap-3">
          <span style={{font:"600 14px/1 var(--f-sans)"}}>{label}</span>
          <span className="chip chip--ai" style={{height:20}}>
            <Icon name="sparkle" size={10} color="var(--c-ai-ink)" stroke={2}/> AI Draft
          </span>
        </div>
        <span className="mono" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)"}}>{agentLabel}</span>
      </div>
      <div style={{font:"400 14px/1.6 var(--f-sans)", color:"var(--c-ink-2)",
        borderLeft:"2px solid var(--c-ai)", paddingLeft:14}}>
        {content}
      </div>
      {suggestion && (
        <div className="row gap-2" style={{marginTop:12, padding:"8px 12px",
          background:"var(--c-ai-soft)", borderRadius:8, alignItems:"flex-start"}}>
          <Icon name="info" size={13} color="var(--c-ai-ink)"/>
          <span style={{font:"400 12.5px/1.45 var(--f-sans)", color:"var(--c-ai-ink)"}}>{suggestion}</span>
        </div>
      )}
    </div>
  );

  return (
    <DoctorShell active="clinical" activeAgents={[1,2,3,4,5,6]}>
      <div style={{padding:"24px 32px", overflow:"hidden", height:"100%"}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 320px", gap:24, height:"100%"}}>
          <div className="col gap-3" style={{minWidth:0}}>
            <PatientStrip/>

            <AIBanner
              agent="Agent 02 · Clinical Decision"
              title="Drafted a SOAP note based on intake + 3 visit history."
              confidence={89}
              action={<button className="btn btn--ai btn--sm">Regenerate <Icon name="refresh" size={12}/></button>}
            >
              Cross-referenced against 12,400 similar presentations. Every section is editable —
              changes train your personal style model.
            </AIBanner>

            <div className="col gap-3">
              <SoapField
                label="S · Subjective"
                agentLabel="generated in 1.8s"
                content="58 y/o M with hx of HTN and T2DM presents with 4-day history of dull, retrosternal chest discomfort radiating to left jaw, worse with exertion. Reports 2-pillow orthopnea and intermittent dyspnea on exertion. Denies syncope, palpitations, or LE edema. Compliant with metformin and lisinopril."
              />
              <SoapField
                label="O · Objective"
                agentLabel="auto-imported from EHR"
                content="VS: BP 158/96, HR 92 bpm, RR 20, SpO2 95% RA, T 37.1°C. Gen: alert, mildly diaphoretic. Cardiac: RRR, S4 gallop, no murmurs. Lungs: bilateral basilar crackles. ECG: NSR with non-specific T-wave inversions in V4–V6. Troponin I: 0.08 ng/mL (mildly elevated)."
              />
              <SoapField
                label="A · Assessment"
                agentLabel="ICD-10 suggestions ready"
                content="1) Acute coronary syndrome, likely NSTEMI given troponin elevation, exertional chest pain, and ECG changes. 2) Decompensated heart failure, likely HFpEF given hx of HTN, S4, basilar crackles. 3) Underlying coronary artery disease with multifactorial risk. 4) Hypertension, uncontrolled."
                suggestion="Consider adding R/O pulmonary embolism — D-dimer pending. ICD-10: I21.4, I50.31, I10."
              />
              <SoapField
                label="P · Plan"
                agentLabel="cross-checked against formulary"
                content="• Admit to telemetry; serial troponins q6h × 3. • ASA 325 mg, atorvastatin 80 mg, metoprolol 25 mg BID, heparin gtt per ACS protocol. • Echo to evaluate LV function. • Cardiology consult — likely cath lab within 24h. • Strict I/O, daily weights, low-Na diet."
                suggestion="Heparin dose flagged: patient weight 92 kg — consider weight-based protocol."
              />
            </div>

            <div className="row" style={{justifyContent:"flex-end", gap:10, marginTop:6, paddingBottom:16}}>
              <button className="btn btn--ghost">Save draft</button>
              <button className="btn btn--ghost">Add my own section</button>
              <button className="btn btn--brand">
                <Icon name="check" size={14} stroke={2.4}/> Approve notes & sign
              </button>
            </div>
          </div>

          {/* sidebar */}
          <div className="col gap-3" style={{minWidth:0}}>
            <div className="card" style={{padding:"16px 18px"}}>
              <span className="kicker">Vitals · live</span>
              <div className="col gap-2" style={{marginTop:10}}>
                {[
                  {l:"HR",  v:"92",   u:"bpm",  d:[88,90,89,92,94,92,93,91,92], color:"var(--c-primary)"},
                  {l:"BP",  v:"158/96", u:"mmHg", d:[152,154,156,158,160,158,159,160,158], color:"var(--c-warn)"},
                  {l:"SpO₂",v:"95",   u:"%",    d:[96,96,95,95,94,95,95,95,95], color:"var(--c-primary)"},
                ].map(m=>(
                  <div key={m.l} className="row" style={{padding:"8px 0", borderBottom:"1px dashed var(--c-hairline)"}}>
                    <div className="col" style={{width:80}}>
                      <span style={{font:"500 12px/1 var(--f-mono)", color:"var(--c-muted)"}}>{m.l}</span>
                      <span className="tab-num" style={{font:"500 18px/1.1 var(--f-sans)", marginTop:3}}>
                        {m.v}<span style={{font:"500 11px/1 var(--f-sans)", color:"var(--c-muted)", marginLeft:3}}>{m.u}</span>
                      </span>
                    </div>
                    <Sparkline data={m.d} color={m.color} width={140} height={32}/>
                  </div>
                ))}
              </div>
              <button className="btn btn--ghost btn--sm" style={{width:"100%", marginTop:10}}>
                <Icon name="activity" size={13}/> Open full monitor
              </button>
            </div>

            <div className="card" style={{padding:"16px 18px"}}>
              <span className="kicker">Recent labs</span>
              <div className="col gap-2" style={{marginTop:10}}>
                {[
                  {l:"Troponin I", v:"0.08", n:"<0.04", a:true},
                  {l:"BNP",        v:"480",  n:"<100",  a:true},
                  {l:"D-dimer",    v:"pending", n:"", a:false},
                  {l:"K⁺",         v:"4.2",  n:"3.5–5.1", a:false},
                  {l:"Cr",         v:"1.1",  n:"0.6–1.2", a:false},
                ].map(x=>(
                  <div key={x.l} className="row" style={{justifyContent:"space-between",
                    font:"400 13px/1.4 var(--f-sans)"}}>
                    <span style={{color:"var(--c-muted)"}}>{x.l}</span>
                    <span className="row gap-2">
                      {x.a && <span style={{width:6, height:6, borderRadius:"50%", background:"var(--c-danger)"}}/>}
                      <span className="mono" style={{font:"500 13px/1 var(--f-mono)", color: x.a ? "var(--c-danger)" : "var(--c-ink)"}}>{x.v}</span>
                      <span style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-faint)", minWidth:60, textAlign:"right"}}>{x.n}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-surface" style={{padding:"14px 16px"}}>
              <span className="kicker kicker--ai">Agent 02 · Suggested orders</span>
              <ul style={{margin:"10px 0 0", padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:8}}>
                {[
                  "Echocardiogram, 2D · STAT",
                  "Lipid panel, fasting",
                  "HbA1c (last value 6 mo ago)",
                  "Smoking cessation referral",
                ].map(x=>(
                  <li key={x} className="row gap-2" style={{font:"400 13px/1.3 var(--f-sans)", color:"var(--c-ink-2)"}}>
                    <span style={{width:14, height:14, borderRadius:4, border:"1.5px solid var(--c-ai)", flexShrink:0}}/>
                    {x}
                  </li>
                ))}
              </ul>
              <button className="btn btn--ai btn--sm" style={{width:"100%", marginTop:12}}>Send to EHR</button>
            </div>
          </div>
        </div>
      </div>
    </DoctorShell>
  );
};

/* ── TAB 2 · Patient Schedule ─────────────────────────────── */
const Doctor_Tab2_Schedule = () => {
  const today = [
    { time:"8:00 AM",  name:"James Tanaka",   age:58, sym:"Chest pressure, exertion-linked", risk:14, dur:"30 min", admitted:true },
    { time:"9:40 AM",  name:"Maya Okafor",    age:34, sym:"Tight chest, SOB after stairs",   risk:22, dur:"30 min" },
    { time:"10:20 AM", name:"Robert Quincy",  age:71, sym:"Post-op cardiology follow-up",    risk:18, dur:"20 min" },
    { time:"11:00 AM", name:"Lila Tarrant",   age:62, sym:"Palpitations, lightheadedness",   risk:58, dur:"30 min", flag:"missed 2 prior" },
    { time:"1:15 PM",  name:"Avi Rosenberg",  age:49, sym:"Routine HTN management",          risk:9,  dur:"15 min" },
    { time:"2:00 PM",  name:"Camille Vasquez",age:55, sym:"New-onset arrhythmia",            risk:81, dur:"45 min", flag:"40+ mi · 2 missed" },
    { time:"3:30 PM",  name:"Daniel Park",    age:38, sym:"Sports physical clearance",       risk:28, dur:"20 min" },
  ];
  const upcoming = [
    { date:"Tomorrow · 9:00 AM", name:"Annette Bui",    age:47, sym:"Echocardiogram follow-up",    risk:12 },
    { date:"Tomorrow · 11:30 AM",name:"Marcus Webb",    age:65, sym:"Statin titration check",      risk:35 },
    { date:"Fri · 10:00 AM",     name:"Yuki Tanaka",    age:52, sym:"Chest pain workup",           risk:24 },
  ];

  const PatientRow = ({ p, showAdmit }) => (
    <div className="card" style={{padding:"14px 18px", display:"flex", gap:16, alignItems:"center"}}>
      <div style={{width:74, color:"var(--c-ink)"}}>
        <div className="mono" style={{font:"500 13px/1 var(--f-mono)", letterSpacing:".02em"}}>{p.time || p.date.split("· ")[1]}</div>
        <div style={{font:"500 11px/1.2 var(--f-sans)", color:"var(--c-muted)", marginTop:3}}>{p.dur || ""}</div>
      </div>
      <div className="divider-v"/>
      <Avatar name={p.name} tone={p.risk>=70?"rose":p.risk>=40?"warm":"primary"} size={40}/>
      <div className="col grow">
        <div className="row gap-2">
          <span style={{font:"600 14px/1.2 var(--f-sans)"}}>{p.name}</span>
          <span style={{font:"400 12px/1 var(--f-sans)", color:"var(--c-muted)"}}>· {p.age} yrs</span>
          {p.admitted && <span className="chip chip--warn" style={{height:20}}>Admitted</span>}
          {p.flag && <span className="chip" style={{height:20, color:"var(--c-danger)", borderColor:"oklch(0.84 0.08 25)"}}>
            <Icon name="alert" size={10} color="var(--c-danger)" stroke={2}/> {p.flag}
          </span>}
        </div>
        <span style={{font:"400 13px/1.3 var(--f-sans)", color:"var(--c-ink-2)", marginTop:3}}>{p.sym}</span>
      </div>
      <RiskScore value={p.risk}/>
      {showAdmit && !p.admitted ? (
        <button className="btn btn--brand btn--sm" style={{minWidth:96}}>
          <Icon name="plus" size={12} stroke={2.4}/> Admit
        </button>
      ) : showAdmit ? (
        <button className="btn btn--soft btn--sm" style={{minWidth:96}} disabled>In care</button>
      ) : (
        <button className="btn btn--ghost btn--sm"><Icon name="chev_right" size={12}/></button>
      )}
    </div>
  );

  return (
    <DoctorShell active="schedule">
      <div style={{padding:"24px 32px", overflow:"hidden", height:"100%"}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 300px", gap:24, height:"100%"}}>
          <div className="col gap-3" style={{minWidth:0, overflow:"hidden"}}>
            {/* day header */}
            <div className="row" style={{justifyContent:"space-between", alignItems:"flex-end"}}>
              <div className="col">
                <span className="kicker">Wednesday · May 20</span>
                <h2 style={{font:"600 26px/1.15 var(--f-sans)", margin:"6px 0 0", letterSpacing:"-.01em"}}>
                  Today's schedule <span style={{color:"var(--c-muted)", fontWeight:500}}>· 7 patients</span>
                </h2>
              </div>
              <div className="row gap-2">
                <div className="row gap-1" style={{background:"var(--c-card)", border:"1px solid var(--c-border)", borderRadius:8, padding:2}}>
                  <button className="btn btn--soft btn--xs" style={{height:28}}><Icon name="list" size={12}/></button>
                  <button className="btn btn--ghost btn--xs" style={{height:28}}><Icon name="grid" size={12}/></button>
                </div>
                <button className="btn btn--ghost btn--sm"><Icon name="filter" size={13}/> Today</button>
                <button className="btn btn--brand btn--sm"><Icon name="plus" size={13}/> Block time</button>
              </div>
            </div>

            {/* Today section */}
            <div className="row gap-3" style={{
              padding:"10px 14px", background:"var(--c-card)",
              borderRadius:10, border:"1px solid var(--c-border)",
            }}>
              <Icon name="chev_down" size={14} color="var(--c-muted)"/>
              <span style={{font:"600 13px/1 var(--f-sans)"}}>Today's Appointments</span>
              <span className="chip chip--primary" style={{height:22}}>7</span>
              <span style={{flex:1}}/>
              <span style={{font:"400 12px/1 var(--f-sans)", color:"var(--c-muted)"}}>1 admitted · 1 high-risk</span>
            </div>
            <div className="col gap-2" style={{paddingLeft:20, position:"relative"}}>
              <div style={{position:"absolute", left:5, top:8, bottom:8, width:2, background:"var(--c-hairline)"}}/>
              {today.map((p,i)=>(
                <div key={i} style={{position:"relative"}}>
                  <span style={{position:"absolute", left:-19, top:24, width:12, height:12, borderRadius:"50%",
                    background: p.admitted ? "var(--c-warn)" : "var(--c-card)",
                    border:`2px solid ${p.admitted ? "var(--c-warn)" : "var(--c-border-2)"}`}}/>
                  <PatientRow p={p} showAdmit/>
                </div>
              ))}
            </div>

            {/* Upcoming section */}
            <div className="row gap-3" style={{
              padding:"10px 14px", background:"var(--c-card)",
              borderRadius:10, border:"1px solid var(--c-border)", marginTop:8,
            }}>
              <Icon name="chev_right" size={14} color="var(--c-muted)"/>
              <span style={{font:"600 13px/1 var(--f-sans)"}}>Upcoming this week</span>
              <span className="chip" style={{height:22}}>3</span>
            </div>
          </div>

          {/* sidebar — agent + summary */}
          <div className="col gap-3">
            <div className="ai-surface" style={{padding:"16px 18px"}}>
              <span className="kicker kicker--ai">Agent 03 · No-Show Manager</span>
              <p style={{margin:"10px 0 14px", font:"400 13px/1.5 var(--f-sans)", color:"var(--c-ai-ink)"}}>
                2 high-risk slots today. Sending reminder texts will reduce expected misses by <strong>61%</strong>.
              </p>
              <button className="btn btn--ai btn--sm" style={{width:"100%"}}>
                <Icon name="send" size={13}/> Send AI reminders (2)
              </button>
            </div>
            <div className="card" style={{padding:"16px 18px"}}>
              <span className="kicker">At a glance</span>
              <div className="col gap-3" style={{marginTop:12}}>
                {[
                  {l:"Booked", v:"7", c:"var(--c-info)"},
                  {l:"Admitted", v:"3", c:"var(--c-warn)"},
                  {l:"Predicted no-shows", v:"2", c:"var(--c-danger)"},
                  {l:"Avg risk", v:"33%", c:"var(--c-warn)"},
                ].map(s=>(
                  <div key={s.l} className="row" style={{justifyContent:"space-between"}}>
                    <span className="row gap-2" style={{font:"400 13px/1 var(--f-sans)", color:"var(--c-ink-2)"}}>
                      <span style={{width:6, height:6, borderRadius:"50%", background:s.c}}/>
                      {s.l}
                    </span>
                    <span className="tab-num" style={{font:"500 15px/1 var(--f-sans)"}}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{padding:"16px 18px"}}>
              <span className="kicker">Time across day</span>
              <div className="col" style={{marginTop:12, gap:6}}>
                {[["Admin",18],["Patient",62],["Notes (AI-assisted)",14],["Break",6]].map(([l,v])=>(
                  <div key={l} className="col gap-1">
                    <div className="row" style={{justifyContent:"space-between", font:"400 12px/1 var(--f-sans)", color:"var(--c-muted)"}}>
                      <span>{l}</span><span className="tab-num">{v}%</span>
                    </div>
                    <div style={{height:6, background:"var(--c-surface)", borderRadius:3, overflow:"hidden"}}>
                      <div style={{height:"100%", width:`${v}%`,
                        background: l.startsWith("Notes") ? "var(--c-ai)" : "var(--c-primary)"}}/>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{margin:"12px 0 0", font:"400 12px/1.45 var(--f-sans)", color:"var(--c-ai-ink)"}}>
                <strong>↓ 38%</strong> time on paperwork this week thanks to AI drafts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DoctorShell>
  );
};

/* ── TAB 3 · Admitted ─────────────────────────────────────── */
const Doctor_Tab3_Admitted = () => {
  const admitted = [
    { name:"James Tanaka", age:58, room:"Tele-3 · Bed 12", since:"7:32 AM (5h 14m)",
      hr:92, bp:"158/96", spo2:95, temp:"99.0", critical:false, tone:"sand",
      dx:"Suspected NSTEMI · ACS protocol", flag:"Tele monitoring" },
    { name:"Lila Tarrant", age:62, room:"ICU · Bed 4", since:"5:14 AM (7h 32m)",
      hr:118, bp:"172/104", spo2:91, temp:"100.6", critical:true, tone:"rose",
      dx:"Decompensated HFrEF, hypoxia", flag:"⚠ Agent 04 alert active" },
    { name:"Marcus Webb", age:65, room:"Med-2 · Bed 8", since:"Yesterday, 11:14 PM",
      hr:78, bp:"132/82", spo2:97, temp:"98.4", critical:false, tone:"primary",
      dx:"COPD exacerbation, improving", flag:"" },
  ];

  return (
    <DoctorShell active="admitted">
      <div style={{padding:"24px 32px", overflow:"hidden", height:"100%"}}>
        <div className="row" style={{justifyContent:"space-between", alignItems:"flex-end", marginBottom:18}}>
          <div className="col">
            <span className="kicker">In your care · live</span>
            <h2 style={{font:"600 26px/1.15 var(--f-sans)", margin:"6px 0 0", letterSpacing:"-.01em"}}>
              Admitted patients <span style={{color:"var(--c-muted)", fontWeight:500}}>· 3 currently</span>
            </h2>
          </div>
          <div className="row gap-2">
            <button className="btn btn--ghost btn--sm"><Icon name="grid" size={13}/> Tele wall view</button>
            <button className="btn btn--ghost btn--sm"><Icon name="bell" size={13}/> Alerts · 1</button>
          </div>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16}}>
          {admitted.map((p,i)=>(
            <div key={i} className="card" style={{
              padding:0, overflow:"hidden",
              border: p.critical ? "1px solid oklch(0.78 0.14 25)" : "1px solid var(--c-border)",
              boxShadow: p.critical ? "0 0 0 4px oklch(0.78 0.14 25 / .12)" : "var(--sh-1)",
            }}>
              {p.critical && (
                <div style={{padding:"8px 16px", background:"var(--c-danger)", color:"#fff",
                  display:"flex", alignItems:"center", gap:8}}>
                  <span className="pulse" style={{width:8, height:8, borderRadius:"50%", background:"#fff"}}/>
                  <span style={{font:"600 12px/1 var(--f-mono)", letterSpacing:".06em"}}>CRITICAL · AGENT 04 ALERT</span>
                </div>
              )}
              <div className="row gap-3" style={{padding:"16px 18px", borderBottom:"1px solid var(--c-border)"}}>
                <Avatar name={p.name} tone={p.tone} size={42}/>
                <div className="col grow">
                  <span style={{font:"600 14.5px/1.2 var(--f-sans)"}}>{p.name}</span>
                  <span style={{font:"400 12px/1.3 var(--f-sans)", color:"var(--c-muted)", marginTop:3}}>{p.age} yrs · {p.room}</span>
                </div>
                <span className="chip chip--warn" style={{height:20}}>Admitted</span>
              </div>
              <div className="col gap-2" style={{padding:"14px 18px"}}>
                <div className="row" style={{justifyContent:"space-between", font:"400 12px/1.3 var(--f-sans)", color:"var(--c-muted)"}}>
                  <span>Since</span><span style={{color:"var(--c-ink-2)"}}>{p.since}</span>
                </div>
                <div className="row" style={{justifyContent:"space-between", font:"400 12px/1.3 var(--f-sans)", color:"var(--c-muted)"}}>
                  <span>Working dx</span><span style={{color:"var(--c-ink-2)", textAlign:"right", maxWidth:170}}>{p.dx}</span>
                </div>
              </div>
              {/* vitals snapshot */}
              <div style={{padding:"12px 18px", background:"var(--c-surface)",
                borderTop:"1px solid var(--c-border)", borderBottom:"1px solid var(--c-border)"}}>
                <div className="row" style={{justifyContent:"space-between", marginBottom:6}}>
                  <span className="kicker">Vitals · live</span>
                  <span style={{font:"500 11px/1 var(--f-mono)", color: p.critical ? "var(--c-danger)" : "var(--c-muted)"}}>
                    {p.critical ? "● ABNORMAL" : "● within range"}
                  </span>
                </div>
                <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8}}>
                  {[
                    {l:"HR", v:p.hr, u:"bpm", crit:p.critical && p.hr>110},
                    {l:"BP", v:p.bp, u:"", crit:p.critical && +p.bp.split("/")[0]>160},
                    {l:"SpO₂", v:p.spo2, u:"%", crit:p.critical && p.spo2<94},
                    {l:"T", v:p.temp, u:"°F", crit:p.critical && +p.temp>100},
                  ].map(m=>(
                    <div key={m.l} className="col gap-1">
                      <span style={{font:"500 10px/1 var(--f-mono)", color:"var(--c-muted)", letterSpacing:".04em"}}>{m.l}</span>
                      <span className="tab-num" style={{
                        font:"500 15px/1 var(--f-sans)",
                        color: m.crit ? "var(--c-danger)" : "var(--c-ink)",
                      }}>
                        {m.v}<span style={{font:"500 9.5px/1 var(--f-sans)", color:"var(--c-muted)", marginLeft:2}}>{m.u}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col gap-2" style={{padding:"14px 18px"}}>
                <button className="btn btn--ghost btn--sm" style={{width:"100%"}}>
                  <Icon name="activity" size={13}/> View vitals monitor
                </button>
                <button className="btn btn--ai btn--sm" style={{width:"100%"}}>
                  <Icon name="sparkle" size={13}/> Generate discharge summary
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* discharge modal preview (Agent 5) */}
        <div style={{marginTop:24, display:"grid", gridTemplateColumns:"1fr 360px", gap:16}}>
          <div className="card" style={{padding:0, overflow:"hidden"}}>
            <div className="row" style={{padding:"14px 18px", borderBottom:"1px solid var(--c-border)",
              background:"linear-gradient(180deg, oklch(0.985 0.014 295), var(--c-card))"}}>
              <div className="col">
                <span className="kicker kicker--ai">Agent 05 · Discharge Planning</span>
                <span style={{font:"500 15px/1.3 var(--f-sans)", marginTop:3}}>Draft summary · Marcus Webb · COPD exacerbation</span>
              </div>
              <span className="chip chip--ai" style={{marginLeft:"auto"}}>
                <Icon name="sparkle" size={10} color="var(--c-ai-ink)" stroke={2}/> AI Draft · 89% conf
              </span>
            </div>
            <div style={{padding:"18px 22px"}}>
              <p style={{margin:0, font:"400 14px/1.6 var(--f-sans)", color:"var(--c-ink-2)"}}>
                Mr. Webb, 65 y/o male with a 30-pack-year smoking history, presented with acute COPD
                exacerbation. Treated with nebulised albuterol/ipratropium, IV methylprednisolone 60 mg q6h,
                and a 5-day course of azithromycin. Saturation improved from 88% on admission to 97% on room
                air by hour 18. Smoking-cessation counselling delivered; nicotine patch prescribed.
                <br/><br/>
                <strong>Discharge plan:</strong> Resume tiotropium and fluticasone-salmeterol. Prednisone
                taper over 7 days. Pulmonary rehab referral. Follow-up with PCP in 7 days, pulmonology in 2 weeks.
              </p>
              <div className="row gap-2" style={{marginTop:16}}>
                <button className="btn btn--ai btn--sm">Refine with notes <Icon name="sparkle" size={11}/></button>
                <button className="btn btn--ghost btn--sm">Edit text</button>
                <button className="btn btn--ghost btn--sm">Print</button>
                <span style={{flex:1}}/>
                <button className="btn btn--brand btn--sm">
                  <Icon name="check" size={13} stroke={2.4}/> Approve & discharge
                </button>
              </div>
            </div>
          </div>
          <div className="card" style={{padding:"16px 18px"}}>
            <span className="kicker">Discharge checklist</span>
            <div className="col gap-2" style={{marginTop:12}}>
              {[
                {l:"Vitals stable for ≥ 4h", d:true},
                {l:"PO meds tolerated", d:true},
                {l:"Patient education delivered", d:true},
                {l:"Rx sent to pharmacy", d:false},
                {l:"Follow-up scheduled", d:false},
              ].map(x=>(
                <div key={x.l} className="row gap-2">
                  <span style={{width:18, height:18, borderRadius:5,
                    background: x.d ? "var(--c-success)" : "var(--c-card)",
                    border:`1.5px solid ${x.d ? "var(--c-success)" : "var(--c-border-2)"}`,
                    display:"grid", placeItems:"center"}}>
                    {x.d && <Icon name="check" size={11} color="#fff" stroke={2.5}/>}
                  </span>
                  <span style={{font:`${x.d?"500":"400"} 13px/1.3 var(--f-sans)`, color: x.d?"var(--c-ink)":"var(--c-muted)"}}>{x.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DoctorShell>
  );
};

/* ── TAB 4 · Discharged ───────────────────────────────────── */
const Doctor_Tab4_Discharged = () => {
  const rows = [
    { name:"Astrid Lemaire", age:42, time:"Today · 11:48 AM", dx:"Migraine, abortive Rx", followUp:"Sent", expanded:true,
      summary:"42 y/o F with chronic migraine, treated with IV ketorolac and metoclopramide. Headache resolved within 90 min. Discharged on rizatriptan 10 mg PRN. Trigger journal recommended.",
      msg:"Hi Astrid — checking in on how the rizatriptan is working. Any side effects? Reply STOP to opt out.", tone:"warm" },
    { name:"Marcus Webb", age:65, time:"Today · 9:22 AM",  dx:"COPD exacerbation",      followUp:"Sent",      tone:"primary" },
    { name:"Hana Patel",   age:29, time:"Today · 8:15 AM",  dx:"Acute pharyngitis",     followUp:"Pending",   tone:"sky" },
    { name:"Owen Kingsley",age:71, time:"Yesterday · 6:10 PM", dx:"AFib, rate controlled",followUp:"Responded", tone:"sage" },
    { name:"Sofia Reyes",  age:36, time:"Yesterday · 3:47 PM", dx:"Renal colic, stone passage",followUp:"Sent", tone:"rose" },
  ];

  return (
    <DoctorShell active="discharged">
      <div style={{padding:"24px 32px", overflow:"hidden", height:"100%"}}>
        <div className="row" style={{justifyContent:"space-between", alignItems:"flex-end", marginBottom:18}}>
          <div className="col">
            <span className="kicker">Recently discharged</span>
            <h2 style={{font:"600 26px/1.15 var(--f-sans)", margin:"6px 0 0", letterSpacing:"-.01em"}}>
              Discharged patients <span style={{color:"var(--c-muted)", fontWeight:500}}>· follow-ups on rails</span>
            </h2>
          </div>
          <div className="row gap-2">
            <div style={{display:"inline-flex", padding:3, background:"var(--c-card)", border:"1px solid var(--c-border)", borderRadius:10}}>
              <button className="btn btn--soft btn--xs" style={{borderRadius:7}}>Today (3)</button>
              <button className="btn btn--ghost btn--xs" style={{borderRadius:7}}>History (218)</button>
            </div>
            <button className="btn btn--ghost btn--sm"><Icon name="download" size={13}/> Export</button>
          </div>
        </div>

        {/* follow-up funnel */}
        <div className="card" style={{padding:"16px 20px", marginBottom:16}}>
          <div className="row" style={{justifyContent:"space-between", marginBottom:10}}>
            <span className="kicker kicker--ai">Agent 06 · Post-Visit follow-up · last 30 days</span>
            <span className="mono" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)"}}>n = 218</span>
          </div>
          <div className="row gap-2">
            {[
              {l:"Discharged", v:218, c:"var(--c-info)"},
              {l:"Day-3 msg sent", v:214, c:"var(--c-ai)"},
              {l:"Read", v:189, c:"var(--c-primary)"},
              {l:"Responded", v:131, c:"var(--c-success)"},
              {l:"Re-admitted", v:6, c:"var(--c-danger)"},
            ].map((f,i,arr)=>(
              <div key={f.l} className="col gap-1" style={{flex:1}}>
                <div style={{height:36, background:f.c, opacity:.85, borderRadius:8,
                  width: `${(f.v/arr[0].v)*100}%`, minWidth:36,
                  position:"relative", display:"flex", alignItems:"center", paddingLeft:10, color:"#fff", font:"600 13px/1 var(--f-mono)"}}>
                  {f.v}
                </div>
                <span style={{font:"400 11px/1.2 var(--f-sans)", color:"var(--c-muted)", marginTop:2}}>{f.l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col gap-3">
          {rows.map((r,i)=>(
            <div key={i} className="card" style={{padding:0, overflow:"hidden"}}>
              <div className="row gap-4" style={{padding:"16px 20px", alignItems:"center"}}>
                <Avatar name={r.name} tone={r.tone} size={40}/>
                <div className="col grow">
                  <div className="row gap-2">
                    <span style={{font:"600 14.5px/1.2 var(--f-sans)"}}>{r.name}</span>
                    <span style={{font:"400 12px/1 var(--f-sans)", color:"var(--c-muted)"}}>· {r.age} yrs</span>
                  </div>
                  <span style={{font:"400 13px/1.3 var(--f-sans)", color:"var(--c-ink-2)", marginTop:3}}>{r.dx}</span>
                </div>
                <span style={{font:"400 12.5px/1.3 var(--f-sans)", color:"var(--c-muted)", marginRight:8}}>{r.time}</span>
                <StatusPill status={r.followUp}/>
                <button className="btn btn--ghost btn--sm" style={{marginLeft:8}}>
                  {r.expanded ? <Icon name="chev_up" size={13}/> : <Icon name="chev_down" size={13}/>}
                </button>
              </div>
              {r.expanded && (
                <div style={{padding:"16px 20px 20px 76px", background:"var(--c-surface)", borderTop:"1px solid var(--c-border)"}}>
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:20}}>
                    <div>
                      <span className="kicker">AI discharge summary</span>
                      <p style={{font:"400 13px/1.55 var(--f-sans)", color:"var(--c-ink-2)", margin:"8px 0 0"}}>{r.summary}</p>
                    </div>
                    <div>
                      <span className="kicker kicker--ai">Follow-up message · sent 3 days post-discharge</span>
                      <div style={{
                        marginTop:8, padding:"12px 14px",
                        background:"var(--c-card)",
                        border:"1px solid oklch(0.88 0.04 295)",
                        borderRadius:12, fontStyle:"italic",
                        font:"400 13px/1.55 var(--f-sans)", color:"var(--c-ink-2)",
                        position:"relative",
                      }}>
                        <span style={{position:"absolute", top:-8, left:14, padding:"2px 8px",
                          background:"var(--c-ai)", color:"#fff", borderRadius:999,
                          font:"600 9.5px/1 var(--f-mono)", letterSpacing:".05em"}}>SMS · AGENT 06</span>
                        “{r.msg}”
                      </div>
                      <div className="row gap-2" style={{marginTop:8, font:"400 11.5px/1 var(--f-mono)", color:"var(--c-muted)"}}>
                        <Icon name="check" size={12} color="var(--c-success)" stroke={2.4}/> delivered · 11:50 AM
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </DoctorShell>
  );
};

/* ── TAB 5 · No Show ──────────────────────────────────────── */
const Doctor_Tab5_NoShow = () => {
  const rows = [
    { name:"Camille Vasquez", appt:"May 20 · 2:00 PM", age:55, risk:81, prior:"Missed 2 of last 3", distance:"42 mi", insurance:"Self-pay", contact:"Last SMS read · no reply", tone:"rose" },
    { name:"Lila Tarrant",    appt:"May 20 · 11:00 AM", age:62, risk:74, prior:"Missed 2 of last 4", distance:"31 mi", insurance:"Medicare", contact:"No phone on file", tone:"warm" },
    { name:"Theo Bradshaw",   appt:"May 21 · 9:30 AM",  age:48, risk:68, prior:"Missed 1 of last 2", distance:"22 mi", insurance:"BlueCross", contact:"Confirmed via app",  tone:"warm" },
    { name:"Indra Patel",     appt:"May 21 · 3:00 PM",  age:33, risk:54, prior:"First visit",        distance:"38 mi", insurance:"Aetna",     contact:"Pending confirmation", tone:"sand" },
    { name:"Marco Esposito",  appt:"May 22 · 10:20 AM", age:41, risk:46, prior:"No history",         distance:"19 mi", insurance:"BlueCross", contact:"Reminder queued",      tone:"sky" },
    { name:"Hana Kim",        appt:"May 22 · 1:15 PM",  age:29, risk:38, prior:"Reliable",           distance:"7 mi",  insurance:"United",    contact:"App confirmed",        tone:"sage" },
  ];

  return (
    <DoctorShell active="noshow">
      <div style={{padding:"24px 32px", overflow:"hidden", height:"100%"}}>
        <div className="row" style={{justifyContent:"space-between", alignItems:"flex-end", marginBottom:18}}>
          <div className="col">
            <span className="kicker">Predicted misses · Agent 03</span>
            <h2 style={{font:"600 26px/1.15 var(--f-sans)", margin:"6px 0 0", letterSpacing:"-.01em"}}>
              No-show risk · this week
            </h2>
          </div>
          <div className="row gap-2" style={{alignItems:"center"}}>
            <div className="row gap-2" style={{padding:"6px 10px", background:"var(--c-card)", border:"1px solid var(--c-border)", borderRadius:8}}>
              <span style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)"}}>FROM</span>
              <span style={{font:"500 13px/1 var(--f-sans)"}}>May 20</span>
              <Icon name="arrow_right" size={12} color="var(--c-faint)"/>
              <span style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)"}}>TO</span>
              <span style={{font:"500 13px/1 var(--f-sans)"}}>May 27</span>
            </div>
            <button className="btn btn--soft btn--sm">Today</button>
            <button className="btn btn--ghost btn--sm">Week</button>
          </div>
        </div>

        {/* stats row */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:18}}>
          {[
            {l:"Predicted misses", v:"5", k:"of 23 booked", c:"var(--c-danger)"},
            {l:"Estimated $ lost",  v:"$1,840", k:"if no action", c:"var(--c-ink)"},
            {l:"AI reminders sent", v:"18", k:"this week", c:"var(--c-ai)"},
            {l:"Reduction expected", v:"61%", k:"with interventions", c:"var(--c-success)"},
          ].map(s=>(
            <div key={s.l} className="card" style={{padding:"16px 18px"}}>
              <span className="kicker">{s.l}</span>
              <span className="serif tab-num" style={{font:"500 32px/1 var(--f-serif)", display:"block", marginTop:6, color:s.c}}>{s.v}</span>
              <span style={{font:"400 12px/1.3 var(--f-sans)", color:"var(--c-muted)", marginTop:4, display:"block"}}>{s.k}</span>
            </div>
          ))}
        </div>

        {/* table */}
        <div className="card" style={{padding:0, overflow:"hidden"}}>
          <div style={{
            display:"grid", gridTemplateColumns:"2fr 1.4fr 1.4fr 0.9fr 2fr 0.9fr",
            padding:"12px 20px", background:"var(--c-surface)",
            borderBottom:"1px solid var(--c-border)",
            font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)", letterSpacing:".08em", textTransform:"uppercase",
          }}>
            <span>Patient</span>
            <span>Appointment</span>
            <span>Why elevated</span>
            <span>Distance</span>
            <span>AI risk score</span>
            <span style={{textAlign:"right"}}>Action</span>
          </div>
          {rows.map((r,i)=>(
            <div key={i} style={{
              display:"grid", gridTemplateColumns:"2fr 1.4fr 1.4fr 0.9fr 2fr 0.9fr",
              padding:"14px 20px", borderBottom:"1px solid var(--c-hairline)", alignItems:"center",
              background: r.risk>=70 ? "oklch(0.99 0.01 25)" : "transparent",
            }}>
              <div className="row gap-3" style={{minWidth:0}}>
                <Avatar name={r.name} tone={r.tone} size={32}/>
                <div className="col" style={{minWidth:0}}>
                  <span style={{font:"600 13.5px/1.2 var(--f-sans)"}}>{r.name}</span>
                  <span style={{font:"400 11.5px/1.2 var(--f-sans)", color:"var(--c-muted)", marginTop:2}}>{r.age} yrs · {r.insurance}</span>
                </div>
              </div>
              <span style={{font:"500 13px/1 var(--f-mono)", color:"var(--c-ink)"}}>{r.appt}</span>
              <span style={{font:"400 12.5px/1.4 var(--f-sans)", color:"var(--c-ink-2)"}}>{r.prior}</span>
              <span className="row gap-1" style={{font:"400 12.5px/1 var(--f-sans)", color:"var(--c-ink-2)"}}>
                <Icon name="pin" size={12} color="var(--c-muted)"/> {r.distance}
              </span>
              <div className="row gap-3">
                <div style={{position:"relative", flex:1, maxWidth:140}}>
                  <div style={{height:8, background:"var(--c-surface)", borderRadius:4, overflow:"hidden"}}>
                    <div style={{
                      height:"100%", width:`${r.risk}%`,
                      background: r.risk>=70 ? "var(--c-danger)" : r.risk>=40 ? "var(--c-warn)" : "var(--c-success)",
                      borderRadius:4,
                    }}/>
                  </div>
                  <span className="mono" style={{font:"500 11px/1 var(--f-mono)",
                    color: r.risk>=70 ? "var(--c-danger)" : r.risk>=40 ? "oklch(0.45 0.13 75)" : "oklch(0.40 0.10 155)",
                    marginTop:5, display:"block"}}>
                    {r.risk}% · {r.contact}
                  </span>
                </div>
              </div>
              <div className="row gap-1" style={{justifyContent:"flex-end"}}>
                <button className="btn btn--ghost btn--xs"><Icon name="chat" size={11}/></button>
                {r.risk>=70
                  ? <button className="btn btn--brand btn--xs">Contact</button>
                  : <button className="btn btn--soft btn--xs">Remind</button>}
              </div>
            </div>
          ))}
        </div>

        {/* tooltip preview overlay */}
        <div className="ai-surface" style={{marginTop:18, padding:"14px 18px", display:"flex", gap:14, alignItems:"center"}}>
          <div style={{width:36, height:36, borderRadius:10,
            background:"linear-gradient(135deg, var(--c-ai-2), var(--c-ai))", color:"#fff",
            display:"grid", placeItems:"center", boxShadow:"var(--sh-glow-ai)"}}>
            <Icon name="sparkle" size={16}/>
          </div>
          <div className="col grow">
            <span className="kicker kicker--ai">Why Camille's risk is 81%</span>
            <span style={{font:"400 13px/1.5 var(--f-sans)", color:"var(--c-ink-2)", marginTop:3}}>
              Missed 2 of last 3 appointments · lives 42 mi away · self-pay · last SMS read 6 days ago, no
              reply · model confidence 88%. <strong>Suggested:</strong> phone call from front desk + Lyft
              credit offer.
            </span>
          </div>
          <button className="btn btn--ai btn--sm">Apply suggestion</button>
        </div>
      </div>
    </DoctorShell>
  );
};

Object.assign(window, {
  Doctor_Tab1_Clinical, Doctor_Tab2_Schedule, Doctor_Tab3_Admitted,
  Doctor_Tab4_Discharged, Doctor_Tab5_NoShow,
});
