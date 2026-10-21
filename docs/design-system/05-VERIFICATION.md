# 05 · Verifica

Tutti i numeri sono misurati; ciò che non è stato verificato è dichiarato.

## Build, tipi, test

| Controllo | Baseline (`main` 791fb974) | Dopo |
|---|---|---|
| `npm run lint` (tsc) | pulito | pulito |
| `npm run test` | 422/422 | **454/454** (+32: `theme.test.ts` 14, `charts.test.tsx` 18) — rieseguito dopo le ultime modifiche |
| `npm run build` | ok 16.9 s | ok 10.2 s |
| `npm run design:check` | — | nessuna nuova violazione (baseline: 60 file con debito; `hex` 776→590, `tiny-text` 384→115) |
| ESLint `src` | 244 problemi (20 errori) | 20 errori (gli stessi), nessun errore nuovo; i warning nuovi per variabili inutilizzate sono stati rimossi; restano solo segnalazioni di numero di riga cambiato (`exhaustive-deps`, preesistenti) |
| Test backend (`pytest`) | 3 falliti preesistenti | non rieseguito (nessun file backend toccato) |

Bundle (gzip, ultima build): `StatisticsView` 354.45 → 323.82 kB (86.22 → 83.59), `DashboardView` 94.59 → 93.30, `RankingView`, `TrainingView`, `PaceLabView` −0.2…−0.4 kB; `index.css` 186.02 → 195.24 kB (30.26 → 32.16 gzip: token e classi `ea-*`); `vendor-charts`, `index`, `App` invariati.

## Prima/dopo nel browser (Chrome headless, dati registrati, 114 catture per stato)

| Misura | Prima | Dopo |
|---|---|---|
| Corpo dei tick (tutte le pagine × viewport) | 9 px ×569 · 10 px ×1200 · 10.5 px ×30 · 12 px ×56 | **12 px ×1565** |
| Colore dei tick | #333 (1.5:1), #444, #555, #666 su 11 di 29 grafici | **#8A8A8A (5.6:1) su tutti** |
| Testo < 12 px, tutte le 19 pagine | 6437 / 10383 nodi (62%) | 4210 / 10328 (41%): pagine analitiche < 10%; il resto è `/activities` (3331 nodi), non analitica |
| Card di grafico: raggio e superficie | 24/16/12/8/26 px, 29 con vetro | **16 px piatte (43)**; 3 con vetro residuo fuori dalle viste migrate |
| Altezze dichiarate dei plot | ≈ 20 valori | classi per famiglia (160/240/320/360) |
| Errori console (esclusi blocchi di rete) | solo `/profile` (stile mappa bloccato dallo script) | identici, nessun errore nuovo |
| Overflow orizzontale del documento | 0 a tutti i viewport | 0 a tutti i viewport |
| Grafici Recharts renderizzati (1440×900) | 29 | 29 |

Controlli funzionali (script `interact_pilot`, `tooltip_smoke`): sul pilota intervalli 1M↔3M, filtro KPI, tastiera (frecce/Esc), tooltip su barre e dispersione, filtro km 30D/90D, zone 7D: **tutti ok, valori identici alla baseline** (404,0 km · 74 uscite · 31.4 km/sett. · 21.1 km; 38.1 / 28.6 / +9.5). Hover su 29 grafici: 20 con tooltip condiviso, 6 con tooltip proprio ma nello stesso guscio, 3 senza risposta all'hover generico (radiale e 2 dispersioni: servono i punti esatti; non verificati a mano).

## Verifica a 360 / 390 / 768 px (`responsive_probe`)

Chrome headless con touch (`hasTouch`), dati registrati, **ogni richiesta non-GET stubbata** (venivano intercettati `PUT /api/user/layout`, `POST /api/runs/weather/bulk` e `POST /api/runs/:id/weather`: nessuna scrittura sul DB di produzione). Il browser integrato dell'app non è usabile per questo: il backend locale accetta solo le origini `localhost:3000/3001/5173` (CORS) e non permette di intercettare le richieste prima del caricamento.

Sonda su 12 viste (dashboard, `/training`, `/ranking`, 9 schede di `/statistics`) × 3 viewport, escluso il guscio dell'app (sidebar, header, nav):

| Controllo | Primo giro | Dopo le correzioni |
|---|---|---|
| overflow orizzontale del documento | 0 | **0** |
| elementi fuori dallo schermo non in un contenitore scorrevole | 0 | **0** |
| contenuto tagliato da un antenato `overflow:hidden` | 5 combinazioni (dashboard 360 e 768, training 768, biomeccanica 360 e 390) | **0** |
| etichette di tick fuori dal grafico | 11 etichette in 4 grafici (Clima & Ritmo, Biomeccanica, Potenziale & Progressi V2, Biologia & Futuro), a tutti e 3 i viewport | **0** |
| tick dell'asse X sovrapposti | 0 | **0** |

Dettaglio dei difetti e delle correzioni: `04-MIGRATION-LOG.md`. Evidenza visiva: `screenshots/responsive-after/tap-fitness-390.png`, `tap-bars-390.png` (tooltip al tocco), `screenshots/after/training__768x1024.jpg`.

**Tooltip al tocco** (tap con `page.touchscreen.tap`): rispondono tutti i grafici a linea, area e barre (verificati uno per uno, anche a 390 px) e il grafico guida di Carico & Forma. **Non rispondono** i 4 grafici a dispersione (Matrice degli Sforzi, Le sedute che pesano, GCT vs Cadenza, matrice cadenza/velocità): in Recharts 3 il tooltip dello scatter richiede l'ingresso del puntatore sul singolo punto (r ≈ 5) e il tocco non lo produce nemmeno sul punto. Un tentativo di allargare l'area sensibile con un tratto trasparente non ha dato effetto verificabile ed è stato rimosso. Il treemap non ha tooltip per costruzione. Con il mouse i tooltip funzionano su 27 grafici su 29 (stessa sonda di prima: 20 condivisi + 6 propri + 3 muti → **27 condivisi + 2 muti**; i 2 muti sono radiale e treemap).

## Rendering misurato (build di produzione, Chrome headless, mediana di 3 esecuzioni)

Metodo: `main` e il branch compilati con `vite build` e serviti con `vite preview`; CDP `Performance.getMetrics` a pagina caricata (dopo 2.5 s) e tempi di frame mentre si scorre l'intera pagina in 60 passi. Stesso hardware, stesse richieste registrate.

| Pagina | Task (s) base → dopo | Script (s) | Layout (s) | Nodi DOM | Heap JS (MB) | Frame di scorrimento (media / p95) |
|---|---|---|---|---|---|---|
| Dashboard | 3.30 → 3.36 | 1.86 → 1.97 | 0.312 → 0.300 | 2734 → 3266 | 44 → 33 | 16.0 / 26 → 16.0 / 26 ms |
| Carico & Forma | 0.31 → 0.30 | 0.17 → 0.17 | 0.042 → 0.039 | 1810 → 1648 | 18 → 19 | 16.0 / 18 → 16.0 / 17 ms |
| Potenziale & Progressi | 0.46 → 0.44 | 0.24 → 0.24 | 0.067 → 0.061 | 1096 → 1504 | 15 → 15 | 16.0 / 18 → 16.0 / 18 ms |
| Biomeccanica | 0.62 → 0.60 | 0.32 → 0.32 | 0.090 → 0.080 | 2891 → 2831 | 21 → 21 | 16.0 / 18 → 16.0 / 18 ms |
| Detraining | 0.49 → 0.46 | 0.22 → 0.22 | 0.069 → 0.059 | 2051 → 2010 | 15 → 15 | 16.0 / 18 → 16.0 / 18 ms |

**Lettura onesta:** nessuna regressione misurabile; sulle schede di `/statistics` task e layout scendono del 3–12%, sul dashboard i valori sono entro il rumore (+2% task, −4% layout, +10% style recalc). Il **costo di composizione del `backdrop-filter` non è misurabile qui**: in headless i frame sono vincolati al vsync (16 ms) e nessuna pagina ha frame lunghi né prima né dopo; l'effetto atteso sulla GPU di un dispositivo reale non è verificato. Il numero di nodi DOM cresce su dashboard (+19%) e Potenziale & Progressi (+37%): non ho indagato la causa (probabilmente strutture accessibili e legende nuove, più il rendering asincrono di widget a pagina caricata); non è un indicatore di costo di rendering, che resta uguale.

## Quality gate

| QG | Esito |
|---|---|
| 01 copertura | ✅ 19 pagine, 82 istanze + SVG inventariati e classificati (`01-AUDIT`, `INVENTORY-*`) |
| 02 consistenza | 🟡 viste analitiche e dashboard sul contratto; eccezioni in `04`; debito residuo misurato e a cricchetto |
| 03 fedeltà dei dati | ✅ nessuna formula, unità, dominio, formatter, scala o API toccati; 422 test originali verdi; valori del pilota identici. Unica modifica visibile: colori delle barre per tipo di seduta (dichiarata) e larghezza dell'asse Y (geometria, non dati) |
| 04 fedeltà funzionale | 🟡 pilota (intervalli, filtro KPI, tastiera, tooltip) e hover su 29 grafici verificati; tooltip al tocco verificato su linea/area/barre, **non** sugli scatter; non verificati a mano tutti i filtri di ogni scheda |
| 05 responsive | ✅ per le 12 viste × 360/390/768: 0 overflow, 0 clipping, 0 tick tagliati (sonda automatica + screenshot); 🟡 non verificate le altre rotte (race-lab, pace-lab, gamification, runner-dna, profile, activities, badges) e il tocco reale su dispositivo |
| 06 accessibilità | 🟡 contrasti, 12 px, daltonismo (test), focus, tastiera sul grafico guida, `aria`/riassunto sul kit; **non** eseguito un audit con screen reader né axe |
| 07 performance | ✅ nessuna regressione misurata su build di produzione (tabella sopra); 🟡 costo GPU del blur non misurabile in headless |
| 08 build e test | ✅ tsc pulito · 454/454 · build ok (10.3 s) · ESLint: 20 errori preesistenti invariati, nessun nuovo errore o warning di variabili inutilizzate |
| 09 confronti prima/dopo | ✅ 114+114 catture (cartella ignorata da git); riesaminate a vista le principali |
| 10 manutenibilità | ✅ nuovo grafico = kit + preset + `design:check` + skill locale |

## Non verificato

Safari/Firefox; touch reale su dispositivo; tooltip al tocco sugli scatter (limite noto); dati vuoti/errore reali; modali a schermo intero; hover/focus di ogni card; responsive di race-lab, pace-lab, gamification, runner-dna, profile, activities, badges; Playwright MCP (aggiunto, non usato: gli script usano `playwright-core`); audit con screen reader. Il plugin Superpowers è attivo da questa sessione ma i suoi flussi non sono stati eseguiti; `/plugin install` interattivo non è disponibile nell'app (usato `claude plugin install`).
