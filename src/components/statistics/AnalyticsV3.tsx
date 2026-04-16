/**
 * ANALYTICS PRO V3 — Biomechanics & Telemetry Dashboard
 * Ground Contact Stability · Radar · Efficiency Correlation · Long-Term Adaptation
 */
import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, ReferenceLine, Legend,
  AreaChart, Area, Cell,
} from 'recharts';
import { Activity, Zap, RefreshCw } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────
const NEON   = '#C0FF00';
const ORANGE = '#F97316';
const BG     = '#0A0A0A';
const CARD   = '#111111';
const BORDER = '#1E1E1E';
const GRID   = '#1A1A1A';
const DIM    = '#444444';
const MUTED  = '#666666';

// ─── Mock data ───────────────────────────────────────────────────────────────

const sessionEvolutionData = [
  { s: '1', score: 68, fill: '#4ade80' },
  { s: '2', score: 72, fill: '#84cc16' },
  { s: '3', score: 76, fill: '#a3e635' },
  { s: '4', score: 78, fill: '#C0FF00' },
  { s: '5', score: 80, fill: '#eab308' },
  { s: '6', score: 83, fill: '#f97316' },
  { s: '7', score: 94, fill: '#f97316' },
];

const efficiencyData = [
  { t: '0:00', speed: 2.80, cardiac: 0.62 },
  { t: '5:00', speed: 2.90, cardiac: 0.70 },
  { t: '10:00', speed: 3.05, cardiac: 0.75 },
  { t: '15:00', speed: 3.20, cardiac: 0.78 },
  { t: '20:00', speed: 3.35, cardiac: 0.81 },
  { t: '25:00', speed: 3.42, cardiac: 0.82 },
  { t: '30:00', speed: 3.38, cardiac: 0.83 },
  { t: '35:00', speed: 3.30, cardiac: 0.85 },
  { t: '40:00', speed: 3.22, cardiac: 0.86 },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'];
const adaptationData = MONTHS.map((m, i) => {
  const base  = Math.sin((i / 9) * Math.PI * 1.6) * 40 + 50;
  const stress = 30 + Math.sin(i / 2.5) * 18 + i * 2;
  return { month: m, adaptation: Math.round(base), stress: Math.round(stress) };
});

// ─── Pentagon Radar ──────────────────────────────────────────────────────────

interface RadarAxis { label: string; value: number; max?: number }

function PentagonRadar({ axes }: { axes: RadarAxis[] }) {
  const cx = 140, cy = 130, R = 90;
  const n = axes.length;

  const angle = (i: number) => (i * 2 * Math.PI) / n - Math.PI / 2;
  const pt    = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  // rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  const polyPoints = (r: number) =>
    Array.from({ length: n }, (_, i) => pt(i, r))
      .map(p => `${p.x},${p.y}`)
      .join(' ');

  // data polygon
  const dataPoly = axes
    .map((a, i) => {
      const norm = (a.value / (a.max ?? 100)) * R;
      return `${pt(i, norm).x},${pt(i, norm).y}`;
    })
    .join(' ');

  return (
    <svg width={280} height={260} className="mx-auto">
      {/* Ring backgrounds */}
      {rings.map((r, ri) => (
        <polygon
          key={ri}
          points={polyPoints(R * r)}
          fill="none"
          stroke={ri === rings.length - 1 ? '#2A2A2A' : '#1E1E1E'}
          strokeWidth={1}
        />
      ))}

      {/* Spokes */}
      {axes.map((_, i) => {
        const outer = pt(i, R);
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={outer.x} y2={outer.y}
            stroke={GRID}
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPoly}
        fill={`${NEON}22`}
        stroke={NEON}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data points */}
      {axes.map((a, i) => {
        const norm = (a.value / (a.max ?? 100)) * R;
        const p = pt(i, norm);
        return (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={NEON} stroke={BG} strokeWidth={1.5} />
        );
      })}

      {/* Labels */}
      {axes.map((a, i) => {
        const lp = pt(i, R + 18);
        return (
          <g key={i}>
            <text
              x={lp.x} y={lp.y - 4}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8}
              fontWeight={900}
              fill={MUTED}
              letterSpacing={1.5}
              fontFamily="monospace"
            >
              {a.label.toUpperCase()}
            </text>
            <text
              x={lp.x} y={lp.y + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fontWeight={900}
              fill={NEON}
              fontFamily="monospace"
            >
              {a.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const radarAxes: RadarAxis[] = [
  { label: 'Power',     value: 94.2 },
  { label: 'Speed',     value: 82.1 },
  { label: 'Technique', value: 91.0 },
  { label: 'Recovery',  value: 76.4 },
  { label: 'Stamina',   value: 88.5 },
];

// ─── Spatial Force Distribution ──────────────────────────────────────────────

function SpatialForceMap() {
  return (
    <div className="w-full flex flex-col gap-0">
      {/* Main map area */}
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          height: 420,
          background: '#050505',
          border: `1px solid ${BORDER}`,
        }}
      >
        {/* Subtle grid */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.12 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <line key={`v${i}`} x1={`${(i + 1) * 9.09}%`} y1="0" x2={`${(i + 1) * 9.09}%`} y2="100%" stroke="#2A3A2A" strokeWidth={0.5} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={`${(i + 1) * 11.1}%`} x2="100%" y2={`${(i + 1) * 11.1}%`} stroke="#2A3A2A" strokeWidth={0.5} />
          ))}
        </svg>

        {/* Center divider line */}
        <div
          className="absolute top-0 bottom-0"
          style={{ left: '50%', width: 1, background: 'rgba(80,80,80,0.4)', transform: 'translateX(-50%)' }}
        />

        {/* L label */}
        <span
          className="absolute font-black italic tracking-wider select-none"
          style={{ left: '23%', top: '12%', fontSize: 48, color: 'rgba(160,160,160,0.25)', transform: 'translateX(-50%)' }}
        >L</span>

        {/* R label */}
        <span
          className="absolute font-black italic tracking-wider select-none"
          style={{ left: '77%', top: '12%', fontSize: 48, color: 'rgba(160,160,160,0.25)', transform: 'translateX(-50%)' }}
        >R</span>

        {/* ── Left foot outline ── */}
        <div
          className="absolute"
          style={{
            left: '12%',
            top: '18%',
            width: '30%',
            height: '58%',
            borderRadius: 24,
            border: '1px solid rgba(192,255,0,0.18)',
            background: 'rgba(192,255,0,0.03)',
          }}
        />

        {/* Left glow outer */}
        <div
          className="absolute"
          style={{
            left: '27%',
            top: '62%',
            width: 160,
            height: 160,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(192,255,0,0.45) 0%, rgba(150,220,0,0.2) 35%, rgba(100,180,0,0.06) 65%, transparent 80%)',
            borderRadius: '50%',
            filter: 'blur(8px)',
          }}
        />
        {/* Left glow core */}
        <div
          className="absolute"
          style={{
            left: '27%',
            top: '62%',
            width: 60,
            height: 60,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, #C0FF00 0%, rgba(192,255,0,0.85) 40%, rgba(192,255,0,0.3) 70%, transparent 100%)',
            borderRadius: 14,
            filter: 'blur(2px)',
            boxShadow: `0 0 30px ${NEON}, 0 0 60px rgba(192,255,0,0.3)`,
          }}
        />

        {/* ── Right foot outline ── */}
        <div
          className="absolute"
          style={{
            left: '58%',
            top: '18%',
            width: '30%',
            height: '58%',
            borderRadius: 24,
            border: '1px solid rgba(249,115,22,0.18)',
            background: 'rgba(249,115,22,0.03)',
          }}
        />

        {/* Right glow outer */}
        <div
          className="absolute"
          style={{
            left: '73%',
            top: '62%',
            width: 170,
            height: 170,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(249,115,22,0.45) 0%, rgba(220,100,0,0.2) 35%, rgba(180,70,0,0.06) 65%, transparent 80%)',
            borderRadius: '50%',
            filter: 'blur(9px)',
          }}
        />
        {/* Right glow core */}
        <div
          className="absolute"
          style={{
            left: '73%',
            top: '62%',
            width: 64,
            height: 64,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, #FFB347 0%, rgba(249,115,22,0.9) 40%, rgba(249,115,22,0.3) 70%, transparent 100%)',
            borderRadius: 14,
            filter: 'blur(2px)',
            boxShadow: `0 0 30px ${ORANGE}, 0 0 60px rgba(249,115,22,0.3)`,
          }}
        />

        {/* Center diamond */}
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            width: 18,
            height: 18,
            transform: 'translate(-50%, -50%) rotate(45deg)',
            backgroundColor: NEON,
            boxShadow: `0 0 16px ${NEON}, 0 0 32px rgba(192,255,0,0.4)`,
          }}
        />
      </div>

      {/* ── Metrics bar below map ── */}
      <div
        className="w-full rounded-b-2xl grid grid-cols-2 gap-0"
        style={{ background: '#0D0D0D', border: `1px solid ${BORDER}`, borderTop: 'none' }}
      >
        {/* Pronation Deviation */}
        <div className="px-6 py-4 border-r" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black tracking-widest" style={{ color: MUTED }}>PRONATION DEVIATION</span>
            <span className="text-sm font-black" style={{ color: NEON }}>+1.2%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: '#1A1A1A' }}>
            <div className="h-full rounded-full" style={{ width: '35%', background: `linear-gradient(90deg, #4ade80, ${NEON})` }} />
          </div>
        </div>
        {/* Peak Impact Force */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black tracking-widest" style={{ color: MUTED }}>PEAK IMPACT FORCE</span>
            <span className="text-sm font-black" style={{ color: ORANGE }}>3.48 G</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: '#1A1A1A' }}>
            <div className="h-full rounded-full" style={{ width: '72%', background: `linear-gradient(90deg, #fb923c, ${ORANGE})` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0D0D0D', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '8px 14px' }}>
      <p style={{ color: MUTED, fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 11, fontWeight: 900 }}>
          {p.name}: <span style={{ color: '#fff' }}>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AnalyticsV3() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ══════════════════════════════════════════════════
          GROUND CONTACT STABILITY
      ══════════════════════════════════════════════════ */}
      <div
        className="rounded-3xl p-0 overflow-hidden"
        style={{ background: CARD, border: `1px solid ${BORDER}` }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-8 py-5 border-b"
          style={{ borderColor: BORDER }}
        >
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5" style={{ color: NEON }} />
            <span className="text-base font-black tracking-widest uppercase italic" style={{ color: '#fff' }}>
              Ground Contact Stability
            </span>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black tracking-widest"
            style={{ background: `${NEON}18`, border: `1px solid ${NEON}44`, color: NEON }}
          >
            STABILITY SCORE
            <span className="text-base font-black ml-1">94.2</span>
            <span className="text-[10px]">%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left: Spatial Force Distribution */}
          <div
            className="p-8 border-r"
            style={{ borderColor: BORDER }}
          >
            <p className="text-[9px] font-black tracking-[0.3em] mb-4" style={{ color: DIM }}>
              SPATIAL FORCE DISTRIBUTION
            </p>
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center gap-1.5 text-[10px] font-black" style={{ color: MUTED }}>
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: NEON }} /> OPTIMAL
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-black" style={{ color: MUTED }}>
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: ORANGE }} /> IMBALANCE
              </span>
            </div>
            <SpatialForceMap />
          </div>

          {/* Right: Metrics + Bar chart */}
          <div className="p-8 flex flex-col gap-6">
            {/* Contact Time Off */}
            <div>
              <p className="text-[9px] font-black tracking-[0.3em] mb-1" style={{ color: DIM }}>CONTACT TIME OFF</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black leading-none" style={{ color: '#fff' }}>14</span>
                <span className="text-xl font-black" style={{ color: MUTED }}>ms</span>
              </div>
              <p className="text-[9px] mt-1" style={{ color: MUTED }}>
                Optimal ground contact asymmetry. Bilateral balance within elite range.
              </p>
            </div>

            {/* Two metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div
                className="rounded-2xl px-5 py-4"
                style={{ background: '#0D0D0D', border: `1px solid ${BORDER}` }}
              >
                <p className="text-[9px] font-black tracking-widest mb-1" style={{ color: DIM }}>CADENCE</p>
                <p className="text-2xl font-black" style={{ color: '#fff' }}>178 <span className="text-xs font-bold" style={{ color: MUTED }}>spm</span></p>
              </div>
              <div
                className="rounded-2xl px-5 py-4"
                style={{ background: '#0D0D0D', border: `1px solid ${BORDER}` }}
              >
                <p className="text-[9px] font-black tracking-widest mb-1" style={{ color: DIM }}>STRIDE L.</p>
                <p className="text-2xl font-black" style={{ color: '#fff' }}>8.2 <span className="text-xs font-bold" style={{ color: MUTED }}>m/s</span></p>
              </div>
            </div>

            {/* Session Evolution bar chart */}
            <div>
              <p className="text-[9px] font-black tracking-[0.3em] mb-3" style={{ color: DIM }}>SESSION EVOLUTION</p>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={sessionEvolutionData} barCategoryGap="20%">
                  <XAxis dataKey="s" tick={{ fill: MUTED, fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[50, 100]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div style={{ background: '#0D0D0D', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 900, color: NEON }}>
                          {payload[0].value}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {sessionEvolutionData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sync button */}
            <button
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-xs tracking-widest uppercase transition-all"
              style={{
                background: NEON,
                color: '#000',
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Telemetry Data
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          BOTTOM ROW: Radar + Efficiency Correlation
      ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pentagon Radar */}
        <div
          className="rounded-3xl p-8"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-5 h-5" style={{ color: NEON }} />
            <div>
              <h3 className="text-sm font-black tracking-widest uppercase italic" style={{ color: '#fff' }}>
                Athletic Profile
              </h3>
              <p className="text-[9px] font-black tracking-widest mt-0.5" style={{ color: DIM }}>
                MULTI-AXIS BIOMECH SCORE
              </p>
            </div>
          </div>
          <PentagonRadar axes={radarAxes} />
          <div className="mt-4 grid grid-cols-5 gap-2">
            {radarAxes.map((a) => (
              <div key={a.label} className="text-center">
                <p className="text-[8px] font-black tracking-widest uppercase" style={{ color: MUTED }}>{a.label}</p>
                <p className="text-xs font-black mt-0.5" style={{ color: NEON }}>{a.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Efficiency Correlation */}
        <div
          className="rounded-3xl p-8"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5" style={{ color: ORANGE }} />
              <div>
                <h3 className="text-sm font-black tracking-widest uppercase italic" style={{ color: '#fff' }}>
                  Efficiency Correlation
                </h3>
                <p className="text-[9px] font-black tracking-widest mt-0.5" style={{ color: DIM }}>
                  BOUT RATIO: SPEED OUTPUT VS CARDIAC STRESS
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[9px] font-black" style={{ color: MUTED }}>
                <span className="w-4 border-t-2 border-dashed inline-block" style={{ borderColor: NEON }} /> SPEED OUTPUT
              </span>
              <span className="flex items-center gap-1.5 text-[9px] font-black" style={{ color: MUTED }}>
                <span className="w-4 border-t-2 border-dashed inline-block" style={{ borderColor: ORANGE }} /> CARDIAC STRESS
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={efficiencyData} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fill: MUTED, fontSize: 9, fontWeight: 900 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: MUTED, fontSize: 9, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<DarkTooltip />} />
              {/* Optimal range band */}
              <ReferenceLine y={0.80} stroke={NEON} strokeDasharray="6 3" strokeWidth={1} opacity={0.4} label={{ value: 'OPTIMAL RANGE', position: 'right', fill: NEON, fontSize: 8, fontWeight: 900 }} />
              <Line
                type="monotone"
                dataKey="speed"
                name="Speed Output"
                stroke={NEON}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 4, fill: NEON, stroke: BG, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="cardiac"
                name="Cardiac Stress"
                stroke={ORANGE}
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={{ r: 4, fill: ORANGE, stroke: BG, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Bottom stats */}
          <div
            className="mt-5 grid grid-cols-2 gap-4 pt-5 border-t"
            style={{ borderColor: BORDER }}
          >
            <div>
              <p className="text-[9px] font-black tracking-widest" style={{ color: DIM }}>PEAK SPEED RATIO</p>
              <p className="text-2xl font-black mt-1" style={{ color: '#fff' }}>
                1.42 <span className="text-xs font-bold" style={{ color: MUTED }}>m/s</span>
              </p>
            </div>
            <div>
              <p className="text-[9px] font-black tracking-widest" style={{ color: DIM }}>AVG EFFICIENCY</p>
              <p className="text-2xl font-black mt-1" style={{ color: '#fff' }}>
                0.82 <span className="text-xs font-bold" style={{ color: MUTED }}>km/l</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          LONG-TERM TRAINING ADAPTATION
      ══════════════════════════════════════════════════ */}
      <div
        className="rounded-3xl p-8"
        style={{ background: CARD, border: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5" style={{ color: NEON }} />
            <div>
              <h3 className="text-sm font-black tracking-widest uppercase italic" style={{ color: '#fff' }}>
                Long-Term Training Adaptation
              </h3>
              <p className="text-[9px] font-black tracking-widest mt-0.5" style={{ color: DIM }}>
                SUPERCOMPENSATION CYCLE — STRESS VS ADAPTATION CURVE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 text-[9px] font-black" style={{ color: MUTED }}>
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: `${NEON}80` }} />
              ADAPTATION
            </span>
            <span className="flex items-center gap-1.5 text-[9px] font-black" style={{ color: MUTED }}>
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: `${ORANGE}80` }} />
              RACE DATA
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={adaptationData} margin={{ top: 10, right: 20, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="adaptGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={NEON}   stopOpacity={0.18} />
                <stop offset="95%" stopColor={NEON}   stopOpacity={0} />
              </linearGradient>
              <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={ORANGE} stopOpacity={0.18} />
                <stop offset="95%" stopColor={ORANGE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: MUTED, fontSize: 9, fontWeight: 900 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: MUTED, fontSize: 9, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<DarkTooltip />} />
            {/* Race Date marker */}
            <ReferenceLine
              x="Jul"
              stroke={ORANGE}
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: 'RACE DATE', position: 'top', fill: ORANGE, fontSize: 9, fontWeight: 900 }}
            />
            <Area
              type="monotone"
              dataKey="stress"
              name="Stress"
              stroke={ORANGE}
              strokeWidth={2}
              fill="url(#stressGrad)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="adaptation"
              name="Adaptation"
              stroke={NEON}
              strokeWidth={2.5}
              fill="url(#adaptGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Bottom annotation */}
        <div
          className="mt-5 flex items-center justify-between pt-5 border-t"
          style={{ borderColor: BORDER }}
        >
          <p className="text-[9px] font-black tracking-widest" style={{ color: DIM }}>
            BANISTER-COGGAN SUPERCOMPENSATION MODEL
          </p>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[9px] font-black tracking-widest" style={{ color: DIM }}>PEAK ADAPTATION</p>
              <p className="text-sm font-black" style={{ color: NEON }}>JUNE — JULY WINDOW</p>
            </div>
            <div>
              <p className="text-[9px] font-black tracking-widest" style={{ color: DIM }}>READINESS INDEX</p>
              <p className="text-sm font-black" style={{ color: '#fff' }}>87.4 / 100</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
