import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Source, Layer, Marker, type MapRef } from "react-map-gl/maplibre";
import type { MapLibreEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { gsap } from "../celebrations/gsapSetup";
import { Globe2, MapPin, Navigation } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import { computeGamiStats, buildRoute, positionAtKm, routeLine, EARTH_CIRCUMFERENCE } from "./gamiData";

const MONO = "'JetBrains Mono', monospace";
const ACCENT = "#22D3EE";
const LIT = "#C0FF00";
const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export function GamificationV1() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const s = useMemo(() => computeGamiStats(runs), [runs]);

  const mapRef = useRef<MapRef | null>(null);
  const hudRef = useRef<HTMLDivElement>(null);

  const route = useMemo(() => buildRoute(s.totalKm), [s.totalKm]);
  const lap = Math.floor(s.totalKm / route.totalKm);
  const traveledKm = s.totalKm % route.totalKm;          // posizione nel giro corrente
  const pos = useMemo(() => positionAtKm(traveledKm), [traveledKm]);
  const stops = useMemo(() => buildRoute(traveledKm).stops, [traveledKm]);

  const fullGeo = useMemo(() => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeLine(null) } }) as const, []);
  const litGeo = useMemo(() => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeLine(traveledKm) } }) as const, [traveledKm]);

  const pct = (s.totalKm / EARTH_CIRCUMFERENCE) * 100;
  const reachedCount = stops.filter((x) => x.reached).length;
  const next = stops.find((x) => !x.reached);
  const lastReached = [...stops].reverse().find((x) => x.reached);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !hudRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".gw-hud > *", { opacity: 0, y: 16, duration: 0.6, stagger: 0.08, ease: "power3.out" });
      const proxy = { v: 0 };
      const el = hudRef.current?.querySelector(".gw-pct");
      if (el) gsap.to(proxy, { v: pct, duration: 1.4, ease: "power2.out", onUpdate: () => { el.textContent = proxy.v.toFixed(2) + "%"; } });
    }, hudRef);
    return () => ctx.revert();
  }, [ready, pct]);

  const onLoad = (e: MapLibreEvent) => {
    const map = e.target;
    try { (map as unknown as { setProjection: (p: unknown) => void }).setProjection({ type: "globe" }); } catch { /* fallback mercator */ }
    setReady(true);
    map.flyTo({ center: [pos.lng, pos.lat], zoom: 3.2, pitch: 30, duration: 3200, essential: true });
  };

  return (
    <main className="flex-1 relative min-h-0 bg-black overflow-hidden">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: pos.lng, latitude: pos.lat, zoom: 1.6 }}
        mapStyle={DARK_STYLE}
        onLoad={onLoad as never}
        attributionControl={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {/* Rotta completa (fioca) */}
        <Source id="route-full" type="geojson" data={fullGeo as never}>
          <Layer id="route-full-l" type="line" paint={{ "line-color": "#3F3F46", "line-width": 1.5, "line-dasharray": [2, 3] }} />
        </Source>
        {/* Tratto percorso — glow + linea */}
        <Source id="route-lit" type="geojson" data={litGeo as never}>
          <Layer id="route-lit-glow" type="line" paint={{ "line-color": LIT, "line-width": 9, "line-blur": 8, "line-opacity": 0.5 }} />
          <Layer id="route-lit-core" type="line" paint={{ "line-color": LIT, "line-width": 2.5 }} />
        </Source>

        {/* Pin città */}
        {stops.slice(0, -1).map((c, i) => (
          <Marker key={`${c.name}-${i}`} longitude={c.lng} latitude={c.lat} anchor="center">
            <div className="grid place-items-center" title={`${c.name} · ${c.cumKm.toLocaleString("it-IT")} km`}>
              <div className="rounded-full" style={{
                width: c.reached ? 10 : 7, height: c.reached ? 10 : 7,
                background: c.reached ? LIT : "transparent",
                border: `2px solid ${c.reached ? LIT : "#52525B"}`,
                boxShadow: c.reached ? `0 0 10px ${LIT}` : "none",
              }} />
            </div>
          </Marker>
        ))}

        {/* Posizione attuale */}
        <Marker longitude={pos.lng} latitude={pos.lat} anchor="center">
          <div className="relative grid place-items-center">
            <span className="absolute w-7 h-7 rounded-full animate-ping" style={{ background: `${ACCENT}55` }} />
            <span className="relative w-3.5 h-3.5 rounded-full" style={{ background: ACCENT, boxShadow: `0 0 14px ${ACCENT}` }} />
          </div>
        </Marker>
      </Map>

      {/* vignettatura spaziale */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 30%, transparent 55%, rgba(0,0,0,0.85) 100%)" }} />

      {/* HUD */}
      <div ref={hudRef} className="gw-hud pointer-events-none absolute inset-0 p-4 md:p-8 flex flex-col justify-between">
        {/* top */}
        <div className="flex items-start justify-between gap-4">
          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5 max-w-[340px]">
            <div className="flex items-center gap-2 mb-3">
              <Globe2 className="w-5 h-5 text-[#22D3EE]" />
              <h1 className="text-lg font-black tracking-tight uppercase italic text-white">Giro del <span className="text-[#22D3EE]">Mondo</span></h1>
            </div>
            <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">Distanza percorsa</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{Math.round(s.totalKm).toLocaleString("it-IT")}</span>
              <span className="text-sm text-gray-500">km</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${LIT}, ${ACCENT})` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px]">
              <span className="text-gray-500">giro del pianeta</span>
              <span className="gw-pct font-black tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{pct.toFixed(2)}%</span>
            </div>
            {lap > 0 && <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-[#C0FF00]">🌍 {lap}° giro completato!</div>}
          </div>

          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl px-4 py-3 text-right">
            <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500">Sei a</div>
            <div className="text-sm font-black text-[#22D3EE] flex items-center gap-1.5 justify-end">
              <Navigation className="w-3.5 h-3.5" />{lastReached?.name ?? "Roma"}
            </div>
            {next && (
              <div className="text-[10px] text-gray-500 mt-1">
                prossima: <span className="text-gray-300">{next.name}</span> · <span style={{ fontFamily: MONO }}>{Math.max(0, next.cumKm - traveledKm).toLocaleString("it-IT")} km</span>
              </div>
            )}
          </div>
        </div>

        {/* bottom — passaporto tappe */}
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 mb-2 px-1">
            <MapPin className="w-3.5 h-3.5 text-[#C0FF00]" />
            <span className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-400">Passaporto · {reachedCount}/{stops.length} tappe</span>
          </div>
          <div className="flex items-center gap-2">
            {stops.slice(0, -1).map((c, i) => (
              <div key={i} className="shrink-0 rounded-xl border px-3 py-2 min-w-[92px]"
                style={{ borderColor: c.reached ? `${LIT}44` : "rgba(255,255,255,0.06)", background: c.reached ? `${LIT}10` : "transparent", opacity: c.reached ? 1 : 0.5 }}>
                <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: c.reached ? LIT : "#71717A" }}>{c.name}</div>
                <div className="text-[9px] text-gray-500 tabular-nums" style={{ fontFamily: MONO }}>{c.cumKm.toLocaleString("it-IT")} km</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
