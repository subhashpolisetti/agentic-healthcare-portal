/* Shared UI primitives — AI HealthCare Portal */

const Logo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2.5C7.5 2.5 4 6 4 10.5c0 3.6 2.6 6.4 6 9.4 1.1 1 2 1.6 2 1.6s.9-.6 2-1.6c3.4-3 6-5.8 6-9.4 0-4.5-3.5-8-8-8Z"
      stroke="currentColor" strokeWidth="1.4"/>
    <path d="M9 11.2h2.1V8.8h1.8v2.4H15v1.8h-2.1V15h-1.8v-2H9v-1.8Z" fill="currentColor"/>
  </svg>
);

const Avatar = ({ name = "?", tone = "primary", size = 36, src }) => {
  const initials = name.split(/\s+/).slice(0,2).map(s=>s[0]||"").join("").toUpperCase();
  const palette = {
    primary: ["oklch(0.92 0.04 180)", "oklch(0.30 0.05 180)"],
    ai:      ["oklch(0.94 0.04 295)", "oklch(0.40 0.13 295)"],
    warm:    ["oklch(0.92 0.05 60)",  "oklch(0.40 0.08 60)"],
    rose:    ["oklch(0.92 0.05 20)",  "oklch(0.42 0.10 20)"],
    sage:    ["oklch(0.92 0.04 145)", "oklch(0.40 0.06 145)"],
    sky:     ["oklch(0.92 0.04 230)", "oklch(0.40 0.08 230)"],
    sand:    ["oklch(0.94 0.025 85)", "oklch(0.40 0.04 85)"],
  };
  const [bg, fg] = palette[tone] || palette.sand;
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background: src ? `center/cover url(${src})` : bg,
      color:fg, display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"var(--f-sans)", fontWeight:600, fontSize: size*0.36, letterSpacing: ".02em",
      flexShrink:0,
    }}>{!src && initials}</div>
  );
};

const Icon = ({ name, size = 16, stroke = 1.6, color = "currentColor" }) => {
  const paths = {
    arrow_right: <path d="M5 12h14M13 6l6 6-6 6"/>,
    chev_right:  <path d="M9 6l6 6-6 6"/>,
    chev_down:   <path d="M6 9l6 6 6-6"/>,
    chev_up:     <path d="M6 15l6-6 6 6"/>,
    check:       <path d="M5 12.5l4.2 4.2L19 7"/>,
    x:           <path d="M6 6l12 12M18 6L6 18"/>,
    search:      <><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></>,
    eye:         <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    eye_off:     <><path d="M3 3l18 18"/><path d="M10.6 6.1A11 11 0 0 1 12 6c6.5 0 10 6 10 6a14 14 0 0 1-3.2 3.8M6.1 6.1C3.6 7.8 2 12 2 12s3.5 7 10 7c1.6 0 3.1-.4 4.4-1"/><path d="M9.5 9.6a3 3 0 0 0 4.2 4.3"/></>,
    plus:        <path d="M12 5v14M5 12h14"/>,
    calendar:    <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    clock:       <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    pin:         <><path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></>,
    video:       <><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2z"/></>,
    sparkle:     <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8"/>,
    heart:       <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>,
    activity:    <path d="M3 12h4l2.5-7 4 14L16 12h5"/>,
    droplet:     <path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11Z"/>,
    thermo:      <><path d="M10 4a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0V4Z"/><path d="M12 4v10"/></>,
    lungs:       <><path d="M12 4v8"/><path d="M12 12c0-2 -1-4 -3-5 -3-1 -5 1 -5 5v3a4 4 0 0 0 6 3.5"/><path d="M12 12c0-2 1-4 3-5 3-1 5 1 5 5v3a4 4 0 0 1-6 3.5"/></>,
    bell:        <><path d="M5 17h14l-1.4-1.4A4 4 0 0 1 16.5 13V10a4.5 4.5 0 0 0-9 0v3a4 4 0 0 1-1.1 2.6L5 17Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
    grid:        <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    list:        <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    user:        <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>,
    stetho:      <><path d="M5 4v6a4 4 0 0 0 8 0V4"/><path d="M9 14v3a4 4 0 0 0 8 0v-1"/><circle cx="17" cy="14" r="2"/></>,
    flag:        <><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></>,
    bed:         <><path d="M3 18V8m18 10v-4a3 3 0 0 0-3-3H3"/><circle cx="8" cy="10" r="2"/></>,
    file_text:   <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></>,
    upload:      <><path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/></>,
    download:    <><path d="M12 4v12"/><path d="M6 12l6 6 6-6"/><path d="M4 20h16"/></>,
    refresh:     <><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></>,
    alert:       <><path d="M12 3l10 18H2L12 3Z"/><path d="M12 10v4M12 18v.01"/></>,
    info:        <><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v5h1"/></>,
    logout:      <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M16 16l4-4-4-4M20 12H10"/></>,
    filter:      <path d="M3 5h18l-7 9v6l-4-2v-4L3 5Z"/>,
    send:        <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7Z"/></>,
    pill:        <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-30 12 12)"/><path d="M8.5 7.5l8 8"/></>,
    shield:      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/>,
    chat:        <><path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1 4.5A8 8 0 0 1 21 12Z"/></>,
    waveform:    <><path d="M3 12h2l2-6 3 12 3-9 2 5h6"/></>,
    sliders:     <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#fff"/><circle cx="15" cy="12" r="2" fill="#fff"/><circle cx="7" cy="18" r="2" fill="#fff"/></>,
    sun:         <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    moon:        <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/>,
    flame:       <path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 1-2 2-3 2-1-3-3-5-5-7-1 3 0 5-1 7-2 1-3 4-3 7 0 4 3 5 8 5Z"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
};

/* App header bar — used on all post-auth pages */
const AppHeader = ({ role = "Patient", name = "Maya Okafor", roleColor = "primary" }) => (
  <header style={{
    height:64, padding:"0 32px",
    borderBottom:"1px solid var(--c-border)",
    background:"var(--c-card)",
    display:"flex", alignItems:"center", justifyContent:"space-between",
  }}>
    <div className="row gap-3">
      <div style={{width:34, height:34, borderRadius:10,
        background:"linear-gradient(135deg, var(--c-primary), var(--c-primary-2))",
        color:"#fff", display:"grid", placeItems:"center"}}>
        <Logo size={20}/>
      </div>
      <div className="col">
        <span style={{font:"600 15px/1 var(--f-sans)", letterSpacing:"-.01em"}}>
          AI HealthCare <span style={{color:"var(--c-muted)", fontWeight:500}}>Portal</span>
        </span>
        <span className="mono" style={{font:"500 10px/1.2 var(--f-mono)", color:"var(--c-ai-ink)", letterSpacing:".08em", marginTop:3}}>
          ✦ POWERED BY AI AGENTS
        </span>
      </div>
    </div>
    <div className="row gap-4">
      <span className={`chip ${roleColor === "ai" ? "chip--ai" : "chip--primary"}`}>
        <span style={{width:6, height:6, borderRadius:"50%",
          background: roleColor === "ai" ? "var(--c-ai)" : "var(--c-primary)"}}/>
        {role}
      </span>
      <div className="row gap-2">
        <Avatar name={name} tone={roleColor==="ai" ? "ai" : "primary"} size={32}/>
        <div className="col" style={{lineHeight:1.15}}>
          <span style={{font:"500 13px/1.2 var(--f-sans)"}}>{name}</span>
          <span style={{font:"400 11px/1.2 var(--f-sans)", color:"var(--c-muted)"}}>
            {role === "Doctor" ? "Internal Medicine" : "Patient #28104"}
          </span>
        </div>
      </div>
      <button className="btn btn--ghost btn--sm" style={{height:34}}>
        <Icon name="logout" size={14}/> Logout
      </button>
    </div>
  </header>
);

/* Sub-nav tab strip for patient/doctor */
const TabStrip = ({ items, active }) => (
  <div style={{
    padding:"0 32px",
    borderBottom:"1px solid var(--c-border)",
    background:"var(--c-card)",
    display:"flex", gap: 4, alignItems:"flex-end", height:48,
  }}>
    {items.map((it) => {
      const isActive = it.key === active;
      return (
        <div key={it.key} style={{position:"relative", padding:"0 14px", height:"100%",
          display:"flex", alignItems:"center", gap:8,
          font: isActive ? "600 13.5px/1 var(--f-sans)" : "500 13.5px/1 var(--f-sans)",
          color: isActive ? "var(--c-ink)" : "var(--c-muted)",
          cursor:"pointer",
        }}>
          {it.icon && <Icon name={it.icon} size={15} color={isActive ? "var(--c-primary)" : "currentColor"}/>}
          {it.label}
          {typeof it.count === "number" && (
            <span style={{
              minWidth:18, height:18, padding:"0 6px",
              borderRadius:9, background: isActive ? "var(--c-ink)" : "var(--c-surface)",
              color: isActive ? "#fff" : "var(--c-muted)",
              font:"600 11px/18px var(--f-mono)", textAlign:"center",
            }}>{it.count}</span>
          )}
          {isActive && <span style={{
            position:"absolute", left:0, right:0, bottom:-1, height:2,
            background:"var(--c-ink)", borderRadius:2,
          }}/>}
        </div>
      );
    })}
  </div>
);

/* Agent status strip (6 dots) */
const AgentsStrip = ({ activeIds = [1,2,3,4,5,6] }) => {
  const agents = [
    { id:1, name:"Intake" },
    { id:2, name:"Clinical" },
    { id:3, name:"No-Show" },
    { id:4, name:"Emergency" },
    { id:5, name:"Discharge" },
    { id:6, name:"Follow-up" },
  ];
  return (
    <div style={{
      padding:"10px 32px",
      borderBottom:"1px solid var(--c-border)",
      background:"linear-gradient(180deg, oklch(0.985 0.012 295), var(--c-card))",
      display:"flex", alignItems:"center", gap:20,
    }}>
      <span className="kicker kicker--ai">✦ AI Agents</span>
      <div className="row gap-4" style={{flex:1}}>
        {agents.map((a) => {
          const active = activeIds.includes(a.id);
          return (
            <div key={a.id} className="row gap-2" style={{font:"500 12px/1 var(--f-mono)",
              letterSpacing:".04em", color: active ? "var(--c-ink)" : "var(--c-faint)"}}>
              <span className={`ai-dot ${active ? "" : "ai-dot--idle"}`}/>
              <span style={{color:"var(--c-muted)", marginRight:2}}>0{a.id}</span>
              {a.name}
            </div>
          );
        })}
      </div>
      <span className="mono" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)"}}>
        all systems · 0.98ms p50
      </span>
    </div>
  );
};

/* Status badge for appointment/discharge */
const StatusPill = ({ status }) => {
  const map = {
    Booked:     { cls:"chip--info",    dot:"var(--c-info)"   },
    Admitted:   { cls:"chip--warn",    dot:"var(--c-warn)"   },
    Discharged: { cls:"chip--success", dot:"var(--c-success)"},
    "No Show":  { cls:"chip--danger",  dot:"var(--c-danger)" },
    Pending:    { cls:"chip",          dot:"var(--c-faint)"  },
    Sent:       { cls:"chip--ai",      dot:"var(--c-ai)"     },
    Responded:  { cls:"chip--success", dot:"var(--c-success)"},
  };
  const c = map[status] || map.Pending;
  return (
    <span className={`chip ${c.cls}`}>
      <span style={{width:6, height:6, borderRadius:"50%", background:c.dot}}/>
      {status}
    </span>
  );
};

/* Risk pill — low / medium / high with mini bar */
const RiskScore = ({ value, label }) => {
  const tier = value >= 70 ? "high" : value >= 35 ? "med" : "low";
  const colors = {
    low:  ["oklch(0.95 0.03 155)", "var(--c-success)", "oklch(0.38 0.10 155)"],
    med:  ["oklch(0.96 0.045 90)",  "var(--c-warn)",    "oklch(0.45 0.13 75)"],
    high: ["oklch(0.96 0.025 25)",  "var(--c-danger)",  "oklch(0.46 0.16 25)"],
  }[tier];
  return (
    <div style={{display:"inline-flex", alignItems:"center", gap:10,
      padding:"4px 10px 4px 6px", borderRadius:999,
      background: colors[0], color: colors[2],
      border:`1px solid ${colors[1].replace("var(--c-","oklch(0.86 0.06 ")}`,
    }}>
      <span style={{width:24, height:24, borderRadius:"50%",
        background:"#fff", display:"grid", placeItems:"center",
        font:"600 10px/1 var(--f-mono)", color: colors[2], border:`1.5px solid ${colors[1]}`,
      }}>{value}</span>
      <span style={{font:"500 12px/1 var(--f-sans)"}}>{label || (tier==="high"?"High":tier==="med"?"Medium":"Low")}</span>
    </div>
  );
};

/* AI banner — used in clinical contexts to mark AI-generated content */
const AIBanner = ({ agent, title, children, action, confidence }) => (
  <div className="ai-surface" style={{padding:"16px 18px", display:"flex", gap:14, alignItems:"flex-start"}}>
    <div style={{
      width:36, height:36, borderRadius:10, flexShrink:0,
      background:"linear-gradient(135deg, var(--c-ai-2), var(--c-ai))",
      color:"#fff", display:"grid", placeItems:"center",
      boxShadow:"var(--sh-glow-ai)",
    }}>
      <Icon name="sparkle" size={18} stroke={1.8}/>
    </div>
    <div className="grow">
      <div className="row gap-2" style={{marginBottom:4}}>
        <span className="kicker kicker--ai">{agent}</span>
        {typeof confidence === "number" && (
          <span className="mono" style={{font:"500 10px/1 var(--f-mono)", color:"var(--c-ai-ink)",
            background:"#fff", padding:"3px 6px", borderRadius:4, border:"1px solid oklch(0.86 0.06 295)"}}>
            {confidence}% CONFIDENCE
          </span>
        )}
      </div>
      <div style={{font:"500 15px/1.35 var(--f-sans)", color:"var(--c-ink)"}}>{title}</div>
      {children && <div style={{font:"400 13px/1.5 var(--f-sans)", color:"var(--c-ink-2)", marginTop:4}}>{children}</div>}
    </div>
    {action}
  </div>
);

/* Sparkline */
const Sparkline = ({ data, color = "var(--c-primary)", width = 120, height = 36, fill = true }) => {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v,i) => [i*step, height - ((v-min)/range)*(height-6) - 3]);
  const d = pts.map((p,i)=> (i===0?"M":"L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {fill && <path d={area} fill={color} opacity=".10"/>}
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.4" fill={color}/>
    </svg>
  );
};

Object.assign(window, {
  Logo, Avatar, Icon, AppHeader, TabStrip, AgentsStrip,
  StatusPill, RiskScore, AIBanner, Sparkline,
});
