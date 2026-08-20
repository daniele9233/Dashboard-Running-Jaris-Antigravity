import { useMemo, useState } from "react";
import {
  AlertTriangle, BookOpen, Check, ChevronDown, FlaskConical, Minus,
  RefreshCw, Thermometer, TrendingDown, X,
} from "lucide-react";
import { fmtClock, fmtPace } from "../gamification/gamiCore";
import { evaluatePlan, diagnose } from "../../utils/trainingAdherence";
import { AdherenceBanner, AdherenceStrip } from "../TrainingAdherence";
import type { Run } from "../../types/api";
import { allStudies, type Study } from "./studies";
import type { GoalOutlook, Plan, PlanSession, PlanWeek } from "./planEngine";
import { probColor, parseTime } from "./planFormat";
import type { SessionOutcome, useTrainingPlan } from "./useTrainingPlan";

const MONO = "'JetBrains Mono', monospace";
const LIT = "#C0FF00";
const TEAL = "#00FFAA";

const KIND_COLOR: Record<PlanSession["kind"], string> = {
  rest: "#3F3F46",
  recovery: "#6B7280",
  easy: "#8B5CF6",
  long: "#10B981",
  tempo: "#F97316",
  intervals: "#EF4444",
  race: "#C0FF00",
  strength: "#0EA5E9",
};

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });

/* ══ 1 · LA PREVISIONE ════════════════════════════════════════════════════ */

/**
 * La probabilità come anello, non come numero secco.
 *
 * Un "38%" da solo si legge come una bocciatura. L'anello con la banda accanto
 * dice la cosa giusta: il tempo previsto è una distribuzione, l'obiettivo è un
 * punto dentro quella distribuzione, e la domanda non è "ce la faccio" ma
 * "quanta della distribuzione sta sotto il traguardo".
 */
function ProbRing({ p, size = 128 }: { p: number; size?: number }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const col = probColor(p);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontFamily: MONO, fill: col, fontSize: size * 0.26, fontWeight: 900 }}>
        {Math.round(p * 100)}
      </text>
      <text x="50%" y="66%" textAnchor="middle" dominantBaseline="middle"
        style={{ fill: "#6B7280", fontSize: 9, fontWeight: 900, letterSpacing: "0.2em" }}>
        PER CENTO
      </text>
    </svg>
  );
}

function OutlookCard({ o }: { o: GoalOutlook }) {
  const days = Math.round((Date.parse(o.goal.dateIso) - Date.now()) / 86400000);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="p-5 flex gap-5 items-center">
        <ProbRing p={o.probability} />
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-600">
            {o.goal.label} · fra {days} giorni
          </div>
          <div className="text-3xl font-black italic tracking-tighter text-white leading-none mt-1">
            {fmtClock(o.goal.targetSec)}
          </div>
          <div className="mt-2.5 space-y-1 text-[11.5px]" style={{ fontFamily: MONO }}>
            <div className="text-gray-300">
              previsto <span className="font-black text-white">{fmtClock(o.predictedSec)}</span>
              <span className="text-gray-600"> · al fresco {fmtClock(o.predictedCoolSec)}</span>
            </div>
            <div className="text-gray-500">banda 10-90% · {fmtClock(o.p10Sec)} – {fmtClock(o.p90Sec)}</div>
            <div className="text-gray-500">
              VDOT {o.vdotProjected} previsto · {o.vdotRequired} richiesto
            </div>
          </div>
        </div>
      </div>

      {/* aria del giorno */}
      <div className="px-5 py-2.5 border-t border-white/[0.06] flex flex-wrap items-center gap-x-3 gap-y-1"
        style={{ background: `${o.conditions.band.color}0d` }}>
        <Thermometer className="w-3.5 h-3.5" style={{ color: o.conditions.band.color }} />
        <span className="text-[11px] font-bold" style={{ fontFamily: MONO, color: o.conditions.band.color }}>
          {o.conditions.tempC}°C + DP {o.conditions.dpC}° = indice {o.conditions.index}
        </span>
        <span className="text-[11px] text-gray-500" style={{ fontFamily: MONO }}>
          aria {o.conditions.band.label} · costa {o.heatCostSec}″ rispetto ai 12 °C ideali
        </span>
      </div>

      {/* cosa frena */}
      <div className="px-5 py-3 border-t border-white/[0.06]">
        <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-600 mb-2">Cosa frena</div>
        <ul className="space-y-1.5">
          {o.limiters.map((l, i) => (
            <li key={i} className="flex gap-2 text-[11.5px] text-gray-400 leading-snug">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-600 shrink-0" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* le leve */}
      <div className="px-5 py-3 border-t border-white/[0.06]">
        <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-600 mb-2">
          Le leve, in secondi
        </div>
        <div className="space-y-2">
          {o.levers.map((l) => {
            const good = l.deltaSec < 0;
            return (
              <div key={l.label} className="flex items-start gap-3">
                <span className="text-[12.5px] font-black tabular-nums w-14 shrink-0 text-right"
                  style={{ fontFamily: MONO, color: good ? TEAL : "#F43F5E" }}>
                  {good ? "" : "+"}{l.deltaSec}″
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-bold text-white/90">{l.label}</span>
                  <span className="block text-[10px] text-gray-600 leading-snug">{l.detail}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══ 2 · I TEST ═══════════════════════════════════════════════════════════ */

function TestCard({
  entry, result, onSave,
}: {
  entry: Plan["tests"][number];
  result?: { valueSec: number; note?: string };
  onSave: (v: { dateIso: string; valueSec: number } | null) => void;
}) {
  const t = entry.session.test!;
  const [draft, setDraft] = useState("");
  const past = entry.dateIso <= new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical className="w-3.5 h-3.5" style={{ color: TEAL }} />
        <span className="text-[9px] font-black tracking-[0.25em] uppercase" style={{ color: TEAL }}>
          {fmtDay(entry.dateIso)}
        </span>
      </div>
      <h3 className="text-[15px] font-black text-white leading-tight">{t.label}</h3>
      <p className="mt-2 text-[11.5px] text-gray-400 leading-relaxed">{t.measures}</p>

      <div className="mt-3 space-y-1.5">
        <div className="flex gap-2 text-[11.5px] leading-snug">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
          <span className="text-gray-300">{t.gate}</span>
        </div>
        <div className="flex gap-2 text-[11.5px] leading-snug">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span className="text-gray-400">{t.alarm}</span>
        </div>
      </div>

      {result ? (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-3 py-2">
          <span className="text-[13px] font-black text-white" style={{ fontFamily: MONO }}>
            {fmtClock(result.valueSec)}
          </span>
          <button type="button" onClick={() => onSave(null)}
            className="text-[10px] text-gray-500 hover:text-red-400 transition-colors">
            cancella
          </button>
        </div>
      ) : past ? (
        <form className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const sec = parseTime(draft);
            if (sec) { onSave({ dateIso: entry.dateIso, valueSec: sec }); setDraft(""); }
          }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="mm:ss"
            className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-[13px] text-white outline-none focus:border-[#C0FF00]/50"
            style={{ fontFamily: MONO }} inputMode="numeric" />
          <button type="submit" className="px-3 py-2 rounded-lg text-[11px] font-black text-black" style={{ background: LIT }}>
            Salva
          </button>
        </form>
      ) : null}
    </div>
  );
}

/* ══ 3 · LE SETTIMANE ═════════════════════════════════════════════════════ */

function OutcomeButtons({
  outcome, onMark,
}: { outcome?: SessionOutcome; onMark: (o: SessionOutcome | null) => void }) {
  const opts: { id: SessionOutcome; icon: typeof Check; color: string; title: string }[] = [
    { id: "done", icon: Check, color: "#22C55E", title: "Fatta" },
    { id: "partial", icon: Minus, color: "#F59E0B", title: "A metà" },
    { id: "skipped", icon: X, color: "#F43F5E", title: "Saltata" },
  ];
  return (
    <div className="flex gap-1">
      {opts.map((o) => {
        const on = outcome === o.id;
        return (
          <button key={o.id} type="button" title={o.title}
            onClick={() => onMark(on ? null : o.id)}
            className="w-7 h-7 rounded-md border flex items-center justify-center transition-colors"
            style={on
              ? { background: o.color, borderColor: o.color, color: "#000" }
              : { borderColor: "rgba(255,255,255,0.1)", color: "#52525B" }}>
            <o.icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}

function SessionRow({
  s, outcome, onMark, studies,
}: {
  s: PlanSession;
  outcome?: SessionOutcome;
  onMark: (o: SessionOutcome | null) => void;
  studies: Study[];
}) {
  const [open, setOpen] = useState(false);
  const col = KIND_COLOR[s.kind];
  const isRest = s.kind === "rest";

  return (
    <div className="border-b border-white/[0.05] last:border-0">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="w-1 h-9 rounded-full shrink-0" style={{ background: col }} />
        <span className="text-[10px] font-black tracking-widest uppercase text-gray-600 w-20 shrink-0"
          style={{ fontFamily: MONO }}>
          {fmtDay(s.date)}
        </span>

        <button type="button" onClick={() => !isRest && setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left group">
          <span className={`block text-[12.5px] font-bold leading-tight ${isRest ? "text-gray-600" : "text-white group-hover:text-[#C0FF00]"} transition-colors`}>
            {s.test && <span className="mr-1.5" style={{ color: TEAL }}>◆</span>}
            {s.title}
          </span>
          {s.heat && (
            <span className="block text-[10px] mt-0.5" style={{ fontFamily: MONO, color: s.heat.conditions.band.color }}>
              {s.heat.conditions.tempC}°+{s.heat.conditions.dpC}° → {fmtPace(s.heat.adjustedFrom)}–{fmtPace(s.heat.adjustedTo)}/km
              <span className="text-gray-600"> (+{s.heat.penaltyPct}% sull'aria ideale)</span>
            </span>
          )}
        </button>

        {s.target_distance_km > 0 && (
          <span className="text-[12px] font-black tabular-nums text-gray-400 w-14 text-right shrink-0"
            style={{ fontFamily: MONO }}>
            {s.target_distance_km} km
          </span>
        )}
        {!isRest && <OutcomeButtons outcome={outcome} onMark={onMark} />}
      </div>

      {open && !isRest && (
        <div className="px-4 pb-4 pl-[4.5rem] space-y-2">
          <p className="text-[12px] text-gray-300 leading-relaxed">{s.description}</p>
          <p className="text-[11.5px] italic leading-relaxed" style={{ color: `${LIT}cc` }}>{s.why}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {s.studies.map((id) => {
              const st = studies.find((x) => x.id === id);
              return (
                <span key={id} title={st?.says}
                  className="text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 text-gray-500">
                  {st ? st.ref.split(" — ")[0] : id}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WeekBlock({
  w, log, onMark, studies, defaultOpen,
}: {
  w: PlanWeek;
  log: Record<string, SessionOutcome>;
  onMark: (date: string, o: SessionOutcome | null) => void;
  studies: Study[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const acwrHot = w.acwr > 1.3;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors">
        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-600 w-8 shrink-0"
          style={{ fontFamily: MONO }}>
          S{w.index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black text-white">
            {w.blockLabel}
            <span className="text-gray-600 font-normal ml-2" style={{ fontFamily: MONO }}>
              {fmtDay(w.startIso)} – {fmtDay(w.endIso)}
            </span>
          </span>
          {!open && <span className="block text-[11px] text-gray-500 truncate mt-0.5">{w.why}</span>}
        </span>
        <span className="text-right shrink-0" style={{ fontFamily: MONO }}>
          <span className="block text-[14px] font-black text-white tabular-nums">{w.targetKm} km</span>
          <span className="block text-[9px]" style={{ color: acwrHot ? "#F59E0B" : "#52525B" }}>
            ACWR {w.acwr.toFixed(2)} · VDOT {w.vdot}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-600 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <p className="px-4 pb-3 text-[11.5px] text-gray-400 leading-relaxed border-b border-white/[0.05]">
            {w.why}
          </p>
          <div>
            {w.sessions.map((s) => (
              <SessionRow key={s.date} s={s} studies={studies}
                outcome={log[s.date]} onMark={(o) => onMark(s.date, o)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ══ 4 · LA BOARD ═════════════════════════════════════════════════════════ */

export function PlanBoard({
  plan, api, runs, onRegenerate,
}: {
  plan: Plan;
  api: ReturnType<typeof useTrainingPlan>;
  runs: Run[];
  onRegenerate: () => void;
}) {
  const [showScience, setShowScience] = useState(false);
  const studies = useMemo(() => allStudies(), []);
  const todayIso = new Date().toISOString().slice(0, 10);

  // l'aderenza legge le sedute prescritte contro le corse vere: stesso codice
  // già in uso, perché il verdetto su una seduta non deve dipendere da chi
  // l'ha generata
  const evals = useMemo(() => {
    const sessions = plan.weeks.flatMap((w) => w.sessions).filter((s) => s.kind !== "rest" && s.kind !== "strength");
    return evaluatePlan(sessions, runs);
  }, [plan, runs]);
  const diag = useMemo(() => diagnose(evals), [evals]);

  const currentWeek = plan.weeks.findIndex((w) => todayIso >= w.startIso && todayIso <= w.endIso);

  return (
    <div className="max-w-6xl mx-auto px-5 py-8 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[9px] font-black tracking-[0.35em] uppercase text-gray-600 mb-2">
            {plan.weeks.length} settimane · picco {plan.peakKm} km · {plan.config.runsPerWeek} uscite
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white leading-none">
            Il <span style={{ color: LIT }}>Piano</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {api.offline && (
            <span className="text-[10px] text-amber-400/80 max-w-[14rem] leading-snug">
              Server non raggiungibile: le spunte restano su questo dispositivo.
            </span>
          )}
          <button type="button" onClick={onRegenerate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold border border-white/10 text-gray-300 hover:border-white/25 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Rigenera
          </button>
        </div>
      </header>

      {plan.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-5 space-y-2">
          {plan.warnings.map((w, i) => (
            <div key={i} className="flex gap-2.5 text-[12px] text-amber-200/90 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {plan.outlook.map((o) => <OutlookCard key={o.goal.id} o={o} />)}
      </div>

      {/* la tenuta: il numero che spiega la mezza */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-3.5 h-3.5 text-white/70" />
          <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-white/80">
            La tenuta — esponente di Riegel
          </h2>
        </div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="text-4xl font-black tabular-nums text-gray-500" style={{ fontFamily: MONO }}>
            {plan.riegelNow.toFixed(3)}
          </span>
          <span className="text-2xl text-gray-700">→</span>
          <span className="text-4xl font-black tabular-nums" style={{ fontFamily: MONO, color: LIT }}>
            {plan.riegelEnd.toFixed(3)}
          </span>
          <p className="text-[11.5px] text-gray-400 leading-relaxed flex-1 min-w-[16rem]">
            Quanto perdi allungando la distanza. A 1,055 sei un atleta a volume alto: il 5000 si
            traduce quasi per intero nella mezza. Sopra 1,09 il motore c'è ma la distanza lo
            disperde. Il piano lo abbassa con i chilometri e con i lunghi, non con le ripetute.
          </p>
        </div>
      </section>

      {/* i test */}
      <section>
        <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-white/80 mb-3">
          I test — come sapere se il piano sta funzionando
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plan.tests.map((t) => (
            <TestCard key={t.session.test!.id} entry={t}
              result={api.state.tests[t.session.test!.id]}
              onSave={(v) => api.recordTest(t.session.test!.id, v)} />
          ))}
        </div>
      </section>

      {/* aderenza */}
      {evals.length > 0 && (
        <section>
          <AdherenceBanner d={diag} />
          <AdherenceStrip evals={evals} />
        </section>
      )}

      {/* le settimane */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-white/80">Settimana per settimana</h2>
        {plan.weeks.map((w, i) => (
          <WeekBlock key={w.startIso} w={w} studies={studies} log={api.state.log}
            onMark={api.mark} defaultOpen={i === Math.max(0, currentWeek)} />
        ))}
      </section>

      {/* le fonti */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <button type="button" onClick={() => setShowScience((v) => !v)}
          className="w-full flex items-center gap-2.5 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
          <BookOpen className="w-4 h-4 text-white/70" />
          <span className="text-[10px] font-black tracking-[0.25em] uppercase text-white/80 flex-1">
            Le fonti — {plan.studies.length} lavori pubblicati
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showScience ? "rotate-180" : ""}`} />
        </button>
        {showScience && (
          <div className="px-5 pb-5 space-y-4">
            {plan.studies.map((s) => (
              <div key={s.id} className="border-l-2 pl-3.5" style={{ borderColor: `${LIT}44` }}>
                <div className="text-[11.5px] font-bold text-white/90">{s.ref}</div>
                <div className="text-[11px] text-gray-400 leading-snug mt-1">{s.says}</div>
                <div className="text-[11px] leading-snug mt-1" style={{ color: `${TEAL}bb` }}>
                  Nel piano: {s.used}
                </div>
                {s.caveat && (
                  <div className="text-[10.5px] text-amber-300/70 leading-snug mt-1">⚠ {s.caveat}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
