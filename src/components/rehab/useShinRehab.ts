import { useCallback, useEffect, useState } from "react";
import { upsertPain, type PainEntry, type PhaseId } from "../../data/shinRehab";
import { STORAGE_KEY, defaultState, parseState, type ShinRehabState } from "./shinRehabState";

function load(): ShinRehabState {
  try {
    return parseState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // finestra privata o archivio bloccato: la pagina funziona lo stesso, senza memoria
    return defaultState();
  }
}

/** Lo stato del programma e le azioni per cambiarlo; ogni modifica si salva da sola. */
export function useShinRehab() {
  const [state, setState] = useState<ShinRehabState>(load);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* niente archivio: si lavora in memoria */
    }
  }, [state]);

  const setPhase = useCallback((phase: PhaseId) => setState((s) => ({ ...s, phase })), []);

  const toggleGate = useCallback((id: string) => {
    setState((s) => {
      const gates = { ...s.gates };
      if (gates[id]) delete gates[id]; else gates[id] = true;
      return { ...s, gates };
    });
  }, []);

  const toggleDone = useCallback((day: string, exerciseId: string) => {
    setState((s) => {
      const today = new Set(s.done[day] ?? []);
      if (today.has(exerciseId)) today.delete(exerciseId); else today.add(exerciseId);
      return { ...s, done: { ...s.done, [day]: [...today] } };
    });
  }, []);

  const savePain = useCallback((entry: PainEntry) => {
    setState((s) => ({ ...s, pain: upsertPain(s.pain, entry) }));
  }, []);

  const setRunStep = useCallback((runStep: number) => setState((s) => ({ ...s, runStep })), []);

  const reset = useCallback(() => setState(defaultState()), []);

  return { state, setPhase, toggleGate, toggleDone, savePain, setRunStep, reset };
}
