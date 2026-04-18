/**
 * ANALYTICS PRO V2 — Cyber-Athletic Dashboard
 * Advanced data-viz with neon accents, glow effects, radial gauges
 */
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Line, LineChart, Cell, ReferenceLine, ReferenceArea, Legend,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import type { GctAnalysisResponse } from '../../api';
import type { Run, FitnessFreshnessPoint, ProAnalyticsChart } from '../../types/api';
import {
  Activity, Zap, TrendingUp, Heart, Timer, Info, Footprints, Maximize2, X,
  Target, Radar,
} from 'lucide-react';
import { ChartExpandButton, ChartFullscreenModal } from './ChartFullscreenModal';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const NEON = '#D4FF00';
const NEON_DIM = 'rgba(212,255,0,0.15)';
const CARD_BG = '#0E0E0E';
const CARD_BORDER = '#1E1E1E';
const GRID_COLOR = '#1E1E1E';
const LABEL_COLOR = '#8E8E93';
const BG_DARK = '#111111';
const RACE_ORANGE = '#FF5B00';

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
function V2Card({
  children,
  className = '',
  accent = NEON,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-7 relative group ${className}`}
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      {children}
    </div>
  );
}

type RacePredictionCardData = {
  distance: string;
  time: string;
  pace: string;
  color: string;
  type: 'gauge' | 'bar';
  value: number;
  target: number;
  trend: string;
  trendColor: string;
};

type RaceReadinessAxis = {
  label: string;
  value: number;
  hint: string;
};

type RaceForecastRow = {
  distance: string;
  time: string;
  pace: string;
  score: number;
  color: string;
  note: string;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function vdotForRaceTime(distanceKm: number, durationMin: number): number {
  const velocity = (distanceKm * 1000) / durationMin;
  const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
  const fraction = 0.8
    + 0.1894393 * Math.exp(-0.012778 * durationMin)
    + 0.2989558 * Math.exp(-0.1932605 * durationMin);
  return vo2 / fraction;
}

function predictRaceSeconds(vdot: number | null, distanceKm: number): number | null {
  if (!vdot || vdot <= 0) return null;
  let low = distanceKm * 2.2;
  let high = distanceKm * 10;

  for (let i = 0; i < 42; i++) {
    const mid = (low + high) / 2;
    if (vdotForRaceTime(distanceKm, mid) > vdot) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.round(high * 60);
}

function formatRaceTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRacePace(seconds: number, distanceKm: number): string {
  const paceSeconds = Math.round(seconds / distanceKm);
  const m = Math.floor(paceSeconds / 60);
  const s = paceSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRaceTrend(currentSeconds: number | null, previousSeconds: number | null): string {
  if (currentSeconds === null || previousSeconds === null) return 'VDOT live projection';
  const delta = currentSeconds - previousSeconds;
  const sign = delta <= 0 ? '-' : '+';
  const abs = Math.abs(Math.round(delta));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${s.toString().padStart(2, '0')} vs 3M`;
}

function RacePredictionCard({
  distance,
  time,
  pace,
  color,
  type,
  value,
  target,
  trend,
  trendColor,
}: RacePredictionCardData) {
  return (
    <div className="bg-[#111] border border-[#1E1E1E] rounded-2xl p-5 relative flex flex-col shadow-xl overflow-hidden hover:border-[#333] transition-colors group aspect-square min-h-0">
      <div className="absolute top-0 left-0 right-0 h-1 transition-all group-hover:h-1.5" style={{ backgroundColor: color }} />

      <div className="flex justify-between items-start mb-5">
        <h3 className="text-2xl font-black italic text-white tracking-tighter">{distance}</h3>
        <Target size={18} className="opacity-40 transition-opacity group-hover:opacity-100" style={{ color }} />
      </div>

      <div className="mb-4">
        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Projected Time</div>
        <div
          className="text-3xl font-black font-mono tracking-tighter -ml-0.5"
          style={{ color, textShadow: `0 0 15px ${color}40` }}
        >
          {time}
        </div>
        <div className="text-[10px] mt-2 font-mono tracking-wide font-medium" style={{ color: trendColor }}>
          {trend}
        </div>
      </div>

      <div className="flex-grow flex items-center justify-center py-2 h-[72px]">
        {type === 'gauge' ? (
          <RaceGauge value={value} color={color} target={target} />
        ) : (
          <RaceLinearBar value={value} color={color} target={target} />
        )}
      </div>

      <div className="mt-auto border-t border-[#1E1E1E] pt-4 flex justify-between items-end">
        <div>
          <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-1">Target Pace</div>
          <div className="text-sm font-black font-mono text-gray-200">
            {pace} <span className="text-[10px] text-gray-500 font-sans tracking-wide">/km</span>
          </div>
        </div>
        <div className="text-[9px] uppercase tracking-widest font-black flex items-center gap-1" style={{ color }}>
          Analyze
        </div>
      </div>
    </div>
  );
}

function RaceGauge({ value, color, target }: { value: number; color: string; target: number }) {
  const radius = 40;
  const arcLength = Math.PI * radius;
  const strokeVal = clamp01(value) * arcLength;
  const angle = Math.PI - (clamp01(value) * Math.PI);
  const nx = 50 + 35 * Math.cos(angle);
  const ny = 55 - 35 * Math.sin(angle);
  const targetAngle = Math.PI - (clamp01(target) * Math.PI);
  const tx = 50 + 40 * Math.cos(targetAngle);
  const ty = 55 - 40 * Math.sin(targetAngle);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 100 60" className="w-[85%] max-w-[150px] drop-shadow-lg overflow-visible">
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#222" strokeWidth="6" strokeLinecap="round" />
        <circle cx={tx} cy={ty} r="3.5" fill={RACE_ORANGE} />
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${strokeVal} ${arcLength}`}
          className="transition-all duration-1000 ease-out drop-shadow-[0_0_6px_currentColor]"
        />
        <line x1="50" y1="55" x2={nx} y2={ny} stroke="white" strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-1000 ease-out" />
        <circle cx="50" cy="55" r="5" fill="white" className="drop-shadow-md" />
      </svg>
    </div>
  );
}

function RaceLinearBar({ value, color, target }: { value: number; color: string; target: number }) {
  return (
    <div className="w-full flex items-center h-full pb-4">
      <div className="relative w-full h-2 bg-[#222] rounded-full">
        <div
          className="absolute top-0 left-0 bottom-0 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${clamp01(value) * 100}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}80` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
          style={{ left: `calc(${clamp01(target) * 100}% - 6px)`, backgroundColor: RACE_ORANGE, boxShadow: `0 0 8px ${RACE_ORANGE}` }}
        />
        <div className="absolute top-5 left-0 text-[9px] text-gray-600 uppercase font-black tracking-widest">Base</div>
        <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-600 uppercase font-black tracking-widest">Threshold</div>
        <div className="absolute top-5 right-0 text-[9px] text-gray-600 uppercase font-black tracking-widest" style={{ color: `${RACE_ORANGE}AA` }}>Max</div>
      </div>
    </div>
  );
}

function RacePredictionsGrid({ cards }: { cards: RacePredictionCardData[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:gap-5 self-start">
      {cards.map((card) => (
        <div key={card.distance} className="min-w-0">
          <RacePredictionCard {...card} />
        </div>
      ))}
    </div>
  );
}

function RaceReadinessRadarCard({
  axes,
  overall,
  limiter,
  advice,
}: {
  axes: RaceReadinessAxis[];
  overall: number;
  limiter: string;
  advice: string;
}) {
  const center = 105;
  const radius = 72;
  const axisCount = Math.max(axes.length, 1);
  const pointFor = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index / axisCount) * Math.PI * 2;
    const r = radius * clamp01(value / 100);
    return {
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
      labelX: center + Math.cos(angle) * (radius + 30),
      labelY: center + Math.sin(angle) * (radius + 22),
    };
  };
  const polygon = axes.map((axis, index) => {
    const p = pointFor(index, axis.value);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <V2Card accent={NEON}>
      <V2Header
        icon={Radar}
        title="Race Readiness Radar"
        subtitle="Velocita - soglia - endurance - consistenza - freschezza"
        tooltip={{
          title: 'RACE READINESS',
          lines: [
            'Sintesi della prontezza gara dai dati gia caricati in AnalyticsV2.',
            'Velocita e soglia derivano da VDOT, trend passo e threshold pace.',
            'Endurance, consistenza e freschezza usano ultime corse e fitness/freshness.',
          ],
        }}
      />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-center">
        <div className="lg:col-span-3 min-h-[250px] flex items-center justify-center">
          <svg viewBox="0 0 210 210" className="w-full max-w-[300px] overflow-visible">
            {[0.25, 0.5, 0.75, 1].map((level) => {
              const ring = axes.map((_, index) => {
                const p = pointFor(index, level * 100);
                return `${p.x},${p.y}`;
              }).join(' ');
              return (
                <polygon key={level} points={ring} fill="none" stroke="#252525" strokeWidth="1" />
              );
            })}
            {axes.map((axis, index) => {
              const p = pointFor(index, 100);
              return (
                <g key={axis.label}>
                  <line x1={center} y1={center} x2={p.x} y2={p.y} stroke="#242424" strokeWidth="1" />
                  <text
                    x={p.labelX}
                    y={p.labelY}
                    textAnchor={p.labelX < center - 5 ? 'end' : p.labelX > center + 5 ? 'start' : 'middle'}
                    fill={LABEL_COLOR}
                    fontSize="9"
                    fontWeight="900"
                  >
                    {axis.label}
                  </text>
                </g>
              );
            })}
            <polygon points={polygon} fill={NEON_DIM} stroke={NEON} strokeWidth="3" filter="url(#v2-glow-sm)" />
            {axes.map((axis, index) => {
              const p = pointFor(index, axis.value);
              return <circle key={axis.label} cx={p.x} cy={p.y} r="4" fill={NEON} stroke="#050505" strokeWidth="2" />;
            })}
            <text x={center} y={center - 2} textAnchor="middle" fill="white" fontSize="28" fontWeight="900" fontStyle="italic">
              {overall}
            </text>
            <text x={center} y={center + 14} textAnchor="middle" fill={LABEL_COLOR} fontSize="9" fontWeight="900">
              READY
            </text>
          </svg>
        </div>
        <div className="lg:col-span-2 space-y-3">
          {axes.map((axis) => (
            <div key={axis.label} className="bg-[#111] border border-[#242424] rounded-[6px] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[#777] font-black uppercase tracking-widest">{axis.label}</span>
                <span className="text-sm font-mono font-black text-white">{axis.value}%</span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${axis.value}%`, backgroundColor: NEON }} />
              </div>
              <div className="text-[9px] text-[#555] font-bold mt-2 uppercase tracking-widest">{axis.hint}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
        <div className="bg-[#111] border border-[#242424] rounded-[6px] p-4">
          <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Fattore limitante</div>
          <div className="text-white font-black uppercase italic">{limiter}</div>
        </div>
        <div className="bg-[#111] border border-[#242424] rounded-[6px] p-4">
          <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Mossa pratica</div>
          <div className="text-white text-xs font-bold leading-relaxed">{advice}</div>
        </div>
      </div>
    </V2Card>
  );
}

function RaceForecastLab({
  rows,
  bestDistance,
  confidence,
  limiter,
  advice,
}: {
  rows: RaceForecastRow[];
  bestDistance: string;
  confidence: number;
  limiter: string;
  advice: string;
}) {
  return (
    <V2Card className="xl:col-span-2" accent={NEON}>
      <V2Header
        icon={Target}
        title="Race Forecast Lab"
        subtitle="Affidabilita previsioni e distanza piu pronta oggi"
        tooltip={{
          title: 'RACE FORECAST LAB',
          lines: [
            'Mantiene le previsioni gara sopra e aggiunge un riepilogo decisionale.',
            'La confidenza cresce con consistenza, endurance e trend VDOT.',
            'Il limitante principale guida il prossimo allenamento utile.',
          ],
        }}
      />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-4 bg-[#111] border border-[#242424] rounded-[6px] p-5 flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="text-[10px] text-[#555] uppercase tracking-widest font-black">Distanza piu pronta oggi</div>
            <div className="text-5xl font-black italic mt-4" style={{ color: NEON }}>{bestDistance}</div>
            <div className="text-[11px] text-[#777] font-bold uppercase tracking-widest mt-3">Confidenza previsione</div>
          </div>
          <div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-mono font-black text-white">{confidence}</span>
              <span className="text-sm font-black pb-1" style={{ color: NEON }}>%</span>
            </div>
            <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden mt-3">
              <div className="h-full rounded-full" style={{ width: `${confidence}%`, backgroundColor: NEON }} />
            </div>
          </div>
        </div>
        <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((row) => (
            <div key={row.distance} className="bg-[#111] border border-[#242424] rounded-[6px] p-4">
              <div className="flex justify-between items-start gap-3 mb-3">
                <div>
                  <div className="text-white text-lg font-black italic">{row.distance}</div>
                  <div className="text-[10px] text-[#666] uppercase tracking-widest font-bold">{row.note}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-black" style={{ color: row.color }}>{row.time}</div>
                  <div className="text-[9px] text-[#666] font-bold">{row.pace}/km</div>
                </div>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${row.score}%`, backgroundColor: row.color }} />
              </div>
            </div>
          ))}
        </div>
        <div className="xl:col-span-3 space-y-3">
          <div className="bg-[#111] border border-[#242424] rounded-[6px] p-4">
            <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-2">Limitante</div>
            <div className="text-white font-black uppercase italic">{limiter}</div>
          </div>
          <div className="bg-[#111] border border-[#242424] rounded-[6px] p-4">
            <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-2">Prossimo focus</div>
            <div className="text-[#BDBDBD] text-xs font-bold leading-relaxed">{advice}</div>
          </div>
        </div>
      </div>
    </V2Card>
  );
}

const EVOLUTION_RANGES = ['1M', '3M', '6M', 'ALL'] as const;
type EvolutionRange = typeof EVOLUTION_RANGES[number];

type FitnessEvolutionPoint = {
  label: string;
  v: number;
  time: string;
  pace: string;
};

type FitnessEvolutionDataSets = Record<EvolutionRange, FitnessEvolutionPoint[]>;

type FitnessEvolutionCardData = {
  title: string;
  value: string;
  unit: string;
  color: string;
  dataSets: FitnessEvolutionDataSets;
};

function makeEvolutionPoint(label: string, vdotValue: number, distanceKm: number): FitnessEvolutionPoint {
  const seconds = predictRaceSeconds(vdotValue, distanceKm) ?? Math.round(distanceKm * 5 * 60);
  const paceSeconds = Math.max(1, Math.round(seconds / distanceKm));

  return {
    label,
    v: Math.round((700 - paceSeconds) * 10) / 10,
    time: formatRaceTime(seconds),
    pace: `${formatRacePace(seconds, distanceKm)}/km`,
  };
}

function buildFitnessEvolutionDataSets(
  vdotPoints: { name: string; vdot: number }[],
  distanceKm: number,
  fallbackVdot: number,
): FitnessEvolutionDataSets {
  const safePoints = vdotPoints.length > 0
    ? vdotPoints
    : Array.from({ length: 6 }, (_, i) => ({
        name: ['NOV', 'DIC', 'GEN', 'FEB', 'MAR', 'APR'][i],
        vdot: fallbackVdot - (5 - i) * 0.35,
      }));

  const latest = safePoints[safePoints.length - 1]?.vdot ?? fallbackVdot;
  const before = safePoints[Math.max(0, safePoints.length - 2)]?.vdot ?? latest;
  const oneMonth = Array.from({ length: 4 }, (_, i) => {
    const t = i / 3;
    return makeEvolutionPoint(`${i + 1} WK`, before + (latest - before) * t, distanceKm);
  });

  const fromMonthly = (count: number) => safePoints.slice(-count).map(p => makeEvolutionPoint(p.name, p.vdot, distanceKm));

  return {
    '1M': oneMonth,
    '3M': fromMonthly(3),
    '6M': fromMonthly(6),
    ALL: safePoints.map(p => makeEvolutionPoint(p.name, p.vdot, distanceKm)),
  };
}

const EvolutionTooltip = ({ active, payload, color }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;

  return (
    <div className="bg-[#111] border border-[#2A2A2A] p-2.5 rounded-lg shadow-xl whitespace-nowrap z-50 flex flex-col gap-1.5 min-w-[120px]">
      <span className="text-[9px] text-gray-400 font-bold tracking-widest uppercase mb-0.5">{data.label}</span>
      <div className="flex items-center justify-between gap-4">
        <span className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">Tempo</span>
        <span className="font-mono font-black text-xs" style={{ color }}>{data.time}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">Pace</span>
        <span className="font-mono font-bold text-xs text-gray-200">{data.pace}</span>
      </div>
    </div>
  );
};

function FitnessEvolutionCard({
  title,
  value,
  unit,
  dataSets,
  color,
  timeRange,
  onTimeRangeChange,
  fullscreen = false,
}: FitnessEvolutionCardData & {
  timeRange: EvolutionRange;
  onTimeRangeChange: (range: EvolutionRange) => void;
  fullscreen?: boolean;
}) {
  const data = dataSets[timeRange] || [];
  const gradientId = `fitness-evolution-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;

  return (
    <div className={`bg-[#111] border border-[#1E1E1E] rounded-lg p-4 relative flex flex-col shadow-xl overflow-hidden hover:border-[#333] transition-colors group min-h-0 ${fullscreen ? 'h-full' : 'aspect-square'}`}>
      <div className="absolute top-0 left-0 right-0 h-1 transition-all group-hover:h-1.5" style={{ backgroundColor: color }} />

      <div className="flex justify-between items-start mb-2 relative z-10">
        <div className="min-w-0">
          <span className="text-[10px] text-gray-300 font-bold tracking-[0.15em] uppercase mb-1 block truncate">{title}</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl xl:text-3xl font-black text-white tracking-tight font-mono">{value}</span>
            <span className="text-[10px] xl:text-xs font-bold ml-1" style={{ color }}>{unit}</span>
          </div>
        </div>
        <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] flex items-center justify-center border border-[#2A2A2A] transition-transform group-hover:scale-105 shrink-0">
          <TrendingUp size={14} style={{ color }} />
        </div>
      </div>

      <div className="flex-1 min-h-[82px] w-full mt-3 relative z-0 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              content={(props) => <EvolutionTooltip {...props} color={color} />}
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 5, fill: color, stroke: '#111', strokeWidth: 2 }}
              dot={{ r: 3.5, fill: '#111', stroke: color, strokeWidth: 2.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between items-center text-[8px] text-gray-500 font-bold tracking-[0.1em] mt-2 px-1">
        {data.map((d, i) => <span key={`${d.label}-${i}`}>{d.label}</span>)}
      </div>

      <div className="flex bg-[#1A1A1A] rounded-lg p-1 mt-4 border border-[#1E1E1E] select-none shadow-inner">
        {EVOLUTION_RANGES.map(range => (
          <button
            key={range}
            type="button"
            onClick={() => onTimeRangeChange(range)}
            className={`flex-1 text-center py-1.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
              range === timeRange ? 'bg-[#333] text-gray-200 shadow-md' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );
}

function FitnessEvolutionGrid({ cards }: { cards: FitnessEvolutionCardData[] }) {
  const [expanded, setExpanded] = useState(false);
  const [ranges, setRanges] = useState<Record<string, EvolutionRange>>({});
  const rangeFor = (title: string) => ranges[title] ?? '6M';
  const setRangeFor = (title: string, range: EvolutionRange) => {
    setRanges(prev => ({ ...prev, [title]: range }));
  };

  const renderCards = (fullscreen = false) => (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 xl:gap-5 self-start ${fullscreen ? 'h-full grid-rows-2' : ''}`}>
      {cards.map(card => (
        <div key={card.title} className="min-w-0 min-h-0">
          <FitnessEvolutionCard
            {...card}
            timeRange={rangeFor(card.title)}
            onTimeRangeChange={(range) => setRangeFor(card.title, range)}
            fullscreen={fullscreen}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative group">
      <div className="absolute right-3 top-3 z-10">
        <ChartExpandButton onClick={() => setExpanded(true)} />
      </div>
      {renderCards(false)}
      <ChartFullscreenModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title="Performance Evolution"
        subtitle="Previsioni gara nel tempo — range sincronizzati"
        accent={NEON}
      >
        {renderCards(true)}
      </ChartFullscreenModal>
    </div>
  );
}

function V2Header({
  icon: Icon, title, subtitle, tooltip, onExpand,
}: {
  icon: React.ElementType; title: string; subtitle?: string;
  tooltip?: { title: string; lines: string[] };
  onExpand?: () => void;
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
      <div className="flex items-center gap-1 shrink-0">
        {onExpand && (
          <button onClick={onExpand} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[#2A2A2A] text-[#555] hover:text-[#D4FF00]">
            <Maximize2 size={15} />
          </button>
        )}
        {tooltip && <V2Info title={tooltip.title} lines={tooltip.lines} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
interface AnalyticsV2Props {
  vdot: number | null;
  zoneDistribution?: { zone: string; name: string; pct: number; minutes: number }[];
  gctData?: GctAnalysisResponse | null;
  runs?: Run[];
  ffHistory?: FitnessFreshnessPoint[];
  maxHr?: number;
  thresholdPace?: string | null;
  proCharts?: Record<string, ProAnalyticsChart>;
  onRequestChartDetail?: (chartId: string) => void;
  onlySections?: AnalyticsV2Section[];
  hideSections?: AnalyticsV2Section[];
}

type AnalyticsV2Section = 'pmc' | 'drift' | 'zones' | 'gct';

// pace string "M:SS" → decimal minutes
function parsePaceDecimal(pace: string): number {
  if (!pace) return 0;
  const [m, s] = pace.split(':').map(Number);
  if (isNaN(m) || isNaN(s)) return 0;
  return m + s / 60;
}
// decimal minutes → "M:SS"
function formatPaceStr(dec: number): string {
  if (!dec) return '--';
  const m = Math.floor(dec);
  const s = Math.round((dec - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AnalyticsV2({
  vdot, zoneDistribution, gctData, runs = [],
  ffHistory = [], maxHr, thresholdPace, proCharts = {}, onRequestChartDetail, onlySections, hideSections = [],
}: AnalyticsV2Props) {
  const { t } = useTranslation();
  const hasOnlySections = (onlySections?.length ?? 0) > 0;
  const showCore = !hasOnlySections;
  const showSection = (section: AnalyticsV2Section) => (
    hasOnlySections ? onlySections!.includes(section) : !hideSections.includes(section)
  );

  // ── Scatter: real avg_cadence + avg_ground_contact_time ──────────────
  const scatterData = React.useMemo(() => {
    const backend = proCharts.gct_cadence?.series_card?.length ? proCharts.gct_cadence.series_card : proCharts.gct_cadence?.series_detail;
    if (backend?.length) {
      return backend.map((p) => ({ cadence: Math.round(Number(p.cadence)), gct: Math.round(Number(p.gct)) }));
    }
    const real = runs
      .filter(r => r.avg_cadence != null && r.avg_ground_contact_time != null && !r.is_treadmill)
      .map(r => ({ cadence: Math.round(r.avg_cadence!), gct: Math.round(r.avg_ground_contact_time!) }));
    return real;
  }, [runs, proCharts]);

  // ── PMC: real ffHistory (last 90 days) ───────────────────────────────
  const pmcChartData = React.useMemo(() => {
    if (ffHistory.length >= 10) {
      return ffHistory.slice(-90).map(p => {
        const d = new Date(p.date);
        return {
          day: d.toLocaleDateString('it', { day: '2-digit', month: 'short' }),
          ctl: Math.round(p.ctl * 10) / 10,
          atl: Math.round(p.atl * 10) / 10,
          tsb: Math.round(p.tsb * 10) / 10,
        };
      });
    }
    return [];
  }, [ffHistory]);

  const toPaceTrendData = React.useCallback((points?: Array<Record<string, any>>) => (
    points ?? []
  )
    .filter((d) => d.pace)
    .map((d) => ({
      month: String(d.date),
      pace: Math.round((Number(d.pace) / 60) * 100) / 100,
      runs: Number(d.runs ?? 0),
    })), []);

  const toThresholdTrendData = React.useCallback((points?: Array<Record<string, any>>) => (
    points ?? []
  )
    .filter((d) => d.threshold_pace)
    .map((d) => ({
      month: String(d.date),
      pace: Math.round(Number(d.threshold_pace)),
      hr: Math.round((maxHr ?? 190) * 0.88),
    })), [maxHr]);

  const toVdotTrendData = React.useCallback((points?: Array<Record<string, any>>) => (
    points ?? []
  )
    .filter((d) => d.vdot)
    .map((d) => ({ name: String(d.date), vdot: Number(d.vdot) })), []);

  // ── Pace Trend: monthly card, weekly detail when expanded ────────────
  const paceChartData = React.useMemo(() => {
    const backend = toPaceTrendData(proCharts.trend_passo?.series_card);
    if (backend.length) return backend;
    const now = new Date();
    const data = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (9 - i), 1);
      const monthRuns = runs.filter(r => {
        if (!r.avg_pace || r.is_treadmill) return false;
        const rd = new Date(r.date);
        const secs = parsePaceDecimal(r.avg_pace) * 60;
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth() && secs > 100;
      });
      const avgDec = monthRuns.length > 0
        ? monthRuns.reduce((s, r) => s + parsePaceDecimal(r.avg_pace), 0) / monthRuns.length
        : 0;
      return {
        month: d.toLocaleString('it', { month: 'short' }).toUpperCase(),
        pace: avgDec > 0 ? Math.round(avgDec * 100) / 100 : null,
      };
    }).filter((d): d is { month: string; pace: number } => d.pace !== null && d.pace > 0);
    return data;
  }, [runs, proCharts, toPaceTrendData]);

  const paceDetailData = React.useMemo(() => {
    const backend = toPaceTrendData(proCharts.trend_passo?.series_detail);
    return backend.length ? backend : paceChartData;
  }, [paceChartData, proCharts, toPaceTrendData]);

  // ── Cardiac Drift: splits of most recent long run with HR ────────────
  const { driftChartData, driftRunLabel, driftStartKm } = React.useMemo(() => {
    const suitable = [...runs]
      .filter(r => !r.is_treadmill && r.splits.length >= 6 && r.splits.some(s => s.hr != null))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (!suitable) {
      return { driftChartData: [], driftRunLabel: 'Dati insufficienti', driftStartKm: DRIFT_START_KM };
    }
    const pts = suitable.splits.slice(0, 15).map(s => ({
      km: `${s.km}`,
      pace: parsePaceDecimal(s.pace),
      hr: s.hr ?? 0,
    })).filter(s => s.pace > 0 && s.hr > 0);

    // Find drift start: first km where HR increase > 3 bpm relative to first 3km avg HR
    const baseHr = pts.slice(0, 3).reduce((s, p) => s + p.hr, 0) / Math.min(3, pts.length);
    const driftKm = pts.find((p, i) => i >= 3 && p.hr > baseHr * 1.05)?.km ?? pts[Math.floor(pts.length * 0.6)]?.km ?? '8';

    const label = suitable.date ? new Date(suitable.date).toLocaleDateString('it', { day: '2-digit', month: 'short', year: '2-digit' }) : 'Ultima corsa';
    return { driftChartData: pts, driftRunLabel: label, driftStartKm: driftKm };
  }, [runs]);

  const zonesChartData = React.useMemo(() => {
    const backend = proCharts.pace_zones?.series_card;
    if (backend?.length) {
      return backend.map((z, i) => ({
        zone: String(z.zone ?? `Z${i + 1}`),
        name: String(z.name ?? z.zone ?? ''),
        min: Number(z.km ?? z.minutes ?? 0),
        pct: Number(z.pct ?? 0),
        color: String(z.color ?? zonesV2[i]?.color ?? NEON),
      }));
    }
    return (zoneDistribution ?? []).map((z, i) => ({
      zone: z.zone,
      name: z.name,
      min: z.minutes,
      pct: z.pct,
      color: zonesV2.find((fallback) => fallback.zone === z.zone)?.color ?? zonesV2[i]?.color ?? NEON,
    }));
  }, [proCharts, zoneDistribution]);
  const totalZoneMin = zonesChartData.reduce((s, z) => s + z.min, 0);

  // ── AT Gauge: use maxHr + thresholdPace when available ───────────────
  const atHr = maxHr ? Math.round(maxHr * 0.88) : 165;
  const atPace = thresholdPace ?? '5:05';

  // ── Expand states ─────────────────────────────────────────────────────
  const [atExpanded, setAtExpanded] = useState(false);
  const [pmcExpanded, setPmcExpanded] = useState(false);
  const [paceExpanded, setPaceExpanded] = useState(false);
  const [driftExpanded, setDriftExpanded] = useState(false);
  const [zonesExpanded, setZonesExpanded] = useState(false);
  const [gctExpanded, setGctExpanded] = useState(false);
  const [vdotV2Expanded, setVdotV2Expanded] = useState(false);
  const openExpandedChart = (chartId: string, setter: (open: boolean) => void) => {
    onRequestChartDetail?.(chartId);
    setter(true);
  };

  function formatPaceSecs(secs: number): string {
    if (!secs || secs <= 0) return '--';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const MONTH_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

  const atTrendData = React.useMemo(() => {
    const backend = toThresholdTrendData(proCharts.threshold_progression?.series_card);
    if (backend.length) return backend;
    const now = new Date();
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const monthRuns = runs.filter(r => {
        if (r.is_treadmill || !r.avg_pace || !r.avg_hr) return false;
        const rd = new Date(r.date);
        const sameMonth = rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
        return sameMonth && (r.distance_km ?? 0) >= 3 && r.avg_hr > 80;
      });
      if (monthRuns.length === 0) return null;
      // Pick the run with the highest avg_hr that month
      const best = monthRuns.reduce((prev, cur) => (cur.avg_hr ?? 0) > (prev.avg_hr ?? 0) ? cur : prev);
      const paceSecs = Math.round(parsePaceDecimal(best.avg_pace) * 60);
      const isCurrentYear = d.getFullYear() === now.getFullYear();
      const monthLabel = MONTH_SHORT[d.getMonth()] + (isCurrentYear ? '' : ` ${String(d.getFullYear()).slice(2)}`);
      return {
        month: monthLabel,
        pace: paceSecs,
        hr: best.avg_hr ?? 0,
      };
    }).filter((d): d is { month: string; pace: number; hr: number } => d !== null);

    return monthly;
  }, [runs, maxHr, proCharts, toThresholdTrendData]);

  const atTrendDetailData = React.useMemo(() => {
    const backend = toThresholdTrendData(proCharts.threshold_progression?.series_detail);
    return backend.length ? backend : atTrendData;
  }, [atTrendData, proCharts, toThresholdTrendData]);

  // ── VDOT estimator ────────────────────────────────────────────────────
  function estimateVdotV2(distanceKm: number, durationMin: number): number | null {
    if (distanceKm <= 0 || durationMin <= 0 || durationMin < 10) return null;
    const v = (distanceKm * 1000) / durationMin;
    const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
    const denom = 0.8 + 0.1894393 * Math.exp(-0.012778 * durationMin) + 0.2989558 * Math.exp(-0.1932605 * durationMin);
    const vdotEst = vo2 / denom;
    if (vdotEst < 28 || vdotEst > 65) return null;
    return parseFloat(vdotEst.toFixed(1));
  }

  // T-Pace from VDOT (Jack Daniels formula — min/km decimal)
  function calcTPaceV2(v: number): string {
    // T-pace in min/km: approximate from VDOT
    const tPaceMs = 1000 / ((-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (v * (0.8 + 0.2989558 * Math.exp(-0.1932605 * 35)) + 4.60))) / (2 * 0.000104) / 1000);
    // Simpler direct approximation used by many coaches:
    const tPaceSecs = (29.54 + 5.000663 * v - 0.007546 * v * v);
    // tPaceSecs is secs per 400m, convert to min/km
    const minPerKm = (tPaceSecs * 1000) / (400 * 60);
    const m = Math.floor(minPerKm);
    const s = Math.round((minPerKm - m) * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const vdotHistory = React.useMemo(() => {
    const now = new Date();
    const raw: (number | null)[] = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const monthRuns = runs.filter(r => {
        if (r.is_treadmill) return false;
        const rd = new Date(r.date);
        const sameMonth = rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
        const paceMinKm = r.avg_pace ? parsePaceDecimal(r.avg_pace) : 99;
        const hrPct = r.avg_hr_pct ?? (maxHr && r.avg_hr ? r.avg_hr / maxHr : 0);
        return sameMonth && (r.distance_km ?? 0) >= 5 && (hrPct >= 0.80 || paceMinKm <= 5.75);
      });
      if (monthRuns.length === 0) return null;
      // Pick best qualifying run (highest estimated VDOT)
      let bestVdot: number | null = null;
      for (const r of monthRuns) {
        const distKm = r.distance_km ?? 0;
        const durationMin = r.duration_minutes > 0 ? r.duration_minutes : (r.avg_pace ? parsePaceDecimal(r.avg_pace) * distKm : 0);
        const est = estimateVdotV2(distKm, durationMin);
        if (est !== null && (bestVdot === null || est > bestVdot)) bestVdot = est;
      }
      return bestVdot;
    });

    // Force last month value to equal vdot prop if available
    if (vdot !== null && vdot !== undefined) {
      raw[11] = vdot;
    }

    // Forward-fill nulls
    let last: number | null = null;
    return raw.map(v2 => {
      if (v2 !== null) { last = v2; return v2; }
      return last;
    });
  }, [runs, vdot, maxHr]);

  const vdotChartData = React.useMemo(() => {
    const backend = toVdotTrendData(proCharts.vo2_vdot_trend?.series_card);
    if (backend.length) return backend;
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const isCurrentYear = d.getFullYear() === now.getFullYear();
      const monthLabel = MONTH_SHORT[d.getMonth()] + (isCurrentYear ? '' : ` ${String(d.getFullYear()).slice(2)}`);
      return {
        name: monthLabel,
        vdot: vdotHistory[i],
      };
    }).filter((d): d is { name: string; vdot: number } => d.vdot !== null);
  }, [vdotHistory, proCharts, toVdotTrendData]);

  const vdotDetailData = React.useMemo(() => {
    const backend = toVdotTrendData(proCharts.vo2_vdot_trend?.series_detail);
    return backend.length ? backend : vdotChartData;
  }, [proCharts, toVdotTrendData, vdotChartData]);

  const atPanel = React.useMemo(() => {
    const latest = atTrendData[atTrendData.length - 1] ?? null;
    const avgPace = atTrendData.length
      ? atTrendData.reduce((sum, p) => sum + p.pace, 0) / atTrendData.length
      : 0;
    const avgHr = atTrendData.length
      ? atTrendData.reduce((sum, p) => sum + p.hr, 0) / atTrendData.length
      : 0;

    const paceValues = atTrendData.map(p => p.pace);
    const hrValues = atTrendData.map(p => p.hr);
    const paceMin = paceValues.length ? Math.min(...paceValues) : 240;
    const paceMax = paceValues.length ? Math.max(...paceValues) : 330;
    const hrMinRaw = hrValues.length ? Math.min(...hrValues) : 150;
    const hrMaxRaw = hrValues.length ? Math.max(...hrValues) : 180;

    const paceDomainMin = Math.min(240, Math.floor((paceMin - 8) / 30) * 30);
    const paceDomainMax = Math.max(330, Math.ceil((paceMax + 8) / 30) * 30);
    const hrDomainMin = Math.min(150, Math.floor((hrMinRaw - 4) / 10) * 10);
    const hrDomainMax = Math.max(180, Math.ceil((hrMaxRaw + 4) / 10) * 10);

    const paceTicks: number[] = [];
    for (let v = paceDomainMin; v <= paceDomainMax; v += 30) paceTicks.push(v);

    const hrTicks: number[] = [];
    for (let v = hrDomainMin; v <= hrDomainMax; v += 10) hrTicks.push(v);

    const paceDelta = latest ? Math.round(latest.pace - avgPace) : 0;
    const hrDelta = latest ? Math.round(latest.hr - avgHr) : 0;

    return {
      latest,
      paceDomain: [paceDomainMin, paceDomainMax] as [number, number],
      paceTicks,
      hrDomain: [hrDomainMin, hrDomainMax] as [number, number],
      hrTicks,
      paceDelta,
      hrDelta,
    };
  }, [atTrendData]);

  const racePredictionCards = React.useMemo<RacePredictionCardData[]>(() => {
    const currentVdot = vdot ?? (vdotChartData.length > 0 ? vdotChartData[vdotChartData.length - 1]?.vdot : null);
    const olderVdot = vdotChartData.length >= 4 ? vdotChartData[vdotChartData.length - 4]?.vdot : null;
    const sourceVdot = currentVdot ?? 52;
    const vdotShift = (sourceVdot - 52) / 20;

    const definitions = [
      { distance: '5K', distanceKm: 5, color: NEON, type: 'gauge' as const, baseValue: 0.70, target: 0.80, weight: 0.34, fallbackSeconds: 1122 },
      { distance: '10K', distanceKm: 10, color: NEON, type: 'gauge' as const, baseValue: 0.55, target: 0.55, weight: 0.30, fallbackSeconds: 2355 },
      { distance: 'HALF', distanceKm: 21.0975, color: RACE_ORANGE, type: 'gauge' as const, baseValue: 0.85, target: 0.95, weight: 0.22, fallbackSeconds: 5200 },
      { distance: 'FULL', distanceKm: 42.195, color: RACE_ORANGE, type: 'gauge' as const, baseValue: 0.35, target: 0.50, weight: 0.36, fallbackSeconds: 11520 },
    ];

    return definitions.map((def) => {
      const predictedSeconds = predictRaceSeconds(sourceVdot, def.distanceKm) ?? def.fallbackSeconds;
      const previousSeconds = olderVdot ? predictRaceSeconds(olderVdot, def.distanceKm) : null;
      const delta = previousSeconds === null ? null : predictedSeconds - previousSeconds;

      return {
        distance: def.distance,
        time: formatRaceTime(predictedSeconds),
        pace: formatRacePace(predictedSeconds, def.distanceKm),
        color: def.color,
        type: def.type,
        value: clamp01(def.baseValue + vdotShift * def.weight),
        target: def.target,
        trend: formatRaceTrend(predictedSeconds, previousSeconds),
        trendColor: delta === null ? LABEL_COLOR : delta <= 0 ? NEON : RACE_ORANGE,
      };
    });
  }, [vdot, vdotChartData]);

  const fitnessEvolutionCards = React.useMemo<FitnessEvolutionCardData[]>(() => {
    const currentVdot = vdot ?? (vdotChartData.length > 0 ? vdotChartData[vdotChartData.length - 1]?.vdot : null);
    const sourceVdot = currentVdot ?? 52;
    const raceByDistance = new Map<string, RacePredictionCardData>(racePredictionCards.map(card => [card.distance, card]));
    const definitions = [
      { key: '5K', title: '5KM EVOLUTION', distanceKm: 5, unit: '/km', color: NEON },
      { key: '10K', title: '10KM EVOLUTION', distanceKm: 10, unit: '/km', color: NEON },
      { key: 'HALF', title: 'HALF MARATHON', distanceKm: 21.0975, unit: '/tot', color: RACE_ORANGE },
      { key: 'FULL', title: 'MARATHON', distanceKm: 42.195, unit: '/tot', color: RACE_ORANGE },
    ];

    return definitions.map(def => {
      const prediction = raceByDistance.get(def.key);
      return {
        title: def.title,
        value: prediction?.time ?? '—',
        unit: def.unit,
        color: def.color,
        dataSets: buildFitnessEvolutionDataSets(vdotChartData, def.distanceKm, sourceVdot),
      };
    });
  }, [racePredictionCards, vdot, vdotChartData]);

  const raceReadiness = React.useMemo(() => {
    const now = new Date();
    const datedRuns = runs
      .map((run) => ({ run, date: new Date(`${run.date}T12:00:00`) }))
      .filter(({ date }) => !Number.isNaN(date.getTime()));
    const recentDays = (days: number) => datedRuns.filter(({ date }) => (now.getTime() - date.getTime()) / 86400000 <= days);
    const recent35 = recentDays(35);
    const recent56 = recentDays(56);
    const recent90 = recentDays(90);
    const currentVdot = vdot ?? (vdotChartData.length > 0 ? vdotChartData[vdotChartData.length - 1]?.vdot : null) ?? 45;
    const olderVdot = vdotChartData.length >= 4 ? vdotChartData[vdotChartData.length - 4]?.vdot : currentVdot;
    const vdotTrend = currentVdot - olderVdot;
    const firstPace = paceChartData.find((p) => p.pace && p.pace > 0)?.pace ?? null;
    const lastPace = [...paceChartData].reverse().find((p) => p.pace && p.pace > 0)?.pace ?? null;
    const paceGainSec = firstPace && lastPace ? (firstPace - lastPace) * 60 : 0;
    const thresholdSeconds = thresholdPace ? parsePaceDecimal(thresholdPace) * 60 : null;
    const latestTsb = ffHistory.length ? ffHistory[ffHistory.length - 1]?.tsb : null;
    const maxRecentDistance = Math.max(0, ...recent90.map(({ run }) => run.distance_km ?? 0));
    const longRuns = recent90.filter(({ run }) => (run.distance_km ?? 0) >= 14).length;
    const weekKeys = new Set(recent56.map(({ date }) => {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
    }));

    const speed = Math.round(Math.max(35, Math.min(100, 48 + (currentVdot - 38) * 2.3 + paceGainSec * 0.55 + vdotTrend * 5)));
    const threshold = Math.round(Math.max(35, Math.min(100, thresholdSeconds ? 112 - (thresholdSeconds - 240) * 0.32 : 52 + (currentVdot - 40) * 2.1)));
    const endurance = Math.round(Math.max(30, Math.min(100, (maxRecentDistance / 21.1) * 70 + longRuns * 8 + recent90.length * 0.7)));
    const consistency = Math.round(Math.max(25, Math.min(100, (weekKeys.size / 8) * 82 + Math.min(recent56.length, 16) * 1.4)));
    const freshness = Math.round(Math.max(30, Math.min(100, latestTsb == null ? 62 : 58 + latestTsb * 1.6 + Math.min(recent35.length, 12) * 0.6)));
    const axes: RaceReadinessAxis[] = [
      { label: 'Velocita', value: speed, hint: 'VDOT e passo' },
      { label: 'Soglia', value: threshold, hint: 'T-pace e HR' },
      { label: 'Endurance', value: endurance, hint: 'lunghi recenti' },
      { label: 'Consistenza', value: consistency, hint: 'settimane attive' },
      { label: 'Freschezza', value: freshness, hint: 'TSB e carico' },
    ];
    const limiterAxis = axes.reduce((min, axis) => axis.value < min.value ? axis : min, axes[0]);
    const adviceByLimiter: Record<string, string> = {
      Velocita: 'Inserisci 6-8 allunghi o ripetute brevi con recupero pieno.',
      Soglia: 'Fai un blocco tempo controllato da 20-30 minuti a ritmo sostenibile.',
      Endurance: 'Aggiungi un lungo facile progressivo senza forzare il finale.',
      Consistenza: 'Stabilizza la settimana con 3-4 uscite regolari prima di testare.',
      Freschezza: 'Scarica 48 ore e tieni solo mobilita o corsa molto facile.',
    };
    const overall = Math.round(axes.reduce((sum, axis) => sum + axis.value, 0) / axes.length);
    return {
      axes,
      overall,
      limiter: limiterAxis.label,
      advice: adviceByLimiter[limiterAxis.label] ?? 'Mantieni il carico stabile e ritesta dopo una settimana pulita.',
    };
  }, [ffHistory, paceChartData, runs, thresholdPace, vdot, vdotChartData]);

  const raceForecastRows = React.useMemo<RaceForecastRow[]>(() => {
    const scores = new Map(raceReadiness.axes.map((axis) => [axis.label, axis.value]));
    const scoreFor = (distance: string) => {
      const speed = scores.get('Velocita') ?? 60;
      const threshold = scores.get('Soglia') ?? 60;
      const endurance = scores.get('Endurance') ?? 60;
      const consistency = scores.get('Consistenza') ?? 60;
      const freshness = scores.get('Freschezza') ?? 60;
      if (distance === '5K') return speed * 0.42 + threshold * 0.24 + freshness * 0.20 + consistency * 0.14;
      if (distance === '10K') return threshold * 0.36 + speed * 0.25 + endurance * 0.20 + consistency * 0.19;
      if (distance === 'HALF') return endurance * 0.38 + threshold * 0.30 + consistency * 0.20 + freshness * 0.12;
      return endurance * 0.46 + consistency * 0.26 + freshness * 0.16 + threshold * 0.12;
    };
    const noteFor: Record<string, string> = {
      '5K': 'spinta rapida',
      '10K': 'soglia stabile',
      HALF: 'tenuta aerobica',
      FULL: 'volume richiesto',
    };
    return racePredictionCards.map((card) => ({
      distance: card.distance,
      time: card.time,
      pace: card.pace,
      color: card.color,
      score: Math.round(Math.max(0, Math.min(100, scoreFor(card.distance)))),
      note: noteFor[card.distance] ?? 'profilo gara',
    }));
  }, [racePredictionCards, raceReadiness.axes]);

  const raceBestDistance = raceForecastRows.reduce((best, row) => row.score > best.score ? row : best, raceForecastRows[0] ?? {
    distance: '5K',
    score: 0,
    time: '--',
    pace: '--',
    color: NEON,
    note: '',
  }).distance;
  const raceConfidence = Math.round(Math.max(0, Math.min(100, raceForecastRows.reduce((sum, row) => sum + row.score, 0) / Math.max(1, raceForecastRows.length))));

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      <GlowDefs />

      {/* ════════════════════════════════════════════════════
          1. PMC + ANAEROBIC THRESHOLD TREND — SIDE BY SIDE
      ════════════════════════════════════════════════════ */}
      {(showCore || showSection('pmc')) && (
      <div className={`grid gap-6 ${showCore ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
      {showSection('pmc') && (
      <V2Card className="flex flex-col">
        <V2Header
          icon={Activity}
          title={t("statistics.performanceManagementChart")}
          subtitle="Fitness (CTL) · Fatigue (ATL) · Form (TSB) — 90 giorni"
          onExpand={() => openExpandedChart('fitness_freshness', setPmcExpanded)}
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
            <ComposedChart data={pmcChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
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
                {pmcChartData.map((e, i) => (
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
      )}

       {/* Race Predictions — right column */}
       {showCore && <RacePredictionsGrid cards={racePredictionCards} />}
       {showCore && <FitnessEvolutionGrid cards={fitnessEvolutionCards} />}
       {showCore && (
         <RaceForecastLab
           rows={raceForecastRows}
           bestDistance={raceBestDistance}
           confidence={raceConfidence}
           limiter={raceReadiness.limiter}
           advice={raceReadiness.advice}
         />
       )}
       {false && showCore && (
       <V2Card>
         <V2Header
           icon={Zap}
           title="Gara Previsioni"
           subtitle="Stima prestazioni gara basata su VDOT — 12 mesi"
           onExpand={() => openExpandedChart('threshold_progression', setAtExpanded)}
           tooltip={{
             title: 'PREVISIONI GARA',
             lines: [
               'Stima dei tempi di gara basata sull\'indice VDOT.',
               'VDOT: indice Jack Daniels che stima VO₂max dal ritmo di gara.',
               'Ogni mese: miglior stima VDOT tra le corse qualificanti.',
               'Forward-fill: i mesi senza dati mantengono l\'ultimo valore valido.',
               'Ultimo mese forzato al valore VDOT calcolato dal profilo atleta.',
             ],
           }}
         />
         <div className="h-[260px] w-full">
           <ResponsiveContainer width="100%" height="100%">
             <LineChart data={vdotChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
               <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
               <XAxis dataKey="name" stroke="#333" fontSize={9} tickLine={false} axisLine={false} />
               <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false}
                 domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v) => v.toFixed(0)} />
               <Tooltip
                 content={({ active, payload }) => {
                   if (!active || !payload?.length) return null;
                   const d = payload[0]?.payload;
                   if (!d) return null;
                   return (
                     <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                       <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: NEON }}>{d.name}</p>
                       <div className="flex items-center gap-2 text-xs mb-0.5">
                         <span className="text-[#777]">VDOT:</span>
                         <span className="text-white font-bold">{d.vdot}</span>
                       </div>
                       {d.vdot && (
                         <div className="flex items-center gap-2 text-xs">
                           <span className="text-[#777]">5K:</span>
                           <span className="font-bold" style={{ color: NEON }}>{calcTPaceV2(d.vdot)} /km</span>
                         </div>
                       )}
                       {d.vdot && (
                         <div className="flex items-center gap-2 text-xs">
                           <span className="text-[#777]">10K:</span>
                           <span className="font-bold" style={{ color: NEON }}>{calcTPaceV2(d.vdot)} /km</span>
                         </div>
                       )}
                     </div>
                   );
                 }}
               />
               <Line type="monotone" dataKey="vdot" name="VDOT"
                 stroke={NEON} strokeWidth={3}
                 dot={{ r: 4, fill: NEON, strokeWidth: 0 }}
                 activeDot={{ r: 6, fill: NEON, stroke: '#000', strokeWidth: 2 }} />
             </LineChart>
           </ResponsiveContainer>
         </div>
         {/* KPI strip */}
         <div className="flex gap-4 mt-5">
           {(() => {
             const currentVdot = vdot ?? (vdotChartData.length > 0 ? vdotChartData[vdotChartData.length - 1]?.vdot : null);
             const olderVdot = vdotChartData.length >= 4 ? vdotChartData[vdotChartData.length - 4]?.vdot : null;
             const recentVdot = vdotChartData.length >= 1 ? vdotChartData[vdotChartData.length - 1]?.vdot : null;
             const trend3m = (recentVdot != null && olderVdot != null) ? (recentVdot - olderVdot) : null;
             const tPace = currentVdot ? calcTPaceV2(currentVdot) : null;
             return (
               <>
                 <div className="flex-1 bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                   <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">VDOT Attuale</div>
                   <div className="text-xl font-mono font-black" style={{ color: NEON }}>{currentVdot ?? '—'}</div>
                 </div>
                 <div className="flex-1 bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                   <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Trend 3M</div>
                   <div className="text-xl font-mono font-black" style={{ color: trend3m == null ? '#555' : trend3m >= 0 ? NEON : '#F43F5E' }}>
                     {trend3m == null ? '—' : `${trend3m >= 0 ? '+' : ''}${trend3m.toFixed(1)}`}
                   </div>
                 </div>
                 <div className="flex-1 bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                   <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">5K Tempo</div>
                   <div className="text-xl font-mono font-black text-white">{tPace ?? '—'} {tPace ? '/km' : ''}</div>
                 </div>
               </>
             );
           })()}
         </div>
       </V2Card>
       )}
      </div>
      )}

       {/* ════════════════════════════════════════════════════
           2. ANAEROBIC THRESHOLD TREND + VO₂ MAX / VDOT TREND — SIDE BY SIDE
       ════════════════════════════════════════════════════ */}
       {showCore && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
           {/* Anaerobic Threshold Trend — left column */}
           <div
              className="xl:col-span-2 bg-[#111111] border border-[#1B1B1B] rounded-[3px] p-6 flex flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_246px] gap-6 relative group overflow-hidden"
              style={{ minHeight: 402 }}
           >
                <div className="min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                     <h3 className="text-[15px] md:text-base font-black tracking-wider uppercase italic text-[#E7E7E7] leading-none">Progressione Temporale</h3>
                     <p className="text-[9px] font-black uppercase tracking-widest mt-2 text-[#787878]">
                       Passo vs FC (last 12 sessions)
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-5 pr-8 text-[9px] font-black uppercase tracking-widest text-[#3A3A3A]">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON }} />
                      Passo
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#FF4B93]" />
                      Frequenza C.
                    </span>
                    <button
                      onClick={() => openExpandedChart('threshold_progression', setAtExpanded)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[#2A2A2A] text-[#555] hover:text-[#D4FF00]"
                      title="Espandi"
                    >
                      <Maximize2 size={15} />
                    </button>
                  </div>
                </div>
              <div className="h-[312px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={atTrendData} margin={{ top: 12, right: 10, left: -12, bottom: 2 }}>
                    <defs>
                      <linearGradient id="v2-at-panel-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NEON} stopOpacity={0.16} />
                        <stop offset="100%" stopColor={NEON} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1A1A1A" strokeDasharray="1 0" vertical horizontal />
                    <XAxis dataKey="month" stroke="#2F2F2F" fontSize={10} fontWeight={900} tickLine={false} axisLine={false} interval={2} dy={5} />
                    <YAxis yAxisId="pace" reversed stroke="#525252" fontSize={10} fontWeight={900} tickLine={false} axisLine={false}
                      tickFormatter={formatPaceSecs} domain={atPanel.paceDomain} ticks={atPanel.paceTicks} width={42} />
                    <YAxis yAxisId="hr" orientation="right" stroke="#525252" fontSize={10} fontWeight={900} tickLine={false} axisLine={false}
                      domain={atPanel.hrDomain} ticks={atPanel.hrTicks} width={34} />
                   <Tooltip
                      contentStyle={{ backgroundColor: '#151515', borderColor: '#2A2A2A', borderRadius: '4px' }}
                      itemStyle={{ color: '#fff' }}
                      labelStyle={{ color: NEON, fontWeight: 900, textTransform: 'uppercase' }}
                     formatter={(val: number, name: string) =>
                       name === 'Threshold Pace' ? [formatPaceSecs(val) + ' /km', name] : [`${val} bpm`, name]
                     }
                   />
                    <Area yAxisId="pace" type="monotone" dataKey="pace" name="Threshold Pace"
                      stroke={NEON} strokeWidth={2} fill="url(#v2-at-panel-area)" fillOpacity={1}
                      dot={{ r: 3.5, fill: '#111111', stroke: NEON, strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: NEON, stroke: '#111111', strokeWidth: 2 }} />
                    <Line yAxisId="hr" type="monotone" dataKey="hr" name="Threshold HR"
                      stroke="#FF4B93" strokeWidth={2} strokeDasharray="4 5"
                      dot={false}
                      activeDot={{ r: 5, fill: '#FF4B93', stroke: '#111111', strokeWidth: 2 }} />
                    {atPanel.latest && (
                      <ReferenceLine
                        x={atPanel.latest.month}
                        yAxisId="pace"
                        stroke="transparent"
                        label={{ value: 'CURRENT', position: 'insideBottomRight', fill: NEON, fontSize: 10, fontWeight: 900 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              </div>

              <div className="grid grid-rows-2 gap-5 min-h-[312px]">
                <div className="bg-[#242424] border-l-2 p-6 flex flex-col justify-center relative rounded-[2px]" style={{ borderLeftColor: NEON }}>
                  <div className="absolute right-4 top-4 w-9 h-9 rounded-[8px] bg-[#2D350A] flex items-center justify-center">
                    <Timer className="w-4 h-4" style={{ color: NEON }} />
                  </div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-[#A6A6A6]">
                    Passo Soglia <span className="ml-2" style={{ color: NEON }}>Latest</span>
                  </div>
                  <div className="flex items-baseline mt-3">
                    <span className="text-[52px] leading-none italic font-black" style={{ color: NEON }}>
                      {atPanel.latest ? formatPaceSecs(atPanel.latest.pace) : '--'}
                    </span>
                    <span className="text-[18px] italic font-black text-[#DADADA] ml-2">/km</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest font-black mt-4 text-[#A6A6A6]">
                    <span style={{ color: NEON }}>{atPanel.paceDelta >= 0 ? '+' : '-'} {formatPaceSecs(Math.abs(atPanel.paceDelta))}</span>
                    <span className="ml-2">vs avg</span>
                  </div>
                </div>

                <div className="bg-[#242424] border-l-2 p-6 flex flex-col justify-center relative rounded-[2px]" style={{ borderLeftColor: '#FF4B93' }}>
                  <div className="absolute right-4 top-4 w-9 h-9 rounded-[8px] bg-[#3A202D] flex items-center justify-center">
                    <Heart className="w-4 h-4 fill-[#FF4B93]" style={{ color: '#FF4B93' }} />
                  </div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-[#A6A6A6]">
                    FC Soglia <span className="ml-2 text-[#FF4B93]">Latest</span>
                  </div>
                  <div className="flex items-baseline mt-3">
                    <span className="text-[52px] leading-none italic font-black text-[#FF4B93]">
                      {atPanel.latest ? atPanel.latest.hr : '--'}
                    </span>
                    <span className="text-[18px] italic font-black text-[#DADADA] ml-2">bpm</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest font-black mt-4 text-[#A6A6A6]">
                    <span className="text-[#FF4B93]">{atPanel.hrDelta >= 0 ? '+' : '-'} {Math.abs(atPanel.hrDelta)} BPM</span>
                    <span className="ml-2">vs avg</span>
                  </div>
                </div>
              </div>
            </div>

           {/* VO₂ Max / VDOT Trend — right column */}
           <V2Card>
             <V2Header
               icon={Zap}
               title="VO₂ Max / VDOT Trend"
               subtitle="Storico 12 mesi — stima Jack Daniels"
              onExpand={() => openExpandedChart('vo2_vdot_trend', setVdotV2Expanded)}
               tooltip={{
                 title: 'VO₂MAX / VDOT TREND',
                 lines: [
                   'VDOT: indice Jack Daniels calcolato da distanza e durata delle corse qualificanti.',
                   'Qualificanti: ≥ 5km, non treadmill, HRpct ≥ 80% oppure ritmo ≤ 5:45/km.',
                   'Ogni mese: miglior stima VDOT tra le corse qualificanti.',
                   'Forward-fill: i mesi senza dati mantengono l\'ultimo valore valido.',
                   'Ultimo mese forzato al valore VDOT calcolato dal profilo atleta.',
                 ],
               }}
             />
             <div className="h-[260px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={vdotChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                   <defs>
                     <linearGradient id="v2-vdot-grad" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor={NEON} stopOpacity={0.35} />
                       <stop offset="100%" stopColor={NEON} stopOpacity={0} />
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                   <XAxis dataKey="name" stroke="#333" fontSize={9} tickLine={false} axisLine={false} />
                   <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false}
                     domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v) => v.toFixed(0)} />
                   <Tooltip
                     content={({ active, payload }) => {
                       if (!active || !payload?.length) return null;
                       const d = payload[0]?.payload;
                       if (!d) return null;
                       return (
                         <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                           <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: NEON }}>{d.name}</p>
                           <div className="flex items-center gap-2 text-xs mb-0.5">
                             <span className="text-[#777]">VDOT:</span>
                             <span className="text-white font-bold">{d.vdot}</span>
                           </div>
                           {d.vdot && (
                             <div className="flex items-center gap-2 text-xs">
                               <span className="text-[#777]">T-Pace:</span>
                               <span className="font-bold" style={{ color: NEON }}>{calcTPaceV2(d.vdot)} /km</span>
                             </div>
                           )}
                         </div>
                       );
                     }}
                   />
                   <Area type="monotone" dataKey="vdot" name="VDOT"
                     stroke={NEON} strokeWidth={3} fillOpacity={1} fill="url(#v2-vdot-grad)"
                     dot={{ r: 4, fill: NEON, strokeWidth: 0 }}
                     activeDot={{ r: 6, fill: NEON, stroke: '#000', strokeWidth: 2 }} />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
             {/* KPI strip */}
             <div className="flex gap-4 mt-5">
               {(() => {
                 const currentVdot = vdot ?? (vdotChartData.length > 0 ? vdotChartData[vdotChartData.length - 1]?.vdot : null);
                 const olderVdot = vdotChartData.length >= 4 ? vdotChartData[vdotChartData.length - 4]?.vdot : null;
                 const recentVdot = vdotChartData.length >= 1 ? vdotChartData[vdotChartData.length - 1]?.vdot : null;
                 const trend3m = (recentVdot != null && olderVdot != null) ? (recentVdot - olderVdot) : null;
                 const tPace = currentVdot ? calcTPaceV2(currentVdot) : null;
                 return (
                   <>
                     <div className="flex-1 bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                       <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">VDOT Attuale</div>
                       <div className="text-xl font-mono font-black" style={{ color: NEON }}>{currentVdot ?? '—'}</div>
                     </div>
                     <div className="flex-1 bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                       <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Trend 3M</div>
                       <div className="text-xl font-mono font-black" style={{ color: trend3m == null ? '#555' : trend3m >= 0 ? NEON : '#F43F5E' }}>
                         {trend3m == null ? '—' : `${trend3m >= 0 ? '+' : ''}${trend3m.toFixed(1)}`}
                       </div>
                     </div>
                     <div className="flex-1 bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                       <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">T-Pace</div>
                       <div className="text-xl font-mono font-black text-white">{tPace ?? '—'} {tPace ? '/km' : ''}</div>
                     </div>
                   </>
                 );
               })()}
             </div>
           </V2Card>
           <RaceReadinessRadarCard
             axes={raceReadiness.axes}
             overall={raceReadiness.overall}
             limiter={raceReadiness.limiter}
             advice={raceReadiness.advice}
           />
         </div>
       )}

      {/* ════════════════════════════════════════════════════
          2. GAUGES + PACE TREND
      ════════════════════════════════════════════════════ */}
      {showCore && (
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
            value={atHr}
            max={maxHr ?? 200}
            label="Threshold HR"
            unit="bpm"
            color="#A78BFA"
          />
          <div className="mt-3 text-center">
            <span className="text-lg font-black italic text-white">{atPace}</span>
            <span className="text-[10px] text-[#666] ml-1">/km</span>
          </div>
        </V2Card>

        {/* Pace Trend */}
        <V2Card className="col-span-6">
          <V2Header
            icon={TrendingUp}
            title={t("statistics.paceTrend")}
            subtitle="Passo medio mensile — Y invertita (più basso = più veloce)"
            onExpand={() => openExpandedChart('trend_passo', setPaceExpanded)}
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
              <AreaChart data={paceChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
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
      )}

      {/* ════════════════════════════════════════════════════
          3. CARDIAC DRIFT + TIME IN ZONES
      ════════════════════════════════════════════════════ */}
      {(showSection('drift') || showSection('zones')) && (
      <div className="grid grid-cols-12 gap-6">
        {/* Cardiac Drift */}
        {showSection('drift') && (
        <V2Card className={showSection('zones') ? 'col-span-7' : 'col-span-12'}>
          <V2Header
            icon={Heart}
            title={t("statistics.cardiacDrift")}
            subtitle={`${driftRunLabel} — Passo vs FC per km split`}
            onExpand={() => openExpandedChart('cardiac_drift', setDriftExpanded)}
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
              <ComposedChart data={driftChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
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
                  domain={['dataMin - 0.2', 'dataMax + 0.2']}
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
                  domain={['dataMin - 5', 'dataMax + 5']}
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
                <ReferenceArea yAxisId="pace" x1={driftStartKm} x2={driftChartData[driftChartData.length - 1]?.km ?? '14'} fill="url(#v2-drift-area)" />
                <ReferenceLine yAxisId="pace" x={driftStartKm} stroke="#F43F5E" strokeDasharray="4 4" strokeOpacity={0.5} />
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
        )}

        {/* Time in Zones — thin donut-style bars */}
        {showSection('zones') && (
        <V2Card className={showSection('drift') ? 'col-span-5' : 'col-span-12'}>
          <V2Header
            icon={Timer}
            title={t("statistics.timeInZones")}
            subtitle="Distribuzione tempo per zona FC"
            onExpand={() => openExpandedChart('pace_zones', setZonesExpanded)}
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
                  return zonesChartData.map((z, i) => {
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
                <span className="text-2xl font-black italic text-white">{totalZoneMin}</span>
                <span className="text-[9px] font-black text-[#555] uppercase tracking-widest">min totali</span>
              </div>
            </div>
          </div>

          {/* Zone breakdown bars */}
          <div className="space-y-3">
            {zonesChartData.map((z) => (
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
        )}
      </div>
      )}

      {/* ════════════════════════════════════════════════════
          4. GCT TREND — FULL WIDTH (dati reali)
      ════════════════════════════════════════════════════ */}
      {showSection('gct') && (
      <V2Card>
        <V2Header
          icon={Footprints}
          title="GCT vs Cadence"
          subtitle={`Tempo Contatto Suolo (ms) vs Cadenza (spm) · ${scatterData.length} corse`}
          onExpand={() => openExpandedChart('gct_cadence', setGctExpanded)}
          tooltip={{
            title: 'GCT × CADENZA',
            lines: [
              'Ogni punto = una corsa. X = cadenza (spm), Y = GCT (ms).',
              'Neon: zona ottimale — cadenza > 175 spm e GCT < 240 ms.',
              'Grigio: fuori zona ottimale, margine di miglioramento.',
              'Elite: > 180 spm e < 200 ms GCT.',
              'Migliora con drill (A-skip), pliometria, cues posturali.',
            ],
          }}
        />

        <div className="flex items-center gap-6 mb-4 text-[9px] font-black uppercase tracking-widest">
          <span className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON }} />
            Zona Ottimale (cadenza &gt; 175 · GCT &lt; 240)
          </span>
          <span className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#555]" />
            Fuori zona
          </span>
          <span className="text-[#333] ml-auto">
            {scatterData.filter(d => d.cadence > 175 && d.gct < 240).length} / {scatterData.length} ottimali
          </span>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis
                type="number"
                dataKey="cadence"
                name="Cadence"
                stroke={LABEL_COLOR}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={['dataMin - 5', 'dataMax + 5']}
                unit=" spm"
              />
              <YAxis
                type="number"
                dataKey="gct"
                name="GCT"
                stroke={LABEL_COLOR}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={['dataMin - 10', 'dataMax + 10']}
                unit=" ms"
              />
              <ZAxis range={[20, 20]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  const optimal = d.cadence > 175 && d.gct < 240;
                  return (
                    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: optimal ? NEON : '#888' }}>
                        {optimal ? 'ZONA OTTIMALE' : 'FUORI ZONA'}
                      </p>
                      <div className="flex items-center gap-2 text-xs mb-0.5">
                        <span className="text-[#777]">Cadenza:</span>
                        <span className="text-white font-bold">{d.cadence} spm</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#777]">GCT:</span>
                        <span className="text-white font-bold">{d.gct} ms</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter name="Metrics" data={scatterData}>
                {scatterData.map((entry, index) => {
                  const isOptimal = entry.cadence > 175 && entry.gct < 240;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isOptimal ? NEON : '#555555'}
                      fillOpacity={isOptimal ? 0.8 : 0.4}
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </V2Card>
      )}

      {/* ── MODAL EXPANDED ── */}
      {showCore && atExpanded && (() => {
        const expandedAtData = atTrendDetailData.length ? atTrendDetailData : atTrendData;
        const first = expandedAtData[0];
        const last = expandedAtData[expandedAtData.length - 1];
        const improvement = first && last ? first.pace - last.pace : 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-md">
            <div className="bg-[#0E0E0E] border border-[#1E1E1E] rounded-2xl p-6 md:p-8 w-[92vw] max-w-[1500px] shadow-2xl flex flex-col" style={{ height: '68vh', borderLeft: `3px solid ${NEON}` }}>

              {/* Modal header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#222] rounded-xl border border-[#2A2A2A]">
                    <Zap className="w-6 h-6" style={{ color: NEON }} />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-xl tracking-widest uppercase italic">Anaerobic Threshold Trend</h2>
                    <p className="text-[11px] mt-0.5" style={{ color: LABEL_COLOR }}>Dettaglio settimanale passo e FC di soglia anaerobica</p>
                  </div>
                </div>
                <button
                  onClick={() => setAtExpanded(false)}
                  className="p-2 bg-[#222] hover:bg-[#2A2A2A] rounded-full text-white transition-colors border border-[#333]"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Expanded chart */}
              <div className="flex-1 w-full" style={{ minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={expandedAtData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="v2-at-grad-exp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={NEON} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={NEON} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="month" stroke="#555" fontSize={12} tickLine={false} axisLine={false} dy={10} interval="preserveStartEnd" minTickGap={22} />
                    <YAxis yAxisId="pace" reversed stroke="#555" fontSize={12} tickLine={false} axisLine={false}
                      tickFormatter={formatPaceSecs} domain={['dataMin - 15', 'dataMax + 15']}
                      label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft', fill: '#555', dy: 55, fontSize: 10 }} />
                    <YAxis yAxisId="hr" orientation="right" stroke="#555" fontSize={12} tickLine={false} axisLine={false}
                      domain={['dataMin - 10', 'dataMax + 10']} tickFormatter={(v) => `${v} bpm`}
                      label={{ value: 'Heart Rate (bpm)', angle: 90, position: 'insideRight', fill: '#555', dy: -60, fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#151515', borderColor: '#2A2A2A', borderRadius: '4px' }}
                      itemStyle={{ color: '#fff' }}
                      labelStyle={{ color: NEON, fontWeight: 900, textTransform: 'uppercase' }}
                      formatter={(val: number, name: string) =>
                        name === 'Threshold Pace' ? [formatPaceSecs(val) + ' /km', name] : [`${val} bpm`, name]
                      }
                    />
                    <Area yAxisId="pace" type="monotone" dataKey="pace" name="Threshold Pace"
                      stroke={NEON} strokeWidth={3} fillOpacity={1} fill="url(#v2-at-grad-exp)" />
                    <Line yAxisId="hr" type="monotone" dataKey="hr" name="Threshold HR"
                      stroke="#EC4899" strokeWidth={3}
                      dot={{ r: 5, fill: CARD_BG, stroke: '#EC4899', strokeWidth: 2 }}
                      activeDot={{ r: 8, fill: '#EC4899', stroke: '#fff' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Info panels */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Passo Iniziale</div>
                  <div className="text-xl font-mono font-black text-white">{first ? formatPaceSecs(first.pace) : '--'}</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Passo Attuale</div>
                  <div className="text-xl font-mono font-black" style={{ color: NEON }}>{last ? formatPaceSecs(last.pace) : '--'}</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Miglioramento</div>
                  <div className="text-xl font-mono font-black" style={{ color: improvement > 0 ? NEON : '#F43F5E' }}>
                    {improvement > 0 ? '-' : '+'}{formatPaceSecs(Math.abs(improvement))} /km
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── PMC MODAL ── */}
      {showSection('pmc') && pmcExpanded && (() => {
        const lastPmc = pmcChartData[pmcChartData.length - 1];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-md">
            <div className="bg-[#0E0E0E] border border-[#1E1E1E] rounded-2xl p-6 md:p-8 w-[92vw] max-w-[1500px] shadow-2xl flex flex-col" style={{ height: '68vh', borderLeft: `3px solid ${NEON}` }}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#222] rounded-xl border border-[#2A2A2A]">
                    <Activity className="w-6 h-6" style={{ color: NEON }} />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-xl tracking-widest uppercase italic">Performance Management Chart</h2>
                    <p className="text-[11px] mt-0.5" style={{ color: LABEL_COLOR }}>Fitness (CTL) · Fatigue (ATL) · Form (TSB) — 90 giorni</p>
                  </div>
                </div>
                <button onClick={() => setPmcExpanded(false)} className="p-2 bg-[#222] hover:bg-[#2A2A2A] rounded-full text-white transition-colors border border-[#333]">
                  <X size={22} />
                </button>
              </div>
              <div className="flex-1 w-full" style={{ minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pmcChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="v2-ctl-grad-exp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="day" stroke="#555" fontSize={11} tickLine={false} axisLine={false} interval={14} dy={10} />
                    <YAxis yAxisId="left" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#555" fontSize={11} tickLine={false} axisLine={false} domain={[-30, 30]} />
                    <Tooltip content={<V2Tooltip />} />
                    <ReferenceLine yAxisId="right" y={0} stroke="#333" strokeDasharray="4 4" />
                    <Bar yAxisId="right" dataKey="tsb" name="Form (TSB)" radius={[2, 2, 0, 0]} maxBarSize={6} opacity={0.7}>
                      {pmcChartData.map((e, i) => (<Cell key={i} fill={e.tsb >= 0 ? NEON : '#F43F5E'} />))}
                    </Bar>
                    <Area yAxisId="left" type="monotone" dataKey="ctl" name="Fitness (CTL)" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#v2-ctl-grad-exp)" />
                    <Line yAxisId="left" type="monotone" dataKey="atl" name="Fatigue (ATL)" stroke="#F43F5E" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">CTL Attuale</div>
                  <div className="text-xl font-mono font-black" style={{ color: '#6366F1' }}>{lastPmc?.ctl ?? '--'}</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">ATL Attuale</div>
                  <div className="text-xl font-mono font-black" style={{ color: '#F43F5E' }}>{lastPmc?.atl ?? '--'}</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">TSB (Form)</div>
                  <div className="text-xl font-mono font-black" style={{ color: lastPmc && lastPmc.tsb >= 0 ? NEON : '#F43F5E' }}>
                    {lastPmc?.tsb ?? '--'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── PACE TREND MODAL ── */}
      {showCore && paceExpanded && (() => {
        const expandedPaceData = paceDetailData.length ? paceDetailData : paceChartData;
        const paces = expandedPaceData.map(d => d.pace);
        const fastestPace = paces.length > 0 ? Math.min(...paces) : null;
        const slowestPace = paces.length > 0 ? Math.max(...paces) : null;
        const trendSecs = paces.length >= 2 ? Math.round((paces[0] - paces[paces.length - 1]) * 60) : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-md">
            <div className="bg-[#0E0E0E] border border-[#1E1E1E] rounded-2xl p-6 md:p-8 w-[92vw] max-w-[1500px] shadow-2xl flex flex-col" style={{ height: '68vh', borderLeft: `3px solid ${NEON}` }}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#222] rounded-xl border border-[#2A2A2A]">
                    <TrendingUp className="w-6 h-6" style={{ color: NEON }} />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-xl tracking-widest uppercase italic">Pace Trend</h2>
                    <p className="text-[11px] mt-0.5" style={{ color: LABEL_COLOR }}>Passo medio settimanale negli ultimi 12 mesi</p>
                  </div>
                </div>
                <button onClick={() => setPaceExpanded(false)} className="p-2 bg-[#222] hover:bg-[#2A2A2A] rounded-full text-white transition-colors border border-[#333]">
                  <X size={22} />
                </button>
              </div>
              <div className="flex-1 w-full" style={{ minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={expandedPaceData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="v2-pace-grad-exp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NEON} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={NEON} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="month" stroke="#555" fontSize={12} tickLine={false} axisLine={false} dy={10} interval="preserveStartEnd" minTickGap={22} />
                    <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} reversed
                      domain={['dataMin - 0.2', 'dataMax + 0.2']}
                      tickFormatter={(v) => { const m = Math.floor(v); const s = Math.round((v - m) * 60); return `${m}:${s.toString().padStart(2, '0')}`; }} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const { month, pace } = payload[0].payload;
                      const m = Math.floor(pace); const s = Math.round((pace - m) * 60);
                      return (
                        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: NEON }}>{month}</p>
                          <p className="text-white font-black text-sm">{m}:{s.toString().padStart(2, '0')} /km</p>
                        </div>
                      );
                    }} />
                    <Area type="monotone" dataKey="pace" stroke={NEON} strokeWidth={3} fillOpacity={1} fill="url(#v2-pace-grad-exp)"
                      dot={{ r: 5, fill: NEON, strokeWidth: 0 }} activeDot={{ r: 7, fill: NEON, stroke: '#000', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Passo Più Veloce</div>
                  <div className="text-xl font-mono font-black" style={{ color: NEON }}>{fastestPace ? formatPaceStr(fastestPace) : '--'} /km</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Passo Più Lento</div>
                  <div className="text-xl font-mono font-black text-white">{slowestPace ? formatPaceStr(slowestPace) : '--'} /km</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Trend (secs)</div>
                  <div className="text-xl font-mono font-black" style={{ color: trendSecs == null ? '#555' : trendSecs > 0 ? NEON : '#F43F5E' }}>
                    {trendSecs == null ? '—' : `${trendSecs > 0 ? '-' : '+'}${Math.abs(trendSecs)}s`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── CARDIAC DRIFT MODAL ── */}
      {showSection('drift') && driftExpanded && (() => {
        const avgPace = driftChartData.length > 0
          ? driftChartData.reduce((s, d) => s + d.pace, 0) / driftChartData.length : 0;
        const first3Hr = driftChartData.length >= 3
          ? driftChartData.slice(0, 3).reduce((s, d) => s + d.hr, 0) / 3 : 0;
        const last3Hr = driftChartData.length >= 3
          ? driftChartData.slice(-3).reduce((s, d) => s + d.hr, 0) / 3 : 0;
        const driftPct = first3Hr > 0 ? ((last3Hr - first3Hr) / first3Hr * 100) : 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-md">
            <div className="bg-[#0E0E0E] border border-[#1E1E1E] rounded-2xl p-6 md:p-8 w-[92vw] max-w-[1500px] shadow-2xl flex flex-col" style={{ height: '68vh', borderLeft: `3px solid ${NEON}` }}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#222] rounded-xl border border-[#2A2A2A]">
                    <Heart className="w-6 h-6" style={{ color: NEON }} />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-xl tracking-widest uppercase italic">Deriva Cardiaca</h2>
                    <p className="text-[11px] mt-0.5" style={{ color: LABEL_COLOR }}>{driftRunLabel} — Passo vs FC per km split</p>
                  </div>
                </div>
                <button onClick={() => setDriftExpanded(false)} className="p-2 bg-[#222] hover:bg-[#2A2A2A] rounded-full text-white transition-colors border border-[#333]">
                  <X size={22} />
                </button>
              </div>
              <div className="flex-1 w-full" style={{ minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={driftChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="v2-drift-area-exp" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#F43F5E" stopOpacity={0} />
                        <stop offset="50%" stopColor="#F43F5E" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="km" stroke="#555" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis yAxisId="pace" stroke="#555" fontSize={11} tickLine={false} axisLine={false} reversed
                      domain={['dataMin - 0.2', 'dataMax + 0.2']}
                      tickFormatter={(v) => { const m = Math.floor(v); const s = Math.round((v - m) * 60); return `${m}:${s.toString().padStart(2, '0')}`; }} />
                    <YAxis yAxisId="hr" orientation="right" stroke="#555" fontSize={11} tickLine={false} axisLine={false}
                      domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(v) => `${v} bpm`} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      const m = Math.floor(d.pace); const s = Math.round((d.pace - m) * 60);
                      return (
                        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: NEON }}>KM {d.km}</p>
                          <div className="flex items-center gap-2 text-xs mb-0.5"><span className="text-[#777]">Pace:</span><span className="text-white font-bold">{m}:{s.toString().padStart(2, '0')} /km</span></div>
                          <div className="flex items-center gap-2 text-xs"><span className="text-[#777]">HR:</span><span className="text-white font-bold">{d.hr} bpm</span></div>
                        </div>
                      );
                    }} />
                    <ReferenceArea yAxisId="pace" x1={driftStartKm} x2={driftChartData[driftChartData.length - 1]?.km ?? '14'} fill="url(#v2-drift-area-exp)" />
                    <ReferenceLine yAxisId="pace" x={driftStartKm} stroke="#F43F5E" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Line yAxisId="pace" type="monotone" dataKey="pace" name="Pace" stroke={NEON} strokeWidth={3}
                      dot={{ r: 4, fill: NEON, strokeWidth: 0 }} activeDot={{ r: 6, fill: NEON }} />
                    <Line yAxisId="hr" type="monotone" dataKey="hr" name="HR" stroke="#F43F5E" strokeWidth={3}
                      dot={{ r: 4, fill: '#F43F5E', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#F43F5E' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Passo Medio</div>
                  <div className="text-xl font-mono font-black text-white">{formatPaceStr(avgPace)} /km</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">FC Primi 3km</div>
                  <div className="text-xl font-mono font-black text-white">{first3Hr > 0 ? Math.round(first3Hr) : '--'} bpm</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">FC Ultimi 3km + Drift</div>
                  <div className="text-xl font-mono font-black" style={{ color: driftPct > 10 ? '#F43F5E' : driftPct > 5 ? '#F59E0B' : NEON }}>
                    {last3Hr > 0 ? Math.round(last3Hr) : '--'} bpm
                    {driftPct !== 0 && <span className="text-sm ml-2">(+{driftPct.toFixed(1)}%)</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── TIME IN ZONES MODAL ── */}
      {showSection('zones') && zonesExpanded && (() => {
        const dominantZone = [...zonesChartData].sort((a, b) => b.pct - a.pct)[0];
        const z2 = zonesChartData.find(z => z.zone === 'Z2');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-md">
            <div className="bg-[#0E0E0E] border border-[#1E1E1E] rounded-2xl p-6 md:p-8 w-[92vw] max-w-[1500px] shadow-2xl flex flex-col" style={{ height: '68vh', borderLeft: `3px solid ${NEON}` }}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#222] rounded-xl border border-[#2A2A2A]">
                    <Timer className="w-6 h-6" style={{ color: NEON }} />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-xl tracking-widest uppercase italic">Time in Zones</h2>
                    <p className="text-[11px] mt-0.5" style={{ color: LABEL_COLOR }}>Distribuzione tempo per zona frequenza cardiaca</p>
                  </div>
                </div>
                <button onClick={() => setZonesExpanded(false)} className="p-2 bg-[#222] hover:bg-[#2A2A2A] rounded-full text-white transition-colors border border-[#333]">
                  <X size={22} />
                </button>
              </div>
              <div className="flex-1 w-full" style={{ minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={zonesChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
                    <XAxis type="number" stroke="#555" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                    <YAxis type="category" dataKey="zone" stroke="#555" fontSize={12} tickLine={false} axisLine={false} width={30} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: d.color }}>{d.zone} — {d.name}</p>
                          <div className="text-xs"><span className="text-[#777]">Percentuale: </span><span className="text-white font-bold">{d.pct}%</span></div>
                          <div className="text-xs"><span className="text-[#777]">Minuti: </span><span className="text-white font-bold">{d.min}</span></div>
                        </div>
                      );
                    }} />
                    <Bar dataKey="pct" name="%" radius={[0, 4, 4, 0]}>
                      {zonesChartData.map((z, i) => (<Cell key={i} fill={z.color} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Minuti Totali</div>
                  <div className="text-xl font-mono font-black text-white">{totalZoneMin}</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Zona Dominante</div>
                  <div className="text-xl font-mono font-black" style={{ color: dominantZone?.color ?? NEON }}>
                    {dominantZone ? `${dominantZone.zone} ${dominantZone.name}` : '--'}
                  </div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Z2 Aerobic %</div>
                  <div className="text-xl font-mono font-black" style={{ color: (z2?.pct ?? 0) >= 70 ? NEON : (z2?.pct ?? 0) >= 50 ? '#F59E0B' : '#F43F5E' }}>
                    {z2?.pct ?? '--'}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── GCT MODAL ── */}
      {showSection('gct') && gctExpanded && (() => {
        const optimalCount = scatterData.filter(d => d.cadence > 175 && d.gct < 240).length;
        const avgCadence = scatterData.length > 0
          ? Math.round(scatterData.reduce((s, d) => s + d.cadence, 0) / scatterData.length) : 0;
        const avgGct = scatterData.length > 0
          ? Math.round(scatterData.reduce((s, d) => s + d.gct, 0) / scatterData.length) : 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-md">
            <div className="bg-[#0E0E0E] border border-[#1E1E1E] rounded-2xl p-6 md:p-8 w-[92vw] max-w-[1500px] shadow-2xl flex flex-col" style={{ height: '68vh', borderLeft: `3px solid ${NEON}` }}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#222] rounded-xl border border-[#2A2A2A]">
                    <Footprints className="w-6 h-6" style={{ color: NEON }} />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-xl tracking-widest uppercase italic">GCT vs Cadence</h2>
                    <p className="text-[11px] mt-0.5" style={{ color: LABEL_COLOR }}>Tempo Contatto Suolo vs Cadenza — {scatterData.length} corse</p>
                  </div>
                </div>
                <button onClick={() => setGctExpanded(false)} className="p-2 bg-[#222] hover:bg-[#2A2A2A] rounded-full text-white transition-colors border border-[#333]">
                  <X size={22} />
                </button>
              </div>
              <div className="flex-1 w-full" style={{ minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis type="number" dataKey="cadence" name="Cadence" stroke={LABEL_COLOR} fontSize={12}
                      tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} unit=" spm" />
                    <YAxis type="number" dataKey="gct" name="GCT" stroke={LABEL_COLOR} fontSize={12}
                      tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} unit=" ms" />
                    <ZAxis range={[25, 25]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        const optimal = d.cadence > 175 && d.gct < 240;
                        return (
                          <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: optimal ? NEON : '#888' }}>
                              {optimal ? 'ZONA OTTIMALE' : 'FUORI ZONA'}
                            </p>
                            <div className="text-xs mb-0.5"><span className="text-[#777]">Cadenza: </span><span className="text-white font-bold">{d.cadence} spm</span></div>
                            <div className="text-xs"><span className="text-[#777]">GCT: </span><span className="text-white font-bold">{d.gct} ms</span></div>
                          </div>
                        );
                      }} />
                    <Scatter name="Metrics" data={scatterData}>
                      {scatterData.map((entry, index) => {
                        const isOptimal = entry.cadence > 175 && entry.gct < 240;
                        return (<Cell key={`gct-exp-${index}`} fill={isOptimal ? NEON : '#555555'} fillOpacity={isOptimal ? 0.8 : 0.4} />);
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Zona Ottimale</div>
                  <div className="text-xl font-mono font-black" style={{ color: NEON }}>{optimalCount} / {scatterData.length}</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Cadenza Media</div>
                  <div className="text-xl font-mono font-black text-white">{avgCadence > 0 ? `${avgCadence} spm` : '--'}</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">GCT Medio</div>
                  <div className="text-xl font-mono font-black text-white">{avgGct > 0 ? `${avgGct} ms` : '--'}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── VDOT V2 MODAL ── */}
      {showCore && vdotV2Expanded && (() => {
        const expandedVdotData = vdotDetailData.length ? vdotDetailData : vdotChartData;
        const currentVdot = vdot ?? (expandedVdotData.length > 0 ? expandedVdotData[expandedVdotData.length - 1]?.vdot : null);
        const olderVdot = expandedVdotData.length >= 4 ? expandedVdotData[expandedVdotData.length - 4]?.vdot : null;
        const recentVdot = expandedVdotData.length >= 1 ? expandedVdotData[expandedVdotData.length - 1]?.vdot : null;
        const trend3m = (recentVdot != null && olderVdot != null) ? (recentVdot - olderVdot) : null;
        const tPace = currentVdot ? calcTPaceV2(currentVdot) : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-md">
            <div className="bg-[#0E0E0E] border border-[#1E1E1E] rounded-2xl p-6 md:p-8 w-[92vw] max-w-[1500px] shadow-2xl flex flex-col" style={{ height: '68vh', borderLeft: `3px solid ${NEON}` }}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#222] rounded-xl border border-[#2A2A2A]">
                    <Zap className="w-6 h-6" style={{ color: NEON }} />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-xl tracking-widest uppercase italic">VO₂ Max / VDOT Trend</h2>
                    <p className="text-[11px] mt-0.5" style={{ color: LABEL_COLOR }}>Dettaglio settimanale — stima Jack Daniels</p>
                  </div>
                </div>
                <button onClick={() => setVdotV2Expanded(false)} className="p-2 bg-[#222] hover:bg-[#2A2A2A] rounded-full text-white transition-colors border border-[#333]">
                  <X size={22} />
                </button>
              </div>
              <div className="flex-1 w-full" style={{ minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={expandedVdotData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="v2-vdot-grad-exp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NEON} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={NEON} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="name" stroke="#555" fontSize={12} tickLine={false} axisLine={false} dy={10} interval="preserveStartEnd" minTickGap={22} />
                    <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false}
                      domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v) => v.toFixed(0)} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      return (
                        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-2xl">
                          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: NEON }}>{d.name}</p>
                          <div className="flex items-center gap-2 text-xs mb-0.5"><span className="text-[#777]">VDOT:</span><span className="text-white font-bold">{d.vdot}</span></div>
                          {d.vdot && <div className="flex items-center gap-2 text-xs"><span className="text-[#777]">T-Pace:</span><span className="font-bold" style={{ color: NEON }}>{calcTPaceV2(d.vdot)} /km</span></div>}
                        </div>
                      );
                    }} />
                    <Area type="monotone" dataKey="vdot" name="VDOT" stroke={NEON} strokeWidth={3}
                      fillOpacity={1} fill="url(#v2-vdot-grad-exp)"
                      dot={{ r: 5, fill: NEON, strokeWidth: 0 }} activeDot={{ r: 7, fill: NEON, stroke: '#000', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">VDOT Attuale</div>
                  <div className="text-xl font-mono font-black" style={{ color: NEON }}>{currentVdot ?? '—'}</div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">Trend 3M</div>
                  <div className="text-xl font-mono font-black" style={{ color: trend3m == null ? '#555' : trend3m >= 0 ? NEON : '#F43F5E' }}>
                    {trend3m == null ? '—' : `${trend3m >= 0 ? '+' : ''}${trend3m.toFixed(1)}`}
                  </div>
                </div>
                <div className="bg-[#111] p-4 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[#555] text-[10px] uppercase tracking-widest font-black mb-1">T-Pace</div>
                  <div className="text-xl font-mono font-black text-white">{tPace ?? '—'} {tPace ? '/km' : ''}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
