import { useEffect, useMemo, useRef } from "react";
import Map, { Source, Layer, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import polyline from "@mapbox/polyline";
import { gsap } from "../celebrations/gsapSetup";
import { Flame, MapPinned } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";

const MONO = "'JetBrains Mono', monospace";
const TOKEN = "pk.eyJ1Ijoia2lra29kZXJpc28iLCJhIjoiY21uYWszMTIxMGp3NzJzc2JraDhwbTU5ayJ9.-60pgYn_BXERAHA7AqVgqA";

type LoadedMap = { flyTo: (o: unknown) => void };

export function GamificationV3() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);

  // Punti densi da tutte le polyline (heatmap) + linee (tracce)
  const { points, lines, mapped, romaKm, center } = useMemo(() => {
    const pts: GeoJSON.Feature[] = [];
    const lns: GeoJSON.Feature[] = [];
    let mapped = 0, romaKm = 0;
    let sumLng = 0, sumLat = 0, n = 0;
    for (const r of runs) {
      if (!r.polyline || !r.start_latlng) continue;
      if (Math.abs(r.start_latlng[0] - 41.9) > 0.8 || Math.abs(r.start_latlng[1] - 12.5) > 0.9) continue;
      let coords: [number, number][] = [];
      try { coords = polyline.decode(r.polyline).map(([lat, lng]) => [lng, lat] as [number, number]); } catch { continue; }
      if (coords.length < 2) continue;
      mapped++; romaKm += r.distance_km || 0;
      sumLng += coords[0][0]; sumLat += coords[0][1]; n++;
      lns.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
      for (let i = 0; i < coords.length; i += 4) pts.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coords[i] } });
    }
    return {
      points: { type: "FeatureCollection", features: pts } as GeoJSON.FeatureCollection,
      lines: { type: "FeatureCollection", features: lns.slice(0, 400) } as GeoJSON.FeatureCollection,
      mapped, romaKm: Math.round(romaKm),
      center: n ? [sumLng / n, sumLat / n] as [number, number] : [12.4922, 41.8902] as [number, number],
    };
  }, [runs]);

  const mapRef = useRef<MapRef | null>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const c = gsap.context(() => gsap.from(".hm-hud > *", { opacity: 0, y: 16, duration: 0.6, stagger: 0.08, ease: "power3.out", delay: 0.2 }), hudRef); return () => c.revert(); }, []);

  const onLoad = (e: { target: LoadedMap }) => { e.target.flyTo({ center, zoom: 12.4, pitch: 0, duration: 2600, essential: true }); };

  return (
    <main className="flex-1 relative min-h-0 bg-black overflow-hidden">
      <Map ref={mapRef} mapboxAccessToken={TOKEN} initialViewState={{ longitude: center[0], latitude: center[1], zoom: 11 }}
        mapStyle="mapbox://styles/mapbox/dark-v11" onLoad={onLoad as never} attributionControl={false} style={{ position: "absolute", inset: 0 }}>
        <Source id="tracks" type="geojson" data={lines}>
          <Layer id="tracks-l" type="line" paint={{ "line-color": "#C0FF00", "line-width": 1.2, "line-opacity": 0.12 }} layout={{ "line-cap": "round" }} />
        </Source>
        <Source id="heat" type="geojson" data={points}>
          <Layer id="heat-l" type="heatmap" paint={{
            "heatmap-weight": 0.7,
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1, 15, 3],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 8, 15, 22],
            "heatmap-opacity": 0.85,
            "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(0,0,0,0)", 0.2, "rgba(34,211,238,0.4)", 0.45, "rgba(34,211,238,0.9)",
              0.7, "rgba(192,255,0,0.95)", 1, "rgba(255,255,255,1)"],
          }} />
        </Source>
      </Map>

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(130% 100% at 50% 45%, transparent 60%, rgba(0,0,0,0.7) 100%)" }} />

      <div ref={hudRef} className="hm-hud absolute top-4 left-4 z-10 rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5 max-w-[300px]">
        <div className="flex items-center gap-2 mb-3"><Flame className="w-5 h-5 text-[#C0FF00]" /><h1 className="text-lg font-black tracking-tight uppercase italic text-white">La Tua <span className="text-[#C0FF00]">Roma</span></h1></div>
        <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">Mappa di calore · tracce reali</div>
        <div className="flex items-baseline gap-2"><span className="text-4xl font-black tabular-nums text-[#C0FF00]" style={{ fontFamily: MONO }}>{mapped}</span><span className="text-sm text-gray-500">corse</span></div>
        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-400"><MapPinned className="w-3.5 h-3.5 text-[#22D3EE]" /><span><span className="font-black text-white" style={{ fontFamily: MONO }}>{romaKm.toLocaleString("it-IT")}</span> km percorsi in città</span></div>
        <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">Ogni tua corsa accende le strade che hai percorso davvero. Più passi, più la mappa brucia. Sincronizza per espandere la tua impronta.</p>
      </div>
    </main>
  );
}
