import React, { useState, useMemo, useRef } from "react";
import type { FitnessFreshnessPoint } from "../../../types/api";

import { CHART_SERIES, CHART_TEXT, ChartRangeSelector } from "../../charts";
/**
 * FitnessChart — CTL (Chronic Training Load) over time, Strava-style.
 *
 * Estratto da DashboardView.tsx (round 5 — #14 god component split).
 * Componente puro presentazionale: riceve `ff` series e renderizza area+line
 * SVG handcrafted con hover marker.
 *
 * Range tabs: 1m / 3m / 6m / 1y / 2y. Dati filtrati client-side da `ff`.
 */

type FFRange = "1m" | "3m" | "6m" | "1y" | "2y";
const FF_RANGE_DAYS: Record<FFRange, number> = { "1m": 30, "3m": 90, "6m": 182, "1y": 365, "2y": 730 };
const FF_TAB_LABELS: Record<FFRange, string> = { "1m": "1 mese", "3m": "3 mesi", "6m": "6 mesi", "1y": "1 anno", "2y": "2 anni" };

export function FitnessChart({ ff }: { ff: FitnessFreshnessPoint[] | undefined }) {
  const [range, setRange] = useState<FFRange>("1y");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(() => {
    if (!ff?.length) return [] as FitnessFreshnessPoint[];
    const cutoff = Date.now() - FF_RANGE_DAYS[range] * 86400000;
    return ff
      .filter((p) => new Date(p.date).getTime() >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [ff, range]);

  // SVG viewport (preserveAspectRatio="none" stretches horizontally)
  const W = 1000, H = 260;
  const padL = 42, padR = 18, padT = 16, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const { maxY, minY } = useMemo(() => {
    if (!data.length) return { maxY: 60, minY: 0 };
    const vals = data.map((d) => d.ctl);
    const mx = Math.max(...vals);
    const mn = Math.min(...vals, 0);
    const top = Math.ceil((mx + 5) / 10) * 10;
    return { maxY: Math.max(top, 10), minY: Math.floor(mn / 10) * 10 };
  }, [data]);

  const x = (i: number) => padL + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => padT + (1 - (v - minY) / (maxY - minY || 1)) * plotH;

  const linePath = useMemo(() => {
    if (!data.length) return "";
    return data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(d.ctl).toFixed(2)}`).join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, maxY, minY]);

  const areaPath = useMemo(() => {
    if (!data.length) return "";
    const top = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(d.ctl).toFixed(2)}`).join(" ");
    return `${top} L ${x(data.length - 1).toFixed(2)} ${padT + plotH} L ${padL} ${padT + plotH} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, maxY, minY]);

  const yTicks = useMemo(() => {
    const step = Math.max(10, Math.ceil((maxY - minY) / 4 / 10) * 10);
    const arr: number[] = [];
    for (let v = minY; v <= maxY; v += step) arr.push(v);
    return arr;
  }, [maxY, minY]);

  const xLabels = useMemo(() => {
    if (data.length < 2) return [] as { i: number; label: string }[];
    const want = 5;
    const step = Math.max(1, Math.floor(data.length / want));
    const out: { i: number; label: string }[] = [];
    const fmt = (s: string) => {
      const d = new Date(s);
      return d.toLocaleDateString("it", { month: "short" }).replace(".", "");
    };
    for (let i = 0; i < data.length; i += step) out.push({ i, label: fmt(data[i].date) });
    out.push({ i: data.length - 1, label: "Oggi" });
    return out;
  }, [data]);

  const current = data.length ? data[data.length - 1].ctl : null;
  const first = data.length ? data[0].ctl : null;
  const delta = current !== null && first !== null ? current - first : null;
  const rangeLabel = data.length
    ? `dal ${new Date(data[0].date).toLocaleDateString("it", { day: "numeric", month: "short", year: "numeric" })} al ${new Date(data[data.length - 1].date).toLocaleDateString("it", { day: "numeric", month: "short", year: "numeric" })}`
    : "—";

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!data.length || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const rel = (px - padL) / plotW;
    const idx = Math.round(rel * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const hov = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="h-full rounded-2xl p-5 flex flex-col overflow-hidden border border-ea-hairline shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] bg-ea-surface-1">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
        <div>
          <h3 className="text-white text-lg font-black tracking-tight">Condizione fisica</h3>
          <p className="text-ea-text-muted text-xs tracking-wide">Allenamento e recupero sommati nel tempo (CTL)</p>
        </div>
        <ChartRangeSelector<FFRange>
          value={range}
          options={(Object.keys(FF_TAB_LABELS) as FFRange[]).map((k) => ({ value: k, label: k.toUpperCase(), title: FF_TAB_LABELS[k] }))}
          onChange={(k) => { setRange(k); setHoverIdx(null); }}
          aria-label="Intervallo della condizione fisica"
        />
      </div>

      {/* Current value + delta */}
      <div className="mb-2">
        <div className="flex items-baseline gap-3">
          <span className="text-white text-4xl font-black">{current !== null ? current.toFixed(0) : "—"}</span>
          <span className="text-ea-text-muted text-xs tracking-widest">CTL</span>
          {delta !== null && (
            <span className={`text-xs font-black ${delta >= 0 ? "text-ea-amber" : "text-ea-cyan"}`}>
              {delta >= 0 ? "+" : ""}{delta.toFixed(0)} punti
            </span>
          )}
        </div>
        <p className="text-ea-text-axis text-xs tracking-wider">{rangeLabel}</p>
      </div>

      {/* Chart */}
      <div className="relative flex-1 min-h-[260px]">
        {data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-ea-text-axis text-xs font-black tracking-widest uppercase">
            nessun dato in questo periodo
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-full"
            style={{ cursor: "crosshair" }}
            onMouseMove={onMove}
            onMouseLeave={() => setHoverIdx(null)}
            role="img"
            aria-label={`Andamento condizione fisica (CTL) ultimi ${FF_TAB_LABELS[range]}`}
          >
            <title>Condizione fisica — CTL nel tempo</title>
            <desc>Grafico ad area che mostra l'andamento del Chronic Training Load nel periodo selezionato</desc>
            <defs>
              <linearGradient id="ffGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_SERIES.load} stopOpacity="0.55" />
                <stop offset="100%" stopColor={CHART_SERIES.load} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Y grid + labels */}
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#26262b" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <text x={padL - 8} y={y(v) + 3} textAnchor="end" fontSize="12" fill={CHART_TEXT.faint} style={{ fontFamily: "JetBrains Mono" }}>
                  {v}
                </text>
              </g>
            ))}

            {/* Area + line */}
            <path d={areaPath} fill="url(#ffGrad)" />
            <path d={linePath} fill="none" stroke={CHART_SERIES.load} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />

            {/* X labels */}
            {xLabels.map((l, k) => (
              <text
                key={k}
                x={x(l.i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="12"
                fill={CHART_TEXT.axis}
                style={{ fontFamily: "JetBrains Mono" }}
              >
                {l.label}
              </text>
            ))}

            {/* Hover marker */}
            {hov && hoverIdx !== null && (
              <g>
                <line
                  x1={x(hoverIdx)}
                  x2={x(hoverIdx)}
                  y1={padT}
                  y2={padT + plotH}
                  stroke={CHART_SERIES.load}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={x(hoverIdx)} cy={y(hov.ctl)} r={12} fill={CHART_SERIES.load} fillOpacity={0.25} />
                <circle cx={x(hoverIdx)} cy={y(hov.ctl)} r={5} fill={CHART_SERIES.load} stroke={CHART_TEXT.primary} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </svg>
        )}

        {/* CTL badge — HTML so it never stretches */}
        {hov && hoverIdx !== null && (() => {
          const badgeLeft = (x(hoverIdx) / W) * 100;
          const badgeTop  = (Math.max(padT + 4, y(hov.ctl) - 38) / H) * 100;
          return (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `calc(${badgeLeft}% - 22px)`,
                top: `${badgeTop}%`,
              }}
            >
              <div
                style={{
                  background: CHART_SERIES.load,
                  borderRadius: 12,
                  width: 44,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 900, color: CHART_TEXT.primary, lineHeight: 1 }}>
                  {hov.ctl.toFixed(0)}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Hover date overlay (HTML, not scaled) */}
        {hov && (
          <div className="absolute top-0 right-0 bg-ea-surface-2 border border-ea-hairline rounded-[12px] px-3 py-1.5 pointer-events-none">
            <div className="text-xs tracking-widest uppercase text-ea-text-muted font-black">
              {new Date(hov.date).toLocaleDateString("it", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div className="text-sm font-black text-white" style={{ fontFamily: "JetBrains Mono" }}>
              CTL {hov.ctl.toFixed(1)} · ATL {hov.atl.toFixed(1)} · TSB {hov.tsb >= 0 ? "+" : ""}{hov.tsb.toFixed(1)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
