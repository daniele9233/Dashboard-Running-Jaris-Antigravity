import { useCallback, useEffect, useState } from "react";
import { clearRunnerDnaCache, getBestEfforts, getProfile, getRunnerDna } from "../api";
import type { BestEffortsResponse, Profile, RunnerDnaResponse } from "../types/api";
import { buildRunnerDnaUiModel, type RunnerDnaUiModel } from "../utils/runnerDnaModel";

type RunnerDnaUiState = {
  model: RunnerDnaUiModel | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
  regenerate: () => Promise<void>;
};

export function useRunnerDnaUiModel(): RunnerDnaUiState {
  const [model, setModel] = useState<RunnerDnaUiModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (clearCache = false) => {
    const isInitial = model === null && !clearCache;
    if (isInitial) setLoading(true);
    if (clearCache) setRefreshing(true);
    setError(null);

    try {
      if (clearCache) {
        await clearRunnerDnaCache();
      }

      const [dnaResult, profileResult, bestEffortsResult] = await Promise.allSettled([
        getRunnerDna(),
        getProfile(),
        getBestEfforts(),
      ]);

      if (dnaResult.status === "rejected") {
        throw dnaResult.reason instanceof Error ? dnaResult.reason : new Error("Runner DNA non disponibile");
      }

      const dna = (dnaResult.value as RunnerDnaResponse).dna;
      const profile = profileResult.status === "fulfilled"
        ? profileResult.value as Profile
        : null;
      const bestEfforts = bestEffortsResult.status === "fulfilled"
        ? ((bestEffortsResult.value as BestEffortsResponse).efforts ?? [])
        : [];

      setModel(buildRunnerDnaUiModel(dna, profile, bestEfforts));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il caricamento Runner DNA");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [model]);

  useEffect(() => {
    void load(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    model,
    loading,
    refreshing,
    error,
    reload: () => load(false),
    regenerate: () => load(true),
  };
}
