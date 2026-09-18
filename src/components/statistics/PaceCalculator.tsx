import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Calculator, Timer, Gauge, Zap, Activity } from "lucide-react";
import { CHART_SERIES } from "./chartTheme";

const NEON = CHART_SERIES.primary;
const CYAN = CHART_SERIES.compare;
const LOAD = CHART_SERIES.load;
const RISK = CHART_SERIES.risk;
const PROJECTED = CHART_SERIES.projected;

const KM_PER_MILE = 1.60934;

const DISTANCES = [
  { label: "1K", km: 1 },
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

// ─── Formattazione ───────────────────────────────────────────────────────────
function fmtPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  if (!Number.isFinite(total) || total <= 0) return "—";
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtTime(minutes: number): string {
  const total = Math.round(minutes * 60);
  if (!Number.isFinite(total) || total <= 0) return "—";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDistance(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return "—";
  return km >= 100 ? km.toFixed(0) : km.toFixed(km < 10 ? 2 : 1);
}

/**
 * Parser tollerante: separatore libero e forma compatta.
 *   "4:30" · "4.30" · "4,30" · "4 30" · "430" → 4 min 30 sec
 *   "1:30:00" · "13000"                      → 1 h 30 min
 *   "4"                                      → 4 min
 * Restituisce secondi totali.
 */
function parseClock(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // Forma compatta senza separatori: le ultime due cifre sono i secondi.
  if (/^\d+$/.test(s)) {
    const n = s;
    if (n.length <= 2) return Number(n) * 60;               // "4" → 4:00
    if (n.length <= 4) {                                     // "430" → 4:30
      const sec = Number(n.slice(-2));
      const min = Number(n.slice(0, -2));
      return sec > 59 ? null : min * 60 + sec;
    }
    const sec = Number(n.slice(-2));                         // "13000" → 1:30:00
    const min = Number(n.slice(-4, -2));
    const hr = Number(n.slice(0, -4));
    return sec > 59 || min > 59 ? null : hr * 3600 + min * 60 + sec;
  }

  const parts = s.split(/[:.,\s]+/).filter(Boolean).map(Number);
  if (!parts.length || parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function parseDistance(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
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

/** Passo in SECONDI/km per una frazione di VDOT (Daniels invertito). */
function vdotToPace(vdot: number, fraction: number): number {
  const vo2 = vdot * fraction;
  const disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60);
  // vel è in metri/minuto: 1000/vel dà i MINUTI per km, non i secondi.
  // Restituire 1000/vel faceva stampare "0:06 /km" al posto di "5:53 /km".
  const vel = (-0.182258 + Math.sqrt(disc)) / (2 * 0.000104);
  return 60000 / vel;
}

/**
 * Checkpoint di passaggio adattivi: ogni km sulle brevi, ogni 2 km sulle medie,
 * ogni 5 km sulle lunghe. Una maratona con 42 righe non si legge.
 */
function buildCheckpoints(distKm: number): number[] {
  if (distKm <= 0) return [];
  const step = distKm <= 12 ? 1 : distKm <= 25 ? 2 : 5;
  const marks: number[] = [];
  for (let d = step; d < distKm - 0.001; d += step) marks.push(d);
  marks.push(distKm); // il traguardo esatto c'è sempre
  return marks;
}

type Field = "distance" | "time" | "pace";

const FIELD_LABEL: Record<Field, string> = {
  distance: "distanza",
  time: "tempo",
  pace: "passo",
};

/** Marcatore del campo calcolato. Resta scrivibile: scriverci dentro lo
 *  promuove a input e sposta il calcolo su un altro campo. */
const CALC_BADGE = (
  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[7px] align-middle" style={{ background: "rgba(192,255,0,0.14)" }}>
    AUTO
  </span>
);

const STYLE = {
  card: "rounded-[26px] border p-6",
  cardBg: "#0E0E0E",
  border: "#1E1E1E",
  input:
    "w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white font-mono text-lg font-bold focus:outline-none focus:border-[#C0FF00]/40 text-center transition-all",
  label: "text-[10px] font-black tracking-[0.22em] uppercase mb-2 text-center",
};

export function PaceCalculator({ vdot }: { vdot?: number | null }) {
  const { i18n } = useTranslation();
  const showMiles = i18n.language === "en";

  const [distance, setDistance] = useState("10");
  const [time, setTime] = useState("45:00");
  const [pace, setPace] = useState("4:30");

  /**
   * Ordine di modifica, dal più recente al meno recente. I primi due campi sono
   * gli input, il TERZO è quello calcolato — e si aggiorna da solo.
   *
   * Partenza [distance, time, pace] → il passo è derivato.
   * Scrivi nel passo → [pace, distance, time] → ora è il TEMPO a ricalcolarsi,
   * che è esattamente il comportamento atteso quando imposti un ritmo.
   */
  const [order, setOrder] = useState<Field[]>(["distance", "time", "pace"]);
  const derived = order[2];

  // Scrivere in un campo lo promuove a input: se era lui il calcolato, il ruolo
  // passa a quello toccato meno di recente. Nessun campo è mai bloccato.
  const touch = (f: Field) =>
    setOrder((prev) => (prev[0] === f ? prev : [f, ...prev.filter((x) => x !== f)] as Field[]));

  const typedDist = parseDistance(distance);
  const typedTimeSec = parseClock(time);
  const typedPaceSec = parseClock(pace);

  const computed = useMemo(() => {
    let distKm = typedDist;
    let timeSec = typedTimeSec;
    let paceSec = typedPaceSec;

    // Il campo derivato si ricalcola dagli altri due; se mancano, resta nullo.
    if (derived === "pace") {
      paceSec = distKm && timeSec ? timeSec / distKm : null;
    } else if (derived === "time") {
      timeSec = distKm && paceSec ? paceSec * distKm : null;
    } else {
      distKm = timeSec && paceSec ? timeSec / paceSec : null;
    }

    const timeMin = timeSec != null ? timeSec / 60 : null;
    const ready = distKm != null && distKm > 0 && timeMin != null && timeMin > 0;

    const predictions = ready
      ? ALL_DISTANCES.map((d) => ({ ...d, timeMin: riegelPredict(timeMin, distKm, d.km) }))
      : [];

    const computedVdot = ready && distKm >= 3 ? estimateVdot(distKm, timeMin) : null;

    const zones = computedVdot
      ? VDOT_ZONES.map((z) => ({ ...z, pace: vdotToPace(computedVdot, z.pct) }))
      : [];

    const checkpoints = ready && paceSec
      ? buildCheckpoints(distKm).map((km) => ({ km, atSec: km * paceSec! }))
      : [];

    return { distKm, timeSec, paceSec, timeMin, ready, predictions, computedVdot, zones, checkpoints };
  }, [typedDist, typedTimeSec, typedPaceSec, derived]);

  // Valore mostrato: se il campo è derivato vince il calcolo, altrimenti la
  // stringa digitata resta intatta (niente riscritture sotto le dita).
  const distanceValue = derived === "distance" ? fmtDistance(computed.distKm ?? 0) : distance;
  const timeValue = derived === "time" ? fmtTime(computed.timeMin ?? 0) : time;
  const paceValue = derived === "pace" ? fmtPace(computed.paceSec ?? 0) : pace;

  const derivedStyle = (f: Field) =>
    derived === f
      ? {
          background: "rgba(192,255,0,0.06)",
          borderColor: `${NEON}55`,
          color: NEON,
        }
      : undefined;

  const vdotDelta =
    computed.computedVdot != null && vdot != null ? computed.computedVdot - vdot : null;

  return (
    <div className="space-y-6">
      <section className={STYLE.card} style={{ background: STYLE.cardBg, borderColor: STYLE.border, borderLeft: `3px solid ${NEON}` }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(192,255,0,0.10)" }}>
            <Calculator className="w-5 h-5" style={{ color: NEON }} />
          </div>
          <div>
            <h2 className="text-lg font-black italic text-white">Calcolatore Passo / Tempo</h2>
            <p className="text-[10px] tracking-[0.2em] font-bold" style={{ color: "#666" }}>
              SCRIVI IN DUE CAMPI — IL TERZO SI CALCOLA DA SOLO
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* DISTANZA */}
          <div>
            <div className={STYLE.label} style={{ color: derived === "distance" ? NEON : CYAN }}>
              Distanza (km) {derived === "distance" && CALC_BADGE}
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={distanceValue}
              onFocus={(e) => e.target.select()}
              onChange={(e) => { setDistance(e.target.value); touch("distance"); }}
              className={STYLE.input}
              style={derivedStyle("distance")}
              placeholder="10"
            />
            <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
              {DISTANCES.map((d) => {
                const active = computed.distKm != null && Math.abs(computed.distKm - d.km) < 0.01;
                return (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => { setDistance(String(d.km)); touch("distance"); }}
                    className="px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider transition-all"
                    style={{
                      background: active ? NEON : "rgba(255,255,255,0.04)",
                      color: active ? "#0A0A0A" : "#888",
                      border: `1px solid ${active ? NEON : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TEMPO */}
          <div>
            <div className={STYLE.label} style={{ color: derived === "time" ? NEON : LOAD }}>
              Tempo {derived === "time" && CALC_BADGE}
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={timeValue}
              onFocus={(e) => e.target.select()}
              onChange={(e) => { setTime(e.target.value); touch("time"); }}
              className={STYLE.input}
              style={derivedStyle("time")}
              placeholder="45:00"
            />
            <div className="text-[9px] font-bold tracking-wider text-center mt-2" style={{ color: "#555" }}>
              {derived === "time" ? "calcolato" : "h:mm:ss · mm:ss · 4500"}
            </div>
          </div>

          {/* PASSO */}
          <div>
            <div className={STYLE.label} style={{ color: derived === "pace" ? NEON : RISK }}>
              Passo /km {derived === "pace" && CALC_BADGE}
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={paceValue}
              onFocus={(e) => e.target.select()}
              onChange={(e) => { setPace(e.target.value); touch("pace"); }}
              className={STYLE.input}
              style={derivedStyle("pace")}
              placeholder="4:30"
            />
            <div className="text-[9px] font-bold tracking-wider text-center mt-2" style={{ color: "#555" }}>
              {computed.paceSec
                ? showMiles
                  ? `${fmtPace(computed.paceSec * KM_PER_MILE)}/mi`
                  : `${(3600 / computed.paceSec).toFixed(1)} km/h`
                : "4:30 · 4.30 · 430"}
            </div>
          </div>
        </div>

        <div className="text-[9px] font-bold tracking-[0.2em] uppercase text-center" style={{ color: "#444" }}>
          {`stai impostando ${FIELD_LABEL[order[0]]} e ${FIELD_LABEL[order[1]]} → `}
          <span style={{ color: NEON }}>{FIELD_LABEL[derived]} calcolato</span>
        </div>
      </section>

      {/* TABELLA PASSAGGI */}
      {computed.checkpoints.length > 0 && (
        <section className={STYLE.card} style={{ background: STYLE.cardBg, borderColor: STYLE.border, borderLeft: `3px solid ${LOAD}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Gauge className="w-4 h-4" style={{ color: LOAD }} />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Tempi di passaggio</h3>
            <span className="text-[9px] font-bold" style={{ color: "#555" }}>
              · a {fmtPace(computed.paceSec ?? 0)}/km costanti
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
            {computed.checkpoints.map((c, i) => {
              const isFinish = i === computed.checkpoints.length - 1;
              return (
                <div
                  key={c.km}
                  className="rounded-xl p-2.5 text-center border"
                  style={{
                    background: isFinish ? "rgba(192,255,0,0.08)" : "#0A0A0A",
                    borderColor: isFinish ? `${NEON}44` : "#1A1A1A",
                  }}
                >
                  <div className="text-[9px] font-black tracking-wider mb-1" style={{ color: isFinish ? NEON : "#888" }}>
                    {isFinish ? "ARRIVO" : `${fmtDistance(c.km)} km`}
                  </div>
                  <div className="text-[13px] font-black font-mono text-white">{fmtTime(c.atSec / 60)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {computed.predictions.length > 0 && (
        <section className={STYLE.card} style={{ background: STYLE.cardBg, borderColor: STYLE.border, borderLeft: `3px solid ${CYAN}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Timer className="w-4 h-4" style={{ color: CYAN }} />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Previsioni su tutte le distanze</h3>
            <span className="text-[9px] font-bold" style={{ color: "#555" }}>· Riegel T₂ = T₁ × (D₂/D₁)¹·⁰⁶</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
            {computed.predictions.map((p) => {
              const isActive = computed.distKm != null && Math.abs(p.km - computed.distKm) < 0.001;
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
            <div className="text-center mb-2">
              <div className="text-[48px] font-black leading-none" style={{ color: NEON }}>{computed.computedVdot}</div>
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase mt-1" style={{ color: "#666" }}>Jack Daniels Formula</div>
            </div>
            {vdotDelta != null && (
              <div className="text-center mt-3 pt-3 border-t" style={{ borderColor: "#1A1A1A" }}>
                <span className="text-[10px] font-bold" style={{ color: "#666" }}>
                  il tuo VDOT attuale è <span className="text-white font-black">{vdot}</span> ·{" "}
                </span>
                <span
                  className="text-[11px] font-black"
                  style={{ color: vdotDelta > 0.05 ? NEON : vdotDelta < -0.05 ? RISK : "#888" }}
                >
                  {vdotDelta > 0 ? "+" : ""}{vdotDelta.toFixed(1)}
                </span>
              </div>
            )}
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
