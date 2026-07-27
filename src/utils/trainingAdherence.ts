import type { Run, Session, Lap } from '../types/api';

/**
 * ADERENZA ALL'ALLENAMENTO
 * ────────────────────────────────────────────────────────────────────────────
 * Prima l'unico esito era un bottone manuale "Effettuato / Fallito": binario,
 * soggettivo e muto sul PERCHÉ. Qui il verdetto lo dà il sistema, confrontando
 * la prescrizione ("5×1000 @ 4:08") con i giri realmente corsi.
 *
 * Una seduta storta capita: non significa niente. Il segnale arriva dal
 * PATTERN — se due o tre sedute chiave di fila non si chiudono, il problema
 * non è la giornata, è il piano. E le cause non sono equivalenti:
 *
 *  · ritmi oltre il motore attuale  → i target vanno ricalibrati
 *  · crollo dentro la seduta        → la velocità c'è, manca la tenuta
 *  · fallimenti solo col caldo      → non è il piano, è il termometro
 *  · calo su volume alto            → fatica accumulata, serve scarico
 *
 * Ognuna porta a un'azione diversa: da qui il verdetto, non un contatore.
 */

// ─── Prescrizione estratta dalla seduta ──────────────────────────────────────

export type SessionKind = 'reps' | 'tempo' | 'easy';

export interface Prescription {
  kind: SessionKind;
  /** Ripetizioni prescritte (0 per continuo/facile). */
  reps: number;
  /** Distanza della singola ripetuta in metri (se prescritta a distanza). */
  repDistM: number | null;
  /** Durata della singola ripetuta in secondi (se prescritta a tempo). */
  repDurSec: number | null;
  /** Passo obiettivo della parte di LAVORO, in secondi/km. */
  targetPaceSec: number | null;
}

const paceToSec = (p: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(p.trim());
  if (!m) return null;
  const v = +m[1] * 60 + +m[2];
  return v > 0 && v < 1200 ? v : null;
};

/**
 * Estrae la struttura dal titolo + descrizione della seduta.
 * I formati reali del piano: "8×300 m @ 3:29/km", "2×8 min @ 4:11/km",
 * "4×4 min @ 90–95% FCmax (≈3:58/km)", "20 min continui @ 4:09/km".
 * Il passo si cerca DOPO la struttura, perché la descrizione contiene anche
 * il passo del riscaldamento, che non è il target.
 */
export function parsePrescription(session: Session): Prescription {
  const text = `${session.title ?? ''} · ${session.description ?? ''}`;
  const fallbackPace = session.target_pace ? paceToSec(session.target_pace) : null;

  const paceAfter = (from: number): number | null => {
    const tail = text.slice(from);
    // "@ 4:08/km" oppure "(≈3:58/km)" — il primo che compare dopo la struttura
    const m = /(?:@|≈|~)\s*(\d{1,2}:\d{2})/.exec(tail);
    return m ? paceToSec(m[1]) : null;
  };

  // 5×1000 m — ripetute a distanza
  const byDist = /(\d{1,2})\s*[×x]\s*(\d{3,4})\s*m/i.exec(text);
  if (byDist) {
    return {
      kind: 'reps',
      reps: +byDist[1],
      repDistM: +byDist[2],
      repDurSec: null,
      targetPaceSec: paceAfter(byDist.index + byDist[0].length) ?? fallbackPace,
    };
  }

  // 4×4 min / 3×10′ — ripetute a tempo
  const byTime = /(\d{1,2})\s*[×x]\s*(\d{1,2})\s*(?:min|′|')/i.exec(text);
  if (byTime) {
    return {
      kind: 'reps',
      reps: +byTime[1],
      repDistM: null,
      repDurSec: +byTime[2] * 60,
      targetPaceSec: paceAfter(byTime.index + byTime[0].length) ?? fallbackPace,
    };
  }

  // "20 min continui @ 4:09/km" / "25 min continui"
  const cont = /(\d{1,3})\s*(?:min|′)\s*(?:continui|continue|continuo)/i.exec(text);
  if (cont) {
    return {
      kind: 'tempo',
      reps: 1,
      repDistM: null,
      repDurSec: +cont[1] * 60,
      targetPaceSec: paceAfter(cont.index + cont[0].length) ?? fallbackPace,
    };
  }

  // "8 km continui a ritmo gara" — tempo a distanza
  const contKm = /(\d{1,2}(?:[.,]\d)?)\s*km\s*continui/i.exec(text);
  if (contKm) {
    return {
      kind: 'tempo',
      reps: 1,
      repDistM: Math.round(parseFloat(contKm[1].replace(',', '.')) * 1000),
      repDurSec: null,
      targetPaceSec: paceAfter(contKm.index + contKm[0].length) ?? fallbackPace,
    };
  }

  return { kind: 'easy', reps: 0, repDistM: null, repDurSec: null, targetPaceSec: fallbackPace };
}

// ─── Valutazione della singola seduta ────────────────────────────────────────

export type Verdict = 'on_target' | 'close' | 'under' | 'not_completed' | 'missed' | 'unrated';

export interface SessionEval {
  date: string;
  title: string;
  verdict: Verdict;
  kind: SessionKind;
  repsPrescribed: number;
  repsDone: number;
  targetPaceSec: number | null;
  actualPaceSec: number | null;
  /** Scarto % dal passo obiettivo: +4 = 4% più lento del target. */
  deltaPct: number | null;
  /** Decadimento interno: quanto l'ultima ripetuta è più lenta della prima (%). */
  fadePct: number | null;
  tempC: number | null;
}

/** I giri di lavoro: i più veloci, quando la seduta mostra un contrasto reale. */
function workLaps(laps: Lap[]): { km: number; paceSec: number }[] {
  const valid = laps
    .filter((l) => (l.distance ?? 0) >= 150 && (l.moving_time ?? 0) > 0)
    .map((l) => ({ km: l.distance / 1000, paceSec: l.moving_time / (l.distance / 1000) }));
  if (valid.length < 2) return valid;
  const sorted = [...valid].map((v) => v.paceSec).sort((a, b) => a - b);
  const fastest = sorted[0];
  const slowest = sorted[sorted.length - 1];
  // Senza contrasto (lento continuo) sono tutti "lavoro": non c'è recupero da isolare.
  if (slowest / fastest <= 1.25) return valid;
  const cut = fastest + (slowest - fastest) * 0.4;
  return valid.filter((v) => v.paceSec <= cut);
}

export function evaluateSession(session: Session, run: Run | null): SessionEval {
  const p = parsePrescription(session);
  const base = {
    date: session.date,
    title: session.title ?? '',
    kind: p.kind,
    repsPrescribed: p.reps,
    targetPaceSec: p.targetPaceSec,
    tempC: run?.temperature ?? null,
  };

  if (!run) {
    return { ...base, verdict: 'missed', repsDone: 0, actualPaceSec: null, deltaPct: null, fadePct: null };
  }

  // Le corse facili non si "falliscono": contano solo se fatte.
  if (p.kind === 'easy') {
    return { ...base, verdict: 'on_target', repsDone: 1, actualPaceSec: null, deltaPct: null, fadePct: null };
  }

  const work = workLaps(run.laps ?? []);
  if (!work.length || p.targetPaceSec == null) {
    // Senza giri non si può giudicare la struttura: la corsa c'è, il resto no.
    return { ...base, verdict: 'unrated', repsDone: 0, actualPaceSec: null, deltaPct: null, fadePct: null };
  }

  // Per le ripetute conta solo ciò che somiglia alla ripetuta prescritta:
  // un riscaldamento veloce non è una rep.
  let matched = work;
  if (p.kind === 'reps' && p.repDistM) {
    const lo = (p.repDistM / 1000) * 0.75, hi = (p.repDistM / 1000) * 1.3;
    const m = work.filter((w) => w.km >= lo && w.km <= hi);
    if (m.length) matched = m;
  }

  const repsDone = p.kind === 'tempo' ? (matched.length ? 1 : 0) : matched.length;
  const totKm = matched.reduce((s, w) => s + w.km, 0);
  const actualPaceSec = totKm > 0 ? matched.reduce((s, w) => s + w.paceSec * w.km, 0) / totKm : null;
  const deltaPct = actualPaceSec != null ? ((actualPaceSec - p.targetPaceSec) / p.targetPaceSec) * 100 : null;
  const fadePct =
    matched.length >= 3
      ? ((matched[matched.length - 1].paceSec - matched[0].paceSec) / matched[0].paceSec) * 100
      : null;

  const repRatio = p.reps > 0 ? repsDone / p.reps : 1;
  let verdict: Verdict;
  if (repRatio < 0.6) verdict = 'not_completed';
  else if (deltaPct == null) verdict = 'unrated';
  else if (repRatio >= 0.95 && deltaPct <= 2) verdict = 'on_target';
  else if (repRatio >= 0.8 && deltaPct <= 5) verdict = 'close';
  else verdict = 'under';

  return { ...base, verdict, repsDone, actualPaceSec, deltaPct, fadePct };
}

// ─── Diagnosi sul pattern ────────────────────────────────────────────────────

export type DiagnosisLevel = 'ok' | 'watch' | 'recalibrate';
export type DiagnosisCause = 'none' | 'pace_too_fast' | 'endurance' | 'heat' | 'fatigue';

export interface Diagnosis {
  level: DiagnosisLevel;
  cause: DiagnosisCause;
  headline: string;
  detail: string;
  action: string | null;
  /** Passo consigliato (sec/km) quando la causa è un target troppo ambizioso. */
  suggestedPaceSec: number | null;
  streak: number;
  considered: number;
}

const HEAT_C = 20;

/**
 * Legge le ultime sedute chiave (più recenti in testa) e stabilisce se il piano
 * regge. Una seduta storta non muove nulla: serve un pattern.
 */
export function diagnose(evals: SessionEval[]): Diagnosis {
  // Solo sedute di qualità già giudicabili: i lenti non dicono nulla sul target.
  const key = evals.filter((e) => e.kind !== 'easy' && e.verdict !== 'unrated').slice(0, 6);
  const bad = (v: Verdict) => v === 'under' || v === 'not_completed' || v === 'missed';

  let streak = 0;
  for (const e of key) {
    if (bad(e.verdict)) streak++;
    else break;
  }

  if (key.length === 0) {
    return {
      level: 'ok', cause: 'none', streak: 0, considered: 0, suggestedPaceSec: null,
      headline: 'Nessuna seduta chiave da valutare',
      detail: 'Servono sedute di qualità con i giri registrati per giudicare l\'aderenza.',
      action: null,
    };
  }

  if (streak < 2) {
    const lastBad = key.length && bad(key[0].verdict);
    return {
      level: 'ok', cause: 'none', streak, considered: key.length, suggestedPaceSec: null,
      headline: lastBad ? 'Una seduta storta, nessun allarme' : 'Piano in linea col tuo motore',
      detail: lastBad
        ? 'Capita, e da sola non significa nulla. Se anche la prossima chiave non si chiude, il piano va rivisto.'
        : 'Le ultime sedute chiave sono state chiuse ai ritmi previsti.',
      action: null,
    };
  }

  // ── Da qui in poi: due o più sedute chiave fallite di fila ────────────────
  const failed = key.slice(0, streak);
  const withPace = failed.filter((e) => e.deltaPct != null);
  const avgDelta = withPace.length
    ? withPace.reduce((s, e) => s + (e.deltaPct ?? 0), 0) / withPace.length
    : 0;

  const hotFailed = failed.filter((e) => (e.tempC ?? 0) >= HEAT_C).length;
  const okOnes = key.slice(streak);
  const coolOk = okOnes.filter((e) => (e.tempC ?? 99) < HEAT_C).length;

  const fades = failed.map((e) => e.fadePct).filter((v): v is number => v != null);
  const avgFade = fades.length ? fades.reduce((s, v) => s + v, 0) / fades.length : 0;

  const level: DiagnosisLevel = streak >= 3 ? 'recalibrate' : 'watch';
  const suggested =
    withPace.length && withPace[0].targetPaceSec != null
      ? Math.round(withPace[0].targetPaceSec * (1 + Math.max(0, avgDelta) / 100))
      : null;

  // Caldo: fallite quando faceva caldo, riuscite quando era fresco → è il meteo.
  if (hotFailed === failed.length && coolOk > 0) {
    return {
      level: 'watch', cause: 'heat', streak, considered: key.length, suggestedPaceSec: suggested,
      headline: 'Non è il piano, è il caldo',
      detail: `Le ultime ${streak} sedute chiave sono saltate tutte con ${HEAT_C}°C o più, mentre al fresco le chiudevi. Il motore non è cambiato.`,
      action: 'Sposta la qualità all\'alba e concedi i secondi al termometro invece di inseguire il passo.',
    };
  }

  // Le rep si chiudono ma crollano: velocità c'è, manca la tenuta.
  if (avgFade >= 4 && avgDelta < 6) {
    return {
      level, cause: 'endurance', streak, considered: key.length, suggestedPaceSec: suggested,
      headline: 'Parti bene e cali: è tenuta, non velocità',
      detail: `Nelle ultime ${streak} sedute le ripetute finali sono in media ${avgFade.toFixed(1)}% più lente delle prime. Il passo iniziale lo reggi: non lo sostieni.`,
      action: 'Tieni i ritmi ma accorcia le ripetute e allunga il volume facile: il limite è la cilindrata aerobica.',
    };
  }

  // Molto lontano dal target su più sedute: i ritmi sono oltre il motore attuale.
  if (avgDelta >= 3) {
    return {
      level, cause: 'pace_too_fast', streak, considered: key.length, suggestedPaceSec: suggested,
      headline: streak >= 3 ? 'I ritmi sono oltre il tuo motore attuale' : 'Due sedute chiuse sotto target',
      detail: `Nelle ultime ${streak} sedute chiave hai corso in media ${avgDelta.toFixed(1)}% più lento del target. Non è la giornata: è il target.`,
      action: suggested
        ? `Ricalibra la qualità su ${Math.floor(suggested / 60)}:${String(suggested % 60).padStart(2, '0')}/km: ci si allena al ritmo che regge il motore di oggi, non a quello che vorremmo.`
        : 'Riporta i ritmi della qualità sul VDOT reale.',
    };
  }

  // Sedute saltate o interrotte senza scarto di passo: carico o vita.
  return {
    level, cause: 'fatigue', streak, considered: key.length, suggestedPaceSec: null,
    headline: `${streak} sedute chiave non chiuse`,
    detail: 'Il passo non è il problema: le sedute non sono state completate. Di solito è fatica accumulata o settimane troppo piene.',
    action: 'Inserisci una settimana di scarico (−25% di volume) e riprendi la qualità dopo.',
  };
}

// ─── Aggregatore: sessioni del piano + corse reali ───────────────────────────

/** Abbina ogni seduta del piano alla corsa dello stesso giorno e la valuta. */
export function evaluatePlan(sessions: Session[], runs: Run[], today = new Date()): SessionEval[] {
  const todayStr = today.toISOString().slice(0, 10);
  const byDate = new Map<string, Run>();
  for (const r of runs) {
    const d = r.date?.slice(0, 10);
    if (!d) continue;
    // Se in un giorno ci sono più corse tiene la più lunga: è la seduta.
    const prev = byDate.get(d);
    if (!prev || (r.distance_km ?? 0) > (prev.distance_km ?? 0)) byDate.set(d, r);
  }
  return sessions
    .filter((s) => s.type !== 'rest' && s.date && s.date <= todayStr)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => evaluateSession(s, byDate.get(s.date.slice(0, 10)) ?? null));
}
