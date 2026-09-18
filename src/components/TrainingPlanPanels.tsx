import { useState } from "react";
import { ChevronDown, Flag, HeartPulse, ListChecks, Sparkles, Timer } from "lucide-react";
import type { SessionEval } from "../utils/trainingAdherence";
import { VERDICT_STYLE } from "./TrainingAdherence";
import {
  AFTER_RACE, BIKE_ZONES, PLAN_BIBS, PLAN_CHANGES, PLAN_KINDS, PLAN_LEGEND, PLAN_WEEKS, RACE_HM,
  RUN_ZONES, TEST_5K, ZONE_NOTES, nextPlanDay, planDateLabel,
  type PlanDay, type ZoneRow,
} from "../data/mezzaOttobrePlan";

/**
 * I pezzi del piano "test 5 km e mezza" nella pagina Training.
 *
 * Le due targhe restano identiche all'originale — sono il motivo per cui il
 * piano piaceva così com'era. Tutto il resto parla la lingua del sito: fondi
 * scuri a strati, etichette in maiuscolo spaziato, numeri in JetBrains Mono.
 */

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const COND = "'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif";
const BODY = "'Barlow', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const PAGE_BG = "#121212";

export type ManualStatus = "done" | "failed";

const kmFmt = (km: number) => km.toLocaleString("it-IT", { maximumFractionDigits: 1 });

function SectionTitle({ icon: Icon, children, hint }: { icon: typeof Flag; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <Icon className="w-4 h-4 self-center shrink-0" style={{ color: "var(--app-accent)" }} />
      <h2 className="text-[11px] font-black tracking-[0.22em] uppercase text-white/90">{children}</h2>
      {hint && <span className="ml-auto text-[10px] text-gray-500 truncate">{hint}</span>}
    </div>
  );
}

// ── le targhe ─────────────────────────────────────────────────────────────────
/** Come nel piano originale: pettorale bianco, banda di zona, quattro spille. */
export function PlanBibs() {
  const pin = (pos: React.CSSProperties) => (
    <span className="absolute rounded-full" style={{ width: "0.6rem", height: "0.6rem", border: "1.5px solid #9AA3AD", background: PAGE_BG, ...pos }} />
  );
  return (
    <div className="grid gap-[0.9rem] sm:grid-cols-2">
      {PLAN_BIBS.map((b) => (
        <div key={b.id} className="relative overflow-hidden"
          style={{ background: "#F4F6F8", color: "#111820", borderRadius: 6, padding: "1.7rem 1.4rem 1.1rem", border: "1px solid #2D3540", fontFamily: BODY }}>
          <span className="absolute left-0 right-0 top-0" style={{ height: "0.55rem", background: b.band }} />
          {pin({ top: "1.05rem", left: "0.75rem" })}
          {pin({ top: "1.05rem", right: "0.75rem" })}
          {pin({ bottom: "0.75rem", left: "0.75rem" })}
          {pin({ bottom: "0.75rem", right: "0.75rem" })}
          <p className="text-center m-0" style={{ fontFamily: COND, fontWeight: 700, fontSize: "clamp(3.4rem, 16vw, 4.8rem)", lineHeight: 0.95, margin: "0.15rem 0 0.4rem", fontVariantNumeric: "tabular-nums" }}>
            {b.value}
          </p>
          <p className="text-center m-0" style={{ fontSize: "0.98rem", lineHeight: 1.35 }}>
            <strong style={{ fontWeight: 600 }}>{b.title}</strong><br />{b.when}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── la prossima seduta ────────────────────────────────────────────────────────
export function NextSession({ todayIso, onOpen }: { todayIso: string; onOpen: (iso: string) => void }) {
  const next = nextPlanDay(todayIso);
  if (!next) return null;
  const { day, isToday } = next;
  const col = PLAN_KINDS[day.kind].color;
  return (
    <button type="button" onClick={() => onOpen(day.date)}
      className="relative w-full text-left rounded-xl border border-[#2A2A2A] bg-[#181818] overflow-hidden pl-5 pr-4 py-4 hover:border-white/20 transition-colors">
      <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: col }} />
      <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.22em] uppercase">
        <span style={{ color: isToday ? "var(--app-accent)" : "#9CA3AF" }}>{isToday ? "Oggi" : "Prossima seduta"}</span>
        <span className="text-gray-500 normal-case tracking-normal font-bold">{planDateLabel(day.date)}</span>
        <span className="ml-auto px-1.5 py-0.5 rounded text-[9px]" style={{ color: col, background: `${col}1a` }}>{PLAN_KINDS[day.kind].label}</span>
      </div>
      <div className="mt-1.5 text-2xl font-black text-white leading-tight">{day.title}</div>
      {(day.detail || day.km) && (
        <p className="mt-1 text-[13px] text-gray-400 leading-snug">
          {day.detail}{day.km ? <span className="text-gray-300" style={MONO}> {day.detail ? "· " : ""}Totale {kmFmt(day.km)} km</span> : null}
        </p>
      )}
    </button>
  );
}

// ── settimana per settimana ───────────────────────────────────────────────────
const DOW_SHORT = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

export function PlanWeeks({
  todayIso, manual, verdicts, onOpen,
}: {
  todayIso: string;
  manual: Record<string, ManualStatus>;
  verdicts: Record<string, SessionEval>;
  onOpen: (iso: string) => void;
}) {
  return (
    <div className="space-y-8">
      {PLAN_WEEKS.map((w) => {
        const current = w.days[0].date <= todayIso && todayIso <= w.days[w.days.length - 1].date;
        return (
          <section key={w.n}>
            <div className="flex items-end justify-between gap-4 mb-2">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  Settimana {w.n}
                  {current && <span className="ml-2 align-middle text-[9px] font-black tracking-[0.2em] uppercase px-1.5 py-0.5 rounded" style={{ color: "#0A0A0A", background: "var(--app-accent)" }}>in corso</span>}
                </h3>
                <p className="text-[11px] text-gray-500">{w.dates}</p>
              </div>
              <div className="text-base font-black text-gray-200 whitespace-nowrap" style={MONO}>{w.km}</div>
            </div>
            <ul className="rounded-xl border border-[#2A2A2A] bg-[#181818] overflow-hidden divide-y divide-[#232323]">
              {w.days.map((d) => (
                <DayRow key={d.date} d={d} todayIso={todayIso} manual={manual[d.date]} verdict={verdicts[d.date]} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function DayRow({ d, todayIso, manual, verdict, onOpen }: {
  d: PlanDay; todayIso: string; manual?: ManualStatus; verdict?: SessionEval; onOpen: (iso: string) => void;
}) {
  const col = PLAN_KINDS[d.kind].color;
  const isToday = d.date === todayIso;
  const past = d.date < todayIso;
  const done = d.done || manual === "done";
  const dt = new Date(d.date + "T00:00:00Z");
  // l'esito automatico si mostra solo quando dice qualcosa: "senza giri" e le
  // giornate già segnate a mano restano mute in lista
  const auto = verdict && verdict.verdict !== "unrated" && !manual && !d.done ? VERDICT_STYLE[verdict.verdict] : null;
  return (
    <li>
      <button type="button" onClick={() => onOpen(d.date)}
        className={`relative w-full grid grid-cols-[3rem_1fr_auto] gap-x-3 pl-5 pr-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${isToday ? "bg-[#C0FF00]/[0.06]" : ""} ${past && !isToday ? "opacity-[0.55]" : ""}`}>
        <span className="absolute left-2 top-3 bottom-3 w-1 rounded-full" style={{ background: col }} />
        <span className="flex flex-col leading-tight pt-0.5">
          <span className="text-[11px] text-gray-500">{DOW_SHORT[dt.getUTCDay()]}</span>
          <span className="text-xl font-black text-gray-200 tabular-nums" style={MONO}>{dt.getUTCDate()}</span>
        </span>
        <span className="min-w-0">
          <span className={`block font-bold text-white ${d.big ? "text-[17px]" : "text-[14px]"}`}>
            {d.title}
            {isToday && !done && <span className="ml-2 text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--app-accent)" }}>oggi</span>}
            {done && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-[#10B981]">fatto</span>}
            {manual === "failed" && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-[#EF4444]">saltata</span>}
            {auto && <span className="ml-2 text-[10px] font-black uppercase tracking-wider" style={{ color: auto.color }}>{auto.label}</span>}
          </span>
          {(d.detail || d.moved) && (
            <span className="block mt-0.5 text-[12.5px] text-gray-400 leading-snug">
              {d.detail}{d.moved && <em className="text-gray-500"> {d.moved}</em>}
            </span>
          )}
          {d.verify && (
            <span className="block mt-2 rounded-r-md border-l-2 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-gray-300 leading-snug" style={{ borderColor: col }}>
              {d.verify}
            </span>
          )}
        </span>
        <span className="text-right whitespace-nowrap pt-0.5">
          {d.km ? <span className="text-base font-black text-gray-200" style={MONO}>{kmFmt(d.km)}<span className="ml-0.5 text-[10px] font-normal text-gray-500">km</span></span> : null}
        </span>
      </button>
    </li>
  );
}

export function PlanLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {PLAN_LEGEND.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm" style={{ background: PLAN_KINDS[k].color }} />{PLAN_KINDS[k].label}
        </span>
      ))}
      <span className="text-[11px] text-gray-600">I colori seguono l'ordine delle zone del Garmin.</span>
    </div>
  );
}

// ── zone ──────────────────────────────────────────────────────────────────────
function ZoneTable({ head, rows }: { head: [string, string, string]; rows: ZoneRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#2A2A2A] bg-[#141414]">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[9px] font-black uppercase tracking-[0.18em] text-gray-500 border-b border-[#2A2A2A]">
            {head.map((h) => <th key={h} className="px-3.5 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-[#1E1E1E] last:border-0">
              <td className="px-3.5 py-2 whitespace-nowrap font-bold text-gray-200">
                <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-[-1px]" style={{ background: PLAN_KINDS[r.kind].color }} />{r.name}
              </td>
              <td className="px-3.5 py-2 whitespace-nowrap text-gray-300" style={MONO}>{r.pace}</td>
              <td className="px-3.5 py-2 text-gray-300" style={MONO}>{r.hr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ZonesPanel() {
  return (
    <section id="piano-zone">
      <SectionTitle icon={HeartPulse} hint="soglia intorno a 155">Zone di frequenza cardiaca</SectionTitle>
      <p className="text-[12.5px] text-gray-400 leading-relaxed mb-3">{ZONE_NOTES.intro}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <ZoneTable head={["Corsa", "Passo", "FC"]} rows={RUN_ZONES} />
        <ZoneTable head={["Bici", "Uso", "FC"]} rows={BIKE_ZONES} />
      </div>
      <div className="mt-3 space-y-1 text-[12px] text-gray-500 leading-snug">
        <p>{ZONE_NOTES.bike}</p>
        <p>{ZONE_NOTES.heat}</p>
      </div>
    </section>
  );
}

// ── test e gara ───────────────────────────────────────────────────────────────
function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-[13px] text-gray-300 leading-snug">
          <span className="mt-[7px] w-1 h-1 rounded-full shrink-0" style={{ background: "var(--app-accent)" }} />{t}
        </li>
      ))}
    </ul>
  );
}

export function TestPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section id="piano-test">
      {!compact && <SectionTitle icon={Timer} hint="sabato 10 ottobre">Test 5 km</SectionTitle>}
      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 space-y-4">
        <Bullets items={TEST_5K.before} />
        <div className="grid grid-cols-5 gap-1.5">
          {TEST_5K.splits.map(([k, p]) => (
            <div key={k} className="rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] py-2 text-center">
              <span className="block text-[10px] text-gray-500">{k}</span>
              <span className="block text-lg font-black text-white tabular-nums" style={MONO}>{p}</span>
            </div>
          ))}
        </div>
        <Bullets items={TEST_5K.after} />
      </div>
    </section>
  );
}

export function RacePanel({ compact = false }: { compact?: boolean }) {
  return (
    <section id="piano-gara">
      {!compact && <SectionTitle icon={Flag} hint="domenica 18 ottobre">Mezza maratona</SectionTitle>}
      <div className="overflow-x-auto rounded-xl border border-[#2A2A2A] bg-[#141414]">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[9px] font-black uppercase tracking-[0.18em] text-gray-500 border-b border-[#2A2A2A]">
              <th className="px-3.5 py-2.5">Tratto</th><th className="px-3.5 py-2.5">Passo</th><th className="px-3.5 py-2.5">FC</th>
            </tr>
          </thead>
          <tbody>
            {RACE_HM.segments.map((s) => (
              <tr key={s.stretch} className="border-b border-[#1E1E1E] last:border-0">
                <td className="px-3.5 py-2 whitespace-nowrap font-bold text-gray-200">{s.stretch}</td>
                <td className="px-3.5 py-2 text-white font-bold" style={MONO}>{s.pace}</td>
                <td className="px-3.5 py-2 text-gray-300" style={MONO}>{s.hr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
        <Bullets items={RACE_HM.notes} />
      </div>
    </section>
  );
}

export function AfterPanel() {
  return (
    <section>
      <SectionTitle icon={ListChecks}>Dopo la mezza</SectionTitle>
      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4"><Bullets items={AFTER_RACE} /></div>
    </section>
  );
}

/** Le novità di questa versione del piano: chiuse, si aprono se servono. */
export function ChangesPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#181818] overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/[0.02]">
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: "var(--app-accent)" }} />
        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-300">Cosa cambia rispetto al 14 settembre</span>
        <ChevronDown className={`ml-auto w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4"><Bullets items={PLAN_CHANGES} /></div>}
    </div>
  );
}

/** Il contenuto di una giornata nel dettaglio a schermo intero. */
export function PlanDayBody({ day }: { day: PlanDay }) {
  const col = PLAN_KINDS[day.kind].color;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider" style={{ color: col, background: `${col}1a` }}>{PLAN_KINDS[day.kind].label}</span>
        {day.km ? <span className="text-sm font-black text-gray-200" style={MONO}>{kmFmt(day.km)} km</span> : null}
      </div>
      {(day.detail || day.moved) && (
        <p className="text-gray-300 leading-relaxed">{day.detail}{day.moved && <em className="text-gray-500"> {day.moved}</em>}</p>
      )}
      {day.verify && (
        <p className="rounded-r-lg border-l-2 bg-white/[0.03] px-3 py-2 text-[13px] text-gray-200 leading-snug" style={{ borderColor: col }}>{day.verify}</p>
      )}
      {day.more === "test" && <TestPanel compact />}
      {day.more === "gara" && <RacePanel compact />}
    </div>
  );
}
