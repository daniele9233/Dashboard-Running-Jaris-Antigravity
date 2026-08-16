import type { Run } from "../../types/api";
import {
  ZONES, type ZoneDef, type ZoneMinutes, bestSustainedPaceSec, clamp, cleanRuns, dayIndex,
  daySessions, weekStart,
} from "./gamiCore";

/**
 * GAMIFICATION V3 — L'ALBERO DELL'ATLETA
 * ════════════════════════════════════════════════════════════════════════════
 * Qui non esiste un punteggio unico. Una corsa non produce "valore": produce
 * MATERIALI, e materiali diversi a seconda di cos'era.
 *
 *   40 km lenti  →  tanto Fondo, zero Potenza
 *   5×1000       →  poca roba in totale, ma è l'unica che dà Potenza
 *
 * Ne segue la cosa che né la v1 né la v2 sanno dire: due atleti con lo stesso
 * volume sbloccano alberi completamente diversi. Se ti manca un nodo, non ti
 * manca "impegno" — ti manca un tipo preciso di seduta, e l'albero ti dice
 * quale e quante volte.
 *
 * Nessuna spesa manuale: un nodo si apre da solo quando i materiali bastano.
 * I totali sono di carriera — l'albero è quello che hai costruito, non quello
 * che stai facendo questo mese (per quello c'è la v2).
 */

export type ResId = "fondo" | "potenza" | "soglia" | "costanza" | "tenuta";

export interface ResDef { id: ResId; name: string; color: string; unit: string; from: string }
export const RESOURCES: Record<ResId, ResDef> = {
  fondo:    { id: "fondo",    name: "Fondo",    color: "#22D3EE", unit: "FND", from: "chilometri in lento, medio e recupero" },
  potenza:  { id: "potenza",  name: "Potenza",  color: "#F43F5E", unit: "POT", from: "minuti di lavoro nelle ripetute e in gara" },
  soglia:   { id: "soglia",   name: "Soglia",   color: "#FBBF24", unit: "SOG", from: "minuti di lavoro in soglia e nei medi tirati" },
  costanza: { id: "costanza", name: "Costanza", color: "#A3E635", unit: "CST", from: "quante volte esci in una settimana" },
  tenuta:   { id: "tenuta",   name: "Tenuta",   color: "#A78BFA", unit: "TEN", from: "corse lunghe e settimane ad alto volume" },
};
export const RES_ORDER: ResId[] = ["fondo", "potenza", "soglia", "costanza", "tenuta"];

export type Yield = Partial<Record<ResId, number>>;

// ── quanto rende una corsa ────────────────────────────────────────────────────
/**
 * Quota di seduta che è davvero lavoro, quando gli split non ci sono.
 *
 * Era una supposizione necessaria: senza vedere dentro la seduta, di un 5×1000
 * da 55 minuti si poteva solo dire "diciamo che 25 erano lavoro". Adesso, quando
 * gli split ci sono, i minuti si contano invece di stimarli — e questi due
 * numeri restano solo per le corse che gli split non ce l'hanno.
 */
const WORK_FRACTION = { vo2: 0.45, threshold: 0.7 };
const KM_PER_FONDO = 5;      // 5 km aerobici = 1 Fondo
const MIN_PER_POTENZA = 6;   // 6 minuti di lavoro duro = 1 Potenza
const MIN_PER_SOGLIA = 8;

/** Tenuta: la dà la durata, non l'intensità. */
function enduranceBonus(min: number): number {
  return min >= 100 ? 3 : min >= 70 ? 2 : min >= 55 ? 1 : 0;
}

/**
 * I materiali prodotti da UNA seduta. È la funzione che risponde a "quanto pesa
 * questa corsa": non un numero solo, ma dove va a finire.
 *
 * Con `zm` — i minuti per zona letti split per split — il conto è esatto: una
 * seduta mista produce Potenza per i minuti di ripetute, Soglia per quelli in
 * soglia e Fondo per il riscaldamento, invece di essere schiacciata sull'unica
 * etichetta della giornata. Senza, si ricade sulle frazioni stimate: meno
 * preciso, ma nessuna corsa resta senza peso.
 *
 * Prende km e minuti sciolti, non una `Run`, perché la stessa formula deve
 * girare su tre cose diverse: lo storico, la seduta del giorno (che può essere
 * la somma di più attività Strava) e le sedute ipotetiche del pannello.
 */
export function runYield(km: number, min: number, zone: ZoneDef, zm?: ZoneMinutes): Yield {
  const covered = zm ? zm.recovery + zm.easy + zm.medium + zm.threshold + zm.vo2 : 0;
  if (zm && covered > 0) {
    const y: Yield = {};
    const hard = zm.vo2 + zm.threshold;
    const aerobicShare = (zm.recovery + zm.easy + zm.medium) / covered;
    if (zm.vo2 > 0) y.potenza = round1(zm.vo2 / MIN_PER_POTENZA);
    const sogliaMin = zm.threshold + zm.medium * 0.3;
    if (sogliaMin > 0) y.soglia = round1(sogliaMin / MIN_PER_SOGLIA);
    // i chilometri della parte dura contano come fondo a un terzo: correre forte
    // resta correre, ma non è quello che costruisce la base
    y.fondo = round1((km * (aerobicShare + 0.3 * (1 - aerobicShare))) / KM_PER_FONDO);
    const t = enduranceBonus(min);
    if (t) y.tenuta = t;
    void hard;
    return y;
  }

  const y: Yield = {};
  if (zone.id === "vo2") {
    y.potenza = round1((min * WORK_FRACTION.vo2) / MIN_PER_POTENZA);
    y.fondo = round1((km * 0.3) / KM_PER_FONDO);       // anche una seduta dura fa km
  } else if (zone.id === "threshold") {
    y.soglia = round1((min * WORK_FRACTION.threshold) / MIN_PER_SOGLIA);
    y.fondo = round1((km * 0.5) / KM_PER_FONDO);
  } else {
    y.fondo = round1(km / KM_PER_FONDO);
    // un medio lungo lavora sulla soglia anche se non è una seduta di soglia
    if (zone.id === "medium" && min >= 35) y.soglia = round1((min * 0.25) / MIN_PER_SOGLIA);
  }
  const t = enduranceBonus(min);
  if (t) y.tenuta = (y.tenuta ?? 0) + t;
  return y;
}

/** Costanza e volume sono proprietà della SETTIMANA, non della singola corsa. */
function weeklyYield(days: number, km: number): Yield {
  const y: Yield = {};
  const c = days >= 6 ? 5 : days >= 5 ? 4 : days >= 4 ? 3 : days >= 3 ? 2 : days >= 2 ? 1 : 0;
  if (c) y.costanza = c;
  const t = km >= 55 ? 5 : km >= 40 ? 3 : km >= 28 ? 1 : 0;
  if (t) y.tenuta = t;
  return y;
}

// ── L'ALBERO ──────────────────────────────────────────────────────────────────
export interface NodeDef {
  id: string; branch: ResId | "capstone"; tier: number;
  name: string;
  /** Cosa cambia davvero quando si apre. */
  effect: string;
  /** Come si arriva: il tipo di seduta che produce ciò che manca. */
  howTo: string;
  cost: Yield;
}

const B = (branch: ResId, tier: number, name: string, cost: number, effect: string, howTo: string): NodeDef =>
  ({ id: `${branch}-${tier}`, branch, tier, name, effect, howTo, cost: { [branch]: cost } });

export const TREE: NodeDef[] = [
  // ── FONDO ──
  B("fondo", 1, "Base Aerobica", 30,
    "45 minuti continui senza che il passo si sfaldi nel finale.",
    "Qualsiasi corsa lenta. 6 uscite da 8 km e il nodo è tuo."),
  B("fondo", 2, "Capillarizzazione", 120,
    "Recuperi in un giorno invece di due: puoi permetterti la seconda qualità della settimana.",
    "Volume lento costante, 30-40 km a settimana."),
  B("fondo", 3, "Fondo Profondo", 350,
    "Il lungo smette di essere una prova e torna a essere allenamento.",
    "Un anno di lenti sopra i 30 km settimanali."),
  B("fondo", 4, "Motore da Maratona", 900,
    "L'aerobico non è più il tuo limite: a frenarti resta solo la velocità.",
    "Chilometraggio da maratoneta, per stagioni intere."),

  // ── POTENZA ──
  B("potenza", 1, "Prima Scintilla", 15,
    "Chiudi una seduta di ripetute intera, senza mollare l'ultima.",
    "3-4 sedute di ripetute. Sono l'unica fonte di Potenza."),
  B("potenza", 2, "Cambio di Ritmo", 60,
    "Reggi 5 ripetute dove ne reggevi 4, allo stesso passo.",
    "Una seduta di ripetute a settimana per un paio di mesi."),
  B("potenza", 3, "VO2 Alto", 160,
    "Le ripetute cominciano ad ALZARE il VDOT invece di limitarsi a confermarlo.",
    "Ripetute continuative per una stagione, con recuperi che si accorciano."),
  B("potenza", 4, "Motore Rosso", 400,
    "Il tuo VO2max è il punto di forza, non il tappo.",
    "Anni di lavoro sopra soglia. Il ramo più lento dell'albero."),

  // ── SOGLIA ──
  B("soglia", 1, "Soglia Trovata", 15,
    "Sai riconoscere il ritmo che potresti tenere un'ora — la sensazione, non il numero.",
    "3 tempo run da 20 minuti."),
  B("soglia", 2, "Mezz'ora in Soglia", 55,
    "Trenta minuti pieni al ritmo soglia senza deriva cardiaca.",
    "Una seduta di soglia a settimana per due mesi."),
  B("soglia", 3, "Soglia Estesa", 150,
    "Il ritmo soglia diventa il tuo ritmo gara sui 10K.",
    "Soglia lunga (8-10 km) ripetuta per una stagione."),
  B("soglia", 4, "Soglia da Gara", 380,
    "Corri la mezza al ritmo che oggi tieni sui 10.",
    "Anni di lavoro a cavallo della soglia."),

  // ── COSTANZA ──
  B("costanza", 1, "Abitudine", 12,
    "Correre smette di essere una decisione da prendere ogni volta.",
    "6 settimane con almeno 3 uscite."),
  B("costanza", 2, "Tre a Settimana", 50,
    "La base non si perde più fra un blocco e l'altro.",
    "Quattro mesi senza settimane vuote."),
  B("costanza", 3, "Stagione Piena", 140,
    "Arrivi alla gara con una preparazione, non con una speranza.",
    "Un anno di settimane piene, 4-5 uscite."),
  B("costanza", 4, "Anno Intero", 360,
    "Niente ripartenze da zero: ogni stagione parte più in alto della precedente.",
    "Tre anni senza buchi veri."),

  // ── TENUTA ──
  B("tenuta", 1, "Primo Lungo", 12,
    "Un'ora di corsa non ti costa più il giorno dopo.",
    "Qualche uscita oltre i 55 minuti."),
  B("tenuta", 2, "Novanta Minuti", 50,
    "Il lungo da 90 minuti entra nella routine settimanale.",
    "Un lungo a settimana per due mesi, più settimane sopra i 40 km."),
  B("tenuta", 3, "Volume Sostenuto", 140,
    "Reggi settimane da 50+ km senza che la qualità ne risenta.",
    "Una stagione di lunghi veri e volume alto."),
  B("tenuta", 4, "Corpo da Gara Lunga", 360,
    "La distanza non è più una variabile: la mezza è una distanza di allenamento.",
    "Anni di lunghi. Il ramo che chiede più pazienza."),

  // ── CAPSTONE: qui i rami si incontrano ──
  { id: "cap-5k25", branch: "capstone", tier: 1, name: "5K sotto i 25'",
    effect: "Il primo tempo che vale la pena scrivere: 5:00/km tenuti per cinque chilometri.",
    howTo: "Fondo per reggerli, soglia per non esplodere a metà.",
    cost: { fondo: 60, soglia: 40 } },
  { id: "cap-5k22", branch: "capstone", tier: 2, name: "5K sotto i 22'",
    effect: "Entri nella fascia dove i 5K si corrono, non si sopravvivono: 4:24/km.",
    howTo: "Serve la Potenza: senza ripetute, questo nodo non si apre mai.",
    cost: { fondo: 150, soglia: 100, potenza: 80 } },
  // I due capstone alti sono tarati sulle previsioni di gara del backend: se il
  // cruscotto dice 20:05 sui 5K e 43:09 sui 10K, questi due nodi devono leggersi
  // "quasi", non "aperto". Due pagine che si contraddicono valgono meno di una.
  { id: "cap-5k20", branch: "capstone", tier: 3, name: "5K sotto i 20'",
    effect: "3:59/km. La soglia simbolica del podista amatore serio.",
    howTo: "Tutti e quattro i rami insieme — è il senso di questo nodo.",
    cost: { fondo: 250, soglia: 160, potenza: 120, costanza: 90 } },
  { id: "cap-10k43", branch: "capstone", tier: 4, name: "10K sotto i 43'",
    effect: "4:18/km per dieci chilometri: la distanza diventa il tuo terreno.",
    howTo: "Soglia lunga e tenuta. La potenza pura qui conta meno del saper durare.",
    cost: { fondo: 340, soglia: 210, tenuta: 190 } },
];

// ── STATO ─────────────────────────────────────────────────────────────────────
export interface NodeState extends NodeDef {
  unlocked: boolean;
  /** 0-100: il ramo più indietro comanda, non la media. */
  pct: number;
  missing: { res: ResDef; need: number; have: number }[];
  /** Settimane al ritmo attuale — null se manca un materiale che non produci. */
  weeks: number | null;
  /** Il materiale che frena. */
  blockedBy: ResDef | null;
}

export interface RunYieldRow {
  id: string; date: string; name: string; km: number; minutes: number;
  zone: ZoneDef; yields: { res: ResDef; amount: number }[]; total: number;
}

/** Cosa produrrebbe una seduta tipo, e quale nodo avvicina di più. */
export interface Play {
  id: string; label: string; detail: string; zone: ZoneDef;
  yields: { res: ResDef; amount: number }[];
  /** Il nodo che questa seduta avvicina di più, e di quanti punti percentuali. */
  moves: { node: NodeState; gainPct: number } | null;
}

export interface TreeState {
  ok: boolean;
  res: Record<ResId, number>;
  /** Ritmo di produzione delle ultime 8 settimane, per settimana. */
  rate: Record<ResId, number>;
  nodes: NodeState[];
  unlockedCount: number;
  total: number;
  /** I tre nodi più vicini all'apertura. */
  next: NodeState[];
  recent: RunYieldRow[];
  plays: Play[];
  /** Il ramo più avanti e quello più indietro, in percentuale di nodi aperti. */
  strongest: ResDef | null;
  weakest: ResDef | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const RATE_WINDOW_WEEKS = 8;

const EMPTY_RES = (): Record<ResId, number> => ({ fondo: 0, potenza: 0, soglia: 0, costanza: 0, tenuta: 0 });

export function buildTree(runsIn: Run[], todayIso: string = new Date().toISOString()): TreeState {
  const runs = cleanRuns(runsIn);
  if (runs.length < 3) {
    return { ok: false, res: EMPTY_RES(), rate: EMPTY_RES(), nodes: [], unlockedCount: 0, total: TREE.length, next: [], recent: [], plays: [], strongest: null, weakest: null };
  }
  const sessions = daySessions(runsIn);
  if (!sessions.length) {
    return { ok: false, res: EMPTY_RES(), rate: EMPTY_RES(), nodes: [], unlockedCount: 0, total: TREE.length, next: [], recent: [], plays: [], strongest: null, weakest: null };
  }
  const today = Math.max(dayIndex(todayIso), sessions[sessions.length - 1].day);
  const rateFrom = today - RATE_WINDOW_WEEKS * 7;

  const res = EMPTY_RES();
  const recentRes = EMPTY_RES();
  const rows: RunYieldRow[] = [];

  // per-seduta (= per giorno: i frammenti Strava dello stesso allenamento
  // vanno sommati, altrimenti tre spezzoni da 40 minuti non danno Tenuta)
  for (const s of sessions) {
    // il conto esatto solo quando gli intertempi coprono almeno metà seduta:
    // sotto, la ripartizione è ricostruita e le frazioni stimate sono più oneste
    const detailed = s.splitMinutes >= s.minutes * 0.5;
    const y = runYield(s.km, s.minutes, s.zone, detailed ? s.zoneMinutes : undefined);
    for (const k of RES_ORDER) {
      const v = y[k] ?? 0;
      res[k] += v;
      if (s.day > rateFrom) recentRes[k] += v;
    }
    rows.push({
      id: s.id, date: s.date, name: s.name,
      km: round1(s.km), minutes: Math.round(s.minutes), zone: s.zone,
      yields: RES_ORDER.filter((k) => (y[k] ?? 0) > 0).map((k) => ({ res: RESOURCES[k], amount: round1(y[k]!) })),
      total: round1(RES_ORDER.reduce((s2, k) => s2 + (y[k] ?? 0), 0)),
    });
  }

  // per-settimana
  const weeks = new Map<number, { days: Set<number>; km: number }>();
  for (const s of sessions) {
    const w = weekStart(s.day);
    const cur = weeks.get(w) ?? { days: new Set<number>(), km: 0 };
    cur.days.add(s.day); cur.km += s.km;
    weeks.set(w, cur);
  }
  for (const [w, v] of weeks) {
    const y = weeklyYield(v.days.size, v.km);
    for (const k of RES_ORDER) {
      const amt = y[k] ?? 0;
      res[k] += amt;
      if (w > rateFrom) recentRes[k] += amt;
    }
  }

  for (const k of RES_ORDER) res[k] = round1(res[k]);
  const rate = EMPTY_RES();
  for (const k of RES_ORDER) rate[k] = round1(recentRes[k] / RATE_WINDOW_WEEKS);

  const nodes = TREE.map((n) => nodeState(n, res, rate));
  const unlockedCount = nodes.filter((n) => n.unlocked).length;
  const next = nodes.filter((n) => !n.unlocked).sort((a, b) => b.pct - a.pct).slice(0, 3);

  // ramo più avanti / più indietro (solo i cinque rami, non i capstone)
  // a parità di avanzamento vince chi PRODUCE di più: se due rami sono fermi
  // entrambi a zero, quello da segnalare è quello che non stai alimentando
  const branchPct = RES_ORDER.map((k) => {
    const bn = nodes.filter((n) => n.branch === k);
    return {
      res: RESOURCES[k],
      pct: bn.reduce((s, n) => s + (n.unlocked ? 100 : n.pct), 0) / Math.max(1, bn.length),
      rate: rate[k],
    };
  }).sort((a, b) => b.pct - a.pct || b.rate - a.rate);

  return {
    ok: true, res, rate, nodes, unlockedCount, total: TREE.length, next,
    recent: rows.slice(-10).reverse(),
    plays: buildPlays(res, rate, nodes, bestSustainedPaceSec(runs)),
    strongest: branchPct[0]?.res ?? null,
    weakest: branchPct[branchPct.length - 1]?.res ?? null,
  };
}

function nodeState(n: NodeDef, res: Record<ResId, number>, rate: Record<ResId, number>): NodeState {
  const needs = RES_ORDER.filter((k) => (n.cost[k] ?? 0) > 0);
  const missing = needs
    .map((k) => ({ res: RESOURCES[k], need: n.cost[k]!, have: res[k] }))
    .filter((m) => m.have < m.need);
  // il ramo più indietro comanda: un nodo non si apre "in media"
  const pct = Math.round(Math.min(...needs.map((k) => clamp((res[k] / n.cost[k]!) * 100, 0, 100))));
  let weeks: number | null = 0;
  let blockedBy: ResDef | null = null;
  for (const m of missing) {
    const r = rate[m.res.id];
    if (r <= 0) { weeks = null; blockedBy = m.res; break; }
    const w = (m.need - m.have) / r;
    if (weeks != null && w > weeks) { weeks = w; blockedBy = m.res; }
  }
  return {
    ...n, unlocked: missing.length === 0, pct: missing.length === 0 ? 100 : pct,
    missing, weeks: weeks == null ? null : Math.ceil(weeks), blockedBy,
  };
}

/**
 * "Se domani faccio X, cosa cambia". La stessa funzione `runYield` usata sullo
 * storico, girata in avanti su sedute tipo — così il numero mostrato è lo
 * stesso che quella corsa produrrà davvero una volta sincronizzata.
 */
function buildPlays(
  res: Record<ResId, number>, rate: Record<ResId, number>, nodes: NodeState[], bestPace: number | null,
): Play[] {
  const easyPace = (bestPace ?? 300) * 1.3;
  const specs: { id: string; label: string; detail: string; zone: ZoneDef; km: number; min: number }[] = [
    { id: "reps", label: "Ripetute 5×1000", detail: "≈55 min totali, 25 di lavoro", zone: ZONES.vo2, km: 11, min: 55 },
    { id: "thr", label: "Soglia 6 km", detail: "≈45 min con 26 di lavoro", zone: ZONES.threshold, km: 10, min: 45 },
    { id: "long", label: "Lungo 18 km", detail: `≈${Math.round((easyPace * 18) / 60)} min in lento`, zone: ZONES.easy, km: 18, min: (easyPace * 18) / 60 },
    { id: "easy", label: "Lento 10 km", detail: `≈${Math.round((easyPace * 10) / 60)} min`, zone: ZONES.easy, km: 10, min: (easyPace * 10) / 60 },
    { id: "rec", label: "Recupero 6 km", detail: "corsa rigenerante", zone: ZONES.recovery, km: 6, min: (easyPace * 1.12 * 6) / 60 },
  ];
  return specs.map((s) => {
    const y = runYield(s.km, s.min, s.zone);
    // quale nodo chiuso avvicina di più
    let best: { node: NodeState; gainPct: number } | null = null;
    for (const n of nodes) {
      if (n.unlocked) continue;
      const after = { ...res };
      for (const k of RES_ORDER) after[k] += y[k] ?? 0;
      const gain = nodeState(n, after, rate).pct - n.pct;
      if (gain > 0 && (!best || gain > best.gainPct)) best = { node: n, gainPct: Math.round(gain * 10) / 10 };
    }
    return {
      id: s.id, label: s.label, detail: s.detail, zone: s.zone,
      yields: RES_ORDER.filter((k) => (y[k] ?? 0) > 0).map((k) => ({ res: RESOURCES[k], amount: round1(y[k]!) })),
      moves: best,
    };
  });
}
