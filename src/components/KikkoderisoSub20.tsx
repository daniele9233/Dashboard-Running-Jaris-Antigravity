import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Flame, Zap, CheckCircle2, RotateCcw, Trophy, CalendarDays, TrendingUp,
  Thermometer, Droplets, Mountain, Clock, Activity, Loader2,
} from "lucide-react";
import { evaluateSub20Session, type Sub20EvalResult } from "../api";

/**
 * kikkoderisoSub20 — personal Sub-20 5K plan (Piano_Sub20_5K_Daniele.pdf).
 *
 * 10-week block, race pace 3:59/km, target 19:58, Rome summer 2026. Every
 * session can be scored with a success percentage (— / 50 / 70 / 90 / 100),
 * persisted to localStorage. Weekly and overall completion roll up from those.
 */

const STORAGE_KEY = "metic:kikkoderiso-sub20:v1";

type Slot = "mar" | "qual" | "sab" | "dom";

interface WeekRow {
  week: number;
  phase?: string;
  mar: string;
  qual: string;
  qualNote?: string;
  sab: string;
  dom: string;
  km: number | null;
  isTest?: boolean;
}

// Plan transcribed verbatim from the PDF (10 weeks).
const PLAN: WeekRow[] = [
  { week: 1, phase: "Carico · iniziato 2/6", mar: "FAC 6 km", qual: "3×1000 @ 3:58", qualNote: "rec 2′ + 2 km FAC", sab: "FAC 6 km", dom: "LUN 9 km", km: 28 },
  { week: 2, mar: "FAC 6 km", qual: "4×1000 @ 3:57", qualNote: "rec 2′", sab: "FAC 6 km", dom: "LUN 10 km", km: 30 },
  { week: 3, mar: "FAC 7 km", qual: "5×1000 @ 3:57", qualNote: "rec 2′", sab: "FAC 7 km", dom: "LUN 11 km", km: 33 },
  { week: 4, phase: "Scarico", mar: "FAC 5 km", qual: "3×1200 @ 3:58", qualNote: "rec 2′30″", sab: "FAC 6 km", dom: "LUN 8 km", km: 26 },
  { week: 5, mar: "FAC 7 km", qual: "2×2000 @ 4:00", qualNote: "rec 3′", sab: "FAC 7 km", dom: "LUN 12 km", km: 36 },
  { week: 6, mar: "FAC 7 km", qual: "5×1000 @ 3:55", qualNote: "rec 90″", sab: "FAC 7 km", dom: "LUN 12 km", km: 38 },
  { week: 7, mar: "FAC 8 km", qual: "3×1600 @ 3:58", qualNote: "rec 2′30″", sab: "FAC 8 km", dom: "LUN 13 km", km: 40 },
  { week: 8, phase: "Scarico", mar: "FAC 6 km", qual: "4×1000 @ 3:55", qualNote: "rec 90″", sab: "FAC 6 km", dom: "LUN 9 km", km: 30 },
  { week: 9, mar: "FAC 7 km", qual: "2×2400 @ 3:58", qualNote: "rec 3′ · quasi i 5 km spezzati", sab: "FAC 6 km", dom: "LUN 11 km", km: 37 },
  { week: 10, phase: "Taper", mar: "FAC 5 km", qual: "3×1000 @ 3:55", qualNote: "rec 2′ sciolto", sab: "Riposo", dom: "TEST 5 km", km: null, isTest: true },
];

const SLOTS: { key: Slot; label: string; sub: string }[] = [
  { key: "mar", label: "MAR", sub: "Facile" },
  { key: "qual", label: "GIO · ALBA", sub: "Qualità" },
  { key: "sab", label: "SAB", sub: "Facile" },
  { key: "dom", label: "DOM", sub: "Lungo" },
];

const PCT_OPTIONS = [0, 50, 70, 90, 100];

const GOLDEN_RULES = [
  "Qualità solo all'alba (6:00–7:00, min 18–20°C). Sopra 25°C il ritmo gara non è esprimibile: salti, non sposti al pomeriggio.",
  "Facili a frequenza cardiaca, non a passo. Tetto FC ~140 bpm. A 18°C escono ~5:45–6:15, a 30–34°C anche 6:30–7:00. Entrambi corretti.",
  "Idratazione e sale. In estate bevi prima e dopo, reintegra sali: una qualità disidratato non rende e carica i tendini.",
  "Il piede comanda. Se tibiale posteriore (sx) o Achille (dx) danno segnali, salti il lungo successivo e non aumenti il volume. 48h tra le intense sempre.",
];

type ScoreMap = Record<string, number>;

function loadScores(): ScoreMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScoreMap) : {};
  } catch {
    return {};
  }
}

function pctColor(pct: number): string {
  if (pct >= 100) return "#10B981";
  if (pct >= 70) return "#C0FF00";
  if (pct >= 50) return "#F59E0B";
  if (pct > 0) return "#F97316";
  return "#3A3A3A";
}

// ── Auto-evaluation (kikkoderisoSub20) ──────────────────────────────────────
// Confronto automatico della qualità eseguita vs prescritto, normalizzato per
// pendenza + temperatura + umidità (motore /api/sub20/evaluate-session).
const QUAL_DATES_KEY = "metic:kikkoderiso-sub20:qualdates:v1";
const EVALS_KEY = "metic:kikkoderiso-sub20:evals:v1";
// Settimana 1 = giovedì 4/6/2026 (piano iniziato martedì 2/6). Mese 0-based.
const QUAL_BASE = new Date(2026, 5, 4);

function loadJson<T>(key: string): T {
  if (typeof window === "undefined") return {} as T;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

function defaultQualDate(week: number): string {
  const d = new Date(QUAL_BASE);
  d.setDate(d.getDate() + (week - 1) * 7);
  // Local date components (NO toISOString — sfasa di 1 giorno in fuso UTC+).
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// "3×1000 @ 3:58" → { reps: 3, rep_m: 1000, targetSec: 238 }
function parseQual(qual: string): { reps: number; rep_m: number; targetSec: number } | null {
  const m = qual.match(/(\d+)\s*[×x]\s*(\d+)\s*@\s*(\d+):(\d+)/i);
  if (!m) return null;
  return { reps: +m[1], rep_m: +m[2], targetSec: +m[3] * 60 + +m[4] };
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtPace = (sec: number | null | undefined): string =>
  sec == null ? "—" : `${Math.floor(sec / 60)}:${pad2(Math.round(sec % 60))}`;
const fmtDelta = (sec: number | null | undefined): string =>
  sec == null ? "—" : `${sec > 0 ? "+" : ""}${sec}s/km`;
const fmtDate = (iso: string | undefined): string => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

const VERDICT: Record<string, { label: string; color: string; desc: string }> = {
  AVANTI:   { label: "AVANTI",   color: "#10B981", desc: "più forte del piano" },
  IN_LINEA: { label: "IN LINEA", color: "#C0FF00", desc: "in linea col piano" },
  INDIETRO: { label: "INDIETRO", color: "#F43F5E", desc: "sotto il prescritto" },
  ND:       { label: "N/D",      color: "#6B7280", desc: "dati insufficienti" },
};

export function KikkoderisoSub20() {
  const [scores, setScores] = useState<ScoreMap>(() => loadScores());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch {
      /* quota — ignore */
    }
  }, [scores]);

  const setScore = useCallback((id: string, pct: number) => {
    setScores((prev) => {
      const next = { ...prev };
      if (prev[id] === pct) delete next[id]; // toggle off
      else next[id] = pct;
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    if (window.confirm("Azzerare tutti i progressi del piano Sub-20?")) setScores({});
  }, []);

  const { overallPct, doneCount, totalSessions } = useMemo(() => {
    const total = PLAN.length * SLOTS.length;
    let sum = 0;
    let done = 0;
    for (const w of PLAN) {
      for (const s of SLOTS) {
        const v = scores[`w${w.week}-${s.key}`] ?? 0;
        sum += v;
        if (v > 0) done += 1;
      }
    }
    return { overallPct: Math.round(sum / total), doneCount: done, totalSessions: total };
  }, [scores]);

  const weekPct = useCallback(
    (week: number) => {
      let sum = 0;
      for (const s of SLOTS) sum += scores[`w${week}-${s.key}`] ?? 0;
      return Math.round(sum / SLOTS.length);
    },
    [scores],
  );

  // ── Auto-evaluation state ──
  const [qualDates, setQualDates] = useState<Record<number, string>>(() => loadJson(QUAL_DATES_KEY));
  const [evals, setEvals] = useState<Record<number, Sub20EvalResult>>(() => loadJson(EVALS_KEY));
  const [busyWeek, setBusyWeek] = useState<number | null>(null);
  const [openWeek, setOpenWeek] = useState<number | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(QUAL_DATES_KEY, JSON.stringify(qualDates)); } catch { /* quota */ }
  }, [qualDates]);
  useEffect(() => {
    try { window.localStorage.setItem(EVALS_KEY, JSON.stringify(evals)); } catch { /* quota */ }
  }, [evals]);

  const qualDateOf = useCallback((week: number) => qualDates[week] ?? defaultQualDate(week), [qualDates]);

  const evaluate = useCallback(async (w: WeekRow) => {
    const parsed = parseQual(w.qual);
    if (!parsed) return;
    setBusyWeek(w.week);
    setOpenWeek(w.week);
    try {
      const res = await evaluateSub20Session({
        date: qualDates[w.week] ?? defaultQualDate(w.week),
        reps: parsed.reps,
        rep_m: parsed.rep_m,
        target_pace_sec: parsed.targetSec,
        window_days: 4,
      });
      setEvals((prev) => ({ ...prev, [w.week]: res }));
    } catch {
      setEvals((prev) => ({ ...prev, [w.week]: { matched: false, error: "network" } }));
    } finally {
      setBusyWeek(null);
    }
  }, [qualDates]);

  // Roll-up "dove sono migliorato"
  const progress = useMemo(() => {
    const items = Object.entries(evals)
      .map(([wk, r]) => ({ week: +wk, r }))
      .filter((x) => x.r.matched && x.r.vdot_implied != null)
      .sort((a, b) => (a.r.run_date || "").localeCompare(b.r.run_date || ""));
    if (items.length === 0) return null;
    const first = items[0].r.vdot_implied as number;
    const last = items[items.length - 1].r.vdot_implied as number;
    return { items, first, last, delta: +(last - first).toFixed(1), count: items.length };
  }, [evals]);

  const sessionText = (w: WeekRow, slot: Slot): { main: string; note?: string } => {
    if (slot === "mar") return { main: w.mar };
    if (slot === "qual") return { main: w.qual, note: w.qualNote };
    if (slot === "sab") return { main: w.sab };
    return { main: w.dom, note: w.isTest ? "alba fresca · parti 4:02–4:03" : undefined };
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6 bg-[#121212]">
      {/* Hero */}
      <div className="rounded-2xl border border-[#C0FF00]/25 bg-gradient-to-br from-[#C0FF00]/[0.06] to-black/40 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.3em] text-[#C0FF00] uppercase">
              <Trophy className="w-4 h-4" /> kikkoderisoSub20
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl font-black italic tracking-tight text-white">
              5 km in <span className="text-[#C0FF00]">19:58</span>
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Passo gara 3:59/km · 10 settimane · Roma estate 2026 · VDOT 53–54
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-[10px] font-black tracking-widest text-gray-500 uppercase mb-1">Completamento</div>
              <div className="text-4xl font-black" style={{ color: pctColor(overallPct) }}>{overallPct}%</div>
              <div className="text-[10px] text-gray-600 mt-1">{doneCount}/{totalSessions} sedute</div>
            </div>
            <button
              type="button"
              onClick={resetAll}
              title="Azzera progressi"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-[11px] font-black tracking-widest text-gray-400 hover:text-[#F43F5E] hover:border-[#F43F5E]/30 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> RESET
            </button>
          </div>
        </div>
        <div className="mt-5 h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${overallPct}%`, backgroundColor: pctColor(overallPct) }} />
        </div>
      </div>

      {/* Golden rules */}
      <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5">
        <div className="flex items-center gap-2 mb-3 text-[10px] font-black tracking-[0.25em] text-amber-400 uppercase">
          <Flame className="w-4 h-4" /> Regole d'oro estate romana
        </div>
        <ol className="space-y-2">
          {GOLDEN_RULES.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-300 leading-relaxed">
              <span className="shrink-0 w-5 h-5 rounded-full bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-[10px] font-black text-amber-400">{i + 1}</span>
              {r}
            </li>
          ))}
        </ol>
      </div>

      {/* Dove sono migliorato (roll-up auto-valutazioni) */}
      {progress && (
        <div className="rounded-2xl border border-[#10B981]/25 bg-[#10B981]/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-black tracking-[0.25em] text-[#10B981] uppercase">
            <TrendingUp className="w-4 h-4" /> Dove sono migliorato
          </div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className="text-[10px] font-black tracking-widest text-gray-500 uppercase mb-1">VDOT implicito</div>
              <div className="text-3xl font-black text-white">
                {progress.first.toFixed(1)} <span className="text-gray-600 text-xl">→</span> {progress.last.toFixed(1)}
              </div>
              <div className="text-[11px] font-black mt-1" style={{ color: progress.delta >= 0 ? "#10B981" : "#F43F5E" }}>
                {progress.delta >= 0 ? "+" : ""}{progress.delta} · {progress.count} sedute valutate
              </div>
            </div>
            <div className="flex-1 min-w-[220px] flex flex-wrap gap-2">
              {progress.items.map(({ week, r }) => (
                <div key={week} className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-[10px] whitespace-nowrap">
                  <span className="text-gray-500 font-black">S{week}</span>{" "}
                  <span style={{ color: VERDICT[r.verdict || "ND"].color }} className="font-black">{fmtDelta(r.delta_sec)}</span>{" "}
                  <span className="text-gray-600">VDOT {r.vdot_implied?.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
            Passo normalizzato (pendenza + caldo) vs prescritto. Il delta che scende settimana dopo settimana a parità di
            sforzo = stai migliorando.
          </p>
        </div>
      )}

      {/* Weekly plan with completion tracking */}
      <div className="space-y-4">
        {PLAN.map((w) => {
          const wp = weekPct(w.week);
          return (
            <div key={w.week} className="rounded-2xl border border-white/10 bg-[#1A1A1A] overflow-hidden">
              {/* Week header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-black text-white">Settimana {w.week}</div>
                  {w.phase && (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border border-white/10 bg-white/[0.04] text-gray-400">
                      {w.phase}
                    </span>
                  )}
                  {w.km != null && <span className="text-[11px] text-gray-500">~{w.km} km</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${wp}%`, backgroundColor: pctColor(wp) }} />
                  </div>
                  <span className="text-xs font-black w-10 text-right" style={{ color: pctColor(wp) }}>{wp}%</span>
                </div>
              </div>

              {/* Sessions */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4">
                {SLOTS.map((slot) => {
                  const id = `w${w.week}-${slot.key}`;
                  const raw = scores[id];
                  const isSet = raw !== undefined;
                  const current = raw ?? 0;
                  const { main, note } = sessionText(w, slot.key);
                  const isRest = main.toLowerCase() === "riposo";
                  const isQual = slot.key === "qual";
                  const accent = pctColor(current);
                  return (
                    <div
                      key={id}
                      className="rounded-xl border p-3 flex flex-col gap-2.5 transition-colors"
                      style={{
                        borderColor: current > 0 ? `${accent}55` : isQual ? "rgba(192,255,0,0.18)" : "rgba(255,255,255,0.08)",
                        background: current > 0 ? `${accent}0D` : isQual ? "rgba(192,255,0,0.03)" : "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: isQual ? "#C0FF00" : "#6B7280" }}>
                          {slot.label}
                        </span>
                        <span className="text-[8px] font-black tracking-widest text-gray-600 uppercase">{slot.sub}</span>
                      </div>
                      <div className="min-h-[34px]">
                        <div className="text-sm font-black text-white leading-tight">{main}</div>
                        {note && <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{note}</div>}
                      </div>

                      {isRest ? (
                        <div className="text-[10px] font-black tracking-widest text-gray-600 uppercase py-1.5 text-center">— riposo —</div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {PCT_OPTIONS.map((p) => {
                            const active = isSet && current === p;
                            const label = p === 0 ? "NO" : p === 100 ? "✓" : `${p}`;
                            const col = p === 0 ? "#F97316" : pctColor(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setScore(id, p)}
                                title={p === 0 ? "Non superato" : p === 100 ? "Superato 100%" : `Superato ${p}%`}
                                className="flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all"
                                style={{
                                  background: active ? col : "rgba(255,255,255,0.04)",
                                  color: active ? "#0A0A0A" : "#8A8A8A",
                                  border: `1px solid ${active ? col : "rgba(255,255,255,0.06)"}`,
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Auto-valutazione qualità */}
              {(() => {
                const parsed = parseQual(w.qual);
                if (!parsed) return null;
                const ev = evals[w.week];
                const busy = busyWeek === w.week;
                const open = openWeek === w.week && !!ev;
                const qid = `w${w.week}-qual`;
                return (
                  <div className="border-t border-white/[0.06] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-[#C0FF00] uppercase">
                        <Activity className="w-3.5 h-3.5" /> Auto-valutazione qualità
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                        <span className="hidden sm:inline">Giorno</span>
                        <input
                          type="date"
                          value={qualDateOf(w.week)}
                          onChange={(e) => setQualDates((p) => ({ ...p, [w.week]: e.target.value }))}
                          className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-[#C0FF00]/40 [color-scheme:dark]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => evaluate(w)}
                        disabled={busy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide border border-[#C0FF00]/30 bg-[#C0FF00]/10 text-[#C0FF00] hover:bg-[#C0FF00]/20 transition-colors disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        {busy ? "Analizzo…" : ev ? "Rivaluta" : "Valuta seduta"}
                      </button>
                      {ev && (
                        <button
                          type="button"
                          onClick={() => setOpenWeek(open ? null : w.week)}
                          className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {open ? "nascondi" : "mostra"}
                        </button>
                      )}
                    </div>

                    {open && ev && (
                      ev.matched && ev.reps && ev.reps.length > 0 ? (
                        <EvalResultView ev={ev} target={parsed.targetSec} onApply={(p) => setScore(qid, p)} applied={scores[qid]} />
                      ) : (
                        <div className="mt-3 text-[12px] text-gray-500 leading-relaxed">
                          {ev.error === "no_reps"
                            ? "Corsa di qualità trovata, ma non riconosco ripetute pulite (struttura continua o GPS rumoroso)."
                            : "Nessuna seduta di qualità in questo giorno — niente da valutare. Imposta il giorno reale in cui hai fatto le ripetute."}
                        </div>
                      )
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Block logic note */}
      <div className="rounded-2xl border border-[#C0FF00]/20 bg-[#C0FF00]/[0.03] p-5">
        <div className="flex items-center gap-2 mb-2 text-[10px] font-black tracking-[0.25em] text-[#C0FF00] uppercase">
          <Zap className="w-4 h-4" /> Logica del blocco intenso
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          Parti da 3×1000 e arrivi (sett. 9) a 2×2400 a ritmo gara — quasi i 5 km spezzati in due. Quando reggi quello con
          recupero breve, i 5 km filati a 3:59 diventano realistici: è il passaggio dal «reggo 3 km» al «reggo 5 km».
          Test finale: parti a 4:02–4:03 i primi 2 km (non 3:55, errore classico), poi tieni e chiudi negli ultimi 1,5 km.
          A 3:59 medio = 19:55.
        </p>
      </div>

      {/* Strides */}
      <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5">
        <div className="flex items-center gap-2 mb-2 text-[10px] font-black tracking-[0.25em] text-[#C0FF00] uppercase">
          <CheckCircle2 className="w-4 h-4" /> Allunghi (allenanti)
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          Dopo 2 corse facili a settimana: 4–6 allunghi da 80–100 m in progressione fino a velocità superiore al ritmo
          gara, recupero camminando. Migliorano la meccanica e rendono il 3:59 più «facile» senza affaticare.
        </p>
      </div>

      <p className="text-[11px] text-gray-600 text-center pb-4">
        Piano personale · i target di passo valgono in condizioni fresche; in estate governa sempre sulla frequenza cardiaca.
      </p>
    </div>
  );
}

// ── Risultato auto-valutazione di una qualità ───────────────────────────────
function EvalResultView({
  ev, target, onApply, applied,
}: {
  ev: Sub20EvalResult;
  target: number;
  onApply: (pct: number) => void;
  applied?: number;
}) {
  const v = VERDICT[ev.verdict || "ND"];
  const c = ev.conditions;
  return (
    <div className="mt-3 space-y-3">
      {/* Verdetto + normalizzato vs target */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className="px-3 py-1.5 rounded-lg text-xs font-black tracking-widest"
          style={{ background: `${v.color}1A`, color: v.color, border: `1px solid ${v.color}55` }}
        >
          {v.label}
        </span>
        <div className="text-[12px] text-gray-300">
          Normalizzato <span className="text-gray-500">(PBP + temp ideale)</span>{" "}
          <b className="text-white">{fmtPace(ev.normalized_avg_sec)}</b> vs target{" "}
          <b className="text-white">{fmtPace(target)}</b> → <b style={{ color: v.color }}>{fmtDelta(ev.delta_sec)}</b>
        </div>
        {ev.vdot_implied != null && (
          <div className="text-[12px] text-gray-400">
            VDOT implicito <b className="text-[#C0FF00]">{ev.vdot_implied.toFixed(1)}</b>
          </div>
        )}
        <div className="text-[11px] text-gray-600">
          {fmtDate(ev.run_date)} · grezzo {fmtPace(ev.avg_raw_sec)}
        </div>
      </div>

      {/* Rep: grezzo · PBP (pendenza) · a temp ideale · dislivello */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {ev.reps!.map((r, i) => (
          <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-gray-500 font-black tracking-wide">R{i + 1}</span>
              <span className="flex items-center gap-2 text-[10px] text-gray-500">
                {r.elev_m != null && (
                  <span className="flex items-center gap-0.5">
                    <Mountain className="w-3 h-3 text-emerald-400" />{r.elev_m > 0 ? "+" : ""}{r.elev_m}m
                  </span>
                )}
                {r.hr_avg != null && <span className="text-[#F43F5E]/80">{r.hr_avg}bpm</span>}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span><span className="text-gray-500">grezzo </span><b className="text-white">{fmtPace(r.pace_sec)}</b></span>
              <span><span className="text-gray-500">PBP </span><b className="text-sky-300">{fmtPace(r.pbp_sec)}</b></span>
              <span><span className="text-gray-500">ideale </span><b className="text-[#10B981]">{fmtPace(r.ideal_sec)}</b></span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-gray-600">{ev.reps_done}/{ev.reps_prescribed} rep completate</div>

      {/* Legenda */}
      <div className="text-[10px] text-gray-500 leading-relaxed rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <b className="text-gray-400">grezzo</b> = passo reale corso · <b className="text-sky-300">PBP</b> = passo in base alla
        pendenza (equivalente in piano: salita → più veloce, discesa → più lento) · <b className="text-[#10B981]">ideale</b> = a
        temperatura ottimale (~12°C) · <b className="text-white">normalizzato</b> = PBP + temp ideale, il valore con cui giudico
        AVANTI / INDIETRO.
      </div>

      {/* Condizioni */}
      {c && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
          {c.temp_c != null && (
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-400" />
              {c.temp_c}°C{c.apparent_c != null ? ` (perc. ${c.apparent_c}°)` : ""}
              <span className="text-gray-600">{c.temp_source === "strava_device" ? "· Garmin" : "· meteo"}</span>
            </span>
          )}
          {c.humidity != null && (
            <span className="flex items-center gap-1">
              <Droplets className="w-3 h-3 text-sky-400" />
              {c.humidity}%
            </span>
          )}
          <span className="flex items-center gap-1">
            <Mountain className="w-3 h-3 text-emerald-400" />
            {c.net_elev_m > 0 ? "+" : ""}{c.net_elev_m}m
          </span>
          {(c.grade_adj_sec !== 0 || c.heat_adj_sec !== 0) && (
            <span className="text-gray-500">
              credito: pendenza {c.grade_adj_sec > 0 ? "+" : ""}{c.grade_adj_sec}s · caldo −{c.heat_adj_sec}s
            </span>
          )}
        </div>
      )}

      {/* Quando avrà effetto */}
      {ev.adaptation && (
        <div className="flex items-start gap-2 text-[11px] text-gray-400 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <Clock className="w-3.5 h-3.5 text-[#C0FF00] mt-0.5 shrink-0" />
          <span>
            <b className="text-gray-200">Effetto sulla performance:</b> dal{" "}
            <b className="text-white">{fmtDate(ev.adaptation.peak_from)}</b> al{" "}
            <b className="text-white">{fmtDate(ev.adaptation.peak_to)}</b>.{" "}
            <span className="text-gray-500">{ev.adaptation.note}</span>
          </span>
        </div>
      )}

      {/* Applica % suggerito */}
      {ev.suggested_pct != null && (
        <button
          type="button"
          onClick={() => onApply(ev.suggested_pct as number)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide border transition-colors"
          style={{
            borderColor: applied === ev.suggested_pct ? "#10B981" : "rgba(192,255,0,0.3)",
            background: applied === ev.suggested_pct ? "#10B98122" : "rgba(192,255,0,0.08)",
            color: applied === ev.suggested_pct ? "#10B981" : "#C0FF00",
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {applied === ev.suggested_pct ? `Applicato ${ev.suggested_pct}%` : `Applica ${ev.suggested_pct}% al punteggio`}
        </button>
      )}
    </div>
  );
}
