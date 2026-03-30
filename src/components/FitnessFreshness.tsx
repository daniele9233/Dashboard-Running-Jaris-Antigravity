import { useMemo, useRef, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import type { FitnessFreshnessPoint, CurrentFF } from "../types/api";
import { recalculateFitnessFreshness } from "../api";

interface FitnessFreshnessProps {
  fitnessFreshness: FitnessFreshnessPoint[];
  currentFf: CurrentFF | null;
  prevCtl: number | null;
}

// ─── Costanti SVG ─────────────────────────────────────────────────────────────
const SVG_W = 1000;
const SVG_H = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 8 };
const CW = SVG_W - PAD.left - PAD.right;
const CH = SVG_H - PAD.top - PAD.bottom;

// ─── Colori (palette sito) ────────────────────────────────────────────────────
const CLR_CTL = "#3B82F6";     // blu — condizione fisica
const CLR_ATL = "#F43F5E";     // rosso — affaticamento
const CLR_TSB_POS = "#14B8A6"; // teal — forma positiva
const CLR_TSB_NEG = "#8B5CF6"; // viola — forma negativa

// ─── Utilities ───────────────────────────────────────────────────────────────

function tsbStatusLabel(tsb: number): string {
  if (tsb > 10) return "Fresco";
  if (tsb > 0) return "Neutro";
  if (tsb > -10) return "Affaticato";
  return "Sovrallenamento";
}

function tsbStatusColor(tsb: number): string {
  if (tsb > 10) return "#14B8A6"; // teal — Fresco
  if (tsb > 0) return "#F59E0B";  // amber — Neutro
  if (tsb > -10) return "#8B5CF6"; // viola — Affaticato
  return "#F43F5E";                // rosso — Sovrallenamento
}

interface ChartPoint {
  x: number;
  yCtl: number;
  yAtl: number;
  yTsb: number;
  y0: number; // linea dello zero
  data: FitnessFreshnessPoint;
}

function buildPoints(data: FitnessFreshnessPoint[]): { points: ChartPoint[]; monthLabels: { x: number; label: string }[] } {
  if (data.length === 0) return { points: [], monthLabels: [] };

  const allValues = data.flatMap((d) => [d.ctl, d.atl, d.tsb]);
  const minVal = Math.min(...allValues) - 2;
  const maxVal = Math.max(...allValues) + 2;
  const range = maxVal - minVal || 1;

  const toY = (val: number) => PAD.top + (1 - (val - minVal) / range) * CH;
  const toX = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * CW;

  const points: ChartPoint[] = data.map((d, i) => ({
    x: toX(i),
    yCtl: toY(d.ctl),
    yAtl: toY(d.atl),
    yTsb: toY(d.tsb),
    y0: toY(0),
    data: d,
  }));

  // Etichette mesi (alla prima occorrenza di ogni mese)
  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = -1;
  data.forEach((d, i) => {
    const date = new Date(d.date);
    const month = date.getMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      monthLabels.push({
        x: toX(i),
        label: date.toLocaleString("it", { month: "short" }).toUpperCase(),
      });
    }
  });

  return { points, monthLabels };
}

// ─── SVG path da array di punti ──────────────────────────────────────────────
function polyline(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

// ─── Componente chart SVG ────────────────────────────────────────────────────

function FFChart({ points }: { points: ChartPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRel = ((e.clientX - rect.left) / rect.width) * SVG_W;
    let nearest = 0;
    let minDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - xRel);
      if (d < minDist) { minDist = d; nearest = i; }
    });
    setHoverIdx(nearest);
  };

  if (points.length === 0) return null;

  // ── Area TSB (tanti poligoni colorati) ───────────────────────────────────
  const tsbAreas: React.ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const avgTsb = (p1.data.tsb + p2.data.tsb) / 2;
    const y0 = p1.y0; // costante (zero line)
    const color = avgTsb >= 0 ? CLR_TSB_POS : CLR_TSB_NEG;
    tsbAreas.push(
      <polygon
        key={i}
        points={`${p1.x},${p1.yTsb} ${p2.x},${p2.yTsb} ${p2.x},${y0} ${p1.x},${y0}`}
        fill={color}
        fillOpacity={0.08}
      />
    );
  }

  // ── Linea TSB (tanti segmenti colorati) ───────────────────────────────────
  const tsbSegments: React.ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const color = (p1.data.tsb + p2.data.tsb) / 2 >= 0 ? CLR_TSB_POS : CLR_TSB_NEG;
    tsbSegments.push(
      <line
        key={i}
        x1={p1.x} y1={p1.yTsb}
        x2={p2.x} y2={p2.yTsb}
        stroke={color}
        strokeWidth={2}
      />
    );
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  // Tooltip position: evita di uscire dai bordi
  const tooltipX = hovered
    ? hovered.x > SVG_W * 0.75 ? hovered.x - 130 : hovered.x + 12
    : 0;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height={SVG_H}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
      className="cursor-crosshair"
    >
      {/* Griglia orizzontale leggera */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={PAD.left} y1={PAD.top + f * CH}
          x2={PAD.left + CW} y2={PAD.top + f * CH}
          stroke="#1e293b" strokeWidth={1}
        />
      ))}

      {/* Linea zero TSB */}
      {points.length > 0 && (
        <line
          x1={PAD.left} y1={points[0].y0}
          x2={PAD.left + CW} y2={points[0].y0}
          stroke="#334155" strokeWidth={1} strokeDasharray="4 3"
        />
      )}

      {/* Area TSB */}
      {tsbAreas}

      {/* Linee CTL e ATL */}
      <path
        d={polyline(points.map((p) => ({ x: p.x, y: p.yCtl })))}
        fill="none"
        stroke={CLR_CTL}
        strokeWidth={2.5}
      />
      <path
        d={polyline(points.map((p) => ({ x: p.x, y: p.yAtl })))}
        fill="none"
        stroke={CLR_ATL}
        strokeWidth={1.5}
        strokeOpacity={0.7}
      />

      {/* Segmenti TSB */}
      {tsbSegments}

      {/* Cursore hover */}
      {hovered && (
        <>
          <line
            x1={hovered.x} y1={PAD.top}
            x2={hovered.x} y2={PAD.top + CH}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
          />
          {/* Dot CTL */}
          <circle cx={hovered.x} cy={hovered.yCtl} r={4} fill={CLR_CTL} />
          {/* Dot ATL */}
          <circle cx={hovered.x} cy={hovered.yAtl} r={3} fill={CLR_ATL} />
          {/* Dot TSB */}
          <circle
            cx={hovered.x} cy={hovered.yTsb} r={4}
            fill={hovered.data.tsb >= 0 ? CLR_TSB_POS : CLR_TSB_NEG}
          />

          {/* Tooltip */}
          <g transform={`translate(${tooltipX}, ${PAD.top + 8})`}>
            <rect x={0} y={0} width={118} height={90} rx={6}
              fill="#1e293b" stroke="#334155" strokeWidth={1} />
            <text x={10} y={18} fill="#94a3b8" fontSize={9} fontWeight={700} fontFamily="sans-serif">
              {new Date(hovered.data.date).toLocaleDateString("it", { day: "numeric", month: "short", year: "2-digit" }).toUpperCase()}
            </text>
            <rect x={10} y={26} width={8} height={2} rx={1} fill={CLR_CTL} />
            <text x={22} y={31} fill="#e2e8f0" fontSize={10} fontFamily="sans-serif">
              CTL: <tspan fontWeight={700}>{hovered.data.ctl.toFixed(1)}</tspan>
            </text>
            <rect x={10} y={44} width={8} height={2} rx={1} fill={CLR_ATL} />
            <text x={22} y={49} fill="#e2e8f0" fontSize={10} fontFamily="sans-serif">
              ATL: <tspan fontWeight={700}>{hovered.data.atl.toFixed(1)}</tspan>
            </text>
            <rect x={10} y={62} width={8} height={2} rx={1}
              fill={hovered.data.tsb >= 0 ? CLR_TSB_POS : CLR_TSB_NEG} />
            <text x={22} y={67} fill="#e2e8f0" fontSize={10} fontFamily="sans-serif">
              TSB: <tspan fontWeight={700}
                fill={hovered.data.tsb >= 0 ? CLR_TSB_POS : CLR_TSB_NEG}>
                {hovered.data.tsb >= 0 ? "+" : ""}{hovered.data.tsb.toFixed(1)}
              </tspan>
            </text>
            <text x={22} y={82} fill="#64748b" fontSize={9} fontFamily="sans-serif">
              TRIMP: {hovered.data.trimp?.toFixed(0) ?? "--"}
            </text>
          </g>
        </>
      )}
    </svg>
  );
}

// ─── Componente principale ───────────────────────────────────────────────────

export function FitnessFreshness({ fitnessFreshness, currentFf, prevCtl }: FitnessFreshnessProps) {
  const [recalcLoading, setRecalcLoading] = useState(false);

  const { points, monthLabels } = useMemo(
    () => buildPoints(fitnessFreshness ?? []),
    [fitnessFreshness]
  );

  const ctl = currentFf?.ctl ?? 0;
  const atl = currentFf?.atl ?? 0;
  const tsb = currentFf?.tsb ?? 0;
  const ctlTrend = currentFf?.ctl_trend ?? (prevCtl !== null ? parseFloat((ctl - prevCtl).toFixed(1)) : null);
  const statusLabel = currentFf?.form_status ?? tsbStatusLabel(tsb);
  const statusColor = tsbStatusColor(tsb);

  const handleRecalculate = async () => {
    setRecalcLoading(true);
    try {
      await recalculateFitnessFreshness();
      window.location.reload(); // ricarica per vedere i nuovi dati
    } catch (e) {
      console.error(e);
    } finally {
      setRecalcLoading(false);
    }
  };

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-6 mt-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#3B82F6]" />
          <h2 className="text-lg font-bold tracking-wider uppercase text-text-primary">
            Fitness &amp; Freshness
          </h2>
          <span className="text-[10px] text-text-muted font-mono ml-1">(TRIMP Lucia)</span>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalcLoading}
          className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${recalcLoading ? "animate-spin" : ""}`} />
          Ricalcola
        </button>
      </div>

      {/* ── Metriche ── */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* CTL */}
        <div>
          <div className="text-5xl font-black mb-1" style={{ color: CLR_CTL }}>
            {ctl > 0 ? ctl.toFixed(1) : "--"}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase" style={{ color: CLR_CTL }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLR_CTL }} />
            Condizione Fisica
          </div>
          {ctlTrend !== null && ctlTrend !== 0 && (
            <div className={`text-sm font-bold mt-1 ${ctlTrend >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
              {ctlTrend >= 0 ? "+" : ""}{ctlTrend} vs 7gg
            </div>
          )}
        </div>

        {/* ATL */}
        <div>
          <div className="text-5xl font-black mb-1" style={{ color: CLR_ATL }}>
            {atl > 0 ? atl.toFixed(1) : "--"}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase" style={{ color: CLR_ATL }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLR_ATL }} />
            Affaticamento
          </div>
        </div>

        {/* TSB */}
        <div>
          <div className="text-5xl font-black mb-1" style={{ color: statusColor }}>
            {currentFf ? (tsb >= 0 ? "+" : "") + tsb.toFixed(1) : "--"}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase" style={{ color: statusColor }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColor }} />
            Forma Fisica
          </div>
          <div className="text-sm font-bold mt-1 uppercase" style={{ color: statusColor }}>
            {statusLabel}
          </div>
        </div>
      </div>

      {/* ── Grafico SVG ── */}
      {points.length > 0 ? (
        <div className="relative">
          <FFChart points={points} />
          {/* Etichette mesi sotto il grafico */}
          <div className="relative h-6" style={{ marginTop: -4 }}>
            <svg viewBox={`0 0 ${SVG_W} 24`} width="100%" height={24}>
              {monthLabels.map((ml) => (
                <text
                  key={ml.label + ml.x}
                  x={ml.x}
                  y={16}
                  fill="#64748b"
                  fontSize={9}
                  fontFamily="sans-serif"
                  fontWeight={600}
                >
                  {ml.label}
                </text>
              ))}
            </svg>
          </div>
        </div>
      ) : (
        <div className="h-48 flex flex-col items-center justify-center gap-3 text-text-muted">
          <p className="text-sm">Nessun dato — sincronizza le corse o clicca Ricalcola</p>
          <button
            onClick={handleRecalculate}
            disabled={recalcLoading}
            className="text-xs font-bold text-[#C0FF00] border border-[#C0FF00]/30 hover:border-[#C0FF00] rounded-lg px-4 py-2 transition-all"
          >
            {recalcLoading ? "Calcolo in corso..." : "Ricalcola ora"}
          </button>
        </div>
      )}

      {/* ── Legenda ── */}
      <div className="flex gap-8 mt-4 pt-4 border-t border-[#1E293B] justify-center text-xs font-semibold tracking-wider text-text-muted">
        <div className="flex items-center gap-2">
          <div className="w-5 h-[2.5px] rounded-full" style={{ backgroundColor: CLR_CTL }} />
          Condizione fisica (CTL 42gg)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-[1.5px] rounded-full" style={{ backgroundColor: CLR_ATL }} />
          Affaticamento (ATL 7gg)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CLR_TSB_POS }} />
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CLR_TSB_NEG }} />
          Forma (TSB)
        </div>
      </div>

      {/* ── Info TSB ── */}
      <div className="grid grid-cols-4 gap-3 mt-4 text-[10px]">
        {[
          { label: "Fresco", range: "TSB > 10", color: "#14B8A6", desc: "Pronto per gara/test" },
          { label: "Neutro", range: "TSB 0–10", color: "#F59E0B", desc: "Buon allenamento" },
          { label: "Affaticato", range: "TSB −10–0", color: "#8B5CF6", desc: "Mantieni il ritmo" },
          { label: "Sovrallenamento", range: "TSB < −10", color: "#F43F5E", desc: "Recupera" },
        ].map(({ label, range, color, desc }) => (
          <div
            key={label}
            className="rounded-lg px-3 py-2 border"
            style={{ borderColor: color + "30", backgroundColor: color + "08" }}
          >
            <div className="font-bold uppercase tracking-wider" style={{ color }}>
              {label}
            </div>
            <div className="text-text-muted mt-0.5">{range}</div>
            <div className="text-text-muted mt-0.5">{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
