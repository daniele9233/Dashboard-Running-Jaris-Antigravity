import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Timer, TrendingUp, TrendingDown } from "lucide-react";
import type { Run } from "../types/api";

interface RacePredictionsProps {
  runs: Run[];
  vdot: number | null;
  racePredictions: Record<string, string> | null;
}

// ─── VDOT calculation from a single run ──────────────────────────────────────
function estimateVdot(distanceKm: number, durationMin: number): number | null {
  if (distanceKm <= 0 || durationMin <= 0) return null;
  if (durationMin < 10) return null; // too short
  const v = (distanceKm * 1000) / durationMin; // meters per minute
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  const denom =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * durationMin) +
    0.2989558 * Math.exp(-0.1932605 * durationMin);
  const vdot = vo2 / denom;
  if (vdot < 28 || vdot > 70) return null;
  return parseFloat(vdot.toFixed(1));
}

// ─── Approximate race predictions from VDOT (Jack Daniels) ──────────────────
function predictRaceTime(vdot: number, distanceKm: number): string {
  // Formula: estimate optimal velocity in m/min from VDOT
  // v at VO2max ≈ (vdot + 4.6) / 0.182258 (ignoring quadratic term as approx)
  // Then apply race efficiency factor
  const efficiencyFactors: Record<number, number> = {
    5: 0.9757,
    10: 0.9387,
    21.0975: 0.9020,
    42.195: 0.8600,
  };
  const ef = efficiencyFactors[distanceKm] ?? 0.88;
  // optimal velocity at 100% VO2max
  const vo2max = vdot;
  const v_opt = (vo2max + 4.60) / 0.182258; // approx, ignores quadratic
  const v_race = v_opt * ef; // race velocity m/min
  const totalMin = (distanceKm * 1000) / v_race;
  const hours = Math.floor(totalMin / 60);
  const mins = Math.floor(totalMin % 60);
  const secs = Math.round((totalMin % 1) * 60);
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// ─── Parse time string → minutes ────────────────────────────────────────────
function parseTime(t: string): number | null {
  const parts = t.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return null;
}

// ─── Monthly VDOT history ────────────────────────────────────────────────────
function buildMonthlyVdot(runs: Run[]): { name: string; vdot: number | null }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthRuns = runs.filter((r) => {
      const rd = new Date(r.date);
      return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
    });
    let bestVdot: number | null = null;
    for (const r of monthRuns) {
      if (!r.distance_km || !r.duration_minutes) continue;
      if (r.distance_km < 3) continue; // ignore very short runs
      const v = estimateVdot(r.distance_km, r.duration_minutes);
      if (v !== null && (bestVdot === null || v > bestVdot)) {
        bestVdot = v;
      }
    }
    return {
      name: d.toLocaleString("it", { month: "short" }).toUpperCase(),
      vdot: bestVdot,
    };
  });
}

// ─── Races config ────────────────────────────────────────────────────────────
const RACES = [
  { key: "5K",  label: "5K",   distKm: 5,       icon: "⚡", color: "#14B8A6" },
  { key: "10K", label: "10K",  distKm: 10,      icon: "🏃", color: "#3B82F6" },
  { key: "HM",  label: "Mezza",distKm: 21.0975, icon: "🎯", color: "#F59E0B" },
  { key: "M",   label: "Maratona", distKm: 42.195, icon: "🏆", color: "#8B5CF6" },
];

// Keys used in racePredictions from backend
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

// ─── vdotToTime: converte VDOT + distanza → tempo gara formattato ────────────
function vdotToTime(vdot: number, distanceMeters: number): string {
  const a = 0.000104, b = 0.182258, c = -(vdot + 4.60);
  const vMax = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a); // m/min a 100% VO2max

  let intensityFactor: number;
  if (distanceMeters <= 5000) intensityFactor = 0.979;
  else if (distanceMeters <= 10000) intensityFactor = 0.960;
  else if (distanceMeters <= 21097) intensityFactor = 0.920;
  else intensityFactor = 0.879;

  const raceVelocity = vMax * intensityFactor;
  const totalSeconds = (distanceMeters / raceVelocity) * 60;

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Trend chart tooltip con previsioni gara ─────────────────────────────────
const TrendTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number | null; color: string; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  const vdotEntry = payload.find((e) => e.name === "VDOT" && e.value != null);
  const vdotVal = vdotEntry?.value ?? null;
  return (
    <div className="bg-[#1E293B] border border-[#334155] p-3 rounded-xl shadow-xl text-xs min-w-[180px]">
      <p className="text-[#C0FF00] font-bold mb-2 uppercase tracking-wider">{label}</p>
      {vdotVal != null && (
        <>
          <p className="text-white font-bold mb-2">VDOT {vdotVal}</p>
          <div className="space-y-1 border-t border-white/10 pt-2">
            {[
              { label: "5K", meters: 5000, color: "#14B8A6" },
              { label: "10K", meters: 10000, color: "#3B82F6" },
              { label: "Mezza", meters: 21097, color: "#F59E0B" },
              { label: "Maratona", meters: 42195, color: "#8B5CF6" },
            ].map((race) => (
              <div key={race.label} className="flex justify-between gap-4">
                <span style={{ color: race.color }}>{race.label}</span>
                <span className="text-white font-bold font-mono">{vdotToTime(vdotVal, race.meters)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

export function RacePredictions({ runs, vdot, racePredictions }: RacePredictionsProps) {
  const predictions = racePredictions ?? {};

  const monthlyVdot = useMemo(() => buildMonthlyVdot(runs), [runs]);

  // Fill gaps in monthly VDOT with interpolation / forward-fill
  const filledVdot = useMemo(() => {
    const arr = [...monthlyVdot];
    // forward fill
    let last: number | null = null;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].vdot !== null) last = arr[i].vdot;
      else if (last !== null) arr[i] = { ...arr[i], vdot: last };
    }
    return arr;
  }, [monthlyVdot]);

  // Compute trend: compare last month vs 3 months ago
  const vdotTrend = useMemo(() => {
    const recent = filledVdot[filledVdot.length - 1]?.vdot;
    const old = filledVdot[filledVdot.length - 4]?.vdot;
    if (recent == null || old == null) return null;
    return parseFloat((recent - old).toFixed(1));
  }, [filledVdot]);

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-[#C0FF00]" />
          <h2 className="text-lg font-bold tracking-wider uppercase text-text-primary">
            Previsioni di Gara
          </h2>
          {vdot && (
            <span className="text-[10px] bg-[#C0FF00]/10 text-[#C0FF00] font-black px-2 py-0.5 rounded-md border border-[#C0FF00]/20 uppercase tracking-wider">
              VDOT {vdot}
            </span>
          )}
        </div>
        {vdotTrend !== null && (
          <div className={`flex items-center gap-1 text-sm font-bold ${vdotTrend >= 0 ? "text-[#14B8A6]" : "text-[#F43F5E]"}`}>
            {vdotTrend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {vdotTrend >= 0 ? "+" : ""}{vdotTrend} VDOT (3 mesi)
          </div>
        )}
      </div>

      {/* Race prediction cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {RACES.map((race) => {
          const backendTime = findPrediction(predictions, race.key);
          const vdotTime = vdot ? predictRaceTime(vdot, race.distKm) : null;
          const displayTime = backendTime ?? vdotTime;
          const timeMin = displayTime ? parseTime(displayTime) : null;

          // Pace per km
          let paceStr = "—";
          if (timeMin && timeMin > 0) {
            const paceMinPerKm = timeMin / race.distKm;
            const pm = Math.floor(paceMinPerKm);
            const ps = Math.round((paceMinPerKm % 1) * 60);
            paceStr = `${pm}:${String(ps).padStart(2, "0")}/km`;
          }

          return (
            <div
              key={race.key}
              className="rounded-xl p-4 border flex flex-col gap-2 relative overflow-hidden group hover:border-opacity-60 transition-all"
              style={{
                borderColor: race.color + "30",
                backgroundColor: race.color + "06",
              }}
            >
              {/* accent bar */}
              <div
                className="absolute top-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-t-xl"
                style={{ backgroundColor: race.color }}
              />
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: race.color }}>
                {race.label}
              </div>
              <div className="text-xl font-black text-white leading-tight">
                {displayTime ?? "—"}
              </div>
              <div className="text-[10px] text-text-muted font-medium">{paceStr}</div>
              {!backendTime && vdot && (
                <div className="text-[9px] text-text-muted italic">stimata da VDOT</div>
              )}
            </div>
          );
        })}
      </div>

      {/* VDOT trend chart */}
      <div>
        <div className="text-[10px] text-text-muted font-semibold tracking-wider uppercase mb-3">
          Andamento VDOT — Ultimi 12 Mesi
        </div>
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filledVdot} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
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
                domain={["auto", "auto"]}
                dx={-4}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
              <Line
                type="monotone"
                dataKey="vdot"
                name="VDOT"
                stroke="#C0FF00"
                strokeWidth={2}
                dot={{ r: 3, fill: "#C0FF00", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#C0FF00", stroke: "#fff", strokeWidth: 1 }}
                connectNulls={false}
              />
              {vdot && (
                <Line
                  type="monotone"
                  dataKey={() => vdot}
                  name="Attuale"
                  stroke="#C0FF00"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.3}
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
