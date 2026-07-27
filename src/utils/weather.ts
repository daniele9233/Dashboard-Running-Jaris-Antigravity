/**
 * Meteo per corsa — modulo condiviso.
 *
 * Estratto da EnvironmentalNormalizerView (dove la logica era già corretta e
 * collaudata) perché serviva anche al widget "Impatto Meteo" della dashboard,
 * che invece leggeva `run.temperature` — un campo che i documenti run NON
 * hanno: il filtro `(r.temperature ?? 0) > 5` scartava ogni corsa e il widget
 * restava permanentemente sull'empty state.
 *
 * Tre livelli di cache, dal più economico al più costoso:
 *   1. memoria (Map)  → zero rete nella stessa sessione
 *   2. Mongo          → sopravvive al reload e vale su tutti i device
 *   3. open-meteo     → solo per le corse mai risolte prima
 */
import type { Run } from '../types/api';
import { getRunsWeatherBulk, postRunWeather } from '../api';

export type WeatherSource = 'archive' | 'forecast' | 'run-fallback' | 'stored';

export type WeatherSnapshot = {
  temperature: number | null;
  humidity: number | null;
  apparent: number | null;
  wind: number | null;
  dewpoint: number | null;
  estimatedHour: number;
  estimatedLabel: string;
  source: WeatherSource;
};

/** Promesse in volo/risolte per chiave (run+data+coord+ora). */
const weatherCache = new Map<string, Promise<WeatherSnapshot | null>>();
/** Snapshot già persistiti su Mongo, indicizzati per run id. */
const storedByRunId = new Map<string, WeatherSnapshot | null>();
/** Run id per cui il bulk ha già risposto: evita di ri-chiedere al server. */
const preloadedIds = new Set<string>();

// ─── Punto di rugiada (Magnus-Tetens) ────────────────────────────────────────
// Più accurato dell'approssimazione `T - (100 - RH) / 5`, che sbaglia di
// diversi gradi sotto il 50% di umidità.
export function computeDewpoint(tempC: number, humidityPct: number): number | null {
  if (!Number.isFinite(tempC) || !Number.isFinite(humidityPct) || humidityPct <= 0) return null;
  const rh = Math.min(100, Math.max(1, humidityPct));
  const gamma = Math.log(rh / 100) + (17.625 * tempC) / (243.04 + tempC);
  return (243.04 * gamma) / (17.625 - gamma);
}

export function parsePaceToSeconds(pace?: string | null): number | null {
  if (!pace) return null;
  const clean = pace.replace('/km', '').trim();
  const [minStr, secStr] = clean.split(':');
  const mins = Number(minStr);
  const secs = Number(secStr);
  if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
  return mins * 60 + secs;
}

export function formatPace(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const rounded = Math.max(0, Math.round(seconds));
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Ora locale reale da start_date_local (es. "2026-06-02T08:15:15Z"). La 'Z' è
// nominale — Strava ci scrive l'orologio da parete locale — quindi l'ora si
// legge dalla stringa invece di convertirla via Date.
export function runStartHour(run: Run): number | null {
  const s = run.start_date_local;
  if (typeof s === 'string' && s.length >= 13 && s[10] === 'T') {
    const h = parseInt(s.slice(11, 13), 10);
    if (Number.isFinite(h) && h >= 0 && h <= 23) return h;
  }
  return null;
}

// I due campioni orari più vicini al PUNTO MEDIO della corsa. Le letture sono
// istantanee alle HH:00: una corsa 07:25→07:47 sta fra il campione delle 07:00
// (19.9°C) e quello delle 08:00 (21.3°C), e da sola l'ora di partenza può
// finire appena sotto la soglia dei 20°C ed escludere la corsa a torto.
export function runCoveredHours(run: Run, startHour: number): number[] {
  const s = run.start_date_local;
  const minutes =
    typeof s === 'string' && s.length >= 16 ? parseInt(s.slice(14, 16), 10) : 0;
  const startMin = startHour * 60 + (Number.isFinite(minutes) ? minutes : 0);
  const midMin = startMin + Math.max(0, run.duration_minutes ?? 0) / 2;
  const h1 = Math.min(23, Math.floor(midMin / 60));
  const h2 = Math.min(23, Math.max(h1, Math.round(midMin / 60)));
  return h1 === h2 ? [h1] : [h1, h2];
}

export function inferRunHour(name?: string | null): { hour: number; label: string } {
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

/** Una corsa ha meteo solo se è outdoor e georeferenziata. */
export function hasWeatherContext(run: Run): boolean {
  return !run.is_treadmill && Array.isArray(run.start_latlng) && run.start_latlng.length === 2;
}

/**
 * Carica in un colpo solo gli snapshot già salvati su Mongo. Va chiamata prima
 * di `fetchWeatherForRun` sulle stesse corse: senza, ogni corsa farebbe una
 * chiamata a open-meteo anche se il dato era già stato risolto in passato.
 */
export async function preloadStoredWeather(runIds: string[]): Promise<void> {
  const missing = runIds.filter((id) => id && !preloadedIds.has(id));
  if (missing.length === 0) return;
  try {
    const res = await getRunsWeatherBulk(missing);
    const map = res?.weather ?? {};
    for (const id of missing) {
      preloadedIds.add(id);
      const w = map[id];
      if (!w) continue;
      const temperature = typeof w.temperature === 'number' ? w.temperature : null;
      const humidity = typeof w.humidity === 'number' ? w.humidity : null;
      storedByRunId.set(id, {
        temperature,
        humidity,
        apparent: typeof w.apparent_temperature === 'number' ? w.apparent_temperature : temperature,
        wind: typeof w.wind_speed === 'number' ? w.wind_speed : null,
        dewpoint:
          typeof w.dewpoint === 'number'
            ? w.dewpoint
            : temperature != null && humidity != null
            ? computeDewpoint(temperature, humidity)
            : null,
        estimatedHour: typeof w.estimated_hour === 'number' ? w.estimated_hour : 8,
        estimatedLabel: 'salvato',
        source: 'stored',
      });
    }
  } catch {
    // Il server non risponde: si prosegue con open-meteo, nessun blocco.
    for (const id of missing) preloadedIds.add(id);
  }
}

/** Salva su Mongo senza bloccare la UI: un fallimento non è un errore visibile. */
function persist(run: Run, snap: WeatherSnapshot): void {
  if (!run.id) return;
  void postRunWeather(run.id, {
    temperature: snap.temperature,
    humidity: snap.humidity,
    apparent_temperature: snap.apparent,
    dewpoint: snap.dewpoint,
    wind_speed: snap.wind,
    source: snap.source,
    estimated_hour: snap.estimatedHour,
  }).catch(() => { /* best effort */ });
}

export async function fetchWeatherForRun(run: Run): Promise<WeatherSnapshot | null> {
  if (!hasWeatherContext(run)) return null;

  const stored = run.id ? storedByRunId.get(run.id) : undefined;
  if (stored) return stored;

  // Ora reale della corsa quando c'è; il nome ("mattutina") si usa solo se
  // l'attività non porta timestamp, e può sbagliare di un'ora.
  const realHour = runStartHour(run);
  const inferred = inferRunHour(run.name);
  const hour = realHour ?? inferred.hour;
  const label = realHour != null
    ? `ora reale · ${String(realHour).padStart(2, '0')}:00`
    : inferred.label;
  const key = buildWeatherKey(run, hour);
  const cached = weatherCache.get(key);
  if (cached) return cached;

  const request = (async (): Promise<WeatherSnapshot | null> => {
    const [latitude, longitude] = run.start_latlng!;
    // L'archivio ha un ritardo di ~5 giorni: le corse recenti (oggi incluso)
    // lì non esistono e verrebbero scartate. Per quelle si usa il forecast,
    // che serve il passato prossimo via past_days.
    const ageDays = (Date.now() - new Date(run.date).getTime()) / 86400000;
    const useForecast = ageDays < 9;
    try {
      const base = {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m',
        timezone: 'auto',
      };
      const url = useForecast
        ? `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({ ...base, past_days: '10', forecast_days: '1' }).toString()}`
        : `https://archive-api.open-meteo.com/v1/archive?${new URLSearchParams({ ...base, start_date: run.date, end_date: run.date }).toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`weather ${response.status}`);
      const json = await response.json();
      const times: string[] = json?.hourly?.time ?? [];
      const temperatures: Array<number | null> = json?.hourly?.temperature_2m ?? [];
      const humidities: Array<number | null> = json?.hourly?.relative_humidity_2m ?? [];
      const apparentTemps: Array<number | null> = json?.hourly?.apparent_temperature ?? [];
      const winds: Array<number | null> = json?.hourly?.wind_speed_10m ?? [];

      const coveredHours = realHour != null ? runCoveredHours(run, realHour) : [hour];
      const wantedPrefixes = coveredHours.map(
        (h) => `${run.date}T${String(h).padStart(2, '0')}:00`,
      );
      let indices = times
        .map((value, i) => (wantedPrefixes.some((p) => value.startsWith(p)) ? i : -1))
        .filter((i) => i >= 0);
      if (!indices.length) {
        const anyDay = times.findIndex((value) => value.startsWith(run.date));
        if (anyDay >= 0) indices = [anyDay];
        else if (!useForecast) indices = [Math.min(Math.max(hour, 0), times.length - 1)];
      }
      const avgOf = (arr: Array<number | null>): number | null => {
        const vals = indices.map((i) => arr[i]).filter((v): v is number => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      // La temperatura registrata dal dispositivo, quando c'è, è il dato reale
      // di quel momento: batte il valore modellato a un'ora stimata.
      const measuredTemp =
        typeof run.temperature === 'number' && run.temperature > -50 ? run.temperature : null;
      if (!indices.length && measuredTemp == null) return null;

      const temperature = measuredTemp ?? avgOf(temperatures);
      const humidity = avgOf(humidities);
      const snap: WeatherSnapshot = {
        temperature,
        humidity,
        apparent: avgOf(apparentTemps) ?? measuredTemp,
        wind: avgOf(winds),
        dewpoint: temperature != null && humidity != null ? computeDewpoint(temperature, humidity) : null,
        estimatedHour: hour,
        estimatedLabel: measuredTemp != null ? `${label} · temp reale del dispositivo` : label,
        source: measuredTemp != null ? 'run-fallback' : useForecast ? 'forecast' : 'archive',
      };
      if (run.id) storedByRunId.set(run.id, snap);
      persist(run, snap);
      return snap;
    } catch {
      if (run.temperature == null) return null;
      return {
        temperature: run.temperature,
        humidity: null,
        apparent: run.temperature,
        wind: null,
        dewpoint: null,
        estimatedHour: hour,
        estimatedLabel: `${label} · fallback temperatura run`,
        source: 'run-fallback',
      };
    }
  })();

  weatherCache.set(key, request);
  return request;
}

/**
 * Penalità climatica in sec/km. Modello unico per dashboard e statistiche:
 * prima il widget usava una formula diversa dalla vista Normalizzatore, quindi
 * la stessa corsa poteva mostrare due numeri diversi in due schermate.
 */
export function computeEnvironmentalPenalty(run: Run, weather: WeatherSnapshot | null): number {
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

/** Esegue le fetch a piccoli gruppi: open-meteo non ama le raffiche. */
export async function fetchWeatherBatch(
  runs: Run[],
  concurrency = 6,
): Promise<Map<string, WeatherSnapshot | null>> {
  const eligible = runs.filter(hasWeatherContext);
  await preloadStoredWeather(eligible.map((r) => r.id).filter(Boolean) as string[]);

  const out = new Map<string, WeatherSnapshot | null>();
  for (let i = 0; i < eligible.length; i += concurrency) {
    const chunk = eligible.slice(i, i + concurrency);
    const settled = await Promise.all(chunk.map((r) => fetchWeatherForRun(r).catch(() => null)));
    chunk.forEach((r, j) => out.set(r.id, settled[j]));
  }
  return out;
}
