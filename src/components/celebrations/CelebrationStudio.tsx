import { useMemo, useState } from "react";
import { Trophy, Play, Layers } from "lucide-react";
import {
  CELEBRATIONS, CELEBRATION_GROUPS,
  type CelebrationDef, type CelebrationGroup,
} from "./celebrationRegistry";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { MultiCelebrationOverlay } from "./MultiCelebrationOverlay";

/**
 * Celebration Studio — vetrina dei 100 stili di celebrazione traguardi,
 * filtrabile per gruppo. Click su una card → overlay full-screen con la
 * celebrazione completa (scena GSAP + chrome). Serve a scegliere gli stili
 * da agganciare alla detection reale dei record.
 *
 * Include il simulatore di SBLOCCO SIMULTANEO: se una corsa fa scattare 2-3
 * traguardi insieme, il MultiCelebrationOverlay li mostra in un unico momento.
 */
export function CelebrationStudio() {
  const [active, setActive] = useState<CelebrationDef | null>(null);
  const [runId, setRunId] = useState(0);
  const [group, setGroup] = useState<CelebrationGroup | "TUTTI">("TUTTI");
  const [multi, setMulti] = useState<CelebrationDef[] | null>(null);
  const [multiRun, setMultiRun] = useState(0);

  const visible = useMemo(
    () => (group === "TUTTI" ? CELEBRATIONS : CELEBRATIONS.filter((c) => c.group === group)),
    [group],
  );

  const play = (def: CelebrationDef) => {
    setActive(def);
    setRunId((n) => n + 1);
  };

  // Pesca `count` traguardi distinti a caso → simula uno sblocco multiplo.
  // Vengono ordinati dalla categoria più importante alla meno (mostrati così).
  const GROUP_PRIORITY: Record<CelebrationGroup, number> = {
    GARE: 6, CLASSICI: 5, VELOCITÀ: 4, FISIOLOGIA: 3, VOLUME: 2, SALITE: 1, COSTANZA: 0,
  };
  const simulateMulti = (count: number) => {
    const pool = [...CELEBRATIONS];
    const chosen: CelebrationDef[] = [];
    for (let i = 0; i < count && pool.length; i++) {
      chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    chosen.sort((a, b) => GROUP_PRIORITY[b.group] - GROUP_PRIORITY[a.group]);
    setMulti(chosen);
    setMultiRun((n) => n + 1);
  };

  return (
    <section className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-black/40 p-6 md:p-8">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-4 h-4 text-[#C0FF00]" />
        <h2 className="text-sm font-black tracking-[0.25em] uppercase text-white">Celebration Studio</h2>
        <span className="text-[10px] font-black text-gray-600 ml-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {CELEBRATIONS.length}
        </span>
      </div>
      <p className="text-[11px] text-gray-500 mb-5">
        Celebrazioni per i tuoi traguardi di corsa — GSAP timeline, DrawSVG, MotionPath, SplitText.
        Clicca per vedere la celebrazione a schermo intero.
      </p>

      {/* Simulatore sblocco simultaneo */}
      <div className="rounded-2xl border border-[#C0FF00]/20 bg-[#C0FF00]/[0.04] p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Layers className="w-4 h-4 text-[#C0FF00] shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] font-black tracking-[0.18em] uppercase text-white">Sblocco simultaneo</div>
            <div className="text-[10px] text-gray-500 leading-snug">Se una corsa fa scattare più traguardi, ognuno prende lo schermo e parte da solo, uno dopo l'altro.</div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => simulateMulti(2)}
            className="px-3.5 py-2 rounded-xl border border-[#C0FF00]/40 bg-[#C0FF00]/10 text-[#C0FF00] text-[10px] font-black tracking-[0.18em] uppercase hover:bg-[#C0FF00]/20 transition-colors"
          >
            Simula 2 badge
          </button>
          <button
            type="button"
            onClick={() => simulateMulti(3)}
            className="px-3.5 py-2 rounded-xl border border-[#C0FF00]/40 bg-[#C0FF00]/10 text-[#C0FF00] text-[10px] font-black tracking-[0.18em] uppercase hover:bg-[#C0FF00]/20 transition-colors"
          >
            Simula 3 badge
          </button>
        </div>
      </div>

      {/* Filtro gruppi */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["TUTTI", ...CELEBRATION_GROUPS] as const).map((g) => {
          const sel = group === g;
          const count = g === "TUTTI" ? CELEBRATIONS.length : CELEBRATIONS.filter((c) => c.group === g).length;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`px-3.5 py-1.5 rounded-full border text-[10px] font-black tracking-[0.18em] uppercase transition-colors ${
                sel
                  ? "border-[#C0FF00]/50 bg-[#C0FF00]/10 text-[#C0FF00]"
                  : "border-white/[0.08] bg-white/[0.02] text-gray-500 hover:text-white hover:border-white/[0.2]"
              }`}
            >
              {g} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {visible.map((def) => {
          const n = CELEBRATIONS.indexOf(def) + 1;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => play(def)}
              className="group text-left rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4 relative overflow-hidden"
            >
              <div aria-hidden className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition-opacity"
                style={{ background: `linear-gradient(90deg, ${def.accent}, ${def.accent2}, transparent)` }} />
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black tracking-[0.2em]" style={{ color: def.accent }}>
                  {String(n).padStart(2, "0")}
                </span>
                <Play className="w-3.5 h-3.5 text-gray-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-[12px] font-black uppercase tracking-wide text-white leading-tight">
                {def.title}
              </div>
              <div className="text-[9px] text-gray-500 mt-1.5 leading-snug">{def.mechanic}</div>
            </button>
          );
        })}
      </div>

      <p className="text-[9px] text-gray-600 mt-5 leading-relaxed">
        Motore: GSAP 3.15 (DrawSVG · MotionPath · SplitText · CustomEase) via useGSAP.
        Slot Rive integrato (@rive-app/react-canvas): aggiungi un asset .riv in public/rive/ e registralo
        sulla celebrazione per un layer state-machine autorato nell'editor Rive.
      </p>

      {active && (
        <CelebrationOverlay
          def={active}
          runId={runId}
          onReplay={() => setRunId((n) => n + 1)}
          onClose={() => setActive(null)}
        />
      )}

      {multi && multi.length > 0 && (
        <MultiCelebrationOverlay
          defs={multi}
          runId={multiRun}
          onClose={() => setMulti(null)}
        />
      )}
    </section>
  );
}
