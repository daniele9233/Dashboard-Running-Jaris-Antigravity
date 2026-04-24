/**
 * ANALYTICS PRO V4 â€” Race Engineering Dashboard
 * Style: Scientific Instrument / Data Observatory
 * Sharp panels Â· bracket decorations Â· terminal data Â· dense charts
 */
import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis,
  LineChart, Line, ReferenceLine, BarChart, Bar, Cell,
  ComposedChart, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import type { Run, FitnessFreshnessPoint, ProAnalyticsChart } from '../../types/api';
import { ChartExpandButton, ChartFullscreenModal } from './ChartFullscreenModal';

// â”€â”€â”€ Palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const N  = '#C0FF00';           // neon lime
const N2 = 'rgba(192,255,0,.15)';
const N3 = 'rgba(192,255,0,.06)';
const OR = '#F97316';
const BL = '#3B82F6';
const PU = '#8B5CF6';
const RD = '#F43F5E';
const CY = '#22D3EE';
const BG = '#080808';
const S1 = '#0E0E0E';
const S2 = '#161616';
const S3 = '#1C1C1C';
const BR = '#222';
const DM = '#555';
const MT = '#1E1E1E';

// â”€â”€â”€ Shared tiny label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Lbl({ children, color = DM }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ color, fontSize: 9, fontWeight: 900, letterSpacing: '0.22em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
      {children}
    </span>
  );
}

// â”€â”€â”€ Corner bracket decoration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Bracket({ size = 10, color = N, pos }: { size?: number; color?: string; pos: 'tl'|'tr'|'bl'|'br' }) {
  const s = size;
  const tl = pos === 'tl', tr = pos === 'tr', bl = pos === 'bl', br = pos === 'br';
  return (
    <svg
      width={s} height={s}
      style={{
        position: 'absolute',
        top:    (tl || tr) ? 0 : undefined,
        bottom: (bl || br) ? 0 : undefined,
        left:   (tl || bl) ? 0 : undefined,
        right:  (tr || br) ? 0 : undefined,
        pointerEvents: 'none',
      }}
    >
      {tl && <><line x1={0} y1={s} x2={0} y2={0} stroke={color} strokeWidth={1.5}/><line x1={0} y1={0} x2={s} y2={0} stroke={color} strokeWidth={1.5}/></>}
      {tr && <><line x1={s} y1={s} x2={s} y2={0} stroke={color} strokeWidth={1.5}/><line x1={0} y1={0} x2={s} y2={0} stroke={color} strokeWidth={1.5}/></>}
      {bl && <><line x1={0} y1={0} x2={0} y2={s} stroke={color} strokeWidth={1.5}/><line x1={0} y1={s} x2={s} y2={s} stroke={color} strokeWidth={1.5}/></>}
      {br && <><line x1={s} y1={0} x2={s} y2={s} stroke={color} strokeWidth={1.5}/><line x1={0} y1={s} x2={s} y2={s} stroke={color} strokeWidth={1.5}/></>}
    </svg>
  );
}

// Panel with bracket corners
function Panel({
  children,
  className = '',
  style = {},
  accent = N,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  accent?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        background: S1,
        border: `1px solid ${MT}`,
        borderLeft: `3px solid ${accent}`,
        ...style,
      }}
    >
      <Bracket pos="tl" size={12} />
      <Bracket pos="tr" size={12} />
      <Bracket pos="bl" size={12} />
      <Bracket pos="br" size={12} />
      {children}
    </div>
  );
}

// â”€â”€â”€ Tooltip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TT({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#050505', border: `1px solid ${BR}`, padding: '8px 14px', fontFamily: 'monospace' }}>
      <p style={{ color: DM, fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 11, fontWeight: 900 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: '#fff', marginLeft: 8 }}>
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// â”€â”€â”€ Mock data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// 16-week training heatmap
const DAYS = ['L','M','M','G','V','S','D'];
const heatmap = Array.from({ length: 16 }, (_, w) =>
  Array.from({ length: 7 }, (_, d) => {
    const r = Math.random();
    if (r < 0.28) return 0;
    if (r < 0.55) return 1;
    if (r < 0.75) return 2;
    if (r < 0.88) return 3;
    return 4;
  })
);

const heatColor = (v: number) => {
  if (v === 0) return S2;
  if (v === 1) return 'rgba(192,255,0,0.18)';
  if (v === 2) return 'rgba(192,255,0,0.40)';
  if (v === 3) return 'rgba(192,255,0,0.68)';
  return N;
};

// Lactate curve
const lactate = [
  { pace: 6.5, la: 1.1 }, { pace: 6.0, la: 1.3 }, { pace: 5.5, la: 1.7 },
  { pace: 5.0, la: 2.2 }, { pace: 4.8, la: 2.8 }, { pace: 4.6, la: 3.5 },
  { pace: 4.4, la: 4.8 }, { pace: 4.2, la: 6.5 }, { pace: 4.0, la: 9.2 },
  { pace: 3.8, la: 13.0 },
];

// Cadence vs speed scatter
const cadScatter = Array.from({ length: 40 }, () => ({
  speed: 8 + Math.random() * 8,
  cadence: 155 + Math.random() * 30,
  r: Math.random() * 20 + 5,
}));

// Split analysis (per km)
const splits = Array.from({ length: 12 }, (_, i) => {
  const base = 260 + Math.sin(i / 3) * 20 + (i > 8 ? -15 : 0);
  const sec = Math.round(base + (Math.random() - 0.5) * 12);
  const min = Math.floor(sec / 60);
  const s   = sec % 60;
  return { km: i + 1, pace: sec, label: `${min}:${String(s).padStart(2,'0')}`, delta: Math.round((Math.random() - 0.5) * 15) };
});

// Weekly volume last 26 weeks
const weekly = Array.from({ length: 26 }, (_, i) => {
  const base = 45 + Math.sin(i / 4) * 18 + Math.sin(i / 11) * 10;
  return { w: `W${i + 1}`, km: Math.round(Math.max(0, base + (Math.random() - 0.5) * 10)), target: 60 };
});

// Elevation vs HR
const elvHr = Array.from({ length: 20 }, (_, i) => ({
  elev: i * 15,
  hr: 140 + i * 2.2 + (Math.random() - 0.5) * 8,
  pace: 4.5 + i * 0.08,
}));

// Shoe wear radar
const shoeRadar = [
  { axis: 'Heel',    A: 82, B: 68 },
  { axis: 'MidFoot', A: 91, B: 85 },
  { axis: 'ForeF.',  A: 74, B: 92 },
  { axis: 'Lateral', A: 88, B: 71 },
  { axis: 'Medial',  A: 65, B: 78 },
];

// Pace zone distribution
const paceZones = [
  { zone: 'Z1 Easy',     pct: 38, color: BL,  pace: '>5:30' },
  { zone: 'Z2 Aerobic',  pct: 29, color: CY,  pace: '5:00â€“5:30' },
  { zone: 'Z3 Tempo',    pct: 18, color: N,   pace: '4:30â€“5:00' },
  { zone: 'Z4 Threshold',pct: 10, color: OR,  pace: '4:00â€“4:30' },
  { zone: 'Z5 VO2Max',   pct: 5,  color: RD,  pace: '<4:00' },
];

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KpiTile({ label, value, unit, sub, accent = N }: { label: string; value: string; unit: string; sub: string; accent?: string }) {
  return (
    <Panel className="p-5 flex flex-col gap-2" accent={accent}>
      <Lbl color={DM}>{label}</Lbl>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span style={{ fontSize: 44, fontWeight: 900, lineHeight: 1, color: '#fff', fontFamily: 'monospace', letterSpacing: '-0.04em' }}>{value}</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: accent, fontFamily: 'monospace' }}>{unit}</span>
      </div>
      <span style={{ fontSize: 9, color: DM, fontWeight: 900, letterSpacing: '0.18em', fontFamily: 'monospace' }}>{sub.toUpperCase()}</span>
      <div style={{ height: 2, background: MT, marginTop: 4 }}>
        <div style={{ height: '100%', width: '100%', background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      </div>
    </Panel>
  );
}

function HeatmapCalendar() {
  return (
    <Panel className="p-6" style={{ gridColumn: 'span 2' }}>
      <div className="flex items-center justify-between mb-5">
        <Lbl color={DM}>TRAINING DENSITY â€” LAST 16 WEEKS</Lbl>
        <div className="flex items-center gap-3">
          {[0,1,2,3,4].map(v => (
            <span key={v} className="flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, background: heatColor(v), display: 'inline-block' }} />
              <Lbl color={DM}>{['Rest','Easy','Mod','Hard','Race'][v]}</Lbl>
            </span>
          ))}
        </div>
      </div>
      {/* Day labels */}
      <div className="flex gap-1 mb-1.5 ml-[52px]">
        {DAYS.map((d, i) => (
          <div key={i} style={{ width: 16, fontSize: 8, fontWeight: 900, color: DM, textAlign: 'center', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{d}</div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {heatmap.map((week, wi) => (
          <div key={wi} className="flex items-center gap-1">
            <span style={{ width: 44, fontSize: 8, color: MT, fontFamily: 'monospace', fontWeight: 900, textAlign: 'right', paddingRight: 8, letterSpacing: '0.1em' }}>W{wi + 1}</span>
            {week.map((day, di) => (
              <div
                key={di}
                style={{
                  width: 16, height: 16,
                  background: heatColor(day),
                  boxShadow: day >= 3 ? `0 0 6px ${N}` : 'none',
                }}
                title={['Rest','Easy','Moderate','Hard','Race'][day]}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: `1px solid ${MT}` }}>
        <Lbl color={DM}>TOTAL TRAINING DAYS: <span style={{ color: N }}>87/112</span></Lbl>
        <Lbl color={DM}>CONSISTENCY SCORE: <span style={{ color: N }}>77.7%</span></Lbl>
        <Lbl color={DM}>HARD SESSIONS: <span style={{ color: OR }}>23</span></Lbl>
        <Lbl color={DM}>REST DAYS: <span style={{ color: DM }}>25</span></Lbl>
      </div>
    </Panel>
  );
}

function LactateCurve() {
  return (
    <Panel className="p-6" accent={OR}>
      <div className="flex items-center justify-between mb-5">
        <Lbl color={DM}>LACTATE THRESHOLD MODEL</Lbl>
        <Lbl color={OR}>LT2 @ 4:32 MIN/KM</Lbl>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={lactate} margin={{ top: 4, right: 12, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="laGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={OR} stopOpacity={0.3} />
              <stop offset="95%" stopColor={OR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={MT} vertical={false} />
          <XAxis dataKey="pace" tick={{ fill: DM, fontSize: 9, fontFamily: 'monospace', fontWeight: 900 }} axisLine={false} tickLine={false} label={{ value: 'PACE MIN/KM', position: 'insideBottom', fill: DM, fontSize: 8, fontWeight: 900, offset: -2 }} />
          <YAxis tick={{ fill: DM, fontSize: 9, fontFamily: 'monospace', fontWeight: 900 }} axisLine={false} tickLine={false} />
          <Tooltip content={<TT />} />
          <ReferenceLine x={4.4} stroke={OR} strokeDasharray="5 3" strokeWidth={1.5} label={{ value: 'LT2', fill: OR, fontSize: 9, fontWeight: 900 }} />
          <ReferenceLine y={4} stroke={N} strokeDasharray="5 3" strokeWidth={1} label={{ value: '4 mmol/L', fill: N, fontSize: 8, fontWeight: 900, position: 'right' }} />
          <Area type="monotone" dataKey="la" name="Lactate (mmol/L)" stroke={OR} strokeWidth={2.5} fill="url(#laGrad)" dot={{ r: 3, fill: OR, stroke: BG, strokeWidth: 1.5 }} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4" style={{ borderTop: `1px solid ${MT}` }}>
        {[['LT1','5:05','Aerobic',N],['LT2','4:32','Threshold',OR],['MAP','3:58','VO2Max',RD]].map(([k,v,l,c]) => (
          <div key={k}>
            <Lbl color={c as string}>{k}</Lbl>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'monospace', lineHeight: 1.2, marginTop: 2 }}>{v}</p>
            <Lbl color={DM}>{l}</Lbl>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function AnalyticsV4CadenceSpeedMatrix({ chart, onRequestDetail }: { chart?: ProAnalyticsChart; onRequestDetail?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cardPoints = chart?.series_card ?? [];
  const detailPoints = chart?.series_detail?.length ? chart.series_detail : cardPoints;
  const avgCadence = Math.round(cardPoints.reduce((s, p) => s + Number(p.cadence ?? 0), 0) / Math.max(1, cardPoints.length));
  const overStride = Math.round(cardPoints.filter((p) => Number(p.cadence ?? 0) < 165).length / Math.max(1, cardPoints.length) * 100);
  const renderChart = (isExpanded = false) => {
    const points = isExpanded ? detailPoints : cardPoints;
    if (!points.length) {
      return <div className="h-full flex items-center justify-center text-[#555] text-xs font-black tracking-widest uppercase">Dati reali insufficienti</div>;
    }
    return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: isExpanded ? 20 : 4, right: isExpanded ? 20 : 12, bottom: isExpanded ? 24 : 0, left: isExpanded ? -4 : -16 }}>
        <CartesianGrid strokeDasharray="2 4" stroke={MT} />
        <XAxis type="number" dataKey="speed" name="Speed" domain={[7,17]} tick={{ fill: DM, fontSize: isExpanded ? 12 : 9, fontFamily: 'monospace', fontWeight: 900 }} axisLine={false} tickLine={false} label={{ value: 'SPEED KM/H', position: 'insideBottom', fill: DM, fontSize: 8, fontWeight: 900, offset: -2 }} />
        <YAxis type="number" dataKey="cadence" name="Cadence" domain={[150,190]} tick={{ fill: DM, fontSize: isExpanded ? 12 : 9, fontFamily: 'monospace', fontWeight: 900 }} axisLine={false} tickLine={false} />
        <ZAxis type="number" dataKey="r" range={isExpanded ? [45,180] : [20,100]} />
        <Tooltip cursor={{ stroke: MT }} content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0].payload;
          return (
            <div style={{ background: '#050505', border: `1px solid ${BR}`, padding: '8px 12px', fontFamily: 'monospace' }}>
              <p style={{ color: CY, fontSize: 10, fontWeight: 900 }}>{d.speed.toFixed(1)} km/h · {d.cadence.toFixed(0)} spm</p>
            </div>
          );
        }} />
        <ReferenceLine x={13} stroke={N} strokeDasharray="4 3" strokeWidth={1} />
        <ReferenceLine y={170} stroke={N} strokeDasharray="4 3" strokeWidth={1} />
        <Scatter data={points} fill={CY} fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
  };

  return (
    <>
      <Panel
        className="p-6 group"
        accent={N}
        style={{
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(192,255,0,0.04)',
          background: 'radial-gradient(circle at top left, rgba(192,255,0,0.07), transparent 24%), #0E0E0E',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <Lbl color={DM}>CADENCE vs SPEED MATRIX</Lbl>
          <div className="flex items-center gap-3">
            <Lbl color={CY}>N = {cardPoints.length}</Lbl>
            <ChartExpandButton onClick={() => { onRequestDetail?.(); setExpanded(true); }} />
          </div>
        </div>
        <div className="h-[200px] w-full">{renderChart(false)}</div>
        <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${MT}` }}>
          <div><Lbl color={DM}>AVG CADENCE</Lbl><p style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>{avgCadence || '—'} <span style={{ fontSize: 11, color: DM }}>spm</span></p></div>
          <div><Lbl color={DM}>OPT. WINDOW</Lbl><p style={{ fontSize: 18, fontWeight: 900, color: N, fontFamily: 'monospace' }}>170-180</p></div>
          <div><Lbl color={DM}>OVER-STRIDE</Lbl><p style={{ fontSize: 18, fontWeight: 900, color: OR, fontFamily: 'monospace' }}>{overStride}%</p></div>
        </div>
      </Panel>
      <ChartFullscreenModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title="Cadence vs Speed Matrix"
        subtitle="Cadenza rispetto alla velocita — finestra ottimale evidenziata"
        accent={CY}
        details={
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]"><Lbl color={DM}>AVG CADENCE</Lbl><p style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>{avgCadence || '—'} spm</p></div>
            <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]"><Lbl color={DM}>OPT. WINDOW</Lbl><p style={{ fontSize: 20, fontWeight: 900, color: N, fontFamily: 'monospace' }}>170-180</p></div>
            <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]"><Lbl color={DM}>OVER-STRIDE</Lbl><p style={{ fontSize: 20, fontWeight: 900, color: OR, fontFamily: 'monospace' }}>{overStride}%</p></div>
          </div>
        }
      >
        {renderChart(true)}
      </ChartFullscreenModal>
    </>
  );
}
function SplitAnalysis() {
  const paceMin = Math.min(...splits.map(s => s.pace));
  const paceMax = Math.max(...splits.map(s => s.pace));
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between mb-5">
        <Lbl color={DM}>SPLIT ANALYSIS â€” LAST LONG RUN</Lbl>
        <Lbl color={N}>NEG. SPLIT: YES</Lbl>
      </div>
      <div className="space-y-2">
        {splits.map((s) => {
          const norm = (s.pace - paceMin) / (paceMax - paceMin);
          const barColor = norm < 0.3 ? N : norm < 0.6 ? CY : norm < 0.8 ? OR : RD;
          const width = `${(1 - norm) * 80 + 20}%`;
          return (
            <div key={s.km} className="flex items-center gap-3">
              <span style={{ width: 22, fontSize: 9, color: DM, fontFamily: 'monospace', fontWeight: 900, textAlign: 'right' }}>K{s.km}</span>
              <div style={{ flex: 1, height: 14, background: S2, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width, background: `${barColor}22`, borderRight: `2px solid ${barColor}` }} />
              </div>
              <span style={{ width: 36, fontSize: 10, fontWeight: 900, color: '#fff', fontFamily: 'monospace', textAlign: 'right' }}>{s.label}</span>
              <span style={{ width: 32, fontSize: 9, fontWeight: 900, fontFamily: 'monospace', textAlign: 'right', color: s.delta < 0 ? N : s.delta > 5 ? RD : DM }}>
                {s.delta < 0 ? '' : '+'}{s.delta}s
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function WeeklyVolume() {
  const movAvg = weekly.map((w, i) => {
    const slice = weekly.slice(Math.max(0, i - 3), i + 1);
    return { ...w, avg: Math.round(slice.reduce((s, x) => s + x.km, 0) / slice.length) };
  });
  return (
    <Panel className="p-6" style={{ gridColumn: 'span 2' }} accent={N}>
      <div className="flex items-center justify-between mb-5">
        <Lbl color={DM}>26-WEEK VOLUME PROGRESSION + MOVING AVG</Lbl>
        <div className="flex items-center gap-5">
          <Lbl color={N}>â–  WEEKLY KM</Lbl>
          <Lbl color={OR}>â€” 4W AVG</Lbl>
          <Lbl color={DM}>--- TARGET 60km</Lbl>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={movAvg} margin={{ top: 4, right: 12, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={N} stopOpacity={0.25} />
              <stop offset="95%" stopColor={N} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={MT} vertical={false} />
          <XAxis dataKey="w" tick={{ fill: DM, fontSize: 8, fontFamily: 'monospace', fontWeight: 900 }} axisLine={false} tickLine={false} interval={3} />
          <YAxis tick={{ fill: DM, fontSize: 9, fontFamily: 'monospace', fontWeight: 900 }} axisLine={false} tickLine={false} domain={[0, 90]} />
          <Tooltip content={<TT />} />
          <ReferenceLine y={60} stroke={DM} strokeDasharray="6 4" strokeWidth={1} label={{ value: 'TARGET', fill: DM, fontSize: 8, fontWeight: 900, position: 'right' }} />
          <Area type="monotone" dataKey="km" name="KM" stroke={N} strokeWidth={2} fill="url(#volGrad)" dot={false} />
          <Line type="monotone" dataKey="avg" name="4W Avg" stroke={OR} strokeWidth={2} dot={false} strokeDasharray="0" />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  );
}

export function AnalyticsV4PaceZoneDistribution({ chart, onRequestDetail }: { chart?: ProAnalyticsChart; onRequestDetail?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const zones = (chart?.series_card ?? []).map((z) => ({
    zone: String(z.zone ?? z.name ?? ''),
    pace: String(z.name ?? z.zone ?? ''),
    pct: Number(z.pct ?? 0),
    color: String(z.color ?? N),
  })).filter((z) => z.zone);
  const easyPct = Math.round(zones.filter((z) => ['Z1', 'Z2'].includes(z.zone)).reduce((s, z) => s + z.pct, 0));
  const highPct = Math.round(zones.filter((z) => ['Z4', 'Z5'].includes(z.zone)).reduce((s, z) => s + z.pct, 0));
  const renderZones = (isExpanded = false) => {
    if (!zones.length) {
      return <div className="h-[180px] flex items-center justify-center text-[#555] text-xs font-black tracking-widest uppercase">Dati reali insufficienti</div>;
    }
    return (
    <div className={`${isExpanded ? 'h-full flex flex-col justify-center gap-5' : 'mt-5 space-y-3'}`}>
      {zones.map((z) => (
        <div key={z.zone}>
          <div className="flex items-center justify-between mb-1">
            <Lbl color={z.color}>{z.zone}</Lbl>
            <div className="flex items-center gap-3">
              <Lbl color={DM}>{z.pace}</Lbl>
              <span style={{ fontSize: isExpanded ? 18 : 13, fontWeight: 900, color: '#fff', fontFamily: 'monospace', width: isExpanded ? 46 : 32, textAlign: 'right' }}>{z.pct}%</span>
            </div>
          </div>
          <div style={{ height: isExpanded ? 10 : 6, background: S2, width: '100%' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, z.pct)}%`,
                background: z.color,
                transition: 'width 0.8s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
  };

  return (
    <>
      <Panel className="p-6 group" accent={N}>
        <div className="flex items-center justify-between gap-3">
          <Lbl color={DM}>DISTRIBUZIONE ZONE DI PASSO — ULTIMI 90 GIORNI</Lbl>
          <ChartExpandButton onClick={() => { onRequestDetail?.(); setExpanded(true); }} />
        </div>
        {renderZones(false)}
        <div className="mt-5 pt-4 grid grid-cols-2 gap-4" style={{ borderTop: `1px solid ${MT}` }}>
          <div>
            <Lbl color={DM}>RAPPORTO 80/20</Lbl>
            <p style={{ fontSize: 22, fontWeight: 900, color: N, fontFamily: 'monospace', marginTop: 2 }}>{easyPct} / {highPct}</p>
            <Lbl color={OR}>OBIETTIVO: 80/20</Lbl>
          </div>
          <div>
            <Lbl color={DM}>GIORNI AD ALTA INTENSITA</Lbl>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'monospace', marginTop: 2 }}>{chart?.quality?.sample_size ?? 0} <span style={{ fontSize: 12, color: DM }}>corse</span></p>
            <Lbl color={DM}>ENTRO I LIMITI</Lbl>
          </div>
        </div>
      </Panel>
      <ChartFullscreenModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title="Distribuzione Zone di Passo"
        subtitle="Ultimi 90 giorni — rapporto intensita"
        accent={N}
        details={
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]"><Lbl color={DM}>RAPPORTO 80/20</Lbl><p style={{ fontSize: 22, fontWeight: 900, color: N, fontFamily: 'monospace' }}>{easyPct} / {highPct}</p></div>
            <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]"><Lbl color={DM}>CORSE VALIDATE</Lbl><p style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>{chart?.quality?.sample_size ?? 0}</p></div>
          </div>
        }
      >
        {renderZones(true)}
      </ChartFullscreenModal>
    </>
  );
}
function ShoeWearRadar() {
  return (
    <Panel className="p-6" accent={OR}>
      <div className="flex items-center justify-between mb-5">
        <Lbl color={DM}>FOOTWEAR WEAR PATTERN</Lbl>
        <div className="flex items-center gap-4">
          <Lbl color={N}>â€” L</Lbl>
          <Lbl color={OR}>â€” R</Lbl>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={shoeRadar} outerRadius={80}>
          <PolarGrid stroke={MT} strokeDasharray="2 4" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: DM, fontSize: 9, fontFamily: 'monospace', fontWeight: 900 }} />
          <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
          <Tooltip content={<TT />} />
          <Radar name="Left" dataKey="A" stroke={N} fill={N} fillOpacity={0.18} strokeWidth={2} />
          <Radar name="Right" dataKey="B" stroke={OR} fill={OR} fillOpacity={0.18} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-between mt-2 pt-4" style={{ borderTop: `1px solid ${MT}` }}>
        <div><Lbl color={DM}>KM ON SHOE</Lbl><p style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>487 <span style={{ fontSize: 11, color: DM }}>km</span></p></div>
        <div><Lbl color={DM}>ESTIMATED LIFE</Lbl><p style={{ fontSize: 18, fontWeight: 900, color: N, fontFamily: 'monospace' }}>~113 km</p></div>
        <div><Lbl color={DM}>HEEL DROP Î”</Lbl><p style={{ fontSize: 18, fontWeight: 900, color: OR, fontFamily: 'monospace' }}>-1.2 mm</p></div>
      </div>
    </Panel>
  );
}

function ElevationHR() {
  return (
    <Panel className="p-6" accent={PU}>
      <div className="flex items-center justify-between mb-5">
        <Lbl color={DM}>ELEVATION vs CARDIAC RESPONSE</Lbl>
        <Lbl color={PU}>HR DRIFT: +6 BPM</Lbl>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={elvHr} margin={{ top: 4, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={MT} vertical={false} />
          <XAxis dataKey="elev" tick={{ fill: DM, fontSize: 9, fontFamily: 'monospace', fontWeight: 900 }} axisLine={false} tickLine={false} label={{ value: 'ELEV (m)', position: 'insideBottom', fill: DM, fontSize: 8, fontWeight: 900, offset: -2 }} />
          <YAxis yAxisId="hr" tick={{ fill: DM, fontSize: 9, fontFamily: 'monospace', fontWeight: 900 }} axisLine={false} tickLine={false} domain={[130, 185]} />
          <Tooltip content={<TT />} />
          <Area yAxisId="hr" type="monotone" dataKey="hr" name="HR (bpm)" stroke={PU} strokeWidth={2} fill={`${PU}18`} dot={false} />
          <Line yAxisId="hr" type="monotone" dataKey="pace" name="Pace" stroke={RD} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${MT}` }}>
        <div><Lbl color={DM}>CARDIAC EFFICIENCY</Lbl><p style={{ fontSize: 16, fontWeight: 900, color: '#fff', fontFamily: 'monospace', marginTop: 2 }}>1.42 bpm/m</p></div>
        <div><Lbl color={DM}>DECOUPLING</Lbl><p style={{ fontSize: 16, fontWeight: 900, color: PU, fontFamily: 'monospace', marginTop: 2 }}>3.8%</p></div>
        <div><Lbl color={DM}>AEROBIC BASE</Lbl><p style={{ fontSize: 16, fontWeight: 900, color: N, fontFamily: 'monospace', marginTop: 2 }}>SOLID</p></div>
      </div>
    </Panel>
  );
}

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function AnalyticsV4() {
  return (
    <div
      className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700"
      style={{ fontFamily: 'monospace' }}
    >
      {/* â”€â”€ Header terminal strip â”€â”€ */}
      <div
        style={{
          background: S1,
          border: `1px solid ${MT}`,
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className="flex items-center gap-4">
          <span style={{ color: N, fontSize: 10, fontWeight: 900, letterSpacing: '0.3em' }}>RACE ENGINEERING â€” DATA OBSERVATORY v4</span>
          <span style={{ color: MT, fontSize: 9, letterSpacing: '0.2em' }}>SESSION: 2026-04-15 Â· ATHLETE: #00312 Â· STATUS: ACTIVE</span>
        </div>
        <div className="flex items-center gap-6">
          <Lbl color={DM}>VDOT <span style={{ color: N }}>54.2</span></Lbl>
          <Lbl color={DM}>CTL <span style={{ color: CY }}>61.4</span></Lbl>
          <Lbl color={DM}>TSB <span style={{ color: OR }}>+8.2</span></Lbl>
          <div style={{ width: 8, height: 8, background: N, borderRadius: '50%', boxShadow: `0 0 6px ${N}` }} />
        </div>
      </div>

      {/* â”€â”€ KPI Row â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="VO2 MAX ESTIMATE" value="54.2" unit="ml/kg/min" sub="â†‘ Elite Threshold" accent={N} />
        <KpiTile label="WEEKLY VOLUME" value="68.4" unit="km" sub="â†‘ +8.2 vs prev week" accent={CY} />
        <KpiTile label="CHRONIC LOAD" value="61" unit="CTL" sub="Fitness building phase" accent={BL} />
        <KpiTile label="RACE READINESS" value="87" unit="%" sub="June target: 94%" accent={OR} />
      </div>

      {/* â”€â”€ Heatmap full width â”€â”€ */}
      <div className="grid grid-cols-3 gap-4" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <AnalyticsV4PaceZoneDistribution />
        <HeatmapCalendar />
      </div>

      {/* â”€â”€ Lactate + Cadence row â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LactateCurve />
        <AnalyticsV4CadenceSpeedMatrix />
      </div>

      {/* â”€â”€ Split analysis + Shoe radar â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SplitAnalysis />
        <ShoeWearRadar />
      </div>

      {/* â”€â”€ Weekly volume full width â”€â”€ */}
      <div className="grid grid-cols-3 gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <WeeklyVolume />
        <ElevationHR />
      </div>

      {/* â”€â”€ Footer data strip â”€â”€ */}
      <div
        style={{
          background: S1,
          border: `1px solid ${MT}`,
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Lbl color={MT}>DATA LAST SYNC: 2026-04-15 Â· 08:32 UTC+1</Lbl>
        <div className="flex items-center gap-6">
          <Lbl color={DM}>TOTAL RUNS THIS YEAR: <span style={{ color: '#fff' }}>87</span></Lbl>
          <Lbl color={DM}>YTD DISTANCE: <span style={{ color: N }}>1,248 km</span></Lbl>
          <Lbl color={DM}>YTD ELEV: <span style={{ color: CY }}>8,420 m</span></Lbl>
        </div>
      </div>
    </div>
  );
}
