import type { Run } from "../types/api";

export function normaliseCadenceSpm(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) return null;
  const numeric = Number(value);
  const spm = numeric < 120 ? numeric * 2 : numeric;
  if (spm < 50 || spm > 240) return null;
  return Math.round(spm);
}

export function cadenceSpmFromRun(run: Pick<Run, "avg_cadence" | "avg_cadence_spm" | "biomechanics">): number | null {
  const canonical = run.biomechanics?.avg_cadence_spm ?? run.avg_cadence_spm;
  const fromCanonical = normaliseCadenceSpm(canonical);
  if (fromCanonical != null) return fromCanonical;
  return normaliseCadenceSpm(run.avg_cadence);
}

