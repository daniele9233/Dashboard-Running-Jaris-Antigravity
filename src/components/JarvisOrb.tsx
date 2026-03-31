import { useEffect, useRef } from 'react';
import {
  WebGLRenderer, Scene, PerspectiveCamera,
  BufferGeometry, BufferAttribute, PointsMaterial, Points,
  LineBasicMaterial, LineSegments, AdditiveBlending,
  Color, Clock,
} from 'three';
import type { OrbState } from '../types/jarvis';

interface JarvisOrbProps {
  state: OrbState;
  analyser: AnalyserNode | null;
}

const COLOR_LIME = new Color(0xC0FF00);   // idle / listening
const COLOR_TEAL = new Color(0x00FFAA);   // thinking / speaking

const N = 2000;
const MAX_LINES = 6000;

export function JarvisOrb({ state, analyser }: JarvisOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbState>(state);
  const analyserRef = useRef<AnalyserNode | null>(analyser);

  // Keep refs in sync with props
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { analyserRef.current = analyser; }, [analyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;
    let animId = 0;

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new Scene();
    const camera = new PerspectiveCamera(45, (canvas.clientWidth || window.innerWidth) / (canvas.clientHeight || window.innerHeight), 1, 1000);
    camera.position.z = 80;

    // ── Particles ──────────────────────────────────────────────────────────
    const geo = new BufferGeometry();
    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    const phase = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.pow(Math.random(), 0.5) * 25;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      phase[i] = Math.random() * 1000;
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));

    const mat = new PointsMaterial({
      color: COLOR_LIME,
      size: 0.4,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const points = new Points(geo, mat);
    scene.add(points);

    // ── Lines ───────────────────────────────────────────────────────────────
    const linePos = new Float32Array(MAX_LINES * 6);
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute('position', new BufferAttribute(linePos, 3));
    lineGeo.setDrawRange(0, 0);

    const lineMat = new LineBasicMaterial({
      color: COLOR_LIME,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const lines = new LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // ── Animation state ─────────────────────────────────────────────────────
    let targetRadius = 25, currentRadius = 25;
    let targetSpeed = 0.3, currentSpeed = 0.3;
    let targetBright = 0.6, currentBright = 0.6;
    let targetSize = 0.4, currentSize = 0.4;
    let lineAmount = 0, targetLineAmount = 0;
    let spinX = 0, spinY = 0;
    let transitionEnergy = 0;
    let lastState: OrbState = 'idle';
    let freqData = new Uint8Array(64);

    const clock = new Clock();

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

    function animate() {
      if (destroyed) return;
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const s = stateRef.current;

      // Per-state targets
      switch (s) {
        case 'idle':
          targetRadius = 28; targetSpeed = 0.2; targetBright = 0.5; targetSize = 0.35; targetLineAmount = 0.1; break;
        case 'listening':
          targetRadius = 22; targetSpeed = 0.35; targetBright = 0.7; targetSize = 0.42; targetLineAmount = 0.45; break;
        case 'thinking':
          targetRadius = 16; targetSpeed = 0.55; targetBright = 0.75; targetSize = 0.32; targetLineAmount = 1.0; break;
        case 'speaking':
          targetRadius = 20; targetSpeed = 0.25; targetBright = 0.75; targetSize = 0.42; targetLineAmount = 0.75; break;
        case 'navigating':
          targetRadius = 18; targetSpeed = 0.8; targetBright = 0.9; targetSize = 0.5; targetLineAmount = 1.0; break;
      }

      currentRadius = lerp(currentRadius, targetRadius, 0.025);
      currentSpeed  = lerp(currentSpeed,  targetSpeed,  0.025);
      currentBright = lerp(currentBright, targetBright, 0.025);
      currentSize   = lerp(currentSize,   targetSize,   0.025);
      lineAmount    = lerp(lineAmount,    targetLineAmount, 0.025);

      // Transition tumble
      if (s !== lastState) { transitionEnergy = 1.0; lastState = s; }
      transitionEnergy *= 0.985;
      if (transitionEnergy > 0.05) {
        spinX += transitionEnergy * 0.012 * Math.sin(t * 1.7);
        spinY += transitionEnergy * 0.015;
      }

      // Audio
      let bass = 0;
      const an = analyserRef.current;
      if (an) {
        if (freqData.length !== an.frequencyBinCount) freqData = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < 8; i++) sum += freqData[i];
        bass = sum / (8 * 255);
      }

      // Add pseudo bass for idle breathing or navigating high energy
      let pseudoBass = 0;
      if (s === 'idle') {
        pseudoBass = (Math.sin(t * 0.8) * Math.sin(t * 1.3) + 1) * 0.03 + (Math.random() * 0.015);
      } else if (s === 'navigating') {
        pseudoBass = 0.15 + (Math.random() * 0.1);
      }
      bass = Math.max(bass, pseudoBass);

      // Color lerp
      if (s === 'navigating') {
        // Fast color cycling: green -> yellow -> orange -> red -> purple
        const h = (t * 0.8) % 1;
        const colorDyn = new Color().setHSL(h, 1, 0.5);
        mat.color.lerp(colorDyn, 0.1);
        lineMat.color.lerp(colorDyn, 0.1);
      } else {
        const targetColor = (s === 'thinking' || s === 'speaking') ? COLOR_TEAL : COLOR_LIME;
        mat.color.lerp(targetColor, 0.02);
        lineMat.color.lerp(targetColor, 0.02);
      }

      // Particle update
      const p = geo.getAttribute('position') as BufferAttribute;
      const a = p.array as Float32Array;

      for (let i = 0; i < N; i++) {
        const i3 = i * 3;
        const x = a[i3], y = a[i3 + 1], z = a[i3 + 2];
        const px = phase[i];

        vel[i3]     += Math.sin(t * 0.05 + px) * 0.001 * currentSpeed;
        vel[i3 + 1] += Math.cos(t * 0.06 + px * 1.3) * 0.001 * currentSpeed;
        vel[i3 + 2] += Math.sin(t * 0.055 + px * 0.7) * 0.001 * currentSpeed;

        const dist = Math.sqrt(x * x + y * y + z * z) || 0.01;
        const pull = Math.max(0, dist - currentRadius) * 0.002 + 0.0003;
        vel[i3]     -= (x / dist) * pull;
        vel[i3 + 1] -= (y / dist) * pull;
        vel[i3 + 2] -= (z / dist) * pull;

        if (bass > 0.04) {
          vel[i3]     += (x / dist) * bass * 0.018;
          vel[i3 + 1] += (y / dist) * bass * 0.018;
          vel[i3 + 2] += (z / dist) * bass * 0.018;
        }

        vel[i3] *= 0.992; vel[i3 + 1] *= 0.992; vel[i3 + 2] *= 0.992;
        a[i3] += vel[i3]; a[i3 + 1] += vel[i3 + 1]; a[i3 + 2] += vel[i3 + 2];
      }
      p.needsUpdate = true;

      // Lines
      if (lineAmount > 0.01) {
        const lp = lineGeo.getAttribute('position') as BufferAttribute;
        const la = lp.array as Float32Array;
        let lineCount = 0;
        const maxDistSq = (8 * (1 + bass * 0.5)) ** 2;
        const step = Math.max(1, Math.floor(N / 500));

        for (let i = 0; i < N && lineCount < MAX_LINES; i += step) {
          const i3 = i * 3;
          const x1 = a[i3], y1 = a[i3 + 1], z1 = a[i3 + 2];
          for (let j = i + step; j < N && lineCount < MAX_LINES; j += step) {
            const j3 = j * 3;
            const dx = a[j3] - x1, dy = a[j3 + 1] - y1, dz = a[j3 + 2] - z1;
            if (dx * dx + dy * dy + dz * dz < maxDistSq) {
              const idx = lineCount * 6;
              la[idx] = x1; la[idx+1] = y1; la[idx+2] = z1;
              la[idx+3] = a[j3]; la[idx+4] = a[j3+1]; la[idx+5] = a[j3+2];
              lineCount++;
            }
          }
        }
        lineGeo.setDrawRange(0, lineCount * 2);
        lp.needsUpdate = true;
        lineMat.opacity = lineAmount * 0.12;
      } else {
        lineGeo.setDrawRange(0, 0);
      }

      points.rotation.x = spinX;
      points.rotation.y = spinY;
      lines.rotation.x  = spinX;
      lines.rotation.y  = spinY;

      mat.opacity  = currentBright + bass * 0.08;
      mat.size     = currentSize   + bass * 0.05;

      camera.position.x = Math.sin(t * 0.02) * 5;
      camera.position.y = Math.cos(t * 0.03) * 3;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    animate();

    // Resize observer
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    obs.observe(canvas);

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      obs.disconnect();
      geo.dispose();
      mat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      renderer.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ background: 'transparent' }}
    />
  );
}
