import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { API_CACHE } from "../hooks/apiCacheKeys";
import { getRuns } from "../api";
import type { RunsResponse } from "../types/api";
import { useTrainingPlan } from "./training/useTrainingPlan";
import { PlanSetup } from "./training/PlanSetup";
import { PlanBoard } from "./training/PlanBoard";

/**
 * TRAINING
 * ════════════════════════════════════════════════════════════════════════════
 * Una cosa sola: il piano. O lo generi, o lo guardi.
 *
 * Prima qui convivevano due programmi — uno generato dal backend e uno scritto
 * a mano — con due modelli diversi dei ritmi, del caldo e del VDOT. Due
 * risposte alla stessa domanda sono peggio di nessuna: l'atleta non sa a quale
 * credere e smette di credere a entrambe.
 */
export function TrainingView() {
  const api = useTrainingPlan();
  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const [editing, setEditing] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);

  if (api.loading) {
    return (
      <div className="flex-1 bg-[#050505] text-white flex items-center justify-center">
        <div className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-600 animate-pulse">
          Leggo le tue corse
        </div>
      </div>
    );
  }

  const showSetup = editing || !api.plan;

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] text-white">
      {showSetup ? (
        <PlanSetup api={api} todayIso={todayIso} onDone={() => setEditing(false)} />
      ) : (
        <PlanBoard
          plan={api.plan!}
          api={api}
          runs={runsData?.runs ?? []}
          onRegenerate={() => setEditing(true)}
        />
      )}
    </div>
  );
}
