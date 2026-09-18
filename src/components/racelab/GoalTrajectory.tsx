import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { dayIndex, dayToIso, fmtClock } from "../gamification/gamiCore";
import type { GoalCurvePoint } from "./raceLabEngine";

/**
 * LA TRAIETTORIA
 * ════════════════════════════════════════════════════════════════════════════
 * Una pagina che dice «l'obiettivo diventa possibile il 10 ottobre» chiede di
 * credere a una data. Questo grafico la mostra: da dove parte, con che pendenza
 * sale, quanto è larga l'incertezza attorno, e dove il caldo la rimanda.
 *
 * Dall'alto in basso, tutto sullo stesso asse dei giorni:
 *
 *   0. GLI EVENTI — una corsia sopra il grafico con oggi, la gara, il giorno in
 *      cui l'obiettivo diventa possibile (50%) e quello in cui diventa
 *      probabile (80%). Stanno lì e non sulle curve perché sulle curve le
 *      etichette si coprivano a vicenda, e coprivano i dati.
 *   1. IL TEMPO — la curva del piano simulato con la sua banda a ±1 σ, e come
 *      confronto la tratteggiata del carico che tieni adesso. L'asse è
 *      rovesciato: più in alto = più forte, perché così si legge un progresso.
 *   2. LA PROBABILITÀ — lo stesso asse dei giorni, in percentuale. È un pannello
 *      a parte e non un secondo asse sullo stesso grafico: due scale sovrapposte
 *      inventano incroci che nei dati non ci sono.
 *   3. IL CLIMA — la temperatura attesa, con i gradi scritti sopra: non peggiori
 *      a luglio, è luglio.
 *
 * Sopra il disegno c'è la LETTURA: i numeri del giorno che conta — la gara, se
 * c'è — che seguono il cursore quando passi sul grafico. È il posto dove prima
 * stava un riquadro che copriva proprio la curva che si stava leggendo.
 *
 * Il viewBox è largo quanto il contenitore vero, in pixel: niente scala, quindi
 * i testi hanno la dimensione scritta qui sia sul monitor sia sul telefono.
 */

const LIME = "#C0FF00";
const CYAN = "#22D3EE";
const GRAY = "#6B7280";
const SURFACE = "#0A0A0A";
const GOOD = "#22C55E";
const BAD = "#F43F5E";
const MONO = "'JetBrains Mono', monospace";

/** Le misure in pixel veri: due formati, stessa grammatica. */
const SIZE = {
  wide: {
    row0: 13, rowH: 15, main: 232, gap1: 26, prob: 70, gap2: 12, clim: 17, axis: 22, L: 60, R: 82,
    ticks: 6,
    fs: { axis: 10, lane: 10, caption: 9, end: 10.5, endSub: 9, clim: 9, prob: 11 },
  },
  narrow: {
    row0: 12, rowH: 14, main: 176, gap1: 24, prob: 56, gap2: 10, clim: 15, axis: 20, L: 44, R: 62,
    ticks: 4,
    fs: { axis: 9.5, lane: 9.5, caption: 8.5, end: 10, endSub: 8.5, clim: 8.5, prob: 10 },
  },
} as const;

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const dateOf = (iso: string) => new Date(iso + "T00:00:00Z");
const fmtDay = (iso: string) => `${dateOf(iso).getUTCDate()} ${MONTHS[dateOf(iso).getUTCMonth()]}`;
const fmtMonth = (iso: string) => `${MONTHS[dateOf(iso).getUTCMonth()]} ${String(dateOf(iso).getUTCFullYear()).slice(2)}`;
const isoPlus = (iso: string, days: number) => dayToIso(dayIndex(iso) + days);
const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Blu→rosso: la stessa scala del resto dell'app per il clima. */
function tempColor(t: number): string {
  if (t <= 5) return "#3B82F6";
  if (t <= 12) return "#22D3EE";
  if (t <= 18) return "#C0FF00";
  if (t <= 24) return "#FBBF24";
  if (t <= 29) return "#FB923C";
  return "#F43F5E";
}

/** Tacche del tempo su passi che si leggono: 10″, 30″, un minuto, tre… mai 50″. */
const TICK_STEPS = [5, 10, 15, 20, 30, 60, 120, 180, 300, 600, 900, 1800, 3600];
function timeTicks(lo: number, hi: number, max: number): number[] {
  const step = TICK_STEPS.find((s) => (hi - lo) / s <= max) ?? 3600;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

/**
 * Le etichette di fine riga si spingono a vicenda invece di sovrapporsi: si
 * ordinano, si tiene una distanza minima, e se si esce dal basso si risale.
 */
function spread(ys: number[], gap: number, top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = order.map((o) => o.y);
  for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k], out[k - 1] + gap);
  const over = out[out.length - 1] - bottom;
  if (over > 0) for (let k = 0; k < out.length; k++) out[k] -= over;
  const under = top - out[0];
  if (under > 0) for (let k = 0; k < out.length; k++) out[k] += under;
  const res = new Array<number>(ys.length);
  order.forEach((o, k) => { res[o.i] = out[k]; });
  return res;
}

const pathOf = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

// ── chiavi della legenda e della lettura: un tratto, non un quadratino ────────
function LineKey({ color, dashed, width = 2.5 }: { color: string; dashed?: boolean; width?: number }) {
  return (
    <svg width="16" height="6" aria-hidden className="shrink-0">
      <line x1="1.5" y1="3" x2="14.5" y2="3" stroke={color} strokeWidth={width} strokeLinecap="round"
        strokeDasharray={dashed ? "3.5 3" : undefined} />
    </svg>
  );
}

function DotKey({ color, hollow }: { color: string; hollow?: boolean }) {
  return (
    <svg width="10" height="10" aria-hidden className="shrink-0">
      <circle cx="5" cy="5" r="3.5" fill={hollow ? SURFACE : color} stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

function Cell({ keyMark, label, value, sub, className = "" }: {
  keyMark?: ReactNode; label: string; value: ReactNode; sub?: ReactNode; className?: string;
}) {
  return (
    <div className={`min-w-0 px-3 py-2.5 ${className}`}>
      <div className="text-[19px] font-black leading-none text-white whitespace-nowrap tabular-nums" style={{ fontFamily: MONO }}>
        {value}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-black tracking-[0.18em] uppercase text-gray-500">
        {keyMark}{label}
      </div>
      {sub != null && (
        <div className="mt-0.5 text-[10px] text-gray-500 truncate tabular-nums" style={{ fontFamily: MONO }}>{sub}</div>
      )}
    </div>
  );
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

type EventId = "race" | "p80" | "p50" | "ref" | "today";
/** Un evento sull'asse dei giorni; le etichette vanno dalla più piena alla più corta. */
interface ChartEvent { id: EventId; day: number; texts: string[] }

export function GoalTrajectory({
  curve, targetSec, deadlineDays, etaPlanDays, etaPlanIso, etaSafeDays, etaSafeIso,
  horizonDays, distLabel,
}: GoalTrajectoryProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(920);
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  // il formato segue la larghezza reale del contenitore, non quella della finestra
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (el.clientWidth) setCw(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width) setCw(Math.round(e.contentRect.width)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = cw < 620;
  const S = narrow ? SIZE.narrow : SIZE.wide;
  const W = Math.max(300, cw);

  if (curve.length < 2) return null;
  const maxDay = curve[curve.length - 1].day;
  const todayIso = curve[0].iso;
  const last = curve[curve.length - 1];
  const plotR = W - S.R;
  const X = (d: number) => S.L + (Math.min(Math.max(d, 0), maxDay) / maxDay) * (plotR - S.L);

  const nearestIdx = (day: number) => {
    let best = 0, bd = Infinity;
    curve.forEach((p, i) => { const d = Math.abs(p.day - day); if (d < bd) { bd = d; best = i; } });
    return best;
  };

  // il giorno che conta: la gara, o la data a cui la pagina legge la probabilità
  const anchorDay = deadlineDays ?? horizonDays ?? null;
  const anchorIdx = anchorDay != null && anchorDay <= maxDay ? nearestIdx(anchorDay) : curve.length - 1;
  const focusIdx = hover != null && hover < curve.length ? hover : anchorIdx;
  const fp = curve[focusIdx];

  const tagOf = (d: number): string | null =>
    d === 0 ? "oggi"
      : deadlineDays === d ? "gara"
        : etaSafeDays === d ? "probabile"
          : etaPlanDays === d ? "possibile"
            : deadlineDays == null && horizonDays === d ? "riferimento"
              : null;

  // ── la corsia degli eventi: prima quelli che contano di più ──
  // ogni evento ha un'etichetta piena e una corta, per quando lo spazio non basta
  const events: ChartEvent[] = [];
  const evDate = (d: number, iso?: string | null) => fmtDay(iso ?? isoPlus(todayIso, d));
  if (deadlineDays != null) {
    const date = evDate(deadlineDays);
    events.push({ id: "race", day: deadlineDays, texts: [`GARA · ${date}`, "GARA"] });
  }
  if (etaSafeDays != null) {
    const date = evDate(etaSafeDays, etaSafeIso);
    events.push({ id: "p80", day: etaSafeDays, texts: [...(narrow ? [] : [`PROBABILE 80% · ${date}`]), `80% · ${date}`, "80%"] });
  }
  if (etaPlanDays != null) {
    const date = evDate(etaPlanDays, etaPlanIso);
    events.push({ id: "p50", day: etaPlanDays, texts: [...(narrow ? [] : [`POSSIBILE 50% · ${date}`]), `50% · ${date}`, "50%"] });
  }
  if (deadlineDays == null && horizonDays != null) {
    const date = evDate(horizonDays);
    events.push({ id: "ref", day: horizonDays, texts: [...(narrow ? [] : [`RIFERIMENTO · ${date}`]), `RIF. · ${date}`, "RIF."] });
  }
  events.push({ id: "today", day: 0, texts: ["OGGI"] });

  /**
   * Ogni evento è una bandierina: il simbolo sta esattamente sulla sua data e
   * il testo lo segue a destra, o a sinistra se a destra non c'è posto. Fino a
   * tre righe: se un'etichetta tocca quella di un evento più importante scende,
   * e solo se non c'è posto nemmeno lì si accorcia. La corsia è alta quanto le
   * righe che servono. Un evento oltre la fine del grafico resta in corsia, in
   * fondo, con la freccia.
   */
  const charW = S.fs.lane * 0.62;
  const placed: {
    ev: ChartEvent; text: string; cx: number; tx: number; anchor: "start" | "end";
    x0: number; x1: number; row: number; off: boolean;
  }[] = [];
  for (const ev of events) {
    const off = ev.day > maxDay;
    for (const t of ev.texts) {
      const text = off ? `${t} →` : t;
      const tw = text.length * charW;
      let cx: number, tx: number, anchor: "start" | "end", x0: number, x1: number;
      if (off) {
        tx = W - 4; anchor = "end"; x1 = W - 4; x0 = tx - tw - 14; cx = x0 + 5;
      } else {
        cx = X(ev.day);
        if (cx + 9 + tw <= W - 4) { tx = cx + 9; anchor = "start"; x0 = cx - 5; x1 = tx + tw; }
        else { tx = cx - 9; anchor = "end"; x0 = tx - tw; x1 = cx + 5; }
      }
      const row = [0, 1, 2].find((r) => !placed.some((p) => p.row === r && x0 < p.x1 + 10 && p.x0 < x1 + 10));
      if (row != null) { placed.push({ ev, text, cx, tx, anchor, x0, x1, row, off }); break; }
    }
  }
  const rowsUsed = Math.max(1, ...placed.map((p) => p.row + 1));
  const rowY = (r: number) => S.row0 + r * S.rowH;

  // ── la geometria verticale, sotto la corsia ──
  const secs = curve.flatMap((p) => [p.loSec, p.hiSec, p.nowSec, p.planSec]);
  const pad = Math.max(5, (Math.max(...secs, targetSec) - Math.min(...secs, targetSec)) * 0.08);
  const lo = Math.min(...secs, targetSec) - pad;
  const hi = Math.max(...secs, targetSec) + pad;
  const mainTop = rowY(rowsUsed - 1) + 12, mainBot = mainTop + S.main;
  const probTop = mainBot + S.gap1, probBot = probTop + S.prob;
  const climTop = probBot + S.gap2, climBot = climTop + S.clim;
  const H = climBot + S.axis;
  // asse rovesciato: il tempo più basso (più forte) sta in alto
  const Y = (sec: number) => mainTop + ((sec - lo) / (hi - lo)) * S.main;
  const YP = (p: number) => probBot - 1 - p * (S.prob - 2);

  // ── le curve ──
  const planD = pathOf(curve.map((p) => [X(p.day), Y(p.planSec)]));
  const nowD = pathOf(curve.map((p) => [X(p.day), Y(p.nowSec)]));
  const bandD = pathOf([
    ...curve.map((p): [number, number] => [X(p.day), Y(p.loSec)]),
    ...[...curve].reverse().map((p): [number, number] => [X(p.day), Y(p.hiSec)]),
  ]) + "Z";
  const probD = pathOf(curve.map((p) => [X(p.day), YP(p.planProb)]));
  const probNowD = pathOf(curve.map((p) => [X(p.day), YP(p.nowProb)]));
  const probAreaD = `M${X(0).toFixed(1)},${YP(0).toFixed(1)}`
    + curve.map((p) => `L${X(p.day).toFixed(1)},${YP(p.planProb).toFixed(1)}`).join("")
    + `L${X(maxDay).toFixed(1)},${YP(0).toFixed(1)}Z`;

  const yTicks = timeTicks(lo, hi, S.ticks);

  // ── asse dei giorni: settimane se la finestra è corta, mesi se è lunga ──
  const rawTicks = maxDay <= 120
    ? curve.filter((p) => p.day > 0 && dateOf(p.iso).getUTCDay() === 1)
    : curve.filter((p, i) => i > 0 && dateOf(p.iso).getUTCMonth() !== dateOf(curve[i - 1].iso).getUTCMonth());
  const tickLabel = maxDay <= 120 ? fmtDay : fmtMonth;
  const minTickGap = S.fs.axis * 0.62 * 6 + 14;
  const xTicks: GoalCurvePoint[] = [];
  for (const t of rawTicks) {
    const prev = xTicks[xTicks.length - 1];
    if (X(t.day) - S.L < minTickGap / 2) continue;
    if (!prev || X(t.day) - X(prev.day) >= minTickGap) xTicks.push(t);
  }

  // ── il clima, mese per mese, con i gradi scritti ──
  const months: { x0: number; x1: number; sum: number; n: number }[] = [];
  curve.forEach((p, i) => {
    const cur = months[months.length - 1];
    const x = X(p.day);
    if (!cur || dateOf(p.iso).getUTCMonth() !== dateOf(curve[i - 1].iso).getUTCMonth()) {
      if (cur) cur.x1 = x;
      months.push({ x0: x, x1: x, sum: p.tempC, n: 1 });
    } else {
      cur.x1 = x;
      cur.sum += p.tempC;
      cur.n += 1;
    }
  });

  const evStyle: Record<EventId, { color: string; line: string; lineOpacity: number; width: number; dash?: string }> = {
    race: { color: "#fff", line: "#fff", lineOpacity: 0.55, width: 1.5 },
    p80: { color: LIME, line: LIME, lineOpacity: 0.4, width: 1 },
    p50: { color: LIME, line: LIME, lineOpacity: 0.28, width: 1 },
    ref: { color: "#D1D5DB", line: "#fff", lineOpacity: 0.25, width: 1, dash: "3 4" },
    today: { color: LIME, line: LIME, lineOpacity: 0, width: 0 },
  };
  const glyph = (id: EventId, cx: number, cy: number, r = 3.6) => {
    const c = evStyle[id].color;
    if (id === "race") {
      return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} transform={`rotate(45 ${cx} ${cy})`} fill="#fff" />;
    }
    if (id === "p50" || id === "ref") return <circle cx={cx} cy={cy} r={r} fill={SURFACE} stroke={c} strokeWidth={1.8} />;
    return <circle cx={cx} cy={cy} r={r} fill={c} />;
  };

  // ── le etichette a fine riga: chi è chi, senza cercarlo in legenda ──
  const endItems = [
    { id: "target", y: Y(targetSec), value: fmtClock(targetSec), name: "obiettivo", color: "#fff", dashed: true },
    { id: "plan", y: Y(last.planSec), value: null, name: "piano", color: LIME, dashed: false },
    { id: "now", y: Y(last.nowSec), value: null, name: "attuale", color: GRAY, dashed: true },
  ];
  const endYs = spread(endItems.map((e) => e.y), narrow ? 17 : 19, mainTop + 8, mainBot - 8);

  // ── lettura del giorno a fuoco ──
  const gap = fp.planSec - targetSec;
  const tag = tagOf(fp.day);
  const anchorPoint = curve[anchorIdx];

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const vx = ((e.clientX - r.left) / r.width) * W;
    setHover(nearestIdx(((vx - S.L) / (plotR - S.L)) * maxDay));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = curve.length, cur = hover ?? anchorIdx, step = e.shiftKey ? 7 : 1;
    const to = e.key === "ArrowRight" ? Math.min(n - 1, cur + step)
      : e.key === "ArrowLeft" ? Math.max(0, cur - step)
        : e.key === "Home" ? 0
          : e.key === "End" ? n - 1
            : null;
    if (to != null) { setHover(to); e.preventDefault(); }
    else if (e.key === "Escape") setHover(null);
  };

  const summary = anchorDay != null
    ? `Traiettoria verso l'obiettivo sui ${distLabel}: il ${fmtDay(anchorPoint.iso)} il piano dà ${fmtClock(anchorPoint.planSec)}, ${pct(anchorPoint.planProb)} di riuscita.`
    : `Traiettoria verso l'obiettivo sui ${distLabel}.`;

  // la tabella: una riga a settimana, più i giorni che contano
  const tableRows = curve.filter((p, i) => p.day % 7 === 0 || i === curve.length - 1 || tagOf(p.day) != null);

  return (
    <div className="w-full" ref={wrapRef}>
      {/* ── la lettura: i numeri del giorno che conta, o di quello sotto il cursore ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-[10px] text-gray-600">
          {asTable ? "Una riga a settimana, più i giorni che contano." : narrow
            ? "Trascina sul grafico per leggere un giorno."
            : "Passa sul grafico, o usa ← → dopo averlo selezionato, per leggere un giorno."}
        </span>
        <div className="flex rounded-lg border border-white/10 overflow-hidden text-[10px] font-black uppercase tracking-[0.14em]" role="group" aria-label="Vista">
          {[{ id: false, label: "Grafico" }, { id: true, label: "Tabella" }].map((o) => (
            <button key={o.label} type="button" onClick={() => setAsTable(o.id)} aria-pressed={asTable === o.id}
              className="px-2.5 py-1 transition-colors"
              style={{ background: asTable === o.id ? `${LIME}1f` : "transparent", color: asTable === o.id ? LIME : "#6B7280" }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid rounded-xl border border-white/8 bg-white/[0.02] divide-white/5 ${
        narrow ? "grid-cols-2 divide-y" : "grid-cols-[1.15fr_repeat(4,1fr)] divide-x"}`}>
        <Cell className={narrow ? "col-span-2" : ""}
          value={fmtDay(fp.iso)}
          keyMark={tag ? <span className="w-1.5 h-1.5 rotate-45 shrink-0" style={{ background: tag === "gara" ? "#fff" : LIME }} /> : undefined}
          label={tag ?? (fp.day === 1 ? "domani" : `fra ${fp.day} giorni`)}
          sub={tag && fp.day > 0 ? `fra ${fp.day} gg · ${fp.tempC}°` : `${fp.tempC}° attesi`} />
        <Cell keyMark={<LineKey color={LIME} />} label="piano" value={fmtClock(fp.planSec)}
          sub={`±1σ ${fmtClock(fp.loSec)}–${fmtClock(fp.hiSec)}`} />
        <Cell keyMark={<LineKey color={GRAY} dashed />} label="attuale" value={fmtClock(fp.nowSec)}
          sub={Math.abs(fp.nowSec - fp.planSec) < 1
            ? "uguale al piano"
            : `${fp.nowSec > fp.planSec ? "+" : "−"}${fmtClock(Math.abs(fp.nowSec - fp.planSec))} sul piano`} />
        <Cell keyMark={<span className="w-2 h-2 rounded-full shrink-0" style={{ background: Math.abs(gap) < 1 ? GRAY : gap <= 0 ? GOOD : BAD }} />}
          label={Math.abs(gap) < 1 ? "in pari" : gap <= 0 ? "di margine" : "da trovare"}
          value={fmtClock(Math.abs(gap))} sub={`obiettivo ${fmtClock(targetSec)}`} />
        <Cell keyMark={<LineKey color={CYAN} />} label="riuscita" value={pct(fp.planProb)}
          sub={`attuale ${pct(fp.nowProb)}`} />
      </div>

      {asTable ? (
        <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-white/8">
          <table className="w-full text-[11px] tabular-nums" style={{ fontFamily: MONO }}>
            <thead className="sticky top-0 bg-[#0A0A0A] text-[9px] uppercase tracking-[0.14em] text-gray-500">
              <tr className="text-right [&>th]:px-3 [&>th]:py-2 [&>th]:font-black">
                <th className="text-left">Data</th><th>°C</th><th>Piano</th><th>±1σ</th><th>Attuale</th>
                <th>% piano</th><th>% attuale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tableRows.map((p) => {
                const t = tagOf(p.day);
                return (
                  <tr key={p.day} className="text-right text-gray-300 [&>td]:px-3 [&>td]:py-1.5">
                    <td className="text-left text-white whitespace-nowrap">
                      {fmtDay(p.iso)}{t && <span className="ml-2 text-[9px] uppercase" style={{ color: t === "gara" ? "#fff" : LIME }}>{t}</span>}
                    </td>
                    <td>{p.tempC}°</td>
                    <td className="text-white font-bold">{fmtClock(p.planSec)}</td>
                    <td className="text-gray-500 whitespace-nowrap">{fmtClock(p.loSec)}–{fmtClock(p.hiSec)}</td>
                    <td>{fmtClock(p.nowSec)}</td>
                    <td className="text-white font-bold">{pct(p.planProb)}</td>
                    <td>{pct(p.nowProb)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 rounded-lg outline-none focus-visible:ring-1 focus-visible:ring-[#C0FF00]/50"
          tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)} role="group"
          aria-label={`${summary} Frecce sinistra e destra per leggere un giorno.`}>
          <svg
            ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto select-none"
            style={{ touchAction: "pan-y" }}
            onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={() => setHover(null)}
            role="img" aria-label={summary}
          >
            <defs>
              <linearGradient id="gt-prob" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={CYAN} stopOpacity={0.02} />
                <stop offset="100%" stopColor={CYAN} stopOpacity={0.2} />
              </linearGradient>
              <clipPath id="gt-clim">
                <rect x={S.L} y={climTop} width={plotR - S.L} height={S.clim} rx={4} />
              </clipPath>
            </defs>

            {/* ── griglia e asse dei tempi ── */}
            {yTicks.map((v) => (
              <g key={`y${v}`}>
                <line x1={S.L} x2={plotR} y1={Y(v)} y2={Y(v)} stroke="#ffffff0f" strokeWidth={1} />
                <text x={S.L - 8} y={Y(v)} textAnchor="end" dominantBaseline="central"
                  fill="#6B7280" style={{ fontFamily: MONO, fontSize: S.fs.axis }}>
                  {fmtClock(v)}
                </text>
              </g>
            ))}
            <text x={S.L + 6} y={mainTop + S.fs.caption + 4} fill="#4B5563"
              style={{ fontFamily: MONO, fontSize: S.fs.caption }}>↑ più veloce</text>
            {xTicks.map((p) => (
              <line key={`gx${p.day}`} x1={X(p.day)} x2={X(p.day)} y1={mainTop} y2={mainBot} stroke="#ffffff08" strokeWidth={1} />
            ))}

            {/* ── gli eventi: una riga verticale che attraversa tempo e probabilità ── */}
            {events.filter((ev) => ev.day <= maxDay && ev.id !== "today").map((ev) => {
              const st = evStyle[ev.id];
              return (
                <line key={`ev${ev.id}`} x1={X(ev.day)} x2={X(ev.day)} y1={mainTop} y2={probBot}
                  stroke={st.line} strokeOpacity={st.lineOpacity} strokeWidth={st.width} strokeDasharray={st.dash} />
              );
            })}
            {placed.map(({ ev, text, cx, tx, anchor, row, off }) => {
              const gy = rowY(row) - S.fs.lane * 0.34;
              // dalla bandierina la riga scende fino al grafico, se nessuna etichetta le passa davanti
              const blocked = placed.some((p) => p.row > row && cx > p.x0 - 3 && cx < p.x1 + 3);
              return (
                <g key={`lane${ev.id}`}>
                  {!off && ev.id !== "today" && !blocked && (
                    <line x1={cx} x2={cx} y1={gy + 5} y2={mainTop} stroke={evStyle[ev.id].line}
                      strokeOpacity={evStyle[ev.id].lineOpacity} strokeWidth={evStyle[ev.id].width}
                      strokeDasharray={evStyle[ev.id].dash} />
                  )}
                  {glyph(ev.id, cx, gy)}
                  <text x={tx} y={rowY(row)} textAnchor={anchor} fill={ev.id === "race" ? "#fff" : "#D1D5DB"}
                    style={{ fontFamily: MONO, fontSize: S.fs.lane, fontWeight: 800, letterSpacing: "0.04em" }}>
                    {text}
                  </text>
                </g>
              );
            })}

            {/* ── il tempo obiettivo: la linea che conta ── */}
            <line x1={S.L} x2={plotR} y1={Y(targetSec)} y2={Y(targetSec)}
              stroke="#fff" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.7} />

            {/* ── banda d'incertezza e curve ── */}
            <path d={bandD} fill={LIME} fillOpacity={0.09} className="gt-path gt-fade" />
            <path d={pathOf(curve.map((p) => [X(p.day), Y(p.loSec)]))} fill="none" stroke={LIME} strokeOpacity={0.18}
              strokeWidth={1} className="gt-path gt-fade" />
            <path d={pathOf(curve.map((p) => [X(p.day), Y(p.hiSec)]))} fill="none" stroke={LIME} strokeOpacity={0.18}
              strokeWidth={1} className="gt-path gt-fade" />
            <path d={nowD} fill="none" stroke={GRAY} strokeWidth={1.8} strokeDasharray="5 4" className="gt-path gt-fade" />
            <path d={planD} fill="none" stroke={LIME} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
              pathLength={1} className="gt-path gt-draw" />

            {/* ── i giorni che contano, sulla curva ── */}
            {([
              ["p50", etaPlanDays], ["p80", etaSafeDays], ["race", deadlineDays],
            ] as const).map(([id, d]) => {
              if (d == null || d > maxDay) return null;
              const p = curve[nearestIdx(d)];
              const cx = X(d), cy = Y(p.planSec);
              return (
                <g key={`m${id}`}>
                  <circle cx={cx} cy={cy} r={7} fill={SURFACE} />
                  {glyph(id, cx, cy, id === "race" ? 4.4 : 5)}
                </g>
              );
            })}
            <circle cx={X(0)} cy={Y(curve[0].planSec)} r={6} fill={SURFACE} />
            <circle cx={X(0)} cy={Y(curve[0].planSec)} r={4} fill={LIME} />

            {/* ── chi è chi, a fine riga ── */}
            {endItems.map((e, k) => {
              const ly = endYs[k];
              const x = plotR + 8;
              return (
                <g key={`end${e.id}`}>
                  <line x1={plotR + 1} y1={e.y} x2={x - 2} y2={ly} stroke={e.color}
                    strokeOpacity={e.id === "now" ? 0.8 : 0.6} strokeWidth={1} />
                  {e.value ? (
                    <>
                      <text x={x} y={ly - 1} fill="#fff"
                        style={{ fontFamily: MONO, fontSize: S.fs.end, fontWeight: 800 }}>{e.value}</text>
                      <text x={x} y={ly + S.fs.endSub + 1} fill="#9CA3AF"
                        style={{ fontFamily: MONO, fontSize: S.fs.endSub }}>{e.name}</text>
                    </>
                  ) : (
                    <text x={x} y={ly} dominantBaseline="central" fill={e.id === "plan" ? "#E5E7EB" : "#9CA3AF"}
                      style={{ fontFamily: MONO, fontSize: S.fs.endSub + 0.5, fontWeight: e.id === "plan" ? 800 : 400 }}>
                      {e.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── la probabilità, pannello a parte ── */}
            <text x={S.L} y={probTop - 8} fill="#6B7280"
              style={{ fontFamily: MONO, fontSize: S.fs.caption, fontWeight: 800, letterSpacing: "0.14em" }}>
              PROBABILITÀ DI RIUSCITA
            </text>
            {[0, 0.5, 1].map((v) => (
              <line key={`pg${v}`} x1={S.L} x2={plotR} y1={YP(v)} y2={YP(v)} stroke="#ffffff0f" strokeWidth={1} />
            ))}
            <line x1={S.L} x2={plotR} y1={YP(0.8)} y2={YP(0.8)} stroke="#ffffff30" strokeWidth={1} strokeDasharray="3 4" />
            {[0, 0.5, 0.8].map((v) => (
              <text key={`pl${v}`} x={S.L - 8} y={YP(v)} textAnchor="end" dominantBaseline="central"
                fill={v === 0.8 ? "#9CA3AF" : "#4B5563"} style={{ fontFamily: MONO, fontSize: S.fs.axis - 0.5 }}>
                {pct(v)}
              </text>
            ))}
            <path d={probAreaD} fill="url(#gt-prob)" className="gt-path gt-fade" />
            <path d={probNowD} fill="none" stroke={GRAY} strokeWidth={1.5} strokeDasharray="4 4" className="gt-path gt-fade" />
            <path d={probD} fill="none" stroke={CYAN} strokeWidth={2} strokeLinejoin="round" pathLength={1}
              className="gt-path gt-draw" />
            {anchorDay != null && anchorDay <= maxDay && (() => {
              const cx = X(anchorPoint.day), cy = YP(anchorPoint.planProb);
              const right = cx < plotR - 48;
              const above = cy - probTop > 16;
              return (
                <g>
                  <circle cx={cx} cy={cy} r={6} fill={SURFACE} />
                  <circle cx={cx} cy={cy} r={4} fill={CYAN} />
                  <text x={right ? cx + 9 : cx - 9} y={above ? cy - 7 : cy + 14} textAnchor={right ? "start" : "end"}
                    fill="#fff" stroke={SURFACE} strokeWidth={3} paintOrder="stroke"
                    style={{ fontFamily: MONO, fontSize: S.fs.prob, fontWeight: 800 }}>
                    {pct(anchorPoint.planProb)}
                  </text>
                </g>
              );
            })()}

            {/* ── il clima ── */}
            <g clipPath="url(#gt-clim)">
              {curve.slice(1).map((p, i) => {
                const x0 = X(curve[i].day), x1 = X(p.day);
                return (
                  <rect key={`t${p.day}`} x={x0} y={climTop} width={Math.max(1, x1 - x0 + 0.6)} height={S.clim}
                    fill={tempColor(p.tempC)} opacity={0.42} />
                );
              })}
            </g>
            {months.filter((m) => m.x1 - m.x0 >= 30).map((m) => (
              <text key={`mt${m.x0}`} x={(m.x0 + m.x1) / 2} y={climTop + S.clim / 2} textAnchor="middle"
                dominantBaseline="central" fill="#fff" fillOpacity={0.88}
                style={{ fontFamily: MONO, fontSize: S.fs.clim, fontWeight: 800 }}>
                {Math.round(m.sum / m.n)}°
              </text>
            ))}
            <text x={S.L - 8} y={climTop + S.clim / 2} textAnchor="end" dominantBaseline="central"
              fill="#4B5563" style={{ fontFamily: MONO, fontSize: S.fs.caption }}>{narrow ? "°C" : "CLIMA"}</text>

            {/* ── l'asse dei giorni ── */}
            {xTicks.map((p) => (
              <g key={`x${p.day}`}>
                <line x1={X(p.day)} x2={X(p.day)} y1={climBot + 2} y2={climBot + 5} stroke="#ffffff26" />
                <text x={X(p.day)} y={climBot + 15} textAnchor="middle"
                  fill="#6B7280" style={{ fontFamily: MONO, fontSize: S.fs.axis }}>
                  {tickLabel(p.iso)}
                </text>
              </g>
            ))}

            {/* ── il cursore ── */}
            {hover != null && (
              <g pointerEvents="none">
                <line x1={X(fp.day)} x2={X(fp.day)} y1={mainTop} y2={climBot} stroke="#ffffff45" strokeWidth={1} />
                <circle cx={X(fp.day)} cy={Y(fp.nowSec)} r={5} fill={SURFACE} />
                <circle cx={X(fp.day)} cy={Y(fp.nowSec)} r={3} fill={GRAY} />
                <circle cx={X(fp.day)} cy={Y(fp.planSec)} r={6.5} fill={SURFACE} />
                <circle cx={X(fp.day)} cy={Y(fp.planSec)} r={4.5} fill={LIME} />
                <circle cx={X(fp.day)} cy={YP(fp.nowProb)} r={4.5} fill={SURFACE} />
                <circle cx={X(fp.day)} cy={YP(fp.nowProb)} r={2.5} fill={GRAY} />
                <circle cx={X(fp.day)} cy={YP(fp.planProb)} r={6} fill={SURFACE} />
                <circle cx={X(fp.day)} cy={YP(fp.planProb)} r={4} fill={CYAN} />
              </g>
            )}
          </svg>
        </div>
      )}

      {/* ── legenda ── */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px] text-gray-500">
        <span className="flex items-center gap-1.5"><LineKey color={LIME} />piano simulato</span>
        <span className="flex items-center gap-1.5"><LineKey color={GRAY} dashed width={2} />carico che tieni adesso</span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-2.5 rounded-sm shrink-0" style={{ background: `${LIME}24`, boxShadow: `inset 0 0 0 1px ${LIME}30` }} />
          incertezza ±1σ
        </span>
        <span className="flex items-center gap-1.5"><LineKey color="#fff" dashed width={1.5} />obiettivo</span>
        <span className="flex items-center gap-1.5"><LineKey color={CYAN} width={2} />probabilità di riuscita</span>
        <span className="flex items-center gap-1.5"><DotKey color={LIME} hollow />possibile (50%)</span>
        <span className="flex items-center gap-1.5"><DotKey color={LIME} />probabile (80%)</span>
      </div>
    </div>
  );
}
