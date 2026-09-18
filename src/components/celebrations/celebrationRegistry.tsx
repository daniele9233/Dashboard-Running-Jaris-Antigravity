import type { ComponentType } from "react";
import {
  StopwatchScene, RouteScene, VelocityScene, CadenceScene, LaurelScene,
  OrbitScene, SummitScene, StreakScene, OdometerScene, PulseScene,
  type SceneProps,
} from "./scenes";
import {
  WeekBarsScene, MilestoneScene, CalendarWaveScene, ThousandScene, FinishTapeScene,
  ArchScene, TallyScene, DoubleDayScene, HourglassScene, OverflowScene,
} from "./scenesVolume";
import {
  TrackLapScene, RepLadderScene, SplitWatchScene, LaunchScene, NegativeSplitScene,
  BarrierBreakScene, GaugeScene, RocketFinishScene, StampLapsScene, StaircaseScene,
} from "./scenesSpeed";
import {
  TrailScene, CablewayScene,
} from "./scenesClimb";
import {
  ChainScene, TripleFlameScene, HundredScene, SunriseScene, NightOwlScene,
  RainRunnerScene, SnowflakeScene, HeatScene, PerfectCheckScene, PieWheelScene,
} from "./scenesHabit";
import {
  TrophyBuildScene, TripleStarsScene, BibPinScene,
  GateOpenScene, StopClockScene, RankClimbScene, TierUpScene,
  PhoenixScene,
} from "./scenesRace";
import {
  SubFourScene, UrbanLimitScene, LocomotiveScene, DoubleKScene, MileScene,
  EightHundredScene, ThreeKScene, TempoWaveScene, EvenSplitScene, YassoScene,
} from "./scenesPace";
import {
  Week80Scene, Month200Scene, TwoThousandScene, YearRingScene, HundredRunsScene,
  Runs250Scene, SundayLongScene, TwentyHoursScene, CalorieBurnScene, FourWeeksScene,
} from "./scenesDist";
import {
  EfficiencyScene, SteadyHeartScene, GroundContactScene, OscillationScene, PowerBoltScene,
  RecoveryDipScene, FlatlineScene, CoolHeartScene, StrideScene, GoldIndexScene,
} from "./scenesPhysio";
import {
  HeatPeakScene, BirthdayScene, TrackOvalScene, WindScene, HumidityScene,
  FogScene, DawnTenScene, YearStreakScene, WeekendScene, NewYearScene,
} from "./scenesMoments";
import {
  CrownClockScene, HalfRecordScene, ArchUnderScene, RingGoalScene, GantryScene,
  GrowthScene, PodiumScene, MetronomeGateScene, TripleBibScene, BibStackScene,
} from "./scenesPodium";

/**
 * Registry delle celebrazioni: 100 traguardi running in 7 gruppi, ognuno con
 * la propria scena GSAP, palette e formattazione del valore. Valori demo =
 * dati reali dell'atleta dove noti.
 *
 * `riv` (opzionale): aggancia un asset Rive (.riv) come layer della scena —
 * vedi RiveLayer.tsx per il flusso di attivazione.
 */

const fmtTime = (secs: number): string => {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmtKm = (v: number): string => `${v.toFixed(1).replace(".", ",")} km`;
const fmtInt = (unit: string) => (v: number) => `${Math.round(v)} ${unit}`;

export type CelebrationGroup = "CLASSICI" | "VOLUME" | "VELOCITÀ" | "FISIOLOGIA" | "SALITE" | "COSTANZA" | "GARE";

export interface CelebrationDef {
  id: string;
  group: CelebrationGroup;
  /** Chip in alto, es. "RECORD PERSONALE" */
  category: string;
  /** Titolo kinetic, es. "MIGLIOR 1 KM" */
  title: string;
  /** Descrizione breve per il pulsante dello studio */
  mechanic: string;
  value: number;
  format: (v: number) => string;
  accent: string;
  accent2: string;
  Scene: ComponentType<SceneProps>;
  /** La scena mostra già il valore al suo interno → niente counter comune */
  hideValue?: boolean;
  riv?: { src: string; stateMachine?: string };
}

export const CELEBRATIONS: CelebrationDef[] = [
  /* ── CLASSICI ─────────────────────────────────────────────────────────── */
  { id: "best-1k", group: "CLASSICI", category: "RECORD PERSONALE", title: "MIGLIOR 1 KM",
    mechanic: "Cronometro · lancetta elastica + flash", value: 222, format: fmtTime,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: StopwatchScene },
  { id: "longest-run", group: "CLASSICI", category: "RECORD DISTANZA", title: "CORSA PIÙ LUNGA",
    mechanic: "Percorso che si disegna · pin con bounce", value: 21.6, format: fmtKm,
    accent: "#22D3EE", accent2: "#60A5FA", Scene: RouteScene },
  { id: "fastest-segment", group: "CLASSICI", category: "RECORD VELOCITÀ", title: "TRATTO PIÙ VELOCE",
    mechanic: "Nuovo record di passo sui 400 m", value: 203, format: (v) => `${fmtTime(v)} /km`,
    accent: "#F43F5E", accent2: "#FB923C", Scene: VelocityScene, hideValue: true },
  { id: "best-cadence", group: "CLASSICI", category: "RECORD BIOMECCANICA", title: "CADENZA RECORD",
    mechanic: "Equalizzatore a battito · impronte", value: 184, format: fmtInt("spm"),
    accent: "#A78BFA", accent2: "#F472B6", Scene: CadenceScene },
  { id: "best-5k", group: "CLASSICI", category: "RECORD PERSONALE", title: "MIGLIOR 5 KM",
    mechanic: "Alloro · medaglione + shine", value: 1272, format: fmtTime,
    accent: "#F59E0B", accent2: "#C0FF00", Scene: LaurelScene },
  { id: "best-10k", group: "CLASSICI", category: "RECORD PERSONALE", title: "MIGLIOR 10 KM",
    mechanic: "Anelli orbitali · satellite MotionPath", value: 2726, format: fmtTime,
    accent: "#22D3EE", accent2: "#C0FF00", Scene: OrbitScene },
  { id: "elevation-record", group: "CLASSICI", category: "RECORD SALITA", title: "DISLIVELLO RECORD",
    mechanic: "Cresta + bandierina in vetta", value: 642, format: (v) => `+${Math.round(v)} m`,
    accent: "#10B981", accent2: "#C0FF00", Scene: SummitScene },
  { id: "streak", group: "CLASSICI", category: "COSTANZA", title: "STREAK ALLENAMENTI",
    mechanic: "Nuovo record di giorni consecutivi", value: 5, format: fmtInt("giorni"),
    accent: "#FB923C", accent2: "#F43F5E", Scene: StreakScene },
  { id: "weekly-volume", group: "CLASSICI", category: "RECORD VOLUME", title: "SETTIMANA RECORD",
    mechanic: "Contachilometri · cifre che rotolano", value: 52.4, format: fmtKm,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: OdometerScene, hideValue: true },
  { id: "vdot-record", group: "CLASSICI", category: "MOTORE AEROBICO", title: "NUOVO VDOT",
    mechanic: "ECG · testa luminosa + shockwave", value: 48.2, format: (v) => v.toFixed(1).replace(".", ","),
    accent: "#C0FF00", accent2: "#22D3EE", Scene: PulseScene },

  /* ── VOLUME & DISTANZA ────────────────────────────────────────────────── */
  { id: "week-60k", group: "VOLUME", category: "RECORD VOLUME", title: "60 KM IN UNA SETTIMANA",
    mechanic: "7 colonne · l'ultima sfonda l'obiettivo", value: 61.3, format: fmtKm,
    accent: "#C0FF00", accent2: "#F59E0B", Scene: WeekBarsScene },
  { id: "first-30k", group: "VOLUME", category: "PRIMA VOLTA", title: "PRIMA CORSA DA 30 KM",
    mechanic: "Strada prospettica · cippo che si pianta", value: 30.2, format: fmtKm,
    accent: "#22D3EE", accent2: "#C0FF00", Scene: MilestoneScene },
  { id: "month-100k", group: "VOLUME", category: "RECORD VOLUME", title: "100 KM IN UN MESE",
    mechanic: "Calendario · celle a ondata diagonale", value: 102.7, format: fmtKm,
    accent: "#A78BFA", accent2: "#22D3EE", Scene: CalendarWaveScene },
  { id: "total-1000k", group: "VOLUME", category: "MILESTONE", title: "1000 KM TOTALI",
    mechanic: "Cifre che cadono con bounce", value: 1000, format: fmtKm,
    accent: "#F59E0B", accent2: "#C0FF00", Scene: ThousandScene, hideValue: true },
  { id: "first-half", group: "VOLUME", category: "PRIMA VOLTA", title: "PRIMA MEZZA MARATONA",
    mechanic: "Nastro del traguardo che si spezza", value: 21.097, format: fmtKm,
    accent: "#C0FF00", accent2: "#F43F5E", Scene: FinishTapeScene, hideValue: true },
  { id: "first-marathon", group: "VOLUME", category: "PRIMA VOLTA", title: "PRIMA MARATONA",
    mechanic: "Arco del traguardo + coriandoli", value: 42.195, format: fmtKm,
    accent: "#F59E0B", accent2: "#22D3EE", Scene: ArchScene },
  { id: "runs-50", group: "VOLUME", category: "MILESTONE", title: "50 CORSE COMPLETATE",
    mechanic: "Tacche da conteggio timbrate in serie", value: 50, format: fmtInt("corse"),
    accent: "#10B981", accent2: "#C0FF00", Scene: TallyScene, hideValue: true },
  { id: "double-day", group: "VOLUME", category: "GIORNATA SPECIALE", title: "DOPPIETTA GIORNALIERA",
    mechanic: "Sole e luna sull'arco del giorno", value: 2, format: fmtInt("corse"),
    accent: "#F59E0B", accent2: "#A78BFA", Scene: DoubleDayScene, hideValue: true },
  { id: "month-10h", group: "VOLUME", category: "RECORD TEMPO", title: "10 ORE IN UN MESE",
    mechanic: "Clessidra · sabbia che scorre + flip", value: 10, format: fmtInt("ore"),
    accent: "#22D3EE", accent2: "#C0FF00", Scene: HourglassScene, hideValue: true },
  { id: "day-record", group: "VOLUME", category: "RECORD GIORNALIERO", title: "KM RECORD IN UN GIORNO",
    mechanic: "La barra sfonda il fondo scala", value: 26.4, format: fmtKm,
    accent: "#F43F5E", accent2: "#C0FF00", Scene: OverflowScene },

  /* ── VELOCITÀ & RIPETUTE ──────────────────────────────────────────────── */
  { id: "400-sub3", group: "VELOCITÀ", category: "RIPETUTE", title: "400 M SOTTO I 3:00/KM",
    mechanic: "Pista · lampo sul rettilineo", value: 176, format: (v) => `${fmtTime(v)} /km`,
    accent: "#F43F5E", accent2: "#C0FF00", Scene: TrackLapScene },
  { id: "rep-1000", group: "VELOCITÀ", category: "RIPETUTE", title: "RECORD RIPETUTE 1000 M",
    mechanic: "Nuovo record sul giro da 1000 m", value: 214, format: (v) => `${fmtTime(v)} best`,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: RepLadderScene },
  { id: "first-intervals", group: "VELOCITÀ", category: "PRIMA VOLTA", title: "PRIMA SESSIONE DI RIPETUTE",
    mechanic: "Una seduta classificata come ripetute", value: 3, format: fmtInt("lap"),
    accent: "#A78BFA", accent2: "#C0FF00", Scene: SplitWatchScene, hideValue: true },
  { id: "200-record", group: "VELOCITÀ", category: "SPRINT", title: "RECORD 200 M",
    mechanic: "Nuovo record sul giro da 200 m", value: 32, format: (v) => `${Math.round(v)}″`,
    accent: "#FB923C", accent2: "#F43F5E", Scene: LaunchScene },
  { id: "negative-split", group: "VELOCITÀ", category: "GESTIONE GARA", title: "NEGATIVE SPLIT PERFETTO",
    mechanic: "La seconda metà sorpassa la prima", value: 38, format: (v) => `−0:${String(Math.round(v)).padStart(2, "0")}`,
    accent: "#22D3EE", accent2: "#C0FF00", Scene: NegativeSplitScene, hideValue: true },
  { id: "barrier-break", group: "VELOCITÀ", category: "BARRIERA", title: "MURO ABBATTUTO",
    mechanic: "5K limato di almeno 30 secondi", value: 1188, format: fmtTime,
    accent: "#C0FF00", accent2: "#F43F5E", Scene: BarrierBreakScene, hideValue: true },
  { id: "speed-20", group: "VELOCITÀ", category: "VELOCITÀ MAX", title: "OLTRE 20 KM/H",
    mechanic: "Un tratto lanciato oltre i 20 km/h", value: 20, format: (v) => `${v.toFixed(1).replace(".", ",")} km/h`,
    accent: "#C0FF00", accent2: "#F43F5E", Scene: GaugeScene },
  { id: "final-sprint", group: "VELOCITÀ", category: "FINALE", title: "ULTIMO KM PIÙ VELOCE",
    mechanic: "Freccia che accelera fuori scena", value: 238, format: (v) => `${fmtTime(v)} /km`,
    accent: "#22D3EE", accent2: "#F59E0B", Scene: RocketFinishScene },
  { id: "rep-400x8", group: "VELOCITÀ", category: "RIPETUTE", title: "RECORD 8 × 400 M",
    mechanic: "Otto giri timbrati in sequenza", value: 78, format: (v) => `${Math.round(v)}″ medio`,
    accent: "#A78BFA", accent2: "#F472B6", Scene: StampLapsScene },
  { id: "progression", group: "VELOCITÀ", category: "GESTIONE", title: "PROGRESSIONE PERFETTA",
    mechanic: "Scala discendente · pallina che scende", value: 5, format: fmtInt("km in negativa"),
    accent: "#10B981", accent2: "#C0FF00", Scene: StaircaseScene, hideValue: true },

  /* ── SALITE & TERRENO ─────────────────────────────────────────────────── */
  { id: "first-trail", group: "SALITE", category: "TERRENO", title: "CORSA COLLINARE",
    mechanic: "Almeno 15 m di dislivello per km", value: 15, format: (v) => `${Math.round(v)} m/km`,
    accent: "#10B981", accent2: "#86EFAC", Scene: TrailScene },
  { id: "longest-climb", group: "SALITE", category: "SALITA", title: "SALITA NON-STOP PIÙ LUNGA",
    mechanic: "Nuovo record di salita continua", value: 4, format: fmtKm,
    accent: "#22D3EE", accent2: "#C0FF00", Scene: CablewayScene },

  /* ── COSTANZA & CONDIZIONI ────────────────────────────────────────────── */
  { id: "streak-7", group: "COSTANZA", category: "STREAK", title: "7 GIORNI DI FILA",
    mechanic: "Catena · anelli che si agganciano", value: 7, format: fmtInt("giorni"),
    accent: "#C0FF00", accent2: "#22D3EE", Scene: ChainScene, hideValue: true },
  { id: "streak-30", group: "COSTANZA", category: "CARICO", title: "MESE DI FUOCO",
    mechanic: "Venti corse in trenta giorni", value: 20, format: fmtInt("corse"),
    accent: "#FB923C", accent2: "#F43F5E", Scene: TripleFlameScene, hideValue: true },
  { id: "streak-100", group: "COSTANZA", category: "ABITUDINE", title: "CENTO GIORNI IN UN ANNO",
    mechanic: "100 giorni di corsa dentro 365", value: 100, format: fmtInt("giorni"),
    accent: "#F59E0B", accent2: "#F43F5E", Scene: HundredScene, hideValue: true },
  { id: "dawn-run", group: "COSTANZA", category: "CONDIZIONI", title: "CORSA ALL'ALBA",
    mechanic: "Il sole sorge coi raggi che si estendono", value: 5.8, format: fmtKm,
    accent: "#F59E0B", accent2: "#FB923C", Scene: SunriseScene, hideValue: true },
  { id: "night-run", group: "COSTANZA", category: "CONDIZIONI", title: "CORSA NOTTURNA",
    mechanic: "Partenza dalle 20:00 in poi", value: 7.2, format: fmtKm,
    accent: "#A78BFA", accent2: "#E4E4E7", Scene: NightOwlScene, hideValue: true },
  { id: "rain-run", group: "COSTANZA", category: "CONDIZIONI", title: "ASFALTO BAGNATO",
    mechanic: "Umidità ≥95% tra gli 8 e i 16°C", value: 8.3, format: fmtKm,
    accent: "#C0FF00", accent2: "#60A5FA", Scene: RainRunnerScene },
  { id: "freezing-run", group: "COSTANZA", category: "CONDIZIONI", title: "CORSA NEL GELO",
    mechanic: "Termometro sotto i 2°C", value: 2, format: (v) => `${Math.round(v)}°C`,
    accent: "#60A5FA", accent2: "#BAE6FD", Scene: SnowflakeScene, hideValue: true },
  { id: "heat-run", group: "COSTANZA", category: "CONDIZIONI", title: "CORSA OLTRE I 30°C",
    mechanic: "Termometro che sfora · onde di calore", value: 33, format: (v) => `${Math.round(v)}°C`,
    accent: "#FB923C", accent2: "#F43F5E", Scene: HeatScene, hideValue: true },
  { id: "perfect-month", group: "COSTANZA", category: "PIANO", title: "MESE PERFETTO",
    mechanic: "Venti giorni di corsa nello stesso mese", value: 20, format: fmtInt("giorni"),
    accent: "#C0FF00", accent2: "#FFFFFF", Scene: PerfectCheckScene, hideValue: true },
  { id: "week-coverage", group: "COSTANZA", category: "ABITUDINE", title: "OGNI GIORNO DELLA SETTIMANA",
    mechanic: "Tutti e 7 i giorni coperti nella stessa settimana", value: 7, format: fmtInt("giorni"),
    accent: "#22D3EE", accent2: "#A78BFA", Scene: PieWheelScene, hideValue: true },

  /* ── GARE & MILESTONE ─────────────────────────────────────────────────── */
  { id: "first-pb-season", group: "GARE", category: "STAGIONE", title: "PRIMO PB STAGIONALE",
    mechanic: "Un record caduto quest'anno", value: 0, format: fmtTime,
    accent: "#F59E0B", accent2: "#C0FF00", Scene: TrophyBuildScene, hideValue: true },
  { id: "triple-pb", group: "GARE", category: "MESE D'ORO", title: "3 PB NELLO STESSO MESE",
    mechanic: "Tre record personali dentro lo stesso mese", value: 3, format: fmtInt("PB"),
    accent: "#C0FF00", accent2: "#F59E0B", Scene: TripleStarsScene, hideValue: true },
  { id: "first-race", group: "GARE", category: "PRIMA VOLTA", title: "PRIMA PROVA CRONOMETRATA",
    mechanic: "5 km o più sotto i 4:30/km", value: 1247, format: (v) => `#${Math.round(v)}`,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: BibPinScene, hideValue: true },
  { id: "sub50-10k", group: "GARE", category: "BARRIERA", title: "10K SOTTO I 50 MINUTI",
    mechanic: "Il cancello 50:00 si apre a battenti", value: 2952, format: fmtTime,
    accent: "#22D3EE", accent2: "#C0FF00", Scene: GateOpenScene, hideValue: true },
  { id: "sub2-half", group: "GARE", category: "BARRIERA", title: "MEZZA SOTTO LE 2 ORE",
    mechanic: "Il cronometro si ferma sul tempo", value: 7148, format: fmtTime,
    accent: "#C0FF00", accent2: "#F59E0B", Scene: StopClockScene, hideValue: true },
  { id: "rank-up", group: "GARE", category: "CLASSIFICA", title: "TOP 5 PERSONALE",
    mechanic: "Una corsa ≥8 km entra nelle tue 5 migliori", value: 5, format: (v) => `${Math.round(v)}°`,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: RankClimbScene, hideValue: true },
  { id: "tier-up", group: "GARE", category: "RANKING", title: "SALTO DI TIER",
    mechanic: "Superi un multiplo di 5 di VDOT", value: 10, format: (v) => `tier ${Math.round(v)}`,
    accent: "#22D3EE", accent2: "#C0FF00", Scene: TierUpScene, hideValue: true },
  { id: "comeback", group: "GARE", category: "RITORNO", title: "COMEBACK",
    mechanic: "La fenice si rialza dalle ceneri", value: 31, format: (v) => `dopo ${Math.round(v)} giorni`,
    accent: "#F59E0B", accent2: "#F43F5E", Scene: PhoenixScene },

  /* ── VELOCITÀ · estensione ────────────────────────────────────────────── */
  { id: "sub-4", group: "VELOCITÀ", category: "BARRIERA", title: "SOTTO I 4 MINUTI",
    mechanic: "1000 m con passo sotto i 4:00/km", value: 234, format: (v) => `${fmtTime(v)} /km`,
    accent: "#C0FF00", accent2: "#F43F5E", Scene: SubFourScene, hideValue: true },
  { id: "urban-limit", group: "VELOCITÀ", category: "TENUTA", title: "LIMITE URBANO",
    mechanic: "3000 m tenuti sopra i 16 km/h", value: 16, format: (v) => `${Math.round(v)} km/h`,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: UrbanLimitScene, hideValue: true },
  { id: "sustained-18", group: "VELOCITÀ", category: "TENUTA", title: "LOCOMOTIVA",
    mechanic: "18 km/h tenuti per 2 minuti", value: 18, format: (v) => `${Math.round(v)} km/h`,
    accent: "#F59E0B", accent2: "#FB923C", Scene: LocomotiveScene, hideValue: true },
  { id: "pb-2k", group: "VELOCITÀ", category: "RECORD PERSONALE", title: "DOPPIO CHILOMETRO",
    mechanic: "Due 1K che si fondono in 2K", value: 372, format: fmtTime,
    accent: "#22D3EE", accent2: "#C0FF00", Scene: DoubleKScene, hideValue: true },
  { id: "pb-mile", group: "VELOCITÀ", category: "RECORD PERSONALE", title: "MIGLIO VELOCE",
    mechanic: "I 4 giri consecutivi più veloci (≈1600 m)", value: 438, format: fmtTime,
    accent: "#C0FF00", accent2: "#A78BFA", Scene: MileScene, hideValue: true },
  { id: "pb-800", group: "VELOCITÀ", category: "RECORD PERSONALE", title: "OTTOCENTO RECORD",
    mechanic: "Due giri lampo sull'anello", value: 142, format: fmtTime,
    accent: "#F43F5E", accent2: "#C0FF00", Scene: EightHundredScene, hideValue: true },
  { id: "pb-3k", group: "VELOCITÀ", category: "RECORD PERSONALE", title: "TREMILA RECORD",
    mechanic: "Tre colonne-lap che salgono", value: 612, format: fmtTime,
    accent: "#22D3EE", accent2: "#60A5FA", Scene: ThreeKScene, hideValue: true },
  { id: "tempo-record", group: "VELOCITÀ", category: "SOGLIA", title: "TEMPO RUN PIÙ LUNGA",
    mechanic: "La tempo/soglia più lunga di sempre", value: 74, format: fmtInt("min"),
    accent: "#F59E0B", accent2: "#C0FF00", Scene: TempoWaveScene, hideValue: true },
  { id: "even-splits", group: "VELOCITÀ", category: "GESTIONE GARA", title: "SPLIT AL MILLIMETRO",
    mechanic: "Tutti gli split entro 15 s/km su un lungo", value: 0, format: fmtTime,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: EvenSplitScene, hideValue: true },
  { id: "yasso", group: "VELOCITÀ", category: "RIPETUTE", title: "SERIE DA DIECI",
    mechanic: "Dieci ripetute da 800 m o più in una seduta", value: 10, format: fmtInt("rip"),
    accent: "#A78BFA", accent2: "#F472B6", Scene: YassoScene, hideValue: true },

  /* ── VOLUME · estensione ──────────────────────────────────────────────── */
  { id: "week-80k", group: "VOLUME", category: "RECORD VOLUME", title: "80 KM IN UNA SETTIMANA",
    mechanic: "La colonna supera la tacca degli 80", value: 81.3, format: fmtKm,
    accent: "#C0FF00", accent2: "#F59E0B", Scene: Week80Scene },
  { id: "month-200k", group: "VOLUME", category: "RECORD VOLUME", title: "200 KM IN UN MESE",
    mechanic: "Anello mensile di 28 segmenti", value: 205, format: fmtKm,
    accent: "#A78BFA", accent2: "#22D3EE", Scene: Month200Scene, hideValue: true },
  { id: "total-2000k", group: "VOLUME", category: "MILESTONE", title: "2000 KM TOTALI",
    mechanic: "Cippi lungo la strada, 2000 si pianta", value: 2000, format: fmtKm,
    accent: "#F59E0B", accent2: "#C0FF00", Scene: TwoThousandScene, hideValue: true },
  { id: "year-1000k", group: "VOLUME", category: "MILESTONE", title: "1000 KM IN UN ANNO",
    mechanic: "Anello dei 12 mesi che si chiude", value: 1000, format: fmtKm,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: YearRingScene, hideValue: true },
  { id: "runs-100", group: "VOLUME", category: "MILESTONE", title: "100 CORSE",
    mechanic: "Griglia 10×10 che si riempie", value: 100, format: fmtInt("corse"),
    accent: "#22D3EE", accent2: "#C0FF00", Scene: HundredRunsScene, hideValue: true },
  { id: "runs-250", group: "VOLUME", category: "MILESTONE", title: "250 CORSE",
    mechanic: "Mattoni impilati fino a 250", value: 250, format: fmtInt("corse"),
    accent: "#10B981", accent2: "#C0FF00", Scene: Runs250Scene, hideValue: true },
  { id: "sunday-long", group: "VOLUME", category: "ABITUDINE", title: "LUNGO DOMENICALE",
    mechanic: "Domenica da almeno 16 km", value: 17.5, format: fmtKm,
    accent: "#F59E0B", accent2: "#FB923C", Scene: SundayLongScene },
  { id: "month-20h", group: "VOLUME", category: "RECORD TEMPO", title: "20 ORE IN UN MESE",
    mechanic: "Quadrante che accumula 20 ore", value: 20, format: fmtInt("ore"),
    accent: "#22D3EE", accent2: "#C0FF00", Scene: TwentyHoursScene, hideValue: true },
  { id: "cal-1000", group: "VOLUME", category: "ENERGIA", title: "PIZZA BRUCIATA",
    mechanic: "Oltre 1000 kcal in un allenamento", value: 1000, format: fmtInt("kcal"),
    accent: "#FB923C", accent2: "#F43F5E", Scene: CalorieBurnScene, hideValue: true },
  { id: "four-weeks", group: "VOLUME", category: "PIANO", title: "4 SETTIMANE PIENE",
    mechanic: "Quattro settimane di fila oltre i 30 km", value: 4, format: fmtInt("sett"),
    accent: "#C0FF00", accent2: "#10B981", Scene: FourWeeksScene, hideValue: true },

  /* ── FISIOLOGIA ───────────────────────────────────────────────────────── */
  { id: "z2-faster", group: "FISIOLOGIA", category: "EFFICIENZA", title: "MACCHINA EFFICIENTE",
    mechanic: "Stessa FC Z2, passo più veloce del mese scorso", value: 13, format: fmtKm,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: EfficiencyScene, hideValue: true },
  { id: "hr-stable", group: "FISIOLOGIA", category: "CUORE", title: "CARDIO-CHIRURGO",
    mechanic: "Lungo con le due metà entro 5 bpm", value: 5, format: fmtInt("bpm"),
    accent: "#F43F5E", accent2: "#C0FF00", Scene: SteadyHeartScene, hideValue: true },
  { id: "gct-200", group: "FISIOLOGIA", category: "BIOMECCANICA", title: "PASSO FELPATO",
    mechanic: "Tempo di contatto al suolo sotto i 200 ms", value: 184, format: fmtInt("ms"),
    accent: "#A78BFA", accent2: "#C0FF00", Scene: GroundContactScene, hideValue: true },
  { id: "low-vo", group: "FISIOLOGIA", category: "BIOMECCANICA", title: "RIMBALZO MINIMO",
    mechanic: "Oscillazione verticale ai minimi", value: 6, format: fmtInt("cm"),
    accent: "#22D3EE", accent2: "#A78BFA", Scene: OscillationScene, hideValue: true },
  { id: "power-record", group: "FISIOLOGIA", category: "CUORE", title: "PICCO CARDIACO",
    mechanic: "Nuova FC massima toccata in allenamento", value: 184, format: fmtInt("bpm"),
    accent: "#C0FF00", accent2: "#F59E0B", Scene: PowerBoltScene },
  { id: "hr-recovery", group: "FISIOLOGIA", category: "CUORE", title: "RECUPERO LAMPO",
    mechanic: "FC giù di 30+ bpm dalla ripetuta al recupero", value: 36, format: fmtInt("bpm"),
    accent: "#22D3EE", accent2: "#C0FF00", Scene: RecoveryDipScene, hideValue: true },
  { id: "low-drift", group: "FISIOLOGIA", category: "MOTORE", title: "ZERO DERIVA",
    mechanic: "Deriva cardiaca sotto il 3% su un lungo", value: 2, format: (v) => `${v.toFixed(1).replace(".", ",")}%`,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: FlatlineScene, hideValue: true },
  { id: "cool-heart", group: "FISIOLOGIA", category: "CUORE", title: "CUORE FRESCO",
    mechanic: "FC media più bassa a parità di corsa", value: 6, format: fmtInt("bpm"),
    accent: "#60A5FA", accent2: "#BAE6FD", Scene: CoolHeartScene, hideValue: true },
  { id: "stride-record", group: "FISIOLOGIA", category: "BIOMECCANICA", title: "FALCATA RECORD",
    mechanic: "Lunghezza del passo da primato", value: 1.52, format: (v) => `${v.toFixed(2).replace(".", ",")} m`,
    accent: "#C0FF00", accent2: "#F472B6", Scene: StrideScene, hideValue: true },
  { id: "efficiency-index", group: "FISIOLOGIA", category: "EFFICIENZA", title: "INDICE D'ORO",
    mechanic: "Miglior indice di efficienza di sempre", value: 1.64, format: (v) => v.toFixed(2).replace(".", ","),
    accent: "#F59E0B", accent2: "#C0FF00", Scene: GoldIndexScene, hideValue: true },

  /* ── COSTANZA · estensione ────────────────────────────────────────────── */
  { id: "heat-record-32", group: "COSTANZA", category: "CONDIZIONI", title: "CALDO RECORD",
    mechanic: "Allenamento oltre i 32°C", value: 33, format: (v) => `${Math.round(v)}°C`,
    accent: "#FB923C", accent2: "#F59E0B", Scene: HeatPeakScene, hideValue: true },
  { id: "birthday-run", group: "COSTANZA", category: "MOMENTO", title: "CORSA DI NATALE",
    mechanic: "Corri il 25 dicembre", value: 1, format: fmtInt(""),
    accent: "#C0FF00", accent2: "#F472B6", Scene: BirthdayScene, hideValue: true },
  { id: "track-session", group: "COSTANZA", category: "TERRENO", title: "PISTA BOLLENTE",
    mechanic: "Almeno 6 giri da 400 m nella stessa seduta", value: 6, format: fmtInt("giri"),
    accent: "#C0FF00", accent2: "#22D3EE", Scene: TrackOvalScene, hideValue: true },
  { id: "windy-run", group: "COSTANZA", category: "TERRITORIO", title: "ESPLORATORE",
    mechanic: "Corso in almeno 5 località diverse", value: 5, format: fmtInt("località"),
    accent: "#22D3EE", accent2: "#60A5FA", Scene: WindScene, hideValue: true },
  { id: "humid-run", group: "COSTANZA", category: "CONDIZIONI", title: "AFA TOTALE",
    mechanic: "Umidità oltre il 90%", value: 92, format: (v) => `${Math.round(v)}%`,
    accent: "#60A5FA", accent2: "#BAE6FD", Scene: HumidityScene, hideValue: true },
  { id: "foggy-run", group: "COSTANZA", category: "CONDIZIONI", title: "NELLA NEBBIA",
    mechanic: "Umidità ≥95% sotto gli 8°C", value: 1, format: fmtInt(""),
    accent: "#A78BFA", accent2: "#E4E4E7", Scene: FogScene, hideValue: true },
  { id: "dawn-ten", group: "COSTANZA", category: "ABITUDINE", title: "DIECI ALBE",
    mechanic: "Dieci corse iniziate prima delle 7:00", value: 10, format: fmtInt("albe"),
    accent: "#F59E0B", accent2: "#FB923C", Scene: DawnTenScene, hideValue: true },
  { id: "streak-365", group: "COSTANZA", category: "STREAK LEGGENDARIA", title: "52 SETTIMANE DI FILA",
    mechanic: "Un anno senza saltare una settimana", value: 52, format: fmtInt("sett"),
    accent: "#F59E0B", accent2: "#F43F5E", Scene: YearStreakScene, hideValue: true },
  { id: "weekend-warrior", group: "COSTANZA", category: "ABITUDINE", title: "GUERRIERO DEL WEEKEND",
    mechanic: "Ogni weekend del mese coperto", value: 4, format: fmtInt("we"),
    accent: "#C0FF00", accent2: "#22D3EE", Scene: WeekendScene, hideValue: true },
  { id: "new-year-run", group: "COSTANZA", category: "MOMENTO", title: "CORSA DI CAPODANNO",
    mechanic: "Il primo gennaio, conto alla rovescia", value: 1, format: fmtInt(""),
    accent: "#C0FF00", accent2: "#F59E0B", Scene: NewYearScene, hideValue: true },

  /* ── GARE · estensione ────────────────────────────────────────────────── */
  { id: "10k-minus1", group: "GARE", category: "RECORD GARA", title: "RE DEL CRONOMETRO",
    mechanic: "10K abbassato di oltre 1 minuto", value: 2322, format: fmtTime,
    accent: "#F59E0B", accent2: "#C0FF00", Scene: CrownClockScene, hideValue: true },
  { id: "pb-half", group: "GARE", category: "RECORD GARA", title: "MEZZA RECORD",
    mechanic: "Nuovo PB sulla mezza maratona", value: 5400, format: fmtTime,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: HalfRecordScene, hideValue: true },
  { id: "sub20-5k", group: "GARE", category: "BARRIERA", title: "5K SOTTO I 20 MINUTI",
    mechanic: "Sprint sotto l'arco dei 20:00", value: 1200, format: fmtTime,
    accent: "#C0FF00", accent2: "#F43F5E", Scene: ArchUnderScene, hideValue: true },
  { id: "sub25-5k", group: "GARE", category: "BARRIERA", title: "5K SOTTO I 25 MINUTI",
    mechanic: "L'anello obiettivo si chiude a 25:00", value: 1500, format: fmtTime,
    accent: "#22D3EE", accent2: "#C0FF00", Scene: RingGoalScene, hideValue: true },
  { id: "sub40-10k", group: "GARE", category: "BARRIERA", title: "10K SOTTO I 40 MINUTI",
    mechanic: "Il cronometro del gantry si ferma a 39:xx", value: 2400, format: fmtTime,
    accent: "#C0FF00", accent2: "#22D3EE", Scene: GantryScene, hideValue: true },
  { id: "two-month-pr", group: "GARE", category: "PROGRESSO", title: "CRESCITA COSTANTE",
    mechanic: "PB su 5k o 10k due mesi di fila", value: 2, format: fmtInt("mesi"),
    accent: "#C0FF00", accent2: "#10B981", Scene: GrowthScene, hideValue: true },
  { id: "podium", group: "GARE", category: "CLASSIFICA", title: "PODIO PERSONALE",
    mechanic: "Le tue 3 migliori 5K tutte sotto i 21:00", value: 1260, format: fmtTime,
    accent: "#F59E0B", accent2: "#C0FF00", Scene: PodiumScene, hideValue: true },
  { id: "sub90-half", group: "GARE", category: "BARRIERA", title: "MEZZA SOTTO 1H30",
    mechanic: "Il pendolo si ferma su 1:30:00", value: 5400, format: fmtTime,
    accent: "#A78BFA", accent2: "#C0FF00", Scene: MetronomeGateScene, hideValue: true },
  { id: "races-3-month", group: "GARE", category: "MESE DI PROVE", title: "TRIS DI PROVE",
    mechanic: "Tre prove cronometrate nello stesso mese", value: 3, format: fmtInt("prove"),
    accent: "#C0FF00", accent2: "#F59E0B", Scene: TripleBibScene, hideValue: true },
  { id: "races-10", group: "GARE", category: "MILESTONE", title: "10 PROVE CRONOMETRATE",
    mechanic: "Dieci corse ≥5 km sotto i 4:30/km", value: 10, format: fmtInt("prove"),
    accent: "#22D3EE", accent2: "#C0FF00", Scene: BibStackScene, hideValue: true },
];

export const CELEBRATION_GROUPS: CelebrationGroup[] = [
  "CLASSICI", "VOLUME", "VELOCITÀ", "FISIOLOGIA", "SALITE", "COSTANZA", "GARE",
];
