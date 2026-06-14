import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gsap } from "../celebrations/gsapSetup";
import { Radar, Navigation } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import { computeGamiStats, EARTH_CIRCUMFERENCE } from "./gamiData";
import { useJourney, JourneyArc, FullRoute, CityNodes, CurrentPin } from "./globe3d";

const MONO = "'JetBrains Mono', monospace";
const GRID = "#22D3EE";
const LIT = "#C0FF00";
const PIN = "#F472B6";
const R = 2;

/** Punti dati distribuiti sulla sfera (fibonacci) — texture "data globe". */
function DotSphere({ count = 1400 }: { count?: number }) {
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const off = 2 / count, inc = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = i * off - 1 + off / 2, r = Math.sqrt(1 - y * y), ph = i * inc;
      pos[i * 3] = Math.cos(ph) * r * R; pos[i * 3 + 1] = y * R; pos[i * 3 + 2] = Math.sin(ph) * r * R;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); return g;
  }, [count]);
  return <points geometry={geo}><pointsMaterial size={0.022} color={GRID} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation /></points>;
}

/** Anello di scansione orizzontale che spazza il globo dall'alto in basso. */
function ScanRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    const y = Math.sin(st.clock.elapsedTime * 0.6) * R;          // -R..R
    const rad = Math.sqrt(Math.max(0.0001, R * R - y * y));
    if (ref.current) { ref.current.position.y = y; ref.current.scale.set(rad, rad, rad); }
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1, 0.012, 8, 96]} />
      <meshBasicMaterial color={GRID} transparent opacity={0.8} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

function HoloScene({ totalKm }: { totalKm: number }) {
  const J = useJourney(totalKm, R);
  const grp = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (grp.current) grp.current.rotation.y += dt * 0.12; });
  return (
    <>
      <ambientLight intensity={0.6} />
      <ScanRing />
      <group ref={grp}>
        {/* sfera interna scura (occlude il lato lontano) */}
        <mesh><sphereGeometry args={[R * 0.985, 48, 48]} /><meshBasicMaterial color="#020617" /></mesh>
        {/* wireframe lat/long */}
        <mesh><sphereGeometry args={[R, 36, 24]} /><meshBasicMaterial color={GRID} wireframe transparent opacity={0.22} /></mesh>
        <DotSphere />
        <FullRoute pts={J.fullPts} color={GRID} />
        <JourneyArc pts={J.litPts} color={LIT} radius={R} tube={0.014} />
        <CityNodes stops={J.stops} radius={R} litColor={LIT} dimColor="#1e3a5f" />
        <CurrentPin lat={J.current.lat} lng={J.current.lng} radius={R} color={PIN} />
      </group>
      {/* alone esterno */}
      <mesh scale={R * 1.25}><sphereGeometry args={[1, 48, 48]} /><meshBasicMaterial color={GRID} transparent opacity={0.04} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    </>
  );
}

export function GamificationV3() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const s = useMemo(() => computeGamiStats(runs), [runs]);
  const J = useJourney(s.totalKm, R);
  const pct = (s.totalKm / EARTH_CIRCUMFERENCE) * 100;
  const lastReached = [...J.stops].reverse().find((x) => x.reached);
  const next = J.stops.find((x) => !x.reached);
  const reachedCount = J.stops.filter((x) => x.reached).length;

  const hudRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => gsap.from(".ho-hud > *", { opacity: 0, y: 18, duration: 0.6, stagger: 0.1, ease: "power3.out", delay: 0.3 }), hudRef);
    return () => ctx.revert();
  }, []);

  return (
    <main className="flex-1 relative min-h-0 overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 50%, #04141c 0%, #02060c 55%, #000 100%)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`, backgroundSize: "44px 44px" }} />
      <Canvas camera={{ position: [0, 1, 6], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <HoloScene totalKm={s.totalKm} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 45%, transparent 60%, rgba(0,0,0,0.72) 100%)" }} />

      <div ref={hudRef} className="ho-hud pointer-events-none absolute inset-0 p-4 md:p-8 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="pointer-events-auto rounded-2xl border border-[#22D3EE]/25 bg-black/55 backdrop-blur-xl p-5 max-w-[330px]" style={{ boxShadow: "0 0 30px -10px #22D3EE55" }}>
            <div className="flex items-center gap-2 mb-3"><Radar className="w-5 h-5 text-[#22D3EE]" /><h1 className="text-lg font-black tracking-tight uppercase italic text-white">Holo <span className="text-[#22D3EE]">Globe</span></h1></div>
            <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">// distanza tracciata</div>
            <div className="flex items-baseline gap-2"><span className="text-4xl font-black tabular-nums text-[#22D3EE]" style={{ fontFamily: MONO }}>{Math.round(s.totalKm).toLocaleString("it-IT")}</span><span className="text-sm text-gray-500">km</span></div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${LIT}, ${GRID})` }} /></div>
            <div className="flex items-center justify-between mt-1.5 text-[10px]"><span className="text-gray-500">orbita planetaria</span><span className="font-black tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{pct.toFixed(2)}%</span></div>
          </div>
          <div className="pointer-events-auto rounded-2xl border border-[#F472B6]/25 bg-black/55 backdrop-blur-xl px-4 py-3 text-right">
            <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500">// posizione</div>
            <div className="text-sm font-black text-[#F472B6] flex items-center gap-1.5 justify-end"><Navigation className="w-3.5 h-3.5" />{lastReached?.name ?? "Roma"}</div>
            {next && <div className="text-[10px] text-gray-500 mt-1">target: <span className="text-gray-300">{next.name}</span> · <span style={{ fontFamily: MONO }}>{Math.max(0, next.cumKm - J.traveledKm).toLocaleString("it-IT")} km</span></div>}
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.22em] uppercase text-gray-600">
          <span style={{ fontFamily: MONO }}>nodi {reachedCount}/{J.stops.length} · scansione attiva</span>
          <span>globo olografico · auto-rotazione</span>
        </div>
      </div>
    </main>
  );
}
