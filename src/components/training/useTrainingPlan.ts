import { useCallback, useEffect, useMemo, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import { getRuns, getVdotPaces, getPlanState, putPlanState } from "../../api";
import type { Run, RunsResponse, VdotPacesResponse } from "../../types/api";
import { cleanRuns, dayIndex, paceToSec, heatSlowdownFrac, humidityOf, vdotFrom } from "../gamification/gamiCore";
import { climateFromRuns, ROME, type Climate } from "./climate";
import { buildPlan, type FitnessSnapshot, type Plan, type PlanConfig, type RaceGoal } from "./planEngine";

/**
 * IL PONTE FRA I DATI E IL PIANO
 * ════════════════════════════════════════════════════════════════════════════
 * Il motore è una funzione pura: gli si passa una fotografia della forma e
 * restituisce un piano. Questo hook scatta la fotografia.
 *
 * La regola che vale più di tutte: il VDOT lo dà il backend, non questa pagina.
 * Ricalcolarlo qui significherebbe mostrare all'atleta due numeri diversi nella
 * stessa app, ed è un errore già pagato altrove. Se l'ancora del backend non
 * c'è, si stima dalle prove reali — e la pagina lo dichiara.
 */

const WEEK_MS = 7;

export interface PlanState {
  config: PlanConfig | null;
  /** data ISO → esito della seduta. */
  log: Record<string, SessionOutcome>;
  /** id del test → risultato inserito dall'atleta. */
  tests: Record<string, TestResult>;
}

export type SessionOutcome = "done" | "partial" | "skipped";

export interface TestResult {
  dateIso: string;
  /** Quello che l'atleta ha scritto: tempo in secondi, o passo medio. */
  valueSec: number;
  note?: string;
}

/* ── la fotografia della forma ─────────────────────────────────────────────── */

interface Derived {
  fitness: FitnessSnapshot;
  /** Il clima in cui si allena: le sue corse. */
  climate: Climate;
  /** Il clima in cui si gareggia: le normali, che nessuno ha selezionato. */
  raceClimate: Climate;
  /** Da dove viene ogni numero: va mostrato, non nascosto. */
  provenance: { vdot: string; volume: string; climate: string };
  weeklyHistory: { weekIso: string; km: number }[];
  ready: boolean;
}

const mondayIso = (iso: string) => {
  const d = dayIndex(iso);
  const dow = (new Date(d * 86400000).getUTCDay() + 6) % 7;
  return new Date((d - dow) * 86400000).toISOString().slice(0, 10);
};

/**
 * Stima di riserva del VDOT.
 *
 * Solo prove ≥5 km: sotto quella distanza il contributo anaerobico gonfia il
 * numero — una 4 km tirata dà un VDOT da cui escono previsioni sui 5000 che
 * non reggono. È una regola già pagata a caro prezzo altrove nell'app.
 */
function seedVdot(runs: Run[]): { vdot: number; from: string } | null {
  let best = 0, from = "";
  for (const r of runs) {
    if (r.is_treadmill) continue;
    const ps = paceToSec(r.avg_pace), km = r.distance_km || 0;
    if (!ps || km < 5 || km > 25) continue;
    const cool = ps / (1 + heatSlowdownFrac(r.temperature, humidityOf(r), km));
    const v = vdotFrom(km * 1000, cool * km);
    if (v > best) { best = v; from = `${km.toFixed(1)} km del ${r.date}, riportati al fresco`; }
  }
  return best > 0 ? { vdot: Math.min(80, Math.max(25, best)), from } : null;
}

export function deriveFitness(runs: Run[], vdotAnchor: number | null, todayIso: string): Derived {
  const clean = cleanRuns(runs).filter((r) => !r.is_treadmill);
  const today = dayIndex(todayIso);

  /* ── volume settimanale ── */
  const byWeek = new Map<string, number>();
  const dayHasRun = new Set<string>();
  for (const r of clean) {
    if (!r.date) continue;
    byWeek.set(mondayIso(r.date), (byWeek.get(mondayIso(r.date)) ?? 0) + (r.distance_km || 0));
    dayHasRun.add(r.date);
  }
  const weeks = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekIso, km]) => ({ weekIso, km: Math.round(km * 10) / 10 }));

  // le settimane VUOTE contano come zero: saltare due settimane e poi fare 40
  // non è "40 km a settimana", ed è la differenza fra un piano e un infortunio
  const spanWeeks = (from: number, to: number) => {
    const out: number[] = [];
    for (let d = today - to * WEEK_MS; d < today - from * WEEK_MS; d += WEEK_MS) {
      const iso = mondayIso(new Date(d * 86400000).toISOString().slice(0, 10));
      out.push(byWeek.get(iso) ?? 0);
    }
    return out;
  };

  const last4 = spanWeeks(0, 4);
  const last12 = spanWeeks(0, 12);
  const weeklyKm = last4.length ? last4.reduce((s, v) => s + v, 0) / last4.length : 0;
  const peakWeeklyKm = last12.length ? Math.max(...last12) : weeklyKm;

  const recent6w = clean.filter((r) => r.date && dayIndex(r.date) > today - 42);
  const longestKm = recent6w.length ? Math.max(...recent6w.map((r) => r.distance_km || 0)) : 0;

  const last8wDays = new Set([...dayHasRun].filter((d) => dayIndex(d) > today - 56));
  const runsPerWeek = Math.round((last8wDays.size / 8) * 10) / 10;

  /* ── VDOT ── */
  const seed = seedVdot(clean);
  const vdot = vdotAnchor && vdotAnchor > 0 ? vdotAnchor : (seed?.vdot ?? 45);
  const vdotSource = vdotAnchor && vdotAnchor > 0
    ? "ancora del backend, la stessa di tutto il resto dell'app"
    : seed
      ? `stima locale su ${seed.from} — l'ancora del backend non è arrivata`
      : "nessuna prova utilizzabile: numero di riserva, da rifare con il test dei 3000";

  /* ── clima ── */
  const withWeather = clean.filter((r) => r.temperature != null && r.start_date_local).length;
  const climate = withWeather >= 30 ? climateFromRuns(clean) : ROME;

  return {
    fitness: {
      vdot: Math.round(vdot * 10) / 10,
      vdotSource,
      weeklyKm: Math.round(weeklyKm * 10) / 10,
      peakWeeklyKm: Math.round(peakWeeklyKm * 10) / 10,
      longestKm: Math.round(longestKm * 10) / 10,
      runsPerWeek,
      vdotDemonstrated: seed ? Math.round(seed.vdot * 10) / 10 : null,
      vdotDemonstratedFrom: seed?.from,
    },
    climate,
    raceClimate: ROME,
    provenance: {
      vdot: vdotSource,
      volume: `media delle ultime 4 settimane (le settimane senza corse contano zero) · picco su 12 · lungo su 6`,
      climate: withWeather >= 30
        ? `allenamenti: dalle tue ${withWeather} corse con meteo, riportate alla media giornaliera · `
          + "gare: normali climatiche, perché i giorni brutti li salti tu, non la gara"
        : "normali climatiche di Roma: servono almeno 30 corse con meteo e orario per usare le tue",
    },
    weeklyHistory: weeks.slice(-16),
    ready: clean.length >= 10,
  };
}

/* ── l'hook ────────────────────────────────────────────────────────────────── */

const LOCAL_KEY = "metic.plan-state.v1";

const readLocal = (): PlanState | null => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as PlanState) : null;
  } catch { return null; }
};

const writeLocal = (s: PlanState) => {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(s)); } catch { /* quota */ }
};

export interface UseTrainingPlan {
  loading: boolean;
  derived: Derived | null;
  state: PlanState;
  plan: Plan | null;
  /** Anteprima con i parametri correnti, prima di salvare. */
  preview: (goals: RaceGoal[], opts: Partial<PlanConfig>) => Plan | null;
  save: (config: PlanConfig) => Promise<void>;
  clear: () => Promise<void>;
  mark: (dateIso: string, outcome: SessionOutcome | null) => void;
  recordTest: (id: string, result: TestResult | null) => void;
  /** Il server non risponde: si continua in locale, ma va detto. */
  offline: boolean;
}

export function useTrainingPlan(todayIso = new Date().toISOString().slice(0, 10)): UseTrainingPlan {
  const { data: runsData, loading: runsLoading } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const { data: vdotData, loading: vdotLoading } = useApi<VdotPacesResponse>(getVdotPaces, { cacheKey: API_CACHE.VDOT_PACES });

  const [state, setState] = useState<PlanState>(() => readLocal() ?? { config: null, log: {}, tests: {} });
  const [offline, setOffline] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // il server è la fonte di verità quando risponde; il locale serve a non
  // perdere una spunta quando il backend gratuito dorme
  useEffect(() => {
    let alive = true;
    getPlanState()
      .then((res) => {
        if (!alive) return;
        setOffline(false);
        if (res?.config) {
          setState({
            config: res.config as PlanConfig,
            log: (res.log ?? {}) as Record<string, SessionOutcome>,
            tests: (res.tests ?? {}) as Record<string, TestResult>,
          });
        }
      })
      .catch(() => alive && setOffline(true))
      .finally(() => alive && setHydrated(true));
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (hydrated) writeLocal(state); }, [state, hydrated]);

  const derived = useMemo(
    () => (runsData?.runs?.length ? deriveFitness(runsData.runs, vdotData?.vdot ?? null, todayIso) : null),
    [runsData, vdotData, todayIso],
  );

  const plan = useMemo(() => {
    if (!state.config) return null;
    try { return buildPlan(state.config); } catch { return null; }
  }, [state.config]);

  const preview = useCallback((goals: RaceGoal[], opts: Partial<PlanConfig>): Plan | null => {
    if (!derived || !goals.length) return null;
    try {
      return buildPlan({
        todayIso,
        startIso: opts.startIso ?? todayIso,
        goals,
        fitness: opts.fitness ?? derived.fitness,
        maxWeeklyKm: opts.maxWeeklyKm ?? Math.round(derived.fitness.weeklyKm * 1.3),
        runsPerWeek: opts.runsPerWeek ?? 5,
        climate: opts.climate ?? derived.climate,
        raceClimate: opts.raceClimate ?? derived.raceClimate,
        strength: opts.strength ?? true,
      });
    } catch { return null; }
  }, [derived, todayIso]);

  const push = useCallback(async (next: PlanState) => {
    setState(next);
    try {
      await putPlanState({ config: next.config, log: next.log, tests: next.tests });
      setOffline(false);
    } catch { setOffline(true); }
  }, []);

  const save = useCallback(async (config: PlanConfig) => {
    await push({ config, log: {}, tests: {} });
  }, [push]);

  const clear = useCallback(async () => {
    setState({ config: null, log: {}, tests: {} });
    try { await putPlanState({ config: null }); setOffline(false); } catch { setOffline(true); }
  }, []);

  const mark = useCallback((dateIso: string, outcome: SessionOutcome | null) => {
    setState((prev) => {
      const log = { ...prev.log };
      if (outcome) log[dateIso] = outcome; else delete log[dateIso];
      const next = { ...prev, log };
      putPlanState({ log }).then(() => setOffline(false)).catch(() => setOffline(true));
      return next;
    });
  }, []);

  const recordTest = useCallback((id: string, result: TestResult | null) => {
    setState((prev) => {
      const tests = { ...prev.tests };
      if (result) tests[id] = result; else delete tests[id];
      const next = { ...prev, tests };
      putPlanState({ tests }).then(() => setOffline(false)).catch(() => setOffline(true));
      return next;
    });
  }, []);

  return {
    loading: runsLoading || vdotLoading || !hydrated,
    derived, state, plan, preview, save, clear, mark, recordTest, offline,
  };
}
