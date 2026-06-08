import { useCallback, useEffect, useMemo, useState } from "react";
import { Target, Flame, Zap, CheckCircle2, RotateCcw, Trophy } from "lucide-react";

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
