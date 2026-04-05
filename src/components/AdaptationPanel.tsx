import { useMemo, useState } from "react";
import type { Run } from "../types/api";

interface AdaptationPanelProps {
  runs: Run[];
}

// ─── Classificazione run per tipo di adattamento ─────────────────────────────
type RunCategory = "neuromuscolare" | "metabolico" | "strutturale";

interface CategoryConfig {
  label: string;
  color: string;
  icon: string;
  daysToAdapt: number;        // giorni medi al picco
  rangeLabel: string;
  desc: string;
}

const CATEGORIES: Record<RunCategory, CategoryConfig> = {
  neuromuscolare: {
    label: "Neuromuscolare",
    color: "#F59E0B",
    icon: "⚡",
    daysToAdapt: 5,
    rangeLabel: "3–7 giorni",
    desc: "Forza e reattività",
  },
  metabolico: {
    label: "Metabolico",
    color: "#F97316",
    icon: "🔥",
    daysToAdapt: 10,
    rangeLabel: "7–14 giorni",
    desc: "Efficienza e soglia",
  },
  strutturale: {
    label: "Strutturale",
    color: "#8B5CF6",
    icon: "🧬",
    daysToAdapt: 17,
    rangeLabel: "14–21 giorni",
    desc: "Capillari e mitocondri",
  },
};

function classifyRun(run: Run): RunCategory {
  const hrPct = run.avg_hr_pct;
  const paceMinPerKm = run.duration_minutes / Math.max(run.distance_km, 0.01);

  if (hrPct !== null && hrPct !== undefined) {
    if (hrPct > 85) return "neuromuscolare";
    if (hrPct > 72) return "metabolico";
    return "strutturale";
  }
  // fallback su pace
  if (paceMinPerKm < 4.5) return "neuromuscolare";
  if (paceMinPerKm < 5.5) return "metabolico";
  return "strutturale";
}

/** Giorni da oggi verso il picco: 0 = oggi è il picco, negativo = già passato */
function daysUntilPeak(runDate: string, daysToAdapt: number): number {
  const run = new Date(runDate);
  run.setHours(0, 0, 0, 0);
  const peakDate = new Date(run.getTime() + daysToAdapt * 86400000);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((peakDate.getTime() - now.getTime()) / 86400000);
}

/** % maturazione: 0 = appena allenato, 100 = al picco */
function maturationPct(runDate: string, daysToAdapt: number): number {
  const run = new Date(runDate);
  run.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const elapsed = (now.getTime() - run.getTime()) / 86400000;
  return Math.min(100, Math.max(0, Math.round((elapsed / daysToAdapt) * 100)));
}

function formatPeakDate(runDate: string, daysToAdapt: number): string {
  const run = new Date(runDate);
  const peak = new Date(run.getTime() + daysToAdapt * 86400000);
  return peak.toLocaleDateString("it", { day: "numeric", month: "short" });
}

// ─── Componente ───────────────────────────────────────────────────────────────

const PERIODS = [7, 14, 30] as const;
type Period = (typeof PERIODS)[number];

export function AdaptationPanel({ runs }: AdaptationPanelProps) {
  const [period, setPeriod] = useState<Period>(14);

  // Ultime 8 corse per la lista
  const recentRuns = useMemo(() => runs.slice(0, 8), [runs]);

  // Summary per periodo selezionato
  const summary = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    const periodRuns = runs.filter((r) => new Date(r.date) >= cutoff);

    const byType: Record<RunCategory, { km: number; count: number }> = {
      neuromuscolare: { km: 0, count: 0 },
      metabolico:     { km: 0, count: 0 },
      strutturale:    { km: 0, count: 0 },
    };
    for (const r of periodRuns) {
      const cat = classifyRun(r);
      byType[cat].km    += r.distance_km;
      byType[cat].count += 1;
    }

    const totalKm    = periodRuns.reduce((s, r) => s + r.distance_km, 0);
    const totalRuns  = periodRuns.length;

    // Adattamento dominante (by km)
    const dominant = (Object.entries(byType) as [RunCategory, { km: number; count: number }][])
      .sort((a, b) => b[1].km - a[1].km)[0]?.[0] ?? null;

    return { totalKm, totalRuns, byType, dominant };
  }, [runs, period]);

  if (runs.length === 0) {
    return (
      <div className="bg-bg-card border border-[#1E293B] rounded-xl h-full flex items-center justify-center">
        <p className="text-xs text-text-muted">Sincronizza le corse per vedere gli adattamenti</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 border-b border-[#1E293B]">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧬</span>
          <h3 className="text-[11px] font-black uppercase tracking-wider text-text-primary">
            Adattamenti
          </h3>
          <span className="text-[9px] text-text-muted">Quando emergerà ogni corsa</span>
        </div>
        {/* Period tabs */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="text-[9px] font-black px-2 py-1 rounded-md transition-all"
              style={{
                color:           period === p ? "#0F172A" : "#64748B",
                backgroundColor: period === p ? "#C0FF00" : "transparent",
              }}
            >
              {p}gg
            </button>
          ))}
        </div>
      </div>

      {/* ── Body: left list + right summary ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: run list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
          {recentRuns.map((run) => {
            const cat   = classifyRun(run);
            const cfg   = CATEGORIES[cat];
            const pct   = maturationPct(run.date, cfg.daysToAdapt);
            const dLeft = daysUntilPeak(run.date, cfg.daysToAdapt);
            const peakStr = formatPeakDate(run.date, cfg.daysToAdapt);
            const isReady   = dLeft <= 0;
            const isMaturing = dLeft > 0 && pct > 0;

            return (
              <div
                key={run.id}
                className="flex items-center gap-3 px-4 py-2 border-b border-[#0F172A] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                {/* Type icon */}
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs"
                  style={{ backgroundColor: cfg.color + "20" }}
                >
                  {cfg.icon}
                </div>

                {/* Run info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-black text-white">
                      {run.distance_km.toFixed(1)} km
                    </span>
                    <span className="text-[9px] text-[#475569]">
                      {new Date(run.date).toLocaleDateString("it", { day: "numeric", month: "short" })}
                    </span>
                    <span className="text-[9px] text-[#475569]">· {run.avg_pace}/km</span>
                  </div>
                  {/* Maturation bar */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-[#1E293B] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isReady ? "#C0FF00" : cfg.color,
                          opacity: isReady ? 1 : 0.8,
                        }}
                      />
                    </div>
                    <span
                      className="text-[9px] font-bold shrink-0"
                      style={{ color: cfg.color }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Peak info */}
                <div className="text-right shrink-0">
                  <div
                    className="text-[9px] font-black uppercase tracking-wider"
                    style={{ color: cfg.color }}
                  >
                    {cfg.label.split("")[0]}{cfg.label.slice(1, 6)}.
                  </div>
                  {isReady ? (
                    <div className="text-[9px] font-black text-[#C0FF00]">✓ Attivo</div>
                  ) : (
                    <div className="text-[9px] text-[#64748B]">
                      {dLeft <= 1 ? "Domani" : `${peakStr}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px bg-[#1E293B] my-3 shrink-0" />

        {/* Right: summary for selected period */}
        <div className="w-[175px] shrink-0 flex flex-col gap-3 p-3 overflow-hidden">
          <div className="text-[9px] text-text-muted font-bold uppercase tracking-widest">
            Ultimi {period} giorni
          </div>

          {/* Total */}
          <div className="flex gap-3">
            <div className="flex flex-col">
              <span className="text-xl font-black text-white leading-none">
                {summary.totalKm.toFixed(0)}<span className="text-xs text-[#475569] ml-0.5">km</span>
              </span>
              <span className="text-[9px] text-[#64748B]">{summary.totalRuns} corse</span>
            </div>
          </div>

          {/* By type */}
          <div className="flex flex-col gap-2">
            {(["neuromuscolare", "metabolico", "strutturale"] as RunCategory[]).map((cat) => {
              const cfg  = CATEGORIES[cat];
              const data = summary.byType[cat];
              const total = summary.totalKm;
              const pct = total > 0 ? Math.round((data.km / total) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="flex items-center gap-1 text-[9px] font-bold" style={{ color: cfg.color }}>
                      {cfg.icon} {cfg.label.slice(0, 8)}.
                    </span>
                    <span className="text-[9px] text-[#64748B]">{data.km.toFixed(0)} km</span>
                  </div>
                  <div className="h-1 bg-[#1E293B] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                    />
                  </div>
                  <div className="text-[8px] text-[#334155] mt-0.5">{cfg.rangeLabel} · {cfg.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Dominant adaptation insight */}
          {summary.dominant && (
            <div
              className="rounded-lg px-2 py-1.5 text-[9px] leading-snug border mt-auto"
              style={{
                borderColor: CATEGORIES[summary.dominant].color + "30",
                backgroundColor: CATEGORIES[summary.dominant].color + "10",
                color: CATEGORIES[summary.dominant].color,
              }}
            >
              {CATEGORIES[summary.dominant].icon} Focus{" "}
              <strong>{CATEGORIES[summary.dominant].label}</strong>
              <br />
              <span className="opacity-70">{CATEGORIES[summary.dominant].desc}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
