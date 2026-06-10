// Helper condivisi tra le varianti Runner DNA (V1/V2).
// RunnerDnaView.tsx ha copie locali: non toccarlo, è la versione stabile.

export const MONO = "JetBrains Mono, monospace";

export function formatItalianDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function humanizeCoachText(text: string | null | undefined) {
  if (!text) return "";
  return text.replace(/(\d+(?:[.,]\d+)?)\s*(?:corse\/settimana|runs?\/week)/gi, (_match, rawValue: string) => {
    const numericValue = Number(rawValue.replace(",", "."));
    if (!Number.isFinite(numericValue)) return "uscite medie a settimana";
    return `${formatItalianDecimal(numericValue, 1)} uscite medie a settimana`;
  });
}

function parseTimeSecs(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + (parts[1] ?? 0);
}

export function formatDelta(from: string, to: string): string {
  const diff = parseTimeSecs(from) - parseTimeSecs(to);
  if (diff <= 0) return "";
  const m = Math.floor(diff / 60), s = diff % 60;
  return `-${m}:${s.toString().padStart(2, "0")}`;
}

export const DISTANCE_LABELS: Record<string, string> = {
  "5K": "5K",
  "10K": "10K",
  "HALF MARATHON": "MEZZA",
  "MARATHON": "MARATONA",
};
export const DISTANCE_ORDER = ["5K", "10K", "HALF MARATHON", "MARATHON"];

export const TREND_COLORS: Record<string, string> = {
  "In Forte Crescita": "#C0FF00",
  "In Crescita": "#34D399",
  "Stabile": "#F59E0B",
  "In Calo": "#F97316",
  "In Forte Regressione": "#F43F5E",
};

export const BIOMECH_SHORT_LABELS: Record<string, string> = {
  cadence: "Cadenza",
  vertical_oscillation: "Osc. verticale",
  vertical_ratio: "Ratio verticale",
  ground_contact: "Contatto suolo",
  stride: "Falcata",
};
