import { useMemo } from "react";
import { Timer, Zap } from "lucide-react";
import type { Run } from "../../../types/api";

/**
 * NextOptimalSessionWidget — semi-circular gauge "ore al recupero" + raccomandazione.
 *
 * Estratto da DashboardView.tsx (round 5 — #14 god component split).
 * Modello recupero a 2 segnali combinati (max conservativo):
 *   1. Tempo intercorso da ultima corsa vs minRecoveryHours stimato per intensità.
 *   2. ATL vs target (CTL+5) → ore residue logaritmiche.
 *
 * Recommendation:
 *   atl > 70 || tsb < -20  → easy/recovery
 *   atl > 40 || tsb < -5   → moderate
 *   else                    → hard
 */
export function NextOptimalSessionWidget({
  tsb, atl, ctl, runs, faticaColor,
}: {
  tsb: number | null;
  atl: number;
  ctl: number;
  runs: Run[];
  faticaColor: string;
}) {
  const { hoursUntil, pct, recommendation, readyAt } = useMemo(() => {
    const gpsRuns = runs.filter(r => !r.is_treadmill);
    const lastRun = gpsRuns[0] ?? null;

    // Hours elapsed since last run
    const hoursElapsed = lastRun
      ? (Date.now() - new Date(lastRun.date + 'T12:00:00').getTime()) / 3600000
      : 9999;

    // Minimum recovery based on last run intensity
    let minRecoveryHours = 24;
    if (lastRun) {
      const hrPct = lastRun.avg_hr_pct != null
        ? (lastRun.avg_hr_pct > 1 ? lastRun.avg_hr_pct / 100 : lastRun.avg_hr_pct)
        : 0.72;
      const isHard = ['intervals', 'ripetute', 'tempo', 'soglia'].includes(
        (lastRun.run_type ?? '').toLowerCase()
      );
      const isLong = lastRun.distance_km > 18;

      if (isHard || hrPct > 0.88) {
        minRecoveryHours = isLong ? 72 : 48;
      } else if (hrPct > 0.78 || lastRun.distance_km > 12) {
        minRecoveryHours = 36;
      } else {
        minRecoveryHours = 24;
      }
    }

    // Also compute ATL-based model as secondary signal
    let atlHours = 0;
    if (tsb !== null && atl > 0 && ctl > 0) {
      const targetAtl = ctl + 5;
      if (atl > targetAtl) {
        atlHours = Math.round(7 * Math.log(atl / targetAtl) * 24);
      }
    }

    // Take the larger of the two models (conservative)
    const remainingFromLastRun = Math.max(0, minRecoveryHours - hoursElapsed);
    const totalRemaining = Math.max(remainingFromLastRun, atlHours > 0 ? Math.min(atlHours, remainingFromLastRun + 12) : 0);
    const hoursUntil = Math.round(totalRemaining);

    // Recovery pct
    const pct = minRecoveryHours > 0
      ? Math.max(0, Math.min(1, hoursElapsed / minRecoveryHours))
      : 1;

    // Ready-at timestamp
    const readyAt = hoursUntil > 0
      ? new Date(Date.now() + hoursUntil * 3600000)
      : null;

    const recommendation = (atl > 70 || (tsb !== null && tsb < -20))
      ? 'easy'
      : (atl > 40 || (tsb !== null && tsb < -5))
      ? 'moderate'
      : 'hard';

    return {
      hoursUntil,
      pct,
      recommendation: recommendation as 'easy' | 'moderate' | 'hard',
      readyAt,
    };
  }, [tsb, atl, ctl, runs]);

  const isReady = hoursUntil === 0;
  const h = Math.floor(hoursUntil);
  const arcColor = faticaColor;

  const readyAtLabel = readyAt
    ? readyAt.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
      + ' ' + readyAt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  const recLabel = recommendation === 'hard'
    ? 'HARD SESSION' : recommendation === 'moderate'
    ? 'MODERATE SESSION' : 'EASY / RECOVERY';
  const recColor = recommendation === 'hard'
    ? '#C0FF00' : recommendation === 'moderate'
    ? '#F59E0B' : '#60A5FA';

  const ringColor = isReady ? "#C0FF00" : arcColor;

  // Semicircular arc path length
  const arcLen = Math.PI * 85;

  return (
    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Timer className="text-[#C0FF00]" size={14} />
        <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest">NEXT OPTIMAL SESSION</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Semicircle gauge — Garmin-style */}
        <div className="relative w-full mx-auto" style={{ maxWidth: '220px', aspectRatio: '200 / 120' }}>
          <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="nos-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor={ringColor} stopOpacity="0.35" />
                <stop offset="100%" stopColor={ringColor} stopOpacity="1" />
              </linearGradient>
            </defs>
            {/* Track */}
            <path d="M 15 105 A 85 85 0 0 1 185 105" stroke="#242424" strokeWidth="9" fill="none" strokeLinecap="round" />
            {/* Fill */}
            <path
              d="M 15 105 A 85 85 0 0 1 185 105"
              stroke="url(#nos-grad)"
              strokeWidth="9"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${arcLen}`}
              strokeDashoffset={arcLen * (1 - pct)}
              style={{ transition: "stroke-dashoffset .6s ease" }}
            />
            {/* Tick marks at 0/50/100% */}
            <line x1="15"  y1="105" x2="15"  y2="115" stroke="#444" strokeWidth="1" />
            <line x1="100" y1="20"  x2="100" y2="10"  stroke="#444" strokeWidth="1" />
            <line x1="185" y1="105" x2="185" y2="115" stroke="#444" strokeWidth="1" />
          </svg>

          {/* Center content — anchored inside arc */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
            {isReady ? (
              <>
                <Zap size={30} className="text-[#C0FF00] mb-1" />
                <span className="text-[#C0FF00] text-[10px] font-black tracking-widest">READY NOW</span>
              </>
            ) : (
              <>
                <span className="text-white font-black font-mono text-[40px] leading-none">{h}</span>
                <span className="text-[#666] text-[9px] font-black tracking-widest mt-1">ORE AL RECUPERO</span>
              </>
            )}
          </div>
        </div>

        {/* Recommendation + date */}
        <div
          className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl mt-5 w-full"
          style={{ background: `${recColor}14`, border: `1px solid ${recColor}44` }}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: recColor, boxShadow: `0 0 6px ${recColor}` }} />
            <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: recColor }}>
              {recLabel}
            </span>
          </div>
          {readyAtLabel && (
            <div className="text-[10px] tracking-wider font-black" style={{ color: `${recColor}BB` }}>
              {readyAtLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
