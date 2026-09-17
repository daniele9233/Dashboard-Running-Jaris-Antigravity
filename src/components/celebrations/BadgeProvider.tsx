import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getRuns, getBadgeState, saveBadgeState, type BadgeState } from "../../api";
import { useApi, invalidateCache } from "../../hooks/useApi";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { Run, RunsResponse } from "../../types/api";
import { CELEBRATIONS, type CelebrationDef, type CelebrationGroup } from "./celebrationRegistry";
import { evaluateMet } from "./badgeRules";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { MultiCelebrationOverlay } from "./MultiCelebrationOverlay";

const GROUP_PRIORITY: Record<CelebrationGroup, number> = {
  GARE: 6, CLASSICI: 5, VELOCITÀ: 4, FISIOLOGIA: 3, VOLUME: 2, SALITE: 1, COSTANZA: 0,
};

/**
 * Quante celebrazioni a schermo pieno al massimo per valutazione. Le altre
 * compaiono comunque in bacheca (e da lì si rigiocano).
 */
const MAX_CELEBRATIONS = 3;

const EMPTY_STATE: BadgeState = {
  activated: false, activated_at: null, baseline_run_ids: [], baseline: {}, unlocked: {},
  backfilled_at: null,
};

/**
 * LA VALUTAZIONE DEI BADGE
 * ════════════════════════════════════════════════════════════════════════════
 * Prima i badge si valutavano solo dentro `evaluateAfterSync`, chiamata dal
 * ritorno OAuth di Strava e dal bottone "sincronizza" del profilo. Risultato:
 * chi apriva la bacheca senza passare da lì la trovava a zero su cento, pur
 * avendo nello storico decine di traguardi già raggiunti — e le corse arrivate
 * da Garmin o da un altro dispositivo non sbloccavano niente.
 *
 * Adesso la valutazione segue le CORSE, non i bottoni: il provider legge la
 * lista dalla cache condivisa e rivaluta ogni volta che quella lista cambia.
 * Il primo giro è un recupero: sblocca in silenzio tutto ciò che lo storico
 * già soddisfa (celebrare cinquanta badge in fila non è una festa, è un
 * sequestro) e lascia una traccia in `backfilled_at`. Dal giro dopo, ogni
 * nuovo sblocco è una notizia e si festeggia.
 */
type EvaluateMode = "auto" | "celebrate";

export interface BadgeApi {
  state: BadgeState | null;
  unlockedIds: Set<string>;
  /** Le corse su cui è stata fatta l'ultima valutazione (le condivide la bacheca). */
  runs: Run[];
  /** True finché stato o corse non sono arrivati. */
  loading: boolean;
  /** Quanti badge ha sbloccato il recupero iniziale, per dirlo una volta. */
  backfilled: number | null;
  /** Ultima valutazione conclusa (ISO), per mostrare "controllato alle …". */
  checkedAt: string | null;
  /** Rivaluta adesso e celebra i nuovi sblocchi (bottone in bacheca). */
  checkNow: () => Promise<string[]>;
  /** Da chiamare dopo un sync riuscito: ricarica le corse e celebra i nuovi. */
  evaluateAfterSync: () => Promise<string[]>;
  /** Rigioca la celebrazione di un badge (es. click in bacheca). */
  replay: (def: CelebrationDef) => void;
}

const Ctx = createContext<BadgeApi | null>(null);

export function useBadges(): BadgeApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBadges must be used within BadgeProvider");
  return v;
}

/** Firma della lista corse: cambia solo quando cambia qualcosa che conta. */
const runsSignature = (runs: Run[]) =>
  runs.length === 0 ? "" : `${runs.length}:${runs[0]?.id ?? ""}:${runs[runs.length - 1]?.id ?? ""}`;

export function BadgeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BadgeState | null>(null);
  const stateRef = useRef<BadgeState | null>(null);
  stateRef.current = state;

  const [backfilled, setBackfilled] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const [queue, setQueue] = useState<CelebrationDef[] | null>(null);
  const [runId, setRunId] = useState(0);

  // Le corse arrivano dalla cache condivisa: quando un sync le invalida, questo
  // hook si risveglia e la valutazione riparte da sola.
  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => runsData?.runs ?? [], [runsData]);

  // Carica lo stato; alla prima attivazione congela la baseline (i record
  // partono da qui, gli obiettivi guardano comunque tutto lo storico).
  useEffect(() => {
    let alive = true;
    (async () => {
      let s = await getBadgeState().catch(() => null);
      if (!s || !s.activated) {
        const all = (await getRuns().catch(() => ({ runs: [] as Run[] }))).runs ?? [];
        s = {
          ...EMPTY_STATE,
          activated: true,
          activated_at: new Date().toISOString(),
          baseline_run_ids: all.map((r) => r.id),
          unlocked: s?.unlocked ?? {},
          backfilled_at: s?.backfilled_at ?? null,
        };
        await saveBadgeState(s).catch(() => {});
      }
      if (alive) setState({ ...EMPTY_STATE, ...s });
    })();
    return () => { alive = false; };
  }, []);

  const fire = useCallback((defs: CelebrationDef[], cap = Infinity) => {
    if (!defs.length) return;
    const ordered = [...defs].sort((a, b) => GROUP_PRIORITY[b.group] - GROUP_PRIORITY[a.group]);
    setQueue(ordered.slice(0, cap));
    setRunId((n) => n + 1);
  }, []);

  /**
   * Il cuore: confronta i criteri con lo stato salvato e persiste la differenza.
   * `auto` festeggia solo se il recupero iniziale è già stato fatto.
   */
  const evaluate = useCallback(async (list: Run[], mode: EvaluateMode): Promise<string[]> => {
    const cur = stateRef.current;
    if (!cur || list.length === 0) return [];

    const met = evaluateMet(list, cur.baseline_run_ids);
    const newIds = met.filter((id) => !(id in cur.unlocked));
    const firstPass = !cur.backfilled_at;
    const now = new Date().toISOString();
    setCheckedAt(now);

    if (newIds.length === 0) {
      // niente da sbloccare, ma il recupero va comunque marcato: altrimenti il
      // primo badge vero finirebbe nel silenzio del backfill
      if (firstPass) {
        const next = { ...cur, backfilled_at: now };
        setState(next);
        await saveBadgeState(next).catch(() => {});
      }
      return [];
    }

    const unlocked = { ...cur.unlocked };
    for (const id of newIds) unlocked[id] = { at: now };
    const next: BadgeState = { ...cur, unlocked, backfilled_at: cur.backfilled_at ?? now };
    setState(next);
    await saveBadgeState(next).catch(() => {});

    const silent = firstPass && mode === "auto";
    if (silent) {
      setBackfilled(newIds.length);
    } else {
      const defs = newIds
        .map((id) => CELEBRATIONS.find((c) => c.id === id))
        .filter((d): d is CelebrationDef => Boolean(d));
      fire(defs, MAX_CELEBRATIONS);
    }
    return newIds;
  }, [fire]);

  // Valutazione automatica: a ogni cambio reale della lista corse.
  const lastSig = useRef("");
  useEffect(() => {
    if (!state || runs.length === 0) return;
    const sig = runsSignature(runs);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    evaluate(runs, "auto").catch(() => {});
  }, [state, runs, evaluate]);

  const checkNow = useCallback(async () => {
    invalidateCache(API_CACHE.RUNS);
    const fresh = (await getRuns().catch(() => ({ runs: [] as Run[] }))).runs ?? [];
    const list = fresh.length ? fresh : runs;
    lastSig.current = runsSignature(list);
    return evaluate(list, "celebrate");
  }, [evaluate, runs]);

  const evaluateAfterSync = useCallback(async () => {
    const fresh = (await getRuns().catch(() => ({ runs: [] as Run[] }))).runs ?? [];
    const list = fresh.length ? fresh : runs;
    lastSig.current = runsSignature(list);
    return evaluate(list, "celebrate");
  }, [evaluate, runs]);

  const replay = useCallback((def: CelebrationDef) => fire([def]), [fire]);

  const unlockedIds = useMemo(() => new Set(Object.keys(state?.unlocked ?? {})), [state]);

  const api = useMemo<BadgeApi>(() => ({
    state, unlockedIds, runs,
    loading: !state || runsData == null,
    backfilled, checkedAt, checkNow, evaluateAfterSync, replay,
  }), [state, unlockedIds, runs, runsData, backfilled, checkedAt, checkNow, evaluateAfterSync, replay]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {queue && queue.length === 1 && (
        <CelebrationOverlay
          def={queue[0]}
          runId={runId}
          onReplay={() => setRunId((n) => n + 1)}
          onClose={() => setQueue(null)}
        />
      )}
      {queue && queue.length > 1 && (
        <MultiCelebrationOverlay
          defs={queue}
          runId={runId}
          onClose={() => setQueue(null)}
        />
      )}
    </Ctx.Provider>
  );
}
