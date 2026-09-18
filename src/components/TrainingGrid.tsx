import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { useApi, invalidateCache } from "../hooks/useApi";
import { API_CACHE } from "../hooks/apiCacheKeys";
import { getRuns, getSub20Status, putSub20Status, type Sub20StatusResponse, type Sub20SessionStatus } from "../api";
import type { RunsResponse } from "../types/api";
import { evaluatePlan } from "../utils/trainingAdherence";
import { SessionVerdict, AdherenceStrip } from "./TrainingAdherence";
import {
  PLAN_DAY_BY_DATE, PLAN_KINDS, PLAN_META, planDateLabel, planRunSessions, type PlanDay,
} from "../data/mezzaOttobrePlan";
import {
  AfterPanel, ChangesPanel, NextSession, PlanBibs, PlanDayBody, PlanLegend, PlanWeeks,
  RacePanel, TestPanel, ZonesPanel,
} from "./TrainingPlanPanels";

/**
 * TRAINING — il piano "test 5 km il 10 ottobre, mezza il 18".
 *
 * Il piano è scritto a mano e ha date fisse, quindi la pagina non ha più leve:
 * niente finestra da scegliere, niente obiettivo da digitare, niente motore che
 * ricalcola i ritmi. Si legge il piano, si vede dove sei, e ogni seduta di corsa
 * viene confrontata da sola con quello che hai corso davvero.
 *
 * Le viste di calendario restano quelle di sempre; la vista "Piano" — quella che
 * si apre — è la lista settimana per settimana del piano originale.
 */

type View = "Piano" | "Day" | "Week" | "Month" | "Year";
const VIEWS: { id: View; label: string }[] = [
  { id: "Piano", label: "Piano" },
  { id: "Day", label: "Giorno" },
  { id: "Week", label: "Settimana" },
  { id: "Month", label: "Mese" },
  { id: "Year", label: "Anno" },
];

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const keyOf = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function TrainingGrid() {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("Piano");
  /** Giorno aperto a schermo intero, sopra tutto, su fondo pieno. */
  const [detailDate, setDetailDate] = useState<Date | null>(null);
  const todayIso = isoOf(new Date());

  const openDay = (date: Date) => setDetailDate(date);
  const openIso = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    setDetailDate(new Date(y, m - 1, d));
  };
  const closeDay = useCallback(() => setDetailDate(null), []);

  // Esc chiude, e finché il dettaglio è aperto la pagina sotto non scorre.
  useEffect(() => {
    if (!detailDate) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDay(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [detailDate, closeDay]);

  // ── Aderenza: prescrizione ↔ giri realmente corsi, solo sulle sedute di corsa.
  const runSessions = useMemo(() => planRunSessions(), []);
  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const adherence = useMemo(() => evaluatePlan(runSessions, runsData?.runs ?? []), [runSessions, runsData]);
  const adherenceByDate = useMemo(
    () => Object.fromEntries(adherence.map((e) => [e.date.slice(0, 10), e])),
    [adherence],
  );

  // ── Esiti manuali, persistenti su DB (la stessa raccolta di sempre, per data).
  const { data: statusData } = useApi<Sub20StatusResponse>(getSub20Status, { cacheKey: "sub20-status" });
  const [manual, setManual] = useState<Record<string, Sub20SessionStatus>>({});
  useEffect(() => {
    if (statusData?.statuses) setManual(statusData.statuses);
  }, [statusData]);

  const mark = useCallback(async (date: string, status: Sub20SessionStatus | null) => {
    setManual((prev) => {
      const next = { ...prev };
      if (status) next[date] = status; else delete next[date];
      return next;
    });
    try {
      const res = await putSub20Status(date, status);
      if (res?.statuses) setManual(res.statuses);
      invalidateCache("sub20-status");
    } catch {
      /* l'ottimistico resta; ritenta al prossimo click */
    }
  }, []);

  const dayOf = (year: number, month: number, day: number): PlanDay | undefined => PLAN_DAY_BY_DATE[keyOf(year, month, day)];
  const statusOf = (year: number, month: number, day: number) => {
    const iso = keyOf(year, month, day);
    return { done: !!PLAN_DAY_BY_DATE[iso]?.done || manual[iso] === "done", failed: manual[iso] === "failed" };
  };

  const next = () => {
    const d = new Date(currentDate);
    if (view === "Month") d.setMonth(d.getMonth() + 1);
    else if (view === "Week") d.setDate(d.getDate() + 7);
    else if (view === "Day") d.setDate(d.getDate() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    setCurrentDate(d);
  };
  const prev = () => {
    const d = new Date(currentDate);
    if (view === "Month") d.setMonth(d.getMonth() - 1);
    else if (view === "Week") d.setDate(d.getDate() - 7);
    else if (view === "Day") d.setDate(d.getDate() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    setCurrentDate(d);
  };

  const formatDateDisplay = () => {
    if (view === "Month") return currentDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    if (view === "Year") return currentDate.getFullYear().toString();
    if (view === "Week") {
      const mon = new Date(currentDate);
      const day = mon.getDay();
      mon.setDate(mon.getDate() - day + (day === 0 ? -6 : 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `${mon.toLocaleDateString("it-IT", { month: "short", day: "numeric" })} – ${sun.toLocaleDateString("it-IT", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return currentDate.toLocaleDateString("it-IT", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  // ── Mese ────────────────────────────────────────────────────────────────────
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

    return (
      <div className="h-full flex flex-col min-h-[600px]">
        <div className="grid grid-cols-7 mb-2">
          {["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"].map((d) => (
            <div key={d} className="text-xs font-semibold text-gray-500 tracking-wider text-center">{d}</div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 gap-px bg-[#2A2A2A] border border-[#2A2A2A] rounded-lg overflow-hidden">
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="bg-[#181818] min-h-[120px]" />;
            const pd = dayOf(year, month, day);
            const { done, failed } = statusOf(year, month, day);
            const isToday = keyOf(year, month, day) === todayIso;
            return (
              <div key={`${year}-${month}-${day}`}
                className="bg-[#181818] min-h-[120px] p-2 flex flex-col group hover:bg-[#1E1E1E] transition-colors cursor-pointer"
                onClick={() => openDay(new Date(year, month, day))}>
                <span className={`text-sm font-medium mb-2 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-[#3B82F6] text-white" : "text-gray-400"}`}>{day}</span>
                {pd && (
                  <div className={`flex-1 rounded-md p-2 border flex flex-col gap-1 ${done ? "opacity-60" : ""}`}
                    style={{
                      borderColor: `${failed ? "#EF4444" : PLAN_KINDS[pd.kind].color}55`,
                      backgroundColor: `${failed ? "#EF4444" : PLAN_KINDS[pd.kind].color}12`,
                    }}>
                    <span className="text-xs font-bold text-gray-200 line-clamp-2">{pd.title}</span>
                    {pd.km ? <span className="text-[11px] text-gray-400">{pd.km.toLocaleString("it-IT")} km</span> : null}
                    {done && <span className="text-[11px] text-[#10B981]">✓ Effettuata</span>}
                    {failed && <span className="text-[11px] text-[#EF4444]">✗ Saltata</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Settimana ───────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const mon = new Date(currentDate);
    const day = mon.getDay();
    mon.setDate(mon.getDate() - day + (day === 0 ? -6 : 1));
    const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
    const dayNames = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];

    return (
      <div className="h-full flex flex-col min-h-[600px] overflow-x-auto">
        <div className="flex-1 grid grid-cols-7 gap-4 min-w-[900px]">
          {weekDays.map((date) => {
            const pd = dayOf(date.getFullYear(), date.getMonth(), date.getDate());
            const { done, failed } = statusOf(date.getFullYear(), date.getMonth(), date.getDate());
            const isToday = isoOf(date) === todayIso;
            return (
              <div key={date.toISOString()}
                className="rounded-xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4 flex flex-col cursor-pointer hover:border-white/[0.2] transition-colors"
                onClick={() => openDay(date)}>
                <div className="text-center mb-6 pb-4 border-b border-[#2A2A2A]">
                  <div className="text-xs font-semibold text-gray-500 tracking-wider mb-2">{dayNames[date.getDay()]}</div>
                  <div className={`text-2xl font-bold mx-auto w-10 h-10 flex items-center justify-center rounded-full ${isToday ? "bg-[#3B82F6] text-white" : "text-gray-200"}`}>{date.getDate()}</div>
                </div>
                {pd ? (
                  <div className={`flex-1 rounded-lg p-4 border flex flex-col gap-3 ${done ? "opacity-60" : ""}`}
                    style={{
                      borderColor: `${failed ? "#EF4444" : PLAN_KINDS[pd.kind].color}55`,
                      backgroundColor: `${failed ? "#EF4444" : PLAN_KINDS[pd.kind].color}12`,
                    }}>
                    <span className="text-sm font-bold text-gray-200">{pd.title}</span>
                    {pd.km ? <span className="text-xs text-gray-400 bg-[#1E1E1E] px-2 py-1.5 rounded">{pd.km.toLocaleString("it-IT")} km</span> : null}
                    {done && <span className="text-xs text-[#10B981] mt-auto">✓ Effettuata</span>}
                    {failed && <span className="text-xs text-[#EF4444] mt-auto">✗ Saltata</span>}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-600 font-medium bg-[#121212] rounded-lg border border-[#2A2A2A] border-dashed">
                    Fuori piano
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
  const renderDayDetail = (date: Date, onClose?: () => void) => {
    const iso = isoOf(date);
    const pd = PLAN_DAY_BY_DATE[iso];
    const { done, failed } = statusOf(date.getFullYear(), date.getMonth(), date.getDate());
    const col = pd ? PLAN_KINDS[pd.kind].color : "#2A2A2A";

    return (
      <div className="w-full max-w-2xl mx-auto rounded-2xl border border-white/[0.12] shadow-[0_8px_40px_rgba(0,0,0,0.85)] bg-[#141414] p-6 sm:p-8">
        {onClose && (
          <button type="button" onClick={onClose} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 group transition-colors">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Chiudi</span>
          </button>
        )}
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 text-center capitalize">
          {date.toLocaleDateString("it-IT", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </h2>

        {pd ? (
          <div className={`rounded-2xl border bg-surface p-6 sm:p-8 ${done ? "opacity-90" : ""}`}
            style={{ borderColor: `${failed ? "#EF4444" : col}55` }}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-6 border-b border-[#2A2A2A]">
              <h3 className="text-2xl font-bold text-gray-100">{pd.title}</h3>
              <span className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                done ? "bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]"
                  : failed ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
                  : "bg-[#1E1E1E] border-[#2A2A2A] text-gray-300"}`}>
                {done ? "✓ Effettuata" : failed ? "✗ Saltata" : "Programmata"}
              </span>
            </div>

            <div className="mb-6 pb-6 border-b border-[#2A2A2A]"><PlanDayBody day={pd} /></div>

            {/* Esito automatico: solo le sedute di corsa, confrontate coi giri */}
            {adherenceByDate[iso] && (
              <div className="mb-6 pb-6 border-b border-[#2A2A2A]">
                <SessionVerdict e={adherenceByDate[iso]} />
              </div>
            )}

            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Correzione manuale</div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => mark(iso, manual[iso] === "done" ? null : "done")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                    manual[iso] === "done" ? "bg-[#10B981] border-[#10B981] text-black" : "bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/20"}`}>
                  <CheckCircle2 className="w-4 h-4" /> Effettuato
                </button>
                <button type="button" onClick={() => mark(iso, failed ? null : "failed")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                    failed ? "bg-[#EF4444] border-[#EF4444] text-white" : "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20"}`}>
                  <XCircle className="w-4 h-4" /> Saltato
                </button>
              </div>
              <p className="text-[11px] text-gray-600 mt-2.5">
                {pd.done ? "Già segnata come fatta nel piano. " : ""}Salvato sul database, permanente. Ritocca lo stesso pulsante per annullare.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[#121212] rounded-xl border border-[#2A2A2A] border-dashed flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-[#1E1E1E] flex items-center justify-center mb-6 border border-[#2A2A2A]">
              <span className="text-4xl">☕</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-300">Fuori dal piano</h3>
            <p className="text-gray-500 mt-2">Il piano va da {planDateLabel(PLAN_META.start)} a {planDateLabel(PLAN_META.end)}.</p>
          </div>
        )}
      </div>
    );
  };

  const renderDayView = () => <div className="h-full flex items-start justify-center pt-4">{renderDayDetail(currentDate)}</div>;

  // ── Anno ────────────────────────────────────────────────────────────────────
  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
        {Array.from({ length: 12 }, (_, month) => {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          let firstDay = new Date(year, month, 1).getDay();
          firstDay = firstDay === 0 ? 6 : firstDay - 1;
          const days: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) days.push(null);
          for (let i = 1; i <= daysInMonth; i++) days.push(i);
          return (
            <div key={month}
              className="rounded-xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-5 cursor-pointer hover:border-white/[0.2] transition-colors"
              onClick={() => { const d = new Date(currentDate); d.setMonth(month); setCurrentDate(d); setView("Month"); }}>
              <h3 className="text-sm font-bold text-gray-200 mb-4 uppercase tracking-wider">{monthNames[month]} {year}</h3>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
                  const pd = dayOf(year, month, day);
                  const { done, failed } = statusOf(year, month, day);
                  return (
                    <div key={`${year}-${month}-${day}`}
                      className={`aspect-square rounded-sm ${pd ? "cursor-pointer hover:ring-1 hover:ring-white/50" : ""}`}
                      onClick={pd ? (e) => { e.stopPropagation(); openDay(new Date(year, month, day)); } : undefined}
                      style={{ backgroundColor: failed ? "#EF4444" : pd ? PLAN_KINDS[pd.kind].color : "#2A2A2A", opacity: pd ? (done ? 0.45 : 0.9) : 0.3 }}
                      title={pd ? `${day} ${monthNames[month]}: ${pd.title}${done ? " ✓" : failed ? " ✗" : ""}` : `${day} ${monthNames[month]}`} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#121212]">
      {/* Intestazione: va a capo invece di traboccare */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4 sm:p-6 border-b border-[#2A2A2A]">
        <div className="flex flex-wrap items-center gap-4 min-w-0">
          <h1 className="text-2xl font-bold text-white shrink-0">{t("sections.trainingMenu")}</h1>
          <span className="flex items-center gap-2 px-3 py-1.5 text-sm font-black rounded-lg"
            style={{ background: "var(--app-accent)", color: "#0A0A0A", boxShadow: "0 0 22px rgba(192,255,0,0.45)" }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#0A0A0A" }} />
            {PLAN_META.name}
          </span>
          <span className="text-xs text-gray-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>14 set → 18 ott</span>
          <AdherenceStrip evals={adherence} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <div className="flex bg-[#1E1E1E] rounded-md border border-[#2A2A2A] p-1">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" onClick={() => setView(v.id)}
                className={`px-3 sm:px-4 py-1.5 text-sm rounded-sm transition-colors ${view === v.id ? "bg-[#2A2A2A] text-white font-medium shadow-sm" : "text-gray-400 hover:text-gray-200"}`}>
                {v.label}
              </button>
            ))}
          </div>
          {view !== "Piano" && (
            <div className="flex items-center bg-[#1E1E1E] rounded-md border border-[#2A2A2A] px-2 py-1.5">
              <button type="button" onClick={prev} aria-label="Precedente" className="p-1 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="mx-2 text-sm text-gray-200 min-w-[160px] text-center font-semibold tracking-wide capitalize">{formatDateDisplay()}</span>
              <button type="button" onClick={next} aria-label="Successivo" className="p-1 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {/* In testa: le due targhe e la seduta che viene */}
        {/* larga quanto il piano originale: le targhe restano in proporzione */}
        <div className="max-w-3xl space-y-3 mb-10">
          <PlanBibs />
          <NextSession todayIso={todayIso} onOpen={openIso} />
          <p className="text-[11px] text-gray-500 px-1">{PLAN_META.version}</p>
          <ChangesPanel />
        </div>

        {view === "Piano" && (
          <PlanWeeks todayIso={todayIso} manual={manual} verdicts={adherenceByDate} onOpen={openIso} />
        )}
        {view === "Month" && renderMonthView()}
        {view === "Week" && renderWeekView()}
        {view === "Day" && renderDayView()}
        {view === "Year" && renderYearView()}

        <div className="mt-6 pt-4 border-t border-[#2A2A2A]"><PlanLegend /></div>

        {/* Il resto del piano: zone, test, gara, dopo */}
        <div className="mt-10 space-y-10">
          <ZonesPanel />
          <div className="grid gap-10 xl:grid-cols-2 items-start">
            <TestPanel />
            <RacePanel />
          </div>
          <AfterPanel />
        </div>
      </div>

      {/* Dettaglio seduta — copre tutto */}
      {detailDate && (
        <div className="fixed inset-0 z-[70] bg-[#0A0A0A] overflow-y-auto" onClick={closeDay} role="presentation">
          <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
            <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              {renderDayDetail(detailDate, closeDay)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
