import { useMemo, useState } from "react";
import { Target, Sparkles, Plus, Trash2, AlertTriangle, Thermometer } from "lucide-react";
import { fmtClock } from "../gamification/gamiCore";
import { conditionsAt } from "./climate";
import { parseTime, probColor } from "./planFormat";
import type { Plan, PlanConfig, RaceGoal } from "./planEngine";
import type { useTrainingPlan } from "./useTrainingPlan";

const MONO = "'JetBrains Mono', monospace";
const LIT = "#C0FF00";

/**
 * GENERA PIANO
 * ════════════════════════════════════════════════════════════════════════════
 * Tre domande sole — che tempo, che giorno, a che ora — perché sono le uniche
 * che l'atleta sa davvero. Tutto il resto (volume, qualità, taper, ritmi) esce
 * dai suoi dati, e l'anteprima mostra la probabilità PRIMA di generare: se un
 * obiettivo non sta in piedi è meglio saperlo adesso che a novembre.
 *
 * L'ora di partenza è un campo di prima classe e non un dettaglio: su una gara
 * di settembre a Roma sposta il risultato più di tre settimane di allenamento,
 * e nessun generatore di piani lo chiede mai.
 */

const DISTANCES = [
  { label: "5K", m: 5000 },
  { label: "10K", m: 10000 },
  { label: "Mezza", m: 21097.5 },
  { label: "Maratona", m: 42195 },
];

const nextMonday = (todayIso: string): string => {
  const d = new Date(`${todayIso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() + (7 - dow));
  return d.toISOString().slice(0, 10);
};

const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-[13px] text-white outline-none " +
  "focus:border-[#C0FF00]/50 transition-colors";

/**
 * Un campo con la sua etichetta.
 *
 * `as="div"` non è un vezzo: un <button> dentro un <label> non riceve il
 * click, perché il label lo inoltra al controllo associato e il bottone resta
 * muto. I gruppi di bottoni devono stare in un div, non in un label.
 */
function Field({
  label, hint, children, as = "label",
}: {
  label: string; hint?: string; children: React.ReactNode; as?: "label" | "div";
}) {
  const Tag = as;
  return (
    <Tag className="block min-w-0">
      <span className="block text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[10px] text-gray-600 leading-snug">{hint}</span>}
    </Tag>
  );
}

interface GoalDraft {
  id: string;
  label: string;
  distanceM: number;
  time: string;
  dateIso: string;
  startHour: number;
}

const emptyGoal = (todayIso: string, i: number): GoalDraft => ({
  id: `g${i}-${Math.random().toString(36).slice(2, 7)}`,
  label: DISTANCES[0].label,
  distanceM: DISTANCES[0].m,
  time: "",
  dateIso: todayIso,
  startHour: 9,
});

export function PlanSetup({
  api, todayIso, onDone,
}: {
  api: ReturnType<typeof useTrainingPlan>;
  todayIso: string;
  onDone: () => void;
}) {
  const { derived, preview, save } = api;

  const [drafts, setDrafts] = useState<GoalDraft[]>([emptyGoal(todayIso, 0)]);
  const [startIso, setStartIso] = useState(() => nextMonday(todayIso));
  const [maxKm, setMaxKm] = useState(() => Math.round((derived?.fitness.weeklyKm ?? 35) * 1.35));
  const [runsPerWeek, setRunsPerWeek] = useState(5);
  const [strength, setStrength] = useState(true);
  const [saving, setSaving] = useState(false);

  const goals: RaceGoal[] = useMemo(() => {
    const out: RaceGoal[] = [];
    const sorted = [...drafts].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    sorted.forEach((d, i) => {
      const sec = parseTime(d.time);
      if (!sec || d.dateIso <= todayIso) return;
      out.push({
        id: d.id, label: d.label, distanceM: d.distanceM, targetSec: sec,
        dateIso: d.dateIso, startHour: d.startHour, priority: i === 0 ? "A" : "B",
      });
    });
    return out;
  }, [drafts, todayIso]);

  const config: PlanConfig | null = useMemo(() => {
    if (!derived || !goals.length) return null;
    return {
      todayIso, startIso, goals,
      fitness: derived.fitness,
      maxWeeklyKm: maxKm,
      runsPerWeek,
      climate: derived.climate,
      raceClimate: derived.raceClimate,
      strength,
    };
  }, [derived, goals, todayIso, startIso, maxKm, runsPerWeek, strength]);

  const plan: Plan | null = useMemo(
    () => (config ? preview(config.goals, config) : null),
    [config, preview],
  );

  const addGoal = () => setDrafts((d) => (d.length >= 2 ? d : [...d, emptyGoal(todayIso, d.length)]));
  const patch = (id: string, p: Partial<GoalDraft>) =>
    setDrafts((d) => d.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const generate = async () => {
    if (!config) return;
    setSaving(true);
    try { await save(config); onDone(); } finally { setSaving(false); }
  };

  if (!derived) {
    return (
      <div className="p-10 text-center text-gray-500 text-sm">
        Servono le tue corse per calibrare il piano. Sincronizza e torna qui.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 space-y-6">
      <header>
        <div className="text-[9px] font-black tracking-[0.35em] uppercase text-gray-600 mb-2">Generatore</div>
        <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white leading-none">
          Genera <span style={{ color: LIT }}>Piano</span>
        </h1>
        <p className="mt-3 text-[13px] text-gray-400 max-w-2xl leading-relaxed">
          Dimmi che tempo vuoi fare, che giorno e a che ora si parte. Volume, qualità,
          scarico e taper escono dai tuoi dati e dalla letteratura, non da un modello standard.
        </p>
      </header>

      {/* ── la forma di partenza ── */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-white/80 mb-4">
          Da dove parti
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { k: "VDOT", v: derived.fitness.vdot.toFixed(1), h: derived.provenance.vdot },
            { k: "km / settimana", v: derived.fitness.weeklyKm.toFixed(0), h: `picco recente ${derived.fitness.peakWeeklyKm.toFixed(0)} km` },
            { k: "lungo massimo", v: `${derived.fitness.longestKm.toFixed(0)} km`, h: "ultime 6 settimane" },
            { k: "uscite / settimana", v: derived.fitness.runsPerWeek.toFixed(1), h: "giorni distinti, ultime 8 settimane" },
          ].map((x) => (
            <div key={x.k}>
              <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-600">{x.k}</div>
              <div className="text-3xl font-black text-white tabular-nums" style={{ fontFamily: MONO }}>{x.v}</div>
              <div className="text-[10px] text-gray-600 leading-snug mt-0.5">{x.h}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── gli obiettivi ── */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-white/80 flex items-center gap-2">
            <Target className="w-3.5 h-3.5" /> Obiettivi
          </h2>
          {drafts.length < 2 && (
            <button type="button" onClick={addGoal}
              className="flex items-center gap-1.5 text-[11px] font-bold text-black px-3 py-1.5 rounded-lg"
              style={{ background: LIT }}>
              <Plus className="w-3.5 h-3.5" /> Seconda gara
            </button>
          )}
        </div>

        <div className="space-y-4">
          {drafts.map((d, i) => {
            const cond = d.dateIso > todayIso ? conditionsAt(d.dateIso, d.startHour, derived.raceClimate) : null;
            return (
              <div key={d.id} className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: i === 0 ? LIT : "#00FFAA" }}>
                    Gara {i === 0 ? "A" : "B"}
                  </span>
                  {drafts.length > 1 && (
                    <button type="button" onClick={() => setDrafts((x) => x.filter((y) => y.id !== d.id))}
                      className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Distanza">
                    <select
                      value={d.label}
                      onChange={(e) => {
                        const dist = DISTANCES.find((x) => x.label === e.target.value)!;
                        patch(d.id, { label: dist.label, distanceM: dist.m });
                      }}
                      className={inputCls} style={{ fontFamily: MONO }}>
                      {DISTANCES.map((x) => <option key={x.label} value={x.label}>{x.label}</option>)}
                    </select>
                  </Field>

                  <Field label="Tempo obiettivo" hint={d.time && !parseTime(d.time) ? "formato mm:ss o h:mm:ss" : undefined}>
                    <input value={d.time} onChange={(e) => patch(d.id, { time: e.target.value })}
                      placeholder={d.distanceM > 15000 ? "1:34:35" : "19:59"}
                      className={inputCls} style={{ fontFamily: MONO }} inputMode="numeric" />
                  </Field>

                  <Field label="Data">
                    <input type="date" value={d.dateIso} min={todayIso}
                      onChange={(e) => patch(d.id, { dateIso: e.target.value })}
                      className={inputCls} style={{ fontFamily: MONO }} />
                  </Field>

                  <Field label="Ora di partenza"
                    hint={cond ? `attesi ${cond.tempC}°C · DP ${cond.dpC}°` : undefined}>
                    <input type="number" min={5} max={22} value={d.startHour}
                      onChange={(e) => patch(d.id, { startHour: Math.max(5, Math.min(22, +e.target.value)) })}
                      className={inputCls} style={{ fontFamily: MONO }} />
                  </Field>
                </div>

                {cond && (
                  <div className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: cond.band.color }}>
                    <Thermometer className="w-3.5 h-3.5" />
                    <span style={{ fontFamily: MONO }}>
                      indice {cond.index} · aria {cond.band.label}
                    </span>
                    <span className="text-gray-600">
                      — cambiare l'ora di partenza è la leva più economica che hai
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── i vincoli ── */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-white/80 mb-4">Quanto puoi dare</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Si parte il" hint="sempre un lunedì">
            <input type="date" value={startIso} onChange={(e) => setStartIso(e.target.value)}
              className={inputCls} style={{ fontFamily: MONO }} />
          </Field>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500">Tetto settimanale</span>
              <span className="text-[13px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{maxKm} km</span>
            </div>
            <input type="range" min={Math.max(15, Math.round(derived.fitness.weeklyKm))} max={Math.round(derived.fitness.weeklyKm * 1.6) + 5}
              value={maxKm} onChange={(e) => setMaxKm(+e.target.value)}
              className="w-full accent-[#C0FF00] cursor-pointer" />
            <span className="block mt-1 text-[10px] text-gray-600 leading-snug">
              Il piano non ci arriva comunque di colpo: mai oltre +10% a settimana.
            </span>
          </div>

          <Field as="div" label="Uscite a settimana" hint={runsPerWeek > derived.fitness.runsPerWeek + 0.7
            ? "Più uscite E più volume insieme è il modo classico di rompersi: aumenta una cosa per volta."
            : undefined}>
            <div className="flex gap-2">
              {[4, 5, 6].map((n) => (
                <button key={n} type="button" onClick={() => setRunsPerWeek(n)}
                  className="flex-1 py-2 rounded-lg text-[13px] font-black border transition-colors"
                  style={runsPerWeek === n
                    ? { background: LIT, color: "#000", borderColor: LIT }
                    : { borderColor: "rgba(255,255,255,0.1)", color: "#9CA3AF" }}>
                  {n}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <label className="flex items-center gap-2.5 mt-5 cursor-pointer">
          <input type="checkbox" checked={strength} onChange={(e) => setStrength(e.target.checked)}
            className="accent-[#C0FF00] w-4 h-4" />
          <span className="text-[12px] text-gray-300">
            Due richiami di forza a settimana
            <span className="text-gray-600"> — 2-8% di economia di corsa, con carichi alti (Blagrove 2018, Llanos-Lagos 2024)</span>
          </span>
        </label>
      </section>

      {/* ── anteprima ── */}
      {plan && (
        <section className="rounded-2xl border p-5" style={{ borderColor: `${LIT}33`, background: `${LIT}08` }}>
          <h2 className="text-[10px] font-black tracking-[0.25em] uppercase mb-4" style={{ color: LIT }}>
            Anteprima · {plan.weeks.length} settimane, picco {plan.peakKm} km
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {plan.outlook.map((o) => (
              <div key={o.goal.id} className="rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-black text-white">
                    {o.goal.label} · {fmtClock(o.goal.targetSec)}
                  </span>
                  <span className="text-3xl font-black tabular-nums" style={{ fontFamily: MONO, color: probColor(o.probability) }}>
                    {Math.round(o.probability * 100)}%
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-gray-400" style={{ fontFamily: MONO }}>
                  previsto {fmtClock(o.predictedSec)} · banda {fmtClock(o.p10Sec)}–{fmtClock(o.p90Sec)}
                </div>
              </div>
            ))}
          </div>

          {plan.warnings.length > 0 && (
            <ul className="mt-4 space-y-2">
              {plan.warnings.map((w, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-amber-300/90 leading-snug">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={generate} disabled={!config || saving}
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-black text-[13px] tracking-wide text-black disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          style={{ background: LIT }}>
          <Sparkles className="w-4 h-4" />
          {saving ? "Genero…" : "Genera Piano"}
        </button>
        {!config && (
          <span className="text-[11px] text-gray-600">
            Serve almeno una gara con tempo e data future.
          </span>
        )}
      </div>
    </div>
  );
}
