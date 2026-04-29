import React from 'react';
import type { Run } from '../../types/api';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { CloudSun, Droplets, ThermometerSun, Wind, Gauge, Sparkles, MapPin } from 'lucide-react';

const NEON = '#C0FF00';
const CYAN = '#22D3EE';
const AMBER = '#F59E0B';
const PINK = '#FF4D8D';
const PANEL = '#0E0E0E';
const BORDER = '#1F290E';
const MUTED = '#7D8590';

type WeatherSnapshot = {
  temperature: number | null;
  humidity: number | null;
  apparent: number | null;
  wind: number | null;
  estimatedHour: number;
  estimatedLabel: string;
  source: 'archive' | 'run-fallback';
};

type EnrichedRun = {
  run: Run;
  label: string;
  actualPaceSec: number;
  normalizedPaceSec: number;
  deltaSec: number;
  weather: WeatherSnapshot | null;
  idealNarrative: string;
};

const weatherCache = new Map<string, Promise<WeatherSnapshot | null>>();

function parsePaceToSeconds(pace?: string | null): number | null {
  if (!pace) return null;
  const clean = pace.replace('/km', '').trim();
  const [minStr, secStr] = clean.split(':');
  const mins = Number(minStr);
  const secs = Number(secStr);
  if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
  return mins * 60 + secs;
}

function formatPace(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const rounded = Math.max(0, Math.round(seconds));
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatDateLabel(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

function inferRunHour(name?: string | null): { hour: number; label: string } {
  const text = (name ?? '').toLowerCase();
  if (text.includes('night')) return { hour: 22, label: 'stima notte · 22:00' };
  if (text.includes('evening')) return { hour: 20, label: 'stima sera · 20:00' };
  if (text.includes('afternoon') || text.includes('pomerid')) return { hour: 17, label: 'stima pomeriggio · 17:00' };
  if (text.includes('lunch') || text.includes('pranzo')) return { hour: 13, label: 'stima pausa pranzo · 13:00' };
  if (text.includes('morning') || text.includes('mattutin')) return { hour: 7, label: 'stima mattina · 07:00' };
  return { hour: 8, label: 'stima fascia diurna · 08:00' };
}

function buildWeatherKey(run: Run, hour: number): string {
  const [lat, lon] = run.start_latlng ?? [0, 0];
  return `${run.id}:${run.date}:${lat.toFixed(4)}:${lon.toFixed(4)}:${hour}`;
}

async function fetchWeatherForRun(run: Run): Promise<WeatherSnapshot | null> {
  if (!run.start_latlng) return null;
  const { hour, label } = inferRunHour(run.name);
  const key = buildWeatherKey(run, hour);
  const cached = weatherCache.get(key);
  if (cached) return cached;

  const request = (async () => {
    const [latitude, longitude] = run.start_latlng!;
    try {
      const query = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        start_date: run.date,
        end_date: run.date,
        hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m',
        timezone: 'auto',
      });
      const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${query.toString()}`);
      if (!response.ok) throw new Error(`archive ${response.status}`);
      const json = await response.json();
      const times: string[] = json?.hourly?.time ?? [];
      const temperatures: Array<number | null> = json?.hourly?.temperature_2m ?? [];
      const humidities: Array<number | null> = json?.hourly?.relative_humidity_2m ?? [];
      const apparentTemps: Array<number | null> = json?.hourly?.apparent_temperature ?? [];
      const winds: Array<number | null> = json?.hourly?.wind_speed_10m ?? [];
      const targetHour = String(hour).padStart(2, '0');
      let index = times.findIndex((value) => value.includes(`T${targetHour}:00`));
      if (index < 0) index = Math.min(Math.max(hour, 0), times.length - 1);
      if (index < 0) return null;
      return {
        temperature: temperatures[index] ?? run.temperature ?? null,
        humidity: humidities[index] ?? null,
        apparent: apparentTemps[index] ?? null,
        wind: winds[index] ?? null,
        estimatedHour: hour,
        estimatedLabel: label,
        source: 'archive' as const,
      };
    } catch {
      if (run.temperature == null) return null;
      return {
        temperature: run.temperature,
        humidity: null,
        apparent: run.temperature,
        wind: null,
        estimatedHour: hour,
        estimatedLabel: `${label} · fallback temperatura run`,
        source: 'run-fallback' as const,
      };
    }
  })();

  weatherCache.set(key, request);
  return request;
}

function computeEnvironmentalPenalty(run: Run, weather: WeatherSnapshot | null): number {
  const actualPaceSec = parsePaceToSeconds(run.avg_pace) ?? 0;
  if (!actualPaceSec) return 0;

  const effectiveTemp = weather?.apparent ?? weather?.temperature ?? run.temperature ?? 10;
  const humidity = weather?.humidity ?? 60;
  const wind = weather?.wind ?? 8;
  const elevationPerKm = run.distance_km > 0 ? (run.elevation_gain ?? 0) / run.distance_km : 0;

  const heatPenalty = Math.max(0, effectiveTemp - 12) * 0.72;
  const coldPenalty = Math.max(0, 5 - effectiveTemp) * 0.30;
  const humidityPenalty = Math.max(0, humidity - 65) * 0.16;
  const windPenalty = Math.max(0, wind - 12) * 0.12;
  const climbPenalty = Math.max(0, elevationPerKm - 6) * 0.15;
  const synergyPenalty = effectiveTemp > 22 && humidity > 70
    ? ((effectiveTemp - 22) * (humidity - 70)) / 85
    : 0;

  const distanceFactor = Math.min(1.12, Math.max(0.88, (run.distance_km ?? 0) / 8));
  const total = (heatPenalty + coldPenalty + humidityPenalty + windPenalty + climbPenalty + synergyPenalty) * distanceFactor;
  return Math.max(0, Math.min(28, total));
}

function describeNormalization(run: Run, weather: WeatherSnapshot | null, deltaSec: number): string {
  const temp = weather?.temperature;
  const humidity = weather?.humidity;
  const distance = (run.distance_km ?? 0).toFixed(1).replace('.', ',');
  if (deltaSec <= 2) {
    return `Su ${distance} km eri gia vicino a condizioni quasi neutre: il margine climatico qui e minimo.`;
  }
  const parts = [];
  if (temp != null) parts.push(`${Math.round(temp)}°C`);
  if (humidity != null) parts.push(`${Math.round(humidity)}% umidita`);
  const climate = parts.length ? parts.join(' · ') : 'clima non perfetto';
  return `Su ${distance} km, con ${climate}, a parita di sforzo il modello ti stima circa ${Math.round(deltaSec)} sec/km piu veloce in assetto ideale 5-10°C.`;
}

function formatHumidity(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : `${Math.round(value)}%`;
}

function formatTemperature(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : `${Math.round(value)}°`;
}

export function EnvironmentalNormalizerView({ runs }: { runs: Run[] }) {
  const [limit, setLimit] = React.useState<10 | 30>(10);
  const [weatherByRun, setWeatherByRun] = React.useState<Record<string, WeatherSnapshot | null>>({});

  const paceQualifiedRuns = React.useMemo(() => {
    return [...runs]
      .filter((run) => {
        const paceSec = parsePaceToSeconds(run.avg_pace);
        return Boolean(run.start_latlng) && !run.is_treadmill && paceSec != null && paceSec < 300;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [runs]);

  const weatherWindowRuns = React.useMemo(() => {
    const poolSize = limit === 30 ? 120 : 60;
    return paceQualifiedRuns.slice(0, poolSize);
  }, [paceQualifiedRuns, limit]);

  React.useEffect(() => {
    let cancelled = false;
    const missing = weatherWindowRuns.filter((run) => !(run.id in weatherByRun));
    if (!missing.length) return;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (run) => [run.id, await fetchWeatherForRun(run)] as const),
      );
      if (cancelled) return;
      setWeatherByRun((current) => {
        const next = { ...current };
        for (const [id, value] of entries) next[id] = value;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [weatherWindowRuns, weatherByRun]);

  const hotReferenceRuns = React.useMemo(() => {
    return weatherWindowRuns.filter((run) => {
      const weather = weatherByRun[run.id];
      const temperature = weather?.temperature ?? run.temperature ?? null;
      return temperature != null && temperature > 20;
    });
  }, [weatherWindowRuns, weatherByRun]);

  const pendingWeatherCount = React.useMemo(
    () => weatherWindowRuns.filter((run) => !(run.id in weatherByRun)).length,
    [weatherWindowRuns, weatherByRun],
  );

  const visibleRuns = React.useMemo(() => hotReferenceRuns.slice(0, limit), [hotReferenceRuns, limit]);

  const enrichedRuns = React.useMemo<EnrichedRun[]>(() => {
    return visibleRuns
      .map((run) => {
        const actualPaceSec = parsePaceToSeconds(run.avg_pace);
        if (actualPaceSec == null) return null;
        const weather = weatherByRun[run.id] ?? null;
        const deltaSec = computeEnvironmentalPenalty(run, weather);
        const normalizedPaceSec = Math.max(150, actualPaceSec - deltaSec);
        return {
          run,
          label: formatDateLabel(run.date),
          actualPaceSec,
          normalizedPaceSec,
          deltaSec,
          weather,
          idealNarrative: describeNormalization(run, weather, deltaSec),
        };
      })
      .filter((item): item is EnrichedRun => item !== null);
  }, [visibleRuns, weatherByRun]);

  const chartData = React.useMemo(() => [...enrichedRuns].reverse().map((item) => ({
    id: item.run.id,
    label: item.label,
    actual: item.actualPaceSec,
    ideal: item.normalizedPaceSec,
    delta: item.deltaSec,
    temp: item.weather?.temperature ?? null,
    humidity: item.weather?.humidity ?? null,
  })), [enrichedRuns]);

  const summary = React.useMemo(() => {
    if (!enrichedRuns.length) return null;
    const avgActual = enrichedRuns.reduce((sum, item) => sum + item.actualPaceSec, 0) / enrichedRuns.length;
    const avgIdeal = enrichedRuns.reduce((sum, item) => sum + item.normalizedPaceSec, 0) / enrichedRuns.length;
    const avgDelta = enrichedRuns.reduce((sum, item) => sum + item.deltaSec, 0) / enrichedRuns.length;
    const tempSamples = enrichedRuns.filter((item) => item.weather?.temperature != null);
    const humiditySamples = enrichedRuns.filter((item) => item.weather?.humidity != null);
    const avgTemp = tempSamples.length
      ? tempSamples.reduce((sum, item) => sum + (item.weather?.temperature ?? 0), 0) / tempSamples.length
      : null;
    const avgHumidity = humiditySamples.length
      ? humiditySamples.reduce((sum, item) => sum + (item.weather?.humidity ?? 0), 0) / humiditySamples.length
      : null;
    const biggestBoost = enrichedRuns.reduce((best, item) => (item.deltaSec > best.deltaSec ? item : best), enrichedRuns[0]);
    return { avgActual, avgIdeal, avgDelta, avgTemp, avgHumidity, biggestBoost };
  }, [enrichedRuns]);

  if (!paceQualifiedRuns.length) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div
          className="rounded-[28px] border p-8"
          style={{
            background: 'radial-gradient(circle at top left, rgba(192,255,0,0.10), transparent 28%), radial-gradient(circle at bottom right, rgba(34,211,238,0.08), transparent 34%), #0B0B0B',
            borderColor: BORDER,
            borderLeft: `3px solid ${NEON}`,
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(192,255,0,0.12)' }}>
              <CloudSun className="w-5 h-5" style={{ color: NEON }} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-wide text-white italic">Normalizzatore Ambientale</h2>
              <p className="text-[11px] uppercase tracking-[0.25em]" style={{ color: MUTED }}>ritmo reale standardizzato · STP 5–10°C</p>
            </div>
          </div>
          <p className="text-sm leading-7 max-w-3xl" style={{ color: '#A2ACB7' }}>
            Qui leggeremo solo le corse outdoor con GPS e passo sotto 5:00/km, e poi terremo solo i riferimenti davvero corsi sopra i 20°C.
            Al momento il campione non e ancora sufficiente.
          </p>
        </div>
      </div>
    );
  }

  if (!enrichedRuns.length) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div
          className="rounded-[28px] border p-8"
          style={{
            background: 'radial-gradient(circle at top left, rgba(192,255,0,0.10), transparent 28%), radial-gradient(circle at bottom right, rgba(34,211,238,0.08), transparent 34%), #0B0B0B',
            borderColor: BORDER,
            borderLeft: `3px solid ${NEON}`,
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(192,255,0,0.12)' }}>
              <CloudSun className="w-5 h-5" style={{ color: NEON }} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-wide text-white italic">Normalizzatore Ambientale</h2>
              <p className="text-[11px] uppercase tracking-[0.25em]" style={{ color: MUTED }}>solo corse veloci in caldo reale</p>
            </div>
          </div>
          <p className="text-sm leading-7 max-w-3xl" style={{ color: '#A2ACB7' }}>
            {pendingWeatherCount > 0
              ? `Sto ancora leggendo il meteo storico delle ultime ${weatherWindowRuns.length} corse veloci: appena finisce il fetch, qui resteranno solo le uscite sopra i 20°C.`
              : `Nel campione recente non ho trovato ancora corse outdoor sotto 5:00/km con temperatura superiore a 20°C. Appena compaiono, questo tab le usera come riferimenti.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section
        className="rounded-[30px] border overflow-hidden"
        style={{
          background: 'radial-gradient(circle at top left, rgba(192,255,0,0.12), transparent 24%), radial-gradient(circle at bottom right, rgba(34,211,238,0.10), transparent 34%), #0A0A0A',
          borderColor: BORDER,
          borderLeft: `3px solid ${NEON}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(192,255,0,0.03)',
        }}
      >
        <div className="p-8 border-b border-white/[0.05]">
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
            <div className="max-w-4xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(192,255,0,0.12)' }}>
                  <CloudSun className="w-5 h-5" style={{ color: NEON }} />
                </div>
                <div>
                  <div className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: '#8A9562' }}>Clima, GPS e ritmo reale</div>
                  <h2 className="text-[34px] leading-none font-black tracking-tight text-white">Normalizzatore Ambientale</h2>
                </div>
              </div>
              <p className="text-base leading-8" style={{ color: '#BAC4CF' }}>
                Questo pannello prende solo le tue corse veloci reali sotto 5:00/km fatte in condizioni calde, legge il meteo storico sulle coordinate GPS del giorno
                e pulisce il passo dai fattori esterni. Il risultato non e un “fantasy pace”, ma una stima standardizzata di quanto valeva davvero quella prestazione in condizioni STP:
                aria fresca, umidita gestibile, vento leggero.
              </p>
              <div className="flex flex-wrap gap-3 mt-5">
                {[
                  'STP target · 8°C / 55% RH / vento debole',
                  'Solo corse outdoor GPS sotto 5:00/km e oltre 20°C',
                  'Temperatura e umidita da archivio meteo storico',
                  'Ora stimata quando la seduta non porta il timestamp completo',
                ].map((item) => (
                  <span
                    key={item}
                    className="px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.22em]"
                    style={{ color: '#D7FF76', background: 'rgba(192,255,0,0.08)', border: '1px solid rgba(192,255,0,0.16)' }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2 bg-[#0E0E0E] border border-white/[0.06] rounded-2xl p-1.5">
              {[10, 30].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLimit(value as 10 | 30)}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.22em] transition-all"
                  style={{
                    background: limit === value ? NEON : 'transparent',
                    color: limit === value ? '#0A0A0A' : '#7D8590',
                  }}
                >
                  ultime {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        {summary && (
          <div className="p-8 grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Ritmo medio reale',
                    value: `${formatPace(summary.avgActual)} /km`,
                    sub: `${enrichedRuns.length} corse calde lette`,
                    color: '#FFFFFF',
                  },
                  {
                    label: 'Ritmo medio STP',
                    value: `${formatPace(summary.avgIdeal)} /km`,
                    sub: `${Math.round(summary.avgDelta)} sec/km recuperabili`,
                    color: NEON,
                  },
                  {
                    label: 'Meteo medio letto',
                    value: `${formatTemperature(summary.avgTemp)} · ${formatHumidity(summary.avgHumidity)}`,
                    sub: 'campione reale sulle coordinate GPS',
                    color: CYAN,
                  },
                  {
                    label: 'Max ego boost',
                    value: `-${Math.round(summary.biggestBoost.deltaSec)} sec/km`,
                    sub: `${summary.biggestBoost.label} · ${formatPace(summary.biggestBoost.actualPaceSec)} → ${formatPace(summary.biggestBoost.normalizedPaceSec)}`,
                    color: PINK,
                  },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl border p-5" style={{ background: PANEL, borderColor: '#232323' }}>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-black mb-3" style={{ color: MUTED }}>{card.label}</div>
                    <div className="text-[28px] leading-none font-black" style={{ color: card.color }}>{card.value}</div>
                    <div className="text-sm mt-3 leading-6" style={{ color: '#8C96A0' }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-[26px] border p-6" style={{ background: '#0D0D0D', borderColor: '#202020' }}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.26em] font-black" style={{ color: '#8A9562' }}>Actual vs STP</div>
                    <h3 className="text-2xl font-black text-white">Quanto clima stavi trascinando addosso</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.24em] font-black" style={{ color: MUTED }}>assetto ideale</div>
                    <div className="text-sm font-bold" style={{ color: '#B9C1CA' }}>5–10°C · 45–60% RH · vento contenuto</div>
                  </div>
                </div>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 18, left: 10, bottom: 8 }}>
                      <defs>
                        <linearGradient id="env-boost-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CYAN} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={CYAN} stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#67707A', fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                      <YAxis
                        yAxisId="pace"
                        reversed
                        tick={{ fill: '#67707A', fontSize: 10, fontWeight: 800 }}
                        axisLine={false}
                        tickLine={false}
                        domain={[
                          (min: number) => Math.floor((min - 12) / 5) * 5,
                          (max: number) => Math.ceil((max + 12) / 5) * 5,
                        ]}
                        tickFormatter={(value) => formatPace(value)}
                      />
                      <YAxis yAxisId="delta" hide domain={[0, (max: number) => Math.max(12, Math.ceil(max + 3))]} />
                      <Tooltip
                        contentStyle={{
                          background: '#090909',
                          border: '1px solid #273510',
                          borderRadius: 18,
                          boxShadow: '0 18px 42px rgba(0,0,0,0.35)',
                        }}
                        labelStyle={{ color: '#FFFFFF', fontWeight: 800 }}
                        formatter={(value: number, name: string) => {
                          if (name === 'delta') return [`-${Math.round(value)} sec/km`, 'boost climatico'];
                          return [`${formatPace(value)} /km`, name === 'actual' ? 'passo reale' : 'ritmo STP'];
                        }}
                      />
                      <Bar yAxisId="delta" dataKey="delta" barSize={18} radius={[8, 8, 0, 0]} fill="url(#env-boost-fill)" />
                      <Line yAxisId="pace" type="monotone" dataKey="actual" name="actual" stroke={AMBER} strokeWidth={2.5} dot={{ r: 4, fill: AMBER }} activeDot={{ r: 6, fill: AMBER }} connectNulls />
                      <Line yAxisId="pace" type="monotone" dataKey="ideal" name="ideal" stroke={NEON} strokeWidth={3} dot={{ r: 4, fill: NEON }} activeDot={{ r: 6, fill: NEON }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div
                className="rounded-[28px] border p-6"
                style={{
                  background: 'linear-gradient(180deg, rgba(192,255,0,0.08), rgba(34,211,238,0.04)), #0E0E0E',
                  borderColor: '#273510',
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-5 h-5" style={{ color: NEON }} />
                  <div className="text-[10px] uppercase tracking-[0.24em] font-black" style={{ color: '#8A9562' }}>la corsa piu sottovalutata</div>
                </div>
                <div className="text-[14px] font-black uppercase tracking-[0.14em] text-white">{summary.biggestBoost.run.name ?? 'Run veloce'}</div>
                <div className="text-[34px] leading-none font-black mt-3" style={{ color: '#FFFFFF' }}>
                  {formatPace(summary.biggestBoost.actualPaceSec)} <span className="text-base" style={{ color: MUTED }}>/km reale</span>
                </div>
                <div className="text-[34px] leading-none font-black mt-2" style={{ color: NEON }}>
                  {formatPace(summary.biggestBoost.normalizedPaceSec)} <span className="text-base" style={{ color: '#7EA533' }}>/km STP</span>
                </div>
                <p className="text-base leading-7 mt-5" style={{ color: '#B8C2CC' }}>
                  {summary.biggestBoost.idealNarrative}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  {[
                    { icon: ThermometerSun, label: 'temperatura', value: formatTemperature(summary.biggestBoost.weather?.temperature) },
                    { icon: Droplets, label: 'umidita', value: formatHumidity(summary.biggestBoost.weather?.humidity) },
                    { icon: Wind, label: 'vento', value: summary.biggestBoost.weather?.wind != null ? `${Math.round(summary.biggestBoost.weather.wind)} km/h` : '—' },
                    { icon: Gauge, label: 'ora letta', value: summary.biggestBoost.weather?.estimatedLabel ?? 'n/d' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border p-4" style={{ background: '#101010', borderColor: '#232323' }}>
                      <item.icon className="w-4 h-4 mb-3" style={{ color: item.label === 'umidita' ? CYAN : item.label === 'temperatura' ? AMBER : NEON }} />
                      <div className="text-[9px] uppercase tracking-[0.24em] font-black" style={{ color: MUTED }}>{item.label}</div>
                      <div className="text-sm font-black mt-2 text-white">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border p-6" style={{ background: PANEL, borderColor: '#232323' }}>
                <div className="text-[10px] uppercase tracking-[0.24em] font-black mb-4" style={{ color: '#8A9562' }}>come leggere il booster</div>
                <div className="space-y-4">
                  {[
                    'Il modello non cambia la tua corsa: cambia solo il contesto attorno alla corsa.',
                    'Usa temperatura, umidita, vento e dislivello/km per stimare quanto il clima ti ha frenato a pari sforzo.',
                    'Se il delta e alto, il passo reale del giorno non racconta tutto il tuo valore aerobico.',
                    'Se il delta e basso, quella seduta vale quasi gia “puro motore” anche senza normalizzazione.',
                  ].map((line) => (
                    <div key={line} className="flex gap-3">
                      <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: NEON }} />
                      <p className="text-sm leading-7" style={{ color: '#AEB8C2' }}>{line}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border overflow-hidden" style={{ background: '#0B0B0B', borderColor: '#1E1E1E', borderLeft: `3px solid ${CYAN}` }}>
        <div className="p-7 border-b border-white/[0.05] flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: '#4D9EAE' }}>ultime corse lette</div>
            <h3 className="text-2xl font-black text-white">Le tue uscite sotto 5:00/km, ripulite dal meteo</h3>
          </div>
            <div className="text-sm leading-7 max-w-2xl" style={{ color: '#94A0AA' }}>
            Ogni card usa giorno reale e coordinate GPS reali. Se il backend non porta l’orario esatto, la lettura meteo viene ancorata a una fascia oraria coerente con il nome della seduta.
            Qui restano solo le corse veloci con temperatura davvero sopra i 20°C.
          </div>
        </div>
        <div className="p-7 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {enrichedRuns.map((item) => (
            <article key={item.run.id} className="rounded-[24px] border p-5" style={{ background: '#101010', borderColor: '#232323' }}>
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.22em]" style={{ background: 'rgba(192,255,0,0.08)', color: '#D7FF76' }}>
                      {item.label}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: MUTED }}>
                      {(item.run.distance_km ?? 0).toFixed(1).replace('.', ',')} km
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: '#6D7781' }}>
                      {item.weather?.estimatedLabel ?? 'ora non leggibile'}
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-white mt-3">{item.run.name ?? 'Run veloce'}</h4>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: '#79828B' }}>boost stimato</div>
                  <div className="text-[26px] leading-none font-black" style={{ color: PINK }}>-{Math.round(item.deltaSec)} sec/km</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
                <div className="rounded-2xl border p-4" style={{ background: '#0C0C0C', borderColor: '#1F1F1F' }}>
                  <div className="text-[9px] uppercase tracking-[0.22em] font-black" style={{ color: MUTED }}>passo reale</div>
                  <div className="text-[26px] font-black mt-2 text-white">{formatPace(item.actualPaceSec)}</div>
                  <div className="text-xs mt-1" style={{ color: '#7A838D' }}>/km</div>
                </div>
                <div className="rounded-2xl border p-4" style={{ background: '#0C0C0C', borderColor: '#1F1F1F' }}>
                  <div className="text-[9px] uppercase tracking-[0.22em] font-black" style={{ color: '#8A9562' }}>ritmo STP</div>
                  <div className="text-[26px] font-black mt-2" style={{ color: NEON }}>{formatPace(item.normalizedPaceSec)}</div>
                  <div className="text-xs mt-1" style={{ color: '#7EA533' }}>/km</div>
                </div>
                <div className="rounded-2xl border p-4" style={{ background: '#0C0C0C', borderColor: '#1F1F1F' }}>
                  <div className="flex items-center gap-2">
                    <ThermometerSun className="w-4 h-4" style={{ color: AMBER }} />
                    <div className="text-[9px] uppercase tracking-[0.22em] font-black" style={{ color: MUTED }}>temperatura</div>
                  </div>
                  <div className="text-[24px] font-black mt-2 text-white">{formatTemperature(item.weather?.temperature)}</div>
                </div>
                <div className="rounded-2xl border p-4" style={{ background: '#0C0C0C', borderColor: '#1F1F1F' }}>
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4" style={{ color: CYAN }} />
                    <div className="text-[9px] uppercase tracking-[0.22em] font-black" style={{ color: MUTED }}>umidita</div>
                  </div>
                  <div className="text-[24px] font-black mt-2 text-white">{formatHumidity(item.weather?.humidity)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div className="rounded-2xl border p-4" style={{ background: '#0C0C0C', borderColor: '#1F1F1F' }}>
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4" style={{ color: '#7ED6FF' }} />
                    <div className="text-[9px] uppercase tracking-[0.22em] font-black" style={{ color: MUTED }}>vento</div>
                  </div>
                  <div className="text-lg font-black mt-2 text-white">
                    {item.weather?.wind != null ? `${Math.round(item.weather.wind)} km/h` : '—'}
                  </div>
                </div>
                <div className="rounded-2xl border p-4" style={{ background: '#0C0C0C', borderColor: '#1F1F1F' }}>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" style={{ color: '#9CA3AF' }} />
                    <div className="text-[9px] uppercase tracking-[0.22em] font-black" style={{ color: MUTED }}>dislivello</div>
                  </div>
                  <div className="text-lg font-black mt-2 text-white">
                    {Math.round(item.run.elevation_gain ?? 0)} m
                  </div>
                </div>
                <div className="rounded-2xl border p-4" style={{ background: '#0C0C0C', borderColor: '#1F1F1F' }}>
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4" style={{ color: NEON }} />
                    <div className="text-[9px] uppercase tracking-[0.22em] font-black" style={{ color: MUTED }}>lettura</div>
                  </div>
                  <div className="text-sm font-black mt-2 text-white">
                    {item.weather?.source === 'archive' ? 'meteo archivio' : 'fallback temperatura'}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border p-4" style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.08), rgba(192,255,0,0.06))', borderColor: 'rgba(34,211,238,0.18)' }}>
                <p className="text-sm leading-7" style={{ color: '#C7D0D8' }}>{item.idealNarrative}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
