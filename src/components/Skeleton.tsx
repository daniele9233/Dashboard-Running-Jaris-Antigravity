/**
 * Skeleton — convention loading placeholder shared.
 *
 * Convention (round 6 — #24): skeleton SEMPRE per loading dati. Spinner solo
 * per azioni utente (es. "Sincronizzando..."). Niente più mix di skeleton +
 * spinner + dash placeholder sulla stessa pagina.
 *
 * Uso:
 *   <Skeleton className="h-10 rounded-xl" />
 *   <Skeleton variant="text" lines={3} />
 *   <Skeleton variant="card" />
 */
import { type CSSProperties } from "react";

interface SkeletonProps {
  /** Tailwind override per dimensioni custom. */
  className?: string;
  /** Variant: "block" (default) / "text" / "card" / "circle". */
  variant?: "block" | "text" | "card" | "circle";
  /** Per variant=text: numero di linee. Default 1. */
  lines?: number;
  /** Inline style override. */
  style?: CSSProperties;
}

const BASE = "bg-white/[0.06] animate-pulse rounded-xl";

export function Skeleton({
  className = "",
  variant = "block",
  lines = 1,
  style,
}: SkeletonProps) {
  if (variant === "text") {
    return (
      <div className="space-y-2" aria-busy="true" aria-live="polite">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${BASE} h-3 ${i === lines - 1 ? "w-2/3" : "w-full"} ${className}`}
            style={style}
          />
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`${BASE} h-full min-h-[200px] ${className}`}
        style={style}
        aria-busy="true"
        aria-live="polite"
      />
    );
  }

  if (variant === "circle") {
    return (
      <div
        className={`bg-white/[0.06] animate-pulse rounded-full ${className}`}
        style={style}
        aria-busy="true"
        aria-live="polite"
      />
    );
  }

  // block (default)
  return (
    <div
      className={`${BASE} h-10 ${className}`}
      style={style}
      aria-busy="true"
      aria-live="polite"
    />
  );
}
