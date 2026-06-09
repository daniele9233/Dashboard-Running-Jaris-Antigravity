import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Trophy, Zap, Gauge, Wind, Route, CalendarDays, TrendingUp, Clock,
  Thermometer, Droplets, Mountain, CheckCircle2, Loader2, Activity, RotateCcw,
  Sun, Snowflake,
} from "lucide-react";
import { evaluateSub20Session, type Sub20EvalResult } from "../api";

/**
 * kikkoderisoSub20 — Piano 5K sub-20:00 (Piano_5K_sub20.pdf, Daniele Pascolini).
 *
 * 9 settimane in 3 blocchi + taper. Ritmo gara 4:00/km, obiettivo 19:59.
 * Soglia-centrico. La settimana in corso è dettagliata e tracciabile (chip di
 * completamento + auto-valutazione delle sedute di qualità contro Strava).
 */

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE — codifica semantica dei 4 tipi di seduta (usata in tutta la sezione)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  qualita: "#FB7185", // VO2max / ritmo gara — sforzo brillante
  soglia: "#C0FF00",  // il motore della 5K — accento del piano
  facolt: "#94A3B8",  // facoltativa — defilata
  lungo: "#38BDF8",   // base aerobica — calma, lunga
  good: "#34D399",
};

type DayKey = "qualita" | "soglia" | "facolt" | "lungo";

const DAY_TYPES: {
  key: DayKey; day: string; label: string; tag: string; when: string;
  color: string; Icon: typeof Zap;
}[] = [
  { key: "qualita", day: "Martedì", label: "Qualità", tag: "VO2max e ritmo gara", when: "all'alba", color: C.qualita, Icon: Zap },
  { key: "soglia", day: "Giovedì", label: "Soglia", tag: "Il motore della 5K", when: "all'alba", color: C.soglia, Icon: Gauge },
  { key: "facolt", day: "Venerdì", label: "Facoltativa", tag: "3–4 km lenti sul tapis", when: "solo se fresco", color: C.facolt, Icon: Wind },
  { key: "lungo", day: "Domenica", label: "Lungo", tag: "Facile, base aerobica", when: "in conversazione", color: C.lungo, Icon: Route },
];
const DT: Record<DayKey, (typeof DAY_TYPES)[number]> = Object.fromEntries(
  DAY_TYPES.map((d) => [d.key, d]),
) as Record<DayKey, (typeof DAY_TYPES)[number]>;

const PACES: { label: string; val: string; unit: string; key?: boolean }[] = [
  { label: "Recupero / facile", val: "5:30–6:00", unit: "/km" },
  { label: "Lungo facile", val: "5:25–5:50", unit: "/km" },
  { label: "Soglia (inizio → fine)", val: "4:32 → 4:15", unit: "/km", key: true },
  { label: "Ritmo gara 5K", val: "4:00", unit: "/km", key: true },
  { label: "VO2max / 800 veloci", val: "3:52–3:58", unit: "/km" },
  { label: "Allunghi", val: "brillanti, progressivi", unit: "" },
];

interface Session {
  id: string;
  day: string;
  date: string;       // ISO, giorno reale di default
  type: DayKey;
  title: string;
  note?: string;
  eval?: { reps: number; rep_m: number; targetSec: number; label: string };
}

const WEEK: { range: string; volume: string; sessions: Session[] } = {
  range: "9 → 14 giugno",
  volume: "~30 km",
  sessions: [
    {
      id: "cur-qualita", day: "Mar 9/6", date: "2026-06-09", type: "qualita",
      title: "2 km riscaldamento, poi 3×1000 @ 3:56 (GAP), 3 km defaticamento.",
      eval: { reps: 3, rep_m: 1000, targetSec: 236, label: "3×1000 @ 3:56" },
    },
    {
      id: "cur-soglia", day: "Gio 11/6", date: "2026-06-11", type: "soglia",
      title: "2 km facili + 3–4 allunghi (80–100 m), poi 3×1500 @ 4:30–4:32 con rec 90″ jog, 1,5 km defaticamento (~8 km).",
      note: "Passo comodo-duro: a fine di ogni 1500 devi sentirti capace di farne un altro. Sotto 4:25 stai correndo VO2max, non soglia: rallenta.",
      eval: { reps: 3, rep_m: 1500, targetSec: 271, label: "3×1500 @ 4:31" },
    },
    {
      id: "cur-facolt", day: "Ven 12/6", date: "2026-06-12", type: "facolt",
      title: "3–4 km molto lenti sul tapis roulant (5:40–6:00).",
      note: "Solo se arrivi fresco. Nel dubbio salta, non perdi nulla.",
    },
    {
      id: "cur-lungo", day: "Dom 14/6", date: "2026-06-14", type: "lungo",
      title: "11–12 km facili (5:25–5:50), tutto in conversazione.",
      note: "4–5 allunghi rilassati a fine corsa.",
    },
  ],
};

const BLOCKS: { n: number; name: string; weeks: string; theme: string; color: string; rows: [string, string][] }[] = [
  {
    n: 1, name: "Blocco 1", weeks: "Sett. 1–3 · 9 · 16 · 23 giugno", theme: "Struttura e base soglia", color: C.soglia,
    rows: [
      ["Soglia", "4:32 → 4:28 → 4:25 · volume 20–24′ (3×1500 → 4×1500 o 2×12′)"],
      ["Martedì", "alterna 5–6×800 @ 3:55 (rec 90″) e 4×1000 @ 4:00 (rec 2′)"],
      ["Lungo", "12 → 13 km facili"],
    ],
  },
  {
    n: 2, name: "Blocco 2", weeks: "Sett. 4–6 · 30 giu · 7 · 14 luglio", theme: "Affilare la soglia e specificità", color: C.lungo,
    rows: [
      ["Soglia", "4:22 → 4:18 → 4:15 · fino a 26–28′"],
      ["Martedì", "6×800 @ 3:52 · 5×1000 @ 3:58 · primo ritmo gara 2×2000 @ 4:00"],
      ["Lungo", "13–14 km, qualcuno con finale steady (ultimi 3 km ~4:55)"],
    ],
  },
  {
    n: 3, name: "Blocco 3", weeks: "Sett. 7–9 · 21 · 28 lug · 4 agosto", theme: "Specifico 5K", color: C.qualita,
    rows: [
      ["Soglia", "mantenimento ~4:15 (non si spinge all'infinito)"],
      ["Ritmo gara", "5×1000 @ 3:58 · 4×1200 @ 4:00 · 3×1600 @ 4:00 · 5K spezzata 3000+2000 @ 4:00"],
      ["Test", "a metà blocco: 3 km a tutta o 5K vera, per tarare la forma"],
      ["Lungo", "12–13 km facili"],
    ],
  },
];
const TAPER = {
  body: "Volume −30/40%, una spruzzata di intensità (3–4×400 @ ritmo gara), poi gara.",
};

const SIGNALS = [
  "A pari passo di soglia, la frequenza che scende settimana dopo settimana (es. 4:30/km da 170 a 164 bpm): il motore cresce.",
  "La soglia che, a parità di frequenza, diventa più veloce.",
  "Gli adattamenti si vedono su 8–16 settimane, non giorno per giorno.",
];

const PRINCIPLE =
  "La soglia è il motore. Per correre i 1000 di gara a 4:00/km devi abbassare la soglia da ~4:30 a ~4:15/km. Il grosso del lavoro va su soglia e fondo aerobico: le ripetute a ritmo gara sono il collaudo finale, non il termometro.";

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE + eval helpers
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "metic:kikkoderiso-sub20:scores:v2";
const QUAL_DATES_KEY = "metic:kikkoderiso-sub20:qualdates:v2";
const EVALS_KEY = "metic:kikkoderiso-sub20:evals:v2";
const MANUAL_WX_KEY = "metic:kikkoderiso-sub20:manualwx:v2";

const PCT_OPTIONS = [0, 50, 70, 90, 100];

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function pctColor(pct: number): string {
  if (pct >= 100) return C.good;
  if (pct >= 70) return C.soglia;
  if (pct >= 50) return "#F59E0B";
  if (pct > 0) return "#F97316";
  return "#3A3A3A";
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

const VERDICT: Record<string, { label: string; color: string }> = {
  AVANTI: { label: "AVANTI", color: C.good },
  IN_LINEA: { label: "IN LINEA", color: C.soglia },
  INDIETRO: { label: "INDIETRO", color: "#FB7185" },
  ND: { label: "N/D", color: "#6B7280" },
};

type ScoreMap = Record<string, number>;
type ManualWx = { temp?: number; hum?: number };

// ─────────────────────────────────────────────────────────────────────────────
// Section shell — header consistente, corpo libero (no card-grid ripetute)
// ─────────────────────────────────────────────────────────────────────────────
function Section({ icon, kicker, title, accent = "#C0FF00", children, aside }: {
  icon: React.ReactNode; kicker: string; title: string; accent?: string;
  children: React.ReactNode; aside?: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex items-end justify-between gap-4 mb-3.5">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.28em] uppercase" style={{ color: accent }}>
            {icon} {kicker}
          </div>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">{title}</h2>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function KikkoderisoSub20() {
  const [scores, setScores] = useState<ScoreMap>(() => loadJson(STORAGE_KEY, {}));
  const [qualDates, setQualDates] = useState<Record<string, string>>(() => loadJson(QUAL_DATES_KEY, {}));
  const [evals, setEvals] = useState<Record<string, Sub20EvalResult>>(() => loadJson(EVALS_KEY, {}));
  const [manualWx, setManualWx] = useState<Record<string, ManualWx>>(() => loadJson(MANUAL_WX_KEY, {}));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores)); } catch { /* quota */ } }, [scores]);
  useEffect(() => { try { window.localStorage.setItem(QUAL_DATES_KEY, JSON.stringify(qualDates)); } catch { /* quota */ } }, [qualDates]);
  useEffect(() => { try { window.localStorage.setItem(EVALS_KEY, JSON.stringify(evals)); } catch { /* quota */ } }, [evals]);
  useEffect(() => { try { window.localStorage.setItem(MANUAL_WX_KEY, JSON.stringify(manualWx)); } catch { /* quota */ } }, [manualWx]);

  const setScore = useCallback((id: string, pct: number) => {
    setScores((prev) => {
      const next = { ...prev };
      if (prev[id] === pct) delete next[id];
      else next[id] = pct;
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    if (window.confirm("Azzerare il completamento della settimana?")) setScores({});
  }, []);

  const { weekPct, doneCount } = useMemo(() => {
    const s = WEEK.sessions;
    const sum = s.reduce((a, x) => a + (scores[x.id] ?? 0), 0);
    return { weekPct: Math.round(sum / s.length), doneCount: s.filter((x) => (scores[x.id] ?? 0) > 0).length };
  }, [scores]);

  const evaluate = useCallback(async (s: Session) => {
    if (!s.eval) return;
    setBusyKey(s.id);
    setOpenKey(s.id);
    const mwx = manualWx[s.id] || {};
    try {
      const res = await evaluateSub20Session({
        date: qualDates[s.id] ?? s.date,
        reps: s.eval.reps, rep_m: s.eval.rep_m, target_pace_sec: s.eval.targetSec,
        window_days: 2, manual_temp_c: mwx.temp, manual_humidity: mwx.hum,
      });
      setEvals((prev) => ({ ...prev, [s.id]: res }));
    } catch {
      setEvals((prev) => ({ ...prev, [s.id]: { matched: false, error: "network" } }));
    } finally {
      setBusyKey(null);
    }
  }, [qualDates, manualWx]);

  const progress = useMemo(() => {
    const byId: Record<string, Session> = Object.fromEntries(WEEK.sessions.map((s) => [s.id, s]));
    const items = Object.entries(evals)
      .map(([id, r]) => ({ id, label: byId[id]?.eval?.label ?? id, r }))
      .filter((x) => x.r.matched && x.r.vdot_implied != null)
      .sort((a, b) => (a.r.run_date || "").localeCompare(b.r.run_date || ""));
    if (items.length === 0) return null;
    const first = items[0].r.vdot_implied as number;
    const last = items[items.length - 1].r.vdot_implied as number;
    return { items, first, last, delta: +(last - first).toFixed(1), count: items.length };
  }, [evals]);

  return (
    <div className="flex-1 overflow-auto bg-[#101010]">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-8 space-y-12">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <header className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-[11px] font-black tracking-[0.32em] text-[#C0FF00] uppercase">
              <Trophy className="w-4 h-4" /> Piano 5K · sub 20:00
            </div>
            <button
              type="button" onClick={resetAll} title="Azzera completamento settimana"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-[10px] font-black tracking-widest text-gray-500 hover:text-[#FB7185] hover:border-[#FB7185]/30 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> RESET
            </button>
          </div>

          <h1 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight text-white leading-[1.05]">
            Cinque chilometri<br className="hidden sm:block" /> in <span className="text-[#C0FF00]">19:59</span>
          </h1>
          <p className="mt-3 text-sm font-semibold text-gray-400">
            Ritmo gara 4:00/km · Daniele Pascolini · 9 giugno → inizio settembre 2026
          </p>

          <p className="mt-6 max-w-[68ch] text-[15px] leading-relaxed text-gray-300">
            {PRINCIPLE}
          </p>
        </header>

        {/* ── LA SETTIMANA TIPO ─────────────────────────────────────────── */}
        <Section
          icon={<CalendarDays className="w-3.5 h-3.5" />}
          kicker="Sempre lo stesso ritmo"
          title="La settimana tipo"
          aside={<span className="hidden sm:block text-[11px] text-gray-500 max-w-[20ch] text-right leading-snug">Qualità distanziate almeno 48h. Volume ~30 km, fino a 35–40 nei blocchi avanzati.</span>}
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
            {DAY_TYPES.map((d) => {
              const Icon = d.Icon;
              return (
                <div key={d.key} className="flex items-center gap-4 px-4 sm:px-5 py-3.5">
                  <div className="grid place-items-center w-10 h-10 rounded-xl shrink-0" style={{ background: `${d.color}1A`, color: d.color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="w-20 sm:w-24 shrink-0">
                    <div className="text-sm font-black text-white">{d.day}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-black tracking-widest uppercase" style={{ color: d.color }}>{d.label}</span>
                    <div className="text-[13px] text-gray-400 truncate">{d.tag}</div>
                  </div>
                  <div className="hidden sm:block text-[11px] font-semibold text-gray-500 italic shrink-0">{d.when}</div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── RITMI ─────────────────────────────────────────────────────── */}
        <Section icon={<Gauge className="w-3.5 h-3.5" />} kicker="A che velocità" title="I ritmi di riferimento">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-0 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-2">
            {PACES.map((p) => (
              <div
                key={p.label}
                className="flex items-baseline justify-between gap-3 py-3 border-b border-white/[0.05] last:border-0 sm:[&:nth-last-child(2)]:border-0"
              >
                <span className={`text-[13px] ${p.key ? "font-bold text-white" : "text-gray-400"}`}>{p.label}</span>
                <span className="flex items-baseline gap-1 shrink-0">
                  <span className="font-mono text-sm font-black tabular-nums" style={{ color: p.key ? C.soglia : "#D1D5DB" }}>{p.val}</span>
                  {p.unit && <span className="text-[10px] text-gray-600">{p.unit}</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] text-gray-500">
            <span className="font-bold text-[#C0FF00]">Soglia</span> e <span className="font-bold text-[#C0FF00]">ritmo gara</span> sono i due perni: tutto il resto li serve.
          </p>
        </Section>

        {/* ── SETTIMANA IN CORSO (interattiva) ──────────────────────────── */}
        <Section
          icon={<Activity className="w-3.5 h-3.5" />}
          kicker={`${WEEK.range} · ${WEEK.volume}`}
          title="Settimana in corso"
          aside={
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-24 sm:w-32 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${weekPct}%`, background: pctColor(weekPct) }} />
              </div>
              <span className="text-xs font-black tabular-nums w-12 text-right" style={{ color: pctColor(weekPct) }}>
                {doneCount}/{WEEK.sessions.length}
              </span>
            </div>
          }
        >
          <div className="space-y-3">
            {WEEK.sessions.map((s) => {
              const d = DT[s.type];
              const Icon = d.Icon;
              const score = scores[s.id];
              const isSet = score !== undefined;
              const ev = evals[s.id];
              const busy = busyKey === s.id;
              const open = openKey === s.id && !!ev;
              return (
                <div key={s.id} className="rounded-2xl border border-white/10 bg-[#181818] overflow-hidden">
                  {/* head */}
                  <div className="flex items-center gap-3 px-4 sm:px-5 pt-4">
                    <div className="grid place-items-center w-9 h-9 rounded-lg shrink-0" style={{ background: `${d.color}1A`, color: d.color }}>
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{s.day}</span>
                        <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: d.color }}>{d.label}</span>
                      </div>
                    </div>
                    {isSet && (
                      <span className="ml-auto text-[10px] font-black tracking-wider px-2 py-0.5 rounded-md" style={{ color: pctColor(score), background: `${pctColor(score)}1A` }}>
                        {score === 100 ? "FATTA" : score === 0 ? "SALTATA" : `${score}%`}
                      </span>
                    )}
                  </div>

                  {/* body */}
                  <div className="px-4 sm:px-5 pt-2 pb-4">
                    <p className="text-[14px] leading-relaxed text-gray-200">{s.title}</p>
                    {s.note && <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">{s.note}</p>}

                    {/* completion chips */}
                    <div className="mt-3.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold tracking-wider text-gray-600 uppercase mr-1">Esito</span>
                      {PCT_OPTIONS.map((p) => {
                        const active = isSet && score === p;
                        const label = p === 0 ? "salta" : p === 100 ? "✓" : `${p}`;
                        const col = p === 0 ? "#F97316" : pctColor(p);
                        return (
                          <button
                            key={p} type="button" onClick={() => setScore(s.id, p)}
                            title={p === 0 ? "Saltata" : p === 100 ? "Riuscita al 100%" : `Riuscita al ${p}%`}
                            className="min-w-[34px] px-2 py-1 rounded-lg text-[11px] font-black tracking-wide transition-all"
                            style={{
                              background: active ? col : "rgba(255,255,255,0.04)",
                              color: active ? "#0A0A0A" : "#9CA3AF",
                              border: `1px solid ${active ? col : "rgba(255,255,255,0.07)"}`,
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* auto-eval (solo sedute di qualità: hanno reps@pace) */}
                    {s.eval && (
                      <div className="mt-3.5 pt-3.5 border-t border-white/[0.06]">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: d.color }}>
                            <Zap className="w-3.5 h-3.5" /> Confronto con Strava
                          </span>
                          <label className="flex items-center gap-1 text-[11px] text-gray-400" title="Giorno reale della seduta">
                            <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                            <input
                              type="date" value={qualDates[s.id] ?? s.date}
                              onChange={(e) => setQualDates((p) => ({ ...p, [s.id]: e.target.value }))}
                              className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-[#C0FF00]/40 [color-scheme:dark]"
                            />
                          </label>
                          <label className="flex items-center gap-1 text-[11px] text-gray-400" title="Temperatura reale (es. valore Strava). Vuoto = meteo automatico.">
                            <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                            <input
                              type="number" step="0.1" inputMode="decimal" placeholder="auto"
                              value={manualWx[s.id]?.temp ?? ""}
                              onChange={(e) => setManualWx((p) => ({ ...p, [s.id]: { ...p[s.id], temp: e.target.value === "" ? undefined : parseFloat(e.target.value) } }))}
                              className="w-14 bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-amber-400/40"
                            />
                            <span className="text-gray-500">°C</span>
                          </label>
                          <label className="flex items-center gap-1 text-[11px] text-gray-400" title="Umidità reale">
                            <Droplets className="w-3.5 h-3.5 text-sky-400" />
                            <input
                              type="number" step="1" min="0" max="100" inputMode="numeric" placeholder="auto"
                              value={manualWx[s.id]?.hum ?? ""}
                              onChange={(e) => setManualWx((p) => ({ ...p, [s.id]: { ...p[s.id], hum: e.target.value === "" ? undefined : parseFloat(e.target.value) } }))}
                              className="w-12 bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-sky-400/40"
                            />
                            <span className="text-gray-500">%</span>
                          </label>
                          <button
                            type="button" onClick={() => evaluate(s)} disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide border border-[#C0FF00]/30 bg-[#C0FF00]/10 text-[#C0FF00] hover:bg-[#C0FF00]/20 transition-colors disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            {busy ? "Analizzo…" : ev ? "Rivaluta" : "Valuta"}
                          </button>
                          {ev && (
                            <button type="button" onClick={() => setOpenKey(open ? null : s.id)} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                              {open ? "nascondi" : "mostra"}
                            </button>
                          )}
                        </div>

                        {open && ev && (
                          ev.matched && ev.reps && ev.reps.length > 0 ? (
                            <EvalResultView ev={ev} target={s.eval.targetSec} onApply={(p) => setScore(s.id, p)} applied={scores[s.id]} />
                          ) : (
                            <p className="mt-3 text-[12px] text-gray-500 leading-relaxed">
                              {ev.error === "no_reps"
                                ? "Corsa trovata, ma non riconosco ripetute pulite (struttura continua o GPS rumoroso)."
                                : "Nessuna seduta di qualità in questo giorno. Imposta la data reale in cui l'hai corsa."}
                            </p>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* dove sono migliorato */}
          {progress && (
            <div className="mt-4 rounded-2xl border border-[#34D399]/25 bg-[#34D399]/[0.05] px-5 py-4">
              <div className="flex items-center gap-1.5 mb-3 text-[10px] font-black tracking-[0.22em] text-[#34D399] uppercase">
                <TrendingUp className="w-3.5 h-3.5" /> Dove sono migliorato
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white tabular-nums">{progress.first.toFixed(1)}</span>
                  <span className="text-gray-600">→</span>
                  <span className="text-2xl font-black text-white tabular-nums">{progress.last.toFixed(1)}</span>
                  <span className="text-[11px] text-gray-500 ml-1">VDOT implicito</span>
                  <span className="text-[11px] font-black ml-1" style={{ color: progress.delta >= 0 ? C.good : "#FB7185" }}>
                    {progress.delta >= 0 ? "+" : ""}{progress.delta}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {progress.items.map((it) => (
                    <span key={it.id} className="px-2.5 py-1 rounded-md border border-white/10 bg-white/[0.03] text-[10px] whitespace-nowrap">
                      <span className="text-gray-500">{it.label}</span>{" "}
                      <span className="font-black" style={{ color: VERDICT[it.r.verdict || "ND"].color }}>{fmtDelta(it.r.delta_sec)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── LA PROGRESSIONE (blocchi) ─────────────────────────────────── */}
        <Section icon={<TrendingUp className="w-3.5 h-3.5" />} kicker="9 settimane in 3 blocchi" title="La progressione">
          <ol className="space-y-3">
            {BLOCKS.map((b) => (
              <li key={b.n} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                  <span className="grid place-items-center w-7 h-7 rounded-lg text-sm font-black shrink-0" style={{ background: `${b.color}1A`, color: b.color }}>
                    {b.n}
                  </span>
                  <span className="text-base font-black text-white">{b.name}</span>
                  <span className="text-[11px] text-gray-500">{b.weeks}</span>
                  <span className="ml-auto text-[10px] font-black tracking-widest uppercase" style={{ color: b.color }}>{b.theme}</span>
                </div>
                <dl className="space-y-1.5 pl-10">
                  {b.rows.map(([k, v]) => (
                    <div key={k} className="flex flex-col sm:flex-row sm:gap-3">
                      <dt className="w-24 shrink-0 text-[11px] font-black tracking-wider uppercase text-gray-500">{k}</dt>
                      <dd className="text-[13px] text-gray-300 leading-relaxed">{v}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
            {/* taper */}
            <li className="rounded-2xl border border-dashed border-white/15 bg-transparent p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
                <span className="grid place-items-center w-7 h-7 rounded-lg shrink-0 bg-white/5 text-gray-400">
                  <Snowflake className="w-4 h-4" />
                </span>
                <span className="text-base font-black text-white">Taper</span>
                <span className="text-[11px] text-gray-500">settimana gara</span>
                <span className="ml-auto text-[10px] font-black tracking-widest uppercase text-gray-500">Scarico</span>
              </div>
              <p className="pl-10 text-[13px] text-gray-300 leading-relaxed">{TAPER.body}</p>
            </li>
          </ol>
        </Section>

        {/* ── SEGNALI ───────────────────────────────────────────────────── */}
        <Section icon={<CheckCircle2 className="w-3.5 h-3.5" />} kicker="Come capire se funziona" title="I segnali che contano">
          <ul className="grid gap-2.5 sm:grid-cols-3">
            {SIGNALS.map((sig, i) => (
              <li key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <Gauge className="w-4 h-4 text-[#C0FF00] mb-2" />
                <p className="text-[12.5px] leading-relaxed text-gray-300">{sig}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── NOTA GARA ─────────────────────────────────────────────────── */}
        <Section icon={<Sun className="w-3.5 h-3.5" />} kicker="Scegli il campo da gioco" title="Nota gara" accent="#F59E0B">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-5 space-y-3">
            <p className="text-[14px] leading-relaxed text-gray-200">
              La forma può maturare entro fine agosto, ma a Roma fine agosto significa caldo e umidità (19°, 85% UR) che valgono 3–5 sec/km. A inizio-metà settembre l'aria è più fresca e quei secondi tornano in tasca. Costruisci la forma per fine agosto, ma corri il giorno in cui il meteo ti dà la chance migliore, probabilmente inizio settembre.
            </p>
            <div className="flex items-start gap-2.5 rounded-xl bg-black/30 border border-white/[0.06] px-4 py-3">
              <Snowflake className="w-4 h-4 text-sky-300 mt-0.5 shrink-0" />
              <p className="text-[13px] leading-relaxed text-gray-300">
                <b className="text-white">Stima onesta:</b> PB ampio molto probabile (20:10–20:40). Il 19:59 secco è il bersaglio stretch, più alla portata in giornata fresca.
              </p>
            </div>
          </div>
        </Section>

        <p className="text-[11px] text-gray-600 leading-relaxed border-t border-white/[0.06] pt-5">
          Generato il 9 giugno 2026 · GAP = passo corretto per la pendenza (PBP su Strava) · piano indicativo, da adattare in base a forma e recupero.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Risultato auto-valutazione di una seduta
// ─────────────────────────────────────────────────────────────────────────────
function EvalResultView({ ev, target, onApply, applied }: {
  ev: Sub20EvalResult; target: number; onApply: (pct: number) => void; applied?: number;
}) {
  const v = VERDICT[ev.verdict || "ND"];
  const c = ev.conditions;
  return (
    <div className="mt-3.5 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="px-3 py-1.5 rounded-lg text-xs font-black tracking-widest" style={{ background: `${v.color}1A`, color: v.color, border: `1px solid ${v.color}55` }}>
          {v.label}
        </span>
        <div className="text-[12px] text-gray-300">
          Normalizzato <span className="text-gray-500">(PBP + temp ideale)</span>{" "}
          <b className="text-white">{fmtPace(ev.normalized_avg_sec)}</b> vs target{" "}
          <b className="text-white">{fmtPace(target)}</b> → <b style={{ color: v.color }}>{fmtDelta(ev.delta_sec)}</b>
        </div>
        {ev.vdot_implied != null && (
          <div className="text-[12px] text-gray-400">VDOT implicito <b className="text-[#C0FF00]">{ev.vdot_implied.toFixed(1)}</b></div>
        )}
        <div className="text-[11px] text-gray-600">{fmtDate(ev.run_date)} · grezzo {fmtPace(ev.avg_raw_sec)}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {ev.reps!.map((r, i) => (
          <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-gray-500 font-black tracking-wide">R{i + 1}</span>
              <span className="flex items-center gap-2 text-[10px] text-gray-500">
                {r.elev_m != null && (
                  <span className="flex items-center gap-0.5"><Mountain className="w-3 h-3 text-emerald-400" />{r.elev_m > 0 ? "+" : ""}{r.elev_m}m</span>
                )}
                {r.hr_avg != null && <span className="text-[#FB7185]">{r.hr_avg}bpm</span>}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span><span className="text-gray-500">grezzo </span><b className="text-white">{fmtPace(r.pace_sec)}</b></span>
              <span><span className="text-gray-500">PBP </span><b className="text-sky-300">{fmtPace(r.pbp_sec)}</b></span>
              <span><span className="text-gray-500">ideale </span><b className="text-[#34D399]">{fmtPace(r.ideal_sec)}</b></span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-gray-600">{ev.reps_done}/{ev.reps_prescribed} rep completate</div>

      <div className="text-[10px] text-gray-500 leading-relaxed rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <b className="text-gray-400">grezzo</b> = passo reale corso · <b className="text-sky-300">PBP</b> = passo in base alla pendenza (equivalente in piano: salita più veloce, discesa più lento) · <b className="text-[#34D399]">ideale</b> = a temperatura ottimale (~12°C) · <b className="text-white">normalizzato</b> = PBP + temp ideale, il valore con cui giudico AVANTI / INDIETRO.
      </div>

      {c && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
          {c.temp_c != null && (
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-400" />
              {c.temp_c}°C{c.apparent_c != null ? ` (perc. ${c.apparent_c}°)` : ""}
              <span className="text-gray-600">{c.temp_source === "manual" ? "· manuale" : c.temp_source === "strava_device" ? "· Garmin" : "· meteo"}</span>
            </span>
          )}
          {c.humidity != null && <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-sky-400" />{c.humidity}%</span>}
          <span className="flex items-center gap-1"><Mountain className="w-3 h-3 text-emerald-400" />{c.net_elev_m > 0 ? "+" : ""}{c.net_elev_m}m</span>
          {(c.grade_adj_sec !== 0 || c.heat_adj_sec !== 0) && (
            <span className="text-gray-500">credito: pendenza {c.grade_adj_sec > 0 ? "+" : ""}{c.grade_adj_sec}s · caldo −{c.heat_adj_sec}s</span>
          )}
        </div>
      )}

      {ev.adaptation && (
        <div className="flex items-start gap-2 text-[11px] text-gray-400 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <Clock className="w-3.5 h-3.5 text-[#C0FF00] mt-0.5 shrink-0" />
          <span>
            <b className="text-gray-200">Effetto sulla performance:</b> dal <b className="text-white">{fmtDate(ev.adaptation.peak_from)}</b> al <b className="text-white">{fmtDate(ev.adaptation.peak_to)}</b>. <span className="text-gray-500">{ev.adaptation.note}</span>
          </span>
        </div>
      )}

      {ev.suggested_pct != null && (
        <button
          type="button" onClick={() => onApply(ev.suggested_pct as number)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide border transition-colors"
          style={{
            borderColor: applied === ev.suggested_pct ? C.good : "rgba(192,255,0,0.3)",
            background: applied === ev.suggested_pct ? "#34D39922" : "rgba(192,255,0,0.08)",
            color: applied === ev.suggested_pct ? C.good : "#C0FF00",
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {applied === ev.suggested_pct ? `Applicato ${ev.suggested_pct}%` : `Applica ${ev.suggested_pct}% all'esito`}
        </button>
      )}
    </div>
  );
}
