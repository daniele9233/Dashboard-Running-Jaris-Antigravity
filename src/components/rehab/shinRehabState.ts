import { PHASES, upsertPain, type PainEntry, type PhaseId } from "../../data/shinRehab";

/**
 * Lo stato del programma, tenuto nel browser.
 *
 * Non va sul backend, apposta: è un quaderno personale, e il backend locale
 * scrive sul database di produzione. Il prezzo è che vive solo in questo browser.
 */
export interface ShinRehabState {
  version: 1;
  phase: PhaseId;
  /** I criteri spuntati, per id. */
  gates: Record<string, boolean>;
  /** Gli esercizi fatti, per giorno. */
  done: Record<string, string[]>;
  pain: PainEntry[];
  /** L'ultimo passo della tabella di ritorno alla corsa completato (0 = nessuno). */
  runStep: number;
}

export const STORAGE_KEY = "metic.shinRehab.v1";

export const defaultState = (): ShinRehabState => ({
  version: 1, phase: "calma", gates: {}, done: {}, pain: [], runStep: 0,
});

/** La data locale come YYYY-MM-DD (non UTC: "oggi" è quello del tuo orologio). */
export function localIso(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const isIso = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Legge lo stato salvato senza fidarsi: un valore rovinato non deve rompere la pagina. */
export function parseState(raw: string | null): ShinRehabState {
  const base = defaultState();
  if (!raw) return base;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!data || typeof data !== "object") return base;
  const d = data as Record<string, unknown>;

  const phase = PHASES.some((p) => p.id === d.phase) ? (d.phase as PhaseId) : base.phase;

  const gates: Record<string, boolean> = {};
  if (d.gates && typeof d.gates === "object") {
    for (const [k, v] of Object.entries(d.gates as Record<string, unknown>)) if (v === true) gates[k] = true;
  }

  const done: Record<string, string[]> = {};
  if (d.done && typeof d.done === "object") {
    for (const [k, v] of Object.entries(d.done as Record<string, unknown>)) {
      if (isIso(k) && Array.isArray(v)) done[k] = v.filter((x): x is string => typeof x === "string");
    }
  }

  let pain: PainEntry[] = [];
  if (Array.isArray(d.pain)) {
    for (const e of d.pain as Partial<PainEntry>[]) {
      if (e && isIso(e.date)) {
        pain = upsertPain(pain, {
          date: e.date, morning: Number(e.morning), walking: Number(e.walking), effort: Number(e.effort),
        });
      }
    }
  }

  const runStep = Number.isInteger(d.runStep) && (d.runStep as number) >= 0 && (d.runStep as number) <= 7
    ? (d.runStep as number)
    : 0;

  return { version: 1, phase, gates, done, pain, runStep };
}

/** Quanti esercizi hai fatto oggi, su quanti ne prevede la fase. */
export function doneToday(state: ShinRehabState, ids: string[], today: string): number {
  const set = new Set(state.done[today] ?? []);
  return ids.filter((id) => set.has(id)).length;
}
