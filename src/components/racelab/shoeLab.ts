/**
 * LABORATORIO: SCARPE, CLIMA, AIUTI
 * ════════════════════════════════════════════════════════════════════════════
 * I numeri di questo file sono la parte che si può sbagliare più facilmente, e
 * quella su cui l'atleta baserà decisioni vere. Quindi tre regole.
 *
 * 1. SI PARTE DALL'ECONOMIA DI CORSA, NON DAL PASSO.
 *    Gli studi misurano il costo metabolico a velocità fissa: una scarpa "fa
 *    risparmiare il 4%" di ossigeno, non "fa guadagnare il 4% di tempo". Le due
 *    cose non coincidono, e confonderle è l'errore più comune che si legge in
 *    giro. La conversione sta in {@link ECON_TO_PACE} ed è dichiarata.
 *
 * 2. OGNI VOCE PORTA LA SUA INCERTEZZA.
 *    Un confronto diretto in laboratorio fra tutti i modelli top non esiste:
 *    i dati vengono da studi diversi, su soggetti diversi, con calzature di
 *    riferimento diverse. Dove il dato è solido l'incertezza è stretta, dove è
 *    interpolato è larga — e la pagina lo mostra invece di nasconderlo.
 *
 * 3. IL GUADAGNO NON È UGUALE PER TUTTI.
 *    Chi corre più forte trae di più dalle piastre (più tempo di volo da
 *    restituire); il nitrato funziona molto meno in chi è già molto allenato.
 *    Dove la letteratura lo dice, il modello lo scala.
 *
 * Riferimenti principali: Hoogkamer et al. 2018 (Vaporfly, −4% costo metabolico
 * vs flat da gara); Barnes & Kilding 2019; Bosquet et al. 2007 (meta-analisi
 * sul tapering); Senefeld et al. 2020 e McMahon et al. 2017 (meta-analisi sui
 * nitrati); Ely et al. 2007 (temperatura e prestazione di endurance).
 */

/**
 * Da risparmio metabolico a guadagno di velocità.
 *
 * Il costo dell'ossigeno cresce più che linearmente con la velocità, quindi
 * risparmiare il 4% di energia non regala il 4% di velocità: ne regala circa
 * tre quarti. È il fattore che riconcilia il "4%" del nome commerciale con i
 * ~2,5-3% di tempo che si misurano davvero in gara.
 */
export const ECON_TO_PACE = 0.75;

export type ShoeClass = "superRacer" | "superTrainer" | "trainer" | "flat";

export interface Shoe {
  id: string;
  brand: string;
  name: string;
  cls: ShoeClass;
  /** Risparmio metabolico stimato rispetto a una flat da gara tradizionale, %. */
  economyPct: number;
  /** Incertezza (±) su quel numero, in punti percentuali. */
  uncertaintyPct: number;
  /** Massa dichiarata, g (misura 42-43): entra nel modello a parte. */
  grams: number;
  /** Su cosa si basa il numero. Sta in pagina: niente cifre senza provenienza. */
  basis: string;
}

/**
 * La flat da gara tradizionale è lo zero della scala: tutto è misurato rispetto
 * a lei perché è il riferimento degli studi originali.
 */
export const SHOES: Shoe[] = [
  {
    id: "alphafly3", brand: "Nike", name: "Alphafly 3", cls: "superRacer",
    economyPct: 4.2, uncertaintyPct: 0.7, grams: 214,
    basis: "Discendente diretta delle Vaporfly dei test Hoogkamer (−4%). Aria pressurizzata + piastra piena: la stima più alta della categoria, ma la forbice fra i top model è dentro il rumore.",
  },
  {
    id: "metaspeedray", brand: "ASICS", name: "Metaspeed Ray", cls: "superRacer",
    economyPct: 4.1, uncertaintyPct: 0.9, grams: 129,
    basis: "Massa molto bassa a parità di stack: il vantaggio in economia dal peso è reale e misurabile (~0,7% ogni 100 g). Dato indipendente ancora scarso: incertezza più larga.",
  },
  {
    id: "fastr3", brand: "Puma", name: "Fast-R Nitro Elite 3", cls: "superRacer",
    economyPct: 3.9, uncertaintyPct: 0.9, grams: 170,
    basis: "Intersuola disaccoppiata + PEBA. Test indipendenti la collocano nel gruppo di testa, senza dati pubblicati che la separino dalle altre.",
  },
  {
    id: "endorphinelite2", brand: "Saucony", name: "Endorphin Elite 2", cls: "superRacer",
    economyPct: 3.7, uncertaintyPct: 0.9, grams: 190,
    basis: "Schiuma IncrediRun + piastra. Dentro la categoria, verso la parte bassa della forbice nei confronti indipendenti.",
  },
  {
    id: "adiospro4", brand: "Adidas", name: "Adizero Adios Pro 4", cls: "superRacer",
    economyPct: 3.8, uncertaintyPct: 0.8, grams: 176,
    basis: "Lightstrike Pro + bastoncini in carbonio. Serie con la storia di test più lunga dopo Nike.",
  },
  {
    id: "feidian6", brand: "Li Ning", name: "Feidian 6 Elite", cls: "superRacer",
    economyPct: 3.6, uncertaintyPct: 1.1, grams: 160,
    basis: "Costruzione da super scarpa e massa bassa, ma i dati pubblici sono quasi solo del produttore: è la stima meno solida della lista.",
  },
  {
    id: "superblast3", brand: "ASICS", name: "Superblast 3", cls: "superTrainer",
    economyPct: 2.4, uncertaintyPct: 0.6, grams: 248,
    basis: "Super trainer: stack alto e schiuma FF Turbo+, ma senza piastra piena in carbonio e più pesante. I test indipendenti la mettono stabilmente sotto le racer con piastra, sopra qualunque allenamento.",
  },
  {
    id: "trainer", brand: "—", name: "Scarpa da allenamento", cls: "trainer",
    economyPct: 0.6, uncertaintyPct: 0.5, grams: 260,
    basis: "Allenamento moderna con schiuma EVA/TPU evoluta: poco sopra la flat tradizionale.",
  },
  {
    id: "flat", brand: "—", name: "Flat da gara (riferimento)", cls: "flat",
    economyPct: 0, uncertaintyPct: 0, grams: 190,
    basis: "Lo zero della scala: la calzatura di controllo degli studi originali.",
  },
];

export const shoeById = (id: string | null | undefined): Shoe | null =>
  SHOES.find((s) => s.id === id) ?? null;

/** La scarpa con cui questo atleta corre forte, se non dice altro. */
export const DEFAULT_SHOE_ID = "superblast3";

/**
 * Il guadagno di una scarpa non è uguale per tutti.
 *
 * Le piastre restituiscono energia in proporzione a quanta gliene dai: a ritmi
 * lenti la stessa scarpa rende meno. Sotto i 3:30/km si è oltre i dati; sopra i
 * 5:30 il vantaggio si riduce sensibilmente. Fattore 1 attorno ai ritmi di gara
 * su cui gli studi sono stati fatti (~3:00-4:00/km per i soggetti allenati,
 * scalato qui su un amatore veloce).
 */
export function shoeSpeedFactor(paceSec: number): number {
  if (paceSec <= 240) return 1;
  if (paceSec >= 400) return 0.62;
  return 1 - ((paceSec - 240) / (400 - 240)) * 0.38;
}

/** Guadagno di passo (%) di una scarpa rispetto a un'altra, a quel ritmo. */
export function shoeGainPct(from: Shoe, to: Shoe, paceSec: number): number {
  return (to.economyPct - from.economyPct) * ECON_TO_PACE * shoeSpeedFactor(paceSec);
}

// ── TAPER ─────────────────────────────────────────────────────────────────────
export type TaperKind = "none" | "short" | "full";

export interface TaperDef { id: TaperKind; label: string; detail: string; gainPct: number; uncertaintyPct: number }

/**
 * Bosquet 2007, meta-analisi su 27 studi: il tapering ottimale (2 settimane,
 * volume −40/−60%, intensità invariata, frequenza quasi invariata) vale in media
 * ~3% di prestazione, con una forbice larga. Qui si resta prudenti.
 */
export const TAPERS: TaperDef[] = [
  { id: "none", label: "Nessuno", detail: "Carico pieno fino alla vigilia", gainPct: 0, uncertaintyPct: 0 },
  { id: "short", label: "Corto (5-7 giorni)", detail: "Volume −30%, intensità invariata", gainPct: 1.2, uncertaintyPct: 0.6 },
  { id: "full", label: "Pieno (10-14 giorni)", detail: "Volume −45%, intensità invariata, frequenza tenuta", gainPct: 2.3, uncertaintyPct: 1.0 },
];
export const taperById = (id: TaperKind | null | undefined): TaperDef =>
  TAPERS.find((t) => t.id === id) ?? TAPERS[0];

// ── NITRATI (SUCCO DI BARBABIETOLA) ───────────────────────────────────────────
/**
 * Il nitrato alimentare migliora l'efficienza mitocondriale e riduce il costo
 * dell'ossigeno. Le meta-analisi danno ~1-1,5% sulle prove a cronometro — ma il
 * beneficio CROLLA con il livello di allenamento: negli atleti d'élite gli studi
 * sono in larga parte nulli, perché il loro sistema è già ottimizzato.
 *
 * Protocollo dei lavori positivi: ~400-800 mg di nitrato (circa 140 ml di succo
 * concentrato), 2-3 ore prima, per 3-6 giorni consecutivi. Una dose singola il
 * giorno stesso rende meno della metà.
 */
export function nitrateGainPct(vdot: number): number {
  if (vdot >= 65) return 0.2;
  if (vdot <= 45) return 1.5;
  return 1.5 - ((vdot - 45) / 20) * 1.3;
}
export const NITRATE_UNCERTAINTY = 0.6;

// ── ALTRE VARIABILI DI GIORNATA ───────────────────────────────────────────────
/**
 * Il vantaggio di correre in gruppo invece che da soli. Sui 10 km in solitaria
 * si perde qualcosa contro la stessa forma corsa in gruppo: aria e ritmo.
 */
export const PACK_GAIN_PCT = 0.7;

/** Superficie: pista e asfalto liscio contro sterrato o asfalto rotto. */
export const SURFACE = [
  { id: "track", label: "Pista", gainPct: 0.8 },
  { id: "road", label: "Asfalto", gainPct: 0 },
  { id: "rough", label: "Sterrato o asfalto rotto", gainPct: -1.8 },
] as const;
export type SurfaceId = (typeof SURFACE)[number]["id"];
export const surfaceById = (id: SurfaceId) => SURFACE.find((s) => s.id === id) ?? SURFACE[1];

// ── RPE: la corsa era davvero a tutta? ────────────────────────────────────────
/**
 * Serve a una cosa sola: capire quanto margine è rimasto.
 *
 * Una prova a RPE 8 non è una prestazione massimale, e trattarla come tale
 * gonfia ogni stima costruita sopra. Qui l'RPE non entra in nessun calcolo di
 * VDOT o di soglia — quella strada era già stata scartata perché il dato è
 * soggettivo — ma per rispondere a "quanto avrei corso se ci fossi andato a
 * tutta" è l'unica informazione che ce l'ha.
 */
export function rpeMaxGainPct(rpe: number | null | undefined): number {
  if (rpe == null) return 0;
  const r = Math.max(1, Math.min(10, rpe));
  if (r >= 9.5) return 0;
  // ogni punto sotto il massimale vale circa l'1,4% di passo, con la scala che
  // si allarga in basso: sotto RPE 6 non era una prova, era un allenamento
  return Math.min(9, (9.5 - r) * 1.4);
}
