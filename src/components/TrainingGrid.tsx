import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Sparkles, Zap, AlertTriangle, CheckCircle2, Info, Timer, XCircle, CalendarDays, Target, BookOpen, ChevronDown, Gauge } from "lucide-react";
import { useApi, invalidateCache } from "../hooks/useApi";
import { API_CACHE } from "../hooks/apiCacheKeys";
import { getRuns } from "../api";
import type { RunsResponse } from "../types/api";
import { evaluatePlan } from "../utils/trainingAdherence";
import { SessionVerdict, AdherenceStrip } from "./TrainingAdherence";
import {
  getTrainingPlan, generateTrainingPlan, adaptTrainingPlan, evaluateTest,
  getSub20Status, putSub20Status, putSub20Window, putSub20Goal, putSub20Vdot,
  type Sub20StatusResponse, type Sub20SessionStatus,
} from "../api";
import type { Session, TrainingPlanResponse, AdaptAdaptation } from "../types/api";
import { EVIDENCE, type EvidenceKey } from "../data/kikkoEvidence";
import {
  KIKKO_SUB20_LEGEND, KIKKO_SUB20_DEFAULT_START,
  buildKikkoSub20Sessions, kikkoSub20RaceDate, kikkoSub20NormalizeStart,
  kikkoSub20HeatInfo, heatTable, heatReferenceLabel,
  kikkoGoalOdds, KIKKO_SUB20_TARGETS, KIKKO_SUB20_PLAN, kikkoWindow, addDays,
  kikkoVdotOptions, kikkoPlausibleGain, KIKKO_VDOT_MAX_GAIN, type KikkoVdotChoice,
} from "../data/kikkoSub20Plan";
import {
  KIKKO_SUB135_LEGEND, KIKKO_SUB135_DEFAULT_START, KIKKO_SUB135_META,
  buildKikkoSub135Sessions, kikkoSub135RaceDate, kikkoSub135HeatInfo,
  KIKKO_SUB135_TARGETS, KIKKO_SUB135_PLAN,
} from "../data/kikkoSub135Plan";

/**
 * Quale dei due piani kikko è acceso.
 *
 * "off" torna al piano generato dal backend. I due piani non convivono: sono
 * due risposte alla stessa domenica, e mostrarle insieme vorrebbe dire far
 * scegliere all'atleta il target ogni mattina.
 */
type KikkoPlanId = "off" | "sub20" | "sub135";

/**
 * La finestra del piano: quando comincio e quando corro.
 *
 * Le due date NON si legano fra loro. Se la gara è fra sei settimane il piano
 * ne corre sei — le ultime sei, quelle col picco e il taper — invece di
 * spostarti la gara a dodici settimane da oggi. La durata la decide l'atleta,
 * non il software.
 */
interface Window { start: string; race: string }

/** Verde finché l'aria non conta, ambra quando inizia a costare, rosso oltre. */
const HEAT_COLOR: Record<string, string> = {
  b0: "#22D3EE", b1: "#A3E635", b2: "#C0FF00",
  b3: "#F59E0B", b4: "#F97316", b5: "#EF4444", b6: "#EF4444",
};

/**
 * Perché il target di oggi non è quello di riferimento.
 *
 * Non è la temperatura da sola: è l'indice T + DP (temperatura + punto di
 * rugiada, entrambi in °C — il Garmin dà il DP nei dati meteo della sessione).
 * A parità di gradi l'aria umida non lascia evaporare il sudore, e il ritmo
 * paga. La tabella sta accanto alla seduta, non sepolta nella descrizione.
 */
function HeatPanel({
  date, startDate, raceDate, plan, vdot,
}: {
  date: string; startDate: string; raceDate: string;
  plan: KikkoPlanId; vdot: KikkoVdotChoice | null;
}) {
  const info = plan === "sub135"
    ? kikkoSub135HeatInfo(date, startDate, raceDate, vdot)
    : kikkoSub20HeatInfo(date, startDate, raceDate, vdot);
  const { kind, baseSec } = info;
  const col = HEAT_COLOR[info.band.id] ?? "#A3E635";
  // La tabella usa la base di QUELLA settimana: il VDOT sale lungo il piano,
  // quindi le stesse fasce danno ritmi diversi a luglio e a settembre.
  const rows = kind && baseSec != null ? heatTable(kind, baseSec) : [];
  const mono = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div className="mb-6 rounded-xl border overflow-hidden" style={{ borderColor: `${col}44`, background: `${col}0d` }}>
      <div className="px-3.5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: col }}>
          Indice T + DP {info.index}
        </span>
        <span className="text-[11px] text-gray-400" style={mono}>
          ~{info.tempC}°C + DP {info.dpC}° · fascia {info.band.label}
          {info.pace && ` · penalità ${info.pace.penLabel}`}
        </span>
        {info.pace && info.base && (
          <span className="text-[11px] text-gray-400" style={mono}>
            base {info.base} → <span className="font-bold" style={{ color: col }}>{info.pace.range}</span>
          </span>
        )}
        {info.vdot != null && (
          <span className="text-[11px] text-gray-500" style={mono}>VDOT {info.vdot.toFixed(1)}</span>
        )}
        {info.band.skip && (
          <span className="text-[11px] font-bold text-[#EF4444] basis-full">
            Oltre 59: seduta da spostare all'alba o da rimandare.
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto border-t" style={{ borderColor: `${col}22` }}>
          <table className="w-full text-[11px]" style={mono}>
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-bold px-3.5 py-1.5">Esempio</th>
                <th className="text-left font-bold px-2 py-1.5">Penalità</th>
                <th className="text-left font-bold px-2 py-1.5">Passo/km</th>
                <th className="text-left font-bold px-3.5 py-1.5">{heatReferenceLabel(kind!)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const here = r.band.id === info.band.id;
                return (
                  <tr
                    key={r.band.id}
                    className={here ? "text-white font-bold" : "text-gray-500"}
                    style={here ? { background: `${col}1a` } : undefined}
                  >
                    <td className="px-3.5 py-1.5 whitespace-nowrap" style={here ? { color: col } : undefined}>{r.band.example}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.penLabel}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.pace}</td>
                    <td className="px-3.5 py-1.5 whitespace-nowrap">{r.reference}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * SE LA CHIUDI A TARGET, A CHE PUNTO SEI.
 *
 * La domanda dopo una seduta dura non è quanti chilometri hai fatto: è se
 * quella fatica sta portando dove volevi. La percentuale è condizionata —
 * "chiusa al passo prescritto" — e non è una promessa: è la parte della
 * distribuzione che cade sotto il tempo obiettivo, con dentro la variabilità
 * misurata fra gare simili e le settimane che ancora mancano.
 *
 * Sale lungo il piano anche chiudendo sempre al target, e non perché il motore
 * cresca soltanto: perché resta meno ignoto davanti.
 */
function OddsPanel({
  date, vdot, raceIso, targets, distanceKm,
}: {
  date: string;
  vdot: number;
  raceIso: string;
  targets: { label: string; sec: number }[];
  distanceKm: number;
}) {
  const mono = { fontFamily: "'JetBrains Mono', monospace" };
  const odds = targets.map((t) => ({
    ...t,
    o: kikkoGoalOdds({ vdot, distanceKm, targetSec: t.sec, raceIso, sessionIso: date }),
  }));
  if (!odds.length) return null;

  const colorOf = (p: number) =>
    p >= 0.7 ? "#22C55E" : p >= 0.45 ? "#C0FF00" : p >= 0.25 ? "#F59E0B" : "#F43F5E";

  return (
    <div className="mb-6 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-[#2A2A2A]">
        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-400">
          Se la chiudi a target
        </span>
        <span className="ml-2 text-[11px] text-gray-600" style={mono}>
          VDOT {vdot.toFixed(1)} · gara fra {Math.round(odds[0].o.weeksLeft)} settimane
        </span>
      </div>

      <div className="divide-y divide-[#1E1E1E]">
        {odds.map(({ label, o }) => {
          const col = colorOf(o.p);
          return (
            <div key={label} className="px-3.5 py-2.5 flex items-center gap-3">
              <span className="text-[11px] font-bold text-gray-300 w-16 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#1E1E1E] overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round(o.p * 100)}%`, background: col }} />
              </div>
              <span className="text-[15px] font-black tabular-nums w-12 text-right"
                style={{ ...mono, color: col }}>
                {Math.round(o.p * 100)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-3.5 py-2 border-t border-[#2A2A2A] text-[10px] text-gray-600 leading-snug">
        Previsione con l'aria attesa il giorno di gara:{" "}
        <span className="text-gray-400" style={mono}>
          {odds.map((x) => fmtRaceTime(x.o.predictedSec)).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
        </span>
        . La banda tiene conto dell'1,4% di variabilità fra gare simili dello stesso atleta e di
        quanto manca alla gara.
      </div>
    </div>
  );
}

/**
 * Un campo data che si comporta come un calendario.
 *
 * Due correzioni a quello nativo. La prima è l'icona: senza `color-scheme:
 * dark` il browser la disegna quasi nera su fondo nero, e il campo sembra
 * testo morto — la riga sta in index.css e vale per tutta l'app. La seconda è
 * il bersaglio: l'icona nativa è larga sedici pixel, qui il clic apre il
 * calendario da qualunque punto del campo.
 */
function DateField({
  label, value, onChange, title, accent,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  title: string;
  accent?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const open = () => {
    const el = ref.current;
    if (!el) return;
    // showPicker non c'è su tutti i browser: dove manca resta il clic nativo
    try { (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); }
    catch { /* il campo resta comunque digitabile */ }
  };

  return (
    <div
      onClick={open}
      role="presentation"
      title={title}
      className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-2 py-1 cursor-pointer hover:border-white/25 transition-colors"
    >
      <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: accent ?? "#6B7280" }} />
      <span className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-600">{label}</span>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-0 p-0 text-xs font-bold outline-none cursor-pointer"
        style={{ color: accent ?? "#FFFFFF" }}
      />
    </div>
  );
}

/**
 * PERCHÉ QUESTA SEDUTA HA QUESTA FORMA.
 *
 * Non la bibliografia della corsa: proprio i lavori che giustificano la durata
 * della ripetuta, la lunghezza del recupero e il ritmo scritto su quella riga.
 * Sta chiuso di default — chi vuole solo correre non deve leggerlo — ma esiste,
 * perché un piano da cui non puoi discostarti con cognizione è un piano che o
 * segui alla lettera o butti.
 */
function EvidencePanel({ evidence }: { evidence: EvidenceKey }) {
  const [open, setOpen] = useState(false);
  const e = EVIDENCE[evidence];
  if (!e) return null;

  return (
    <div className="mb-6 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black tracking-[0.2em] uppercase text-gray-400">
            Cosa allena
          </span>
          <span className="block text-[12px] text-gray-300 leading-snug mt-0.5">{e.what}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-gray-600 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3">
          <p className="text-[11.5px] text-gray-400 leading-relaxed">{e.why}</p>
          <div className="space-y-2.5">
            {e.studies.map((st) => (
              <div key={st.ref} className="border-l-2 border-[#2A2A2A] pl-3">
                <div className="text-[11px] font-bold text-gray-300 leading-snug">{st.ref}</div>
                <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{st.says}</div>
                {st.caveat && (
                  <div className="text-[10.5px] text-amber-300/70 leading-snug mt-1">⚠ {st.caveat}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "19:59" o "1:34:35" → secondi. Null se non è un tempo. */
function parseGoal(text: string): number | null {
  const parts = text.trim().split(":").map((x) => Number(x));
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const sec = parts.length === 2 ? parts[0] * 60 + parts[1]
    : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : null;
  return sec != null && sec >= 300 && sec <= 6 * 3600 ? sec : null;
}

/** "19:47" o "1:34:12". */
function fmtRaceTime(sec: number): string {
  const t = Math.round(sec);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const SESSION_COLORS: Record<string, string> = {
  easy:      "#8B5CF6",
  recovery:  "#6B7280",
  intervals: "#EF4444",
  tempo:     "#F97316",
  long:      "#10B981",
  rest:      "transparent",
  strength:  "#0EA5E9",   // sky-blue — riposo attivo con forza
};

interface SessionDisplay {
  color: string;
  title: string;
  details: string[];
  completed: boolean;
  description: string;
}

function toDisplay(session: Session | undefined): SessionDisplay | null {
  if (!session) return null;
  // Rest day with strength exercises → show as "strength" day
  if (session.type === "rest") {
    const hasStrength = (session.strength_exercises?.length ?? 0) > 0;
    if (!hasStrength) return null;
    return {
      color: SESSION_COLORS.strength,
      title: "Riposo + Forza",
      details: [`${session.strength_exercises!.length} esercizi`],
      completed: session.completed,
      description: "Recupero attivo con sessione di forza e prevenzione.",
    };
  }
  const color = SESSION_COLORS[session.type] ?? "#6B7280";
  const details: string[] = [];
  if (session.target_distance_km) details.push(`${session.target_distance_km} km`);
  if (session.target_pace) details.push(`${session.target_pace}/km`);
  return { color, title: session.title, details, completed: session.completed, description: session.description };
}

/** Data ISO → "mar 14 lug" (locale IT), senza sfasamenti di fuso. */
function fmtItShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

// ─── Generate Plan Modal ─────────────────────────────────────────────────────

// ─── Adapt Plan Modal ─────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20"    },
  warning:  { icon: AlertTriangle, color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20"  },
  info:     { icon: Info,          color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
};

function AdaptPlanModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<AdaptAdaptation[] | null>(null);
  const [summary, setSummary]   = useState<{ weeks: number; sessions: number; triggered: number } | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const handleAdapt = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adaptTrainingPlan();
      if (res.message) {
        setError(res.message);
      } else {
        // Plan changed → invalidate plan + current week
        invalidateCache(API_CACHE.TRAINING_PLAN);
        invalidateCache(API_CACHE.TRAINING_CURRENT_WEEK);
        setResult(res.adaptations);
        setSummary({ weeks: res.weeks_modified, sessions: res.sessions_modified, triggered: res.triggered_count });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore nell'adattamento del piano.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="p-6 border-b border-[#2A2A2A] shrink-0">
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Adatta Piano
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Gestisce gli <strong>"Allarmi"</strong>: serve per le decisioni più pesanti (ridurre i chilometri, cambiare la struttura della settimana, gestire gli infortuni).
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result && !loading && (
            <div className="space-y-3">
              {[
                { icon: "⚡", label: "ACWR (Prevenzione Infortuni)", desc: "Calcola il rapporto tra il carico di questa settimana e quello delle ultime 4. Se hai esagerato troppo in fretta, riduce il volume per proteggerti." },
                { icon: "📊", label: "TSB (Forma vs Fatica)",        desc: "Controlla se sei troppo stanco. Se la 'Freshness' è troppo bassa, trasforma una sessione dura in una di recupero." },
                { icon: "🎯", label: "VDOT Drift (Correzione Ritmo)", desc: "Se sei più veloce o lento del previsto, ricalcola tutti i tuoi passi (Easy, Threshold, Interval) per il futuro." },
                { icon: "✅", label: "Compliance (Costanza)",       desc: "Se hai saltato troppi allenamenti negli ultimi 14 giorni, il piano si ammorbidisce per farti riprendere senza stress." },
                { icon: "🏁", label: "Taper (Scarico Pre-Gara)",     desc: "A meno di 14 giorni dalla gara, riduce i chilometri per farti arrivare al via con gambe fresche e cariche." },
              ].map(m => (
                <div key={m.label} className="flex items-start gap-3 p-3 rounded-lg backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] bg-gradient-to-br from-white/[0.05] to-black/40">
                  <span className="text-lg">{m.icon}</span>
                  <div>
                    <span className="text-sm font-bold text-gray-200">{m.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Analisi in corso…</p>
            </div>
          )}

          {result && summary && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex gap-3 mb-2">
                <div className="flex-1 rounded-lg backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] bg-gradient-to-br from-white/[0.05] to-black/40 p-3 text-center">
                  <div className="text-xl font-bold text-amber-400">{summary.triggered}</div>
                  <div className="text-xs text-gray-500">modelli attivati</div>
                </div>
                <div className="flex-1 rounded-lg backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] bg-gradient-to-br from-white/[0.05] to-black/40 p-3 text-center">
                  <div className="text-xl font-bold text-white">{summary.weeks}</div>
                  <div className="text-xs text-gray-500">settimane modificate</div>
                </div>
                <div className="flex-1 rounded-lg backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] bg-gradient-to-br from-white/[0.05] to-black/40 p-3 text-center">
                  <div className="text-xl font-bold text-white">{summary.sessions}</div>
                  <div className="text-xs text-gray-500">sessioni aggiornate</div>
                </div>
              </div>

              {/* Adaptation cards */}
              {result.map((a, i) => {
                const cfg = SEVERITY_CONFIG[a.severity] ?? SEVERITY_CONFIG.info;
                const Icon = a.triggered ? cfg.icon : CheckCircle2;
                return (
                  <div key={i} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${a.triggered ? cfg.color : "text-[#10B981]"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{a.model_name}</span>
                          {a.triggered && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              a.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                              a.severity === 'warning'  ? 'bg-amber-500/20 text-amber-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>attivato</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{a.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <Info className="w-4 h-4 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#2A2A2A] shrink-0 flex gap-3">
          <button
            type="button"
            onClick={() => { onClose(); if (result) onDone(); }}
            className="flex-1 py-3 rounded-lg bg-[#121212] border border-[#2A2A2A] text-gray-400 hover:text-white transition-colors text-sm font-medium"
          >
            {result ? "Chiudi" : "Annulla"}
          </button>
          {!result && !loading && (
            <button
              type="button"
              onClick={handleAdapt}
              className="flex-1 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Analizza e Adatta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Evaluate Test Modal ─────────────────────────────────────────────────────

function EvaluateTestModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    test_vdot: number;
    test_pace: string;
    previous_plan_vdot: number;
    new_target_vdot: number;
    vdot_change: number;
    direction: string;
    confidence: number;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testDistance, setTestDistance] = useState("3");
  const [testTime, setTestTime] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().split("T")[0]);

  const handleEvaluate = async () => {
    if (!testDistance || !testTime) {
      setError("Inserisci distanza e tempo del test.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await evaluateTest({
        test_distance_km: parseFloat(testDistance),
        test_time: testTime.trim(),
        test_date: testDate,
      });
      setResult(res as unknown as typeof result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore nella valutazione del test.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#2A2A2A] shrink-0">
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <Timer className="w-5 h-5 text-purple-400" />
            Test di Valutazione
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Esegui un test (minimo 3km) per ricalibrare il piano. Il nuovo VDOT verrà usato per adattare le sessioni future.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result && !loading && (
            <div className="space-y-5">
              {/* Test Distance */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Distanza Test (km)</label>
                <div className="grid grid-cols-4 gap-2">
                  {["3", "5", "10"].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTestDistance(d)}
                      className={`py-2.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                        testDistance === d
                          ? "bg-purple-500 border-purple-500 text-white"
                          : "bg-[#121212] border-[#2A2A2A] text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {d} km
                    </button>
                  ))}
                  <input
                    type="number"
                    value={testDistance}
                    onChange={e => setTestDistance(e.target.value)}
                    placeholder="Custom"
                    className="bg-[#121212] border border-[#2A2A2A] rounded-lg px-2 py-2 text-white text-xs font-mono placeholder:text-gray-600 focus:border-purple-500 focus:outline-none text-center"
                  />
                </div>
              </div>

              {/* Test Time */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
                  Tempo del Test
                </label>
                <input
                  type="text"
                  value={testTime}
                  onChange={e => setTestTime(e.target.value)}
                  placeholder="es. 14:30"
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white text-lg font-mono placeholder:text-gray-600 focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Test Date */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
                  Data del Test
                </label>
                <input
                  type="date"
                  value={testDate}
                  onChange={e => setTestDate(e.target.value)}
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Info box */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <p className="text-[11px] text-purple-300 leading-relaxed">
                  <span className="font-bold">Base scientifica:</span> Daniels (2013) — il VDOT da time trial è il metodo più accurato per stimare la forma attuale. Test ≥ 3km per affidabilità.
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Valutazione in corso…</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* VDOT comparison */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4 text-center">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">VDOT Precedente</div>
                  <div className="text-2xl font-bold text-gray-400">{result.previous_plan_vdot}</div>
                </div>
                <div className="rounded-xl backdrop-blur-2xl border border-purple-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4 text-center">
                  <div className="text-[10px] text-purple-400 uppercase mb-1">VDOT Test</div>
                  <div className="text-2xl font-bold text-purple-400">{result.test_vdot}</div>
                  <div className="text-[10px] text-gray-500 mt-1">Passo: {result.test_pace}/km</div>
                </div>
                <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4 text-center">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">Nuovo Target</div>
                  <div className="text-2xl font-bold text-white">{result.new_target_vdot}</div>
                </div>
              </div>

              {/* Direction indicator */}
              <div className={`rounded-xl border p-4 ${
                result.direction === "improved"
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : result.direction === "declined"
                  ? "bg-red-500/10 border-red-500/20"
                  : "bg-blue-500/10 border-blue-500/20"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.direction === "improved" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : result.direction === "declined" ? (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-400" />
                  )}
                  <span className={`text-sm font-bold ${
                    result.direction === "improved" ? "text-emerald-400" :
                    result.direction === "declined" ? "text-red-400" : "text-blue-400"
                  }`}>
                    {result.direction === "improved" ? "Miglioramento!" :
                     result.direction === "declined" ? "Leggero calo" : "Stabile"}
                  </span>
                  <span className="text-sm text-gray-400">
                    {result.vdot_change > 0 ? "+" : ""}{result.vdot_change} VDOT
                  </span>
                </div>
                <p className="text-xs text-gray-400">{result.message}</p>
              </div>

              {/* Confidence */}
              <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">Confidenza nel piano</span>
                  <span className="text-sm font-bold text-purple-400">{result.confidence}%</span>
                </div>
                <div className="w-full h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all"
                    style={{ width: `${result.confidence}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <Info className="w-4 h-4 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#2A2A2A] shrink-0 flex gap-3">
          <button
            type="button"
            onClick={() => { onClose(); if (result) onDone(); }}
            className="flex-1 py-3 rounded-lg bg-[#121212] border border-[#2A2A2A] text-gray-400 hover:text-white transition-colors text-sm font-medium"
          >
            {result ? "Chiudi" : "Annulla"}
          </button>
          {!result && !loading && (
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={loading}
              className="flex-1 py-3 rounded-lg bg-purple-500 hover:bg-purple-400 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Timer className="w-4 h-4" />
              Valuta e Ricalibra
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Generate Plan Modal ─────────────────────────────────────────────────────

interface GenerateResult {
  current_vdot: number;
  target_vdot: number;
  weeks_generated: number;
  dry_run?: boolean;
  peak_vdot?: number;
  peak_date?: string;
  peak_source?: {
    date?: string;
    name?: string;
    distance_km?: number;
    duration_minutes?: number;
    avg_pace?: string;
    avg_hr?: number | null;
    strava_id?: string | number;
  } | null;
  training_months?: number;
  weekly_volume?: number;
  history_context?: {
    days_since_last_run: number;
    longest_stop_days_6m: number;
    weekly_volume_4w: number;
    weekly_volume_8w: number;
    recent_peak_weekly_km: number;
    quality_sessions_8w: number;
    interval_sessions_8w: number;
    tempo_sessions_8w: number;
    long_runs_8w: number;
    easy_ratio_8w: number;
    aerobic_base_score: number;
    readiness_score: number;
    training_status: string;
    load: { ctl: number; atl: number; tsb: number };
  };
  test_vdot?: number | null;
  plan_mode?: PlanMode | null;
  strategy_options?: StrategyOption[];
  start_weekly_km?: number;
  peak_weekly_km?: number;
  recent_weekly_km?: number;
  climate?: {
    city: string;
    months: { month: number; label: string; temp_c: number; heat_adj_sec: number }[];
    race_month_label: string;
    race_temp_c: number;
    race_heat_adj_sec: number;
  };
  race_predictions_expected?: Record<string, string>;
  feasibility: {
    feasible: boolean;
    difficulty: string;
    message: string;
    confidence_pct: number;
    is_recovery?: boolean;
    conservative_vdot?: number;
    conservative_time?: string;
    conservative_rate?: number;
    optimistic_vdot?: number;
    optimistic_time?: string;
    optimistic_rate?: number;
    original_target_time?: string;
    suggested_weeks?: number;
    suggested_timeframe?: string;
  };
  race_predictions: Record<string, string>;
}

type PlanMode = 'conservative' | 'balanced' | 'aggressive';
type CalibrationMode = 'strava' | '3k' | 'cooper';
interface StrategyOption {
  mode: PlanMode;
  label: string;
  focus: string;
  success_pct: number;
  completion_pct: number;
  weekly_volume_multiplier: number;
  projected_vdot: number;
  note: string;
}

const TIME_PLACEHOLDERS: Record<string, string> = {
  "5K": "es. 25:00",
  "10K": "es. 52:00",
  "Half Marathon": "es. 1:55:00",
  "Marathon": "es. 4:10:00",
};

// Basi climatiche selezionabili (devono combaciare con CITY_MONTH_TEMP_C nel backend)
const CLIMATE_CITIES: { id: string; label: string }[] = [
  { id: "roma", label: "Roma (default · usa anche il tuo storico)" },
  { id: "milano", label: "Milano" },
  { id: "torino", label: "Torino" },
  { id: "napoli", label: "Napoli" },
  { id: "bologna", label: "Bologna" },
  { id: "firenze", label: "Firenze" },
  { id: "palermo", label: "Palermo" },
  { id: "cagliari", label: "Cagliari" },
];

type ModalPhase = 'input' | 'calibration' | 'strategy' | 'done';

function GeneratePlanModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<ModalPhase>('input');
  const [goalRace, setGoalRace] = useState("5K");
  const [weeksToRace, setWeeksToRace] = useState(12);
  const [targetTime, setTargetTime] = useState("");
  const [startDate, setStartDate] = useState(() => {
    // Default: next Monday
    const today = new Date();
    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>('strava');
  const [testTime, setTestTime] = useState("");
  const [cooperMeters, setCooperMeters] = useState("");
  // Km/settimana di partenza (vuoto = auto dal volume recente) + base climatica
  const [startKm, setStartKm] = useState("");
  const [climateCity, setClimateCity] = useState("roma");

  const validateGoal = () => {
    if (!targetTime.trim()) {
      setError("Inserisci il tempo obiettivo (mm:ss o h:mm:ss).");
      return false;
    }
    setError(null);
    return true;
  };

  const testPayload = () => {
    if (calibrationMode === '3k' && testTime.trim()) {
      return { test_distance_km: 3, test_time: testTime.trim() };
    }
    if (calibrationMode === 'cooper' && cooperMeters.trim()) {
      const meters = Number(cooperMeters.replace(",", "."));
      if (Number.isFinite(meters) && meters > 0) {
        return { test_distance_km: meters / 1000, test_time: "12:00" };
      }
    }
    return {};
  };

  const baseParams = () => {
    const km = Number(startKm.replace(",", "."));
    return {
      goal_race: goalRace,
      weeks_to_race: weeksToRace,
      target_time: targetTime.trim(),
      start_date: startDate,
      city: climateCity,
      ...(startKm.trim() && Number.isFinite(km) && km > 0 ? { start_weekly_km: km } : {}),
      ...testPayload(),
    };
  };

  const handleAnalyze = async () => {
    if (!validateGoal()) return;
    if (calibrationMode === '3k' && !testTime.trim()) {
      setError("Inserisci il tempo del test 3 km oppure scegli Solo Strava.");
      return;
    }
    if (calibrationMode === 'cooper' && !cooperMeters.trim()) {
      setError("Inserisci i metri del Cooper oppure scegli Solo Strava.");
      return;
    }
    if (calibrationMode === 'cooper') {
      const meters = Number(cooperMeters.replace(",", "."));
      if (!Number.isFinite(meters) || meters <= 0) {
        setError("Inserisci una distanza Cooper valida in metri.");
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await generateTrainingPlan({ ...baseParams(), dry_run: true });
      const analysis = res as unknown as GenerateResult;
      setResult(analysis);
      if (analysis.weeks_generated > 0 && analysis.dry_run === false) {
        setPhase('done');
        return;
      }
      if (!analysis.strategy_options?.length) {
        const generated = await generateTrainingPlan({ ...baseParams(), plan_mode: 'balanced' });
        setResult(generated as unknown as GenerateResult);
        setPhase('done');
        return;
      }
      setPhase('strategy');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore nell'analisi del piano.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (mode: PlanMode) => {
    if (!validateGoal()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateTrainingPlan({ ...baseParams(), plan_mode: mode });
      // New plan → invalidate plan + current week
      invalidateCache(API_CACHE.TRAINING_PLAN);
      invalidateCache(API_CACHE.TRAINING_CURRENT_WEEK);
      setResult(res as unknown as GenerateResult);
      setPhase('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore nella generazione del piano.");
    } finally {
      setLoading(false);
    }
  };

  const feasColor = result?.feasibility.difficulty === "already_there" ? "text-[#10B981]"
    : result?.feasibility.difficulty === "realistic" ? "text-[#3B82F6]"
    : result?.feasibility.difficulty === "challenging" ? "text-amber-400"
    : "text-red-400";
  const strategyOptions = result?.strategy_options ?? [];
  const defaultStrategy = strategyOptions.find(option => option.mode === 'balanced') ?? strategyOptions[0];
  const selectedStrategy = result?.plan_mode
    ? strategyOptions.find(option => option.mode === result.plan_mode)
    : undefined;
  const selectedSuccessPct = selectedStrategy?.success_pct ?? result?.feasibility.confidence_pct ?? 0;
  const selectedCompletionPct = selectedStrategy?.completion_pct;
  const selectedColor = selectedSuccessPct >= 80 ? "text-[#10B981]"
    : selectedSuccessPct >= 60 ? "text-[#C0FF00]"
    : selectedSuccessPct >= 45 ? "text-amber-400"
    : "text-red-400";
  const peakSource = result?.peak_source;
  const peakDetails = peakSource
    ? [
        peakSource.name,
        peakSource.distance_km ? `${Number(peakSource.distance_km).toFixed(2)} km` : null,
        peakSource.avg_pace ? `${peakSource.avg_pace}/km` : null,
      ].filter(Boolean).join(" - ")
    : "";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#2A2A2A] shrink-0">
          <h2 className="text-xl font-bold text-white mb-1">
            Genera Piano di Allenamento
          </h2>
          <p className="text-gray-500 text-sm mb-3">
            Obiettivo, calibrazione e strategia prima di creare il piano.
          </p>
          {phase === 'input' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-[11px] text-blue-300 leading-relaxed">
                <span className="font-bold uppercase mr-1">Flusso:</span>
                configura l'obiettivo, calibra il VDOT con test opzionale, scegli il profilo di allenamento.
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── PHASE: INPUT ── */}
          {phase === 'input' && (
            <>
              {/* Goal Race */}
              <div className="mb-5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Obiettivo Gara</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["5K", "10K", "Half Marathon", "Marathon"] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => { setGoalRace(g); setTargetTime(""); }}
                      className={`py-2.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                        goalRace === g
                          ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                          : "bg-[#121212] border-[#2A2A2A] text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Time */}
              <div className="mb-5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
                  Tempo Obiettivo
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={targetTime}
                    onChange={e => setTargetTime(e.target.value)}
                    placeholder={TIME_PLACEHOLDERS[goalRace] || "mm:ss"}
                    className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white text-lg font-mono placeholder:text-gray-600 focus:border-[#3B82F6] focus:outline-none transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                    {goalRace === "Marathon" || goalRace === "Half Marathon" ? "h:mm:ss" : "mm:ss"}
                  </span>
                </div>
              </div>

              {/* Weeks slider */}
              <div className="mb-5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
                  Settimane alla gara: <span className="text-white font-bold">{weeksToRace}</span>
                </label>
                <input
                  type="range" min={8} max={24} step={1}
                  value={weeksToRace}
                  onChange={e => setWeeksToRace(Number(e.target.value))}
                  className="w-full accent-[#3B82F6]"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>8 sett.</span>
                  <span>24 sett.</span>
                </div>
              </div>

              {/* Start Date */}
              <div className="mb-5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
                  Data di inizio piano
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:border-[#3B82F6] focus:outline-none transition-colors [color-scheme:dark]"
                />
                <p className="text-[11px] text-gray-600 mt-1.5">
                  Di default: prossimo lunedì. Puoi scegliere qualsiasi giorno.
                </p>
              </div>

              {/* Starting weekly km (regola del 10%) */}
              <div className="mb-5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
                  Km/settimana di partenza
                </label>
                <input
                  type="number"
                  min={8}
                  step={1}
                  value={startKm}
                  onChange={e => setStartKm(e.target.value)}
                  placeholder="auto — dal tuo volume recente"
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white text-lg font-mono placeholder:text-gray-600 focus:border-[#3B82F6] focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-gray-600 mt-1.5">
                  Lascia vuoto per partire dal volume delle tue ultime settimane. Il piano
                  cresce al massimo del <span className="text-gray-400 font-bold">10% a settimana</span> (regola del 10%).
                </p>
              </div>

              {/* Climate base city */}
              <div className="mb-5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
                  Località · base climatica
                </label>
                <select
                  value={climateCity}
                  onChange={e => setClimateCity(e.target.value)}
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:border-[#3B82F6] focus:outline-none transition-colors [color-scheme:dark]"
                >
                  {CLIMATE_CITIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-600 mt-1.5">
                  I ritmi delle sedute si adattano alla temperatura attesa mese per mese
                  (es. a luglio le ripetute sono più lente che a dicembre, a parità di forma).
                </p>
              </div>
            </>
          )}

          {/* ── PHASE: CALIBRATION ── */}
          {phase === 'calibration' && (
            <div className="space-y-5">
              <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Calibrazione VDOT</div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Per un piano piu preciso puoi inserire un test massimale. Se lo salti, il sistema usa lo storico Strava ed e meno certo.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {([
                  { mode: 'strava' as const, title: 'Solo Strava', body: 'Usa le corse recenti. Piu rapido, meno preciso.' },
                  { mode: '3k' as const, title: 'Test 3 km', body: 'Tempo sui 3.000 metri come anchor test.' },
                  { mode: 'cooper' as const, title: 'Cooper 12 min', body: 'Metri percorsi in 12 minuti.' },
                ]).map((card) => (
                  <button
                    key={card.mode}
                    type="button"
                    onClick={() => setCalibrationMode(card.mode)}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      calibrationMode === card.mode
                        ? 'bg-[#3B82F6]/10 border-[#3B82F6] text-white'
                        : 'bg-[#121212] border-[#2A2A2A] text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm font-bold mb-1">{card.title}</div>
                    <div className="text-xs leading-relaxed">{card.body}</div>
                  </button>
                ))}
              </div>

              {calibrationMode === '3k' && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Tempo test 3 km</label>
                  <input
                    type="text"
                    value={testTime}
                    onChange={e => setTestTime(e.target.value)}
                    placeholder="es. 12:45"
                    className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white text-lg font-mono placeholder:text-gray-600 focus:border-[#3B82F6] focus:outline-none"
                  />
                </div>
              )}

              {calibrationMode === 'cooper' && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Metri percorsi in 12 minuti</label>
                  <input
                    type="number"
                    value={cooperMeters}
                    onChange={e => setCooperMeters(e.target.value)}
                    placeholder="es. 2850"
                    className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white text-lg font-mono placeholder:text-gray-600 focus:border-[#3B82F6] focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── PHASE: STRATEGY ── */}
          {phase === 'strategy' && result && (
            <div className="space-y-5">
              <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Scegli una strategia
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  L'analisi e pronta: ora scegli un profilo oppure usa il piano bilanciato consigliato.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">VDOT attuale</div>
                  <div className="text-2xl font-bold text-white">{result.current_vdot}</div>
                  <div className="text-[9px] text-gray-600 mt-1">temp. ideale · solo corse ≥5 km</div>
                  {result.test_vdot && <div className="text-[10px] text-[#C0FF00] mt-1">da anchor test</div>}
                </div>
                <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">VDOT obiettivo</div>
                  <div className="text-2xl font-bold text-[#3B82F6]">{result.target_vdot}</div>
                </div>
                <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Gap</div>
                  <div className={`text-2xl font-bold ${feasColor}`}>+{Math.max(0, result.target_vdot - result.current_vdot).toFixed(1)}</div>
                </div>
              </div>

              {/* Volume + clima del piano */}
              <div className="grid grid-cols-2 gap-3">
                {result.start_weekly_km != null && (
                  <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Volume settimanale</div>
                    <div className="text-lg font-bold text-white">
                      {result.start_weekly_km} <span className="text-xs text-gray-500 font-normal">km/sett →</span> {result.peak_weekly_km} <span className="text-xs text-gray-500 font-normal">km picco</span>
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">
                      recente: {result.recent_weekly_km ?? "—"} km/sett · crescita ≤10%/settimana
                    </div>
                  </div>
                )}
                {result.climate && (
                  <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                      Clima · {result.climate.city.charAt(0).toUpperCase() + result.climate.city.slice(1)}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {result.climate.months.slice(0, 4).map(m => (
                        <span key={m.month} className={`text-[10px] px-2 py-0.5 rounded-full border ${m.heat_adj_sec >= 4 ? "text-amber-300 border-amber-500/30 bg-amber-500/10" : "text-gray-400 border-[#2A2A2A]"}`}>
                          {m.label.slice(0, 3)} {Math.round(m.temp_c)}°{m.heat_adj_sec >= 4 ? ` +${m.heat_adj_sec}s/km` : ""}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1.5">ritmi già adattati al caldo atteso</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {strategyOptions.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => handleGenerate(option.mode)}
                    disabled={loading}
                    className="text-left bg-[#121212] hover:bg-[#171717] border border-[#2A2A2A] hover:border-[#3B82F6]/60 rounded-xl p-4 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">{option.label}</span>
                      <span className="text-lg font-black text-[#C0FF00]">{option.success_pct}%</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-3">{option.focus}</p>
                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="text-gray-500">Successo obiettivo</span><span className="text-white font-bold">{option.success_pct}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Tenuta fisica</span><span className="text-white font-bold">{option.completion_pct}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">VDOT stimato</span><span className="text-white font-bold">{option.projected_vdot}</span></div>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">{option.note}</p>
                    <div className="mt-4 rounded-lg bg-[#3B82F6] px-3 py-2 text-center text-xs font-bold text-white">
                      Genera {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}


          {/* ── PHASE: DONE ── */}
          {phase === 'done' && result && (
            <div className="space-y-4">
              {/* VDOT Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4 text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">VDOT Attuale</div>
                  <div className="text-3xl font-bold text-white">{result.current_vdot}</div>
                  <div className="text-[9px] text-gray-600 mt-0.5">temp. ideale · solo corse ≥5 km</div>
                  {result.test_vdot && <div className="text-[9px] text-[#C0FF00] mt-0.5">calibrato da test</div>}
                </div>
                <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4 text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">VDOT Target</div>
                  <div className="text-3xl font-bold text-[#3B82F6]">{result.target_vdot}</div>
                </div>
              </div>

              {result.history_context && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg p-3">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Stato</div>
                    <div className="text-xs font-bold text-white">{result.history_context.training_status.replaceAll('_', ' ')}</div>
                  </div>
                  <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg p-3">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Stop</div>
                    <div className="text-xs font-bold text-white">{result.history_context.days_since_last_run} gg</div>
                  </div>
                  <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg p-3">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Volume 8 sett.</div>
                    <div className="text-xs font-bold text-white">{result.history_context.weekly_volume_8w} km/w</div>
                  </div>
                  <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg p-3">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Qualita 8 sett.</div>
                    <div className="text-xs font-bold text-white">{result.history_context.quality_sessions_8w}</div>
                  </div>
                </div>
              )}

              {/* Peak context */}
              {result.peak_vdot && result.peak_vdot !== result.current_vdot && (
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2">
                  <span>Picco storico: <strong className="text-[#8B5CF6]">{result.peak_vdot}</strong></span>
                  {result.peak_date && (
                    <span>({new Date(result.peak_date).toLocaleDateString('it', { month: 'short', year: 'numeric' })})</span>
                  )}
                  {peakDetails && <span>- {peakDetails}</span>}
                  {result.feasibility.is_recovery && <span className="text-[#8B5CF6] font-bold">- Recovery Mode</span>}
                </div>
              )}

              {selectedStrategy && (
                <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Strategia scelta</div>
                      <div className="text-lg font-bold text-white">{selectedStrategy.label}</div>
                      <p className="text-xs text-gray-400 mt-1">{selectedStrategy.focus}</p>
                    </div>
                    <div className={`text-3xl font-black ${selectedColor}`}>{selectedStrategy.success_pct}%</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-[#1E1E1E] rounded-lg px-3 py-2">
                      <div className="text-gray-500 uppercase mb-1">Successo obiettivo</div>
                      <div className="text-white font-bold">{selectedStrategy.success_pct}%</div>
                    </div>
                    <div className="bg-[#1E1E1E] rounded-lg px-3 py-2">
                      <div className="text-gray-500 uppercase mb-1">Tenuta fisica</div>
                      <div className="text-white font-bold">{selectedStrategy.completion_pct}%</div>
                    </div>
                    <div className="bg-[#1E1E1E] rounded-lg px-3 py-2">
                      <div className="text-gray-500 uppercase mb-1">VDOT stimato</div>
                      <div className="text-white font-bold">{selectedStrategy.projected_vdot}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">{selectedStrategy.note}</p>
                </div>
              )}

              {/* Gap indicator */}
              <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">Progressione richiesta</span>
                  <span className={`text-sm font-bold ${feasColor}`}>
                    +{Math.max(0, result.target_vdot - result.current_vdot).toFixed(1)} VDOT
                  </span>
                </div>
                <div className="w-full h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981] transition-all"
                    style={{ width: `${Math.min(100, selectedSuccessPct)}%` }}
                  />
                </div>
                <p className={`text-xs mt-2 ${feasColor}`}>{result.feasibility.message}</p>
              </div>

              {/* Volume + clima del piano generato */}
              {(result.start_weekly_km != null || result.climate) && (
                <div className="grid grid-cols-2 gap-3">
                  {result.start_weekly_km != null && (
                    <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Volume settimanale</div>
                      <div className="text-lg font-bold text-white">
                        {result.start_weekly_km} <span className="text-xs text-gray-500 font-normal">km/sett →</span> {result.peak_weekly_km} <span className="text-xs text-gray-500 font-normal">km picco</span>
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1">
                        recente: {result.recent_weekly_km ?? "—"} km/sett · regola del 10%
                      </div>
                    </div>
                  )}
                  {result.climate && (
                    <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                        Clima · {result.climate.city.charAt(0).toUpperCase() + result.climate.city.slice(1)}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {result.climate.months.slice(0, 5).map(m => (
                          <span key={m.month} className={`text-[10px] px-2 py-0.5 rounded-full border ${m.heat_adj_sec >= 4 ? "text-amber-300 border-amber-500/30 bg-amber-500/10" : "text-gray-400 border-[#2A2A2A]"}`}>
                            {m.label.slice(0, 3)} {Math.round(m.temp_c)}°{m.heat_adj_sec >= 4 ? ` +${m.heat_adj_sec}s/km` : ""}
                          </span>
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1.5">ritmi delle sedute già adattati al caldo</div>
                    </div>
                  )}
                </div>
              )}

              {/* Race predictions: ideale vs caldo atteso */}
              {Object.keys(result.race_predictions).length > 0 && (
                <div className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Previsioni a VDOT {result.target_vdot}
                    </div>
                    {result.climate && result.climate.race_heat_adj_sec >= 4 && (
                      <span className="text-[10px] text-amber-300">
                        gara a {result.climate.race_month_label}: ~{Math.round(result.climate.race_temp_c)}°C
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(result.race_predictions).map(([dist, time]) => {
                      const hot = result.race_predictions_expected?.[dist];
                      const showHot = hot && hot !== time;
                      return (
                        <div key={dist} className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                          dist === goalRace ? 'bg-[#3B82F6]/10 border border-[#3B82F6]/30' : 'bg-[#1E1E1E]'
                        }`}>
                          <span className="text-xs text-gray-400">{dist}</span>
                          <span className="flex items-baseline gap-2.5">
                            <span className={`text-sm font-mono font-bold ${dist === goalRace ? 'text-[#3B82F6]' : 'text-white'}`}>
                              {time}
                            </span>
                            {showHot && (
                              <span className="text-[11px] font-mono text-amber-300" title="previsione al caldo atteso">
                                ☀️ {hot}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {result.climate && result.climate.race_heat_adj_sec >= 4 && (
                    <p className="text-[10px] text-gray-600 mt-2">
                      Bianco: temperatura ideale (≤15°C). ☀️ Ambra: al caldo atteso (+{result.climate.race_heat_adj_sec} s/km).
                    </p>
                  )}
                </div>
              )}

              {/* Success probability when infeasible */}
              {!result.feasibility.feasible && !selectedStrategy && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-bold text-red-400">Obiettivo ambizioso</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{result.feasibility.message}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-500 uppercase mb-1">Probabilità di successo</div>
                      <div className="text-2xl font-bold text-red-400">{result.feasibility.confidence_pct}%</div>
                    </div>
                    {result.feasibility.suggested_weeks && (
                      <div className="flex-1">
                        <div className="text-[10px] text-gray-500 uppercase mb-1">Tempo consigliato</div>
                        <div className="text-sm font-bold text-white">{result.feasibility.suggested_timeframe ?? `${result.feasibility.suggested_weeks} settimane`}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!result.feasibility.feasible && selectedStrategy && (
                <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-[#3B82F6]" />
                    <span className="text-sm font-bold text-[#3B82F6]">
                      Obiettivo ambizioso, strategia {selectedStrategy.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{result.feasibility.message}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-500 uppercase mb-1">Probabilita piano scelto</div>
                      <div className={`text-2xl font-bold ${selectedColor}`}>{selectedStrategy.success_pct}%</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-500 uppercase mb-1">Tenuta fisica</div>
                      <div className="text-2xl font-bold text-white">{selectedCompletionPct}%</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Plan summary */}
              <div className="flex items-center gap-2 text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-sm">Piano di {result.weeks_generated} settimane generato con successo!</span>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#2A2A2A] shrink-0 flex gap-3">
          <button
            type="button"
            onClick={() => {
              if (phase === 'done') {
                onClose();
                onDone();
              } else if (phase === 'strategy') {
                setPhase('calibration');
              } else if (phase === 'calibration') {
                setPhase('input');
              } else {
                onClose();
              }
            }}
            className="flex-1 py-3 rounded-lg bg-[#121212] border border-[#2A2A2A] text-gray-400 hover:text-white transition-colors text-sm font-medium"
          >
            {phase === 'done' ? 'Chiudi' : phase === 'input' ? 'Annulla' : 'Indietro'}
          </button>
          {phase === 'input' && (
            <button
              type="button"
              onClick={() => { if (validateGoal()) setPhase('calibration'); }}
              disabled={loading}
              className="flex-1 py-3 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Continua
            </button>
          )}
          {phase === 'calibration' && (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading}
              className="flex-1 py-3 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <span>Analizzando...</span> : <><Sparkles className="w-4 h-4" /> Mostra Strategie</>}
            </button>
          )}
          {phase === 'strategy' && (
            <button
              type="button"
              onClick={() => defaultStrategy && handleGenerate(defaultStrategy.mode)}
              disabled={loading || !defaultStrategy}
              className="flex-1 py-3 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <span>Generando...</span> : <><Sparkles className="w-4 h-4" /> Genera Piano Bilanciato</>}
            </button>
          )}
          {phase === 'done' && (
            <button
              type="button"
              onClick={() => { onClose(); onDone(); }}
              className="flex-1 py-3 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              Vedi Piano
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrainingGrid() {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'Day' | 'Week' | 'Month' | 'Year'>('Year');
  /**
   * Giorno aperto a schermo intero. Prima cliccare una seduta portava alla
   * vista "Day", che restava dentro la pagina: header, legenda e diagnosi
   * continuavano a leggersi dietro il pannello semitrasparente. La seduta si
   * apre invece sopra tutto, su fondo pieno, senza niente che filtri.
   */
  const [detailDate, setDetailDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showAdaptModal, setShowAdaptModal] = useState(false);
  /**
   * Piano kikkoSub20 acceso/spento. Prima era `useState(false)` senza setter,
   * quindi tutta la macchina interna (adattamento RPE, esiti sedute, legenda)
   * era irraggiungibile.
   *
   * `showSub20` resta come alias perché quella macchina è nata per il piano
   * Sub-20 e viene riusata identica: rinominare venti riferimenti non
   * cambierebbe nulla di sostanziale.
   */
  // Acceso all'apertura su kikkoSub20: entrando in Training si vede subito il
  // calendario sull'anno. I bottoni in header cambiano piano o spengono.
  const [kikkoPlan, setKikkoPlan] = useState<KikkoPlanId>("sub20");
  const showSub20 = kikkoPlan !== "off";

  /**
   * Ogni piano ha la sua partenza, e non è un dettaglio: kikkoSub20 è ancorato
   * al 27 luglio, kikkoSub1:34:35 al 17 agosto. Una sola data condivisa
   * sposterebbe il piano sbagliato ogni volta che si cambia.
   *
   * Sul DB viaggia solo quella di kikkoSub20 — è il campo che esiste. Quella
   * della mezza vive in pagina: il default è già quello giusto e spostarla è
   * un'eccezione, non la regola.
   */
  const [sub20Win, setSub20Win] = useState<Window>({
    start: KIKKO_SUB20_DEFAULT_START,
    race: kikkoSub20RaceDate(KIKKO_SUB20_DEFAULT_START),
  });
  const [sub135Win, setSub135Win] = useState<Window>({
    start: KIKKO_SUB135_DEFAULT_START,
    race: kikkoSub135RaceDate(KIKKO_SUB135_DEFAULT_START),
  });
  const [draft, setDraft] = useState<Window | null>(null);

  const openDay = (date: Date) => setDetailDate(date);
  const closeDay = useCallback(() => setDetailDate(null), []);

  // Esc chiude, e finché il dettaglio è aperto la pagina sotto non scrolla:
  // altrimenti la rotellina muove il calendario dietro invece della seduta.
  useEffect(() => {
    if (!detailDate) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDay(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [detailDate, closeDay]);

  const { data: planData, refetch: refetchPlan } = useApi<TrainingPlanResponse>(getTrainingPlan, { cacheKey: API_CACHE.TRAINING_PLAN });

  // Build date → Session lookup map from all plan weeks
  const sessionMap = useMemo(() => {
    const map: Record<string, Session> = {};
    for (const week of planData?.weeks ?? []) {
      for (const session of week.sessions) {
        if (session.date) map[session.date] = session;
      }
    }
    return map;
  }, [planData]);


  /**
   * Il tempo obiettivo, in secondi, per piano.
   *
   * Vive sul server accanto alla data di partenza — è configurazione del
   * piano, non una preferenza di questo browser — e finché non arriva valgono
   * quelli scritti dentro i piani.
   */
  /**
   * Il VDOT scelto: da dove parti e dove vuoi arrivare, per piano.
   *
   * È l'ingresso che cambia tutti i ritmi del calendario. La partenza dovrebbe
   * uscire da una prova reale — il 3 km a tutta — non da una speranza: se la
   * si mette troppo alta il piano prescrive ritmi che non si reggono, e ogni
   * seduta si chiude "fallita" per un errore di taratura.
   */
  const [vdots, setVdots] = useState<Record<string, KikkoVdotChoice>>({});
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [goalDraft, setGoalDraft] = useState<string | null>(null);

  /** Tutto quello che dipende dal piano acceso, in un posto solo. */
  const activeWin = kikkoPlan === "sub135" ? sub135Win : sub20Win;
  const activeStart = activeWin.start;
  const activeRaceIso = activeWin.race;
  const activePlan = kikkoPlan === "sub135" ? KIKKO_SUB135_PLAN : KIKKO_SUB20_PLAN;
  const activeAccent = kikkoPlan === "sub135" ? "#00FFAA" : "var(--app-accent)";

  /** Il VDOT del piano acceso: quello scelto, o quello scritto nel piano. */
  const activeVdot = vdots[kikkoPlan] ?? null;
  const planVdot = activePlan.weekVdot;
  const shownVdot: KikkoVdotChoice = activeVdot ?? {
    start: planVdot[0],
    target: planVdot[planVdot.length - 1],
  };

  /** Gli obiettivi scritti nel piano, che valgono finché non se ne sceglie uno. */
  const planTargets = kikkoPlan === "sub135" ? KIKKO_SUB135_TARGETS : KIKKO_SUB20_TARGETS;
  const goalSec = goals[kikkoPlan] ?? planTargets[0].sec;

  /**
   * Cosa misura la percentuale: l'obiettivo scelto, più quello di targa del
   * piano se è più ambizioso. Due righe al massimo — la seconda esiste perché
   * kikkoSub20 punta al 19:35 anche quando l'atleta si accontenta della sub-20,
   * e nascondere il tetto verso cui sale il VDOT racconterebbe metà storia.
   */
  const activeTargets = useMemo(() => {
    const chosen = { label: fmtRaceTime(goalSec), sec: goalSec };
    const stretch = planTargets.find((t) => t.sec < goalSec - 1);
    return stretch ? [chosen, stretch] : [chosen];
  }, [goalSec, planTargets]);

  /**
   * La probabilità del giorno, se quel giorno ha una qualità.
   *
   * Sulle lente non compare: un fondo chiuso al passo giusto non dimostra
   * niente sull'obiettivo, e un numero che non si muove mai smette di essere
   * letto.
   */
  const activeOdds = (dayKey: string) => {
    const info = kikkoPlan === "sub135"
      ? kikkoSub135HeatInfo(dayKey, activeStart, activeRaceIso, activeVdot)
      : kikkoSub20HeatInfo(dayKey, activeStart, activeRaceIso, activeVdot);
    const session = sub20Map[dayKey];
    const isQuality = session?.type === "intervals" || session?.type === "tempo";
    if (!isQuality || info.vdot == null) return null;
    return (
      <OddsPanel
        date={dayKey}
        vdot={info.vdot}
        raceIso={activeRaceIso}
        distanceKm={kikkoPlan === "sub135" ? 21.0975 : 5}
        targets={activeTargets}
      />
    );
  };

  /** Le prove dietro la seduta del giorno, se quel giorno c'è una seduta. */
  const activeEvidence = (dayKey: string) => {
    const info = kikkoPlan === "sub135"
      ? kikkoSub135HeatInfo(dayKey, activeStart, activeRaceIso, activeVdot)
      : kikkoSub20HeatInfo(dayKey, activeStart, activeRaceIso, activeVdot);
    return info.evidence ? <EvidencePanel evidence={info.evidence} /> : null;
  };

  /** La bozza dei due calendari: quella applicata quando non si sta modificando. */
  const shownWin = draft ?? activeWin;
  /**
   * Quanto del piano entra nella finestra scelta.
   *
   * Se le settimane bastano il piano ci sta intero; se sono meno si corrono le
   * ULTIME — quelle col picco e il taper — e la pagina lo dice, invece di far
   * finta che il programma sia lo stesso.
   */
  const draftWindow = useMemo(
    () => kikkoWindow(activePlan, shownWin.start, shownWin.race),
    [activePlan, shownWin],
  );
  const dirty = shownWin.start !== activeWin.start || shownWin.race !== activeWin.race;

  /**
   * Quanto salto regge la finestra scelta.
   *
   * Il tetto non è prudenza mia: è il tasso che la letteratura misura su
   * atleti già allenati, e serve a dire subito quando si sta chiedendo al
   * piano più di quanto un piano possa dare.
   */
  const plausibleGain = kikkoPlausibleGain(draftWindow.weeksUsed, shownVdot.start);
  const askedGain = Math.round((shownVdot.target - shownVdot.start) * 10) / 10;


  // Il piano acceso, dentro la sua finestra.
  const sub20Sessions = useMemo(
    () => (kikkoPlan === "sub135"
      ? buildKikkoSub135Sessions(sub135Win.start, sub135Win.race, vdots.sub135 ?? null)
      : buildKikkoSub20Sessions(sub20Win.start, sub20Win.race, vdots.sub20 ?? null)),
    [kikkoPlan, sub20Win, sub135Win, vdots],
  );
  const sub20Map = useMemo(() => {
    const map: Record<string, Session> = {};
    for (const s of sub20Sessions) map[s.date] = s;
    return map;
  }, [sub20Sessions]);

  const getSession = (year: number, month: number, day: number): Session | undefined => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (showSub20) return sub20Map[key];
    return sessionMap[key];
  };

  // ── Aderenza: confronto automatico fra prescrizione e giri realmente corsi.
  // Il verdetto lo dà il sistema; la diagnosi guarda il pattern, non il giorno.
  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const adherence = useMemo(
    () => evaluatePlan(showSub20 ? sub20Sessions : Object.values(sessionMap), runsData?.runs ?? []),
    [sessionMap, sub20Sessions, runsData, showSub20],
  );
  const adherenceByDate = useMemo(
    () => Object.fromEntries(adherence.map((e) => [e.date.slice(0, 10), e])),
    [adherence],
  );

  // ── Esiti sedute Sub-20 (persistenti su DB) ──
  const { data: sub20StatusData } = useApi<Sub20StatusResponse>(getSub20Status, { cacheKey: "sub20-status" });
  const [sub20Status, setSub20StatusLocal] = useState<Record<string, Sub20SessionStatus>>({});
  useEffect(() => {
    if (sub20StatusData?.statuses) setSub20StatusLocal(sub20StatusData.statuses);
    if (sub20StatusData?.goals) setGoals(sub20StatusData.goals);
    if (sub20StatusData?.vdots) setVdots(sub20StatusData.vdots as Record<string, KikkoVdotChoice>);
    // Sul DB può esserci la partenza del vecchio piano Sub-20, che era ancorata
    // a un martedì: senza normalizzare, kikkoSub20 slitta di un giorno e le
    // qualità cadono di mercoledì e venerdì.
    if (sub20StatusData?.start_date || sub20StatusData?.race_date) {
      setSub20Win((prev) => ({
        start: sub20StatusData.start_date
          ? kikkoSub20NormalizeStart(sub20StatusData.start_date)
          : prev.start,
        race: sub20StatusData.race_date
          ? kikkoSub20NormalizeStart(sub20StatusData.race_date)
          : prev.race,
      }));
      setDraft(null);
    }
  }, [sub20StatusData]);

  const keyOf = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const sub20StatusOf = (year: number, month: number, day: number): Sub20SessionStatus | undefined =>
    showSub20 ? sub20Status[keyOf(year, month, day)] : undefined;

  const markSub20 = useCallback(async (date: string, status: Sub20SessionStatus | null) => {
    setSub20StatusLocal((prev) => {
      const next = { ...prev };
      if (status) next[date] = status; else delete next[date];
      return next;
    });
    try {
      const res = await putSub20Status(date, status);
      if (res?.statuses) setSub20StatusLocal(res.statuses);
      invalidateCache("sub20-status");
    } catch {
      /* l'ottimistico resta; ritenta al prossimo click */
    }
  }, []);


  /**
   * "Applica": la finestra in bozza diventa quella del piano.
   *
   * Entrambe le date vengono riportate al lunedì della loro settimana — il
   * piano è ancorato al lunedì, e una partenza di mercoledì farebbe cadere le
   * qualità di giovedì e sabato. Il calendario salta sulla prima settimana
   * davvero corsa, che con una finestra stretta non è quella scelta ma la
   * prima che il piano riesce a farci stare.
   */
  const applyWindow = useCallback(async () => {
    if (!draft) return;
    const win: Window = {
      start: kikkoSub20NormalizeStart(draft.start),
      race: kikkoSub20NormalizeStart(draft.race),
    };
    setDraft(null);

    const w = kikkoWindow(activePlan, win.start, win.race);
    const [y, m, d] = w.firstMonday.split("-").map(Number);
    setCurrentDate(new Date(y, m - 1, d));
    setView("Month");

    // Sul DB c'è una finestra sola, ed è di kikkoSub20: quella della mezza vive
    // in pagina. Salvarci sopra sposterebbe l'altro piano.
    if (kikkoPlan === "sub135") {
      setSub135Win(win);
      return;
    }

    setSub20Win(win);
    try {
      const res = await putSub20Window(win.start, win.race);
      if (res?.start_date && res?.race_date) {
        setSub20Win({
          start: kikkoSub20NormalizeStart(res.start_date),
          race: kikkoSub20NormalizeStart(res.race_date),
        });
      }
      invalidateCache("sub20-status");
    } catch {
      /* l'ottimistico resta */
    }
  }, [draft, kikkoPlan, activePlan]);

  /** Salva il VDOT del piano acceso. La partenza trascina l'obiettivo se lo supera. */
  const saveVdot = useCallback(async (next: KikkoVdotChoice) => {
    const clean: KikkoVdotChoice = {
      start: Math.round(next.start * 10) / 10,
      target: Math.round(Math.min(Math.max(next.target, next.start), next.start + KIKKO_VDOT_MAX_GAIN) * 10) / 10,
    };
    setVdots((prev) => ({ ...prev, [kikkoPlan]: clean }));
    try {
      const res = await putSub20Vdot(kikkoPlan, clean.start, clean.target);
      if (res?.vdots) setVdots(res.vdots as Record<string, KikkoVdotChoice>);
      invalidateCache("sub20-status");
    } catch {
      /* l'ottimistico resta */
    }
  }, [kikkoPlan]);

  /** Salva il tempo obiettivo del piano acceso. Testo non valido: si ignora. */
  const saveGoal = useCallback(async () => {
    if (goalDraft == null) return;
    const sec = parseGoal(goalDraft);
    setGoalDraft(null);
    if (sec == null || sec === goalSec) return;
    setGoals((prev) => ({ ...prev, [kikkoPlan]: sec }));
    try {
      const res = await putSub20Goal(kikkoPlan, sec);
      if (res?.goals) setGoals(res.goals);
      invalidateCache("sub20-status");
    } catch {
      /* l'ottimistico resta; ritenta al prossimo salvataggio */
    }
  }, [goalDraft, goalSec, kikkoPlan]);

  const next = () => {
    const d = new Date(currentDate);
    if (view === 'Month') d.setMonth(d.getMonth() + 1);
    else if (view === 'Week') d.setDate(d.getDate() + 7);
    else if (view === 'Day') d.setDate(d.getDate() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    setCurrentDate(d);
  };

  const prev = () => {
    const d = new Date(currentDate);
    if (view === 'Month') d.setMonth(d.getMonth() - 1);
    else if (view === 'Week') d.setDate(d.getDate() - 7);
    else if (view === 'Day') d.setDate(d.getDate() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    setCurrentDate(d);
  };

  const formatDateDisplay = () => {
    if (view === 'Month') return currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    if (view === 'Year') return currentDate.getFullYear().toString();
    if (view === 'Week') {
      const mon = new Date(currentDate);
      const day = mon.getDay();
      const diff = mon.getDate() - day + (day === 0 ? -6 : 1);
      mon.setDate(diff);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `${mon.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString('it-IT', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('it-IT', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  // ── Month View ──────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    while (days.length % 7 !== 0) days.push(null);

    const weekDays = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

    return (
      <div className="h-full flex flex-col min-h-[600px]">
        <div className="grid grid-cols-7 mb-2">
          {weekDays.map(d => (
            <div key={d} className="text-xs font-semibold text-gray-500 tracking-wider text-center">{d}</div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 gap-px bg-[#2A2A2A] border border-[#2A2A2A] rounded-lg overflow-hidden">
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="bg-[#181818] min-h-[120px]" />;

            const session = getSession(year, month, day);
            const display = toDisplay(session);
            const st = sub20StatusOf(year, month, day);
            const done = st === 'done' || (!showSub20 && display?.completed);
            const failed = st === 'failed';
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

            return (
              <div
                key={`${year}-${month}-${day}`}
                className="bg-[#181818] min-h-[120px] p-2 flex flex-col group hover:bg-[#1E1E1E] transition-colors cursor-pointer"
                onClick={() => openDay(new Date(year, month, day))}
              >
                <span className={`text-sm font-medium mb-2 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-[#3B82F6] text-white' : 'text-gray-400'}`}>
                  {day}
                </span>
                {display && (
                  <div
                    className={`flex-1 rounded-md p-2 border-l-4 bg-[#121212] flex flex-col gap-1 ${done ? 'opacity-60' : ''}`}
                    style={{ borderLeftColor: failed ? '#EF4444' : display.color }}
                  >
                    <span className="text-xs font-bold text-gray-200">{display.title}</span>
                    <span className="text-[10px] text-gray-400 line-clamp-2 leading-tight">{display.details.join(' · ')}</span>
                    {done && <span className="text-[10px] text-[#10B981]">✓ Effettuata</span>}
                    {failed && <span className="text-[10px] text-[#EF4444]">✗ Fallita</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Week View ───────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const mon = new Date(currentDate);
    const day = mon.getDay();
    const diff = mon.getDate() - day + (day === 0 ? -6 : 1);
    mon.setDate(diff);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });

    const dayNames = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

    return (
      <div className="h-full flex flex-col min-h-[600px]">
        <div className="flex-1 grid grid-cols-7 gap-4">
          {weekDays.map(date => {
            const session = getSession(date.getFullYear(), date.getMonth(), date.getDate());
            const display = toDisplay(session);
            const st = sub20StatusOf(date.getFullYear(), date.getMonth(), date.getDate());
            const done = st === 'done' || (!showSub20 && display?.completed);
            const failed = st === 'failed';
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={date.toISOString()}
                className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4 flex flex-col cursor-pointer hover:border-white/[0.2] transition-colors"
                onClick={() => openDay(date)}
              >
                <div className="text-center mb-6 pb-4 border-b border-[#2A2A2A]">
                  <div className="text-xs font-semibold text-gray-500 tracking-wider mb-2">{dayNames[date.getDay()]}</div>
                  <div className={`text-2xl font-bold mx-auto w-10 h-10 flex items-center justify-center rounded-full ${isToday ? 'bg-[#3B82F6] text-white' : 'text-gray-200'}`}>
                    {date.getDate()}
                  </div>
                </div>

                {display ? (
                  <div className={`flex-1 rounded-lg p-4 border-t-4 bg-[#121212] flex flex-col gap-3 ${done ? 'opacity-60' : ''}`} style={{ borderTopColor: failed ? '#EF4444' : display.color }}>
                    <span className="text-sm font-bold text-gray-200 uppercase tracking-wider">{display.title}</span>
                    <div className="flex flex-col gap-2">
                      {display.details.map((d, i) => (
                        <span key={i} className="text-xs text-gray-400 bg-[#1E1E1E] px-2 py-1.5 rounded">{d}</span>
                      ))}
                    </div>
                    {done && <span className="text-xs text-[#10B981] mt-auto">✓ Effettuata</span>}
                    {failed && <span className="text-xs text-[#EF4444] mt-auto">✗ Fallita</span>}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-600 font-medium bg-[#121212] rounded-lg border border-[#2A2A2A] border-dashed">
                    Riposo
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Dettaglio del giorno ────────────────────────────────────────────────────
  // Usato sia dalla vista "Day" sia dal pannello a schermo intero che si apre
  // cliccando una seduta: stesso contenuto, fondo PIENO in entrambi i casi.
  const renderDayDetail = (date: Date, onClose?: () => void) => {
    const session = getSession(date.getFullYear(), date.getMonth(), date.getDate());
    const display = toDisplay(session);
    const dayKey = keyOf(date.getFullYear(), date.getMonth(), date.getDate());
    const st = sub20StatusOf(date.getFullYear(), date.getMonth(), date.getDate());
    const done = st === 'done' || (!showSub20 && display?.completed);
    const failed = st === 'failed';

    return (
      <div className="w-full max-w-2xl mx-auto rounded-2xl border border-white/[0.12] shadow-[0_8px_40px_rgba(0,0,0,0.85)] bg-[#141414] p-8">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 group transition-colors"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Chiudi</span>
            </button>
          )}
          <h2 className="text-3xl font-bold text-white mb-8 text-center capitalize">
            {date.toLocaleDateString('it-IT', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>

          {display ? (
            <div className={`rounded-xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.6)] bg-[#1A1A1A] p-8 border-l-4 ${done ? 'opacity-75' : ''}`} style={{ borderLeftColor: failed ? '#EF4444' : display.color }}>
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#2A2A2A]">
                <h3 className="text-2xl font-bold text-gray-200">{display.title}</h3>
                <span className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                  done
                    ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                    : failed
                    ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                    : 'bg-[#1E1E1E] border-[#2A2A2A] text-gray-300'
                }`}>
                  {done ? '✓ Effettuata' : failed ? '✗ Fallita' : 'Programmata'}
                </span>
              </div>

              {/* Esito AUTOMATICO: confronto prescrizione ↔ giri corsi */}
              {adherenceByDate[dayKey] && (
                <div className="mb-6 pb-6 border-b border-[#2A2A2A]">
                  <SessionVerdict e={adherenceByDate[dayKey]} />
                </div>
              )}

              {/* Esito manuale — solo Sub-20, persistente su DB */}
              {showSub20 && (
                <div className="mb-6 pb-6 border-b border-[#2A2A2A]">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Correzione manuale</div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => markSub20(dayKey, done ? null : 'done')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                        done
                          ? 'bg-[#10B981] border-[#10B981] text-black'
                          : 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/20'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Effettuato
                    </button>
                    <button
                      type="button"
                      onClick={() => markSub20(dayKey, failed ? null : 'failed')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                        failed
                          ? 'bg-[#EF4444] border-[#EF4444] text-white'
                          : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                      }`}
                    >
                      <XCircle className="w-4 h-4" /> Fallito
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-2.5">
                    Salvato sul database, permanente. Ritocca lo stesso pulsante per annullare.
                  </p>
                </div>
              )}


              <p className="text-gray-300 leading-relaxed mb-6">{display.description}</p>

              {showSub20 && (
                <HeatPanel
                  date={dayKey} startDate={activeStart} raceDate={activeRaceIso}
                  plan={kikkoPlan} vdot={activeVdot}
                />
              )}
              {showSub20 && activeOdds(dayKey)}
              {showSub20 && activeEvidence(dayKey)}

              {display.details.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {display.details.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 bg-[#1E1E1E] px-5 py-3 rounded-xl border border-[#2A2A2A]">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: display.color }} />
                      <span className="text-gray-200 text-sm font-medium">{d}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Strength / Prehab Exercises */}
              {session?.strength_exercises && session.strength_exercises.length > 0 && (
                <div className="mt-6 pt-6 border-t border-[#2A2A2A]">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#8B5CF6]/15 flex items-center justify-center text-[#8B5CF6] text-[10px]">💪</span>
                    Forza & Prevenzione
                  </h4>
                  <div className="grid gap-2">
                    {session.strength_exercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between bg-[#1E1E1E] px-4 py-2.5 rounded-lg border border-[#2A2A2A]">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-200 font-medium">{ex.name}</span>
                          {ex.note && <span className="text-[10px] text-gray-600 ml-2">{ex.note}</span>}
                        </div>
                        <span className="text-xs text-gray-500 font-mono ml-3 shrink-0">
                          {ex.sets}×{ex.reps}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            (() => {
              // Rest day — may have strength exercises
              const restSession = session;
              const restExercises = restSession?.strength_exercises ?? [];
              return (
                <div className="bg-[#121212] rounded-xl border border-[#2A2A2A] border-dashed">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-20 h-20 rounded-full bg-[#1E1E1E] flex items-center justify-center mb-6 border border-[#2A2A2A]">
                      <span className="text-4xl">{restExercises.length > 0 ? '💪' : '☕'}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-300">
                      {restExercises.length > 0 ? 'Riposo + Forza' : 'Giorno di Riposo'}
                    </h3>
                    <p className="text-gray-500 mt-2 text-lg">
                      {restExercises.length > 0 ? 'Recupero attivo con sessione di forza e prevenzione.' : 'Recupero e ricarica delle energie.'}
                    </p>
                  </div>

                  {restExercises.length > 0 && (
                    <div className="px-8 pb-8">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-[#8B5CF6]/15 flex items-center justify-center text-[#8B5CF6] text-[10px]">💪</span>
                        Sessione Forza & Prevenzione Infortuni
                      </h4>
                      <div className="grid gap-2">
                        {restExercises.map((ex, i) => (
                          <div key={i} className="flex items-center justify-between bg-[#1E1E1E] px-4 py-2.5 rounded-lg border border-[#2A2A2A]">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-200 font-medium">{ex.name}</span>
                              {ex.note && <span className="text-[10px] text-gray-600 ml-2">{ex.note}</span>}
                            </div>
                            <span className="text-xs text-gray-500 font-mono ml-3 shrink-0">
                              {ex.sets}×{ex.reps}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
      </div>
    );
  };

  const renderDayView = () => (
    <div className="h-full flex items-start justify-center pt-10">
      {renderDayDetail(currentDate)}
    </div>
  );

  // ── Year View ───────────────────────────────────────────────────────────────
  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

    return (
      <div className="grid grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
        {Array.from({ length: 12 }, (_, month) => {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          let firstDay = new Date(year, month, 1).getDay();
          firstDay = firstDay === 0 ? 6 : firstDay - 1;

          const days: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) days.push(null);
          for (let i = 1; i <= daysInMonth; i++) days.push(i);

          return (
            <div
              key={month}
              className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-5 cursor-pointer hover:border-white/[0.2] transition-colors"
              onClick={() => { const d = new Date(currentDate); d.setMonth(month); setCurrentDate(d); setView('Month'); }}
            >
              <h3 className="text-sm font-bold text-gray-200 mb-4 uppercase tracking-wider">{monthNames[month]} {year}</h3>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
                  const session = getSession(year, month, day);
                  const display = toDisplay(session);
                  const st = sub20StatusOf(year, month, day);
                  const done = st === 'done' || (!showSub20 && display?.completed);
                  const failed = st === 'failed';
                  return (
                    <div
                      key={`${year}-${month}-${day}`}
                      // Sul quadratino di una seduta il click apre quella seduta,
                      // non il mese: è il gesto che ci si aspetta.
                      className={`aspect-square rounded-sm ${display ? 'cursor-pointer hover:ring-1 hover:ring-white/50' : ''}`}
                      onClick={display ? (e) => { e.stopPropagation(); openDay(new Date(year, month, day)); } : undefined}
                      style={{
                        backgroundColor: failed ? '#EF4444' : display ? display.color : '#2A2A2A',
                        opacity: display ? (done ? 0.45 : 0.9) : 0.3,
                      }}
                      title={display ? `${day} ${monthNames[month]}: ${display.title}${done ? ' ✓' : failed ? ' ✗' : ''}` : `${day} ${monthNames[month]}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const hasPlan = (planData?.weeks.length ?? 0) > 0;

  return (
    <div className="flex flex-col h-full bg-[#121212]">
      {/* Header
          Va a capo, e non è pignoleria: con due piani accanto a "Genera Piano",
          al date-picker e ai quattro tasti di vista, a 1280 px la riga
          traboccava e il primo bottone finiva fuori dallo schermo — invisibile
          e non cliccabile. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-6 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-2xl font-bold text-white shrink-0">{t("sections.trainingMenu")}</h1>
          <AdherenceStrip evals={adherence} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Genera Piano
          </button>

          {/* I due piani kikko.
              Acceso = pieno, con il pallino. Spento = grigio, senza accento:
              prima erano due bottoni colorati, uno pieno e uno bordato, e a
              colpo d'occhio non si capiva quale fosse attivo. Un solo elemento
              acceso alla volta, e si vede da lontano. */}
          {([
            { id: "sub20", label: "kikkoSub20", accent: "var(--app-accent)", glow: "192,255,0" },
            { id: "sub135", label: KIKKO_SUB135_META.phase, accent: "#00FFAA", glow: "0,255,170" },
          ] as const).map((btn) => {
            const on = kikkoPlan === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setKikkoPlan(on ? "off" : btn.id)}
                title={on ? "Piano attivo — tocca per tornare al piano generato" : `Attiva ${btn.label}`}
                aria-pressed={on}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-black rounded-lg border transition-all ${
                  on ? "scale-[1.03]" : "hover:border-white/25 hover:text-gray-200"
                }`}
                style={
                  on
                    ? {
                        background: btn.accent,
                        color: "#0A0A0A",
                        borderColor: btn.accent,
                        boxShadow: `0 0 22px rgba(${btn.glow},0.55)`,
                      }
                    : {
                        background: "#1A1A1A",
                        color: "#6B7280",
                        borderColor: "#2A2A2A",
                      }
                }
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: on ? "#0A0A0A" : "#3F3F46" }}
                />
                {btn.label}
              </button>
            );
          })}

          {/* Inizio, gara e obiettivo.
              I due calendari sono legati dalla durata del piano: toccandone uno
              si sposta l'altro, perché le settimane non si allungano da sole.
              L'obiettivo invece è libero — è la domanda a cui risponde la
              percentuale sulle sedute di qualità. */}
          {showSub20 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#141414] px-2.5 py-1.5">
              <DateField
                label="Inizio"
                value={shownWin.start}
                onChange={(iso) => setDraft({ ...shownWin, start: kikkoSub20NormalizeStart(iso) })}
                title="Lunedì da cui parti"
              />

              <span className="text-gray-700">→</span>

              <DateField
                label="Gara"
                value={addDays(kikkoSub20NormalizeStart(shownWin.race), 6)}
                accent={activeAccent}
                title="Giorno della gara — indipendente dall'inizio"
                onChange={(iso) => setDraft({ ...shownWin, race: kikkoSub20NormalizeStart(iso) })}
              />

              {/* Quanto del piano ci sta. Se la finestra è stretta si corrono
                  le ultime settimane, quelle col picco e il taper, e va detto. */}
              <span
                className="text-[10px] whitespace-nowrap"
                style={{ color: draftWindow.weeksSkipped > 0 ? "#F59E0B" : "#6B7280" }}
                title={
                  draftWindow.weeksSkipped > 0
                    ? `Il piano ne ha ${activePlan.weeks.length}: con questa finestra si corrono le ultime ${draftWindow.weeksUsed}, dal picco al taper.`
                    : draftWindow.weeksIdle > 0
                      ? `Il piano dura ${activePlan.weeks.length} settimane: le prime ${draftWindow.weeksIdle} restano libere.`
                      : "Il piano ci sta intero."
                }
              >
                {draftWindow.weeksUsed} sett.
                {draftWindow.weeksSkipped > 0 && ` · ultime ${draftWindow.weeksUsed} di ${activePlan.weeks.length}`}
                {draftWindow.weeksIdle > 0 && ` · ${draftWindow.weeksIdle} libere prima`}
              </span>

              <button
                type="button"
                onClick={applyWindow}
                disabled={!dirty}
                className="px-3 py-1 rounded-md text-xs font-bold text-gray-300 bg-[#1E1E1E] border border-[#2A2A2A] hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
              >
                Applica
              </button>

              <span className="w-px h-5 bg-[#2A2A2A]" />

              {/* Il VDOT: da dove parti e dove punti.
                  La partenza dovrebbe uscire da una prova reale, non da una
                  speranza — messa troppo alta il piano scrive ritmi che non si
                  reggono e ogni seduta si chiude "fallita" per un errore di
                  taratura. L'obiettivo si ferma a +2 punti perché è quello che
                  un blocco può davvero produrre. */}
              <label
                className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-2 py-1"
                title="Il VDOT da cui parti. Va ancorato a una prova vera: il 3 km a tutta della prima settimana serve a questo."
              >
                <Gauge className="w-3.5 h-3.5 shrink-0 text-gray-500" />
                <span className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-600">VDOT</span>
                <input
                  type="number" step={0.1} min={25} max={85}
                  value={shownVdot.start}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) saveVdot({ start: v, target: shownVdot.target });
                  }}
                  className="w-[3.2rem] bg-transparent border-0 p-0 text-xs font-bold text-white outline-none"
                />
              </label>

              <span className="text-gray-700">→</span>

              <label
                className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-2 py-1"
                title="Il VDOT a cui punti alla gara. Massimo +2 punti: oltre, nessun blocco lo produce."
              >
                <span className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-600">Arrivo</span>
                <select
                  value={shownVdot.target}
                  onChange={(e) => saveVdot({ start: shownVdot.start, target: Number(e.target.value) })}
                  className="bg-transparent border-0 p-0 text-xs font-bold outline-none cursor-pointer"
                  style={{ color: activeAccent }}
                >
                  {kikkoVdotOptions(shownVdot.start).map((v) => (
                    <option key={v} value={v} style={{ background: "#0A0A0A" }}>
                      {v.toFixed(1)}{v > shownVdot.start ? ` (+${(v - shownVdot.start).toFixed(1)})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {/* Il salto chiesto contro quello che la finestra può dare. */}
              {askedGain > plausibleGain + 0.05 && (
                <span
                  className="text-[10px] font-bold whitespace-nowrap"
                  style={{ color: askedGain > plausibleGain * 1.6 ? "#F43F5E" : "#F59E0B" }}
                  title={`Su ${draftWindow.weeksUsed} settimane la letteratura misura circa +${plausibleGain.toFixed(1)} punti per un atleta a questo livello (Milanović 2015, Bacon 2013). Chiederne +${askedGain.toFixed(1)} significa scrivere ritmi che potrebbero non arrivare.`}
                >
                  +{askedGain.toFixed(1)} in {draftWindow.weeksUsed} sett. · realistico +{plausibleGain.toFixed(1)}
                </span>
              )}


              <label
                className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-2 py-1"
                title="Il tempo che vuoi fare. È l'obiettivo su cui si misura la percentuale delle sedute di qualità."
              >
                <Target className="w-3.5 h-3.5 shrink-0" style={{ color: activeAccent }} />
                <span className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-600">Obiettivo</span>
                <input
                  value={goalDraft ?? fmtRaceTime(goalSec)}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onBlur={saveGoal}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  inputMode="numeric"
                  placeholder={kikkoPlan === "sub135" ? "1:34:35" : "19:59"}
                  className="w-[4.5rem] bg-transparent border-0 p-0 text-xs font-bold outline-none"
                  style={{
                    color: goalDraft != null && parseGoal(goalDraft) == null ? "#F43F5E" : activeAccent,
                  }}
                />
              </label>
            </div>
          )}

          <div className="flex bg-[#1E1E1E] rounded-md border border-[#2A2A2A] p-1">
            {(['Day', 'Week', 'Month', 'Year'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 text-sm rounded-sm transition-colors ${view === v ? 'bg-[#2A2A2A] text-white font-medium shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#1E1E1E] rounded-md border border-[#2A2A2A] px-2 py-1.5">
            <button onClick={prev} className="p-1 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="mx-2 text-sm text-gray-200 min-w-[160px] text-center font-semibold tracking-wide capitalize">
              {formatDateDisplay()}
            </span>
            <button onClick={next} className="p-1 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!showSub20 && !hasPlan && planData !== null && (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1E1E1E] flex items-center justify-center mb-4 border border-[#2A2A2A]">
            <Sparkles className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-300 mb-2">Nessun piano generato</h3>
          <p className="text-gray-500 mb-6">Genera un piano personalizzato basato sul tuo VDOT.</p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-[#3B82F6] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] transition-colors"
          >
            Genera il tuo Piano
          </button>
        </div>
      )}

      {/* Calendar (piano generico o Sub-20: stesso rendering, dataset diverso) */}
      {(showSub20 || hasPlan || planData === null) && (
        <div className="flex-1 overflow-auto p-6">
          {view === 'Month' && renderMonthView()}
          {view === 'Week' && renderWeekView()}
          {view === 'Day' && renderDayView()}
          {view === 'Year' && renderYearView()}
          {/* Legend */}
          {(showSub20 || hasPlan) && (
            <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-[#2A2A2A]">
              {(kikkoPlan === "sub135" ? KIKKO_SUB135_LEGEND : kikkoPlan === "sub20" ? KIKKO_SUB20_LEGEND : ([
                { color: SESSION_COLORS.easy,      label: 'Easy / Recovery' },
                { color: SESSION_COLORS.tempo,     label: 'Tempo' },
                { color: SESSION_COLORS.intervals, label: 'Intervals' },
                { color: SESSION_COLORS.long,      label: 'Long Run' },
                { color: SESSION_COLORS.strength,  label: 'Riposo + Forza' },
                { color: '#2A2A2A',                label: 'Riposo', opacity: 0.3 },
              ] as Array<{ color: string; label: string; opacity?: number }>)).map(({ color, label, opacity }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: (opacity as number | undefined) ?? 0.9 }} />
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dettaglio seduta — copre tutto: niente scritte che filtrano da dietro */}
      {detailDate && (
        <div
          className="fixed inset-0 z-[70] bg-[#0A0A0A] overflow-y-auto"
          onClick={closeDay}
          role="presentation"
        >
          <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
            <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              {renderDayDetail(detailDate, closeDay)}
            </div>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showModal && (
        <GeneratePlanModal
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); refetchPlan(); }}
        />
      )}

      {/* Adapt Modal */}
      {showAdaptModal && (
        <AdaptPlanModal
          onClose={() => setShowAdaptModal(false)}
          onDone={() => { setShowAdaptModal(false); refetchPlan(); }}
        />
      )}
    </div>
  );
}
