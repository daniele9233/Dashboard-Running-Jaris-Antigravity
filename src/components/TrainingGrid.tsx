import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Zap, AlertTriangle, CheckCircle2, Info, Timer } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { getTrainingPlan, generateTrainingPlan, adaptTrainingPlan, evaluateTest } from "../api";
import type { Session, TrainingPlanResponse, AdaptAdaptation } from "../types/api";

const SESSION_COLORS: Record<string, string> = {
  easy:      "#8B5CF6",
  recovery:  "#6B7280",
  intervals: "#EF4444",
  tempo:     "#F97316",
  long:      "#10B981",
  rest:      "transparent",
};

interface SessionDisplay {
  color: string;
  title: string;
  details: string[];
  completed: boolean;
  description: string;
}

function toDisplay(session: Session | undefined): SessionDisplay | null {
  if (!session || session.type === "rest") return null;
  const color = SESSION_COLORS[session.type] ?? "#6B7280";
  const details: string[] = [];
  if (session.target_distance_km) details.push(`${session.target_distance_km} km`);
  if (session.target_pace) details.push(`${session.target_pace}/km`);
  return { color, title: session.title, details, completed: session.completed, description: session.description };
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
                <div key={m.label} className="flex items-start gap-3 p-3 bg-[#121212] rounded-lg border border-[#2A2A2A]">
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
                <div className="flex-1 bg-[#121212] rounded-lg p-3 border border-[#2A2A2A] text-center">
                  <div className="text-xl font-bold text-amber-400">{summary.triggered}</div>
                  <div className="text-xs text-gray-500">modelli attivati</div>
                </div>
                <div className="flex-1 bg-[#121212] rounded-lg p-3 border border-[#2A2A2A] text-center">
                  <div className="text-xl font-bold text-white">{summary.weeks}</div>
                  <div className="text-xs text-gray-500">settimane modificate</div>
                </div>
                <div className="flex-1 bg-[#121212] rounded-lg p-3 border border-[#2A2A2A] text-center">
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
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4 text-center">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">VDOT Precedente</div>
                  <div className="text-2xl font-bold text-gray-400">{result.previous_plan_vdot}</div>
                </div>
                <div className="bg-[#121212] border border-purple-500/30 rounded-xl p-4 text-center">
                  <div className="text-[10px] text-purple-400 uppercase mb-1">VDOT Test</div>
                  <div className="text-2xl font-bold text-purple-400">{result.test_vdot}</div>
                  <div className="text-[10px] text-gray-500 mt-1">Passo: {result.test_pace}/km</div>
                </div>
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4 text-center">
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
              <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
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
  training_months?: number;
  weekly_volume?: number;
  test_vdot?: number | null;
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
  };
  race_predictions: Record<string, string>;
}

const TIME_PLACEHOLDERS: Record<string, string> = {
  "5K": "es. 25:00",
  "10K": "es. 52:00",
  "Half Marathon": "es. 1:55:00",
  "Marathon": "es. 4:10:00",
};

type ModalPhase = 'input' | 'done';

function GeneratePlanModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<ModalPhase>('input');
  const [goalRace, setGoalRace] = useState("5K");
  const [weeksToRace, setWeeksToRace] = useState(12);
  const [targetTime, setTargetTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const handleGenerate = async () => {
    if (!targetTime.trim()) {
      setError("Inserisci il tempo obiettivo (mm:ss o h:mm:ss).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof generateTrainingPlan>[0] = {
        goal_race: goalRace,
        weeks_to_race: weeksToRace,
        target_time: targetTime.trim(),
      };
      const res = await generateTrainingPlan(params);
      setResult(res as unknown as GenerateResult);
      setPhase('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore nella generazione del piano.");
    } finally {
      setLoading(false);
    }
  };

  const handleChoose = async (mode: 'conservative' | 'aggressive') => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof generateTrainingPlan>[0] = {
        goal_race: goalRace,
        weeks_to_race: weeksToRace,
        target_time: targetTime.trim(),
        plan_mode: mode,
      };
      const res = await generateTrainingPlan(params);
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#2A2A2A] shrink-0">
          <h2 className="text-xl font-bold text-white mb-1">
            'Genera Piano di Allenamento'
          </h2>
          <p className="text-gray-500 text-sm mb-3">
            'Piano scientifico — Daniels VDOT + storia completa dell\'atleta.'
          </p>
          {phase === 'input' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-[11px] text-blue-300 leading-relaxed">
                <span className="font-bold uppercase mr-1">Auto-Adapt:</span>
                Ogni sync da Strava ricalcola il tuo VDOT e aggiorna i passi futuri automaticamente.
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
            </>
          )}


          {/* ── PHASE: DONE ── */}
          {phase === 'done' && result && (
            <div className="space-y-4">
              {/* VDOT Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4 text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">VDOT Attuale</div>
                  <div className="text-3xl font-bold text-white">{result.current_vdot}</div>
                  {result.test_vdot && <div className="text-[9px] text-[#C0FF00] mt-0.5">calibrato da test</div>}
                </div>
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4 text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">VDOT Target</div>
                  <div className="text-3xl font-bold text-[#3B82F6]">{result.target_vdot}</div>
                </div>
              </div>

              {/* Peak context */}
              {result.peak_vdot && result.peak_vdot !== result.current_vdot && (
                <div className="flex items-center gap-2 text-[10px] text-gray-500 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2">
                  <span>Picco storico: <strong className="text-[#8B5CF6]">{result.peak_vdot}</strong></span>
                  {result.peak_date && (
                    <span>({new Date(result.peak_date).toLocaleDateString('it', { month: 'short', year: 'numeric' })})</span>
                  )}
                  {result.feasibility.is_recovery && <span className="text-[#8B5CF6] font-bold">· Recovery Mode</span>}
                </div>
              )}

              {/* Gap indicator */}
              <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">Progressione richiesta</span>
                  <span className={`text-sm font-bold ${feasColor}`}>
                    +{Math.max(0, result.target_vdot - result.current_vdot).toFixed(1)} VDOT
                  </span>
                </div>
                <div className="w-full h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981] transition-all"
                    style={{ width: `${Math.min(100, result.feasibility.confidence_pct)}%` }}
                  />
                </div>
                <p className={`text-xs mt-2 ${feasColor}`}>{result.feasibility.message}</p>
              </div>

              {/* Race predictions */}
              {Object.keys(result.race_predictions).length > 0 && (
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Previsioni a VDOT {result.target_vdot}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.race_predictions).map(([dist, time]) => (
                      <div key={dist} className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                        dist === goalRace ? 'bg-[#3B82F6]/10 border border-[#3B82F6]/30' : 'bg-[#1E1E1E]'
                      }`}>
                        <span className="text-xs text-gray-400">{dist}</span>
                        <span className={`text-sm font-mono font-bold ${dist === goalRace ? 'text-[#3B82F6]' : 'text-white'}`}>
                          {time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success probability when infeasible */}
              {!result.feasibility.feasible && (
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
              onClose(); if (phase === 'done') onDone();
            }}
            className="flex-1 py-3 rounded-lg bg-[#121212] border border-[#2A2A2A] text-gray-400 hover:text-white transition-colors text-sm font-medium"
          >
            {phase === 'done' ? 'Chiudi' : 'Annulla'}
          </button>
          {phase === 'input' && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 py-3 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <span>Analizzando…</span> : <><Sparkles className="w-4 h-4" /> Genera Piano</>}
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'Day' | 'Week' | 'Month' | 'Year'>('Year');
  const [previousView, setPreviousView] = useState<'Week' | 'Month' | 'Year' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showAdaptModal, setShowAdaptModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  const goToDay = (date: Date, fromView: 'Week' | 'Month' | 'Year') => {
    setCurrentDate(date);
    setPreviousView(fromView);
    setView('Day');
  };

  const goBack = () => {
    setView(previousView ?? 'Month');
    setPreviousView(null);
  };

  const { data: planData, refetch: refetchPlan } = useApi<TrainingPlanResponse>(getTrainingPlan);

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

  const getSession = (year: number, month: number, day: number): Session | undefined => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return sessionMap[key];
  };

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
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

            return (
              <div
                key={`${year}-${month}-${day}`}
                className="bg-[#181818] min-h-[120px] p-2 flex flex-col group hover:bg-[#1E1E1E] transition-colors cursor-pointer"
                onClick={() => goToDay(new Date(year, month, day), 'Month')}
              >
                <span className={`text-sm font-medium mb-2 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-[#3B82F6] text-white' : 'text-gray-400'}`}>
                  {day}
                </span>
                {display && (
                  <div
                    className={`flex-1 rounded-md p-2 border-l-4 bg-[#121212] flex flex-col gap-1 ${display.completed ? 'opacity-60' : ''}`}
                    style={{ borderLeftColor: display.color }}
                  >
                    <span className="text-xs font-bold text-gray-200">{display.title}</span>
                    <span className="text-[10px] text-gray-400 line-clamp-2 leading-tight">{display.details.join(' · ')}</span>
                    {display.completed && <span className="text-[10px] text-[#10B981]">✓ Completata</span>}
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
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={date.toISOString()}
                className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 flex flex-col cursor-pointer hover:border-gray-500 transition-colors"
                onClick={() => goToDay(date, 'Week')}
              >
                <div className="text-center mb-6 pb-4 border-b border-[#2A2A2A]">
                  <div className="text-xs font-semibold text-gray-500 tracking-wider mb-2">{dayNames[date.getDay()]}</div>
                  <div className={`text-2xl font-bold mx-auto w-10 h-10 flex items-center justify-center rounded-full ${isToday ? 'bg-[#3B82F6] text-white' : 'text-gray-200'}`}>
                    {date.getDate()}
                  </div>
                </div>

                {display ? (
                  <div className={`flex-1 rounded-lg p-4 border-t-4 bg-[#121212] flex flex-col gap-3 ${display.completed ? 'opacity-60' : ''}`} style={{ borderTopColor: display.color }}>
                    <span className="text-sm font-bold text-gray-200 uppercase tracking-wider">{display.title}</span>
                    <div className="flex flex-col gap-2">
                      {display.details.map((d, i) => (
                        <span key={i} className="text-xs text-gray-400 bg-[#1E1E1E] px-2 py-1.5 rounded">{d}</span>
                      ))}
                    </div>
                    {display.completed && <span className="text-xs text-[#10B981] mt-auto">✓ Completata</span>}
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

  // ── Day View ────────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const session = getSession(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const display = toDisplay(session);

    return (
      <div className="h-full flex items-start justify-center pt-10">
        <div className="w-full max-w-2xl bg-[#181818] border border-[#2A2A2A] rounded-2xl p-8 shadow-2xl">
          {/* Back button */}
          {previousView && (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 group transition-colors"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Torna a {previousView === 'Month' ? 'Mese' : previousView === 'Week' ? 'Settimana' : 'Anno'}</span>
            </button>
          )}
          <h2 className="text-3xl font-bold text-white mb-8 text-center capitalize">
            {currentDate.toLocaleDateString('it-IT', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>

          {display ? (
            <div className={`rounded-xl p-8 border-l-4 bg-[#121212] ${display.completed ? 'opacity-75' : ''}`} style={{ borderLeftColor: display.color }}>
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#2A2A2A]">
                <h3 className="text-2xl font-bold text-gray-200">{display.title}</h3>
                <span className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                  display.completed
                    ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                    : 'bg-[#1E1E1E] border-[#2A2A2A] text-gray-300'
                }`}>
                  {display.completed ? '✓ Completata' : 'Programmata'}
                </span>
              </div>

              <p className="text-gray-300 leading-relaxed mb-6">{display.description}</p>

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
      </div>
    );
  };

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
              className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-5 cursor-pointer hover:border-gray-500 transition-colors"
              onClick={() => { const d = new Date(currentDate); d.setMonth(month); setCurrentDate(d); setView('Month'); }}
            >
              <h3 className="text-sm font-bold text-gray-200 mb-4 uppercase tracking-wider">{monthNames[month]} {year}</h3>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
                  const session = getSession(year, month, day);
                  const display = toDisplay(session);
                  return (
                    <div
                      key={`${year}-${month}-${day}`}
                      className="aspect-square rounded-sm"
                      style={{
                        backgroundColor: display ? display.color : '#2A2A2A',
                        opacity: display ? (display.completed ? 0.5 : 0.9) : 0.3,
                      }}
                      title={display ? `${day} ${monthNames[month]}: ${display.title}` : `${day} ${monthNames[month]}`}
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
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Training Menu</h1>
          {hasPlan && (() => {
            const firstW = planData!.weeks[0];
            const lastW = planData!.weeks[planData!.weeks.length - 1];
            return (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 bg-[#1E1E1E] border border-[#2A2A2A] px-3 py-1 rounded-full">
                  {planData!.weeks.length} sett. · {firstW?.phase}
                </span>
                {firstW?.target_vdot && lastW?.target_vdot && (
                  <span className="text-xs text-[#3B82F6] bg-[#3B82F6]/10 border border-[#3B82F6]/20 px-3 py-1 rounded-full font-mono">
                    VDOT {firstW.target_vdot} → {lastW.target_vdot}
                  </span>
                )}
                {firstW?.goal_race && firstW?.target_time && (
                  <span className="text-xs text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 px-3 py-1 rounded-full">
                    🎯 {firstW.goal_race} in {firstW.target_time}
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        <div className="flex items-center gap-4">
          {hasPlan && (
            <button
              type="button"
              onClick={() => setShowTestModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm font-medium rounded-lg transition-colors"
            >
              <Timer className="w-4 h-4" />
              Test
            </button>
          )}
          {hasPlan && (
            <button
              type="button"
              onClick={() => setShowAdaptModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-colors"
            >
              <Zap className="w-4 h-4" />
              Adatta Piano
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Genera Piano
          </button>

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
      {!hasPlan && planData !== null && (
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

      {/* Calendar */}
      {(hasPlan || planData === null) && (
        <div className="flex-1 overflow-auto p-6">
          {view === 'Month' && renderMonthView()}
          {view === 'Week' && renderWeekView()}
          {view === 'Day' && renderDayView()}
          {view === 'Year' && renderYearView()}
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

      {/* Test Modal */}
      {showTestModal && (
        <EvaluateTestModal
          onClose={() => setShowTestModal(false)}
          onDone={() => { setShowTestModal(false); refetchPlan(); }}
        />
      )}
    </div>
  );
}
