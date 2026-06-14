import { Suspense, useMemo, useRef, useEffect, Component, type ReactNode } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Stars, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "../celebrations/gsapSetup";
import { Globe2, Navigation } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import { computeGamiStats, EARTH_CIRCUMFERENCE } from "./gamiData";
import { useJourney, Atmosphere, JourneyArc, FullRoute, CityNodes, CurrentPin } from "./globe3d";

const MONO = "'JetBrains Mono', monospace";
const LIT = "#C0FF00";
const PIN = "#22D3EE";
const R = 2;
const TEX = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets";

class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

function SolidEarth() {
  return <mesh><sphereGeometry args={[R, 64, 64]} /><meshStandardMaterial color="#1d4ed8" roughness={0.9} metalness={0.1} /></mesh>;
}

function TexturedEarth() {
  const [day, normal, spec, clouds] = useLoader(THREE.TextureLoader, [
    `${TEX}/earth_atmos_2048.jpg`, `${TEX}/earth_normal_2048.jpg`, `${TEX}/earth_specular_2048.jpg`, `${TEX}/earth_clouds_1024.png`,
  ]);
  const cloudsRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (cloudsRef.current) cloudsRef.current.rotation.y += dt * 0.012; });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[R, 96, 96]} />
        <meshStandardMaterial map={day} normalMap={normal} roughnessMap={spec} metalness={0.12} roughness={0.92} normalScale={new THREE.Vector2(0.85, 0.85)} />
      </mesh>
      <mesh ref={cloudsRef} scale={1.012}>
        <sphereGeometry args={[R, 64, 64]} />
        <meshStandardMaterial alphaMap={clouds} color="#ffffff" transparent opacity={0.55} depthWrite={false} roughness={1} />
      </mesh>
    </group>
  );
}

function EarthScene({ totalKm }: { totalKm: number }) {
  const J = useJourney(totalKm, R);
  const grp = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Group>(null);
  useFrame((st, dt) => {
    if (grp.current) grp.current.rotation.y += dt * 0.03;
    if (halo.current) { const s = 1 + Math.sin(st.clock.elapsedTime * 2) * 0.18; halo.current.scale.setScalar(s); }
  });
  return (
    <>
      <Stars radius={300} depth={80} count={5000} factor={4} saturation={0} fade speed={0.3} />
      <ambientLight intensity={0.14} />
      <directionalLight position={[6, 3, 5]} intensity={2.4} color="#FFF6E8" />
      <group ref={grp}>
        <Suspense fallback={<SolidEarth />}>
          <GLBoundary fallback={<SolidEarth />}><TexturedEarth /></GLBoundary>
        </Suspense>
        <FullRoute pts={J.fullPts} color="#475569" />
        <JourneyArc pts={J.litPts} color={LIT} radius={R} />
        <CityNodes stops={J.stops} radius={R} litColor={LIT} />
        <CurrentPin lat={J.current.lat} lng={J.current.lng} radius={R} color={PIN} />
      </group>
      <Atmosphere radius={R} color="#3B82F6" power={3.2} />
    </>
  );
}

export function GamificationV2() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const s = useMemo(() => computeGamiStats(runs), [runs]);
  const J = useJourney(s.totalKm, R);
  const pct = (s.totalKm / EARTH_CIRCUMFERENCE) * 100;
  const lastReached = [...J.stops].reverse().find((x) => x.reached);
  const next = J.stops.find((x) => !x.reached);

  const hudRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => gsap.from(".bl-hud > *", { opacity: 0, y: 18, duration: 0.6, stagger: 0.1, ease: "power3.out", delay: 0.3 }), hudRef);
    return () => ctx.revert();
  }, []);

  return (
    <main className="flex-1 relative min-h-0 overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 45%, #0a1530 0%, #050a18 55%, #000 100%)" }}>
      <Canvas camera={{ position: [0, 1.5, 6], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }}>
        <EarthScene totalKm={s.totalKm} />
        <OrbitControls enablePan={false} enableZoom autoRotate={false} minDistance={3.2} maxDistance={12} rotateSpeed={0.5} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 58%, rgba(0,0,0,0.72) 100%)" }} />

      <div ref={hudRef} className="bl-hud pointer-events-none absolute inset-0 p-4 md:p-8 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-5 max-w-[320px]">
            <div className="flex items-center gap-2 mb-3"><Globe2 className="w-5 h-5 text-[#22D3EE]" /><h1 className="text-lg font-black tracking-tight uppercase italic text-white">Blue <span className="text-[#22D3EE]">Marble</span></h1></div>
            <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">Distanza percorsa</div>
            <div className="flex items-baseline gap-2"><span className="text-4xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{Math.round(s.totalKm).toLocaleString("it-IT")}</span><span className="text-sm text-gray-500">km</span></div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${LIT}, ${PIN})` }} /></div>
            <div className="flex items-center justify-between mt-1.5 text-[10px]"><span className="text-gray-500">giro del pianeta</span><span className="font-black tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{pct.toFixed(2)}%</span></div>
            {J.lap > 0 && <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-[#C0FF00]">🌍 {J.lap}° giro completato</div>}
          </div>
          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl px-4 py-3 text-right">
            <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500">Sei a</div>
            <div className="text-sm font-black text-[#22D3EE] flex items-center gap-1.5 justify-end"><Navigation className="w-3.5 h-3.5" />{lastReached?.name ?? "Roma"}</div>
            {next && <div className="text-[10px] text-gray-500 mt-1">prossima: <span className="text-gray-300">{next.name}</span> · <span style={{ fontFamily: MONO }}>{Math.max(0, next.cumKm - J.traveledKm).toLocaleString("it-IT")} km</span></div>}
          </div>
        </div>
        <div className="text-center text-[10px] font-bold tracking-[0.25em] uppercase text-gray-600">Terra fotorealistica · trascina per ruotare · scroll per zoom</div>
      </div>
    </main>
  );
}
