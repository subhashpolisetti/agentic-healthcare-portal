/* Patient screens — Book Appointment + My Appointments */

const PATIENT_NAV = [
  { key: "book",   label: "Book Appointment", icon: "plus" },
  { key: "appts",  label: "My Appointments",  icon: "calendar", count: 4 },
  { key: "vitals", label: "Vitals",           icon: "activity" },
  { key: "records",label: "Records",          icon: "file_text" },
];

/* ── Step 1 · Empty symptom input ────────────────────────── */
const PatientBook_Step1 = () => (
  <div className="frame app col" style={{height:"100%"}}>
    <AppHeader role="Patient" name="Maya Okafor" roleColor="primary"/>
    <TabStrip items={PATIENT_NAV} active="book"/>
    <div style={{flex:1, overflow:"hidden", padding:"40px 64px"}}>
      <div style={{maxWidth:880, margin:"0 auto"}}>
        <span className="kicker">Step 1 of 4 · Describe</span>
        <h1 className="serif" style={{font:"500 52px/1.08 var(--f-serif)", margin:"12px 0 10px", letterSpacing:"-.02em"}}>
          What's going on, <span style={{color:"var(--c-muted)"}}>Maya?</span>
        </h1>
        <p style={{font:"400 16px/1.55 var(--f-sans)", color:"var(--c-ink-2)", margin:"0 0 28px", maxWidth:620}}>
          In a sentence or two — the more honest, the better the match. Our intake agent
          reads symptoms, history, and location to find the right specialist.
        </p>

        <div className="card" style={{padding:24, position:"relative"}}>
          <textarea className="textarea" rows={5}
            defaultValue="For the past 3 days I've had a tight chest pressure that comes and goes, mostly after climbing stairs. Sometimes I feel short of breath. No fever. I'm 34."
            style={{font:"400 16px/1.55 var(--f-sans)", border:"none", padding:0, minHeight:120}}/>
          <div className="row" style={{justifyContent:"space-between", marginTop:8}}>
            <div className="row gap-2" style={{color:"var(--c-muted)"}}>
              <button className="btn btn--ghost btn--sm" style={{height:30}}>
                <Icon name="pin" size={13}/> Brooklyn, NY · auto
              </button>
              <button className="btn btn--ghost btn--sm" style={{height:30}}>
                <Icon name="upload" size={13}/> Attach photo / labs
              </button>
              <button className="btn btn--ghost btn--sm" style={{height:30}}>
                <Icon name="waveform" size={13}/> Voice note
              </button>
            </div>
            <span className="mono" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-faint)"}}>238 / 1000</span>
          </div>
        </div>

        <div className="row" style={{justifyContent:"space-between", marginTop:24, alignItems:"flex-start"}}>
          <div className="col gap-2" style={{maxWidth:520}}>
            <span className="kicker">Common right now</span>
            <div className="row gap-2" style={{flexWrap:"wrap"}}>
              {["Sinus pressure","Sleep trouble","Lower back pain","Anxiety check-in","Skin rash","Telehealth follow-up"].map(t=>(
                <span key={t} style={{
                  padding:"8px 14px", borderRadius:999,
                  background:"var(--c-card)", border:"1px solid var(--c-border)",
                  font:"500 13px/1 var(--f-sans)", color:"var(--c-ink-2)", cursor:"pointer",
                }}>{t}</span>
              ))}
            </div>
          </div>
          <button className="btn btn--brand btn--lg" style={{minWidth:220}}>
            Find best doctors <Icon name="arrow_right" size={16} stroke={2}/>
          </button>
        </div>

        {/* trust strip */}
        <div className="row gap-6" style={{marginTop:56, paddingTop:24, borderTop:"1px solid var(--c-hairline)"}}>
          {[
            {n:"4.9", l:"avg patient rating", k:"of 5.0"},
            {n:"12 min", l:"avg time to booking", k:""},
            {n:"83 %", l:"AI match accuracy", k:"vs self-search"},
            {n:"24 / 7", l:"telehealth coverage", k:""},
          ].map(s=>(
            <div key={s.l} className="col">
              <span className="serif tab-num" style={{font:"500 28px/1 var(--f-serif)", letterSpacing:"-.01em"}}>{s.n}</span>
              <span style={{font:"400 12px/1.3 var(--f-sans)", color:"var(--c-muted)", marginTop:4}}>{s.l} <span style={{color:"var(--c-faint)"}}>{s.k}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ── Step 2 · AI analysing loading state ──────────────────── */
const PatientBook_Step2_Loading = () => (
  <div className="frame app col" style={{height:"100%"}}>
    <AppHeader role="Patient" name="Maya Okafor" roleColor="primary"/>
    <TabStrip items={PATIENT_NAV} active="book"/>
    <div style={{flex:1, padding:"40px 64px", overflow:"hidden"}}>
      <div style={{maxWidth:880, margin:"0 auto"}}>
        {/* Echoed query */}
        <div className="row gap-3" style={{marginBottom:24}}>
          <span className="kicker">Step 2 of 4 · Analysing</span>
        </div>
        <div className="card" style={{padding:"14px 18px", marginBottom:24,
          background:"var(--c-surface)", display:"flex", gap:12, alignItems:"flex-start"}}>
          <Icon name="chat" size={16} color="var(--c-muted)"/>
          <p style={{margin:0, font:"400 13px/1.5 var(--f-sans)", color:"var(--c-ink-2)"}}>
            "For the past 3 days I've had a tight chest pressure that comes and goes, mostly after
            climbing stairs. Sometimes I feel short of breath. No fever. I'm 34."
          </p>
          <button style={{border:"none", background:"transparent", color:"var(--c-muted)", cursor:"pointer", font:"500 12px/1 var(--f-sans)"}}>Edit</button>
        </div>

        {/* AI working banner */}
        <div className="ai-surface" style={{padding:"28px 28px"}}>
          <div className="row gap-3" style={{marginBottom:18}}>
            <div style={{
              width:44, height:44, borderRadius:12,
              background:"linear-gradient(135deg, var(--c-ai-2), var(--c-ai))",
              color:"#fff", display:"grid", placeItems:"center", boxShadow:"var(--sh-glow-ai)",
            }}>
              <Icon name="sparkle" size={22}/>
            </div>
            <div className="col">
              <span className="kicker kicker--ai">Agent 01 · Patient Intake</span>
              <span style={{font:"500 17px/1.3 var(--f-sans)", marginTop:4}}>Analysing your symptoms…</span>
            </div>
            <div style={{marginLeft:"auto", display:"flex", gap:6}}>
              <span className="pulse" style={{width:8, height:8, borderRadius:"50%", background:"var(--c-ai)"}}/>
              <span className="pulse" style={{width:8, height:8, borderRadius:"50%", background:"var(--c-ai)", animationDelay:".2s"}}/>
              <span className="pulse" style={{width:8, height:8, borderRadius:"50%", background:"var(--c-ai)", animationDelay:".4s"}}/>
            </div>
          </div>
          <div className="col gap-3">
            {[
              {label:"Parsing symptom timeline (3-day onset, exertion-linked)", state:"done"},
              {label:"Cross-referencing against 4,810 similar presentations", state:"done"},
              {label:"Filtering for cardiology + pulmonology specialists in 25 mi", state:"loading"},
              {label:"Ranking by availability, match score, and no-show risk", state:"queued"},
            ].map((s,i)=>(
              <div key={i} className="row gap-3">
                <span style={{width:18, height:18, borderRadius:"50%", display:"grid", placeItems:"center",
                  background: s.state==="done" ? "var(--c-success)" : s.state==="loading" ? "var(--c-ai)" : "var(--c-surface)",
                  border: s.state==="queued" ? "1.5px dashed var(--c-faint)" : "none",
                }}>
                  {s.state==="done" && <Icon name="check" size={11} color="#fff" stroke={2.5}/>}
                  {s.state==="loading" && <span style={{width:6, height:6, borderRadius:"50%", background:"#fff"}}/>}
                </span>
                <span style={{font:`${s.state==="queued"?"400":"500"} 14px/1.4 var(--f-sans)`,
                  color: s.state==="queued" ? "var(--c-muted)" : "var(--c-ink)"}}>
                  {s.label}
                </span>
                {s.state==="loading" && <span className="mono" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-ai-ink)", marginLeft:"auto"}}>~ 2.4s</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton list */}
        <div className="col gap-3" style={{marginTop:24}}>
          {[1,2,3].map(i=>(
            <div key={i} className="card" style={{padding:18, display:"flex", gap:16, alignItems:"center"}}>
              <div className="shimmer-bg" style={{width:56, height:56, borderRadius:"50%"}}/>
              <div className="col gap-2" style={{flex:1}}>
                <div className="shimmer-bg" style={{height:14, width:"40%", borderRadius:4}}/>
                <div className="shimmer-bg" style={{height:12, width:"60%", borderRadius:4}}/>
              </div>
              <div className="shimmer-bg" style={{height:32, width:88, borderRadius:8}}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ── Step 3 · Results with doctors ────────────────────────── */
const DoctorCard = ({ d }) => (
  <div className="card card--lift" style={{padding:20, display:"flex", gap:18, alignItems:"flex-start", position:"relative"}}>
    {/* match badge */}
    <div style={{
      position:"absolute", top:16, right:16,
      display:"flex", alignItems:"center", gap:6,
      padding:"5px 11px 5px 7px", borderRadius:999,
      background:"var(--c-ai-soft)", color:"var(--c-ai-ink)",
      border:"1px solid oklch(0.88 0.05 295)",
    }}>
      <Icon name="sparkle" size={11} color="var(--c-ai-ink)" stroke={2}/>
      <span className="mono" style={{font:"600 11px/1 var(--f-mono)", letterSpacing:".04em"}}>{d.match}% MATCH</span>
    </div>

    <Avatar name={d.name} tone={d.tone} size={64}/>

    <div className="col gap-1" style={{flex:1, minWidth:0, paddingRight:120}}>
      <div className="row gap-2">
        <span style={{font:"600 16px/1.2 var(--f-sans)"}}>{d.name}</span>
        <span style={{font:"500 12px/1 var(--f-sans)", color:"var(--c-muted)"}}>· {d.title}</span>
      </div>
      <div className="row gap-3" style={{color:"var(--c-ink-2)"}}>
        <span style={{font:"500 13px/1.3 var(--f-sans)", color:"var(--c-primary)"}}>{d.specialty}</span>
        <span style={{color:"var(--c-faint)"}}>·</span>
        <span style={{font:"400 13px/1.3 var(--f-sans)"}}>{d.hospital}</span>
      </div>

      <div className="row gap-2" style={{marginTop:10, flexWrap:"wrap"}}>
        <span className="chip">
          {d.tele
            ? <><Icon name="video" size={11} color="var(--c-info)" stroke={2}/> Telehealth</>
            : <><Icon name="pin" size={11} color="var(--c-info)" stroke={2}/> {d.distance}</>}
        </span>
        <span className="chip"><Icon name="clock" size={11} color="var(--c-success)" stroke={2}/> {d.next}</span>
        <span className="chip"><Icon name="shield" size={11} color="var(--c-muted)" stroke={2}/> Accepts BlueCross</span>
        <span className="chip">★ {d.rating}  <span style={{color:"var(--c-faint)"}}>·  {d.reviews}</span></span>
      </div>

      <p style={{margin:"12px 0 0", font:"400 13px/1.45 var(--f-sans)", color:"var(--c-ink-2)",
        borderLeft:"2px solid var(--c-ai)", paddingLeft:10, fontStyle:"italic"}}>
        <span className="mono" style={{font:"500 10px/1 var(--f-mono)", color:"var(--c-ai-ink)", letterSpacing:".06em", textTransform:"uppercase", fontStyle:"normal", marginRight:6}}>Why matched ·</span>
        {d.why}
      </p>
    </div>

    <div className="col gap-2" style={{alignSelf:"flex-end", marginLeft:"auto"}}>
      <button className="btn btn--brand">Book <Icon name="arrow_right" size={14} stroke={2}/></button>
      <button className="btn btn--ghost btn--sm">View profile</button>
    </div>
  </div>
);

const PatientBook_Step3_Results = () => {
  const doctors = [
    { name:"Dr. Elena Voss", title:"MD, FACC", specialty:"Cardiology", hospital:"Mount Sinai · Cardio Wing",
      match:94, distance:"3.2 mi", tele:false, next:"Tomorrow, 9:40 AM", rating:"4.92", reviews:"312 reviews",
      tone:"primary",
      why:"Strong fit for exertion-triggered chest pressure under 40. Specialises in atypical-presentation work-ups and same-week ECGs." },
    { name:"Dr. Theodore Kim", title:"MD", specialty:"Cardiology", hospital:"NewYork-Presbyterian",
      match:88, distance:"8.7 mi", tele:false, next:"Thu, 2:00 PM", rating:"4.86", reviews:"540 reviews",
      tone:"sage",
      why:"Excellent reviews from younger patients; combines cardiology with stress-related lifestyle assessments." },
    { name:"Dr. Priya Anand", title:"MD, MPH", specialty:"Pulmonology", hospital:"Telehealth (Virtual)",
      match:81, distance:"", tele:true, next:"Today, 4:15 PM", rating:"4.95", reviews:"218 reviews",
      tone:"sky",
      why:"For ruling out respiratory cause of shortness of breath. Same-day virtual triage available." },
  ];
  return (
    <div className="frame app col" style={{height:"100%"}}>
      <AppHeader role="Patient" name="Maya Okafor" roleColor="primary"/>
      <TabStrip items={PATIENT_NAV} active="book"/>
      <div style={{flex:1, overflow:"hidden", padding:"32px 64px"}}>
        <div style={{maxWidth:920, margin:"0 auto"}}>
          {/* recap row */}
          <div className="row" style={{justifyContent:"space-between", alignItems:"flex-end", marginBottom:18}}>
            <div className="col">
              <span className="kicker">Step 3 of 4 · Choose your doctor</span>
              <h2 style={{font:"600 24px/1.2 var(--f-sans)", margin:"6px 0 0", letterSpacing:"-.01em"}}>
                3 doctors matched <span style={{color:"var(--c-muted)", fontWeight:500}}>from 184 nearby</span>
              </h2>
            </div>
            <div className="row gap-2">
              <button className="btn btn--ghost btn--sm"><Icon name="filter" size={13}/> Filters · 2</button>
              <button className="btn btn--ghost btn--sm"><Icon name="sliders" size={13}/> Sort: Match score</button>
            </div>
          </div>

          {/* AI recommendation banner */}
          <AIBanner
            agent="Agent 01 · Patient Intake"
            title="Based on your symptoms, we recommend a Cardiologist."
            confidence={92}
            action={<button className="btn btn--ai btn--sm">See reasoning →</button>}
          >
            Chest pain triggered by exertion + episodic shortness of breath at age 34 fits an atypical-angina
            pattern. We've prioritised cardiology, but kept one pulmonologist on the list to rule out a
            respiratory cause via telehealth.
          </AIBanner>

          <div className="col gap-3" style={{marginTop:18}}>
            {doctors.map((d,i)=><DoctorCard key={i} d={d}/>)}
          </div>

          <div className="row" style={{justifyContent:"center", marginTop:18, color:"var(--c-muted)", font:"400 13px/1 var(--f-sans)"}}>
            <button className="btn btn--ghost btn--sm">Show 9 more matches <Icon name="chev_down" size={13}/></button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Step 4 · Booking modal (over results) ────────────────── */
const PatientBook_Step4_BookingModal = () => {
  const slots = {
    morning:   ["8:00","8:20","9:00","9:40","10:20","11:00"],
    afternoon: ["12:30","1:10","1:50","2:30","3:10","3:50"],
    evening:   ["4:30","5:10","6:00"],
  };
  return (
    <div className="frame app col" style={{height:"100%", position:"relative"}}>
      <AppHeader role="Patient" name="Maya Okafor" roleColor="primary"/>
      <TabStrip items={PATIENT_NAV} active="book"/>
      {/* dimmed bg */}
      <div style={{flex:1, position:"relative", overflow:"hidden"}}>
        <div style={{padding:"32px 64px", filter:"blur(2px)", opacity:.6}}>
          <div style={{maxWidth:920, margin:"0 auto"}}>
            <div className="ai-surface" style={{padding:18, marginBottom:18, height:80}}/>
            {[1,2,3].map(i=>(
              <div key={i} className="card" style={{padding:20, height:120, marginBottom:12}}/>
            ))}
          </div>
        </div>
        <div style={{position:"absolute", inset:0, background:"oklch(0.20 0.012 240 / .35)"}}/>

        {/* modal */}
        <div style={{
          position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)",
          width:720, maxWidth:"94%", maxHeight:"94%",
          background:"var(--c-card)", borderRadius:18,
          boxShadow:"var(--sh-3)", overflow:"hidden",
          display:"flex", flexDirection:"column",
        }}>
          {/* header */}
          <div className="row gap-4" style={{padding:"20px 24px", borderBottom:"1px solid var(--c-border)"}}>
            <Avatar name="Elena Voss" tone="primary" size={48}/>
            <div className="col grow">
              <div className="row gap-2">
                <span style={{font:"600 17px/1 var(--f-sans)"}}>Dr. Elena Voss</span>
                <span className="chip chip--ai" style={{height:20}}>94% match</span>
              </div>
              <span style={{font:"400 13px/1.3 var(--f-sans)", color:"var(--c-muted)", marginTop:4}}>Cardiology · Mount Sinai Cardio Wing · 3.2 mi</span>
            </div>
            <button style={{width:32, height:32, borderRadius:8, border:"none", background:"var(--c-surface)", display:"grid", placeItems:"center", cursor:"pointer"}}>
              <Icon name="x" size={14}/>
            </button>
          </div>

          <div className="row" style={{flex:1, minHeight:0}}>
            {/* calendar */}
            <div style={{width:300, padding:"20px 22px", borderRight:"1px solid var(--c-border)"}}>
              <div className="row" style={{justifyContent:"space-between", marginBottom:16}}>
                <span style={{font:"600 14px/1 var(--f-sans)"}}>May 2026</span>
                <div className="row gap-1">
                  <button style={{width:26, height:26, border:"none", borderRadius:6, background:"var(--c-surface)", display:"grid", placeItems:"center", cursor:"pointer"}}>
                    <Icon name="chev_right" size={12} stroke={2}/>
                  </button>
                </div>
              </div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4,
                font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)", marginBottom:8, textAlign:"center"}}>
                {["M","T","W","T","F","S","S"].map((d,i)=><span key={i}>{d}</span>)}
              </div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4}}>
                {Array.from({length:35}).map((_,i)=>{
                  const day = i - 3; // start offset
                  const inMonth = day >= 1 && day <= 31;
                  const isPast = inMonth && day < 19;
                  const isSelected = day === 20;
                  const hasSlots = inMonth && !isPast && ![24,25].includes(day);
                  return (
                    <div key={i} style={{
                      height:36, display:"grid", placeItems:"center",
                      borderRadius:8, cursor: hasSlots ? "pointer" : "default",
                      background: isSelected ? "var(--c-ink)" : "transparent",
                      color: isSelected ? "#fff"
                            : !inMonth ? "transparent"
                            : isPast ? "var(--c-faint)"
                            : !hasSlots ? "var(--c-faint)"
                            : "var(--c-ink)",
                      font:`${isSelected?"600":"500"} 13px/1 var(--f-sans)`,
                      position:"relative",
                    }}>
                      {inMonth ? day : ""}
                      {hasSlots && !isSelected && (
                        <span style={{position:"absolute", bottom:5, width:4, height:4, borderRadius:"50%", background:"var(--c-primary)"}}/>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="col gap-2" style={{marginTop:18, padding:"12px 14px", background:"var(--c-surface)", borderRadius:10}}>
                <span className="kicker">Selected</span>
                <span style={{font:"500 15px/1.2 var(--f-sans)"}}>Wed · May 20</span>
                <span className="row gap-1" style={{font:"400 12px/1.3 var(--f-sans)", color:"var(--c-muted)"}}>
                  <Icon name="info" size={12}/> In-person · 30 min
                </span>
              </div>
            </div>

            {/* slots */}
            <div style={{flex:1, padding:"20px 24px", overflow:"hidden"}}>
              <div className="col gap-5">
                {Object.entries(slots).map(([part, list]) => (
                  <div key={part} className="col gap-2">
                    <div className="row gap-2">
                      <Icon name={part==="morning"?"sun":part==="evening"?"moon":"sun"} size={14} color="var(--c-muted)"/>
                      <span className="kicker">{part}</span>
                      <span style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-faint)"}}>· {list.length} available</span>
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8}}>
                      {list.map(t => {
                        const selected = t === "9:40";
                        return (
                          <button key={t} style={{
                            padding:"10px 0", borderRadius:8, cursor:"pointer",
                            background: selected ? "var(--c-primary)" : "var(--c-card)",
                            color: selected ? "#fff" : "var(--c-ink)",
                            border: `1px solid ${selected ? "var(--c-primary)" : "var(--c-border-2)"}`,
                            font:"500 13px/1 var(--f-mono)",
                            boxShadow: selected ? "0 4px 12px -4px oklch(0.40 0.06 180 / .35)" : "none",
                          }}>{t}</button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="row gap-3" style={{padding:"16px 24px", borderTop:"1px solid var(--c-border)",
            background:"var(--c-surface)", justifyContent:"space-between", alignItems:"center"}}>
            <div className="row gap-2" style={{font:"500 13px/1.3 var(--f-sans)", color:"var(--c-ink-2)"}}>
              <Icon name="shield" size={14} color="var(--c-success)"/>
              <span>No-show risk monitoring will activate on confirmation.</span>
            </div>
            <div className="row gap-2">
              <button className="btn btn--ghost">Back</button>
              <button className="btn btn--brand">Confirm booking · Wed 9:40 AM</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── My Appointments ─────────────────────────────────────── */
const apptCard = (a) => (
  <div className="card" style={{padding:0, overflow:"hidden", display:"flex"}}>
    <div style={{width:6, alignSelf:"stretch", background:a.accent}}/>
    <div style={{padding:"18px 22px", display:"flex", gap:18, alignItems:"center", flex:1}}>
      <div className="col" style={{width:78, textAlign:"center", flexShrink:0}}>
        <span className="mono" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)", letterSpacing:".08em"}}>{a.month}</span>
        <span className="serif" style={{font:"500 32px/1 var(--f-serif)", marginTop:2}}>{a.day}</span>
        <span style={{font:"500 12px/1.2 var(--f-sans)", color:"var(--c-muted)", marginTop:4}}>{a.time}</span>
      </div>
      <div className="divider-v"/>
      <Avatar name={a.dr} tone={a.tone} size={44}/>
      <div className="col grow">
        <div className="row gap-2">
          <span style={{font:"600 15px/1.2 var(--f-sans)"}}>{a.dr}</span>
          <span style={{font:"400 13px/1 var(--f-sans)", color:"var(--c-muted)"}}>· {a.spec}</span>
        </div>
        <span style={{font:"400 13px/1.4 var(--f-sans)", color:"var(--c-ink-2)", marginTop:3}}>{a.where}</span>
        {a.followUp && (
          <div className="row gap-2" style={{marginTop:8}}>
            <span style={{width:14, height:14, borderRadius:4,
              background:"var(--c-ai-soft)", display:"grid", placeItems:"center"}}>
              <Icon name="sparkle" size={9} color="var(--c-ai-ink)" stroke={2}/>
            </span>
            <span className="mono" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-ai-ink)", letterSpacing:".04em"}}>
              AI FOLLOW-UP · {a.followUp}
            </span>
          </div>
        )}
      </div>
      <div className="col gap-2" style={{alignItems:"flex-end"}}>
        <StatusPill status={a.status}/>
        <button className="btn btn--ghost btn--sm">
          {a.status === "Booked" ? "Manage" : a.status === "Discharged" ? "View notes" : "Details"}
          <Icon name="chev_right" size={12}/>
        </button>
      </div>
    </div>
  </div>
);

const PatientAppointments = () => {
  const items = [
    { day:"20", month:"MAY", time:"9:40 AM", dr:"Dr. Elena Voss", spec:"Cardiology", where:"Mount Sinai · Cardio Wing, Floor 6, Suite 612",
      status:"Booked", accent:"var(--c-info)", tone:"primary" },
    { day:"14", month:"MAY", time:"11:15 AM", dr:"Dr. Sara Lin", spec:"Internal Medicine", where:"Currently being seen · Room 304",
      status:"Admitted", accent:"var(--c-warn)", tone:"warm" },
    { day:"02", month:"MAY", time:"3:00 PM", dr:"Dr. Marcus Hale", spec:"Dermatology", where:"Telehealth · Discharged 3:34 PM",
      status:"Discharged", accent:"var(--c-success)", tone:"sage", followUp:"Sent on May 5 · awaiting response" },
    { day:"22", month:"APR", time:"10:30 AM", dr:"Dr. Henry Webb", spec:"Family Medicine", where:"Brooklyn Annex · Clinic 2",
      status:"No Show", accent:"var(--c-danger)", tone:"rose" },
  ];
  return (
    <div className="frame app col" style={{height:"100%"}}>
      <AppHeader role="Patient" name="Maya Okafor" roleColor="primary"/>
      <TabStrip items={PATIENT_NAV} active="appts"/>
      <div style={{flex:1, overflow:"hidden", padding:"32px 64px"}}>
        <div style={{maxWidth:920, margin:"0 auto"}}>
          <div className="row" style={{justifyContent:"space-between", alignItems:"flex-end", marginBottom:24}}>
            <div className="col">
              <span className="kicker">Your care timeline</span>
              <h1 className="serif" style={{font:"500 44px/1.1 var(--f-serif)", letterSpacing:"-.02em", margin:"6px 0 0"}}>
                My appointments
              </h1>
            </div>
            <div className="row gap-2">
              <button className="btn btn--ghost btn--sm"><Icon name="calendar" size={13}/> Sync to Apple Health</button>
              <button className="btn btn--brand btn--sm"><Icon name="plus" size={13}/> Book new</button>
            </div>
          </div>

          {/* segmented */}
          <div className="row gap-2" style={{marginBottom:18}}>
            {[
              { label:"All", count:4, active:true },
              { label:"Upcoming", count:1 },
              { label:"In-care", count:1 },
              { label:"Completed", count:1 },
              { label:"Missed", count:1 },
            ].map(s=>(
              <span key={s.label} style={{
                padding:"7px 14px", borderRadius:999, cursor:"pointer",
                font:`${s.active?"600":"500"} 13px/1 var(--f-sans)`,
                background: s.active ? "var(--c-ink)" : "var(--c-card)",
                color: s.active ? "#fff" : "var(--c-ink-2)",
                border:"1px solid var(--c-border)",
                display:"inline-flex", alignItems:"center", gap:8,
              }}>{s.label}
                <span style={{font:"500 11px/1 var(--f-mono)", color: s.active ? "rgba(255,255,255,.7)" : "var(--c-muted)"}}>{s.count}</span>
              </span>
            ))}
          </div>

          <div className="col gap-3">
            {items.map((a,i)=><React.Fragment key={i}>{apptCard(a)}</React.Fragment>)}
          </div>

          {/* AI insight tile */}
          <div className="ai-surface" style={{marginTop:22, padding:"16px 18px", display:"flex", gap:14, alignItems:"center"}}>
            <div style={{width:36, height:36, borderRadius:10,
              background:"linear-gradient(135deg, var(--c-ai-2), var(--c-ai))", color:"#fff",
              display:"grid", placeItems:"center", boxShadow:"var(--sh-glow-ai)"}}>
              <Icon name="sparkle" size={16}/>
            </div>
            <div className="col grow">
              <span className="kicker kicker--ai">Agent 06 · Post-Visit</span>
              <span style={{font:"500 14px/1.4 var(--f-sans)", marginTop:3}}>
                You haven't responded to Dr. Hale's follow-up yet — would you like to message him about your rash?
              </span>
            </div>
            <button className="btn btn--ai btn--sm">Reply</button>
            <button className="btn btn--ghost btn--sm">Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  PatientBook_Step1, PatientBook_Step2_Loading, PatientBook_Step3_Results,
  PatientBook_Step4_BookingModal, PatientAppointments,
});
