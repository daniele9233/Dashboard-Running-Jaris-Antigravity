import { useEffect, useMemo, useRef } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { gsap } from "../celebrations/gsapSetup";
import { Mountain, TrendingUp } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";

const MONO = "'JetBrains Mono', monospace";
const LIT = "#C0FF00";
const TOKEN = "pk.eyJ1Ijoia2lra29kZXJpc28iLCJhIjoiY21uYWszMTIxMGp3NzJzc2JraDhwbTU5ayJ9.-60pgYn_BXERAHA7AqVgqA";
const EVEREST = 8848;

// Scala dell'ascesa: vette reali (con coordinate sulla mappa) poi traguardi
// cumulativi cosmici, così c'è sempre una meta più alta da raggiungere.
const PEAKS: { name: string; alt: number; lat?: number; lng?: number; country?: string }[] = [
  { name: "Etna", country: "Italia", lat: 37.751, lng: 14.993, alt: 3357 },
  { name: "Cervino", country: "Italia/CH", lat: 45.9763, lng: 7.6586, alt: 4478 },
  { name: "Monte Bianco", country: "Italia/FR", lat: 45.8326, lng: 6.8652, alt: 4808 },
  { name: "Kilimanjaro", country: "Tanzania", lat: -3.0674, lng: 37.3556, alt: 5895 },
  { name: "Aconcagua", country: "Argentina", lat: -32.6532, lng: -70.0109, alt: 6961 },
  { name: "K2", country: "Pakistan", lat: 35.8825, lng: 76.5133, alt: 8611 },
  { name: "Everest", country: "Nepal", lat: 27.9881, lng: 86.925, alt: 8848 },
  { name: "Everest ×2", alt: 17696 },
  { name: "Everest ×3", alt: 26544 },
  { name: "Stratosfera", alt: 50000 },
  { name: "Spazio · Kármán", alt: 100000 },
];

type LoadedMap = { setProjection: (p: unknown) => void; setFog: (f: unknown) => void; flyTo: (o: unknown) => void };

export function GamificationV2() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const totalAscent = useMemo(() => Math.round(runs.reduce((a, r) => a + (r.elevation_gain || 0), 0)), [runs]);

  const reached = PEAKS.filter((p) => totalAscent >= p.alt);
  const current = reached[reached.length - 1] ?? null;
  const next = PEAKS.find((p) => totalAscent < p.alt) ?? null;
  const everestX = totalAscent / EVEREST;
  const geoPeaks = PEAKS.filter((p) => p.lat != null);
  const focus = [...reached].reverse().find((p) => p.lat != null) ?? geoPeaks[0];

  const mapRef = useRef<MapRef | null>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const c = gsap.context(() => gsap.from(".vt-hud > *", { opacity: 0, y: 16, duration: 0.6, stagger: 0.08, ease: "power3.out", delay: 0.2 }), hudRef); return () => c.revert(); }, []);

  const onLoad = (e: { target: LoadedMap }) => {
    const m = e.target;
    try { m.setProjection("globe"); } catch { /* */ }
    try { m.setFog({ color: "rgb(14,18,28)", "high-color": "rgb(50,70,100)", "horizon-blend": 0.1, "space-color": "rgb(2,4,10)", "star-intensity": 0.4 }); } catch { /* */ }
    m.flyTo({ center: [focus.lng, focus.lat], zoom: 4.2, pitch: 50, duration: 3000, essential: true });
  };

  return (
    <main className="flex-1 relative min-h-0 bg-black overflow-hidden">
      <Map ref={mapRef} mapboxAccessToken={TOKEN} initialViewState={{ longitude: focus.lng, latitude: focus.lat, zoom: 2 }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12" projection={{ name: "globe" }} onLoad={onLoad as never}
        attributionControl={false} style={{ position: "absolute", inset: 0 }}>
        {geoPeaks.map((p) => {
          const got = totalAscent >= p.alt;
          return (
            <Marker key={p.name} longitude={p.lng!} latitude={p.lat!} anchor="bottom">
              <div className="flex flex-col items-center" title={`${p.name} · ${p.alt} m`}>
                {got && <div className="text-[9px] font-black mb-0.5 px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: LIT, fontFamily: MONO }}>{p.name}</div>}
                <svg width="22" height="20" viewBox="0 0 22 20"><path d="M11 1 L21 19 L1 19 Z" fill={got ? LIT : "transparent"} stroke={got ? LIT : "#64748B"} strokeWidth="1.6" /><path d="M11 1 L14.5 7 L8 9 Z" fill={got ? "#FFFFFF" : "#94A3B8"} opacity={got ? 0.9 : 0.5} /></svg>
              </div>
            </Marker>
          );
        })}
      </Map>

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 35%, transparent 55%, rgba(0,0,0,0.8) 100%)" }} />

      <div ref={hudRef} className="vt-hud absolute inset-0 p-4 md:p-8 flex flex-col justify-between pointer-events-none">
        <div className="flex items-start justify-between gap-4">
          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5 max-w-[300px]">
            <div className="flex items-center gap-2 mb-3"><Mountain className="w-5 h-5 text-[#C0FF00]" /><h1 className="text-lg font-black tracking-tight uppercase italic text-white">Scala le <span className="text-[#C0FF00]">Vette</span></h1></div>
            <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">Dislivello totale salito</div>
            <div className="flex items-baseline gap-2"><span className="text-4xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{totalAscent.toLocaleString("it-IT")}</span><span className="text-sm text-gray-500">m</span></div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px]"><TrendingUp className="w-3.5 h-3.5 text-[#C0FF00]" /><span className="text-gray-400">pari a <span className="font-black text-[#C0FF00]" style={{ fontFamily: MONO }}>{everestX.toFixed(2)}×</span> l'Everest</span></div>
            {next && (
              <div className="mt-3">
                <div className="text-[10px] text-gray-500 mb-1">prossima vetta: <span className="text-gray-300">{next.name}</span> ({next.alt} m)</div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (totalAscent / next.alt) * 100)}%`, background: `linear-gradient(90deg, ${LIT}, #22D3EE)` }} /></div>
                <div className="text-[10px] text-gray-600 mt-1" style={{ fontFamily: MONO }}>mancano {(next.alt - totalAscent).toLocaleString("it-IT")} m</div>
              </div>
            )}
          </div>
          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl px-4 py-3 text-right">
            <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500">Vetta attuale</div>
            <div className="text-sm font-black text-[#C0FF00]">{current ? current.name : "Base camp"}</div>
            <div className="text-[10px] text-gray-500 mt-1">{reached.length}/{PEAKS.length} conquistate</div>
          </div>
        </div>
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2">
            {PEAKS.map((p) => {
              const got = totalAscent >= p.alt;
              return (
                <div key={p.name} className="shrink-0 rounded-xl border px-3 py-2 min-w-[96px]" style={{ borderColor: got ? `${LIT}44` : "rgba(255,255,255,0.06)", background: got ? `${LIT}12` : "transparent", opacity: got ? 1 : 0.5 }}>
                  <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: got ? LIT : "#94A3B8" }}>{p.name}</div>
                  <div className="text-[9px] text-gray-500 tabular-nums" style={{ fontFamily: MONO }}>{p.alt.toLocaleString("it-IT")} m</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
