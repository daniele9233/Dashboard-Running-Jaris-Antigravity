import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart,
  ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Dna, Hourglass, Microscope, Snowflake, Sun, Thermometer, Timer } from "lucide-react";
import type { Profile, Run } from "../../types/api";
import { usePhysio } from "../gamification/usePhysio";
import {
  SYSTEMS, SYSTEM_ORDER, adaptationCeiling, climateAt, doseWithRecipe, planToDose, runScenario,
  zeroLevels, type RecipeId, type SystemLevels, type WeeklyPlan,
} from "../gamification/physioEngine";
import { fmtClock, heatSlowdownFrac as heatPenaltyFrac, predictSec } from "../gamification/gamiCore";
import { CHART_SERIES, CHART_SURFACE, CHART_TEXT } from "./chartTheme";

/**
 * BIOLOGIA E FUTURO · V2
 * ════════════════════════════════════════════════════════════════════════════
 * Quattro domande che un atleta si fa davvero, e a cui serve un grafico per
 * rispondere onestamente:
 *
 *   1. «Se mi fermo, quanto perdo — e cosa perdo prima?»  Le costanti di tempo
 *      dei cinque sistemi sono diversissime (15 giorni la potenza aerobica, 60
 *      la tenuta): è per questo che una settimana di stop non è un dramma e sei
 *      non si recuperano in due. Qui la curva del decadimento è calcolata, non
 *      raccontata.
 *   2. «Quale seduta conviene aggiungere?»  Quattro ricette messe a correre in
 *      parallelo nello stesso modello, per dodici settimane.
 *   3. «Quando corro forte?»  Il clima del posto dove corri, mese per mese,
 *      tradotto nel tempo che faresti sui 5 km. È il calendario delle gare.
 *   4. «Quanto mi resta, biologicamente?»  Il declino del VO2max con l'età
 *      contro quello che il tuo allenamento sta ancora costruendo.
 *
 * Il motore è physioEngine, lo stesso della gamification e del Banco di prova.
 * La sezione originale (Detraining / Biologia & Futuro) resta intatta: questa è
 * una seconda lettura, non un rimpiazzo.
 */

const PANEL = CHART_SURFACE.panel;
const BORDER = CHART_SURFACE.border;
const GRID = CHART_SURFACE.grid;
const LIME = CHART_SERIES.primary;
const CYAN = CHART_SERIES.compare;
const MONO = "'JetBrains Mono', monospace";

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

const box = {
  background: "#0A0A0AF5", border: `1px solid ${CHART_SURFACE.borderStrong}`,
  borderRadius: 10, padding: "8px 10px", fontSize: 11,
};

function Panel({ icon: Icon, title, hint, children }: {
  icon: typeof Dna; title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: PANEL }}>
      <div className="flex items-baseline gap-2 px-5 pt-4 pb-3">
        <Icon className="w-4 h-4 self-center" style={{ color: LIME }} />
        <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white">{title}</h3>
        {hint && <span className="ml-auto text-[10px] truncate" style={{ color: CHART_TEXT.faint }}>{hint}</span>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

const RECIPES: { id: RecipeId; label: string; color: string; what: string }[] = [
  { id: "soglia", label: "Una soglia in più", color: SYSTEMS.soglia.color, what: "26′ di lavoro in soglia a settimana" },
  { id: "ripetute", label: "Una seduta di ripetute", color: SYSTEMS.vo2.color, what: "20′ di lavoro sopra soglia" },
  { id: "lungo", label: "Un lungo da 100′", color: SYSTEMS.tenuta.color, what: "100′ in fondo, una volta a settimana" },
  { id: "volume", label: "90′ di lento in più", color: SYSTEMS.mito.color, what: "chilometri, spalmati sulla settimana" },
];

/**
 * Declino del VO2max con l'età, in frazione del valore a 30 anni.
 *
 * ~0,5%/anno in chi resta allenato fino ai 50, poi accelera verso l'1%/anno
 * (Tanaka & Seals 2008, studi longitudinali su master runner). È un modello:
 * serve a dare la forma della curva, non a promettere un numero.
 */
const ageFactor = (age: number) => {
  if (age <= 30) return 1;
  const a = Math.min(age, 85);
  const toFifty = Math.min(a, 50) - 30;
  const afterFifty = Math.max(0, a - 50);
  return 1 - (toFifty * 0.005 + afterFifty * 0.0095);
};

export function BiologyFutureV3({ runs, profile }: { runs: Run[]; profile: Profile | null }) {
  const physio = usePhysio(runs);
  const [stopWeeks, setStopWeeks] = useState(4);

  const easyPace = physio.thresholdPaceSec > 0 ? physio.thresholdPaceSec * 1.22 : 340;

  /** Il carico di adesso, espresso come piano: serve alle ricette. */
  const nowPlan = useMemo<WeeklyPlan>(() => {
    const qualityMin = physio.weeklyZone.threshold + physio.weeklyZone.vo2;
    const sessions = qualityMin >= 12 ? Math.max(1, Math.round(qualityMin / 24)) : 0;
    return {
      km: Math.max(10, Math.round(physio.weeklyKm)),
      qualitySessions: sessions,
      qualityMinutes: sessions ? Math.round(qualityMin / sessions) : 0,
      vo2Share: 0.4,
      longRunMinutes: Math.max(60, Math.round(physio.weeklyMinutes / 4)),
      trainingTempC: climateAt(physio.climate, physio.model.today),
    };
  }, [physio]);

  // ── 1 · SE MI FERMO: il decadimento, sistema per sistema ──
  const decay = useMemo(() => {
    if (!physio.ok) return [];
    const zero: SystemLevels = zeroLevels();
    const days = 84;
    const { points } = runScenario(physio.model, zero, 5000, days, 0.01);
    // runScenario campiona a settimana: aggiungo il giorno zero per partire da oggi
    const t0 = physio.forecast.points[0];
    const out = [{
      week: 0, sec: Math.round(t0?.sec5k ?? points[0]?.sec ?? 0), vdot: physio.vdot,
      ...Object.fromEntries(SYSTEM_ORDER.map((id) => [id, Math.round(physio.byId[id]?.pct ?? 0)])),
    }];
    // i livelli decadono con la loro tau: e^(-giorni/tau)
    for (let w = 1; w <= days / 7; w++) {
      const d = w * 7;
      const row: Record<string, number> = { week: w };
      let vdotLoss = 0;
      for (const id of SYSTEM_ORDER) {
        const pct0 = physio.byId[id]?.pct ?? 0;
        const pct = pct0 * Math.exp(-d / SYSTEMS[id].tau);
        row[id] = Math.round(pct);
        vdotLoss += ((pct0 - pct) / 100) * SYSTEMS[id].vdotSpan;
      }
      row.vdot = Math.round((physio.vdot - vdotLoss) * 10) / 10;
      row.sec = Math.round(points[Math.min(points.length - 1, w - 1)]?.sec ?? 0);
      out.push(row as typeof out[number]);
    }
    return out;
  }, [physio]);

  const decayTop = Math.max(...SYSTEM_ORDER.map((id) => physio.byId[id]?.pct ?? 0), 10);
  const decayAt = decay.find((d) => d.week === stopWeeks) ?? decay[decay.length - 1];
  const decayVdotLoss = decayAt ? Math.round((physio.vdot - decayAt.vdot) * 10) / 10 : 0;

  // ── 2 · LE QUATTRO RICETTE, dodici settimane in parallelo ──
  const recipes = useMemo(() => {
    if (!physio.ok) return { rows: [], summary: [] };
    const base = planToDose(nowPlan, easyPace);
    const ceil = adaptationCeiling(nowPlan);
    const days = 84;
    const baseRun = runScenario(physio.model, base, 5000, days, ceil);
    const series = RECIPES.map((r) => ({
      ...r,
      run: runScenario(physio.model, doseWithRecipe(base, r.id), 5000, days, ceil),
    }));

    const rows = baseRun.points.map((p, i) => {
      const row: Record<string, number | string> = {
        week: i + 1,
        base: Math.round(p.vdotCool * 10) / 10,
      };
      for (const s of series) row[s.id] = Math.round((s.run.points[i]?.vdotCool ?? p.vdotCool) * 10) / 10;
      return row;
    });

    const last = rows[rows.length - 1] as Record<string, number> | undefined;
    const summary = series.map((s) => ({
      id: s.id, label: s.label, color: s.color, what: s.what,
      gain: last ? Math.round(((last[s.id] ?? 0) - (last.base ?? 0)) * 100) / 100 : 0,
      sec5k: last
        ? Math.round((baseRun.points[baseRun.points.length - 1]?.sec ?? 0)
          - (s.run.points[s.run.points.length - 1]?.sec ?? 0))
        : 0,
    })).sort((a, b) => b.gain - a.gain);

    return { rows, summary };
  }, [physio, nowPlan, easyPace]);

  // ── 3 · IL CALENDARIO DEL CLIMA: quando corri forte ──
  /**
   * A FORMA COSTANTE, quanto costa il clima di ogni mese.
   *
   * La prima versione leggeva i mesi dalla curva di previsione, e i mesi già
   * passati non avevano un punto: restavano a zero e il grafico era mezzo vuoto.
   * Qui l'effetto del clima è isolato dalla forma — stesso VDOT tutto l'anno,
   * cambia solo la temperatura — che è esattamente la domanda "in che mese
   * conviene mettere la gara".
   */
  const season = useMemo(() => {
    if (!physio.ok) return [];
    const base = predictSec(5000, physio.vdot);
    return physio.climate.map((t, m) => {
      const sec = base * (1 + heatPenaltyFrac(t, null, 5));
      return {
        month: MESI[m],
        tempC: Math.round(t * 10) / 10,
        sec: Math.round(sec),
        cost: Math.round(sec - base),
      };
    });
  }, [physio]);

  const bestMonth = useMemo(
    () => season.reduce((a, b) => (b.sec < a.sec ? b : a), season[0] ?? { month: "—", sec: 0 }),
    [season],
  );

  // ── 4 · ETÀ E TETTO BIOLOGICO ──
  const age = profile?.age ?? 40;
  const ageCurve = useMemo(() => {
    const potentialNow = Math.max(physio.forecast.plateau, physio.vdot);
    const at30 = potentialNow / ageFactor(age);
    const out: { age: number; ceiling: number; you?: number }[] = [];
    for (let a = Math.max(25, age - 15); a <= age + 25; a++) {
      out.push({ age: a, ceiling: Math.round(at30 * ageFactor(a) * 10) / 10 });
    }
    return out;
  }, [age, physio.forecast.plateau, physio.vdot]);

  const lossPerDecade = useMemo(() => {
    const now = ageCurve.find((p) => p.age === age)?.ceiling ?? 0;
    const then = ageCurve.find((p) => p.age === age + 10)?.ceiling ?? now;
    return Math.round((now - then) * 10) / 10;
  }, [ageCurve, age]);

  const headroom = Math.round((Math.max(0, physio.forecast.plateau - physio.vdot)) * 10) / 10;

  if (!physio.ok) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: BORDER, background: PANEL }}>
        <p className="text-[12px]" style={{ color: CHART_TEXT.muted }}>
          Il modello biologico ha bisogno di almeno cinque corse con passo e durata.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ══ 1 · SE MI FERMO ═════════════════════════════════════════════════ */}
      <Panel
        icon={Hourglass} title="Se mi fermo, cosa perdo prima"
        hint="decadimento con le costanti di tempo reali dei cinque sistemi"
      >
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={decay} margin={{ top: 8, right: 14, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week" tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                    tickFormatter={(w: number) => (w === 0 ? "oggi" : `${w}s`)}
                    stroke={CHART_SURFACE.borderStrong}
                  />
                  <YAxis
                    domain={[0, Math.max(40, Math.ceil(decayTop / 10) * 10)]} width={44} unit="%"
                    tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                    stroke={CHART_SURFACE.borderStrong}
                  />
                  <Tooltip
                    contentStyle={box}
                    labelFormatter={(w) => (w === 0 ? "oggi" : `dopo ${w} settimane di stop`)}
                    formatter={(v: number, n) => [`${v}%`, SYSTEMS[n as keyof typeof SYSTEMS]?.name ?? String(n)]}
                  />
                  <ReferenceArea x1={0} x2={stopWeeks} fill={LIME} fillOpacity={0.05} />
                  <ReferenceLine x={stopWeeks} stroke={LIME} strokeDasharray="4 3" />
                  {SYSTEM_ORDER.map((id) => (
                    <Line
                      key={id} type="monotone" dataKey={id} stroke={SYSTEMS[id].color}
                      strokeWidth={2} dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[10.5px]" style={{ color: CHART_TEXT.muted }}>Settimane di stop</span>
                <span className="text-[13px] font-black tabular-nums" style={{ fontFamily: MONO, color: LIME }}>
                  {stopWeeks}
                </span>
              </div>
              <input
                type="range" min={1} max={12} step={1} value={stopWeeks}
                onChange={(e) => setStopWeeks(+e.target.value)}
                className="w-full accent-[#C0FF00] cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="rounded-xl border p-3.5" style={{ borderColor: `${CHART_SERIES.risk}44`, background: `${CHART_SERIES.risk}0d` }}>
              <div className="text-[9px] font-black tracking-[0.2em] uppercase mb-1" style={{ color: CHART_SERIES.risk }}>
                Dopo {stopWeeks} {stopWeeks === 1 ? "settimana" : "settimane"}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: CHART_SERIES.risk }}>
                  −{decayVdotLoss.toFixed(1)}
                </span>
                <span className="text-[10px]" style={{ color: CHART_TEXT.muted }}>punti VDOT</span>
              </div>
              <div className="mt-1.5 text-[11px]" style={{ color: CHART_TEXT.muted }}>
                Il 5 km passerebbe da{" "}
                <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(decay[0]?.sec ?? 0)}</b>{" "}
                a <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(decayAt?.sec ?? 0)}</b>.
              </div>
            </div>

            {SYSTEM_ORDER.map((id) => {
              const pct0 = physio.byId[id]?.pct ?? 0;
              const left = pct0 * Math.exp(-(stopWeeks * 7) / SYSTEMS[id].tau);
              const lost = pct0 > 0 ? Math.round(((pct0 - left) / pct0) * 100) : 0;
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SYSTEMS[id].color }} />
                  <span className="text-[11px] text-white/80 flex-1 min-w-0 truncate">{SYSTEMS[id].name}</span>
                  <div className="w-20 h-[4px] rounded-full overflow-hidden shrink-0" style={{ background: "#1A1A1A" }}>
                    <div className="h-full rounded-full" style={{ width: `${lost}%`, background: SYSTEMS[id].color }} />
                  </div>
                  <span className="text-[10px] tabular-nums w-12 text-right shrink-0" style={{ fontFamily: MONO, color: CHART_TEXT.muted }}>
                    −{lost}%
                  </span>
                </div>
              );
            })}
            <p className="text-[10.5px] leading-relaxed pt-1" style={{ color: CHART_TEXT.faint }}>
              Le ripetute svaniscono in tre settimane (τ {SYSTEMS.vo2.tau} giorni), il motore aerobico regge
              mesi (τ {SYSTEMS.mito.tau}). È per questo che dopo una pausa torna prima il fondo e poi la
              velocità — e perché non si recupera una stagione in dieci giorni.
            </p>
          </div>
        </div>
      </Panel>

      {/* ══ 2 · LE QUATTRO RICETTE ══════════════════════════════════════════ */}
      <Panel
        icon={Microscope} title="Quale seduta conviene aggiungere"
        hint="dodici settimane, una ricetta alla volta, sopra il carico di adesso"
      >
        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recipes.rows} margin={{ top: 8, right: 14, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis
                  dataKey="week" tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                  tickFormatter={(w: number) => `${w}s`}
                  stroke={CHART_SURFACE.borderStrong}
                />
                <YAxis
                  domain={["auto", "auto"]} width={44}
                  tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                  stroke={CHART_SURFACE.borderStrong}
                />
                <Tooltip
                  contentStyle={box}
                  labelFormatter={(w) => `fra ${w} settimane`}
                  formatter={(v: number, n) => [
                    v.toFixed(1),
                    n === "base" ? "Come adesso" : RECIPES.find((r) => r.id === n)?.label ?? String(n),
                  ]}
                />
                <Line type="monotone" dataKey="base" stroke={CHART_TEXT.axis} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                {RECIPES.map((r) => (
                  <Line key={r.id} type="monotone" dataKey={r.id} stroke={r.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {recipes.summary.map((r, i) => (
              <div
                key={r.id} className="rounded-xl border p-3"
                style={{
                  borderColor: i === 0 ? `${r.color}66` : BORDER,
                  background: i === 0 ? `${r.color}0f` : "#0A0A0A",
                }}
              >
                <div className="flex items-baseline gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                  <span className="text-[12px] font-bold text-white flex-1 min-w-0">{r.label}</span>
                  <span className="text-[13px] font-black tabular-nums shrink-0" style={{ fontFamily: MONO, color: r.color }}>
                    +{r.gain.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-[10px]" style={{ color: CHART_TEXT.muted }}>{r.what}</span>
                  {r.sec5k > 0 && (
                    <span className="text-[10px] tabular-nums shrink-0" style={{ fontFamily: MONO, color: CHART_SERIES.positive }}>
                      −{fmtClock(r.sec5k)} sui 5 km
                    </span>
                  )}
                </div>
              </div>
            ))}
            <p className="text-[10.5px] leading-relaxed pt-1" style={{ color: CHART_TEXT.faint }}>
              I punti sono pochi perché tre mesi sono pochi: la differenza fra la prima e l'ultima ricetta è
              quella fra allenare il sistema che ti frena e allenarne uno già pieno.
            </p>
          </div>
        </div>
      </Panel>

      {/* ══ 3 · IL CALENDARIO DEL CLIMA ═════════════════════════════════════ */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel icon={Thermometer} title="Quando corri forte" hint="clima dei tuoi percorsi, mese per mese">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={season} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }} stroke={CHART_SURFACE.borderStrong} />
                <YAxis
                  yAxisId="cost" width={46}
                  tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                  tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}s`}
                  stroke={CHART_SURFACE.borderStrong}
                />
                <YAxis yAxisId="t" orientation="right" width={34} hide />
                <Tooltip
                  contentStyle={box}
                  labelFormatter={(m) => {
                    const row = season.find((x) => x.month === m);
                    return row ? `${m} · ${row.tempC}°C · ${fmtClock(row.sec)} sui 5 km` : String(m);
                  }}
                  formatter={(v: number, n) => n === "cost"
                    ? [`${v > 0 ? "+" : ""}${v}s`, "costo del clima"]
                    : [`${v}°C`, "temperatura tipica"]}
                />
                <Bar yAxisId="cost" dataKey="cost" radius={[4, 4, 0, 0]} barSize={18}>
                  {season.map((s) => (
                    <Cell
                      key={s.month}
                      fill={s.cost <= 0 ? CHART_SERIES.positive : s.cost < 15 ? CHART_SERIES.load : CHART_SERIES.risk}
                      fillOpacity={s.month === bestMonth.month ? 1 : 0.6}
                    />
                  ))}
                </Bar>
                <Line yAxisId="t" type="monotone" dataKey="tempC" stroke={CYAN} strokeWidth={1.8} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border p-3" style={{ borderColor: BORDER, background: "#0A0A0A" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Snowflake className="w-3.5 h-3.5" style={{ color: CYAN }} />
                <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: CHART_TEXT.axis }}>Mese migliore</span>
              </div>
              <div className="text-[18px] font-black uppercase" style={{ color: CYAN }}>{bestMonth.month}</div>
              <div className="text-[10.5px]" style={{ color: CHART_TEXT.muted }}>
                {fmtClock(bestMonth.sec)} sui 5 km, a forma costante.
              </div>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: BORDER, background: "#0A0A0A" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Sun className="w-3.5 h-3.5" style={{ color: CHART_SERIES.load }} />
                <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: CHART_TEXT.axis }}>Il caldo oggi</span>
              </div>
              <div className="text-[18px] font-black tabular-nums" style={{ fontFamily: MONO, color: CHART_SERIES.load }}>
                +{Math.round(physio.heatCost5kNow)}s
              </div>
              <div className="text-[10.5px]" style={{ color: CHART_TEXT.muted }}>
                Quando rinfresca l'adattamento te ne restituisce {Math.round(physio.heatCreditCool)}.
              </div>
            </div>
          </div>
        </Panel>

        {/* ══ 4 · ETÀ E TETTO BIOLOGICO ═════════════════════════════════════ */}
        <Panel icon={Dna} title="Il tetto biologico" hint={`${age} anni · declino modellato del VO2max`}>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ageCurve} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="bf3-age" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_SERIES.tertiary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_SERIES.tertiary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis
                  dataKey="age" tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                  stroke={CHART_SURFACE.borderStrong}
                />
                <YAxis
                  domain={["auto", "auto"]} width={44}
                  tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                  stroke={CHART_SURFACE.borderStrong}
                />
                <Tooltip
                  contentStyle={box}
                  labelFormatter={(a) => `${a} anni`}
                  formatter={(v: number) => [v.toFixed(1), "tetto VDOT"]}
                />
                <Area type="monotone" dataKey="ceiling" stroke={CHART_SERIES.tertiary} strokeWidth={2} fill="url(#bf3-age)" dot={false} />
                <ReferenceLine y={physio.vdot} stroke={LIME} strokeDasharray="5 4"
                  label={{ value: `sei qui ${physio.vdot.toFixed(1)}`, position: "insideBottomLeft", fill: LIME, fontSize: 10, fontFamily: MONO }} />
                <ReferenceDot x={age} y={ageCurve.find((p) => p.age === age)?.ceiling ?? physio.vdot}
                  r={4.5} fill={CHART_SERIES.tertiary} stroke="#0A0A0A" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border p-3" style={{ borderColor: BORDER, background: "#0A0A0A" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Timer className="w-3.5 h-3.5" style={{ color: CHART_SERIES.risk }} />
                <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: CHART_TEXT.axis }}>L'età si prende</span>
              </div>
              <div className="text-[18px] font-black tabular-nums" style={{ fontFamily: MONO, color: CHART_SERIES.risk }}>
                −{lossPerDecade.toFixed(1)}
              </div>
              <div className="text-[10.5px]" style={{ color: CHART_TEXT.muted }}>punti VDOT nei prossimi dieci anni</div>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: `${LIME}44`, background: `${LIME}0d` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Microscope className="w-3.5 h-3.5" style={{ color: LIME }} />
                <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: CHART_TEXT.axis }}>L'allenamento ti dà</span>
              </div>
              <div className="text-[18px] font-black tabular-nums" style={{ fontFamily: MONO, color: LIME }}>
                +{headroom.toFixed(1)}
              </div>
              <div className="text-[10.5px]" style={{ color: CHART_TEXT.muted }}>punti ancora liberi con questo carico</div>
            </div>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed" style={{ color: CHART_TEXT.faint }}>
            La curva è un modello: mezzo punto percentuale di VO2max all'anno fino ai cinquanta, poi circa uno
            (Tanaka & Seals). Il confronto che conta è fra i due numeri qui sopra — finché l'allenamento dà più
            di quanto l'età toglie, i tuoi primati sono ancora davanti.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export default BiologyFutureV3;
