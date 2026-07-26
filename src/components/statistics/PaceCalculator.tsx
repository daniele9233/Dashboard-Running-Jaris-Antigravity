import { useState, useMemo } from "react";
import { Calculator, Timer, Gauge, Zap, Activity } from "lucide-react";
import { CHART_SERIES, CHART_SURFACE } from "./chartTheme";

const NEON = CHART_SERIES.primary;
const CYAN = CHART_SERIES.compare;
const LOAD = CHART_SERIES.load;
const RISK = CHART_SERIES.risk;
const PROJECTED = CHART_SERIES.projected;

const DISTANCES = [
  { label: "5K", km: 5 },
  { label: "10K", km: 10 },
  { label: "Mezza", km: 21.0975 },
  { label: "Maratona", km: 42.195 },
];

const ALL_DISTANCES = [
  { label: "1 km", km: 1 },
  { label: "1 miglio", km: 1.60934 },
  { label: "3K", km: 3 },
  { label: "5K", km: 5 },
  { label: "8K", km: 8 },
  { label: "10K", km: 10 },
  { label: "15K", km: 15 },
  { label: "10 miglia", km: 16.0934 },
  { label: "Mezza", km: 21.0975 },
  { label: "25K", km: 25 },
  { label: "30K", km: 30 },
  { label: "Maratona", km: 42.195 },
  { label: "50K", km: 50 },
  { label: "100K", km: 100 },
];

const VDOT_ZONES = [
  { key: "easy", label: "Easy / Recupero", abbr: "E/L", pct: 0.65, color: CYAN, desc: "Corsa facile, recupero attivo" },
  { key: "marathon", label: "Marathon Pace", abbr: "M", pct: 0.80, color: "#34D399", desc: "Ritmo maratona" },
  { key: "threshold", label: "Soglia / Tempo", abbr: "T", pct: 0.88, color: LOAD, desc: "Tempo run 20-40 min" },
  { key: "interval", label: "Interval VO2max", abbr: "I", pct: 0.98, color: RISK, desc: "Ripetute 800-1600m" },
  { key: "repetition", label: "Repetition / Speed", abbr: "R", pct: 1.05, color: NEON, desc: "Ripetizioni 200-400m" },
];

function fmtPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  if (total <= 0) return "—";
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtTime(minutes: number): string {
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseTimeToMin(str: string): number | null {
  const parts = str.split(":").map(Number);
  if (parts.some(isNaN) || parts.length > 3 || parts.length < 1) return null;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return parts[0] / 60;
}

function parsePaceToSec(str: string): number | null {
  const parts = str.split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return parts[0] * 60 + parts[1];
}

function riegelPredict(t1Min: number, d1Km: number, d2Km: number): number {
  return t1Min * Math.pow(d2Km / d1Km, 1.06);
}

function estimateVdot(distanceKm: number, durationMin: number): number | null {
  if (distanceKm <= 0 || durationMin <= 0) return null;
  const v = (distanceKm * 1000) / durationMin;
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  const denom =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * durationMin) +
    0.2989558 * Math.exp(-0.1932605 * durationMin);
  const vdot = vo2 / denom;
  if (vdot < 25 || vdot > 85) return null;
  return parseFloat(vdot.toFixed(1));
}

function vdotToPace(vdot: number, fraction: number): number {
  const vo2 = vdot * fraction;
  const disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60);
  const vel = (-0.182258 + Math.sqrt(disc)) / (2 * 0.000104);
  return 1000 / vel;
}

type InputMode = "distance-time" | "distance-pace" | "time-pace";

const STYLE = {
  card: "rounded-[26px] border p-6",
  cardBg: "#0E0E0E",
  border: "#1E1E1E",
  input:
    "w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white font-mono text-lg font-bold focus:outline-none focus:border-[#C0FF00]/40 text-center transition-all",
  label: "text-[10px] font-black tracking-[0.22em] uppercase mb-2 text-center",
  kpiValue: "text-[28px] leading-none font-black",
  kpiLabel: "text-[9px] uppercase tracking-[0.2em] font-black mt-1",
};

export function PaceCalculator({ vdot }: { vdot?: number | null }) {
  const [distance, setDistance] = useState<string>("10");
  const [time, setTime] = useState<string>("45:00");
  const [pace, setPace] = useState<string>("4:30");
  const [lastEdited, setLastEdited] = useState<InputMode>("distance-time");

  const distKm = parseFloat(distance) || 0;
  const timeMin = parseTimeToMin(time);
  const paceSec = parsePaceToSec(pace);

  const computed = useMemo(() => {
    let finalTime: number | null = timeMin;
    let finalPace: number | null = paceSec;
    let finalDist = distKm;

    if (lastEdited === "distance-time" && timeMin && distKm > 0) {
      finalPace = (timeMin * 60) / distKm;
    } else if (lastEdited === "distance-pace" && paceSec && distKm > 0) {
      finalTime = (distKm * paceSec) / 60;
    } else if (lastEdited === "time-pace" && paceSec && timeMin) {
      finalDist = (timeMin * 60) / paceSec;
      finalPace = paceSec;
    }

    const predictions = finalTime && finalDist > 0
      ? ALL_DISTANCES.map((d) => ({
          ...d,
          timeMin: riegelPredict(finalTime, finalDist, d.km),
        }))
      : [];

    const computedVdot = finalTime && finalDist >= 3
      ? estimateVdot(finalDist, finalTime)
      : null;

    const zones = computedVdot
      ? VDOT_ZONES.map((z) => ({
          ...z,
          pace: vdotToPace(computedVdot, z.pct),
        }))
      : [];

    return { finalTime, finalPace, finalDist, predictions, computedVdot, zones };
  }, [distKm, timeMin, paceSec, lastEdited]);

  const setFromPreset = (km: number) => {
    setDistance(km.toString());
    setLastEdited("distance-time");
  };

  const handleDistanceChange = (v: string) => { setDistance(v); setLastEdited((prev) => prev === "time-pace" ? "time-pace" : "distance-time"); };
  const handleTimeChange = (v: string) => { setTime(v); setLastEdited((prev) => prev === "distance-pace" ? "distance-pace" : "distance-time"); };
  const handlePaceChange = (v: string) => { setPace(v); setLastEdited("distance-pace"); };

  return (
    <div className="space-y-6">
      <section className={STYLE.card} style={{ background: STYLE.cardBg, borderColor: STYLE.border, borderLeft: `3px solid ${NEON}` }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(192,255,0,0.10)" }}>
            <Calculator className="w-5 h-5" style={{ color: NEON }} />
          </div>
          <div>
            <h2 className="text-lg font-black italic text-white">Calcolatore Passo / Tempo</h2>
            <p className="text-[10px] tracking-[0.2em] font-bold" style={{ color: "#666" }}>RIEMPINE DUE — IL TERZO SI CALCOLA</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <div className={STYLE.label} style={{ color: CYAN }}>Distanza (km)</div>
            <input
              type="number"
              value={distance}
              onChange={(e) => handleDistanceChange(e.target.value)}
              onFocus={() => lastEdited === "time-pace" && setLastEdited("distance-time")}
              className={STYLE.input}
              placeholder="10"
              step="0.1"
              min="0.1"
            />
            <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
              {DISTANCES.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setFromPreset(d.km)}
                  className="px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider transition-all"
                  style={{
                    background: Math.abs(distKm - d.km) < 0.01 ? NEON : "rgba(255,255,255,0.04)",
                    color: Math.abs(distKm - d.km) < 0.01 ? "#0A0A0A" : "#888",
                    border: `1px solid ${Math.abs(distKm - d.km) < 0.01 ? NEON : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className={STYLE.label} style={{ color: LOAD }}>Tempo (h:mm:ss o mm:ss)</div>
            <input
              type="text"
              value={time}
              onChange={(e) => handleTimeChange(e.target.value)}
              onFocus={() => lastEdited === "distance-pace" && setLastEdited("distance-time")}
              className={STYLE.input}
              placeholder="45:00"
            />
            <div className="text-[9px] font-bold tracking-wider text-center mt-2" style={{ color: "#555" }}>
              {computed.finalTime ? fmtTime(computed.finalTime) : "—"}
            </div>
          </div>

          <div>
            <div className={STYLE.label} style={{ color: RISK }}>Passo (min:sec/km)</div>
            <input
              type="text"
              value={pace}
              onChange={(e) => handlePaceChange(e.target.value)}
              onFocus={() => setLastEdited("distance-pace")}
              className={STYLE.input}
              placeholder="4:30"
            />
            <div className="text-[9px] font-bold tracking-wider text-center mt-2" style={{ color: "#555" }}>
              {computed.finalPace ? `${fmtPace(computed.finalPace)}/km` : "—"}
            </div>
          </div>
        </div>

        <div className="text-[9px] font-bold tracking-[0.2em] uppercase text-center" style={{ color: "#444" }}>
          {lastEdited === "distance-time" && "⇠ MODIFICA DISTANZA O TEMPO → IL PASSO SI AGGIORNA"}
          {lastEdited === "distance-pace" && "⇠ MODIFICA DISTANZA O PASSO → IL TEMPO SI AGGIORNA"}
          {lastEdited === "time-pace" && "⇠ MODIFICA TEMPO O PASSO → LA DISTANZA SI AGGIORNA"}
        </div>
      </section>

      {computed.predictions.length > 0 && (
        <section className={STYLE.card} style={{ background: STYLE.cardBg, borderColor: STYLE.border, borderLeft: `3px solid ${CYAN}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Timer className="w-4 h-4" style={{ color: CYAN }} />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Previsioni su tutte le distanze</h3>
            <span className="text-[9px] font-bold" style={{ color: "#555" }}>· Riegel T₂ = T₁ × (D₂/D₁)¹·⁰⁶</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
            {computed.predictions.map((p) => {
              const isActive = Math.abs((p.km - distKm)) < 0.001;
              return (
                <div
                  key={p.label}
                  className="rounded-xl p-3 text-center border"
                  style={{
                    background: isActive ? "rgba(192,255,0,0.08)" : "#0A0A0A",
                    borderColor: isActive ? `${NEON}44` : "#1A1A1A",
                  }}
                >
                  <div className="text-[9px] font-black tracking-wider mb-1.5" style={{ color: isActive ? NEON : "#888" }}>
                    {p.label}
                  </div>
                  <div className="text-sm font-black font-mono text-white">{fmtTime(p.timeMin)}</div>
                  <div className="text-[9px] font-bold mt-1" style={{ color: "#555" }}>
                    {fmtPace((p.timeMin * 60) / p.km)}/km
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {computed.computedVdot && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={STYLE.card} style={{ background: STYLE.cardBg, borderColor: STYLE.border, borderLeft: `3px solid ${PROJECTED}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4" style={{ color: PROJECTED }} />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">VDOT Stimato</h3>
            </div>
            <div className="text-center mb-4">
              <div className="text-[48px] font-black leading-none" style={{ color: NEON }}>{computed.computedVdot}</div>
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase mt-1" style={{ color: "#666" }}>Jack Daniels Formula</div>
            </div>
          </div>

          <div className={STYLE.card} style={{ background: STYLE.cardBg, borderColor: STYLE.border, borderLeft: `3px solid ${LOAD}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4" style={{ color: LOAD }} />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Zone VDOT ({computed.computedVdot})</h3>
            </div>
            <div className="space-y-2">
              {computed.zones.map((z) => (
                <div key={z.key} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: z.color }} />
                    <div>
                      <div className="text-[11px] font-bold text-white">{z.label}</div>
                      <div className="text-[9px] font-bold" style={{ color: "#555" }}>{z.desc}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black font-mono text-white">{fmtPace(z.pace)}</div>
                    <div className="text-[9px] font-bold" style={{ color: "#555" }}>/km</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
