import { useState, useMemo, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend } from "recharts";
import { Beaker, CheckCircle2, Circle, Zap, AlertTriangle, FlaskConical, Trophy, Calendar as CalendarIcon } from "lucide-react";

/**
 * SupplementsView — Sezione integrazione: tracking manuale + chart saturazione
 * + protocollo PB scientificamente verificato.
 *
 * Modello scientifico:
 *  - Creatina 5g/die: saturazione fosfocreatina muscolare ~28 giorni (Hultman 1996).
 *    Modello esponenziale: S(t) = 1 - exp(-t / 9.5)
 *  - Beta-Alanina 4g/die: incremento carnosina muscolare lineare-saturante,
 *    ~60% a 4 settimane, ~80-90% a 10 settimane (Harris 2006, Hill 2007).
 *    Modello: S(t) = 1 - exp(-t / 35)
 *
 * Persistenza checkbox: localStorage key `metic-lab:supplements:v1`.
 */

type SupplementId = "creatine" | "beta-alanine";

interface SupplementDef {
  id: SupplementId;
  name: string;
  dose: string;
  color: string;
  startDate: string; // YYYY-MM-DD
  tau: number;       // costante di tempo modello esponenziale (giorni)
  fullDays: number;  // giorni a 99% saturazione (per UI)
  source: string;    // citazione studi
}

const SUPPLEMENTS: SupplementDef[] = [
  {
    id: "creatine",
    name: "Creatina monoidrato",
    dose: "5 g/die",
    color: "#C0FF00",
    startDate: "2026-05-12",
    tau: 9.5,
    fullDays: 28,
    source: "Hultman 1996",
  },
  {
    id: "beta-alanine",
    name: "Beta-Alanina",
    dose: "4 g/die",
    color: "#3B82F6",
    startDate: "2026-05-16",
    tau: 35,
    fullDays: 70,
    source: "Harris 2006, Hill 2007",
  },
];

const STORAGE_KEY = "metic-lab:supplements:v1";
const TODAY = new Date("2026-05-15"); // currentDate from memory

// ─── Profilo atleta + protocollo ──────────────────────────────────────────
// Personalizzazione protocollo PB. Dosi calcolate da peso e distanza.
const USER_WEIGHT_KG = 68;
const TARGET_DISTANCE_KM = 5;

/**
 * Conversione bicarbonato grammi → cucchiai/cucchiaini da cucina.
 * Densità apparente NaHCO₃ in polvere fine ≈ 1.0 g/ml.
 *  - cucchiaino raso ≈ 5 g
 *  - cucchiaino colmo ≈ 7 g
 *  - cucchiaio raso ≈ 15 g
 *  - cucchiaio colmo ≈ 20 g
 */
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
  // Inverte: t = -tau * ln(1 - S)
  const t = -tau * Math.log(1 - target);
  const d = new Date(start);
  d.setDate(start.getDate() + Math.ceil(t));
  return d;
}

// ─── State persistence ────────────────────────────────────────────────────

type ChecksMap = Record<string, Record<SupplementId, boolean>>;

function loadChecks(): ChecksMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ChecksMap;
  } catch {
    return {};
  }
}

function saveChecks(checks: ChecksMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
  } catch { /* quota or disabled */ }
}

// Auto-checks default: creatina dal 12 mag al 15 mag (oggi).
function applyAutoChecks(stored: ChecksMap): ChecksMap {
  const result = { ...stored };
  for (const sup of SUPPLEMENTS) {
    const start = parseDate(sup.startDate);
    if (start > TODAY) continue;
    const days = daysBetween(start, TODAY) + 1;
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = fmtDate(d);
      const dayChecks = result[key] ?? { creatine: false, "beta-alanine": false };
      // applica autocheck SOLO se non esiste l'entry per quel giorno (rispetta user input)
      if (!(key in result)) {
        dayChecks[sup.id] = true;
        result[key] = dayChecks;
      }
    }
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────

export function SupplementsView() {
  const [checks, setChecks] = useState<ChecksMap>(() => applyAutoChecks(loadChecks()));

  useEffect(() => { saveChecks(checks); }, [checks]);

  const toggle = useCallback((dateKey: string, sup: SupplementId) => {
    setChecks(prev => {
      const day = prev[dateKey] ?? { creatine: false, "beta-alanine": false };
      return { ...prev, [dateKey]: { ...day, [sup]: !day[sup] } };
    });
  }, []);

  // Curve saturazione: 120 giorni dal primo start
  const chartData = useMemo(() => {
    const firstStart = SUPPLEMENTS.reduce((min, s) => {
      const d = parseDate(s.startDate);
      return d < min ? d : min;
    }, parseDate(SUPPLEMENTS[0].startDate));
    const days = 130;
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(firstStart);
      d.setDate(firstStart.getDate() + i);
      const point: any = { date: fmtDate(d), day: i };
      for (const sup of SUPPLEMENTS) {
        const start = parseDate(sup.startDate);
        const since = daysBetween(start, d);
        point[sup.id] = +(saturation(since, sup.tau) * 100).toFixed(1);
      }
      // PB-ready: minimo tra le due saturazioni — il limitante
      point.pbReady = Math.min(point.creatine, point["beta-alanine"]);
      return point;
    });
  }, []);

  // PB window: data quando entrambi >90%
  const pbReadyDate = useMemo(() => {
    const found = chartData.find(p => p.pbReady >= 90);
    return found ? found.date : null;
  }, [chartData]);

  // Stato corrente per cards — conta TUTTI i giorni spuntati per il supplemento.
  // La saturazione riflette le dosi assunte (passate o pianificate).
  // L'aderenza è calcolata sui giorni elapsed dal start fino a oggi (o ultima spunta, max).
  const currentStatus = useMemo(() => {
    return SUPPLEMENTS.map(sup => {
      const start = parseDate(sup.startDate);
      const sinceToday = daysBetween(start, TODAY);
      let checkedDays = 0;
      let latestChecked: Date | null = null;
      for (const [dateKey, day] of Object.entries(checks)) {
        if (day[sup.id]) {
          checkedDays++;
          const d = parseDate(dateKey);
          if (d >= start && (!latestChecked || d > latestChecked)) {
            latestChecked = d;
          }
        }
      }
      // Giorni elapsed: dal start a oggi o all'ultima spunta (il più tardo dei due)
      const endRef = latestChecked && latestChecked > TODAY ? latestChecked : TODAY;
      const elapsedDays = Math.max(0, daysBetween(start, endRef) + 1);
      const adherence = elapsedDays > 0 ? Math.min(1, checkedDays / elapsedDays) : 0;
      const sat = saturation(checkedDays, sup.tau);
      // Peak 90% considerando aderenza attuale: se l'aderenza è X%, servono più giorni
      const baseDays = -sup.tau * Math.log(0.1);
      const adjustedDays = adherence > 0 ? Math.ceil(baseDays / adherence) : baseDays;
      const peak90 = new Date(start);
      peak90.setDate(start.getDate() + adjustedDays);
      return {
        ...sup,
        daysActive: checkedDays,
        calendarDays: elapsedDays,
        adherence,
        saturation: sat,
        peak90Date: peak90,
        started: sinceToday >= 0 || checkedDays > 0,
      };
    });
  }, [checks]);

  // Calendario: dal primo start supplemento + 90 giorni futuro
  const calendarDays = useMemo(() => {
    const firstStart = SUPPLEMENTS.reduce((min, s) => {
      const d = parseDate(s.startDate);
      return d < min ? d : min;
    }, parseDate(SUPPLEMENTS[0].startDate));
    const lastDate = new Date(TODAY);
    lastDate.setDate(TODAY.getDate() + 90);
    const totalDays = daysBetween(firstStart, lastDate) + 1;
    return Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(firstStart);
      d.setDate(firstStart.getDate() + i);
      return d;
    });
  }, []);

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

      {/* ── Active Supplements Cards ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentStatus.map(sup => (
          <div
            key={sup.id}
            className="rounded-2xl p-6 border"
            style={{
              backgroundColor: "var(--app-bg-alt)",
              borderColor: "var(--app-border)",
              borderLeft: `3px solid ${sup.color}`,
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Beaker className="w-4 h-4" style={{ color: sup.color }} />
                  <h3 className="text-lg font-black" style={{ color: "var(--app-text)" }}>{sup.name}</h3>
                </div>
                <p className="text-xs font-bold tracking-wider" style={{ color: "var(--app-text-muted)" }}>
                  {sup.dose.toUpperCase()} · INIZIO {sup.startDate}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div
                  className="text-[10px] font-black px-2 py-1 rounded-full"
                  style={{
                    color: sup.started ? sup.color : "var(--app-text-muted)",
                    backgroundColor: sup.started ? `${sup.color}1A` : "var(--app-input-bg)",
                  }}
                >
                  {sup.started ? `${sup.daysActive}/${sup.calendarDays} GG` : "DA INIZIARE"}
                </div>
                {sup.started && sup.calendarDays > 0 && (
                  <div className="text-[9px] font-bold tracking-widest" style={{ color: "var(--app-text-muted)" }}>
                    ADERENZA {(sup.adherence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>

            {/* Saturation bar */}
            <div className="mb-3">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[10px] font-bold tracking-widest" style={{ color: "var(--app-text-muted)" }}>
                  SATURAZIONE MUSCOLARE
                </span>
                <span className="text-2xl font-black" style={{ color: sup.color }}>
                  {(sup.saturation * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--app-input-bg)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${sup.saturation * 100}%`, backgroundColor: sup.color }}
                />
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-bold tracking-wider pt-3 border-t" style={{ borderColor: "var(--app-border)", color: "var(--app-text-muted)" }}>
              <span>PICCO 90%: {sup.peak90Date.toLocaleDateString("it", { day: "2-digit", month: "short" })}</span>
              <span>{sup.source}</span>
            </div>
          </div>
        ))}
      </section>

      {/* ── Saturation Chart ── */}
      <section
        className="rounded-2xl p-6 border"
        style={{ backgroundColor: "var(--app-bg-alt)", borderColor: "var(--app-border)" }}
      >
        <div className="flex items-center justify-between mb-4">
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
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ borderColor: "#C0FF00", backgroundColor: "#C0FF001A" }}
            >
              <Trophy className="w-4 h-4" style={{ color: "#C0FF00" }} />
              <div>
                <div className="text-[9px] font-black tracking-widest" style={{ color: "var(--app-text-muted)" }}>
                  PB WINDOW DA
                </div>
                <div className="text-sm font-black" style={{ color: "#C0FF00" }}>
                  {parseDate(pbReadyDate).toLocaleDateString("it", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-[320px]">
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
              <YAxis
                stroke="#64748B"
                fontSize={10}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(v) => parseDate(v as string).toLocaleDateString("it", { day: "2-digit", month: "long", year: "numeric" })}
                formatter={(value: number, name: string) => {
                  const label = name === "creatine" ? "Creatina"
                    : name === "beta-alanine" ? "Beta-Alanina"
                    : "PB-Ready";
                  return [`${value.toFixed(0)}%`, label];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                formatter={(value: string) => {
                  const map: Record<string, string> = {
                    "creatine": "Creatina",
                    "beta-alanine": "Beta-Alanina",
                    "pbReady": "PB-Ready (limitante)",
                  };
                  return map[value] ?? value;
                }}
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

      {/* ── Calendar ── */}
      <section
        className="rounded-2xl p-6 border"
        style={{ backgroundColor: "var(--app-bg-alt)", borderColor: "var(--app-border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon className="w-5 h-5" style={{ color: "#C0FF00" }} />
          <h2 className="text-base font-black tracking-wide" style={{ color: "var(--app-text)" }}>
            CALENDARIO ASSUNZIONI
          </h2>
        </div>
        <p className="text-[11px] font-semibold mb-4" style={{ color: "var(--app-text-muted)" }}>
          Spunta ogni giorno quando hai assunto il supplemento. I giorni passati su creatina sono già spuntati (12 mag → oggi).
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left p-2 font-bold tracking-wider sticky left-0 z-10" style={{ color: "var(--app-text-muted)", backgroundColor: "var(--app-bg-alt)" }}>
                  GIORNO
                </th>
                {SUPPLEMENTS.map(sup => (
                  <th key={sup.id} className="p-2 text-center font-bold tracking-wider" style={{ color: sup.color }}>
                    {sup.name.split(" ")[0].toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendarDays.map(d => {
                const key = fmtDate(d);
                const isToday = key === fmtDate(TODAY);
                const isPast = d < TODAY;
                const isFuture = d > TODAY;
                const dayChecks = checks[key] ?? { creatine: false, "beta-alanine": false };
                return (
                  <tr
                    key={key}
                    className="border-t"
                    style={{
                      borderColor: "var(--app-border)",
                      backgroundColor: isToday ? "#C0FF000A" : "transparent",
                    }}
                  >
                    <td className="p-2 sticky left-0" style={{ backgroundColor: isToday ? "#1f2410" : "var(--app-bg-alt)" }}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: isToday ? "#C0FF00" : "var(--app-text)" }}>
                          {d.toLocaleDateString("it", { day: "2-digit", month: "short", weekday: "short" })}
                        </span>
                        {isToday && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: "#C0FF00", color: "#000" }}>OGGI</span>}
                      </div>
                    </td>
                    {SUPPLEMENTS.map(sup => {
                      const start = parseDate(sup.startDate);
                      const beforeStart = d < start;
                      const checked = dayChecks[sup.id];
                      return (
                        <td key={sup.id} className="p-2 text-center">
                          {beforeStart ? (
                            <span className="text-[10px]" style={{ color: "var(--app-text-muted)" }}>—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggle(key, sup.id)}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-all hover:scale-110"
                              aria-label={`Toggle ${sup.name} ${key}`}
                              style={{
                                backgroundColor: checked ? `${sup.color}26` : "transparent",
                              }}
                            >
                              {checked ? (
                                <CheckCircle2 className="w-5 h-5" style={{ color: sup.color }} />
                              ) : (
                                <Circle className="w-5 h-5" style={{ color: isFuture ? "var(--app-text-muted)" : "var(--app-text-dim)", opacity: isFuture ? 0.4 : 0.7 }} />
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── PB Protocol ── */}
      <section
        className="rounded-2xl p-6 border"
        style={{
          backgroundColor: "var(--app-bg-alt)",
          borderColor: "#C0FF00",
          borderLeftWidth: "4px",
        }}
      >
        <div className="flex items-center gap-3 mb-1">
          <Trophy className="w-6 h-6" style={{ color: "#C0FF00" }} />
          <h2 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
            PROTOCOLLO PERSONAL BEST · {TARGET_DISTANCE_KM}K · {USER_WEIGHT_KG} KG
          </h2>
        </div>
        <p className="text-[11px] font-bold tracking-widest mb-6" style={{ color: "var(--app-text-muted)" }}>
          ✓ VERIFICATO SCIENTIFICAMENTE · ATTIVAZIONE DA {pbReadyDate ? parseDate(pbReadyDate).toLocaleDateString("it", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase() : "—"}
        </p>

        {/* Phase 1: Beetroot loading */}
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

        {/* Phase 2: Day before */}
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

        {/* Phase 3: Race day */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: "#C0FF00" }} />
            <h3 className="text-sm font-black tracking-wider" style={{ color: "var(--app-text)" }}>
              FASE 3 — GIORNO GARA (PARTENZA H10:00)
            </h3>
          </div>

          <div className="space-y-3 pl-3">
            <TimelineRow
              time="H 07:30"
              delta="GARA −150 MIN"
              color="#C0FF00"
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
              time="H 09:00"
              delta="GARA −60 MIN"
              color="#22D3EE"
              title="Snack pre-gara + idratazione finale"
              detail={[
                "30-40 g CHO rapidi (gel + 200 ml acqua, o mezza banana). NO caffè se non testato.",
                "Caffeina opzionale: 3 mg/kg (≈ 200 mg per 68 kg) se ben tollerata. Picco 45-60 min.",
                "Ultima minzione consigliata.",
              ]}
            />
            <TimelineRow
              time="H 09:25"
              delta="GARA −35 MIN"
              color="#3B82F6"
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
              time="H 09:55"
              delta="GARA −5 MIN"
              color="#A78BFA"
              title="Mental prep + posizionamento"
              detail={[
                "Visualizza pacing: km1 a ritmo gara (NO sparata), km 2-3 stabile, km 4-5 negative split.",
                "Posizionati nella griglia in base al tuo obiettivo, non più avanti.",
              ]}
            />
            <TimelineRow
              time="H 10:00"
              delta="START"
              color="#F43F5E"
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

        {/* Dose reference table */}
        <div className="rounded-xl p-4 mb-4 border" style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(192,255,0,0.2)" }}>
          <h4 className="text-xs font-black tracking-widest mb-3" style={{ color: "#C0FF00" }}>
            RIFERIMENTO DOSI BICARBONATO ({USER_WEIGHT_KG} KG)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg p-3" style={{ backgroundColor: "#111" }}>
              <div className="text-[10px] font-bold tracking-wider mb-1" style={{ color: "var(--app-text-muted)" }}>SERA PRIMA · 0.1 g/kg</div>
              <div className="text-base font-black" style={{ color: "#F59E0B" }}>{bicarbDose(0.1, USER_WEIGHT_KG).grams} g</div>
              <div className="text-[11px] mt-1" style={{ color: "var(--app-text)" }}>≈ {bicarbDose(0.1, USER_WEIGHT_KG).spoons}</div>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "#111", outline: "1px solid #C0FF0040" }}>
              <div className="text-[10px] font-bold tracking-wider mb-1" style={{ color: "var(--app-text-muted)" }}>GARA 5K · 0.2 g/kg (CONSIGLIATA)</div>
              <div className="text-base font-black" style={{ color: "#C0FF00" }}>{bicarbDose(0.2, USER_WEIGHT_KG).grams} g</div>
              <div className="text-[11px] mt-1" style={{ color: "var(--app-text)" }}>≈ {bicarbDose(0.2, USER_WEIGHT_KG).spoons}</div>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "#111" }}>
              <div className="text-[10px] font-bold tracking-wider mb-1" style={{ color: "var(--app-text-muted)" }}>DOSE PIENA · 0.3 g/kg</div>
              <div className="text-base font-black" style={{ color: "var(--app-text-muted)" }}>{bicarbDose(0.3, USER_WEIGHT_KG).grams} g</div>
              <div className="text-[11px] mt-1" style={{ color: "var(--app-text)" }}>≈ {bicarbDose(0.3, USER_WEIGHT_KG).spoons}</div>
            </div>
          </div>
          <p className="text-[10px] mt-3" style={{ color: "var(--app-text-muted)" }}>
            Densità apparente NaHCO₃ in polvere ≈ 1 g/ml. Cucchiaino raso ≈ 5 g · cucchiaino colmo ≈ 7 g · cucchiaio raso ≈ 15 g · cucchiaio colmo ≈ 20 g.
          </p>
        </div>

        {/* Note scientifiche */}
        <div
          className="rounded-xl p-4 border"
          style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(245,158,11,0.3)" }}
        >
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

// ─── Helper component ────────────────────────────────────────────────────

function TimelineRow({ time, delta, color, title, detail }: {
  time: string;
  delta: string;
  color: string;
  title: string;
  detail: string[];
}) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-24">
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
