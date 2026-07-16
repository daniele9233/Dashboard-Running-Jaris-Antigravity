import { useMemo } from "react";
import type { Run, FitnessFreshnessPoint, AnalyticsResponse, SupercompensationResponse } from "../../types/api";
import {
  V2, V2Card, V2Label, V2Stat, V2Gauge, V2StepLine, V2Dots, V2Legend,
  paceToSec, secToPace, MONTHS_IT, type StepPoint, type DotPoint,
} from "./v2Shared";

// ═══ 4 · BIOLOGIA & FUTURO ════════════════════════════════════════════════════

const ADAPT_COLORS: Record<string, string> = { neuromuscular: V2.lime, metabolic: V2.orange, structural: V2.cyan };
const ADAPT_LABELS: Record<string, string> = { neuromuscular: "Neuromuscolare", metabolic: "Metabolico", structural: "Strutturale" };

export function V2BiologyFuture({ superData }: { superData: SupercompensationResponse | null }) {
  const totals = superData?.adaptation_totals;
  const goldenLabel = useMemo(() => {
    if (!superData?.golden_day) return "—";
    const d = new Date(superData.golden_day);
    return `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`;
  }, [superData]);

  const readinessLine = useMemo<StepPoint[]>(() => {
    const proj = superData?.projection ?? [];
    return proj.slice(0, 21).map((p) => ({
      label: p.label ?? p.date.slice(5),
      value: Math.round(p.readiness),
      detail: p.label ?? p.date,
    }));
  }, [superData]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <V2Stat label="Giorno d'oro" value={goldenLabel} sub={superData?.days_to_golden != null ? `tra ${superData.days_to_golden} giorni · picco di forma` : "picco di forma previsto"} accent={V2.lime} />
      <V2Stat label="Corse analizzate" value={superData?.recent_runs?.length != null ? String(superData.recent_runs.length) : "—"} sub="finestra supercompensazione" accent={V2.orange} />

      <V2Card span="col-span-2">
        <V2Label>Adattamenti in maturazione</V2Label>
        <div className="flex items-center justify-around gap-2 flex-1 flex-wrap">
          {totals
            ? (Object.keys(ADAPT_COLORS) as Array<keyof typeof totals>).map((k) => (
                <div key={String(k)} className="contents">
                  <V2Gauge pct={totals[k]?.ready_pct ?? 0} label={ADAPT_LABELS[String(k)]}
                    sub={`${totals[k]?.runs ?? 0} corse`} color={ADAPT_COLORS[String(k)]} size={104} />
                </div>
              ))
            : <div className="text-[10px] uppercase tracking-widest py-8" style={{ color: V2.inkMuted }}>Dati insufficienti</div>}
        </div>
      </V2Card>

      <V2Card span="col-span-2 lg:col-span-4">
        <V2Label right="proiezione 3 settimane">Prontezza (readiness)</V2Label>
        <V2StepLine points={readinessLine} color={V2.lime} unit="/100" height={190} />
        <div className="mt-3 text-[10px] leading-4" style={{ color: V2.inkMuted }}>
          Ogni seduta è un investimento che matura in 2-14 giorni a seconda del sistema (neuromuscolare, metabolico, strutturale).
        </div>
      </V2Card>
    </div>
  );
}

// ═══ 5 · CLIMA & RITMO ════════════════════════════════════════════════════════

export function V2ClimatePace({ runs, analytics }: { runs: Run[]; analytics: AnalyticsResponse | null }) {
  // Scatter temperatura → passo (solo outdoor con temperatura registrata)
  const dots = useMemo<DotPoint[]>(() => {
    return runs
      .map((r): DotPoint | null => {
        const pace = paceToSec(r.avg_pace);
        if (r.is_treadmill || r.temperature == null || !pace || (r.distance_km || 0) < 3) return null;
        const d = new Date(r.date);
        return {
          x: r.temperature, y: pace,
          label: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`,
          detail: `${Math.round(r.temperature)}°C · ${secToPace(pace)}/km · ${r.distance_km.toFixed(1)} km`,
          color: r.temperature >= 25 ? V2.orange : V2.lime,
        };
      })
      .filter((p): p is DotPoint => p !== null)
      .slice(0, 120);
  }, [runs]);

  const stats = useMemo(() => {
    const cool = dots.filter((d) => d.x < 18).map((d) => d.y);
    const hot = dots.filter((d) => d.x >= 25).map((d) => d.y);
    const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
    const cAvg = avg(cool), hAvg = avg(hot);
    return {
      cool: cAvg ? secToPace(cAvg) : "—",
      hot: hAvg ? secToPace(hAvg) : "—",
      delta: cAvg && hAvg ? Math.round(hAvg - cAvg) : null,
    };
  }, [dots]);

  const bands = analytics?.race_predictions_temp?.bands ?? [];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <V2Stat label="Passo al fresco" value={stats.cool} unit="/km" sub="corse sotto 18°C" accent={V2.lime} />
      <V2Stat label="Passo al caldo" value={stats.hot} unit="/km" sub="corse sopra 25°C" accent={V2.orange} />
      <V2Stat label="Costo del caldo" value={stats.delta != null ? `+${stats.delta}` : "—"} unit="sec/km" sub="differenza media misurata" accent={V2.cyan} />
      <V2Stat label="Corse col meteo" value={String(dots.length)} sub="outdoor ≥3 km con temperatura" accent={V2.lime} />

      <V2Card span="col-span-2 lg:col-span-4">
        <V2Label right="ogni punto una corsa">Temperatura → passo</V2Label>
        <V2Dots dots={dots} xUnit="°" yFmt={(v) => `${secToPace(v)}/km`} height={230} xTicks={[10, 20, 30]} />
        <div className="mt-3"><V2Legend items={[{ color: V2.lime, label: "sotto 25°C" }, { color: V2.orange, label: "25°C e oltre" }]} /></div>
      </V2Card>

      {bands.length > 0 && (
        <V2Card span="col-span-2 lg:col-span-4">
          <V2Label right="stesso motore, clima diverso">Previsioni per fascia climatica</V2Label>
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ fontFamily: V2.mono }}>
              <thead>
                <tr>
                  <th className="py-2 pr-4 text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: V2.inkMuted }}>Fascia</th>
                  {["5K", "10K", "Half Marathon"].map((k) => (
                    <th key={k} className="py-2 pr-4 text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: V2.inkMuted }}>{k === "Half Marathon" ? "Mezza" : k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bands.map((b) => (
                  <tr key={b.key} style={{ borderTop: `1px solid ${V2.border}` }}>
                    <td className="py-2.5 pr-4">
                      <div className="text-[11px] font-black" style={{ color: V2.ink }}>{b.label}</div>
                      <div className="text-[9px]" style={{ color: V2.inkMuted }}>{b.range} · {b.humidity}% um.</div>
                    </td>
                    {["5K", "10K", "Half Marathon"].map((k) => (
                      <td key={k} className="py-2.5 pr-4 text-[12px] font-black tabular-nums" style={{ color: V2.ink }}>{b.predictions[k] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </V2Card>
      )}
    </div>
  );
}

// ═══ 6 · DETRAINING ═══════════════════════════════════════════════════════════

export function V2Detraining({ runs, ff }: { runs: Run[]; ff: FitnessFreshnessPoint[] }) {
  const stats = useMemo(() => {
    const sorted = [...runs].sort((a, b) => b.date.localeCompare(a.date));
    const last = sorted[0] ?? null;
    const daysSince = last ? Math.floor((Date.now() - new Date(last.date.slice(0, 10) + "T00:00:00").getTime()) / 86400000) : null;
    const kmIn = (fromDays: number, toDays: number) => {
      const from = Date.now() - fromDays * 86400000, to = Date.now() - toDays * 86400000;
      return runs.filter((r) => { const t = new Date(r.date).getTime(); return t >= from && t < to; })
        .reduce((s, r) => s + (r.distance_km || 0), 0);
    };
    const last4 = kmIn(28, 0), prev4 = kmIn(56, 28);
    const deltaPct = prev4 > 0 ? Math.round(((last4 - prev4) / prev4) * 100) : null;
    const ctlNow = ff.length ? ff[ff.length - 1].ctl : null;
    const ctl28 = ff.length > 28 ? ff[ff.length - 29].ctl : null;
    return { daysSince, last4: Math.round(last4), prev4: Math.round(prev4), deltaPct, ctlNow, ctlDelta: ctlNow != null && ctl28 != null ? Math.round((ctlNow - ctl28) * 10) / 10 : null };
  }, [runs, ff]);

  const ctlLine = useMemo<StepPoint[]>(() => {
    const cutoff = Date.now() - 90 * 86400000;
    const pts = ff.filter((p) => new Date(p.date).getTime() >= cutoff);
    const step = Math.max(1, Math.floor(pts.length / 60));
    return pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => {
      const d = new Date(p.date);
      return { label: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`, value: Math.round(p.ctl * 10) / 10, detail: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}` };
    });
  }, [ff]);

  const state = stats.daysSince == null ? { label: "—", tone: V2.neutral, note: "" }
    : stats.daysSince <= 3 ? { label: "ATTIVO", tone: V2.lime, note: "Nessuna perdita: il fitness si mantiene." }
    : stats.daysSince <= 10 ? { label: "PAUSA BREVE", tone: V2.orange, note: "Fino a ~10 giorni il VO2max cala poco (1-3%). Riparti facile." }
    : { label: "DETRAINING", tone: V2.cyan, note: "Oltre 2 settimane il volume plasmatico e il VO2max calano: riprendi con progressione graduale." };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <V2Stat label="Ultima corsa" value={stats.daysSince != null ? String(stats.daysSince) : "—"} unit={stats.daysSince === 1 ? "giorno fa" : "giorni fa"} sub={state.label} accent={state.tone} />
      <V2Stat label="Km 4 settimane" value={String(stats.last4)} unit="km" sub={`prima erano ${stats.prev4} km`} accent={V2.lime} />
      <V2Stat label="Trend volume" value={stats.deltaPct != null ? `${stats.deltaPct > 0 ? "+" : ""}${stats.deltaPct}%` : "—"} sub="ultime 4 sett. vs precedenti" accent={stats.deltaPct != null && stats.deltaPct < 0 ? V2.orange : V2.lime} />
      <V2Stat label="Fitness · CTL" value={stats.ctlNow != null ? stats.ctlNow.toFixed(1) : "—"} sub={stats.ctlDelta != null ? `${stats.ctlDelta > 0 ? "+" : ""}${stats.ctlDelta} in 4 settimane` : "trend 4 settimane"} accent={V2.cyan} />

      <V2Card span="col-span-2 lg:col-span-4">
        <V2Label right="90 giorni">Fitness (CTL) nel tempo</V2Label>
        <V2StepLine points={ctlLine} color={V2.orange} unit="CTL" height={190} />
        <div className="mt-3 text-[10px] leading-4" style={{ color: V2.inkMuted }}>{state.note}</div>
      </V2Card>
    </div>
  );
}
