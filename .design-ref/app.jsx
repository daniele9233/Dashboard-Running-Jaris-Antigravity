// ============================================================
//  METIC LAB — Glassmorphism running dashboard
// ============================================================

const { useState, useEffect, useRef, useMemo } = React;

// ---------- helpers ----------
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;

// ============================================================
//  BACKGROUND — stylized GPS map
// ============================================================
function MapBackground(){
  const [variant, setVariant] = useState(window.__bg || 'map');
  useEffect(()=>{
    const h = ()=> setVariant(window.__bg);
    window.addEventListener('bgchange', h);
    return ()=> window.removeEventListener('bgchange', h);
  },[]);

  if(variant === 'aurora') return <AuroraBg />;
  if(variant === 'mesh') return <MeshBg />;
  return <GpsMapBg />;
}

function GpsMapBg(){
  return (
    <div style={{position:'fixed', inset:0, zIndex:0, overflow:'hidden',
      background:'linear-gradient(160deg, #F5ECE1 0%, #F0E6DA 30%, #E8DFF2 70%, #D8E4F2 100%)'}}>
      {/* soft color blobs */}
      <div style={{position:'absolute', top:'-10%', left:'55%', width:700, height:700, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(255,192,203,0.55), rgba(255,192,203,0) 70%)', filter:'blur(40px)'}} />
      <div style={{position:'absolute', top:'30%', left:'-10%', width:600, height:600, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(183,201,255,0.6), rgba(183,201,255,0) 70%)', filter:'blur(40px)'}} />
      <div style={{position:'absolute', bottom:'-15%', right:'-5%', width:700, height:700, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(196,232,210,0.55), rgba(196,232,210,0) 70%)', filter:'blur(50px)'}} />

      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"
           style={{position:'absolute', inset:0, width:'100%', height:'100%'}}>
        <defs>
          <pattern id="gridBg" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(26,27,46,0.04)" strokeWidth="1"/>
          </pattern>
          <linearGradient id="route" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#FF5C7A" />
            <stop offset="50%" stopColor="#C45CFF" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <filter id="routeGlow"><feGaussianBlur stdDeviation="4"/></filter>
        </defs>
        <rect width="1440" height="900" fill="url(#gridBg)"/>

        {/* water bodies */}
        <path d="M -50 620 Q 200 580 380 640 T 780 620 Q 900 600 1050 640 L 1500 700 L 1500 950 L -50 950 Z"
              fill="rgba(165,199,229,0.35)" />
        <path d="M 1100 80 Q 1250 140 1300 260 Q 1360 380 1500 360 L 1500 0 L 1100 0 Z"
              fill="rgba(165,199,229,0.28)" />

        {/* parks (green blobs) */}
        <ellipse cx="260" cy="280" rx="180" ry="110" fill="rgba(176,213,170,0.42)" />
        <ellipse cx="1180" cy="520" rx="150" ry="95" fill="rgba(176,213,170,0.38)" />
        <ellipse cx="700" cy="180" rx="120" ry="70" fill="rgba(176,213,170,0.30)" />

        {/* secondary streets */}
        <g stroke="rgba(26,27,46,0.10)" strokeWidth="1" fill="none">
          <path d="M 0 200 Q 400 180 800 240 T 1440 260" />
          <path d="M 0 380 Q 500 360 900 420 T 1440 440" />
          <path d="M 0 560 Q 400 540 800 600 T 1440 620" />
          <path d="M 0 780 Q 500 760 900 820 T 1440 840" />
          <path d="M 180 0 Q 200 300 140 600 T 120 900" />
          <path d="M 420 0 Q 440 300 380 600 T 360 900" />
          <path d="M 680 0 Q 700 300 640 600 T 620 900" />
          <path d="M 940 0 Q 960 300 900 600 T 880 900" />
          <path d="M 1200 0 Q 1220 300 1160 600 T 1140 900" />
        </g>

        {/* main arteries */}
        <g stroke="rgba(26,27,46,0.18)" strokeWidth="2" fill="none">
          <path d="M 0 460 Q 500 440 900 500 T 1440 520" />
          <path d="M 540 0 Q 560 300 500 600 T 480 900" />
        </g>

        {/* running route — fat colored glowing line */}
        <g>
          <path d="M 120 720 Q 260 680 360 600 Q 460 520 580 560 Q 720 610 820 540 Q 920 470 1020 480 Q 1140 492 1220 400 Q 1290 320 1260 220 Q 1230 140 1130 140"
                fill="none" stroke="url(#route)" strokeWidth="18" strokeLinecap="round" opacity="0.22" filter="url(#routeGlow)"/>
          <path d="M 120 720 Q 260 680 360 600 Q 460 520 580 560 Q 720 610 820 540 Q 920 470 1020 480 Q 1140 492 1220 400 Q 1290 320 1260 220 Q 1230 140 1130 140"
                fill="none" stroke="url(#route)" strokeWidth="6" strokeLinecap="round" opacity="0.95"/>
          {/* km markers */}
          {[
            {x:120,y:720,k:0},{x:360,y:600,k:2},{x:580,y:560,k:4},
            {x:820,y:540,k:6},{x:1020,y:480,k:8},{x:1220,y:400,k:10},{x:1130,y:140,k:12.4}
          ].map((p,i)=>(
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="7" fill="white" stroke="#1A1B2E" strokeWidth="1.5"/>
              <text x={p.x+12} y={p.y+4} fontSize="10" fontWeight="700" fill="#1A1B2E" style={{fontFamily:'JetBrains Mono'}}>{p.k}K</text>
            </g>
          ))}
          {/* current position */}
          <circle cx="1260" cy="220" r="12" fill="#FF5C7A" opacity="0.35">
            <animate attributeName="r" values="12;22;12" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.45;0;0.45" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="1260" cy="220" r="7" fill="#FF5C7A" stroke="white" strokeWidth="2.5"/>
        </g>
      </svg>
    </div>
  );
}

function AuroraBg(){
  return (
    <div style={{position:'fixed', inset:0, zIndex:0, overflow:'hidden',
      background:'linear-gradient(160deg, #FFF5EC 0%, #F0E8FC 50%, #E0EEFA 100%)'}}>
      <div style={{position:'absolute', top:'-20%', left:'-10%', width:900, height:900, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(255,110,150,0.45), transparent 65%)', filter:'blur(60px)'}} />
      <div style={{position:'absolute', top:'10%', right:'-15%', width:900, height:900, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(99,102,241,0.45), transparent 65%)', filter:'blur(60px)'}} />
      <div style={{position:'absolute', bottom:'-25%', left:'20%', width:1000, height:1000, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(52,211,153,0.38), transparent 65%)', filter:'blur(70px)'}} />
      <div style={{position:'absolute', top:'40%', left:'40%', width:500, height:500, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(251,191,36,0.35), transparent 65%)', filter:'blur(50px)'}} />
    </div>
  );
}

function MeshBg(){
  return (
    <div style={{position:'fixed', inset:0, zIndex:0, overflow:'hidden',
      background:'radial-gradient(at 20% 20%, #FFD6E0, transparent 40%), radial-gradient(at 80% 10%, #D6E4FF, transparent 40%), radial-gradient(at 50% 80%, #D6FFE4, transparent 40%), linear-gradient(#F8F2EC, #EEF0FA)'}}>
    </div>
  );
}

// ============================================================
//  TOP BAR
// ============================================================
function TopBar(){
  return (
    <div className="glass glass-strong" style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'14px 22px', borderRadius:20, marginBottom:24
    }}>
      <div style={{display:'flex', alignItems:'center', gap:28}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:32, height:32, borderRadius:10, background:'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontStyle:'italic', fontSize:14, letterSpacing:'-0.04em',
            boxShadow:'0 6px 16px -4px rgba(255,92,122,0.55), inset 0 1px 0 rgba(255,255,255,0.4)'}}>M</div>
          <div>
            <div style={{fontFamily:'Outfit', fontWeight:900, fontStyle:'italic', fontSize:16, letterSpacing:'-0.03em', lineHeight:1}}>METIC LAB</div>
            <div className="eyebrow-sm" style={{marginTop:2}}>Elite Performance</div>
          </div>
        </div>
        <nav style={{display:'flex', gap:4}}>
          {['Dashboard','Activities','Training','Runner DNA'].map((x,i)=>(
            <button key={x} className="btn" style={{
              background: i===0 ? 'rgba(26,27,46,0.92)' : 'transparent',
              color: i===0 ? 'white' : 'var(--ink-2)',
              border: i===0 ? '1px solid rgba(26,27,46,0.92)' : '1px solid transparent',
              boxShadow: i===0 ? '0 6px 16px -6px rgba(26,27,46,0.4)' : 'none',
              letterSpacing:'0.12em'
            }}>{x}</button>
          ))}
        </nav>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:10}}>
        <div className="chip"><span className="dot pulse"/> Live · Strava</div>
        <button className="btn" aria-label="search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          Search
        </button>
        <div style={{width:38, height:38, borderRadius:14, overflow:'hidden', border:'2px solid rgba(255,255,255,0.8)',
          background:'linear-gradient(135deg,#FFB5C5,#A5B4FC)', display:'flex', alignItems:'center', justifyContent:'center',
          color:'white', fontWeight:800, fontSize:13}}>DR</div>
      </div>
    </div>
  );
}

// ============================================================
//  HERO — run title + quick stats floating over map
// ============================================================
function HeroBlock(){
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 340px 340px', gap:24, marginBottom:24}}>
      {/* Main run summary */}
      <div className="glass glass-soft lift" style={{padding:'28px 30px', borderRadius:28, minHeight:240}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div className="chip" style={{marginBottom:14}}>
              <span className="dot"/> Morning Run · Today 07:42
            </div>
            <h1 style={{
              fontFamily:'Outfit', fontWeight:900, fontStyle:'italic', fontSize:48, letterSpacing:'-0.03em',
              lineHeight:0.95, margin:0
            }}>Tempo run<br/>through Parco Nord</h1>
            <div style={{marginTop:10, color:'var(--ink-3)', fontSize:13, maxWidth:520}}>
              12.4 km at steady threshold. Cardiac drift kept under 3% — form is trending toward peak. 
            </div>
          </div>
          <button className="btn-primary btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Replay run
          </button>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:18, marginTop:26}}>
          <HeroStat label="Distance" value="12.4" unit="km" />
          <HeroStat label="Pace avg" value="4:18" unit="/km" />
          <HeroStat label="Moving time" value="53:23" unit="min" />
          <HeroStat label="Elev gain" value="142" unit="m" />
        </div>
      </div>

      {/* Status of form */}
      <StatusOfForm />

      {/* Next optimal session */}
      <NextSession />
    </div>
  );
}
function HeroStat({label,value,unit}){
  return (
    <div>
      <div className="eyebrow-sm" style={{marginBottom:6}}>{label}</div>
      <div style={{display:'flex', alignItems:'baseline', gap:5}}>
        <div className="hero-num mono" style={{fontSize:32}}>{value}</div>
        <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:600}}>{unit}</div>
      </div>
    </div>
  );
}

function StatusOfForm(){
  // TSB gauge
  const tsb = +8.4;
  const pct = (tsb + 30) / 60; // map -30..30 to 0..1
  const angle = -120 + pct*240;
  return (
    <div className="glass lift" style={{padding:'22px 24px', borderRadius:28, display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div className="eyebrow">Status of form</div>
        <div className="chip" style={{background:'rgba(16,185,129,0.18)', borderColor:'rgba(16,185,129,0.4)', color:'#047857'}}>
          <span className="dot" style={{background:'#10B981', boxShadow:'0 0 0 4px rgba(16,185,129,0.2)'}}/>
          Fresh
        </div>
      </div>
      {/* gauge */}
      <div style={{position:'relative', width:'100%', aspectRatio:'2/1', marginTop:6}}>
        <svg viewBox="0 0 200 110" width="100%" height="100%">
          <defs>
            <linearGradient id="gaugeGrad" x1="0" x2="1">
              <stop offset="0%" stopColor="#F43F5E"/>
              <stop offset="50%" stopColor="#FBBF24"/>
              <stop offset="100%" stopColor="#10B981"/>
            </linearGradient>
          </defs>
          {/* track */}
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(26,27,46,0.08)" strokeWidth="14" strokeLinecap="round"/>
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="14" strokeLinecap="round" opacity="0.85"/>
          {/* needle */}
          <g transform={`rotate(${angle} 100 100)`}>
            <line x1="100" y1="100" x2="100" y2="30" stroke="#1A1B2E" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="100" cy="100" r="6" fill="#1A1B2E"/>
            <circle cx="100" cy="100" r="2" fill="#fff"/>
          </g>
        </svg>
        <div style={{position:'absolute', bottom:0, left:0, right:0, textAlign:'center'}}>
          <div className="mono hero-num" style={{fontSize:34}}>+{tsb.toFixed(1)}</div>
          <div className="eyebrow-sm" style={{marginTop:2}}>TSB · CTL−ATL</div>
        </div>
      </div>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--ink-4)', fontWeight:700, letterSpacing:'0.1em'}}>
        <span>OVERLOAD</span><span>NEUTRAL</span><span>PEAK</span>
      </div>
    </div>
  );
}

function NextSession(){
  return (
    <div className="glass lift" style={{padding:'22px 24px', borderRadius:28, display:'flex', flexDirection:'column', gap:14, position:'relative', overflow:'hidden'}}>
      <div style={{position:'absolute', right:-40, top:-40, width:180, height:180, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(99,102,241,0.35), transparent 70%)', filter:'blur(24px)', zIndex:0}}/>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div className="eyebrow">Next optimal session</div>
        <div className="chip" style={{background:'rgba(99,102,241,0.18)', borderColor:'rgba(99,102,241,0.4)', color:'#4338CA'}}>VO₂ · T+36h</div>
      </div>
      <div>
        <div style={{fontFamily:'Outfit', fontWeight:900, fontStyle:'italic', fontSize:28, letterSpacing:'-0.02em', lineHeight:1}}>6×1000m<br/>@ VO₂ pace</div>
        <div style={{fontSize:12, color:'var(--ink-3)', marginTop:8, lineHeight:1.5}}>
          Target 3:42/km · 3' recovery jog. Readiness window opens <span className="mono" style={{color:'var(--ink)'}}>Mon 21 Apr · 08:00</span>.
        </div>
      </div>
      <div style={{display:'flex', gap:6, marginTop:'auto'}}>
        <Bar color="#10B981" flex={1.2} label="Easy" />
        <Bar color="#6366F1" flex={0.5} label="Vo2" active />
        <Bar color="#F59E0B" flex={0.3} label="Thr" />
        <Bar color="#A5B4FC" flex={0.8} label="Long" />
      </div>
    </div>
  );
}
function Bar({color, flex, label, active}){
  return (
    <div style={{flex, display:'flex', flexDirection:'column', gap:4}}>
      <div style={{height:6, borderRadius:99, background:color, opacity: active?1:0.45}}/>
      <div className="eyebrow-sm" style={{color: active?'var(--ink)':'var(--ink-4)'}}>{label}</div>
    </div>
  );
}

// ============================================================
//  MAIN CHART — interactive pace/HR/elevation
// ============================================================
function PaceChart(){
  const [mode, setMode] = useState('pace');
  const [hoverIdx, setHoverIdx] = useState(null);
  const wrapRef = useRef(null);

  // 12.4km data - one point every 200m = 62 samples
  const data = useMemo(()=>{
    const pts = [];
    for(let i=0;i<=62;i++){
      const km = i*0.2;
      // pace oscillates with a tempo feel + drift
      const base = 258 + 8*Math.sin(km*0.9) - 2*km + 6*Math.sin(km*2.2);
      const pace = base + (km>6 && km<8 ? 14 : 0); // hill
      const hr = 152 + 12*Math.sin(km*0.6) + (km>6 && km<8 ? 10 : 0) + km*0.6;
      const elev = 30 + 50*Math.sin(km*0.5) + 30*Math.sin(km*0.2) + (km>6&&km<8?40:0);
      pts.push({km, pace, hr, elev});
    }
    return pts;
  },[]);

  const W=820, H=280;
  const pad = {l:40, r:20, t:30, b:30};
  const iw = W-pad.l-pad.r, ih = H-pad.t-pad.b;

  const series = {
    pace: { key:'pace', min:240, max:320, color:'var(--accent)', color2:'var(--accent-2)',
      fmt:(v)=> `${Math.floor(v/60)}:${String(Math.round(v%60)).padStart(2,'0')}/km` },
    hr:   { key:'hr',   min:130, max:185, color:'#F43F5E', color2:'#FB923C',
      fmt:(v)=> `${Math.round(v)} bpm` },
    elev: { key:'elev', min:0,   max:180, color:'#10B981', color2:'#06B6D4',
      fmt:(v)=> `${Math.round(v)} m` }
  };
  const s = series[mode];

  const xAt = i => pad.l + (i/(data.length-1))*iw;
  const yAt = v => pad.t + ih - ((v-s.min)/(s.max-s.min))*ih;

  const linePath = data.map((d,i)=>`${i===0?'M':'L'} ${xAt(i).toFixed(1)} ${yAt(d[s.key]).toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L ${xAt(data.length-1).toFixed(1)} ${pad.t+ih} L ${xAt(0)} ${pad.t+ih} Z`;

  function onMove(e){
    const rect = wrapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W/rect.width);
    if(x < pad.l || x > pad.l+iw){ setHoverIdx(null); return; }
    const i = Math.round(((x-pad.l)/iw) * (data.length-1));
    setHoverIdx(clamp(i,0,data.length-1));
  }

  const hov = hoverIdx!=null ? data[hoverIdx] : null;

  return (
    <div className="glass lift" style={{padding:'24px 26px', borderRadius:28, gridColumn:'span 7'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <div>
          <div className="eyebrow" style={{marginBottom:4}}>Performance arc</div>
          <div style={{fontFamily:'Outfit', fontWeight:900, fontStyle:'italic', fontSize:24, letterSpacing:'-0.02em'}}>
            {mode==='pace'?'Pace':mode==='hr'?'Heart rate':'Elevation'} · 12.4 km
          </div>
        </div>
        <div className="tabs">
          <button className={mode==='pace'?'active':''} onClick={()=>setMode('pace')}>Pace</button>
          <button className={mode==='hr'?'active':''} onClick={()=>setMode('hr')}>HR</button>
          <button className={mode==='elev'?'active':''} onClick={()=>setMode('elev')}>Elev</button>
        </div>
      </div>

      <div ref={wrapRef} style={{position:'relative'}} onMouseMove={onMove} onMouseLeave={()=>setHoverIdx(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:'block'}}>
          <defs>
            <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.35"/>
              <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" x2="1">
              <stop offset="0%" stopColor={s.color}/>
              <stop offset="100%" stopColor={s.color2}/>
            </linearGradient>
          </defs>
          {/* grid */}
          {[0,1,2,3,4].map(i=>{
            const y = pad.t + (ih/4)*i;
            return <line key={i} x1={pad.l} x2={W-pad.r} y1={y} y2={y} stroke="rgba(26,27,46,0.06)" strokeDasharray="2 4"/>;
          })}
          {/* area */}
          <path d={areaPath} fill="url(#areaGrad)"/>
          {/* line */}
          <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>

          {/* x labels */}
          {[0,2,4,6,8,10,12].map(k=>{
            const i = Math.round(k/12.4 * (data.length-1));
            return <text key={k} x={xAt(i)} y={H-8} fontSize="10" fill="var(--ink-4)" textAnchor="middle" fontWeight="600" style={{fontFamily:'JetBrains Mono'}}>{k}K</text>;
          })}
          {/* y labels */}
          {[0,0.5,1].map(t=>{
            const v = s.min + (s.max-s.min)*(1-t);
            const y = pad.t + ih*t;
            const label = mode==='pace' ? `${Math.floor(v/60)}:${String(Math.round(v%60)).padStart(2,'0')}` : Math.round(v);
            return <text key={t} x={pad.l-8} y={y+3} fontSize="10" fill="var(--ink-4)" textAnchor="end" fontWeight="600" style={{fontFamily:'JetBrains Mono'}}>{label}</text>;
          })}

          {/* hover marker */}
          {hov && (
            <g>
              <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={pad.t} y2={pad.t+ih} stroke="var(--ink)" strokeDasharray="2 3" opacity="0.35"/>
              <circle cx={xAt(hoverIdx)} cy={yAt(hov[s.key])} r="9" fill={s.color} opacity="0.22"/>
              <circle cx={xAt(hoverIdx)} cy={yAt(hov[s.key])} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2"/>
            </g>
          )}
        </svg>

        {/* tooltip */}
        {hov && (
          <div className="glass glass-strong" style={{
            position:'absolute',
            left: `${(xAt(hoverIdx)/W)*100}%`,
            top: `${(yAt(hov[s.key])/H)*100}%`,
            transform: `translate(${xAt(hoverIdx) > W*0.7 ? '-110%' : '10%'}, -110%)`,
            padding:'10px 14px', borderRadius:14, pointerEvents:'none',
            minWidth:150
          }}>
            <div className="eyebrow-sm" style={{marginBottom:4}}>km <span className="mono" style={{color:'var(--ink)'}}>{hov.km.toFixed(1)}</span></div>
            <div className="mono" style={{fontWeight:700, fontSize:14}}>{s.fmt(hov[s.key])}</div>
            <div style={{marginTop:6, display:'flex', gap:10, fontSize:10, color:'var(--ink-3)', fontWeight:600}}>
              <span>HR <span className="mono" style={{color:'var(--ink)'}}>{Math.round(hov.hr)}</span></span>
              <span>Elev <span className="mono" style={{color:'var(--ink)'}}>{Math.round(hov.elev)}m</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  HR ZONES — donut with interactive slices
// ============================================================
function HRZones(){
  const zones = [
    {n:'Z1', label:'Recovery', pct:6,  min:'18%', color:'#60A5FA', range:'110-131'},
    {n:'Z2', label:'Endurance',pct:14, min:'28%', color:'#34D399', range:'131-148'},
    {n:'Z3', label:'Tempo',    pct:45, min:'45%', color:'#FBBF24', range:'148-162'},
    {n:'Z4', label:'Threshold',pct:28, min:'28%', color:'#FB923C', range:'162-175'},
    {n:'Z5', label:'VO₂',      pct:7,  min:'7%',  color:'#F43F5E', range:'175-189'},
  ];
  const total = zones.reduce((s,z)=>s+z.pct,0);
  const [active,setActive] = useState(2);

  const R = 88, r = 62;
  const cx=120, cy=120;
  let startAngle = -90;
  const gap = 2;

  return (
    <div className="glass lift" style={{padding:'24px 26px', borderRadius:28, gridColumn:'span 5', display:'flex', gap:20, alignItems:'center'}}>
      <div style={{flex:'0 0 240px', position:'relative'}}>
        <div className="eyebrow" style={{marginBottom:10}}>Heart rate zones</div>
        <svg viewBox="0 0 240 240" width="240" height="240">
          {zones.map((z,i)=>{
            const a1 = startAngle + gap/2;
            const a2 = startAngle + (z.pct/total)*360 - gap/2;
            startAngle += (z.pct/total)*360;
            const large = (a2-a1)>180?1:0;
            const rad = p => (p*Math.PI)/180;
            const isActive = i===active;
            const rr = isActive ? R+6 : R;
            const x1 = cx + rr*Math.cos(rad(a1)), y1 = cy + rr*Math.sin(rad(a1));
            const x2 = cx + rr*Math.cos(rad(a2)), y2 = cy + rr*Math.sin(rad(a2));
            const x3 = cx + r*Math.cos(rad(a2)), y3 = cy + r*Math.sin(rad(a2));
            const x4 = cx + r*Math.cos(rad(a1)), y4 = cy + r*Math.sin(rad(a1));
            const d = `M ${x1} ${y1} A ${rr} ${rr} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`;
            return <path key={i} d={d} fill={z.color} opacity={isActive?1:0.75} style={{cursor:'pointer', transition:'all .3s ease'}} onMouseEnter={()=>setActive(i)}/>;
          })}
          <circle cx={cx} cy={cy} r={r-4} fill="rgba(255,255,255,0.5)" />
          <text x={cx} y={cy-6} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--ink-3)" letterSpacing="2">{zones[active].n} · {zones[active].label.toUpperCase()}</text>
          <text x={cx} y={cy+18} textAnchor="middle" fontSize="28" fontWeight="900" fill="var(--ink)" style={{fontFamily:'JetBrains Mono'}}>{zones[active].pct}%</text>
          <text x={cx} y={cy+34} textAnchor="middle" fontSize="10" fill="var(--ink-4)" style={{fontFamily:'JetBrains Mono'}}>{zones[active].range} bpm</text>
        </svg>
      </div>
      <div style={{flex:1, display:'flex', flexDirection:'column', gap:10}}>
        <div style={{fontFamily:'Outfit', fontWeight:900, fontStyle:'italic', fontSize:22, letterSpacing:'-0.02em', marginBottom:4}}>Distribution</div>
        {zones.map((z,i)=>(
          <div key={z.n} onMouseEnter={()=>setActive(i)} style={{
            display:'flex', alignItems:'center', gap:12, padding:'8px 10px', borderRadius:12,
            background: i===active ? 'rgba(255,255,255,0.55)' : 'transparent',
            border: i===active ? '1px solid rgba(255,255,255,0.8)' : '1px solid transparent',
            cursor:'pointer', transition:'all .2s ease'
          }}>
            <div style={{width:8, height:24, borderRadius:4, background:z.color}}/>
            <div style={{flex:1}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:3}}>
                <div style={{fontSize:11, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase'}}>{z.n} · {z.label}</div>
                <div className="mono" style={{fontSize:12, fontWeight:700}}>{z.pct}%</div>
              </div>
              <div style={{height:4, borderRadius:99, background:'rgba(26,27,46,0.08)', overflow:'hidden'}}>
                <div style={{height:'100%', width:`${(z.pct/45)*100}%`, background:z.color, borderRadius:99, transition:'width .6s ease'}}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
//  SPLITS TABLE
// ============================================================
function Splits(){
  const splits = [
    {km:1, pace:'4:22', hr:146, elev:'+12', best:false},
    {km:2, pace:'4:18', hr:152, elev:'+8',  best:false},
    {km:3, pace:'4:12', hr:158, elev:'-4',  best:true},
    {km:4, pace:'4:15', hr:161, elev:'+18', best:false},
    {km:5, pace:'4:09', hr:164, elev:'-10', best:true},
    {km:6, pace:'4:14', hr:166, elev:'+6',  best:false},
    {km:7, pace:'4:34', hr:172, elev:'+42', best:false},
    {km:8, pace:'4:28', hr:170, elev:'+14', best:false},
    {km:9, pace:'4:19', hr:167, elev:'-22', best:false},
    {km:10,pace:'4:11', hr:169, elev:'-8',  best:false},
    {km:11,pace:'4:14', hr:172, elev:'+4',  best:false},
    {km:12,pace:'4:16', hr:174, elev:'+2',  best:false},
  ];
  const [period, setPeriod] = useState('Run');
  const maxHr = Math.max(...splits.map(s=>s.hr));
  return (
    <div className="glass lift" style={{padding:'24px 26px', borderRadius:28, gridColumn:'span 7'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <div>
          <div className="eyebrow" style={{marginBottom:4}}>Splits · per kilometer</div>
          <div style={{fontFamily:'Outfit', fontWeight:900, fontStyle:'italic', fontSize:22, letterSpacing:'-0.02em'}}>Km breakdown</div>
        </div>
        <div className="tabs">
          {['Run','Week','Month'].map(p=>(
            <button key={p} className={period===p?'active':''} onClick={()=>setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:6}}>
        {splits.map((s,i)=>{
          const intensity = (s.hr - 140) / (maxHr - 140);
          return (
            <div key={s.km} style={{
              padding:'12px 8px', borderRadius:14,
              background: s.best ? 'rgba(255,92,122,0.12)' : 'rgba(255,255,255,0.38)',
              border: s.best ? '1px solid rgba(255,92,122,0.4)' : '1px solid rgba(255,255,255,0.7)',
              position:'relative'
            }}>
              {s.best && <div style={{position:'absolute', top:6, right:8, fontSize:8, fontWeight:800, color:'var(--accent)', letterSpacing:'0.1em'}}>PR</div>}
              <div className="eyebrow-sm" style={{fontSize:9, marginBottom:6}}>K{s.km}</div>
              <div className="mono" style={{fontSize:14, fontWeight:800, lineHeight:1}}>{s.pace}</div>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:4, fontWeight:600}}>{s.hr}bpm</div>
              <div style={{marginTop:8, height:3, borderRadius:2, background:'rgba(26,27,46,0.08)', overflow:'hidden'}}>
                <div style={{height:'100%', width:`${intensity*100}%`, background: s.best?'var(--accent)':'var(--accent-2)', borderRadius:2}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
//  BOTTOM WIDGETS
// ============================================================
function BottomWidgets(){
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:24, marginTop:24}}>
      <KPI label="VO₂ Max" value="54.2" unit="ml/kg" trend="+0.8" />
      <KPI label="VDOT" value="48.4" unit="points" trend="+0.3" />
      <KPI label="CTL · fitness" value="62.1" unit="TSS/d" trend="+1.2" accent />
      <KPI label="Cardiac drift" value="2.8" unit="%" trend="−0.4" />
      <KPI label="ACWR" value="1.12" unit="ratio" trend="ok" />
    </div>
  );
}
function KPI({label, value, unit, trend, accent}){
  const up = trend && trend.startsWith('+');
  const ok = trend==='ok';
  return (
    <div className="glass lift" style={{padding:'20px 22px', borderRadius:24, overflow:'hidden', position:'relative'}}>
      {accent && <div style={{position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg, var(--accent), var(--accent-2))'}}/>}
      <div className="eyebrow" style={{marginBottom:12}}>{label}</div>
      <div style={{display:'flex', alignItems:'baseline', gap:6}}>
        <div className="hero-num mono" style={{fontSize:34}}>{value}</div>
        <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:600}}>{unit}</div>
      </div>
      <div style={{marginTop:14, display:'flex', alignItems:'center', gap:6}}>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:99,
          background: ok ? 'rgba(16,185,129,0.15)' : up ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
          color: ok||up ? '#047857' : '#BE123C',
          fontSize:10, fontWeight:800, letterSpacing:'0.08em'
        }}>
          {ok ? '✓ OPTIMAL' : <><span>{up?'↑':'↓'}</span> <span className="mono">{trend}</span></>}
        </div>
        <div className="eyebrow-sm">7d</div>
      </div>
      {/* mini sparkline */}
      <svg viewBox="0 0 100 26" width="100%" height="26" style={{marginTop:8}}>
        <path d={sparkPath(accent?1:0.2 + Math.random()*0.3)}
              fill="none" stroke={accent?'var(--accent)':'var(--ink-3)'} strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    </div>
  );
}
function sparkPath(seed){
  let pts = [];
  for(let i=0;i<20;i++){
    const y = 14 + Math.sin(i*0.7+seed*10)*5 + Math.cos(i*1.4+seed*3)*3;
    pts.push(`${i===0?'M':'L'} ${i*(100/19)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

// ============================================================
//  WEEKLY VOLUME + WEATHER
// ============================================================
function WeekVolume(){
  const days = [
    {d:'M', km:8.2,  intensity:'easy'},
    {d:'T', km:14.3, intensity:'thr'},
    {d:'W', km:6.5,  intensity:'easy'},
    {d:'T', km:0,    intensity:'rest'},
    {d:'F', km:12.4, intensity:'thr'},
    {d:'S', km:10.1, intensity:'easy'},
    {d:'S', km:22.5, intensity:'long'},
  ];
  const colors = {easy:'#60A5FA', thr:'var(--accent)', long:'#8B5CF6', rest:'#D4D7E8'};
  const max = Math.max(...days.map(d=>d.km));
  const total = days.reduce((s,d)=>s+d.km,0).toFixed(1);
  return (
    <div className="glass lift" style={{padding:'24px 26px', borderRadius:28, gridColumn:'span 3'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div className="eyebrow" style={{marginBottom:4}}>Weekly volume</div>
          <div style={{display:'flex', alignItems:'baseline', gap:6}}>
            <div className="hero-num mono" style={{fontSize:34}}>{total}</div>
            <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:600}}>km · week 16</div>
          </div>
        </div>
        <div className="chip" style={{background:'rgba(16,185,129,0.18)', borderColor:'rgba(16,185,129,0.4)', color:'#047857'}}>+12% vs avg</div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:8, marginTop:22, alignItems:'end', height:110}}>
        {days.map((d,i)=>(
          <div key={i} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%'}}>
            <div style={{flex:1, width:'100%', display:'flex', alignItems:'flex-end'}}>
              <div style={{
                width:'100%',
                height:`${(d.km/max)*100}%`,
                minHeight: d.km>0?8:2,
                background: d.km>0?colors[d.intensity]:'rgba(26,27,46,0.08)',
                borderRadius:8,
                boxShadow: d.km>0?`0 4px 12px -4px ${colors[d.intensity]}aa`:'none'
              }}/>
            </div>
            <div className="eyebrow-sm" style={{fontSize:10}}>{d.d}</div>
            <div className="mono" style={{fontSize:10, color:'var(--ink-3)', fontWeight:700}}>{d.km || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Weather(){
  return (
    <div className="glass lift" style={{padding:'24px 26px', borderRadius:28, gridColumn:'span 2', position:'relative', overflow:'hidden'}}>
      <div style={{position:'absolute', right:-30, top:-30, width:200, height:200, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(251,191,36,0.35), transparent 70%)', filter:'blur(30px)'}}/>
      <div className="eyebrow">Race conditions</div>
      <div style={{display:'flex', alignItems:'baseline', gap:6, marginTop:10}}>
        <div className="hero-num mono" style={{fontSize:44}}>18°</div>
        <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:600}}>· 62% hum</div>
      </div>
      <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:600, marginTop:4}}>Milano · partly cloudy</div>
      <div style={{marginTop:16, display:'flex', gap:8}}>
        {['06','08','10','12','14'].map((h,i)=>{
          const t = [14,16,19,22,21][i];
          return (
            <div key={h} style={{flex:1, textAlign:'center', padding:'8px 0', borderRadius:10,
              background: i===1 ? 'rgba(255,255,255,0.55)' : 'transparent',
              border: i===1 ? '1px solid rgba(255,255,255,0.8)':'1px solid transparent'}}>
              <div className="eyebrow-sm" style={{fontSize:9}}>{h}:00</div>
              <div className="mono" style={{fontWeight:800, marginTop:3, fontSize:13}}>{t}°</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
//  HALL OF FAME
// ============================================================
function HallOfFame(){
  const records = [
    {d:'5K',     t:'19:42', date:'12 Mar', color:'#10B981'},
    {d:'10K',    t:'41:18', date:'08 Feb', color:'#FF5C7A'},
    {d:'Half',   t:'1:32:04', date:'14 Jan', color:'#6366F1'},
    {d:'Maraton',t:'3:18:44', date:'09 Oct', color:'#EC4899'},
  ];
  return (
    <div className="glass lift" style={{padding:'24px 26px', borderRadius:28, gridColumn:'span 2'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <div className="eyebrow">Hall of Fame</div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21L7 19.5M14 14.66V17c0 .55.47.98.97 1.21L17 19.5M18 2H6v7a6 6 0 0012 0V2z"/></svg>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {records.map(r=>(
          <div key={r.d} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.7)'}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <div style={{width:6, height:26, borderRadius:3, background:r.color}}/>
              <div>
                <div style={{fontSize:11, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase'}}>{r.d}</div>
                <div className="mono" style={{fontSize:16, fontWeight:800, lineHeight:1.1}}>{r.t}</div>
              </div>
            </div>
            <div className="eyebrow-sm">{r.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
//  APP
// ============================================================
function App(){
  return (
    <>
      <MapBackground />
      <div style={{position:'relative', zIndex:2, maxWidth:1400, margin:'0 auto', padding:'22px 26px 40px'}}>
        <TopBar />
        <HeroBlock />

        <div style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:24}}>
          <PaceChart />
          <HRZones />
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:24, marginTop:24}}>
          <Splits />
          <WeekVolume />
          <HallOfFame />
        </div>

        <BottomWidgets />

        <div style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:24, marginTop:24}}>
          <div style={{gridColumn:'span 7'}}>
            <AdaptationSummary />
          </div>
          <div style={{gridColumn:'span 3'}}>
            <Weather />
          </div>
          <div style={{gridColumn:'span 2'}}>
            <RaceCountdown />
          </div>
        </div>
      </div>
    </>
  );
}

function AdaptationSummary(){
  const items = [
    {dot:'#10B981', title:'Aerobic base', note:'CTL climbed +3.2 over 14 days. Progressive and sustainable.'},
    {dot:'#FF5C7A', title:'Threshold sessions', note:'4 consecutive T-pace runs under target RPE. Hold cadence.'},
    {dot:'#6366F1', title:'VO₂ readiness', note:'Parasympathetic HRV stable at 62ms. Green light for Tue intervals.'},
    {dot:'#F59E0B', title:'Watchpoint', note:'Right calf load ratio 1.22 — keep sub-30 min on easy days.'},
  ];
  return (
    <div className="glass lift" style={{padding:'28px 30px', borderRadius:28}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
        <div>
          <div className="eyebrow" style={{marginBottom:4}}>Adaptation summary</div>
          <div style={{fontFamily:'Outfit', fontWeight:900, fontStyle:'italic', fontSize:24, letterSpacing:'-0.02em'}}>
            Your body is responding
          </div>
        </div>
        <div className="chip">Week 16 of 20 · Milano Marathon</div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
        {items.map(it=>(
          <div key={it.title} style={{display:'flex', gap:12, padding:'12px 14px', borderRadius:16,
            background:'rgba(255,255,255,0.38)', border:'1px solid rgba(255,255,255,0.7)'}}>
            <div style={{width:8, height:8, borderRadius:99, background:it.dot, marginTop:6, boxShadow:`0 0 0 4px ${it.dot}22`, flex:'0 0 auto'}}/>
            <div>
              <div style={{fontSize:12, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4}}>{it.title}</div>
              <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.45}}>{it.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RaceCountdown(){
  const [tick, setTick] = useState(0);
  useEffect(()=>{
    const id = setInterval(()=>setTick(t=>t+1), 1000);
    return ()=>clearInterval(id);
  },[]);
  // fake countdown
  const days = 27;
  const hours = 14;
  const mins = 22;
  const secs = 60 - (tick % 60);
  return (
    <div className="glass lift" style={{padding:'24px 22px', borderRadius:28, height:'100%', display:'flex', flexDirection:'column', justifyContent:'space-between',
      background:'linear-gradient(165deg, rgba(26,27,46,0.88), rgba(59,61,92,0.88))', color:'white', borderColor:'rgba(255,255,255,0.15)'}}>
      <div>
        <div className="eyebrow" style={{color:'rgba(255,255,255,0.55)'}}>Race day</div>
        <div style={{fontFamily:'Outfit', fontWeight:900, fontStyle:'italic', fontSize:20, letterSpacing:'-0.02em', marginTop:6, lineHeight:1.05}}>
          Milano<br/>Marathon
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8}}>
        <Cell n={days} l="days" />
        <Cell n={String(hours).padStart(2,'0')} l="hrs" />
        <Cell n={String(mins).padStart(2,'0')} l="min" />
        <Cell n={String(secs).padStart(2,'0')} l="sec" />
      </div>
    </div>
  );
}
function Cell({n,l}){
  return (
    <div style={{padding:'8px 10px', borderRadius:12, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)'}}>
      <div className="mono" style={{fontSize:22, fontWeight:800, lineHeight:1}}>{n}</div>
      <div style={{fontSize:9, fontWeight:800, letterSpacing:'0.2em', textTransform:'uppercase', color:'rgba(255,255,255,0.45)', marginTop:3}}>{l}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
