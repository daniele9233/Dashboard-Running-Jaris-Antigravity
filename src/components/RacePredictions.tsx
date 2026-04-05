import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Timer, TrendingUp, TrendingDown } from "lucide-react";
import type { Run } from "../types/api";

interface RacePredictionsProps {
  runs: Run[];
  vdot: number | null;
  racePredictions: Record<string, string> | null;
}

// ─── VDOT da singola corsa (Daniels) ─────────────────────────────────────────
function estimateVdot(distanceKm: number, durationMin: number): number | null {
  if (distanceKm < 5 || durationMin <= 0 || durationMin < 10) return null; // < 5K distorce VDOT
  const paceMinPerKm = durationMin / distanceKm;
  if (paceMinPerKm > 6.0) return null; // ritmo facile/recupero — non usare per VDOT
  const v = (distanceKm * 1000) / durationMin;
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  const denom =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * durationMin) +
    0.2989558 * Math.exp(-0.1932605 * durationMin);
  const vdot = vo2 / denom;
  if (vdot < 28 || vdot > 70) return null;
  return parseFloat(vdot.toFixed(1));
}

// ─── Tempo gara (min) via bisection — metodo esatto Daniels ──────────────────
// Trova T tale che: VO2(distM/T) = vdot * %VO2max(T)
function vdotToRaceTimeMin(vdot: number, distanceM: number): number {
  let lo = distanceM / 600; // velocità massima teorica (600 m/min)
  let hi = distanceM / 5;   // velocità minima teorica (5 m/min)
  for (let i = 0; i < 60; i++) {
    const T = (lo + hi) / 2;
    const v = distanceM / T;
    const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
    const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * T) + 0.2989558 * Math.exp(-0.1932605 * T);
    if (vo2 > vdot * pct) lo = T; else hi = T;
  }
  return (lo + hi) / 2;
}

// ─── Pace min/km da VDOT + distanza (metodo esatto) ──────────────────────────
function vdotToPaceMinKm(vdot: number, distanceMeters: number): number {
  const T = vdotToRaceTimeMin(vdot, distanceMeters);
  return T / (distanceMeters / 1000);
}

function fmtPace(v: number): string {
  const m = Math.floor(v);
  const s = Math.round((v % 1) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Tempo gara formattato ────────────────────────────────────────────────────
function vdotToTime(vdot: number, distanceMeters: number): string {
  const totalMin = vdotToRaceTimeMin(vdot, distanceMeters);
  const h = Math.floor(totalMin / 60);
  const m = Math.floor(totalMin % 60);
  const s = Math.round((totalMin % 1) * 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function predictRaceTime(vdot: number, distanceKm: number): string {
  return vdotToTime(vdot, distanceKm * 1000);
}

// ─── Parse time string → minutes ─────────────────────────────────────────────
function parseTime(t: string): number | null {
  const parts = t.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return null;
}

// ─── Monthly VDOT history ─────────────────────────────────────────────────────
function buildMonthlyVdot(runs: Run[]): { name: string; vdot: number | null }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthRuns = runs.filter((r) => {
      const rd = new Date(r.date);
      return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
    });
    let best: number | null = null;
    for (const r of monthRuns) {
      const v = estimateVdot(r.distance_km, r.duration_minutes);
      if (v !== null && (best === null || v > best)) best = v;
    }
    return { name: d.toLocaleString("it", { month: "short" }).toUpperCase(), vdot: best };
  });
}

// ─── Race config ──────────────────────────────────────────────────────────────
const RACES = [
  { key: "5K",  label: "5K",      distKm: 5,       distM: 5000,  color: "#14B8A6" },
  { key: "10K", label: "10K",     distKm: 10,      distM: 10000, color: "#3B82F6" },
  { key: "HM",  label: "Mezza",   distKm: 21.0975, distM: 21097, color: "#F59E0B" },
  { key: "M",   label: "Maratona",distKm: 42.195,  distM: 42195, color: "#8B5CF6" },
];

const BACKEND_KEYS: Record<string, string[]> = {
  "5K":  ["5K", "5k"],
  "10K": ["10K", "10k"],
  "HM":  ["Half Marathon", "HM", "21K", "Mezza"],
  "M":   ["Marathon", "Maratona", "42K"],
};

function findPrediction(predictions: Record<string, string>, key: string): string | null {
  for (const k of BACKEND_KEYS[key] ?? []) {
    if (predictions[k]) return predictions[k];
  }
  return null;
}

// ─── Pace chart tooltip ───────────────────────────────────────────────────────
const PaceTooltip = ({
  active,
  payload,
  label,
  activeRace,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  activeRace: string;
}) => {
  if (!active || !payload?.length) return null;
  const entries = payload.filter((p) => p.value != null);
  return (
    <div className="bg-[#1E293B] border border-[#334155] p-3 rounded-xl shadow-xl text-xs min-w-[170px]">
      <p className="text-[#C0FF00] font-bold mb-2 uppercase tracking-wider">{label}</p>
      <div className="space-y-1.5">
        {entries.map((e) => (
          <div key={e.dataKey} className="flex justify-between gap-4">
            <span style={{ color: e.color }}>{e.name}</span>
            <span className="text-white font-bold font-mono">{fmtPace(e.value)}/km</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

type ActiveRace = "all" | "5K" | "10K" | "HM" | "M";

export function RacePredictions({ runs, vdot, racePredictions }: RacePredictionsProps) {
  const predictions = racePredictions ?? {};
  const [activeRace, setActiveRace] = useState<ActiveRace>("all");

  const monthlyVdot = useMemo(() => buildMonthlyVdot(runs), [runs]);

  // Forward-fill nulls
  const filledVdot = useMemo(() => {
    const arr = [...monthlyVdot];
    let last: number | null = null;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].vdot !== null) last = arr[i].vdot;
      else if (last !== null) arr[i] = { ...arr[i], vdot: last };
    }
    return arr;
  }, [monthlyVdot]);

  // Pace data per ogni distanza
  const paceData = useMemo(() => {
    return filledVdot.map((point) => {
      const v = point.vdot;
      if (v == null) return { name: point.name, vdot: null };
      return {
        name: point.name,
        vdot: v,
        pace5k:  parseFloat(vdotToPaceMinKm(v, 5000).toFixed(3)),
        pace10k: parseFloat(vdotToPaceMinKm(v, 10000).toFixed(3)),
        paceHM:  parseFloat(vdotToPaceMinKm(v, 21097).toFixed(3)),
        paceM:   parseFloat(vdotToPaceMinKm(v, 42195).toFixed(3)),
      };
    });
  }, [filledVdot]);

  const vdotTrend = useMemo(() => {
    const recent = filledVdot[filledVdot.length - 1]?.vdot;
    const old = filledVdot[filledVdot.length - 4]?.vdot;
    if (recent == null || old == null) return null;
    return parseFloat((recent - old).toFixed(1));
  }, [filledVdot]);

  // Y-axis domain basato su linee visibili
  const yDomain = useMemo(() => {
    const keys =
      activeRace === "all"
        ? ["pace5k", "pace10k", "paceHM", "paceM"]
        : activeRace === "5K" ? ["pace5k"]
        : activeRace === "10K" ? ["pace10k"]
        : activeRace === "HM" ? ["paceHM"]
        : ["paceM"];
    const vals = paceData.flatMap((p: any) => keys.map((k) => p[k]).filter(Boolean));
    if (!vals.length) return ["auto", "auto"];
    const min = Math.min(...vals) - 0.1;
    const max = Math.max(...vals) + 0.1;
    return [parseFloat(min.toFixed(2)), parseFloat(max.toFixed(2))];
  }, [paceData, activeRace]);

  const FILTER_BUTTONS: { key: ActiveRace; label: string; color: string }[] = [
    { key: "all", label: "Tutte", color: "#94A3B8" },
    { key: "5K",  label: "5K",    color: "#14B8A6" },
    { key: "10K", label: "10K",   color: "#3B82F6" },
    { key: "HM",  label: "Mezza", color: "#F59E0B" },
    { key: "M",   label: "Maratona", color: "#8B5CF6" },
  ];

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-[#C0FF00]" />
          <h2 className="text-sm font-bold tracking-wider uppercase text-text-primary">
            Previsioni di Gara
          </h2>
          {vdot && (
            <span className="text-[10px] bg-[#C0FF00]/10 text-[#C0FF00] font-black px-2 py-0.5 rounded-md border border-[#C0FF00]/20 uppercase tracking-wider">
              VDOT {vdot}
            </span>
          )}
        </div>
        {vdotTrend !== null && (
          <div className={`flex items-center gap-1 text-xs font-bold ${vdotTrend >= 0 ? "text-[#14B8A6]" : "text-[#F43F5E]"}`}>
            {vdotTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {vdotTrend >= 0 ? "+" : ""}{vdotTrend} (3M)
          </div>
        )}
      </div>

      {/* Race cards */}
      <div className="grid grid-cols-2 gap-3 mb-4 shrink-0">
        {RACES.map((race) => {
          const backendTime = findPrediction(predictions, race.key);
          const vdotTime = vdot ? predictRaceTime(vdot, race.distKm) : null;
          const displayTime = backendTime ?? vdotTime;
          const timeMin = displayTime ? parseTime(displayTime) : null;
          let paceStr = "—";
          if (timeMin && timeMin > 0) {
            const p = timeMin / race.distKm;
            paceStr = `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}/km`;
          }
          return (
            <div
              key={race.key}
              className="rounded-xl p-3 border flex flex-col gap-1 relative overflow-hidden group hover:border-opacity-60 transition-all"
              style={{ borderColor: race.color + "30", backgroundColor: race.color + "06" }}
            >
              <div className="absolute top-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500" style={{ backgroundColor: race.color }} />
              <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: race.color }}>{race.label}</div>
              <div className="text-lg font-black text-white leading-tight">{displayTime ?? "—"}</div>
              <div className="text-[9px] text-text-muted">{paceStr}</div>
            </div>
          );
        })}
      </div>

      {/* Chart section — fills remaining space */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Chart header + filter */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="text-[9px] text-text-muted font-semibold tracking-wider uppercase">
            Andamento Pace · 12 Mesi
          </div>
          {/* Filter buttons */}
          <div className="flex gap-1">
            {FILTER_BUTTONS.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setActiveRace(key)}
                className="text-[9px] font-bold px-2 py-0.5 rounded-md transition-all border"
                style={{
                  color: activeRace === key ? "#0F172A" : color,
                  backgroundColor: activeRace === key ? color : "transparent",
                  borderColor: color + (activeRace === key ? "FF" : "50"),
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={paceData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#1E293B" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 9 }}
                dy={6}
                interval={1}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 9 }}
                domain={yDomain}
                tickFormatter={fmtPace}
                dx={-4}
                width={36}
                reversed
              />
              <Tooltip
                content={(props) => (
                  <PaceTooltip {...props} activeRace={activeRace} />
                )}
                cursor={{ stroke: "rgba(255,255,255,0.08)" }}
              />
              <Line
                type="monotone"
                dataKey="pace5k"
                name="5K"
                stroke="#14B8A6"
                strokeWidth={activeRace === "5K" || activeRace === "all" ? 2 : 0.5}
                strokeOpacity={activeRace === "all" || activeRace === "5K" ? 1 : 0.2}
                dot={false}
                isAnimationActive={false}
                hide={false}
              />
              <Line
                type="monotone"
                dataKey="pace10k"
                name="10K"
                stroke="#3B82F6"
                strokeWidth={activeRace === "10K" || activeRace === "all" ? 2 : 0.5}
                strokeOpacity={activeRace === "all" || activeRace === "10K" ? 1 : 0.2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="paceHM"
                name="Mezza"
                stroke="#F59E0B"
                strokeWidth={activeRace === "HM" || activeRace === "all" ? 2 : 0.5}
                strokeOpacity={activeRace === "all" || activeRace === "HM" ? 1 : 0.2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="paceM"
                name="Maratona"
                stroke="#8B5CF6"
                strokeWidth={activeRace === "M" || activeRace === "all" ? 2 : 0.5}
                strokeOpacity={activeRace === "all" || activeRace === "M" ? 1 : 0.2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
