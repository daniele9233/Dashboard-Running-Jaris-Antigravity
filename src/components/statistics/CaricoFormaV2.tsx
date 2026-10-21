import React, { useId, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, ReferenceLine } from "recharts";
import type { FitnessFreshnessPoint, Run, ProAnalyticsChart } from "../../types/api";
import { AREA_FILL, AnalyticsChartCard, CHART_SERIES, CHART_SHAPE, CHART_SURFACE, CHART_TEXT, CHART_TYPE, CHART_WORKOUT, CHART_ZONES, ChartCard, ChartEmptyState, ChartHeader, ChartInsight, ChartKpi, ChartKpiStrip, ChartLegend, ChartPlot, ChartRangeSelector, ChartStat, ChartStats, ChartTooltip, ChartTooltipContent, chartCursor, chartCursorBar, chartGrid, chartGridBoth, chartMargin, chartReferenceLine, chartTick, chartXAxis, chartYAxis, formatDelta, useElementSize } from "../charts";
// WeeklyKmChart non più usato qui — sostituito da CaricoKmChart inline

// ─── TYPES ───────────────────────────────────────────────────────────────────

type FFRange = "1m" | "3m" | "6m" | "1y" | "2y";
const FF_RANGE_DAYS: Record<FFRange, number> = { "1m": 30, "3m": 90, "6m": 182, "1y": 365, "2y": 730 };
const FF_RANGES = (Object.keys(FF_RANGE_DAYS) as FFRange[]).map((k) => ({ value: k, label: k.toUpperCase() }));

export interface CaricoFormaV2Props {
  ffHistory: FitnessFreshnessPoint[];
  kmRuns: Run[];
  paceDistributionChart?: ProAnalyticsChart;
  effortMatrixChart?: ProAnalyticsChart;
}

// ─── MAIN MULTI-LINE SVG CHART ────────────────────────────────────────────────

const CHART_LINES = [
  { key: "ctl" as const, label: "Condizione fisica", short: "Condizione", color: CHART_SERIES.load },
  { key: "atl" as const, label: "Affaticamento",     short: "Affatica.",  color: CHART_SERIES.risk },
  { key: "tsb" as const, label: "Forma",             short: "Forma",      color: CHART_SERIES.positive },
] as const;

/**
 * Le fasce di forma (TSB) secondo Coggan. Servono a dare un nome al numero:
 * −6 da solo non dice niente, "zona di lavoro produttivo" sì.
 */
const TSB_ZONES = [
  { min: 25, label: "scarico", color: CHART_SERIES.compare },
  { min: 5, label: "fresco", color: CHART_SERIES.positive },
  { min: -10, label: "equilibrio", color: CHART_SERIES.primary },
  { min: -30, label: "carico produttivo", color: CHART_SERIES.load },
  { min: -Infinity, label: "rischio", color: CHART_SERIES.risk },
];
const tsbZone = (v: number) => TSB_ZONES.find((z) => v >= z.min) ?? TSB_ZONES[TSB_ZONES.length - 1];

/** La fascia è la forma stessa: deve leggersi come una forma, non come un velo di contesto. */
const RIBBON_OPACITY = 0.34;

const fmtLongDate = (s: string) => new Date(s).toLocaleDateString("it", { day: "numeric", month: "short", year: "numeric" });

function FitnessMultiChart({ ff }: { ff: FitnessFreshnessPoint[] }) {
  const [range, setRange] = useState<FFRange>("3m");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [focus, setFocus] = useState<"all" | "ctl" | "atl" | "tsb">("all");
  // Le misure vere del contenitore: il disegno si ricalcola, il testo resta a 12 px reali.
  const [plotRef, { width: W, height: H }] = useElementSize<HTMLDivElement>({ width: 900, height: 320 });
  // id univoci: la card può montare più volte (clipPath/gradienti condividono lo spazio dei nomi del documento)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = { under: `${uid}-under`, over: `${uid}-over`, spine: `${uid}-spine` };

  const data = useMemo(() => {
    if (!ff?.length) return [] as FitnessFreshnessPoint[];
    const cutoff = Date.now() - FF_RANGE_DAYS[range] * 86400000;
    return ff
      .filter(p => new Date(p.date).getTime() >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [ff, range]);

  /*
   * IL FIUME.
   *
   * Tre curve sovrapposte erano tre cose da leggere e nessuna da capire. Qui
   * la curva è UNA — la condizione — e l'affaticamento è il suo argine: la
   * fascia fra le due È la forma, perché forma = condizione − affaticamento.
   *
   *   fascia VERDE  → l'affaticamento sta sotto la condizione: stai assorbendo
   *   fascia ROSSA  → l'affaticamento sta sopra: stai scavando nel serbatoio
   *   spessore      → quanto, in punti di forma
   *
   * Niente linea tratteggiata da inseguire: il colore e lo spessore dicono
   * tutto a colpo d'occhio, e il numero esatto lo dà il cursore.
   */
  const narrow = W < 520;
  const padL = narrow ? 36 : 44, padR = narrow ? 48 : 62, padT = 16, padB = 28;
  const plotW = Math.max(40, W - padL - padR);
  const plotH = Math.max(40, H - padT - padB);
  const top = padT, bot = padT + plotH;

  const maxLoad = useMemo(() => {
    if (!data.length) return 60;
    const mx = Math.max(...data.flatMap(d => [d.ctl, d.atl]));
    return Math.max(20, Math.ceil((mx * 1.12) / 10) * 10);
  }, [data]);

  const geo = useMemo(() => {
    const x = (i: number) => padL + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    /** Il carico parte da zero: non esiste un carico negativo. */
    const y = (v: number) => bot - (v / (maxLoad || 1)) * plotH;
    const path = (key: "ctl" | "atl", reverse = false) => {
      const pts = reverse ? [...data].reverse() : data;
      const idx = (i: number) => (reverse ? data.length - 1 - i : i);
      return pts.map((d, i) => `${i === 0 && !reverse ? "M" : "L"} ${x(idx(i)).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");
    };
    const ctlPath = path("ctl");
    const lastX = x(data.length - 1).toFixed(1);
    return {
      x,
      y,
      ctlPath,
      atlPath: path("atl"),
      /** La fascia: condizione all'andata, affaticamento al ritorno. */
      ribbon: data.length ? `${ctlPath} ${path("atl", true)} Z` : "",
      /** Sotto la condizione = fascia verde · sopra = fascia rossa. Due ritagli. */
      clipUnder: data.length ? `${ctlPath} L ${lastX} ${bot} L ${padL} ${bot} Z` : "",
      clipOver: data.length ? `${ctlPath} L ${lastX} ${top} L ${padL} ${top} Z` : "",
    };
  }, [data, maxLoad, padL, plotW, plotH, bot, top]);
  const { x, y } = geo;

  const loadTicks = useMemo(() => {
    const step = Math.max(10, Math.ceil(maxLoad / 4 / 10) * 10);
    const arr: number[] = [];
    for (let v = step; v <= maxLoad; v += step) arr.push(v);
    return arr;
  }, [maxLoad]);

  const xLabels = useMemo(() => {
    if (data.length < 2) return [] as { i: number; label: string }[];
    const want = narrow ? 3 : 6;
    const step = Math.max(1, Math.floor(data.length / want));
    const out: { i: number; label: string }[] = [];
    const fmt = (s: string) =>
      new Date(s).toLocaleDateString("it", { month: "short", day: "numeric" }).replace(".", "");
    for (let i = 0; i < data.length; i += step) out.push({ i, label: fmt(data[i].date) });
    if (data.length && out[out.length - 1]?.i !== data.length - 1)
      out.push({ i: data.length - 1, label: "Oggi" });
    return out;
  }, [data, narrow]);

  const moveTo = (idx: number) => setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!data.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left - padL) / plotW;
    moveTo(Math.round(rel * (data.length - 1)));
  };
  /** Frecce, Home, Fine: lo stesso scorrimento del puntatore, da tastiera. */
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!data.length) return;
    const cur = hoverIdx ?? data.length - 1;
    if (e.key === "ArrowLeft") moveTo(cur - 1);
    else if (e.key === "ArrowRight") moveTo(cur + 1);
    else if (e.key === "Home") moveTo(0);
    else if (e.key === "End") moveTo(data.length - 1);
    else if (e.key === "Escape") setHoverIdx(null);
    else return;
    e.preventDefault();
  };

  const hov = hoverIdx !== null ? data[hoverIdx] ?? null : null;
  /** Punto letto dai numeri in alto: quello sotto al cursore, altrimenti oggi. */
  const shown = hov ?? (data.length ? data[data.length - 1] : null);
  const shownIdx = hoverIdx ?? (data.length - 1);
  const zone = shown ? tsbZone(shown.tsb) : null;
  const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;

  // Delta sui 7 giorni precedenti al punto mostrato: si aggiorna scorrendo.
  const kpi = useMemo(() => {
    if (!data.length || !shown) return null;
    const prev = data[Math.max(0, shownIdx - 7)];
    return CHART_LINES.map(l => ({
      ...l,
      current: shown[l.key],
      delta: shown[l.key] - prev[l.key],
    }));
  }, [data, shown, shownIdx]);

  const summary = shown && zone
    ? `${fmtLongDate(shown.date)}: condizione ${shown.ctl.toFixed(1)}, affaticamento ${shown.atl.toFixed(1)}, forma ${signed(shown.tsb)}, ${zone.label}.`
    : undefined;

  const last = data.length ? data[data.length - 1] : null;

  return (
    <ChartCard>
      <ChartHeader
        title="Condizione · Affaticamento · Forma"
        description={
          shown
            ? <>La fascia fra le due curve è la tua forma · <span style={{ color: zone?.color }}>{zone?.label}</span></>
            : "Andamento nel tempo"
        }
        actions={
          <ChartRangeSelector
            value={range}
            options={FF_RANGES}
            onChange={(r) => { setRange(r); setHoverIdx(null); }}
            aria-label="Intervallo del grafico condizione, affaticamento, forma"
          />
        }
      />

      {kpi && (
        <ChartKpiStrip>
          {kpi.map(k => {
            const d = formatDelta(k.delta);
            return (
              <ChartKpi
                key={k.key}
                label={k.label}
                value={`${k.key === "tsb" && k.current > 0 ? "+" : ""}${k.current.toFixed(1)}`}
                delta={d.text}
                trend={d.trend}
                color={k.color}
                active={focus === k.key}
                onClick={() => setFocus(focus === k.key ? "all" : k.key)}
              />
            );
          })}
        </ChartKpiStrip>
      )}

      <ChartPlot
        ref={plotRef}
        size="tall"
        label="Condizione, affaticamento e forma nel tempo"
        summary={summary}
      >
        {!data.length ? (
          <ChartEmptyState title="Nessun dato nel periodo selezionato" />
        ) : (
          <div
            tabIndex={0}
            role="application"
            aria-label="Scorri con le frecce sinistra e destra per leggere un giorno"
            onKeyDown={onKey}
            onFocus={() => { if (hoverIdx === null) setHoverIdx(data.length - 1); }}
            onBlur={() => setHoverIdx(null)}
            className="absolute inset-0 outline-none"
          >
            <svg
              width={W}
              height={H}
              className="block touch-none"
              style={{ cursor: "crosshair" }}
              onPointerMove={onMove}
              onPointerLeave={() => setHoverIdx(null)}
              aria-hidden="true"
            >
              <defs>
                <clipPath id={ids.under}><path d={geo.clipUnder} /></clipPath>
                <clipPath id={ids.over}><path d={geo.clipOver} /></clipPath>
                <linearGradient id={ids.spine} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_SERIES.load} stopOpacity={AREA_FILL.top} />
                  <stop offset="100%" stopColor={CHART_SERIES.load} stopOpacity={AREA_FILL.bottom} />
                </linearGradient>
              </defs>

              {/* griglia essenziale: solo orizzontali, dietro a tutto */}
              {loadTicks.map(v => (
                <g key={v}>
                  <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={chartGrid.stroke} strokeDasharray={chartGrid.strokeDasharray} strokeWidth={1} />
                  <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={chartTick.fontSize} fill={chartTick.fill} fontFamily={chartTick.fontFamily}>{v}</text>
                </g>
              ))}
              <line x1={padL} x2={W - padR} y1={bot} y2={bot} stroke={CHART_SURFACE.borderStrong} strokeWidth={1} />

              {/* velo sotto la condizione: dà corpo al fiume senza sporcare */}
              <path d={geo.clipUnder} fill={`url(#${ids.spine})`} />

              {/* LA FASCIA — verde dove assorbi, rossa dove scavi */}
              {(focus === "all" || focus === "tsb") && (
                <>
                  <g clipPath={`url(#${ids.under})`}>
                    <path d={geo.ribbon} fill={CHART_SERIES.positive} fillOpacity={RIBBON_OPACITY} />
                  </g>
                  <g clipPath={`url(#${ids.over})`}>
                    <path d={geo.ribbon} fill={CHART_SERIES.risk} fillOpacity={RIBBON_OPACITY} />
                  </g>
                </>
              )}

              {/* argine: l'affaticamento è un bordo, non una seconda curva urlata */}
              {(focus === "all" || focus === "atl") && (
                <path d={geo.atlPath} fill="none" stroke={CHART_SERIES.risk} strokeWidth={CHART_SHAPE.strokeWidthDerived}
                  strokeOpacity={0.85} strokeLinejoin="round" strokeLinecap="round" />
              )}

              {/* la spina dorsale: la condizione */}
              {(focus === "all" || focus === "ctl") && (
                <path d={geo.ctlPath} fill="none" stroke={CHART_SERIES.load} strokeWidth={CHART_SHAPE.strokeWidth}
                  strokeLinejoin="round" strokeLinecap="round" />
              )}

              {/* oggi: pallino + valore fuori dal riquadro, sempre leggibile */}
              {last && (
                <g pointerEvents="none">
                  <circle cx={x(data.length - 1)} cy={y(last.ctl)} r={CHART_SHAPE.activeDotRadius}
                    fill={CHART_SURFACE.panel} stroke={CHART_SERIES.load} strokeWidth={2.5} />
                  <text x={W - padR + 8} y={y(last.ctl) + 4} fontSize={13} fontWeight="700"
                    fill={CHART_SERIES.load} fontFamily={CHART_TYPE.mono}>
                    {last.ctl.toFixed(0)}
                  </text>
                </g>
              )}

              {/* asse dei tempi */}
              {xLabels.map((lbl, k) => (
                <text key={k} x={x(lbl.i)} y={H - 8}
                  textAnchor={k === 0 ? "start" : lbl.i === data.length - 1 ? "end" : "middle"}
                  fontSize={chartTick.fontSize} fill={chartTick.fill} fontFamily={chartTick.fontFamily}>
                  {lbl.label}
                </text>
              ))}

              {/* cursore: la fascia del giorno si accende */}
              {hov && hoverIdx !== null && (
                <g pointerEvents="none">
                  <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={y(Math.max(hov.ctl, hov.atl))} y2={bot}
                    stroke={chartCursor.stroke} strokeWidth={chartCursor.strokeWidth} />
                  <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={y(hov.ctl)} y2={y(hov.atl)}
                    stroke={hov.tsb >= 0 ? CHART_SERIES.positive : CHART_SERIES.risk} strokeWidth={3} strokeOpacity={0.9} />
                  <circle cx={x(hoverIdx)} cy={y(hov.atl)} r={4} fill={CHART_SURFACE.panel} stroke={CHART_SERIES.risk} strokeWidth={2} />
                  <circle cx={x(hoverIdx)} cy={y(hov.ctl)} r={CHART_SHAPE.activeDotRadius} fill={CHART_SURFACE.panel} stroke={CHART_SERIES.load} strokeWidth={2.5} />
                </g>
              )}
            </svg>

            {/* Targhetta: si sposta a sinistra se il cursore è nella metà destra */}
            {hov && hoverIdx !== null && (
              <div
                className="absolute top-2"
                style={hoverIdx > data.length / 2 ? { left: padL + 8 } : { right: padR + 8 }}
              >
                <ChartTooltip
                  title={<>{fmtLongDate(hov.date)} · <span style={{ color: zone?.color }}>{zone?.label}</span></>}
                  rows={CHART_LINES.map(l => ({
                    label: l.short,
                    value: `${l.key === "tsb" && hov.tsb > 0 ? "+" : ""}${hov[l.key].toFixed(1)}`,
                    color: l.color,
                  }))}
                />
              </div>
            )}
          </div>
        )}
      </ChartPlot>

      {/* Come si legge: senza questa riga il verde e il rosso restano decorazione */}
      <ChartLegend
        items={[
          { key: "under", label: "affaticamento sotto la condizione — stai assorbendo", color: CHART_SERIES.positive, kind: "band" },
          { key: "over", label: "affaticamento sopra — stai scavando nel serbatoio", color: CHART_SERIES.risk, kind: "band" },
          { key: "ctl", label: "condizione fisica", color: CHART_SERIES.load, kind: "line" },
        ]}
      />
      <ChartInsight>Scorri sul grafico, o usa le frecce ← →, per leggere un giorno.</ChartInsight>
    </ChartCard>
  );
}

// ─── PACE ZONES BARS ─────────────────────────────────────────────────────────

type ZoneRange = "7d" | "30d" | "90d" | "all";

const ZONE_BINS = [
  { zone: "Z1", name: "Recupero",  minSec: 390, color: CHART_ZONES[0] },
  { zone: "Z2", name: "Easy",      minSec: 360, color: CHART_ZONES[1] },
  { zone: "Z3", name: "Steady",    minSec: 330, color: CHART_ZONES[2] },
  { zone: "Z4", name: "Threshold", minSec: 300, color: CHART_ZONES[3] },
  { zone: "Z5", name: "Fast",      minSec:   0, color: CHART_ZONES[4] },
] as const;

const RANGE_DAYS: Record<ZoneRange, number | null> = { "7d": 7, "30d": 30, "90d": 90, "all": null };
const RANGE_OPTIONS = (Object.keys(RANGE_DAYS) as ZoneRange[]).map((k) => ({ value: k, label: k.toUpperCase() }));

function parsePaceSec(pace?: string | null): number | null {
  if (!pace) return null;
  const parts = String(pace).trim().split(":").map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return parts[0] * 60 + parts[1];
}

function PaceZonesCard({ runs }: { runs: Run[] }) {
  const [range, setRange] = useState<ZoneRange>("90d");

  const { zones, totalKm } = useMemo(() => {
    const days = RANGE_DAYS[range];
    const cutoff = days ? Date.now() - days * 86400000 : null;
    const filtered = runs.filter(r =>
      cutoff ? new Date(`${r.date.slice(0, 10)}T00:00:00`).getTime() >= cutoff : true
    );
    const bins = ZONE_BINS.map(b => ({ ...b, km: 0 }));
    for (const run of filtered) {
      const paceSec = parsePaceSec(run.avg_pace);
      if (!paceSec) continue;
      const bin = bins.find(b => paceSec >= b.minSec);
      if (bin) bin.km += run.distance_km;
    }
    const total = bins.reduce((s, b) => s + b.km, 0);
    return {
      zones: bins.map(b => ({ ...b, km: +b.km.toFixed(1), pct: total ? (b.km / total) * 100 : 0 })),
      totalKm: +total.toFixed(1),
    };
  }, [runs, range]);

  const maxPct = Math.max(...zones.map(z => z.pct), 1);

  return (
    <AnalyticsChartCard
      className="h-full"
      title="Zone di Passo"
      description={`Distribuzione km · ${range === "all" ? "tutte le corse" : `ultimi ${range}`}`}
      actions={
        <>
          <span className="font-mono text-[14px] font-bold tabular-nums text-ea-text-muted">{totalKm} <span className="text-[12px] font-medium">km</span></span>
          <ChartRangeSelector<ZoneRange> value={range} options={RANGE_OPTIONS} onChange={setRange} aria-label="Intervallo delle zone di passo" />
        </>
      }
      size="auto"
      plotClassName="flex-1"
      status={totalKm ? "ready" : "empty"}
    >
      <ul className="m-0 flex h-full list-none flex-col justify-between gap-4 p-0" aria-label="Chilometri per zona di passo">
        {zones.map(z => (
          <li key={z.zone} className="grid grid-cols-[3.75rem_1fr_3.75rem_4.5rem] items-center gap-3 text-[12px] leading-4">
            <div className="min-w-0">
              <div className="font-mono font-bold" style={{ color: z.color }}>{z.zone}</div>
              <div className="truncate text-ea-text-muted">{z.name}</div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-ea-surface-2" aria-hidden="true">
              <div
                className="h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: `${(z.pct / maxPct) * 100}%`, background: z.color }}
              />
            </div>
            <div className="text-right font-mono text-[14px] font-bold tabular-nums text-ea-text">
              {z.pct.toFixed(1)}<span className="text-[12px] font-medium text-ea-text-muted">%</span>
            </div>
            <div className="text-right font-mono tabular-nums text-ea-text-muted">{z.km} km</div>
          </li>
        ))}
      </ul>
    </AnalyticsChartCard>
  );
}

// ─── PACE DISTRIBUTION CARD ──────────────────────────────────────────────────

function PaceDistributionCard({ chart }: { chart?: ProAnalyticsChart }) {
  const data = (chart?.series_card ?? []) as Array<{ pace: string; pace_sec: number; runs: number }>;
  const totalRuns = data.reduce((s, d) => s + Number(d.runs ?? 0), 0);
  const modal = data.reduce<typeof data[number] | null>(
    (best, d) => (!best || Number(d.runs ?? 0) > Number(best.runs ?? 0) ? d : best),
    null,
  );
  const fastestPace = data.find(d => Number(d.runs) > 0)?.pace ?? "—";
  const slowestPace = [...data].reverse().find(d => Number(d.runs) > 0)?.pace ?? "—";
  const maxRuns = Math.max(...data.map(d => Number(d.runs ?? 0)), 1);

  return (
    <AnalyticsChartCard
      title="Distribuzione del Passo"
      description={`Corse per zona · storico · ${totalRuns} corse`}
      size="standard"
      status={data.length ? "ready" : "empty"}
      plotLabel="Numero di corse per passo medio"
      summary={modal ? `Il passo più frequente è ${modal.pace} al chilometro, con ${modal.runs} corse.` : undefined}
      stats={
        <ChartStats>
          <ChartStat label="Passo modale" value={modal?.pace ?? "—"} color={CHART_SERIES.primary} />
          <ChartStat label="Più veloce" value={fastestPace} />
          <ChartStat label="Più lento" value={slowestPace} />
        </ChartStats>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={chartMargin} barCategoryGap="20%">
          <CartesianGrid {...chartGrid} />
          <XAxis {...chartXAxis} dataKey="pace" interval="preserveStartEnd" />
          <YAxis {...chartYAxis} width={32} />
          <Tooltip
            cursor={chartCursorBar}
            content={
              <ChartTooltipContent
                title={(l) => `Passo ${l} /km`}
                row={(e) => ({ label: "Frequenza", value: `${e.value} corse`, color: CHART_SERIES.primary })}
              />
            }
          />
          <Bar dataKey="runs" radius={CHART_SHAPE.barRadius}>
            {data.map((d, i) => {
              const isModal = modal && d.pace === modal.pace;
              const ratio = Number(d.runs) / maxRuns;
              // tre livelli: il passo modale (lime pieno), le zone frequenti (lime attenuato), il resto (neutro leggibile)
              return (
                <Cell
                  key={i}
                  fill={isModal || ratio > 0.4 ? CHART_SERIES.primary : CHART_TEXT.faint}
                  fillOpacity={isModal ? 1 : ratio > 0.4 ? 0.55 : 1}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}

// ─── EFFORT MATRIX CARD ──────────────────────────────────────────────────────

function EffortMatrixCard({ chart }: { chart?: ProAnalyticsChart }) {
  const data = (chart?.series_card ?? []) as Array<{ dist: number; pace: number; z?: number; hr?: number }>;

  const stats = useMemo(() => {
    if (!data.length) return { count: 0, avgDist: 0, avgPace: 0, avgHr: 0, maxDist: 0 };
    const valid = data.filter(d => Number.isFinite(d.dist) && Number.isFinite(d.pace));
    const sum = valid.reduce<{ dist: number; pace: number; hr: number; hrN: number }>(
      (acc, d) => ({
        dist: acc.dist + d.dist,
        pace: acc.pace + d.pace,
        hr: acc.hr + (Number.isFinite(d.hr) ? Number(d.hr) : 0),
        hrN: acc.hrN + (Number.isFinite(d.hr) ? 1 : 0),
      }),
      { dist: 0, pace: 0, hr: 0, hrN: 0 },
    );
    return {
      count: valid.length,
      avgDist: sum.dist / valid.length,
      avgPace: sum.pace / valid.length,
      avgHr: sum.hrN ? sum.hr / sum.hrN : 0,
      maxDist: Math.max(...valid.map(d => d.dist)),
    };
  }, [data]);

  const fmtPace = (p: number) => {
    if (!Number.isFinite(p) || p <= 0) return "—";
    const total = Math.round(p * 60);   // minuti decimali → totale sec: mai ":60"
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const xMax = Math.max(10, Math.ceil(stats.maxDist / 5) * 5);

  return (
    <AnalyticsChartCard
      title="Matrice degli Sforzi"
      description={`Distanza (km) × passo (min/km) · bolla = FC · ${stats.count} corse`}
      size="standard"
      status={data.length ? "ready" : "empty"}
      plotLabel="Distanza e passo di ogni corsa; la dimensione del punto indica la frequenza cardiaca"
      legend={
        <ChartLegend
          items={[
            { key: "run", label: "corsa (dimensione = FC)", color: CHART_SERIES.primary, kind: "dot" },
            { key: "avg", label: "passo medio", color: CHART_TEXT.axis, kind: "dashed" },
          ]}
        />
      }
      stats={
        <ChartStats>
          <ChartStat label="Distanza media" value={stats.count ? stats.avgDist.toFixed(1) : "—"} unit={stats.count ? "km" : undefined} color={CHART_SERIES.primary} />
          <ChartStat label="Passo medio" value={stats.count ? fmtPace(stats.avgPace) : "—"} unit={stats.count ? "/km" : undefined} />
          <ChartStat label="FC media" value={stats.avgHr ? Math.round(stats.avgHr) : "—"} unit={stats.avgHr ? "bpm" : undefined} />
        </ChartStats>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={chartMargin}>
          <CartesianGrid {...chartGridBoth} />
          <XAxis {...chartXAxis} type="number" dataKey="dist" domain={[0, xMax]} />
          <YAxis {...chartYAxis} type="number" dataKey="pace" domain={[3.5, 6.8]} reversed={false} width={44} tickFormatter={(v: number) => fmtPace(v)} />
          <ZAxis type="number" dataKey="hr" range={[40, 240]} />
          <ReferenceLine y={stats.avgPace || 4.8} {...chartReferenceLine} />
          <Tooltip
            cursor={{ ...chartCursor, strokeDasharray: "3 3" }}
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <ChartTooltip
                  rows={[
                    { label: "Distanza", value: `${d.dist.toFixed(1)} km`, color: CHART_SERIES.primary },
                    { label: "Passo", value: `${fmtPace(d.pace)} /km` },
                    ...(Number.isFinite(d.hr) && d.hr > 0 ? [{ label: "FC", value: `${Math.round(d.hr)} bpm` }] : []),
                  ]}
                />
              );
            }}
          />
          <Scatter data={data} fill={CHART_SERIES.primary} fillOpacity={CHART_SHAPE.scatterOpacity} />
        </ScatterChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}

// ─── CARICO KM CHART (stacked, solo CaricoFormaV2) ───────────────────────────

function getRunCategory(runType: string): "easy" | "tempo" | "intervals" | "long" | "race" {
  const t = (runType || "").toLowerCase();
  if (t.includes("race") || t.includes("gara") || t.includes("compet")) return "race";
  if (t.includes("long") || t.includes("lun") || t.includes("fondo lungo")) return "long";
  if (t.includes("interval") || t.includes("speed") || t.includes("fartlek") || t.includes("ripetute")) return "intervals";
  if (t.includes("tempo") || t.includes("threshold") || t.includes("soglia")) return "tempo";
  return "easy";
}

const CAT_DEFS = [
  { key: "easy",      label: "Easy Run",  color: CHART_WORKOUT.easy },
  { key: "tempo",     label: "Tempo",     color: CHART_WORKOUT.tempo },
  { key: "intervals", label: "Intervals", color: CHART_WORKOUT.intervals },
  { key: "long",      label: "Long Run",  color: CHART_WORKOUT.long },
  { key: "race",      label: "Race",      color: CHART_WORKOUT.race },
] as const;

function buildKmEntry(label: string, dayRuns: Run[]): Record<string, number | string> {
  const e: Record<string, number | string> = { day: label, easy: 0, tempo: 0, intervals: 0, long: 0, race: 0 };
  for (const r of dayRuns) {
    const cat = getRunCategory(r.run_type ?? "");
    (e[cat] as number) += r.distance_km;
  }
  for (const c of CAT_DEFS) e[c.key] = Math.round((e[c.key] as number) * 10) / 10;
  return e;
}

type KmPeriod = "7d" | "30d" | "90d" | "all";
const KM_RANGE_DAYS: Record<KmPeriod, number | null> = { "7d": 7, "30d": 30, "90d": 90, "all": null };
const KM_RANGES = (Object.keys(KM_RANGE_DAYS) as KmPeriod[]).map((k) => ({ value: k, label: k.toUpperCase() }));

function CaricoKmChart({ runs }: { runs: Run[] }) {
  const [period, setPeriod] = useState<KmPeriod>("90d");

  const chartData = useMemo(() => {
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    // Settimane di CALENDARIO lun→dom: lunedì della settimana di `now`.
    const mondayOf = (ref: Date) => {
      const dow = ref.getDay();
      const m = new Date(ref);
      m.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1));
      m.setHours(0, 0, 0, 0);
      return m;
    };
    // Domenica (fine) della settimana corrente — ancora per i bucket settimanali.
    const weekAnchorSunday = new Date(mondayOf(now));
    weekAnchorSunday.setDate(weekAnchorSunday.getDate() + 6);
    weekAnchorSunday.setHours(23, 59, 59, 999);

    if (period === "7d") {
      // Per 7d: la settimana corrente lun→dom (7 barre giornaliere)
      const monday = mondayOf(now);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const label = d.toLocaleDateString("it", { weekday: "short" }).slice(0, 3).toUpperCase();
        return buildKmEntry(label, runs.filter(r => r.date.slice(0, 10) === toLocal(d)));
      });
    } else if (period === "30d") {
      // Per 30d: barre settimanali (ultimi 30 giorni → ~4-5 settimane)
      const weeks = 5;
      return Array.from({ length: weeks }, (_, i) => {
        const weekEnd = new Date(weekAnchorSunday);
        weekEnd.setDate(weekAnchorSunday.getDate() - (weeks - 1 - i) * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        const label = weekStart.toLocaleDateString("it", { day: "numeric", month: "short" }).toUpperCase();
        return buildKmEntry(label, runs.filter(r => {
          const t = new Date(r.date).getTime();
          return t >= weekStart.getTime() && t <= weekEnd.getTime();
        }));
      });
    } else if (period === "90d") {
      // Per 90d: barre settimanali (13 settimane)
      const weeks = 13;
      return Array.from({ length: weeks }, (_, i) => {
        const weekEnd = new Date(weekAnchorSunday);
        weekEnd.setDate(weekAnchorSunday.getDate() - (weeks - 1 - i) * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        const label = weekStart.toLocaleDateString("it", { day: "numeric", month: "short" }).toUpperCase();
        return buildKmEntry(label, runs.filter(r => {
          const t = new Date(r.date).getTime();
          return t >= weekStart.getTime() && t <= weekEnd.getTime();
        }));
      });
    } else {
      // ALL: barre mensili da prima corsa a oggi
      const sorted = [...runs].sort((a, b) => a.date.localeCompare(b.date));
      if (!sorted.length) return [];
      const first = new Date(sorted[0].date);
      const months: Array<{ year: number; month: number }> = [];
      const cur = new Date(first.getFullYear(), first.getMonth(), 1);
      const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      while (cur <= endMonth) {
        months.push({ year: cur.getFullYear(), month: cur.getMonth() });
        cur.setMonth(cur.getMonth() + 1);
      }
      return months.map(({ year, month }) => {
        const label = new Date(year, month, 1).toLocaleDateString("it", { month: "short", year: "2-digit" }).toUpperCase();
        return buildKmEntry(label, runs.filter(r => {
          const rd = new Date(r.date);
          return rd.getFullYear() === year && rd.getMonth() === month;
        }));
      });
    }
  }, [runs, period]);

  const stats = useMemo(() => {
    const days = KM_RANGE_DAYS[period];
    // 7d = settimana di CALENDARIO da lunedì (non ultimi 7 giorni rolling).
    let cutoffMs: number | null;
    if (period === "7d") {
      const now = new Date();
      const m = new Date(now);
      m.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      m.setHours(0, 0, 0, 0);
      cutoffMs = m.getTime();
    } else {
      cutoffMs = days ? Date.now() - days * 86400000 : null;
    }
    const pr = runs.filter(r => cutoffMs ? new Date(r.date).getTime() >= cutoffMs : true);
    const totalKm = pr.reduce((s, r) => s + r.distance_km, 0);
    const weeks = period === "7d" ? 1 : (days ? days / 7 : (pr.length ? (new Date().getTime() - new Date(pr[0].date).getTime()) / (7 * 86400000) : 1));
    const nonZero = chartData.filter(d => CAT_DEFS.some(c => (d[c.key] as number) > 0));
    const avgKmBar = nonZero.length
      ? nonZero.reduce((s, d) => s + CAT_DEFS.reduce((a, c) => a + (d[c.key] as number), 0), 0) / nonZero.length
      : 0;
    return {
      totalKm,
      count: pr.length,
      avgKmPerWeek: weeks > 0 ? totalKm / weeks : 0,
      maxKm: pr.reduce((m, r) => Math.max(m, r.distance_km), 0),
      avgKmBar,
    };
  }, [runs, period, chartData]);

  const periodLabel =
    period === "7d" ? "questa settimana (lun→dom)"
    : period === "30d" ? "ultimi 30 giorni"
    : period === "90d" ? "ultimi 90 giorni"
    : "tutto";

  return (
    <AnalyticsChartCard
      className="h-full"
      title="Carico chilometrico"
      description={`Km per tipo di seduta · ${periodLabel}`}
      actions={<ChartRangeSelector<KmPeriod> value={period} options={KM_RANGES} onChange={setPeriod} aria-label="Intervallo del carico chilometrico" />}
      stats={
        <ChartStats>
          <ChartStat label="Totale" value={stats.totalKm.toLocaleString("it", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit="km" color={CHART_SERIES.primary} />
          <ChartStat label="Uscite" value={stats.count} />
          <ChartStat label="Media" value={stats.avgKmPerWeek.toFixed(1)} unit="km/sett." />
          <ChartStat label="Massimo" value={stats.maxKm.toFixed(1)} unit="km" />
        </ChartStats>
      }
      size="standard"
      status={chartData.length ? "ready" : "empty"}
      plotLabel="Chilometri per tipo di seduta nel periodo"
      legend={
        <ChartLegend
          items={[
            ...CAT_DEFS.map(c => ({ key: c.key, label: c.label, color: c.color, kind: "bar" as const })),
            ...(stats.avgKmBar > 0
              ? [{ key: "avg", label: "media per barra", value: `${stats.avgKmBar.toFixed(1)} km`, color: CHART_TEXT.axis, kind: "dashed" as const }]
              : []),
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={chartMargin} barCategoryGap="30%">
          <CartesianGrid {...chartGrid} />
          <XAxis {...chartXAxis} dataKey="day" />
          <YAxis {...chartYAxis} width={32} />
          {stats.avgKmBar > 0 && (
            <ReferenceLine y={stats.avgKmBar} {...chartReferenceLine} />
          )}
          <Tooltip
            cursor={chartCursorBar}
            content={
              <ChartTooltipContent
                row={(e) => {
                  const cat = CAT_DEFS.find(c => c.key === e.name);
                  if (!e.value) return null;
                  return { label: cat?.label ?? String(e.name), value: `${e.value} km`, color: cat?.color };
                }}
              />
            }
          />
          {CAT_DEFS.map((cat, i) => (
            <Bar key={cat.key} dataKey={cat.key} stackId="s" fill={cat.color} radius={i === CAT_DEFS.length - 1 ? CHART_SHAPE.barRadius : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export function CaricoFormaV2({ ffHistory, kmRuns, paceDistributionChart, effortMatrixChart }: CaricoFormaV2Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Main fitness/fatigue/form chart ── */}
      <FitnessMultiChart ff={ffHistory} />

      {/* ── Km stacked + Pace zones — una colonna sotto i 1024 px ── */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <CaricoKmChart runs={kmRuns} />
        <PaceZonesCard runs={kmRuns} />
      </div>

      {/* ── Distribuzione Passo + Matrice Sforzi ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaceDistributionCard chart={paceDistributionChart} />
        <EffortMatrixCard chart={effortMatrixChart} />
      </div>
    </div>
  );
}
