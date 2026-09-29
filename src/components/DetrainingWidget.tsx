import React from 'react';
import type { LucideIcon } from "lucide-react";
import { motion } from 'motion/react';
import { Activity, AlertTriangle, Bike, Sparkles, TrendingDown } from 'lucide-react';
import type { BikeSession, Profile, Run } from '../types/api';
import {
  bikeScenarioPoint,
  buildDetrainingInputs,
  computeBikeCoverage,
  computeDetrainingCurve,
  daysSinceLastRun,
  predict5kFromVdot,
  paceLabel,
} from '../utils/detrainingModel';
import { formatDuration } from '../utils/paceFormat';

interface Props {
  profile: Profile | null | undefined;
  runs: Run[];
  /** Sedute in bici: servono solo a stimare quanto tengono il motore senza corsa. */
  bikes?: BikeSession[];
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

const NO_BIKES: BikeSession[] = [];

function lossLabel(pct: number): string {
  const loss = (1 - pct) * 100;
  return loss < 0.05 ? '~0' : `-${loss.toFixed(1)}`;
}

function perfLabel(pct: number): string {
  const delta = (pct - 1) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;
}

export function DetrainingWidget({ profile, runs, bikes = NO_BIKES, vdot, base5kSec: base5kSecProp }: Props) {
  const days = daysSinceLastRun(runs);
  const inputs = React.useMemo(() => buildDetrainingInputs(profile, runs, vdot), [profile, runs, vdot]);

  // Run BOTH models so we can compare taper vs full stop at current "days off".
  const taper = React.useMemo(() => computeDetrainingCurve(inputs, Math.max(60, days + 5), 'taper'), [inputs, days]);
  const fullStop = React.useMemo(() => computeDetrainingCurve(inputs, Math.max(60, days + 5), 'fullStop'), [inputs, days]);

  const idx = Math.min(days, taper.curve.length - 1);
  const tPoint = taper.curve[idx];
  const fPoint = fullStop.curve[idx];

  const tDelta = (tPoint.performancePct - 1) * 100;
  const tVo2Loss = (1 - tPoint.vo2Pct) * 100;
  const fVo2Loss = (1 - fPoint.vo2Pct) * 100;

  // Bici dall'ultima corsa: il fermo totale rigiocato giorno per giorno con la dose che conta.
  const bike = React.useMemo(
    () => computeBikeCoverage(profile, runs, bikes, vdot, days),
    [profile, runs, bikes, vdot, days],
  );
  const bPoint = bike ? bikeScenarioPoint(fullStop, bike.daily, days) : null;
  const rode = (bike?.sessions.length ?? 0) > 0;
  const needed = bike ? `~${formatDuration(Math.round(bike.maintenanceMinPerWeek / 5) * 5)} a settimana` : '';
  const bikeVerdict = !bike || !rode
    ? { color: '#666', line: `Per tenere il VO2max: ${needed}` }
    : bike.counted === 0
      ? { color: ORANGE, line: 'Troppo corte o troppo piano: non contano' }
      : bike.coverage >= 1
        ? { color: GREEN, line: 'Dose piena: da qui perdi poco o nulla' }
        : bike.coverage >= 0.5
          ? { color: ACCENT, line: `Rallenta il calo: servono ${needed}` }
          : { color: ORANGE, line: `Non basta a lungo: servono ${needed}` };
  const bikeDetail = bike
    ? [
        "Dall'ultima corsa:",
        ...bike.sessions.map((s) =>
          `${s.date.slice(8, 10)}/${s.date.slice(5, 7)} · ${Math.round(s.minutes)}' · ${Math.round(s.x * 100)}% della riserva `
          + `(${s.source === 'hr' ? 'FC' : s.source === 'power' ? 'potenza' : 'stimata'}) · conta ${Math.round(s.efficacy * 100)}%`),
        `Carico utile: bici ${Math.round(bike.bikeWeeklyTrimp)} TRIMP negli ultimi 7 giorni, corsa prima dello stop ${Math.round(bike.runWeeklyTrimp)} a settimana.`,
        "Conta dai 10' e dal 30% della riserva, per intero dal 45%.",
      ].join('\n')
    : '';

  // State classification.
  let state: { label: string; color: string; sub: string; icon: LucideIcon };
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
    <div className="h-full rounded-[24px] p-6 flex flex-col overflow-hidden backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: state.color }} />
          <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest">DETRAINING</span>
        </div>
        <span
          className="px-2 py-1 rounded-[12px] text-[9px] font-black tracking-widest uppercase"
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
              VO2 {lossLabel(tPoint.vo2Pct)}% · perf {perfLabel(tPoint.performancePct)}%
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
              VO2 {lossLabel(fPoint.vo2Pct)}% · perf {perfLabel(fPoint.performancePct)}%
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

      {/* Bici dall'ultima corsa: quanto tiene il motore aerobico senza correre */}
      {bike && (
        <div
          className="rounded-[16px] border px-3 py-2 mb-2"
          style={{ background: `${bikeVerdict.color}0D`, borderColor: `${bikeVerdict.color}33` }}
        >
          <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest mb-1.5">
            <span className="flex items-center gap-1.5" style={{ color: bikeVerdict.color }}>
              <Bike className="w-3 h-3" /> CON LA BICI
            </span>
            {bPoint && rode && (
              <span className="text-white font-mono">
                VO2 {lossLabel(bPoint.vo2Pct)}% · perf {perfLabel(bPoint.performancePct)}%
              </span>
            )}
          </div>
          {rode && (
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(bike.coverage * 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: bikeVerdict.color }}
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-[10px] mt-1.5" title={bikeDetail}>
            <span className="text-[#A0A0A0] font-bold">
              {rode
                ? `${bike.sessions.length} ${bike.sessions.length === 1 ? 'uscita' : 'uscite'} · ${formatDuration(bike.minutes)}`
                : "nessuna uscita dall'ultima corsa"}
            </span>
            {rode && (
              <span className="font-black uppercase tracking-widest" style={{ color: bikeVerdict.color }}>
                copertura {Math.round(bike.coverage * 100)}%
              </span>
            )}
          </div>
          <div
            className="text-[#666] text-[10px] font-bold mt-1"
            title="Minuti di bici a settimana, all'intensità delle tue uscite (almeno il 45% della riserva), per arrivare a un terzo del carico di corsa di prima: lì il VO2max regge (Hickson). Più forte, ne bastano meno."
          >
            {bikeVerdict.line}
          </div>
        </div>
      )}

      {/* 5K pace comparison */}
      <div className="grid grid-cols-3 gap-2 mt-auto">
        <div className="rounded-[16px] bg-white/[0.025] border border-white/[0.06] p-3">
          <div className="text-[9px] font-black tracking-widest uppercase text-gray-500">5K base</div>
          <div className="text-white text-lg font-black font-mono mt-1">{formatSec(base5kSec)}</div>
        </div>
        <div className="rounded-[16px] border p-3" style={{ background: `${GREEN}10`, borderColor: `${GREEN}33` }}>
          <div className="text-[9px] font-black tracking-widest uppercase" style={{ color: GREEN }}>5K taper</div>
          <div className="text-white text-lg font-black font-mono mt-1">{formatSec(t5k)}</div>
          <div className="text-[9px] font-bold mt-0.5" style={{ color: tDeltaSec < 0 ? GREEN : '#666' }}>
            {tDeltaSec < 0 ? '↓' : '+'}{Math.abs(Math.round(tDeltaSec))}s
          </div>
        </div>
        <div className="rounded-[16px] border p-3" style={{ background: `${RED}10`, borderColor: `${RED}33` }}>
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
