# 04 · Registro della migrazione

Livelli: **A** contratto completo (card, testata, KPI, plot, legenda, tooltip, assi) · **B** guscio + primitive (assi, griglia, tooltip, titoli, superfici piatte, testo ≥ 12 px) via `scripts/design-codemod.py` + ritocchi a mano · **C** SVG proprietari: solo colori e corpi del testo · **D** solo regola dei 12 px · **—** non toccato.

## Rotte e viste

| Rotta / vista | File principali | Livello | Note |
|---|---|---|---|
| `/statistics` Carico & Forma (**pilota**) | `CaricoFormaV2.tsx` | **A** | riscritta sul kit; FitnessMultiChart ricalcolato alla larghezza reale, tastiera, `useId`; una colonna sotto 1024 px |
| `/statistics` Potenziale & Progressi V2 | `PotentialProgressV3.tsx` | **A** | `ChartKpi`, `ChartPlot`, `ChartLegend`, `seriesStroke` (misurato continuo / previsto tratteggiato) |
| `/statistics` Biologia & Futuro V2 | `BiologyFutureV3.tsx` | **A/B** | `ChartPanel`, preset, `seriesStroke` |
| `/statistics` Potenziale & Progressi | `AnalyticsV2`, `AthletePotentialVector`, `PotenzialProgressiV2` | **B** | `V2Card/V2Header` delegano a `ChartCard/ChartHeader`; righe gauge responsive; radar con spazio per le etichette |
| `/statistics` Biomeccanica & Efficienza | `AnalyticsV3/V4/V5`, `FastBiomechanics`, `StatsDrift`, parte inline di `StatisticsView` | **B** | `Panel/LBPanel` → `ChartCard`; tooltip → `ChartTooltip`; via fili laterali, bracket, glow |
| `/statistics` Biologia & Futuro | `StatisticsView` (inline), `MainChart`, `AnaerobicThreshold`, `FitnessFreshness`, `SupercompensationChart` | **B** | `Card/CardHeader` → kit |
| `/statistics` Clima & Ritmo | `EnvironmentalNormalizerView` | **B** | sfondi atmosferici, fili laterali, titoli |
| `/statistics` Detraining | `BiologyFutureV2`, `BiologyFutureLab` | **B** | `Panel` e `Card/CardHeader` → kit; `borderTop` colorato rimosso |
| `/statistics` Calcolatore | `PaceCalculator` | **B** | colori e superfici |
| `/` Dashboard | `DashboardView`, `dashboard/widgets/*`, `VO2MaxChart`, `RacePredictions`, `TopStats`, `WeeklyStatsPanel`, `CardiacDrift`, `DetrainingWidget` | **B** | superfici piatte, tick 12 px, tooltip condiviso |
| `/training`, `/ranking` | `TrainingSidebar`, `RankingView` | **B** | `TrainingGrid`: solo testo ≥ 12 px (barra colorata **intatta**) |
| `/pace-lab`, `/race-lab` | `pacelab/*`, `racelab/*` | **C** + `Card` → `ChartCard` | stile editoriale (numeri di sezione, titoli in corsivo) mantenuto: identità propria dichiarata |
| `/gamification-v1`, `/runner-dna` | `GoalCone`, `AthleteEvolutionFramework`, `RunnerDnaView` | **C** | |
| `/badges`, `/profile`, `/activities` | | **D** | solo regola dei 12 px; nessun grafico Recharts |
| mappe, 3D, hero, celebrazioni, icone | | **—** | fuori ambito per vincolo |

## Eccezioni dichiarate (non sono difetti)

1. `TrainingGrid.tsx`: la barra colorata che codifica il tipo di seduta resta com'è (funzionale, istruzione esplicita).
2. Pace Lab e Race Lab conservano la voce editoriale (numeri di sezione `01…04`, domanda in corsivo): è la guida a un percorso, non una card di grafico.
3. Il tile ATL pieno lime del dashboard è un'enfasi voluta della vista, presente anche nella baseline.
4. Overlay (info, popover) mantengono un'ombra con offset reale.
5. `AnalyticsV5` conserva la numerazione "capitoli" e la tipografia monospazio "lab".

## Decisioni prese senza chiedere (reversibili)

- Palette proposta dal master prompt **non adottata** (motivi in `02-TOKENS.md`); modificato solo `projected` `#6366F1` → `#818CF8` (contrasto 4.3 → 6.5).
- Colori dei tipi di seduta nel grafico "Carico chilometrico" ora da `CHART_WORKOUT` (easy verde, long ciano, tempo ambra, intervalli rosa-rosso, gara lime): **cambia il colore delle barre**, non i dati.
- Rimosso l'import del font `Outfit` (mai usato).
- Rimossi vetro (blur + gradiente + ombra interna), fili laterali/superiori colorati, glow, bracket decorativi, titoli in corsivo.
- Tooltip, legende, selettori di intervallo, stati vuoti unificati nel kit.

## Difetti trovati dalla verifica a 360 / 390 / 768 px e corretti

Trovati con `responsive_probe` (overflow, clipping da `overflow:hidden`, tick fuori dal grafico, sovrapposizione dei tick, tocco → tooltip) su 12 viste × 3 viewport; ogni correzione è stata riverificata con la stessa sonda.

| Difetto | Dove | Correzione |
|---|---|---|
| Etichette degli assi tagliate (da 8 a 29 px) in 4 grafici | Clima & Ritmo; Biomeccanica (matrice cadenza/velocità); Potenziale & Progressi V2; Biologia & Futuro | un asse Y **nascosto** riservava comunque la larghezza del preset (40 px): ora `width={0}` su tutti gli assi nascosti (10 punti) e nel codemod; margini negativi *dentro un ternario* (`left: isExpanded ? -16 : …`) azzerati; asse con `unit` a 64 px; asse categorico a 96 px; primo tick temporale con `padding` |
| `/training` a 768 px: griglia schiacciata a ~140 px accanto alla sidebar da 350 px | `TrainingView` | sidebar fissa da `lg` (1024), sotto il pannello a scomparsa; **la barra colorata di `TrainingGrid` non è toccata** |
| Dashboard 768 px: anello "Status Forma" tagliato di 98 px | `DashboardView` | anello e metriche affiancati solo da `lg` |
| Dashboard 360 px: riga "Dislivello" tagliata di 12 px; selettore "1 mese … 2 anni" fuori di 23 px | `LastRunMap`, `FitnessChart` | riga con `flex-wrap`; il selettore ora è `ChartRangeSelector` (etichette `1M…2Y`, titolo esteso per i lettori di schermo) |
| Biomeccanica 360 px: riga "Real Telemetry Snapshot" fuori di 5 px | `AnalyticsV3` | `flex-wrap` |

**Esito dopo le correzioni:** 36 combinazioni vista × viewport, **0** overflow di documento, **0** elementi fuori dallo schermo, **0** contenuti tagliati da contenitori, **0** tick tagliati o sovrapposti.

## Debito `design:check` ridotto (da 776/384 a 590/115)

| Regola | Prima del lavoro | Dopo il primo passaggio | Ora |
|---|---|---|---|
| `hex` (esadecimale nel componente di grafico) | 776 | 750 | **590** |
| `tiny-text` (< 12 px) | 384 | 155 | **115** |
| `glass` (vetro / filo laterale) | — | 61 | 61 |
| `italic-title` | 13 | 12 | 12 |
| `local-tooltip-style` | 7 | 7 | 6 |
| `negative-margin` | — | 0 | 0 (regola estesa ai ternari) |

Come: il codemod mappa ora anche i valori alternativi dei ternari, le varianti di giallo/azzurro/lime e i neutri inline; la regola dei 12 px è stata estesa ad `AdaptationPanel`, `TrainingGoalBox`, `TrainingAdherence`, `FirstRunOnboarding`, `ErrorBoundary`; il tooltip del radar di `RankingView` è passato a `ChartTip`.
**Cosa resta e perché non è stato toccato:** `RoutesView`, `LastRunMap`, `LiveTelemetry3DMap` (mappe/3D, fuori ambito), `ProfileView`/`ActivitiesView`/`Sidebar`/`JarvisOverlay` (non sono grafici: vetro e micro-testo di quelle viste richiedono una decisione di design a parte), i colori dei livelli di `RankingView` (categorie: oro/rosa/azzurro) e le scale interne di colore di `RunnerDnaView`.

## Decisioni chiuse dopo la prima consegna

- **Codice morto eliminato** (decisione dell'utente): `StatsProgress.tsx` e `StatsCalc.tsx` (5 grafici mai renderizzati, nessun import) e i 5 blocchi `{false && …}` di primo livello che ne contenevano 13 (4 in `StatisticsView`, 1 in `AnalyticsV2`, ≈ 50 kB di sorgente). Eliminati con l'AST di TypeScript, non a mano; poi tolti a cascata gli import, le costanti, gli hook e i tipi rimasti senza utilizzatori (`useLoadFormLayout`, `LOAD_FORM_DEFAULT_LAYOUTS`, `mergeLocalLayouts`…, tutti usati solo da quel codice). Esito: ESLint `src` da 20 errori / 224 avvisi (su `main`) a **2 errori** (entrambi preesistenti e non correlati: `ProfileView`, `AnalyticsV4`) / 176 avvisi; nessun nuovo avviso.
- **Skill versionata** (decisione dell'utente): la skill sta ora in `.agents/skills/elite-analytics-charts/SKILL.md`, cartella tracciata come le altre. Claude Code la legge da `.claude/skills/` (cartella ignorata da git): su un nuovo clone va ricreato il collegamento, come per le altre skill (`.claude/skills/elite-analytics-charts` → `.agents/skills/elite-analytics-charts`, p.es. `New-Item -ItemType Junction` su Windows).

## Decisioni ancora aperte per l'utente

1. **Palette dei tipi di seduta** (e barra colorata di `TrainingGrid`): oggi quattro palette (TrainingGrid, TrainingSidebar, heatmap del Profilo, Carico km). `CHART_WORKOUT` è pronta; unificarle cambia la barra di `TrainingGrid` (vincolo: chiedere).
2. All'apertura `Clima & Ritmo` e il dashboard inviano `POST …/weather` per ogni corsa: con il backend locale scrivono sul Mongo di produzione.

## Debito residuo (misurato da `npm run design:check -- --report`)

`hex` 590 · `tiny-text` 115 · `glass` 61 · `italic-title` 12 · `contentStyle` 6 · margini negativi 0. La baseline è in `scripts/design-check.baseline.json` (60 file): il controllo fallisce solo se un file ne aggiunge.
Non migrati a mano: la maggior parte dei blocchi non-grafico (tabelle, liste, banner) dentro le viste analitiche; `AnalyticsV3` "Ground Contact Stability" conserva tile interne con stile proprio; i grafici a dispersione non mostrano il tooltip al tocco (limite di Recharts, vedi `05-VERIFICATION.md`); l'area vuota in fondo a "Biologia & Futuro" e la parte alta della hero "Vettore potenziale" su telefono sono **preesistenti** (identiche nella baseline).
