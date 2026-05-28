/* Design tokens reference card */

const TokensCard = () => {
  const colors = [
    { name:"primary",      v:"oklch(0.40 0.06 180)",   role:"Brand · CTAs"      },
    { name:"primary-soft", v:"oklch(0.94 0.02 180)",   role:"Tinted surfaces"   },
    { name:"ai",           v:"oklch(0.58 0.16 295)",   role:"AI-generated content" },
    { name:"ai-soft",      v:"oklch(0.96 0.02 295)",   role:"Agent banners"     },
    { name:"ink",          v:"oklch(0.20 0.012 240)",  role:"Headings / body"   },
    { name:"muted",        v:"oklch(0.55 0.012 240)",  role:"Captions"          },
    { name:"bg",           v:"oklch(0.985 0.005 85)",  role:"Page background"   },
    { name:"card",         v:"#FFFFFF",                role:"Card surface"      },
    { name:"border",       v:"oklch(0.91 0.008 85)",   role:"Dividers"          },
    { name:"success",      v:"oklch(0.58 0.12 155)",   role:"Discharge, OK"     },
    { name:"warn",         v:"oklch(0.72 0.14 75)",    role:"Admitted, caution" },
    { name:"danger",       v:"oklch(0.58 0.18 25)",    role:"No-show, critical" },
  ];

  return (
    <div className="frame app" style={{height:"100%", overflow:"hidden"}}>
      <div style={{padding:"40px 48px", height:"100%", overflow:"hidden"}}>
        {/* header */}
        <div className="row gap-3" style={{marginBottom:6}}>
          <div style={{width:34, height:34, borderRadius:10,
            background:"linear-gradient(135deg, var(--c-primary), var(--c-primary-2))",
            color:"#fff", display:"grid", placeItems:"center"}}>
            <Logo size={20}/>
          </div>
          <div className="col">
            <span style={{font:"600 16px/1 var(--f-sans)"}}>AI HealthCare Portal — Design Tokens</span>
            <span className="mono" style={{font:"500 10px/1.2 var(--f-mono)", color:"var(--c-muted)", marginTop:3, letterSpacing:".08em"}}>
              v 1.0 · drop-in CSS variables for React
            </span>
          </div>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:32, marginTop:24, height:"calc(100% - 80px)"}}>
          <div className="col gap-7" style={{overflow:"hidden"}}>
            {/* Colors */}
            <div>
              <span className="kicker">Color · 12 tokens</span>
              <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10, marginTop:12}}>
                {colors.map(c=>(
                  <div key={c.name} className="card" style={{padding:"10px 12px", display:"flex", gap:10, alignItems:"center"}}>
                    <span style={{width:36, height:36, borderRadius:8, background:c.v, border:"1px solid var(--c-border)", flexShrink:0}}/>
                    <div className="col" style={{minWidth:0, flex:1}}>
                      <span className="mono" style={{
                        font:"500 10.5px/1.15 var(--f-mono)", color:"var(--c-ink)",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block",
                      }}>--c-{c.name}</span>
                      <span style={{
                        font:"400 10.5px/1.25 var(--f-sans)", color:"var(--c-muted)", marginTop:3,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block",
                      }}>{c.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Type */}
            <div>
              <span className="kicker">Type · 7 styles</span>
              <div className="card" style={{padding:"18px 20px", marginTop:12}}>
                <div style={{font:"500 56px/1.02 var(--f-serif)", letterSpacing:"-.02em"}}>Care that thinks ahead.</div>
                <div className="mono" style={{font:"500 10px/1 var(--f-mono)", color:"var(--c-muted)", marginTop:6}}>--t-display · Instrument Serif 56/1.02 · −2% tracking</div>
                <div style={{height:1, background:"var(--c-hairline)", margin:"18px 0"}}/>
                <div className="col gap-3">
                  {[
                    {t:"600 32px/1.12 var(--f-sans)", n:"--t-h1",     s:"H1 · Page title"},
                    {t:"600 22px/1.20 var(--f-sans)", n:"--t-h2",     s:"H2 · Section"},
                    {t:"600 17px/1.30 var(--f-sans)", n:"--t-h3",     s:"H3 · Card title"},
                    {t:"400 14px/1.50 var(--f-sans)", n:"--t-body",   s:"Body — for prose, descriptions, AI-generated text in clinical contexts."},
                    {t:"500 11px/1.20 var(--f-mono)", n:"--t-caption",s:"CAPTION · AGENT LABEL · MONOSPACE"},
                  ].map(x=>(
                    <div key={x.n} className="row" style={{justifyContent:"space-between", gap:24}}>
                      <span style={{font:x.t, color:"var(--c-ink)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{x.s}</span>
                      <span className="mono" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)", flexShrink:0}}>{x.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col gap-7" style={{overflow:"hidden"}}>
            {/* Spacing */}
            <div>
              <span className="kicker">Spacing · 4 px base</span>
              <div className="card" style={{padding:"14px 18px", marginTop:12}}>
                <div className="col gap-2">
                  {[
                    ["--s-1",4],["--s-2",8],["--s-3",12],["--s-4",16],["--s-5",20],
                    ["--s-6",24],["--s-7",32],["--s-8",40],["--s-9",56],["--s-10",80],
                  ].map(([n,v])=>(
                    <div key={n} className="row gap-3" style={{alignItems:"center"}}>
                      <span className="mono" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)", width:46}}>{n}</span>
                      <div style={{height:8, background:"var(--c-primary)", width:v, borderRadius:2}}/>
                      <span className="mono tab-num" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-ink)", marginLeft:"auto"}}>{v}px</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Radius + shadow */}
            <div>
              <span className="kicker">Radius · Shadow</span>
              <div className="card" style={{padding:"14px 18px", marginTop:12}}>
                <div className="col gap-3">
                  {[
                    {n:"--r-1", v:6,  l:"6 px"},
                    {n:"--r-2", v:10, l:"10 px · controls"},
                    {n:"--r-3", v:14, l:"14 px · cards"},
                    {n:"--r-4", v:20, l:"20 px · modals"},
                    {n:"--r-pill", v:999, l:"pill"},
                  ].map(x=>(
                    <div key={x.n} className="row gap-3" style={{alignItems:"center"}}>
                      <div style={{width:46, height:30, borderRadius:Math.min(x.v,14),
                        background:"var(--c-primary-soft)", border:"1px solid oklch(0.86 0.04 180)"}}/>
                      <span className="mono" style={{font:"500 11px/1 var(--f-mono)", color:"var(--c-muted)"}}>{x.n}</span>
                      <span style={{font:"400 12px/1 var(--f-sans)", color:"var(--c-ink-2)", marginLeft:"auto"}}>{x.l}</span>
                    </div>
                  ))}
                </div>
                <div style={{height:1, background:"var(--c-hairline)", margin:"14px 0"}}/>
                <div className="row gap-3" style={{alignItems:"center"}}>
                  {[
                    {n:"--sh-1", b:"var(--sh-1)"},
                    {n:"--sh-2", b:"var(--sh-2)"},
                    {n:"--sh-3", b:"var(--sh-3)"},
                  ].map((s,i)=>(
                    <div key={s.n} className="col gap-1" style={{flex:1, alignItems:"center"}}>
                      <div style={{width:50, height:34, borderRadius:8, background:"#fff", boxShadow:s.b, marginBottom:6}}/>
                      <span className="mono" style={{font:"500 10px/1 var(--f-mono)", color:"var(--c-muted)"}}>{s.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Components row */}
            <div>
              <span className="kicker">Components</span>
              <div className="card" style={{padding:"14px 18px", marginTop:12}}>
                <div className="row gap-2" style={{flexWrap:"wrap", marginBottom:12}}>
                  <button className="btn btn--brand btn--sm">Primary</button>
                  <button className="btn btn--ghost btn--sm">Ghost</button>
                  <button className="btn btn--ai btn--sm"><Icon name="sparkle" size={11}/> AI</button>
                  <button className="btn btn--primary btn--sm">Ink</button>
                </div>
                <div className="row gap-2" style={{flexWrap:"wrap"}}>
                  <span className="chip chip--primary">primary</span>
                  <span className="chip chip--ai">ai</span>
                  <span className="chip chip--success">success</span>
                  <span className="chip chip--warn">warn</span>
                  <span className="chip chip--danger">danger</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { TokensCard });
