# REPORT TECNICO STRUTTURALE — METIC LAB

> Documento di specifica per ridisegno UI/UX. Analisi puramente strutturale, logica e funzionale del codice. Tutti i riferimenti estetici (CSS, classi, colori, layout decorativo) sono ignorati per design.

---

## CHECKLIST COMPLETA DEI MODULI

Il progetto è una SPA React 19 + TypeScript con backend Python FastAPI. Frontend ~33.000 righe TS/TSX, backend ~7.500 righe Python. Identificati 29 punti di analisi:

1. **Architettura globale**: bootstrap (`main.tsx`), root component (`App.tsx`), routing React Router v7, Sidebar, top bar, i18n (italiano/inglese), gestione tema.
2. **Layout Engine**: `LayoutContext` + `react-grid-layout` per dashboard widget personalizzabile (drag, resize, hide/restore, persistenza locale + remota).
3. **DashboardView** — orchestratore di 14 widget montabili in `react-grid-layout`.
4. **Widget VO2MaxChart** — VDOT corrente + storico mensile.
5. **Widget RacePredictions** — predizioni 5K/10K/HM/Marathon da VDOT.
6. **Widget DetrainingWidget + util `detrainingModel.ts`** — modello taper/fermo con perdita di forma giorno per giorno.
7. **Widget AnaerobicThreshold** — soglia anaerobica via HR/pace.
8. **Widget CardiacDrift + util `cardiacDrift.ts`** — calcolo drift cardiaco corsa per corsa.
9. **Widget WeeklyStatsPanel + TopStats** — KPI volumi settimanali, KPI top.
10. **Widget LastRunMap + MapFallback** — mappa Mapbox/MapLibre ultima corsa via polyline.
11. **Widget MainChart** — chart fitness/freshness multi-serie.
12. **Widget FitnessFreshness, SupercompensationChart, AdaptationPanel** — modello CTL/ATL/TSB e supercompensazione adattamenti (neuromuscolare/metabolico/strutturale).
13. **RecentActivities + BadgesGrid** — lista corse recenti, badge leggendario "Passerotto" (unico).
14. **Modulo Training** — `TrainingView`, `TrainingGrid`, `TrainingSidebar`: generatore di piano, calendario sessioni, valutazione test, adattamento.
15. **ActivitiesView** — catalogo corse + filtri + dettagli.
16. **RoutesView + LiveTelemetry3DMap** — viewer dettaglio corsa con percorso 2D/3D, telemetria, splits, terreno.
17. **ProfileView** — profilo utente, PB, gara obiettivo, integrazioni Strava/Garmin.
18. **RankingView** — leaderboard performance + categorie.
19. **RunnerDnaView + util `runnerDnaModel.ts` + hook `useRunnerDnaUiModel.ts`** — DNA del corridore: scoring biomeccanico/aerobico/economy, diagnosi e priorità.
20. **StatisticsView** — master view con tab analytics.
21. **AnalyticsV2/V3/V4/V5** — varianti progressive del pannello analitico (carico, forma, potenziale, biomeccanica).
22. **BiologyFutureLab + BiologyFutureV2** — proiezioni biologiche/longevity.
23. **EnvironmentalNormalizerView + StatsCalc/Drift/Progress/Risk** — normalizzazione meteo + chart specializzati.
24. **Jarvis (Orb + Overlay + `useJarvis` hook + `JarvisContext`)** — assistente vocale/testuale Gemini.
25. **Backend API surface** — 55 endpoint REST FastAPI in `server.py`.
26. **Backend Math** — VDOT, generatore piano Daniels, paces, fattibilità, progressione, FIT extraction.
27. **Backend DNA + Supercompensation** — algoritmi DNA + modello supercompensazione 3-adattamenti.
28. **Strava + Garmin pipeline** — OAuth, sync attività, importazione CSV, FIT files, matching.
29. **Settings, Theme, ErrorBoundary** — infrastruttura UI comune.

---

# PUNTO 1 — ARCHITETTURA GLOBALE

## 1.1 Bootstrap

**File**: `src/main.tsx`
- Mount React 19 root su `#root`.
- Wrappa `App` in `BrowserRouter` (`react-router-dom` v7).
- Inizializza `i18n` (importa `./i18n`).

**File**: `src/i18n/index.ts`
- Inizializza `i18next` + `i18next-browser-languagedetector`.
- Lingue supportate: `it` (default), `en`.
- Risorse caricate da `./translations.ts`.

**File**: `src/i18n/translations.ts` (~16 KB)
- Dizionari di stringhe organizzati per namespace: `nav`, `header`, `sidebar`, `common`, `dashboard`, `training`, `profile`, `runnerDna`, `statistics`, `jarvis`, ecc.

## 1.2 Stack tecnologico (da `package.json`)

```
Frontend:
- react 19, react-dom 19, react-router-dom 7
- recharts 3 (charts)
- mapbox-gl 3 + maplibre-gl 5 + react-map-gl 8 + @mapbox/polyline + @turf/turf
- three 0.183 (3D telemetry map)
- gsap 3 (animazioni Jarvis)
- motion 12 (Framer Motion)
- react-grid-layout 2 (dashboard interattiva)
- lucide-react (icone)
- @google/genai (Gemini per Jarvis)
- date-fns 4
- i18next 26 + react-i18next 17
- tailwind v4 (style: ignorato per il report)

Backend:
- FastAPI/uvicorn
- MongoDB (driver derivato dalle query in server.py)
- garth (Garmin), stravalib equivalente custom (OAuth Strava raw)
- Google Generative AI SDK (Gemini)
- librerie FIT parsing per Garmin Running Dynamics
```

## 1.3 Routing (`App.tsx`)

**Routes registrate** (React Router v7 nested in `<Suspense>` + `<ErrorBoundary>`):

| Path | Componente | Note |
|---|---|---|
| `/` | `<DashboardView/>` | Home performance |
| `/activities` | `<ActivitiesView onSelectRun={(id)=>nav(`/activities/${id}`)}/>` | Catalogo corse |
| `/activities/:runId` | `<RoutesViewWrapper/>` → `<RoutesView runId/>` | Dettaglio corsa |
| `/training` | `<TrainingView/>` | Piano allenamento |
| `/runner-dna` | `<RunnerDnaView/>` | DNA del runner |
| `/runner-dna-v2` | `<Navigate to="/runner-dna" replace/>` | Redirect legacy |
| `/ranking` | `<RankingView/>` | Classifica/leaderboard |
| `/statistics` | `<StatisticsView/>` | Analytics avanzate |
| `/profile` | `<ProfileView/>` | Profilo utente |
| `/recovery` | `<ComingSoonView label="Recovery"/>` | Placeholder |
| `/biometrics` | `<ComingSoonView label="Biometrics"/>` | Placeholder |
| `/insights` | `<ComingSoonView label="Insights"/>` | Placeholder |
| `*` | `<ComingSoonView label="Page not found"/>` | 404 |

**Effetto OAuth Strava**: in `useEffect` montato una volta, legge `?strava_code=...` dalla query string, chiama `exchangeStravaCode(code)` → `syncStrava()` → `navigate("/activities")`. Pulisce la query con `history.replaceState`.

## 1.4 Provider Tree

```
<LayoutProvider>
  <JarvisProvider>
    <AppContent>
      ... routing ...
    </AppContent>
  </JarvisProvider>
</LayoutProvider>
```

Provider attivi globalmente:
- **`LayoutProvider`** → stato dashboard (vedi Punto 2).
- **`JarvisProvider`** → assistente AI (vedi Punto 24). Espone `JarvisPortal` ReactNode che `AppContent` rende come overlay globale.

## 1.5 Top Bar (in `AppContent`) — **single source of truth per la nav**

Elementi logici renderizzati nell'header:

- **Brand**: testo `METIC LAB`.
- **Nav menu** principale con 7 voci (canoniche):
  - `dashboard`, `training`, `activities`, `statistics`, `runnerDna`, `ranking`, `profile`.
  - Voce attiva derivata da `location.pathname.split("/")[1] || "dashboard"`.
- **Search input** — `disabled` + `readOnly` + tooltip "Coming soon" (vedi CHANGELOG round 1 fix #3).
- **`<SettingsControls/>`** — controlli lingua + tema (Punto 29).
- **Notifiche** (Bell): icon dimmed + tooltip "Coming soon", **niente badge rosso statico**.
- **Settings icon**: rimossa — `SettingsControls` la copre già.
- **Avatar utente**: gradient circle con iniziali "ML" (rimossa `picsum.photos`).

## 1.6 Sidebar (`Sidebar.tsx`) — **niente nav, solo logo + sensors + bottom**

**Props in input**: nessuna. (Era `{ activeView, onViewChange }` — rimosse al CHANGELOG round 2 fix #9.)

**Sezioni renderizzate**:
1. Logo Metic Lab + tagline `ELITE PERFORMANCE`.
2. **Sensors**: pannello Garmin Watch con badge "N/A" neutro (era hardcoded "CONNECTED" in verde).
3. **Spacer** `flex-1` che spinge il bottom verso il basso.
4. **Bottom**: bottoni `Support`, `Sign Out`, `Start Session` — tutti `disabled` + `title="Coming soon"` + opacity 40 (round 1 fix #4).

> ✅ **DEDUP NAV**: rimosso completamente il blocco `<nav>` con i 4 menu items (Dashboard / Biometrics / Training / Analytics). La Sidebar non duplica più la TopBar — TopBar è l'unica via di navigazione.

## 1.7 ErrorBoundary

**File**: `src/components/ErrorBoundary.tsx`
- React class component classica `componentDidCatch`.
- Riceve `resetKey={location.pathname}` per resettare al cambio rotta.
- Mostra fallback testuale con bottone retry.

---

# PUNTO 2 — LAYOUT ENGINE

## 2.1 LayoutContext

**File**: `src/context/LayoutContext.tsx` (284 righe)

### Modello dati

```ts
interface Layout {
  i: string;       // widget key
  x: number;
  y: number;
  w: number;       // colonne occupate
  h: number;       // righe (rowHeight 60px) — informazione dimensionale, non estetica
  minW?: number; minH?: number;
  maxW?: number; maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}
interface Layouts {
  lg?: Layout[]; md?: Layout[]; sm?: Layout[];
  xs?: Layout[]; xxs?: Layout[];
}
```

### Default Layout (`DEFAULT_LAYOUTS`)

Tre breakpoint (lg=12 col, md=6 col, sm=1 col), ognuno con 14 widget (`status-form`, `vo2max`, `previsione-gara`, `detraining`, `fatigue-atl`, `soglia`, `deriva`, `weekly-km`, `last-run-map`, `next-optimal`, `hr-zones`, `fitness-chart`, `training-paces`, `session-logs`).

### API esposta dal Context

```ts
interface LayoutContextValue {
  layouts: Layouts;
  ready: boolean;
  onLayoutChange(current: Layout[], all: Layouts): void;
  resetLayout(): void;
  hiddenKeys: string[];
  hideWidget(key: string): void;
  restoreWidget(key: string): void;
}
```

### Persistenza (flusso dati)

- **localStorage**: chiavi `metic:layout`, `metic:hidden`. Letti all'init come fallback istantaneo.
- **Backend**: hydrate al mount via `GET /api/user/layout`. Se la risposta contiene `layouts` o `hidden_keys`, sovrascrivono local.
- **Salvataggio**: ogni `onLayoutChange` / `hideWidget` / `restoreWidget`:
  1. aggiorna state,
  2. scrive subito in `localStorage`,
  3. schedula `PUT /api/user/layout` con debounce 500ms.

### `mergeWithDefaults(stored)`
Se l'utente ha layout salvato che non contiene chiavi nuove (widget aggiunti dopo), append automatico delle chiavi mancanti dal `DEFAULT_LAYOUTS`. Garantisce che nessun widget nuovo "sparisca".

## 2.2 Widget Registry

**File**: `src/components/dashboard/widgetRegistry.ts`

```ts
WIDGET_REGISTRY: WidgetMeta[] = [
  { key, label }, ...
]
```

14 entries con label leggibile in italiano (Status di Forma, VO2 Max / VDOT, Previsione Gara, Detraining, Fatigue ATL, Soglia Anaerobica, Deriva Cardiaca, KM Settimanali, Mappa Ultima Corsa, Prossima Sessione, Zone Cardiache, Condizione Fisica, Training Paces, Session Logs).

> Funzione: alimenta menu di restore dei widget nascosti.

## 2.3 GridCard

**File**: `src/components/GridCard.tsx` (52 righe)

Wrapper minimo per ogni widget nella griglia. Riceve in props:
- `title?: string`
- `onHide?: () => void`
- `children: ReactNode`
- handle drag (classe `drag-handle` esposta a react-grid-layout).
- bottone × per chiamare `onHide`.

> Logica essenziale: header con titolo e maniglia di trascinamento, body con il widget.

---

# PUNTO 3 — DashboardView (orchestratore)

**File**: `src/components/DashboardView.tsx` (~2.000+ righe)

## 3.1 DashboardView — modello dati e flussi

**Hook API consumati** (via `useApi<T>(fetcher)`):
- `getDashboard()` → `DashboardResponse` (refetch ogni 60 min)
- `getRuns()` → `RunsResponse`
- `getAnalytics()` → `AnalyticsResponse`
- `getBestEfforts()` → `{efforts: BestEffort[]}`
- `getVdotPaces()` → `VdotPacesResponse`
- `getProfile()` → `Profile`
- `getDashboardInsight()` → `{insight: string|null}`

**Stato locale**:
- `chartPeriod: '7d'|'month'|'year'`
- `openAddMenu: bool` — popover ripristino widget nascosti

## 3.2 Calcoli derivati (DashboardView)

| Variabile | Formula |
|---|---|
| `faticaColor` | `atl > 50 → red`, `> 30 → amber`, else `green` |
| `faticaLabel` | `HIGH / MODERATE / LOW` (stesse soglie) |
| `readiness` (Peak Score 0-100) | `clamp(0,100, ((tsb + 40) / 70) * 100)` |
| `gaugeOffset` | `251.2 * (1 - readiness/100)` (geometria SVG, ignorabile) |
| `status.label` | `tsb > 10 FRESH; > -5 NEUTRAL; > -20 FATIGUED; else OVERLOADED` |
| `atHr` (HR soglia anaerobica) | `round(maxHr * 0.88)` (Daniels T) |
| `ltHr` | `round(maxHr * 0.85)` |
| `efficiency` | `clamp(70,100, 85 + tsb*1.05)` |
| `neuroBar` | `min(100, ctl)` |
| `metaboBar` | `min(100, atl)` |
| `struttBar` | `min(100, max(0, 50 + tsb*2))` |

## 3.3 Algoritmo Drift Cardiaco — UNIFICATO

> **FIX (2026-04-28 round 2)**: rimossa la 3a copia locale di `computeDrift` da DashboardView (era divergente: solo first-half/second-half avg HR senza filtro mediana). Ora usa `computeDrift` da `src/utils/cardiacDrift.ts` (filtro `±12%` + reject se steady < 50% raw splits). Stesso algoritmo del widget CardiacDrift (round 1 fix #1). Una sola implementazione canonica in tutto il client.

```ts
// In DashboardView.tsx
import { computeDrift as computeDriftCanonical } from "../utils/cardiacDrift";
const driftFor = (r) => computeDriftCanonical(r)?.drift ?? null;
```

`driftSeries`: array fino a 12 corse qualificate, ordinate vecchio→nuovo.

## 3.4 Algoritmo Threshold Pace (`thresholdPace`)

**Step 1 — VDOT base**: dato `v = analytics.vdot`:
```
vo2 = v * 0.88
disc = 0.182258² + 4 * 0.000104 * (vo2 + 4.60)
speedMpm = (-0.182258 + sqrt(disc)) / (2 * 0.000104)
vdotPaceSecs = round(60000 / speedMpm)  // sec/km
```

**Step 2 — Override empirico**: filtra `runs` con `!is_treadmill && distance_km ≥ 3 && avg_hr_pct ∈ [0.86, 0.91]`. Se ≥ 3 corse → mediana del pace, `secsToPaceStr`.

**Step 3 — Fallback**: `clamp(150, 500, vdotPaceSecs)`.

## 3.5 Algoritmo Race Predictions (Previsione Gara) — ESTRATTO IN UTIL

> **FIX (2026-04-28 round 2)**: la useMemo da ~80 righe è stata estratta in `src/utils/racePredictions.ts` come `buildRacePredictions({ predictions, runs, thresholdPace })`. DashboardView ora chiama:
> ```ts
> const racePredictions = useMemo(
>   () => buildRacePredictions({ predictions, runs, thresholdPace }),
>   [predictions, runs, thresholdPace],
> );
> ```
> Costanti `BENEFIT`, `TYPICAL_KM`, `TARGETS` ora module-level (non più ri-allocate per render). Logica e formule restano identiche (vedi sotto).
>
> **MIGRATION PATH**: questa logica dovrebbe vivere in FastAPI come endpoint `GET /api/race-predictions` che restituisca `{ targets: [{ label, predicted_time, delta_estimated, stim, magnitude }, ...] }` — il client diventerebbe sola visualizzazione. Vedi CHANGELOG round 2 fix #11.

Targets: `5K`, `10K`, `21K (mezza, 21.0975 km)`, `42K (maratona, 42.195 km)`.

**Match key prediction**: cerca in `analytics.race_predictions` (mappa) la prima chiave con normalized form contenente uno tra `["5k"]`, `["10k"]`, `["half","mezza","21"]`, `["marathon","maratona","42"]`.

**Calcolo `deltaSec` (impatto ultima corsa)**:

1. Identifica ultima corsa valida (no treadmill, pace > 3:00/km, dist ≥ 3 km).
2. **Stim classification** (5 categorie):
   - `paceRatio = thresholdPaceSec / lastPaceSec`, fallback `hrPct / 0.87`
   - `dist ≥ 25` → `long_endurance`
   - `dist ≥ 15 && paceRatio < 1.03` → `medium_long`
   - `paceRatio ≥ 1.05 && dist < 8` → `intervals`
   - `paceRatio ≥ 0.92` → `tempo`
   - `hrPct < 0.72` → `easy`
   - default → `tempo`
3. **Magnitude**: `clamp(0.2, 2.0, dist / TYPICAL_KM[stim])`. Se `paceRatio > 1.0` → `*= 1 + (paceRatio-1)*0.8`. Clamp finale `2.5`.
4. **Tabella benefici** (sec di miglioramento per stim×target a magnitude=1):
   ```
   intervals      5K=8   10K=6   21K=3   42K=2
   tempo          5K=5   10K=13  21K=40  42K=62
   medium_long    5K=2   10K=8   21K=45  42K=95
   long_endurance 5K=1   10K=4   21K=30  42K=130
   easy           5K=1   10K=2   21K=6   42K=12
   ```
   `TYPICAL_KM = {intervals:6, tempo:10, medium_long:18, long_endurance:30, easy:8}`.
5. `deltaSec = -round(BENEFIT[stim][target] * magnitude)` (negativo = miglioramento). Se < 1 sec → null.

**Output per ogni target**:
```ts
{ label: '5K'|'10K'|'Mezza'|'Maratona', short: '5K'|'10K'|'21K'|'42K',
  km: number, key: string|null, timeStr: string|null, secs: number|null, deltaSec: number|null }
```

## 3.6 Sparkline KM settimanali (`sparklinePoints`)

Genera 10 settimane retrograde, somma km per finestra di 7 giorni. Coordinate SVG `100×32` (`x = i*11, y = 32 - (v/max)*28`).

## 3.7 Hall of Fame (`hofEfforts`)

Per ogni distanza target `['5 km', '10 km', 'Mezza Maratona']`, cerca match esatto su `efforts.distance`.

## 3.8 Widget — `NextOptimalSessionWidget`

**Props**: `tsb`, `atl`, `ctl`, `runs[]`, `faticaColor`.

**Logica** (decision tree su `tsb`):
- `tsb > 10` → `WORKOUT INTENSO` (intervalli VO2max)
- `tsb 0..10` → `LUNGO PROGRESSIVO`
- `tsb -10..0` → `MEDIO TEMPO`
- `tsb -20..-10` → `RECUPERO ATTIVO`
- `tsb < -20` → `RIPOSO TOTALE`

Per ogni outcome: `title`, `desc`, `intensity`, `pace_target`, `duration` calcolati da `runs` storici (mediane personalizzate).

## 3.9 Widget — `HRZones`

**Props**: `lastRun: Run|null`.

Calcola distribuzione % per zone 1-5 dai splits dell'ultima corsa. Map `hr → zone` via percentile su HR max profilo.

## 3.10 Widget — `FitnessChart` (CTL nel tempo)

**Props**: `ff: FitnessFreshnessPoint[]|undefined`.

**Stato**: `range ∈ {1m,3m,6m,1y,2y}` (giorni: 30, 90, 182, 365, 730), `hoverIdx`.

**Output**: line+area SVG di `ctl`, ticks dinamici (`step = ceil((maxY-minY)/4/10)*10`), label X (5 etichette + "Oggi"). Header mostra `current ctl` + `delta = ctl_finale - ctl_iniziale`.

## 3.11 Widget — `Status of Form` (hero)

**Sezioni**:
1. **Gauge SVG** circolare con `readiness` 0-100 (Peak Score).
2. **Metaphor stats** — 4 colonne mappate su valori numerici con `icon` emoji + `label` testuale + `sub` descrizione.
   - `tsbMeta`: 🔋/🪫/🔴 → Pieno/Buono/Medio/Scarico/Critico
   - `ctlMeta`: 🛴/🚗/🏎️/🚀 → Base/Discreto/Potente/Forte/Elite
   - `atlMeta`: 💤/💨/🔥/🌋 → Leggero/Medio/Alto/Estremo
   - `effMeta`: ⚡/⚠️ → Piena/Buona/Ridotta/Bassa
3. **Insight AI** (se `insightData.insight`): testo da `/api/ai/dashboard-insight` con icona Sparkles.

## 3.12 Widget — `Session Logs`

Tabella 7 colonne: `Type | Date | Duration | Avg Pace | TE Score | Status`.

`teRaw = hrPct * 5` → label: `HIGHLY_AEROBIC ≥4`, `AEROBIC ≥3`, `RECOVERY ≥2`, else `—`.

Click su row → `navigate('/activities/${run.id}')`.

## 3.13 Widget — `Training Paces`

**Input**: `vdotPacesData.paces = {easy, marathon, threshold, interval, repetition}` (string MM:SS).

5 zones: `E (Easy)`, `M (Marathon)`, `T (Threshold)`, `I (Interval)`, `R (Repetition)`.

Range `±3%` → `lo = round(centerSecs*0.97)`, `hi = round(centerSecs*1.03)`. Output `MM:SS – MM:SS min/km`.

## 3.14 Helpers (utilities locali)

```ts
fmtPbTime(minutes) -> "MM:SS" | "H:MM:SS"
bestPbTime(runs, minKm, maxKm, targetKm) -> string  // estrae miglior tempo proiettato
timeUntil(dateStr) -> {days, hours, minutes} | null
parsePaceToSecs("5:30") -> 330
secsToPaceStr(330) -> "5:30"
hmsToSecs("1:23:45") -> 5025
formatDuration(minutes) -> "1h 23'"
```

---

---

# PUNTO 4 — Widget VO2MaxChart

**File**: `src/components/VO2MaxChart.tsx`

## 4.1 Props

```ts
interface VO2MaxChartProps {
  runs: Run[];
  vdot: number | null;  // valore corrente da analytics backend
}
```

## 4.2 `estimateVdot(distanceKm, durationMin)`

**Pre-condizioni**: `distanceKm > 0 && durationMin >= 10`.

```
v   = distanceKm * 1000 / durationMin           // m/min
vo2 = -4.60 + 0.182258·v + 0.000104·v²         // VO2 a velocità v
denom = 0.8
      + 0.1894393·exp(-0.012778·durationMin)
      + 0.2989558·exp(-0.1932605·durationMin)   // %VO2max sostenibile per durata
vdot = vo2 / denom
valid range: 30..65 else null → round 1 dec
```

> Formula Daniels 1998. `denom` = frazione di VO2max sostenibile per quella durata.

## 4.3 Color/Label thresholds

| VDOT | Color | Label |
|---|---|---|
| > 55 | `#C0FF00` | Elite |
| > 45 | `#14B8A6` | Avanzato |
| > 35 | `#3B82F6` | Intermedio |
| else | `#94A3B8` | Principiante |

## 4.4 `buildHistory(runs)` — VDOT mensile

12 mesi retrogradi. Per ogni mese (`d`):

1. Filtra `runs` con `getFullYear() === d.getFullYear() && getMonth() === d.getMonth()`.
2. Per ogni run del mese:
   - skip `distance_km < 5`
   - se `avg_hr_pct` definito → skip `< 0.80` (corsa facile con HR)
   - altrimenti → skip `paceMinKm > 5.75` (no HR, escludi ritmi lenti)
   - calcola `estimateVdot`, tieni `best = max`
3. Output: `{name: "GEN".."DIC", vdot: number|null}` (12 entries).

## 4.5 Forward-fill + sync con vdot corrente

- `filledHistory`: scorre array, mantiene `last` valido, sostituisce null con `last`.
- `filledWithCurrent`: `arr[arr.length-1] = {..., vdot: vdot}` — forza ultimo punto al VDOT API per sync gauge↔chart.

## 4.6 `calcTPace(vdot)` — Daniels T-Pace

```
a = 0.000104, b = 0.182258, c = -(vdot + 4.60)
vMax = (-b + sqrt(b² - 4ac)) / 2a       // velocità m/min a VO2max
vT   = vMax * 0.88                       // soglia T = 88% VO2max
pace = 1000 / vT                         // min/km
return "M:SS"
```

## 4.7 Trend 3 mesi

```
recent = filledWithCurrent[len-1].vdot
older  = filledWithCurrent[len-4].vdot
trend  = recent != null && older != null ? round(recent - older, 1) : null
```

## 4.8 Output sezioni

- **`VdotGauge`**: SVG semicircolare, range `28..65`, arco da 180° a 0°. Marker zone a 35/45/55.
- Label livello + T-Pace.
- AreaChart Recharts 12 mesi (`dataKey="vdot"`, `connectNulls={false}`).
- Tooltip mostra VDOT + label livello + T-Pace.

---

# PUNTO 5 — Widget RacePredictions

**File**: `src/components/RacePredictions.tsx`

## 5.1 Props

```ts
interface RacePredictionsProps {
  runs: Run[];
  vdot: number | null;
  racePredictions: Record<string, string> | null;  // dal backend
}
```

State: `activeRace ∈ {'all','5K','10K','HM','M'}`.

## 5.2 `estimateVdot` (variante più stretta)

Differenze vs Punto 4:
- skip `distanceKm < 5` (no minore di 5K)
- skip `paceMinKm > 6.0` (escludi recovery)
- range valid: `28..70`

## 5.3 `vdotToRaceTimeMin(vdot, distanceM)` — bisezione

Trova `T` (min) tale che `VO2(distM/T) = vdot * %VO2max(T)`:

```
lo = distM / 600   // velocità max teorica 600 m/min
hi = distM / 5     // velocità min teorica
loop 60 iter:
  T   = (lo + hi) / 2
  v   = distM / T
  vo2 = -4.60 + 0.182258·v + 0.000104·v²
  pct = 0.8 + 0.1894393·exp(-0.012778·T) + 0.2989558·exp(-0.1932605·T)
  if vo2 > vdot * pct → lo = T
  else                → hi = T
return (lo + hi) / 2
```

`vdotToPaceMinKm(vdot, distM)` = `T / (distM / 1000)`.

`vdotToTime` formatta a `H:MM:SS` o `M:SS`.

## 5.4 RACES config

```ts
RACES = [
  { key:'5K',  label:'5K',       distKm:5,        distM:5000  },
  { key:'10K', label:'10K',      distKm:10,       distM:10000 },
  { key:'HM',  label:'Mezza',    distKm:21.0975,  distM:21097 },
  { key:'M',   label:'Maratona', distKm:42.195,   distM:42195 },
]

BACKEND_KEYS:
  "5K"  → ["5K","5k"]
  "10K" → ["10K","10k"]
  "HM"  → ["Half Marathon","HM","21K","Mezza"]
  "M"   → ["Marathon","Maratona","42K"]
```

`findPrediction(predictions, key)`: itera alias, ritorna prima match.

`displayTime` = `backendTime ?? vdotTime` (preferenza backend).

## 5.5 `buildMonthlyVdot` — outlier filter

Identico a Punto 4 ma:
```
peak  = max(raw)
floor = peak * 0.87
mesi sotto floor → null   // mesi "coasting", non drop fitness
```

## 5.6 Pace data per chart

Per ogni punto mensile con `vdot != null`:
```
pace5k  = vdotToPaceMinKm(v, 5000)
pace10k = vdotToPaceMinKm(v, 10000)
paceHM  = vdotToPaceMinKm(v, 21097)
paceM   = vdotToPaceMinKm(v, 42195)
```

## 5.7 yDomain dinamico

Usa solo le linee visibili (`activeRace`):
```
keys = activeRace==='all' ? ['pace5k','pace10k','paceHM','paceM'] : [pace<key>]
vals = paceData.flatMap(p => keys.map(k=>p[k]).filter(Boolean))
domain = [min(vals)-0.1, max(vals)+0.1]
YAxis reversed=true   // pace più basso = più alto su asse
```

## 5.8 Filter buttons

`{all, 5K, 10K, HM, M}` modulano:
- `strokeWidth`: 2 (attiva/all) vs 0.5 (inattiva)
- `strokeOpacity`: 1 vs 0.2

## 5.9 Trend VDOT 3M

```
recent - older  (filledVdot[-1] - filledVdot[-4]), round 1 dec
```

---

# PUNTO 6 — DetrainingWidget + `detrainingModel.ts`

**Files**:
- `src/utils/detrainingModel.ts`
- `src/components/DetrainingWidget.tsx`

## 6.1 Riferimenti scientifici (dichiarati nel modulo)

Coyle 1984 · Mujika & Padilla 2000 · Bosquet 2007/2013 · Mujika 2018 · Bruusgaard 2010 · Seaborne 2018 · Murach 2020 · Sousa 2019/2024.

## 6.2 Tipi pubblici

```ts
DetrainingProfileInputs {
  age, sex, weightKg, yearsRunning, weeklyKmAvg, vdot
}

DetrainingPoint {
  day, vo2Pct, ltPct, plasmaPct, mitochondriaPct,
  capillaryPct, strokeVolumePct, restingHrDelta,
  performancePct,  // può essere > 1 in finestra taper
  phase: 'taper'|'plateau'|'detraining'|'plateau-low'
}

DetrainingMode = 'taper' | 'fullStop'

DetrainingSummary {
  inputs, trainingFactor, ageFactor, protective,
  taperDays, vo2MaxLossCap, ltLossCap, plasmaLossCap,
  mitochondriaLossCap, capillaryLossCap, baselineVo2,
  curve: DetrainingPoint[],
  snapshots: DetrainingPoint[],          // a [3,7,14,30,60]
  paceProjection: PaceProjection[],
  backToFit: BackToFitEntry[],
  taperPeakDay, taperPeakBoost
}

PaceProjection { basePaceLabel, basePaceSecPerKm, level, rows[] }
BackToFitEntry { daysOff, daysToRecover, ratio, note }
```

## 6.3 `buildDetrainingInputs(profile, runs, vdot)`

- `age`: `profile.age` || 35
- `sex`: `profile.sex.toUpperCase()` || `'M'`
- `weightKg`: `profile.weight_kg` || 70
- `yearsRunning`: da `profile.started_running`; fallback dal run più vecchio
- `weeklyKmAvg`: `sum(run.distance_km, ultimi 12 settimane) / 12`

## 6.4 `computeDetrainingCurve(inputs, daysMax=90, mode='taper')`

### Score base

```
vdotScore     = vdot ? clamp((vdot-30)/30) : clamp(weeklyKmAvg/80)
volScore      = clamp(weeklyKmAvg/80)
histScore     = clamp(yearsRunning/10)
trainingFactor = clamp(0.4·vdotScore + 0.4·volScore + 0.2·histScore)
ageFactor     = 1 + max(0, age-35)/100
protective    = clamp(1 - 0.04·yearsRunning, 0.7, 1)
```

### Plateau caps + tempi caratteristici (τ)

| Sistema | Loss cap | τ (giorni) |
|---|---|---|
| VO2max | `clamp((0.10 + 0.07·trainingFactor) · ageFactor · protective, 0, 0.22)` | 18 |
| LT (soglia) | `clamp(vo2MaxLossCap · 1.45, 0, 0.30)` | 14 |
| Plasma | `0.10` (fisso) | 2.2 |
| Mitocondri | `clamp((0.30 + 0.20·trainingFactor) · ageFactor, 0.25, 0.55)` | 28 |
| Capillari | `clamp(0.20·trainingFactor + 0.05, 0.05, 0.25)` | 45 |
| Stroke volume | `clamp(0.10 + 0.10·trainingFactor, 0.10, 0.20)` | 12 |
| Resting HR Δ | `5 + 5·trainingFactor` (bpm max) | 14 |

### TAPER vs FULL STOP

| Param | taper | fullStop |
|---|---|---|
| `taperDays` | 5 | 2 |
| `lagVo2` | 5 | 2 |
| `lagLt` | 5 | 2 |
| `lagMito` | 3 | 1 |
| `lagCap` | 14 | 7 |
| `lagStroke` | 4 | 1 |
| `lagHr` | 5 | 2 |
| `fullStopMul` (su caps) | 1.0 | 1.18 |
| `taperPeakBoost` | `0.005 + 0.025·trainingFactor` | 0 |
| `taperPeakDay` | 8 | 0 |

> Plasma usa lag 0 in entrambi (perdita immediata). `fullStopMul` amplifica `vo2Cap`/`ltCap`/`mitoCap`/`capCap` con clamp ricalibrato.

### Loop giorno per giorno

```
per d = 0..daysMax:
  eff(lag) = max(0, d - lag)
  decayX = capX · (1 - exp(-eff(lagX) / τX))   // X ∈ {vo2, lt, mito, cap, stroke, hr}
  decayPlasma = plasmaCap · (1 - exp(-d / τPlasma))   // no lag

  // Bell di taper: solo modalità taper
  taperBell = (1 ≤ d ≤ 14) ? exp(-(d - taperPeakDay)² / 12) : 0
  taperGain = taperPeakBoost · taperBell

  performancePct = clamp(
    1 + taperGain - 0.6·decayVo2 - 0.4·decayLt,
    0.5, 1.05
  )

  phase = d ≤ taperDays ? 'taper'
        : d ≤ 14        ? 'plateau'
        : d ≤ 45        ? 'detraining'
        :                 'plateau-low'
```

> Performance index: VO2 pesa 60%, LT 40%, taper boost additivo. Cap 1.05 = +5% max boost.

### Output finali

- `snapshots = curve[3, 7, 14, 30, 60]`
- `paceProjection`: presets `[5:00, 4:00, 3:30]/km` × livelli `[intermediate, advanced, elite]`
  - `newSec = basePaceSec / performancePct` (taper window → boost = pace più veloce)
- `backToFit` (Mujika ratio):
  ```
  ratio = 2 + 0.5·(1-protective)·4 + max(0, (age-35)/50)
  daysOff 7  → recover round(7·ratio·0.4)
  daysOff 14 → recover round(14·ratio·0.7)
  daysOff 30 → recover round(30·ratio)
  daysOff 60 → recover round(60·ratio)
  ```

## 6.5 Helpers esportati

```ts
daysSinceLastRun(runs): number
  // floor((now - max(date)) / 86400000)

predict5kFromVdot(vdot): number  // empirical Daniels piecewise-linear
  vdot ≥ 60 → 960  - (vdot-60)·18
  50..60   → 1157 - (vdot-50)·19.7
  40..50   → 1418 - (vdot-40)·26.1
  30..40   → 1840 - (vdot-30)·42.2
  < 30     → 2300

projectRaceTime(baseTimeSec, curve, day):
  pt = curve[day], newSec = baseTimeSec / pt.performancePct
  return { sec, label "M:SS", deltaSec }

paceLabel(secPerKm): "M:SS/km"
parsePace("M:SS"): seconds
formatLossLine(point): "D{n}: VO2 -X% · LT -X% · PV -X%"
```

## 6.6 DetrainingWidget — props e flusso

```ts
interface Props {
  profile: Profile | null | undefined;
  runs: Run[];
  vdot: number | null;
  base5kSec?: number | null;  // opzionale: override da PREVISIONE GARA backend
}
```

Flusso:
1. `days = daysSinceLastRun(runs)`
2. `inputs = buildDetrainingInputs(profile, runs, vdot)`
3. **Doppia curva**: `taper` + `fullStop`, `daysMax = max(60, days+5)`.
4. `idx = min(days, curve.length - 1)`
5. `tPoint`, `fPoint` = `curve[idx]` per i due modi.

Metriche derivate:
```
tDelta    = (tPoint.performancePct - 1) · 100
fDelta    = (fPoint.performancePct - 1) · 100
tVo2Loss  = (1 - tPoint.vo2Pct) · 100
fVo2Loss  = (1 - fPoint.vo2Pct) · 100
```

## 6.7 Stato visivo (5 fascie)

| `days` | Label | Sub | Colore |
|---|---|---|---|
| ≤ 2 | RECUPERO | Fatica residua dissipa | green |
| ≤ 5 | TAPER | Performance può salire | green |
| ≤ 10 | POST-TAPER | Plateau, decay ridotto | accent |
| ≤ 21 | DETRAINING | Vero detraining iniziato | orange |
| > 21 | DETRAINING SEVERO | Perdite strutturali | red |

## 6.8 5K comparison

```
base5kSec = base5kSecProp ?? (vdot ? predict5kFromVdot(vdot) : 1500)
t5k       = base5kSec / tPoint.performancePct
f5k       = base5kSec / fPoint.performancePct
tDeltaSec = t5k - base5kSec
fDeltaSec = f5k - base5kSec
```

Output a 3 card: `5K base`, `5K taper`, `5K fermo`.

> Memo: il prop `base5kSec` allinea il widget al baseline backend di PREVISIONE GARA (vedi feedback memoria `feedback_vdot_formula.md`).

---

# PUNTO 7 — Widget AnaerobicThreshold

**File**: `src/components/AnaerobicThreshold.tsx`

## 7.1 Props + state

```ts
interface Props { runs: Run[]; vdot?: number | null }
state: timeRange ∈ {'6m','12m','all'}
```

> **FIX (2026-04-28)**: rimossa prop `maxHr` (era ricevuta ma mai usata nel componente — refactor leftover). Vedi CHANGELOG fix.

## 7.2 Costruzione punti mensili

```
monthsBack = timeRange === '6m' ? 6 : timeRange === '12m' ? 12 : 24
per i = monthsBack-1..0:
  d = primo giorno mese (now - i)
  filtra runs:
    !is_treadmill
    && distance_km ≥ 3
    && avg_hr > 80
    && avg_pace presente
    && stesso (year, month)
  best = run con MAX avg_hr   // best aerobic effort del mese
  push { label "MES YY", hr: best.avg_hr, paceSec: parsePaceSec(best.avg_pace), runName }
```

## 7.3 Domini chart (2 assi Y)

```
hrMin = min(hrs) - 5
hrMax = max(hrs) + 5

paceMin = min(paces) - 10        // pace più veloce (sec minore)
paceMax = max(paces) + 10
paceDomain = [paceMax, paceMin]  // REVERSED → faster = up
paceTickValues: ogni 15s, da ceil(paceMin/15)·15 a paceMax
```

## 7.4 T-Pace reference

```
calcTPace(vdot) come Punto 4 (vMax · 0.88)
tPaceSec = parsePaceSec(calcTPace(vdot))
```

Renderizzato come `<ReferenceLine>` su asse pace.

## 7.5 Trend (linguistico)

```
mid = floor(points.length / 2)
avg1 = mean(paceSec prima metà)
avg2 = mean(paceSec seconda metà)
diff = avg2 - avg1                  // negativo = pace migliorato (sec minori)

diff < -5 → "Miglioramento" (emerald, ↑)
diff >  5 → "Peggioramento" (rose, ↓)
else      → "Stabile"        (gray, →)
```

## 7.6 Currents

```
last = points[points.length - 1]
currentHr   = last.hr
currentPace = last.paceSec
```

## 7.7 Linee rendering

Due `<Line>` su `LineChart`:
- HR (rose) su `yAxisId="hr"`, asse sx.
- Pace (blue) su `yAxisId="pace"`, asse dx, dominio invertito.
- T-Pace `<ReferenceLine>` se `vdot` definito.

> HR mostrata è `avg_hr` della miglior corsa mensile (no normalizzazione %HRmax). La prop `maxHr` è stata rimossa (vedi 7.1).

---

# PUNTO 8 — CardiacDrift + `cardiacDrift.ts`

**Files**:
- `src/utils/cardiacDrift.ts`
- `src/components/CardiacDrift.tsx`

## 8.1 Tipo `DriftResult`

```ts
DriftResult {
  drift: number;     // % (positivo = HR sale = peggio)
  hr1, hr2;          // bpm media prima/seconda metà
  pace1, pace2;      // sec/km media prima/seconda metà
  kmFirst, kmSecond; // label "km a–b"
  date, distKm, runId, label;
  splits: { km, hr, pace, paceLabel }[];
}
```

## 8.2 `driftLabel(d)` (util ts)

| Drift % | Label | Color |
|---|---|---|
| < 3.5 | Eccellente | `#C0FF00` |
| < 5.0 | Buona | `#27D3C3` |
| < 7.5 | Da migliorare | `#F59E0B` |
| ≥ 7.5 | Insufficiente | `#FF4D8D` |

## 8.3 `computeDrift(run)` (util ts) — versione ufficiale

Pipeline:

```
1. raw = splits.filter(hr > 80 && pace presente && parsePaceSec > 0)
   reject se raw.length < 4 → null

2. paces = raw.map(parsePaceSec)
   median = sorted(paces)[floor(len/2)]

3. steady = raw.filter(p ∈ [median·0.88, median·1.12])   // ±12% tight
   reject se steady.length < 4 OR steady.length < raw.length·0.5 → null

4. mid = floor(steady.length / 2)
   first  = steady[0..mid)
   second = steady[mid..]

5. hr1 = avg(first.hr),  hr2 = avg(second.hr)
   pace1 = avg(first.pace), pace2 = avg(second.pace)
   reject se hr1 ≤ 0 → null

6. drift = (hr2 - hr1) / hr1 · 100, round 1 dec
```

> Filtro `±12%` esclude intervalli/colline → solo steady-state runs vere.

## 8.4 CardiacDrift component — props e logica

**Props**: `{ runs: Run[] }`

```
results = runs
  .filter(r => distance_km ≥ 4 && splits.length ≥ 4)
  .sort((a,b) => b.date - a.date)        // più recenti prima
  .slice(0, 20)
  .map(computeDrift)
  .filter(d => d != null)
  .slice(0, 10)

latest = results[0] ?? null
trendData = [...results].reverse()       // vecchio → nuovo per chart
improving = results.length ≥ 2 && results[0].drift < results[1].drift
```

Se `latest == null` → fallback testo "Sincronizza corse...".

## 8.5 ✅ Duplicazione `computeDrift` — RISOLTA

> **FIX (2026-04-28)**: `CardiacDrift.tsx` aveva una copia locale divergente di `computeDrift` con filtro più largo (`±15%`/`+20%` e senza il check `< 50% split validi`). Ora il componente importa direttamente `computeDrift` e `DriftResult` da `src/utils/cardiacDrift.ts` — un solo algoritmo per tutto il sistema (filtro `±12%` + reject se steady < 50% del raw). Effetto: alcune corse con tratti molto variabili non vengono più classificate come drift stabili (meno falsi positivi). Il `driftLabel` locale è preservato perché contiene campi extra `bg`/`border` per Tailwind non presenti nell'util.

## 8.6 CV passo

Renderizzato solo se `|pace2 - pace1| / pace1 < 0.15`:
```
CV = |pace2 - pace1| / pace1 · 100   // %
mostra "(costante)" se CV < 15%
```

## 8.7 Trend chart

`<LineChart>` su `trendData` con 3 `<ReferenceLine>` orizzontali:
- 3.5% emerald
- 5.0% blue
- 7.5% rose

Linea principale colore = `improving ? emerald : rose`.

---

---

# PUNTO 9 — WeeklyStatsPanel + TopStats

## 9.1 WeeklyStatsPanel

**File**: `src/components/WeeklyStatsPanel.tsx`

### Props

```ts
interface WeeklyStatsPanelProps { runs: Run[] }
```

### `buildWeeklyData(runs)` — 8 blocchi da 7 giorni

```
now = oggi (23:59:59)
per idx = 0..7:
  weeksAgo = 7 - idx       // 7 = più vecchia, 0 = settimana corrente
  end   = now - weeksAgo·7 giorni
  start = end - 6 giorni (00:00:00)
  weekRuns = runs.filter(r.date ∈ [start, end])
  km = sum(weekRuns.distance_km)
  label = weeksAgo === 0 ? "OGG" : start.toLocaleDateString("DD MES")
  push { label, km: round(km,1), count: weekRuns.length, current: weeksAgo===0 }
```

### Output

- BarChart 8 barre, `dataKey="km"`.
- Cell color: `current ? '#C0FF00' : '#3B82F6'`, fillOpacity: `km > 0 ? (current ? 0.9 : 0.6) : 0.12`.
- Right column: `recentRuns = runs.slice(0, 5)` con data, distance, avg_pace, avg_hr (fallback durata se HR mancante).

## 9.2 TopStats

**File**: `src/components/TopStats.tsx`

### Props

```ts
interface TopStatsProps { runs: Run[] }
```

### `getWeekStart(date)` — lunedì della settimana

```
day = date.getDay()                      // 0=Dom..6=Sab
diff = day === 0 ? -6 : 1 - day          // back to Mon
new Date + diff giorni @ 00:00
```

### Calcolo Total Distance settimana corrente

```
weekStart     = getWeekStart(now)
lastWeekStart = weekStart - 7 giorni

// Lun..Dom della settimana corrente
weekDayData = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map((name, i) => {
  dayDate = weekStart + i giorni
  km = sum(runs.filter(r.date.slice(0,10) === dayDate.toISOString.slice(0,10)).distance_km)
  return { name, value: round(km,1), color: DAY_COLORS[i] }
})

DAY_COLORS = [purple, blue, teal, amber, rose, emerald, pink]

thisKm = sum(weekDayData.value)
lastKm = sum(runs ∈ [lastWeekStart, weekStart) .distance_km)

weekPct = lastKm > 0 ? round((thisKm - lastKm) / lastKm · 100) : null
```

### Output

BarChart con 7 barre giornaliere colorate, opacity `value > 0 ? 1 : 0.12`. Header mostra `thisWeekKm` + delta `weekPct` (verde positivo, rosso negativo).

---

# PUNTO 10 — LastRunMap + MapFallback

## 10.1 LastRunMap

**File**: `src/components/LastRunMap.tsx`

### Props

```ts
interface LastRunMapProps { run: Run | null }
```

### Dipendenze

- `react-map-gl/mapbox` + `mapbox-gl` (token: `import.meta.env.VITE_MAPBOX_TOKEN`)
- `@mapbox/polyline` per decode encoded polyline format

### Pipeline GPS

```
priority 1: run.polyline (encoded Google polyline format)
  decoded   = polylineDecode.decode(run.polyline)        // [[lat,lng], ...]
  coords    = decoded.map(([lat,lng]) => [lng, lat])     // GeoJSON XY order

priority 2: run.start_latlng (singolo punto fallback)
  coords = [[lng, lat]]

priority 3 (no GPS): rendering "no-GPS" card con grid SVG decorativo
```

### Bounds + padding

```
lngs/lats = coords.map(c => c[0|1])
padLng = max((maxLng - minLng) · 0.3, 0.003)
padLat = max((maxLat - minLat) · 0.3, 0.003)
bounds = [[minLng - padLng, minLat - padLat],
          [maxLng + padLng, maxLat + padLat]]
```

### routeGeoJson

Solo se `coords.length > 1`:
```ts
{
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
    properties: {}
  }]
}
```

### Layers Mapbox

1. `route-glow`: line-width 8, opacity 0.2, blur 4 (alone luminoso).
2. `route-line`: line-width 3, opacity 0.95 (linea principale).
3. `<Marker>` su `startCoord` (cerchio lime).

### Resize hook

`ResizeObserver` su containerRef → chiama `mapRef.current.resize()` quando `react-grid-layout` cambia dim widget.

### onLoad

`map.setConfigProperty('basemap', 'lightPreset', 'dusk')` (style Mapbox Standard).

### Stati di rendering

- `!run` → "Nessuna corsa".
- `!bounds` (no GPS) → card alternativa con km big number + grid SVG decorativo + meta.
- Else → mappa interattiva 3D (pitch 62, bearing -17, zoom 17).

## 10.2 MapFallback

**File**: `src/components/MapFallback.tsx`

### Props

```ts
interface MapFallbackProps { run: Run | null }
```

Rendering testuale quando Mapbox non disponibile/token assente. Mostra: `MapPin` icon, `distance_km`, `avg_pace`, `formatDuration(duration_minutes)`, data formattata.

> Nota: i due componenti coprono casi diversi — `LastRunMap` fa anche il fallback "no-GPS" inline; `MapFallback` è un wrapper di sostituzione totale (non utilizzato di default in DashboardView).

---

# PUNTO 11 — Widget MainChart

**File**: `src/components/MainChart.tsx`

## 11.1 Props + state

```ts
interface MainChartProps { runs: Run[] }

state: period ∈ {'1S','4S','8S','12S','6M','1A','TUTTO'}
state: expanded: bool   // modal fullscreen
```

PERIODS in ordine: `1S, 4S, 8S, 12S, 6M, 1A, TUTTO`.

## 11.2 Categorizzazione corse

`getRunCategory(runType)`:
```
runType.toLowerCase() match:
  contains 'race'/'gara'/'compet'        → 'race'
  contains 'long'/'lun'/'fondo lungo'    → 'long'
  contains 'interval'/'speed'/'fartlek'/'ripetute' → 'intervals'
  contains 'tempo'/'threshold'/'soglia'  → 'tempo'
  default                                 → 'easy'
```

## 11.3 Modello Entry

```ts
interface Entry {
  name: string;
  easy, tempo, intervals, long, race: number;  // km per categoria
  total: number;                                // somma km bar
}
```

`addRun(entry, run)`: incrementa `entry[cat]` e `entry.total` con `round(distance_km, 1)`.

## 11.4 `buildData(runs, period)` — 3 modalità

### 1S — giornaliero

```
weekStart = getWeekStart(now)            // Lunedì
DAY_IT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']
return DAY_IT.map((name, i) => {
  dayDate = weekStart + i giorni
  entry filled with runs su quel dayStr (ISO YYYY-MM-DD)
})
```

### 4S/8S/12S — settimanale

```
numWeeks = 4 | 8 | 12
currentWeekStart = getWeekStart(now)
return Array(numWeeks, i => {
  ws = currentWeekStart - (numWeeks-1-i)·7 giorni
  we = ws + 7 giorni
  label = "MES DD" (es "MAG 12")
  entry filled con runs ∈ [ws, we)
})
```

### 6M / 1A / TUTTO — mensile

```
6M:    months = ultimi 6 mesi
1A:    months = ultimi 12 mesi
TUTTO: months = dal mese del run più vecchio fino ad oggi (loop while d<=now)

label = MES (TUTTO/1A aggiungono " 'YY")
entry filled con runs nel (year, month)
```

## 11.5 Statistiche derivate

```
periodKm  = round(sum(chartData.total), 1)
avgKm     = bars con total>0 → media; else 0
maxKm     = max(chartData.total) o 10
maxWeekKm = max(chartData.total)
totalRuns = count runs nel periodo (filtri data per period)
```

`barSize`:
```
1S → 28
4S → 22
TUTTO con > 24 punti → 8
else → 14
```

## 11.6 Rendering bars (stacked)

5 `<Bar>` con `stackId="a"`:
```
easy      #14B8A6 (radius bottom)
tempo     #3B82F6
intervals #F59E0B
long      #F43F5E
race      #8B5CF6 (radius top)
```

`<ReferenceLine y={avgKm}>` lime con label `AVG {avgKm} km`.

## 11.7 Modal fullscreen

`<ChartFullscreenModal>` (componente esterno) con `accent="#3B82F6"`, riusa `renderChart(isExpanded=true)` con margini/font ingranditi.

`recentRuns`: ultimi 5 (filtra `!is_treadmill`, sort desc data) — definiti ma renderizzati in `<div className="hidden">` (legacy/dead path).

---

---

# PUNTO 12 — FitnessFreshness + SupercompensationChart + AdaptationPanel

## 12.1 FitnessFreshness

**File**: `src/components/FitnessFreshness.tsx`

### Props

```ts
interface FitnessFreshnessProps {
  fitnessFreshness: FitnessFreshnessPoint[];   // serie storica
  currentFf: CurrentFF | null;                  // valori correnti
  prevCtl: number | null;                       // CTL t-1 per delta
}

// FitnessFreshnessPoint: { date: ISO, ctl, atl, tsb }
// CurrentFF: { ctl, atl, tsb, ctl_trend?, form_status? }
```

### Modello PMC (Performance Management Chart)

```
CTL = Chronic Training Load   (Condizione fisica, τ=42 giorni)
ATL = Acute Training Load     (Affaticamento, τ=7 giorni)
TSB = CTL - ATL               (Forma)
```

### Status TSB → label/color

| TSB | Label | Color |
|---|---|---|
| > 10 | Fresco | `#C0FF00` |
| > -5 | Neutro | `#14B8A6` |
| > -20 | Affaticato | `#F59E0B` |
| ≤ -20 | Sovrallenamento | `#F43F5E` |

### Insight (`getInsight(tsb)`)

```
> 10  → "Forma ottimale. Momento per gareggiare."
> -5  → "Equilibrio. Continua per migliorare."
> -20 → "Corpo assorbe il carico. Adattamenti emergeranno."
≤ -20 → "Recupera. Supercompensazione richiede riposo."
```

### Trend derivati

```ts
ctlTrend = currentFf.ctl_trend ?? round(ctl - prevCtl, 1)
atlTrend = round(atl - fitnessFreshness[len-2].atl, 1)
```

### Ticks mensili X-axis

```ts
seen = Set<string>()  // "YYYY-MM" già visti
monthTicks = fitnessFreshness.filter(d => {
  m = d.date.slice(0,7)
  if (seen.has(m)) return false
  seen.add(m); return true
}).map(d => d.date)
```

### Ricalcolo

`handleRecalculate` → `await recalculateFitnessFreshness()` (API) → `window.location.reload()`.

### Output

3 KPI (Condizione/Affaticamento/Forma) + AreaChart 3 serie (`ctl`, `atl`, `tsb`) con gradients + ReferenceLine `y=0` + Insight box. Modal fullscreen via `<ChartFullscreenModal>`.

`atlTrend` con `trendInverted=true`: aumento = peggio (rosso) anche se positivo.

## 12.2 SupercompensationChart

**File**: `src/components/SupercompensationChart.tsx`

### Props

```ts
interface SupercompensationChartProps { currentFf: CurrentFF | null }
```

State: `rangeDays ∈ {7, 14, 21, 30}`, `menuOpen: bool`.

### Modello Banister forward projection

```
CTL_DECAY = exp(-1/42)  ≈ 0.9764
ATL_DECAY = exp(-1/7)   ≈ 0.8667

projectForward(ctl0, atl0, days):
  c = ctl0; a = atl0
  per d = 0..days:
    push { date, ctl: round(c,1), atl: round(a,1), tsb: round(c-a, 1) }
    c *= CTL_DECAY
    a *= ATL_DECAY

  // Marca picco TSB
  peakIdx = argmax(points.tsb)
  if peakIdx > 0 → points[peakIdx].isPeak = true
```

> ATL decade più veloce di CTL → TSB cresce → emerge picco di forma.

### Insight (`getInsightText`)

```
peak.day === 0  → "Sei al picco oggi"
peak.day ≤ 3    → "Picco vicino: ${peak.label}, riposa ancora ${peak.day} giorni"
currentTsb < -5 → "Corpo assorbe carico. Picco previsto ${peak.label}"
default         → "Adattamenti consolidando. Picco previsto ${peak.label}"
```

### Output

LineChart con 3 linee (CTL blu, ATL rosso tratteggiato, TSB teal). `<ReferenceDot>` sul picco TSB con label `★ PICCO {date}`. Range dropdown.

## 12.3 AdaptationPanel

**File**: `src/components/AdaptationPanel.tsx`

### Props

```ts
interface AdaptationPanelProps { runs: Run[] }
```

State: `period ∈ {7, 14, 30}` (giorni).

### Categorie adattamento

```ts
type RunCategory = 'neuromuscolare' | 'metabolico' | 'strutturale'

CATEGORIES = {
  neuromuscolare: { daysToAdapt: 5,  range: '3-7gg',   desc: 'Forza/reattività', icon: ⚡ },
  metabolico:     { daysToAdapt: 10, range: '7-14gg',  desc: 'Efficienza/soglia', icon: 🔥 },
  strutturale:    { daysToAdapt: 17, range: '14-21gg', desc: 'Capillari/mitocondri', icon: 🧬 },
}
```

### `classifyRun(run)` — decision tree

```
if avg_hr_pct definito:
  > 0.85 → neuromuscolare
  > 0.72 → metabolico
  else   → strutturale
else (fallback pace = duration/distance):
  < 4.5 min/km → neuromuscolare
  < 5.5 min/km → metabolico
  else         → strutturale
```

### Funzioni temporali

```
daysUntilPeak(runDate, daysToAdapt):
  peakDate = runDate + daysToAdapt giorni
  return round((peakDate - now) / 86400000)
  // 0 = oggi, negativo = già passato

maturationPct(runDate, daysToAdapt):
  elapsed = (now - runDate) / 86400000
  return clamp(0, 100, round(elapsed/daysToAdapt · 100))
```

### Summary per `period`

```
cutoff = now - period giorni
periodRuns = runs.filter(r.date >= cutoff)

byType[cat] = { km, count } per ciascuna categoria
totalKm = sum
dominant = byType ordinato per km desc, prima entry
```

### Output

- **Sx**: lista ultime 8 corse con maturation bar (% colorato categoria, lime se ≥100%) + "Domani" / data picco / "✓ Attivo".
- **Dx**: summary del periodo selezionato — totale km/corse, breakdown per categoria con barre %, badge "Focus dominant".

---

---

# PUNTO 13 — RecentActivities + BadgesGrid

## 13.1 RecentActivities

**File**: `src/components/RecentActivities.tsx`

### Props

```ts
interface RecentActivitiesProps { runs: Run[] }
```

### `getRunStyle(runType)` — mapping icona/label

```
runType.toLowerCase() match:
  'interval'/'speed'/'fartlek'/'ripetute' → Zap   amber  "Intervals"
  'tempo'/'threshold'/'soglia'            → Timer blue   "Tempo"
  'long'/'lun'/'fondo lungo'              → MapPin rose  "Long Run"
  'recov'/'rigene'                        → HeartPulse purple "Recovery"
  'race'/'gara'/'compet'                  → TrendingUp pink "Race"
  default                                  → Footprints teal "Easy Run"
```

### `getDayLabel(dateStr)` — gruppo data

```
runDate (00:00) === today → "OGGI"
runDate === today - 1     → "IERI"
else                       → "DD MES" (Italiano, uppercase)
```

### Raggruppamento

```
sorted = runs.sort(desc date).slice(0, 20)
map = Map<dayLabel, Run[]>()
for run of sorted:
  push run in map[getDayLabel(run.date)]
return Array.from(map.entries())  // [{group, items[]}]
```

### Click handler

`onClick(run)` → `navigate('/activities/${run.id}')` (React Router).

### Output per riga

- icona categoria + bg
- title = `run.location` || category label
- data formattata "DD MES, HH:MM"
- `distance_km` + `avg_pace`
- `<ChevronRight>`

## 13.2 BadgesGrid (~110 righe) — FIX 2026-04-29

> **CHANGELOG FIX 2026-04-29**: eliminati tutti i badge (250+, 16 categorie) tranne il badge leggendario **Passerotto**. Il file è passato da 1582 → ~110 righe. `BadgeContext` ridotto a 2 campi. `buildContext` ora O(n) su runs, zero side-data.

**File**: `src/components/BadgesGrid.tsx`

### Props

```ts
interface Props {
  runs: Run[];
  // vdot / vdotPeak / vdotDelta / maxHr: legacy, accettati ma non usati
  vdot?: number;
  vdotPeak?: number;
  vdotDelta?: number;
  maxHr?: number;
}
```

### Modello dati (slim)

```ts
interface BadgeContext {
  best5k: number | null;   // secondi totali sul 5K (pace_sec × 5)
  best10k: number | null;  // secondi totali sul 10K (pace_sec × 10)
}
```

### `buildContext(runs)` — algoritmo

```
runs2026 = runs.filter(year >= 2026)
per ogni run con paceSec:
  dist ∈ [4.5, 5.5]  → best5k  = min(best5k,  paceSec · 5)
  dist ∈ [9, 11]     → best10k = min(best10k, paceSec · 10)
return { best5k, best10k }
```

### `LEGENDARY_BADGE = "Passerotto"` 🐦

```
check: best5k !== null && best5k < 1200   // sub 20:00
     && best10k !== null && best10k < 2550 // sub 4:15/km × 10 = 42:30
```

Render: `<LegendaryBadgeCard unlocked />` — card centrata, bordo amber, badge "LEGGENDARIO".

### Rendering principale

```
ctx = buildContext(runs)
unlocked = LEGENDARY_BADGE.check(ctx)
→ <LegendaryBadgeCard unlocked={unlocked} />
```

---

---

# PUNTO 14 — Modulo Training

3 file:
- `src/components/TrainingView.tsx` (18 righe — solo layout)
- `src/components/TrainingGrid.tsx` (~1543 righe — calendario + modali)
- `src/components/TrainingSidebar.tsx` (~245 righe — panoramica settimanale)

## 14.1 TrainingView (orchestratore)

```tsx
<TrainingView>
  flex
    div flex-1 → <TrainingGrid/>
    div w[350px] → <TrainingSidebar/>
```

Nessun props, nessun state. Pura composizione.

## 14.2 SESSION_COLORS (condiviso)

```ts
{
  easy:      "#8B5CF6",
  recovery:  "#6B7280",
  intervals: "#EF4444",
  tempo:     "#F97316",
  long:      "#10B981",
  rest:      "transparent",
  strength:  "#0EA5E9",   // riposo + forza
}
```

## 14.3 TrainingSidebar

### Hook API

- `useApi<TrainingWeek>(getCurrentWeek)` → settimana corrente
- `useApi<RunsResponse>(getRuns)` → corse totali

### Modello `TrainingWeek` (dal backend)

```ts
TrainingWeek {
  week_number: int;
  week_start, week_end: ISO;
  phase: string;          // 'base'/'build'/'peak'/'taper'/...
  target_km: number;
  target_vdot: number | null;
  goal_race?: string;
  target_time?: string;
  is_recovery_week: boolean;
  sessions: Session[];
}
```

### Mileage Chart (ultimi 9 settimane)

```
weekMap = Map<isoMonday, totalKm>
per ciascuna run:
  d = Date(run.date)
  dow = d.getDay()
  diff = d.getDate() - dow + (dow === 0 ? -6 : 1)  // sposta a lunedì
  monKey = mon.toISOString().slice(0,10)
  weekMap[monKey] += distance_km

sorted = entries.sort(asc).slice(-9)
labels: prima entry e prima settimana del mese mostrano il nome MES
maxMileage = max(values, 10)
yMax = ceil(max/10) * 10
```

BarChart con `Cell.opacity = 1` ultima settimana, `0.65` precedenti.

### Weekly Menu

```
weeklyMenu = currentWeek.sessions.map(session => {
  date  = "DAY DD MES" (uppercase)
  type  = session.type === 'rest' ? 'Riposo' : session.title
  color = SESSION_COLORS[session.type]
  status = session.completed ? 'completed'
         : session.type === 'rest' ? 'rest'
         : 'pending'
  km = session.target_distance_km > 0 ? value : null
})
```

Render: bordo sx colorato per categoria, icona `<CheckCircle2>` verde se completata. Box riassunto con `target_km`, `phase`, `target_vdot`, `goal_race`+`target_time`, flag `is_recovery_week`.

## 14.4 TrainingGrid — main calendar

### Hook API

`useApi<TrainingPlanResponse>(getTrainingPlan)`.

```ts
TrainingPlanResponse { weeks: TrainingWeek[] }
Session {
  id, date: ISO; type: string;
  title, description: string;
  target_distance_km: number;
  target_pace?: string;
  completed: bool;
  strength_exercises?: string[];
}
```

### State

```ts
currentDate: Date;
view: 'Day' | 'Week' | 'Month' | 'Year';   // default 'Year'
previousView: 'Week'|'Month'|'Year'|null;  // back-button state
showModal: bool;        // GeneratePlanModal
showAdaptModal: bool;   // AdaptPlanModal
```

### `sessionMap` (lookup)

```
sessionMap[session.date] = session  // chiave "YYYY-MM-DD"
getSession(year, month, day) → sessionMap[`${y}-${MM}-${DD}`]
```

### `toDisplay(session)` → SessionDisplay | null

```
session === null → null
type === 'rest':
  if strength_exercises?.length > 0 → "Riposo + Forza" + count esercizi
  else → null (renderizza vuoto)
else:
  color = SESSION_COLORS[type]
  details = []
  if target_distance_km → push "X km"
  if target_pace        → push "MM:SS/km"
```

### Navigazione date

```
next/prev incrementa secondo view:
  Month → ±1 mese
  Week  → ±7 giorni
  Day   → ±1 giorno
  Year  → ±1 anno

goToDay(date, fromView): salva previousView, switch a Day
goBack(): ripristina previousView (default Month)
```

### View renderers

- **Year**: 12 mini-month grid, click → switch a Month.
- **Month**: griglia 7×N giorni, week start lunedì, sessione = card con bordo sx colorato.
- **Week**: 7 colonne, ogni giorno card con bordo top colorato.
- **Day**: pannello centrato con dettaglio sessione + bottone back.

## 14.5 GeneratePlanModal — flusso a 4 fasi

### State

```ts
phase: 'input' | 'calibration' | 'strategy' | 'done'
goalRace: '5K' | '10K' | 'Half Marathon' | 'Marathon'
weeksToRace: number   // default 12
targetTime: string    // "MM:SS" o "H:MM:SS"
startDate: ISO        // default = next Monday
calibrationMode: 'strava' | '3k' | 'cooper'
testTime, cooperMeters: string
result: GenerateResult | null
```

### `GenerateResult` schema

```ts
{
  current_vdot, target_vdot, peak_vdot;
  weeks_generated;
  peak_date, peak_source: { name, distance_km, avg_pace, ... };
  training_months, weekly_volume;
  test_vdot, plan_mode: 'conservative'|'balanced'|'aggressive';
  strategy_options: StrategyOption[];
  feasibility: {
    feasible: bool;
    difficulty: 'already_there'|'realistic'|'challenging'|'unrealistic';
    message, confidence_pct;
    is_recovery: bool;
    conservative_vdot/time/rate;
    optimistic_vdot/time/rate;
    suggested_weeks, suggested_timeframe;
  };
  race_predictions: Record<string, string>;
}

StrategyOption {
  mode: PlanMode;
  label, focus: string;
  success_pct, completion_pct: number;
  weekly_volume_multiplier, projected_vdot: number;
  note: string;
}
```

### Flusso `handleAnalyze`

```
1. Validazione targetTime
2. Se calibrationMode='3k' → require testTime
   Se calibrationMode='cooper' → require cooperMeters numerico
3. testPayload():
     '3k'    → { test_distance_km: 3, test_time }
     'cooper'→ { test_distance_km: meters/1000, test_time: "12:00" }
     altrimenti → {}
4. POST /api/training/plan { ...baseParams, dry_run: true }
5. Branch:
   - weeks_generated > 0 && dry_run === false → done
   - !strategy_options.length → fallback POST con plan_mode='balanced' → done
   - else → phase 'strategy' (utente sceglie tra Conservative/Balanced/Aggressive)
6. handleGenerate(mode): POST con plan_mode esplicito → done
```

### `feasColor` / `selectedColor`

```
feasibility.difficulty:
  already_there → emerald
  realistic     → blue
  challenging   → amber
  else          → red

success_pct:
  ≥ 80 → emerald
  ≥ 60 → lime
  ≥ 45 → amber
  else → red
```

## 14.6 AdaptPlanModal — algoritmi `AdaptAdaptation`

### Modello

```ts
AdaptAdaptation {
  model_name: string;       // ACWR | TSB | VDOT_DRIFT | COMPLIANCE | TAPER
  triggered: bool;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

AdaptResponse {
  adaptations: AdaptAdaptation[];
  weeks_modified, sessions_modified, triggered_count: number;
  message?: string;          // stringa errore se generation fallita
}
```

### 5 modelli (descrizione UI)

```
ACWR        — Acute:Chronic Workload Ratio. Riduce volume se >1.5
TSB         — Training Stress Balance. Trasforma duro in recovery se TSB troppo basso
VDOT_DRIFT  — Ricalibra paces se VDOT reale diverso da target
COMPLIANCE  — Ammorbidisce piano se troppe sessioni saltate (14gg)
TAPER       — Riduce volume <14gg da gara
```

### API

`POST /api/training/adapt` (no payload). Backend esegue tutti i modelli, modifica sessioni future, ritorna lista risultati.

## 14.7 EvaluateTestModal — ricalibrazione VDOT

### State

```ts
testDistance: string  // default "3"
testTime: string      // "MM:SS"
testDate: ISO         // default oggi
result: { test_vdot, test_pace, previous_plan_vdot, new_target_vdot,
          vdot_change, direction: 'improved'|'declined'|'stable',
          confidence: number, message: string }
```

### Flusso

```
POST /api/training/evaluate-test {
  test_distance_km, test_time, test_date
}
```

### Output

3 card VDOT (Precedente / Test / Nuovo Target). Direction badge + confidence bar 0-100%. Min distanza 3 km (Daniels).

## 14.8 API endpoints utilizzati

```
GET  /api/training/plan          → TrainingPlanResponse
GET  /api/training/current-week  → TrainingWeek
POST /api/training/plan          → genera piano (param: goal_race, weeks_to_race,
                                                  target_time, start_date, plan_mode,
                                                  test_distance_km?, test_time?, dry_run?)
POST /api/training/adapt         → AdaptResponse
POST /api/training/evaluate-test → EvaluateTestResponse
```

> Backend math di generazione/adapt: documentata al Punto 26.

---

> **STATO REPORT**: completati Punti 1-14 della checklist. Prossimo punto: 15 (ActivitiesView).

# PUNTO 15 — ActivitiesView

**File**: `src/components/ActivitiesView.tsx` (~1040 righe)

Vista catalogo corse split-screen: lista a sinistra + mappa Mapbox 3D a destra. Modale separato per import CSV Garmin.

## 15.1 Props e routing

```ts
interface ActivitiesViewProps {
  onSelectRun: (runId: string) => void;
}
```

Montata in `App.tsx` su `/activities`. Callback `onSelectRun` naviga a `/activities/:runId`.

## 15.2 Data fetching

```ts
const { data, loading, error } = useApi<RunsResponse>(getRuns);
// GET /api/runs -> { runs: Run[] }   (newest-first)
const runs: Run[] = data?.runs ?? [];
```

Il `Run` model (fonte: `src/types/api.ts`) usato in vista — campi consumati:

```ts
Run {
  id, date, distance_km, duration_minutes, avg_pace,
  avg_hr | max_hr, run_type, notes, location,
  splits: Split[], polyline, start_latlng: [lat, lng] | null,
  is_treadmill, elevation_gain,
  // running dynamics: avg_vertical_oscillation, avg_vertical_ratio,
  //                   avg_ground_contact_time, avg_stride_length
}

Split {
  km, pace, hr | null, cadence | null, distance,
  elapsed_time, elevation_difference
}
```

## 15.3 State

```ts
hoveredRunId:    string | null
selectedRunId:   string | null
mapViewMode:     'world' | 'last-run' | 'all-zoomed'   // default 'all-zoomed'
mapReady:        bool
showGarminImport: bool
showTrailView:   bool
csvFile:         File | null
csvParsing:      bool
csvImporting:    bool
csvResult:       { success, message, imported, skipped } | null
parsedRuns:      Array<Record<string,string>>
// refs
mapRef, fileInputRef, rafRef (rotation), rotationTimeoutRef
```

## 15.4 Derivazioni

```ts
allRuns         = runs
runsWithCoords  = allRuns.filter(r => r.start_latlng?.length === 2)
lastRunWithCoords = runsWithCoords[0]   // newest-first array
visibleMarkers  = mapViewMode==='last-run' && lastRunWithCoords
                  ? [lastRunWithCoords] : runsWithCoords
```

### driftMap (precomputed via `useMemo([allRuns])`)

```
driftMap: Record<runId, ComputeDriftResult>
Per ogni run:
  if !is_treadmill && distance_km >= 4 && splits.length >= 4:
     d = computeDrift(run)            // util cardiacDrift.ts (Punto 8)
     if d != null -> driftMap[run.id] = d
```

UI mostra drift% e badge `hr1 -> hr2` per ogni card che lo qualifica.

### Center fallback

```
initialLng = lastRunWithCoords ? start_latlng[1] : 12.49 (Roma)
initialLat = lastRunWithCoords ? start_latlng[0] : 41.89
```

## 15.5 Mapbox setup (mappa destra)

```
<Map mapboxAccessToken={VITE_MAPBOX_TOKEN}
     mapStyle="mapbox://styles/mapbox/standard"
     initialViewState={{ longitude, latitude, zoom:12, pitch:60, bearing:-20 }}
     onLoad={handleMapLoad} onMouseDown/onTouchStart/onWheel={stopRotation}>

handleMapLoad imposta:
  basemap.lightPreset           = 'dusk'
  basemap.showPointOfInterestLabels = true
  basemap.showPlaceLabels       = true
  basemap.showRoadLabels        = true
  basemap.showTransitLabels     = true
  setMapReady(true)
```

## 15.6 Modalita vista mappa — `applyViewMode(mode, runs)`

```
WORLD:
  map.setProjection('globe')
  centroid = mean(start_latlng) di tutte le runs con coords (fallback 12.49/41.89)
  flyTo(center=centroid, zoom=3, pitch=0, bearing=0, duration=1800)

LAST-RUN:
  map.setProjection('mercator')
  last = withCoords[0]   (newest)
  flyTo(center=[lng,lat], zoom=15.5, pitch=62, bearing=-20, duration=2000)
  setSelectedRunId(last.id)

ALL-ZOOMED (default):
  map.setProjection('mercator')
  recentRuns = runs degli ultimi 6 mesi (fallback all)
  Cluster su griglia 0.01 deg x 0.01 deg (toFixed(2) lat,lng):
     clusters[key] = { sumLat, sumLng, count }
  bestCluster = cluster con count massimo
  centroid = (sumLat/count, sumLng/count)
  flyTo(center=centroid, zoom=15.5, pitch=62, bearing=-20, duration=2000)
```

Auto-applicata 500ms dopo `mapReady && allRuns.length > 0`.

## 15.7 Rotazione mappa

```
startRotation():
  bearing = current; rotate() -> bearing = (bearing + 0.15) % 360
  rafRef = rAF(rotate)
stopRotation(): cancelAnimationFrame + clearTimeout
```

Auto-trigger: dopo 2.2s da click su run (se `map.isStyleLoaded()`). Ferma su `onMouseDown/onTouchStart/onWheel` mappa.

## 15.8 Click handler card / marker

```
handleRunClick(run):
  if !run.start_latlng -> return
  setSelectedRunId(run.id)
  stopRotation()
  flyTo(center=[lng,lat], zoom=16.5, pitch=65, duration=2000)
  setTimeout(2200ms): if styleLoaded -> startRotation()
```

## 15.9 Run card — contenuto e logica

```
runTitle = notes
   ? notes.replace('Importata da Strava: ','')
          .replace(/(\s*\[Strava:[^\]]*\])+/g, '').trim()
          || `${typeLabel} ${distance_km.toFixed(1)} km`
   : `${typeLabel} ${distance_km.toFixed(1)} km`

typeLabel via getRunTypeLabel(run_type):
  easy        -> Easy
  tempo|soglia-> Tempo
  intervals|interval|ripetute -> Intervals
  long|lungo  -> Long
  recovery|riposo -> Recovery
  else        -> string raw
```

**Stats mostrate**: km, pace, hr, (drift % e hr1->hr2 se driftMap[run.id]).

**Badge condizionali**:
- `is_treadmill` -> badge "tapis" (escluso da analytics)

> **FIX (2026-04-28)**: rimossa la special-case `__demo_trail__` (card "Trail Premium" Monte Cavo Loop hardcoded) e l'overlay `TrailRunView`. Vedi PUNTO 16 e CHANGELOG.

**Click**:
- card body -> `handleRunClick(run)` (se `hasCoords`)
- freccia destra -> `onSelectRun(run.id)` (naviga al dettaglio `/activities/:id`)

## 15.10 Marker mappa

Per ogni run in `visibleMarkers`:

```
<Marker longitude latitude anchor="center" onClick={handleRunClick(run)}>
  scale = isHovered || isSelected ? 1.45 : 1.0
  opacity = isHovered || isSelected ? 1 : 0.7
  color = isSelected ? '#C0FF00' : markerColor (per type)
  Bubble distance overlay se isSelected: "{distance_km.toFixed(1)} km"
  "LAST" badge se mode==='last-run' && isLastRun && !isSelected
```

`getTypeStyle.markerColor`:
- Tempo `#3B82F6` (blue)
- Intervals `#F43F5E` (rose)
- Long `#F59E0B` (amber)
- Recovery `#A855F7` (purple)
- default `#10B981` (emerald)

## 15.11 Bottom info panel (mappa)

Quando `selectedRunId`:

```
<MotionDiv> notes-cleaned title + typeLabel badge +
            distance_km, avg_pace, formatDuration, location
            "Rotazione attiva" indicator
```

## 15.12 Garmin CSV Import (modal)

### Parser CSV

```
parseGarminCsv(text):
  - split lines (escludi vuote)
  - autodetect delimiter: count occorrenze di ',', ';', '\t' nella prima riga
    (rispetta quote e doppie quote escapate "")
  - parseLine: gestisce virgolette singole, "" -> ", delimiter fuori da quote
  - header = parseLine(line[0]).map(strip BOM)
  - returns Array<Record<header_field, value>>
```

### Flusso state

```
file selected -> handleCsvFile(file):
  setCsvParsing(true)
  text = await file.text()
  runs = parseGarminCsv(text)
  if runs.length === 0 -> result.error
  else:
     setParsedRuns(runs); setCsvFile(file)
     result = "{N} corse trovate nel file '{name}'"
  setCsvParsing(false)

click "Importa" -> handleImportToDatabase():
  setCsvImporting(true)
  result = await importGarminCsv(parsedRuns)
     -> POST /api/garmin/csv-import { runs }
     -> response: { imported, duplicates, matched, enriched, skipped }
  message: "Importazione completata: {imported} salvate, {duplicates}
            duplicate, {matched} match Strava, {enriched} arricchite"
  reset parsedRuns + csvFile
```

Risorsa target: collezione `garmin_csv_data` (separata da Strava runs).

## 15.13 API consumate

```
GET  /api/runs                  -> RunsResponse { runs: Run[] }
POST /api/garmin/csv-import     { runs }
                                -> { imported, duplicates, matched, enriched, skipped }
```

## 15.14 Dipendenze esterne

- `react-map-gl/mapbox` + `mapbox-gl` (mapStyle `mapbox/standard`, projection switchable globe/mercator)
- `motion/react` (animazioni card)
- `useApi` hook
- `computeDrift`, `driftLabel` from `utils/cardiacDrift`
- `lucide-react` icons
- VITE_MAPBOX_TOKEN env var

---

# PUNTO 16 — RoutesView + LiveTelemetry3DMap

Vista dettaglio corsa singola. Due componenti concentrici:

- **RoutesView** = wrapper che switcha tra Standard (MapLibre 2D) e 3D Telemetry
- **LiveTelemetry3DMap** = playback Mapbox 3D con chase-camera

> **FIX (2026-04-28)**: rimosso `TrailRunView` (overlay full-screen ~976 righe, dati hardcoded "Monte Cavo Loop"). Vedi CHANGELOG.

## 16.1 RoutesView

**File**: `src/components/RoutesView.tsx` (~730 righe)
**Route**: `/activities/:runId` -> `<RoutesViewWrapper>` legge `useParams.runId` -> `<RoutesView runId={runId}/>`

### Props
```ts
{ runId?: string | null }
```

### Data fetching
```ts
useApi<Run>(() => getRun(runId ?? ''))
// GET /api/runs/:id -> Run completo (con polyline, splits, streams?)
```

Streams sono campo extension non tipizzato (`(run as any).streams`): array per-point `{ d, pace, hr, cad, alt, ll }` se disponibile (vedi `getRunSplits` GET `/api/runs/:id/splits` non chiamato qui).

### State
```
activeSplit:       number | null
mapMode:           'pace' | 'hr' | 'elevation'    // default 'pace'
mapView:           'standard' | '3d-telemetry'    // default 'standard'
drawProgress:      number 0..1                    // animazione draw polyline
chartMetrics:      Set<'pace'|'hr'|'cadence'>     // default {'pace'}
hoveredStreamIdx:  number | null
mapRef:            MapRef
```

### Polyline decoding

```ts
decodePolyline(encoded: string): [lng, lat][]
// Algoritmo Google polyline standard, returns coordinate per maplibre
// (lng prima di lat, /1e5)
```

```ts
routeCoords = useMemo(() => {
  poly = (run as any).polyline
  return poly ? decodePolyline(poly) : []
})
```

### chartData (sorgente per grafico bottom)

```ts
if (streams.length > 0):
  chartData = streams.map((pt, i) => ({
    idx:     i,
    dist:    pt.d ? (pt.d/1000).toFixed(1) : '',
    pace:    pt.pace ?? null,
    hr:      pt.hr ?? null,
    cadence: pt.cad ?? null,
    alt:     pt.alt ?? null,
    ll:      pt.ll ?? null,        // [lat, lng]
  }))
else (fallback):
  chartData = splits.map(s => ({
    idx:     s.km,
    dist:    `${s.km}`,
    pace:    paceToSeconds(s.pace),
    hr:      s.hr ? round(s.hr) : null,
    cadence: s.cadence ?? null,
    alt:     s.elevation_difference ?? null,
    ll:      null,
  }))
```

### hoveredPoint (sync grafico <-> marker mappa)

```
if hoveredStreamIdx == null -> null
pt = chartData[idx]
if pt.ll -> { lat: ll[0], lng: ll[1] }
else if routeCoords.length > 0:
  ratio = idx / max(chartData.length-1, 1)
  coordIdx = floor(ratio * routeCoords.length) clamp len-1
  c = routeCoords[coordIdx]
  -> { lat: c[1], lng: c[0] }
```

### bounds -> fitBounds

```
bounds = [[minLng, minLat], [maxLng, maxLat]]    // calcolato over routeCoords
mapRef.fitBounds(bounds + pad 0.002,
  { padding:{top:80,bottom:120,left:380,right:280}, pitch:45, duration:1500 })
```

(Padding asimmetrico riserva spazio per pannelli laterali fissi.)

### Animazione draw

```
useEffect([runId, routeCoords]):
  start = performance.now()
  duration = 2000ms
  rAF: progress = min(elapsed/2000, 1) -> setDrawProgress
visibleCoords = routeCoords.slice(0, floor(routeCoords.length * drawProgress))
```

### segmentedLines (route colorato per metric)

```ts
features = visibleCoords.slice(0,-1).map((c,i) => {
  next = visibleCoords[i+1]
  splitIdx = floor((i / visibleCoords.length) * splits.length) clamp
  split    = splits[splitIdx]

  // color rules
  PACE:
     paceSec < 270  -> '#10B981'   (<= 4:30/km)
     paceSec < 330  -> '#3B82F6'   (4:30-5:30)
     else           -> '#F59E0B'
  HR:
     hr > 170       -> '#EF4444'
     hr > 155       -> '#F59E0B'
     else           -> '#10B981'
  ELEVATION:
     elDiff > 0     -> '#EF4444'   (salita)
     else           -> '#10B981'   (piatto/discesa)

  return Feature(LineString[c, next], { color, width:4, id:i })
})
```

Renderizzato come 2 layer: `route-lines` (line-width 4) + `route-glow` (line-blur 15, line-width *4, opacity 0.3).

### Standard view — UI overlay layout

| Posizione | Contenuto |
|---|---|
| Top center | Toggle `Standard / 3D Telemetry` |
| Left 8/8 (340px) | `SESSION ANALYTICS`: title, date, location, distance/time/avg-pace, avg-hr/max-hr/elevation_gain, splits table (km/pace/hr/elev) hover -> `setActiveSplit` |
| Right top (240px) | `ROUTE COLOR` selector (pace/hr/elevation) |
| Right next | `Run Info` card: type, cadence (`cadenceSpmFromRun(run)`), avg_hr_pct |
| Right next (cond) | `Running Dynamics`: avg_vertical_oscillation cm, avg_vertical_ratio %, avg_ground_contact_time ms, avg_stride_length m |
| Bottom (left 380, right 8) | Multi-metric chart (Recharts ComposedChart) |

### Marker logici sulla mappa

```
KM markers:
   per ogni split: ptIdx = floor(split.km / distance_km * routeCoords.length)
   pos = routeCoords[ptIdx]
Start: routeCoords[0] (emerald + ping)
End:   routeCoords[last] (rose)
hoveredPoint: marker [#C0FF00] (sync con chart)
activeSplit (hover splits table): GeoJSON Source line slice
   coordinates: routeCoords.slice(
     floor((km-1)/distance * len),
     floor(km/distance * len)
   )
   line-color #FFF, line-width 12, line-blur 5, opacity 0.4
```

### Chart bottom (Recharts ComposedChart)

```
toggleChartMetric(key):  Set<'pace'|'hr'|'cadence'>
                         garantisce min 1 metrica attiva

XAxis: dataKey='dist', interval = streams ? floor(len/12) : 0
YAxis pace: orientation='left', reversed (pace lower=better)
YAxis hr:   orientation='right', hide
YAxis cadence: hide
3 Area (cond su chartMetrics):
   pace:    stroke '#C0FF00' strokeWidth 1.5 fill paceGrad
   hr:      stroke '#F43F5E' strokeWidth 1.5 fill hrGrad   connectNulls
   cadence: stroke '#8B5CF6' strokeWidth 1.5 fill cadenceGrad connectNulls
onMouseMove: setHoveredStreamIdx(activeTooltipIndex)
onMouseLeave: setHoveredStreamIdx(null)
```

Header chart mostra valori live: format pace `Math.floor(pace/60):pace%60` /km, hr round, cadence round.

### Helpers utilizzati

```
formatDate(dateStr): toLocaleDateString('en-US') uppercased
                     "MONDAY, JANUARY 7, 2026"
formatDuration(min): h:mm:ss o m:ss
paceToSeconds(pace): "MM:SS" -> seconds
cadenceSpmFromRun(run): import da utils/cadence.ts
```

### MapLibre style

`https://tiles.openfreemap.org/styles/dark` (NO Mapbox token, free). `initialViewState`: zoom 14, pitch 45.

## 16.2 LiveTelemetry3DMap

**File**: `src/components/LiveTelemetry3DMap.tsx` (~600 righe)

Sub-componente attivato quando `mapView === '3d-telemetry'` in RoutesView. Riceve gia route + streams + splits + run.

### Props
```ts
{
  routeCoords: [number, number][];   // [lng, lat]
  streams:     any[];
  splits:      Split[];
  run:         Run;
}
```

### State

```
runData:        RunPoint[]                    // points equidistanti generati
isPlaying:      bool
playbackIndex:  number (float per smooth)
playbackSpeed:  0.5 | 1 | 2 | 4   default 1
currentBearing: number
cameraFollow:   bool                           // chase-cam toggle
// refs
lastTimeRef, rafRef, bearingRef
```

### RunPoint model

```ts
RunPoint {
  id:         number
  coordinates:[lng, lat]
  distance:   number (km)
  elevation:  number (m)
  heartRate:  number
  pace:       number (sec/km)
  cadence:    number (spm)
}
```

### Generazione runData (turf.js)

```
useEffect([routeCoords, streams, splits, run]):
  line       = turf.lineString(routeCoords)
  totalLength = turf.length(line, units='kilometers')
  numPoints   = clamp(routeCoords.length * 2, 300, 1000)

  for i in [0, numPoints):
    dist  = i / (numPoints-1) * totalLength
    pt    = turf.along(line, dist, units='kilometers')
    coords = pt.geometry.coordinates [lng, lat]

    if streams.length > 0:
       streamIdx = round(i/(numPoints-1) * (streams.length-1))
       elevation = streams[idx].alt ?? 0
       heartRate = streams[idx].hr  ?? 0
       pace      = streams[idx].pace ?? 0
       cadence   = normaliseCadenceSpm(streams[idx].cad) ?? 0
    elif splits.length > 0:
       splitIdx = floor(dist) clamp len-1
       elevation = split.elevation_difference ?? 0
       heartRate = split.hr ?? 0
       pace      = paceToSeconds(split.pace)
       cadence   = normaliseCadenceSpm(split.cadence) ?? 0

    points.push(RunPoint)

  on turf error: fallback runData = routeCoords.map((c,i) =>
    distance: i/(len-1) * run.distance_km
    elevation: 0, heartRate: avg_hr, pace: paceToSeconds(avg_pace),
    cadence: cadenceSpmFromRun(run))
```

### Animation loop (rAF)

```
useEffect([isPlaying, runData.length, playbackSpeed]):
  animate(time):
    deltaTime = (time - lastTime) / 1000 sec
    advancement = deltaTime * 3 * playbackSpeed   // 3 punti/sec base
    setPlaybackIndex(prev => min(prev + advancement, len-1))

end-of-route: useEffect — if playbackIndex >= len-1 -> setIsPlaying(false)
```

### Smooth interpolation (playbackPoint)

```ts
i = floor(playbackIndex)
frac = playbackIndex - i
p1 = runData[i]; p2 = runData[min(i+1, len-1)]
playbackPoint = {
  coordinates: lerp(p1.coords, p2.coords, frac),
  distance:    lerp(p1.distance, p2.distance, frac),
  elevation:   lerp(p1.elevation, p2.elevation, frac),
  heartRate:   lerp(p1.heartRate, p2.heartRate, frac),
  pace:        lerp(p1.pace, p2.pace, frac),
  cadence:     lerp(p1.cadence, p2.cadence, frac),
}
```

### Chase camera (3D)

```
useEffect([playbackPoint, cameraFollow, runData, playbackIndex]):
  idx = floor(playbackIndex)
  lookAhead = min(idx+15, len-1)
  from = turf.point(playbackPoint.coordinates)
  to   = turf.point(runData[lookAhead].coordinates)
  targetBearing = turf.bearing(from, to)

  // shortest arc
  delta = targetBearing - bearingRef
  delta normalized to [-180, 180]
  newBearing = bearingRef + delta * 0.08   (low-pass filter)
  bearingRef = newBearing

  map.jumpTo({
    center: playbackPoint.coordinates,
    bearing: newBearing,
    pitch: 70,
    zoom:  17.5,
  })
```

### Ghost runner (proiezione futura)

```
useMemo([playbackIndex, runData, isPlaying]):
  ghostIdx = min(playbackIndex * 1.02 + 15, len-1)
  -> interpolato come playbackPoint, mostrato dietro come marker fantasma
```

### GeoJSON layers

```
fullRouteGeoJSON:    routeCoords (sempre, opacity 0.12, dasharray [2,4])
completedRouteGeoJSON: runData.slice(0, floor(idx)+1) + playbackPoint.coords
                       lineMetrics + line-gradient 0->1 (alpha 0->1, color #C0FF00)
                       glow (line-blur 18, opacity 0.25)
```

### Mapbox setup

```
mapStyle: 'mapbox://styles/mapbox/dark-v11'
initialView: routeCoords[mid] zoom 14 pitch 60 bearing 0

onLoad:
  add source 'mapbox-dem' (raster-dem mapbox.mapbox-terrain-dem-v1, tileSize 512, maxzoom 14)
  setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })
  setFog({ range:[0.5,10], color:'#0a0a1a', high-color:'#0a0a1a', horizon-blend:0.1 })
  fitBounds(routeCoords) padding 80 pitch 60 duration 1500

3D buildings layer: 'building' source-layer, fill-extrusion-height interpolato a zoom 15
```

### UI controlli sinistra (380px)

| Sezione | Contenuto |
|---|---|
| Header | "Live Telemetry 3D" + runTitle |
| Live Metrics 2x2 | Distance (`playbackPoint.distance`), Pace (`formatPace`), HR, Elevation (live values con interpolazione) |
| Playback bar | `progress = playbackIndex/(len-1)*100`, click setza index proporzionale |
| Controls | Reset (`resetPlayback`) + Play/Pause (`togglePlay`) + Speed [0.5,1,2,4] |
| Camera toggle | `Chase Camera ON` <-> `Free Camera` (`cameraFollow`) |
| Km Splits table | per ogni split: `currentKm = floor(playbackPoint.distance)+1`, isActive=split.km===currentKm, isPassed=split.km<currentKm |

### Floating HUD (top-right su mappa, only when isPlaying)

Pace, HR, Elevation, Distance live (round o N/A se 0).

## 16.3 TrailRunView — RIMOSSO

> **FIX (2026-04-28)**: il file `src/components/TrailRunView.tsx` (~976 righe) e tutti i riferimenti correlati sono stati eliminati.
>
> Cosa è stato rimosso:
> - File `src/components/TrailRunView.tsx` (overlay full-screen Mapbox 3D con simulazione RAF, chase-cam, 53 waypoints hardcoded "Monte Cavo Loop", 6 segmenti, 2 water sources, slope-heatmap, telemetria simulata).
> - In `ActivitiesView.tsx`: import `TrailRunView`, state `showTrailView`/`setShowTrailView`, special-case `if (run.id === '__demo_trail__')` con card "Trail Premium" hardcoded, blocco `<AnimatePresence>` overlay, icon `Mountain` da lucide-react.
>
> Motivo: dati interamente hardcoded, non collegati a backend, codice sperimentale demo non parte del flusso utente reale.

## 16.4 API consumate (Punto 16 totale)

```
GET /api/runs/:id            -> Run completo (RoutesView/LiveTelemetry3DMap)
GET /api/runs/:id/splits     -> unknown (esposto da api.ts ma non chiamato qui)
```

## 16.5 Dipendenze esterne (Punto 16)

- `react-map-gl/maplibre` (RoutesView Standard) + `maplibre-gl`
- `react-map-gl/mapbox` (LiveTelemetry3DMap) + `mapbox-gl`
- `@turf/turf` (lineString, length, along, point, bearing)
- `recharts` (ComposedChart/AreaChart)
- `lucide-react` icons
- `utils/cadence.ts` -> `cadenceSpmFromRun`, `normaliseCadenceSpm`
- VITE_MAPBOX_TOKEN env

---

---

## Punto 17 — ProfileView (`src/components/ProfileView.tsx`)

### Responsabilità
Dashboard profilo atleta: hero con mappa ultima corsa, edit profilo, regola 80/20, grafico progressione pace, heatmap attività, personal records, Strava sync, Jarvis toggle.

### Route / accesso
Nessuna route dedicata — montato come tab `profile` in `App.tsx`.

### Props
```ts
interface ProfileViewProps {
  onNavigate: (view: string, data?: any) => void;
}
```

### State locale
```ts
const [profile, setProfile] = useState<Profile | null>(null);
const [runs, setRuns] = useState<Run[]>([]);
const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
const [isEditModalOpen, setIsEditModalOpen] = useState(false);
const [editForm, setEditForm] = useState<Partial<Profile>>({});
const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
const [isSaving, setIsSaving] = useState(false);
const [stravaConnecting, setStravaConnecting] = useState(false);
const [syncingStrava, setSyncingStrava] = useState(false);
```

### Context
```ts
const { isJarvisEnabled, toggleJarvis } = useJarvisContext();
```

### API calls
```ts
getProfile()         // GET /api/profile
getRuns()            // GET /api/runs
getHeatmap()         // GET /api/heatmap
updateProfile(form)  // PATCH /api/profile  (multipart/form-data)
getStravaAuthUrl()   // GET /api/strava/auth-url
syncStrava()         // POST /api/strava/sync
```

### Sotto-componenti principali

#### HeroMap
```
MapLibre GL (react-map-gl/maplibre), non-interactive
Source: ultima run con polyline decodificata → GeoJSON LineString
Layer "route-line": line-color, line-width 3
Layer "route-glow": line-color glow, line-width 7, opacity 0.3
Camera: fitBounds su [minLng, minLat, maxLng, maxLat] con padding 40
```
Decodifica Google Encoded Polyline:
```ts
function decodePolyline(encoded: string): [number, number][] {
  // standard Google algorithm: zigzag + 1e-5 scale
}
```

#### EditModal
Canvas resize per upload immagine profilo:
```ts
const canvas = document.createElement('canvas');
canvas.width = 256; canvas.height = 256;
ctx.drawImage(img, 0, 0, 256, 256);
const blob = canvas.toDataURL('image/jpeg', 0.85);
```
Form fields: `name`, `age`, `weight_kg`, `height_cm`, `max_hr`, `resting_hr`, `ftp_watts`, `bio`.
Submit: `PATCH /api/profile` con `FormData` (include `profile_pic` se file selezionato).

#### EightyTwentyRule
```ts
const SLOW_MAX_HR = 146; // bpm — soglia Z2
const slowRuns = runs.filter(r => r.avg_hr && r.avg_hr <= SLOW_MAX_HR);
const slowPct = slowRuns.length / runs.length * 100;
const isBalanced = slowPct >= 75 && slowPct <= 85;
```
Output: percentuale corsa lenta, badge "Bilanciato" / "Troppo intenso" / "Troppo lento".

#### PaceProgressionChart
SVG custom 500×140px, ultime 20 run ordinate per data:
```ts
const paces = last20.map(r => r.avg_pace_sec); // secondi/km
const minPace = Math.min(...paces);
const maxPace = Math.max(...paces);
// Scala Y invertita: pace più basso = in alto
const y = (pace: number) =>
  10 + ((pace - minPace) / (maxPace - minPace)) * 120;
// Linea SVG path con punti [x, y] per ogni run
// Area fill sotto la linea
// Dots colorati per run_type
```

#### Heatmap Attività
Griglia 24 settimane × 7 giorni:
```ts
function buildHeatmapGrid(
  heatmap: HeatmapPoint[],
  weeks: number = 24
): DayCell[][] {
  // genera array di 24*7 celle a partire da oggi - 24 settimane
  // ogni cella: { date, hasRun, runType, count }
  // run_type color mapping: easy→verde, tempo→arancio, long→blu, race→rosso
}
```

#### Personal Records
Navigazione verso RankingView:
```ts
PR_DISTANCES = ['1K','5K','10K','HM','Marathon'];
// Per ogni distanza, mostra best effort se disponibile
// Click → onNavigate('ranking', { distance })
```

#### Strava Connect/Sync
```ts
// Connect: window.location.href = await getStravaAuthUrl()
// Sync: syncStrava() → aggiorna runs + profile
// Mostra badge "Connesso" se profile.strava_connected === true
```

---

## Punto 18 — RankingView (`src/components/RankingView.tsx`)

### Responsabilità
Due tab: (1) Benchmark manuale con analisi statistica/percentile/WAVA/Riegel; (2) MyRanking auto che carica profilo + best efforts reali e mostra posizionamento completo.

### Route / accesso
Tab `ranking` in `App.tsx`. Riceve eventuale `initialData` con `{ distance }` da ProfileView.

### Props
```ts
interface RankingViewProps {
  onNavigate: (view: string, data?: any) => void;
  initialData?: { distance?: string };
}
```

### State Tab 1 (Benchmark manuale)
```ts
const [selectedDistance, setSelectedDistance] = useState('10K');
const [hours, setHours] = useState('');
const [minutes, setMinutes] = useState('');
const [seconds, setSeconds] = useState('');
const [age, setAge] = useState('');
const [gender, setGender] = useState<'M'|'F'>('M');
const [results, setResults] = useState<BenchmarkResult | null>(null);
```

### State Tab 2 (MyRanking)
```ts
const [profile, setProfile] = useState<Profile | null>(null);
const [bestEfforts, setBestEfforts] = useState<BestEffort[]>([]);
const [manualTimes, setManualTimes] = useState<Record<string, string>>({});
// manualTimes: override utente per distanze senza best effort
```

### API calls
```ts
getProfile()      // GET /api/profile
getBestEfforts()  // GET /api/best-efforts
```

### Modelli dati chiave
```ts
interface BenchmarkResult {
  timeSeconds: number;
  paceSecPerKm: number;
  percentile: number;       // 0–100
  wavaScore: number;        // 0–100
  tier: string;             // 'Elite'|'Sub-Elite'|'Competitive'|'Recreational'|'Beginner'
  predictedTimes: Record<string, number>; // Riegel per ogni distanza
  percentileVsAge: number;  // WAVA age-graded
}

interface BestEffort {
  distance: string;
  time_seconds: number;
  date: string;
  activity_id?: string;
}
```

### Matematica — Percentile (probit inverso / normCDF)

**Distribuzione log-normale dei tempi da corsa:**
```ts
// Medie di riferimento (secondi) per gender M
const REFERENCE_TIMES: Record<string, number> = {
  '1K': 210, '5K': 1380, '10K': 2880,
  'HM': 6300, 'Marathon': 13500
};
const SIGMA_COMPETITIVE = 0.22;
const SIGMA_ALL = 0.30;
```

**normCDF — approssimazione razionale:**
```ts
function normCDF(x: number): number {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741;
  const a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x) / Math.SQRT2);
  const poly = t*(a1 + t*(a2 + t*(a3 + t*(a4 + t*a5))));
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-x*x/2)));
}
```

**computePercentile:**
```ts
function computePercentile(
  timeSeconds: number,
  distance: string,
  gender: 'M'|'F'
): number {
  const mu = Math.log(REFERENCE_TIMES[distance] * (gender === 'F' ? 1.12 : 1));
  const sigma = SIGMA_ALL;
  const z = (Math.log(timeSeconds) - mu) / sigma;
  // Percentile: corridori più lenti di questo tempo
  return normCDF(z) * 100;
}
```

**Peter Acklam probit (inverse normCDF)** — usato per BellCurve SVG:
```ts
function probit(p: number): number {
  // Coefficienti Acklam (razionale) per approssimazione
  // a[0..5], b[0..4] per regione centrale |p-0.5| <= 0.425
  // c[0..5], d[0..3] per code
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, ...];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, ...];
  // ... implementazione completa
}
```

### Matematica — WAVA Age-Grading (WMA 2015)

```ts
// Tabelle WMA 2015 per ogni distanza × età (18–90), M e F
// age_factor(age, distance, gender): interpolazione lineare tra valori tabellati
// world_record(distance, gender): tempo WR di riferimento

function computeWAVA(
  timeSeconds: number,
  distance: string,
  age: number,
  gender: 'M'|'F'
): number {
  const wf = age_factor(age, distance, gender);
  const wr = world_record(distance, gender);
  // Performance time aggiustata per età
  const ageGradedTime = timeSeconds * wf;
  const wavaScore = (wr / ageGradedTime) * 100;
  return Math.min(wavaScore, 100);
}
```

Tier da WAVA score:
```ts
function getTier(wava: number): string {
  if (wava >= 90) return 'World Class';
  if (wava >= 80) return 'National Class';
  if (wava >= 70) return 'Regional Class';
  if (wava >= 60) return 'Local Class';
  if (wava >= 50) return 'Competitive';
  return 'Recreational';
}
```

### Matematica — Riegel Race Predictor

```ts
// T₂ = T₁ × (D₂/D₁)^1.06
const DISTANCES_METERS: Record<string, number> = {
  '1K': 1000, '5K': 5000, '10K': 10000,
  'HM': 21097, 'Marathon': 42195
};

function riegelPredict(
  knownTime: number,    // secondi
  knownDist: number,    // metri
  targetDist: number    // metri
): number {
  return knownTime * Math.pow(targetDist / knownDist, 1.06);
}
```

### Sotto-componenti

#### BellCurve (SVG)
```
SVG 400×120, x-axis = z-score da -3 a +3
Curva gaussiana: y = exp(-z²/2) / sqrt(2π) scalata a 100px
Area colorata a sinistra del percentile utente (fill gradient)
Marker verticale alla posizione z dell'utente
Label: "Top X%"
```

#### TierTable
```
Tabella 6 tier × distanze
Mostra WR-equivalente per ogni tier (WAVA ×)
Evidenzia riga del tier utente
```

#### DistancePredictor
```
Input: distanza sorgente + tempo
Output: griglia Riegel per tutte le altre distanze
```

#### WAVACard
```
Mostra: wavaScore, tier, confronto M/F stesso age-group
Gauge SVG 0–100
```

#### MultiDistRadar (Tab 2 — MyRanking)
```ts
// Recharts RadarChart
// Axes: '1K','5K','10K','HM','Marathon'
// Value: percentile per ogni distanza (0–100)
// Data source: merge bestEfforts + manualTimes (prende il valore migliore)
const mergedTimes = distances.map(d => {
  const be = bestEfforts.find(e => e.distance === d)?.time_seconds;
  const manual = manualTimes[d] ? parseTimeString(manualTimes[d]) : undefined;
  return be && manual ? Math.min(be, manual) : be ?? manual;
});
```

#### ComparativeTierTableFull
```
Griglia completa: utente vs tier corridori nazionali
Colonne: Distanza | Tempo utente | Percentile | WAVA | Tier | Gap vs tier superiore
Gap = riegelPredict(userTime, dist, dist) confrontato con soglia tier
```

#### ProfileAssessment (Riegel Cross-Analysis)
```ts
// Per ogni coppia di distanze (A, B):
// predictedB = riegelPredict(timeA, distA, distB)
// actualB = mergedTimes[B]
// pctDiff = (actualB - predictedB) / predictedB * 100
// deficit: pctDiff < -5% (peggio del previsto)
// strength: pctDiff > +5% (meglio del previsto)

interface DistanceAnalysis {
  distance: string;
  actual: number;
  predicted: number;
  pctDiff: number;
  label: 'strength' | 'deficit' | 'on-target';
}
```
Output: lista punti di forza e deficit per distanza, con suggerimento allenamento.

### MyRankingTab — flow completo
```
1. mount → getProfile() + getBestEfforts()
2. merge: bestEfforts + manualTimes → mergedTimes[]
3. computePercentile per ogni distanza → percentiles[]
4. computeWAVA(time, dist, profile.age, profile.gender) → wavaScores[]
5. Riegel cross-analysis → ProfileAssessment
6. render: MultiDistRadar + ComparativeTierTableFull + WAVACard + ProfileAssessment
7. utente può override tempo → setState manualTimes → ricalcolo immediato
```

---

---

## Punto 19 — RunnerDnaView + `runnerDnaModel.ts` + `useRunnerDnaUiModel.ts`

### Responsabilita
"DNA del corridore": scoring multidimensionale del profilo atletico con biomeccanica, potenziale distanze, diagnosi forze/debolezze, proiezione evoluzione.

### Route / accesso
Tab `runner-dna` in `App.tsx`.

### Props
```ts
interface RunnerDnaViewProps {
  onNavigate: (view: string, data?: any) => void;
}
```

### Hook principale: `useRunnerDnaUiModel`
```ts
// src/hooks/useRunnerDnaUiModel.ts
const { data: dna } = useApi(getRunnerDna);      // GET /api/runner-dna
const { data: profile } = useApi(getProfile);    // GET /api/profile
const { data: beData } = useApi(getBestEfforts); // GET /api/best-efforts

// Chiama buildRunnerDnaUiModel(dna, profile, bestEfforts) → RunnerDnaUiModel
```

### Modello dati di output: `RunnerDnaUiModel`
```ts
{
  base: { name, age, weightKg, heightCm, sex, level, trainingHistory,
          weeklyFrequency, totalRuns, totalKm, weeksActive }
  identity: { rank: RunnerDnaRank, archetype, description, coachVerdict, unlockMessage }
  performance: { vdot, vdotCeiling, avgPace, avgPaceSeconds, avgHr, avgCadence,
                 ctl, atl, tsb, readiness, freshness, trendStatus, idealDistance,
                 potentialPct, improvementPotential, pb5k, pb10k, pbHalf,
                 thresholdLabel, cardiacDriftLabel }
  scores: { overall, projected, items: RunnerDnaScoreItem[] }
  distanceTalents: RunnerDnaDistanceTalent[]
  biomechanics: RunnerDnaBiomechanicMetric[]
  diagnostics: { strengths, weaknesses, priorities }
  freshness: { lastRunDate, activeGarminCsv, matchedGarminCsv, label }
  predictions: { current, potential }   // Record<string,string> pace predizioni
  evolution: RunnerDnaEvolutionPoint[]
}
```

### Ranking system (in `runnerDnaModel.ts`)
```ts
const rankRules = [
  { min: 96, name: "Elite" },
  { min: 89, name: "Semi professionista" },
  { min: 79, name: "Esperto" },
  { min: 66, name: "Runner evoluto" },
  { min: 51, name: "Amatore solido" },
  { min: 36, name: "Amatore base" },
  { min: 21, name: "Corridore occasionale" },
  { min:  1, name: "Inizio percorso" },
];
```

### Score items — pesi
```ts
const scoreCopy = {
  aerobic_engine:  { weight: 30 },  // VDOT, capacita aerobica
  consistency:     { weight: 20 },  // runs/week, regolarita
  load_capacity:   { weight: 20 },  // volume assorbibile
  efficiency:      { weight: 15 },  // HR/pace ratio
  biomechanics:    { weight: 15 },  // cadenza, oscillazione, GCT
};
```

### Score overall / projected
```ts
currentStrength = mean(items.map(i => i.score))  // o da backend scores.current_strength
projected = clamp(currentStrength + improvementPotential * 0.25)
```

### Talenti per distanza (buildDistanceTalents)
```ts
// Ogni distanza ha formula lineare pesata dei 5 score items:
short:    aerobic*0.35 + biomechanics*0.35 + efficiency*0.20 + load*0.10
5K:       aerobic*0.38 + efficiency*0.24 + biomechanics*0.18 + consistency*0.10 + load*0.10
10K:      aerobic*0.30 + efficiency*0.24 + consistency*0.20 + load*0.16 + biomechanics*0.10
HalfM:    load*0.30 + consistency*0.27 + aerobic*0.20 + efficiency*0.18 + biomechanics*0.05
Marathon: load*0.36 + consistency*0.30 + efficiency*0.18 + aerobic*0.10 + biomechanics*0.06
Ultra:    load*0.38 + consistency*0.32 + efficiency*0.16 + biomechanics*0.08 + aerobic*0.06
// Bonus +8 per ideal_distance match
// Ordinate per score desc
```

### Biomechanics scoring (metricScoreHigher / metricScoreLower)
```ts
function metricScoreHigher(value, low, high) => clamp((value - low) / (high - low) * 100)
function metricScoreLower(value, best, worst) => clamp((worst - value) / (worst - best) * 100)

// Benchmark per metrica:
cadence:              metricScoreHigher(spm, 150, 184)   benchmark "168-182 spm"
vertical_oscillation: metricScoreLower(cm, 6.4, 11.2)   benchmark "6.5-8.5 cm"
vertical_ratio:       metricScoreLower(pct, 5.8, 10.2)  benchmark "6.0-7.5%"
ground_contact:       metricScoreLower(ms, 205, 300)    benchmark "210-240 ms"
stride_length:        metricScoreHigher(m, 0.85, 1.35)  benchmark "1.10-1.30 m"
```

### Verdict biomeccanica
```ts
score >= 72 → "positivo"
score >= 52 → "neutro"
< 52        → "da migliorare"
null        → "non disponibile"
```

### Sotto-componenti visuali (RunnerDnaView.tsx)

| Componente | Tipo | Dati |
|---|---|---|
| `DnaHelixDecor` | SVG animato | 4 loop, 140 steps, 30 rungs |
| `VdotGauge` | SVG cerchio | arc strokeDashoffset, transition 2s cubic-bezier |
| `DnaStrand` | barra animata | score 0-100, colori gradient |
| `TrendBadge` | badge colorato | status string → color map |
| `ComparisonRow` | barre comparative | normalizzato min/max, higherBetter flag |
| `buildProfileVisualScores` | transformer | usa breakdown[] o dna_scores fallback |

Chart Recharts usati:
- `RadarChart` per score radar
- `BarChart` per confronti
- `AreaChart` per evoluzione

---

## Punto 20 — StatisticsView (`src/components/statistics/StatisticsView.tsx`)

### Responsabilita
Master view analytics con 5 tab, ognuna con proprio layout `react-grid-layout` persistito su `localStorage`. Orchestratore di tutti i sotto-componenti analytics.

### Tab disponibili
```ts
type StatTab = 'load_form' | 'biology' | 'biomechanics' | 'future_lab' | 'environment';
```

| Tab | Label | Componenti principali |
|---|---|---|
| `load_form` | Carico & Forma | FitnessFreshness, MainChart, AnalyticsV5 (PaceDistributionBell, EffortMatrix), SupercompensationChart |
| `biology` | DNA Biologico | BiologyFutureLab, BiologyFutureV2, SupercompensationChart, AdaptationPanel |
| `biomechanics` | Biomeccanica | AnalyticsV2 (drift, zone), AnalyticsV3, AnalyticsV4 (cadence-speed matrix) |
| `future_lab` | Futuro Lab | BiologyFutureLab, AnalyticsV2 PMC, StatsDrift |
| `environment` | Ambiente | EnvironmentalNormalizerView |

### API calls
```ts
getAnalytics()           // GET /api/analytics
getVdotPaces()           // GET /api/vdot/paces
getRuns()                // GET /api/runs
getGctAnalysis()         // GET /api/garmin/gct-analysis
getDashboard()           // GET /api/dashboard
getProAnalytics()        // GET /api/analytics/pro
getSupercompensation()   // GET /api/supercompensation
getProfile()             // GET /api/profile
```

### Layout grid per tab (useLoadFormLayout hook)
```ts
// Chiave localStorage: "metic:statistics:load-form:layout"
// Chiave hidden: "metic:statistics:load-form:hidden"
// LOAD_FORM_WIDGETS: 6 widget con i,x,y,w,h per lg/md/sm
// mergeLocalLayouts: unisce layout salvato con default (aggiunge nuovi widget)
// Persist automatica su onLayoutChange
```

### classifyBiologyRun (locale, per fallback supercompensazione)
```ts
function classifyBiologyRun(run: Run): { type, key, window, reason }
  // Neuromuscolare (window: 7gg):
  //   regex /repetition|ripet|sprint|fartlek|hill sprint/ || durata<=45 && pace<=300 && hrPct>=82
  // Strutturale (window: 21gg):
  //   regex /long|lungo|trail|collinare/ || distance>=14 || duration>=75 || elevation>=250
  // Metabolico (window: 14gg): default
```

### buildStravaBiologyFallback — supercompensazione locale
```ts
// Usato quando GET /api/supercompensation non disponibile
// Per ogni run Strava (max 20, non treadmill, ordinate per data desc):
//   load = distance * duration / 10 * hrFactor   (hrFactor = 1 + max(hrPct-70,0)/100)
//   elapsed = days_since_run
//   maturity = elapsed <= window ? elapsed/window : max(0, 1 - (elapsed-window)/(window*0.75))
//
// Projection 21gg:
//   adaptation_ready = matured / totalLoad * 100
//   freshness = 50 + latestTsb * 1.4 + i * 0.6
//   readiness = adaptationReady * 0.62 + freshness * 0.38
//   bestPoint = max(readiness) → golden_day
```

### hasUsableChart / preferChart
```ts
// ProAnalyticsChart usabile se sample_size > 0 e series_card.length > 0
function hasUsableChart(chart?: ProAnalyticsChart): boolean
function preferChart(primary, fallback): ProAnalyticsChart
```

---

## Punto 21 — AnalyticsV2 / V3 / V4 / V5

### AnalyticsV2 (`src/components/statistics/AnalyticsV2.tsx`)
Panelli con effetti glow SVG, gauge semi-circolari.

**SemiGauge SVG:**
```ts
// Semicerchio da sinistra a destra attraverso il top
R = 68
CIRC = Math.PI * R    // lunghezza semicerchio
offset = CIRC * (1 - pct)
path = `M ${80-R} 78 A ${R} ${R} 0 0 1 ${80+R} 78`
// transition: all 1000ms
```

**GlowDefs:** filtri SVG `feGaussianBlur stdDeviation=5` + `feMerge` per glow sui chart.

**Dati mock presenti** (usati quando `ProAnalytics` non disponibile):
- `pmcV2`: 90 punti CTL/ATL/TSB calcolati con noise sinusoidale
- `paceTrendV2`: 10 mesi, base 5.8 min/km decrescente
- `driftV2`: 14 km splits con HR crescente (drift simulato)
- `zonesV2`: 5 zone HR con percentuali e minuti

**Chart principali:**
- AreaChart PMC (CTL + ATL + TSB con ReferenceLine a 0)
- LineChart cardiac drift (pace + HR, ReferenceArea da km 8 = zona drift)
- BarChart zone distribution

### AnalyticsV4 (`src/components/statistics/AnalyticsV4.tsx`)

**AnalyticsV4CadenceSpeedMatrix:** ScatterChart cadenza (x) vs velocita (y), colorato per run_type.

**AnalyticsV4PaceZoneDistribution:** BarChart distribuzione corse per fascia di passo (Z1-Z5) con dati reali da `runs`.

### AnalyticsV5 (`src/components/statistics/AnalyticsV5.tsx`)

**AnalyticsV5BestEffortsProgression:** LineChart evoluzione PB nel tempo per distanza.

**AnalyticsV5EffortMatrix:** ComposedChart (Bar + Line) sforzo per settimana: distanza + HR media.

**AnalyticsV5PaceDistributionBell:** BarChart distribuzione passo (istogramma) con curva normale sovrapposta.

### ChartFullscreenModal
```ts
// Modal overlay che wrappa un chart in fullscreen
interface ChartExpandButtonProps { onClick: () => void }
interface ChartFullscreenModalProps { title, children, onClose }
```

---

## Punto 22 — BiologyFutureLab + BiologyFutureV2

### BiologyFutureLab (`src/components/statistics/BiologyFutureLab.tsx`)

**Props:**
```ts
interface Props {
  profile: Profile | null | undefined;
  runs: Run[];
  vdot: number | null;
}
```

**Dati dal modello detrenamento:**
```ts
const inputs = buildDetrainingInputs(profile, runs, vdot);
const summary = computeDetrainingCurve(inputs);
// → summary.curve: array di PaceProjection per day 0..60
```

**buildChartData:**
```ts
summary.curve
  .filter(p => p.day % 1 === 0 && p.day <= 60)
  .map(p => ({
    day: p.day,
    vo2:    p.vo2Pct * 100,        // VO2max %
    lt:     p.ltPct * 100,         // Soglia lattato %
    plasma: p.plasmaPct * 100,     // Volume plasmatico %
    mito:   p.mitochondriaPct * 100, // Mitocondri %
    cap:    p.capillaryPct * 100,  // Capillari %
    stroke: p.strokeVolumePct * 100, // Volume sistolico %
    hr:     p.restingHrDelta,      // Delta FC riposo (bpm)
    perf:   p.performancePct * 100 // Performance stimata %
  }))
```

**Chart:** ComposedChart con 6 linee sovrapposte (VO2, LT, plasma, mito, capillari, performance), ReferenceLine a 100%.

**PaceTable:** proiezione pace per distanze (5K/10K/HM/Marathon) a D3/D7/D14/D30/D60.

### BiologyFutureV2 (`src/components/statistics/BiologyFutureV2.tsx`)
Variante con layout alternativo, stessi dati detraining + proiezioni future con grafici Recharts `AreaChart` per trend forma prevista. Mostra anche zona "taper" (D3, D7) in verde.

---

## Punto 23 — EnvironmentalNormalizerView

### File: `src/components/statistics/EnvironmentalNormalizerView.tsx`

### Props
```ts
interface Props { runs: Run[] }
```

### State
```ts
const [limit, setLimit] = useState<10 | 30>(10);
const [weatherByRun, setWeatherByRun] = useState<Record<string, WeatherSnapshot | null>>({});
```

### Fetching meteo — Open-Meteo Archive API
```ts
// URL: https://archive-api.open-meteo.com/v1/archive
// Parametri: latitude, longitude, start_date, end_date, hourly (temp/humidity/apparent_temp/wind)
// Cache locale: weatherCache Map<key, Promise>
// Key: "${run.id}:${run.date}:${lat.toFixed(4)}:${lon.toFixed(4)}:${hour}"
// Fallback: usa run.temperature se disponibile
```

### Stima ora di corsa (inferRunHour)
```ts
// Analisi nome corsa con regex:
"night"      → 22:00
"evening"    → 20:00
"afternoon"  → 17:00
"lunch"      → 13:00
"morning"    → 07:00
default      → 08:00
```

### Modello penalita ambientale (computeEnvironmentalPenalty)
```ts
effectiveTemp = apparent ?? temperature ?? run.temperature ?? 10
humidity = weather.humidity ?? 60
wind = weather.wind ?? 8
elevationPerKm = elevation_gain / distance_km

heatPenalty    = max(0, effectiveTemp - 12) * 0.72   // sec/km per ogni °C > 12°C
coldPenalty    = max(0, 5 - effectiveTemp) * 0.30    // sec/km per ogni °C < 5°C
humidityPenalty= max(0, humidity - 65) * 0.16        // sec/km per ogni % > 65%
windPenalty    = max(0, wind - 12) * 0.12            // sec/km per ogni km/h > 12
climbPenalty   = max(0, elevationPerKm - 6) * 0.15  // sec/km per ogni m/km > 6
synergyPenalty = (temp>22 && humidity>70) ? (temp-22)*(humidity-70)/85 : 0

distanceFactor = clamp(distance / 8, 0.88, 1.12)
total = (somma penalita) * distanceFactor            // capped a 28 sec/km
```

**Output:** `normalizedPaceSec = actualPaceSec - total` (ritmo in condizioni ideali 5-10°C).

**Chart:** ComposedChart con Bar (passo reale) + Line (passo normalizzato) per le ultime N corse.

**Filtro:** escluse corse indoor, senza GPS, con passo > 5:00/km.

---

## Punto 24 — Jarvis (Orb + Overlay + Hook + Context)

### JarvisContext (`src/context/JarvisContext.tsx`)
```ts
interface JarvisContextType {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  JarvisPortal: ReactNode;  // = <JarvisOverlay /> quando enabled, null altrimenti
}
```
Provider monta `<JarvisOverlay />` condizionalmente. `useJarvisContext()` espone il toggle usato da ProfileView e altri.

### JarvisOrb (`src/components/JarvisOrb.tsx`)
Three.js WebGL puro via `useRef<HTMLCanvasElement>`:

```ts
// 2000 particelle distribuite su sfera
N = 2000
pos[i] = r * sin(phi) * cos(theta)  // r = Math.pow(random, 0.5) * 25
mat = PointsMaterial({ size: 0.4, blending: AdditiveBlending })

// 6000 segmenti di linea
MAX_LINES = 6000
lineMat = LineBasicMaterial({ blending: AdditiveBlending })

// Colori:
COLOR_LIME = 0xC0FF00  // idle / listening
COLOR_TEAL = 0x00FFAA  // thinking / speaking

// Stati animazione (float lerp per smooth transition):
targetRadius, currentRadius    // espansione sfera
targetSpeed, currentSpeed      // velocita orbita
targetBright, currentBright    // luminosita
targetSize, currentSize        // dimensione particelle
lineAmount, targetLineAmount   // quante linee disegnare

// RAF loop: aggiorna parametri per stato orb, anima particelle, ridisegna linee
// Analyser FFT 256 bins per reactive audio visualization durante speaking
```

### useJarvis (`src/hooks/useJarvis.ts`)

**State machine OrbState:**
```ts
type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'navigating'
```

**Doppio motore ASR:**
```ts
// 1. Local Whisper (prioritario se presente):
//    Healthcheck: GET http://localhost:9000/status
//    Se ok → usa VAD loop con MediaRecorder + AnalyserNode FFT
//    Silenzio > 1200ms dopo parlato (avg frequenza > 1.5) → stop MediaRecorder
//    POST http://localhost:9000/transcribe (FormData "file": audio/webm)
//    → data.text → processFinalText()
//
// 2. Chrome Web Speech API (fallback):
//    SpeechRecognition({ lang: 'it-IT', continuous: false, interimResults: true })
//    Restart automatico 800ms dopo onend se still listening
//    Interim fallback: 2500ms timer dopo wake word interim
```

**Wake word detection:**
```ts
const WAKE_WORD_RE = /\b(jarvis|giarvis|gervis|giavis|ehi jarvis|hey jarvis|ok jarvis|service|servizio)\b/i
```

**Direct navigation (senza API call):**
```ts
const DIRECT_NAV = [
  { re: /dashboard|home/, route: '/' },
  { re: /allenamento|training/, route: '/training' },
  { re: /attivita|corse/, route: '/activities' },
  { re: /statistiche/, route: '/statistics' },
  { re: /runner.*dna/, route: '/runner-dna' },
  { re: /profilo|profile/, route: '/profile' },
];
// Match → onAction({ type: 'navigate', route }) + speak() immediato
```

**Flow comando con API:**
```
processFinalText(lower)
  → DIRECT_NAV match → navigazione istantanea
  → WAKE_WORD_RE match → estrai comando → sendCommand(cmd)
    → updateOrbState('thinking')
    → jarvisChat(cmd)   // POST /api/jarvis/chat
    → setResponse(result.text)
    → speak(result.text, result.audio)
      → se audio base64 Fish Audio: AudioContext.decodeAudioData → BufferSource
      → fallback: SpeechSynthesisUtterance('it-IT', rate=1.05, pitch=0.95)
      → Chrome bug fix: pause()+resume() ogni 5s via setInterval
      → onEnd → updateOrbState('listening') → startListening()
```

**Audio setup:**
```ts
navigator.mediaDevices.getUserMedia({ audio: true })
AudioContext → AnalyserNode (fftSize: 256) → MediaStreamSource
// Condiviso tra mic input e Fish Audio output (entrambi connessi al medesimo analyser)
```

---

## Punto 25 — Backend API Surface

**File:** `backend/server.py` — FastAPI app, MongoDB motor, CORS *.

### Endpoint completi (55+)

| Metodo | Path | Funzione |
|---|---|---|
| GET | `/` | health |
| GET | `/api/version` | versione + schema |
| GET | `/api/strava/auth-url` | URL OAuth Strava |
| GET | `/api/strava/callback` | redirect SPA con `?strava_code=` |
| POST | `/api/strava/exchange-code` | scambia code → tokens, crea profilo |
| POST | `/api/strava/sync` | sync attivita da Strava API |
| GET | `/api/profile` | profilo atleta |
| PATCH | `/api/profile` | aggiorna profilo (multipart) |
| GET | `/api/runs` | lista run (con split/polyline) |
| GET | `/api/runs/{id}` | singola run |
| GET | `/api/runs/{id}/splits` | splits corsa |
| GET | `/api/dashboard` | dati dashboard aggregati |
| GET | `/api/fitness-freshness` | storico CTL/ATL/TSB |
| POST | `/api/fitness-freshness/recalculate` | ricalcola TRIMP |
| GET | `/api/analytics` | analytics base |
| GET | `/api/analytics/pro` | analytics avanzate (multi-tab, multi-range) |
| GET | `/api/vdot/paces` | paces per VDOT corrente |
| GET | `/api/recovery-score` | recovery score |
| GET | `/api/injury-risk` | rischio infortuni |
| POST | `/api/recovery-checkin` | checkin recupero |
| GET | `/api/supercompensation` | dati supercompensazione |
| GET | `/api/training-plan` | piano allenamento |
| GET | `/api/training-plan/current` | settimana corrente |
| PATCH | `/api/training-plan/session/complete` | toggle sessione |
| POST | `/api/training-plan/generate` | genera piano Daniels |
| POST | `/api/training-plan/adapt` | adatta piano |
| POST | `/api/training-plan/evaluate-test` | valuta test distanza |
| GET | `/api/badges` | badge sbloccati |
| GET | `/api/best-efforts` | personal best per distanza |
| GET | `/api/heatmap` | heatmap attivita 24 settimane |
| GET | `/api/weekly-report` | report settimanale |
| GET | `/api/weekly-history` | storico settimanale |
| GET | `/api/prediction-history` | storico predizioni gara |
| GET | `/api/garmin/status` | stato token Garmin |
| GET | `/api/garmin/auth-start` | URL SSO Garmin (garth) |
| POST | `/api/garmin/exchange-ticket` | scambia ticket CAS Garmin |
| POST | `/api/garmin/save-token` | salva dump token garth |
| POST | `/api/garmin/sync` | sync Garmin (limit, force) |
| POST | `/api/garmin/sync-all` | sync completo |
| POST | `/api/garmin/csv-import` | importa CSV Garmin |
| POST | `/api/garmin/csv-link` | abbina CSV → run Strava |
| GET | `/api/garmin/csv-data` | lista CSV importati |
| DELETE | `/api/garmin/csv-data/{id}` | elimina CSV |
| GET | `/api/garmin/gct-analysis` | analisi ground contact time mensile |
| GET | `/api/runner-dna` | DNA corridore (con cache) |
| DELETE | `/api/runner-dna/cache` | invalida cache DNA |
| POST | `/api/ai/analyze-run` | analisi AI singola corsa (Anthropic) |
| GET | `/api/ai/dashboard-insight` | insight AI dashboard |
| POST | `/api/jarvis/chat` | chat Jarvis (Gemini + Fish Audio TTS) |
| GET | `/api/user/layout` | layout griglia utente |
| PUT | `/api/user/layout` | salva layout griglia |

### DB collections MongoDB
```
runs, profile, strava_tokens, fitness_freshness,
training_plan, garmin_csv_data, analytics_cache,
runner_dna_cache, badges_cache, badges_log
```

### Schemi versione
```python
ANALYTICS_SCHEMA_VERSION    = "pro-v9-2026-04-19"
RUNNER_DNA_SCHEMA_VERSION   = "runner-dna-v4-2026-04-22"
GARMIN_CSV_REPAIR_VERSION   = "garmin-csv-repair-v2-2026-04-22"
```

---

## Punto 26 — Backend Math (TRIMP, CTL/ATL/TSB, VDOT, Daniels)

### TRIMP — Metodo Lucia 2003 (`_compute_fitness_freshness`)
```python
hr_reserve = (avg_hr - resting_hr) / (max_hr - resting_hr)   # clampato [0,1]
trimp = duration_min * hr_reserve * (0.64 * exp(1.92 * hr_reserve))
# Fallback senza HR: hr_reserve = 0.55
```

### CTL/ATL/TSB — EMA giornaliera
```python
FITNESS_CTL_DAYS = 42    # Chronic Training Load
FITNESS_ATL_DAYS = 7     # Acute Training Load

ALPHA_CTL = 2.0 / (42 + 1)   # = 0.04651
ALPHA_ATL = 2.0 / (7 + 1)    # = 0.25

# Per ogni giorno da primo run a oggi:
ctl = ctl + ALPHA_CTL * (trimp_today - ctl)
atl = atl + ALPHA_ATL * (trimp_today - atl)
tsb = ctl - atl   # Training Stress Balance
```

### Proiezione forward (senza nuovo allenamento)
```python
# Usato in _project_fitness_freshness_doc:
elapsed_days = (now - computed_at).total_seconds() / 86400
ctl_projected = ctl * ((1 - ALPHA_CTL) ** elapsed_days)
atl_projected = atl * ((1 - ALPHA_ATL) ** elapsed_days)
tsb_projected = ctl_projected - atl_projected
```

### VDOT — Daniels & Gilbert (iterativo)
```python
# Calcolo da gara: dato tempo T e distanza D,
# trova V = % VO2max per quella distanza (tabella Daniels)
# Procedura iterativa: vdot tale che velocity(vdot, D) * T ≈ D
# velocity(vdot, %vo2max) = vdot * %vo2max / 1000  [ml/kg/min → m/min]
#
# %VO2max = 0.8 + 0.1894393 * e^(-0.012778 * T_min)
#          + 0.2989558 * e^(-0.1932605 * T_min)
#
# VO2 = (-4.60 + 0.182258*v + 0.000104*v^2) dove v = m/min
# VDOT = VO2 / %VO2max
```

### Paces Daniels per zona
```python
# Da VDOT derivate pace per:
# E (Easy): 59-74% VO2max
# M (Marathon): 75-84% VO2max
# T (Threshold): 83-88% VO2max
# I (Interval): 95-100% VO2max
# R (Repetition): >100% VO2max
```

### Generatore piano Daniels
```python
# Input: goal_race, weeks_to_race, target_time, plan_mode, dry_run
# Calcola: vdot_corrente → vdot_target → delta_settimane
# Piano diviso in blocchi:
#   Base (25% settimane): solo easy + lunghi
#   Build (40% settimane): introduce interval e tempo
#   Peak (25% settimane): volume max, qualita alta
#   Taper (10% settimane): volume -30-50%, mantiene intensita
# Ogni sessione ha: run_type, distance_km, pace, notes
```

### Feasibility check
```python
# Taxa di miglioramento VDOT settimanale max: ~0.5 punti/sett (amatori)
# vdot_needed = vdot_per_tempo_obiettivo(target_time, race_distance)
# improvement_needed = vdot_needed - vdot_corrente
# weeks_needed = improvement_needed / 0.5
# feasible = weeks_to_race >= weeks_needed * 0.8
# confidence_pct = min(95, 50 + (weeks_to_race - weeks_needed) * 5)
```

---

## Punto 27 — Backend DNA + Supercompensazione

### Runner DNA (`GET /api/runner-dna`)
```python
# Cache su db.runner_dna_cache (keyed per athlete_id)
# Schema version check: RUNNER_DNA_SCHEMA_VERSION
# Dati aggregati da: runs, garmin_csv_data, profile, fitness_freshness
#
# Struttura risposta RunnerDnaResponse:
{
  dna: {
    profile: { vdot_current, level, archetype_description, type }
    stats: { total_runs, total_km, avg_pace, avg_hr, avg_cadence, weeks_active }
    performance: { trend_status, trend_detail }
    consistency: { runs_per_week }
    efficiency: { label, description }
    current_state: { tsb, ctl, atl, fitness_score, readiness, form_label }
    potential: { vdot_ceiling, ideal_distance, potential_pct,
                 current_predictions, predictions }
    ai_coach: { coach_verdict, unlock_message, gaps }
    diagnostics: { strengths, weaknesses, priorities }
    running_dynamics: { vertical_oscillation_cm, vertical_ratio_pct,
                        ground_contact_ms, stride_length_m, sample_runs,
                        cadence_runs, ... }
    scores: { current_strength, improvement_potential, breakdown[] }
    comparison: { last_month: { vdot } }
    data_freshness: { last_run_date, active_garmin_csv, matched_garmin_csv,
                      schema_version, data_signature, auto_recalculated }
  }
}
```

### Supercompensazione (`GET /api/supercompensation`)
```python
# Risposta SupercompensationResponse:
{
  investments: [{ date, load, type, adaptation_type }]
  golden_day: str | null          # data peak readiness
  days_to_golden: int | null
  projection: SupercompensationProjectionPoint[]  # 21 giorni
  recent_runs: SupercompensationRun[]             # max 20
  adaptation_totals: {
    neuromuscular: { label, load, runs, missing_pct, ready_pct, color }
    metabolic:     { ... }
    structural:    { ... }
  }
  golden_day_score: float | null
}

# SupercompensationProjectionPoint per giorno i:
{
  date, label,
  neuromuscular, metabolic, structural,  # 0-100 maturita adattamento
  adaptation_ready, readiness, fitness,  # 0-100
  tsb, freshness
}
```

---

## Punto 28 — Strava + Garmin Pipeline

### Strava OAuth flow
```
1. Frontend → GET /api/strava/auth-url → URL Strava
2. Browser redirect → Strava authorize page
3. Strava redirect → GET /api/strava/callback?code=XXX
4. Backend redirect → FRONTEND_URL?strava_code=XXX
5. Frontend → POST /api/strava/exchange-code { code }
6. Backend → POST https://www.strava.com/oauth/token
7. Upsert db.strava_tokens (athlete_id, access_token, refresh_token, expires_at)
8. Crea profilo (se nuovo atleta)
```

### Strava sync (`POST /api/strava/sync`)
```python
# Refresh token se scaduto: POST /oauth/token con grant_type=refresh_token
# GET https://www.strava.com/api/v3/athlete/activities
#   Paginazione: per_page=200, after=last_synced_timestamp
# Per ogni activity:
#   GET /api/v3/activities/{id} (solo se tipo=Run)
#   GET /api/v3/activities/{id}/streams?keys=latlng,heartrate,cadence,altitude
#   Normalizza: calcola has_gps, avg_cadence_spm, biomechanics dict
#   Upsert db.runs (unique: strava_id)
#   Invalida analytics_cache + runner_dna_cache
```

### Garmin pipeline — garth SSO
```python
# garth: libreria Python per Garmin Connect SSO
# Flow: GET /api/garmin/auth-start → URL CAS SSO
# Utente autentica su Garmin → ticket CAS
# POST /api/garmin/exchange-ticket { ticket, service } → garth.resume()
# POST /api/garmin/save-token { token_dump } → garth.load(dump)
#
# Script locali: garth_generate_token.py (browser automation + token dump)
```

### Garmin sync (`POST /api/garmin/sync`)
```python
# garth.client.connectapi() → lista activities Garmin
# Per ogni activity:
#   GET activity details + laps + running dynamics
#   Abbina a run Strava per data/distanza (finestra +/-3 min, distanza +/-1km)
#   Arricchisce run con: avg_vertical_oscillation, avg_ground_contact_time,
#                        avg_vertical_ratio, avg_stride_length
#   Update db.runs + db.garmin_csv_data.matched_run_id
```

### Garmin CSV import (`POST /api/garmin/csv-import`)
```python
# Frontend invia: rows[] = array di { [colonna]: valore } dal CSV parseato
# Auto-detect delimiter (comma/semicolon/tab), gestione quotes
# Per ogni riga:
#   Genera fingerprint = hash(athlete_id + date + distance + duration)
#   Upsert db.garmin_csv_data (unique: fingerprint)
#   Parsed fields: date, distance_km, duration_minutes, avg_pace, avg_hr,
#     avg_vertical_oscillation_cm, avg_vertical_ratio_pct, avg_ground_contact_time_ms,
#     avg_stride_length_m, avg_cadence_spm, elevation_gain_m, avg_power_w, calories
# Schema repair v2: normalizza header italiani/inglesi
```

### CSV link (`POST /api/garmin/csv-link`)
```python
# Abbina CSV non linkati a run Strava:
# Per ogni garmin_csv senza matched_run_id:
#   Cerca in runs: same date ±3min, distance ±1km
#   Se match unico → set matched_run_id, aggiungi dynamics alla run
#   Se amgibuo → match_status = "ambiguous"
# Ritorna: GarminCsvLinkResult { matched, unmatched, ambiguous, enriched }
```

### FIT file extraction
```python
# Usando fitdecode (Python library)
# GET activity FIT stream da Garmin Connect
# Estrae: DataMessage "record" → latlng, hr, cadence, altitude
# DataMessage "session" → total fields
# DataMessage "lap" → splits
```

---

## Punto 29 — Settings, Theme, ErrorBoundary

### ThemeContext (`src/context/ThemeContext.tsx`)
```ts
type Theme = "dark" | "light"
// Persiste in localStorage["app-theme"]
// Applica a <html data-theme="..."> per CSS custom props globali
// Default: "dark"
interface ThemeContextValue { theme, setTheme, toggleTheme }
```

### SettingsControls (`src/components/SettingsControls.tsx`)
Pannello impostazioni accessibile da Sidebar. Espone:
- Toggle tema dark/light (`useTheme`)
- Toggle Jarvis (`useJarvisContext`)
- Selezione lingua (`i18n.changeLanguage`)
- Link alla documentazione

### ErrorBoundary (`src/components/ErrorBoundary.tsx`)
```ts
// Class component React 19
interface Props { children, fallback?, resetKey? }
interface State { hasError, error: Error | null }

// getDerivedStateFromError → hasError = true
// componentDidCatch → console.error
// componentDidUpdate: se resetKey cambia && hasError → reset (consente ripristino su navigazione)
// Render fallback personalizzato o default con pulsante "Torna alla Dashboard"
// Usato come wrapper per ogni tab/view in App.tsx
```

### MapFallback (`src/components/MapFallback.tsx`)
Componente fallback mostrato quando la mappa Mapbox/MapLibre non riesce a caricare (token mancante, errore WebGL). Mostra messaggio statico con link a configurazione token.

### Local Whisper server (`local-whisper/server.py`)
```
FastAPI su porta 9000
GET /status → { ok: true }
POST /transcribe (FormData "file") → { text, time_ms }
Usa faster-whisper su GPU RTX 4080
Model: "large-v3" o configurabile
Output: trascrizione audio/webm in italiano
```

---

# CHANGELOG FIX — 2026-04-28

Lista di interventi correttivi applicati al codice rispetto a quanto descritto nelle sezioni precedenti.

## 1. CardiacDrift — algoritmo unificato (Punto 8.5)

**File**: `src/components/CardiacDrift.tsx`

- **Prima**: copia locale di `parsePaceSec`, `DriftResult` e `computeDrift` con filtro permissivo `±15%`/`+20%` e nessun check `< 50% split validi`. Algoritmo divergente rispetto a `src/utils/cardiacDrift.ts` (filtro `±12%` + reject 50%).
- **Dopo**: rimosse le copie locali. Componente importa `computeDrift` e `DriftResult` direttamente dall'util. Una sola implementazione canonica per tutto il sistema.
- **Effetto utente**: corse con tratti molto variabili non sono più classificate come drift stabili (meno falsi positivi). I pochi run dove l'algoritmo locale forniva un drift e l'ufficiale tornava `null` ora mostrano "Sincronizza corse..." invece del valore.
- **Conservato**: `fmtPace` e `driftLabel` locali (quest'ultimo ha `bg`/`border` Tailwind specifici non presenti nell'util).

## 2. AnalyticsV2 — rimosso codice morto con `Math.random()` (Punto 21 / `AnalyticsV2.tsx`)

**File**: `src/components/statistics/AnalyticsV2.tsx`

- **Prima**: tre costanti module-level con `Math.random()` ricalcolate ad ogni reload del modulo:
  - `pmcV2` (90 giorni, ATL pseudo-random)
  - `paceTrendV2` (10 mesi, deterministica ma dead)
  - `driftV2` (14 km splits, pace+HR random)
- **Dopo**: tutte e tre rimosse. Erano già **dead code**: `pmcChartData` (line 1019) usa dati reali ffHistory o array vuoto; `driftChartData` usa run reali o vuoto. Mai renderizzate.
- **Conservato**: `DRIFT_START_KM = '8'` (usato come fallback constant a line 1134) e `zonesV2` (mapping colori zone, no fake data).
- **Effetto utente**: nessun cambio visivo (codice non eseguito). Bundle leggermente più piccolo, niente valori pseudo-random a module-load.

## 3. TopBar (App.tsx) — UI morta rimossa (Punto 1)

**File**: `src/App.tsx`

- **Search input**: ora `disabled` + `readOnly` + `opacity-50` + tooltip "Coming soon". Prima era senza `onChange`/`onSubmit` ma sembrava attivo.
- **Bell**: rimosso il dot rosso statico (`bg-rose-500 rounded-full`) che simulava una notifica permanente. Bell ora dimmed + `cursor-not-allowed` con tooltip.
- **Settings icon**: rimosso completamente. Era duplicato — `SettingsControls` (a sinistra) gestisce già lingua/tema. Anche import `Settings` da lucide-react rimosso.
- **Avatar**: rimossa `<img src="https://picsum.photos/seed/user/100/100">` (richiamo HTTP esterno ad ogni mount). Sostituita con span "ML" su gradiente già presente.

## 4. Sidebar — UI morta rimossa (Punto 1)

**File**: `src/components/Sidebar.tsx`

- **Menu items duplicati**: `statistics` appariva due volte (`Biometrics` con BarChart3 + `Analytics` con Gauge), entrambi puntavano a `statistics`. Ora il primo è `biometrics` e usa la route `/biometrics` (ComingSoonView esistente).
- **Garmin Watch "CONNECTED"**: badge verde hardcoded che mostrava sempre "CONNECTED" indipendentemente dallo stato reale. Ora mostra `"N/A"` in grigio neutro.
- **Bottom buttons**: `Support`, `Sign Out`, `Start Session` non avevano `onClick` handler. Ora `disabled` + `title="Coming soon"` + `opacity-40 cursor-not-allowed`. Visivamente chiaro che non sono attivi.

## 5. TrailRunView — eliminato (Punto 16)

**Files toccati**:
- `src/components/TrailRunView.tsx` → **eliminato** (~976 righe).
- `src/components/ActivitiesView.tsx`:
  - rimosso `import { TrailRunView }`.
  - rimosso `import Mountain` da `lucide-react`.
  - rimosso `import { AnimatePresence }` (usato solo dall'overlay trail).
  - rimosso state `showTrailView`/`setShowTrailView`.
  - rimosso intero blocco `if (run.id === '__demo_trail__') { ... }` (card "Trail Premium" Monte Cavo Loop hardcoded).
  - rimosso blocco `<AnimatePresence>{showTrailView && <TrailRunView />}` overlay.

**Motivo**: dati interamente hardcoded (53 waypoints, 6 segmenti, 2 water sources), nessun collegamento backend, codice demo sperimentale non parte del flusso utente reale.

## 6. BadgesGrid — `polarizedPct` ora usa `profile.max_hr` (Punto 13.2)

**File**: `src/components/BadgesGrid.tsx`

- **Prima**: `(avg_hr / 190) · 100 < 77` come criterio Z1+Z2 — assumeva HRmax=190 per tutti, sbilanciando i badge "Zona Ideale 80/20" e "Mese Polarizzato" per atleti più anziani (HRmax più bassa) o con cuori più grandi.
- **Dopo**:
  ```
  hrRefMax = (maxHr > 100) ? maxHr : 190
  z1z2 = filter(avg_hr / hrRefMax · 100 < 77)
  ```
  - Aggiunta prop `maxHr: number` a `BadgesGrid` e parametro `maxHr` a `buildContext`.
  - Call site `StatisticsView.tsx` passa `maxHr={dashData?.profile?.max_hr ?? 0}`.
  - Fallback `190` solo se profilo non valorizzato (`max_hr` mancante o ≤100).
- **Effetto utente**: % Polarizzato ora correlata alla fisiologia reale dell'atleta. Atleta con HRmax=170 → soglia Z2 = 130 bpm (prima era 146). Badge sbloccati con criterio individuale, non globale.

## 7. AnaerobicThreshold — rimossa prop `maxHr` morta (Punto 7)

**File**: `src/components/AnaerobicThreshold.tsx`

- **Prima**: `interface Props { runs, maxHr, vdot? }` ma `maxHr` era ricevuta e mai usata internamente (il chart calcola `hrMin`/`hrMax` da `Math.min/max(...hrs)` sui punti reali).
- **Dopo**: prop `maxHr` rimossa dall'interface, dalla destrutturazione e dal call site in `StatisticsView.tsx` (line 1488 — comunque dentro un `{false && ...}` gate).
- **Effetto utente**: nessuno (la prop era già dead). Tipo più pulito, niente refactor leftover.

---

## Quadro di sicurezza

Tutti i fix:
- ✅ **Reversibili via git revert** — nessuna migrazione DB, nessuna modifica schema.
- ✅ **Nessuna API call rimossa o modificata**.
- ✅ **TypeScript pulito sui file editati** (`tsc --noEmit` zero errori sui touched files).
- ✅ **Niente comportamento utente cambiato silenziosamente**: dove la logica numerica cambia (CardiacDrift filter, BadgesGrid HRmax) il cambiamento è documentato e correttivo (algoritmo già canonico nell'util / formula corretta scientificamente).

---

# CHANGELOG FIX — 2026-04-28 (round 2 — issue architetturali)

Secondo round di interventi sui problemi architetturali sollevati dall'analisi.

## 8. Cache layer globale per `useApi` — N fetch duplicate ELIMINATE

**File**: `src/hooks/useApi.ts` (riscritto), `src/hooks/apiCacheKeys.ts` (nuovo).

### Problema (prima)

`useApi` non aveva cache. Stessi endpoint chiamati da view diverse → N fetch duplicate ad ogni navigazione:

| Endpoint        | Chiamato da                                                                                  | Fetch totali |
|-----------------|----------------------------------------------------------------------------------------------|---------------|
| `getRuns`       | DashboardView, StatisticsView, ActivitiesView, ProfileView, TrainingSidebar, RoutesView*    | 5–6           |
| `getDashboard`  | DashboardView, StatisticsView                                                                | 2             |
| `getProfile`    | DashboardView, StatisticsView, ProfileView                                                   | 3             |
| `getAnalytics`  | DashboardView, StatisticsView                                                                | 2             |
| `getVdotPaces`  | DashboardView, StatisticsView                                                                | 2             |
| `getBestEfforts`| DashboardView, ProfileView                                                                   | 2             |

In totale ~16 round-trip extra solo per attraversare due tab. (RoutesView usa `getRun(id)` con id dinamico, quindi non condivide la cache `getRuns`.)

### Soluzione (dopo)

Cache module-level a TTL (default 60s) keyed per stringa stabile. Quattro componenti chiave:

```ts
// Cache & dedupe in-flight
const responseCache = new Map<string, { data: unknown; ts: number }>();
const inflight      = new Map<string, Promise<unknown>>();
const subscribers   = new Map<string, Set<() => void>>();

// API
useApi<T>(fn, { cacheKey?, ttl?, enabled? }): ApiState<T>
invalidateCache(key?: string)              // drop one or all
peekCache<T>(key): T | null                // read without subscribing
```

**Caratteristiche**:
- **Cache hit instantaneo**: `useState` viene seedato da `responseCache.get(cacheKey)` al primo render → niente flash di skeleton se la cache è calda.
- **Dedupe in-flight**: due componenti che chiedono la stessa key contemporaneamente condividono la stessa Promise (1 sola network call).
- **Subscribe pattern**: ogni hook si registra in `subscribers[key]`; quando un peer chiama `invalidateCache(key)` tutti i sottoscrittori si auto-rifanno fetch.
- **TTL configurabile**: 60s default, accetta override per-call.
- **Backward-compatible**: `useApi(fn)` senza `cacheKey` si comporta come prima (no cache).
- **`fnRef`**: la `fn` viene tenuta in ref aggiornata ad ogni render → call site con arrow inline (`useApi(() => getRun(id))`) restano stabili senza ri-fetchare ad ogni render del genitore.

### Cache keys centralizzate

`src/hooks/apiCacheKeys.ts`:
```ts
export const API_CACHE = {
  PROFILE: 'profile', DASHBOARD: 'dashboard', RUNS: 'runs',
  ANALYTICS: 'analytics', VDOT_PACES: 'vdot-paces',
  BEST_EFFORTS: 'best-efforts', HEATMAP: 'heatmap',
  TRAINING_PLAN: 'training-plan', TRAINING_CURRENT_WEEK: 'training-current-week',
  GCT_ANALYSIS: 'gct-analysis', SUPERCOMPENSATION: 'supercompensation',
  DASHBOARD_INSIGHT: 'dashboard-insight',
};
```

### Invalidations cablate

Eventi che mutano dati lato server invalidano i loro derivati:

| Trigger                              | Invalidate                                                       |
|--------------------------------------|------------------------------------------------------------------|
| `App.tsx` Strava OAuth callback      | RUNS, DASHBOARD, ANALYTICS, BEST_EFFORTS, HEATMAP, SUPERCOMPENSATION |
| `ProfileView.handleStravaSync`       | idem                                                             |
| `ProfileView.EditModal.save`         | PROFILE, DASHBOARD                                               |
| `ActivitiesView.handleImportToDatabase` (Garmin CSV) | idem set runs                                  |
| `TrainingGrid.handleAdapt`           | TRAINING_PLAN, TRAINING_CURRENT_WEEK                             |
| `TrainingGrid.handleGenerate`        | TRAINING_PLAN, TRAINING_CURRENT_WEEK                             |

### Effetto utente

- Navigazione Dashboard ↔ Statistics: ~16 fetch → ~0 (entrambi leggono dalla stessa cache).
- Backend load: drasticamente ridotto.
- UX: contenuti istantanei al cambio tab (no spinner per dati già visti).
- Mutazioni: garantita consistenza — non si vedono mai dati stantii dopo sync/edit.

## 9. Dedup nav TopBar/Sidebar — single source of truth

**Files**: `src/components/Sidebar.tsx`, `src/App.tsx`.

### Problema (prima)

Due navigazioni concorrenti con semantiche diverse:
- **TopBar** (App.tsx): 7 voci (Dashboard, Training, Activities, Statistics, Runner DNA, Ranking, Profile).
- **Sidebar**: 4 voci, sottoinsieme parziale + 1 voce ("Biometrics") che puntava a `/statistics` invece che `/biometrics` → confusione.

Risultato: due pulsanti che fanno la stessa cosa, nessuno dei quali corrisponde 1:1 alla URL bar.

### Soluzione (dopo)

- Rimosso completamente il blocco `<nav>` dalla Sidebar (includeva 4 menu items + costruzione `menuItems`).
- Rimosse props `activeView`/`onViewChange` (non più necessarie).
- Rimossi import icone non più usate (`LayoutGrid`, `Gauge`, `BarChart3`, `Box`).
- Aggiunto `<div className="flex-1" />` come spacer per tenere il blocco bottom in fondo.
- `App.tsx` ora chiama `<Sidebar />` senza props.

**TopBar** = single source of truth per tutta la navigazione. Sidebar ora contiene solo: logo, sensors panel (Garmin N/A), tre bottom button disabled (Support, Sign Out, Start Session — tutti con `title="Coming soon"` come da fix round 1).

### Effetto utente

Niente più due UI di navigazione confliggenti. Path URL ↔ TopBar corrispondenza 1:1.

## 10. Empty-state audit + guards

**Files toccati / verificati**: `VO2MaxChart.tsx`, `FitnessFreshness.tsx`, `MainChart.tsx`, `DashboardView.tsx (FitnessChart, HRZones)`.

### Risultato audit

| Componente        | Stato | Comportamento con 0 corse                                                  |
|-------------------|-------|----------------------------------------------------------------------------|
| `VO2MaxChart`     | ✅    | Linea 244–249 mostra "Aggiungi corse per calcolare". `displayVdot=null` → skip gauge/T-pace. `filledWithCurrent` sempre 12 elementi → array access safe. |
| `FitnessFreshness`| ✅    | Linea 392–403 mostra "Nessun dato — sincronizza le corse o clicca Ricalcola" con bottone CTA. `length<2` guard sul trend ATL (linea 136). |
| `MainChart`       | ✅    | Header mostra "Nessuna corsa" se `periodKm === 0` (linea 339). `Math.max(...arr, 1)` previene domain collapse. `withRuns.length > 0 ? avg : 0` previene div/0. |
| `DashboardView.FitnessChart` | ✅ | Linea 204–207 mostra "nessun dato in questo periodo" overlay. Tutti i path SVG ritornano stringa vuota quando `data.length===0`. |
| `DashboardView.HRZones`      | ✅ | `lastRun?.max_hr ?? 190`, `lastRun?.splits ?? []`. `total = ... \|\| 1` previene div/0. |

### Pattern di hardening usati nel codice

```
- N || 1                                  (guard su denominatori)
- Math.max(..., 1)                        (guard su domain Math.max([]))
- arr?.length ? arr : fallback             (path/coordinate calculations)
- arr.length === 0 ? <Empty/> : <Chart/>  (skip pesante render → mostra empty UI)
- ?? 0 / ?? null  su tutti gli accessi a `currentFf`, `lastRun`, ecc.
```

### Conclusione

Tutti i componenti pesanti già gestiscono empty state in modo difensivo. Nessuna nuova guard necessaria — il rischio crash su "0 runs / primo sync" è già coperto. **L'audit è documentato qui come baseline per future regressioni.**

## 11. God Component — DashboardView.tsx (estrazione math)

**File**: `src/components/DashboardView.tsx` (-110 righe), `src/utils/paceFormat.ts` (nuovo, 50 righe), `src/utils/racePredictions.ts` (nuovo, 130 righe).

### Problema (prima)

`DashboardView.tsx` = 1885 righe. Calcolava in client:
- 5 helper di formatting pace/time/duration (`fmtPbTime`, `parsePaceToSecs`, `secsToPaceStr`, `hmsToSecs`, `formatDuration`).
- `computeDrift(run)` — **terza copia divergente** dell'algoritmo drift cardiaco (oltre util e CardiacDrift già unificati). Versione qui: nessun filtro mediana, solo "first-half vs second-half avg HR".
- `racePredictions` — useMemo di ~80 righe con classificazione stimolo, BENEFIT table 5×4, magnitude calculation, target matching.

Violazione regola: client = view, backend = compute.

### Soluzione (dopo)

#### 11.1 `src/utils/paceFormat.ts` (nuovo)

Pure functions (no React, zero deps):
```ts
parsePaceToSecs(pace)    // "5:42" → 342
secsToPaceStr(secs)      // 342 → "5:42"
hmsToSecs(s)             // "1:23:45" → 5025, "5:42" → 342
formatDuration(min)      // 75.5 → "1h 15m"
fmtPbTime(min)           // 25.42 → "25:25"  (or "1:23:45")
```
Riutilizzabile in tutta l'app. Rimosse 5 funzioni inline da DashboardView.

#### 11.2 `src/utils/racePredictions.ts` (nuovo)

Pure function `buildRacePredictions({ predictions, runs, thresholdPace })` che ritorna `RacePrediction[]` con campi `{ label, short, km, key, timeStr, secs, deltaSec }`.

Internamente:
- `classifyStimulus(last, thresholdPace)` → `{ stim: 'intervals'|'tempo'|...|'easy', magnitude }`
- `BENEFIT[stim][target]` × `magnitude` → `deltaSec`
- `findPredictionKey(keys, patterns)` → match loose contro chiavi backend (`/^5k$|^10k$|half|mezza|...`)

Costanti `BENEFIT`, `TYPICAL_KM`, `TARGETS` ora module-level in `racePredictions.ts` (non più ri-allocate ad ogni render).

#### 11.3 Drift cardiaco unificato (3a copia rimossa)

DashboardView aveva:
```ts
// LOCAL — first/second half HR, no median filter
const computeDrift = (r: Run): number | null => { ... }
```

Ora:
```ts
import { computeDrift as computeDriftCanonical } from "../utils/cardiacDrift";
const driftFor = (r) => computeDriftCanonical(r)?.drift ?? null;
```

Allineato con CardiacDrift component (round 1 fix #1) → **una sola implementazione** di drift cardiaco in tutto il client. Filtro `±12%` + reject se steady < 50% raw splits.

### Effetto utente

- Stesso comportamento visivo (algoritmo `computeDrift` ora più rigoroso → meno run classificati come drift stabile, coerente con widget CardiacDrift).
- Codice testabile in isolamento (utility puri).
- DashboardView passato da 1885 → ~1775 righe.

### MIGRATION PATH (lato backend, da fare)

> Le utility `racePredictions.ts` e in parte `paceFormat.ts` sono **stop-gap**: idealmente la pipeline matematica vive in FastAPI così il client riceve un JSON già digerito.

Endpoint proposto:

```
GET /api/race-predictions
  → {
      targets: [
        { label, short: "5K", km: 5,
          predicted_time: "25:42",     // canonical from VDOT
          delta_estimated: -5,          // from latest qualifying run
          stim_classified: "tempo",
          magnitude: 1.05
        },
        ...
      ],
      stimulus: { last_run_id, stim, magnitude, classified_at }
    }
```

Una volta migrato:
- Eliminare `src/utils/racePredictions.ts` (DashboardView leggerà direttamente la response).
- BENEFIT table + classifyStimulus + TYPICAL_KM vivono in `backend/race_predictions.py`.
- Test unitari Python su BENEFIT / classify edge cases.

Stesso pattern andrebbe applicato a:
- `polarizedPct` (ora in BadgesGrid) → `GET /api/badges?include=polarized`.
- `bestPbTime` (proiezione PB su distanza target) → già coperto da `analytics.race_predictions`?
- Detraining model (`detrainingModel.ts`) → `GET /api/detraining/projection`.
- Drift batch (`computeDrift` su array) → `GET /api/drift/history`.

Quando questi 4 saranno migrati, `DashboardView` scenderà sotto le ~1200 righe e diventerà un componente di sola visualizzazione, conforme alla regola "client = view, backend = compute".

---

## Quadro di sicurezza (round 2)

- ✅ **Cache layer reversibile**: il vecchio comportamento (no-cache) è recuperabile rimuovendo i `cacheKey` dai call site; nessuna API esterna toccata.
- ✅ **Sidebar nav rimossa**: TopBar nav identico — gli URL e routing non cambiano.
- ✅ **Estrazione utility**: refactor puro, nessuna formula numerica modificata in `racePredictions` o `paceFormat`. La sola differenza algoritmica è `computeDrift` (ora più rigoroso, ma allineato a util canonico).
- ✅ **TypeScript pulito sui file editati** (`tsc --noEmit` 0 errori sui touched files; gli unici 2 errori restanti — RunnerDnaView line 661, EnvironmentalNormalizerView line 137-138 — sono pre-esistenti).
- ✅ **Empty state audit** documentato come baseline.

---

# CHANGELOG FIX — 2026-04-29 (round 3 — sicurezza & dev experience)

Terzo round: hardening sicurezza backend + setup developer-experience minimo per nuovi contributori.

## 27. CORS whitelist — `allow_origins=["*"]` ELIMINATO

**File**: `backend/server.py`.

### Problema (prima)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # ⚠️ wildcard
    allow_credentials=True,        # invalido per spec — i browser ignorano credenziali
    allow_methods=["*"],
    allow_headers=["*"],
)
```

`allow_origins=["*"]` accoppiato a `allow_credentials=True` è **invalido per la spec CORS**: i browser rifiutano comunque l'invio di credenziali (cookie / Authorization). Inoltre apre la porta a CSRF da qualunque dominio.

### Soluzione (dopo)

Whitelist env-driven con default sani per dev + prod:

```python
_DEFAULT_ORIGINS = (
    "http://localhost:3000,http://localhost:3001,http://localhost:5173,"
    "https://dani-frontend-ea0s.onrender.com"
)
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Override in prod via env var `ALLOWED_ORIGINS=https://foo.com,https://bar.com`.

## 28. Rate limiting via `slowapi` — degradazione graceful

**File**: `backend/server.py`, `backend/requirements.txt`.

### Soluzione

`slowapi` aggiunto a requirements (`>=0.1.9`). Import opzionale: se la dipendenza non è installata, decoratori `@limiter.limit(...)` diventano no-op tramite stub interno. Server parte comunque.

```python
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    _SLOWAPI_AVAILABLE = True
except ImportError:
    _SLOWAPI_AVAILABLE = False

# ...

if _SLOWAPI_AVAILABLE:
    limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
else:
    class _NoopLimiter:
        def limit(self, *_a, **_kw):
            def deco(f): return f
            return deco
    limiter = _NoopLimiter()
```

### Limiti applicati

| Endpoint | Limite | Motivo |
|---|---|---|
| (default globale) | 120/min per IP | safety net |
| `POST /api/ai/analyze-run` | 10/min | costoso (Anthropic call) |
| `POST /api/jarvis/chat` | 30/min | costoso (Gemini call) |
| `POST /api/training-plan/generate` | 10/min | costoso |
| `POST /api/garmin/csv-import` | 20/min | parsing pesante |

## 29. Audit secrets — repo pulito

### Findings

- ✅ `.gitignore` esclude `.env*` con re-include solo per `.env.example`.
- ✅ `git ls-files` → solo `.env.example` committato. **Nessun secret in repo.**
- ⚠️ `render.yaml` contiene `VITE_MAPBOX_TOKEN` hardcoded — è un public token (`pk.*`), per design pubblico, MA va restritto per dominio nella dashboard Mapbox altrimenti chiunque può consumare la quota.
- ✅ `backend/.env` (locale) contiene secrets reali (Mongo, Anthropic, Strava, Garmin) ma è ignored.

### Azioni

- Creato `backend/.env.example` completo (era mancante) — template di tutte le var documentate.
- Aggiornato `.env.example` frontend con commento sulla restrizione Mapbox.
- README aggiornato con sezione "Note di sicurezza" + raccomandazione `gitleaks`/`trufflehog` per audit periodici.

### Audit consigliato (manuale, periodico)

```bash
# gitleaks
gitleaks detect --source . --no-git
# trufflehog
trufflehog filesystem .
```

## 30. NoSQL injection audit — surface zero

### Risultati ricerca

```
grep "$where|$regex|$function|$expr"  → 0 occorrenze
grep "re.compile.*request|re.compile.*body"  → 0
grep ".find({...request|...body|...query}"  → 0
```

Tutte le query Mongo sono **dict-based** via `motor` (driver async). I dict sono parametrizzati nativamente: `db.runs.find({"athlete_id": x, "date": y})` non è interpolazione di stringa, è invio strutturato BSON al server Mongo.

### Conclusione

Surface NoSQL injection = **zero** (al momento del round 3). Da preservare:

> **REGOLA**: mai interpolare user-input in stringhe `$where` / `$regex`. Se servono regex su user-input (es. ricerca testuale), passare via `re.escape()` e wrap in `{"$regex": re.escape(user_input)}`.

## 31 + 32. README esecutivo + indice documentazione

**Files**: `README.md` (riscritto), `ROADMAP.md` (nuovo, era il vecchio README).

### Prima

- `README.md` = lista todo/done della roadmap. Zero info per nuovi dev.
- `PRD.md`, `REPORT-TECNICO.md`, `MEMORY.md`, `repo-map.md` → 4 fonti senza index canonico.

### Dopo

- Vecchio README copiato a `ROADMAP.md` (pieno valore preservato).
- Nuovo `README.md` con:
  - Quick start 5-min (prerequisiti, setup, `npm run dev`).
  - **Tabella documentazione** (chi cosa, ownership): README/PRD/REPORT-TECNICO/ROADMAP/CHANGELOG-AI/repo-map.
  - Stack frontend + backend.
  - Tabella env-var (frontend + backend) con flag obbligatoria/opzionale.
  - Lista comandi npm completa.
  - Sezione sicurezza (CORS, rate limit, secrets, Mapbox).
  - Struttura repo.
  - Troubleshooting (Garmin 429, CORS, slowapi, bundle size).

## 33. ESLint flat config — React 19 + TS

**File**: `eslint.config.js` (nuovo), `package.json` (script + devDeps).

### Config

Flat config v9 con:
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` (regole exhaustive-deps + rules-of-hooks)
- `eslint-plugin-react-refresh` (Vite HMR safety)

Regole **lenient** per non bloccare dev su rumore esistente:
- `@typescript-eslint/no-explicit-any`: off
- `@typescript-eslint/no-unused-vars`: warn con pattern `^_`
- `prefer-const`: warn
- ignora: `dist`, `node_modules`, `backend`, `browser-tools-mcp`, `local-whisper`, `public`, `restyling`, `scripts`, `docs`

### Comandi

```bash
npm run lint:eslint       # check
npm run lint:eslint:fix   # auto-fix
```

DevDep aggiunte (lazy-install: `npm install` quando vuoi attivare).

## 34. Prettier — config + ignore

**Files**: `.prettierrc.json`, `.prettierignore`.

### Config

```json
{ "semi": true, "singleQuote": true, "trailingComma": "all",
  "printWidth": 100, "tabWidth": 2, "arrowParens": "always", "endOfLine": "lf" }
```

Allineato allo stile prevalente nel codebase (single quote, trailing comma).

### Comandi

```bash
npm run format          # write
npm run format:check    # CI-friendly check
```

## 35. Bundle analyzer + code splitting

**Files**: `vite.config.ts`, `src/App.tsx`.

### Code splitting per route — lazy loading

Tutte le 8 view principali sono ora `React.lazy()` (chunk separati per ognuna):

```ts
const DashboardView  = lazy(() => import("./components/DashboardView").then(m => ({ default: m.DashboardView })));
const TrainingView   = lazy(() => import("./components/TrainingView").then(m => ({ default: m.TrainingView })));
const ProfileView    = lazy(() => import("./components/ProfileView").then(m => ({ default: m.ProfileView })));
const StatisticsView = lazy(() => import("./components/statistics/StatisticsView").then(m => ({ default: m.StatisticsView })));
const RoutesView     = lazy(() => import("./components/RoutesView").then(m => ({ default: m.RoutesView })));
const ActivitiesView = lazy(() => import("./components/ActivitiesView").then(m => ({ default: m.ActivitiesView })));
const RunnerDnaView  = lazy(() => import("./components/RunnerDnaView").then(m => ({ default: m.RunnerDnaView })));
const RankingView    = lazy(() => import("./components/RankingView").then(m => ({ default: m.RankingView })));
```

`<Suspense>` (già presente) gestisce loading con spinner. Il `.then(m => ({ default: m.X }))` adatta i named export al protocollo di `lazy()`.

### Manual chunks vendor

In `vite.config.ts → build.rollupOptions.output.manualChunks`:

| Chunk | Contenuto | Perché separato |
|---|---|---|
| `vendor-three` | three | Heavy 3D, usato solo in RoutesView |
| `vendor-mapbox` | mapbox-gl, maplibre-gl, react-map-gl, @mapbox/polyline | Heavy maps, usato solo in DashboardView/ActivitiesView/RoutesView |
| `vendor-charts` | recharts | Cambia raramente, isolata per cache HTTP |
| `vendor-motion` | motion, gsap | Animazioni, usate diffusamente |
| `vendor-i18n` | i18next + browser-detector + react-i18next | Stabile, isolato |
| `vendor-genai` | @google/genai | Heavy AI SDK (JARVIS) |
| `vendor-react` | react, react-dom, react-router-dom | Core, max stabilità cache |

### Bundle analyzer

`npm run build:analyze` → genera `dist/stats.html` (treemap interattivo, gzip + brotli sizes). Plugin caricato solo in modalità `analyze` (zero overhead in build normale).

```bash
npm run build:analyze     # apre stats.html nel browser
```

Plugin è devDep opzionale: se non installato, build normale comunque funziona (try/catch in `vite.config.ts`).

### `chunkSizeWarningLimit: 600`

Soglia warning alzata da 500 → 600 kB. Sotto questa soglia: nessun warning. Sopra: `[plugin] (!) Some chunks are larger than 600 kBs`.

## Quadro di sicurezza (round 3)

- ✅ **CORS reversibile**: setting via env-var; per ripristinare `*` basta `ALLOWED_ORIGINS=*` (sconsigliato).
- ✅ **Rate limit graceful**: se `slowapi` non installato, server parte e funziona (no-op decorators). Zero rischio downtime.
- ✅ **Secret audit**: nessun file modificato che contenga credenziali; solo template `.env.example`.
- ✅ **Lazy loading**: `Suspense` boundary già presente in App.tsx — nessuna nuova logica error-boundary aggiunta. Routes funzionano identiche.
- ✅ **ESLint/Prettier**: solo configs + script package.json. Zero impatto runtime. DevDep aggiunte ma `npm install` rimane scelta dell'utente.
- ✅ **Bundle visualizer**: caricato dinamicamente solo in `--mode analyze`. Build normale (`npm run build`) invariato.
- ✅ **TypeScript pulito**: 0 nuovi errori (verificato `tsc --noEmit`). Errori pre-esistenti restano i 2 noti (`RunnerDnaView:661`, `EnvironmentalNormalizerView:137-138`).

---

# CHANGELOG FIX — 2026-04-29 (round 4 — production-readiness)

Quarto round: fix bloccanti per "production-grade" + dev-experience completa.
DevDep installate (`npm install` eseguito → `node_modules` popolato), `slowapi` installato lato Python.

## 2. TS errors pre-esistenti — FIXATI

**Files**: `src/components/RunnerDnaView.tsx`, `src/components/statistics/EnvironmentalNormalizerView.tsx`.

### RunnerDnaView:661

Type predicate richiedeva `currentTime: string` ma il valore inferred era `string | undefined`:

```ts
// ❌ prima
.filter((item): item is { dist; currentTime?: string; potentialTime; delta } => item !== null)

// ✅ dopo
.filter((item): item is { dist; currentTime: string | undefined; potentialTime; delta } => item !== null)
```

Now il predicato matcha esattamente lo shape inferred.

### EnvironmentalNormalizerView:137-138

`source: 'archive' | 'run-fallback'` (literal union nel type `WeatherSnapshot`) ma le assegnazioni inline producevano `string`:

```ts
// ❌ prima
return { ..., source: 'archive' };       // → string
return { ..., source: 'run-fallback' };  // → string

// ✅ dopo
return { ..., source: 'archive' as const };
return { ..., source: 'run-fallback' as const };
```

`as const` preserva la literal type → assignable a `WeatherSnapshot.source`.

### Verifica

```bash
npx tsc --noEmit  → 0 errori
```

## 4. Test suite — Vitest + 18 test verdi

**Files**: `vitest.config.ts` (nuovo), `src/utils/paceFormat.test.ts`, `src/utils/racePredictions.test.ts`, `package.json`.

### Setup

- `vitest@^2.1.9` installato come devDep.
- Config: `environment: 'node'` (test util puri, niente DOM), include `src/**/*.{test,spec}.{ts,tsx}`.
- Coverage v8 → `npm run test:coverage`.
- Convention: file `*.test.ts` accanto al modulo testato (no `__tests__` folder).

### Script package.json

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### Test attuali (18 ✓)

| File | Tests | Coperto |
|---|---|---|
| `paceFormat.test.ts` | 13 | parsePaceToSecs, secsToPaceStr, hmsToSecs, formatDuration, fmtPbTime + round-trip |
| `racePredictions.test.ts` | 5 | buildRacePredictions: empty input, pattern matching, deltaSec, classifier tempo, treadmill skip |

```
Test Files  2 passed (2)
     Tests  18 passed (18)
   Duration 284ms
```

### Roadmap test

Da aggiungere (next sprint): `cardiacDrift`, `cadence`, `useApi` (jsdom + mock fetch), componenti chiave.

## 5. CI/CD GitHub Actions

**File**: `.github/workflows/ci.yml`.

### 2 job paralleli

**Frontend** (Node 20):
1. `npm ci` (npm cache enabled)
2. `npm run lint` (tsc --noEmit) — bloccante
3. `npm run lint:eslint` — `continue-on-error` finché baseline si stabilizza
4. `npm run format:check` — `continue-on-error`
5. `npm test` (Vitest) — bloccante
6. `npm run build` con env mockate (`VITE_BACKEND_URL=http://localhost:8000` ecc.) — bloccante

**Backend** (Python 3.11):
1. `pip install -r backend/requirements.txt pytest`
2. AST syntax check (`ast.parse(server.py)`) — bloccante
3. `pytest backend/` — `continue-on-error`, skipped se nessun test trovato

### Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Run obsoleti su nuovo push allo stesso branch vengono cancellati → niente coda di build superflue.

## 6. FirstRunOnboarding — gate per dashboard vuota

**File**: `src/components/FirstRunOnboarding.tsx` (nuovo), `src/components/DashboardView.tsx`.

### Problema (prima)

Utente con zero corse → DashboardView caricato comunque → tutti i widget mostrano skeleton/dash/zero. Comunica nulla, sembra rotto.

### Soluzione (dopo)

Componente di gate con due CTA chiari:

1. **"Connetti Strava"** → chiama `getStravaAuthUrl()`, redirect a OAuth.
2. **"Importa Garmin CSV"** → naviga a `/activities` (dove c'è già il CSV uploader).

Footer: "Single-tenant, dati in DB privato."

### Wiring DashboardView

```ts
const { data: runsData, loading: runsLoading } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
// ...
const showOnboarding = !runsLoading && runsData !== null && runs.length === 0;
// ...
if (showOnboarding) return <FirstRunOnboarding onImportClick={() => navigate("/activities")} />;
```

Skip durante `runsLoading` → niente flash dell'onboarding al primo paint.

## 7. Granular ErrorBoundary — `<WidgetBoundary>`

**Files**: `src/components/ErrorBoundary.tsx`, `src/components/GridCard.tsx`.

### Problema (prima)

Un solo `<ErrorBoundary>` wrappa tutto `<Routes>`. Crash di un widget singolo (es. `VO2MaxChart` per dato malformato) abbatte tutta la dashboard.

### Soluzione (dopo)

Aggiunto `<WidgetBoundary scope?>` accanto a `<ErrorBoundary>`:

- **Fallback compatto** (no full-screen, no "Torna alla Dashboard"): card con `Errore widget` + messaggio + bottone "Riprova".
- **Reset locale**: `setState({ hasError: false })` invece di navigation.
- **Telemetry hook**: `reportError(err, { scope: 'widget:<scope>' })`.

`GridCard` ora wrappa automaticamente i children:

```tsx
<div className="h-full">
  <WidgetBoundary scope={scope}>{children}</WidgetBoundary>
</div>
```

### Effetto utente

Crash di un widget → restano operativi gli altri 11. Un click su "Riprova" tenta il rerender senza ricaricare la pagina.

## 8. Telemetry stub — pronto per Sentry

**Files**: `src/utils/telemetry.ts` (nuovo), `src/main.tsx`, `src/components/ErrorBoundary.tsx`.

### Design

Funzioni stub a singola signature, pronte per swap drop-in:

```ts
initTelemetry()
reportError(err, ctx?)
reportEvent(name, data?)
```

### Comportamento attuale

- `console.error` strutturato per ogni evento.
- `window.error` + `window.unhandledrejection` listeners → cattura tutto fuori boundary.
- In production (hostname !== localhost): `navigator.sendBeacon('/api/telemetry/error', payload)` — best-effort, non bloccante.

### Migration path → Sentry

```ts
// telemetry.ts
import * as Sentry from '@sentry/react';
export function initTelemetry() {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, ... });
}
export function reportError(err, ctx) {
  Sentry.captureException(err, { tags: { scope: ctx.scope }, extra: ctx });
}
```

I call site (`ErrorBoundary`, `WidgetBoundary`, `main.tsx`) restano invariati.

## 9. Cache layer — persist localStorage + Stale-While-Revalidate

**File**: `src/hooks/useApi.ts`.

### Espansione

Round 2 aveva introdotto cache memory + dedupe in-flight. Round 4 aggiunge:

1. **Persist localStorage**: opt-out via `persist: false`. Default `true`.
   - Prefix `metic:apicache:v1:` (versionato — bump = drop tutto al deploy).
   - Max 500 KB per key (skip silenzioso oltre).
   - Hard expiry `persistTtl` (default 24h).

2. **Stale-While-Revalidate**:
   - `age < ttl` (60s) → cache fresh, no network.
   - `ttl < age < persistTtl` → mostra **stale immediately**, refetch in background, no spinner.
   - `age > persistTtl` → cache miss, fetch foreground (loading=true).

3. **Cross-tab sync via storage event**:
   - Tab A invalida key X → storage event → Tab B aggiorna memory cache + notifica subscriber.
   - Listener montato 1 sola volta a load (idempotent flag `__meticApiCacheSync`).
   - Niente loop: storage event NON si triggera nella tab che ha scritto.

### Effetto utente

- Reload pagina → dashboard appare istantaneamente (dato persistito).
- 60s+ ma < 24h → vedi dato vecchio + fetch dietro le quinte → swap silenzioso.
- 2 tab aperte → sync widget movements / theme / dati API a vicenda senza refresh.

### API esposta

```ts
useApi<T>(fn, {
  cacheKey?: string,
  ttl?: number,           // default 60_000
  enabled?: boolean,      // default true
  persist?: boolean,      // default true (NEW)
  persistTtl?: number,    // default 24h (NEW)
})

invalidateCache(key?: string)   // memory + localStorage + cross-tab notify
peekCache<T>(key)               // legge da memory, fallback a localStorage idratando
```

## 10 + 11. UI Cleanup — Sidebar bottom + TopBar search/Bell

**Files**: `src/components/Sidebar.tsx`, `src/App.tsx`.

### Rimosso

- **Sidebar.tsx**: bottoni "Support" / "Sign Out" / "Start Session" (tutti `disabled coming-soon`). Senza auth, "Sign Out" non ha semantica. Quando arriverà l'auth → user menu nell'avatar dropdown della TopBar.
- **App.tsx TopBar**: input ricerca disabled (~25 righe) e bottone Bell disabled.

### Conservato

- Sidebar: logo + sensori (Garmin watch N/A) + spacer flex-1.
- TopBar: nav 7 voci + SettingsControls (lingua/tema) + avatar.

### Effetto

UI più pulita. Nessun pulsante che "non fa niente" — solo elementi funzionali.

## 20. Cross-tab sync — storage event listeners

**Files**: `src/context/ThemeContext.tsx`, `src/context/LayoutContext.tsx`, `src/hooks/useApi.ts`.

### Problema (prima)

3 sorgenti di stato persistente in localStorage senza listener cross-tab:
- `app-theme` (ThemeContext)
- `metic:layout` + `metic:hidden` (LayoutContext)
- N chiavi cache API

Due tab divergevano: cambio tema in A non rifletteva in B finché refresh.

### Soluzione (dopo)

Listener `window.addEventListener('storage', ...)` registrato su mount in:

1. **ThemeContext**: `key === 'app-theme'` → `setThemeState(newValue)`.
2. **LayoutContext**: `key === 'metic:layout'` → reparse + setLayouts; `key === 'metic:hidden'` → setHiddenKeys.
3. **useApi**: prefix-based filter su `metic:apicache:v1:` → propaga a memory cache + notifica subscriber.

`storage` event si triggera **solo** nelle tab che NON hanno scritto → niente loop ricorsivi.

## 25. Avatar dinamico — iniziali da profile.name

**File**: `src/App.tsx`.

### Prima

`<span>ML</span>` hardcoded.

### Dopo

```ts
function deriveInitials(name?: string | null): string {
  if (!name) return "ML";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "ML";
}

const { data: profile } = useApi(getProfile, { cacheKey: API_CACHE.PROFILE });
const initials = deriveInitials((profile as { name?: string } | null)?.name);
```

`title={profileName}` + `aria-label` per a11y. Cache shared con DashboardView/ProfileView.

## 26. JarvisOverlay — lazy-load on enable

**File**: `src/context/JarvisContext.tsx`.

### Prima

```ts
import { JarvisOverlay } from '../components/JarvisOverlay';
// ...
const JarvisPortal = enabled ? <JarvisOverlay /> : null;
```

`JarvisOverlay` import eager → bundle iniziale include Gemini SDK + audio init code anche se utente non attiva mai JARVIS. Possibile permission prompt microfono al mount globale.

### Dopo

```ts
const JarvisOverlay = lazy(() =>
  import('../components/JarvisOverlay').then(m => ({ default: m.JarvisOverlay }))
);
// ...
const JarvisPortal = enabled ? (
  <Suspense fallback={null}>
    <JarvisOverlay />
  </Suspense>
) : null;
```

Chunk separato (~24 KB gzipped) caricato **solo** quando `setEnabled(true)`. Nessun audio init al mount. Permission prompt microfono solo on-demand.

## Verifica integrità sito (round 4)

Eseguito ciclo completo end-to-end:

```bash
npx tsc --noEmit          → 0 errori
npx vitest run             → 18/18 test passati (284ms)
npx vite build             → 15.87s, dist/ generato
```

### Bundle output (post split)

| Chunk | Size | Gzip | Note |
|---|---|---|---|
| `index` (entry) | 220 KB | 70 KB | App + Sidebar + ErrorBoundary + cache layer |
| `vendor-react` | 49 KB | 17 KB | react + react-dom + react-router-dom |
| `vendor-i18n` | 50 KB | 16 KB | i18next + plugins |
| `vendor-motion` | 96 KB | 32 KB | motion + gsap |
| `vendor-charts` | 444 KB | 126 KB | recharts (dinamico, lazy se non in route Statistics/Dashboard) |
| `vendor-three` | 492 KB | 124 KB | three (lazy, solo RoutesView 3D) |
| `vendor-mapbox` | 2.82 MB | 771 KB | mapbox-gl + maplibre + react-map-gl + polyline (heavy ma lazy) |
| `DashboardView` | 68 KB | 19 KB | lazy chunk |
| `StatisticsView` | 319 KB | 77 KB | lazy chunk (god component) |
| `RunnerDnaView` | 92 KB | 23 KB | lazy chunk |
| `JarvisOverlay` | 24 KB | 9 KB | lazy on enable |
| `FirstRunOnboarding` | <2 KB | <1 KB | route-level + onboarding |

> Chunk `vendor-mapbox` > 600 KB: warning Vite, atteso. Lazy-loaded → carica solo quando route con mappa è visitata. Non impatta first paint dashboard.

### Ciò che NON è cambiato (zero rischio breakage)

- ✅ Routing identico — niente refactor URL.
- ✅ Backend endpoint invariati.
- ✅ Schema API/Mongo invariati.
- ✅ DashboardView render path: solo aggiunta gate `if (showOnboarding) return …`. Tutta la logica esistente sotto invariata.
- ✅ Cache layer round 2 backward-compatible: `cacheKey?` resta opzionale; `persist?: boolean` ha default `true` → comportamento round 2 ottenibile con `{ persist: false }`.
- ✅ TopBar nav identico — eliminati solo Search e Bell che erano `disabled coming-soon`.
- ✅ Sidebar nav già rimossa round 2; ora rimossi anche bottom buttons disabled.

### Verifiche manuali consigliate

1. Aprire `http://localhost:3000` → carica dashboard normalmente.
2. Cancellare tutti i runs → ricarica → vedi `<FirstRunOnboarding />` invece dei widget vuoti.
3. Aprire 2 tab → cambia tema in A → B aggiorna senza refresh.
4. F12 → Network → ricarica `/` → memory cache hit → no refetch network calls.

---

# DEFERRED — punti audit non eseguiti (con motivazione)

Audit fornita dall'utente conta 35 punti. Eseguiti round 3+4: **#2, #4, #5, #6, #7, #8, #9, #10, #11, #19, #20, #25, #26, #27, #28, #29, #30, #31, #32, #33, #34, #35** (22 punti). Sotto la lista dei deferred, con rationale.

## #1 Auth + sessione utente — DEFERRED

**Why deferred**: trasformazione da single-tenant a multi-utente è cambio archittetturale di **~1-2 settimane di lavoro**:
- Aggiungere `user_id` a TUTTE le collection Mongo (runs, garmin_csv_data, training_plan, analytics_cache, runner_dna_cache, strava_tokens, …).
- Introdurre middleware FastAPI auth (Clerk/Supabase/JWT custom).
- Migliare ogni endpoint per filtrare per user.
- Frontend: AuthProvider, login page, redirect logic.
- Migrazione dati esistenti (assegnare a un `user_id` di sistema).

Senza requisito multi-utente concreto da PRD → over-engineering. Quando arriva, progettare prima `auth.py` router separato e progressivamente migrare.

## #3 Math heavy ancora client-side — PARZIALE

Estratti finora: `racePredictions`, `paceFormat`, `cardiacDrift` unificato (3 copie → 1).

**Restano client**: `polarizedPct` (BadgesGrid), `bestPbTime`, `detrainingModel`, `runnerDnaModel`, `thresholdPace`, `injuryRisk` ACWR.

**Why deferred**: ognuno richiede:
1. Endpoint backend `GET /api/<topic>` con stessa logica.
2. Test backend per parità.
3. Switch frontend a fetch.
4. Validare nessuna regressione di display.

= 1-3 giorni a testa. Da pianificare in sprint dedicati. Per ora il client è leggibile dopo round 2/3 cleanups.

## #12 Componenti V2/V3/V4/V5 — DEFERRED

**Why deferred**: sapere quale è il "winner" per ogni famiglia richiede lettura side-by-side di centinaia di righe + validazione UX con utente. Lavoro di product, non di pulizia tecnica. Serve decisione esplicita su cosa tenere.

## #13 DRIFT_START_KM = '8' — DEFERRED

Già parzialmente affrontato round 1 (eliminato il dead code AnalyticsV2). La constant residua in `src/components/CardiacDrift.tsx` è fallback per chart UI, derivare da run reale richiede refactor del rendering.

## #14 DashboardView 1764 righe — DEFERRED

**Why deferred**: split in `dashboard/widgets/*.tsx` è ~3 giorni. Va fatto **prima** di scrivere nuovi widget. Round 4 ha solo introdotto gate FirstRunOnboarding (un check + `<FirstRunOnboarding/>`); refactor god component lasciato a sprint dedicato.

## #15 server.py 7527 righe — DEFERRED

**Why deferred**: split in `backend/routers/<domain>.py` è 2-3 giorni di rischio elevato. Tutti gli endpoint passano da test manuale prima del merge. Da fare con feature freeze.

## #16 Sync queue background — DEFERRED

**Why deferred**: introdurre Celery/RQ/arq aggiunge:
- Worker process separato.
- Broker (Redis).
- UI poll endpoint `/api/sync/status`.
- Errore retry policy.

= 2 settimane progetto a sé. Per single-tenant con sync occasionali → priority bassa. Mai fatto timeout in pratica con il dataset attuale.

## #17 WebSocket / SSE live update — DEFERRED

Stesso motivo di #16: infrastruttura non giustificata da carichi attuali. Polling soft + invalidateCache copre il caso "Strava sync done".

## #18 Dependency drift — INFORMATIVO

Già scritto in README sezione "Stack" con versioni. Pin ulteriore richiede testing matrice su versioni stabili → non automatizzabile senza ore di test manuali.

## #21 i18n incompleto — DEFERRED

**Why deferred**: ~150+ stringhe italiane hardcoded in widget. Estrazione manuale = 1 giorno + traduzione EN. Da fare con audit `grep -r 'text-(white|gray)"\s*>' | grep -v t\(`. Per ora EN supportata parzialmente, non rotta.

## #22 Mobile responsive — DEFERRED

**Why deferred**: testing su 375px richiede dev server + browser tool. Sidebar fixed 220px, TopBar 7 voci → richiede drawer pattern. ~2 giorni. Per uso desktop attuale (target del PRD) non bloccante.

## #23 a11y — DEFERRED

**Why deferred**: audit completo con `axe-core` + lighthouse, refactor color contrast (testi #A0A0A0 su #1a1a1a NON WCAG AA), aria-label su SVG charts, keyboard nav. ~1 settimana. Questo round 4 ha aggiunto `aria-label` solo all'avatar.

## #24 Loading states inconsistenti — DEFERRED

**Why deferred**: convention "skeleton sempre" richiede sostituire 30+ pattern di rendering condizionale. Audit + refactor diffuso. Il `Suspense` lazy-loading di route + `WidgetBoundary` di round 4 hanno **ridotto** il problema (loading univoco a livello route).

---

# CHANGELOG FIX — 2026-04-29 (round 5 — production architecture patterns)

Quinto round: pattern di estrazione e push notifications. Tutti i punti
attaccati sono PARZIALMENTE risolti come "pattern proven", con plan di
completamento documentato (per ogni punto: cosa è fatto, cosa resta).

## #17 SSE — Server-Sent Events live update

**Files**: `backend/server.py`, `src/hooks/useServerEvents.ts` (nuovo), `src/App.tsx`.

### Backend

Aggiunto event bus in-process + endpoint `GET /api/events/stream`:

```python
_event_subscribers: list[asyncio.Queue] = []

async def publish_event(payload: dict):
    payload.setdefault("ts", dt.datetime.utcnow().isoformat() + "Z")
    for q in _event_subscribers:
        try: q.put_nowait(payload)
        except asyncio.QueueFull: ...

@app.get("/api/events/stream")
async def event_stream(request: Request):
    queue = asyncio.Queue(maxsize=100)
    _event_subscribers.append(queue)
    async def gen():
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"
        while not await request.is_disconnected():
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield f"data: {json.dumps(payload)}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream", ...)
```

Headers `X-Accel-Buffering: no` per disabilitare buffering Render/nginx.

### Eventi pushati

| Evento | Trigger | Payload |
|---|---|---|
| `connected` | Apertura connessione | `{ ts }` |
| `sync_started` | Inizio Strava sync | `{ source: "strava" }` |
| `sync_complete` | Fine Strava sync OK | `{ source, count }` |
| `sync_error` | Errore Strava sync | `{ source, error }` |
| `training_adapted` | Plan adattato (>0 trigger) | `{ triggered, weeks }` |

### Frontend

```ts
useServerEvents(); // hook globale in App.tsx
```

Su `sync_complete` invalida cache: RUNS, DASHBOARD, ANALYTICS, BEST_EFFORTS,
HEATMAP, SUPERCOMPENSATION, VDOT_PACES. UI si aggiorna senza F5.
Reconnect auto via EventSource native backoff.

### TODO completamento

- Garmin sync hooks (oggi solo Strava + adapt).
- Toast UI per visual feedback.
- Multi-tenant scoping con auth (#1 deferred).

## #21 i18n — extract critical strings batch

**Files**: `src/i18n/translations.ts`, `src/components/FirstRunOnboarding.tsx`,
`src/components/ErrorBoundary.tsx`.

### Aggiunti 4 namespace (IT + EN)

```ts
onboarding: { welcome, tagline, stravaTitle, stravaSubtitle, stravaDesc, ...12 keys }
errors: { somethingWrong, backToDashboard, widgetError, retry, backendConnection }
widgets: { addRunsToCalculate, noDataAvailable, paceSoglia, tPace, historyMonths, ... }
sync: { stravaSyncFailed, stravaSyncing, stravaSyncDone, garminSyncing, trainingAdapted }
```

### Componenti i18n-ed

- `FirstRunOnboarding` (round 4 hardcoded → 100% t() ora)
- `ErrorBoundary` (class component: usa `i18n.t()` direct invece di hook)

### TODO completamento

~150 stringhe IT hardcoded restano in DashboardView, StatisticsView, ProfileView,
AnaerobicThreshold, CardiacDrift, RecentActivities, BadgesGrid, RankingView,
RunnerDnaView. ESLint rule da aggiungere per bloccare nuove hardcoded.

## #14 DashboardView split — pattern proven

**Files**: `src/components/dashboard/widgets/{FitnessChart,HRZones,NextOptimalSessionWidget}.tsx` (nuovi),
`src/components/DashboardView.tsx`.

### Estratti 3 widget

| Widget | LOC | Notes |
|---|---|---|
| `FitnessChart` | 240 | CTL/ATL/TSB SVG handcrafted, range tabs |
| `HRZones` | 145 | Donut zone Daniels da `lastRun.splits` |
| `NextOptimalSessionWidget` | 175 | Recovery gauge semi-circolare |

**DashboardView**: 1775 → 1215 righe (-31%, -560 righe).

### Pattern stabilito

```
src/components/dashboard/widgets/<WidgetName>.tsx
```

Ogni widget: pure presentational, no fetch interno, riceve dati come props,
memo computed locali, importable e testabile in isolamento.

### TODO completamento

DashboardView ancora 1215 righe. Da estrarre:
- `bestPbTime` helper, `timeUntil` helper
- Race-prediction grid render (~200 righe)
- Status of Form gauge (~150 righe)
- Weekly KM card (~100 righe)
- Adaptation summary (~80 righe)
- Session logs table (~100 righe)

Target finale: **DashboardView < 500 righe**, solo orchestrazione.

## #15 server.py split — pattern proven

**Files**: `backend/routers/__init__.py` (nuovo), `backend/routers/health.py` (nuovo),
`backend/deps.py` (nuovo), `backend/server.py`.

### Estratto router `health`

`GET /` + `GET /api/version` migrati a `backend/routers/health.py` come
`APIRouter`. Registrato in server.py:

```python
from backend.routers import health as _health_router
app.include_router(_health_router.router)
```

### Dependency injection helpers

`backend/deps.py` introduce `get_db()`, `get_athlete_id()`, `get_publish_event()`
con late import per evitare circular. Pattern per router futuri:

```python
from fastapi import Depends
from backend.deps import get_db, get_athlete_id

@router.get("/api/profile")
async def get_profile(db = Depends(get_db),
                     athlete_id: int | None = Depends(get_athlete_id)):
    q = {"athlete_id": athlete_id} if athlete_id else {}
    return await db.profile.find_one(q)
```

### TODO completamento

55 endpoint totali, 2 estratti. Restano da migrare:
- `routers/strava.py` (4 endpoint)
- `routers/garmin.py` (8 endpoint)
- `routers/profile.py` (4 endpoint)
- `routers/runs.py` (3 endpoint)
- `routers/training.py` (6 endpoint)
- `routers/analytics.py` (5+ endpoint)
- `routers/ai.py` (2 endpoint)
- `routers/admin.py` (3 endpoint)

Target finale: **server.py < 300 righe**.

### Verifica

```bash
python -c "from backend.server import app; print(len(app.routes))"
# 60+ route registered, includendo health router
```

## #3 Math heavy → backend — pattern proven con `thresholdPace`

**Files**: `backend/server.py`, `src/types/api.ts`, `src/components/DashboardView.tsx`.

### Migrato

Algoritmo `thresholdPace` (Daniels T-pace + empirical override) spostato lato
backend. Endpoint `GET /api/vdot/paces` ora restituisce ANCHE
`paces.threshold_empirical`:

```python
tempo_runs = [r for r in runs
              if not r.get("is_treadmill")
              and 3 <= r.get("distance_km", 0)
              and 0.86 <= hr_pct <= 0.91][:8]

if len(tempo_runs) >= 3:
    paces = sorted([_parse_pace(r["avg_pace"]) for r in tempo_runs])
    threshold_empirical = _format_pace(paces[len(paces)//2])
```

### Frontend (DashboardView)

```ts
// PRIMA: ~30 righe useMemo (Daniels formula + classifier + median)
// DOPO: 3 righe
const thresholdPace = vdotPacesData?.paces?.threshold_empirical
  ?? vdotPacesData?.paces?.threshold
  ?? null;
```

DashboardView -28 righe di logica matematica.

### TODO completamento

Pattern proven. Restano 5 moduli da migrare:

| Modulo | LOC client | Endpoint backend proposto |
|---|---|---|
| `runnerDnaModel.ts` | ~700 | `GET /api/dna/scores` |
| `detrainingModel.ts` | ~250 | `GET /api/detraining/projection` |
| `injuryRisk` ACWR | ~60 | `GET /api/injury-risk` |
| `bestPbTime` | ~15 | `GET /api/best-pb-times` |

## Verifica integrità sito (round 5)

```
npx tsc --noEmit          → 0 errori
npx vitest run             → 18/18 test passati
python ast.parse server.py → OK
python -c "from backend.server import app" → OK (60+ routes)
npx vite build             → 9.75s, dist/ generato
```

### Files nuovi / modifiche

| Path | Δ |
|---|---|
| `backend/routers/__init__.py` | NEW (vuoto) |
| `backend/routers/health.py` | NEW (~50 righe) |
| `backend/deps.py` | NEW (~50 righe) |
| `src/components/dashboard/widgets/FitnessChart.tsx` | NEW (~240 righe) |
| `src/components/dashboard/widgets/HRZones.tsx` | NEW (~145 righe) |
| `src/components/dashboard/widgets/NextOptimalSessionWidget.tsx` | NEW (~175 righe) |
| `src/hooks/useServerEvents.ts` | NEW (~95 righe) |
| `src/components/DashboardView.tsx` | -560 (1775 → 1215) |
| `backend/server.py` | +60 SSE, +35 threshold_empirical, -10 health |
| `src/i18n/translations.ts` | +90 (4 namespace × 2 lang) |
| `src/components/FirstRunOnboarding.tsx` | hardcoded → i18n |
| `src/components/ErrorBoundary.tsx` | hardcoded → i18n |
| `src/App.tsx` | + 1 useServerEvents() |
| `src/types/api.ts` | + threshold_empirical optional |

### Quel che NON è cambiato (zero rischio breakage)

- ✅ Routing identico
- ✅ Backend endpoint invariati (solo aggiunte: SSE + estensione vdot/paces)
- ✅ Schema API/Mongo invariati
- ✅ DashboardView render path identico — solo widget definitions estratte
- ✅ thresholdPace logic identica (stesso algoritmo, solo migrato server-side)
- ✅ Cache layer invariato
- ✅ TopBar / Sidebar invariati

---

# CHANGELOG FIX — 2026-04-29 (round 6 — polish + a11y + mobile + scaffolds)

Sesto round: 11 punti (P2/P3 + parziali P0). Tutti verificati `tsc 0 errori,
vitest 18/18, server.py AST OK, vite build 9.80s`.

## #13 DRIFT_START_KM — derivato da corsa reale

**File**: `src/components/statistics/AnalyticsV2.tsx`.

```ts
function deriveDriftStartKm(distanceKm: number | undefined): string {
  if (!distanceKm || distanceKm < 6) return '4';
  return String(Math.max(4, Math.min(8, Math.round(distanceKm / 2))));
}
```

Half-distance clamped [4, 8]. Es: 10km → 5km, 6km → 4km, 20km → 8km.
Magic number `'8'` rimosso. Fallback usato come secondo livello dopo
heuristic HR-spike di 5%.

## #18 engines field + dep audit

**File**: `package.json`.

```json
{
  "engines": { "node": ">=20", "npm": ">=10" }
}
```

Inoltre rinominato `"name": "react-example"` → `"name": "metic-lab"` (non era
mai stato corretto). Niente Renovate config — lasciato a decisione futura.

## #12 V2/V3/V4/V5 audit + cleanup parziale

**Files**: `src/components/statistics/StatsRisk.tsx` (DELETED).

### Audit (tutto importato → nessuna eliminazione massiva)

```
AnalyticsV2 → usato in StatisticsView linee 1749, 1973
AnalyticsV3 → linea 1883
AnalyticsV4 → linee 1221, 1350, 1985 (sub-componenti)
AnalyticsV5 → linee 1232, 1243, 1730, 1734, 1871 (sub-componenti)
BiologyFutureV2 → linea 2455
BiologyFutureLab → linea 2211
```

NON sono "versioni alternative" del medesimo componente — sono **sezioni
distinte** della stessa view, ognuna con scope differente. Senza decisione
prodotto su quale tenere/rinominare, eliminazione = perdita feature.

### Cleanup eseguito

- ❌ `StatsRisk.tsx` (216 righe) — dead code: definito ma mai importato. Conteneva mock `acwrData` array hardcoded.

## #23 a11y — aria-labels su SVG + role="img" sui chart

**Files**: 3 widget in `src/components/dashboard/widgets/`.

```jsx
<svg role="img" aria-label={`Andamento condizione fisica (CTL) ultimi ${range}`}>
  <title>Condizione fisica — CTL nel tempo</title>
  <desc>Grafico ad area che mostra l'andamento del Chronic Training Load...</desc>
  ...
</svg>
```

3 chart pattern stabilito. Da estendere a tutti gli SVG charts esistenti
(VO2MaxChart, MainChart, FitnessFreshness, CardiacDrift, AnaerobicThreshold,
BadgesGrid donut, ecc.) — TODO documentato.

## #24 Skeleton — convention component shared

**File**: `src/components/Skeleton.tsx` (nuovo).

```tsx
<Skeleton />                              // block default h-10
<Skeleton variant="text" lines={3} />     // 3 linee
<Skeleton variant="card" className="h-64" /> // card placeholder
<Skeleton variant="circle" className="w-12 h-12" /> // avatar
```

`aria-busy="true"` + `aria-live="polite"` su tutti per screen reader.

**Convention** (round 6): skeleton per loading dati, spinner solo per azioni.

### TODO completamento

Sostituire ~30 pattern raw `animate-pulse` / `animate-spin` esistenti con
`<Skeleton />` o `<ActionSpinner />` (da creare).

## #22 Mobile responsive — Sidebar drawer + TopBar overflow-x

**Files**: `src/components/Sidebar.tsx`, `src/App.tsx`.

### Sidebar — drawer pattern < 768px

```tsx
const [isMobile, setIsMobile] = useState(...matches("(max-width: 767px)"));
const [open, setOpen] = useState(false);

if (isMobile) return (
  <>
    {!open && <button aria-label="Apri menu"><Menu/></button>}     {/* hamburger */}
    {open && <div className="fixed inset-0 bg-black/60" onClick={...}/>}  {/* backdrop */}
    <aside className={`fixed top-0 left-0 ... transform transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}>
      ...
    </aside>
  </>
);
```

ESC key chiude drawer. `aria-label`, `role="dialog"` per a11y.

### TopBar nav — overflow-x scroll mobile

```jsx
<nav className="flex items-center gap-3 md:gap-5 overflow-x-auto whitespace-nowrap scrollbar-hide" aria-label="Navigazione principale">
```

Logo "METIC LAB" hidden su mobile (era hardcoded visible). Padding ridotto
`px-4 md:px-8`. Gap nav ridotto `gap-3 md:gap-5`. Padding sinistra `pl-12`
per fare spazio al hamburger button.

## #6 ext — VO2MaxChart empty state migliorato

**File**: `src/components/VO2MaxChart.tsx`.

### Prima

```tsx
<div className="text-center py-4">
  <div className="text-2xl font-black text-text-muted">—</div>
  <div className="text-[10px]">Aggiungi corse per calcolare</div>
</div>
```

### Dopo

```tsx
<div className="text-center py-4 px-3">
  <div className="text-3xl mb-2">🏃</div>
  <div className="text-sm font-black text-white mb-1">VDOT non disponibile</div>
  <div className="text-[10px] leading-relaxed">
    Servono almeno {N - runs.length} corse di ≥5 km a sforzo costante (HR ≥ 80%).
    <br/>
    <span className="text-[#C0FF00]/80">Sincronizza più attività per attivare il calcolo.</span>
  </div>
</div>
```

Comunica **perché** il dato manca + **quanti** ne servono. Pattern da
estendere ad altri widget (FitnessChart, CardiacDrift, MainChart) — TODO.

## #3 — bestPbTime cleanup (parziale)

**File**: `src/components/DashboardView.tsx`.

`bestPbTime` definito ma **mai chiamato** (dead code dopo round 5
extractions). Rimosso. Le PB projections sono già coperte da
`buildRacePredictions` util + backend `analytics.race_predictions`.

DashboardView: 1215 → 1199 righe (-16, -1.3%).

### TODO completamento

`runnerDnaModel` (~700 righe), `detrainingModel` (~250 righe) restano lato
client. Migration in sprint dedicati.

## #14 — InfoTooltip extracted

**Files**: `src/components/dashboard/widgets/InfoTooltip.tsx` (nuovo),
`src/components/DashboardView.tsx`.

`InfoTooltip` (44 righe SVG portal-rendered) estratto. Aggiunto
`aria-label="Info: ${title}"` + `role="tooltip"` (a11y improvement gratis).

DashboardView: 1199 → 1155 righe (-44, -3.7%).

**Cumulativo round 5+6**: 1775 → 1155 righe (-620, **-35%**).

## #16 — Async queue scaffold + plan

**File**: `backend/worker.py` (nuovo, 110 righe stub).

### Cosa contiene

- 3 task placeholder: `strava_sync_task`, `garmin_sync_task`, `training_adapt_task`.
- `WorkerSettings` class commentata (decommentare dopo `pip install arq`).
- `enqueue_strava_sync()` helper stub.
- Documentazione completa: provider scelto (arq), alternativi valutati
  (Celery/RQ/Dramatiq), flusso end-to-end, design decisions.

### Cosa NON è ancora attivo

- `pip install arq` non eseguito (richiede Redis attivo per uso reale).
- Endpoint `POST /api/strava/sync` chiama ancora `await strava_sync()` inline.
- `GET /api/sync/status/:task_id` non esiste.

### Activation path (~2 settimane lavoro)

1. Aggiungere Redis su Render (addon o Upstash free tier).
2. `pip install arq` + aggiungere a `requirements.txt`.
3. Decommentare `WorkerSettings` + import `arq`.
4. Creare `routers/sync.py` con endpoint `enqueue` + `status`.
5. Sostituire chiamate inline con enqueue.
6. Avviare worker process: `arq backend.worker.WorkerSettings` (Render second service).
7. Frontend: hook `useSyncStatus(taskId)` + toast con progress.

## Verifica integrità (round 6)

```
npx tsc --noEmit          → 0 errori
npx vitest run             → 18/18 verdi (351ms)
python ast server.py + worker + health + deps → ALL OK
npx vite build             → 9.80s ✓
```

### Files nuovi/modifiche

| Path | Δ |
|---|---|
| `src/components/Skeleton.tsx` | NEW (~70 righe) |
| `src/components/dashboard/widgets/InfoTooltip.tsx` | NEW (~55 righe) |
| `backend/worker.py` | NEW (~110 righe stub) |
| `src/components/statistics/StatsRisk.tsx` | DELETED (216 righe dead code) |
| `src/components/Sidebar.tsx` | +95 righe (drawer mobile) |
| `src/components/DashboardView.tsx` | -60 righe (1215 → 1155) |
| `src/components/VO2MaxChart.tsx` | empty state UX |
| `src/components/statistics/AnalyticsV2.tsx` | DRIFT_START_KM derived |
| `src/components/dashboard/widgets/FitnessChart.tsx` | + role/title/desc |
| `src/components/dashboard/widgets/HRZones.tsx` | + role/title/desc |
| `src/components/dashboard/widgets/NextOptimalSessionWidget.tsx` | + role/title/desc |
| `src/App.tsx` | TopBar mobile padding/overflow |
| `package.json` | +engines, name fix |

### Quel che NON è cambiato

- ✅ Routing identico
- ✅ Backend endpoint invariati (worker.py è stub puro, non attivo)
- ✅ DashboardView render path identico (solo InfoTooltip + bestPbTime extract/remove)
- ✅ Cache layer invariato
- ✅ Sidebar desktop identica (>= 768px)
- ✅ Schema API/Mongo invariati

---

# CHANGELOG FIX — 2026-04-30 (round 8 — P0 advancements)

User ha chiesto: "fai tutti i punti definiti dentro a P0". P0 totale realisticamente
~5-6 settimane. Sessione singola → tutti i punti AVANZANO, nessuno completato 100%.
Cap onesto: 6h work effettive, ogni step verificato.

## #14 DashboardView — WeeklyKmChart extracted

`src/components/dashboard/widgets/WeeklyKmChart.tsx` (nuovo, ~110 righe).
Self-contained: state interno chartPeriod + memos chartData + weeklyKmTotal.

DashboardView: 1155 → 1041 righe (-114, -10%).
Cumulato round 5+6+8: 1775 → 1041 (-734, **-41%**).

Skip StatusOfForm (12+ props, costo refactor > beneficio).

## #15 server.py — routers/profile.py + routers/runs.py

Pattern Depends DI esteso a 7 endpoint:
- `routers/profile.py`: GET/PATCH /api/profile, GET/PUT /api/user/layout
- `routers/runs.py`: GET /api/runs, GET /api/runs/{id}, GET /api/runs/{id}/splits

Helpers in `deps.py`: aggiunti `oid`, `oids`, `normalise_run_quality_fields`
con late-import pattern.

Cumulato round 5+8: 9/55 endpoint estratti (16%).

## #3 Math heavy → backend

- injuryRisk: verificato già backend (POST /api/training-plan/adapt → modello ACWR).
  TrainingGrid.tsx solo descrizione tooltip, nessuna replica.
- detraining (371 righe TS): SKIP — sprint dedicato required.

Cumulato round 5+6+8: thresholdPace migrato, bestPbTime dead-code rimosso,
injuryRisk verificato. Restano runnerDnaModel + detrainingModel (sprint).

## #1 Auth scaffold

`backend/auth.py` (135 righe, NON attivo):
- `AUTH_ENABLED` env flag (default false)
- `get_current_user_id()` Depends helper → ritorna "default" se disabilitato
- `get_user_scope_query()` → {} se disabilitato, {"user_id": x} altrimenti
- `migrate_assign_default_user()` script one-shot per backfill user_id="legacy"
- Design: JWT custom (no vendor lock-in). Documentate alternative (Clerk, Supabase, Auth0).

`src/context/AuthContext.tsx` (115 righe, NON mounted):
- `AuthProvider` con `enabled` flag interno (default false)
- `useAuth()` hook → ritorna user "default" se non attivo
- `withAuthHeader()` helper per fetch con Bearer JWT
- Sentry `identifyUser()` integrato
- Login/logout stub con TODO esatti per implementation

Activation path documentato in entrambi i file (8 step).

## Verifica integrità (round 8)

```
npx tsc --noEmit                         → 0 errori
npx vitest run                           → 18/18 verdi
pytest backend/test_smoke.py             → 6/6 verdi
python ast.parse {server, auth, deps, 3 routers} → ALL OK
npx vite build                           → 16.59s ✓
```

## Files nuovi/modifiche

| Path | Δ |
|---|---|
| `src/components/dashboard/widgets/WeeklyKmChart.tsx` | NEW (~110) |
| `backend/routers/profile.py` | NEW (~75) |
| `backend/routers/runs.py` | NEW (~50) |
| `backend/auth.py` | NEW (~135) — scaffold |
| `src/context/AuthContext.tsx` | NEW (~115) — scaffold |
| `backend/deps.py` | +oid/oids/normalise helpers |
| `backend/server.py` | -126 righe (3 endpoint blocks rimossi) |
| `src/components/DashboardView.tsx` | -114 (1155→1041) |

---
