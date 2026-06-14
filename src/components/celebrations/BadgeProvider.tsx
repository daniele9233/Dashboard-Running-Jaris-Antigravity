import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getRuns, getBadgeState, saveBadgeState, type BadgeState } from "../../api";
import { CELEBRATIONS, type CelebrationDef, type CelebrationGroup } from "./celebrationRegistry";
import { evaluateMet } from "./badgeRules";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { MultiCelebrationOverlay } from "./MultiCelebrationOverlay";

const GROUP_PRIORITY: Record<CelebrationGroup, number> = {
  GARE: 6, CLASSICI: 5, VELOCITÀ: 4, FISIOLOGIA: 3, VOLUME: 2, SALITE: 1, COSTANZA: 0,
};

const EMPTY_STATE: BadgeState = {
  activated: false, activated_at: null, baseline_run_ids: [], baseline: {}, unlocked: {},
};

interface BadgeApi {
  state: BadgeState | null;
  unlockedIds: Set<string>;
  /** Da chiamare dopo un sync riuscito: valuta e celebra i nuovi sblocchi. */
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

export function BadgeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BadgeState | null>(null);
  const stateRef = useRef<BadgeState | null>(null);
  stateRef.current = state;

  const [queue, setQueue] = useState<CelebrationDef[] | null>(null);
  const [runId, setRunId] = useState(0);

  // Carica lo stato; alla prima attivazione congela la baseline (no storico).
  useEffect(() => {
    let alive = true;
    (async () => {
      let s = await getBadgeState().catch(() => null);
      if (!s || !s.activated) {
        const runs = (await getRuns().catch(() => ({ runs: [] }))).runs ?? [];
        s = {
          activated: true,
          activated_at: new Date().toISOString(),
          baseline_run_ids: runs.map((r) => r.id),
          baseline: {},
          unlocked: s?.unlocked ?? {},
        };
        await saveBadgeState(s).catch(() => {});
      }
      if (alive) setState({ ...EMPTY_STATE, ...s });
    })();
    return () => { alive = false; };
  }, []);

  const fire = useCallback((defs: CelebrationDef[]) => {
    if (!defs.length) return;
    const ordered = [...defs].sort((a, b) => GROUP_PRIORITY[b.group] - GROUP_PRIORITY[a.group]);
    setQueue(ordered);
    setRunId((n) => n + 1);
  }, []);

  const evaluateAfterSync = useCallback(async (): Promise<string[]> => {
    const cur = stateRef.current;
    if (!cur) return [];
    const runs = (await getRuns().catch(() => ({ runs: [] }))).runs ?? [];
    const met = evaluateMet(runs, cur.baseline_run_ids);
    const newIds = met.filter((id) => !(id in cur.unlocked));
    if (newIds.length === 0) return [];
    const now = new Date().toISOString();
    const unlocked = { ...cur.unlocked };
    for (const id of newIds) unlocked[id] = { at: now };
    const next: BadgeState = { ...cur, unlocked };
    setState(next);
    await saveBadgeState(next).catch(() => {});
    const defs = newIds
      .map((id) => CELEBRATIONS.find((c) => c.id === id))
      .filter((d): d is CelebrationDef => Boolean(d));
    fire(defs);
    return newIds;
  }, [fire]);

  const replay = useCallback((def: CelebrationDef) => fire([def]), [fire]);

  const unlockedIds = new Set(Object.keys(state?.unlocked ?? {}));

  return (
    <Ctx.Provider value={{ state, unlockedIds, evaluateAfterSync, replay }}>
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
