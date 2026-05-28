/* Emergency Vitals Monitor */

const VitalCard = ({ name, value, unit, range, data, color, icon, critical, alert, ring }) => (
  <div className="card" style={{
    padding:"18px 20px", position:"relative", overflow:"hidden",
    border: critical ? "1px solid oklch(0.78 0.16 25)" : "1px solid var(--c-border)",
    background: critical ? "linear-gradient(180deg, oklch(0.985 0.018 25), var(--c-card))" : "var(--c-card)",
    boxShadow: critical ? "0 0 0 4px oklch(0.78 0.14 25 / .15)" : "var(--sh-1)",
  }}>
    {critical && (
      <div className="pulse" style={{
        position:"absolute", top:14, right:14,
        width:10, height:10, borderRadius:"50%", background:"var(--c-danger)",
        boxShadow:"0 0 0 5px oklch(0.78 0.16 25 / .25)",
      }}/>
    )}
    <div className="row" style={{justifyContent:"space-between"}}>
      <div className="row gap-2">
        <span style={{width:28, height:28, borderRadius:8,
          background: critical ? "var(--c-danger-soft)" : "var(--c-surface)",
          color: critical ? "var(--c-danger)" : color,
          display:"grid", placeItems:"center"}}>
          <Icon name={icon} size={15}/>
        </span>
        <div className="col">
          <span style={{font:"500 13px/1 var(--f-sans)", color:"var(--c-ink)"}}>{name}</span>
          <span style={{font:"500 11px/1.1 var(--f-mono)", color:"var(--c-muted)", marginTop:3}}>{range}</span>
        </div>
      </div>
      {alert && (
        <span className="chip chip--danger" style={{height:20}}>
          <Icon name="alert" size={9} color="var(--c-danger)" stroke={2.4}/> {alert}
        </span>
      )}
    </div>

    <div className="row" style={{justifyContent:"space-between", alignItems:"flex-end", marginTop:14}}>
      <div className="col">
        <span className="tab-num" style={{
          font:`500 ${typeof value === "string" && value.length > 5 ? 36 : 44}px/1 var(--f-serif)`,
          letterSpacing:"-.02em",
          color: critical ? "var(--c-danger)" : "var(--c-ink)",
        }}>
          {value}<span style={{font:"500 14px/1 var(--f-sans)", color:"var(--c-muted)", marginLeft:6}}>{unit}</span>
        </span>
        <span style={{font:"500 11px/1 var(--f-mono)", color: critical ? "var(--c-danger)" : "var(--c-muted)", letterSpacing:".04em", marginTop:6}}>
          {critical ? "● CRITICAL · 3m 14s" : "● in range · stable"}
        </span>
      </div>
      {ring && (
        <div style={{width:64, height:64, position:"relative"}}>
          <svg width={64} height={64}>
            <circle cx="32" cy="32" r="26" stroke="var(--c-surface)" strokeWidth="6" fill="none"/>
            <circle cx="32" cy="32" r="26" stroke={critical?"var(--c-danger)":color} strokeWidth="6" fill="none"
              strokeLinecap="round" strokeDasharray={`${ring*1.63} 200`} transform="rotate(-90 32 32)"/>
          </svg>
          <span className="tab-num" style={{
            position:"absolute", inset:0, display:"grid", placeItems:"center",
            font:"500 14px/1 var(--f-mono)", color:critical?"var(--c-danger)":color,
          }}>{ring}%</span>
        </div>
      )}
    </div>

    <div style={{marginTop:12}}>
      <Sparkline data={data} color={critical?"var(--c-danger)":color} width={296} height={42}/>
    </div>
  </div>
);

const VitalsMonitor = () => (
  <div className="frame app col" style={{height:"100%"}}>
    <AppHeader role="Doctor" name="Dr. Aisha Rahman" roleColor="ai"/>
    {/* sub-header for vitals */}
    <div style={{
      padding:"14px 32px", background:"var(--c-card)",
      borderBottom:"1px solid var(--c-border)",
      display:"flex", alignItems:"center", gap:24,
    }}>
      <div className="row gap-3">
        <span className="row gap-2" style={{
          padding:"4px 10px 4px 6px", borderRadius:999,
          background:"var(--c-success-soft)", color:"oklch(0.38 0.10 155)",
          border:"1px solid oklch(0.86 0.06 155)",
        }}>
          <span className="pulse" style={{width:8, height:8, borderRadius:"50%", background:"var(--c-success)",
            boxShadow:"0 0 0 3px oklch(0.58 0.12 155 / .25)"}}/>
          <span style={{font:"500 11px/1 var(--f-mono)", letterSpacing:".06em"}}>WEBSOCKET · LIVE · 23ms</span>
        </span>
        <span style={{height:18, width:1, background:"var(--c-border)"}}/>
        <div className="col">
          <span style={{font:"600 15px/1 var(--f-sans)"}}>Emergency Vitals · Lila Tarrant</span>
          <span style={{font:"400 11.5px/1.2 var(--f-sans)", color:"var(--c-muted)", marginTop:3}}>
            ICU · Bed 4 · 62 yrs · Admitted 5:14 AM · MRN 81-204-119
          </span>
        </div>
      </div>
      <div style={{flex:1}}/>
      <span className="mono tab-num" style={{font:"500 13px/1 var(--f-mono)", color:"var(--c-muted)"}}>
        12:46:18 PM
      </span>
      <button className="btn btn--ghost btn--sm"><Icon name="bell" size={13}/> Alert sound</button>
      <button className="btn btn--soft btn--sm"><Icon name="user" size={13}/> Patient chart</button>
    </div>

    <div style={{flex:1, padding:"20px 32px", overflow:"hidden", background:"var(--c-bg)"}}>
      <div style={{display:"grid", gridTemplateColumns:"1fr 340px", gap:20, height:"100%"}}>
        <div className="col gap-3" style={{minWidth:0}}>
          {/* Agent 4 banner */}
          <div className="card" style={{
            padding:"16px 18px",
            background:"linear-gradient(180deg, oklch(0.97 0.022 25), var(--c-card))",
            border:"1px solid oklch(0.84 0.10 25)",
            display:"flex", gap:14, alignItems:"flex-start",
          }}>
            <div style={{
              width:40, height:40, borderRadius:10, flexShrink:0,
              background:"var(--c-danger)", color:"#fff",
              display:"grid", placeItems:"center",
              boxShadow:"0 0 0 4px oklch(0.78 0.16 25 / .15)",
            }}>
              <Icon name="alert" size={20}/>
            </div>
            <div className="grow">
              <div className="row gap-2" style={{marginBottom:4}}>
                <span className="kicker" style={{color:"var(--c-danger)"}}>⚠ Agent 04 · Emergency Monitor</span>
                <span className="mono" style={{font:"500 10px/1 var(--f-mono)", color:"var(--c-muted)"}}>raised 12:43:04 PM · 3m 14s ago</span>
              </div>
              <div style={{font:"500 15px/1.35 var(--f-sans)"}}>
                Heart rate has been &gt; 110 bpm and SpO₂ &lt; 94% for more than 3 minutes.
              </div>
              <div style={{font:"400 13px/1.5 var(--f-sans)", color:"var(--c-ink-2)", marginTop:6}}>
                Pattern consistent with hypoxia-driven tachycardia. <strong>Suggested action:</strong> review
                current diuretic dosage and consider supplemental O₂ titration. <span style={{color:"var(--c-muted)"}}>Confidence 91%.</span>
              </div>
            </div>
            <div className="col gap-2">
              <button className="btn btn--brand btn--sm">Acknowledge</button>
              <button className="btn btn--ghost btn--sm">Page resident</button>
            </div>
          </div>

          {/* 2x3 vitals grid */}
          <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14, flex:1, minHeight:0}}>
            <VitalCard
              name="Heart Rate" icon="heart" value="118" unit="bpm" range="60–100 bpm"
              data={[92,94,98,102,108,112,116,118,116,118,120,118]}
              color="var(--c-primary)" critical alert="HIGH"
            />
            <VitalCard
              name="Blood Pressure" icon="activity" value="172/104" unit="mmHg" range="< 130/80"
              data={[160,162,168,170,172,174,170,172,176,172,170,172]}
              color="var(--c-warn)" critical
            />
            <VitalCard
              name="SpO₂" icon="droplet" value="91" unit="%" range="≥ 95%"
              data={[94,93,93,92,92,91,91,90,91,91,91,91]}
              color="var(--c-info)" critical alert="LOW" ring={91}
            />
            <VitalCard
              name="Temperature" icon="thermo" value="100.6" unit="°F" range="97.8–99.1"
              data={[99.0,99.2,99.4,99.6,99.8,100.0,100.2,100.4,100.5,100.6,100.6,100.6]}
              color="var(--c-warn)"
            />
            <VitalCard
              name="Respiratory Rate" icon="lungs" value="24" unit="/min" range="12–20"
              data={[18,19,20,21,22,23,24,24,24,24,24,24]}
              color="var(--c-info)"
            />
            <VitalCard
              name="Glucose" icon="pill" value="142" unit="mg/dL" range="70–140"
              data={[126,128,132,138,140,142,140,142,142,142,142,142]}
              color="var(--c-primary)"
            />
          </div>

          {/* timeline */}
          <div className="card" style={{padding:"14px 18px"}}>
            <div className="row" style={{justifyContent:"space-between", marginBottom:8}}>
              <span className="kicker">Session timeline · last 30 min</span>
              <div className="row gap-2">
                <span className="row gap-1" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)"}}>
                  <span style={{width:6, height:6, borderRadius:"50%", background:"var(--c-danger)"}}/> alerts
                </span>
                <span className="row gap-1" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)"}}>
                  <span style={{width:6, height:6, borderRadius:"50%", background:"var(--c-warn)"}}/> warnings
                </span>
              </div>
            </div>
            <div style={{position:"relative", height:24, background:"var(--c-surface)", borderRadius:6}}>
              <div style={{position:"absolute", left:"4%", top:0, bottom:0, width:2, background:"var(--c-warn)"}}/>
              <div style={{position:"absolute", left:"22%", top:0, bottom:0, width:2, background:"var(--c-warn)"}}/>
              <div style={{position:"absolute", left:"58%", top:0, bottom:0, width:2, background:"var(--c-danger)"}}/>
              <div style={{position:"absolute", left:"72%", top:0, bottom:0, width:2, background:"var(--c-warn)"}}/>
              <div style={{position:"absolute", left:"89%", top:-2, bottom:-2, width:3, background:"var(--c-danger)",
                boxShadow:"0 0 0 4px oklch(0.78 0.16 25 / .2)"}}/>
              <span style={{position:"absolute", left:"89%", bottom:-22, transform:"translateX(-50%)",
                font:"500 10px/1 var(--f-mono)", color:"var(--c-danger)"}}>now</span>
            </div>
            <div className="row" style={{justifyContent:"space-between", marginTop:8, font:"500 10px/1 var(--f-mono)", color:"var(--c-faint)"}}>
              <span>-30m</span><span>-20m</span><span>-10m</span><span>now</span>
            </div>
          </div>
        </div>

        {/* alert history sidebar */}
        <div className="col gap-3">
          <div className="card" style={{padding:"16px 18px"}}>
            <div className="row" style={{justifyContent:"space-between"}}>
              <span className="kicker">Alert history · this session</span>
              <span className="chip chip--danger" style={{height:20}}>4</span>
            </div>
            <div className="col" style={{marginTop:12}}>
              {[
                { sev:"danger", t:"12:43 PM", title:"HR > 110 + SpO₂ < 94 (3+ min)",
                  agent:"Agent 04", body:"Review diuretic dosage and consider O₂ titration.", active:true },
                { sev:"warn",   t:"12:18 PM", title:"BP > 170/100 sustained",
                  agent:"Agent 04", body:"Trend rising 14% over last hour.", ack:"Dr. Patel" },
                { sev:"warn",   t:"11:42 AM", title:"Temp rising — 100.6°F",
                  agent:"Agent 04", body:"Suggest blood cultures if persists.", ack:"Dr. Rahman" },
                { sev:"warn",   t:"5:32 AM", title:"Admission baseline anomaly",
                  agent:"Agent 04", body:"Crackles + S4 noted in handoff.", ack:"Auto" },
              ].map((a,i,arr)=>(
                <div key={i} style={{
                  position:"relative", paddingLeft:18,
                  paddingBottom: i===arr.length-1 ? 0 : 14,
                  borderLeft: i===arr.length-1 ? "none" : "1px dashed var(--c-border)",
                  marginLeft:6,
                }}>
                  <span style={{
                    position:"absolute", left:-7, top:0, width:14, height:14, borderRadius:"50%",
                    background: a.sev==="danger" ? "var(--c-danger)" : "var(--c-warn)",
                    border:"3px solid var(--c-card)",
                    boxShadow: a.active ? "0 0 0 3px oklch(0.78 0.16 25 / .2)" : "none",
                  }}/>
                  <div className="row" style={{justifyContent:"space-between"}}>
                    <span style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)"}}>{a.t} · {a.agent}</span>
                    {a.active
                      ? <span className="chip chip--danger" style={{height:18, fontSize:9.5}}>ACTIVE</span>
                      : <span style={{font:"500 10px/1 var(--f-mono)", color:"var(--c-faint)"}}>ACK · {a.ack}</span>}
                  </div>
                  <div style={{font:"500 13px/1.3 var(--f-sans)", marginTop:5}}>{a.title}</div>
                  <div style={{font:"400 12px/1.45 var(--f-sans)", color:"var(--c-muted)", marginTop:3}}>{a.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{padding:"16px 18px"}}>
            <span className="kicker">Active medications</span>
            <div className="col gap-2" style={{marginTop:10}}>
              {[
                {n:"Furosemide", d:"40mg IV q12h", note:"diuretic"},
                {n:"Metoprolol",  d:"25mg PO BID", note:"beta-blocker"},
                {n:"Heparin gtt", d:"per ACS protocol", note:"anticoag"},
                {n:"O₂ via NC",   d:"2 L/min", note:"adjusting"},
              ].map(m=>(
                <div key={m.n} className="row" style={{justifyContent:"space-between", font:"400 13px/1.3 var(--f-sans)"}}>
                  <div className="col">
                    <span style={{color:"var(--c-ink)"}}>{m.n}</span>
                    <span style={{font:"400 11px/1.2 var(--f-sans)", color:"var(--c-muted)", marginTop:2}}>{m.note}</span>
                  </div>
                  <span className="mono" style={{font:"500 12px/1 var(--f-mono)", color:"var(--c-ink-2)"}}>{m.d}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn--brand btn--lg" style={{width:"100%"}}>
            <Icon name="bell" size={15}/> Escalate to rapid response
          </button>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { VitalsMonitor });
