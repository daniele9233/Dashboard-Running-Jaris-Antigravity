import type { Run, Split } from "../types/api";

export interface DriftResult {
  drift: number;       // % (positive = HR rose = worse)
  hr1: number;         // avg HR first half
  hr2: number;         // avg HR second half
  pace1: number;       // avg pace sec/km first half
  pace2: number;       // avg pace sec/km second half
  kmFirst: string;     // e.g. "km 1–5"
  kmSecond: string;
  date: string;
  distKm: number;
  runId: string;
  label: string;       // short date
  splits: { km: number; hr: number; pace: number; paceLabel: string }[];
}

export function driftLabel(d: number): { label: string; color: string } {
  if (d < 3.5) return { label: "Eccellente",    color: "#C0FF00" };
  if (d < 5.0) return { label: "Buona",         color: "#27D3C3" };
  if (d < 7.5) return { label: "Da migliorare", color: "#F59E0B" };
  return            { label: "Insufficiente",   color: "#FF4D8D" };
}

function parsePaceSec(pace: string): number {
  const parts = pace.split(":");
  if (parts.length < 2) return 0;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function fmtPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Compute cardiac drift for a single run.
 * Only valid for steady-pace runs: splits must stay within ±12% of the
 * median pace, and ≥50% of HR-valid splits must survive the pace filter.
 * Returns null if the run doesn't qualify.
 */
export function computeDrift(run: Run): DriftResult | null {
  const raw: Split[] = (run.splits ?? []).filter(
    s => s.hr && s.hr > 80 && s.pace && parsePaceSec(s.pace) > 0
  );
  if (raw.length < 4) return null;

  const paces = raw.map(s => parsePaceSec(s.pace));
  const sorted = [...paces].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // ±12% of median — tight enough to exclude intervals / hills
  const steady = raw.filter(s => {
    const p = parsePaceSec(s.pace);
    return p >= median * 0.88 && p <= median * 1.12;
  });

  // Reject if the run was not mostly steady (< 50% of raw splits survived)
  if (steady.length < 4 || steady.length < raw.length * 0.5) return null;

  const mid = Math.floor(steady.length / 2);
  const first  = steady.slice(0, mid);
  const second = steady.slice(mid);

  const avgHr   = (arr: Split[]) => arr.reduce((s, x) => s + (x.hr  ?? 0), 0) / arr.length;
  const avgPace = (arr: Split[]) => arr.reduce((s, x) => s + parsePaceSec(x.pace), 0) / arr.length;

  const hr1 = avgHr(first);
  const hr2 = avgHr(second);
  if (hr1 <= 0) return null;

  const drift = ((hr2 - hr1) / hr1) * 100;

  return {
    drift:    Math.round(drift * 10) / 10,
    hr1:      Math.round(hr1),
    hr2:      Math.round(hr2),
    pace1:    avgPace(first),
    pace2:    avgPace(second),
    kmFirst:  `km ${steady[0].km}–${steady[mid - 1].km}`,
    kmSecond: `km ${steady[mid].km}–${steady[steady.length - 1].km}`,
    date:     run.date,
    distKm:   run.distance_km,
    runId:    run.id,
    label:    run.date.slice(5).replace("-", "/"),
    splits:   steady.map(s => ({
      km:        s.km,
      hr:        s.hr!,
      pace:      parsePaceSec(s.pace),
      paceLabel: fmtPace(parsePaceSec(s.pace)),
    })),
  };
}
