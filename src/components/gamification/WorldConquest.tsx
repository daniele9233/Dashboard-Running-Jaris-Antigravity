import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Check, Crown, Globe2, Lock, Route, Swords, X, type LucideIcon } from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import type { Run } from "../../types/api";
import { useAthleteVdot } from "./useAthleteVdot";
import { computeXpPace } from "./evolutionEngine";
import { ITALY_REGIONS, HOME_REGION_ID } from "./italyRegions";
import {
  CONTINENTS, COUNTRY_BY_ISO, TERRITORY_OF, flagOf, type BiomeId,
} from "./worldData";
import {
  buildWorld, RANGE_PER_LONG_KM, type CountryState, type CountryStatus, type Wonder, type WorldState,
} from "./worldEngine";
import { BRAND } from "../../theme/tokens";

const MONO = "'JetBrains Mono', monospace";
const LIME = BRAND;
const GOLD = "#FBBF24";
/** Prefisso degli id salvati nelle conquiste: le regioni italiane restano senza. */
export const WORLD_PREFIX = "w:";

const fmt = (n: number) => Math.round(n).toLocaleString("it-IT");

// ── i codici del tileset, territori compresi ─────────────────────────────────
const TERRITORIES: Record<string, string[]> = {};
for (const [t, owner] of Object.entries(TERRITORY_OF)) (TERRITORIES[owner] ??= []).push(t);
const codesOf = (iso: string) => [iso, ...(TERRITORIES[iso] ?? [])];

/** Solo la vista del mondo "internazionale": un confine conteso non va disegnato due volte. */
const WORLDVIEW = ["any", ["==", "all", ["get", "worldview"]], ["in", "US", ["get", "worldview"]]];

const STATUS_LABEL: Record<CountryStatus, string> = {
  home: "casa", owned: "tua", attackable: "attaccabile", poor: "servono XP", passport: "serve passaporto", range: "fuori gittata",
};

/** Colore e peso di ogni nazione sulla mappa, a seconda di come sta rispetto all'impero. */
function styleOf(s: CountryState, passportColor: Record<BiomeId, string>) {
  switch (s.status) {
    case "home": return { fill: GOLD, fo: 0.5, line: GOLD, lw: 1.4 };
    case "owned": return { fill: LIME, fo: 0.42, line: LIME, lw: 1.1 };
    case "attackable": return { fill: "#FFFFFF", fo: 0.16, line: "#FFFFFF", lw: 0.9 };
    case "poor": return { fill: "#B8B8B8", fo: 0.1, line: "#878787", lw: 0.6 };
    case "passport": return { fill: passportColor[s.country.biome], fo: 0.1, line: passportColor[s.country.biome], lw: 0.6 };
    default: return { fill: "#000000", fo: 0.01, line: "#1F2937", lw: 0.4 };
  }
}

/** Un'espressione `match` di Mapbox: gruppi di codici → valore. */
function matchBy<T extends string | number>(world: WorldState, pick: (s: CountryState) => T, fallback: T): unknown[] {
  const groups: Record<string, { value: T; codes: string[] }> = {};
  for (const s of world.countries) {
    const v = pick(s);
    const k = String(v);
    (groups[k] ??= { value: v, codes: [] }).codes.push(...codesOf(s.country.iso));
  }
  const out: unknown[] = ["match", ["get", "iso_3166_1"]];
  for (const g of Object.values(groups)) out.push(g.codes, g.value);
  out.push(fallback);
  return out;
}

interface Props {
  runs: Run[];
  /** Tutti gli id conquistati: regioni italiane e nazioni ("w:FR"). */
  conquered: Set<string>;
  onToggle: (id: string, conquer: boolean) => void;
  token: string;
}

export function WorldConquest({ runs, conquered, onToggle, token }: Props) {
  const vdot = useAthleteVdot();
  const pace = useMemo(() => computeXpPace(runs), [runs]);
  const owned = useMemo(
    () => new Set([...conquered].filter((id) => id.startsWith(WORLD_PREFIX)).map((id) => id.slice(WORLD_PREFIX.length))),
    [conquered],
  );
  const italyDone = useMemo(
    () => ITALY_REGIONS.filter((r) => r.id === HOME_REGION_ID || conquered.has(r.id)).length,
    [conquered],
  );
  const world = useMemo(
    () => buildWorld({ runs, totalXp: pace.totalXp, owned, vdot, italyRegions: { done: italyDone, total: ITALY_REGIONS.length } }),
    [runs, pace.totalXp, owned, vdot, italyDone],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [tab, setTab] = useState<"impero" | "fronte" | "meraviglie">("fronte");
  const [toast, setToast] = useState<{ iso: string; text: string } | null>(null);
  const mapRef = useRef<MapRef>(null);
  const toastRef = useRef<HTMLDivElement>(null);

  const passportColor = useMemo(
    () => Object.fromEntries(Object.values(world.passports).map((p) => [p.biome, p.color])) as Record<BiomeId, string>,
    [world.passports],
  );

  // ── i livelli della mappa ──
  const paint = useMemo(() => ({
    fill: {
      "fill-color": matchBy(world, (s) => styleOf(s, passportColor).fill, "#000000"),
      "fill-opacity": matchBy(world, (s) => styleOf(s, passportColor).fo, 0),
    },
    line: {
      "line-color": matchBy(world, (s) => styleOf(s, passportColor).line, "#1F2937"),
      "line-width": matchBy(world, (s) => styleOf(s, passportColor).lw, 0.3),
    },
  }), [world, passportColor]);

  const focusCodes = useMemo(() => [...new Set([hover, selected].filter(Boolean).flatMap((iso) => codesOf(iso!)))], [hover, selected]);

  const arcs = useMemo(() => ({
    type: "FeatureCollection",
    features: world.arcs.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } })),
  }), [world.arcs]);

  const capitals = useMemo(() => ({
    type: "FeatureCollection",
    features: world.countries
      .filter((s) => s.status === "owned" || s.status === "home" || s.status === "attackable")
      .map((s) => ({
        type: "Feature",
        properties: { kind: s.status === "attackable" ? "front" : "mine" },
        geometry: { type: "Point", coordinates: [s.country.lng, s.country.lat] },
      })),
  }), [world.countries]);

  // i riempimenti vanno sotto le etichette: altrimenti i nomi dei paesi
  // conquistati finiscono velati di lime. Il primo livello di testo dello stile
  // si trova solo a stile caricato, e i livelli si montano dopo.
  const [labelsFrom, setLabelsFrom] = useState<string | null>(null);

  const onLoad = (e: { target: { setFog: (f: unknown) => void; flyTo: (o: unknown) => void; getStyle: () => { layers?: { id: string; type: string }[] } } }) => {
    setLabelsFrom(e.target.getStyle().layers?.find((l) => l.type === "symbol")?.id ?? "");
    try {
      e.target.setFog({ color: "rgb(10,15,30)", "high-color": "rgb(30,55,100)", "horizon-blend": 0.08, "space-color": "rgb(2,4,10)", "star-intensity": 0.55 });
    } catch { /* stili senza nebbia */ }
    e.target.flyTo({ center: [18, 32], zoom: 1.9, duration: 2200, essential: true });
  };

  const select = (iso: string | null, fly = false) => {
    setSelected(iso);
    if (iso && fly) {
      const c = COUNTRY_BY_ISO[iso];
      const zoom = Math.max(mapRef.current?.getZoom() ?? 2, c.areaKm2 > 2e6 ? 2 : c.areaKm2 > 2e5 ? 3 : 4);
      mapRef.current?.flyTo({ center: [c.lng, c.lat], zoom, duration: 1400, essential: true });
    }
  };

  const conquer = (iso: string) => {
    const s = world.byIso[iso];
    if (!s || s.status !== "attackable") return;
    onToggle(WORLD_PREFIX + iso, true);
    setToast({ iso, text: `${s.country.name} è tua · −${fmt(s.cost)} XP` });
  };
  const release = (iso: string) => {
    if (world.byIso[iso]?.status !== "owned") return;
    onToggle(WORLD_PREFIX + iso, false);
  };

  useEffect(() => {
    if (!toast || !toastRef.current) return;
    const tl = gsap.timeline()
      .fromTo(toastRef.current, { y: -18, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" })
      .to(toastRef.current, { opacity: 0, y: -10, duration: 0.4, delay: 2.6, onComplete: () => setToast(null) });
    return () => { tl.kill(); };
  }, [toast]);

  const sel = selected ? world.byIso[selected] : null;

  return (
    <>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{ longitude: 18, latitude: 32, zoom: 1.4 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        projection={{ name: "globe" }}
        onLoad={onLoad as never}
        attributionControl={false}
        style={{ position: "absolute", inset: 0 }}
        interactiveLayerIds={["world-fill"]}
        cursor={hover ? "pointer" : "grab"}
        onMouseMove={(e) => {
          const code = e.features?.[0]?.properties?.iso_3166_1 as string | undefined;
          const iso = code ? TERRITORY_OF[code] ?? code : null;
          setHover(iso && COUNTRY_BY_ISO[iso] ? iso : null);
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const code = e.features?.[0]?.properties?.iso_3166_1 as string | undefined;
          const iso = code ? TERRITORY_OF[code] ?? code : null;
          select(iso && COUNTRY_BY_ISO[iso] ? iso : null);
        }}
      >
        {labelsFrom != null && <Source id="countries" type="vector" url="mapbox://mapbox.country-boundaries-v1">
          <Layer id="world-fill" type="fill" source-layer="country_boundaries" filter={WORLDVIEW as never} paint={paint.fill as never} beforeId={labelsFrom || undefined} />
          <Layer id="world-line" type="line" source-layer="country_boundaries" filter={WORLDVIEW as never} paint={paint.line as never} beforeId={labelsFrom || undefined} />
          <Layer id="world-focus" type="line" source-layer="country_boundaries"
            filter={["all", WORLDVIEW, ["in", ["get", "iso_3166_1"], ["literal", focusCodes]]] as never}
            paint={{ "line-color": "#FFFFFF", "line-width": 2.2 }} />
        </Source>}

        <Source id="empire-arcs" type="geojson" data={arcs as never}>
          <Layer id="empire-glow" type="line" paint={{ "line-color": LIME, "line-width": 6, "line-blur": 6, "line-opacity": 0.35 }} />
          <Layer id="empire-core" type="line" paint={{ "line-color": LIME, "line-width": 1.6, "line-opacity": 0.9 }} layout={{ "line-cap": "round" }} />
        </Source>

        <Source id="capitals" type="geojson" data={capitals as never}>
          <Layer id="capital-dots" type="circle" paint={{
            "circle-radius": ["match", ["get", "kind"], "mine", 3.5, 2.5] as never,
            "circle-color": ["match", ["get", "kind"], "mine", LIME, "#FFFFFF"] as never,
            "circle-stroke-color": "#050505", "circle-stroke-width": 1.5,
          }} />
        </Source>

        {world.wonders.map((w) => (
          <Marker key={w.def.id} longitude={w.def.lng} latitude={w.def.lat} anchor="center"
            onClick={(e) => { e.originalEvent.stopPropagation(); select(w.def.iso, true); }}>
            <div title={`${w.def.city} · ${w.def.title}`} className="grid place-items-center w-7 h-7 rounded-full text-[14px] cursor-pointer transition-transform hover:scale-110"
              style={{
                background: w.claimed ? `${GOLD}33` : "rgba(5,5,5,0.75)",
                border: `1.5px solid ${w.claimed ? GOLD : w.met ? "#FFFFFF" : "rgba(255,255,255,0.25)"}`,
                boxShadow: w.claimed ? `0 0 14px ${GOLD}aa` : "none",
                filter: w.met || w.claimed ? "none" : "grayscale(0.8) opacity(0.7)",
              }}>
              {w.def.emoji}
            </div>
          </Marker>
        ))}
      </Map>

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 30%, transparent 55%, rgba(0,0,0,0.8) 100%)" }} />

      {toast && (
        <div ref={toastRef} className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl border text-[12px] font-black text-white"
          style={{ borderColor: `${LIME}66`, background: "rgba(10,10,10,0.9)", boxShadow: `0 0 30px ${LIME}33`, fontFamily: MONO }}>
          <span className="inline-flex items-center gap-2"><Flag iso={toast.iso} size={20} />{toast.text}</span>
        </div>
      )}

      {/* HUD dell'impero: a sinistra da tablet in su */}
      <div className="hidden md:block absolute top-20 left-4 z-10 w-[300px] rounded-2xl border border-white/10 bg-black/65 backdrop-blur-xl p-4 overflow-y-auto" style={{ maxHeight: "calc(100% - 110px)" }}>
        <Empire world={world} />
      </div>

      {/* legenda della mappa */}
      <div className="hidden lg:flex absolute bottom-4 left-4 z-10 flex-wrap gap-x-3 gap-y-1 px-3 py-2 rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl text-[11px] text-gray-400">
        <LegendSwatch color={GOLD}>casa</LegendSwatch>
        <LegendSwatch color={LIME}>tuo</LegendSwatch>
        <LegendSwatch color="#FFFFFF">attaccabile</LegendSwatch>
        <LegendSwatch color="#878787">servono XP</LegendSwatch>
        <LegendSwatch color={passportColor.g}>serve un passaporto</LegendSwatch>
        <LegendSwatch color="#1F2937">fuori gittata</LegendSwatch>
      </div>

      {/* pannello: scheda della nazione, oppure fronte e meraviglie */}
      <div className="absolute z-20 inset-x-2 bottom-2 md:inset-x-auto md:bottom-auto md:top-20 md:right-4 md:w-[340px] rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl overflow-hidden flex flex-col max-h-[52%] md:max-h-[calc(100%-110px)]">
        {sel ? (
          <CountryCard s={sel} world={world} pace={pace} onClose={() => setSelected(null)} onConquer={conquer} onRelease={release} />
        ) : (
          <>
            <div className="flex shrink-0 border-b border-white/10">
              {([["impero", "Impero"], ["fronte", "Il fronte"], ["meraviglie", "Meraviglie"]] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setTab(id)}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${id === "impero" ? "md:hidden" : ""} ${tab === id ? "text-brand bg-white/[0.04]" : "text-gray-500 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto p-3">
              {tab === "impero" && <div className="md:hidden"><Empire world={world} /></div>}
              {(tab === "fronte" || (tab === "impero")) && <div className={tab === "impero" ? "hidden md:block" : ""}><Front world={world} onPick={(iso) => select(iso, true)} /></div>}
              {tab === "meraviglie" && <Wonders list={world.wonders} onPick={(iso) => select(iso, true)} />}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── l'impero ──────────────────────────────────────────────────────────────────
function Empire({ world }: { world: WorldState }) {
  const locked = Object.values(world.passports).filter((p) => p.biome !== "t");
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Globe2 className="w-5 h-5 text-brand" />
        <h1 className="text-lg font-black tracking-tight uppercase italic text-white">Conquista del <span className="text-brand">Mondo</span></h1>
      </div>
      <div className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">XP da spendere</div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black text-white" style={{ fontFamily: MONO }}>{fmt(world.availableXp)}</span>
        <span className="text-sm text-gray-500">XP</span>
      </div>
      <div className="text-[11px] text-gray-500 mt-1" style={{ fontFamily: MONO }}>
        {fmt(world.totalXp)} guadagnati · {fmt(world.spentXp)} spesi
        {world.discount > 0 && <span className="ml-1.5 font-black text-[#FBBF24]">sconto impero −{Math.round(world.discount * 100)}%</span>}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-gray-500">
        In Italia si marcia coi chilometri, il mondo si conquista con gli XP: le sedute di qualità valgono eserciti.
      </p>

      <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(world.owned / world.total) * 100}%`, background: `linear-gradient(90deg, ${GOLD}, ${LIME})` }} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[11px]">
        <span className="text-gray-500">nazioni conquistate</span>
        <span className="font-black text-brand" style={{ fontFamily: MONO }}>{world.owned}/{world.total}</span>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.22em] uppercase text-gray-400">
          <Route className="w-3 h-3 text-brand" />Gittata
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-white" style={{ fontFamily: MONO }}>{fmt(world.range)}</span>
          <span className="text-[11px] text-gray-500">km</span>
        </div>
        <p className="text-[11px] leading-snug text-gray-500">
          Il tuo lungo più lungo è {world.stats.longestKm.toLocaleString("it-IT", { maximumFractionDigits: 1 })} km: ogni km in più allunga il braccio di {RANGE_PER_LONG_KM} km.
        </p>
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-black tracking-[0.22em] uppercase text-gray-400 mb-2">Passaporti</div>
        <div className="grid grid-cols-2 gap-1.5">
          {locked.map((p) => (
            <div key={p.biome} className="rounded-lg border px-2.5 py-2" style={{ borderColor: p.unlocked ? `${p.color}55` : "rgba(255,255,255,0.08)", background: p.unlocked ? `${p.color}10` : "transparent" }}
              title={p.requirement}>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px]">{p.emoji}</span>
                <span className="text-[11px] font-black text-white/90 truncate">{p.name}</span>
                {p.unlocked ? <Check className="ml-auto w-3 h-3 shrink-0" style={{ color: p.color }} /> : <Lock className="ml-auto w-3 h-3 shrink-0 text-gray-600" />}
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${p.progress * 100}%`, background: p.color }} />
              </div>
              <div className="mt-1 text-[11px] text-gray-500 truncate" style={{ fontFamily: MONO }}>
                {fmt(p.value)}/{fmt(p.target)} {p.unit}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-black tracking-[0.22em] uppercase text-gray-400 mb-2">Continenti</div>
        <div className="space-y-1.5">
          {world.continents.map((c) => (
            <div key={c.id}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className={c.done ? "font-black text-brand" : "text-gray-300"}>{c.name}{c.done && " ✓"}</span>
                <span className="text-gray-500" style={{ fontFamily: MONO }}>{c.owned}/{c.total}</span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(c.owned / c.total) * 100}%`, background: c.done ? GOLD : LIME }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-gray-600">Ogni continente completato toglie il 10% a tutti i prezzi, ogni meraviglia il 3%.</p>
      </div>
    </div>
  );
}

// ── il fronte ─────────────────────────────────────────────────────────────────
function Front({ world, onPick }: { world: WorldState; onPick: (iso: string) => void }) {
  const byCost = (a: CountryState, b: CountryState) => a.cost - b.cost;
  const ready = world.countries.filter((s) => s.status === "attackable").sort(byCost);
  const poor = world.countries.filter((s) => s.status === "poor").sort(byCost).slice(0, 6);
  const gated = world.countries.filter((s) => s.status === "passport").sort(byCost).slice(0, 6);
  return (
    <div className="space-y-4">
      <FrontGroup title="Pronte da prendere" hint={`${ready.length}`} rows={ready} onPick={onPick} />
      {poor.length > 0 && <FrontGroup title="Servono più XP" rows={poor} onPick={onPick} />}
      {gated.length > 0 && <FrontGroup title="Serve un passaporto" rows={gated} onPick={onPick} world={world} />}
      {ready.length === 0 && poor.length === 0 && gated.length === 0 && (
        <p className="text-[11px] text-gray-500">Niente in gittata: allunga il lungo per raggiungere nuove capitali.</p>
      )}
    </div>
  );
}

function FrontGroup({ title, hint, rows, onPick, world }: { title: string; hint?: string; rows: CountryState[]; onPick: (iso: string) => void; world?: WorldState }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] font-black tracking-[0.22em] uppercase text-gray-400">{title}</span>
        {hint && <span className="text-[11px] text-gray-600" style={{ fontFamily: MONO }}>{hint}</span>}
      </div>
      <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
        {rows.map((s) => (
          <button key={s.country.iso} type="button" onClick={() => onPick(s.country.iso)}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-left">
            <Flag iso={s.country.iso} size={20} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-white/90 truncate">{s.country.name}</div>
              <div className="text-[11px] text-gray-500 truncate">
                {world ? `${world.passports[s.country.biome].emoji} ${world.passports[s.country.biome].name}` : `${fmt(s.distanceKm)} km da ${s.nearest?.capital ?? "casa"}`}
              </div>
            </div>
            <span className="text-[11px] font-black shrink-0" style={{ fontFamily: MONO, color: s.status === "attackable" ? LIME : "#B8B8B8" }}>{fmt(s.cost)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── le meraviglie ─────────────────────────────────────────────────────────────
function Wonders({ list, onPick }: { list: Wonder[]; onPick: (iso: string) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] leading-snug text-gray-500 mb-2">
        Le città delle grandi maratone, più Roma. Una meraviglia è tua quando tieni la nazione <b className="text-gray-300">e</b> hai fatto l'impresa.
      </p>
      {list.map((w) => (
        <button key={w.def.id} type="button" onClick={() => onPick(w.def.iso)}
          className="w-full text-left rounded-xl border px-3 py-2 transition-colors hover:bg-white/[0.04]"
          style={{ borderColor: w.claimed ? `${GOLD}66` : "rgba(255,255,255,0.08)", background: w.claimed ? `${GOLD}0d` : "transparent" }}>
          <div className="flex items-center gap-2">
            <span className="text-[16px]">{w.def.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black text-white/90 truncate">{w.def.city} · <span className="text-gray-400 font-bold">{w.def.title}</span></div>
              <div className="text-[11px] text-gray-500 truncate">{w.def.challenge}</div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded"
              style={w.claimed ? { color: "#0a0a0a", background: GOLD } : w.met ? { color: "#FFFFFF", background: "rgba(255,255,255,0.12)" } : { color: "#B8B8B8", background: "rgba(255,255,255,0.05)" }}>
              {w.claimed ? "tua" : w.met ? `prendi ${COUNTRY_BY_ISO[w.def.iso].name}` : "in corso"}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${w.progress * 100}%`, background: w.met ? GOLD : "#B8B8B8" }} />
            </div>
            <span className="text-[11px] text-gray-500 shrink-0" style={{ fontFamily: MONO }}>{w.status}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── la scheda della nazione ───────────────────────────────────────────────────
function CountryCard({ s, world, pace, onClose, onConquer, onRelease }: {
  s: CountryState; world: WorldState; pace: { perDay: number; perSession: number };
  onClose: () => void; onConquer: (iso: string) => void; onRelease: (iso: string) => void;
}) {
  const c = s.country;
  const passport = world.passports[c.biome];
  const wonder = world.wonders.filter((w) => w.def.iso === c.iso);
  const sessions = pace.perSession > 0 ? Math.max(1, Math.ceil(s.missingXp / pace.perSession)) : null;
  return (
    <div className="overflow-y-auto">
      <div className="relative p-4 border-b border-white/10" style={{ background: `radial-gradient(120% 140% at 0% 0%, ${s.status === "owned" || s.status === "home" ? LIME : "#ffffff"}14, transparent 60%)` }}>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="absolute top-3 right-3 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        <div className="flex items-center gap-3">
          <Flag iso={c.iso} size={48} />
          <div className="min-w-0">
            <div className="text-lg font-black text-white leading-tight truncate">{c.name}</div>
            <div className="text-[11px] text-gray-400 truncate">{c.capital} · {CONTINENTS[c.continent].name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Chip color={passport.color}>{passport.emoji} {passport.name}</Chip>
              <Chip color={s.status === "attackable" ? LIME : s.status === "owned" || s.status === "home" ? GOLD : "#B8B8B8"}>{STATUS_LABEL[s.status]}</Chip>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {s.status !== "home" && (
          <div className="grid grid-cols-2 gap-2">
            <Fact label="Costo" value={`${fmt(s.cost)} XP`} />
            <Fact label="Distanza" value={`${fmt(s.distanceKm)} km`} sub={s.nearest ? `da ${s.nearest.capital}` : undefined} />
          </div>
        )}

        {s.status === "home" && <Note icon={Crown} color={GOLD}>La tua base. Da qui parte ogni rotta dell'impero.</Note>}
        {s.status === "owned" && (
          <>
            <Note icon={Check} color={LIME}>Nel tuo impero.</Note>
            <button type="button" onClick={() => onRelease(c.iso)}
              className="w-full py-2 rounded-xl border border-white/15 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:bg-white/5">
              Rilascia · +{fmt(s.cost)} XP
            </button>
          </>
        )}
        {s.status === "attackable" && (
          <button type="button" onClick={() => onConquer(c.iso)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.02] active:scale-95"
            style={{ background: LIME, boxShadow: `0 0 24px ${LIME}55` }}>
            <Swords className="w-4 h-4" />Conquista · {fmt(s.cost)} XP
          </button>
        )}
        {s.status === "poor" && (
          <Note icon={Lock} color="#B8B8B8">
            Ti mancano <b className="text-white">{fmt(s.missingXp)} XP</b>{sessions != null && <> — circa <b className="text-white">{sessions} {sessions === 1 ? "seduta" : "sedute"}</b> al tuo ritmo</>}.
          </Note>
        )}
        {s.status === "passport" && (
          <div className="rounded-xl border p-3" style={{ borderColor: `${passport.color}44`, background: `${passport.color}0d` }}>
            <div className="text-[11px] text-gray-300 leading-snug">
              Serve il passaporto <b className="text-white">{passport.emoji} {passport.name}</b>: {passport.requirement}.
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${passport.progress * 100}%`, background: passport.color }} />
            </div>
            <div className="mt-1 text-[11px] text-gray-400" style={{ fontFamily: MONO }}>{fmt(passport.value)}/{fmt(passport.target)} {passport.unit}</div>
          </div>
        )}
        {s.status === "range" && (
          <Note icon={Route} color="#B8B8B8">
            Fuori gittata: <b className="text-white">{fmt(s.distanceKm)} km</b> dalla tua capitale più vicina, la gittata è {fmt(world.range)} km.{" "}
            {s.longRunNeeded <= 42
              ? <>Un lungo da <b className="text-white">{s.longRunNeeded} km</b> la apre — oppure conquista una capitale più vicina.</>
              : <>Nessun lungo arriva così lontano: ci si arriva di capitale in capitale, allargando il fronte.</>}
          </Note>
        )}

        {wonder.map((w) => (
          <div key={w.def.id} className="rounded-xl border p-3" style={{ borderColor: w.claimed ? `${GOLD}66` : "rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[18px]">{w.def.emoji}</span>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-white">Meraviglia · {w.def.city}</div>
                <div className="text-[11px] text-gray-400">{w.def.title}: {w.def.challenge}</div>
              </div>
            </div>
            <div className="mt-2 text-[11px]" style={{ fontFamily: MONO, color: w.claimed ? GOLD : w.met ? "#FFFFFF" : "#B8B8B8" }}>
              {w.claimed ? "tua: −3% su tutti i prezzi" : w.met ? "impresa fatta: conquista la nazione per prenderla" : w.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * La bandiera come immagine. Le bandiere emoji sono lettere-regione che Windows
 * non disegna: al loro posto comparirebbe "FR". Se l'immagine non arriva si
 * torna all'emoji, che almeno su macOS e telefoni è una bandiera.
 */
function Flag({ iso, size }: { iso: string; size: number }) {
  const [broken, setBroken] = useState(false);
  const h = Math.round(size * 0.68);
  if (broken) return <span className="shrink-0 leading-none" style={{ fontSize: h }}>{flagOf(iso)}</span>;
  return (
    <img src={`https://flagcdn.com/w80/${iso.toLowerCase()}.png`} alt="" width={size} height={h} loading="lazy"
      onError={() => setBroken(true)}
      className="shrink-0 rounded-[3px] object-cover ring-1 ring-white/15" style={{ width: size, height: h }} />
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-500">{label}</div>
      <div className="text-[14px] font-black text-white" style={{ fontFamily: MONO }}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 truncate">{sub}</div>}
    </div>
  );
}

function Note({ icon: Icon, color, children }: { icon: LucideIcon; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] leading-snug text-gray-300" style={{ borderColor: `${color}33`, background: `${color}0a` }}>
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color }} />
      <span>{children}</span>
    </div>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide" style={{ color, background: `${color}1a` }}>
      {children}
    </span>
  );
}

function LegendSwatch({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm border border-white/20" style={{ background: color }} />{children}
    </span>
  );
}
