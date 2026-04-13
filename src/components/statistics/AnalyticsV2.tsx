/**
 * ANALYTICS PRO V2 — Cyber-Athletic Dashboard
 * Advanced data-viz with neon accents, glow effects, radial gauges
 */
import React, { useState, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Line, LineChart, Cell, ReferenceLine, Legend,
  ScatterChart, Scatter, ZAxis, ReferenceArea,
} from 'recharts';
import {
  Activity, Zap, TrendingUp, Heart, Timer, Info, Footprints,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const NEON = '#D4FF00';
const NEON_DIM = 'rgba(212,255,0,0.15)';
const CARD_BG = '#1A1A1A';
const CARD_BORDER = '#2A2A2A';
const GRID_COLOR = '#1E1E1E';
const LABEL_COLOR = '#8E8E93';
const BG_DARK = '#111111';

// ─────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────

// PMC — 90 giorni
const pmcV2 = Array.from({ length: 90 }, (_, i) => {
  const noise = Math.sin(i / 7) * 8 + Math.sin(i / 13) * 5;
  const ctl = 32 + i * 0.28 + Math.sin(i / 20) * 3;
  const atl = ctl + noise + (Math.random() * 6 - 3);
  const tsb = ctl - atl;
  const d = new Date();
  d.setDate(d.getDate() - (89 - i));
  return {
    day: d.toLocaleDateString('it', { day: '2-digit', month: 'short' }),
    ctl: Math.round(ctl * 10) / 10,
    atl: Math.round(atl * 10) / 10,
    tsb: Math.round(tsb * 10) / 10,
  };
});

// Pace Trend — 10 mesi (min/km decimale, più basso = più veloce)
const paceTrendV2 = (() => {
  const now = new Date();
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (9 - i), 1);
    const base = 5.8 - i * 0.12 + Math.sin(i / 2) * 0.15;
    return {
      month: d.toLocaleString('it', { month: 'short' }).toUpperCase(),
      pace: Math.round(base * 100) / 100,
    };
  });
})();

// Cardiac Drift — singola sessione, 14 km splits
const driftV2 = Array.from({ length: 14 }, (_, i) => {
  const basePace = 5.15 + (Math.random() * 0.12 - 0.06);
  const baseHr = 142 + i * 1.8 + (Math.random() * 3 - 1.5);
  return {
    km: `${i + 1}`,
    pace: Math.round(basePace * 100) / 100,
    hr: Math.round(baseHr),
  };
});
// Mark divergence zone: from km 8 onward
const DRIFT_START_KM = '8';

// GCT vs Cadence scatter — 40 punti
const scatterV2 = Array.from({ length: 40 }, () => {
  const cadence = 155 + Math.round(Math.random() * 35);
  const gctBase = 310 - cadence * 0.55 + (Math.random() * 30 - 15);
  const gct = Math.round(Math.max(190, Math.min(290, gctBase)));
  const optimal = cadence >= 175 && gct <= 235;
  return { cadence, gct, optimal };
});

// Zone Data
const zonesV2 = [
  { zone: 'Z1', name: 'Recovery', pct: 15, min: 82, color: '#4A4A4A' },
  { zone: 'Z2', name: 'Aerobic',  pct: 42, min: 228, color: '#6366F1' },
  { zone: 'Z3', name: 'Tempo',    pct: 22, min: 120, color: '#8B5CF6' },
  { zone: 'Z4', name: 'Threshold',pct: 14, min: 76,  color: '#A78BFA' },
  { zone: 'Z5', name: 'VO₂max',  pct: 7,  min: 38,  color: NEON },
];

// ─────────────────────────────────────────────────────────────
// SHARED SVG GLOW FILTER
// ─────────────────────────────────────────────────────────────
function GlowDefs() {
  return (
    <svg width="0" height="0" className="absolute">
      <defs>
        <filter id="v2-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="v2-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// INFO TOOLTIP (V2 variant)
// ─────────────────────────────────────────────────────────────
function V2Info({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex ml-auto shrink-0">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-[#3A3A3A] hover:text-[#666] transition-colors focus:outline-none"
      >
        <Info size={14} />
      </button>
      {open && (
        <div className="absolute z-50 top-full right-0 mt-2 w-72 bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 shadow-2xl pointer-events-none">
          <div className="text-[10px] font-black tracking-widest mb-2" style={{ color: NEON }}>{title}</div>
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="text-[#777] text-[10px] leading-relaxed flex gap-1.5">
                <span className="text-[#444] shrink-0">›</span>{l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SEMI-CIRCLE GAUGE
// ─────────────────────────────────────────────────────────────
function SemiGauge({
  value, max, label, unit, trend, color,
}: {
  value: number; max: number; label: string; unit: string;
  trend?: number; color: string;
}) {
  const pct = Math.min(value / max, 1);
  const R = 68;
  const CIRC = Math.PI * R; // semicircle length
  const offset = CIRC * (1 - pct);

  // Arc path: left to right through top
  const startX = 80 - R;
  const endX = 80 + R;
  const Y = 78;
  const path = `M ${startX} ${Y} A ${R} ${R} 0 0 1 ${endX} ${Y}`;

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="95" viewBox="0 0 160 95" overflow="visible">
        {/* Background arc */}
        <path d={path} fill="none" stroke="#1E1E1E" strokeWidth="10" strokeLinecap="round" />
        {/* Value arc */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          filter="url(#v2-glow)"
          className="transition-all duration-1000"
        />
        {/* Center value */}
        <text x="80" y="58" textAnchor="middle" className="fill-white text-[28px] font-black italic" fontWeight="900" fontStyle="italic">
          {value}
        </text>
        <text x="80" y="73" textAnchor="middle" fill={LABEL_COLOR} fontSize="9" fontWeight="700" letterSpacing="0.1em">
          {unit}
        </text>
      </svg>
      <div className="text-center -mt-1">
        <div className="text-[10px] font-black text-[#555] uppercase tracking-[0.2em]">{label}</div>
        {trend !== undefined && (
          <div className={`text-xs font-black mt-0.5 ${trend >= 0 ? 'text-[#D4FF00]' : 'text-[#F43F5E]'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CUSTOM TOOLTIP
// ─────────────────────────────────────────────────────────────
function V2Tooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm">
      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: NEON }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs mb-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color || p.stroke }} />
          <span className="text-[#777]">{p.name}:</span>
          <span className="text-white font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// V2 CARD
// ─────────────────────────────────────────────────────────────
function V2Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[${CARD_BG}] border border-[${CARD_BORDER}] rounded-2xl p-7 ${className}`}
      style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}>
      {children}
    </div>
  );
}

function V2Header({
  icon: Icon, title, subtitle, tooltip,
}: {
  icon: React.ElementType; title: string; subtitle?: string;
  tooltip?: { title: string; lines: string[] };
}) {
  return (
    <div className="flex items-start justify-between mb-6 gap-3">
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 shrink-0" style={{ color: NEON }} />
        <div>
          <h3 className="text-sm font-black tracking-widest uppercase italic leading-none text-white">{title}</h3>
          {subtitle && <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: LABEL_COLOR }}>{subtitle}</p>}
        </div>
      </div>
      {tooltip && <V2Info title={tooltip.title} lines={tooltip.lines} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
interface AnalyticsV2Props {
  vdot: number | null;
  zoneDistribution?: { zone: string; name: string; pct: number; minutes: number }[];
}

export function AnalyticsV2({ vdot, zoneDistribution }: AnalyticsV2Props) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      <GlowDefs />

      {/* ════════════════════════════════════════════════════
          1. PMC — FULL WIDTH
      ════════════════════════════════════════════════════ */}
      <V2Card>
        <V2Header
          icon={Activity}
          title="Performance Management Chart"
          subtitle="Fitness (CTL) · Fatigue (ATL) · Form (TSB) — 90 giorni"
          tooltip={{
            title: 'PMC — BANISTER MODEL',
            lines: [
              'CTL (Fitness): media mobile 42gg del carico. Sale con allenamento costante.',
              'ATL (Fatigue): media mobile 7gg. Sale rapidamente, si dissipa in fretta.',
              'TSB (Form): CTL − ATL. Positivo = fresco, negativo = affaticato.',
              'Zona verde: TSB > 0, picco prestativo. Zona rossa: overreaching.',
              'Modello Banister-Coggan con decay esponenziali.',
            ],
          }}
        />
        <div className="flex gap-6 text-[9px] font-black uppercase tracking-widest mb-6">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#6366F1]" /> Fitness (CTL)</span>
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#F43F5E]" /> Fatigue (ATL)</span>
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON }} /> Form (TSB)</span>
        </div>
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pmcV2} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="v2-ctl-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="day" stroke="#333" fontSize={9} tickLine={false} axisLine={false} interval={14} />
              <YAxis yAxisId="left" stroke="#333" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#333" fontSize={9} tickLine={false} axisLine={false} domain={[-30, 30]} />
              <Tooltip content={<V2Tooltip />} />
              <ReferenceLine yAxisId="right" y={0} stroke="#333" strokeDasharray="4 4" />
              {/* TSB Bars */}
              <Bar yAxisId="right" dataKey="tsb" name="Form (TSB)" radius={[2, 2, 0, 0]} maxBarSize={6} opacity={0.7}>
                {pmcV2.map((e, i) => (
                  <Cell key={i} fill={e.tsb >= 0 ? NEON : '#F43F5E'} />
                ))}
              </Bar>
              {/* CTL Area */}
              <Area yAxisId="left" type="monotone" dataKey="ctl" name="Fitness (CTL)" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#v2-ctl-grad)" />
              {/* ATL Line */}
              <Line yAxisId="left" type="monotone" dataKey="atl" name="Fatigue (ATL)" stroke="#F43F5E" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </V2Card>

      {/* ════════════════════════════════════════════════════
          2. GAUGES + PACE TREND
      ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-12 gap-6">
        {/* VDOT Gauge */}
        <V2Card className="col-span-3 flex flex-col items-center justify-center">
          <V2Header
            icon={Zap}
            title="VDOT"
            tooltip={{
              title: 'VDOT — VO₂MAX EQUIVALENTE',
              lines: [
                'Indice Jack Daniels che stima VO₂max dal ritmo di gara.',
                'Aggiornato ad ogni sync. Solo corse ≥ 5K qualificanti.',
                'Trend: variazione rispetto al mese precedente.',
              ],
            }}
          />
          <SemiGauge
            value={vdot ?? 42}
            max={65}
            label="VO₂max equiv."
            unit="ml/kg/min"
            trend={vdot ? 1.3 : undefined}
            color={NEON}
          />
        </V2Card>

        {/* AT Gauge */}
        <V2Card className="col-span-3 flex flex-col items-center justify-center">
          <V2Header
            icon={Heart}
            title="Soglia AT"
            tooltip={{
              title: 'SOGLIA ANAEROBICA',
              lines: [
                'FC alla soglia lattato: punto di svolta metabolico.',
                'Passo alla soglia: velocità sostenibile 40–60 min.',
                'Miglioramento = soglia che sale (HR) e passo che scende.',
              ],
            }}
          />
          <SemiGauge
            value={165}
            max={200}
            label="Threshold HR"
            unit="bpm"
            trend={3}
            color="#A78BFA"
          />
          <div className="mt-3 text-center">
            <span className="text-lg font-black italic text-white">5:05</span>
            <span className="text-[10px] text-[#666] ml-1">/km</span>
          </div>
        </V2Card>

        {/* Pace Trend */}
        <V2Card className="col-span-6">
          <V2Header
            icon={TrendingUp}
            title="Pace Trend"
            subtitle="Passo medio mensile — Y invertita (più basso = più veloce)"
            tooltip={{
              title: 'ANDAMENTO PACE',
              lines: [
                'Asse Y invertito: valori bassi sono in alto (= più veloce).',
                'Trend discendente = miglioramento fitness aerobica.',
                'Il gradiente neon evidenzia la zona di performance.',
                'Ideale: calo costante 0.05–0.10 min/km al mese.',
              ],
            }}
          />
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={paceTrendV2} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="v2-pace-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={NEON} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="month" stroke="#333" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#333"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  reversed
                  domain={['dataMin - 0.2', 'dataMax + 0.2']}
                  tickFormatter={(v) => {
                    const m = Math.floor(v);
                    const s = Math.round((v - m) * 60);
                    return `${m}:${s.toString().padStart(2, '0')}`;
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const { month, pace } = payload[0].payload;
                    const m = Math.floor(pace);
                    const s = Math.round((pace - m) * 60);
                    return (
                      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: NEON }}>{month}</p>
                        <p className="text-white font-black text-sm">{m}:{s.toString().padStart(2, '0')} /km</p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pace"
                  stroke={NEON}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#v2-pace-grad)"
                  dot={{ r: 4, fill: NEON, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: NEON, stroke: '#000', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </V2Card>
      </div>

      {/* ════════════════════════════════════════════════════
          3. CARDIAC DRIFT + TIME IN ZONES
      ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-12 gap-6">
        {/* Cardiac Drift */}
        <V2Card className="col-span-7">
          <V2Header
            icon={Heart}
            title="Deriva Cardiaca"
            subtitle="Sessione tipo — Passo vs FC per km split"
            tooltip={{
              title: 'CARDIAC DRIFT / DECOUPLING',
              lines: [
                'Passo costante + FC che sale = decoupling (deriva cardiaca).',
                'Zona evidenziata: area di divergenza (da km 8+).',
                'Drift < 5%: eccellente efficienza aerobica.',
                'Drift > 10%: segnale di affaticamento o disidratazione.',
                'Migliora con volume base Z2 e nutrizione in gara.',
              ],
            }}
          />
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={driftV2} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="v2-drift-area" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#F43F5E" stopOpacity={0} />
                    <stop offset="50%" stopColor="#F43F5E" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="km" stroke="#333" fontSize={9} tickLine={false} axisLine={false} label={{ value: 'km', position: 'insideBottomRight', offset: -5, fill: '#555', fontSize: 9 }} />
                <YAxis
                  yAxisId="pace"
                  stroke="#555"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  domain={[4.8, 5.5]}
                  reversed
                  tickFormatter={(v) => {
                    const m = Math.floor(v);
                    const s = Math.round((v - m) * 60);
                    return `${m}:${s.toString().padStart(2, '0')}`;
                  }}
                />
                <YAxis
                  yAxisId="hr"
                  orientation="right"
                  stroke="#555"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  domain={[135, 175]}
                  tickFormatter={(v) => `${v} bpm`}
                />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  const m = Math.floor(d.pace);
                  const s = Math.round((d.pace - m) * 60);
                  return (
                    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: NEON }}>KM {d.km}</p>
                      <div className="flex items-center gap-2 text-xs mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NEON }} />
                        <span className="text-[#777]">Pace:</span>
                        <span className="text-white font-bold">{m}:{s.toString().padStart(2, '0')} /km</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" />
                        <span className="text-[#777]">HR:</span>
                        <span className="text-white font-bold">{d.hr} bpm</span>
                      </div>
                    </div>
                  );
                }} />
                {/* Divergence zone highlight */}
                {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                {/* @ts-expect-error recharts ReferenceArea generic typing issue */}
                <ReferenceArea yAxisId="pace" x1={DRIFT_START_KM} x2="14" fill="url(#v2-drift-area)" />
                <ReferenceLine yAxisId="pace" x={DRIFT_START_KM} stroke="#F43F5E" strokeDasharray="4 4" strokeOpacity={0.5} />
                {/* Pace line */}
                <Line
                  yAxisId="pace"
                  type="monotone"
                  dataKey="pace"
                  name="Pace"
                  stroke={NEON}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: NEON, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: NEON }}
                />
                {/* HR line */}
                <Line
                  yAxisId="hr"
                  type="monotone"
                  dataKey="hr"
                  name="HR"
                  stroke="#F43F5E"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#F43F5E', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#F43F5E' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-4 text-[9px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON }} /> Pace</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#F43F5E]" /> Heart Rate</span>
            <span className="flex items-center gap-2 text-[#F43F5E]/60"><div className="w-6 h-2 bg-[#F43F5E]/10 rounded" /> Zona Drift</span>
          </div>
        </V2Card>

        {/* Time in Zones — thin donut-style bars */}
        <V2Card className="col-span-5">
          <V2Header
            icon={Timer}
            title="Time in Zones"
            subtitle="Distribuzione tempo per zona FC"
            tooltip={{
              title: 'DISTRIBUZIONE ZONE FC',
              lines: [
                'Z1 Recovery (< 68%): recupero attivo.',
                'Z2 Aerobic (68–83%): base aerobica, 80% del volume totale.',
                'Z3 Tempo (84–94%): soglia ventilatorio.',
                'Z4 Threshold (94–99%): ritmo gara.',
                'Z5 VO₂max (> 99%): potenza massima, sprint.',
                'Scala colori: dal grigio scuro al neon per intensità crescente.',
              ],
            }}
          />

          {/* Central donut-ish display */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {(() => {
                  const R = 42;
                  const CIRC = 2 * Math.PI * R;
                  let accumulated = 0;
                  return zonesV2.map((z, i) => {
                    const dash = (z.pct / 100) * CIRC;
                    const gap = CIRC - dash;
                    const offset = -accumulated * (CIRC / 100);
                    accumulated += z.pct;
                    return (
                      <circle
                        key={i}
                        cx="50"
                        cy="50"
                        r={R}
                        fill="none"
                        stroke={z.color}
                        strokeWidth="6"
                        strokeDasharray={`${dash} ${gap}`}
                        strokeDashoffset={-offset}
                        strokeLinecap="butt"
                        className="transition-all duration-700"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black italic text-white">542</span>
                <span className="text-[9px] font-black text-[#555] uppercase tracking-widest">min totali</span>
              </div>
            </div>
          </div>

          {/* Zone breakdown bars */}
          <div className="space-y-3">
            {zonesV2.map((z) => (
              <div key={z.zone}>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                  <span className="text-[#888]">{z.zone} <span className="text-[#555]">{z.name}</span></span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#555]">{z.min} min</span>
                    <span className="text-white w-8 text-right">{z.pct}%</span>
                  </div>
                </div>
                <div className="h-1 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${z.pct}%`, backgroundColor: z.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </V2Card>
      </div>

      {/* ════════════════════════════════════════════════════
          4. GCT vs CADENCE SCATTER — FULL WIDTH
      ════════════════════════════════════════════════════ */}
      <V2Card>
        <V2Header
          icon={Footprints}
          title="GCT vs Cadenza"
          subtitle="Scatter plot — Tempo Contatto Suolo (ms) vs Passi/Minuto (spm)"
          tooltip={{
            title: 'GCT × CADENZA',
            lines: [
              'Ogni punto = una corsa. X = cadenza, Y = GCT.',
              'Zona neon (alto-sx): cadenza alta + GCT bassa = efficienza ottimale.',
              'Punti grigi: rapporto non ottimale, margine di miglioramento.',
              'Elite: > 180 spm e < 210 ms GCT.',
              'Migliora con drill (A-skip, B-skip), pliometria, cues posturali.',
            ],
          }}
        />
        <div className="flex items-center gap-4 mb-4 text-[9px] font-black uppercase tracking-widest">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON }} /> Zona Ottimale</span>
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#333]" /> Fuori Zona</span>
          <span className="text-[#444] ml-auto">Cadenza ≥ 175 spm · GCT ≤ 235 ms</span>
        </div>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: -5, bottom: 10 }}>
              <defs>
                <radialGradient id="v2-optimal-zone" cx="0.3" cy="0.7" r="0.6">
                  <stop offset="0%" stopColor={NEON} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={NEON} stopOpacity={0} />
                </radialGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis
                type="number"
                dataKey="cadence"
                name="Cadenza"
                unit=" spm"
                stroke="#333"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                domain={[150, 195]}
              />
              <YAxis
                type="number"
                dataKey="gct"
                name="GCT"
                unit=" ms"
                stroke="#333"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                domain={[180, 300]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  return (
                    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: d.optimal ? NEON : '#888' }}>
                        {d.optimal ? 'ZONA OTTIMALE' : 'FUORI ZONA'}
                      </p>
                      <div className="text-xs text-white font-bold">
                        {d.cadence} spm · {d.gct} ms
                      </div>
                    </div>
                  );
                }}
              />
              {/* Optimal zone visual */}
              <ReferenceArea
                {...{ x1: 175, x2: 195, y1: 180, y2: 235, fill: NEON, fillOpacity: 0.04, stroke: NEON, strokeDasharray: '4 4' } as any}
              />
              <ReferenceLine x={175} stroke={NEON} strokeOpacity={0.2} strokeDasharray="4 4" />
              <ReferenceLine y={235} stroke={NEON} strokeOpacity={0.2} strokeDasharray="4 4" />
              <Scatter name="Runs" data={scatterV2} isAnimationActive={false}>
                {scatterV2.map((e, i) => (
                  <Cell
                    key={i}
                    fill={e.optimal ? NEON : '#3A3A3A'}
                    fillOpacity={e.optimal ? 0.9 : 0.45}
                    r={e.optimal ? 6 : 4}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </V2Card>

    </div>
  );
}
