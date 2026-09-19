import { useId, useState, type PointerEvent } from "react";
import { fmtPace } from "../gamification/gamiCore";
import { fmtKm, type Course, type Split } from "./paceEngine";
import { LIT, MONO, RISK, SURFACE, LineKey } from "./ui";
import { PACE_BINS, niceTicks, paceColor, pathOf, useWidth } from "./chartKit";

/**
 * IL GRAFICO DEL PACEPRO
 * ════════════════════════════════════════════════════════════════════════════
 * Quello del Garmin, con due differenze che contano:
 *
 *   - il passo e la quota non condividono il grafico con due assi: stanno in
 *     due pannelli uno sopra l'altro, sulla stessa scala dei km. Due scale
 *     sovrapposte inventano incroci che nei dati non ci sono;
 *   - sotto c'è il SERBATOIO: la linea che il Garmin non ha e che dice se il
 *     piano regge. Con la tratteggiata rossa della giornata storta — lo stesso
 *     piano seguito da chi quel giorno vale l'1,5% in meno.
 *
 * Il colore dei gradini segue lo scarto dal passo medio: blu più lento, rosso
 * più veloce, grigio chiaro in linea. Divergente, con il neutro al centro.
 */

export function PaceProChart({ course, splits, avgPace, badTrace, badWallKm, selected, onSelect }: {
  course: Course;
  splits: Split[];
  avgPace: number;
  badTrace: { km: number; tank: number }[];
  badWallKm: number | null;
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const [wrapRef, cw] = useWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");
  const narrow = cw < 560;
  const W = Math.max(300, cw);
  const D = course.distKm;
  const hasElev = !course.flat;
  const M = { l: narrow ? 44 : 54, r: narrow ? 10 : 16, t: 18 };
  const H1 = narrow ? 170 : 220, GAP = 30, H2 = hasElev ? (narrow ? 58 : 72) : 0, H3 = narrow ? 70 : 84, AX = 26;
  const top2 = M.t + H1 + GAP;
  const top3 = top2 + (hasElev ? H2 + GAP : 0);
  const H = top3 + H3 + AX;
  const [hover, setHover] = useState<number | null>(null);

  const X = (km: number) => M.l + (km / D) * (W - M.l - M.r);
  const paces = splits.map((s) => s.paceSec);
  const pMin = Math.min(...paces, avgPace), pMax = Math.max(...paces, avgPace);
  const spread = Math.max(16, pMax - pMin);
  const pLo = pMin - spread * 0.25, pHi = pMax + spread * 0.25;
  // asse rovesciato: più veloce = più in alto, come sul Garmin
  const Y1 = (p: number) => M.t + ((p - pLo) / (pHi - pLo)) * H1;
  const eMin = Math.min(...course.elev), eMax = Math.max(...course.elev);
  const eSpan = Math.max(10, eMax - eMin);
  const Y2 = (e: number) => top2 + (1 - (e - (eMin - eSpan * 0.1)) / (eSpan * 1.2)) * H2;
  const Y3 = (t: number) => top3 + (1 - Math.max(0, Math.min(1, t))) * H3;

  const pTicks = niceTicks(pLo, pHi, narrow ? 4 : 5, [2, 5, 10, 15, 20, 30, 60]);
  const xTicks = niceTicks(0, D, narrow ? 5 : 11, [0.5, 1, 2, 2.5, 5]);

  const active = hover ?? selected;
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const km = (((e.clientX - r.left) / r.width) * W - M.l) / (W - M.l - M.r) * D;
    if (km < 0 || km > D) { setHover(null); return; }
    const i = splits.findIndex((s) => km >= s.km0 - 1e-9 && km <= s.km1 + 1e-9);
    setHover(i >= 0 ? i : null);
  };

  // la quota: un'area, e i metri scritti agli estremi
  let cum = 0;
  const elevKm = course.elev.map((_, i) => (i === 0 ? 0 : (cum += course.seg[i - 1])));
  const elevD = hasElev
    ? pathOf([[X(0), top2 + H2], ...course.elev.map((e, i): [number, number] => [X(elevKm[i]), Y2(e)]), [X(D), top2 + H2]]) + "Z"
    : "";

  // il serbatoio del piano, split per split (partendo da pieno)
  const tankPts: [number, number][] = [[X(0), Y3(1)], ...splits.map((s): [number, number] => [X(s.km1), Y3(s.tankLeft)])];
  const badPts: [number, number][] = badTrace.map((p) => [X(p.km), Y3(p.tank)]);
  const sp = active != null ? splits[active] : null;

  return (
    <div ref={wrapRef} className="w-full">
      <div className="min-h-[34px] mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
        {sp ? (
          <>
            <span className="font-black text-white tabular-nums" style={{ fontFamily: MONO }}>
              km {fmtKm(sp.km0, sp.km0 % 1 ? 1 : 0)}–{fmtKm(sp.km1, sp.km1 % 1 ? 1 : 0)}
            </span>
            <span><b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtPace(sp.paceSec)}</b>/km</span>
            {hasElev && (
              <span className="tabular-nums" style={{ fontFamily: MONO }}>
                {sp.up >= 0.5 && <>↑{Math.round(sp.up)} m </>}{sp.down >= 0.5 && <>↓{Math.round(sp.down)} m </>}
                <span className="text-gray-500">({(sp.grade * 100).toFixed(1).replace(".", ",")}%)</span>
              </span>
            )}
            <span>serbatoio <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{Math.max(0, Math.round(sp.tankLeft * 100))}%</b></span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              più lento
              <span className="inline-flex h-2 w-16 rounded-full overflow-hidden">
                {[...PACE_BINS].reverse().map((b) => <span key={b.color} className="flex-1" style={{ background: b.color }} />)}
              </span>
              più veloce
            </span>
            <span className="inline-flex items-center gap-1.5"><LineKey color={LIT} dashed width={1.8} />passo medio</span>
            <span className="inline-flex items-center gap-1.5"><LineKey color={LIT} />serbatoio del piano</span>
            <span className="inline-flex items-center gap-1.5"><LineKey color={RISK} dashed width={2} />giornata storta</span>
          </>
        )}
      </div>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" className="block touch-pan-y select-none cursor-crosshair"
        aria-label="Passo per frazione, quota e serbatoio lungo il percorso"
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => { onMove(e); }}
        onClick={() => onSelect(hover)}>
        <defs>
          <linearGradient id={`${uid}e`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9CA3AF" stopOpacity="0.35" />
            <stop offset="1" stopColor="#9CA3AF" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* ── il passo ── */}
        <text x={M.l} y={M.t - 6} fontSize="9.5" fontWeight="800" fill="#8A8A8A" letterSpacing="0.14em">PASSO AL KM</text>
        {pTicks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={Y1(t)} y2={Y1(t)} stroke="#1E1E1E" />
            <text x={M.l - 7} y={Y1(t) + 3.5} textAnchor="end" fontSize="10" fill="#8A8A8A" fontFamily={MONO}>{fmtPace(t)}</text>
          </g>
        ))}
        {active != null && sp && (
          <rect x={X(sp.km0)} y={M.t} width={Math.max(1, X(sp.km1) - X(sp.km0))} height={H1} fill="#fff" fillOpacity="0.05" />
        )}
        <line x1={M.l} x2={W - M.r} y1={Y1(avgPace)} y2={Y1(avgPace)} stroke={LIT} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="5 4" />
        {!narrow && (
          <text x={W - M.r} y={Y1(avgPace) - 5} textAnchor="end" fontSize="9.5" fontWeight="800" fill={LIT}>media {fmtPace(avgPace)}</text>
        )}
        {/* i raccordi verticali, poi i gradini colorati sopra */}
        {splits.slice(1).map((s, i) => (
          <line key={`v${i}`} x1={X(s.km0)} x2={X(s.km0)} y1={Y1(splits[i].paceSec)} y2={Y1(s.paceSec)} stroke="#4B5563" strokeWidth="1.5" />
        ))}
        {splits.map((s, i) => (
          <line key={i} x1={X(s.km0) + 1} x2={X(s.km1) - 1} y1={Y1(s.paceSec)} y2={Y1(s.paceSec)}
            stroke={paceColor((s.paceSec - avgPace) / avgPace)} strokeWidth={active === i ? 4 : 3} strokeLinecap="round" />
        ))}
        {splits.map((s, i) => s.locked && (
          <circle key={`l${i}`} cx={(X(s.km0) + X(s.km1)) / 2} cy={Y1(s.paceSec) - 8} r="2.5" fill="#fff" />
        ))}

        {/* ── la quota ── */}
        {hasElev && (
          <g>
            <text x={M.l} y={top2 - 8} fontSize="9.5" fontWeight="800" fill="#8A8A8A" letterSpacing="0.14em">QUOTA</text>
            <path d={elevD} fill={`url(#${uid}e)`} stroke="#9CA3AF" strokeWidth="1.2" strokeOpacity="0.8" />
            <text x={M.l - 7} y={Y2(eMax) + 3.5} textAnchor="end" fontSize="10" fill="#8A8A8A" fontFamily={MONO}>{Math.round(eMax)} m</text>
            <text x={M.l - 7} y={Y2(eMin) + 3.5} textAnchor="end" fontSize="10" fill="#8A8A8A" fontFamily={MONO}>{Math.round(eMin)} m</text>
            {active != null && sp && (
              <rect x={X(sp.km0)} y={top2} width={Math.max(1, X(sp.km1) - X(sp.km0))} height={H2} fill="#fff" fillOpacity="0.05" />
            )}
          </g>
        )}

        {/* ── il serbatoio ── */}
        <text x={M.l} y={top3 - 8} fontSize="9.5" fontWeight="800" fill="#8A8A8A" letterSpacing="0.14em">SERBATOIO</text>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={Y3(t)} y2={Y3(t)} stroke={t === 0 ? "#3A3A3A" : "#1E1E1E"} />
            <text x={M.l - 7} y={Y3(t) + 3.5} textAnchor="end" fontSize="10" fill="#8A8A8A" fontFamily={MONO}>{Math.round(t * 100)}%</text>
          </g>
        ))}
        <path d={pathOf(badPts)} fill="none" stroke={RISK} strokeWidth="2" strokeDasharray="5 4" />
        {badWallKm != null && (() => {
          const x = X(badWallKm), y = Y3(0);
          return (
            <g>
              <path d={`M${x - 4.5},${y - 4.5}L${x + 4.5},${y + 4.5}M${x + 4.5},${y - 4.5}L${x - 4.5},${y + 4.5}`} stroke={RISK} strokeWidth="2.5" strokeLinecap="round" />
              <text x={x + (x > W - 120 ? -8 : 8)} y={y - 7} textAnchor={x > W - 120 ? "end" : "start"} fontSize="9.5" fontWeight="900" fill={RISK}>
                muro km {fmtKm(badWallKm)}
              </text>
            </g>
          );
        })()}
        <path d={pathOf(tankPts)} fill="none" stroke={LIT} strokeWidth="2.5" strokeLinejoin="round" />
        {active != null && sp && (
          <circle cx={X(sp.km1)} cy={Y3(sp.tankLeft)} r="4" fill={LIT} stroke={SURFACE} strokeWidth="2" />
        )}

        {xTicks.map((t) => (
          <text key={t} x={X(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8A8A8A" fontFamily={MONO}>{fmtKm(t, t % 1 ? 1 : 0)}</text>
        ))}
      </svg>
    </div>
  );
}
