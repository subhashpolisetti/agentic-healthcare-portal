/* Auth screen — Sign In / Sign Up */

const AuthScreen = ({ mode = "signin" }) => {
  const isSignUp = mode === "signup";
  return (
    <div className="frame app row" style={{height:"100%"}}>
      {/* ── LEFT: editorial panel ─────────────────────── */}
      <div style={{
        width:"46%", height:"100%", position:"relative",
        background:"linear-gradient(180deg, oklch(0.30 0.05 180) 0%, oklch(0.22 0.04 180) 100%)",
        color:"#fff", padding:48, display:"flex", flexDirection:"column",
        overflow:"hidden",
      }}>
        {/* subtle grid */}
        <svg style={{position:"absolute", inset:0, opacity:.10, pointerEvents:"none"}} aria-hidden="true">
          <defs>
            <pattern id="g" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M0 36V0M36 0H0" stroke="currentColor" strokeWidth=".5" fill="none"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#g)"/>
        </svg>
        {/* radial accent */}
        <div style={{position:"absolute", right:-160, top:-160, width:480, height:480,
          background:"radial-gradient(circle, oklch(0.58 0.16 295 / .35), transparent 70%)",
          pointerEvents:"none"}}/>

        <div className="row gap-3" style={{position:"relative"}}>
          <div style={{width:38, height:38, borderRadius:11,
            background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.18)",
            display:"grid", placeItems:"center"}}>
            <Logo size={22}/>
          </div>
          <div className="col">
            <span style={{font:"600 16px/1 var(--f-sans)", letterSpacing:"-.01em"}}>AI HealthCare Portal</span>
            <span className="mono" style={{font:"500 10px/1.2 var(--f-mono)", opacity:.7, letterSpacing:".10em", marginTop:3}}>
              ✦ POWERED BY AI AGENTS
            </span>
          </div>
        </div>

        {/* hero */}
        <div style={{marginTop:"auto", marginBottom:32, position:"relative"}}>
          <span className="kicker" style={{color:"oklch(0.85 0.05 295)", opacity:.9}}>2025 · Spring release</span>
          <h1 className="serif" style={{font:"500 56px/1.05 var(--f-serif)", margin:"14px 0 18px",
            letterSpacing:"-0.02em", maxWidth:480}}>
            Care that<br/>thinks ahead of<br/><em style={{color:"oklch(0.85 0.08 295)", fontStyle:"italic"}}>the moment.</em>
          </h1>
          <p style={{font:"400 15px/1.6 var(--f-sans)", maxWidth:440, color:"rgba(255,255,255,.78)"}}>
            Six specialised AI agents work silently in the background — routing patients,
            drafting clinical notes, watching vitals — so clinicians can spend their
            attention where it matters most.
          </p>
        </div>

        {/* live agents card */}
        <div style={{
          position:"relative",
          background:"rgba(255,255,255,.07)",
          border:"1px solid rgba(255,255,255,.14)",
          borderRadius:14, padding:"16px 18px",
          display:"flex", alignItems:"center", gap:18,
        }}>
          <div className="col gap-1">
            <span className="mono" style={{font:"500 10px/1 var(--f-mono)", opacity:.6, letterSpacing:".10em"}}>LIVE · 6 AGENTS</span>
            <span className="tab-num" style={{font:"500 20px/1 var(--f-serif)", marginTop:2}}>2,418 <span style={{opacity:.5, fontSize:13}}> tasks/hr</span></span>
          </div>
          <div style={{flex:1}}>
            <svg viewBox="0 0 200 36" preserveAspectRatio="none" style={{width:"100%", height:36}}>
              <path d="M0 22 L20 22 L26 8 L34 30 L42 14 L50 22 L75 22 L82 6 L88 28 L96 18 L110 22 L130 22 L138 4 L146 32 L154 18 L170 22 L200 22"
                fill="none" stroke="oklch(0.88 0.10 295)" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="190" cy="22" r="2.4" fill="oklch(0.88 0.10 295)"/>
            </svg>
          </div>
          <div className="row gap-2">
            {[1,2,3,4,5,6].map(i => (
              <span key={i} style={{width:6, height:6, borderRadius:"50%",
                background: i<=5 ? "oklch(0.82 0.13 155)" : "rgba(255,255,255,.25)",
                boxShadow: i<=5 ? "0 0 0 3px oklch(0.82 0.13 155 / .15)" : "none"}}/>
            ))}
          </div>
        </div>

        <div style={{marginTop:24, fontSize:12, color:"rgba(255,255,255,.55)",
          display:"flex", justifyContent:"space-between"}}>
          <span>HIPAA-aligned · SOC2 Type II</span>
          <span className="mono">v 4.12.2</span>
        </div>
      </div>

      {/* ── RIGHT: auth card ─────────────────────────── */}
      <div style={{flex:1, height:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:32, background:"var(--c-bg)"}}>
        <div style={{width:420, maxWidth:"100%"}}>
          {/* toggle */}
          <div style={{
            display:"inline-flex", padding:4, gap:4,
            background:"var(--c-surface)", border:"1px solid var(--c-border)",
            borderRadius:999, marginBottom:32,
          }}>
            <button style={{
              padding:"8px 18px", borderRadius:999, border:"none", cursor:"pointer",
              font:"500 13px/1 var(--f-sans)",
              background: !isSignUp ? "var(--c-card)" : "transparent",
              color: !isSignUp ? "var(--c-ink)" : "var(--c-muted)",
              boxShadow: !isSignUp ? "var(--sh-1)" : "none",
            }}>Sign in</button>
            <button style={{
              padding:"8px 18px", borderRadius:999, border:"none", cursor:"pointer",
              font:"500 13px/1 var(--f-sans)",
              background: isSignUp ? "var(--c-card)" : "transparent",
              color: isSignUp ? "var(--c-ink)" : "var(--c-muted)",
              boxShadow: isSignUp ? "var(--sh-1)" : "none",
            }}>Create account</button>
          </div>

          <h2 style={{font:"600 28px/1.15 var(--f-sans)", letterSpacing:"-.02em", margin:"0 0 8px"}}>
            {isSignUp ? "Create your account" : "Welcome back."}
          </h2>
          <p style={{font:"400 14px/1.5 var(--f-sans)", color:"var(--c-muted)", margin:"0 0 28px"}}>
            {isSignUp
              ? "Patients and clinicians, one portal — pick your role to get started."
              : "Sign in to your portal. Your agents are waiting."}
          </p>

          <div className="col gap-4">
            {isSignUp && (
              <div>
                <label className="label">Full Name</label>
                <input className="input" defaultValue="Dr. Aisha Rahman"/>
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input className="input" defaultValue={isSignUp ? "" : "aisha.rahman@uhc.org"} placeholder="you@hospital.org"/>
            </div>
            <div>
              <label className="label">Password</label>
              <div style={{position:"relative"}}>
                <input className="input" type="password" defaultValue="••••••••••••" style={{paddingRight:44}}/>
                <button style={{position:"absolute", right:6, top:6, height:32, width:32,
                  display:"grid", placeItems:"center", border:"none", borderRadius:8,
                  background:"transparent", color:"var(--c-muted)", cursor:"pointer"}}>
                  <Icon name="eye" size={16}/>
                </button>
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="label">I am a…</label>
                <div className="row gap-3">
                  {[
                    {key:"patient", label:"Patient", desc:"Book care", icon:"user", active:false},
                    {key:"doctor",  label:"Clinician", desc:"Manage patients", icon:"stetho", active:true},
                  ].map(r=>(
                    <div key={r.key} style={{
                      flex:1, padding:"14px 14px",
                      borderRadius:12, cursor:"pointer",
                      border:`1.5px solid ${r.active ? "var(--c-primary)" : "var(--c-border-2)"}`,
                      background: r.active ? "var(--c-primary-soft)" : "var(--c-card)",
                      position:"relative",
                    }}>
                      <div className="row gap-2" style={{marginBottom:6}}>
                        <Icon name={r.icon} size={18} color={r.active ? "var(--c-primary)" : "var(--c-muted)"}/>
                        <span style={{font:"600 14px/1 var(--f-sans)",
                          color: r.active ? "var(--c-primary-ink)" : "var(--c-ink)"}}>{r.label}</span>
                        {r.active && (
                          <span style={{marginLeft:"auto", width:18, height:18, borderRadius:"50%",
                            background:"var(--c-primary)", display:"grid", placeItems:"center"}}>
                            <Icon name="check" size={12} color="#fff" stroke={2.4}/>
                          </span>
                        )}
                      </div>
                      <div style={{font:"400 12px/1.3 var(--f-sans)",
                        color: r.active ? "var(--c-primary-ink)" : "var(--c-muted)"}}>{r.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isSignUp && (
              <div className="row" style={{justifyContent:"space-between", marginTop:-4}}>
                <label className="row gap-2" style={{cursor:"pointer", font:"400 13px/1 var(--f-sans)", color:"var(--c-ink-2)"}}>
                  <span style={{width:16, height:16, borderRadius:4,
                    border:"1.5px solid var(--c-primary)", background:"var(--c-primary)",
                    display:"grid", placeItems:"center"}}>
                    <Icon name="check" size={11} color="#fff" stroke={2.5}/>
                  </span>
                  Remember me for 30 days
                </label>
                <a style={{font:"500 13px/1 var(--f-sans)", color:"var(--c-primary)", cursor:"pointer", textDecoration:"none"}}>
                  Forgot password?
                </a>
              </div>
            )}

            <button className="btn btn--brand btn--lg" style={{marginTop:8, width:"100%"}}>
              {isSignUp ? "Create account" : "Sign in"}
              <Icon name="arrow_right" size={16} stroke={2}/>
            </button>

            <div className="row gap-3" style={{margin:"4px 0"}}>
              <div className="grow divider-h"/>
              <span style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-faint)", letterSpacing:".10em"}}>OR</span>
              <div className="grow divider-h"/>
            </div>

            <button className="btn btn--soft btn--lg" style={{width:"100%"}}>
              <span style={{width:18, height:18, borderRadius:"50%",
                background:"conic-gradient(from 0deg, #e74c3c 0 25%, #f1c40f 25% 50%, #27ae60 50% 75%, #2980b9 75%)"}}/>
              Continue with hospital SSO
            </button>

            <p style={{font:"400 12px/1.5 var(--f-sans)", color:"var(--c-muted)", marginTop:8, textAlign:"center"}}>
              By continuing you agree to our <a style={{color:"var(--c-ink)"}}>Terms</a> & <a style={{color:"var(--c-ink)"}}>Privacy Notice</a>.
              <br/>HIPAA compliant. Your data never trains a foundation model.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { AuthScreen });
