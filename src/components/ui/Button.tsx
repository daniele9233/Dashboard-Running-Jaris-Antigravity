import { forwardRef, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * IL BOTTONE
 * ════════════════════════════════════════════════════════════════════════════
 * Prima non esisteva: ogni pagina ne scriveva uno suo, e in giro c'erano pill
 * lime piene con testo nero, pill bordate grigie, bottoni arancioni, un "Edit
 * Profile" blu e link-testo lime — sei modi di dire "fai questa cosa". Un
 * prodotto dove il bottone "salva" cambia faccia da una schermata all'altra
 * insegna all'utente a non fidarsi di nessuno dei due.
 *
 * Tre varianti, e basta:
 *   primary    — l'azione della schermata. Lime pieno, testo scuro. Una per vista.
 *   secondary  — azioni utili ma non principali. Superficie e bordo.
 *   ghost      — manutenzione e azioni rare (reset, annulla). Solo testo.
 *
 * Tutti gli stati sono qui: hover, premuto, focus (dall'anello globale in
 * index.css), disabilitato, in caricamento.
 */
type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ComponentType<{ className?: string }>;
  loading?: boolean;
  children?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-ink hover:bg-[#D2FF4D] active:bg-[#AEE600] border border-transparent",
  secondary:
    "bg-white/[0.03] text-gray-200 border border-white/10 hover:border-white/25 hover:text-white active:bg-white/[0.06]",
  ghost:
    "bg-transparent text-gray-400 border border-transparent hover:text-white hover:bg-white/[0.04] active:bg-white/[0.07]",
};

const SIZE: Record<Size, string> = {
  sm: "min-h-[36px] px-3 gap-1.5 text-[11px] rounded-lg",
  md: "min-h-[44px] px-4 gap-2 text-[12px] rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon: Icon, loading = false, disabled, className, children, type, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center font-black uppercase tracking-[0.14em] whitespace-nowrap",
        "transition-colors duration-150 select-none",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden
        />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 shrink-0" />
      ) : null}
      {children}
    </button>
  );
});
