import { useState, useId, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";

/**
 * STATISTICS V2 — design tokens + primitive grafiche.
 *
 * Stile: "aree piene + linee spesse" (app-fitness moderna). Curve morbide
 * (Catmull-Rom), tratto 3px, riempimenti a gradiente sotto la linea, glow
 * soft, punti arrotondati, barre spesse a gradiente. Tooltip ovunque.
 *
 * Palette (invariata, validata dataviz su superficie dark):
 *   LIME #C0FF00 primaria · ORANGE #FF9500 secondaria · CYAN #22D3EE terziaria.
 * Il grigio #8E8E93 non è mai una serie: solo assi/testo secondario. Il testo
 * non indossa MAI il colore della serie (ink tokens).
 */

export const V2 = {
  bg: "#0C0C0C",
  surface: "#161616",
  surfaceUp: "#1C1C1C",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  ink: "#F2F2F2",
  inkSoft: "#A8A8AD",
  inkMuted: "#6E6E73",
  grid: "rgba(255,255,255,0.05)",
  lime: "#C0FF00",
  orange: "#FF9500",
  cyan: "#22D3EE",
  neutral: "#8E8E93",
  mono: "'JetBrains Mono', monospace",
} as const;

export const SERIES = [V2.lime, V2.orange, V2.cyan] as const;

// ─── Curva morbida (Catmull-Rom → cubic Bézier) ──────────────────────────────
type Pt = { x: number; y: number };
function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// ─── Primitive UI ─────────────────────────────────────────────────────────────

export function V2Card({ children, className = "", span = "" }: { children: ReactNode; className?: string; span?: string }) {
  return (
    <div
      className={`rounded-[26px] p-5 md:p-6 flex flex-col min-w-0 ${span} ${className}`}
      style={{ background: `linear-gradient(180deg, ${V2.surfaceUp}, ${V2.surface})`, border: `1px solid ${V2.border}` }}
    >
      {children}
    </div>
  );
}

export function V2Label({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <span className="text-[11px] font-black tracking-[0.16em] uppercase" style={{ color: V2.ink }}>{children}</span>
      {right && <span className="text-[9px] tracking-[0.14em] uppercase" style={{ color: V2.inkMuted, fontFamily: V2.mono }}>{right}</span>}
    </div>
  );
}

/** Hero number tile — barra-accento a gradiente sopra, numero grande. */
export function V2Stat({ label, value, unit, sub, accent = V2.lime }: {
  label: string; value: string; unit?: string; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-[22px] p-5 flex flex-col justify-between min-w-0 relative overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${accent}0F, ${V2.surface} 55%)`, border: `1px solid ${V2.border}` }}>
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span className="text-[9px] font-black tracking-[0.18em] uppercase truncate" style={{ color: V2.inkSoft, fontFamily: V2.mono }}>{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl md:text-[2.4rem] font-black tabular-nums leading-none" style={{ color: V2.ink, fontFamily: V2.mono }}>{value}</span>
        {unit && <span className="text-xs font-bold" style={{ color: V2.inkMuted }}>{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[10px] leading-4" style={{ color: V2.inkMuted }}>{sub}</div>}
    </div>
  );
}

export function V2Tip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute z-20 rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{ left: x, top: y, transform: "translate(-50%, calc(-100% - 12px))", background: "#000000", border: `1px solid ${V2.borderStrong}`, color: V2.ink, whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}

export function V2TipRow({ swatch, label, value }: { swatch?: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 leading-5">
      {swatch && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: swatch }} />}
      <span style={{ color: V2.inkSoft }}>{label}</span>
      <span className="ml-auto pl-3 font-black tabular-nums" style={{ color: V2.ink, fontFamily: V2.mono }}>{value}</span>
    </div>
  );
}

export function V2Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[10px] font-bold" style={{ color: V2.inkSoft }}>
          <span className="w-3 h-3 rounded-full" style={{ background: it.color, boxShadow: `0 0 6px ${it.color}88` }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ─── BARRE SPESSE A GRADIENTE (magnitudine per categoria) ─────────────────────
export interface HBarRow { label: string; value: number; detail?: string; color?: string }

export function V2HBars({ rows, unit, maxOverride }: { rows: HBarRow[]; unit: string; maxOverride?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(maxOverride ?? 0, ...rows.map((r) => r.value), 0.001);
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => {
        const pct = Math.max(2, (r.value / max) * 100);
        const active = hover === i;
        const c = r.color ?? V2.lime;
        return (
          <div key={r.label + i} className="grid items-center gap-3" style={{ gridTemplateColumns: "72px 1fr 68px" }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="text-[10px] font-bold tabular-nums truncate" style={{ color: active ? V2.ink : V2.inkMuted, fontFamily: V2.mono }}>{r.label}</span>
            <div className="h-[18px] rounded-full relative overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${c}AA, ${c})`,
                  boxShadow: active ? `0 0 14px ${c}88` : `0 0 6px ${c}44`,
                  opacity: hover === null || active ? 1 : 0.4,
                }} />
            </div>
            <span className="text-[12px] font-black tabular-nums text-right" style={{ color: active ? V2.ink : V2.inkSoft, fontFamily: V2.mono }}>
              {r.value % 1 === 0 ? r.value : r.value.toFixed(1)}<span className="text-[9px] font-bold ml-0.5" style={{ color: V2.inkMuted }}>{unit}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── AREA LINE morbida, tratto spesso, riempimento a gradiente, hover ─────────
export interface StepPoint { label: string; value: number | null; detail?: string }

export function V2StepLine({ points, color = V2.lime, unit, height = 190, fmt }: {
  points: StepPoint[]; color?: string; unit: string; height?: number; fmt?: (v: number) => string;
}) {
  const gid = useId().replace(/[:]/g, "");
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null);
  const W = 720, H = height, padL = 10, padR = 10, padT = 16, padB = 24;
  const valid = points.filter((p): p is StepPoint & { value: number } => p.value != null);
  if (valid.length < 2) {
    return <div className="h-[120px] grid place-items-center text-[10px] uppercase tracking-widest" style={{ color: V2.inkMuted }}>Dati insufficienti</div>;
  }
  const vals = valid.map((p) => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i: number) => padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const fmtV = fmt ?? ((v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1)));

  const xy: Pt[] = [];
  points.forEach((p, i) => { if (p.value != null) xy.push({ x: x(i), y: y(p.value) }); });
  const lineD = smoothPath(xy);
  const areaD = `${lineD} L ${xy[xy.length - 1].x.toFixed(1)} ${H - padB} L ${xy[0].x.toFixed(1)} ${H - padB} Z`;

  const onMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let best = -1, bestDist = Infinity;
    points.forEach((p, i) => { if (p.value == null) return; const dd = Math.abs(x(i) - relX); if (dd < bestDist) { bestDist = dd; best = i; } });
    if (best >= 0 && points[best].value != null) setHover({ i: best, px: (x(best) / W) * rect.width, py: (y(points[best].value!) / H) * rect.height });
  };

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.42} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke={V2.grid} strokeWidth={1} />
        ))}
        <path d={areaD} fill={`url(#area-${gid})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 2px 6px ${color}55)` }} />
        {hover && <line x1={x(hover.i)} x2={x(hover.i)} y1={padT} y2={H - padB} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />}
        {points.map((p, i) =>
          p.value == null ? null : (
            <circle key={i} cx={x(i)} cy={y(p.value)} r={hover?.i === i ? 6 : 0}
              fill={color} stroke="#000" strokeWidth={2} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
          ),
        )}
        {points.map((p, i) => (i % labelStep === 0
          ? <text key={`l${i}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fontFamily={V2.mono} fill={V2.inkMuted}>{p.label}</text>
          : null))}
      </svg>
      {hover && points[hover.i].value != null && (
        <V2Tip x={hover.px} y={hover.py}>
          <V2TipRow swatch={color} label={points[hover.i].detail ?? points[hover.i].label} value={`${fmtV(points[hover.i].value!)} ${unit}`} />
        </V2Tip>
      )}
    </div>
  );
}

// ─── DOT STRIP (scatter con dot grandi + glow) ────────────────────────────────
export interface DotPoint { x: number; y: number; label: string; detail: string; color?: string }

export function V2Dots({ dots, xUnit, yFmt, height = 210, xTicks }: {
  dots: DotPoint[]; xUnit: string; yFmt: (v: number) => string; height?: number; xTicks?: number[];
}) {
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null);
  const W = 720, H = height, padL = 48, padR = 14, padT = 14, padB = 28;
  if (dots.length < 3) {
    return <div className="h-[120px] grid place-items-center text-[10px] uppercase tracking-widest" style={{ color: V2.inkMuted }}>Dati insufficienti</div>;
  }
  const xs = dots.map((d) => d.x), ys = dots.map((d) => d.y);
  const xLo = Math.min(...xs), xHi = Math.max(...xs), yLo = Math.min(...ys), yHi = Math.max(...ys);
  const xSpan = xHi - xLo || 1, ySpan = yHi - yLo || 1;
  const px = (v: number) => padL + ((v - xLo) / xSpan) * (W - padL - padR);
  const py = (v: number) => padT + (1 - (v - yLo) / ySpan) * (H - padT - padB);
  const ticks = xTicks ?? [xLo, (xLo + xHi) / 2, xHi];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
        {[0.33, 0.66].map((f) => (
          <line key={f} x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke={V2.grid} strokeWidth={1} />
        ))}
        <text x={6} y={py(yHi) + 4} fontSize={10} fontFamily={V2.mono} fill={V2.inkMuted}>{yFmt(yHi)}</text>
        <text x={6} y={py(yLo) + 4} fontSize={10} fontFamily={V2.mono} fill={V2.inkMuted}>{yFmt(yLo)}</text>
        {ticks.map((tk) => (
          <text key={tk} x={px(tk)} y={H - 8} textAnchor="middle" fontSize={10} fontFamily={V2.mono} fill={V2.inkMuted}>{Math.round(tk)}{xUnit}</text>
        ))}
        {dots.map((dot, i) => {
          const c = dot.color ?? V2.lime;
          const on = hover?.i === i;
          return (
            <circle key={i} cx={px(dot.x)} cy={py(dot.y)} r={on ? 8 : 5}
              fill={c} stroke="#000" strokeWidth={on ? 2 : 1.5}
              opacity={hover === null || on ? 0.95 : 0.28}
              style={on ? { filter: `drop-shadow(0 0 8px ${c})` } : undefined}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ i, px: (px(dot.x) / W) * rect.width, py: (py(dot.y) / H) * rect.height });
              }} />
          );
        })}
      </svg>
      {hover && (
        <V2Tip x={hover.px} y={hover.py}>
          <div className="font-black mb-0.5" style={{ fontFamily: V2.mono }}>{dots[hover.i].label}</div>
          <div style={{ color: V2.inkSoft }}>{dots[hover.i].detail}</div>
        </V2Tip>
      )}
    </div>
  );
}

// ─── RADIAL GAUGE spesso a gradiente + glow ───────────────────────────────────
export function V2Gauge({ pct, label, sub, color = V2.lime, size = 118 }: {
  pct: number; label: string; sub?: string; color?: string; size?: number;
}) {
  const gid = useId().replace(/[:]/g, "");
  const stroke = 11;
  const R = (size - stroke - 4) / 2, C = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <defs>
            <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.65} />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={`url(#g-${gid})`} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - clamped / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 0.9s ease", filter: `drop-shadow(0 0 5px ${color}88)` }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-lg font-black tabular-nums" style={{ color: V2.ink, fontFamily: V2.mono }}>{Math.round(clamped)}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: V2.inkSoft, fontFamily: V2.mono }}>{label}</div>
        {sub && <div className="text-[9px] mt-0.5" style={{ color: V2.inkMuted }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Helpers dati ─────────────────────────────────────────────────────────────

export const paceToSec = (p?: string | null): number | null => {
  if (!p || !p.includes(":")) return null;
  const [m, s] = p.split(":");
  const v = parseInt(m, 10) * 60 + parseInt(s, 10);
  return Number.isFinite(v) && v > 0 ? v : null;
};

export const secToPace = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function mondayOf(ref: Date): Date {
  const d = new Date(ref);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export const MONTHS_IT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
