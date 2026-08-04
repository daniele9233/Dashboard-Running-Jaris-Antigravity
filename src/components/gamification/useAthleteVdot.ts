import { useApi } from "../../hooks/useApi";
import { getVdotPaces } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { VdotPacesResponse } from "../../types/api";

/**
 * Il VDOT ufficiale dell'atleta — quello di `/api/vdot/paces`, lo stesso che
 * alimenta dashboard, zone di Daniels e previsioni gara.
 *
 * Il backend lo ricava dai GIRI dell'orologio sulle sedute di ripetute e
 * applica il modello del caldo; le pagine di gamification, che leggono solo il
 * passo medio di ogni corsa, arrivavano a un numero più basso. Due VDOT diversi
 * nella stessa app sono un bug, non una sfumatura: questo hook è la fonte unica.
 *
 * @returns null finché la chiamata non risponde — chi lo usa deve reggere
 *   l'assenza e ricadere sulla propria stima locale.
 */
export function useAthleteVdot(): number | null {
  const { data } = useApi<VdotPacesResponse>(getVdotPaces, { cacheKey: API_CACHE.VDOT_PACES });
  const v = data?.vdot;
  return typeof v === "number" && v > 0 ? v : null;
}
