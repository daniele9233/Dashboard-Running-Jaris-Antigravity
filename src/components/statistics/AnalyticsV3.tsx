/**
 * ANALYTICS PRO V3 — Biomechanics & Telemetry Dashboard
 * Ground Contact Stability · Radar · Efficiency Correlation · Long-Term Adaptation
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, ReferenceLine,
  AreaChart, Area,
} from 'recharts';
import { Activity, Zap, RefreshCcw, Info, Check, AlertTriangle } from 'lucide-react';
import { ChartExpandButton, ChartFullscreenModal } from './ChartFullscreenModal';
import type { GarminCsvLinkResult, ProAnalyticsChart } from '../../types/api';

// ─── Constants ──────────────────────────────────────────────────────────────
const NEON   = '#C0FF00';
const ORANGE = '#F97316';
const BG     = '#0A0A0A';
const CARD   = '#0E0E0E';
const BORDER = '#1E1E1E';
const GRID   = '#1A1A1A';
const DIM    = '#444444';
const MUTED  = '#666666';
const NEON_GREEN = '#ccff00';
const NEON_ORANGE = '#ff5b00';

const cardStyle = (accent = NEON): React.CSSProperties => ({
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderLeft: `3px solid ${accent}`,
});

// ─── Mock data ───────────────────────────────────────────────────────────────

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

function GroundContactStability({
  chart,
  onTelemetrySync,
}: {
  chart?: ProAnalyticsChart;
  onTelemetrySync?: () => Promise<GarminCsvLinkResult | void>;
}) {
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncResult, setSyncResult] = useState<GarminCsvLinkResult | null>(null);
  const latest = chart?.kpis ?? chart?.series_card?.[chart.series_card.length - 1] ?? {};
  const score = Number(latest.score ?? chart?.summary?.latest_score ?? 0);
  const gct = Number(latest.gct ?? 0);
  const cadence = Number(latest.cadence ?? 0);
  const verticalRatio = Number(latest.vertical_ratio ?? 0);
  const hasData = chart?.quality?.status === 'ok' && score > 0;
  const evolution = (chart?.series_card?.length ? chart.series_card : chart?.series_detail ?? []).slice(-7);

  const handleSync = async () => {
    if (syncState === 'syncing') return;
    setSyncState('syncing');
    try {
      const result = await onTelemetrySync?.();
      setSyncResult(result ?? null);
      setSyncState('success');
      setLastSyncTime(new Date());
      setTimeout(() => setSyncState('idle'), 3000);
    } catch {
      setSyncState('error');
    }
  };

  return (
    <main className="relative w-full bg-[#111] rounded-[2rem] border border-gray-800 shadow-2xl flex flex-col overflow-hidden">
      <div className="absolute left-0 top-16 bottom-16 w-1 bg-[#ccff00] rounded-r-full shadow-[0_0_15px_#ccff00]" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 sm:p-8 border-b border-gray-800/60 ml-2">
        <div className="flex items-center gap-3">
          <Activity size={24} color={NEON_GREEN} className="opacity-90" />
          <h2 className="text-xl sm:text-2xl font-black italic tracking-wide text-white">
            GROUND CONTACT STABILITY
          </h2>
        </div>

        <div className="mt-4 sm:mt-0 flex items-center gap-4 bg-[#ccff00]/10 border border-[#ccff00]/20 rounded-full px-5 py-2">
          <span className="text-xs font-bold tracking-wider text-[#ccff00]">STABILITY SCORE</span>
          <div className="flex items-baseline gap-1 shadow-sm">
            <span className="text-xl font-black text-[#ccff00]">{hasData ? score.toFixed(1) : '--'}</span>
            <span className="text-sm font-bold text-[#ccff00] opacity-80">%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-gray-800/60 ml-2">
        <div className="p-6 sm:p-10 flex flex-col relative group">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-6 text-xs font-bold tracking-wider text-gray-500 uppercase">
              <span>Spatial Force Distribution</span>
              <div className="flex gap-4">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ccff00]" /> Optimal</div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ff5b00]" /> Imbalance</div>
              </div>
            </div>
            <button className="text-gray-500 hover:text-white transition-colors bg-white/[0.03] p-1.5 rounded-full border border-gray-800/50 hover:bg-white/[0.1]">
              <Info size={16} />
            </button>
          </div>

          <div className="relative w-full p-8 sm:p-14 border border-gray-800/40 bg-[#060606] rounded-3xl flex items-center justify-center gap-12 sm:gap-24 overflow-hidden isolate shadow-inner">
            <div className="absolute top-[10%] bottom-[10%] left-1/2 w-px bg-gradient-to-b from-transparent via-gray-800 to-transparent -translate-x-1/2" />
            <SensorPad side="L" color={NEON_GREEN} load="48.5" peak="1.4" />
            <SensorPad side="R" color={NEON_ORANGE} load="51.5" peak="1.6" />
          </div>

          <div className="flex justify-between mt-6 text-xs text-gray-500 font-bold uppercase tracking-wider pt-6 border-t border-gray-800/40">
            <div className="flex flex-col gap-2 w-1/3">
              <span>Pronation Deviation</span>
              <div className="flex items-end justify-between text-[#ccff00]">
                <div className="w-full h-1 bg-[#ccff00]/20 rounded-full overflow-hidden mr-4">
                  <div className="h-full w-[40%] bg-[#ccff00] rounded-full shadow-[0_0_10px_#ccff00]" />
                </div>
                <span>+1.2%</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-1/3">
              <span className="text-right">Peak Impact Force</span>
              <div className="flex flex-row-reverse items-end justify-between text-[#ff5b00]">
                <div className="w-full h-1 bg-[#ff5b00]/20 rounded-full overflow-hidden ml-4">
                  <div className="h-full w-[85%] bg-[#ff5b00] rounded-full shadow-[0_0_10px_#ff5b00]" />
                </div>
                <span>3.48 G</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10 flex flex-col justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Contact Time Off</span>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-6xl sm:text-7xl font-black text-white tracking-tighter shadow-sm">{hasData ? Math.round(gct) : '--'}</span>
              <span className="text-xl sm:text-2xl text-gray-500 font-bold">ms</span>
            </div>
            <p className="text-sm text-gray-500">
              {hasData ? 'Stability calcolata da GCT, cadenza, vertical ratio e consistenza.' : 'Importa il CSV Garmin in Activities e collega la telemetria.'}
            </p>
          </div>

          <div className="flex gap-4 sm:gap-6 mt-10">
            <MetricBox title="CADENCE" value={cadence ? cadence.toFixed(0) : '--'} unit="spm" />
            <MetricBox title="VERT. RATIO" value={verticalRatio ? verticalRatio.toFixed(1) : '--'} unit="%" />
          </div>

          <div className="mt-12 mb-8">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-8 block">Session Evolution</span>
            <div className="flex items-end justify-between gap-1 sm:gap-2 px-2 h-20 border-b border-gray-800 pb-2">
              {(evolution.length ? evolution : Array.from({ length: 7 }, (_, i) => ({ score: 0, date: `${i + 1}` }))).map((row, idx) => {
                const value = Number(row.score ?? 0);
                const scaleY = value ? Math.max(0.15, Math.min(1, value / 100)) : 0.12;
                const color = value >= 85 ? '#ccff00' : value >= 70 ? '#facc15' : '#f97316';
                return (
                <EvolutionBar key={idx} scaleY={scaleY} color={color} label={String(row.date ?? idx + 1).slice(-5)} />
                );
              })}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <button
              onClick={handleSync}
              disabled={syncState === 'syncing'}
              className={`
                group w-full font-black italic tracking-widest uppercase py-5 rounded-2xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-95 shadow-[0_0_20px_rgba(204,255,0,0.15)]
                ${syncState === 'idle' ? 'bg-[#ccff00] text-black hover:bg-[#d4ff1a]' : ''}
                ${syncState === 'syncing' ? 'bg-[#ccff00]/60 text-black/60 cursor-not-allowed shadow-none' : ''}
                ${syncState === 'success' ? 'bg-[#4ade80] text-black shadow-[0_0_20px_rgba(74,222,128,0.2)]' : ''}
                ${syncState === 'error' ? 'bg-[#ff5b00] text-black shadow-[0_0_20px_rgba(255,91,0,0.2)]' : ''}
              `}
            >
              {syncState === 'idle' && (
                <>
                  <RefreshCcw size={18} className="group-hover:-rotate-180 transition-transform duration-500" />
                  Sync Telemetry Data
                </>
              )}
              {syncState === 'syncing' && (
                <>
                  <RefreshCcw size={18} className="animate-spin" />
                  Syncing...
                </>
              )}
              {syncState === 'success' && (
                <>
                  <Check size={18} />
                  Sync Successful
                </>
              )}
              {syncState === 'error' && (
                <>
                  <AlertTriangle size={18} />
                  Sync Error - Retry
                </>
              )}
            </button>

            <div className="text-center text-[10px] sm:text-xs font-mono text-gray-500 uppercase tracking-widest h-4 flex items-center justify-center">
              {syncState === 'syncing' && 'Collegamento CSV Garmin importati...'}
              {syncState === 'error' && <span className="text-[#ff5b00]">Link CSV non riuscito. Importa il CSV in Activities e riprova.</span>}
              {syncState === 'success' && syncResult && <span className="text-[#ccff00]">{syncResult.matched} match, {syncResult.enriched} corse arricchite</span>}
              {syncState !== 'syncing' && syncState !== 'error' && lastSyncTime && (
                <>Last Synced: <span className="text-gray-400 ml-1">{syncState === 'success' ? 'Just Now' : lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SensorPad({ side, color, load, peak }: { side: string; color: string; load: string; peak: string }) {
  const rawForceData = [12, 24, 38, 75, 95, 82, 30, 15, 12, 25, 60, 92, 55, 18];

  return (
    <div className="relative w-[110px] h-[240px] sm:w-[130px] sm:h-[300px] flex flex-col justify-between z-10 group">
      <div className="flex justify-between items-start w-full">
        <span className="text-4xl sm:text-6xl font-light text-white/90 font-mono tracking-tighter">
          {side}
        </span>
        <div className="text-right">
          <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-bold mb-0.5">Load</span>
          <span className="text-xl font-mono text-white font-medium leading-none">{load}<span className="text-sm text-gray-500">%</span></span>
        </div>
      </div>

      <div className={`relative w-full flex-grow my-8 flex flex-col justify-between ${side === 'L' ? 'items-end' : 'items-start'}`}>
        <div className={`absolute top-0 bottom-0 w-px bg-gray-800/80 ${side === 'L' ? 'right-0' : 'left-0'}`} />
        {rawForceData.map((val, idx) => {
          const variation = side === 'L' ? 0 : (idx % 2 === 0 ? -6 : 8);
          const finalVal = Math.min(100, Math.max(5, val + variation));

          return (
            <div
              key={idx}
              className="relative flex items-center w-full"
              style={{ justifyContent: side === 'L' ? 'flex-end' : 'flex-start' }}
            >
              <div
                className="h-[2px] sm:h-[3px] rounded-full transition-all duration-300 group-hover:opacity-100"
                style={{
                  width: `${finalVal}%`,
                  backgroundColor: color,
                  opacity: (finalVal / 100) * 0.8 + 0.2,
                  boxShadow: finalVal > 80 ? `0 0 12px ${color}` : 'none',
                }}
              />

              {finalVal > 75 && (
                <div
                  className="absolute w-1 h-1 rounded-full bg-white opacity-90 shadow-[0_0_8px_white]"
                  style={{ [side === 'L' ? 'right' : 'left']: `calc(${finalVal}% + 6px)` }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-end w-full border-b border-gray-800/40 pb-2">
        <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Peak Force</span>
        <span className="text-sm font-mono text-gray-300">{peak} <span className="text-[10px] text-gray-600">xBW</span></span>
      </div>
    </div>
  );
}

function MetricBox({ title, value, unit }: { title: string; value: string; unit: string }) {
  return (
    <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-white/[0.04] transition-colors cursor-default group">
      <span className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">{title}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter group-hover:text-gray-100 transition-colors">{value}</span>
        <span className="text-sm font-bold text-gray-500">{unit}</span>
      </div>
    </div>
  );
}

function EvolutionBar({ scaleY, color, label }: { scaleY: number; color: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-end flex-1 gap-2 sm:gap-3 group">
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        className="w-full max-w-[40px] sm:max-w-[48px] rounded-t-sm rounded-b-[1px] relative overflow-hidden"
        style={{
          height: '20px',
          backgroundColor: color,
          transformOrigin: 'bottom',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/40" />
      </motion.div>
      <span className="text-[10px] text-gray-600 font-black tracking-wider group-hover:text-gray-400 transition-colors">{label}</span>
    </div>
  );
}

export function AnalyticsV3({
  data = {},
  onTelemetrySync,
}: {
  data?: Record<string, ProAnalyticsChart>;
  onTelemetrySync?: () => Promise<GarminCsvLinkResult | void>;
}) {
  const [athleticExpanded, setAthleticExpanded] = useState(false);
  const [efficiencyExpanded, setEfficiencyExpanded] = useState(false);
  const [adaptationExpanded, setAdaptationExpanded] = useState(false);
  const radarAxesReal: RadarAxis[] = (data.athletic_profile?.series_card ?? []).map((d) => ({
    label: String(d.axis ?? ''),
    value: Number(d.value ?? 0),
  })).filter((d) => d.label);
  const efficiencySeries = (data.efficiency_correlation?.series_card ?? []).map((d) => ({
    t: String(d.date ?? ''),
    speed: Number(d.efficiency ?? 0),
    cardiac: Number(d.hr ?? 0) / 200,
  })).filter((d) => d.speed || d.cardiac);
  const efficiencyDetail = (data.efficiency_correlation?.series_detail?.length ? data.efficiency_correlation.series_detail : data.efficiency_correlation?.series_card ?? []).map((d) => ({
    t: String(d.date ?? ''),
    speed: Number(d.efficiency ?? 0),
    cardiac: Number(d.hr ?? 0) / 200,
  })).filter((d) => d.speed || d.cardiac);
  const adaptationSeries = (data.adaptation?.series_card ?? []).map((d) => ({
    month: String(d.date ?? ''),
    adaptation: Math.max(0, Math.min(100, 100 - Number(d.gct ?? 280) / 4)),
    stress: Number(d.km ?? 0),
  }));
  const adaptationDetail = (data.adaptation?.series_detail?.length ? data.adaptation.series_detail : data.adaptation?.series_card ?? []).map((d) => ({
    month: String(d.date ?? ''),
    adaptation: Math.max(0, Math.min(100, 100 - Number(d.gct ?? 280) / 4)),
    stress: Number(d.km ?? 0),
  }));
  const noData = <div className="h-full min-h-[180px] flex items-center justify-center text-gray-600 text-xs font-black uppercase tracking-widest">Dati reali insufficienti</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ══════════════════════════════════════════════════
          GROUND CONTACT STABILITY
      ══════════════════════════════════════════════════ */}
      <GroundContactStability chart={data.ground_contact_stability} onTelemetrySync={onTelemetrySync} />

      {/* ══════════════════════════════════════════════════
          BOTTOM ROW: Radar + Efficiency Correlation
      ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pentagon Radar */}
        <div
          className="rounded-3xl p-8 group"
          style={cardStyle(NEON)}
        >
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
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
            <ChartExpandButton onClick={() => setAthleticExpanded(true)} />
          </div>
          {radarAxesReal.length ? <PentagonRadar axes={radarAxesReal} /> : noData}
          <div className="mt-4 grid grid-cols-5 gap-2">
            {radarAxesReal.map((a) => (
              <div key={a.label} className="text-center">
                <p className="text-[8px] font-black tracking-widest uppercase" style={{ color: MUTED }}>{a.label}</p>
                <p className="text-xs font-black mt-0.5" style={{ color: NEON }}>{a.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Efficiency Correlation */}
        <div
          className="rounded-3xl p-8 group"
          style={cardStyle(ORANGE)}
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
              <ChartExpandButton onClick={() => setEfficiencyExpanded(true)} />
            </div>
          </div>

          {efficiencySeries.length ? <ResponsiveContainer width="100%" height={200}>
            <LineChart data={efficiencySeries} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
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
          </ResponsiveContainer> : noData}

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
        className="rounded-3xl p-8 group"
        style={cardStyle(NEON)}
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
            <ChartExpandButton onClick={() => setAdaptationExpanded(true)} />
          </div>
        </div>

        {adaptationSeries.length ? <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={adaptationSeries} margin={{ top: 10, right: 20, bottom: 0, left: -20 }}>
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
        </ResponsiveContainer> : noData}

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

      <ChartFullscreenModal
        open={athleticExpanded}
        onClose={() => setAthleticExpanded(false)}
        title="Athletic Profile"
        subtitle="Multi-axis biomech score"
        accent={NEON}
        details={
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {radarAxesReal.map((a) => (
              <div key={a.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                <p className="text-[9px] font-black tracking-widest uppercase" style={{ color: MUTED }}>{a.label}</p>
                <p className="mt-1 text-xl font-black" style={{ color: NEON }}>{a.value}</p>
              </div>
            ))}
          </div>
        }
      >
        <div className="flex h-full min-h-0 w-full items-center justify-center">
          <div className="scale-[1.45] sm:scale-[1.75] origin-center">
            {radarAxesReal.length ? <PentagonRadar axes={radarAxesReal} /> : noData}
          </div>
        </div>
      </ChartFullscreenModal>

      <ChartFullscreenModal
        open={efficiencyExpanded}
        onClose={() => setEfficiencyExpanded(false)}
        title="Efficiency Correlation"
        subtitle="Speed output vs cardiac stress"
        accent={ORANGE}
        details={
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[9px] font-black tracking-widest" style={{ color: DIM }}>PEAK SPEED RATIO</p>
              <p className="mt-1 text-xl font-black text-white">1.42 <span className="text-xs font-bold" style={{ color: MUTED }}>m/s</span></p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[9px] font-black tracking-widest" style={{ color: DIM }}>AVG EFFICIENCY</p>
              <p className="mt-1 text-xl font-black text-white">0.82 <span className="text-xs font-bold" style={{ color: MUTED }}>km/l</span></p>
            </div>
          </div>
        }
      >
        {efficiencyDetail.length ? <ResponsiveContainer width="100%" height="100%">
          <LineChart data={efficiencyDetail} margin={{ top: 12, right: 28, bottom: 8, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="t" tick={{ fill: MUTED, fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: MUTED, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <Tooltip content={<DarkTooltip />} />
            <ReferenceLine y={0.80} stroke={NEON} strokeDasharray="6 3" strokeWidth={1} opacity={0.4} label={{ value: 'OPTIMAL RANGE', position: 'right', fill: NEON, fontSize: 9, fontWeight: 900 }} />
            <Line type="monotone" dataKey="speed" name="Speed Output" stroke={NEON} strokeWidth={3} strokeDasharray="6 3" dot={{ r: 4, fill: NEON, stroke: BG, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="cardiac" name="Cardiac Stress" stroke={ORANGE} strokeWidth={3} strokeDasharray="4 2" dot={{ r: 4, fill: ORANGE, stroke: BG, strokeWidth: 2 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer> : noData}
      </ChartFullscreenModal>

      <ChartFullscreenModal
        open={adaptationExpanded}
        onClose={() => setAdaptationExpanded(false)}
        title="Long-Term Training Adaptation"
        subtitle="Supercompensation cycle - stress vs adaptation curve"
        accent={NEON}
        details={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[9px] font-black tracking-widest" style={{ color: DIM }}>
              BANISTER-COGGAN SUPERCOMPENSATION MODEL
            </p>
            <div className="grid grid-cols-2 gap-3 sm:w-[420px]">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] font-black tracking-widest" style={{ color: DIM }}>PEAK ADAPTATION</p>
                <p className="mt-1 text-sm font-black" style={{ color: NEON }}>JUNE - JULY WINDOW</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] font-black tracking-widest" style={{ color: DIM }}>READINESS INDEX</p>
                <p className="mt-1 text-sm font-black text-white">87.4 / 100</p>
              </div>
            </div>
          </div>
        }
      >
        {adaptationDetail.length ? <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={adaptationDetail} margin={{ top: 12, right: 28, bottom: 8, left: -10 }}>
            <defs>
              <linearGradient id="adaptGradModal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={NEON} stopOpacity={0.18} />
                <stop offset="95%" stopColor={NEON} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="stressGradModal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ORANGE} stopOpacity={0.18} />
                <stop offset="95%" stopColor={ORANGE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: MUTED, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <Tooltip content={<DarkTooltip />} />
            <ReferenceLine x="Jul" stroke={ORANGE} strokeDasharray="6 3" strokeWidth={1.5} label={{ value: 'RACE DATE', position: 'top', fill: ORANGE, fontSize: 9, fontWeight: 900 }} />
            <Area type="monotone" dataKey="stress" name="Stress" stroke={ORANGE} strokeWidth={2.5} fill="url(#stressGradModal)" dot={false} />
            <Area type="monotone" dataKey="adaptation" name="Adaptation" stroke={NEON} strokeWidth={3} fill="url(#adaptGradModal)" dot={false} />
          </AreaChart>
        </ResponsiveContainer> : noData}
      </ChartFullscreenModal>

    </div>
  );
}
