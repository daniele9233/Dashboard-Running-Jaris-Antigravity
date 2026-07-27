import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Map, { Source, Layer } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import polylineDecode from "@mapbox/polyline";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Search, Shuffle, Ruler, ThermometerSun, MapPin } from "lucide-react";
import type { Run } from "../../types/api";
import { CHART_SERIES, CHART_SURFACE } from "./chartTheme";
import {
  fetchWeatherForRun, computeEnvironmentalPenalty, hasWeatherContext,
  type WeatherSnapshot,
} from "../../utils/weather";
import { MAPBOX_TOKEN, MAPBOX_STYLE_DARK } from "../../utils/mapbox";

const A_COLOR = CHART_SERIES.compare;   // corsa A
const B_COLOR = CHART_SERIES.primary;   // corsa B
const PANEL = CHART_SURFACE.panel;
const BORDER = CHART_SURFACE.border;

/** Distanza minima perché una corsa possa contare come "la migliore". */
const MIN_BEST_KM = 3;

/**
 * Corse confrontabili: ha senso paragonare prestazioni, non uscite lente.
 * Passano il filtro le sedute di QUALITÀ (dove il passo medio non racconta
 * la seduta, perché i recuperi lo diluiscono) e le corse VELOCI oltre i 3 km.
 */
const QUALITY_TYPES = new Set([
  "intervals", "repetition", "vo2max", "tempo", "threshold", "fartlek", "race", "progression",
]);
/** Sotto i 4:30/km una corsa è una prestazione, non un fondo lento. */
const FAST_PACE_SEC = 4 * 60 + 30;

export function isComparableRun(r: Run): boolean {
  if (r.is_treadmill) return false;
  const km = r.distance_km ?? 0;
  if (km < MIN_BEST_KM) return false;

  // Corsa veloce: il passo medio parla da solo.
  const avg = parsePaceSec(r.avg_pace);
  if (avg != null && avg < FAST_PACE_SEC) return true;

  // Seduta di qualità: il passo medio è diluito dai recuperi (un 4×1000 a
  // 3:56 con recuperi camminati esce a 5:00 di media). Vale il passo del
  // tratto di LAVORO — il più veloce fra giri e split.
  if (!QUALITY_TYPES.has((r.run_type ?? "").toLowerCase())) return false;
  const workPaces: number[] = [];
  for (const l of r.laps ?? []) {
    if ((l.distance ?? 0) >= 200 && (l.moving_time ?? 0) > 0) {
      workPaces.push(l.moving_time / (l.distance / 1000));
    }
  }
  for (const s of r.splits ?? []) {
    const p = parsePaceSec(s.pace);
    if (p != null) workPaces.push(p);
  }
  // Senza dettaglio non si può smentire il tipo: la si tiene.
  if (!workPaces.length) return true;
  return Math.min(...workPaces) < FAST_PACE_SEC;
}

// recharts 3 tiene le props del grafico nel suo store: oggetti inline creerebbero
// una nuova identità a ogni render e manderebbero il componente in loop.
const CHART_MARGIN = { top: 8, right: 12, left: -12, bottom: 4 };
const PACE_DOMAIN: [(min: number) => number, (max: number) => number] = [
  (min: number) => Math.floor(min - 15),
  (max: number) => Math.ceil(max + 15),
];

// ─── Helper ──────────────────────────────────────────────────────────────────
function parsePaceSec(pace?: string | null): number | null {
  if (!pace) return null;
  const [m, s] = pace.split(":").map(Number);
  return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : null;
}

function fmtPace(sec?: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  const t = Math.round(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function fmtDuration(min?: number | null): string {
  if (!min) return "—";
  const total = Math.round(min * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
               : `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function decode(poly?: string | null): [number, number][] {
  if (!poly) return [];
  try {
    return polylineDecode.decode(poly).map(([lat, lng]) => [lng, lat] as [number, number]);
  } catch {
    return [];
  }
}

type Bounds = { minLng: number; maxLng: number; minLat: number; maxLat: number };

function boundsOf(coords: [number, number][]): Bounds | null {
  if (coords.length < 2) return null;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

// ─── Mappa di un lato ────────────────────────────────────────────────────────
/**
 * `span` è la finestra geografica imposta dall'esterno: passando lo stesso span
 * alle due mappe, due tracciati si vedono nella STESSA scala. Senza, ogni mappa
 * riempie il proprio riquadro e un 3 km sembra lungo quanto un 15 km — che è
 * esattamente l'errore di lettura che un confronto dovrebbe evitare.
 */
function RouteMap({
  run, color, span,
}: { run: Run | null; color: string; span: number | null }) {
  const mapRef = useRef<MapRef>(null);
  const coords = useMemo(() => decode(run?.polyline), [run]);
  const bounds = useMemo(() => boundsOf(coords), [coords]);

  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: coords.length >= 2
      ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } }]
      : [],
  }), [coords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    const cLng = (bounds.minLng + bounds.maxLng) / 2;
    const cLat = (bounds.minLat + bounds.maxLat) / 2;
    const half = span != null
      ? span / 2
      : Math.max(bounds.maxLng - bounds.minLng, bounds.maxLat - bounds.minLat) / 2;
    const pad = Math.max(half * 0.15, 0.0004);
    map.fitBounds(
      [[cLng - half - pad, cLat - half - pad], [cLng + half + pad, cLat + half + pad]],
      { duration: 600 },
    );
  }, [bounds, span]);

  if (!run) {
    return (
      <div className="h-full grid place-items-center rounded-2xl border" style={{ background: "#0A0A0A", borderColor: BORDER }}>
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">Scegli una corsa</span>
      </div>
    );
  }

  if (coords.length < 2) {
    return (
      <div className="h-full grid place-items-center rounded-2xl border" style={{ background: "#0A0A0A", borderColor: BORDER }}>
        <div className="text-center">
          <MapPin className="w-5 h-5 mx-auto mb-2" style={{ color: "#444" }} />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">
            Nessun tracciato GPS
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-2xl overflow-hidden border" style={{ borderColor: BORDER }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: coords[0][0], latitude: coords[0][1], zoom: 12 }}
        mapStyle={MAPBOX_STYLE_DARK}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <Source id="route" type="geojson" data={geojson}>
          <Layer id="route-glow" type="line"
            paint={{ "line-color": color, "line-width": 7, "line-opacity": 0.18, "line-blur": 3 }} />
          <Layer id="route-line" type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": color, "line-width": 2.6 }} />
        </Source>
      </Map>
    </div>
  );
}

// ─── Selettore corsa ─────────────────────────────────────────────────────────
function RunPicker({
  runs, value, onChange, color, side,
}: { runs: Run[]; value: Run | null; onChange: (r: Run) => void; color: string; side: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? runs.filter((r) =>
          (r.name ?? "").toLowerCase().includes(needle) ||
          r.date.includes(needle) ||
          (r.run_type ?? "").toLowerCase().includes(needle))
      : runs;
    return base.slice(0, 60);
  }, [runs, q]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left rounded-xl border px-3 py-2.5 transition-colors hover:border-white/20"
        style={{ background: "#0A0A0A", borderColor: open ? color : BORDER }}
      >
        <div className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color }}>{side}</div>
        {value ? (
          <>
            <div className="text-[12px] font-black text-white truncate mt-0.5">{value.name || "Corsa"}</div>
            <div className="text-[9px] font-bold text-gray-500 mt-0.5">
              {fmtDate(value.date)} · {value.distance_km?.toFixed(1)} km · {value.avg_pace}/km
            </div>
          </>
        ) : (
          <div className="text-[11px] font-bold text-gray-600 mt-1">Seleziona…</div>
        )}
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full rounded-xl border shadow-2xl overflow-hidden"
          style={{ background: "#0C0C0C", borderColor: BORDER }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: BORDER }}>
            <Search className="w-3 h-3 text-gray-600 shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="nome, data o tipo…"
              className="w-full bg-transparent text-[11px] font-bold text-white outline-none placeholder:text-gray-700"
            />
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onChange(r); setOpen(false); setQ(""); }}
                className="w-full text-left px-3 py-2 hover:bg-white/[0.05] transition-colors"
              >
                <div className="text-[11px] font-bold text-white truncate">{r.name || "Corsa"}</div>
                <div className="text-[9px] font-bold text-gray-600">
                  {fmtDate(r.date)} · {r.distance_km?.toFixed(1)} km · {r.avg_pace}/km · {r.run_type}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[10px] font-bold text-gray-700">Nessuna corsa</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Riga KPI a specchio ─────────────────────────────────────────────────────
type MetricRow = {
  label: string;
  a: number | null;
  b: number | null;
  fmt: (v: number) => string;
  /** true quando un valore più BASSO è migliore (passo, tempo). */
  lowerIsBetter?: boolean;
  unit?: string;
};

function MirrorRow({ m }: { m: MetricRow }) {
  const both = m.a != null && m.b != null;
  const delta = both ? (m.b as number) - (m.a as number) : null;
  const better = delta == null || Math.abs(delta) < 1e-9
    ? "same"
    : (m.lowerIsBetter ? delta < 0 : delta > 0) ? "b" : "a";

  const deltaText = delta == null
    ? "—"
    : `${delta > 0 ? "+" : "−"}${m.fmt(Math.abs(delta))}${m.unit ?? ""}`;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 border-b last:border-b-0" style={{ borderColor: "#171717" }}>
      <div className="text-right">
        <span className={`text-[15px] font-black tabular-nums ${better === "a" ? "text-white" : "text-gray-500"}`}>
          {m.a != null ? m.fmt(m.a) : "—"}
        </span>
        {m.unit && m.a != null && <span className="text-[9px] font-bold text-gray-600 ml-0.5">{m.unit}</span>}
      </div>
      <div className="text-center min-w-[104px]">
        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-600">{m.label}</div>
        <div
          className="text-[10px] font-black tabular-nums mt-0.5"
          style={{ color: better === "same" ? "#555" : better === "b" ? B_COLOR : A_COLOR }}
        >
          {deltaText}
        </div>
      </div>
      <div className="text-left">
        <span className={`text-[15px] font-black tabular-nums ${better === "b" ? "text-white" : "text-gray-500"}`}>
          {m.b != null ? m.fmt(m.b) : "—"}
        </span>
        {m.unit && m.b != null && <span className="text-[9px] font-bold text-gray-600 ml-0.5">{m.unit}</span>}
      </div>
    </div>
  );
}

// ─── Vista principale ────────────────────────────────────────────────────────
export function RunComparison({ runs }: { runs: Run[] }) {
  // Solo prestazioni confrontabili: sedute di qualità e corse veloci oltre i
  // 3 km. Mettere a confronto due fondi lenti non dice nulla, e sporca anche
  // i preset ("la migliore" finirebbe per essere un lento qualsiasi).
  const sorted = useMemo(
    () => runs.filter(isComparableRun).sort((a, b) => b.date.localeCompare(a.date)),
    [runs],
  );

  const [runA, setRunA] = useState<Run | null>(null);
  const [runB, setRunB] = useState<Run | null>(null);
  const [sameScale, setSameScale] = useState(true);
  const [weather, setWeather] = useState<Record<string, WeatherSnapshot | null>>({});

  // Default: le due corse più recenti, così la vista non parte vuota.
  useEffect(() => {
    if (!runA && sorted[1]) setRunA(sorted[1]);
    if (!runB && sorted[0]) setRunB(sorted[0]);
  }, [sorted, runA, runB]);

  // Meteo delle due corse: senza, confrontare un 4:10 a 8°C con un 4:10 a 28°C
  // significa dare per equivalenti due sforzi molto diversi.
  useEffect(() => {
    const targets = [runA, runB].filter((r): r is Run => !!r && hasWeatherContext(r));
    if (targets.length === 0) return;
    let cancelled = false;
    Promise.all(targets.map(async (r) => [r.id, await fetchWeatherForRun(r).catch(() => null)] as const))
      .then((entries) => {
        if (cancelled) return;
        setWeather((prev) => {
          const next = { ...prev };
          for (const [id, w] of entries) next[id] = w;
          return next;
        });
      });
    return () => { cancelled = true; };
  }, [runA, runB]);

  const applyPreset = useCallback((kind: "last-two" | "best-vs-last" | "same-distance") => {
    if (sorted.length < 2) return;
    if (kind === "last-two") {
      setRunA(sorted[1]);
      setRunB(sorted[0]);
      return;
    }
    if (kind === "best-vs-last") {
      const latest = sorted[0];
      // Soglia di distanza obbligatoria: senza, "la più veloce" finisce per
      // essere un artefatto GPS da 100 m a 2:31/km, che non è una prestazione.
      const candidates = sorted.filter((r) => r.distance_km >= MIN_BEST_KM);
      const best = [...candidates].sort(
        (x, y) => (parsePaceSec(x.avg_pace) ?? 1e9) - (parsePaceSec(y.avg_pace) ?? 1e9),
      )[0];
      if (best) {
        setRunA(best);
        setRunB(latest);
      }
      return;
    }
    // Corsa più simile per distanza alla più recente: il confronto più equo.
    const latest = sorted[0];
    const twin = sorted
      .slice(1)
      .map((r) => ({ r, d: Math.abs(r.distance_km - latest.distance_km) }))
      .sort((x, y) => x.d - y.d)[0];
    if (twin) {
      setRunA(twin.r);
      setRunB(latest);
    }
  }, [sorted]);

  // Stessa scala per le due mappe: si prende la finestra più larga fra le due.
  const span = useMemo(() => {
    if (!sameScale) return null;
    const spans = [runA, runB].map((r) => {
      const b = boundsOf(decode(r?.polyline));
      return b ? Math.max(b.maxLng - b.minLng, b.maxLat - b.minLat) : 0;
    });
    const max = Math.max(...spans);
    return max > 0 ? max : null;
  }, [runA, runB, sameScale]);

  // Passo per km delle due corse, sovrapposto sullo stesso asse: è qui che si
  // vede chi ha tenuto e chi è calato, cosa che due grafici affiancati nascondono.
  const paceChart = useMemo(() => {
    const seriesOf = (r: Run | null) =>
      (r?.splits ?? [])
        .filter((s) => (s.distance ?? 1000) >= 400) // scarta la coda finale
        .map((s) => parsePaceSec(s.pace))
        .filter((v): v is number => v != null);
    const a = seriesOf(runA);
    const b = seriesOf(runB);
    const n = Math.max(a.length, b.length);
    if (n < 2) return [];
    return Array.from({ length: n }, (_, i) => ({
      km: i + 1,
      a: a[i] ?? null,
      b: b[i] ?? null,
    }));
  }, [runA, runB]);

  const wA = runA ? weather[runA.id] ?? null : null;
  const wB = runB ? weather[runB.id] ?? null : null;
  const penaltyA = runA ? computeEnvironmentalPenalty(runA, wA) : null;
  const penaltyB = runB ? computeEnvironmentalPenalty(runB, wB) : null;

  const metrics: MetricRow[] = useMemo(() => {
    const paceA = parsePaceSec(runA?.avg_pace);
    const paceB = parsePaceSec(runB?.avg_pace);
    const gapA = runA?.gap_pace_sec ?? null;
    const gapB = runB?.gap_pace_sec ?? null;
    return [
      { label: "distanza", a: runA?.distance_km ?? null, b: runB?.distance_km ?? null, fmt: (v) => v.toFixed(2), unit: " km" },
      { label: "tempo", a: runA?.duration_minutes ?? null, b: runB?.duration_minutes ?? null, fmt: fmtDuration, lowerIsBetter: true },
      { label: "passo", a: paceA, b: paceB, fmt: fmtPace, lowerIsBetter: true, unit: "/km" },
      { label: "PBP", a: gapA, b: gapB, fmt: fmtPace, lowerIsBetter: true, unit: "/km" },
      {
        label: "passo normalizzato",
        a: paceA != null && penaltyA != null ? paceA - penaltyA : null,
        b: paceB != null && penaltyB != null ? paceB - penaltyB : null,
        fmt: fmtPace, lowerIsBetter: true, unit: "/km",
      },
      { label: "FC media", a: runA?.avg_hr ?? null, b: runB?.avg_hr ?? null, fmt: (v) => String(Math.round(v)), lowerIsBetter: true, unit: " bpm" },
      { label: "dislivello", a: runA?.elevation_gain ?? null, b: runB?.elevation_gain ?? null, fmt: (v) => String(Math.round(v)), unit: " m" },
      { label: "temperatura", a: wA?.temperature ?? null, b: wB?.temperature ?? null, fmt: (v) => `${Math.round(v)}`, unit: "°" },
    ];
  }, [runA, runB, wA, wB, penaltyA, penaltyB]);

  const card = "rounded-[26px] border p-5";
  const cardStyle = { background: PANEL, borderColor: BORDER };

  return (
    <div className="space-y-4">
      {/* Selettori + preset */}
      <section className={card} style={cardStyle}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mr-1">Preset</span>
          {([
            ["last-two", "ultime due"],
            ["best-vs-last", "migliore vs ultima"],
            ["same-distance", "stessa distanza"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => applyPreset(k)}
              className="px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider text-gray-400 bg-white/[0.04] border border-white/[0.06] hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => { setRunA(runB); setRunB(runA); }}
            title="Scambia le due corse"
            className="p-1.5 rounded-lg text-gray-500 bg-white/[0.04] border border-white/[0.06] hover:text-white transition-colors"
          >
            <Shuffle className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setSameScale((v) => !v)}
            title="Mostra i due tracciati nella stessa scala metrica"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider border transition-colors"
            style={{
              color: sameScale ? "#0A0A0A" : "#888",
              background: sameScale ? B_COLOR : "rgba(255,255,255,0.04)",
              borderColor: sameScale ? B_COLOR : "rgba(255,255,255,0.06)",
            }}
          >
            <Ruler className="w-3 h-3" />
            stessa scala
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RunPicker runs={sorted} value={runA} onChange={setRunA} color={A_COLOR} side="corsa A" />
          <RunPicker runs={sorted} value={runB} onChange={setRunB} color={B_COLOR} side="corsa B" />
        </div>
      </section>

      {/* Due mappe affiancate */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ height: 320 }}>
        <RouteMap run={runA} color={A_COLOR} span={span} />
        <RouteMap run={runB} color={B_COLOR} span={span} />
      </section>

      {/* KPI a specchio */}
      <section className={card} style={cardStyle}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-3 pb-3 border-b" style={{ borderColor: BORDER }}>
          <div className="text-right text-[10px] font-black truncate" style={{ color: A_COLOR }}>
            {runA ? `${runA.name || "Corsa"} · ${fmtDate(runA.date)}` : "—"}
          </div>
          <div className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-700 min-w-[104px] text-center">vs</div>
          <div className="text-left text-[10px] font-black truncate" style={{ color: B_COLOR }}>
            {runB ? `${runB.name || "Corsa"} · ${fmtDate(runB.date)}` : "—"}
          </div>
        </div>
        {metrics.map((m) => <MirrorRow key={m.label} m={m} />)}

        {wA?.temperature != null && wB?.temperature != null &&
          Math.abs(wA.temperature - wB.temperature) >= 3 && (
            <div className="flex items-start gap-2 mt-3 pt-3 border-t" style={{ borderColor: BORDER }}>
              <ThermometerSun className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: CHART_SERIES.load }} />
              <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
                Differenza di {Math.abs(Math.round(wA.temperature - wB.temperature))}°C fra le due giornate.
                Il <span style={{ color: wA.temperature > wB.temperature ? A_COLOR : B_COLOR }}>passo normalizzato</span> è
                il confronto onesto: toglie dal passo quello che ha messo il clima.
              </p>
            </div>
          )}
      </section>

      {/* Passo per km sovrapposto */}
      {paceChart.length >= 2 && (
        <section className={card} style={cardStyle}>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">
            Passo per km · sovrapposto
          </div>
          <p className="text-[9px] font-bold text-gray-600 mb-4">
            Le due curve sullo stesso asse: dove si allargano, una delle due ha ceduto.
          </p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paceChart} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="km" tick={{ fill: "#67707A", fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                <YAxis
                  reversed
                  domain={PACE_DOMAIN}
                  tick={{ fill: "#67707A", fontSize: 10, fontWeight: 800 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => fmtPace(v)}
                />
                <Tooltip
                  contentStyle={{ background: "#0A0A0A", border: `1px solid ${BORDER}`, borderRadius: 14 }}
                  labelFormatter={(v) => `km ${v}`}
                  formatter={(v: number, name: string) => [`${fmtPace(v)}/km`, name === "a" ? "corsa A" : "corsa B"]}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#888" }}>
                      {value === "a" ? runA?.name || "corsa A" : runB?.name || "corsa B"}
                    </span>
                  )}
                />
                <Line type="monotone" dataKey="a" stroke={A_COLOR} strokeWidth={2.2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="b" stroke={B_COLOR} strokeWidth={2.2} dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {paceChart.length < 2 && (runA || runB) && (
        <section className={card} style={cardStyle}>
          <p className="text-[10px] font-bold text-gray-600 text-center py-4">
            Nessuna delle due corse ha i parziali per km: il grafico sovrapposto non è disponibile.
          </p>
        </section>
      )}
    </div>
  );
}
