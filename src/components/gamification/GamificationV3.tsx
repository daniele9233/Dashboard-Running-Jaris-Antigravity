import { useEffect, useMemo, useRef } from "react";
import Map, { Source, Layer, Marker, type MapRef } from "react-map-gl/maplibre";
import type { MapLibreEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { gsap } from "../celebrations/gsapSetup";
import { Compass, Navigation, Flag } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import { computeGamiStats, buildRoute, positionAtKm, routeLine, EARTH_CIRCUMFERENCE } from "./gamiData";

const MONO = "'JetBrains Mono', monospace";
const AMBER = "#F59E0B";
const PIN = "#FB923C";

// Satellite ultrarealistico ESRI World Imagery (raster, niente etichette).
const ESRI_STYLE = {
  version: 8,
  sources: {
    sat: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256, maxzoom: 19,
      attribution: "© Esri · Maxar · Earthstar Geographics",
    },
  },
  layers: [{ id: "sat", type: "raster", source: "sat" }],
};

export function GamificationV3() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const s = useMemo(() => computeGamiStats(runs), [runs]);

  const mapRef = useRef<MapRef | null>(null);
  const hudRef = useRef<HTMLDivElement>(null);

  const route = useMemo(() => buildRoute(s.totalKm), [s.totalKm]);
  const lap = Math.floor(s.totalKm / route.totalKm);
  const traveledKm = s.totalKm % route.totalKm;
  const pos = useMemo(() => positionAtKm(traveledKm), [traveledKm]);
  const stops = useMemo(() => buildRoute(traveledKm).stops, [traveledKm]);

  const fullGeo = useMemo(() => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeLine(null) } }) as const, []);
  const litGeo = useMemo(() => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeLine(traveledKm) } }) as const, [traveledKm]);

  const pct = (s.totalKm / EARTH_CIRCUMFERENCE) * 100;
  const reachedCount = stops.filter((x) => x.reached).length;
  const next = stops.find((x) => !x.reached);
  const lastReached = [...stops].reverse().find((x) => x.reached);

  useEffect(() => {
    const ctx = gsap.context(() => gsap.from(".ex-hud > *", { opacity: 0, y: 16, duration: 0.6, stagger: 0.08, ease: "power3.out", delay: 0.2 }), hudRef);
    return () => ctx.revert();
  }, []);

  const onLoad = (e: MapLibreEvent) => {
    const map = e.target;
    try { (map as unknown as { setProjection: (p: unknown) => void }).setProjection({ type: "globe" }); } catch { /* */ }
    map.flyTo({ center: [pos.lng, pos.lat], zoom: 3.6, pitch: 45, bearing: -12, duration: 3400, essential: true });
  };

  return (
    <main className="flex-1 relative min-h-0 bg-black overflow-hidden">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: pos.lng, latitude: pos.lat, zoom: 1.8 }}
        mapStyle={ESRI_STYLE as never}
        onLoad={onLoad as never}
        attributionControl={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <Source id="route-full" type="geojson" data={fullGeo as never}>
          <Layer id="route-full-l" type="line" paint={{ "line-color": "#FFFFFF", "line-width": 1.4, "line-opacity": 0.45, "line-dasharray": [2, 3] }} />
        </Source>
        <Source id="route-lit" type="geojson" data={litGeo as never}>
          <Layer id="route-lit-glow" type="line" paint={{ "line-color": AMBER, "line-width": 10, "line-blur": 9, "line-opacity": 0.55 }} />
          <Layer id="route-lit-core" type="line" paint={{ "line-color": "#FDE68A", "line-width": 2.6 }} />
        </Source>

        {stops.slice(0, -1).map((c, i) => (
          <Marker key={`${c.name}-${i}`} longitude={c.lng} latitude={c.lat} anchor="center">
            <div title={`${c.name} · ${c.cumKm.toLocaleString("it-IT")} km`} className="rounded-full"
              style={{ width: c.reached ? 11 : 7, height: c.reached ? 11 : 7, background: c.reached ? AMBER : "rgba(0,0,0,0.35)", border: `2px solid ${c.reached ? "#FDE68A" : "rgba(255,255,255,0.6)"}`, boxShadow: c.reached ? `0 0 12px ${AMBER}` : "none" }} />
          </Marker>
        ))}
        <Marker longitude={pos.lng} latitude={pos.lat} anchor="center">
          <div className="relative grid place-items-center">
            <span className="absolute w-8 h-8 rounded-full animate-ping" style={{ background: `${PIN}55` }} />
            <span className="relative w-4 h-4 rounded-full border-2 border-white" style={{ background: PIN, boxShadow: `0 0 16px ${PIN}` }} />
          </div>
        </Marker>
      </Map>

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 95% at 50% 35%, transparent 50%, rgba(20,10,0,0.55) 100%)" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 22%, transparent 78%, rgba(0,0,0,0.45) 100%)" }} />

      <div ref={hudRef} className="ex-hud pointer-events-none absolute inset-0 p-4 md:p-8 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="pointer-events-auto rounded-2xl border border-[#F59E0B]/25 bg-black/50 backdrop-blur-xl p-5 max-w-[340px]">
            <div className="flex items-center gap-2 mb-3"><Compass className="w-5 h-5 text-[#F59E0B]" /><h1 className="text-lg font-black tracking-tight uppercase italic text-white">La <span className="text-[#F59E0B]">Spedizione</span></h1></div>
            <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">Terreno esplorato</div>
            <div className="flex items-baseline gap-2"><span className="text-4xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{Math.round(s.totalKm).toLocaleString("it-IT")}</span><span className="text-sm text-gray-500">km</span></div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${AMBER}, #FDE68A)` }} /></div>
            <div className="flex items-center justify-between mt-1.5 text-[10px]"><span className="text-gray-500">giro del pianeta</span><span className="font-black tabular-nums" style={{ fontFamily: MONO, color: AMBER }}>{pct.toFixed(2)}%</span></div>
            {lap > 0 && <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-[#F59E0B]">🧭 {lap}° giro completato</div>}
          </div>
          <div className="pointer-events-auto rounded-2xl border border-[#FB923C]/25 bg-black/50 backdrop-blur-xl px-4 py-3 text-right">
            <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500">Accampamento</div>
            <div className="text-sm font-black text-[#FB923C] flex items-center gap-1.5 justify-end"><Navigation className="w-3.5 h-3.5" />{lastReached?.name ?? "Roma"}</div>
            {next && <div className="text-[10px] text-gray-500 mt-1">meta: <span className="text-gray-300">{next.name}</span> · <span style={{ fontFamily: MONO }}>{Math.max(0, next.cumKm - traveledKm).toLocaleString("it-IT")} km</span></div>}
          </div>
        </div>
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 mb-2 px-1"><Flag className="w-3.5 h-3.5 text-[#F59E0B]" /><span className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-400">Diario di viaggio · {reachedCount}/{stops.length}</span></div>
          <div className="flex items-center gap-2">
            {stops.slice(0, -1).map((c, i) => (
              <div key={i} className="shrink-0 rounded-xl border px-3 py-2 min-w-[92px]" style={{ borderColor: c.reached ? `${AMBER}44` : "rgba(255,255,255,0.06)", background: c.reached ? `${AMBER}12` : "transparent", opacity: c.reached ? 1 : 0.5 }}>
                <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: c.reached ? AMBER : "#A8A29E" }}>{c.name}</div>
                <div className="text-[9px] text-gray-500 tabular-nums" style={{ fontFamily: MONO }}>{c.cumKm.toLocaleString("it-IT")} km</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
