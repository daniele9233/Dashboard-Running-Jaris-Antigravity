import { useState, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";

/**
 * STATISTICS V2 — design tokens + primitive condivise.
 *
 * Linguaggio "bento flat" (dalla palette board): superfici PIATTE #161616 su
 * sfondo #0E0E0E, bordi hairline, angoli 24px, label JetBrains Mono uppercase.
 * Niente glassmorphism/gradient-glow (quello è il linguaggio della v1).
 *
 * Colori serie (validati su superficie dark, CVD ΔE ≥ 10, contrasto ≥ 3:1):
 *   LIME #C0FF00 primaria · ORANGE #FF9500 secondaria · CYAN #22D3EE terziaria.
 * Il grigio #8E8E93 non è mai una serie: solo griglie/assi/testo secondario.
 * Il testo non indossa MAI il colore della serie (ink tokens).
 */

export const V2 = {
  bg: "#0E0E0E",
  surface: "#161616",
  surfaceUp: "#1C1C1C",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.14)",
  ink: "#F2F2F2",
  inkSoft: "#A8A8AD",
  inkMuted: "#6E6E73",
  grid: "rgba(255,255,255,0.06)",
  lime: "#C0FF00",
  orange: "#FF9500",
  cyan: "#22D3EE",
  neutral: "#8E8E93",
  mono: "'JetBrains Mono', monospace",
} as const;

export const SERIES = [V2.lime, V2.orange, V2.cyan] as const;

// ─── Primitive UI ─────────────────────────────────────────────────────────────

export function V2Card({ children, className = "", span = "" }: { children: ReactNode; className?: string; span?: string }) {
  return (
    <div
      className={`rounded-3xl p-5 md:p-6 flex flex-col min-w-0 ${span} ${className}`}
      style={{ background: V2.surface, border: `1px solid ${V2.border}` }}
    >
      {children}
    </div>
  );
}

export function V2Label({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <span className="text-[10px] font-bold tracking-[0.22em] uppercase" style={{ color: V2.inkSoft, fontFamily: V2.mono }}>
        {children}
      </span>
      {right && <span className="text-[9px] tracking-[0.14em] uppercase" style={{ color: V2.inkMuted, fontFamily: V2.mono }}>{right}</span>}
    </div>
  );
}

/** Hero number tile — quando il dato è UN numero, niente grafico. */
export function V2Stat({ label, value, unit, sub, accent = V2.lime }: {
  label: string; value: string; unit?: string; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-3xl p-5 flex flex-col justify-between min-w-0" style={{ background: V2.surface, border: `1px solid ${V2.border}` }}>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
        <span className="text-[9px] font-bold tracking-[0.2em] uppercase truncate" style={{ color: V2.inkSoft, fontFamily: V2.mono }}>{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl md:text-4xl font-black tabular-nums leading-none" style={{ color: V2.ink, fontFamily: V2.mono }}>{value}</span>
        {unit && <span className="text-xs font-bold" style={{ color: V2.inkMuted }}>{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[10px] leading-4" style={{ color: V2.inkMuted }}>{sub}</div>}
    </div>
  );
}

/** Tooltip flottante ancorato al mouse (posizione relativa al wrapper). */
export function V2Tip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{
        left: x, top: y, transform: "translate(-50%, calc(-100% - 10px))",
        background: "#0A0A0A", border: `1px solid ${V2.borderStrong}`, color: V2.ink, whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

export function V2TipRow({ swatch, label, value }: { swatch?: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 leading-5">
      {swatch && <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: swatch }} />}
      <span style={{ color: V2.inkSoft }}>{label}</span>
      <span className="ml-auto pl-3 font-black tabular-nums" style={{ color: V2.ink, fontFamily: V2.mono }}>{value}</span>
    </div>
  );
}

/** Legenda: swatch + label in ink (mai testo colorato). */
export function V2Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[10px] font-bold" style={{ color: V2.inkSoft }}>
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ─── BARRE ORIZZONTALI (magnitudine per categoria) ────────────────────────────
export interface HBarRow { label: string; value: number; detail?: string; color?: string }

export function V2HBars({ rows, unit, maxOverride }: { rows: HBarRow[]; unit: string; maxOverride?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(maxOverride ?? 0, ...rows.map((r) => r.value), 0.001);
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r, i) => {
        const pct = Math.max(1.5, (r.value / max) * 100);
        const active = hover === i;
        return (
          <div key={r.label + i} className="grid items-center gap-3" style={{ gridTemplateColumns: "72px 1fr 64px" }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="text-[10px] font-bold tabular-nums truncate" style={{ color: active ? V2.ink : V2.inkMuted, fontFamily: V2.mono }}>{r.label}</span>
            <div className="h-[14px] rounded-[4px] relative" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div
                className="absolute inset-y-0 left-0 rounded-[4px] transition-all duration-300"
                style={{ width: `${pct}%`, background: r.color ?? V2.lime, opacity: hover === null || active ? 1 : 0.35 }}
              />
            </div>
            <span className="text-[11px] font-black tabular-nums text-right" style={{ color: active ? V2.ink : V2.inkSoft, fontFamily: V2.mono }}>
              {r.value % 1 === 0 ? r.value : r.value.toFixed(1)}<span className="text-[9px] font-bold ml-0.5" style={{ color: V2.inkMuted }}>{unit}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── STEP-LINE SVG con hover crosshair + tooltip ──────────────────────────────
export interface StepPoint { label: string; value: number | null; detail?: string }

export function V2StepLine({ points, color = V2.lime, unit, height = 180, fmt }: {
  points: StepPoint[]; color?: string; unit: string; height?: number; fmt?: (v: number) => string;
}) {
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null);
  const W = 720, H = height, padL = 8, padR = 8, padT = 14, padB = 22;
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

  let d = "";
  points.forEach((p, i) => {
    if (p.value == null) return;
    const px = x(i), py = y(p.value);
    d += d === "" ? `M ${px} ${py}` : ` H ${px} V ${py}`;
  });

  const onMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let best = -1, bestDist = Infinity;
    points.forEach((p, i) => {
      if (p.value == null) return;
      const dd = Math.abs(x(i) - relX);
      if (dd < bestDist) { bestDist = dd; best = i; }
    });
    if (best >= 0 && points[best].value != null) {
      setHover({ i: best, px: (x(best) / W) * rect.width, py: (y(points[best].value!) / H) * rect.height });
    }
  };

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke={V2.grid} strokeWidth={1} />
        ))}
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) =>
          p.value == null ? null : (
            <circle key={i} cx={x(i)} cy={y(p.value)} r={hover?.i === i ? 5 : 3}
              fill={hover?.i === i ? color : V2.surface} stroke={color} strokeWidth={2} />
          ),
        )}
        {hover && <line x1={x(hover.i)} x2={x(hover.i)} y1={padT} y2={H - padB} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />}
        {points.map((p, i) =>
          i % labelStep === 0 ? (
            <text key={`l${i}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fontFamily={V2.mono} fill={V2.inkMuted}>{p.label}</text>
          ) : null,
        )}
      </svg>
      {hover && points[hover.i].value != null && (
        <V2Tip x={hover.px} y={hover.py}>
          <V2TipRow swatch={color} label={points[hover.i].detail ?? points[hover.i].label} value={`${fmtV(points[hover.i].value!)} ${unit}`} />
        </V2Tip>
      )}
    </div>
  );
}

// ─── DOT STRIP (distribuzione per punto, es. temp→passo) ─────────────────────
export interface DotPoint { x: number; y: number; label: string; detail: string; color?: string }

export function V2Dots({ dots, xUnit, yFmt, height = 200, xTicks }: {
  dots: DotPoint[]; xUnit: string; yFmt: (v: number) => string; height?: number; xTicks?: number[];
}) {
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null);
  const W = 720, H = height, padL = 46, padR = 12, padT = 12, padB = 26;
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
          <text key={tk} x={px(tk)} y={H - 8} textAnchor="middle" fontSize={10} fontFamily={V2.mono} fill={V2.inkMuted}>
            {Math.round(tk)}{xUnit}
          </text>
        ))}
        {dots.map((dot, i) => (
          <circle key={i} cx={px(dot.x)} cy={py(dot.y)} r={hover?.i === i ? 7 : 4.5}
            fill={dot.color ?? V2.lime} stroke={V2.surface} strokeWidth={2}
            opacity={hover === null || hover.i === i ? 0.95 : 0.3}
            onMouseEnter={(e) => {
              const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              setHover({ i, px: (px(dot.x) / W) * rect.width, py: (py(dot.y) / H) * rect.height });
            }}
          />
        ))}
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

// ─── RADIAL GAUGE (percentuale singola) ───────────────────────────────────────
export function V2Gauge({ pct, label, sub, color = V2.lime, size = 118 }: {
  pct: number; label: string; sub?: string; color?: string; size?: number;
}) {
  const R = (size - 14) / 2, C = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - clamped / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 0.9s ease" }} />
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
