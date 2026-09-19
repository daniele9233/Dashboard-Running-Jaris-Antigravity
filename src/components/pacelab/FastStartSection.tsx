import { useEffect, useId, useMemo, useState, type PointerEvent } from "react";
import { fmtClock, fmtPace } from "../gamification/gamiCore";
import {
  fastStart, fastStartTrace, fmtDelta, fmtKm, kmCost,
  type DistanceId, type FastStartInput, type FastStartResult, type TracePoint,
} from "./paceEngine";
import type { PaceCtx } from "./PaceLabView";
import {
  CYAN, Card, LIT, LOAD, MONO, REF, RISK, SURFACE, Label, LineKey, SectionHead, Stat, Stepper,
} from "./ui";
import { niceTicks, pathOf, useWidth } from "./chartKit";

/**
 * 02 · PARTIRE FORTE
 * ════════════════════════════════════════════════════════════════════════════
 * «Quanto pesa correre i primi 3 km a 4:39 in una mezza da 4:47, e a che km lo
 * pago?» La risposta ha due facce, e la seconda è quella che conta:
 *
 *   - se te ne accorgi SUBITO e rallenti quanto serve, il conto è piccolo:
 *     il costo è convesso, e un errore piccolo costa poco;
 *   - se tieni il passo come se niente fosse, il serbatoio finisce prima del
 *     traguardo. Sembri in vantaggio fino all'ultimo: è lì la trappola.
 *
 * In mezzo, il prezzo di accorgersene tardi: più aspetti, più il resto della
 * gara deve essere lento per rimediare. Il grafico a barre lo mostra km per km.
 */

const DEFAULTS: Record<DistanceId, { km: number; off: number; rows: number[] }> = {
  "3k": { km: 1, off: -5, rows: [0.5, 1, 1.5] },
  "5k": { km: 1, off: -6, rows: [0.5, 1, 2, 2.5] },
  "10k": { km: 2, off: -6, rows: [1, 2, 3, 5] },
  "15k": { km: 3, off: -7, rows: [1, 2, 3, 5] },
  "21k": { km: 3, off: -8, rows: [1, 2, 3, 4, 5] },
};
const OFFSETS = [-3, -5, -8, -10, -15];

const TIME_STEPS = [2, 5, 10, 15, 20, 30, 60, 120, 300];

function BankTankChart({ inp, res, noticeKm }: { inp: FastStartInput; res: FastStartResult; noticeKm: number | null }) {
  const [wrapRef, cw] = useWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");
  const narrow = cw < 560;
  const W = Math.max(300, cw);
  const M = { l: narrow ? 40 : 52, r: narrow ? 44 : 64, t: 18 };
  const H1 = narrow ? 170 : 210, GAP = 34, H2 = narrow ? 92 : 110, AX = 26;
  const H = M.t + H1 + GAP + H2 + AX;
  const D = inp.distKm;
  const [hover, setHover] = useState<number | null>(null);

  const smart = useMemo(() => fastStartTrace(inp, inp.firstKm), [inp]);
  const hold = useMemo(() => fastStartTrace(inp, null), [inp]);
  const late = useMemo(() => (noticeKm != null ? fastStartTrace(inp, noticeKm) : null), [inp, noticeKm]);
  const cP = kmCost(inp.targetPace, inp.vdot);

  const all = [...smart, ...hold, ...(late ?? [])].map((p) => p.bank);
  const bMax = Math.max(res.bankSec, 2, ...all);
  const bMin = Math.min(0, ...all);
  const pad = Math.max(2, (bMax - bMin) * 0.12);
  const yLo = bMin - pad, yHi = bMax + pad;
  const X = (km: number) => M.l + (km / D) * (W - M.l - M.r);
  const Y1 = (s: number) => M.t + (1 - (s - yLo) / (yHi - yLo)) * H1;
  const top2 = M.t + H1 + GAP;
  const Y2 = (t: number) => top2 + (1 - Math.max(0, Math.min(1.05, t)) / 1.05) * H2;

  // se il passo obiettivo regge anche dopo lo strappo, le tre strade sono una sola
  const lines: { id: string; pts: TracePoint[]; color: string; dashed?: boolean; label: string }[] = res.holdOk
    ? [{ id: "smart", pts: smart, color: LIT, label: `poi ${fmtPace(res.smart.restPace)} fino in fondo` }]
    : [
        { id: "hold", pts: hold, color: RISK, label: `tieni ${fmtPace(inp.targetPace)}` },
        ...(late ? [{ id: "late", pts: late, color: CYAN, label: `correggi al km ${fmtKm(noticeKm!, 0)}` }] : []),
        { id: "smart", pts: smart, color: LIT, label: "correggi subito" },
      ];
  const evenTank = (km: number) => 1 - km * cP;

  const yTicks = niceTicks(yLo, yHi, narrow ? 4 : 5, TIME_STEPS);
  const xTicks = niceTicks(0, D, narrow ? 5 : 10, [0.5, 1, 2, 2.5, 5]);

  const at = (pts: TracePoint[], km: number): TracePoint | null => {
    if (km > pts[pts.length - 1].km + 1e-6) return null;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.km - km) < Math.abs(best.km - km)) best = p;
    return best;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const km = ((x - M.l) / (W - M.l - M.r)) * D;
    setHover(km < 0 || km > D ? null : Math.round(km * 10) / 10);
  };

  // le etichette di fine riga: una sotto l'altra, mai sovrapposte
  const ends = lines.map((l) => {
    const last = l.pts[l.pts.length - 1];
    return { l, x: X(last.km), y: Y1(last.bank), last, wall: l.id === "hold" && last.km < D - 1e-6 };
  });
  const sortedEnds = ends.filter((e) => !e.wall).sort((a, b) => a.y - b.y);
  for (let i = 1; i < sortedEnds.length; i++) sortedEnds[i].y = Math.max(sortedEnds[i].y, sortedEnds[i - 1].y + 13);

  const hv = hover != null ? { km: hover, rows: lines.map((l) => ({ l, p: at(l.pts, hover) })) } : null;
  const payback = res.smart.paybackKm;

  return (
    <div ref={wrapRef} className="w-full">
      {/* la lettura del km sotto il cursore */}
      <div className="min-h-[34px] mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {hv ? (
          <>
            <span className="font-black text-white tabular-nums" style={{ fontFamily: MONO }}>km {fmtKm(hv.km)}</span>
            {hv.rows.map(({ l, p }) => (
              <span key={l.id} className="inline-flex items-center gap-1.5 text-gray-400">
                <LineKey color={l.color} />
                {p
                  ? <><b className="tabular-nums text-white" style={{ fontFamily: MONO }}>{fmtDelta(-p.bank)}</b>
                      <span className="tabular-nums" style={{ fontFamily: MONO }}>· {Math.round(p.tank * 100)}%</span></>
                  : <b style={{ color: RISK }}>serbatoio vuoto</b>}
              </span>
            ))}
            <span className="text-gray-600">tempo rispetto al passo costante · serbatoio rimasto</span>
          </>
        ) : (
          <>
            {lines.slice().reverse().map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1.5 text-gray-400"><LineKey color={l.color} />{l.label}</span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-gray-400"><LineKey color={REF} dashed width={2} />passo costante {fmtPace(inp.targetPace)}</span>
          </>
        )}
      </div>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" className="block touch-pan-y select-none cursor-crosshair"
        aria-label="Vantaggio sul passo costante e serbatoio, km per km"
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <clipPath id={`${uid}a`}><rect x={M.l} y={M.t} width={W - M.l - M.r} height={H1} /></clipPath>
        </defs>

        {/* ── pannello 1: il conto in secondi ── */}
        <text x={M.l} y={M.t - 6} fontSize="9.5" fontWeight="800" fill="#8A8A8A" letterSpacing="0.14em">SECONDI DI VANTAGGIO SUL PASSO COSTANTE</text>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={Y1(t)} y2={Y1(t)} stroke={t === 0 ? "#3A3A3A" : "#1E1E1E"} />
            <text x={M.l - 7} y={Y1(t) + 3.5} textAnchor="end" fontSize="10" fill="#8A8A8A" fontFamily={MONO}>
              {t > 0 ? `+${t}″` : t < 0 ? `−${-t}″` : "0"}
            </text>
          </g>
        ))}
        {/* il tratto veloce */}
        <rect x={X(0)} y={M.t} width={X(inp.firstKm) - X(0)} height={H1} fill={LIT} fillOpacity="0.05" />
        <text x={X(inp.firstKm / 2)} y={M.t + H1 - 6} textAnchor="middle" fontSize="9" fill={LIT} fillOpacity="0.8" fontWeight="800">
          {fmtPace(inp.fastPace)}
        </text>
        <g clipPath={`url(#${uid}a)`}>
          <line x1={X(0)} x2={X(D)} y1={Y1(0)} y2={Y1(0)} stroke={REF} strokeWidth="2" strokeDasharray="5 4" />
          {lines.map((l) => (
            <path key={l.id} d={pathOf(l.pts.map((p) => [X(p.km), Y1(p.bank)]))} fill="none" stroke={l.color}
              strokeWidth={l.id === "smart" ? 2.5 : 2} strokeLinejoin="round" />
          ))}
        </g>
        {payback != null && (
          <g>
            <circle cx={X(payback)} cy={Y1(0)} r="4.5" fill={SURFACE} stroke={LIT} strokeWidth="2" />
            {!narrow && (
              <text x={X(payback)} y={Y1(0) - 9} textAnchor="middle" fontSize="9.5" fill={LIT} fontWeight="800">
                restituito al km {fmtKm(payback)}
              </text>
            )}
          </g>
        )}
        {/* il muro */}
        {res.wallKm != null && (
          <g>
            <line x1={X(res.wallKm)} x2={X(res.wallKm)} y1={M.t} y2={top2 + H2} stroke={RISK} strokeOpacity="0.6" strokeDasharray="3 3" />
            {(() => {
              const e = ends.find((x) => x.wall);
              if (!e) return null;
              return (
                <g>
                  <path d={`M${e.x - 5},${e.y - 5}L${e.x + 5},${e.y + 5}M${e.x + 5},${e.y - 5}L${e.x - 5},${e.y + 5}`} stroke={RISK} strokeWidth="2.5" strokeLinecap="round" />
                  <text x={e.x + (e.x > W - M.r - 70 ? -9 : 9)} y={e.y - 8} textAnchor={e.x > W - M.r - 70 ? "end" : "start"} fontSize="10" fill={RISK} fontWeight="900">
                    MURO · km {fmtKm(res.wallKm!)}
                  </text>
                </g>
              );
            })()}
          </g>
        )}
        {sortedEnds.map((e) => (
          <text key={e.l.id} x={W - M.r + 6} y={e.y + 3.5} fontSize="10.5" fontWeight="900" fill={e.l.color} fontFamily={MONO}>
            {fmtDelta(-e.last.bank)}
          </text>
        ))}

        {/* ── pannello 2: il serbatoio ── */}
        <text x={M.l} y={top2 - 8} fontSize="9.5" fontWeight="800" fill="#8A8A8A" letterSpacing="0.14em">SERBATOIO RIMASTO</text>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={Y2(t)} y2={Y2(t)} stroke={t === 0 ? "#3A3A3A" : "#1E1E1E"} />
            <text x={M.l - 7} y={Y2(t) + 3.5} textAnchor="end" fontSize="10" fill="#8A8A8A" fontFamily={MONO}>{Math.round(t * 100)}%</text>
          </g>
        ))}
        <line x1={X(0)} y1={Y2(evenTank(0))} x2={X(D)} y2={Y2(evenTank(D))} stroke={REF} strokeWidth="2" strokeDasharray="5 4" />
        {lines.map((l) => (
          <path key={l.id} d={pathOf(l.pts.map((p) => [X(p.km), Y2(p.tank)]))} fill="none" stroke={l.color}
            strokeWidth={l.id === "smart" ? 2.5 : 2} strokeLinejoin="round" />
        ))}

        {/* asse dei km */}
        {xTicks.map((t) => (
          <text key={t} x={X(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8A8A8A" fontFamily={MONO}>{fmtKm(t, t % 1 ? 1 : 0)}</text>
        ))}

        {hv && (
          <g pointerEvents="none">
            <line x1={X(hv.km)} x2={X(hv.km)} y1={M.t} y2={top2 + H2} stroke="#fff" strokeOpacity="0.4" />
            {hv.rows.map(({ l, p }) => p && (
              <g key={l.id}>
                <circle cx={X(p.km)} cy={Y1(p.bank)} r="3.8" fill={l.color} stroke={SURFACE} strokeWidth="2" />
                <circle cx={X(p.km)} cy={Y2(p.tank)} r="3.8" fill={l.color} stroke={SURFACE} strokeWidth="2" />
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

/** Il prezzo di accorgersene tardi: una barra per ogni km, fino al muro. */
function DelayBars({ res, noticeKm, onPick }: { res: FastStartResult; noticeKm: number | null; onPick: (km: number) => void }) {
  const bars = [res.smart, ...res.late.filter((c) => c.atKm > res.smart.atKm + 1e-6)];
  // al massimo ~22 barre: sulle distanze lunghe si salta un km sì e uno no
  const stride = Math.ceil(bars.length / 22);
  const shown = bars.filter((_, i) => i === 0 || i === bars.length - 1 || i % stride === 0);
  const max = Math.max(...shown.map((b) => b.deltaSec), 1);
  return (
    <div>
      <div className="flex items-end gap-[3px] h-[118px]">
        {shown.map((b, i) => {
          const on = noticeKm != null ? Math.abs(b.atKm - noticeKm) < 1e-6 : b === res.smart;
          const h = Math.max(4, (Math.max(0, b.deltaSec) / max) * 88);
          // sul telefono le cifre di tutte le barre si pestano: restano la scelta, gli estremi e una ogni tre
          const key = on || i === 0 || i === shown.length - 1 || i % 3 === 0;
          return (
            <button key={b.atKm} type="button" onClick={() => onPick(b.atKm)}
              className="group flex-1 min-w-0 flex flex-col items-center justify-end h-full"
              title={`Te ne accorgi al km ${fmtKm(b.atKm)}: il resto a ${fmtPace(b.restPace)}, all'arrivo ${fmtDelta(b.deltaSec)}`}>
              <span className={`${key ? "block" : "hidden sm:block"} text-[9.5px] font-black tabular-nums mb-1 whitespace-nowrap`} style={{ fontFamily: MONO, color: on ? "#fff" : "#9CA3AF" }}>
                {fmtDelta(b.deltaSec)}
              </span>
              <span className="w-full rounded-t-[4px] transition-colors"
                style={{ height: h, background: on ? (b === res.smart ? LIT : CYAN) : LOAD, opacity: on ? 1 : 0.55 }} />
            </button>
          );
        })}
        {res.wallKm != null && (
          <div className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
            <span className="text-[9.5px] font-black mb-1" style={{ color: RISK }}>MURO</span>
            <span className="w-full rounded-t-[4px]" style={{ height: 100, background: `repeating-linear-gradient(135deg, ${RISK}, ${RISK} 3px, ${RISK}66 3px, ${RISK}66 6px)` }} />
          </div>
        )}
      </div>
      <div className="flex gap-[3px] mt-1.5 border-t border-white/10 pt-1.5">
        {shown.map((b, i) => (
          <span key={b.atKm} className="flex-1 min-w-0 text-center text-[9.5px] tabular-nums text-gray-500 overflow-hidden" style={{ fontFamily: MONO }}>
            <span className={i % 2 === 0 || i === shown.length - 1 ? "" : "hidden sm:inline"}>{fmtKm(b.atKm, b.atKm % 1 ? 1 : 0)}</span>
          </span>
        ))}
        {res.wallKm != null && (
          <span className="flex-1 min-w-0 text-center text-[9.5px] tabular-nums" style={{ fontFamily: MONO, color: RISK }}>{fmtKm(res.wallKm)}</span>
        )}
      </div>
      <div className="mt-1 text-[9.5px] text-gray-600 text-center">km in cui te ne accorgi e cambi passo</div>
    </div>
  );
}

export function FastStartSection({ ctx }: { ctx: PaceCtx }) {
  const { distId, distKm: D, pace0: P, vdot } = ctx;
  const def = DEFAULTS[distId];
  const [firstKm, setFirstKm] = useState(def.km);
  const [off, setOff] = useState(def.off);
  const [notice, setNotice] = useState<number | null>(null);

  // cambiando distanza si riparte da un esempio sensato per quella distanza
  useEffect(() => { setFirstKm(DEFAULTS[distId].km); setOff(DEFAULTS[distId].off); setNotice(null); }, [distId]);

  const maxFirst = Math.max(0.5, Math.floor(D / 2 / 0.5) * 0.5);
  const N = Math.min(firstKm, maxFirst);
  const inp: FastStartInput = useMemo(
    () => ({ distKm: D, targetPace: P, vdot, firstKm: N, fastPace: P + off }),
    [D, P, vdot, N, off],
  );
  const res = useMemo(() => fastStart(inp), [inp]);

  // il km in cui te ne accorgi: fra la fine del tratto veloce e il muro
  const lastNotice = res.late.length ? res.late[res.late.length - 1].atKm : null;
  const noticeKm = notice != null && lastNotice != null && notice > N + 1e-6 && notice <= lastNotice + 1e-6 ? notice : null;
  const lateCorr = noticeKm != null ? res.late.find((c) => Math.abs(c.atKm - noticeKm) < 1e-6) ?? null : null;

  const matrix = useMemo(() => def.rows.filter((r) => r <= maxFirst).map((km) => ({
    km,
    cells: OFFSETS.map((o) => fastStart({ distKm: D, targetPace: P, vdot, firstKm: km, fastPace: P + o })),
  })), [def.rows, maxFirst, D, P, vdot]);
  const matMax = Math.max(1, ...matrix.flatMap((r) => r.cells.map((c) => Math.max(0, c.smart.deltaSec))));

  const bank = res.bankSec;
  const faster = off < 0;

  return (
    <Card id="partenza" className="pl-rise overflow-hidden">
      <SectionHead n="02" title="Partire forte" question="Quanto costa, e a che km lo paghi?" />

      <div className="px-5 pb-5 grid grid-cols-1 gap-5">
        {/* ── i comandi ── */}
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <div>
            <Label className="mb-1.5">I primi</Label>
            <Stepper label="Km veloci" value={`${fmtKm(N, N % 1 ? 1 : 0)} km`} width="w-[5.2rem]"
              onDec={() => setFirstKm(Math.max(0.5, N - 0.5))} onInc={() => setFirstKm(Math.min(maxFirst, N + 0.5))}
              disabledDec={N <= 0.5} disabledInc={N >= maxFirst} />
          </div>
          <div>
            <Label className="mb-1.5">A</Label>
            <Stepper label="Passo della partenza" value={fmtPace(P + off)} sub={off === 0 ? "= obiettivo" : `${off > 0 ? "+" : "−"}${Math.abs(off)}″/km`}
              onDec={() => setOff(Math.max(-30, off - 1))} onInc={() => setOff(Math.min(20, off + 1))} />
          </div>
          <div className="text-[12px] text-gray-400 pb-2">
            poi {fmtPace(P)}/km fino al traguardo ({ctx.distOn})
          </div>
        </div>

        {/* ── il verdetto ── */}
        {faster ? (
          <div className="rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3.5">
            <p className="text-[15px] md:text-[18px] font-black leading-snug text-gray-200">
              {fmtKm(N, N % 1 ? 1 : 0)} km a {fmtPace(P + off)} ti mettono in tasca{" "}
              <span style={{ color: LIT }}>{Math.round(bank)}″</span>, ma costano il serbatoio di{" "}
              <span style={{ color: LOAD }}>{fmtKm(res.extraKm)} km</span> di gara in più.{" "}
              {res.holdOk ? (
                <>Col margine che hai li reggi: tieni {fmtPace(P)} e arrivi{" "}
                  <span style={{ color: LIT }}>{Math.round(bank)}″</span> prima, con il{" "}
                  {Math.round(res.holdTankEnd * 100)}% del serbatoio invece del {Math.round(res.evenTankEnd * 100)}%.</>
              ) : (
                <>Se poi tieni {fmtPace(P)}, lo paghi al{" "}
                  <span style={{ color: RISK }}>km {fmtKm(res.wallKm!)}</span>: lì il serbatoio è vuoto.
                  Rallentando subito a {fmtPace(res.smart.restPace)} li restituisci entro il{" "}
                  {res.smart.paybackKm != null ? <>km {fmtKm(res.smart.paybackKm)}</> : <>traguardo</>} e chiudi a{" "}
                  <span style={{ color: RISK }}>{fmtDelta(res.smart.deltaSec)}</span>: il vantaggio era un prestito, con gli interessi.</>
              )}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3.5">
            <p className="text-[15px] md:text-[17px] font-black leading-snug text-gray-200">
              {off === 0
                ? <>Nessuno strappo: parti al passo obiettivo. Scegli un passo più veloce per vedere quanto costa.</>
                : <>Partire {Math.abs(off)}″/km più piano per {fmtKm(N, N % 1 ? 1 : 0)} km lascia{" "}
                    <span style={{ color: LOAD }}>{Math.round(-bank)}″</span> da recuperare dopo:{" "}
                    {res.smart.deltaSec > 0.5
                      ? <>il serbatoio risparmiato ti fa correre il resto a {fmtPace(res.smart.restPace)}, ma non basta a riprenderli tutti:
                          chiudi a <span style={{ color: LOAD }}>{fmtDelta(res.smart.deltaSec)}</span>. Anche partire piano ha un prezzo — più
                          piccolo di quello di partire forte, perché qui nessun muro ti aspetta.</>
                      : <>col margine che hai li riprendi correndo il resto a {fmtPace(res.smart.restPace)}, e chiudi sull'obiettivo.</>}
                  </>}
            </p>
          </div>
        )}

        {faster && (
          <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
            <Stat label="In tasca" value={`+${Math.round(bank)}″`} color={LIT}
              sub={<>{fmtKm(N, N % 1 ? 1 : 0)} km × {Math.abs(off)}″ al km</>} />
            <Stat label="Serbatoio in più" value={`${Math.round(res.extraTank * 100)}%`} color={LOAD}
              sub={<>quanto {fmtKm(res.extraKm)} km di gara a {fmtPace(P)}</>} />
            <Stat label={res.holdOk ? "Il margine che resta" : `Se tieni ${fmtPace(P)}`}
              value={res.holdOk ? `${Math.round(res.holdTankEnd * 100)}%` : `km ${fmtKm(res.wallKm!)}`}
              color={res.holdOk ? LIT : RISK}
              sub={res.holdOk ? <>del serbatoio all'arrivo</> : <>il serbatoio è vuoto: {fmtKm(D - res.wallKm!)} km prima del traguardo</>} />
            <Stat label={res.holdOk ? "All'arrivo" : "Il prezzo minimo"} value={fmtDelta(res.smart.deltaSec)} color={res.smart.deltaSec > 0.5 ? RISK : LIT}
              sub={res.holdOk ? <>sull'obiettivo, tenendo {fmtPace(P)} fino in fondo</> : <>rallentando subito a {fmtPace(res.smart.restPace)} per il resto</>} />
          </div>
        )}

        {/* ── il grafico ── */}
        <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
          <BankTankChart inp={inp} res={res} noticeKm={noticeKm} />
        </div>

        {/* ── il prezzo del ritardo + le combinazioni ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
              <Label>Il prezzo di accorgersene tardi</Label>
              {noticeKm != null && (
                <button type="button" onClick={() => setNotice(null)} className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors">
                  togli la linea azzurra
                </button>
              )}
            </div>
            {!faster || res.holdOk ? (
              <p className="mt-2 text-[11.5px] text-gray-500 leading-relaxed">
                {res.holdOk
                  ? <>Col margine che hai il passo obiettivo regge anche dopo la partenza: non c'è niente da correggere.</>
                  : <>Qui si vede quando la partenza è più veloce dell'obiettivo.</>}
              </p>
            ) : (
              <>
                <p className="text-[10.5px] text-gray-500 mb-3 leading-relaxed">
                  Tieni {fmtPace(P)} fino al km della barra, poi il passo più veloce che non ti fa crollare. Tocca una barra per
                  vederla nel grafico.{lateCorr && <> Al km {fmtKm(lateCorr.atKm, 0)}: il resto a <b className="text-gray-300">{fmtPace(lateCorr.restPace)}</b>, all'arrivo <b className="text-gray-300">{fmtDelta(lateCorr.deltaSec)}</b>.</>}
                </p>
                <DelayBars res={res} noticeKm={noticeKm} onPick={(km) => setNotice(km <= N + 1e-6 ? null : km)} />
              </>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
            <Label className="mb-1">Tutte le combinazioni {ctx.distOn}</Label>
            <p className="text-[10.5px] text-gray-500 mb-3 leading-relaxed">
              Il prezzo all'arrivo se correggi subito; sotto, il km del muro se invece tieni {fmtPace(P)}. Tocca una casella.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[340px] border-separate" style={{ borderSpacing: 3 }}>
                <thead>
                  <tr>
                    <th className="text-[9px] font-black tracking-[0.14em] uppercase text-gray-600 text-left font-black">primi</th>
                    {OFFSETS.map((o) => (
                      <th key={o} className="text-[10px] font-black tabular-nums text-gray-400 font-black" style={{ fontFamily: MONO }}>
                        −{Math.abs(o)}″<span className="block text-[9px] text-gray-600 font-normal">{fmtPace(P + o)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.km}>
                      <td className="text-[11px] font-black tabular-nums text-gray-300 pr-1 whitespace-nowrap" style={{ fontFamily: MONO }}>
                        {fmtKm(row.km, row.km % 1 ? 1 : 0)} km
                      </td>
                      {row.cells.map((c, j) => {
                        const on = Math.abs(row.km - N) < 1e-6 && OFFSETS[j] === off;
                        const a = Math.max(0, c.smart.deltaSec) / matMax;
                        return (
                          <td key={j} className="p-0">
                            <button type="button" onClick={() => { setFirstKm(row.km); setOff(OFFSETS[j]); setNotice(null); }}
                              className="w-full rounded-lg px-1 py-1.5 text-center transition-transform hover:scale-[1.04]"
                              style={{
                                background: c.holdOk ? "rgba(192,255,0,0.08)" : `rgba(245,158,11,${0.08 + a * 0.5})`,
                                boxShadow: on ? `inset 0 0 0 2px ${LIT}` : undefined,
                              }}>
                              <span className="block text-[12px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>
                                {fmtDelta(c.smart.deltaSec)}
                              </span>
                              <span className="block text-[9px] tabular-nums" style={{ fontFamily: MONO, color: c.wallKm != null ? "#FDA4AF" : "#86EFAC" }}>
                                {c.wallKm != null ? `muro ${fmtKm(c.wallKm)}` : "regge"}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="-mt-1 text-[11px] text-gray-500 leading-relaxed max-w-5xl">
          <b className="text-gray-300">Come leggerlo.</b> Uno strappo corretto subito costa poco: il consumo cresce più in fretta del
          passo, e un errore piccolo si ripaga con un rallentamento piccolo. Il conto vero lo presenta il passo tenuto «perché
          tanto sto bene»: la linea rossa resta sopra lo zero fino all'ultimo — sembri in vantaggio — e poi finisce il serbatoio.
          Il tempo dopo il muro non lo scriviamo: dipende da quanto crolli, e nessun modello onesto lo sa.
          {" "}Totale a {fmtPace(P)}: {fmtClock(P * D)}.
        </p>
      </div>
    </Card>
  );
}
