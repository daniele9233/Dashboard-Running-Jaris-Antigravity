/**
 * Quanto sei pronto per la sub-20 quando le temperature saranno ideali.
 *
 * Usa gli stessi moduli dell'app (nessun modello parallelo):
 *  · il meteo salvato da /api/runs/backfill-weather
 *  · computeEnvironmentalPenalty da src/utils/weather.ts
 *
 * Metodo: per ogni prestazione veloce si toglie dal passo quello che ha messo
 * il clima, si ricava il VDOT equivalente in condizioni ideali e da lì si
 * proietta il 5K.
 */
import { computeEnvironmentalPenalty, type WeatherSnapshot } from "../src/utils/weather";
import type { Run } from "../src/types/api";

const API = "http://localhost:8000";

const parsePace = (p?: string | null): number | null => {
  if (!p) return null;
  const [m, s] = p.split(":").map(Number);
  return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : null;
};
const fmt = (sec: number): string => {
  const t = Math.round(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const fmtTime = (sec: number): string => {
  const t = Math.round(sec);
  const m = Math.floor(t / 60);
  return `${m}:${String(t % 60).padStart(2, "0")}`;
};

/** Daniels: VDOT da una prestazione (distanza km, tempo minuti). */
function vdotOf(km: number, min: number): number | null {
  if (km <= 0 || min <= 0) return null;
  const v = (km * 1000) / min;
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const denom = 0.8 + 0.1894393 * Math.exp(-0.012778 * min) + 0.2989558 * Math.exp(-0.1932605 * min);
  const vdot = vo2 / denom;
  return vdot < 25 || vdot > 85 ? null : vdot;
}

/** Tempo sui 5K per un dato VDOT: inversione iterativa della formula di Daniels. */
function time5kFromVdot(vdot: number): number {
  let lo = 12, hi = 40; // minuti
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = vdotOf(5, mid);
    if (v == null) { lo = mid; continue; }
    if (v > vdot) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * 60; // secondi
}

async function main() {
  const runs: Run[] = (await (await fetch(`${API}/api/runs`)).json()).runs;
  const ids = runs.map((r) => r.id);
  const wRes = await fetch(`${API}/api/runs/weather/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_ids: ids }),
  });
  const stored: Record<string, any> = (await wRes.json()).weather ?? {};

  const snap = (id: string): WeatherSnapshot | null => {
    const w = stored[id];
    if (!w || typeof w.temperature !== "number") return null;
    return {
      temperature: w.temperature,
      humidity: w.humidity ?? null,
      apparent: w.apparent_temperature ?? w.temperature,
      wind: w.wind_speed ?? null,
      dewpoint: w.dewpoint ?? null,
      estimatedHour: w.estimated_hour ?? 8,
      estimatedLabel: "",
      source: "stored",
    };
  };

  console.log(`corse totali: ${runs.length} · con meteo risolto: ${Object.keys(stored).length}\n`);

  /**
   * Base di calcolo: i BEST EFFORT continui, non il passo medio dell'attività.
   *
   * Il passo medio di una seduta include riscaldamento, defaticamento e i
   * recuperi fra le ripetute: usarlo per stimare un tempo di gara sottostima
   * sistematicamente, perché mette nel conto chilometri che in gara non esistono.
   * Strava salva invece il miglior tratto continuo su ogni distanza: quello è
   * l'unico dato paragonabile a una prova cronometrata.
   *
   * Si usano 1500/2000/3000 m: abbastanza lunghi da essere indicativi sui 5K,
   * abbastanza corti da comparire spesso nelle sedute.
   */
  const BEST_FIELDS: Array<[keyof Run, number]> = [
    ["best_1500m_sec" as keyof Run, 1.5],
    ["best_2000m_sec" as keyof Run, 2.0],
    ["best_3000m_sec" as keyof Run, 3.0],
  ];

  const efforts = runs
    .filter((r) => !r.is_treadmill)
    .flatMap((r) => {
      const w = snap(r.id);
      if (!w) return [];
      return BEST_FIELDS.flatMap(([field, km]) => {
        // ATTENZIONE: il campo contiene il PASSO in sec/km del tratto migliore,
        // non il tempo totale (backend: `pace_s = best_time / target_km`).
        // Trattarlo come tempo produce un 2 km in 5:03, cioè quasi il record
        // del mondo, e un VDOT da 83.
        const pace = (r as any)[field];
        if (typeof pace !== "number" || pace <= 0) return [];
        if (pace > 280) return []; // oltre 4:40/km non è uno sforzo di qualità
        // La penalità climatica si calcola sul tratto, non sull'intera corsa.
        const penalty = computeEnvironmentalPenalty({ ...r, distance_km: km, avg_pace: fmt(pace) }, w);
        const normPace = pace - penalty;
        const vdot = vdotOf(km, (normPace * km) / 60);
        return vdot == null ? [] : [{ r, km, pace, w, penalty, normPace, vdot, field: String(field) }];
      });
    })
    .sort((a, b) => b.vdot - a.vdot);

  if (efforts.length === 0) { console.log("nessuna prestazione utile"); return; }

  console.log(`prestazioni analizzate (>=3 km, sotto 4:40/km, con meteo): ${efforts.length}\n`);
  console.log("── LE 10 MIGLIORI, NORMALIZZATE A CONDIZIONI IDEALI ──");
  console.log("data        tratto  passo   temp  um.   penalità  normalizzato  VDOT");
  for (const e of efforts.slice(0, 10)) {
    console.log(
      `${e.r.date}  ${(e.km.toFixed(1) + " km").padStart(6)}  ${fmt(e.pace)}  ` +
      `${String(Math.round(e.w.temperature!)).padStart(3)}°  ${String(Math.round(e.w.humidity ?? 0)).padStart(3)}%  ` +
      `${("-" + e.penalty.toFixed(1) + "s").padStart(8)}  ${fmt(e.normPace).padStart(11)}  ${e.vdot.toFixed(1)}`,
    );
  }

  // Il VDOT attuale: media delle 3 migliori prestazioni degli ultimi 90 giorni,
  // per non farsi trascinare da un singolo exploit o da forma vecchia.
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const recent = efforts.filter((e) => e.r.date >= cutoff);
  const pool = (recent.length >= 3 ? recent : efforts).slice(0, 3);
  const vdotNow = pool.reduce((s, e) => s + e.vdot, 0) / pool.length;

  console.log(`\n── VDOT ATTUALE ──`);
  console.log(`base: ${pool.length} migliori prestazioni ${recent.length >= 3 ? "degli ultimi 90 giorni" : "di sempre"}`);
  for (const e of pool) console.log(`   ${e.r.date}  ${e.km.toFixed(1)} km in ${fmtTime(e.pace * e.km)}  (${fmt(e.pace)}/km a ${Math.round(e.w.temperature!)}°)  VDOT ${e.vdot.toFixed(1)}`);
  console.log(`VDOT normalizzato = ${vdotNow.toFixed(1)}`);

  const t5k = time5kFromVdot(vdotNow);
  const target = 19 * 60 + 58;
  console.log(`\n── PROIEZIONE 5K IN CONDIZIONI IDEALI (5-11°C) ──`);
  console.log(`tempo stimato : ${fmtTime(t5k)}  (${fmt(t5k / 5)}/km)`);
  console.log(`obiettivo     : ${fmtTime(target)}  (4:00/km)`);
  const gap = t5k - target;
  console.log(`scarto        : ${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(0)} s  ` +
              `(${gap > 0 ? "manca" : "margine"} ${fmt(Math.abs(gap) / 5)}/km)`);

  const vdotNeeded = (() => {
    let lo = 30, hi = 85;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (time5kFromVdot(mid) > target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  })();
  console.log(`VDOT necessario per 19:58: ${vdotNeeded.toFixed(1)}  →  da guadagnare: ${(vdotNeeded - vdotNow).toFixed(1)}`);

  // Quanto pesa il clima oggi
  const avgPen = efforts.slice(0, 10).reduce((s, e) => s + e.penalty, 0) / Math.min(10, efforts.length);
  const avgTemp = efforts.slice(0, 10).reduce((s, e) => s + (e.w.temperature ?? 0), 0) / Math.min(10, efforts.length);
  console.log(`\n── QUANTO TI STA COSTANDO IL CALDO ──`);
  console.log(`temperatura media delle tue prove migliori: ${avgTemp.toFixed(0)}°C`);
  console.log(`penalità media                            : ${avgPen.toFixed(1)} sec/km`);
  console.log(`sui 5K vale                               : ${(avgPen * 5).toFixed(0)} secondi`);
}

main().catch((e) => { console.error(e); process.exit(1); });
