import { describe, it, expect } from 'vitest';
import { parsePrescription, evaluateSession, diagnose, type SessionEval } from './trainingAdherence';
import type { Run, Session, Lap } from '../types/api';

// ─── helper di comodo ────────────────────────────────────────────────────────

const sess = (title: string, description: string, target_pace: string | null = null, type = 'intervals'): Session =>
  ({
    day: 'Mar', date: '2026-08-11', type, title, description,
    target_distance_km: 9, target_pace, target_duration_min: null,
    completed: false, run_id: null,
  }) as Session;

const lap = (distance: number, moving_time: number): Lap => ({
  lap_index: 0, distance, moving_time, elapsed_time: moving_time,
  average_speed: distance / moving_time, average_heartrate: 150,
});

const run = (laps: Lap[], temperature: number | null = 15): Run =>
  ({ id: 'r', date: '2026-08-11', distance_km: 9, laps, temperature } as unknown as Run);

/** Ripetuta da `m` metri corsa a `paceSec` al km. */
const rep = (m: number, paceSec: number) => lap(m, (m / 1000) * paceSec);
const recovery = () => lap(270, 180); // 11:07/km — recupero camminato

// ─── PARSING: i formati che il piano genera davvero ──────────────────────────

describe('parsePrescription', () => {
  it('legge le ripetute a distanza e il passo del lavoro, non del riscaldamento', () => {
    const p = parsePrescription(
      sess('Ripetute Brevi Introduttive',
        '2 km warm-up @ 5:20/km · 8×300 m @ 3:29/km con 90 s recupero camminando · 2 km defaticamento.',
        '3:39'),
    );
    expect(p.kind).toBe('reps');
    expect(p.reps).toBe(8);
    expect(p.repDistM).toBe(300);
    expect(p.targetPaceSec).toBe(3 * 60 + 29); // NON 5:20 del warm-up
  });

  it('legge le ripetute a tempo', () => {
    const p = parsePrescription(
      sess('Soglia Introduttiva', '2 km warm-up @ 5:20/km · 2×8 min @ 4:11/km con 2 min recupero jog.'),
    );
    expect(p.reps).toBe(2);
    expect(p.repDurSec).toBe(8 * 60);
    expect(p.targetPaceSec).toBe(4 * 60 + 11);
  });

  it('legge il passo dentro parentesi del protocollo norvegese', () => {
    const p = parsePrescription(
      sess('Norvegese 4×4', '10 min riscaldamento @ 5:18/km · 4×4 min @ 90–95% FCmax (≈3:58/km) con 3 min recupero.'),
    );
    expect(p.reps).toBe(4);
    expect(p.targetPaceSec).toBe(3 * 60 + 58);
  });

  it('riconosce il tempo continuo', () => {
    const p = parsePrescription(
      sess('Tempo Run 20 min', '2 km warm-up @ 5:18/km · 20 min continui @ 4:09/km (soglia) · 2 km defaticamento.', null, 'tempo'),
    );
    expect(p.kind).toBe('tempo');
    expect(p.targetPaceSec).toBe(4 * 60 + 9);
  });

  it('tratta il lento come corsa facile', () => {
    const p = parsePrescription(sess('Lento', 'Corsa lenta 7.7 km a passo 5:20/km.', '5:06', 'easy'));
    expect(p.kind).toBe('easy');
  });

  it('accetta il formato del piano Sub-20 con apostrofo', () => {
    const p = parsePrescription(sess('Soglia 3×10′ @ 4:32', '3×10′ di soglia rec 90″ jog.'));
    expect(p.reps).toBe(3);
    expect(p.repDurSec).toBe(600);
    expect(p.targetPaceSec).toBe(4 * 60 + 32);
  });
});

// ─── VERDETTO: confronto con i giri realmente corsi ──────────────────────────

describe('evaluateSession', () => {
  const s = sess('Ripetute 1000', '2 km warm-up @ 5:20/km · 5×1000 m @ 4:00/km con 2 min jog.');

  it('centrata quando le rep sono complete e a ritmo', () => {
    const laps = [rep(1000, 238), recovery(), rep(1000, 240), recovery(), rep(1000, 239), recovery(), rep(1000, 241), recovery(), rep(1000, 238)];
    const e = evaluateSession(s, run(laps));
    expect(e.repsDone).toBe(5);
    expect(e.verdict).toBe('on_target');
  });

  it('sotto target quando il passo è ben più lento del prescritto', () => {
    const laps = [rep(1000, 262), recovery(), rep(1000, 265), recovery(), rep(1000, 268), recovery(), rep(1000, 270), recovery(), rep(1000, 272)];
    const e = evaluateSession(s, run(laps));
    expect(e.verdict).toBe('under');
    expect(e.deltaPct).toBeGreaterThan(5);
  });

  it('non completata quando mancano le ripetute', () => {
    const e = evaluateSession(s, run([rep(1000, 240), recovery(), rep(1000, 242)]));
    expect(e.repsDone).toBe(2);
    expect(e.verdict).toBe('not_completed');
  });

  it('misura il decadimento interno alla seduta', () => {
    const laps = [rep(1000, 235), recovery(), rep(1000, 242), recovery(), rep(1000, 250), recovery(), rep(1000, 258), recovery(), rep(1000, 262)];
    const e = evaluateSession(s, run(laps));
    expect(e.fadePct).toBeGreaterThan(10); // l'ultima molto più lenta della prima
  });

  it('ignora il riscaldamento: conta solo ciò che somiglia alla ripetuta', () => {
    const laps = [lap(2000, 640), rep(1000, 239), recovery(), rep(1000, 240), recovery(), rep(1000, 238), recovery(), rep(1000, 241), recovery(), rep(1000, 239)];
    const e = evaluateSession(s, run(laps));
    expect(e.repsDone).toBe(5); // i 2 km di warm-up non sono una rep
  });

  it('segna mancata la seduta senza corsa', () => {
    expect(evaluateSession(s, null).verdict).toBe('missed');
  });

  it('non giudica la struttura senza giri registrati', () => {
    expect(evaluateSession(s, run([])).verdict).toBe('unrated');
  });

  it('il lento conta come fatto, non si "fallisce"', () => {
    const easy = sess('Lento', 'Corsa lenta 8 km a passo 5:20/km.', '5:20', 'easy');
    expect(evaluateSession(easy, run([lap(8000, 2560)])).verdict).toBe('on_target');
  });
});

// ─── DIAGNOSI: il pattern, non il singolo giorno ─────────────────────────────

const ev = (o: Partial<SessionEval>): SessionEval => ({
  date: '2026-08-11', title: 'x', verdict: 'on_target', kind: 'reps',
  repsPrescribed: 5, repsDone: 5, targetPaceSec: 240, actualPaceSec: 240,
  deltaPct: 0, fadePct: 0, tempC: 15, ...o,
});

describe('diagnose', () => {
  it('una seduta storta non fa scattare nulla', () => {
    const d = diagnose([ev({ verdict: 'under', deltaPct: 8 }), ev({}), ev({})]);
    expect(d.level).toBe('ok');
    expect(d.streak).toBe(1);
  });

  it('due sedute sotto target avvisano, tre fanno ricalibrare', () => {
    const two = diagnose([ev({ verdict: 'under', deltaPct: 7 }), ev({ verdict: 'under', deltaPct: 6 }), ev({})]);
    expect(two.level).toBe('watch');
    const three = diagnose([
      ev({ verdict: 'under', deltaPct: 7 }), ev({ verdict: 'under', deltaPct: 6 }), ev({ verdict: 'under', deltaPct: 8 }),
    ]);
    expect(three.level).toBe('recalibrate');
    expect(three.cause).toBe('pace_too_fast');
    expect(three.suggestedPaceSec).toBeGreaterThan(240); // propone un passo più lento
  });

  it('riconosce il caldo invece di incolpare il piano', () => {
    const d = diagnose([
      ev({ verdict: 'under', deltaPct: 6, tempC: 29 }),
      ev({ verdict: 'under', deltaPct: 7, tempC: 27 }),
      ev({ verdict: 'on_target', deltaPct: 0, tempC: 12 }),
    ]);
    expect(d.cause).toBe('heat');
  });

  it('distingue il crollo di tenuta dal target sbagliato', () => {
    const d = diagnose([
      ev({ verdict: 'under', deltaPct: 3, fadePct: 9 }),
      ev({ verdict: 'under', deltaPct: 4, fadePct: 8 }),
    ]);
    expect(d.cause).toBe('endurance');
  });

  it('sedute saltate senza scarto di passo = fatica', () => {
    const d = diagnose([
      ev({ verdict: 'missed', deltaPct: null, fadePct: null }),
      ev({ verdict: 'missed', deltaPct: null, fadePct: null }),
    ]);
    expect(d.cause).toBe('fatigue');
  });

  it('i lenti non entrano nel giudizio sul target', () => {
    const d = diagnose([ev({ kind: 'easy', verdict: 'on_target' }), ev({ kind: 'easy', verdict: 'on_target' })]);
    expect(d.considered).toBe(0);
  });
});
