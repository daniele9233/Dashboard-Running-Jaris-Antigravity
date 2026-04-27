import React from 'react';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, Sparkles, TrendingDown } from 'lucide-react';
import type { Profile, Run } from '../types/api';
import {
  buildDetrainingInputs,
  computeDetrainingCurve,
  daysSinceLastRun,
  predict5kFromVdot,
  paceLabel,
} from '../utils/detrainingModel';

interface Props {
  profile: Profile | null | undefined;
  runs: Run[];
  vdot: number | null;
  /** Se fornito, usa questo baseline (dal backend race_predictions["5K"]) invece di predict5kFromVdot */
  base5kSec?: number | null;
}

const ACCENT = '#C0FF00';
const GREEN = '#22C55E';
const ORANGE = '#F59E0B';
const RED = '#F43F5E';

function formatSec(s: number): string {
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total - m * 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function DetrainingWidget({ profile, runs, vdot, base5kSec: base5kSecProp }: Props) {
  const days = daysSinceLastRun(runs);
  const inputs = React.useMemo(() => buildDetrainingInputs(profile, runs, vdot), [profile, runs, vdot]);

  // Run BOTH models so we can compare taper vs full stop at current "days off".
  const taper = React.useMemo(() => computeDetrainingCurve(inputs, Math.max(60, days + 5), 'taper'), [inputs, days]);
  const fullStop = React.useMemo(() => computeDetrainingCurve(inputs, Math.max(60, days + 5), 'fullStop'), [inputs, days]);

  const idx = Math.min(days, taper.curve.length - 1);
  const tPoint = taper.curve[idx];
  const fPoint = fullStop.curve[idx];

  const tDelta = (tPoint.performancePct - 1) * 100;
  const fDelta = (fPoint.performancePct - 1) * 100;
  const tVo2Loss = (1 - tPoint.vo2Pct) * 100;
  const fVo2Loss = (1 - fPoint.vo2Pct) * 100;

  // State classification.
  let state: { label: string; color: string; sub: string; icon: React.ElementType };
  if (days <= 2) {
    state = { label: 'RECUPERO', color: GREEN, sub: 'Fatica residua dissipa', icon: Sparkles };
  } else if (days <= 5) {
    state = { label: 'TAPER', color: GREEN, sub: 'Performance può salire', icon: Sparkles };
  } else if (days <= 10) {
    state = { label: 'POST-TAPER', color: ACCENT, sub: 'Plateau, decay ridotto', icon: Activity };
  } else if (days <= 21) {
    state = { label: 'DETRAINING', color: ORANGE, sub: 'Vero detraining iniziato', icon: TrendingDown };
  } else {
    state = { label: 'DETRAINING SEVERO', color: RED, sub: 'Perdite strutturali', icon: AlertTriangle };
  }

  // 5K comparison — preferisce il baseline backend (coerente con PREVISIONE GARA), fallback Daniels.
  const base5kSec = (base5kSecProp != null && base5kSecProp > 0)
    ? base5kSecProp
    : vdot ? predict5kFromVdot(vdot) : 25 * 60;
  const t5k = base5kSec / tPoint.performancePct;
  const f5k = base5kSec / fPoint.performancePct;
  const tDeltaSec = t5k - base5kSec;
  const fDeltaSec = f5k - base5kSec;

  const Icon = state.icon;

  // Mini-bar gauge: taper detraining percentage (0-25%).
  const taperPct = Math.max(0, tVo2Loss);
  const fullPct = Math.max(0, fVo2Loss);

  return (
    <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: state.color }} />
          <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest">DETRAINING</span>
        </div>
        <span
          className="px-2 py-1 rounded-md text-[9px] font-black tracking-widest uppercase"
          style={{ background: `${state.color}22`, color: state.color }}
        >
          {state.label}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <motion.span
          key={days}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white text-5xl font-black tracking-tight"
        >
          {days}
        </motion.span>
        <span className="text-[#A0A0A0] text-sm font-semibold">gg dall'ultima corsa</span>
      </div>
      <div className="text-[#666] text-[10px] font-bold uppercase tracking-widest mb-4">{state.sub}</div>

      {/* Two-bar comparison: taper vs full stop */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-1.5">
            <span style={{ color: GREEN }}>SCENARIO TAPER</span>
            <span className="text-white font-mono">
              VO2 {tVo2Loss < 0.05 ? '~0' : `-${tVo2Loss.toFixed(1)}`}% · perf {tDelta >= 0 ? '+' : ''}{tDelta.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, taperPct * 4)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: tDelta >= 0 ? GREEN : taperPct > 5 ? ORANGE : ACCENT }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-1.5">
            <span style={{ color: RED }}>SCENARIO FERMO TOTALE</span>
            <span className="text-white font-mono">
              VO2 {fVo2Loss < 0.05 ? '~0' : `-${fVo2Loss.toFixed(1)}`}% · perf {fDelta >= 0 ? '+' : ''}{fDelta.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, fullPct * 4)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: fullPct > 8 ? RED : fullPct > 3 ? ORANGE : ACCENT }}
            />
          </div>
        </div>
      </div>

      {/* 5K pace comparison */}
      <div className="grid grid-cols-3 gap-2 mt-auto">
        <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] p-3">
          <div className="text-[9px] font-black tracking-widest uppercase text-gray-500">5K base</div>
          <div className="text-white text-lg font-black font-mono mt-1">{formatSec(base5kSec)}</div>
        </div>
        <div className="rounded-xl border p-3" style={{ background: `${GREEN}10`, borderColor: `${GREEN}33` }}>
          <div className="text-[9px] font-black tracking-widest uppercase" style={{ color: GREEN }}>5K taper</div>
          <div className="text-white text-lg font-black font-mono mt-1">{formatSec(t5k)}</div>
          <div className="text-[9px] font-bold mt-0.5" style={{ color: tDeltaSec < 0 ? GREEN : '#666' }}>
            {tDeltaSec < 0 ? '↓' : '+'}{Math.abs(Math.round(tDeltaSec))}s
          </div>
        </div>
        <div className="rounded-xl border p-3" style={{ background: `${RED}10`, borderColor: `${RED}33` }}>
          <div className="text-[9px] font-black tracking-widest uppercase" style={{ color: RED }}>5K fermo</div>
          <div className="text-white text-lg font-black font-mono mt-1">{formatSec(f5k)}</div>
          <div className="text-[9px] font-bold mt-0.5" style={{ color: fDeltaSec > 5 ? RED : '#666' }}>
            +{Math.round(fDeltaSec)}s
          </div>
        </div>
      </div>

      <div className="text-[#555] text-[9px] tracking-wider mt-3 text-center">
        Coyle 1984 · Mujika 2018 · Bosquet 2007/2013
      </div>
    </div>
  );
}
