import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Source, Layer, Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import polyline from "@mapbox/polyline";
import { gsap } from "../celebrations/gsapSetup";
import { Globe2, Map as MapIcon, TrendingUp, Navigation, Target, Activity, Zap, Shield, AlertTriangle, ShieldCheck } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { Run, RunsResponse } from "../../types/api";
import { computeGamiStats, equatorJourney, positionOnCum, EARTH_CIRCUMFERENCE, type CumRoute } from "./gamiData";
import { computeLeveling, GOALS, type Leveling, type Axis } from "./leveling";

const MONO = "'JetBrains Mono', monospace";
const LIT = "#C0FF00";
const TOKEN = "pk.eyJ1Ijoia2lra29kZXJpc28iLCJhIjoiY21uYWszMTIxMGp3NzJzc2JraDhwbTU5ayJ9.-60pgYn_BXERAHA7AqVgqA";

type Mode = "equatore" | "italia" | "ascesa";
type LoadedMap = { setProjection: (p: unknown) => void; setFog: (f: unknown) => void; flyTo: (o: unknown) => void; setConfigProperty?: (a: string, b: string, c: unknown) => void };
const line = (coords: [number, number][]) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }) as const;

const RUN_COLOR: Record<string, string> = { long: "#C0FF00", intervals: "#F43F5E", tempo: "#F59E0B", easy: "#22D3EE", recovery: "#A78BFA" };

// ══ MODALITÀ EQUATORE ═════════════════════════════════════════════════════════
function EquatorMode({ totalKm }: { totalKm: number }) {
  const j = useMemo(() => equatorJourney(totalKm), [totalKm]);
  const onLoad = (e: { target: LoadedMap }) => {
    const m = e.target;
    try { m.setProjection("globe"); } catch { /* */ }
    try { m.setFog({ color: "rgb(10,15,30)", "high-color": "rgb(30,55,100)", "horizon-blend": 0.08, "space-color": "rgb(2,4,10)", "star-intensity": 0.5 }); } catch { /* */ }
    m.flyTo({ center: [j.curLng, 0], zoom: 2.4, duration: 2600, essential: true });
  };
  return (
    <Map mapboxAccessToken={TOKEN} initialViewState={{ longitude: j.curLng, latitude: 0, zoom: 1.6 }}
      mapStyle="mapbox://styles/mapbox/dark-v11" projection={{ name: "globe" }} onLoad={onLoad as never}
      attributionControl={false} style={{ position: "absolute", inset: 0 }}>
      <Source id="eq-full" type="geojson" data={line(j.full) as never}>
        <Layer id="eq-full-l" type="line" paint={{ "line-color": "#475569", "line-width": 1.4, "line-dasharray": [2, 3], "line-opacity": 0.6 }} />
      </Source>
      <Source id="eq-lit" type="geojson" data={line(j.lit) as never}>
        <Layer id="eq-glow" type="line" paint={{ "line-color": LIT, "line-width": 8, "line-blur": 8, "line-opacity": 0.5 }} />
        <Layer id="eq-core" type="line" paint={{ "line-color": LIT, "line-width": 2.5 }} />
      </Source>
      <Marker longitude={j.curLng} latitude={0} anchor="center">
        <div className="relative grid place-items-center"><span className="absolute w-8 h-8 rounded-full animate-ping" style={{ background: "#22D3EE55" }} /><span className="relative w-4 h-4 rounded-full border-2 border-white" style={{ background: "#22D3EE", boxShadow: "0 0 16px #22D3EE" }} /></div>
      </Marker>
    </Map>
  );
}

// ══ MODALITÀ STRADE D'ITALIA ══════════════════════════════════════════════════
function ItaliaMode({ totalKm, route }: { totalKm: number; route: CumRoute }) {
  const litCoords = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < route.coords.length; i++) { if (route.cum[i] > totalKm) break; out.push(route.coords[i]); }
    if (out.length) { const p = positionOnCum(route, totalKm); out.push([p.lng, p.lat]); }
    return out;
  }, [totalKm, route]);
  const pos = useMemo(() => positionOnCum(route, totalKm), [totalKm, route]);
  const onLoad = (e: { target: LoadedMap }) => { e.target.flyTo({ center: [pos.lng, pos.lat], zoom: 7.5, pitch: 40, duration: 2600, essential: true }); };
  return (
    <Map mapboxAccessToken={TOKEN} initialViewState={{ longitude: 12.5, latitude: 42.5, zoom: 5 }}
      mapStyle="mapbox://styles/mapbox/satellite-streets-v12" onLoad={onLoad as never} attributionControl={false} style={{ position: "absolute", inset: 0 }}>
      <Source id="it-full" type="geojson" data={line(route.coords) as never}>
        <Layer id="it-full-l" type="line" paint={{ "line-color": "#FFFFFF", "line-width": 1.2, "line-opacity": 0.35 }} />
      </Source>
      <Source id="it-lit" type="geojson" data={line(litCoords) as never}>
        <Layer id="it-glow" type="line" paint={{ "line-color": LIT, "line-width": 7, "line-blur": 6, "line-opacity": 0.55 }} />
        <Layer id="it-core" type="line" paint={{ "line-color": LIT, "line-width": 3 }} />
      </Source>
      <Marker longitude={pos.lng} latitude={pos.lat} anchor="center">
        <div className="relative grid place-items-center"><span className="absolute w-8 h-8 rounded-full animate-ping" style={{ background: "#C0FF0055" }} /><span className="relative w-4 h-4 rounded-full border-2 border-white" style={{ background: LIT, boxShadow: `0 0 16px ${LIT}` }} /></div>
      </Marker>
    </Map>
  );
}

// ══ MODALITÀ ASCESA — città 3D notturna (le corse illuminano le strade) ═══════
function CityMap({ runs }: { runs: Run[] }) {
  const paths = useMemo(() => {
    const feats = runs.filter((r) => r.polyline && r.start_latlng && Math.abs(r.start_latlng[0] - 41.9) < 0.6 && Math.abs(r.start_latlng[1] - 12.5) < 0.7)
      .slice(0, 60)
      .map((r) => {
        let coords: [number, number][] = [];
        try { coords = polyline.decode(r.polyline as string).map(([lat, lng]) => [lng, lat] as [number, number]); } catch { /* */ }
        return { type: "Feature", properties: { color: RUN_COLOR[r.run_type] ?? RUN_COLOR.easy }, geometry: { type: "LineString", coordinates: coords } };
      }).filter((f) => f.geometry.coordinates.length > 1);
    return { type: "FeatureCollection", features: feats } as const;
  }, [runs]);
  const center = paths.features[0]?.geometry.coordinates[0] ?? [12.4922, 41.8902];
  const onLoad = (e: { target: LoadedMap }) => { try { e.target.setConfigProperty?.("basemap", "lightPreset", "night"); } catch { /* */ } };
  return (
    <Map mapboxAccessToken={TOKEN} initialViewState={{ longitude: center[0], latitude: center[1], zoom: 14.5, pitch: 62, bearing: -18 }}
      mapStyle="mapbox://styles/mapbox/standard" onLoad={onLoad as never} attributionControl={false} style={{ position: "absolute", inset: 0 }}>
      <Source id="runs" type="geojson" data={paths as never}>
        <Layer id="runs-glow" type="line" paint={{ "line-color": ["get", "color"], "line-width": 7, "line-blur": 6, "line-opacity": 0.5 }} layout={{ "line-cap": "round", "line-join": "round" }} />
        <Layer id="runs-core" type="line" paint={{ "line-color": ["get", "color"], "line-width": 2.5 }} layout={{ "line-cap": "round", "line-join": "round" }} />
      </Source>
    </Map>
  );
}

// ── HUD del sistema a livelli ─────────────────────────────────────────────────
const AXES: { k: Axis; short: string; label: string; color: string; icon: typeof Zap }[] = [
  { k: "nm", short: "Neuro", label: "Neuromuscolare", color: "#F43F5E", icon: Zap },
  { k: "met", short: "Metab", label: "Metabolico", color: "#C0FF00", icon: Activity },
  { k: "str", short: "Strutt", label: "Strutturale", color: "#22D3EE", icon: Shield },
];

function AscesaHud({ lev, goalId, setGoalId }: { lev: Leveling; goalId: string; setGoalId: (id: string) => void }) {
  return (
    <>
      {/* Pannello livello + obiettivo (in alto a sinistra) */}
      <div className="absolute top-20 left-4 z-10 w-[320px] max-w-[88vw] space-y-3 pointer-events-auto">
        <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-5 h-5 text-[#C0FF00]" /><h1 className="text-lg font-black tracking-tight uppercase italic text-white">La Tua <span className="text-[#C0FF00]">Ascesa</span></h1></div>
          <div className="flex items-end gap-3">
            <div>
              <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500">Livello</div>
              <div className="text-5xl font-black tabular-nums text-[#C0FF00] leading-none" style={{ fontFamily: MONO }}>{lev.level}</div>
            </div>
            <div className="flex-1 pb-1">
              <div className="flex justify-between text-[10px] mb-1"><span className="text-gray-500 uppercase tracking-wider">XP livello</span><span style={{ fontFamily: MONO }} className="text-gray-400">{Math.round(lev.xp - lev.levelFloor)}/{Math.round(lev.levelCeil - lev.levelFloor)}</span></div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#C0FF00] to-[#22D3EE]" style={{ width: `${lev.levelPct}%` }} /></div>
              <div className="text-[10px] text-gray-600 mt-1" style={{ fontFamily: MONO }}>{lev.xp.toLocaleString("it-IT")} XP totali</div>
            </div>
          </div>

          {/* Detraining */}
          {lev.daysInactive > 2 ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#F43F5E]/30 bg-[#F43F5E]/10 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-[#F43F5E] shrink-0" />
              <div className="text-[10px] leading-tight"><span className="font-black text-[#F43F5E] uppercase tracking-wide">Detraining</span> <span className="text-gray-400">fermo da {lev.daysInactive} giorni · </span><span className="font-bold text-[#F43F5E]" style={{ fontFamily: MONO }}>−{lev.dailyDecay} XP/giorno</span></div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#10B981]/25 bg-[#10B981]/10 px-3 py-2">
              <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
              <div className="text-[10px] text-gray-400">Forma protetta · {2 - lev.daysInactive} giorni di tolleranza rimasti</div>
            </div>
          )}
        </div>

        {/* Obiettivo */}
        <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-4">
          <div className="flex items-center gap-1.5 mb-2"><Target className="w-3.5 h-3.5 text-[#C0FF00]" /><span className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-400">Obiettivo</span></div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {GOALS.map((g) => (
              <button key={g.id} type="button" onClick={() => setGoalId(g.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide uppercase transition-colors ${goalId === g.id ? "bg-[#C0FF00]/15 text-[#C0FF00]" : "text-gray-400 hover:text-white bg-white/[0.03]"}`}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] mb-1"><span className="text-gray-500">verso {lev.goal.label}</span><span className="font-black tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{lev.goalPct}%</span></div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${lev.goalPct}%`, background: lev.nearGoal ? "linear-gradient(90deg,#F59E0B,#C0FF00)" : "linear-gradient(90deg,#C0FF00,#22D3EE)" }} /></div>
          <div className="text-[10px] mt-1.5" style={{ fontFamily: MONO }}>
            {lev.goalPct >= 100 ? <span className="text-[#C0FF00] font-black">🏆 Forma da obiettivo raggiunta!</span>
              : lev.nearGoal ? <span className="text-[#F59E0B] font-black">🔥 Sei vicinissimo! mancano {lev.xpToGoal.toLocaleString("it-IT")} XP</span>
              : <span className="text-gray-500">mancano {lev.xpToGoal.toLocaleString("it-IT")} XP</span>}
          </div>
          <div className="text-[9px] text-gray-600 mt-1.5 leading-snug">{lev.goal.hint}</div>
        </div>
      </div>

      {/* Adattamenti fisiologici (in basso) */}
      <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-auto rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-400">Adattamenti · composizione dello stimolo</span>
          <span className="text-[10px] font-black" style={{ fontFamily: MONO, color: lev.goalMatch >= 75 ? "#C0FF00" : lev.goalMatch >= 55 ? "#F59E0B" : "#F43F5E" }}>match obiettivo {lev.goalMatch}%</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AXES.map((a) => {
            const yours = lev.balance[a.k];
            const target = Math.round(lev.goal.w[a.k] * 100);
            const Icon = a.icon;
            return (
              <div key={a.k}>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide" style={{ color: a.color }}><Icon className="w-3 h-3" />{a.short}</span>
                  <span className="text-[10px] tabular-nums" style={{ fontFamily: MONO, color: "#fff" }}>{yours}%</span>
                </div>
                <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${yours}%`, background: a.color }} />
                  <div className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-white/80" style={{ left: `${target}%` }} title={`target ${target}%`} />
                </div>
                <div className="text-[9px] text-gray-600 mt-0.5">target {target}% · {a.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

const MODES: { id: Mode; label: string; icon: typeof Globe2 }[] = [
  { id: "equatore", label: "Equatore", icon: Globe2 },
  { id: "italia", label: "Strade d'Italia", icon: MapIcon },
  { id: "ascesa", label: "Ascesa", icon: TrendingUp },
];

export function GamificationV1() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const s = useMemo(() => computeGamiStats(runs), [runs]);
  const [mode, setMode] = useState<Mode>("equatore");
  const [goalId, setGoalId] = useState("5k-sub20");
  const [italy, setItaly] = useState<CumRoute | null>(null);
  useEffect(() => { fetch("/italy-route.json").then((r) => r.json()).then(setItaly).catch(() => {}); }, []);

  const eq = equatorJourney(s.totalKm);
  const lev = useMemo(() => computeLeveling(runs, goalId), [runs, goalId]);
  const pct = mode === "equatore" ? eq.pct : mode === "italia" && italy ? Math.min(100, (s.totalKm / italy.distance) * 100) : 0;

  const hudRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const c = gsap.context(() => gsap.from(".gw-hud", { opacity: 0, y: 14, duration: 0.5, ease: "power3.out" }), hudRef); return () => c.revert(); }, [mode]);

  return (
    <main className="flex-1 relative min-h-0 bg-black overflow-hidden">
      {mode === "equatore" && <EquatorMode totalKm={s.totalKm} />}
      {mode === "italia" && italy && <ItaliaMode totalKm={s.totalKm} route={italy} />}
      {mode === "ascesa" && <CityMap runs={runs} />}

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 30%, transparent 55%, rgba(0,0,0,0.8) 100%)" }} />

      {/* Selettore modalità */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 p-1.5 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl">
        {MODES.map((m) => {
          const sel = mode === m.id; const Icon = m.icon;
          return (
            <button key={m.id} type="button" onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black tracking-[0.12em] uppercase transition-colors ${sel ? "bg-[#C0FF00]/15 text-[#C0FF00]" : "text-gray-400 hover:text-white"}`}>
              <Icon className="w-3.5 h-3.5" />{m.label}
            </button>
          );
        })}
      </div>

      <div ref={hudRef} className="gw-hud">
        {mode === "ascesa" ? (
          <AscesaHud lev={lev} goalId={goalId} setGoalId={setGoalId} />
        ) : (
          <div className="absolute top-4 left-4 z-10 rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5 max-w-[300px]">
            <div className="flex items-center gap-2 mb-3">
              {mode === "equatore" ? <Globe2 className="w-5 h-5 text-[#22D3EE]" /> : <Navigation className="w-5 h-5 text-[#C0FF00]" />}
              <h1 className="text-lg font-black tracking-tight uppercase italic text-white">{mode === "equatore" ? <>Lungo l'<span className="text-[#22D3EE]">Equatore</span></> : <>Strade d'<span className="text-[#C0FF00]">Italia</span></>}</h1>
            </div>
            <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">Distanza percorsa</div>
            <div className="flex items-baseline gap-2"><span className="text-4xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{Math.round(s.totalKm).toLocaleString("it-IT")}</span><span className="text-sm text-gray-500">km</span></div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${LIT}, #22D3EE)` }} /></div>
            <div className="flex items-center justify-between mt-1.5 text-[10px]">
              <span className="text-gray-500">{mode === "equatore" ? "giro del pianeta" : `su ${italy ? Math.round(italy.distance).toLocaleString("it-IT") : "…"} km di strade vere`}</span>
              <span className="font-black tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{pct.toFixed(2)}%</span>
            </div>
            {mode === "italia" && <div className="text-[10px] text-gray-600 mt-2">Percorso reale: Roma → Napoli → Bari → … → Milano → Firenze → Roma</div>}
          </div>
        )}
      </div>
    </main>
  );
}
