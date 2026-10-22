import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  Activity, Check, ChevronDown, Dumbbell, Footprints, HeartPulse, Repeat, ShieldAlert, Stethoscope, TriangleAlert,
} from "lucide-react";
import { CartesianGrid, LineChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import {
  AnalyticsChartCard, CHART_SERIES, ChartCard, ChartLegend, ChartPanel, ChartTip,
  chartGrid, chartMargin, chartReferenceLine, chartXAxis, chartYAxis, seriesStroke,
} from "../charts";
import {
  CAUSES, EQUIPMENT, PAIN_BANDS, PHASES, RED_FLAGS, RETURN_RULES, RETURN_TO_RUN,
  exercisesFor, painBand, painPeak, painTrend, phaseById,
  type Equipment, type Exercise, type PainEntry, type PainTrend, type PhaseId,
} from "../../data/shinRehab";
import { doneToday, localIso } from "./shinRehabState";
import { useShinRehab } from "./useShinRehab";

const MONO = "'JetBrains Mono', monospace";

const BAND_TONE = {
  verde: "text-ea-green border-ea-green/40 bg-ea-green/10",
  giallo: "text-ea-amber border-ea-amber/40 bg-ea-amber/10",
  rosso: "text-ea-rose border-ea-rose/40 bg-ea-rose/10",
} as const;

const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// ── pezzi piccoli ─────────────────────────────────────────────────────────────

/** Una casella che si spunta: pulsante vero, area di tocco da 44 px. */
function CheckBox({ checked, onChange, label, className }: {
  checked: boolean; onChange: () => void; label: string; className?: string;
}) {
  return (
    <button
      type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      className={clsx("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", className)}
    >
      <span
        className={clsx(
          "flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
          checked ? "border-ea-lime bg-ea-lime text-black" : "border-ea-hairline-strong bg-ea-surface-2 text-transparent",
        )}
      >
        <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
      </span>
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-ea-hairline-strong bg-ea-surface-2 px-2 py-0.5 text-xs font-bold text-ea-text-muted">
      {children}
    </span>
  );
}

function Slider({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-white">{label}</span>
        <span className="text-sm font-black tabular-nums text-white" style={{ fontFamily: MONO }}>
          {value}<span className="text-xs text-ea-text-axis"> /10</span>
        </span>
      </div>
      <input
        type="range" min={0} max={10} step={1} value={value} aria-label={`${label}, da 0 a 10`}
        onChange={(e) => onChange(Number(e.target.value))} className="h-6 w-full cursor-pointer accent-ea-lime"
      />
      <p className="text-xs text-ea-text-axis">{hint}</p>
    </div>
  );
}

// ── allarmi ───────────────────────────────────────────────────────────────────
function RedFlags() {
  return (
    <ChartCard className="!border-ea-amber/40">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-ea-amber" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-base font-black text-white">Se hai male da settimane, prima fatti visitare</h2>
          <p className="mt-1 text-sm leading-relaxed text-ea-text-muted">
            Questa pagina è un programma di esercizi, non una diagnosi. Dopo qualche settimana di dolore conviene un
            medico dello sport o un fisioterapista, con una risonanza se serve, per escludere una frattura da stress:
            è la cosa che cambia tutto, perché con una frattura non si corre né si saltella.
          </p>
          <details className="group mt-3">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-sm font-bold text-ea-amber">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
              Quando serve subito un medico
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="mt-1 space-y-2 pb-1">
              {RED_FLAGS.map((f) => (
                <li key={f.id} className="flex gap-2 text-sm leading-relaxed text-ea-text-muted">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ea-amber" aria-hidden="true" />
                  {f.text}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </ChartCard>
  );
}

// ── fasi ──────────────────────────────────────────────────────────────────────
function PhaseSection({ phaseId, gates, onPhase, onGate }: {
  phaseId: PhaseId; gates: Record<string, boolean>; onPhase: (p: PhaseId) => void; onGate: (id: string) => void;
}) {
  const phase = phaseById(phaseId);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Fase del programma">
        {PHASES.map((p) => {
          const done = p.gates.filter((g) => gates[g.id]).length;
          const active = p.id === phaseId;
          return (
            <button
              key={p.id} type="button" aria-pressed={active} onClick={() => onPhase(p.id)}
              className={clsx(
                "rounded-2xl border p-4 text-left transition-colors",
                active ? "border-ea-lime/60 bg-ea-surface-2" : "border-ea-hairline bg-ea-surface-1 hover:border-ea-hairline-strong",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={clsx("text-xs font-black uppercase tracking-[0.2em]", active ? "text-ea-lime" : "text-ea-text-axis")}>
                  {p.label}
                </span>
                <span className="text-xs font-bold tabular-nums text-ea-text-axis" style={{ fontFamily: MONO }}>
                  {done}/{p.gates.length}
                </span>
              </div>
              <div className="mt-1 text-sm font-bold text-white">{p.title}</div>
            </button>
          );
        })}
      </div>

      <ChartCard>
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-ea-lime">{phase.label}</h2>
            <p className="text-sm leading-relaxed text-white">{phase.goal}</p>
            <dl className="space-y-3">
              <div className="rounded-xl bg-ea-surface-2 p-3">
                <dt className="text-xs font-black uppercase tracking-[0.18em] text-ea-text-axis">Corsa</dt>
                <dd className="mt-1 text-sm leading-relaxed text-ea-text-muted">{phase.running}</dd>
              </div>
              <div className="rounded-xl bg-ea-surface-2 p-3">
                <dt className="text-xs font-black uppercase tracking-[0.18em] text-ea-text-axis">Quanto e quando</dt>
                <dd className="mt-1 text-sm leading-relaxed text-ea-text-muted">{phase.frequency}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-ea-text-axis">{phase.gatesTitle}</h3>
            <ul>
              {phase.gates.map((g) => (
                <li key={g.id} className="flex items-start gap-1">
                  <CheckBox checked={!!gates[g.id]} onChange={() => onGate(g.id)} label={g.text} />
                  <span className="pt-2.5 text-sm leading-relaxed text-ea-text-muted">{g.text}</span>
                </li>
              ))}
            </ul>
            {phase.gates.every((g) => gates[g.id]) && (
              <p className="mt-2 rounded-lg bg-ea-green/10 px-3 py-2 text-sm font-bold text-ea-green">
                {phase.id === "corsa" ? "Tutti i criteri sono a posto." : "Criteri a posto: puoi passare alla fase dopo."}
              </p>
            )}
          </div>
        </div>
      </ChartCard>
    </div>
  );
}

// ── esercizi ──────────────────────────────────────────────────────────────────
function ExerciseCard({ ex, done, onToggle }: { ex: Exercise; done: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <ChartCard as="article" className={clsx("gap-3", done && "!border-ea-lime/40")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black leading-snug text-white">{ex.name}</h3>
          <p className="mt-0.5 text-xs text-ea-text-axis">{ex.target}</p>
        </div>
        <CheckBox checked={done} onChange={onToggle} label={`Fatto oggi: ${ex.name}`} className="-my-1.5" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ex.equipment.map((q) => (
          <Tag key={q}>{EQUIPMENT.find((e) => e.id === q)?.label}</Tag>
        ))}
      </div>
      <p className="text-sm font-black text-ea-lime" style={{ fontFamily: MONO }}>{ex.prescription}</p>
      <button
        type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] items-center gap-2 text-left text-sm font-bold text-ea-text-muted hover:text-white"
      >
        Come si fa
        <ChevronDown className={clsx("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div className="space-y-3 border-t border-ea-hairline pt-3">
          <ol className="space-y-2">
            {ex.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ea-text-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ea-surface-3 text-xs font-black text-white">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <p className="rounded-lg bg-ea-surface-2 px-3 py-2 text-sm leading-relaxed text-white">
            <b className="text-ea-amber">Attenzione. </b>{ex.cue}
          </p>
          {ex.progression && (
            <p className="text-sm leading-relaxed text-ea-text-muted">
              <b className="text-ea-green">Quando è facile. </b>{ex.progression}
            </p>
          )}
        </div>
      )}
    </ChartCard>
  );
}

function ExerciseSection({ phaseId, doneIds, today, onToggle }: {
  phaseId: PhaseId; doneIds: string[]; today: string; onToggle: (day: string, id: string) => void;
}) {
  const [equip, setEquip] = useState<Equipment | "tutti">("tutti");
  const all = useMemo(() => exercisesFor(phaseId), [phaseId]);
  const shown = useMemo(() => exercisesFor(phaseId, equip), [phaseId, equip]);
  const doneCount = all.filter((e) => doneIds.includes(e.id)).length;
  const pct = all.length ? Math.round((doneCount / all.length) * 100) : 0;

  return (
    <section aria-labelledby="rehab-exercises" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="rehab-exercises" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-ea-text-axis">
            <Dumbbell className="h-4 w-4" aria-hidden="true" /> Gli esercizi di oggi
          </h2>
          <p className="mt-1 text-sm text-ea-text-muted">
            <b className="tabular-nums text-white" style={{ fontFamily: MONO }}>{doneCount}/{all.length}</b> fatti oggi
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra per attrezzo">
          {([{ id: "tutti", label: "Tutti" }, ...EQUIPMENT] as { id: Equipment | "tutti"; label: string }[]).map((q) => (
            <button
              key={q.id} type="button" aria-pressed={equip === q.id} onClick={() => setEquip(q.id)}
              className={clsx(
                "min-h-[44px] rounded-lg border px-3 text-sm font-bold transition-colors",
                equip === q.id
                  ? "border-ea-lime/60 bg-ea-lime/10 text-ea-lime"
                  : "border-ea-hairline-strong text-ea-text-muted hover:text-white",
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-ea-surface-3"
        role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Esercizi fatti oggi"
      >
        <div className="h-full rounded-full bg-ea-lime transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((ex) => (
          <ExerciseCard key={ex.id} ex={ex} done={doneIds.includes(ex.id)} onToggle={() => onToggle(today, ex.id)} />
        ))}
      </div>
      {shown.length === 0 && (
        <p className="text-sm text-ea-text-muted">Nessun esercizio di questa fase con quell'attrezzo: scegline un altro.</p>
      )}
    </section>
  );
}

// ── ritorno alla corsa ────────────────────────────────────────────────────────
function ReturnToRun({ runStep, onStep }: { runStep: number; onStep: (n: number) => void }) {
  return (
    <ChartPanel
      icon={Footprints} title="Ritorno alla corsa"
      hint="Corsa e cammino alternati, a giorni alterni. Si sale di un passo solo dopo due uscite senza dolore."
    >
      <ol className="space-y-1.5">
        {RETURN_TO_RUN.map((r) => {
          const done = r.step <= runStep;
          const next = r.step === runStep + 1;
          return (
            <li
              key={r.step}
              className={clsx(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                done ? "border-ea-green/30 bg-ea-green/10" : next ? "border-ea-lime/50 bg-ea-surface-2" : "border-ea-hairline",
              )}
            >
              <span className={clsx("w-14 shrink-0 text-xs font-black uppercase tracking-[0.15em]", done ? "text-ea-green" : next ? "text-ea-lime" : "text-ea-text-axis")}>
                Passo {r.step}
              </span>
              <span className="flex-1 text-sm font-bold text-white" style={{ fontFamily: MONO }}>{r.label}</span>
              {done && <Check className="h-4 w-4 text-ea-green" strokeWidth={3} aria-label="completato" />}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          type="button" disabled={runStep >= RETURN_TO_RUN.length} onClick={() => onStep(runStep + 1)}
          className="min-h-[44px] rounded-lg bg-ea-lime px-4 text-sm font-black text-black disabled:opacity-40"
        >
          Due uscite senza dolore: passo {Math.min(runStep + 1, RETURN_TO_RUN.length)} fatto
        </button>
        <button
          type="button" disabled={runStep <= 0} onClick={() => onStep(runStep - 1)}
          className="min-h-[44px] rounded-lg border border-ea-hairline-strong px-4 text-sm font-bold text-ea-text-muted hover:text-white disabled:opacity-40"
        >
          Torna indietro di un passo
        </button>
      </div>
      <ul className="space-y-2">
        {RETURN_RULES.map((r, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ea-text-muted">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ea-lime" aria-hidden="true" />
            {r}
          </li>
        ))}
      </ul>
    </ChartPanel>
  );
}

// ── dolore ────────────────────────────────────────────────────────────────────
function PainRules() {
  return (
    <ChartPanel
      icon={HeartPulse} title="Il semaforo del dolore"
      hint="Scrivi un numero da 0 a 10 durante l'esercizio e uno la mattina dopo: decide il secondo."
    >
      <div className="grid gap-3 md:grid-cols-3">
        {PAIN_BANDS.map((b) => (
          <div key={b.id} className={clsx("rounded-xl border p-4", BAND_TONE[b.id])}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-black">{b.title}</span>
              <span className="text-sm font-black tabular-nums" style={{ fontFamily: MONO }}>{b.range}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-white">{b.text}</p>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}

const TREND_TEXT: Record<PainTrend, { tone: string; text: string }> = {
  scende: { tone: "text-ea-green", text: "Il dolore sta scendendo: continua come prevede la fase." },
  stabile: { tone: "text-ea-amber", text: "Il dolore è fermo: tieni il carico, non salire, e controlla i criteri di fase." },
  sale: { tone: "text-ea-rose", text: "Il dolore sta salendo: torna indietro di un livello e, se non cala in qualche giorno, fatti visitare." },
  "dati-pochi": { tone: "text-ea-text-axis", text: "Servono almeno 4 giorni di registro per dire come va." },
};

function PainLog({ pain, today, onSave }: { pain: PainEntry[]; today: string; onSave: (e: PainEntry) => void }) {
  const current = pain.find((e) => e.date === today);
  const [morning, setMorning] = useState(current?.morning ?? 0);
  const [walking, setWalking] = useState(current?.walking ?? 0);
  const [effort, setEffort] = useState(current?.effort ?? 0);

  const data = useMemo(() => pain.slice(-30).map((e) => ({ ...e, label: dayLabel(e.date) })), [pain]);
  const trend = painTrend(pain);
  const band = painBand(Math.max(morning, walking, effort));
  const bandInfo = PAIN_BANDS.find((b) => b.id === band)!;

  const last = pain[pain.length - 1];
  const summary = last
    ? `Ultima registrazione il ${dayLabel(last.date)}: mattino ${last.morning}, camminando ${last.walking}, sforzo ${last.effort}.`
    : "Nessuna registrazione ancora.";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <ChartPanel icon={Activity} title="Come sta oggi la gamba" hint="Tre numeri, una volta al giorno. Si salvano in questo browser.">
        <div className="space-y-4">
          <Slider label="Primo passo del mattino" hint="Appena scendi dal letto: il numero che conta di più." value={morning} onChange={setMorning} />
          <Slider label="Camminando" hint="Durante la giornata, a passo normale." value={walking} onChange={setWalking} />
          <Slider label="Durante esercizi o corsa" hint="Il picco mentre ti alleni." value={effort} onChange={setEffort} />
          <div className={clsx("rounded-xl border px-3 py-2 text-sm font-bold", BAND_TONE[band])}>
            {bandInfo.title}: {bandInfo.text}
          </div>
          <button
            type="button" onClick={() => onSave({ date: today, morning, walking, effort })}
            className="min-h-[44px] w-full rounded-lg bg-ea-lime px-4 text-sm font-black text-black"
          >
            {current ? "Aggiorna oggi" : "Salva oggi"}
          </button>
        </div>
      </ChartPanel>

      <AnalyticsChartCard
        title="Il dolore nei giorni"
        description="0 è nessun dolore, 10 il peggiore. Sotto la linea tratteggiata si può procedere."
        icon={<HeartPulse className="h-4 w-4" />}
        size="standard"
        status={data.length ? "ready" : "empty"}
        statusMessage="Registra il dolore di oggi per iniziare il grafico."
        plotLabel="Dolore giornaliero da 0 a 10: mattino, camminando, durante lo sforzo"
        summary={summary}
        legend={
          <ChartLegend
            items={[
              { key: "morning", label: "Mattino", color: CHART_SERIES.risk, kind: "line" },
              { key: "walking", label: "Camminando", color: CHART_SERIES.load, kind: "line" },
              { key: "effort", label: "Sforzo", color: CHART_SERIES.tertiary, kind: "line" },
            ]}
          />
        }
        insight={<span className={TREND_TEXT[trend].tone}>{TREND_TEXT[trend].text}</span>}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={chartMargin}>
            <CartesianGrid {...chartGrid} />
            <XAxis {...chartXAxis} dataKey="label" />
            <YAxis {...chartYAxis} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
            <ChartTip formatter={(v: number, name: string) => [`${v}/10`, name]} />
            <ReferenceLine {...chartReferenceLine} y={3} />
            <Line {...seriesStroke(CHART_SERIES.risk, "observed")} dataKey="morning" name="Mattino" type="monotone" dot={{ r: 3 }} />
            <Line {...seriesStroke(CHART_SERIES.load, "observed")} dataKey="walking" name="Camminando" type="monotone" dot={{ r: 3 }} />
            <Line {...seriesStroke(CHART_SERIES.tertiary, "observed")} dataKey="effort" name="Sforzo" type="monotone" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </AnalyticsChartCard>
    </div>
  );
}

function Causes() {
  return (
    <ChartPanel icon={Repeat} title="Perché torna" hint="Le quattro cose che nella pratica lo fanno ricadere.">
      <div className="grid gap-3 md:grid-cols-2">
        {CAUSES.map((c) => (
          <div key={c.id} className="rounded-xl bg-ea-surface-2 p-4">
            <h3 className="text-sm font-black text-white">{c.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ea-text-muted">{c.text}</p>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}

// ── pagina ────────────────────────────────────────────────────────────────────
export function ShinRehabView() {
  const { state, setPhase, toggleGate, toggleDone, savePain, setRunStep } = useShinRehab();
  const today = localIso();
  const doneIds = state.done[today] ?? [];
  const phaseExercises = useMemo(() => exercisesFor(state.phase).map((e) => e.id), [state.phase]);
  const todayCount = doneToday(state, phaseExercises, today);
  const peakToday = (() => {
    const e = state.pain.find((p) => p.date === today);
    return e ? painPeak(e) : null;
  })();

  return (
    <main className="flex-1 overflow-y-auto bg-ea-ink">
      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 text-white md:space-y-8 md:px-6 md:py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-tighter md:text-4xl">
            Shin <span className="text-ea-lime">splints</span>
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-ea-text-muted">
            Il programma per guarire la sindrome da stress tibiale mediale: tre fasi, a corpo libero, con manubri,
            elastico e gilet. Non ha una scadenza: si passa alla fase dopo quando i criteri sono a posto, non quando
            è passato il tempo.
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-[0.18em] text-ea-text-axis">
            <span className="flex items-center gap-1.5"><Stethoscope className="h-4 w-4" aria-hidden="true" /> Fase {phaseById(state.phase).label}</span>
            <span>Oggi {todayCount}/{phaseExercises.length} esercizi</span>
            {peakToday != null && <span>Dolore di oggi {peakToday}/10</span>}
          </p>
        </header>

        <RedFlags />

        <PhaseSection phaseId={state.phase} gates={state.gates} onPhase={setPhase} onGate={toggleGate} />

        <ExerciseSection phaseId={state.phase} doneIds={doneIds} today={today} onToggle={toggleDone} />

        {state.phase === "corsa" && <ReturnToRun runStep={state.runStep} onStep={setRunStep} />}

        <PainRules />
        <PainLog pain={state.pain} today={today} onSave={savePain} />
        <Causes />
      </div>
    </main>
  );
}
