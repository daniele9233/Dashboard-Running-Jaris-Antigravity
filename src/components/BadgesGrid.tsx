import { useMemo } from "react";
import type { Run } from "../types/api";

// ─── Context (solo ciò che Passerotto richiede) ───────────────────────────────

interface BadgeContext {
  best5k: number | null;  // secondi totali sul 5K (pace * 5)
  best10k: number | null; // secondi totali sul 10K (pace * 10)
}

// ─── Legendary Badge ──────────────────────────────────────────────────────────

const LEGENDARY_BADGE = {
  id: "passerotto",
  name: "Passerotto 🐦",
  desc: "5K sotto i 20 minuti E 10K sotto i 4:15/km",
  icon: "🐦",
  /** best5k < 1200 s = 20:00 | best10k < 2550 s = 42:30 (4:15/km × 10) */
  check: (c: BadgeContext) =>
    c.best5k !== null && c.best5k < 1200 &&
    c.best10k !== null && c.best10k < 2550,
  message: "Sei un Passerotto! Velocità e resistenza combinate alla perfezione! 🎉",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsePaceSec(pace: string): number | null {
  if (!pace) return null;
  const parts = pace.split(":");
  if (parts.length < 2) return null;
  const v = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return v > 0 ? v : null;
}

function isFrom2026(date: string): boolean {
  return new Date(date).getFullYear() >= 2026;
}

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildContext(runs: Run[]): BadgeContext {
  const runs2026 = runs.filter(r => isFrom2026(r.date));
  let best5k: number | null = null;
  let best10k: number | null = null;

  for (const r of runs2026) {
    const paceSec = parsePaceSec(r.avg_pace ?? "");
    if (!paceSec) continue;
    if (r.distance_km >= 4.5 && r.distance_km <= 5.5) {
      const t = paceSec * 5;
      if (best5k === null || t < best5k) best5k = t;
    }
    if (r.distance_km >= 9 && r.distance_km <= 11) {
      const t = paceSec * 10;
      if (best10k === null || t < best10k) best10k = t;
    }
  }

  return { best5k, best10k };
}

// ─── Legendary Badge Card ─────────────────────────────────────────────────────

function LegendaryBadgeCard({ unlocked }: { unlocked: boolean }) {
  return (
    <div
      className={`relative rounded-2xl border-2 p-6 transition-all ${
        unlocked
          ? "bg-gradient-to-br from-[#1E1E1E] to-[#2A1E00] border-[#F59E0B] shadow-lg shadow-[#F59E0B]/20"
          : "bg-[#121212] border-[#2A2A2A] opacity-50"
      }`}
    >
      {unlocked && (
        <div className="absolute -top-2 -right-2 bg-[#F59E0B] text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
          LEGGENDARIO
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className={`text-5xl ${unlocked ? "" : "grayscale"}`}>🐦</div>
        <div className="flex-1">
          <h3
            className={`text-lg font-black ${
              unlocked ? "text-[#F59E0B]" : "text-gray-500"
            }`}
          >
            Passerotto
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            5K sotto i 20 minuti E 10K sotto i 4:15/km
          </p>
          {unlocked && (
            <p className="text-sm text-[#F59E0B] mt-2 font-bold">
              🎉 Sei un Passerotto! Velocità e resistenza combinate alla perfezione!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  runs: Run[];
  /** Legacy props mantenuti per backward compat con StatisticsView — non usati. */
  vdot?: number;
  vdotPeak?: number;
  vdotDelta?: number;
  maxHr?: number;
}

export function BadgesGrid({ runs }: Props) {
  const ctx = useMemo(() => buildContext(runs), [runs]);
  const unlocked = LEGENDARY_BADGE.check(ctx);

  return (
    <div className="space-y-6">
      <LegendaryBadgeCard unlocked={unlocked} />
    </div>
  );
}
