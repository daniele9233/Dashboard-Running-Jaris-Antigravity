import { useEffect, useMemo, useRef, useState } from "react";
import { fmtClock } from "../gamification/gamiCore";
import type { GoalCurvePoint } from "./raceLabEngine";
import { BRAND } from "../../theme/tokens";

/**
 * LA TRAIETTORIA
 * ════════════════════════════════════════════════════════════════════════════
 * Una pagina che dice «l'obiettivo diventa possibile il 10 ottobre» chiede di
 * credere a una data. Questo grafico la mostra: da dove parte, con che pendenza
 * sale, quanto è larga l'incertezza attorno, e dove il caldo dell'estate la
 * rimanda indietro di due mesi.
 *
 * Tre piani sovrapposti, letti dall'alto in basso:
 *
 *   1. IL TEMPO — la curva del piano simulato, la sua banda a ±1 σ, e come
 *      confronto la curva tratteggiata del carico che tieni adesso. L'asse è
 *      rovesciato: più in alto = più forte, perché è così che si legge un
 *      progresso e non un cronometro.
 *   2. LA PROBABILITÀ — lo stesso asse dei giorni, ma in percentuale: il nastro
 *      che cresce è la risposta alla domanda "quando ci conto davvero".
 *   3. IL CLIMA — una striscia di temperatura attesa. Serve a capire le gobbe:
 *      non peggiori a luglio, è luglio.
 *
 * Tutto in un SVG scritto a mano perché serviva un asse rovesciato, una banda,
 * marcatori datati e un nastro secondario sullo stesso dominio: con una libreria
 * generica sarebbero stati quattro compromessi.
 */

const LIME = BRAND;
const CYAN = "#22D3EE";
const MONO = "'JetBrains Mono', monospace";

/**
 * Due formati, non uno scalato.
 *
 * Lo stesso viewBox da 920 px compresso in 340 su un telefono rende i testi
 * alti tre pixel: illeggibili. Sotto i 620 px di contenitore si passa a un
 * disegno più piccolo — stessa grammatica, meno tacche, font relativamente più
 * grandi — invece di rimpicciolire tutto.
 */
const SIZE = {
  wide: {
    W: 920, H: 300, HP: 74, HT: 16,
    M: { top: 18, right: 62, bottom: 22, left: 58 },
    fs: { axis: 9.5, month: 9, label: 10.5, date: 9.5, target: 10, tip: 10.5 },
  },
  narrow: {
    W: 430, H: 210, HP: 56, HT: 12,
    M: { top: 14, right: 44, bottom: 18, left: 42 },
    fs: { axis: 8.5, month: 8, label: 8.5, date: 8, target: 8.5, tip: 9 },
  },
} as const;

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const fmtDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const fmtMonth = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
};

/** Blu→rosso: la stessa scala del resto dell'app per il clima. */
function tempColor(t: number): string {
  if (t <= 5) return "#3B82F6";
  if (t <= 12) return "#22D3EE";
  if (t <= 18) return BRAND;
  if (t <= 24) return "#FBBF24";
  if (t <= 29) return "#FB923C";
  return "#F43F5E";
}

export interface GoalTrajectoryProps {
  curve: GoalCurvePoint[];
  targetSec: number;
  /** Giorni da oggi alla gara, se una data c'è. */
  deadlineDays?: number | null;
  /** Il giorno in cui la previsione tocca il tempo (50%), con la sua data esatta. */
  etaPlanDays?: number | null;
  etaPlanIso?: string | null;
  /** Il giorno in cui diventa probabile (80%), con la sua data esatta. */
  etaSafeDays?: number | null;
  etaSafeIso?: string | null;
  /** La data a cui si legge la probabilità in pagina. */
  horizonDays?: number | null;
  distLabel: string;
}

export function GoalTrajectory({
  curve, targetSec, deadlineDays, etaPlanDays, etaPlanIso, etaSafeDays, etaSafeIso,
  horizonDays, distLabel,
}: GoalTrajectoryProps) {
  const ref = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [narrow, setNarrow] = useState(false);

  // il formato segue la larghezza reale del contenitore, non quella della finestra
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 620));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { W, H, HP, HT, M, fs } = narrow ? SIZE.narrow : SIZE.wide;

  const geo = useMemo(() => {
    if (curve.length < 2) return null;
    const maxDay = curve[curve.length - 1].day;
    const secs = curve.flatMap((p) => [p.loSec, p.hiSec, p.nowSec, p.planSec]);
    let lo = Math.min(...secs, targetSec);
    let hi = Math.max(...secs, targetSec);
    const pad = Math.max(8, (hi - lo) * 0.12);
    lo -= pad; hi += pad;

    const X = (day: number) => M.left + (day / maxDay) * (W - M.left - M.right);
    // asse rovesciato: il tempo più basso (più forte) sta in alto
    const Y = (sec: number) => M.top + ((sec - lo) / (hi - lo)) * (H - M.top - M.bottom);
    const YP = (p: number) => H + HP - 10 - p * (HP - 22);

    return { maxDay, lo, hi, X, Y, YP };
  }, [curve, targetSec, W, H, HP, M]);

  if (!geo) return null;
  const { maxDay, lo, hi, X, Y, YP } = geo;

  const line = (key: "planSec" | "nowSec") =>
    curve.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.day).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(" ");

  const band = [
    ...curve.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.day).toFixed(1)},${Y(p.loSec).toFixed(1)}`),
    ...[...curve].reverse().map((p) => `L${X(p.day).toFixed(1)},${Y(p.hiSec).toFixed(1)}`),
    "Z",
  ].join(" ");

  const probArea = [
    `M${X(curve[0].day).toFixed(1)},${YP(0).toFixed(1)}`,
    ...curve.map((p) => `L${X(p.day).toFixed(1)},${YP(p.planProb).toFixed(1)}`),
    `L${X(maxDay).toFixed(1)},${YP(0).toFixed(1)}`, "Z",
  ].join(" ");

  const probNowLine = curve
    .map((p, i) => `${i === 0 ? "M" : "L"}${X(p.day).toFixed(1)},${YP(p.nowProb).toFixed(1)}`)
    .join(" ");

  // tacche dell'asse dei tempi: quattro, su multipli leggibili
  const yTicks = (() => {
    const span = hi - lo;
    const raw = span / (narrow ? 3 : 4);
    const step = span > 900 ? Math.ceil(raw / 120) * 120 : span > 300 ? Math.ceil(raw / 30) * 30 : Math.ceil(raw / 10) * 10;
    const start = Math.ceil(lo / step) * step;
    const out: number[] = [];
    for (let v = start; v < hi; v += step) out.push(v);
    return out;
  })();

  // tacche dei mesi
  const monthTicks = curve.filter((p, i) => {
    if (i === 0) return true;
    const prev = curve[i - 1];
    return new Date(p.iso + "T00:00:00Z").getUTCMonth() !== new Date(prev.iso + "T00:00:00Z").getUTCMonth();
  });
  const xTicks = narrow ? monthTicks.filter((_, i) => i % 2 === 0) : monthTicks;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const vx = ((e.clientX - r.left) / r.width) * W;
    const day = ((vx - M.left) / (W - M.left - M.right)) * maxDay;
    let best = 0, bd = Infinity;
    curve.forEach((p, i) => { const d = Math.abs(p.day - day); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  };

  const hp = hover != null ? curve[hover] : null;
  const marker = (
    days: number | null | undefined, iso: string | null | undefined,
    filled: boolean, label: string, color: string,
  ) => {
    if (days == null) return null;
    const p = curve.reduce((a, b) => (Math.abs(b.day - days) < Math.abs(a.day - days) ? b : a), curve[0]);
    const x = X(Math.min(days, maxDay)), y = Y(p.planSec);
    const flip = x > W - 190;
    return (
      <g key={label}>
        <circle cx={x} cy={y} r={5.5} fill={filled ? color : "#0A0A0A"} stroke={color} strokeWidth={2.5} />
        <text x={flip ? x - 10 : x + 10} y={y - 8} textAnchor={flip ? "end" : "start"}
          fill={color} style={{ fontFamily: MONO, fontSize: fs.label, fontWeight: 800 }}>
          {label}
        </text>
        <text x={flip ? x - 10 : x + 10} y={y + 5} textAnchor={flip ? "end" : "start"}
          fill="#9CA3AF" style={{ fontFamily: MONO, fontSize: fs.date }}>
          {fmtDay(iso ?? p.iso)}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full" ref={wrap}>
      <svg
        ref={ref} viewBox={`0 0 ${W} ${H + HP + HT + 14}`} className="w-full h-auto select-none"
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        role="img" aria-label={`Traiettoria verso l'obiettivo sui ${distLabel}`}
      >
        <defs>
          <linearGradient id="gt-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LIME} stopOpacity={0.22} />
            <stop offset="100%" stopColor={LIME} stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="gt-prob" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={CYAN} stopOpacity={0.05} />
            <stop offset="100%" stopColor={CYAN} stopOpacity={0.38} />
          </linearGradient>
        </defs>

        {/* ── griglia + asse dei tempi ── */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={Y(v)} y2={Y(v)} stroke="#ffffff0d" strokeWidth={1} />
            <text x={M.left - 8} y={Y(v)} textAnchor="end" dominantBaseline="central"
              fill="#878787" style={{ fontFamily: MONO, fontSize: fs.axis }}>
              {fmtClock(v)}
            </text>
          </g>
        ))}

        {/* ── mesi ── */}
        {xTicks.map((p) => (
          <g key={`x${p.day}`}>
            <line x1={X(p.day)} x2={X(p.day)} y1={M.top} y2={H - M.bottom} stroke="#ffffff08" strokeWidth={1} />
            <text x={X(p.day)} y={H + HP + HT + 10} textAnchor="middle"
              fill="#4B5563" style={{ fontFamily: MONO, fontSize: fs.month }}>
              {fmtMonth(p.iso)}
            </text>
          </g>
        ))}

        {/* ── il tempo obiettivo: la linea che conta ── */}
        <line x1={M.left} x2={W - M.right} y1={Y(targetSec)} y2={Y(targetSec)}
          stroke="#fff" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.75} />
        <rect x={W - M.right + 2} y={Y(targetSec) - 9} width={54} height={18} rx={4} fill="#ffffff14" />
        <text x={W - M.right + 29} y={Y(targetSec)} textAnchor="middle" dominantBaseline="central"
          fill="#fff" style={{ fontFamily: MONO, fontSize: fs.target, fontWeight: 800 }}>
          {fmtClock(targetSec)}
        </text>

        {/* ── banda d'incertezza e curve ── */}
        <path d={band} fill="url(#gt-band)" />
        <path d={line("nowSec")} fill="none" stroke="#878787" strokeWidth={1.8} strokeDasharray="5 4" />
        <path d={line("planSec")} fill="none" stroke={LIME} strokeWidth={2.6} strokeLinecap="round" />

        {/* ── la data della gara, se c'è ── */}
        {deadlineDays != null && deadlineDays <= maxDay && (
          <g>
            <line x1={X(deadlineDays)} x2={X(deadlineDays)} y1={M.top} y2={H + HP - 10}
              stroke={CYAN} strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={X(deadlineDays)} y={M.top - 6} textAnchor="middle"
              fill={CYAN} style={{ fontFamily: MONO, fontSize: fs.month, fontWeight: 800 }}>
              GARA
            </text>
          </g>
        )}
        {deadlineDays == null && horizonDays != null && horizonDays <= maxDay && (
          <line x1={X(horizonDays)} x2={X(horizonDays)} y1={M.top} y2={H + HP - 10}
            stroke="#ffffff22" strokeWidth={1} strokeDasharray="3 4" />
        )}

        {marker(etaPlanDays, etaPlanIso, false, narrow ? "50%" : "POSSIBILE · 50%", LIME)}
        {marker(etaSafeDays, etaSafeIso, true, narrow ? "80%" : "PROBABILE · 80%", LIME)}

        {/* ── nastro della probabilità ── */}
        <line x1={M.left} x2={W - M.right} y1={YP(0)} y2={YP(0)} stroke="#ffffff14" strokeWidth={1} />
        <line x1={M.left} x2={W - M.right} y1={YP(0.8)} y2={YP(0.8)} stroke="#ffffff10" strokeWidth={1} strokeDasharray="3 4" />
        <path d={probArea} fill="url(#gt-prob)" />
        <path d={curve.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.day).toFixed(1)},${YP(p.planProb).toFixed(1)}`).join(" ")}
          fill="none" stroke={CYAN} strokeWidth={2} />
        <path d={probNowLine} fill="none" stroke="#878787" strokeWidth={1.4} strokeDasharray="4 4" />
        <text x={M.left - 8} y={YP(0.8)} textAnchor="end" dominantBaseline="central"
          fill="#878787" style={{ fontFamily: MONO, fontSize: fs.month }}>80%</text>
        <text x={M.left - 8} y={YP(0)} textAnchor="end" dominantBaseline="central"
          fill="#4B5563" style={{ fontFamily: MONO, fontSize: fs.month }}>0%</text>

        {/* ── striscia del clima ── */}
        {curve.slice(1).map((p, i) => {
          const x0 = X(curve[i].day), x1 = X(p.day);
          return (
            <rect key={`t${p.day}`} x={x0} y={H + HP} width={Math.max(1, x1 - x0)} height={HT - 4}
              fill={tempColor(p.tempC)} opacity={0.5} />
          );
        })}
        <text x={M.left - 8} y={H + HP + (HT - 4) / 2} textAnchor="end" dominantBaseline="central"
          fill="#4B5563" style={{ fontFamily: MONO, fontSize: fs.month }}>{narrow ? "°C" : "CLIMA"}</text>

        {/* ── crosshair e tooltip ── */}
        {hp && (
          <g pointerEvents="none">
            <line x1={X(hp.day)} x2={X(hp.day)} y1={M.top} y2={H + HP + HT - 4}
              stroke="#ffffff33" strokeWidth={1} />
            <circle cx={X(hp.day)} cy={Y(hp.planSec)} r={4} fill={LIME} stroke="#0A0A0A" strokeWidth={1.5} />
            <circle cx={X(hp.day)} cy={Y(hp.nowSec)} r={3} fill="#878787" stroke="#0A0A0A" strokeWidth={1.5} />
            {(() => {
              const bw = narrow ? 128 : 168, bh = narrow ? 68 : 82;
              const bx = Math.min(Math.max(X(hp.day) - bw / 2, M.left), W - M.right - bw);
              const by = Math.max(M.top + 2, Y(hp.planSec) - bh - 14);
              return (
                <g>
                  <rect x={bx} y={by} width={bw} height={bh} rx={8} fill="#0A0A0AF2" stroke="#ffffff1f" />
                  <text x={bx + 9} y={by + bh * 0.21} fill="#fff" style={{ fontFamily: MONO, fontSize: fs.tip, fontWeight: 800 }}>
                    {fmtDay(hp.iso)} · {hp.tempC}°
                  </text>
                  <text x={bx + 9} y={by + bh * 0.42} fill={LIME} style={{ fontFamily: MONO, fontSize: fs.tip, fontWeight: 800 }}>
                    piano {fmtClock(hp.planSec)}
                  </text>
                  <text x={bx + 9} y={by + bh * 0.62} fill="#9CA3AF" style={{ fontFamily: MONO, fontSize: fs.tip - 0.5 }}>
                    {narrow ? "oggi" : "carico di oggi"} {fmtClock(hp.nowSec)}
                  </text>
                  <text x={bx + 9} y={by + bh * 0.85} fill={CYAN} style={{ fontFamily: MONO, fontSize: fs.tip, fontWeight: 800 }}>
                    {Math.round(hp.planProb * 100)}% di riuscita
                  </text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>

      {/* ── legenda ── */}
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-[2.5px] rounded-full" style={{ background: LIME }} />
          piano simulato
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-[2px] rounded-full" style={{ background: "repeating-linear-gradient(90deg,#6B7280 0 4px,transparent 4px 8px)" }} />
          carico che tieni adesso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-2.5 rounded-sm" style={{ background: `linear-gradient(${LIME}44,${LIME}0a)` }} />
          incertezza ±1σ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-[2.5px] rounded-full" style={{ background: CYAN }} />
          probabilità di riuscita
        </span>
      </div>
    </div>
  );
}
