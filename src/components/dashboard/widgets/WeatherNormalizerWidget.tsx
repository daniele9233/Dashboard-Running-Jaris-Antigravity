import { useEffect, useMemo, useRef, useState } from "react";
import { CloudSun, ThermometerSun, Droplets, Wind, TrendingDown, Loader2 } from "lucide-react";
import type { Run } from "../../../types/api";
import { CHART_SERIES } from "../../statistics/chartTheme";
import {
  fetchWeatherBatch,
  computeEnvironmentalPenalty,
  hasWeatherContext,
  type WeatherSnapshot,
} from "../../../utils/weather";

const NEON = CHART_SERIES.primary;
const CYAN = CHART_SERIES.compare;
const LOAD = CHART_SERIES.load;
const RISK = CHART_SERIES.risk;

/** Quante corse recenti alimentano il widget. Oltre, la resa non migliora e
 *  open-meteo inizia a rallentare. */
const SAMPLE_SIZE = 30;
/** Barre nello sparkline in fondo. */
const TREND_SIZE = 12;

const CARD =
  "h-full rounded-[24px] p-6 flex flex-col backdrop-blur-2xl border border-white/[0.12] " +
  "shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] " +
  "bg-gradient-to-br from-white/[0.06] to-black/50";

const fmtDeg = (c: number) => `${Math.round(c)}°`;
const fmtPct = (v: number) => `${Math.round(v)}%`;

type Status = "idle" | "loading" | "ready" | "empty" | "error";

function EmptyCard({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className={`${CARD} justify-center items-center`}>
      {icon}
      <p className="text-[#666] text-[10px] font-black tracking-widest uppercase text-center mt-3">
        {title}
      </p>
      {hint && (
        <p className="text-[#4A4A4A] text-[9px] font-bold text-center mt-1.5 max-w-[85%]">{hint}</p>
      )}
    </div>
  );
}

export function WeatherNormalizerWidget({ runs }: { runs: Run[] }) {
  const [weather, setWeather] = useState<Map<string, WeatherSnapshot | null>>(new Map());
  const [status, setStatus] = useState<Status>("idle");
  const reqId = useRef(0);

  // Corse candidate: outdoor con GPS, le più recenti. `runs` arriva già
  // ordinato per data discendente dall'endpoint.
  const sample = useMemo(
    () => runs.filter(hasWeatherContext).slice(0, SAMPLE_SIZE),
    [runs],
  );

  // Chiave stabile: senza, un nuovo array `runs` a ogni render rilancerebbe le
  // fetch all'infinito.
  const sampleKey = useMemo(() => sample.map((r) => r.id).join(","), [sample]);

  useEffect(() => {
    if (sample.length === 0) {
      setStatus("empty");
      return;
    }
    const myReq = ++reqId.current;
    setStatus("loading");
    fetchWeatherBatch(sample)
      .then((map) => {
        if (myReq !== reqId.current) return; // risposta di una richiesta superata
        setWeather(map);
        setStatus("ready");
      })
      .catch(() => {
        if (myReq !== reqId.current) return;
        setStatus("error");
      });
    // sampleKey identifica il set di corse; `sample` cambierebbe identità troppo spesso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKey]);

  const analysis = useMemo(() => {
    if (sample.length === 0) return null;

    const rows = sample
      .map((run) => {
        const w = weather.get(run.id) ?? null;
        if (!w || w.temperature == null) return null;
        return { run, w, penalty: computeEnvironmentalPenalty(run, w) };
      })
      .filter((r): r is { run: Run; w: WeatherSnapshot; penalty: number } => r !== null);

    if (rows.length === 0) return null;

    const mean = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
    const temps = rows.map((r) => r.w.temperature as number);
    const hums = rows.map((r) => r.w.humidity).filter((v): v is number => v != null);
    const dews = rows.map((r) => r.w.dewpoint).filter((v): v is number => v != null);
    const avgPenalty = mean(rows.map((r) => r.penalty));

    // rows è dal più recente al più vecchio: invertito, lo sparkline scorre da
    // sinistra (passato) a destra (recente), come si legge un grafico.
    const trend = rows
      .slice(0, TREND_SIZE)
      .reverse()
      .map((r, i) => ({ i, penalty: r.penalty, temp: r.w.temperature }));

    return {
      avgTemp: mean(temps),
      avgHumidity: hums.length ? mean(hums) : null,
      avgDew: dews.length ? mean(dews) : null,
      avgPenalty,
      hotDays: rows.filter((r) => (r.w.temperature ?? 0) > 22).length,
      total: rows.length,
      penaltyColor: avgPenalty < 3 ? NEON : avgPenalty < 7 ? LOAD : RISK,
      trend,
    };
  }, [sample, weather]);

  if (status === "empty" || (status === "ready" && !analysis)) {
    return (
      <EmptyCard
        icon={<CloudSun className="w-8 h-8" style={{ color: "#444" }} />}
        title={sample.length === 0 ? "Nessuna corsa outdoor con GPS" : "Meteo non recuperabile"}
        hint={
          sample.length === 0
            ? "Il widget usa le corse all'aperto georeferenziate"
            : "Il servizio meteo non ha dati per queste corse"
        }
      />
    );
  }

  if (status === "error") {
    return (
      <EmptyCard
        icon={<CloudSun className="w-8 h-8" style={{ color: "#444" }} />}
        title="Meteo non disponibile"
        hint="Servizio non raggiungibile, riprova più tardi"
      />
    );
  }

  if (!analysis) {
    return (
      <EmptyCard
        icon={<Loader2 className="w-8 h-8 animate-spin" style={{ color: "#555" }} />}
        title="Recupero meteo…"
        hint={`${sample.length} corse in analisi`}
      />
    );
  }

  const isRefreshing = status === "loading";

  return (
    <div className={`${CARD} p-5 overflow-hidden`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CloudSun className="w-4 h-4" style={{ color: NEON }} />
          <span className="text-[10px] font-black tracking-widest uppercase text-[#A0A0A0]">Impatto Meteo</span>
        </div>
        <span className="text-[9px] font-bold text-[#555] flex items-center gap-1.5">
          {isRefreshing && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
          {analysis.total} corse
        </span>
      </div>

      <div className="text-center mb-4">
        <div className="text-[42px] font-black leading-none" style={{ color: analysis.penaltyColor }}>
          {analysis.avgPenalty.toFixed(1)}
        </div>
        <div className="text-[10px] font-bold tracking-wider text-[#666] mt-0.5">
          sec/km di penalità media
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl border border-white/[0.06] p-2.5 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
          <ThermometerSun className="w-3.5 h-3.5 mx-auto mb-1.5" style={{ color: LOAD }} />
          <div className="text-lg font-black text-white">{fmtDeg(analysis.avgTemp)}</div>
          <div className="text-[8px] font-bold tracking-wider text-[#555]">TEMP</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-2.5 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
          <Droplets className="w-3.5 h-3.5 mx-auto mb-1.5" style={{ color: CYAN }} />
          <div className="text-lg font-black text-white">
            {analysis.avgHumidity != null ? fmtPct(analysis.avgHumidity) : "—"}
          </div>
          <div className="text-[8px] font-bold tracking-wider text-[#555]">RH</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-2.5 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
          <Wind className="w-3.5 h-3.5 mx-auto mb-1.5" style={{ color: "#A78BFA" }} />
          <div className="text-lg font-black text-white">
            {analysis.avgDew != null ? fmtDeg(analysis.avgDew) : "—"}
          </div>
          <div className="text-[8px] font-bold tracking-wider text-[#555]">DEW</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold tracking-wider text-[#666] uppercase">Giorni caldi</span>
          <span className="text-[11px] font-black text-white">
            {analysis.hotDays}<span className="text-[#555]">/{analysis.total}</span>
          </span>
        </div>

        <div className="h-1.5 rounded-full w-full mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, (analysis.hotDays / Math.max(analysis.total, 1)) * 100)}%`,
              background: analysis.hotDays > analysis.total * 0.5 ? RISK : LOAD,
            }}
          />
        </div>

        {analysis.trend.length >= 4 && (
          <>
            <div className="flex items-end gap-0.5 h-10">
              {(() => {
                const maxP = Math.max(...analysis.trend.map((p) => p.penalty), 1);
                return analysis.trend.map((t) => {
                  const h = Math.max(4, (t.penalty / maxP) * 100);
                  const color = t.penalty < 3 ? NEON : t.penalty < 7 ? LOAD : RISK;
                  return (
                    <div
                      key={t.i}
                      className="flex-1 rounded-t-sm"
                      style={{ height: `${h}%`, background: color, opacity: 0.7 }}
                      title={`${t.penalty.toFixed(1)} sec/km · ${fmtDeg(t.temp ?? 0)}`}
                    />
                  );
                });
              })()}
            </div>
            <div className="flex justify-between mt-1 text-[8px] font-bold text-[#333]">
              <span>passato</span>
              <span>→</span>
              <span>recente</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-2 pt-3 border-t border-white/[0.04]">
        <TrendingDown className="w-3 h-3" style={{ color: analysis.penaltyColor }} />
        <span className="text-[9px] font-bold tracking-wider" style={{ color: analysis.penaltyColor }}>
          {analysis.avgPenalty < 3
            ? "Condizioni quasi ideali"
            : analysis.avgPenalty < 7
            ? "Il caldo frena leggermente"
            : "Il meteo impatta il passo"}
        </span>
      </div>
    </div>
  );
}
