import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { CHART_SERIES, CHART_SURFACE, CHART_TEXT, ChartCard } from "../charts";

/** I pezzi comuni del Pace Lab: gli stessi del Banco di prova, più i controlli fini. */

export const MONO = "'JetBrains Mono', monospace";
export const LIT = CHART_SERIES.primary;
export const CYAN = CHART_SERIES.compare;
export const RISK = CHART_SERIES.risk;
export const LOAD = CHART_SERIES.load;
export const GOOD = CHART_SERIES.positive;
export const MUTED = CHART_TEXT.muted;
export const REF = CHART_TEXT.axis;
export const SURFACE = CHART_SURFACE.panel;

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <ChartCard flush id={id} className={`scroll-mt-40 gap-0 ${className}`}>
      {children}
    </ChartCard>
  );
}

/** Il titolo di una sezione: numero, domanda, e la risposta in una riga. */
export function SectionHead({ n, title, question, right }: { n: string; title: string; question: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2 px-5 pt-5 pb-4">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-black tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{n}</span>
          <h2 className="text-xs font-black tracking-[0.22em] uppercase text-white/90">{title}</h2>
        </div>
        <p className="mt-1 text-[17px] md:text-[20px] font-black italic tracking-tight text-white leading-tight">{question}</p>
      </div>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-xs font-black tracking-[0.22em] uppercase text-gray-500 ${className}`}>{children}</div>
  );
}

/** Scelta fra poche opzioni: pulsanti affiancati, quello attivo acceso. */
export function Segmented<T extends string | number>({ value, options, onChange, size = "md", ariaLabel }: {
  value: T;
  options: { value: NoInfer<T>; label: ReactNode; title?: string }[];
  onChange: (v: NoInfer<T>) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel}
      className="inline-flex flex-wrap rounded-xl border border-white/10 bg-black/40 p-0.5 gap-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} title={o.title}
            onClick={() => onChange(o.value)}
            className={`${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[12px]"} rounded-[10px] font-black transition-colors`}
            style={{
              background: on ? LIT : "transparent",
              color: on ? "#000" : "#9CA3AF",
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Un numero da regolare a scatti: −, il valore, +. */
export function Stepper({ value, onDec, onInc, label, sub, width = "w-[4.6rem]", disabledDec, disabledInc }: {
  value: ReactNode; onDec: () => void; onInc: () => void; label?: string; sub?: ReactNode; width?: string;
  disabledDec?: boolean; disabledInc?: boolean;
}) {
  const btn = "w-8 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="inline-flex items-stretch rounded-xl border border-white/10 bg-black/40 overflow-hidden">
      <button type="button" onClick={onDec} disabled={disabledDec} className={btn} aria-label={label ? `${label}: meno` : "meno"}>
        <Minus className="w-3.5 h-3.5" />
      </button>
      <div className={`${width} flex flex-col items-center justify-center border-x border-white/10 px-1`}>
        <span className="text-[15px] font-black text-white tabular-nums leading-none" style={{ fontFamily: MONO }}>{value}</span>
        {sub != null && <span className="mt-0.5 text-xs text-gray-500 tabular-nums leading-none" style={{ fontFamily: MONO }}>{sub}</span>}
      </div>
      <button type="button" onClick={onInc} disabled={disabledInc} className={btn} aria-label={label ? `${label}: più` : "più"}>
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Una cifra che conta, con cosa è e cosa vuol dire. */
export function Stat({ label, value, sub, color = "#fff", mark }: {
  label: string; value: ReactNode; sub?: ReactNode; color?: string; mark?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3">
      <div className="flex items-center gap-1.5">{mark}<Label>{label}</Label></div>
      <div className="mt-1.5 text-[24px] md:text-[26px] font-black leading-none whitespace-nowrap" style={{ fontFamily: MONO, color }}>
        {value}
      </div>
      {sub != null && <div className="mt-1.5 text-xs text-gray-400 leading-snug">{sub}</div>}
    </div>
  );
}

/** Il tratto della legenda: una linea, non un quadratino. */
export function LineKey({ color, dashed, width = 2.5 }: { color: string; dashed?: boolean; width?: number }) {
  return (
    <svg width="18" height="6" aria-hidden className="shrink-0">
      <line x1="1.5" y1="3" x2="16.5" y2="3" stroke={color} strokeWidth={width} strokeLinecap="round"
        strokeDasharray={dashed ? "3.5 3" : undefined} />
    </svg>
  );
}
