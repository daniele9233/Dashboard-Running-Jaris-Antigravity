import type { BestEffort, Profile, RunnerDnaResponse } from "../types/api";

type AnyRecord = Record<string, any>;

export type RunnerDnaRank = {
  min: number;
  name: string;
  tone: string;
  description: string;
};

export type RunnerDnaScoreItem = {
  key: string;
  label: string;
  score: number;
  status: string;
  color: string;
  weight: number;
  description: string;
  insight: string;
};

export type RunnerDnaDistanceTalent = {
  id: string;
  label: string;
  score: number;
  role: "Oggi" | "Potenziale" | "Da costruire";
  insight: string;
  limiter: string;
};

export type RunnerDnaBiomechanicMetric = {
  key: string;
  label: string;
  value: number | null;
  displayValue: string;
  unit: string;
  benchmark: string;
  score: number;
  available: boolean;
  sampleRuns: number | null;
  verdict: "positivo" | "neutro" | "da migliorare" | "non disponibile";
  verdictLabel: string;
  interpretation: string;
  suggestion: string;
  color: string;
};

export type RunnerDnaEvolutionPoint = {
  label: string;
  score: number | null;
  vdot: number | null;
  readiness: number | null;
};

export type RunnerDnaUiModel = {
  base: {
    name: string;
    age: number | null;
    weightKg: number | null;
    heightCm: number | null;
    sex: string | null;
    level: string;
    trainingHistory: string;
    weeklyFrequency: number | null;
    totalRuns: number | null;
    totalKm: number | null;
    weeksActive: number | null;
  };
  identity: {
    rank: RunnerDnaRank;
    archetype: string;
    description: string;
    coachVerdict: string;
    unlockMessage: string;
  };
  performance: {
    vdot: number | null;
    vdotCeiling: number | null;
    vo2maxLabel: string;
    avgPace: string;
    avgPaceSeconds: number | null;
    avgHr: number | null;
    avgCadence: number | null;
    ctl: number | null;
    atl: number | null;
    tsb: number | null;
    readiness: number | null;
    freshness: number | null;
    trendStatus: string;
    trendDetail: string;
    idealDistance: string;
    potentialPct: number | null;
    improvementPotential: number;
    pb5k: string;
    pb10k: string;
    pbHalf: string;
    thresholdLabel: string;
    cardiacDriftLabel: string;
  };
  scores: {
    overall: number;
    projected: number;
    items: RunnerDnaScoreItem[];
  };
  distanceTalents: RunnerDnaDistanceTalent[];
  biomechanics: RunnerDnaBiomechanicMetric[];
  diagnostics: {
    strengths: string[];
    weaknesses: string[];
    priorities: string[];
  };
  freshness: {
    lastRunDate: string | null;
    latestGarminCsvImportedAt: string | null;
    activeGarminCsv: number;
    matchedGarminCsv: number;
    autoRecalculated: boolean;
    schemaVersion: string;
    dataSignature: string;
    label: string;
  };
  predictions: {
    current: Record<string, string>;
    potential: Record<string, string>;
  };
  evolution: RunnerDnaEvolutionPoint[];
  raw: {
    dna: RunnerDnaResponse["dna"];
    profile: Profile | null;
    bestEfforts: BestEffort[];
  };
};

const rankRules: RunnerDnaRank[] = [
  {
    min: 96,
    name: "Elite",
    tone: "standard da atleta assoluto",
    description: "Performance, efficienza e carico sono gia vicini a standard agonistici altissimi.",
  },
  {
    min: 89,
    name: "Semi professionista",
    tone: "macchina da gara quasi completa",
    description: "Profilo molto competitivo, pochi punti deboli e grande solidita fisiologica.",
  },
  {
    min: 79,
    name: "Esperto",
    tone: "runner tecnico e maturo",
    description: "Sai allenarti, reggi il carico e trasformi bene la fatica in prestazione.",
  },
  {
    min: 66,
    name: "Runner evoluto",
    tone: "identita atletica chiara",
    description: "Base aerobica, continuita e potenziale sono forti. Il salto arriva da soglia e recupero.",
  },
  {
    min: 51,
    name: "Amatore solido",
    tone: "fondamenta reali",
    description: "Hai costruito abitudine e resistenza. Ora serve qualita mirata per salire di livello.",
  },
  {
    min: 36,
    name: "Amatore base",
    tone: "fase di costruzione",
    description: "Il sistema aerobico sta prendendo forma. La priorita e rendere stabile la settimana.",
  },
  {
    min: 21,
    name: "Corridore occasionale",
    tone: "scintilla da proteggere",
    description: "Hai segnali utili, ma il profilo ha bisogno di continuita e carico progressivo.",
  },
  {
    min: 1,
    name: "Inizio percorso",
    tone: "prima accensione",
    description: "Il focus e creare routine, fiducia e piccoli progressi misurabili.",
  },
];

const scoreCopy: Record<string, { description: string; insight: string; weight: number }> = {
  aerobic_engine: {
    description: "Motore aerobico, VDOT e capacita di sostenere ritmi intensi.",
    insight: "Qui si vede quanta potenza aerobica puoi trasformare in gara.",
    weight: 30,
  },
  consistency: {
    description: "Frequenza, regolarita e capacita di non perdere il filo.",
    insight: "La costanza e il moltiplicatore silenzioso del tuo livello.",
    weight: 20,
  },
  load_capacity: {
    description: "Quanto carico riesci ad assorbire senza andare fuori equilibrio.",
    insight: "La capacita di carico decide quanto puoi costruire nei prossimi blocchi.",
    weight: 20,
  },
  efficiency: {
    description: "Quanto lavoro produci per ogni battito e per ogni metro corso.",
    insight: "Efficienza alta significa meno spreco e piu velocita a pari fatica.",
    weight: 15,
  },
  biomechanics: {
    description: "Cadenza, contatto a terra, oscillazione e qualita dell'appoggio.",
    insight: "La biomeccanica riduce il costo energetico e protegge dagli infortuni.",
    weight: 15,
  },
};

const colors = ["#C8FF2D", "#22D3EE", "#A78BFA", "#FBBF24", "#FB7185"];

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const clean = value.replace(",", ".").replace(/[^0-9.+-]/g, "");
    if (!clean) return null;
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function formatNumber(value: number | null, digits = 0) {
  if (value === null || !Number.isFinite(value)) return "N/D";
  return value.toLocaleString("it-IT", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function getStatus(score: number) {
  if (score >= 89) return { label: "Elite", color: "#C8FF2D" };
  if (score >= 78) return { label: "Ottimo", color: "#19F2C5" };
  if (score >= 65) return { label: "Buono", color: "#60A5FA" };
  if (score >= 50) return { label: "Discreto", color: "#FBBF24" };
  return { label: "Da costruire", color: "#FB7185" };
}

export function getRunnerDnaRank(score: number): RunnerDnaRank {
  return rankRules.find((rank) => score >= rank.min) ?? rankRules[rankRules.length - 1];
}

export function paceToSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const clean = value.replace("/km", "").trim();
  const parts = clean.split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return null;
  return parts[0] * 60 + parts[1];
}

export function secondsToPace(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "N/D";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function profilePb(profile: Profile | null, keys: string[]) {
  const pbs = profile?.pbs ?? {};
  const entryKey = Object.keys(pbs).find((key) =>
    keys.some((candidate) => key.toLowerCase() === candidate.toLowerCase())
  );
  const pb = entryKey ? pbs[entryKey] : null;
  return pb?.time || "N/D";
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}

function bestEffortTime(bestEfforts: BestEffort[], labels: string[]) {
  const wanted = labels.map(normalizeLabel);
  const effort = bestEfforts.find((item) => wanted.includes(normalizeLabel(item.distance ?? "")));
  return effort?.time?.trim() || null;
}

function effortOrProfilePb(
  bestEfforts: BestEffort[],
  effortLabels: string[],
  profile: Profile | null,
  profileKeys: string[]
) {
  return bestEffortTime(bestEfforts, effortLabels) ?? profilePb(profile, profileKeys);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function startedRunningLabel(value: string | null | undefined) {
  const label = dateLabel(value);
  return label ? `corri dal ${label}` : "storico corsa non disponibile";
}

function metricScoreHigher(value: number | null, low: number, high: number) {
  if (value === null) return 0;
  return clamp(((value - low) / (high - low)) * 100);
}

function metricScoreLower(value: number | null, best: number, worst: number) {
  if (value === null) return 0;
  return clamp(((worst - value) / (worst - best)) * 100);
}

function biomechanicVerdict(score: number, available: boolean) {
  if (!available) {
    return {
      verdict: "non disponibile" as const,
      verdictLabel: "Dato non disponibile",
    };
  }
  if (score >= 72) {
    return {
      verdict: "positivo" as const,
      verdictLabel: "Positivo",
    };
  }
  if (score >= 52) {
    return {
      verdict: "neutro" as const,
      verdictLabel: "Nella norma",
    };
  }
  return {
    verdict: "da migliorare" as const,
    verdictLabel: "Da migliorare",
  };
}

function buildBiomechanicMetric(args: {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  benchmark: string;
  score: number;
  sampleRuns: number | null;
  interpretationAvailable: string;
  suggestionAvailable: string;
  color: string;
}): RunnerDnaBiomechanicMetric {
  const available = args.value !== null && Number.isFinite(args.value);
  const score = available ? round(args.score) : 0;
  const verdict = biomechanicVerdict(score, available);
  return {
    key: args.key,
    label: args.label,
    value: args.value,
    displayValue: available ? formatNumber(args.value, args.value && args.value < 20 ? 1 : 0) : "N/D",
    unit: args.unit,
    benchmark: args.benchmark,
    score,
    available,
    sampleRuns: args.sampleRuns,
    verdict: verdict.verdict,
    verdictLabel: verdict.verdictLabel,
    interpretation: available ? args.interpretationAvailable : "Dato non ancora disponibile dai file Garmin Running Dynamics.",
    suggestion: available ? args.suggestionAvailable : "Importa o abbina un CSV/FIT Garmin per sbloccare questa metrica.",
    color: args.color,
  };
}

function scoreItemsFromDna(dna: AnyRecord): RunnerDnaScoreItem[] {
  const scores = asRecord(dna.scores);
  const breakdown = Array.isArray(scores.breakdown) ? scores.breakdown : [];
  const dnaScores = asRecord(dna.dna_scores);

  const source = breakdown.length
    ? breakdown
    : [
        { key: "aerobic_engine", label: "Motore aerobico", score: dnaScores.aerobic_engine },
        { key: "consistency", label: "Costanza", score: dnaScores.consistency },
        { key: "load_capacity", label: "Capacita di carico", score: dnaScores.load_capacity },
        { key: "efficiency", label: "Efficienza", score: dnaScores.efficiency },
        { key: "biomechanics", label: "Biomeccanica", score: dnaScores.biomechanics },
      ];

  return source
    .map((item: AnyRecord, index: number) => {
      const key = firstString(item.key) ?? `score_${index}`;
      const score = clamp(round(firstNumber(item.score) ?? 0));
      const status = getStatus(score);
      const copy = scoreCopy[key] ?? {
        description: "Indicatore calcolato dai dati reali disponibili.",
        insight: "Questo valore cambia quando sincronizzi nuove corse o nuovi dati Garmin.",
        weight: Math.round(100 / Math.max(1, source.length)),
      };
      return {
        key,
        label: firstString(item.label) ?? key,
        score,
        status: status.label,
        color: status.color || colors[index % colors.length],
        weight: copy.weight,
        description: copy.description,
        insight: copy.insight,
      };
    })
    .filter((item: RunnerDnaScoreItem) => item.score > 0 || breakdown.length > 0);
}

function scoreByKey(items: RunnerDnaScoreItem[], key: string, fallback = 50) {
  return items.find((item) => item.key === key)?.score ?? fallback;
}

function buildDistanceTalents(items: RunnerDnaScoreItem[], idealDistance: string): RunnerDnaDistanceTalent[] {
  const aerobic = scoreByKey(items, "aerobic_engine");
  const consistency = scoreByKey(items, "consistency");
  const load = scoreByKey(items, "load_capacity");
  const efficiency = scoreByKey(items, "efficiency");
  const biomechanics = scoreByKey(items, "biomechanics");
  const ideal = idealDistance.toLowerCase();

  const boost = (label: string) => ideal.includes(label.toLowerCase()) ? 8 : 0;
  const list: RunnerDnaDistanceTalent[] = [
    {
      id: "short",
      label: "Corte",
      score: round(clamp(aerobic * 0.35 + biomechanics * 0.35 + efficiency * 0.2 + load * 0.1 + boost("corte"))),
      role: "Potenziale",
      insight: "Valuta quanto il tuo gesto e il tuo motore si prestano ai ritmi brevi.",
      limiter: "Reattivita, forza elastica e capacita di cambio ritmo.",
    },
    {
      id: "5k",
      label: "5K",
      score: round(clamp(aerobic * 0.38 + efficiency * 0.24 + biomechanics * 0.18 + consistency * 0.1 + load * 0.1 + boost("5"))),
      role: ideal.includes("5") ? "Oggi" : "Potenziale",
      insight: "Distanza che premia VDOT, economia e freschezza nei lavori intensi.",
      limiter: "Soglia alta e finale in progressione.",
    },
    {
      id: "10k",
      label: "10K",
      score: round(clamp(aerobic * 0.3 + efficiency * 0.24 + consistency * 0.2 + load * 0.16 + biomechanics * 0.1 + boost("10"))),
      role: ideal.includes("10") ? "Oggi" : "Potenziale",
      insight: "Profilo di equilibrio tra ritmo, soglia e continuita settimanale.",
      limiter: "Tenuta di ritmo e controllo della fatica centrale.",
    },
    {
      id: "half",
      label: "Mezza",
      score: round(clamp(load * 0.3 + consistency * 0.27 + aerobic * 0.2 + efficiency * 0.18 + biomechanics * 0.05 + boost("mezza"))),
      role: ideal.includes("mezza") ? "Oggi" : "Potenziale",
      insight: "Qui contano continuita, capacita di carico e deriva cardiaca controllata.",
      limiter: "Lunghi progressivi e resistenza muscolare.",
    },
    {
      id: "marathon",
      label: "Maratona",
      score: round(clamp(load * 0.36 + consistency * 0.3 + efficiency * 0.18 + aerobic * 0.1 + biomechanics * 0.06 + boost("maratona"))),
      role: ideal.includes("maratona") ? "Oggi" : "Da costruire",
      insight: "Distanza che richiede carico stabile, pazienza e resilienza biomeccanica.",
      limiter: "Volume, lunghi, fueling e recupero.",
    },
    {
      id: "ultra",
      label: "Ultra",
      score: round(clamp(load * 0.38 + consistency * 0.32 + efficiency * 0.16 + biomechanics * 0.08 + aerobic * 0.06 + boost("ultra"))),
      role: ideal.includes("ultra") ? "Oggi" : "Da costruire",
      insight: "Premia resistenza, gestione dello stress e grande regolarita.",
      limiter: "Volume specifico e tolleranza strutturale.",
    },
  ];

  return list.sort((a, b) => b.score - a.score);
}

function buildFreshnessLabel(freshness: AnyRecord) {
  const lastRun = dateLabel(firstString(freshness.last_run_date));
  const garmin = firstNumber(freshness.active_garmin_csv) ?? 0;
  const matched = firstNumber(freshness.matched_garmin_csv) ?? 0;
  const parts = [
    lastRun ? `Ultima corsa: ${lastRun}` : "Ultima corsa: N/D",
    `Garmin CSV attivi: ${garmin}`,
    `CSV abbinati: ${matched}`,
  ];
  return parts.join(" · ");
}

function buildEvolution(dna: AnyRecord, overall: number, projected: number): RunnerDnaEvolutionPoint[] {
  const profile = asRecord(dna.profile);
  const potential = asRecord(dna.potential);
  const currentState = asRecord(dna.current_state);
  const comparison = asRecord(dna.comparison);
  const lastMonth = asRecord(comparison.last_month);

  const points: RunnerDnaEvolutionPoint[] = [];
  const lastVdot = firstNumber(lastMonth.vdot);
  if (lastVdot !== null) {
    points.push({ label: "Mese scorso", score: null, vdot: lastVdot, readiness: null });
  }

  points.push({
    label: "Ora",
    score: overall,
    vdot: firstNumber(profile.vdot_current),
    readiness: firstNumber(currentState.fitness_score, currentState.readiness, currentState.tsb),
  });

  const ceiling = firstNumber(potential.vdot_ceiling);
  if (ceiling !== null) {
    points.push({ label: "Potenziale", score: projected, vdot: ceiling, readiness: null });
  }

  return points;
}

export function buildRunnerDnaUiModel(
  dnaInput: RunnerDnaResponse["dna"],
  profileInput: Profile | null,
  bestEfforts: BestEffort[] = []
): RunnerDnaUiModel {
  const dna = asRecord(dnaInput);
  const dnaProfile = asRecord(dna.profile);
  const stats = asRecord(dna.stats);
  const performance = asRecord(dna.performance);
  const consistency = asRecord(dna.consistency);
  const efficiency = asRecord(dna.efficiency);
  const currentState = asRecord(dna.current_state);
  const potential = asRecord(dna.potential);
  const aiCoach = asRecord(dna.ai_coach);
  const diagnostics = asRecord(dna.diagnostics);
  const runningDynamics = asRecord(dna.running_dynamics);
  const scoresRaw = asRecord(dna.scores);
  const freshness = asRecord(dna.data_freshness);

  const items = scoreItemsFromDna(dna);
  const currentStrength = round(firstNumber(scoresRaw.current_strength) ??
    (items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 0));
  const improvementPotential = round(firstNumber(scoresRaw.improvement_potential) ?? Math.max(1, 100 - currentStrength));
  const projected = round(clamp(currentStrength + improvementPotential * 0.25));
  const rank = getRunnerDnaRank(currentStrength || 1);
  const idealDistance = firstString(potential.ideal_distance) ?? "N/D";

  const avgPace = firstString(stats.avg_pace) ?? "N/D";
  const avgPaceSeconds = paceToSeconds(avgPace);
  const vdot = firstNumber(dnaProfile.vdot_current);
  const vdotCeiling = firstNumber(potential.vdot_ceiling);
  const tsb = firstNumber(currentState.tsb);
  const ctl = firstNumber(currentState.fitness_ctl, currentState.ctl);
  const atl = firstNumber(currentState.atl);
  const cadence = firstNumber(stats.avg_cadence);
  const weeklyFrequency = firstNumber(consistency.runs_per_week);
  const totalRuns = firstNumber(stats.total_runs);
  const totalKm = firstNumber(stats.total_km, profileInput?.total_km);
  const weeksActive = firstNumber(stats.weeks_active);

  const verticalOscillation = firstNumber(runningDynamics.vertical_oscillation_cm);
  const verticalRatio = firstNumber(runningDynamics.vertical_ratio_pct);
  const groundContact = firstNumber(runningDynamics.ground_contact_ms);
  const stride = firstNumber(runningDynamics.stride_length_m);
  const dynamicsSampleRuns = firstNumber(runningDynamics.sample_runs, runningDynamics.runs, runningDynamics.count);
  const verticalOscillationRuns = firstNumber(runningDynamics.vertical_oscillation_runs, dynamicsSampleRuns);
  const verticalRatioRuns = firstNumber(runningDynamics.vertical_ratio_runs, dynamicsSampleRuns);
  const groundContactRuns = firstNumber(runningDynamics.ground_contact_runs, dynamicsSampleRuns);
  const strideRuns = firstNumber(runningDynamics.stride_runs, dynamicsSampleRuns);
  const cadenceRuns = firstNumber(runningDynamics.cadence_runs, dynamicsSampleRuns, totalRuns);

  const biomechMetrics: RunnerDnaBiomechanicMetric[] = [
    buildBiomechanicMetric({
      key: "cadence",
      label: "Cadenza",
      value: cadence,
      unit: "spm",
      benchmark: "168-182 spm",
      score: metricScoreHigher(cadence, 150, 184),
      sampleRuns: cadence !== null ? cadenceRuns : null,
      color: "#C8FF2D",
      interpretationAvailable: "Cadenza letta dai dati reali disponibili e normalizzata in passi/minuto.",
      suggestionAvailable: "Usa allunghi brevi e tecnica per consolidare frequenza senza forzare la falcata.",
    }),
    buildBiomechanicMetric({
      key: "vertical_oscillation",
      label: "Oscillazione verticale",
      value: verticalOscillation,
      unit: "cm",
      benchmark: "6.5-8.5 cm",
      score: metricScoreLower(verticalOscillation, 6.4, 11.2),
      sampleRuns: verticalOscillation !== null ? verticalOscillationRuns : null,
      color: "#22D3EE",
      interpretationAvailable: "Misura quanta energia sale verso l'alto invece di avanzare.",
      suggestionAvailable: "Cerca appoggi sotto il baricentro e stabilita del bacino nei medi controllati.",
    }),
    buildBiomechanicMetric({
      key: "vertical_ratio",
      label: "Rapporto verticale",
      value: verticalRatio,
      unit: "%",
      benchmark: "6.0-7.5%",
      score: metricScoreLower(verticalRatio, 5.8, 10.2),
      sampleRuns: verticalRatio !== null ? verticalRatioRuns : null,
      color: "#A78BFA",
      interpretationAvailable: "Rapporta rimbalzo verticale e lunghezza falcata.",
      suggestionAvailable: "Migliora economia senza inseguire una falcata artificialmente lunga.",
    }),
    buildBiomechanicMetric({
      key: "ground_contact",
      label: "Ground contact time",
      value: groundContact,
      unit: "ms",
      benchmark: "210-240 ms",
      score: metricScoreLower(groundContact, 205, 300),
      sampleRuns: groundContact !== null ? groundContactRuns : null,
      color: "#FBBF24",
      interpretationAvailable: "Indica quanto tempo resti a terra a ogni appoggio.",
      suggestionAvailable: "Salite brevi, skip e forza piede-caviglia possono migliorare reattivita.",
    }),
    buildBiomechanicMetric({
      key: "stride",
      label: "Lunghezza falcata",
      value: stride,
      unit: "m",
      benchmark: "1.10-1.30 m",
      score: metricScoreHigher(stride, 0.85, 1.35),
      sampleRuns: stride !== null ? strideRuns : null,
      color: "#38BDF8",
      interpretationAvailable: "Falcata reale dai dati Garmin quando disponibili.",
      suggestionAvailable: "Lavora su postura e spinta, non su overstriding.",
    }),
  ];

  const strengths = Array.isArray(diagnostics.strengths) ? diagnostics.strengths : [];
  const weaknesses = Array.isArray(diagnostics.weaknesses) ? diagnostics.weaknesses : Array.isArray(aiCoach.gaps) ? aiCoach.gaps : [];
  const priorities = Array.isArray(diagnostics.priorities) ? diagnostics.priorities : [];

  const baseLevel = firstString(profileInput?.level, dnaProfile.level, profileInput?.race_goal) ?? "N/D";
  const profileType = firstString(dnaProfile.type, rank.name) ?? rank.name;
  const description = firstString(dnaProfile.archetype_description, rank.description) ?? rank.description;
  const coachVerdict = firstString(aiCoach.coach_verdict) ??
    `Forza attuale ${currentStrength}/100. Il profilo si aggiorna dopo sync Strava o import Garmin.`;
  const unlockMessage = firstString(aiCoach.unlock_message, priorities.slice(0, 2).join(" ")) ??
    "Continua a sincronizzare Strava e Garmin per rendere il profilo sempre piu preciso.";

  const freshnessLabel = buildFreshnessLabel(freshness);

  return {
    base: {
      name: firstString(profileInput?.name) ?? "Runner",
      age: firstNumber(profileInput?.age),
      weightKg: firstNumber(profileInput?.weight_kg),
      heightCm: firstNumber(profileInput?.height_cm),
      sex: firstString(profileInput?.sex),
      level: baseLevel,
      trainingHistory: startedRunningLabel(profileInput?.started_running),
      weeklyFrequency,
      totalRuns,
      totalKm,
      weeksActive,
    },
    identity: {
      rank,
      archetype: profileType,
      description,
      coachVerdict,
      unlockMessage,
    },
    performance: {
      vdot,
      vdotCeiling,
      vo2maxLabel: vdot !== null ? `${formatNumber(vdot, 1)} VDOT` : "N/D",
      avgPace,
      avgPaceSeconds,
      avgHr: firstNumber(stats.avg_hr),
      avgCadence: cadence,
      ctl,
      atl,
      tsb,
      readiness: firstNumber(currentState.fitness_score, currentState.readiness),
      freshness: tsb !== null ? clamp(100 - Math.abs(tsb) * 2) : null,
      trendStatus: firstString(performance.trend_status) ?? "N/D",
      trendDetail: firstString(performance.trend_detail) ?? "Trend storico non disponibile.",
      idealDistance,
      potentialPct: firstNumber(potential.potential_pct),
      improvementPotential,
      pb5k: effortOrProfilePb(bestEfforts, ["5 km", "5K", "5k", "5000m"], profileInput, ["5K", "5k", "5000"]),
      pb10k: effortOrProfilePb(bestEfforts, ["10 km", "10K", "10k", "10000m"], profileInput, ["10K", "10k", "10000"]),
      pbHalf: effortOrProfilePb(
        bestEfforts,
        ["Mezza Maratona", "Half Marathon", "21 km", "21K", "21k"],
        profileInput,
        ["Half Marathon", "Mezza", "Mezza Maratona", "21K", "21k"]
      ),
      thresholdLabel: firstString(efficiency.label, currentState.form_label) ?? "N/D",
      cardiacDriftLabel: firstString(efficiency.description, performance.trend_detail) ?? "Dato non disponibile.",
    },
    scores: {
      overall: currentStrength,
      projected,
      items,
    },
    distanceTalents: buildDistanceTalents(items, idealDistance),
    biomechanics: biomechMetrics,
    diagnostics: {
      strengths: strengths.length ? strengths : items.slice(0, 3).map((item) => `${item.label}: ${item.insight}`),
      weaknesses: weaknesses.length ? weaknesses : items.slice(-2).map((item) => `${item.label}: ${item.description}`),
      priorities: priorities.length ? priorities : [unlockMessage],
    },
    freshness: {
      lastRunDate: firstString(freshness.last_run_date),
      latestGarminCsvImportedAt: firstString(freshness.latest_garmin_csv_imported_at),
      activeGarminCsv: firstNumber(freshness.active_garmin_csv) ?? 0,
      matchedGarminCsv: firstNumber(freshness.matched_garmin_csv) ?? 0,
      autoRecalculated: Boolean(freshness.auto_recalculated),
      schemaVersion: firstString(freshness.schema_version) ?? "N/D",
      dataSignature: firstString(freshness.data_signature) ?? "N/D",
      label: freshnessLabel,
    },
    predictions: {
      current: asRecord(potential.current_predictions) as Record<string, string>,
      potential: asRecord(potential.predictions) as Record<string, string>,
    },
    evolution: buildEvolution(dna, currentStrength, projected),
    raw: {
      dna: dnaInput,
      profile: profileInput,
      bestEfforts,
    },
  };
}

export function displayNumber(value: number | null, digits = 0) {
  return formatNumber(value, digits);
}

export function formatRaceTime(value: string | null | undefined) {
  return value && value.trim() ? value : "N/D";
}
