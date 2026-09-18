import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export interface NavItem {
  path: string;
  label: string;
}

/**
 * Le destinazioni dell'app, in un posto solo.
 *
 * Prima vivevano dentro App.tsx e il drawer mobile non le conosceva: su telefono
 * e tablet il menu hamburger si apriva su un logo e sullo stato dell'orologio, e
 * sette sezioni su dieci erano raggiungibili solo scorrendo di lato una striscia
 * larga 158 px, senza nessun segno che scorresse. Barra in alto e drawer ora
 * leggono la stessa lista.
 */
export function useNavItems(): NavItem[] {
  const { t } = useTranslation();
  return useMemo(() => [
    { path: "/", label: t("nav.dashboard") },
    { path: "/training", label: t("nav.training") },
    { path: "/activities", label: t("nav.activities") },
    { path: "/statistics", label: t("nav.statistics") },
    { path: "/runner-dna", label: t("nav.runnerDna") },
    { path: "/ranking", label: t("nav.ranking") },
    { path: "/badges", label: t("nav.badges") },
    { path: "/gamification-v1", label: "GAMI V1" },
    { path: "/race-lab", label: "BANCO DI PROVA" },
    { path: "/profile", label: t("nav.profile") },
  ], [t]);
}

/** Il primo segmento del path decide quale voce è attiva. */
export function isNavActive(pathname: string, itemPath: string): boolean {
  const active = pathname.split("/")[1] || "dashboard";
  const segment = itemPath === "/" ? "dashboard" : itemPath.slice(1);
  return active === segment;
}

/**
 * Porta un elemento al centro di una striscia che scorre in orizzontale, senza
 * toccare lo scroll verticale della pagina (scrollIntoView lo farebbe, e la
 * pagina salterebbe in alto a ogni cambio di tab).
 */
export function centerInStrip(strip: HTMLElement | null, el: HTMLElement | null, smooth = true): void {
  if (!strip || !el) return;
  const s = strip.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  const delta = e.left + e.width / 2 - (s.left + s.width / 2);
  strip.scrollTo({ left: strip.scrollLeft + delta, behavior: smooth ? "smooth" : "auto" });
}
