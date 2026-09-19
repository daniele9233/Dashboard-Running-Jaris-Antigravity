import { useId, useMemo, useState, type PointerEvent } from "react";
import { fmtClock, fmtPace } from "../gamification/gamiCore";
import { correctedAtHalf, fmtDelta, fmtKm, paceLadder, type LadderRow } from "./paceEngine";
import type { PaceCtx } from "./PaceLabView";
import {
  Card, LIT, LOAD, MONO, REF, RISK, SURFACE, LineKey, SectionHead, Segmented,
} from "./ui";
import { niceTicks, pathOf, useWidth } from "./chartKit";

/**
 * 01 · IL LISTINO
 * ════════════════════════════════════════════════════════════════════════════
 * «Quanto pesa fare 10 km a 4:05 invece che a 4:10?» Tre risposte, affiancate:
 *   - il cronometro: 50″, una moltiplicazione;
 *   - il motore: quanto VDOT serve per reggerlo fino in fondo;
 *   - le gambe: al tuo livello, dove finisce il serbatoio — e che tempo fai
 *     davvero se te ne accorgi a metà gara e rimedi come puoi.
 *
 * Il grafico mette in fila il primo e l'ultimo: la retta «sulla carta» e la V
 * del tempo vero. Il fondo della V è il tuo limite; il braccio sinistro sale
 * molto più ripido del destro, ed è tutta lì la lezione del pacing.
 */

const TIME_STEPS = [5, 10, 15, 20, 30, 60, 120, 180, 300, 600];

function PriceCurve({ distKm, center, vdot, limitPace, span, selected, onSelect }: {
  distKm: number; center: number; vdot: number; limitPace: number; span: number;
  selected: number; onSelect: (p: number) => void;
}) {
  const [wrapRef, cw] = useWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");
  const narrow = cw < 560;
  const W = Math.max(300, cw);
  const H = narrow ? 230 : 290;
  const M = { l: narrow ? 50 : 62, r: narrow ? 10 : 18, t: 30, b: 30 };

  const lo = center - span, hi = center + span;
  const grid = useMemo(() => {
    const out: { p: number; paper: number; real: number | null }[] = [];
    for (let p = lo; p <= hi + 1e-9; p += 0.25) out.push({ p, paper: p * distKm, real: correctedAtHalf(distKm, p, vdot) });
    return out;
  }, [lo, hi, distKm, vdot]);

  const best = limitPace * distKm;
  const reals = grid.filter((g) => g.real != null).map((g) => g.real!);
  const yLo = Math.min(best, ...reals, lo * distKm) - 4;
  const yHi = Math.max(hi * distKm, grid[grid.length - 1].real ?? 0) + distKm * 0.8;
  const X = (p: number) => M.l + ((p - lo) / (hi - lo)) * (W - M.l - M.r);
  const Y = (s: number) => M.t + (1 - (s - yLo) / (yHi - yLo)) * (H - M.t - M.b);
  const clipY = (s: number) => Math.max(M.t - 2, Y(s));

  const crash = grid.filter((g) => g.real == null);
  const crashX1 = crash.length ? X(crash[crash.length - 1].p + 0.125) : null;

  const paperD = pathOf(grid.map((g) => [X(g.p), Y(g.paper)]));
  const realPts = grid.filter((g) => g.real != null).map((g): [number, number] => [X(g.p), clipY(g.real!)]);
  const realD = pathOf(realPts);
  // il prezzo delle gambe: l'area fra la carta e la realtà, dove la realtà è peggio
  const priceArea = (() => {
    const seg = grid.filter((g) => g.real != null && g.p <= limitPace + 1e-9);
    if (seg.length < 2) return "";
    return pathOf([
      ...seg.map((g): [number, number] => [X(g.p), clipY(g.real!)]),
      ...[...seg].reverse().map((g): [number, number] => [X(g.p), Y(g.paper)]),
    ]) + "Z";
  })();

  const xTicks = niceTicks(lo, hi, narrow ? 5 : 9, [1, 2, 5, 10, 15, 30]);
  const yTicks = niceTicks(yLo, yHi, narrow ? 4 : 6, TIME_STEPS);

  const sel = grid.reduce((a, g) => (Math.abs(g.p - selected) < Math.abs(a.p - selected) ? g : a), grid[0]);
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const p = lo + ((x - M.l) / (W - M.l - M.r)) * (hi - lo);
    onSelect(Math.round(Math.min(hi, Math.max(lo, p))));
  };

  // etichette dirette: dove le linee escono a destra
  const lastPaper = grid[grid.length - 1];
  const realRight = [...grid].reverse().find((g) => g.real != null);

  return (
    <div ref={wrapRef} className="w-full">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" className="block touch-pan-y select-none cursor-crosshair"
        aria-label="Tempo sulla carta e tempo vero, per ogni passo tentato"
        onPointerMove={onMove} onPointerDown={onMove}>
        <defs>
          <pattern id={`${uid}h`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={RISK} strokeWidth="1.2" strokeOpacity="0.35" />
          </pattern>
          <clipPath id={`${uid}c`}><rect x={M.l} y={M.t - 2} width={W - M.l - M.r} height={H - M.t - M.b + 2} /></clipPath>
        </defs>

        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={Y(t)} y2={Y(t)} stroke="#1E1E1E" />
            <text x={M.l - 8} y={Y(t) + 3.5} textAnchor="end" fontSize={narrow ? 9.5 : 10.5} fill="#8A8A8A" fontFamily={MONO}>{fmtClock(t)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={X(t)} y={H - 10} textAnchor="middle" fontSize={narrow ? 9.5 : 10.5}
            fill={Math.abs(t - center) < 0.01 ? "#fff" : "#8A8A8A"} fontFamily={MONO}>{fmtPace(t)}</text>
        ))}

        {crashX1 != null && (
          <g>
            <rect x={M.l} y={M.t} width={crashX1 - M.l} height={H - M.t - M.b} fill={`url(#${uid}h)`} />
            <text x={M.l + 6} y={M.t + 12} fontSize="9.5" fontWeight="800" fill={RISK} letterSpacing="0.08em">
              {narrow ? "CROLLO" : "CROLLO PRIMA DI METÀ GARA"}
            </text>
          </g>
        )}

        <g clipPath={`url(#${uid}c)`}>
          {priceArea && <path d={priceArea} fill={RISK} fillOpacity="0.12" />}
          <path d={paperD} fill="none" stroke={REF} strokeWidth="2" strokeDasharray="5 4" />
          <path d={realD} fill="none" stroke={LIT} strokeWidth="2.5" strokeLinejoin="round" />
        </g>

        {/* il limite: il fondo della V */}
        {limitPace >= lo && limitPace <= hi && (
          <g>
            <line x1={X(limitPace)} x2={X(limitPace)} y1={M.t - 6} y2={H - M.b} stroke="#fff" strokeOpacity="0.35" strokeDasharray="2 3" />
            <text x={X(limitPace)} y={M.t - 12} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff" letterSpacing="0.08em">
              IL TUO LIMITE
            </text>
            <circle cx={X(limitPace)} cy={Y(best)} r="5.5" fill={SURFACE} stroke={LIT} strokeWidth="2.5" />
            {!narrow && Math.abs(sel.p - limitPace) > 1.2 && (
              <text x={X(limitPace) + 9} y={Y(best) + 17} fontSize="10" fontWeight="800" fill={LIT} fontFamily={MONO}>
                {fmtClock(best)} · il meglio
              </text>
            )}
          </g>
        )}

        {/* etichette dirette */}
        {!narrow && (
          <>
            <text x={X(lastPaper.p) - 4} y={Y(lastPaper.paper) - 8} textAnchor="end" fontSize="10" fill={REF} fontWeight="700">sulla carta</text>
            {realRight && (
              <text x={X(realRight.p) - 4} y={clipY(realRight.real!) + 16} textAnchor="end" fontSize="10" fill={LIT} fontWeight="700">davvero</text>
            )}
          </>
        )}

        {/* il passo che stai guardando */}
        <line x1={X(sel.p)} x2={X(sel.p)} y1={M.t} y2={H - M.b} stroke="#fff" strokeOpacity="0.5" />
        <circle cx={X(sel.p)} cy={Y(sel.paper)} r="4.5" fill={SURFACE} stroke={REF} strokeWidth="2" />
        {sel.real != null && sel.real <= yHi && (
          <circle cx={X(sel.p)} cy={Y(sel.real)} r="5" fill={LIT} stroke={SURFACE} strokeWidth="2" />
        )}
        {sel.real != null && sel.real > yHi && (
          <text x={X(sel.p)} y={M.t + 10} textAnchor="middle" fontSize="11" fill={LIT} fontWeight="900">↑</text>
        )}
      </svg>
    </div>
  );
}

/** La barra "al tuo limite": a sinistra quanto manca, a destra quanto avanza. */
function TankBar({ row, distKm }: { row: LadderRow; distKm: number }) {
  const deficit = row.tankEnd < -1e-4;
  const w = Math.min(1, Math.abs(row.tankEnd) / 0.5) * 50;
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="relative h-[7px] w-[92px] shrink-0 rounded-full bg-white/[0.06]">
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/30" />
        {Math.abs(row.tankEnd) > 1e-4 && (
          <div className="absolute top-0 bottom-0 rounded-full"
            style={deficit
              ? { right: "50%", width: `${w}%`, background: RISK }
              : { left: "50%", width: `${w}%`, background: LOAD, opacity: 0.8 }} />
        )}
      </div>
      <span className="text-[11.5px] tabular-nums whitespace-nowrap" style={{ fontFamily: MONO, color: deficit ? "#FDA4AF" : row.tankEnd > 1e-4 ? "#FCD34D" : "#fff" }}>
        {deficit
          ? `muro al km ${fmtKm(row.wallKm!)}`
          : row.tankEnd > 1e-4
            ? `avanza ${Math.round(row.tankEnd * 100)}%`
            : `vuoto sul traguardo`}
      </span>
      {deficit && <span className="hidden 2xl:inline text-[10px] text-gray-600 whitespace-nowrap">{fmtKm(distKm - row.wallKm!)} km prima</span>}
    </div>
  );
}

export function ListinoSection({ ctx }: { ctx: PaceCtx }) {
  const { distKm, pace0, vdot, limitPace, targetSec } = ctx;
  const [span, setSpan] = useState(6);
  const [pick, setPick] = useState<number | null>(null);
  const rows = useMemo(() => paceLadder(distKm, pace0, vdot, span), [distKm, pace0, vdot, span]);
  const bestSec = limitPace * distKm;
  const selected = pick != null && Math.abs(pick - pace0) <= span ? pick : pace0 - 3;
  const selRow = rows.find((r) => Math.abs(r.paceSec - selected) < 0.01)
    ?? paceLadder(distKm, selected, vdot, 0)[0];

  return (
    <Card id="listino" className="pl-rise overflow-hidden">
      <SectionHead n="01" title="Il listino"
        question="Quanto pesa ogni secondo al km?"
        right={
          <Segmented size="sm" ariaLabel="Ampiezza della scala" value={span} onChange={(v) => setSpan(v)}
            options={[{ value: 6, label: "±6″" }, { value: 10, label: "±10″" }, { value: 15, label: "±15″" }]} />
        } />

      <div className="px-5 pb-5 grid grid-cols-1 gap-5">
        {/* ── la lettura del passo selezionato ── */}
        <div className="rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3">
          <p className="text-[14px] md:text-[16px] font-black leading-snug text-gray-200">
            A <span className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtPace(selRow.paceSec)}/km</span>{" "}
            {ctx.distOn}: sulla carta{" "}
            <span className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(selRow.timeSec)}</span>
            {selRow.offsetSec !== 0 && <span className="text-gray-500 tabular-nums" style={{ fontFamily: MONO }}> ({fmtDelta(selRow.vsCenterSec)} sull'obiettivo)</span>}.{" "}
            {selRow.wallKm != null ? (
              <>Ma al tuo livello il serbatoio finisce al <span style={{ color: RISK }}>km {fmtKm(selRow.wallKm)}</span>
                {selRow.realSec != null
                  ? <>; se te ne accorgi a metà gara e rallenti quanto serve, chiudi in{" "}
                      <span className="tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{fmtClock(selRow.realSec)}</span>{" "}
                      {selRow.realSec - bestSec >= 0.5
                        ? <span className="tabular-nums" style={{ fontFamily: MONO, color: RISK }}>({fmtDelta(selRow.realSec - bestSec)} sul tuo limite)</span>
                        : <span className="text-gray-400">(quanto il tuo limite: sei a un passo da lì)</span>}.</>
                  : <>, prima ancora di metà gara: non c'è correzione che salvi il tempo.</>}
              </>
            ) : selRow.tankEnd > 1e-4 ? (
              <>Arrivi con il <span style={{ color: LOAD }}>{Math.round(selRow.tankEnd * 100)}%</span> del serbatoio: sono{" "}
                <span className="tabular-nums" style={{ fontFamily: MONO, color: LOAD }}>{fmtDelta(selRow.timeSec - bestSec)}</span> lasciati sul tavolo
                {selRow.realSec != null && selRow.realSec < selRow.timeSec - 0.5 && (
                  <>; allungando nella seconda metà ne recuperi una parte e chiudi in{" "}
                    <span className="tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{fmtClock(selRow.realSec)}</span></>
                )}.
              </>
            ) : (
              <>È il tuo limite: il serbatoio si svuota esattamente sul traguardo. Nessun passo costante fa meglio.</>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-gray-500">
            <span className="inline-flex items-center gap-1.5"><LineKey color={REF} dashed width={2} />sulla carta: passo × km</span>
            <span className="inline-flex items-center gap-1.5"><LineKey color={LIT} />davvero: se a metà gara correggi</span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="14" height="10" aria-hidden><rect width="14" height="10" rx="2" fill={RISK} fillOpacity="0.25" /></svg>
              il conto delle gambe
            </span>
            <span className="text-gray-600">passa sul grafico o tocca una riga</span>
          </div>
        </div>

        <PriceCurve distKm={distKm} center={pace0} vdot={vdot} limitPace={limitPace} span={span}
          selected={selected} onSelect={setPick} />

        {/* ── la tabella: ogni secondo, tutti i prezzi ── */}
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[720px] text-left border-separate border-spacing-0">
            <thead>
              <tr className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-500">
                <th className="py-2 pr-3 font-black">Passo</th>
                <th className="py-2 pr-3 font-black">Sulla carta</th>
                <th className="py-2 pr-3 font-black">Vs obiettivo</th>
                <th className="py-2 pr-3 font-black" title="Il VDOT che serve per reggerlo fino in fondo">Motore che serve</th>
                <th className="py-2 pr-3 font-black">Al tuo livello</th>
                <th className="py-2 font-black text-right" title="Se a metà gara ti accorgi e correggi">Davvero</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isTarget = r.offsetSec === 0;
                const isLimit = Math.abs(r.paceSec - limitPace) < 0.5;
                const isSel = Math.abs(r.paceSec - selected) < 0.01;
                return (
                  <tr key={r.offsetSec} onClick={() => setPick(r.paceSec)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                    style={{ background: isSel ? "rgba(255,255,255,0.06)" : undefined }}>
                    <td className="py-1.5 pr-3 border-t border-white/[0.05]"
                      style={{ boxShadow: isTarget ? `inset 3px 0 0 ${LIT}` : undefined }}>
                      <div className="flex items-baseline gap-2 pl-2">
                        <span className="text-[13.5px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{fmtPace(r.paceSec)}</span>
                        <span className="text-[10px] tabular-nums w-7" style={{ fontFamily: MONO, color: r.offsetSec < 0 ? "#FDA4AF" : r.offsetSec > 0 ? "#9CA3AF" : LIT }}>
                          {r.offsetSec === 0 ? "obj" : `${r.offsetSec > 0 ? "+" : "−"}${Math.abs(r.offsetSec)}″`}
                        </span>
                        {isLimit && ctx.levelMode === "vdot" && (
                          <span className="text-[8.5px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-white/10 text-white">limite</span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 border-t border-white/[0.05] text-[12.5px] tabular-nums text-gray-200" style={{ fontFamily: MONO }}>
                      {fmtClock(r.timeSec)}
                    </td>
                    <td className="py-1.5 pr-3 border-t border-white/[0.05] text-[12px] tabular-nums" style={{ fontFamily: MONO, color: r.vsCenterSec < 0 ? "#86EFAC" : r.vsCenterSec > 0 ? "#9CA3AF" : "#6B7280" }}>
                      {r.offsetSec === 0 ? "—" : fmtDelta(r.vsCenterSec)}
                    </td>
                    <td className="py-1.5 pr-3 border-t border-white/[0.05] text-[12px] tabular-nums text-gray-300" style={{ fontFamily: MONO }}>
                      {r.vdot.toFixed(1).replace(".", ",")}
                      <span className="text-gray-600"> · {r.eq.label} {fmtClock(r.eq.sec)}</span>
                    </td>
                    <td className="py-1.5 pr-3 border-t border-white/[0.05]"><TankBar row={r} distKm={distKm} /></td>
                    <td className="py-1.5 border-t border-white/[0.05] text-right text-[12px] tabular-nums whitespace-nowrap" style={{ fontFamily: MONO }}>
                      {r.realSec == null
                        ? <span style={{ color: RISK }}>crollo</span>
                        : <>
                            <span className="text-gray-200">{fmtClock(r.realSec)}</span>
                            <span className="ml-1.5" style={{ color: r.realSec - bestSec > 0.5 ? (r.offsetSec + pace0 < limitPace ? "#FDA4AF" : "#FCD34D") : "#6B7280" }}>
                              {Math.abs(r.realSec - bestSec) < 0.5 ? "±0″" : fmtDelta(r.realSec - bestSec)}
                            </span>
                          </>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="-mt-2 text-[10.5px] text-gray-600 leading-relaxed">
          <b className="text-gray-500">Motore che serve</b>: il VDOT con cui quel passo regge fino in fondo, e il tempo che vale su un'altra distanza.{" "}
          <b className="text-gray-500">Davvero</b>: il tempo finale se a metà gara ti accorgi di come stai — rallenti quanto basta per non crollare,
          o allunghi se ti avanza serbatoio — confrontato con il tuo limite ({fmtClock(bestSec)}).
          {ctx.levelMode === "target" && <> Qui il tuo limite è l'obiettivo, {fmtClock(targetSec)}.</>}
        </p>
      </div>
    </Card>
  );
}
