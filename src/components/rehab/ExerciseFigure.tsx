import { useId } from "react";
import clsx from "clsx";
import { EXERCISE_FIGURES, FRAME_H, FRAME_W, GROUND, along, type Chain, type Frame, type P, type Prop } from "./figures";

const pts = (ps: P[]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

const TONE: Record<Chain["tone"], string> = {
  near: "stroke-white",
  torso: "stroke-white",
  arm: "stroke-white/90",
  far: "stroke-ea-text-axis/60",
  prop: "stroke-ea-hairline-strong",
};

function ChainShape({ c }: { c: Chain }) {
  return (
    <>
      <polyline
        points={pts(c.pts)} fill="none" strokeWidth={c.width} strokeLinecap="round" strokeLinejoin="round"
        className={TONE[c.tone]}
      />
      {c.hl?.map((h, i) => (
        <polyline
          key={i} points={pts([along(c, h.seg, h.from), along(c, h.seg, h.to)])} fill="none"
          strokeWidth={c.width + 1.5} strokeLinecap="round" className="stroke-ea-rose"
        />
      ))}
    </>
  );
}

function PropShape({ p, markerId }: { p: Prop; markerId: string }) {
  switch (p.k) {
    case "rect":
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={1.5} className="fill-ea-surface-3 stroke-ea-text-axis/50" strokeWidth={1} />;
    case "line":
      return (
        <line
          x1={p.a[0]} y1={p.a[1]} x2={p.b[0]} y2={p.b[1]} strokeWidth={2} strokeLinecap="round"
          className={p.tone === "band" ? "stroke-ea-cyan" : "stroke-ea-text-axis"}
          strokeDasharray={p.tone === "band" ? "4 2" : undefined}
        />
      );
    case "dot":
      return (
        <circle
          cx={p.at[0]} cy={p.at[1]} r={p.r}
          className={p.tone === "weight" ? "fill-ea-violet" : p.tone === "towel" ? "fill-ea-cyan" : "fill-ea-text-axis"}
        />
      );
    case "arrow":
      return (
        <line
          x1={p.a[0]} y1={p.a[1]} x2={p.b[0]} y2={p.b[1]} strokeWidth={2} strokeLinecap="round"
          className="stroke-ea-lime" markerEnd={`url(#${markerId})`}
        />
      );
    case "glow":
      return <circle cx={p.at[0]} cy={p.at[1]} r={p.r} className="fill-ea-rose/35" />;
  }
}

function FrameSvg({ frame }: { frame: Frame }) {
  const markerId = useId();
  const far = frame.chains.filter((c) => c.tone === "far");
  const rest = frame.chains.filter((c) => c.tone !== "far");
  const solid = frame.props.filter((p) => p.k === "rect");
  const over = frame.props.filter((p) => p.k !== "rect");
  return (
    <svg viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} className="block h-auto w-full" aria-hidden="true">
      <defs>
        <marker id={markerId} viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" className="fill-ea-lime" />
        </marker>
      </defs>
      <line x1={4} y1={GROUND + 1} x2={FRAME_W - 4} y2={GROUND + 1} strokeWidth={1.5} className="stroke-ea-hairline-strong" />
      {solid.map((p, i) => <PropShape key={`s${i}`} p={p} markerId={markerId} />)}
      {far.map((c, i) => <ChainShape key={`f${i}`} c={c} />)}
      {rest.map((c, i) => <ChainShape key={`c${i}`} c={c} />)}
      {frame.hand?.map((h, i) => <circle key={i} cx={h[0]} cy={h[1]} r={3} className="fill-white" />)}
      {frame.head && <circle cx={frame.head.c[0]} cy={frame.head.c[1]} r={frame.head.r} className="fill-white" />}
      {over.map((p, i) => <PropShape key={`o${i}`} p={p} markerId={markerId} />)}
    </svg>
  );
}

/**
 * Le figure di un esercizio: la posizione di partenza e quella di arrivo, con il
 * muscolo che lavora in rosso. Un esercizio senza figura non mostra niente.
 */
export function ExerciseFigure({ exerciseId, name, className }: { exerciseId: string; name: string; className?: string }) {
  const build = EXERCISE_FIGURES[exerciseId];
  if (!build) return null;
  const frames = build();
  return (
    <figure
      className={clsx("rounded-xl bg-ea-surface-2 p-2", className)}
      role="img"
      aria-label={`${name}: ${frames.map((f) => f.caption).join(", poi ")}. Il muscolo che lavora è in rosso.`}
    >
      <div className={clsx("grid gap-1", frames.length > 1 ? "grid-cols-2" : "mx-auto max-w-[240px] grid-cols-1")}>
        {frames.map((f, i) => (
          <div key={i} className="min-w-0">
            <FrameSvg frame={f} />
            <figcaption className="px-1 pb-1 text-center text-xs leading-snug text-ea-text-axis">{f.caption}</figcaption>
          </div>
        ))}
      </div>
    </figure>
  );
}
