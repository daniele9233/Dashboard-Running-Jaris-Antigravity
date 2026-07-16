import { useMemo } from "react";
import type { Run, FitnessFreshnessPoint, AnalyticsResponse, VdotPacesResponse } from "../../types/api";
import {
  V2, V2Card, V2Label, V2Stat, V2HBars, V2StepLine, V2Dots, V2Legend,
  paceToSec, secToPace, mondayOf, MONTHS_IT, type StepPoint, type HBarRow, type DotPoint,
} from "./v2Shared";

const toLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ═══ 1 · CARICO & FORMA ════════════════════════════════════════════════════════

export function V2LoadForm({ runs, ff }: { runs: Run[]; ff: FitnessFreshnessPoint[] }) {
  const cur = ff.length ? ff[ff.length - 1] : null;

  // Km della settimana corrente (lun→dom)
  const weekKm = useMemo(() => {
    const monday = mondayOf(new Date());
    return runs.filter((r) => new Date(r.date.slice(0, 10) + "T00:00:00") >= monday)
      .reduce((s, r) => s + (r.distance_km || 0), 0);
  }, [runs]);

  // TSB ultimi 90 giorni → step line
  const tsbLine = useMemo<StepPoint[]>(() => {
    const cutoff = Date.now() - 90 * 86400000;
    const pts = ff.filter((p) => new Date(p.date).getTime() >= cutoff);
    const step = Math.max(1, Math.floor(pts.length / 60));
    return pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => {
      const d = new Date(p.date);
      return { label: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`, value: Math.round(p.tsb * 10) / 10, detail: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}` };
    });
  }, [ff]);

  // Km per settimana di calendario (ultime 10, lun→dom)
  const weeklyBars = useMemo<HBarRow[]>(() => {
    const thisMonday = mondayOf(new Date());
    const rows: HBarRow[] = [];
    for (let w = 9; w >= 0; w--) {
      const start = new Date(thisMonday);
      start.setDate(thisMonday.getDate() - w * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const km = runs.filter((r) => {
        const t = new Date(r.date.slice(0, 10) + "T00:00:00").getTime();
        return t >= start.getTime() && t < end.getTime();
      }).reduce((s, r) => s + (r.distance_km || 0), 0);
      rows.push({
        label: `${start.getDate()} ${MONTHS_IT[start.getMonth()]}`,
        value: Math.round(km * 10) / 10,
        color: w === 0 ? V2.lime : V2.orange,
      });
    }
    return rows;
  }, [runs]);

  // Distribuzione zone FC (minuti, ultimi 90 giorni)
  const zoneBars = useMemo<HBarRow[]>(() => {
    const cutoff = Date.now() - 90 * 86400000;
    const zones = [0, 0, 0, 0, 0];
    for (const r of runs) {
      if (new Date(r.date).getTime() < cutoff || !r.avg_hr_pct) continue;
      const pct = r.avg_hr_pct > 1 ? r.avg_hr_pct : r.avg_hr_pct * 100;
      const dur = r.duration_minutes || 0;
      if (pct < 65) zones[0] += dur; else if (pct < 77) zones[1] += dur;
      else if (pct < 84) zones[2] += dur; else if (pct < 91) zones[3] += dur; else zones[4] += dur;
    }
    return zones.map((min, i) => ({ label: `Z${i + 1}`, value: Math.round(min), color: V2.lime }));
  }, [runs]);

  const tsbTone = cur == null ? V2.neutral : cur.tsb > 5 ? V2.lime : cur.tsb > -15 ? V2.orange : V2.cyan;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <V2Stat label="Condizione · CTL" value={cur ? cur.ctl.toFixed(1) : "—"} sub="fitness cronica 42g" accent={V2.lime} />
      <V2Stat label="Fatica · ATL" value={cur ? cur.atl.toFixed(1) : "—"} sub="carico acuto 7g" accent={V2.orange} />
      <V2Stat label="Forma · TSB" value={cur ? cur.tsb.toFixed(1) : "—"} sub={cur && cur.tsb > 5 ? "fresco" : cur && cur.tsb > -15 ? "neutro" : "affaticato"} accent={tsbTone} />
      <V2Stat label="Settimana" value={weekKm.toFixed(1)} unit="km" sub="da lunedì" accent={V2.cyan} />

      <V2Card span="col-span-2 lg:col-span-4">
        <V2Label right="90 giorni">Forma (TSB) nel tempo</V2Label>
        <V2StepLine points={tsbLine} color={V2.lime} unit="TSB" height={190} />
      </V2Card>

      <V2Card span="col-span-2">
        <V2Label right="settimane lun→dom">Volume settimanale</V2Label>
        <V2HBars rows={weeklyBars} unit="km" />
        <div className="mt-4"><V2Legend items={[{ color: V2.lime, label: "settimana corrente" }, { color: V2.orange, label: "settimane precedenti" }]} /></div>
      </V2Card>

      <V2Card span="col-span-2">
        <V2Label right="minuti · 90 giorni">Zone FC</V2Label>
        <V2HBars rows={zoneBars} unit="min" />
        <div className="mt-4 text-[10px] leading-4" style={{ color: V2.inkMuted }}>
          Z1-Z2 aerobico facile · Z3 medio · Z4 soglia · Z5 VO2max
        </div>
      </V2Card>
    </div>
  );
}

// ═══ 2 · POTENZIALE & PROGRESSI ═══════════════════════════════════════════════

export function V2PotentialProgress({ runs, analytics, vdotPaces }: {
  runs: Run[]; analytics: AnalyticsResponse | null; vdotPaces: VdotPacesResponse | null;
}) {
  // Trend passo medio mensile (12 mesi) dal backend analytics.pace_trend,
  // fallback client-side dai runs.
  const paceLine = useMemo<StepPoint[]>(() => {
    const src = analytics?.pace_trend ?? [];
    if (src.length >= 3) {
      return src.slice(-12).map((p) => {
        const d = new Date(p.date);
        const sec = paceToSec(p.pace);
        return { label: MONTHS_IT[d.getMonth()], value: sec, detail: `${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}` };
      });
    }
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const mRuns = runs.filter((r) => {
        const rd = new Date(r.date);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth() && !r.is_treadmill && paceToSec(r.avg_pace);
      });
      if (!mRuns.length) return { label: MONTHS_IT[d.getMonth()], value: null };
      const totKm = mRuns.reduce((s, r) => s + r.distance_km, 0);
      const wsec = mRuns.reduce((s, r) => s + (paceToSec(r.avg_pace) ?? 0) * r.distance_km, 0) / (totKm || 1);
      return { label: MONTHS_IT[d.getMonth()], value: Math.round(wsec), detail: `${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}` };
    });
  }, [analytics, runs]);

  // Best effort 5K-equivalente mensile (miglior passo su corse ≥4km) → progresso
  const bestLine = useMemo<StepPoint[]>(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const m = runs.filter((r) => {
        const rd = new Date(r.date);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth()
          && !r.is_treadmill && (r.distance_km || 0) >= 4 && paceToSec(r.avg_pace);
      });
      if (!m.length) return { label: MONTHS_IT[d.getMonth()], value: null };
      const best = Math.min(...m.map((r) => paceToSec(r.avg_pace)!));
      return { label: MONTHS_IT[d.getMonth()], value: best, detail: `${MONTHS_IT[d.getMonth()]} · miglior passo ≥4km` };
    });
  }, [runs]);

  const preds = analytics?.race_predictions ?? {};
  const predOrder: Array<[string, string]> = [["5K", "5K"], ["10K", "10K"], ["Half Marathon", "Mezza"], ["Marathon", "Maratona"]];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <V2Stat label="VDOT" value={analytics?.vdot != null ? analytics.vdot.toFixed(1) : "—"} sub="motore attuale" accent={V2.lime} />
      <V2Stat label="Passo soglia" value={vdotPaces?.paces?.threshold ?? "—"} unit="/km" sub="tenibile ~1h" accent={V2.orange} />
      {predOrder.slice(0, 2).map(([k, label]) => (
        <div key={k} className="contents">
          <V2Stat label={`Prev. ${label}`} value={preds[k] ?? "—"} sub="a temperatura ideale" accent={V2.cyan} />
        </div>
      ))}

      <V2Card span="col-span-2 lg:col-span-4">
        <V2Label right="12 mesi · più basso = più veloce">Passo medio mensile</V2Label>
        <V2StepLine points={paceLine} color={V2.lime} unit="/km" height={190} fmt={secToPace} />
      </V2Card>

      <V2Card span="col-span-2">
        <V2Label right="miglior passo mensile ≥4 km">Progressione velocità</V2Label>
        <V2StepLine points={bestLine} color={V2.orange} unit="/km" height={170} fmt={secToPace} />
      </V2Card>

      <V2Card span="col-span-2">
        <V2Label right="stima attuale">Previsioni gara</V2Label>
        <div className="grid grid-cols-2 gap-3 flex-1">
          {predOrder.map(([k, label]) => (
            <div key={k} className="rounded-2xl p-4 flex flex-col justify-center" style={{ background: V2.surfaceUp, border: `1px solid ${V2.border}` }}>
              <div className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: V2.inkMuted, fontFamily: V2.mono }}>{label}</div>
              <div className="text-xl font-black tabular-nums mt-1" style={{ color: V2.ink, fontFamily: V2.mono }}>{preds[k] ?? "—"}</div>
            </div>
          ))}
        </div>
      </V2Card>
    </div>
  );
}

// ═══ 3 · BIOMECCANICA & EFFICIENZA ════════════════════════════════════════════

const bio = (r: Run) => ({
  cad: r.avg_cadence_spm ?? r.biomechanics?.avg_cadence_spm ?? (r.avg_cadence && r.avg_cadence < 120 ? r.avg_cadence * 2 : r.avg_cadence) ?? null,
  gct: r.avg_ground_contact_time ?? r.biomechanics?.avg_ground_contact_time_ms ?? null,
  vo: r.avg_vertical_oscillation ?? r.biomechanics?.avg_vertical_oscillation_cm ?? null,
  stride: r.avg_stride_length ?? r.biomechanics?.avg_stride_length_m ?? null,
});

export function V2Biomechanics({ runs }: { runs: Run[] }) {
  const recent = useMemo(() => {
    const cutoff = Date.now() - 90 * 86400000;
    return runs.filter((r) => new Date(r.date).getTime() >= cutoff && !r.is_treadmill);
  }, [runs]);

  const avg = (vals: Array<number | null>) => {
    const v = vals.filter((x): x is number => x != null && x > 0);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };

  const cadAvg = avg(recent.map((r) => bio(r).cad));
  const gctAvg = avg(recent.map((r) => bio(r).gct));
  const voAvg = avg(recent.map((r) => bio(r).vo));
  const strideAvg = avg(recent.map((r) => bio(r).stride));

  // Cadenza mensile 12 mesi
  const cadLine = useMemo<StepPoint[]>(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const m = runs.filter((r) => {
        const rd = new Date(r.date);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth() && !r.is_treadmill;
      }).map((r) => bio(r).cad).filter((c): c is number => c != null && c > 120);
      if (!m.length) return { label: MONTHS_IT[d.getMonth()], value: null };
      return { label: MONTHS_IT[d.getMonth()], value: Math.round(m.reduce((s, c) => s + c, 0) / m.length), detail: `${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}` };
    });
  }, [runs]);

  // Scatter: cadenza (x) vs passo (y) — efficienza del gesto
  const effDots = useMemo<DotPoint[]>(() => {
    return recent
      .map((r): DotPoint | null => {
        const cad = bio(r).cad, pace = paceToSec(r.avg_pace);
        if (!cad || cad < 120 || !pace) return null;
        const d = new Date(r.date);
        return {
          x: Math.round(cad), y: pace,
          label: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`,
          detail: `${Math.round(cad)} spm · ${secToPace(pace)}/km · ${r.distance_km.toFixed(1)} km`,
          color: V2.lime,
        };
      })
      .filter((p): p is DotPoint => p !== null)
      .slice(0, 60);
  }, [recent]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <V2Stat label="Cadenza" value={cadAvg ? String(Math.round(cadAvg)) : "—"} unit="spm" sub="media 90g · target 170-180" accent={V2.lime} />
      <V2Stat label="Contatto suolo" value={gctAvg ? String(Math.round(gctAvg)) : "—"} unit="ms" sub="più basso = più reattivo" accent={V2.orange} />
      <V2Stat label="Oscillazione" value={voAvg ? voAvg.toFixed(1) : "—"} unit="cm" sub="verticale · target < 10" accent={V2.cyan} />
      <V2Stat label="Falcata" value={strideAvg ? strideAvg.toFixed(2) : "—"} unit="m" sub="lunghezza media" accent={V2.lime} />

      <V2Card span="col-span-2 lg:col-span-4">
        <V2Label right="media mensile · 12 mesi">Cadenza nel tempo</V2Label>
        <V2StepLine points={cadLine} color={V2.lime} unit="spm" height={180} />
      </V2Card>

      <V2Card span="col-span-2 lg:col-span-4">
        <V2Label right="ultime 90g · ogni punto una corsa">Cadenza vs passo</V2Label>
        <V2Dots dots={effDots} xUnit=" spm" yFmt={(v) => `${secToPace(v)}/km`} height={220} />
        <div className="mt-3 text-[10px]" style={{ color: V2.inkMuted }}>
          In basso a destra = gesto efficiente (cadenza alta, passo veloce). Passa il cursore sui punti per i dettagli.
        </div>
      </V2Card>
    </div>
  );
}
