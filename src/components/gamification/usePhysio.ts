import { useEffect, useMemo, useState } from "react";
import type { Run } from "../../types/api";
import { useAthleteVdot } from "./useAthleteVdot";
import { buildPhysio, type PhysioState } from "./physioEngine";

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "12 gennaio 2027" — una previsione con una data vera si legge come una data. */
export const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/**
 * Il motore fisiologico, con l'ancora VDOT del backend e la data di oggi viva.
 *
 * La data va rinfrescata quando la pagina torna in primo piano: una previsione
 * che dice "fra tre settimane" calcolata dieci giorni fa non è più la stessa
 * previsione, e un tab lasciato aperto non deve mentire.
 */
export function usePhysio(runs: Run[]): PhysioState {
  const vdot = useAthleteVdot();
  const [today, setToday] = useState(() => new Date().toISOString());
  useEffect(() => {
    const sync = () => setToday(new Date().toISOString());
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return useMemo(() => buildPhysio(runs, today, vdot), [runs, today, vdot]);
}
