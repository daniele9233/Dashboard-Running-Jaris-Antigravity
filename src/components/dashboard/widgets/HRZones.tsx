import { useState, useMemo } from "react";
import type { Run } from "../../../types/api";

/**
 * HRZones — donut chart with per-zone time distribution from last run splits.
 *
 * Estratto da DashboardView.tsx (round 5 — #14 god component split).
 * Pure presentational: riceve `lastRun` e calcola distribuzione zone interna.
 *
 * Zone Daniels:
 *   Z1 Recovery   50-69%  blue
 *   Z2 Endurance  69-78%  green
 *   Z3 Tempo      78-86%  amber
 *   Z4 Threshold  86-92%  orange
 *   Z5 VO2        92-100% rose
 */
export function HRZones({ lastRun }: { lastRun: Run | null }) {
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
