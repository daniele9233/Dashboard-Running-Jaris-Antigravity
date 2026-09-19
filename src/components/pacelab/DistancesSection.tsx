import { useMemo, useState } from "react";
import { fmtClock, fmtPace } from "../gamification/gamiCore";
import { START_FRACTION, distanceMatrix, fmtDelta, fmtKm, type DistanceId } from "./paceEngine";
import type { PaceCtx } from "./PaceLabView";
import { Card, LIT, LOAD, MONO, RISK, SectionHead, Segmented } from "./ui";

/**
 * 03 · TUTTE LE DISTANZE
 * ════════════════════════════════════════════════════════════════════════════
 * Lo stesso motore, cinque gare. Un secondo al km vale 3″ sui 3 km e 21″ sulla
 * mezza, ma sul serbatoio il conto è un altro: pesa di più dove la gara dura
 * il tempo in cui la curva di Daniels è più ripida. La tabella lo mette in fila
 * per trovare la distanza che perdona meno.
 */

const RACE_OFFSETS = [-5, -3, -2, -1, 0, 1, 2, 3, 5];
const START_OFFSETS = [-15, -10, -8, -5, -3];

export function DistancesSection({ ctx, onPickDistance }: { ctx: PaceCtx; onPickDistance: (id: DistanceId) => void }) {
  const [mode, setMode] = useState<"race" | "start">("race");
  const offsets = mode === "race" ? RACE_OFFSETS : START_OFFSETS;
  const rows = useMemo(() => distanceMatrix(ctx.vdot, offsets, mode), [ctx.vdot, offsets, mode]);
  const maxSens = Math.max(...rows.map((r) => r.tankPerSec));
  const worst = rows.reduce((a, r) => (r.tankPerSec > a.tankPerSec ? r : a), rows[0]);
  const mild = rows.reduce((a, r) => (r.tankPerSec < a.tankPerSec ? r : a), rows[0]);
  const startPrices = mode === "start" ? rows.map((r) => r.cells.find((c) => c.offsetSec === -5)!.priceSec!) : [];

  return (
    <Card id="distanze" className="pl-rise overflow-hidden">
      <SectionHead n="03" title="Tutte le distanze" question="Dove un secondo pesa di più?"
        right={
          <Segmented size="sm" ariaLabel="Cosa confrontare" value={mode} onChange={setMode}
            options={[
              { value: "race", label: "Tutta la gara" },
              { value: "start", label: "Solo la partenza" },
            ]} />
        } />

      <div className="px-5 pb-5 grid grid-cols-1 gap-4">
        <p className="text-[14px] md:text-[16px] font-black leading-snug text-gray-200 max-w-5xl">
          {mode === "race" ? (
            <>Al tuo livello (VDOT {ctx.vdot.toFixed(1).replace(".", ",")}) la gara che perdona meno è quella{" "}
              <span style={{ color: RISK }}>{worst.dist.on}</span>: un secondo
              al km costa il <span style={{ color: RISK }}>{(worst.tankPerSec * 100).toFixed(1).replace(".", ",")}%</span> del serbatoio, contro il{" "}
              {(mild.tankPerSec * 100).toFixed(1).replace(".", ",")}% {mild.dist.on}. Ogni casella: dove finisce il serbatoio se corri tutta la gara a quel passo,
              o quanti secondi lasci sul tavolo se vai più piano.</>
          ) : (
            <>Il primo quinto della gara più veloce del tuo passo, poi si torna al passo giusto. Il numero grande è il prezzo
              all'arrivo se correggi subito; sotto, il km del muro se invece tieni il passo come se niente fosse. A −5″/km il conto
              va da <span style={{ color: LOAD }}>{fmtDelta(Math.min(...startPrices))}</span> a{" "}
              <span style={{ color: LOAD }}>{fmtDelta(Math.max(...startPrices))}</span>: poco, se correggi. Il muro è un'altra storia.</>
          )}
        </p>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[860px] border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th className="text-left text-[9px] font-black tracking-[0.18em] uppercase text-gray-500 pb-1">Distanza · il tuo limite</th>
                {offsets.map((o) => (
                  <th key={o} className="text-[11px] font-black tabular-nums pb-1" style={{ fontFamily: MONO, color: o < 0 ? "#FDA4AF" : o > 0 ? "#FCD34D" : "#fff" }}>
                    {o === 0 ? "limite" : `${o > 0 ? "+" : "−"}${Math.abs(o)}″`}
                  </th>
                ))}
                {mode === "race" && (
                  <th className="text-left text-[9px] font-black tracking-[0.18em] uppercase text-gray-500 pb-1 pl-2">1″/km nel serbatoio</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cur = r.dist.id === ctx.distId;
                return (
                  <tr key={r.dist.id}>
                    <td className="pr-2">
                      <button type="button" onClick={() => onPickDistance(r.dist.id)}
                        className="w-full text-left rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/[0.05]"
                        style={{ boxShadow: cur ? `inset 3px 0 0 ${LIT}` : undefined, background: cur ? "rgba(192,255,0,0.06)" : undefined }}
                        title={`Porta tutta la pagina ${r.dist.on}`}>
                        <span className="block text-[13px] font-black text-white">{r.dist.label}
                          {mode === "start" && <span className="ml-1.5 text-[10px] font-normal text-gray-500">primi {fmtKm(r.dist.km * START_FRACTION)} km</span>}
                        </span>
                        <span className="block text-[10.5px] tabular-nums text-gray-500" style={{ fontFamily: MONO }}>
                          {fmtPace(r.limitPace)}/km · {fmtClock(r.limitSec)}
                        </span>
                      </button>
                    </td>
                    {r.cells.map((c) => {
                      if (mode === "race") {
                        if (c.offsetSec === 0) {
                          return (
                            <td key={c.offsetSec} className="rounded-lg text-center px-1 py-1.5 bg-white/[0.06]">
                              <span className="block text-[12px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{fmtPace(r.limitPace)}</span>
                              <span className="block text-[9px] text-gray-500">vuoto all'arrivo</span>
                            </td>
                          );
                        }
                        if (c.wallKm != null) {
                          const early = 1 - c.wallKm / r.dist.km;
                          return (
                            <td key={c.offsetSec} className="rounded-lg text-center px-1 py-1.5"
                              style={{ background: `rgba(244,63,94,${0.1 + Math.min(1, early / 0.35) * 0.45})` }}
                              title={`${fmtPace(r.limitPace + c.offsetSec)}/km per tutta la gara: serbatoio vuoto al km ${fmtKm(c.wallKm)}`}>
                              <span className="block text-[12px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>km {fmtKm(c.wallKm)}</span>
                              <span className="block text-[9px] tabular-nums text-white/60" style={{ fontFamily: MONO }}>{fmtPace(r.limitPace + c.offsetSec)}</span>
                            </td>
                          );
                        }
                        return (
                          <td key={c.offsetSec} className="rounded-lg text-center px-1 py-1.5" style={{ background: `rgba(245,158,11,${0.06 + Math.min(1, c.tankEnd / 0.3) * 0.22})` }}
                            title={`${fmtPace(r.limitPace + c.offsetSec)}/km: avanza il ${Math.round(c.tankEnd * 100)}% del serbatoio`}>
                            <span className="block text-[12px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>+{Math.round(c.leftSec)}″</span>
                            <span className="block text-[9px] tabular-nums text-white/55" style={{ fontFamily: MONO }}>avanza {Math.round(c.tankEnd * 100)}%</span>
                          </td>
                        );
                      }
                      const a = Math.min(1, Math.max(0, c.priceSec!) / 60);
                      return (
                        <td key={c.offsetSec} className="rounded-lg text-center px-1 py-1.5" style={{ background: `rgba(245,158,11,${0.07 + a * 0.5})` }}
                          title={`Primi ${fmtKm(r.dist.km * START_FRACTION)} km a ${fmtPace(r.limitPace + c.offsetSec)}`}>
                          <span className="block text-[12px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{fmtDelta(c.priceSec!)}</span>
                          <span className="block text-[9px] tabular-nums" style={{ fontFamily: MONO, color: c.wallKm != null ? "#FDA4AF" : "#86EFAC" }}>
                            {c.wallKm != null ? `muro ${fmtKm(c.wallKm)}` : "regge"}
                          </span>
                        </td>
                      );
                    })}
                    {mode === "race" && (
                      <td className="pl-2 min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <div className="h-[7px] flex-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(r.tankPerSec / maxSens) * 100}%`, background: r === worst ? RISK : "#9CA3AF" }} />
                          </div>
                          <span className="text-[11.5px] font-black tabular-nums w-11 text-right" style={{ fontFamily: MONO, color: r === worst ? "#FDA4AF" : "#D1D5DB" }}>
                            {(r.tankPerSec * 100).toFixed(1).replace(".", ",")}%
                          </span>
                        </div>
                        <span className="block text-[9.5px] text-gray-600 mt-0.5">{Math.round(r.dist.km)}″ sul cronometro</span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[10.5px] text-gray-600 leading-relaxed max-w-5xl">
          Le altre distanze sono al tuo stesso livello: il passo limite di ognuna è quello che il tuo VDOT regge fino in fondo.
          {ctx.levelMode === "target" && <> Il livello viene dall'obiettivo che hai scritto {ctx.distOn}.</>}
          {" "}Tocca una distanza per portarci tutta la pagina.
        </p>
      </div>
    </Card>
  );
}
