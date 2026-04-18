/**
 * ANALYTICS PRO V5 â€” Editorial Running Intelligence
 * Style: Data-Journal / Left-border panels / Chapter layout / Inverted callouts
 * 12 unique running charts â€” completely distinct from V1â€“V4
 */
import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell, ReferenceLine,
  ComposedChart, Legend, LabelList,
} from 'recharts';
import { ChartExpandButton, ChartFullscreenModal } from './ChartFullscreenModal';
import type { ProAnalyticsChart } from '../../types/api';

// â”€â”€â”€ Palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const N   = '#C0FF00';
const N10 = 'rgba(192,255,0,0.10)';
const N20 = 'rgba(192,255,0,0.20)';
const N40 = 'rgba(192,255,0,0.40)';
const OR  = '#F97316';
const BL  = '#3B82F6';
const PU  = '#A78BFA';
const RD  = '#F43F5E';
const CY  = '#22D3EE';
const YL  = '#FBBF24';
const BG  = '#080808';
const P1  = '#0E0E0E';   // panel bg
const P2  = '#131313';
const HL  = '#1A1A1A';   // hover
const DM  = '#444';
const MT  = '#2A2A2A';
const MID = '#333';

// â”€â”€â”€ Micro helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const mono: React.CSSProperties = { fontFamily: 'monospace' };
const chartMono = { fontFamily: 'monospace' } as const;
const tag  = (txt: string, c = DM) => (
  <span style={{ ...mono, fontSize: 8, fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase', color: c }}>{txt}</span>
);

/** Left-border accent panel */
function LBPanel({ children, accent = N, className = '', style = {} }: {
  children: React.ReactNode; accent?: string; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        background: P1,
        borderLeft: `3px solid ${accent}`,
        padding: '20px 24px',
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Chapter number + title row */
function Chapter({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 20 }}>
      <span style={{ ...mono, fontSize: 11, fontWeight: 900, color: N40, letterSpacing: '0.1em' }}>{n} /</span>
      <div>
        <p style={{ ...mono, fontSize: 11, fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#fff', margin: 0 }}>{title}</p>
        {sub && <p style={{ ...mono, fontSize: 8, color: DM, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  );
}

/** Inverted callout box (neon bg, black text) */
function Callout({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ background: N, padding: '10px 16px', display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ ...mono, fontSize: 7, fontWeight: 900, color: '#000', letterSpacing: '0.25em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ ...mono, fontSize: 22, fontWeight: 900, color: '#000', lineHeight: 1 }}>{value}<span style={{ fontSize: 11, marginLeft: 3 }}>{unit}</span></span>
    </div>
  );
}

/** Thin horizontal rule */
const HR = () => <div style={{ height: 1, background: MT, margin: '4px 0' }} />;

/** Mini stat */
function Stat({ label, val, c = '#fff' }: { label: string; val: string; c?: string }) {
  return (
    <div>
      {tag(label, DM)}
      <p style={{ ...mono, fontSize: 18, fontWeight: 900, color: c, margin: '2px 0 0', lineHeight: 1 }}>{val}</p>
    </div>
  );
}

// â”€â”€â”€ Dark tooltip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TT({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#040404', border: `1px solid ${MT}`, padding: '8px 14px', ...mono }}>
      <p style={{ color: DM, fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 11, fontWeight: 900, margin: 0 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: '#fff', marginLeft: 8 }}>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

// â”€â”€â”€ Mock data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// 01 â€” Critical Power Curve (time in seconds â†’ max power W)
const cpCurve = [
  {t:'5s',  p:420}, {t:'10s', p:380}, {t:'30s', p:320}, {t:'1m',  p:275},
  {t:'3m',  p:238}, {t:'6m',  p:215}, {t:'10m', p:200}, {t:'20m', p:188},
  {t:'30m', p:182}, {t:'1h',  p:170}, {t:'2h',  p:158},
];

// 02 â€” HRV / RMSSD trend (42 days)
const hrv = Array.from({length:42}, (_,i) => ({
  day: i+1,
  rmssd: 42 + Math.sin(i/6)*14 + (Math.random()-0.5)*6,
  baseline: 44,
}));

// 03 â€” TRIMP stacked weekly (16 weeks)
const trimp = Array.from({length:16}, (_,i) => ({
  w: `W${i+1}`,
  aerobic:  Math.round(60 + Math.sin(i/3)*25 + Math.random()*10),
  anaerobic:Math.round(15 + Math.sin(i/2)*8  + Math.random()*5),
}));

// 04 â€” Aerobic Decoupling % (last 20 runs)
const decouple = Array.from({length:20}, (_,i) => ({
  run: i+1,
  pdc: Math.max(0, 3.5 + Math.sin(i/3)*3 + (Math.random()-0.5)*2),
}));

// 05 â€” Elevation silhouette (composite 3 runs)
const elevProfile = Array.from({length:60}, (_,i) => ({
  km: i*0.5,
  runA: 80  + Math.sin(i/8)*120 + Math.sin(i/3)*30 + (i>30 ? -20 : 0),
  runB: 40  + Math.sin(i/10)*80 + Math.cos(i/5)*20,
  runC: 200 + Math.sin(i/6)*180 - (i>45 ? 60 : 0),
}));

// 06 â€” Effort bubble (distance, pace, HR â†’ bubble size)
const bubbles = Array.from({length:28}, () => ({
  dist:  5  + Math.random()*30,
  pace:  4.0 + Math.random()*2,
  hr:    130 + Math.random()*50,
  z:     20  + Math.random()*60,
}));

// 07 â€” Running Economy index trend (20 sessions)
const reIndex = Array.from({length:20}, (_,i) => ({
  s: i+1,
  re:   210 + Math.sin(i/4)*18 - i*1.2,
  opt:  200,
}));

// 08 â€” Recovery window histogram (hours between sessions)
const recovBins = [
  {bin:'<12h', count:3},{bin:'12-18', count:8},{bin:'18-24', count:15},
  {bin:'24-36', count:22},{bin:'36-48', count:18},{bin:'48-72', count:12},
  {bin:'>72h',  count:5},
];

// 09 â€” Seasonal matrix (month Ã— metric, 0..100)
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const METRICS = ['Volume','Intensity','Consistency','Recovery','Form'];
const seasonal = METRICS.map(m =>
  MONTHS_SHORT.map(mo => ({ month: mo, metric: m, value: Math.round(40 + Math.random()*55) }))
);
const seasonColor = (v: number) => {
  if (v < 50)  return 'rgba(59,130,246,0.35)';
  if (v < 65)  return 'rgba(192,255,0,0.35)';
  if (v < 80)  return 'rgba(192,255,0,0.60)';
  return `rgba(192,255,0,0.90)`;
};

// 10 â€” Best Efforts Progression (4 distances over 12 months)
const bestEfforts = Array.from({length:12}, (_,i) => ({
  mo: MONTHS_SHORT[i],
  k5:  Math.round(1200 - i*4  + (Math.random()-0.5)*15),
  k10: Math.round(2520 - i*8  + (Math.random()-0.5)*20),
  hm:  Math.round(5580 - i*18 + (Math.random()-0.5)*40),
}));

// 11 â€” Pace distribution bell (histogram style)
const paceBell = [
  {pace:'3:30-4:00', runs:2}, {pace:'4:00-4:30', runs:8}, {pace:'4:30-5:00', runs:24},
  {pace:'5:00-5:30', runs:31}, {pace:'5:30-6:00', runs:22}, {pace:'6:00-6:30', runs:10},
  {pace:'6:30+',     runs:4},
];

// 12 â€” Load Stress Balance (4 months daily)
const lsb = Array.from({length:120}, (_,i) => {
  const ctl = 35 + (i/120)*30 + Math.sin(i/14)*5;
  const atl = ctl + Math.sin(i/7)*15 + (Math.random()-0.5)*5;
  return { d: i, ctl: Math.round(ctl), atl: Math.round(atl), tsb: Math.round(ctl-atl) };
});

// â”€â”€â”€ Chart components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// 01 â€” Critical Power Curve
function CPCurve() {
  return (
    <LBPanel accent={N} style={{ gridColumn: 'span 2' }}>
      <Chapter n="01" title="Critical Power Curve" sub="Max sustainable power per duration" />
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={cpCurve} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="cpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={N}  stopOpacity={0.3} />
                  <stop offset="100%" stopColor={N}  stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke={MT} vertical={false} />
              <XAxis dataKey="t" tick={{ fill: DM, fontSize: 9, ...chartMono, fontWeight: 900 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: DM, fontSize: 9, ...chartMono, fontWeight: 900 }} axisLine={false} tickLine={false} domain={[140,440]} />
              <Tooltip content={<TT />} />
              <ReferenceLine y={182} stroke={OR} strokeDasharray="5 3" strokeWidth={1.5} label={{ value: 'CP', fill: OR, fontSize: 9, fontWeight: 900 }} />
              <Area type="monotone" dataKey="p" name="Power (W)" stroke={N} strokeWidth={2.5} fill="url(#cpGrad)" dot={{ r:3, fill:N, stroke:BG, strokeWidth:1.5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 160 }}>
          <Callout label="Critical Power" value="182" unit="W" />
          <Callout label="W' (anaerobic)" value="18.4" unit="kJ" />
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['5s peak','420 W',N],['1min','275 W',CY],['20min','188 W',OR],['1h','170 W',DM]].map(([l,v,c])=>(
              <div key={l as string} style={{ display:'flex', justifyContent:'space-between', borderBottom:`1px solid ${MT}`, paddingBottom:4 }}>
                {tag(l as string, DM)}
                <span style={{ ...mono, fontSize:12, fontWeight:900, color:c as string }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LBPanel>
  );
}

// 02 â€” HRV trend
function HRVTrend() {
  return (
    <LBPanel accent={CY}>
      <Chapter n="02" title="HRV â€” RMSSD Trend" sub="Autonomic nervous system readiness (42 days)" />
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={hrv} margin={{ top:4, right:8, bottom:0, left:-20 }}>
          <CartesianGrid strokeDasharray="2 6" stroke={MT} vertical={false} />
          <XAxis dataKey="day" tick={{ fill:DM, fontSize:8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} interval={6} />
          <YAxis tick={{ fill:DM, fontSize:9, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} domain={[20,70]} />
          <Tooltip content={<TT />} />
          <ReferenceLine y={44} stroke={CY} strokeDasharray="5 3" strokeWidth={1} label={{ value:'BASELINE', fill:CY, fontSize:8, fontWeight:900, position:'right' }} />
          <Area type="monotone" dataKey="rmssd" name="RMSSD (ms)" stroke={CY} strokeWidth={2} fill="rgba(34,211,238,0.08)" dot={false} />
          <Line type="monotone" dataKey="baseline" stroke={DM} strokeDasharray="4 4" strokeWidth={1} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <HR />
      <div style={{ display:'flex', gap:20, marginTop:12 }}>
        <Stat label="7-day avg" val="46.3 ms" c={CY} />
        <Stat label="30-day avg" val="43.8 ms" c="#fff" />
        <Stat label="Trend" val="â†‘ +5.7%" c={N} />
        <Stat label="Status" val="READY" c={N} />
      </div>
    </LBPanel>
  );
}

// 03 â€” TRIMP stacked
function TRIMPChart() {
  return (
    <LBPanel accent={OR} style={{ gridColumn: 'span 2' }}>
      <Chapter n="03" title="Training Impulse (TRIMP)" sub="Weekly aerobic + anaerobic training load â€” 16 weeks" />
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={trimp} margin={{ top:4, right:8, bottom:0, left:-20 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="2 6" stroke={MT} vertical={false} />
          <XAxis dataKey="w" tick={{ fill:DM, fontSize:8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} interval={1} />
          <YAxis tick={{ fill:DM, fontSize:9, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} />
          <Tooltip content={<TT />} />
          <Bar dataKey="aerobic"   name="Aerobic"   stackId="t" fill={N}  fillOpacity={0.85} radius={[0,0,0,0]} />
          <Bar dataKey="anaerobic" name="Anaerobic" stackId="t" fill={OR} fillOpacity={0.90} radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
      <HR />
      <div style={{ display:'flex', gap:24, marginTop:12 }}>
        <Stat label="Avg weekly TRIMP" val="86.4"  c="#fff" />
        <Stat label="Peak week"        val="124"    c={N} />
        <Stat label="Aerobic %"        val="79.2%"  c={N} />
        <Stat label="Anaerobic %"      val="20.8%"  c={OR} />
        <Stat label="Trend 4w"         val="â†‘ +12%" c={CY} />
      </div>
    </LBPanel>
  );
}

// 04 â€” Aerobic Decoupling
function DecouplingChart() {
  return (
    <LBPanel accent={PU}>
      <Chapter n="04" title="Aerobic Decoupling" sub="Cardiac drift % per long run â€” optimal < 5%" />
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={decouple} margin={{ top:4, right:8, bottom:0, left:-20 }}>
          <CartesianGrid strokeDasharray="2 6" stroke={MT} vertical={false} />
          <XAxis dataKey="run" tick={{ fill:DM, fontSize:8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill:DM, fontSize:9, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} domain={[0,10]} />
          <Tooltip content={<TT />} />
          <ReferenceLine y={5} stroke={OR} strokeDasharray="5 3" strokeWidth={1.5} label={{ value:'THRESHOLD 5%', fill:OR, fontSize:8, fontWeight:900, position:'right' }} />
          <Bar dataKey="pdc" name="Decoupling %">
            {decouple.map((d,i)=>(
              <Cell key={i} fill={d.pdc > 5 ? OR : PU} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <HR />
      <div style={{ display:'flex', gap:20, marginTop:12 }}>
        <Stat label="Last run"  val="2.8%"  c={PU} />
        <Stat label="Avg 8-run" val="4.1%"  c="#fff" />
        <Stat label="Violations" val="3 / 20" c={OR} />
        <Stat label="Base status" val="BUILDING" c={N} />
      </div>
    </LBPanel>
  );
}

// 05 â€” Elevation Profile composite
function ElevProfileChart() {
  return (
    <LBPanel accent={YL} style={{ gridColumn: 'span 2' }}>
      <Chapter n="05" title="Elevation Profile Composite" sub="Overlay: 3 key workouts this cycle" />
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={elevProfile} margin={{ top:4, right:8, bottom:0, left:-16 }}>
          <defs>
            {[['cGrad',YL],['bGrad',CY],['aGrad',PU]].map(([id,c])=>(
              <linearGradient key={id as string} id={id as string} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={c as string} stopOpacity={0.30} />
                <stop offset="100%" stopColor={c as string} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="2 6" stroke={MT} vertical={false} />
          <XAxis dataKey="km" tick={{ fill:DM, fontSize:8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} interval={9} label={{ value:'KM', position:'insideBottom', fill:DM, fontSize:8, fontWeight:900, offset:-2 }} />
          <YAxis tick={{ fill:DM, fontSize:9, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} label={{ value:'m', angle:-90, fill:DM, fontSize:8, fontWeight:900 }} />
          <Tooltip content={<TT />} />
          <Area type="monotone" dataKey="runC" name="Trail 28k"    stroke={YL} strokeWidth={1.5} fill="url(#cGrad)" dot={false} />
          <Area type="monotone" dataKey="runB" name="Road 15k"     stroke={CY} strokeWidth={1.5} fill="url(#bGrad)" dot={false} />
          <Area type="monotone" dataKey="runA" name="Tempo 10k"    stroke={PU} strokeWidth={1.5} fill="url(#aGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <HR />
      <div style={{ display:'flex', gap:24, marginTop:12 }}>
        <Stat label="Trail 28k elev"  val="+1840m" c={YL} />
        <Stat label="Road 15k elev"   val="+240m"  c={CY} />
        <Stat label="Tempo 10k elev"  val="+120m"  c={PU} />
        <Stat label="Highest point"   val="412m"   c="#fff" />
      </div>
    </LBPanel>
  );
}

// 06 â€” Effort bubble chart
export function AnalyticsV5EffortMatrix({ chart }: { chart?: ProAnalyticsChart }) {
  const [expanded, setExpanded] = useState(false);
  const cardData = chart?.series_card ?? [];
  const detailData = chart?.series_detail?.length ? chart.series_detail : cardData;
  const renderChart = (isExpanded = false) => {
    const data = isExpanded ? detailData : cardData;
    if (!data.length) {
      return <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:DM, fontSize:11, fontWeight:900, letterSpacing:'0.2em', ...mono }}>DATI REALI INSUFFICIENTI</div>;
    }
    return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: isExpanded ? 20 : 4, right: isExpanded ? 20 : 8, bottom: isExpanded ? 24 : 8, left: isExpanded ? -4 : -16 }}>
        <CartesianGrid strokeDasharray="2 6" stroke={MT} />
        <XAxis type="number" dataKey="dist" name="Distanza" domain={[0,40]} tick={{ fill:DM, fontSize:isExpanded ? 12 : 9, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} label={{ value:'KM', position:'insideBottom', fill:DM, fontSize:8, fontWeight:900, offset:-4 }} />
        <YAxis type="number" dataKey="pace" name="Passo" domain={[3.5,6.5]} tick={{ fill:DM, fontSize:isExpanded ? 12 : 9, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} label={{ value:'MIN/KM', angle:-90, fill:DM, fontSize:8, fontWeight:900 }} />
        <ZAxis type="number" dataKey="z" range={isExpanded ? [50,260] : [30,200]} />
        <Tooltip cursor={{ stroke:MT }} content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0].payload;
          return (
            <div style={{ background:'#040404', border:`1px solid ${MT}`, padding:'8px 12px', ...mono }}>
              <p style={{ color:N, fontSize:10, fontWeight:900 }}>{d.dist.toFixed(1)} km @ {d.pace.toFixed(2)} min/km</p>
              <p style={{ color:DM, fontSize:9, fontWeight:900 }}>FC: {d.hr ? d.hr.toFixed(0) : 'N/D'} bpm</p>
            </div>
          );
        }} />
        <ReferenceLine y={4.5} stroke={N} strokeDasharray="4 3" strokeWidth={1} />
        <Scatter data={data} fill={N} fillOpacity={0.55} />
      </ScatterChart>
    </ResponsiveContainer>
  );
  };

  return (
    <>
      <LBPanel accent={N} className="group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <Chapter n="06" title="Matrice degli Sforzi" sub="Distanza × Passo × Frequenza Cardiaca (dimensione bolla = carico FC)" />
          <ChartExpandButton onClick={() => setExpanded(true)} />
        </div>
        <div style={{ height: 200 }}>{renderChart(false)}</div>
      </LBPanel>
      <ChartFullscreenModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title="Matrice degli Sforzi"
        subtitle="Distanza × passo × frequenza cardiaca"
        accent={N}
        details={<div style={{ display:'flex', gap:28, marginTop:4 }}><Stat label="Campioni" val={`${detailData.length}`} c={N} /><Stat label="Threshold ref" val="4.50 /km" c="#fff" /><Stat label="Bubble size" val="Carico FC" c={DM} /></div>}
      >
        {renderChart(true)}
      </ChartFullscreenModal>
    </>
  );
}
// 07 â€” Running Economy trend
function RunningEconomy() {
  return (
    <LBPanel accent={N}>
      <Chapter n="07" title="Running Economy Index" sub="Oâ‚‚ cost (ml/kg/km) â€” lower = better" />
      {/* Big inverted number */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
        <Callout label="Current RE" value="203" unit="ml/kg/km" />
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={{ ...mono, fontSize:9, fontWeight:900, color:N, letterSpacing:'0.2em' }}>â–¼ -3.4% vs 3 months ago</span>
          <span style={{ ...mono, fontSize:9, fontWeight:900, color:DM, letterSpacing:'0.2em' }}>ELITE TARGET: &lt; 195 ml/kg/km</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <ComposedChart data={reIndex} margin={{ top:4, right:8, bottom:0, left:-20 }}>
          <CartesianGrid strokeDasharray="2 6" stroke={MT} vertical={false} />
          <XAxis dataKey="s" tick={{ fill:DM, fontSize:8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} />
          <YAxis domain={[185,230]} tick={{ fill:DM, fontSize:8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} />
          <Tooltip content={<TT />} />
          <ReferenceLine y={200} stroke={N} strokeDasharray="4 3" strokeWidth={1} label={{ value:'TARGET', fill:N, fontSize:8, fontWeight:900, position:'right' }} />
          <Line type="monotone" dataKey="re" name="RE" stroke={N} strokeWidth={2.5} dot={{ r:3, fill:N, stroke:BG, strokeWidth:1.5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </LBPanel>
  );
}

// 08 â€” Recovery histogram
function RecoveryHistogram() {
  return (
    <LBPanel accent={CY}>
      <Chapter n="08" title="Recovery Window Distribution" sub="Hours between consecutive sessions" />
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={recovBins} margin={{ top:4, right:8, bottom:0, left:-20 }} barCategoryGap="15%">
          <CartesianGrid strokeDasharray="2 6" stroke={MT} vertical={false} />
          <XAxis dataKey="bin" tick={{ fill:DM, fontSize:8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill:DM, fontSize:9, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} />
          <Tooltip content={<TT />} />
          <ReferenceLine x="24-36" stroke={N} strokeDasharray="4 3" strokeWidth={1} label={{ value:'OPTIMAL', fill:N, fontSize:8, fontWeight:900 }} />
          <Bar dataKey="count" name="Sessions" radius={[3,3,0,0]}>
            {recovBins.map((b,i) => (
              <Cell key={i} fill={b.bin === '24-36' ? N : b.bin === '18-24' ? CY : b.bin === '36-48' ? CY : b.bin === '<12h' ? RD : MT} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <HR />
      <div style={{ display:'flex', gap:20, marginTop:12 }}>
        <Stat label="Optimal range"   val="24â€“36 h"  c={N} />
        <Stat label="Avg recovery"    val="31.4 h"   c="#fff" />
        <Stat label="Under-recovery"  val="11 cases" c={RD} />
      </div>
    </LBPanel>
  );
}

// 09 â€” Seasonal Matrix
function SeasonalMatrix() {
  return (
    <LBPanel accent={OR} style={{ gridColumn:'span 2' }}>
      <Chapter n="09" title="Seasonal Performance Matrix" sub="Month Ã— Metric heatmap â€” full year" />
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'separate', borderSpacing:3, ...mono }}>
          <thead>
            <tr>
              <th style={{ width:90, textAlign:'left', paddingBottom:6, color:DM, fontSize:8, fontWeight:900, letterSpacing:'0.2em' }}>METRIC</th>
              {MONTHS_SHORT.map(m => (
                <th key={m} style={{ width:46, textAlign:'center', paddingBottom:6, color:DM, fontSize:8, fontWeight:900, letterSpacing:'0.15em' }}>{m.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric, mi) => (
              <tr key={metric}>
                <td style={{ fontSize:9, fontWeight:900, color:'#fff', paddingRight:12, paddingBottom:3, letterSpacing:'0.15em' }}>{metric.toUpperCase()}</td>
                {seasonal[mi].map((cell, ci) => (
                  <td key={ci} style={{ padding:0, paddingBottom:3 }}>
                    <div
                      style={{
                        width:44, height:28,
                        background: seasonColor(cell.value),
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}
                      title={`${cell.month} â€” ${cell.value}`}
                    >
                      <span style={{ fontSize:8, fontWeight:900, color:cell.value>70 ? '#000' : '#fff', ...mono }}>{cell.value}</span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HR />
      <div style={{ display:'flex', gap:20, marginTop:12 }}>
        <Stat label="Peak month" val="May" c={N} />
        <Stat label="Best metric" val="Consistency" c={N} />
        <Stat label="Weakest" val="Recovery â€” Feb" c={OR} />
      </div>
    </LBPanel>
  );
}

// 10 â€” Best Efforts Progression
export function AnalyticsV5BestEffortsProgression({ chart }: { chart?: ProAnalyticsChart }) {
  const [expanded, setExpanded] = useState(false);
  const fmt = (s?: number) => s ? `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}` : '—';
  const toPoint = (d: Record<string, any>): Record<string, any> & { mo: string } => ({ ...d, mo: String(d.date ?? '') });
  const cardData = (chart?.series_card ?? []).map(toPoint);
  const detailData = (chart?.series_detail?.length ? chart.series_detail : chart?.series_card ?? []).map(toPoint);
  const best5 = Math.min(...detailData.map((d) => Number(d.k5)).filter(Boolean));
  const best10 = Math.min(...detailData.map((d) => Number(d.k10)).filter(Boolean));
  const bestHm = Math.min(...detailData.map((d) => Number(d.hm)).filter(Boolean));
  const renderChart = (isExpanded = false) => {
    const data = isExpanded ? detailData : cardData;
    if (!data.length) {
      return <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:DM, fontSize:11, fontWeight:900, letterSpacing:'0.2em', ...mono }}>DATI REALI INSUFFICIENTI</div>;
    }
    return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top:isExpanded ? 20 : 4, right:isExpanded ? 20 : 8, bottom:isExpanded ? 20 : 0, left:isExpanded ? 0 : -8 }}>
        <CartesianGrid strokeDasharray="2 6" stroke={MT} vertical={false} />
        <XAxis dataKey="mo" tick={{ fill:DM, fontSize:isExpanded ? 12 : 9, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left"  tick={{ fill:DM, fontSize:isExpanded ? 11 : 8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} domain={['dataMin - 60', 'dataMax + 60']} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill:DM, fontSize:isExpanded ? 11 : 8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} domain={['dataMin - 120', 'dataMax + 120']} />
        <Tooltip content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <div style={{ background:'#040404', border:`1px solid ${MT}`, padding:'8px 12px', ...mono }}>
              <p style={{ color:DM, fontSize:9, fontWeight:900, letterSpacing:'0.2em', marginBottom:4 }}>{label}</p>
              {payload.map((p,i) => (
                <p key={i} style={{ fontSize:11, fontWeight:900, margin:0 }}>
                  <span style={{ color:p.color as string }}>{p.name}</span>
                  <span style={{ color:'#fff', marginLeft:8 }}>{fmt(p.value as number)}</span>
                </p>
              ))}
            </div>
          );
        }} />
        <Line yAxisId="left"  type="monotone" dataKey="k5"  name="5K"   stroke={N}  strokeWidth={2.5} dot={{ r:4, fill:N,  stroke:BG, strokeWidth:1.5 }} />
        <Line yAxisId="right" type="monotone" dataKey="k10" name="10K"  stroke={CY} strokeWidth={2}   dot={{ r:3, fill:CY, stroke:BG, strokeWidth:1.5 }} />
        <Line yAxisId="right" type="monotone" dataKey="hm"  name="Half" stroke={PU} strokeWidth={2}   dot={{ r:3, fill:PU, stroke:BG, strokeWidth:1.5 }} strokeDasharray="6 3" />
      </LineChart>
    </ResponsiveContainer>
  );
  };

  return (
    <>
      <LBPanel accent={PU} className="group" style={{ gridColumn:'span 2' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
          <Chapter n="10" title="Best Efforts Progression" sub="Monthly personal bests — 5K / 10K / Half Marathon" />
          <ChartExpandButton onClick={() => setExpanded(true)} />
        </div>
        <div style={{ height: 200 }}>{renderChart(false)}</div>
        <HR />
        <div style={{ display:'flex', gap:28, marginTop:12 }}>
          <Stat label="5K best"     val={Number.isFinite(best5) ? fmt(best5) : '—'} c={N}  />
          <Stat label="10K best"    val={Number.isFinite(best10) ? fmt(best10) : '—'} c={CY} />
          <Stat label="Half best"   val={Number.isFinite(bestHm) ? fmt(bestHm) : '—'} c={PU} />
          <Stat label="Campioni" val={`${chart?.quality?.sample_size ?? 0}`} c={N} />
        </div>
      </LBPanel>
      <ChartFullscreenModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title="Best Efforts Progression"
        subtitle="Monthly personal bests — 5K / 10K / Half Marathon"
        accent={PU}
        details={<div style={{ display:'flex', gap:28 }}><Stat label="5K best" val={Number.isFinite(best5) ? fmt(best5) : '—'} c={N} /><Stat label="10K best" val={Number.isFinite(best10) ? fmt(best10) : '—'} c={CY} /><Stat label="Half best" val={Number.isFinite(bestHm) ? fmt(bestHm) : '—'} c={PU} /><Stat label="Campioni" val={`${chart?.quality?.sample_size ?? 0}`} c={N} /></div>}
      >
        {renderChart(true)}
      </ChartFullscreenModal>
    </>
  );
}
// 11 â€” Pace Distribution Bell
export function AnalyticsV5PaceDistributionBell({ chart }: { chart?: ProAnalyticsChart }) {
  const [expanded, setExpanded] = useState(false);
  const cardData = chart?.series_card ?? [];
  const detailData = chart?.series_detail?.length ? chart.series_detail : cardData;
  const modalPace = cardData.reduce((best, item) => Number(item.runs ?? 0) > Number(best?.runs ?? 0) ? item : best, cardData[0]);
  const renderChart = (isExpanded = false) => {
    const data = isExpanded ? detailData : cardData;
    if (!data.length) {
      return <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:DM, fontSize:11, fontWeight:900, letterSpacing:'0.2em', ...mono }}>DATI REALI INSUFFICIENTI</div>;
    }
    return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top:isExpanded ? 20 : 4, right:isExpanded ? 20 : 8, bottom:isExpanded ? 20 : 0, left:isExpanded ? -4 : -20 }} barCategoryGap="12%">
        <CartesianGrid strokeDasharray="2 6" stroke={MT} vertical={false} />
        <XAxis dataKey="pace" tick={{ fill:DM, fontSize:isExpanded ? 12 : 8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill:DM, fontSize:isExpanded ? 12 : 9, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} />
        <Tooltip content={<TT />} />
        <Bar dataKey="runs" name="Corse" radius={[4,4,0,0]}>
          {data.map((_,i) => (
            <Cell key={i} fill={i === Math.floor(data.length / 2) ? N : i % 2 === 0 ? `${N}77` : MT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
  };

  return (
    <>
      <LBPanel accent={N} className="group">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
          <Chapter n="11" title="Distribuzione del Passo" sub="Numero di corse per zona di passo — storico completo" />
          <ChartExpandButton onClick={() => setExpanded(true)} />
        </div>
        <div style={{ height: 180 }}>{renderChart(false)}</div>
        <HR />
        <div style={{ display:'flex', gap:20, marginTop:12 }}>
          <Stat label="Passo modale"  val={String(modalPace?.pace ?? '—')} c={N} />
          <Stat label="Corse totali" val={`${chart?.quality?.sample_size ?? 0}`}        c="#fff" />
          <Stat label="Origine"       val="Outdoor GPS" c={DM} />
        </div>
      </LBPanel>
      <ChartFullscreenModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title="Distribuzione del Passo"
        subtitle="Numero di corse per zona di passo — storico completo"
        accent={N}
        details={<div style={{ display:'flex', gap:28 }}><Stat label="Passo modale" val={String(modalPace?.pace ?? '—')} c={N} /><Stat label="Corse totali" val={`${chart?.quality?.sample_size ?? 0}`} c="#fff" /><Stat label="Origine" val="Outdoor GPS" c={DM} /></div>}
      >
        {renderChart(true)}
      </ChartFullscreenModal>
    </>
  );
}
// 12 â€” Load Stress Balance 4-month
function LSBChart() {
  return (
    <LBPanel accent={BL} style={{ gridColumn:'span 2' }}>
      <Chapter n="12" title="Load Stress Balance â€” 4 Month PMC" sub="CTL (fitness) Â· ATL (fatigue) Â· TSB (form)" />
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={lsb} margin={{ top:4, right:12, bottom:0, left:-16 }}>
          <defs>
            <linearGradient id="tsbGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={N} stopOpacity={0.22} />
              <stop offset="100%" stopColor={N} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" stroke={MT} vertical={false} />
          <XAxis dataKey="d" tick={{ fill:DM, fontSize:8, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} interval={19} />
          <YAxis tick={{ fill:DM, fontSize:9, ...chartMono, fontWeight:900 }} axisLine={false} tickLine={false} />
          <Tooltip content={<TT />} />
          <ReferenceLine y={0} stroke={MT} strokeWidth={1} />
          <Area type="monotone" dataKey="tsb" name="TSB (Form)" stroke={N} strokeWidth={1.5} fill="url(#tsbGrad)" dot={false} />
          <Line type="monotone" dataKey="ctl" name="CTL (Fitness)" stroke={BL} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="atl" name="ATL (Fatigue)" stroke={RD} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <HR />
      <div style={{ display:'flex', gap:28, marginTop:12 }}>
        <Stat label="CTL today" val="61.4" c={BL} />
        <Stat label="ATL today" val="53.2" c={RD} />
        <Stat label="TSB today" val="+8.2" c={N} />
        <Stat label="Peak CTL"  val="68.1" c="#fff" />
        <Stat label="Race window" val="TSB +5â†’+15" c={N} />
      </div>
    </LBPanel>
  );
}

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function AnalyticsV5() {
  return (
    <div
      className="space-y-0 animate-in fade-in slide-in-from-bottom-4 duration-700"
      style={{ fontFamily:'monospace' }}
    >
      {/* â”€â”€ Banner â”€â”€ */}
      <div style={{ background:`linear-gradient(135deg, #0A0A0A 60%, ${N10})`, borderBottom:`3px solid ${N}`, padding:'18px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <p style={{ ...mono, fontSize:9, color:DM, letterSpacing:'0.3em', marginBottom:4 }}>METIC LAB â€” INTELLIGENCE REPORT</p>
          <h2 style={{ ...mono, fontSize:28, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', margin:0 }}>
            ANALYTICS <span style={{ color:N }}>PRO V5</span>
          </h2>
          <p style={{ ...mono, fontSize:8, color:DM, letterSpacing:'0.25em', marginTop:4 }}>12 MODULES Â· RUNNING SCIENCE Â· ATHLETE #00312</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
          <div style={{ display:'flex', gap:12 }}>
            {[['VDOT','54.2',N],['FTP','182W',CY],['LTHR','162bpm',OR]].map(([l,v,c])=>(
              <div key={l} style={{ background:P2, border:`1px solid ${MT}`, padding:'6px 12px' }}>
                {tag(l,DM)}
                <p style={{ ...mono, fontSize:16, fontWeight:900, color:c as string, margin:'2px 0 0' }}>{v}</p>
              </div>
            ))}
          </div>
          <p style={{ ...mono, fontSize:8, color:DM, letterSpacing:'0.2em' }}>LAST SYNC: 2026-04-15 Â· 08:32</p>
        </div>
      </div>

      {/* â”€â”€ Grid â”€â”€ */}
      <div style={{ display:'grid', gap:3 }}>

        {/* Row A: Critical Power (2/3) + HRV (1/3) */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:3 }}>
          <CPCurve />
          <HRVTrend />
        </div>

        {/* Row B: TRIMP (2/3) + Decoupling (1/3) */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:3 }}>
          <TRIMPChart />
          <DecouplingChart />
        </div>

        {/* Row C: Elevation full width */}
        <ElevProfileChart />

        {/* Row D: Effort Bubble (1/2) + Running Economy (1/4) + Recovery (1/4) */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:3 }}>
          <AnalyticsV5EffortMatrix />
          <RunningEconomy />
          <RecoveryHistogram />
        </div>

        {/* Row E: Seasonal matrix full width */}
        <SeasonalMatrix />

        {/* Row F: Best Efforts (2/3) + Pace Bell (1/3) */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:3 }}>
          <AnalyticsV5BestEffortsProgression />
          <AnalyticsV5PaceDistributionBell />
        </div>

        {/* Row G: LSB full width */}
        <LSBChart />

      </div>

      {/* â”€â”€ Footer â”€â”€ */}
      <div style={{ background:P1, borderTop:`1px solid ${MT}`, padding:'10px 24px', display:'flex', justifyContent:'space-between', marginTop:3 }}>
        {tag('Powered by Metic Lab Engine Â· Data Science Module v5.0.1 Â· All metrics are estimates based on training data',DM)}
        <div style={{ display:'flex', gap:24 }}>
          {tag(`YTD: 1,248 km`, N)}
          {tag(`YTD Elev: 8,420m`, CY)}
          {tag(`Sessions: 87`, DM)}
        </div>
      </div>
    </div>
  );
}
