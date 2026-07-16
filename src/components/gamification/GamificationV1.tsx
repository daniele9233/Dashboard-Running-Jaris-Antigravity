import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Map, { Source, Layer, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { gsap } from "../celebrations/gsapSetup";
import { Globe2, Map as MapIcon, Dna, Crown, Check, Lock, Swords } from "lucide-react";
import { useApi, invalidateCache } from "../../hooks/useApi";
import { getRuns, getProfile, getConquests, putConquest, type ConquestsResponse } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse, Profile } from "../../types/api";
import { computeGamiStats, equatorJourney } from "./gamiData";
import { ITALY_REGIONS, regionCostKm, HOME_REGION_ID } from "./italyRegions";
import { AthleteEvolutionFramework } from "./AthleteEvolutionFramework";

const MONO = "'JetBrains Mono', monospace";
const LIT = "#C0FF00";
const GOLD = "#FBBF24";
const TOKEN = "pk.eyJ1Ijoia2lra29kZXJpc28iLCJhIjoiY21uYWszMTIxMGp3NzJzc2JraDhwbTU5ayJ9.-60pgYn_BXERAHA7AqVgqA";

type Mode = "equatore" | "italia" | "evolution";
type LoadedMap = { setProjection: (p: unknown) => void; setFog: (f: unknown) => void; flyTo: (o: unknown) => void; setConfigProperty?: (a: string, b: string, c: unknown) => void };
const line = (coords: [number, number][]) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }) as const;

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

// ══ MODALITÀ CONQUISTA D'ITALIA ═══════════════════════════════════════════════
type RegionCalc = { id: string; region: string; capital: string; lat: number; lng: number; cost: number };

function ItaliaMode({ totalKm, conquered, onToggle }: { totalKm: number; conquered: Set<string>; onToggle: (id: string, conquer: boolean) => void }) {
  const { t } = useTranslation();
  const regions = useMemo<RegionCalc[]>(
    () => ITALY_REGIONS.map((r) => ({ ...r, cost: regionCostKm(r) })).sort((a, b) => a.cost - b.cost),
    [],
  );
  const spent = useMemo(() => regions.reduce((s, r) => s + (conquered.has(r.id) && r.id !== HOME_REGION_ID ? r.cost : 0), 0), [regions, conquered]);
  const available = Math.max(0, totalKm - spent);
  const nConq = regions.filter((r) => conquered.has(r.id) || r.id === HOME_REGION_ID).length;

  const onLoad = (e: { target: LoadedMap }) => { e.target.flyTo({ center: [12.5, 42.0], zoom: 5.1, duration: 1800, essential: true }); };

  const stateOf = (r: RegionCalc): "home" | "conquered" | "affordable" | "locked" => {
    if (r.id === HOME_REGION_ID) return "home";
    if (conquered.has(r.id)) return "conquered";
    return available >= r.cost ? "affordable" : "locked";
  };

  return (
    <>
      <Map mapboxAccessToken={TOKEN} initialViewState={{ longitude: 12.5, latitude: 42.0, zoom: 5 }}
        mapStyle="mapbox://styles/mapbox/dark-v11" onLoad={onLoad as never} attributionControl={false} style={{ position: "absolute", inset: 0 }}>
        {regions.map((r) => {
          const st = stateOf(r);
          const col = st === "home" ? GOLD : st === "conquered" ? LIT : st === "affordable" ? "#FFFFFF" : "#64748B";
          const clickable = st === "affordable";
          return (
            <Marker key={r.id} longitude={r.lng} latitude={r.lat} anchor="center"
              onClick={clickable ? () => onToggle(r.id, true) : undefined}>
              <div className="relative grid place-items-center" style={{ cursor: clickable ? "pointer" : "default" }} title={`${r.region} · ${r.capital} · ${r.cost} km`}>
                {(st === "home" || st === "affordable") && <span className="absolute w-6 h-6 rounded-full animate-ping" style={{ background: col + "44" }} />}
                <span className="relative grid place-items-center rounded-full border-2 border-white/80"
                  style={{ width: st === "locked" ? 10 : 16, height: st === "locked" ? 10 : 16, background: col, boxShadow: st === "locked" ? "none" : `0 0 14px ${col}` }}>
                  {st === "conquered" && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3.5} />}
                  {st === "home" && <Crown className="w-2.5 h-2.5 text-black" strokeWidth={2.5} />}
                </span>
              </div>
            </Marker>
          );
        })}
      </Map>

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 30%, transparent 55%, rgba(0,0,0,0.82) 100%)" }} />

      {/* HUD — km disponibili + progresso conquiste */}
      <div className="gw-hud absolute top-20 left-4 z-10 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-5 w-[290px] max-w-[80vw]">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="w-5 h-5 text-[#C0FF00]" />
          <h1 className="text-lg font-black tracking-tight uppercase italic text-white">Conquista d'<span className="text-[#C0FF00]">Italia</span></h1>
        </div>
        <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">{t("gami.kmAvailable")}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{Math.round(available).toLocaleString("it-IT")}</span>
          <span className="text-sm text-gray-500">km</span>
        </div>
        <div className="text-[10px] text-gray-600 mt-1" style={{ fontFamily: MONO }}>
          {t("gami.traveledSpent", { traveled: Math.round(totalKm).toLocaleString("it-IT"), spent: Math.round(spent).toLocaleString("it-IT") })}
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${(nConq / regions.length) * 100}%`, background: `linear-gradient(90deg, ${GOLD}, ${LIT})` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px]">
          <span className="text-gray-500">{t("gami.regionsConquered")}</span>
          <span className="font-black tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{nConq}/{regions.length}</span>
        </div>
      </div>

      {/* TABELLA regioni — conquista / rilascia */}
      <div className="absolute top-20 right-4 z-10 w-[300px] max-w-[84vw] rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 140px)" }}>
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white/90">{t("gami.regions")}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-widest">{t("gami.costFromRome")}</span>
        </div>
        <div className="overflow-y-auto">
          {regions.map((r) => {
            const st = stateOf(r);
            const deficit = Math.max(0, r.cost - available);
            return (
              <div key={r.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/5 last:border-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st === "home" ? GOLD : st === "conquered" ? LIT : st === "affordable" ? "#fff" : "#475569" }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-white/90 truncate">{r.region}</div>
                  <div className="text-[9px] text-gray-500" style={{ fontFamily: MONO }}>{r.capital} · {r.cost.toLocaleString("it-IT")} km</div>
                </div>
                {st === "home" ? (
                  <span className="text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded-md shrink-0" style={{ color: GOLD, background: GOLD + "1f" }}>🏠 {t("gami.base")}</span>
                ) : st === "conquered" ? (
                  <button type="button" onClick={() => onToggle(r.id, false)} title="Rilascia"
                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded-md shrink-0 transition-colors hover:bg-white/10" style={{ color: LIT, background: LIT + "1f" }}>
                    <Check className="w-3 h-3" />{t("gami.taken")}
                  </button>
                ) : st === "affordable" ? (
                  <button type="button" onClick={() => onToggle(r.id, true)}
                    className="text-[9px] font-black uppercase tracking-wide px-2.5 py-1 rounded-md shrink-0 text-black transition-transform hover:scale-105" style={{ background: LIT }}>
                    {t("gami.conquer")}
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] font-black tabular-nums px-2 py-1 rounded-md shrink-0 text-gray-500 bg-white/5" style={{ fontFamily: MONO }} title={`Ti mancano ${deficit} km`}>
                    <Lock className="w-2.5 h-2.5" />−{deficit.toLocaleString("it-IT")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

const MODES: { id: Mode; labelKey: string; icon: typeof Globe2 }[] = [
  { id: "evolution", labelKey: "gami.modeEvolution", icon: Dna },
  { id: "equatore", labelKey: "gami.modeEquator", icon: Globe2 },
  { id: "italia", labelKey: "gami.modeConquest", icon: MapIcon },
];

export function GamificationV1() {
  const { t } = useTranslation();
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const { data: profile } = useApi<Profile>(getProfile, { cacheKey: API_CACHE.PROFILE });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const s = useMemo(() => computeGamiStats(runs), [runs]);
  const [mode, setMode] = useState<Mode>("evolution");

  // Conquiste (persistenti su DB)
  const { data: conquestsData } = useApi<ConquestsResponse>(getConquests, { cacheKey: "conquests" });
  const [conquered, setConquered] = useState<Set<string>>(new Set());
  useEffect(() => { if (conquestsData?.conquered) setConquered(new Set(conquestsData.conquered)); }, [conquestsData]);
  const toggleConquest = (id: string, conquer: boolean) => {
    setConquered((prev) => { const next = new Set(prev); if (conquer) next.add(id); else next.delete(id); return next; });
    putConquest(id, conquer ? "conquer" : "release")
      .then((res) => { if (res?.conquered) setConquered(new Set(res.conquered)); invalidateCache("conquests"); })
      .catch(() => { /* l'ottimistico resta */ });
  };

  const eq = equatorJourney(s.totalKm);

  const hudRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const c = gsap.context(() => gsap.from(".gw-hud", { opacity: 0, y: 14, duration: 0.5, ease: "power3.out" }), hudRef); return () => c.revert(); }, [mode]);

  return (
    <main className="flex-1 relative min-h-0 bg-black overflow-hidden">
      {mode === "evolution" ? (
        <div className="absolute inset-0 overflow-y-auto">
          <AthleteEvolutionFramework runs={runs} profile={profile ?? null} />
        </div>
      ) : mode === "italia" ? (
        <div ref={hudRef}>
          <ItaliaMode totalKm={s.totalKm} conquered={conquered} onToggle={toggleConquest} />
        </div>
      ) : (
        <>
          <EquatorMode totalKm={s.totalKm} />
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 30%, transparent 55%, rgba(0,0,0,0.8) 100%)" }} />
          <div ref={hudRef} className="gw-hud">
            <div className="absolute top-20 left-4 z-10 rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5 max-w-[300px]">
              <div className="flex items-center gap-2 mb-3">
                <Globe2 className="w-5 h-5 text-[#22D3EE]" />
                <h1 className="text-lg font-black tracking-tight uppercase italic text-white">Lungo l'<span className="text-[#22D3EE]">Equatore</span></h1>
              </div>
              <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">{t("gami.distanceTraveled")}</div>
              <div className="flex items-baseline gap-2"><span className="text-4xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{Math.round(s.totalKm).toLocaleString("it-IT")}</span><span className="text-sm text-gray-500">km</span></div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, eq.pct)}%`, background: `linear-gradient(90deg, ${LIT}, #22D3EE)` }} /></div>
              <div className="flex items-center justify-between mt-1.5 text-[10px]">
                <span className="text-gray-500">{t("gami.planetLap")}</span>
                <span className="font-black tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{eq.pct.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Selettore modalità */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex gap-1.5 p-1.5 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl">
        {MODES.map((m) => {
          const sel = mode === m.id; const Icon = m.icon;
          return (
            <button key={m.id} type="button" onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black tracking-[0.12em] uppercase transition-colors ${sel ? "bg-[#C0FF00]/15 text-[#C0FF00]" : "text-gray-400 hover:text-white"}`}>
              <Icon className="w-3.5 h-3.5" />{t(m.labelKey)}
            </button>
          );
        })}
      </div>
    </main>
  );
}
