import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { TrendingUp, ChevronDown } from "lucide-react";
import type { CurrentFF } from "../types/api";

interface SupercompensationChartProps {
  currentFf: CurrentFF | null;
}

// ─── Banister model: decadimento esponenziale ────────────────────────────────
// CTL (Chronic Training Load): costante 42 giorni
// ATL (Acute Training Load): costante 7 giorni
// Forma (TSB) = CTL - ATL → sale mentre ATL decade più veloce di CTL
const CTL_DECAY = Math.exp(-1 / 42); // ~0.9764
const ATL_DECAY = Math.exp(-1 / 7);  // ~0.8667

type ProjectionPoint = {
  label: string;
  day: number;
  ctl: number;
  atl: number;
  tsb: number;
  isPeak?: boolean;
  isToday?: boolean;
};

function projectForward(ctl: number, atl: number, days: number): ProjectionPoint[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let c = ctl;
  let a = atl;
  const points: ProjectionPoint[] = [];

  for (let d = 0; d <= days; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() + d);
    const label =
      d === 0
        ? "Oggi"
        : date.toLocaleDateString("it", { day: "numeric", month: "numeric" });
    points.push({
      label,
      day: d,
      ctl: parseFloat(c.toFixed(1)),
      atl: parseFloat(a.toFixed(1)),
      tsb: parseFloat((c - a).toFixed(1)),
      isToday: d === 0,
    });
    c = c * CTL_DECAY;
    a = a * ATL_DECAY;
  }

  // Marca il picco TSB
  let peakIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].tsb > points[peakIdx].tsb) peakIdx = i;
  }
  if (peakIdx > 0) points[peakIdx].isPeak = true;

  return points;
}

function tsbColor(tsb: number): string {
  if (tsb > 10)  return "#C0FF00";
  if (tsb > -5)  return "#14B8A6";
  if (tsb > -20) return "#F59E0B";
  return "#F43F5E";
}

function getInsightText(points: ProjectionPoint[], days: number): string {
  const peak = points.find((p) => p.isPeak);
  if (!peak) return "Continua ad allenarti per costruire condizione fisica.";

  const currentTsb = points[0]?.tsb ?? 0;

  if (peak.day === 0) {
    return "🏆 Sei al picco di forma oggi! Ottimo momento per gareggiare o fare un test.";
  }
  if (peak.day <= 3) {
    return `⚡ Il picco di forma è vicino — ${peak.label}. Riposati ancora ${peak.day} giorni per massimizzare le prestazioni.`;
  }
  if (currentTsb < -5) {
    return `🔥 Il corpo sta assorbendo il carico. Con il riposo vedrai il picco di forma intorno al ${peak.label}.`;
  }
  return `🚀 Gli adattamenti si stanno consolidando. Il tuo picco di forma previsto è il ${peak.label}.`;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const FutureTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload as ProjectionPoint;
  if (!pt) return null;

  return (
    <div className="bg-[#0F172A] border border-[#334155] px-3 py-2 rounded-xl shadow-xl text-xs min-w-[150px]">
      <div className="flex items-center gap-1.5 mb-1.5">
        {pt.isPeak && <span className="text-[#C0FF00]">★</span>}
        <p className="text-[#94A3B8] font-semibold">{pt.isToday ? "Oggi" : label}</p>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-[#3B82F6]">Condizione</span>
          <span className="text-white font-bold">{pt.ctl.toFixed(1)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#F43F5E]">Affaticamento</span>
          <span className="text-white font-bold">{pt.atl.toFixed(1)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: tsbColor(pt.tsb) }}>Forma</span>
          <span className="font-bold" style={{ color: tsbColor(pt.tsb) }}>
            {pt.tsb >= 0 ? "+" : ""}{pt.tsb.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Range options ────────────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { label: "7 giorni",  days: 7  },
  { label: "14 giorni", days: 14 },
  { label: "21 giorni", days: 21 },
  { label: "30 giorni", days: 30 },
];

// ─── Component ───────────────────────────────────────────────────────────────
export function SupercompensationChart({ currentFf }: SupercompensationChartProps) {
  const [rangeDays, setRangeDays] = useState(14);
  const [menuOpen, setMenuOpen] = useState(false);

  const ctl = currentFf?.ctl ?? 0;
  const atl = currentFf?.atl ?? 0;

  const points = useMemo(() => {
    if (!currentFf || ctl <= 0) return [];
    return projectForward(ctl, atl, rangeDays);
  }, [ctl, atl, rangeDays, currentFf]);

  const peakPoint = points.find((p) => p.isPeak);
  const insight = useMemo(() => getInsightText(points, rangeDays), [points, rangeDays]);

  if (!currentFf || ctl <= 0) {
    return (
      <div className="bg-bg-card border border-[#1E293B] rounded-xl h-full flex items-center justify-center">
        <p className="text-xs text-text-muted text-center px-4">
          Sincronizza le corse per vedere la proiezione della forma futura.
        </p>
      </div>
    );
  }

  const currentRange = RANGE_OPTIONS.find((r) => r.days === rangeDays)!;

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#C0FF00]" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
            Grafico del Futuro
          </h3>
        </div>

        {/* Range dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-2.5 py-1.5 transition-all"
          >
            {currentRange.label}
            <ChevronDown className={`w-3 h-3 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden shadow-2xl z-50 min-w-[110px]">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => { setRangeDays(opt.days); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-white/10 transition-colors"
                  style={{ color: opt.days === rangeDays ? "#C0FF00" : "#94A3B8" }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Peak badge */}
      {peakPoint && (
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <span className="text-[9px] text-[#94A3B8] uppercase tracking-widest font-bold">
            Picco previsto
          </span>
          <span className="text-[10px] font-black text-[#C0FF00] bg-[#C0FF00]/10 px-2 py-0.5 rounded-md border border-[#C0FF00]/20">
            ★ {peakPoint.label} · +{peakPoint.tsb.toFixed(1)} TSB
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="#1E293B" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#475569", fontSize: 8 }}
              dy={4}
              interval={Math.floor(rangeDays / 5)}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#475569", fontSize: 9 }}
              dx={-4}
              width={28}
            />
            <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 3" strokeWidth={1} />
            <Tooltip
              content={<FutureTooltip />}
              cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
            />

            {/* Condizione (CTL) — blu */}
            <Line
              type="monotone"
              dataKey="ctl"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Condizione"
            />
            {/* Affaticamento (ATL) — rosso */}
            <Line
              type="monotone"
              dataKey="atl"
              stroke="#F43F5E"
              strokeWidth={1.5}
              strokeOpacity={0.7}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
              name="Affaticamento"
            />
            {/* Forma (TSB) — teal/lime */}
            <Line
              type="monotone"
              dataKey="tsb"
              stroke="#14B8A6"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              name="Forma"
            />

            {/* Dot sul picco */}
            {peakPoint && (
              <ReferenceDot
                x={peakPoint.label}
                y={peakPoint.tsb}
                r={5}
                fill="#C0FF00"
                stroke="#0F172A"
                strokeWidth={2}
                label={{
                  value: `★ PICCO ${peakPoint.label}`,
                  position: "top",
                  fill: "#C0FF00",
                  fontSize: 8,
                  fontWeight: 700,
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 shrink-0">
        {[
          { label: "Condizione", color: "#3B82F6", dashed: false },
          { label: "Affaticamento", color: "#F43F5E", dashed: true },
          { label: "Forma", color: "#14B8A6", dashed: false },
        ].map(({ label, color, dashed }) => (
          <div key={label} className="flex items-center gap-1">
            <svg width="16" height="6">
              <line
                x1="0" y1="3" x2="16" y2="3"
                stroke={color}
                strokeWidth={dashed ? 1.5 : 2}
                strokeDasharray={dashed ? "4 2" : undefined}
              />
            </svg>
            <span className="text-[9px] font-semibold" style={{ color }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Insight */}
      <div className="mt-2 bg-white/[0.03] border border-[#1E293B] rounded-lg px-3 py-2 text-[10px] text-[#94A3B8] shrink-0 leading-snug">
        {insight}
      </div>
    </div>
  );
}
