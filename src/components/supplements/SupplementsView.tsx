import { useState, useMemo, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend } from "recharts";
import { Beaker, Zap, AlertTriangle, FlaskConical, Trophy, Calendar as CalendarIcon, Check, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getSupplementsConfig,
  updateSupplement,
  type SupplementId,
} from "../../api";

/**
 * SupplementsView — tracking start date + giornaliero + chart saturazione + protocollo PB.
 *
 * Modello scientifico:
 *  - Creatina 5g/die: S(t) = 1 - exp(-t / 9.5)  (Hultman 1996)
 *  - Beta-Alanina 4g/die: S(t) = 1 - exp(-t / 35)  (Harris 2006, Hill 2007)
 *
 * Day-tracking: checks giornalieri salvati su MongoDB (checked_days array per supplemento).
 * Il ring mostra saturazione teorica (data-based); la griglia settimanale mostra aderenza reale.
 */

interface SupplementDef {
  id: SupplementId;
  name: string;
  shortName: string;
  dose: string;
  color: string;
  defaultStartDate: string;
  tau: number;
  fullDays: number;
  source: string;
  description: string;
}

const SUPPLEMENTS: SupplementDef[] = [
  {
    id: "creatine",
    name: "Creatina monoidrato",
    shortName: "CREATINA",
    dose: "5 g/die",
    color: "#C0FF00",
    defaultStartDate: "2026-05-12",
    tau: 9.5,
    fullDays: 28,
    source: "Hultman 1996",
    description: "Saturazione fosfocreatina muscolare. Potenza neuromuscolare e recupero tra sforzi brevi-intensi.",
  },
  {
    id: "beta-alanine",
    name: "Beta-Alanina",
    shortName: "BETA-ALANINA",
    dose: "4 g/die",
    color: "#3B82F6",
    defaultStartDate: "2026-05-15",
    tau: 35,
    fullDays: 70,
    source: "Harris 2006, Hill 2007",
    description: "Accumulo carnosina muscolare. Tampone H⁺ negli sforzi 1-7 min ad alta intensità.",
  },
];

// Always use real today at midnight (no hardcoding)
const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

// ─── Profilo atleta + protocollo ──────────────────────────────────────────
const USER_WEIGHT_KG = 68;
const TARGET_DISTANCE_KM = 5;

function bicarbSpoons(grams: number): string {
  if (grams <= 0) return "0";
  if (grams <= 3.5) return "½ cucchiaino raso";
  if (grams <= 5.5) return "1 cucchiaino raso";
  if (grams <= 7.5) return "1 cucchiaino colmo";
  if (grams <= 10) return "1.5 cucchiaini rasi";
  if (grams <= 13) return "1 cucchiaio raso scarso";
  if (grams <= 16) return "1 cucchiaio raso";
  if (grams <= 18.5) return "1 cucchiaio raso abbondante";
  if (grams <= 22) return "1 cucchiaio colmo";
  return `${(grams / 15).toFixed(1)} cucchiai rasi`;
}

function bicarbDose(gPerKg: number, weightKg: number) {
  const grams = +(gPerKg * weightKg).toFixed(1);
  return { grams, spoons: bicarbSpoons(grams) };
}

// ─── Utilities ────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

function saturation(daysSinceStart: number, tau: number): number {
  if (daysSinceStart < 0) return 0;
  return 1 - Math.exp(-daysSinceStart / tau);
}

function dateForSaturation(target: number, start: Date, tau: number): Date {
  const t = -tau * Math.log(1 - target);
  const d = new Date(start);
  d.setDate(start.getDate() + Math.ceil(t));
  return d;
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString("it", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("it", { day: "2-digit", month: "short" });
}

// ─── State types ───────────────────────────────────────────────────────────

type StartDateMap = Record<SupplementId, string>;
type ChecksMap    = Record<SupplementId, Set<string>>;

const STORAGE_KEY = "metic-lab:supplements-config:v2";

function loadCachedConfig(): StartDateMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StartDateMap;
  } catch {
    return null;
  }
}

function saveCachedConfig(cfg: StartDateMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}

// ─── Main component ────────────────────────────────────────────────────────

export function SupplementsView() {
  const [startDates, setStartDates] = useState<StartDateMap>(() => {
    const cached = loadCachedConfig();
    if (cached) return cached;
    return {
      creatine:       SUPPLEMENTS[0].defaultStartDate,
      "beta-alanine": SUPPLEMENTS[1].defaultStartDate,
    };
  });

  const [checks, setChecks] = useState<ChecksMap>({
    creatine:       new Set(),
    "beta-alanine": new Set(),
  });

  const [weekOffset, setWeekOffset] = useState<Record<SupplementId, number>>({
    creatine:       0,
    "beta-alanine": 0,
  });

  const [saving, setSaving] = useState<Record<SupplementId, boolean>>({
    creatine: false,
    "beta-alanine": false,
  });
  const [savedFlash, setSavedFlash] = useState<Record<SupplementId, boolean>>({
    creatine: false,
    "beta-alanine": false,
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Carica config (start dates + checked_days) dal backend ───────────────
  useEffect(() => {
    let cancelled = false;
    getSupplementsConfig()
      .then((res) => {
        if (cancelled) return;
        const next: StartDateMap = {
          creatine:       res.supplements?.creatine?.start_date       ?? SUPPLEMENTS[0].defaultStartDate,
          "beta-alanine": res.supplements?.["beta-alanine"]?.start_date ?? SUPPLEMENTS[1].defaultStartDate,
        };
        setStartDates(next);
        saveCachedConfig(next);
        // Load daily checks
        setChecks({
          creatine:       new Set(res.supplements?.creatine?.checked_days       ?? []),
          "beta-alanine": new Set(res.supplements?.["beta-alanine"]?.checked_days ?? []),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load supplements config", err);
        setLoadError("Backend non raggiungibile. Modifiche locali non sincronizzate.");
      });
    return () => { cancelled = true; };
  }, []);

  // ── Update start date ─────────────────────────────────────────────────────
  const handleStartDateChange = useCallback(async (supId: SupplementId, newDate: string) => {
    setStartDates(prev => {
      const next = { ...prev, [supId]: newDate };
      saveCachedConfig(next);
      return next;
    });
    setSaving(prev => ({ ...prev, [supId]: true }));
    try {
      const res = await updateSupplement(supId, { start_date: newDate });
      const synced: StartDateMap = {
        creatine:       res.supplements?.creatine?.start_date       ?? newDate,
        "beta-alanine": res.supplements?.["beta-alanine"]?.start_date ?? newDate,
      };
      setStartDates(synced);
      saveCachedConfig(synced);
      setSavedFlash(prev => ({ ...prev, [supId]: true }));
      setTimeout(() => setSavedFlash(prev => ({ ...prev, [supId]: false })), 1800);
      setLoadError(null);
    } catch (err) {
      console.error("Failed to update supplement", err);
      setLoadError("Errore salvataggio. Riprova.");
    } finally {
      setSaving(prev => ({ ...prev, [supId]: false }));
    }
  }, []);

  // ── Toggle single day check (optimistic) ─────────────────────────────────
  const handleToggleDay = useCallback(async (
    supId: SupplementId,
    dateStr: string,
    currentlyChecked: boolean,
  ) => {
    const newChecked = !currentlyChecked;

    // Optimistic
    setChecks(prev => {
      const s = new Set(prev[supId]);
      if (newChecked) s.add(dateStr);
      else s.delete(dateStr);
      return { ...prev, [supId]: s };
    });

    try {
      await updateSupplement(supId, { check_date: dateStr, checked: newChecked });
    } catch (err) {
      console.error("Failed to toggle day", err);
      // Rollback
      setChecks(prev => {
        const s = new Set(prev[supId]);
        if (newChecked) s.delete(dateStr);
        else s.add(dateStr);
        return { ...prev, [supId]: s };
      });
    }
  }, []);

  // ── Week navigation ───────────────────────────────────────────────────────
  const handleWeekChange = useCallback((supId: SupplementId, offset: number) => {
    setWeekOffset(prev => ({ ...prev, [supId]: offset }));
  }, []);

  // ── Status corrente per ogni supplemento ─────────────────────────────────
  const currentStatus = useMemo(() => {
    return SUPPLEMENTS.map(sup => {
      const startStr = startDates[sup.id];
      const start = parseDate(startStr);
      const since = daysBetween(start, TODAY);
      const sat = saturation(since, sup.tau);
      const peak50 = dateForSaturation(0.5, start, sup.tau);
      const peak90 = dateForSaturation(0.9, start, sup.tau);
      const peakFull = new Date(start);
      peakFull.setDate(start.getDate() + sup.fullDays);

      const started = since >= 0;
      let phaseLabel = "DA INIZIARE";
      let phaseColor = "var(--app-text-muted)";
      if (started) {
        if (sat >= 0.9)      { phaseLabel = "SATURO";       phaseColor = sup.color; }
        else if (sat >= 0.5) { phaseLabel = "QUASI PIENO";  phaseColor = sup.color; }
        else if (sat >= 0.2) { phaseLabel = "LOADING";      phaseColor = sup.color; }
        else                 { phaseLabel = "AVVIO";        phaseColor = sup.color; }
      }

      const checkedCount      = checks[sup.id].size;
      const totalDays         = Math.max(0, since + 1);
      const adherencePct      = totalDays > 0 ? Math.min(100, Math.round((checkedCount / totalDays) * 100)) : 0;

      return {
        ...sup,
        startDate: startStr,
        startDateObj: start,
        daysSinceStart: since,
        saturation: sat,
        peak50Date: peak50,
        peak90Date: peak90,
        peakFullDate: peakFull,
        started,
        phaseLabel,
        phaseColor,
        checkedCount,
        totalDays,
        adherencePct,
      };
    });
  }, [startDates, checks]);

  // ── Chart saturazione ─────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const firstStart = SUPPLEMENTS.reduce((min, s) => {
      const d = parseDate(startDates[s.id]);
      return d < min ? d : min;
    }, parseDate(startDates[SUPPLEMENTS[0].id]));
    return Array.from({ length: 130 }, (_, i) => {
      const d = new Date(firstStart);
      d.setDate(firstStart.getDate() + i);
      const point: any = { date: fmtDate(d), day: i };
      for (const sup of SUPPLEMENTS) {
        const start = parseDate(startDates[sup.id]);
        const since = daysBetween(start, d);
        point[sup.id] = +(saturation(since, sup.tau) * 100).toFixed(1);
      }
      point.pbReady = Math.min(point.creatine, point["beta-alanine"]);
      return point;
    });
  }, [startDates]);

  const pbReadyDate = useMemo(() => {
    const found = chartData.find(p => p.pbReady >= 90);
    return found ? found.date : null;
  }, [chartData]);

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6" style={{ backgroundColor: "var(--app-bg)" }}>
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#C0FF00" }}>
          <FlaskConical className="w-6 h-6 text-black" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
            INTEGRAZIONE
          </h1>
          <p className="text-xs font-bold tracking-widest" style={{ color: "var(--app-text-muted)" }}>
            TRACKING SUPPLEMENTI · SATURAZIONE MUSCOLARE · PROTOCOLLO PB
          </p>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl px-4 py-3 text-sm border" style={{ color: "#F59E0B", borderColor: "#F59E0B40", backgroundColor: "#F59E0B10" }}>
          {loadError}
        </div>
      )}

      {/* ── Supplement Cards ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {currentStatus.map(sup => (
          <SupplementCard
            key={sup.id}
            sup={sup}
            saving={saving[sup.id]}
            savedFlash={savedFlash[sup.id]}
            onDateChange={(d) => handleStartDateChange(sup.id, d)}
            checks={checks[sup.id]}
            weekOffset={weekOffset[sup.id]}
            onToggleDay={(dateStr, currentlyChecked) => handleToggleDay(sup.id, dateStr, currentlyChecked)}
            onWeekChange={(offset) => handleWeekChange(sup.id, offset)}
          />
        ))}
      </section>

      {/* ── Saturation Chart ── */}
      <section
        className="rounded-2xl p-4 md:p-6 border"
        style={{ backgroundColor: "var(--app-bg-alt)", borderColor: "var(--app-border)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-black tracking-wide" style={{ color: "var(--app-text)" }}>
              CURVA SATURAZIONE MUSCOLARE
            </h2>
            <p className="text-[10px] font-bold tracking-widest mt-1" style={{ color: "var(--app-text-muted)" }}>
              MODELLO ESPONENZIALE · S(t) = 1 − e^(−t/τ)
            </p>
          </div>
          {pbReadyDate && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border self-start"
              style={{ borderColor: "#C0FF00", backgroundColor: "#C0FF001A" }}
            >
              <Trophy className="w-4 h-4" style={{ color: "#C0FF00" }} />
              <div>
                <div className="text-[9px] font-black tracking-widest" style={{ color: "var(--app-text-muted)" }}>
                  PB WINDOW DA
                </div>
                <div className="text-sm font-black" style={{ color: "#C0FF00" }}>
                  {formatDateLong(parseDate(pbReadyDate))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-[260px] md:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                stroke="#64748B"
                fontSize={10}
                tickFormatter={(v) => parseDate(v).toLocaleDateString("it", { day: "2-digit", month: "short" })}
                interval={Math.floor(chartData.length / 10)}
              />
              <YAxis stroke="#64748B" fontSize={10} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }}
                labelFormatter={(v) => formatDateLong(parseDate(v as string))}
                formatter={(value: number, name: string) => {
                  const label = name === "creatine" ? "Creatina" : name === "beta-alanine" ? "Beta-Alanina" : "PB-Ready";
                  return [`${value.toFixed(0)}%`, label];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                formatter={(value: string) => ({
                  "creatine": "Creatina",
                  "beta-alanine": "Beta-Alanina",
                  "pbReady": "PB-Ready (limitante)",
                }[value] ?? value)}
              />
              <ReferenceLine y={90} stroke="rgba(192,255,0,0.4)" strokeDasharray="4 4" label={{ value: "PB ready 90%", fill: "#C0FF00", fontSize: 9, position: "right" }} />
              <ReferenceLine x={fmtDate(TODAY)} stroke="rgba(255,255,255,0.3)" strokeDasharray="2 2" label={{ value: "OGGI", fill: "#fff", fontSize: 9, position: "top" }} />
              {pbReadyDate && (
                <ReferenceArea x1={pbReadyDate} x2={chartData[chartData.length - 1].date} fill="#C0FF00" fillOpacity={0.05} />
              )}
              <Line type="monotone" dataKey="creatine" stroke="#C0FF00" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="beta-alanine" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pbReady" stroke="#F43F5E" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── PB Protocol ── */}
      <section
        className="rounded-2xl p-4 md:p-6 border"
        style={{ backgroundColor: "var(--app-bg-alt)", borderColor: "#C0FF00", borderLeftWidth: "4px" }}
      >
        <div className="flex items-center gap-3 mb-1">
          <Trophy className="w-6 h-6" style={{ color: "#C0FF00" }} />
          <h2 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
            PROTOCOLLO PERSONAL BEST · {TARGET_DISTANCE_KM}K · {USER_WEIGHT_KG} KG
          </h2>
        </div>
        <p className="text-[11px] font-bold tracking-widest mb-6" style={{ color: "var(--app-text-muted)" }}>
          ✓ VERIFICATO SCIENTIFICAMENTE · ATTIVAZIONE DA {pbReadyDate ? formatDateLong(parseDate(pbReadyDate)).toUpperCase() : "—"}
        </p>

        {/* Phase 1 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: "#F43F5E" }} />
            <h3 className="text-sm font-black tracking-wider" style={{ color: "var(--app-text)" }}>
              FASE 1 — LOADING NITRATI · 4-5 GIORNI PRIMA
            </h3>
          </div>
          <div className="pl-3 space-y-2 text-sm" style={{ color: "var(--app-text)" }}>
            <p><strong style={{ color: "#F43F5E" }}>Amix Nitro Beet-Root-Max:</strong> 4 capsule/die (2000 mg estratto barbabietola).</p>
            <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
              Razionale: aumento NO₃⁻ → NO₂⁻ → NO via batteri orali. Migliora efficienza mitocondriale e riduce costo O₂ (~3% benefit su 5K — Lansley 2011, Cermak 2012).
            </p>
            <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
              Mantieni anche creatina 5 g/die e beta-alanina 4 g/die nel periodo loading.
            </p>
          </div>
        </div>

        {/* Phase 2 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
            <h3 className="text-sm font-black tracking-wider" style={{ color: "var(--app-text)" }}>
              FASE 2 — SERA PRIMA · ALCALINIZZAZIONE PREPARATORIA
            </h3>
          </div>
          <div className="pl-3 space-y-2 text-sm" style={{ color: "var(--app-text)" }}>
            <p>
              <strong style={{ color: "#F59E0B" }}>Mini-loading bicarbonato:</strong>{" "}
              <span style={{ color: "#F59E0B" }}>{bicarbDose(0.1, USER_WEIGHT_KG).grams} g</span>{" "}
              di NaHCO₃ (≈ <strong>{bicarbDose(0.1, USER_WEIGHT_KG).spoons}</strong>) in 300 ml acqua, dopo cena.
            </p>
            <p><strong style={{ color: "#F59E0B" }}>Carb-loading leggero:</strong> pasta 100-120 g + condimento povero di grassi/fibre. Idratazione abbondante (acqua + sali).</p>
            <p><strong style={{ color: "#F59E0B" }}>Beetroot:</strong> ultima dose 4 capsule (continui il loading di Fase 1).</p>
            <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
              Razionale: 0.1 g/kg predispone tampone ematico, riduce dose acuta del giorno gara e il rischio GI distress (Carr 2011, Mueller 2013).
            </p>
          </div>
        </div>

        {/* Phase 3 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: "#C0FF00" }} />
            <h3 className="text-sm font-black tracking-wider" style={{ color: "var(--app-text)" }}>
              FASE 3 — GIORNO GARA (PARTENZA H10:00)
            </h3>
          </div>
          <div className="space-y-3 pl-3">
            <TimelineRow
              time="H 07:30" delta="GARA −150 MIN" color="#C0FF00"
              title="Bicarbonato + Beetroot + colazione leggera"
              detail={[
                `NaHCO₃: ${bicarbDose(0.2, USER_WEIGHT_KG).grams} g (≈ ${bicarbDose(0.2, USER_WEIGHT_KG).spoons}) in 500-600 ml acqua, sorseggiato lentamente in 30 min.`,
                `⚠ Per 5K uso 0.2 g/kg invece di 0.3 g/kg: benefit ridotto su durata >15 min, ma rischio GI distress molto inferiore. Vince la sicurezza intestinale.`,
                "Amix Beet-Root-Max: 8 capsule (dose acuta).",
                "Colazione: 70-80 g CHO digeribili (es. 2 fette pane bianco + miele + 1 banana matura). Evita fibre, grassi, latticini.",
                "⚠ NESSUN COLLUTORIO — uccide batteri orali NO₃⁻ → NO₂⁻ e annulla il beetroot.",
              ]}
            />
            <TimelineRow
              time="H 09:00" delta="GARA −60 MIN" color="#22D3EE"
              title="Snack pre-gara + idratazione finale"
              detail={[
                "30-40 g CHO rapidi (gel + 200 ml acqua, o mezza banana). NO caffè se non testato.",
                "Caffeina opzionale: 3 mg/kg (≈ 200 mg per 68 kg) se ben tollerata. Picco 45-60 min.",
                "Ultima minzione consigliata.",
              ]}
            />
            <TimelineRow
              time="H 09:25" delta="GARA −35 MIN" color="#3B82F6"
              title="Riscaldamento completo (per 5K serve VO₂max attivo)"
              detail={[
                "10 min trotto progressivo (Z1 → Z2).",
                "5 min drills tecnici (skip, calcio dietro, balzi).",
                "4-6 allunghi 80-100 m a ritmo gara, recupero camminato.",
                "2 brevi tratti a ritmo gara (100-150 m) per attivare cinetica VO₂.",
                "Picco bicarbonato ematico raggiunto (60-90 min post-ingestione).",
              ]}
            />
            <TimelineRow
              time="H 09:55" delta="GARA −5 MIN" color="#A78BFA"
              title="Mental prep + posizionamento"
              detail={[
                "Visualizza pacing: km1 a ritmo gara (NO sparata), km 2-3 stabile, km 4-5 negative split.",
                "Posizionati nella griglia in base al tuo obiettivo, non più avanti.",
              ]}
            />
            <TimelineRow
              time="H 10:00" delta="START" color="#F43F5E"
              title="Partenza — strategia 5K"
              detail={[
                "Stato fisiologico: tampone H⁺ alto, NO ematico elevato, fosfocreatina e carnosina sature.",
                "Tattica: NON partire troppo forte. Primo 400 m max 2-3 sec/km sopra ritmo target.",
                "Km 3-4 è il collo di bottiglia mentale: tieni il ritmo, non mollare.",
                "Ultimi 800 m: la carnosina muscolare tampona H⁺ del finale → spingi forte gli ultimi 400 m.",
              ]}
            />
          </div>
        </div>

        {/* Dose reference */}
        <div className="rounded-xl p-4 mb-4 border" style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(192,255,0,0.2)" }}>
          <h4 className="text-xs font-black tracking-widest mb-3" style={{ color: "#C0FF00" }}>
            RIFERIMENTO DOSI BICARBONATO ({USER_WEIGHT_KG} KG)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {[
              { label: "SERA PRIMA · 0.1 g/kg", dose: bicarbDose(0.1, USER_WEIGHT_KG), color: "#F59E0B", highlight: false },
              { label: "GARA 5K · 0.2 g/kg (CONSIGLIATA)", dose: bicarbDose(0.2, USER_WEIGHT_KG), color: "#C0FF00", highlight: true },
              { label: "DOSE PIENA · 0.3 g/kg", dose: bicarbDose(0.3, USER_WEIGHT_KG), color: "var(--app-text-muted)", highlight: false },
            ].map(({ label, dose, color, highlight }) => (
              <div key={label} className="rounded-lg p-3" style={{ backgroundColor: "#111", outline: highlight ? "1px solid #C0FF0040" : undefined }}>
                <div className="text-[10px] font-bold tracking-wider mb-1" style={{ color: "var(--app-text-muted)" }}>{label}</div>
                <div className="text-base font-black" style={{ color }}>{dose.grams} g</div>
                <div className="text-[11px] mt-1" style={{ color: "var(--app-text)" }}>≈ {dose.spoons}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-3" style={{ color: "var(--app-text-muted)" }}>
            Densità apparente NaHCO₃ in polvere ≈ 1 g/ml. Cucchiaino raso ≈ 5 g · cucchiaino colmo ≈ 7 g · cucchiaio raso ≈ 15 g · cucchiaio colmo ≈ 20 g.
          </p>
        </div>

        {/* Note scientifiche */}
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(245,158,11,0.3)" }}>
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#F59E0B" }} />
            <h4 className="text-xs font-black tracking-widest" style={{ color: "#F59E0B" }}>
              NOTE SCIENTIFICHE — ADATTATO PER 5K
            </h4>
          </div>
          <ul className="space-y-2 text-xs pl-6 list-disc" style={{ color: "var(--app-text-muted)" }}>
            <li>
              <strong style={{ color: "var(--app-text)" }}>Dose bicarbonato ridotta (0.2 vs 0.3 g/kg):</strong> la letteratura
              mostra benefit massimo per sforzi 1-7 min. Il 5K dura 15-25 min → guadagno marginale ma rischio GI distress simile.
              0.2 g/kg conserva ~70% del benefit con metà del rischio (Saunders 2022 meta-analisi).
            </li>
            <li>
              <strong style={{ color: "var(--app-text)" }}>Beetroot è la priorità per 5K:</strong> meta-analisi mostrano
              riduzione ~3% del tempo gara nei 5-10K (Domínguez 2017). Beneficio ben superiore al bicarbonato per questa distanza.
            </li>
            <li>
              <strong style={{ color: "var(--app-text)" }}>Beta-alanina pre-gara è inutile:</strong> ha effetto solo cronico
              (accumulo carnosina), non acuto. Per 5K l'effetto si sente nell'ultimo km (tampone muscolare H⁺).
            </li>
            <li>
              <strong style={{ color: "var(--app-text)" }}>Test in allenamento OBBLIGATORIO:</strong> MAI introdurre nuove molecole
              il giorno gara. Prova bicarbonato 0.2 g/kg + beetroot in 2-3 sessioni a ritmo 5K-3K prima del PB.
            </li>
            <li>
              <strong style={{ color: "var(--app-text)" }}>Capsule alternative:</strong> se hai stomaco sensibile, usa Sodium
              Bicarbonate enteric-coated caps (es. 500 mg/cap) — assumi {Math.round(bicarbDose(0.2, USER_WEIGHT_KG).grams / 0.5)} capsule
              spalmate in 20 min con 600 ml acqua.
            </li>
            <li>
              <strong style={{ color: "var(--app-text)" }}>Idratazione:</strong> bicarbonato = carico sodio elevato
              (~{Math.round(bicarbDose(0.2, USER_WEIGHT_KG).grams * 0.27 * 1000)} mg Na⁺). Aggiungi 500 ml acqua extra prima dell'inizio gara.
            </li>
            <li>
              <strong style={{ color: "var(--app-text)" }}>Caffeina:</strong> sinergica con bicarbonato e beetroot. 3 mg/kg (≈ 200 mg per {USER_WEIGHT_KG} kg)
              45-60 min pre-gara — solo se già testata. NO espresso doppio random il giorno PB.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}

// ─── SupplementCard ──────────────────────────────────────────────────────────

interface SupplementCardProps {
  sup: {
    id: SupplementId;
    name: string;
    shortName: string;
    dose: string;
    color: string;
    tau: number;
    fullDays: number;
    source: string;
    description: string;
    startDate: string;
    startDateObj: Date;
    daysSinceStart: number;
    saturation: number;
    peak50Date: Date;
    peak90Date: Date;
    peakFullDate: Date;
    started: boolean;
    phaseLabel: string;
    phaseColor: string;
    checkedCount: number;
    totalDays: number;
    adherencePct: number;
  };
  saving: boolean;
  savedFlash: boolean;
  checks: Set<string>;
  weekOffset: number;
  onDateChange: (newDate: string) => void;
  onToggleDay: (dateStr: string, currentlyChecked: boolean) => void;
  onWeekChange: (offset: number) => void;
}

function SupplementCard({ sup, saving, savedFlash, checks, weekOffset, onDateChange, onToggleDay, onWeekChange }: SupplementCardProps) {
  const satPct = Math.round(sup.saturation * 100);
  const milestones = [
    { label: "INIZIO", date: sup.startDateObj, pct: 0 },
    { label: "50%",    date: sup.peak50Date,   pct: 50 },
    { label: "90%",    date: sup.peak90Date,   pct: 90 },
    { label: "SATURO", date: sup.peakFullDate, pct: 99 },
  ];

  const totalSpanDays = Math.max(1, daysBetween(sup.startDateObj, sup.peakFullDate));
  const todayPct = sup.started
    ? Math.min(100, Math.max(0, (sup.daysSinceStart / totalSpanDays) * 100))
    : 0;

  return (
    <div
      className="rounded-2xl p-5 md:p-6 border relative overflow-hidden"
      style={{ backgroundColor: "var(--app-bg-alt)", borderColor: "var(--app-border)", borderLeft: `3px solid ${sup.color}` }}
    >
      {/* Background glow */}
      <div
        className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${sup.color}12 0%, transparent 70%)` }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <Beaker className="w-4 h-4 shrink-0" style={{ color: sup.color }} />
            <h3 className="text-base md:text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
              {sup.name}
            </h3>
          </div>
          <p className="text-[11px] font-bold tracking-wider" style={{ color: "var(--app-text-muted)" }}>
            {sup.dose.toUpperCase()} · {sup.source.toUpperCase()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className="text-[9px] font-black px-2.5 py-1 rounded-full tracking-widest"
            style={{
              color: sup.phaseColor,
              backgroundColor: sup.started ? `${sup.color}1A` : "var(--app-input-bg)",
              border: sup.started ? `1px solid ${sup.color}30` : "1px solid var(--app-border)",
            }}
          >
            {sup.phaseLabel}
          </span>
          {sup.started && (
            <span className="text-[9px] font-bold tracking-wider" style={{ color: "var(--app-text-muted)" }}>
              GIORNO {sup.daysSinceStart + 1}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="relative text-[11px] leading-relaxed mb-5 italic" style={{ color: "var(--app-text-muted)" }}>
        {sup.description}
      </p>

      {/* Saturation Big Number + Progress Ring */}
      <div className="relative flex items-center gap-5 mb-6">
        <SaturationRing pct={satPct} color={sup.color} size={88} />
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-black tracking-widest mb-1" style={{ color: "var(--app-text-muted)" }}>
            SATURAZIONE TEORICA
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl md:text-5xl font-black tabular-nums leading-none" style={{ color: sup.color, textShadow: `0 0 24px ${sup.color}40` }}>
              {satPct}
            </span>
            <span className="text-lg font-black" style={{ color: sup.color }}>%</span>
          </div>
          <div className="mt-2 text-[10px] font-bold tracking-wider" style={{ color: "var(--app-text-muted)" }}>
            PICCO 90% · <span style={{ color: sup.color }}>{formatDateShort(sup.peak90Date)}</span>
          </div>
        </div>
      </div>

      {/* Timeline Milestones */}
      <div className="relative mb-6">
        <div className="text-[9px] font-black tracking-widest mb-3" style={{ color: "var(--app-text-muted)" }}>
          MILESTONES
        </div>
        <div className="relative">
          <div className="absolute left-0 right-0 top-3 h-0.5 rounded-full" style={{ backgroundColor: "var(--app-border)" }} />
          <div
            className="absolute left-0 top-3 h-0.5 rounded-full transition-all duration-500"
            style={{ width: `${todayPct}%`, backgroundColor: sup.color, boxShadow: `0 0 8px ${sup.color}80` }}
          />
          {sup.started && (
            <div
              className="absolute top-2 -translate-x-1/2 w-2 h-2 rounded-full ring-4 ring-[var(--app-bg-alt)]"
              style={{ left: `${todayPct}%`, backgroundColor: sup.color, boxShadow: `0 0 12px ${sup.color}` }}
              title="Oggi"
            />
          )}
          <div className="grid grid-cols-4 gap-1 relative">
            {milestones.map((m) => {
              const reached = satPct >= m.pct;
              return (
                <div key={m.label} className="flex flex-col items-center text-center">
                  <div
                    className="w-1.5 h-1.5 rounded-full mb-2 mt-2.5 transition-colors"
                    style={{ backgroundColor: reached ? sup.color : "var(--app-border)", boxShadow: reached ? `0 0 6px ${sup.color}` : "none" }}
                  />
                  <div className="text-[8px] font-black tracking-wider mb-0.5" style={{ color: reached ? sup.color : "var(--app-text-muted)" }}>
                    {m.label}
                  </div>
                  <div className="text-[9px] font-mono tabular-nums" style={{ color: "var(--app-text-muted)" }}>
                    {formatDateShort(m.date)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Date Picker */}
      <div className="relative pb-4 border-b mb-0" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor={`start-${sup.id}`} className="flex items-center gap-1.5 text-[10px] font-black tracking-widest" style={{ color: "var(--app-text-muted)" }}>
            <CalendarIcon className="w-3 h-3" style={{ color: sup.color }} />
            DATA INIZIO ASSUNZIONE
          </label>
          <div className="flex items-center gap-1.5 min-h-[14px]">
            {saving && (
              <span className="flex items-center gap-1 text-[9px] font-bold tracking-widest" style={{ color: "var(--app-text-muted)" }}>
                <Clock className="w-3 h-3 animate-spin" /> SALVATAGGIO…
              </span>
            )}
            {savedFlash && !saving && (
              <span className="flex items-center gap-1 text-[9px] font-black tracking-widest" style={{ color: sup.color }}>
                <Check className="w-3 h-3" /> SALVATO SU DB
              </span>
            )}
          </div>
        </div>
        <input
          id={`start-${sup.id}`}
          type="date"
          value={sup.startDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm font-mono font-bold tabular-nums tracking-wide border-2 transition-all min-h-[48px] focus:outline-none"
          style={{ backgroundColor: "var(--app-input-bg)", borderColor: `${sup.color}40`, color: "var(--app-text)", colorScheme: "dark" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = sup.color; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = `${sup.color}40`; }}
        />
      </div>

      {/* Weekly Day-Tracking Grid */}
      <WeeklyGrid
        startDate={sup.startDateObj}
        checks={checks}
        weekOffset={weekOffset}
        color={sup.color}
        totalDays={sup.totalDays}
        adherencePct={sup.adherencePct}
        checkedCount={sup.checkedCount}
        onToggle={onToggleDay}
        onWeekChange={onWeekChange}
      />
    </div>
  );
}

// ─── WeeklyGrid — compact 7-day tracking grid ────────────────────────────────

interface WeeklyGridProps {
  startDate: Date;
  checks: Set<string>;
  weekOffset: number;
  color: string;
  totalDays: number;
  adherencePct: number;
  checkedCount: number;
  onToggle: (dateStr: string, currentlyChecked: boolean) => void;
  onWeekChange: (offset: number) => void;
}

const DAY_LETTERS = ["L", "M", "M", "G", "V", "S", "D"];

function WeeklyGrid({ startDate, checks, weekOffset, color, totalDays, adherencePct, checkedCount, onToggle, onWeekChange }: WeeklyGridProps) {
  const todayStr = fmtDate(TODAY);

  // Get Monday of week at given offset from current week
  const monday = useMemo(() => {
    const d = new Date(TODAY);
    const day = d.getDay(); // 0=Sun
    const daysToMon = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + daysToMon + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    }),
    [monday],
  );

  const weekLabel = useMemo(() => {
    const s = weekDays[0];
    const e = weekDays[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString("it", { month: "short" }).toUpperCase()}`;
    }
    return `${s.toLocaleDateString("it", { day: "2-digit", month: "short" })} – ${e.toLocaleDateString("it", { day: "2-digit", month: "short" })}`.toUpperCase();
  }, [weekDays]);

  return (
    <div className="pt-4">
      {/* Header: label + week nav */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-black tracking-widest" style={{ color: "var(--app-text-muted)" }}>
          TRACKING GIORNALIERO
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onWeekChange(weekOffset - 1)}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity focus:outline-none"
            style={{ color: "var(--app-text-muted)", backgroundColor: "var(--app-input-bg)" }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-bold tabular-nums min-w-[88px] text-center" style={{ color: "var(--app-text)" }}>
            {weekLabel}
          </span>
          <button
            onClick={() => onWeekChange(weekOffset + 1)}
            disabled={weekOffset >= 0}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-25 focus:outline-none"
            style={{ color: "var(--app-text-muted)", backgroundColor: "var(--app-input-bg)" }}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 7-day grid */}
      <div className="grid grid-cols-7 gap-0.5 mb-3">
        {weekDays.map((day, i) => {
          const dateStr    = fmtDate(day);
          const isToday    = dateStr === todayStr;
          const isFuture   = day > TODAY;
          const isBefore   = day < startDate;
          const isDisabled = isFuture || isBefore;
          const isChecked  = checks.has(dateStr);

          return (
            <button
              key={dateStr}
              onClick={() => !isDisabled && onToggle(dateStr, isChecked)}
              disabled={isDisabled}
              title={isBefore ? "Prima dell'inizio" : isFuture ? "Giorno futuro" : dateStr}
              className="flex flex-col items-center gap-0.5 pt-2 pb-2.5 rounded-xl transition-all duration-150 focus:outline-none select-none"
              style={{
                opacity: isDisabled ? 0.22 : 1,
                cursor: isDisabled ? "not-allowed" : "pointer",
                backgroundColor: isChecked
                  ? `${color}18`
                  : isToday
                  ? "rgba(255,255,255,0.04)"
                  : "transparent",
                boxShadow: isToday && !isChecked ? `0 0 0 1px ${color}40` : isChecked ? `0 0 0 1px ${color}30` : undefined,
              }}
            >
              {/* Day letter */}
              <span className="text-[8px] font-bold leading-none" style={{ color: "var(--app-text-muted)" }}>
                {DAY_LETTERS[i]}
              </span>
              {/* Day number */}
              <span
                className="text-[11px] font-black tabular-nums leading-none my-0.5"
                style={{ color: isChecked ? color : isToday ? "var(--app-text)" : "var(--app-text-muted)" }}
              >
                {day.getDate()}
              </span>
              {/* Check circle */}
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center transition-all duration-150"
                style={{
                  backgroundColor: isChecked ? color : "transparent",
                  border: `1.5px solid ${isChecked ? color : "rgba(255,255,255,0.10)"}`,
                  boxShadow: isChecked ? `0 0 8px ${color}50` : undefined,
                }}
              >
                {isChecked ? (
                  <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
                    <path d="M2.5 6l2.5 2.5 4.5-4.5" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isToday ? (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Adherence summary */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span style={{ color: "var(--app-text-muted)" }}>
            Aderenza:{" "}
            <span className="font-black" style={{ color: "var(--app-text)" }}>{checkedCount}</span>
            /{totalDays} giorni
          </span>
          <span
            className="font-black"
            style={{
              color: adherencePct >= 80 ? color
                : adherencePct >= 60 ? "#F59E0B"
                : "#F43F5E",
            }}
          >
            {adherencePct}%
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${adherencePct}%`,
              backgroundColor: adherencePct >= 80 ? color : adherencePct >= 60 ? "#F59E0B" : "#F43F5E",
              boxShadow: adherencePct > 0 ? `0 0 6px ${color}50` : undefined,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── SaturationRing ───────────────────────────────────────────────────────────

function SaturationRing({ pct, color, size }: { pct: number; color: string; size: number }) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <defs>
        <filter id={`ring-glow-${color.replace("#", "")}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        filter={`url(#ring-glow-${color.replace("#", "")})`}
        style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
      />
    </svg>
  );
}

// ─── TimelineRow ─────────────────────────────────────────────────────────────

function TimelineRow({ time, delta, color, title, detail }: {
  time: string; delta: string; color: string; title: string; detail: string[];
}) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-20 md:w-24">
        <div className="text-base font-black" style={{ color }}>{time}</div>
        <div className="text-[9px] font-bold tracking-widest" style={{ color: "var(--app-text-muted)" }}>{delta}</div>
      </div>
      <div className="flex-1 pb-3 border-b" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-3.5 h-3.5" style={{ color }} />
          <h4 className="text-sm font-black" style={{ color: "var(--app-text)" }}>{title}</h4>
        </div>
        <ul className="space-y-1 text-xs pl-5 list-disc" style={{ color: "var(--app-text-muted)" }}>
          {detail.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      </div>
    </div>
  );
}
