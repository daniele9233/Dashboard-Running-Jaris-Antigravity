import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

interface Props {
  children: ReactNode;
  /** Fraction of the pointer offset the element follows. */
  strength?: number;
  /** Inner content drifts further than the shell, for depth. */
  innerStrength?: number;
  disabled?: boolean;
  className?: string;
}

const SPRING = { stiffness: 220, damping: 18, mass: 0.6 };

/**
 * Pulls its child toward the pointer while hovered. Motion values bypass React
 * render entirely — pointer moves never touch component state.
 */
export function Magnetic({ children, strength = 0.35, innerStrength = 0.15, disabled, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const ix = useMotionValue(0);
  const iy = useMotionValue(0);
  const sx = useSpring(x, SPRING);
  const sy = useSpring(y, SPRING);
  const six = useSpring(ix, SPRING);
  const siy = useSpring(iy, SPRING);

  const onMove = (e: React.PointerEvent) => {
    if (disabled || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    x.set(dx * strength);
    y.set(dy * strength);
    ix.set(dx * innerStrength);
    iy.set(dy * innerStrength);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
    ix.set(0);
    iy.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: sx, y: sy }}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      <motion.div style={{ x: six, y: siy }}>{children}</motion.div>
    </motion.div>
  );
}
