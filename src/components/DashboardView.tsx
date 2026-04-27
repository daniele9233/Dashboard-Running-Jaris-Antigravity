import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  Wind, TrendingDown, Activity, Target, Timer, Zap, Flame, Shield, Trophy, Info, RotateCcw,
  Sparkles, Plus, X,
} from "lucide-react";
// Use v1-compat API from `/legacy` entry (Responsive + WidthProvider HOC with flat props).
import { Responsive, WidthProvider } from "react-grid-layout/legacy";

const ResponsiveGrid = WidthProvider(Responsive);
import { GridCard } from "./GridCard";
import { useLayout } from "../context/LayoutContext";
import { WIDGET_REGISTRY } from "./dashboard/widgetRegistry";

// ─── media query hook (mobile detection) ─────────────────────────────────────
function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return match;
}

// ─── Info Tooltip ─────────────────────────────────────────────────────────────
function InfoTooltip({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const showTooltip = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: rect.bottom + 12,
        left: Math.min(window.innerWidth - 384, Math.max(16, rect.right - 384)),
      });
    }
    setOpen(true);
  };
  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onMouseEnter={showTooltip}
        onMouseLeave={() => setOpen(false)}
        onFocus={showTooltip}
        onBlur={() => setOpen(false)}
        className="text-[#555] hover:text-[#A0A0A0] transition-colors focus:outline-none"
      >
        <Info size={13} />
      </button>
      {open && createPortal(
        <div
          className="fixed z-[9999] w-96 max-h-[70vh] overflow-y-auto bg-[#111] border border-white/15 rounded-2xl p-4 shadow-2xl pointer-events-none"
          style={{ top: position.top, left: position.left }}
        >
          <div className="text-[#C0FF00] text-[10px] font-black tracking-widest mb-2">{title}</div>
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="text-[#D6D6D6] text-[11px] leading-relaxed flex gap-1.5">
                <span className="text-[#555] shrink-0">·</span>{l}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
import { LastRunMap } from "./LastRunMap";

// ─────────────────── Fitness Chart — CTL over time (Strava-style) ───────────────
type FFRange = "1m" | "3m" | "6m" | "1y" | "2y";
const FF_RANGE_DAYS: Record<FFRange, number> = { "1m": 30, "3m": 90, "6m": 182, "1y": 365, "2y": 730 };
const FF_TAB_LABELS: Record<FFRange, string> = { "1m": "1 mese", "3m": "3 mesi", "6m": "6 mesi", "1y": "1 anno", "2y": "2 anni" };

function FitnessChart({ ff }: { ff: FitnessFreshnessPoint[] | undefined }) {
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
  }, [data, maxY, minY]);

  const areaPath = useMemo(() => {
    if (!data.length) return "";
    const top = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(d.ctl).toFixed(2)}`).join(" ");
    return `${top} L ${x(data.length - 1).toFixed(2)} ${padT + plotH} L ${padL} ${padT + plotH} Z`;
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
    <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
        <div>
          <h3 className="text-white text-lg font-black tracking-tight">Condizione fisica</h3>
          <p className="text-[#A0A0A0] text-[11px] tracking-wide">Allenamento e recupero sommati nel tempo (CTL)</p>
        </div>
        <div className="flex gap-1 bg-[#111] border border-white/[0.06] rounded-full p-1">
          {(Object.keys(FF_TAB_LABELS) as FFRange[]).map((k) => (
            <button
              key={k}
              onClick={() => { setRange(k); setHoverIdx(null); }}
              className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase transition-colors ${
                range === k ? "bg-[#F97316] text-white" : "text-[#A0A0A0] hover:text-white"
              }`}
            >
              {FF_TAB_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Current value + delta */}
      <div className="mb-2">
        <div className="flex items-baseline gap-3">
          <span className="text-white text-4xl font-black">{current !== null ? current.toFixed(0) : "—"}</span>
          <span className="text-[#A0A0A0] text-xs tracking-widest">CTL</span>
          {delta !== null && (
            <span className={`text-xs font-black ${delta >= 0 ? "text-[#F97316]" : "text-[#60A5FA]"}`}>
              {delta >= 0 ? "+" : ""}{delta.toFixed(0)} punti
            </span>
          )}
        </div>
        <p className="text-[#666] text-[10px] tracking-wider">{rangeLabel}</p>
      </div>

      {/* Chart */}
      <div className="relative flex-1 min-h-[260px]">
        {data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-[#666] text-xs font-black tracking-widest uppercase">
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
          >
            <defs>
              <linearGradient id="ffGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F97316" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#F97316" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Y grid + labels */}
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#26262b" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <text x={padL - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#666" style={{ fontFamily: "JetBrains Mono" }}>
                  {v}
                </text>
              </g>
            ))}

            {/* Area + line */}
            <path d={areaPath} fill="url(#ffGrad)" />
            <path d={linePath} fill="none" stroke="#F97316" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />

            {/* X labels */}
            {xLabels.map((l, k) => (
              <text
                key={k}
                x={x(l.i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#888"
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
                  stroke="#F97316"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={x(hoverIdx)} cy={y(hov.ctl)} r={12} fill="#F97316" fillOpacity={0.25} />
                <circle cx={x(hoverIdx)} cy={y(hov.ctl)} r={5} fill="#F97316" stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
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
                  background: '#F97316',
                  borderRadius: 8,
                  width: 44,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                  {hov.ctl.toFixed(0)}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Hover date overlay (HTML, not scaled) */}
        {hov && (
          <div className="absolute top-0 right-0 bg-[#111] border border-white/[0.08] rounded-lg px-3 py-1.5 pointer-events-none">
            <div className="text-[10px] tracking-widest uppercase text-[#A0A0A0] font-black">
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

// ─────────────────── HR Zones donut (adapted to dark theme) ───────────────────
function HRZones({ lastRun }: { lastRun: Run | null }) {
  const [active, setActive] = useState(2);

  const zones = useMemo(() => {
    const maxHr = lastRun?.max_hr ?? 190;
    const ranges = [
      { n: "Z1", label: "Recovery", low: 0.5, high: 0.69, color: "#60A5FA" },
      { n: "Z2", label: "Endurance", low: 0.69, high: 0.78, color: "#34D399" },
      { n: "Z3", label: "Tempo", low: 0.78, high: 0.86, color: "#FBBF24" },
      { n: "Z4", label: "Threshold", low: 0.86, high: 0.92, color: "#FB923C" },
      { n: "Z5", label: "VO₂", low: 0.92, high: 1.0, color: "#F43F5E" },
    ];
    const secs = ranges.map(() => 0);
    for (const sp of lastRun?.splits ?? []) {
      if (sp.hr == null) continue;
      const pct = sp.hr / maxHr;
      const zi = ranges.findIndex((r) => pct >= r.low && pct < r.high);
      if (zi >= 0) secs[zi] += sp.elapsed_time || 60;
    }
    const total = secs.reduce((s, v) => s + v, 0);
    return ranges.map((r, i) => {
      const pct = total > 0 ? (secs[i] / total) * 100 : 0;
      return {
        ...r,
        pct: Math.round(pct),
        range: `${Math.round(r.low * maxHr)}-${Math.round(r.high * maxHr)}`,
      };
    });
  }, [lastRun]);

  const total = zones.reduce((s, z) => s + z.pct, 0) || 1;
  const R = 70, r = 48;
  const cx = 96, cy = 96;
  let startAngle = -90;
  const gap = 2;
  const maxPct = Math.max(...zones.map((z) => z.pct), 1);

  return (
    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-5 h-full flex flex-col overflow-hidden">
      {/* ── top label ── */}
      <div className="text-[#A0A0A0] text-[9px] font-black tracking-[0.2em] uppercase mb-3 shrink-0">
        Heart Rate Zones
      </div>

      {/* ── body: donut left / list right ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Donut */}
        <div className="flex items-center justify-center shrink-0" style={{ width: '44%' }}>
          <svg viewBox="0 0 200 200" className="w-full h-full" style={{ maxWidth: 200, maxHeight: 200 }}>
            {zones.map((z, i) => {
              const a1 = startAngle + gap / 2;
              const a2 = startAngle + (z.pct / total) * 360 - gap / 2;
              startAngle += (z.pct / total) * 360;
              const large = a2 - a1 > 180 ? 1 : 0;
              const rad = (p: number) => (p * Math.PI) / 180;
              const isActive = i === active;
              const rr = isActive ? R + 6 : R;
              const ri = isActive ? r - 2 : r;
              const x1 = cx + rr * Math.cos(rad(a1));
              const y1 = cy + rr * Math.sin(rad(a1));
              const x2 = cx + rr * Math.cos(rad(a2));
              const y2 = cy + rr * Math.sin(rad(a2));
              const x3 = cx + ri * Math.cos(rad(a2));
              const y3 = cy + ri * Math.sin(rad(a2));
              const x4 = cx + ri * Math.cos(rad(a1));
              const y4 = cy + ri * Math.sin(rad(a1));
              if (z.pct === 0) return null;
              const d = `M ${x1} ${y1} A ${rr} ${rr} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${ri} ${ri} 0 ${large} 0 ${x4} ${y4} Z`;
              return (
                <path
                  key={i}
                  d={d}
                  fill={z.color}
                  opacity={isActive ? 1 : 0.55}
                  style={{ cursor: "pointer", transition: "all .25s ease", filter: isActive ? `drop-shadow(0 0 6px ${z.color}88)` : "none" }}
                  onMouseEnter={() => setActive(i)}
                />
              );
            })}
            {/* dark inner circle */}
            <circle cx={cx} cy={cy} r={r - 5} fill="#111" />
            {/* center text */}
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#888" letterSpacing="1.2">
              {zones[active].n} · {zones[active].label.toUpperCase()}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff">
              {zones[active].pct}%
            </text>
            <text x={cx} y={cy + 26} textAnchor="middle" fontSize="7.5" fill="#555">
              {zones[active].range} bpm
            </text>
          </svg>
        </div>

        {/* Distribution list */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div className="text-white text-xl font-black italic tracking-tight mb-3 shrink-0">
            Distribution
          </div>
          <div className="flex flex-col gap-1.5 flex-1 justify-evenly">
            {zones.map((z, i) => (
              <div
                key={z.n}
                onMouseEnter={() => setActive(i)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all"
                style={{
                  background: i === active ? "rgba(255,255,255,0.06)" : "transparent",
                  border: i === active ? `1px solid ${z.color}30` : "1px solid transparent",
                }}
              >
                {/* color pill */}
                <div style={{
                  width: 5, height: 22, borderRadius: 3,
                  background: z.color,
                  opacity: i === active ? 1 : 0.65,
                  flexShrink: 0,
                  boxShadow: i === active ? `0 0 8px ${z.color}66` : "none",
                }} />
                {/* label + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white text-[10px] font-black tracking-widest uppercase truncate">
                      {z.n} · {z.label}
                    </span>
                    <span className="text-[#A0A0A0] text-[10px] font-bold ml-2 shrink-0" style={{ fontFamily: "JetBrains Mono" }}>
                      {z.pct}%
                    </span>
                  </div>
                  <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(z.pct / maxPct) * 100}%`, background: z.color, transition: "width .6s ease", opacity: i === active ? 1 : 0.6 }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, CartesianGrid, Area, ComposedChart } from "recharts";
import { useApi } from "../hooks/useApi";
import { getDashboard, getRuns, getAnalytics, getBestEfforts, getVdotPaces, getDashboardInsight, getProfile } from "../api";
import type { DashboardResponse, RunsResponse, AnalyticsResponse, Run, BestEffort, FitnessFreshnessPoint, VdotPacesResponse, Profile } from "../types/api";
import { DetrainingWidget } from "./DetrainingWidget";

function fmtPbTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes * 60) % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function bestPbTime(runs: Run[], minKm: number, maxKm: number, targetKm: number): string {
  const c = runs.filter(r =>
    !r.is_treadmill &&
    r.distance_km >= minKm &&
    r.distance_km <= maxKm &&
    r.duration_minutes > 0
  );
  if (!c.length) return '—';
  // Find best pace run, then project to exact target distance
  const best = c.reduce((b, r) => {
    const pace = r.duration_minutes / r.distance_km;
    return pace < b.duration_minutes / b.distance_km ? r : b;
  });
  const projectedMin = (best.duration_minutes / best.distance_km) * targetKm;
  return fmtPbTime(projectedMin);
}

function timeUntil(dateStr: string): { days: number; hours: number; minutes: number } | null {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return { days, hours, minutes };
}

function parsePaceToSecs(pace: string): number {
  if (!pace) return 0;
  const parts = pace.split(":");
  if (parts.length !== 2) return 0;
  const m = parseInt(parts[0]);
  const s = parseInt(parts[1]);
  if (isNaN(m) || isNaN(s)) return 0;
  return m * 60 + s;
}

function secsToPaceStr(secs: number): string {
  if (secs <= 0) return "--";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Parse "h:mm:ss" or "mm:ss" to seconds
function hmsToSecs(s: string): number | null {
  if (!s) return null;
  const parts = s.split(":").map(x => parseInt(x, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Next Optimal Session Widget ─────────────────────────────────────────────
function NextOptimalSessionWidget({
  tsb, atl, ctl, runs, faticaColor,
}: {
  tsb: number | null;
  atl: number;
  ctl: number;
  runs: Run[];
  faticaColor: string;
}) {
  const { t } = useTranslation();
  const { hoursUntil, pct, recommendation, readyAt } = useMemo(() => {
    const gpsRuns = runs.filter(r => !r.is_treadmill);
    const lastRun = gpsRuns[0] ?? null;

    // Hours elapsed since last run
    const hoursElapsed = lastRun
      ? (Date.now() - new Date(lastRun.date + 'T12:00:00').getTime()) / 3600000
      : 9999;

    // Minimum recovery based on last run intensity
    let minRecoveryHours = 24;
    if (lastRun) {
      const hrPct = lastRun.avg_hr_pct != null
        ? (lastRun.avg_hr_pct > 1 ? lastRun.avg_hr_pct / 100 : lastRun.avg_hr_pct)
        : 0.72;
      const isHard = ['intervals', 'ripetute', 'tempo', 'soglia'].includes(
        (lastRun.run_type ?? '').toLowerCase()
      );
      const isLong = lastRun.distance_km > 18;

      if (isHard || hrPct > 0.88) {
        minRecoveryHours = isLong ? 72 : 48;
      } else if (hrPct > 0.78 || lastRun.distance_km > 12) {
        minRecoveryHours = 36;
      } else {
        minRecoveryHours = 24;
      }
    }

    // Also compute ATL-based model as secondary signal
    let atlHours = 0;
    if (tsb !== null && atl > 0 && ctl > 0) {
      const targetAtl = ctl + 5;
      if (atl > targetAtl) {
        atlHours = Math.round(7 * Math.log(atl / targetAtl) * 24);
      }
    }

    // Take the larger of the two models (conservative)
    const remainingFromLastRun = Math.max(0, minRecoveryHours - hoursElapsed);
    const totalRemaining = Math.max(remainingFromLastRun, atlHours > 0 ? Math.min(atlHours, remainingFromLastRun + 12) : 0);
    const hoursUntil = Math.round(totalRemaining);

    // Recovery pct
    const pct = minRecoveryHours > 0
      ? Math.max(0, Math.min(1, hoursElapsed / minRecoveryHours))
      : 1;

    // Ready-at timestamp
    const readyAt = hoursUntil > 0
      ? new Date(Date.now() + hoursUntil * 3600000)
      : null;

    const recommendation = (atl > 70 || (tsb !== null && tsb < -20))
      ? 'easy'
      : (atl > 40 || (tsb !== null && tsb < -5))
      ? 'moderate'
      : 'hard';

    return {
      hoursUntil,
      pct,
      recommendation: recommendation as 'easy' | 'moderate' | 'hard',
      readyAt,
    };
  }, [tsb, atl, ctl, runs]);

  const isReady = hoursUntil === 0;
  const h = Math.floor(hoursUntil);
  const arcColor = faticaColor;
  const circ = 2 * Math.PI * 38;
  const offset = circ * (1 - pct);

  const readyAtLabel = readyAt
    ? readyAt.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
      + ' ' + readyAt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  const recLabel = recommendation === 'hard'
    ? 'HARD SESSION' : recommendation === 'moderate'
    ? 'MODERATE SESSION' : 'EASY / RECOVERY';
  const recColor = recommendation === 'hard'
    ? '#C0FF00' : recommendation === 'moderate'
    ? '#F59E0B' : '#60A5FA';

  const ringColor = isReady ? "#C0FF00" : arcColor;

  // Semicircular arc path length
  const arcLen = Math.PI * 85;

  return (
    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Timer className="text-[#C0FF00]" size={14} />
        <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest">NEXT OPTIMAL SESSION</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Semicircle gauge — Garmin-style */}
        <div className="relative w-full mx-auto" style={{ maxWidth: '220px', aspectRatio: '200 / 120' }}>
          <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="nos-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor={ringColor} stopOpacity="0.35" />
                <stop offset="100%" stopColor={ringColor} stopOpacity="1" />
              </linearGradient>
            </defs>
            {/* Track */}
            <path d="M 15 105 A 85 85 0 0 1 185 105" stroke="#242424" strokeWidth="9" fill="none" strokeLinecap="round" />
            {/* Fill */}
            <path
              d="M 15 105 A 85 85 0 0 1 185 105"
              stroke="url(#nos-grad)"
              strokeWidth="9"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${arcLen}`}
              strokeDashoffset={arcLen * (1 - pct)}
              style={{ transition: "stroke-dashoffset .6s ease" }}
            />
            {/* Tick marks at 0/50/100% */}
            <line x1="15"  y1="105" x2="15"  y2="115" stroke="#444" strokeWidth="1" />
            <line x1="100" y1="20"  x2="100" y2="10"  stroke="#444" strokeWidth="1" />
            <line x1="185" y1="105" x2="185" y2="115" stroke="#444" strokeWidth="1" />
          </svg>

          {/* Center content — anchored inside arc */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
            {isReady ? (
              <>
                <Zap size={30} className="text-[#C0FF00] mb-1" />
                <span className="text-[#C0FF00] text-[10px] font-black tracking-widest">READY NOW</span>
              </>
            ) : (
              <>
                <span className="text-white font-black font-mono text-[40px] leading-none">{h}</span>
                <span className="text-[#666] text-[9px] font-black tracking-widest mt-1">ORE AL RECUPERO</span>
              </>
            )}
          </div>
        </div>

        {/* Recommendation + date */}
        <div
          className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl mt-5 w-full"
          style={{ background: `${recColor}14`, border: `1px solid ${recColor}44` }}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: recColor, boxShadow: `0 0 6px ${recColor}` }} />
            <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: recColor }}>
              {recLabel}
            </span>
          </div>
          {readyAtLabel && (
            <div className="text-[10px] tracking-wider font-black" style={{ color: `${recColor}BB` }}>
              {readyAtLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardView() {
  const { data: dashData, loading: dashLoading, error: dashError, refetch: refetchDashboard } =
    useApi<DashboardResponse>(getDashboard);
  const { data: runsData } = useApi<RunsResponse>(getRuns);
  const { data: analyticsData } = useApi<AnalyticsResponse>(getAnalytics);
  const { data: effortsData } = useApi<{ efforts: BestEffort[] }>(getBestEfforts);
  const { data: vdotPacesData } = useApi<VdotPacesResponse>(getVdotPaces);
  const { data: profileData } = useApi<Profile>(getProfile);
  const { data: insightData } = useApi<{ insight: string | null }>(getDashboardInsight);

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { layouts, onLayoutChange, resetLayout, hiddenKeys, hideWidget, restoreWidget } = useLayout();
  const [openAddMenu, setOpenAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const interval = window.setInterval(refetchDashboard, 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [refetchDashboard]);
  useEffect(() => {
    if (!openAddMenu) return;
    const onClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setOpenAddMenu(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openAddMenu]);
  const hiddenMeta = WIDGET_REGISTRY.filter((w) => hiddenKeys.includes(w.key));
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [chartPeriod, setChartPeriod] = useState<'7d' | 'month' | 'year'>('year');
  const runs = runsData?.runs ?? [];
  const vdot = analyticsData?.vdot ?? null;

  const ff = dashData?.current_ff ?? null;
  const tsb = ff?.tsb ?? null;
  const ctl = ff?.ctl ?? 0;
  const atl = ff?.atl ?? 0;

  // Fatigue color — shared across Status of Form, Fatigue card, Next Optimal Session
  // Red when ATL > 50 (high fatigue), amber 30-50, green < 30
  const faticaColor = atl > 50 ? "#F43F5E" : atl > 30 ? "#F59E0B" : "#C0FF00";
  const faticaLabel = atl > 50 ? "HIGH" : atl > 30 ? "MODERATE" : "LOW";

  // Peak Score — map TSB [-40..+30] → [0..100]. Linear, clamped.
  // tsb=-30 → ~14, tsb=-10 → ~43, tsb=0 → ~57, tsb=+20 → ~86
  const readiness = tsb !== null ? Math.max(0, Math.min(100, ((tsb + 40) / 70) * 100)) : null;
  const gaugeOffset = readiness !== null ? 251.2 * (1 - readiness / 100) : 251.2;

  const status =
    tsb === null
      ? { label: "—",          color: "#64748B" }
      : tsb > 10
      ? { label: "FRESH",      color: "#C0FF00" }
      : tsb > -5
      ? { label: "NEUTRAL",    color: "#14B8A6" }
      : tsb > -20
      ? { label: "FATIGUED",   color: "#F59E0B" }
      : { label: "OVERLOADED", color: "#F43F5E" };

  const chartData = useMemo(() => {
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (chartPeriod === '7d') {
      const now = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        const ds = toLocal(d);
        const km = runs.filter(r => r.date.slice(0,10) === ds).reduce((s, r) => s + r.distance_km, 0);
        const label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0,3).toUpperCase();
        return { day: label, km: Math.round(km*10)/10 };
      });
    } else if (chartPeriod === 'month') {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const days = new Date(year, month+1, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const km = runs.filter(r => r.date.slice(0,10) === ds).reduce((s, r) => s + r.distance_km, 0);
        return { day: String(day), km: Math.round(km*10)/10 };
      });
    } else {
      // Last 12 months rolling — same pattern as StatisticsView
      const now = new Date();
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        const monthRuns = runs.filter(r => {
          const rd = new Date(r.date);
          return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
        });
        const km = monthRuns.reduce((s, r) => s + r.distance_km, 0);
        const label = d.toLocaleDateString('en', { month: 'short' }).toUpperCase();
        return { day: label, km: Math.round(km * 10) / 10 };
      });
    }
  }, [runs, chartPeriod]);

  // Weekly km total (last 7 days)
  const weeklyKmTotal = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 6);
    cutoff.setHours(0, 0, 0, 0);
    return runs
      .filter(r => new Date(r.date) >= cutoff)
      .reduce((s, r) => s + r.distance_km, 0);
  }, [runs]);

  const avgPace = useMemo(() => {
    const recent = runs.slice(0, 5).filter((r) => !r.is_treadmill && r.avg_pace && parsePaceToSecs(r.avg_pace) > 100);
    if (!recent.length) return "--";
    const avg = recent.reduce((sum, r) => sum + parsePaceToSecs(r.avg_pace), 0) / recent.length;
    return secsToPaceStr(avg);
  }, [runs]);


  const profile = dashData?.profile;
  const maxHr = profile?.max_hr ?? 180;
  // Anaerobic threshold HR — Daniels: T-pace ~88% VO2max ≈ 88-90% HRmax
  // (not 92% → that's already VO2max / I-pace territory)
  const atHr = Math.round(maxHr * 0.88);
  const ltHr = Math.round(maxHr * 0.85);

  const raceDate = profile?.race_date;
  const timeToRace = raceDate ? timeUntil(raceDate) : null;
  const daysToRace = timeToRace?.days ?? null;

  const weekProgress = dashData?.week_progress;
  const nextSession = dashData?.next_session;

  const efficiency = tsb !== null
    ? Math.max(70, Math.min(100, 85 + tsb * 1.05))
    : null;
  const tsbValue = tsb !== null ? tsb.toFixed(1) : "—";
  const ctlValue = ctl > 0 ? ctl.toFixed(1) : "—";
  const effValue = efficiency !== null ? efficiency.toFixed(1) : "—";
  const atlValue = atl > 0 ? atl.toFixed(1) : "—";

  // ─── Human-friendly metaphors (no jargon) ─────────────────────────────
  const tsbMeta = (() => {
    if (tsb === null) return { icon: "🪫", label: "—", sub: "Dati non disponibili", color: "#64748B" };
    if (tsb > 10)   return { icon: "🔋", label: "Pieno",    sub: "Sei fresco, spingi!",        color: "#C0FF00" };
    if (tsb > -5)   return { icon: "🔋", label: "Buono",    sub: "Equilibrio perfetto",        color: "#14B8A6" };
    if (tsb > -15)  return { icon: "🪫", label: "Medio",    sub: "Fase di allenamento",        color: "#F59E0B" };
    if (tsb > -25)  return { icon: "🪫", label: "Scarico",  sub: "Recupera!",                  color: "#F59E0B" };
    return              { icon: "🔴", label: "Critico",  sub: "Stop, rischio infortuni",     color: "#F43F5E" };
  })();

  const ctlMeta = (() => {
    if (ctl <= 0)  return { icon: "🚗", label: "—",         sub: "Nessun dato"         };
    if (ctl < 20)  return { icon: "🛴", label: "Base",      sub: "In crescita"         };
    if (ctl < 35)  return { icon: "🚗", label: "Discreto",  sub: "Solido, continua"    };
    if (ctl < 55)  return { icon: "🏎️", label: "Potente",  sub: "Ottima base"         };
    if (ctl < 75)  return { icon: "🏎️", label: "Forte",    sub: "Atleta evoluto"      };
    return             { icon: "🚀", label: "Elite",     sub: "Top form"            };
  })();

  const atlMeta = (() => {
    if (atl <= 0)  return { icon: "💤", label: "—",         sub: "Nessun dato"            };
    if (atl < 20)  return { icon: "💨", label: "Leggero",   sub: "Molto calmo"            };
    if (atl < 35)  return { icon: "🔥", label: "Medio",     sub: "Attivo"                 };
    if (atl < 55)  return { icon: "🔥", label: "Alto",      sub: "Hai dato molto"         };
    return             { icon: "🌋", label: "Estremo",   sub: "Attenzione al recupero" };
  })();

  const effMeta = (() => {
    if (efficiency === null) return { icon: "⚡", label: "—",        sub: "Dati non disponibili" };
    if (efficiency >= 92)    return { icon: "⚡", label: "Piena",    sub: "Motore al top"        };
    if (efficiency >= 82)    return { icon: "⚡", label: "Buona",    sub: "Ritmo sostenibile"    };
    if (efficiency >= 75)    return { icon: "⚠️", label: "Ridotta",  sub: "Sei un po' stanco"    };
    return                       { icon: "⚠️", label: "Bassa",    sub: "Centralina in protezione" };
  })();

  // ─── PMC (Performance Management Chart) — last 30 days ────────────────
  const pmcData = useMemo(() => {
    const ff = dashData?.fitness_freshness ?? [];
    return ff.slice(-30).map((d) => ({
      date: d.date.slice(5),
      ctl: Number(d.ctl?.toFixed?.(1) ?? 0),
      atl: Number(d.atl?.toFixed?.(1) ?? 0),
      tsb: Number(d.tsb?.toFixed?.(1) ?? 0),
    }));
  }, [dashData?.fitness_freshness]);

  const neuroBar = Math.min(100, ctl);
  const metaboBar = Math.min(100, atl);
  const struttBar = tsb !== null ? Math.min(100, Math.max(0, 50 + tsb * 2)) : 0;

  // Compute drift % for a single run (first-half vs second-half HR)
  const computeDrift = (r: Run): number | null => {
    if (r.distance_km < 4 || !r.splits || r.splits.length < 4) return null;
    const splits = r.splits.filter(s => s.hr && s.hr > 80 && s.pace && s.pace.includes(":"));
    if (splits.length < 4) return null;
    const mid = Math.floor(splits.length / 2);
    const avgHr = (arr: typeof splits) => arr.reduce((s, x) => s + (x.hr ?? 0), 0) / arr.length;
    const hr1 = avgHr(splits.slice(0, mid));
    const hr2 = avgHr(splits.slice(mid));
    if (!hr1) return null;
    return Math.round(((hr2 - hr1) / hr1) * 1000) / 10;
  };

  const lastDrift = useMemo(() => {
    const qualifying = runs.find(r => r.distance_km >= 4 && r.splits?.length >= 4);
    return qualifying ? computeDrift(qualifying) : null;
  }, [runs]);

  // Drift over last N qualifying runs (for Cardiac Drift card sparkline)
  const driftSeries = useMemo(() => {
    const out: { date: string; drift: number }[] = [];
    for (const r of runs) {
      if (out.length >= 12) break;
      const d = computeDrift(r);
      if (d !== null) out.push({ date: r.date, drift: d });
    }
    return out.reverse(); // oldest → newest
  }, [runs]);

  // Threshold pace — Daniels T-pace dal VDOT (88% VO2max).
  // Fonte primaria = VDOT corrente (sempre affidabile).
  // Override solo se ≥3 corse recenti nel range HR 86–91% HRmax (vera soglia),
  // altrimenti il filtro largo mescola M-pace/I-pace e distorce la mediana.
  const thresholdPace = useMemo(() => {
    const v = analyticsData?.vdot;
    let vdotPaceSecs: number | null = null;
    if (v) {
      // Daniels: T-pace = pace @ 88% VO2max. Risolvi VO2 = -4.60 + 0.182258·v + 0.000104·v²
      const vo2 = v * 0.88;
      const disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60);
      if (disc >= 0) {
        const speedMpm = (-0.182258 + Math.sqrt(disc)) / (2 * 0.000104);
        if (speedMpm > 0) vdotPaceSecs = Math.round(60000 / speedMpm); // sec/km
      }
    }

    const tempoRuns = runs.filter(r => {
      if (r.is_treadmill || !r.avg_hr_pct || r.distance_km < 3) return false;
      const pct = r.avg_hr_pct > 1 ? r.avg_hr_pct / 100 : r.avg_hr_pct;
      return pct >= 0.86 && pct <= 0.91;
    }).slice(0, 8);

    if (tempoRuns.length >= 3) {
      const paces = tempoRuns
        .map(r => parsePaceToSecs(r.avg_pace))
        .filter(s => s > 0)
        .sort((a, b) => a - b);
      if (paces.length) {
        return secsToPaceStr(paces[Math.floor(paces.length / 2)]);
      }
    }

    if (vdotPaceSecs) return secsToPaceStr(Math.max(150, Math.min(500, vdotPaceSecs)));
    return null;
  }, [runs, analyticsData?.vdot]);

  const gpsRuns = runs.filter(r => !r.is_treadmill);
  const recentRuns = runs.slice(0, 7);
  const lastRun = gpsRuns[0] ?? null;

  // ── Sparkline: km settimanali ultimi 10 settimane (Status of Form nel tempo)
  const sparklinePoints = useMemo(() => {
    const weeks = Array.from({ length: 10 }, (_, i) => {
      const end = new Date(); end.setDate(end.getDate() - (9 - i) * 7 + 7);
      const start = new Date(end); start.setDate(end.getDate() - 7);
      return runs.filter(r => { const d = new Date(r.date); return d >= start && d < end; })
                 .reduce((s, r) => s + r.distance_km, 0);
    });
    const max = Math.max(...weeks, 1);
    // SVG path: 100×32, points spaced 11px apart
    const pts = weeks.map((v, i) => `${i * 11},${32 - (v / max) * 28}`).join(' ');
    return { pts, hasData: weeks.some(v => v > 0) };
  }, [runs]);

  // Hall of Fame — real PRs from /api/best-efforts (same as Profile)
  const allEfforts = effortsData?.efforts ?? [];
  const hofEfforts = useMemo(() => {
    const targets = ['5 km', '10 km', 'Mezza Maratona'];
    return targets.map(dist => allEfforts.find(e => e.distance === dist) ?? null);
  }, [allEfforts]);

  // ─── Race Predictions (Strava-style multi-distance) ────────────────────────
  // Target 4 distances: 5K, 10K, Half Marathon, Marathon.
  // Match loosely against prediction keys returned by /api/analytics.
  // Delta = impatto della ULTIMA corsa sulla previsione.
  //   Confronto pace ultima corsa vs mediana pace ultime 5 precedenti.
  //   Proiezione su distanza target via Riegel (deltaSec ≈ paceDelta_sec/km × D_km × (D_km/lastD)^0.06)
  const predictions = analyticsData?.race_predictions ?? {};

  // ── Previsione Gara — stimolo fisiologico dell'ultima corsa proiettato su 5K/10K/21K/42K
  //   Classifica ultima corsa (intervals / tempo / medium_long / long_endurance / easy)
  //   Moltiplica benefit table[stim][target] × magnitudine volume × boost intensità
  //   Esempio target: 10K @ 5:50 @ 147bpm (tempo, magnitude≈1) → 5K≈-5s, 10K≈-13s, 21K≈-40s, 42K≈-62s
  const racePredictions = useMemo(() => {
    const keys = Object.keys(predictions);
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace("kilometre", "k").replace("km", "k");
    const findKey = (patterns: string[]) =>
      keys.find(k => patterns.some(p => norm(k).includes(p))) ?? null;

    const targets: { label: string; short: '5K'|'10K'|'21K'|'42K'; km: number; patterns: string[] }[] = [
      { label: "5K",       short: "5K",  km: 5,       patterns: ["5k"] },
      { label: "10K",      short: "10K", km: 10,      patterns: ["10k"] },
      { label: "Mezza",    short: "21K", km: 21.0975, patterns: ["half", "mezza", "21"] },
      { label: "Maratona", short: "42K", km: 42.195,  patterns: ["marathon", "maratona", "42"] },
    ];

    // Identifica ultima corsa outdoor valida
    const valid = runs.filter(r =>
      !r.is_treadmill && r.avg_pace && parsePaceToSecs(r.avg_pace) > 180 && r.distance_km >= 3
    );
    const last = valid[0] ?? null;

    type Stim = 'intervals' | 'tempo' | 'medium_long' | 'long_endurance' | 'easy';

    // Benefit table: secondi stimati per stimolo "tipico" (magnitudine 1.0) su ogni distanza
    // Calibrato su esempio utente: tempo 10km @ threshold → -5/-13/-40/-62
    const BENEFIT: Record<Stim, Record<'5K'|'10K'|'21K'|'42K', number>> = {
      intervals:      { '5K': 8,  '10K': 6,  '21K': 3,  '42K': 2   },
      tempo:          { '5K': 5,  '10K': 13, '21K': 40, '42K': 62  },
      medium_long:    { '5K': 2,  '10K': 8,  '21K': 45, '42K': 95  },
      long_endurance: { '5K': 1,  '10K': 4,  '21K': 30, '42K': 130 },
      easy:           { '5K': 1,  '10K': 2,  '21K': 6,  '42K': 12  },
    };
    const TYPICAL_KM: Record<Stim, number> = {
      intervals: 6, tempo: 10, medium_long: 18, long_endurance: 30, easy: 8,
    };

    let stim: Stim | null = null;
    let magnitude = 0;
    if (last) {
      const distKm = last.distance_km;
      const paceSec = parsePaceToSecs(last.avg_pace);
      const hrPct = last.avg_hr_pct != null
        ? (last.avg_hr_pct > 1 ? last.avg_hr_pct / 100 : last.avg_hr_pct)
        : null;
      // paceRatio: 1.0 = a soglia, >1 più veloce (più duro), <1 più lento (facile)
      const tPaceSec = thresholdPace ? parsePaceToSecs(thresholdPace) : null;
      const paceRatio = tPaceSec && paceSec > 0
        ? tPaceSec / paceSec
        : hrPct !== null
          ? hrPct / 0.87  // 87% HR ~ soglia
          : 1.0;

      // Classifica stimolo
      if (distKm >= 25) stim = 'long_endurance';
      else if (distKm >= 15 && paceRatio < 1.03) stim = 'medium_long';
      else if (paceRatio >= 1.05 && distKm < 8) stim = 'intervals';
      else if (paceRatio >= 0.92) stim = 'tempo';
      else if (hrPct !== null && hrPct < 0.72) stim = 'easy';
      else stim = 'tempo';

      // Magnitudine = volume relativo vs sessione "tipica" del suo stimolo, clamp [0.2, 2.0]
      magnitude = Math.max(0.2, Math.min(2.0, distKm / TYPICAL_KM[stim]));
      // Boost intensità se pace > soglia
      if (paceRatio > 1.0) magnitude *= 1 + (paceRatio - 1) * 0.8;
      magnitude = Math.min(2.5, magnitude);
    }

    return targets.map(t => {
      const key = findKey(t.patterns);
      const timeStr = key ? predictions[key] : null;
      const secs = timeStr ? hmsToSecs(timeStr) : null;
      let deltaSec: number | null = null;
      if (stim) {
        const base = BENEFIT[stim][t.short];
        const d = Math.round(base * magnitude);
        // Miglioramento = negativo; filtro valori troppo piccoli come null
        deltaSec = d >= 1 ? -d : null;
      }
      return { label: t.label, short: t.short, km: t.km, key, timeStr, secs, deltaSec };
    });
  }, [predictions, runs, thresholdPace]);

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="px-14 py-6 max-w-[2200px] mx-auto space-y-6">

        {/* Header */}
        {dashLoading && <div className="h-10 bg-white/5 rounded-xl animate-pulse" />}
        {dashError && (
          <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            Backend connection error: {dashError}
          </div>
        )}
        {dashData && (
          <div className="mb-2 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black italic tracking-tight text-white uppercase">
                {t("dashboard.greeting")}, {profile?.name || t("dashboard.runner")} 👋
              </h2>
              <p className="text-sm text-gray-500 font-medium mt-1">
                {profile?.race_goal}
                {raceDate && ` — ${raceDate}`}
                {daysToRace !== null && (
                  <span className="ml-3 text-[#C0FF00] font-black">{t("dashboard.daysToRace", { days: daysToRace })}</span>
                )}
              </p>
            </div>
            {!isMobile && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative" ref={addMenuRef}>
                  <button
                    type="button"
                    onClick={() => setOpenAddMenu((v) => !v)}
                    disabled={hiddenMeta.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[#666] hover:text-[#C0FF00] hover:border-[#C0FF00]/30 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-[#666] disabled:hover:border-white/[0.06] text-[10px] font-black tracking-widest transition-colors"
                    title="Ripristina widget nascosti"
                  >
                    <Plus size={12} />
                    AGGIUNGI WIDGET
                    {hiddenMeta.length > 0 && (
                      <span className="bg-[#C0FF00] text-black rounded-full px-1.5 text-[9px] leading-4">
                        {hiddenMeta.length}
                      </span>
                    )}
                  </button>
                  {openAddMenu && hiddenMeta.length > 0 && (
                    <div className="absolute right-0 mt-2 w-64 bg-[#1a1a1a] border border-white/[0.08] rounded-2xl shadow-2xl z-40 p-2">
                      <div className="text-[#666] text-[9px] font-black tracking-widest uppercase px-3 py-2">
                        Archivio ({hiddenMeta.length})
                      </div>
                      {hiddenMeta.map((w) => (
                        <button
                          key={w.key}
                          type="button"
                          onClick={() => {
                            restoreWidget(w.key);
                            setOpenAddMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 text-[12px] text-white hover:bg-white/[0.06] rounded-xl flex items-center justify-between group"
                        >
                          <span>{w.label}</span>
                          <Plus size={12} className="text-[#666] group-hover:text-[#C0FF00]" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm("Ripristinare il layout predefinito?")) resetLayout();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[#666] hover:text-[#C0FF00] hover:border-[#C0FF00]/30 text-[10px] font-black tracking-widest transition-colors"
                  title="Ripristina posizioni widget"
                >
                  <RotateCcw size={12} />
                  RESET LAYOUT
                </button>
              </div>
            )}
          </div>
        )}

        <ResponsiveGrid
          className="layout"
          layouts={layouts as any}
          breakpoints={{ lg: 1200, md: 768, sm: 0 }}
          cols={{ lg: 12, md: 6, sm: 1 }}
          rowHeight={60}
          margin={[24, 24]}
          containerPadding={[0, 0]}
          isDraggable={!isMobile}
          isResizable={!isMobile}
          draggableHandle=".drag-handle"
          resizeHandles={['se']}
          onLayoutChange={onLayoutChange as any}
          useCSSTransforms={true}
        >

          {/* ── Status of Form ── */}
          {!hiddenKeys.includes("status-form") && (
          <div key="status-form">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("status-form")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">LIVE BIO-FEED</div>
                <div className="flex items-center gap-2">
                  <h2 className="text-white text-4xl font-black tracking-tighter italic">{t("dashboard.statusOfForm")}</h2>
                  <InfoTooltip title="STATUS FORMA" lines={[
                    'CTL (Fitness): e il tuo "motore" costruito nel tempo. Piu e alto, piu sei allenato.',
                    "ATL (Stanchezza): lo stress accumulato negli ultimi giorni. Indica quanto hai spinto di recente.",
                    "TSB (Forma): il bilancio tra Fitness e Stanchezza. Ti dice se oggi sei al top o ko.",
                    "Valore TSB | Stato | Obiettivo",
                    "Sopra +10 | Fresco | Momento ideale per una gara o un record.",
                    "Tra -5 e +10 | Neutro | Fase di mantenimento della forma fisica.",
                    "Tra -20 e -5 | Stanco | Fase di carico: qui e dove diventi piu forte.",
                    "Sotto -20 | Alert | Troppo stress. Riposa per evitare infortuni.",
                    'EFF (Efficienza): indica quanto lavoro produci per ogni battito cardiaco. Piu e alta, piu il tuo motore e "economico".',
                    "PEAK SCORE (0-100): il tuo semaforo della freschezza. Piu e vicino a 100, piu sei pronto a dare il massimo della tua potenza."
                  ]} />
                </div>
              </div>
              <div
                className="px-3 py-1 rounded-full text-xs font-black tracking-wide flex items-center gap-2"
                style={{
                  color: faticaColor,
                  backgroundColor: faticaColor + "18",
                  border: `1px solid ${faticaColor}35`,
                }}
              >
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: faticaColor }} />
                {status.label === "FRESH" ? t("dashboard.fresh").toUpperCase()
                  : status.label === "NEUTRAL" ? t("dashboard.neutral").toUpperCase()
                  : status.label === "FATIGUED" ? t("dashboard.fatigued").toUpperCase()
                  : status.label === "OVERLOADED" ? t("dashboard.overloaded").toUpperCase()
                  : status.label}
              </div>
            </div>

            <div className="flex items-center justify-center gap-12 flex-1">
              {/* Gauge */}
              <div className="relative w-56 h-56 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100" overflow="visible">
                  <defs>
                    <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <circle cx="50" cy="50" r="40" stroke="#222" strokeWidth="9" fill="none" />
                  <circle
                    cx="50" cy="50" r="40"
                    stroke={faticaColor}
                    strokeWidth="9"
                    fill="none"
                    strokeDasharray="251.2"
                    strokeDashoffset={gaugeOffset}
                    strokeLinecap="round"
                    filter="url(#gauge-glow)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black" style={{ color: faticaColor }}>
                    {readiness !== null ? readiness.toFixed(0) : "—"}
                  </span>
                  <span className="text-[#A0A0A0] text-xs font-black tracking-widest mt-1">{t("dashboard.peakScore").toUpperCase()}</span>
                </div>
              </div>

              {/* Metaphor stats col 1: Serbatoio (TSB) + Potenza (Efficiency) */}
              <div className="flex flex-col gap-4 min-w-[180px]">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">Il tuo serbatoio</span>
                    <span className="text-[#C0FF00]/70 text-[9px] font-black tracking-widest">TSB</span>
                  </div>
                  <div className="text-[#555] text-[9px] font-semibold italic mb-1">quanto sei fresco oggi</div>
                  <div className="text-xl font-black whitespace-nowrap" style={{ color: tsbMeta.color }}>
                    <span className="mr-1.5 font-mono tabular-nums">{tsbValue}</span>{tsbMeta.label}
                  </div>
                  <div className="text-[#888] text-[11px] font-medium mt-0.5">{tsbMeta.sub}</div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">Potenza attuale</span>
                    <span className="text-[#C0FF00]/70 text-[9px] font-black tracking-widest">EFF</span>
                  </div>
                  <div className="text-[#555] text-[9px] font-semibold italic mb-1">efficienza cuore vs ritmo</div>
                  <div className="text-white text-xl font-black whitespace-nowrap">
                    <span className="mr-1.5 font-mono tabular-nums">{effValue}</span>{effMeta.label}
                  </div>
                  <div className="text-[#888] text-[11px] font-medium mt-0.5">{effMeta.sub}</div>
                </div>
              </div>

              {/* Metaphor stats col 2: Motore (CTL) + Lavoro svolto (ATL) */}
              <div className="flex flex-col gap-4 min-w-[180px]">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">Il tuo motore</span>
                    <span className="text-[#C0FF00]/70 text-[9px] font-black tracking-widest">CTL</span>
                  </div>
                  <div className="text-[#555] text-[9px] font-semibold italic mb-1">fitness media 42 giorni</div>
                  <div className="text-white text-xl font-black whitespace-nowrap">
                    <span className="mr-1.5 font-mono tabular-nums">{ctlValue}</span>{ctlMeta.label}
                  </div>
                  <div className="text-[#888] text-[11px] font-medium mt-0.5">{ctlMeta.sub}</div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">Lavoro svolto</span>
                    <span className="text-[#C0FF00]/70 text-[9px] font-black tracking-widest">ATL</span>
                  </div>
                  <div className="text-[#555] text-[9px] font-semibold italic mb-1">carico ultimi 7 giorni</div>
                  <div className="text-white text-xl font-black whitespace-nowrap">
                    <span className="mr-1.5 font-mono tabular-nums">{atlValue}</span>{atlMeta.label}
                  </div>
                  <div className="text-[#888] text-[11px] font-medium mt-0.5">{atlMeta.sub}</div>
                </div>
              </div>
            </div>

            {/* PMC — Performance Management Chart (30d) */}
            {insightData?.insight && (
              <div className="mt-2 pt-2 border-t border-white/[0.06]">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="text-[#C0FF00] mt-0.5 shrink-0" size={14} />
                  <p className="text-[#A0A0A0] text-[12px] leading-snug whitespace-pre-line">
                    {insightData.insight}
                  </p>
                </div>
              </div>
            )}
            </div>
           </GridCard>
          </div>
          )}

          {/* ── VO2 Max ── */}
          {!hiddenKeys.includes("vo2max") && (
          <div key="vo2max">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("vo2max")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] border-t-4 border-t-[#C0FF00] rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <Wind className="text-[#C0FF00]" size={24} />
              <div className="bg-white/10 text-[#A0A0A0] px-2 py-1 rounded text-[10px] font-black tracking-widest">
                {t("dashboard.vdotScore").toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">{t("dashboard.vo2MaxEst")}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-white text-5xl font-black tracking-tight">
                  {vdot !== null ? vdot.toFixed(1) : "—"}
                </span>
                <span className="text-[#A0A0A0] text-sm font-semibold">ml/kg/min</span>
              </div>
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Previsione Gara ── */}
          {!hiddenKeys.includes("previsione-gara") && (
          <div key="previsione-gara">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("previsione-gara")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Target className="text-[#C0FF00]" size={14} />
              <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest">PREVISIONE GARA</span>
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
              {racePredictions.map(p => {
                const delta = p.deltaSec;
                const improved = delta !== null && delta < 0;
                const worsened = delta !== null && delta > 0;
                const deltaColor = improved ? "#16A34A" : worsened ? "#F43F5E" : "#64748B";
                const deltaBg    = improved ? "rgba(22,163,74,0.18)" : worsened ? "rgba(244,63,94,0.15)" : "rgba(100,116,139,0.12)";
                // Strava-style: "8m 22sec" when ≥60s, else "45sec"
                const fmtDelta = (s: number) => {
                  const a = Math.abs(s);
                  if (a >= 60) {
                    const m = Math.floor(a / 60);
                    const ss = a % 60;
                    return `${m}m ${ss.toString().padStart(2, "0")}sec`;
                  }
                  return `${a}sec`;
                };
                return (
                  <div
                    key={p.short}
                    className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                  >
                    <span className="text-[#A0A0A0] text-[11px] font-black tracking-widest w-10">
                      {p.short}
                    </span>
                    <span className="text-white text-sm font-black font-mono flex-1 text-center">
                      {p.timeStr ?? "—"}
                    </span>
                    {delta !== null && delta !== 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
                        style={{ background: deltaBg, color: deltaColor }}
                      >
                        <span className="leading-none">{improved ? "▼" : "▲"}</span>
                        <span className="leading-none font-mono">{fmtDelta(delta)}</span>
                      </span>
                    ) : (
                      <span className="text-[#555] text-[9px] font-black tracking-widest uppercase">—</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[#555] text-[9px] tracking-wider mt-3 text-center">
              stimolo fisiologico ultima corsa → beneficio per distanza
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Detraining (taper vs fermo totale) ── */}
          {!hiddenKeys.includes("detraining") && (
          <div key="detraining">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("detraining")}>
            <DetrainingWidget
              profile={profileData ?? null}
              runs={runs}
              vdot={vdot}
              base5kSec={racePredictions.find(p => p.short === '5K')?.secs ?? null}
            />
           </GridCard>
          </div>
          )}

          {/* ── Fatigue ATL ── */}
          {!hiddenKeys.includes("fatigue-atl") && (
          <div key="fatigue-atl">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("fatigue-atl")}>
            <div
              className="h-full rounded-3xl p-6 flex flex-col justify-between"
              style={{ backgroundColor: faticaColor }}
            >
            <div className="flex justify-between items-start">
              <TrendingDown className="text-black/70" size={24} />
              <div className="bg-black/10 text-black/70 px-2 py-1 rounded text-[10px] font-black tracking-widest">
                {faticaLabel}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-black/60 text-xs font-black tracking-widest">{t("dashboard.fatigueATL").toUpperCase()}</span>
                <InfoTooltip title="FATIGUE — ATL" lines={[
                  "ATL (Acute Training Load) = carico ultimi 7 giorni. Media mobile esponenziale.",
                  "ATL > 80: HIGH RISK — recupero insufficiente.",
                  "ATL 30-80: MODERATE — zona di sviluppo.",
                  "ATL < 30: LOW — fresco, carico sostenibile.",
                  "Formula TRIMP (Lucia): durata × HR_reserve × fattore esponenziale.",
                  "Aumenta dopo ogni allenamento intenso, decade in ~7 giorni."
                ]} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-black text-5xl font-black tracking-tight">
                  {atl > 0 ? atl.toFixed(1) : "—"}
                </span>
                <span className="text-black/60 text-sm font-black">{faticaLabel}</span>
              </div>
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Soglia Anaerobica ── */}
          {!hiddenKeys.includes("soglia") && (
          <div key="soglia">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("soglia")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between">
            <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4">{t("dashboard.anaerobicThreshold").toUpperCase()}</div>
            <div className="flex items-stretch gap-5 mb-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white text-3xl font-black">{atHr}</span>
                  <span className="text-[#A0A0A0] text-xs">BPM</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-[#F43F5E] inline-block" />
                  <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">FC</span>
                </div>
              </div>
              <div className="w-px bg-white/[0.08]" />
              <div className="flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white text-3xl font-black">{thresholdPace ?? "—"}</span>
                  <span className="text-[#A0A0A0] text-xs">/km</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-[#60A5FA] inline-block" />
                  <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">Passo</span>
                </div>
              </div>
            </div>
            <div className="flex gap-1 h-1.5 mt-auto">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`flex-1 rounded-full ${i < 4 ? "bg-[#F43F5E]" : "bg-[#333]"}`} />
              ))}
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Deriva Cardiaca ── */}
          {!hiddenKeys.includes("deriva") && (
          <div key="deriva">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("deriva")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest">
                {t("dashboard.cardiacDrift").toUpperCase()}
              </div>
              {lastDrift !== null && (() => {
                const abs = Math.abs(lastDrift);
                const col = abs < 3.5 ? "#C0FF00" : abs < 5 ? "#F59E0B" : "#F43F5E";
                const lbl = abs < 3.5 ? "Ottima" : abs < 5 ? "Normale" : "Elevata";
                return (
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase"
                    style={{ background: `${col}15`, border: `1px solid ${col}44`, color: col }}
                  >
                    {lbl}
                  </span>
                );
              })()}
            </div>

            {/* Big value */}
            <div className="flex items-baseline gap-2 mb-1">
              <span
                className="text-5xl font-black"
                style={{
                  color: lastDrift === null ? "#666"
                    : Math.abs(lastDrift) < 3.5 ? "#C0FF00"
                    : Math.abs(lastDrift) < 5 ? "#F59E0B" : "#F43F5E",
                }}
              >
                {lastDrift !== null ? (lastDrift >= 0 ? "+" : "") + lastDrift.toFixed(1) : "—"}
              </span>
              <span className="text-[#A0A0A0] text-sm font-black">%</span>
            </div>
            <div className="text-[#666] text-[10px] tracking-wider mb-4">
              ΔFC 2ª metà vs 1ª metà · ultima corsa
            </div>

            {/* Stats grid — media / migliore / peggiore over last qualifying runs */}
            {driftSeries.length >= 2 ? (() => {
              const vals = driftSeries.map(d => Math.abs(d.drift));
              const media = vals.reduce((s, v) => s + v, 0) / vals.length;
              const best = Math.min(...vals);
              const worst = Math.max(...vals);
              const colorFor = (v: number) => v < 3.5 ? "#C0FF00" : v < 5 ? "#F59E0B" : "#F43F5E";
              const Row = ({ label, value, color }: { label: string; value: string; color: string }) => (
                <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">{label}</span>
                  </div>
                  <span className="text-white text-sm font-black font-mono" style={{ color }}>{value}</span>
                </div>
              );
              return (
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest uppercase mb-1">
                    Ultime {driftSeries.length} corse
                  </div>
                  <Row label="Media"    value={`${media.toFixed(1)}%`} color={colorFor(media)} />
                  <Row label="Migliore" value={`${best.toFixed(1)}%`}  color={colorFor(best)} />
                  <Row label="Peggiore" value={`${worst.toFixed(1)}%`} color={colorFor(worst)} />
                </div>
              );
            })() : (
              <div className="flex-1 flex items-center justify-center text-[#666] text-[10px] font-black tracking-widest uppercase">
                dati insufficienti
              </div>
            )}

            {/* Scale bar */}
            <div className="flex gap-1 h-1 mt-3">
              {[...Array(6)].map((_, i) => {
                const driftPct = lastDrift !== null ? Math.abs(lastDrift) : 0;
                const filled = Math.round(Math.min(6, driftPct / 2));
                const color = driftPct < 3.5 ? "#C0FF00" : driftPct < 5 ? "#F59E0B" : "#F43F5E";
                return <div key={i} className="flex-1 rounded-full" style={{ backgroundColor: i < filled ? color : "#333" }} />;
              })}
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Weekly KM Chart ── */}
          {!hiddenKeys.includes("weekly-km") && (
          <div key="weekly-km">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("weekly-km")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[#A0A0A0] text-xs font-black tracking-widest">
                  {chartPeriod === '7d' ? t("dashboard.last7Days").toUpperCase() : chartPeriod === 'month' ? t("dashboard.currentMonth").toUpperCase() : t("dashboard.last12Months").toUpperCase()}
                </div>
                {chartPeriod === '7d' && (
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-[#C0FF00] text-2xl font-black">{weeklyKmTotal.toFixed(1)}</span>
                    <span className="text-[#A0A0A0] text-xs font-black">{t("dashboard.kmThisWeek").toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="flex bg-[#111] rounded-lg border border-white/[0.06] p-0.5">
                {(['7d','month','year'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={`px-3 py-1 rounded-md text-[10px] font-black tracking-wider transition-all ${
                      chartPeriod === p ? 'bg-[#C0FF00] text-black' : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {p === '7d' ? '7D' : p === 'month' ? 'MONTH' : 'YEAR'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="day" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      backgroundColor: "#111",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="km" fill="#C0FF00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Last Run Map ── */}
          {!hiddenKeys.includes("last-run-map") && (
          <div key="last-run-map">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("last-run-map")}>
            <div className="h-full rounded-3xl overflow-hidden relative">
              <div className="absolute inset-0">
                <LastRunMap run={lastRun} />
              </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Next Optimal Session ── */}
          {!hiddenKeys.includes("next-optimal") && (
          <div key="next-optimal">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("next-optimal")}>
            <div className="h-full">
              <NextOptimalSessionWidget tsb={tsb} atl={atl} ctl={ctl} runs={runs} faticaColor={faticaColor} />
            </div>
           </GridCard>
          </div>
          )}

          {/* ── HR Zones ── */}
          {!hiddenKeys.includes("hr-zones") && (
          <div key="hr-zones">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("hr-zones")}>
            <div className="h-full">
              <HRZones lastRun={lastRun} />
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Fitness Chart ── */}
          {!hiddenKeys.includes("fitness-chart") && (
          <div key="fitness-chart">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("fitness-chart")}>
            <FitnessChart ff={dashData?.fitness_freshness} />
           </GridCard>
          </div>
          )}

          {/* ── Training Paces ── */}
          {!hiddenKeys.includes("training-paces") && (
          <div key="training-paces">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("training-paces")}>
            {(() => {
              const vdot = vdotPacesData?.vdot ?? analyticsData?.vdot;
              const paces = vdotPacesData?.paces;

              const zones: { key: string; label: string; abbr: string; color: string; desc: string }[] = [
                { key: "easy",       label: "Easy / Long Run",        abbr: "E", color: "#60A5FA", desc: "Corsa facile, recupero" },
                { key: "marathon",   label: "Marathon Pace",          abbr: "M", color: "#34D399", desc: "Lungo specifico maratona" },
                { key: "threshold",  label: "Threshold / Tempo",      abbr: "T", color: "#F59E0B", desc: "Tempo run 20-40 min" },
                { key: "interval",   label: "Interval (VO2max)",      abbr: "I", color: "#F43F5E", desc: "Ripetute 800m-1600m" },
                { key: "repetition", label: "Repetition / Speed",     abbr: "R", color: "#C0FF00", desc: "Ripetizioni 200-400m" },
              ];

              // Compute range ±5% intorno al passo centrale Daniels
              const parseSecsPace = (p: string | null | undefined): number | null => {
                if (!p || !p.includes(":")) return null;
                const [m, s] = p.split(":").map(Number);
                return m * 60 + s;
              };
              const fmtSecs = (s: number): string =>
                `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

              return (
                <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-5 flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <div>
                      <div className="text-[#A0A0A0] text-[9px] font-black tracking-[0.2em] uppercase">
                        Training Paces
                      </div>
                      <div className="text-white text-xs font-black italic tracking-tight mt-0.5">
                        Zone Daniels personalizzate
                      </div>
                    </div>
                    {vdot && (
                      <div className="flex flex-col items-end">
                        <span className="text-[#A0A0A0] text-[9px] font-black tracking-widest uppercase">VDOT</span>
                        <span className="text-[#C0FF00] text-xl font-black leading-none">{vdot.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Column headers */}
                  {paces ? (
                    <>
                      <div className="grid grid-cols-[28px_1fr_auto] gap-x-3 text-[9px] font-black tracking-widest text-[#555] uppercase mb-2 px-1 shrink-0">
                        <div />
                        <div>Zone</div>
                        <div className="text-right">Passo</div>
                      </div>

                      <div className="flex flex-col gap-2 flex-1 overflow-hidden">
                        {zones.map(z => {
                          const centerSecs = parseSecsPace(paces[z.key as keyof typeof paces]);
                          if (!centerSecs) return null;
                          const loSecs = Math.round(centerSecs * 0.97);
                          const hiSecs = Math.round(centerSecs * 1.03);
                          return (
                            <div key={z.key}
                              className="grid grid-cols-[28px_1fr_auto] gap-x-3 items-center px-1 py-2 rounded-xl"
                              style={{ background: `${z.color}08`, border: `1px solid ${z.color}18` }}
                            >
                              {/* Abbr badge */}
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black"
                                style={{ background: `${z.color}22`, color: z.color }}
                              >
                                {z.abbr}
                              </div>

                              {/* Name + desc */}
                              <div className="min-w-0">
                                <div className="text-white text-[11px] font-black truncate">{z.label}</div>
                                <div className="text-[#555] text-[9px] truncate">{z.desc}</div>
                              </div>

                              {/* Pace range */}
                              <div className="text-right">
                                <div className="font-black font-mono text-[11px]" style={{ color: z.color }}>
                                  {fmtSecs(loSecs)} – {fmtSecs(hiSecs)}
                                </div>
                                <div className="text-[#555] text-[9px]">min/km</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer note */}
                      <div className="text-[#444] text-[9px] tracking-wider mt-3 shrink-0 text-center">
                        basate su formula Daniels 2013 · aggiornate automaticamente
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                      <div className="text-[#555] text-[9px] font-black tracking-widest uppercase text-center">
                        {vdot ? "Calcolo paces…" : "Nessun dato VDOT disponibile"}
                      </div>
                      {!vdot && (
                        <div className="text-[#444] text-[9px] text-center">
                          Registra una corsa a sforzo medio-alto per calibrare il VDOT
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
           </GridCard>
          </div>
          )}

          {/* ── Session Logs ── */}
          {!hiddenKeys.includes("session-logs") && (
          <div key="session-logs">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("session-logs")}>
          {recentRuns.length > 0 ? (
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 w-full overflow-auto">
            <div className="mb-8">
              <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">{t("dashboard.sessionLogs").toUpperCase()}</div>
              <h2 className="text-white text-2xl font-black tracking-tighter italic">{t("dashboard.performanceHistory")}</h2>
            </div>

            <div className="w-full">
              <div className="grid grid-cols-7 text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4 px-4">
                <div className="col-span-2">{t("dashboard.type")}</div>
                <div>{t("dashboard.date")}</div>
                <div>{t("dashboard.duration")}</div>
                <div>{t("dashboard.avgPace").toUpperCase()}</div>
                <div>{t("dashboard.teScore")}</div>
                <div className="text-right">{t("dashboard.status")}</div>
              </div>
              <div className="space-y-2">
                {recentRuns.map((run: Run) => {
                  const hrPct = run.avg_hr_pct != null
                    ? (run.avg_hr_pct > 1 ? run.avg_hr_pct / 100 : run.avg_hr_pct)
                    : null;
                  const teRaw = hrPct !== null ? hrPct * 5 : null;
                  const teLabel =
                    teRaw === null ? "—"
                    : teRaw >= 4 ? t("dashboard.highlyAerobic").toUpperCase()
                    : teRaw >= 3 ? t("dashboard.aerobic").toUpperCase()
                    : teRaw >= 2 ? t("dashboard.recovery").toUpperCase()
                    : "—";
                  const teColor =
                    teRaw === null ? "#A0A0A0"
                    : teRaw >= 4 ? "#C0FF00"
                    : teRaw >= 3 ? "#60A5FA"
                    : "#A0A0A0";
                  return (
                    <div
                      key={run.id}
                      onClick={() => navigate(`/activities/${run.id}`)}
                      className="grid grid-cols-7 items-center bg-[#111] rounded-2xl p-4 cursor-pointer hover:bg-[#1a1a1a] hover:border hover:border-white/10 transition-all"
                    >
                      <div className="col-span-2 flex items-center gap-3">
                        <Activity className="text-[#C0FF00]" size={18} />
                        <span className="text-white font-black text-sm">{run.name || run.run_type || "Run"}</span>
                      </div>
                      <div className="text-[#A0A0A0] text-sm">
                        {new Date(run.date).toLocaleDateString("en", { day: "numeric", month: "short" })}
                      </div>
                      <div className="text-white font-black text-sm">{formatDuration(run.duration_minutes)}</div>
                      <div className="text-[#A0A0A0] text-sm">{run.avg_pace}/km</div>
                      <div className="text-xs font-black" style={{ color: teColor }}>
                        {teRaw !== null ? teRaw.toFixed(1) + " · " : ""}{teLabel}
                      </div>
                      <div className="text-right text-[#C0FF00] font-black text-xs">
                        ● {t("dashboard.verified").toUpperCase()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[#666] text-[10px] font-black tracking-widest">
              NESSUNA CORSA RECENTE
            </div>
          )}
           </GridCard>
          </div>
          )}

        </ResponsiveGrid>
      </div>
    </main>
  );
}
