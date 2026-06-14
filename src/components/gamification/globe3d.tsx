import { useMemo } from "react";
import * as THREE from "three";
import { buildRoute, routeLine, positionAtKm, type RouteStop } from "./gamiData";

/** lat/lng (gradi) → punto sulla sfera di raggio r (allineato a texture equirettangolare). */
export function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/** Dati del viaggio pronti per il rendering 3D. */
export function useJourney(totalKm: number, radius: number) {
  return useMemo(() => {
    const { stops, totalKm: loop } = buildRoute(totalKm);
    const traveledKm = loop > 0 ? totalKm % loop : totalKm;
    const lap = loop > 0 ? Math.floor(totalKm / loop) : 0;
    const litPts = routeLine(traveledKm).map(([lng, lat]) => latLngToVec3(lat, lng, radius * 1.012));
    const fullPts = routeLine(null).map(([lng, lat]) => latLngToVec3(lat, lng, radius * 1.008));
    const pos = positionAtKm(traveledKm);
    return { stops, traveledKm, lap, litPts, fullPts, current: pos };
  }, [totalKm, radius]);
}

/** Atmosfera fresnel (≈ scattering) come guscio additivo BackSide. */
export function Atmosphere({ radius, color, power = 3.0, opacity = 1 }: { radius: number; color: string; power?: number; opacity?: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uPow: { value: power }, uOp: { value: opacity } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vP=mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vP; uniform vec3 uColor; uniform float uPow; uniform float uOp;
      void main(){ vec3 v=normalize(-vP); float f=pow(1.0-max(dot(vN,v),0.0),uPow); gl_FragColor=vec4(uColor, f*uOp); }`,
  }), [color, power, opacity]);
  return <mesh scale={radius * 1.16}><sphereGeometry args={[1, 64, 64]} /><primitive object={mat} attach="material" /></mesh>;
}

/** Arco luminoso del tratto percorso (tube great-circle) + nucleo brillante. */
export function JourneyArc({ pts, color, tube = 0.012, radius = 2 }: { pts: THREE.Vector3[]; color: string; tube?: number; radius?: number }) {
  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, Math.min(800, pts.length * 4), tube * radius, 8, false);
  }, [pts, tube, radius]);
  if (!geo) return null;
  return (
    <>
      <mesh geometry={geo}><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh geometry={geo} scale={2.2}><meshBasicMaterial color={color} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
    </>
  );
}

/** Rotta intera, tenue (linea tratteggiata via punti). */
export function FullRoute({ pts, color }: { pts: THREE.Vector3[]; color: string }) {
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(pts), [pts]);
  return <primitive object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }))} />;
}

/** Nodi città: raggiunte accese, da raggiungere tenui. */
export function CityNodes({ stops, radius, litColor, dimColor = "#475569" }: { stops: RouteStop[]; radius: number; litColor: string; dimColor?: string }) {
  return (
    <>
      {stops.slice(0, -1).map((c, i) => {
        const p = latLngToVec3(c.lat, c.lng, radius * 1.015);
        return (
          <mesh key={i} position={p}>
            <sphereGeometry args={[c.reached ? radius * 0.022 : radius * 0.015, 12, 12]} />
            <meshBasicMaterial color={c.reached ? litColor : dimColor} toneMapped={false} transparent opacity={c.reached ? 1 : 0.6} />
          </mesh>
        );
      })}
    </>
  );
}

/** Pin posizione attuale: nucleo + alone pulsante (scala animata via parent). */
export function CurrentPin({ lat, lng, radius, color }: { lat: number; lng: number; radius: number; color: string }) {
  const p = latLngToVec3(lat, lng, radius * 1.02);
  return (
    <group position={p}>
      <mesh><sphereGeometry args={[radius * 0.03, 16, 16]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh><sphereGeometry args={[radius * 0.06, 16, 16]} /><meshBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
      <pointLight color={color} intensity={1.5} distance={radius * 2} />
    </group>
  );
}
