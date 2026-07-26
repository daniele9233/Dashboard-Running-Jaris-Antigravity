import { useMemo } from "react";
import { CloudSun, ThermometerSun, Droplets, Wind, TrendingDown } from "lucide-react";
import type { Run } from "../../../types/api";
import { CHART_SERIES } from "../../statistics/chartTheme";

const NEON = CHART_SERIES.primary;
const CYAN = CHART_SERIES.compare;
const LOAD = CHART_SERIES.load;
const RISK = CHART_SERIES.risk;

interface WeatherSnapshot {
  temperature: number | null;
  humidity: number | null;
  dewpoint: number | null;
}

function computeDewpoint(temp: number, humidity: number): number {
  return temp - ((100 - humidity) / 5);
}

function dewPenalty(dewpoint: number): number {
  if (dewpoint <= 10) return 0;
  if (dewpoint <= 15) return (dewpoint - 10) * 0.8;
  return 4 + (dewpoint - 15) * 1.2;
}

function heatPenalty(temp: number): number {
  if (temp <= 12) return 0;
  if (temp <= 20) return (temp - 12) * 0.3;
  return 2.4 + (temp - 20) * 0.8;
}

function humidityFactor(humidity: number): number {
  if (humidity <= 60) return 0;
  return Math.min(4, (humidity - 60) * 0.12);
}

function computePenalty(run: Run): WeatherSnapshot & { penaltySec: number } {
  const temp = run.temperature ?? null;
  if (temp == null || temp <= 5) {
    return { temperature: temp, humidity: null, dewpoint: null, penaltySec: 0 };
  }

  const humidity = run.weather ? parseFloat(run.weather) : null;
  const rh = humidity ?? 55;
  const dew = computeDewpoint(temp, rh);

  const tPenalty = heatPenalty(temp);
  const hPenalty = humidityFactor(rh);
  const dPenalty = dewPenalty(dew);
  const penalty = Math.max(0, Math.min(30, (tPenalty + hPenalty + dPenalty) * 0.55));

  return { temperature: temp, humidity: rh, dewpoint: dew, penaltySec: penalty };
}

function fmtDeg(c: number): string {
  return `${Math.round(c)}°`;
}

function fmtPct(v: number): string {
  return `${Math.round(v)}%`;
}

interface WeatherNormalizerWidgetProps {
  runs: Run[];
}

export function WeatherNormalizerWidget({ runs }: WeatherNormalizerWidgetProps) {
  const analysis = useMemo(() => {
    const qualif = runs
      .filter((r) => !r.is_treadmill && r.start_latlng && (r.temperature ?? 0) > 5)
      .slice(0, 60);

    if (qualif.length === 0) return null;

    const snapshots = qualif.map(computePenalty).filter((s) => s.temperature != null);
    if (snapshots.length === 0) return null;

    const avgTemp = snapshots.reduce((s, x) => s + (x.temperature ?? 0), 0) / snapshots.length;
    const avgHumidity = snapshots.reduce((s, x) => s + (x.humidity ?? 0), 0) / snapshots.length;
    const avgDew = snapshots.reduce((s, x) => s + (x.dewpoint ?? 0), 0) / snapshots.length;
    const avgPenalty = snapshots.reduce((s, x) => s + x.penaltySec, 0) / snapshots.length;
    const hotDays = snapshots.filter((s) => (s.temperature ?? 0) > 22).length;

    const penaltyColor =
      avgPenalty < 3 ? NEON : avgPenalty < 7 ? LOAD : RISK;

    const trend = snapshots.slice(-12).map((s, i) => ({
      i,
      penalty: s.penaltySec,
      temp: s.temperature,
    }));

    return {
      avgTemp,
      avgHumidity,
      avgDew,
      avgPenalty,
      hotDays,
      total: snapshots.length,
      penaltyColor,
      trend,
    };
  }, [runs]);

  if (!analysis) {
    return (
      <div className="h-full rounded-[24px] p-6 flex flex-col justify-center items-center backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50">
        <CloudSun className="w-8 h-8 mb-3" style={{ color: "#444" }} />
        <p className="text-[#666] text-[10px] font-black tracking-widest uppercase text-center">
          Dati meteo non disponibili<br />Sincronizza corse outdoor con GPS
        </p>
      </div>
    );
  }

  return (
    <div className="h-full rounded-[24px] p-5 flex flex-col overflow-hidden backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CloudSun className="w-4 h-4" style={{ color: NEON }} />
          <span className="text-[10px] font-black tracking-widest uppercase text-[#A0A0A0]">Impatto Meteo</span>
        </div>
        <span className="text-[9px] font-bold text-[#555]">{analysis.total} corse</span>
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
          <div className="text-lg font-black text-white">{fmtPct(analysis.avgHumidity)}</div>
          <div className="text-[8px] font-bold tracking-wider text-[#555]">RH</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-2.5 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
          <Wind className="w-3.5 h-3.5 mx-auto mb-1.5" style={{ color: "#A78BFA" }} />
          <div className="text-lg font-black text-white">{fmtDeg(analysis.avgDew)}</div>
          <div className="text-[8px] font-bold tracking-wider text-[#555]">DEW</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
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
          <div className="flex items-end gap-0.5 h-10">
            {analysis.trend.map((t) => {
              const maxP = Math.max(...analysis.trend.map((p) => p.penalty), 1);
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
            })}
          </div>
        )}

        <div className="flex justify-between mt-1 text-[8px] font-bold text-[#333]">
          <span>recente</span>
          <span>{analysis.trend.length >= 4 ? "→" : ""}</span>
          <span>{analysis.trend.length >= 4 ? "passato" : ""}</span>
        </div>
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
