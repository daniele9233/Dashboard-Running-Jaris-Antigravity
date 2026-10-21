# 01 · Audit — Elite Analytics (METIC LAB)

Audit eseguito sul branch `design/elite-analytics-design-system` (da `main` a `791fb974`) **prima di qualunque modifica al codice dell'app**. Le misure di rendering vengono dal browser (Chrome headless, dati registrati, orologio fisso al 2026-10-21 10:00 Europe/Rome, animazioni spente); le misure statiche dal sorgente. L'inventario riga per riga sta in [`INVENTORY-baseline.md`](./INVENTORY-baseline.md).

## 1 · Metodo e limiti

| Cosa | Come |
|---|---|
| Baseline di build | `npm run lint` (tsc) pulito · `npm run test` 422/422 verdi · `npm run build` ok (16.9 s) |
| Screenshot | 19 pagine × 6 viewport (1920×1080, 1440×900, 1280×800, 768×1024, 390×844, 360×800) = 114 immagini in `docs/design-system/screenshots/baseline/` (**non versionate**: contengono dati personali reali e il repo è pubblico; la cartella è in `.gitignore`) |
| Dati stabili | Le GET verso il backend locale sono registrate una volta e riprodotte; ogni richiesta non-GET è stubbata (nessuna scrittura sul Mongo di produzione); mappe e telemetria bloccate; `Date` congelata; `prefers-reduced-motion: reduce` |
| Altezza pagina | l'app scorre dentro contenitori annidati: lo script allarga il viewport in altezza finché nulla scorre (tetto 9000 px; la pagina Attività lo raggiunge) |
| Misure DOM | per ogni grafico: titolo della card, dimensioni, corpo e colore dei tick, griglia, tratti, raggio/padding/vetro della card |
| Skill usate | Impeccable (init → `PRODUCT.md`, `document` → `DESIGN.md`, craft-floor, operate), UI/UX Pro Max (dominio `chart` e `ux`), Vercel (composition-patterns, react-best-practices, web-design-guidelines: installate; applicate nelle regole di §7), Superpowers (plugin installato a livello utente, attivo dalla prossima sessione) |
| Playwright MCP | aggiunto con `claude mcp add playwright …` (connesso) ma **non visibile in questa sessione**: gli screenshot sono stati scattati con `playwright-core` + Chrome, da script fuori dal repo |

**Non verificato**: viste diverse da quelle raggiunte dal percorso base (modali, stati di errore, dati vuoti reali, filtri diversi dai default, hover sui grafici in tutte le card); Safari/Firefox; touch reale.

## 2 · Problemi preesistenti (non introdotti dal lavoro di design)

- 3 test falliti in `backend/test_vdot_model.py` (non toccato).
- Errore console Mapbox `Invalid LngLat object (NaN, NaN)`.
- Segnalazioni del design hook su bordi colorati in `TrainingGrid.tsx` (barra che codifica il tipo di seduta: funzionale, **non toccata**).
- All'apertura la vista Clima & Ritmo e il dashboard inviano `POST /api/runs/weather/bulk` e un `POST /api/runs/:id/weather` per corsa: con il backend locale scrivono sul Mongo di produzione. Gli script di audit li bloccano.

## 3 · Numeri dell'audit

| Voce | Valore |
|---|---|
| Grafici Recharts nel sorgente | **82 istanze in 30 file** (Line 22, Bar 17, Composed 17, Area 16, Scatter 6, Radar 3, RadialBar 1) |
| … di cui non renderizzati | 5 in 2 file senza import (`StatsProgress`, `StatsCalc`) + 13 blocchi `{false && …}` nascosti (12 in `StatisticsView`, 1 in `AnalyticsV2`) |
| Grafici Recharts renderizzati nelle 19 pagine | 29 (misurati nel browser, 1440×900) |
| Visualizzazioni SVG custom analitiche | ~25 (curve Pace Lab ×3, Race Lab, GAMI ×2, FitnessMultiChart, anelli/gauge/radar, heatmap…) · vedi §5 |
| Colori esadecimali distinti nei componenti (escluse scene di celebrazione e hero) | **168 in 2 137 usi** — lime: 21 varianti, verdi: 12, arancioni: 9, neutri: 66 |
| Testo sotto i 12 px | **1 173** classi `text-[7..11px]` contro 63 `text-[12px]`; nelle pagine misurate ≈ 6 000 nodi di testo a 7–10 px |
| Implementazioni locali di card/testata | **14** (`V2Card`, `Panel` ×6, `Card`+`CardHeader` ×3, `GlassPanel`, `GridCard`, `LBPanel`, `CardHeader`) |
| Implementazioni di tooltip | **19** funzioni/componenti + 35 `contentStyle` locali + 45 `content` custom |
| Selettori di intervallo (1M/3M, 7D/30D) | ≥ 7 implementazioni |
| Legende | 4 `<Legend>` di Recharts; tutte le altre sono `div` locali |
| `chartTheme` adottato | colori: `CHART_SERIES` in 19 file (179 riferimenti), `CHART_SURFACE` 13, `CHART_TEXT` 12 · **geometria e preset: 0 usi** (`chartGrid`, `chartAxis`, `chartCursor*`, `CHART_SHAPE`, `chartCardClass`, `CHART_MOTION`), `ChartTooltip` 1 consumatore |
| Bundle (gzip) | `vendor-charts` 134.8 kB · `StatisticsView` 86.2 kB · `App` 109.0 kB · `index` 106.1 kB · `vendor-mapbox` 800.8 kB |

## 4 · Come si presenta oggi: tre grammatiche nella stessa app

Passando da una scheda all'altra di `/statistics`:

- **Carico & Forma**: card di vetro scuro (`rounded-3xl`, blur 40 px, gradiente bianco→nero, ombra interna), titoli sans bold, selettori `1M 3M 6M`.
- **Potenziale & Progressi** e **Biomeccanica**: card con cornice lime a 2 px e alone, titoli in corsivo nero maiuscolo, micro-etichette a 7–9 px, un "vettore potenziale" con eyebrow sopra il titolo.
- **Biologia & Futuro V2**, **Detraining**: card piatte quasi senza bordo, titoli in maiuscolo spaziato con icona, tick a 10 px.

Stessa pagina, stessi dati, tre prodotti. Il problema non è "troppo stile": è l'assenza di un contratto che dica come si disegna una card di grafico.

## 5 · Inventario SVG

| Classe | Dove | Trattamento |
|---|---|---|
| **Analitici custom** (migrabili al tema, geometria da preservare) | `CaricoFormaV2` FitnessMultiChart · `pacelab/PaceProChart`, `FastStartSection`, `ListinoSection` · `racelab/GoalTrajectory` · `gamification/GoalCone`, `AthleteEvolutionFramework` · `dashboard/widgets/FitnessChart` · `AnalyticsV3` (radar da 280×260) · `AnalyticsV2` (gauge/anelli/radar di prontezza) | solo proprietà visuali: colori, font, spessori, opacità. Coordinate e algoritmi intatti |
| **Anelli/gauge/progress** | `HRZones`, `NextOptimalSessionWidget`, `VO2MaxChart` (gauge), `PotenzialProgressiV2` (anello), `BiologyFutureV2` (anelli), `StatsProgress`, `RunnerDnaView`, `DashboardView` | colori e font dal tema; mantengono la loro forma |
| **Icone** | `lucide-react` + SVG inline di 14–24 px (`CardiacDrift`, `StatsDrift`, `ProfileView` logo Strava) | **non toccate** |
| **Decorativi** | `components/celebrations/scenes*.tsx` (≈110 SVG di scene di trofei), `components/hero/*` (intro) | **non toccati** |
| **Mappe e 3D** | `LastRunMap`, `LiveTelemetry3DMap`, `RoutesView` (Mapbox), Three.js | **non toccati** |

Regola dello step SVG: nessuna regola CSS globale su tutti gli `svg` (oggi c'è `html[data-theme="dark"] svg * { transition-property: none !important }` in `index.css:195`: vedi U-01); id univoci per gradienti e `clipPath`.

## 6 · Matrice delle incoerenze, per causa

Severità: **CRITICAL** leggibilità o funzione compromesse · **HIGH** incoerenza evidente o responsive errato · **MEDIUM** difformità tipografica/cromatica/geometrica · **LOW** rifinitura.

### A · Tre sistemi di token in parallelo

| ID | Sev | Evidenza |
|---|---|---|
| A-01 | HIGH | `index.css` ha tre strati che non si parlano: variabili `--app-*` (tema), `@theme` Tailwind con `--color-accent: #2DD4BF` (teal, non lime) e `chart-*`, e `chartTheme.ts`. Altre palette locali: `pacelab/ui.tsx`, `SESSION_COLORS` ×2, `ProfileView.runTypeColor`, 13 costanti `NEON/CYAN/ORANGE…` ridefinite per file |
| A-02 | HIGH | 168 esadecimali diversi: 21 sfumature di lime (`#C0FF00 ×401`, `#CCFF00`, `#A3E635`, `#C8FF2D`, `#D7FF76`…), 12 verdi, 9 arancioni (`#F59E0B ×64`, `#F97316 ×20`, `#FB923C`, `#FF5B00`…), 5 rossi |
| A-03 | HIGH | `chartTheme` è stato adottato solo per i colori: nessun grafico usa `chartGrid`, `chartAxis`, `chartCursor`, `CHART_SHAPE`, `chartCardClass` (0 usi); `ChartTooltip` ha un solo consumatore |
| A-04 | HIGH | Il tipo di seduta ha **quattro** palette: `TrainingGrid` (easy viola, tempo arancio, lungo verde, ripetute rosso), `TrainingSidebar` (idem), `ProfileView` heatmap (lungo blu, easy verde, recupero viola, gara rosa), `CaricoFormaV2` (easy verde, tempo ciano, intervalli ambra, lungo lime, gara rosso) |
| A-05 | MEDIUM | Font `Outfit` importato da Google Fonts e mai usato (1 riferimento, l'import); `--font-mono` come font del `body` ma Inter sui testi: la regola non è scritta |

### B · Tipografia

| ID | Sev | Evidenza |
|---|---|---|
| B-01 | **CRITICAL** | I tick degli assi sono 9–10 px (misurato: 9 px ×28 e 10 px ×12 solo in Carico & Forma) con colore `#333` (1.5:1), `#444` (2.0:1), `#555` (2.6:1), `#666` (3.4:1) su `#0E0E0E`: informazione primaria quasi invisibile. 24 degli 82 grafici dichiarano esplicitamente un colore d'asse sotto 3:1 |
| B-02 | HIGH | ≈ 6 000 nodi di testo a 7–10 px nelle 19 pagine (etichette di KPI, legende, sottotitoli). Il sistema vuole ≥ 12 px per il testo informativo |
| B-03 | MEDIUM | Titoli di card: `text-base/lg/xl` · `font-bold/black` · normale/corsivo · maiuscolo/minuscolo; 4 grammatiche di testata nella sola scheda Carico & Forma |
| B-04 | MEDIUM | Eyebrow sopra il titolo ("VETTORE POTENZIALE", "DOPO 4 SETTIMANE"): pattern vietato dal craft-floor di Impeccable, usato come grammatica |
| B-05 | LOW | Cifre in `tabular-nums` in 261 punti ma non ovunque (KPI di alcune card ballano al cursore) |

### C · Card e superfici

| ID | Sev | Evidenza (misurata) |
|---|---|---|
| C-01 | HIGH | Raggio delle card nei grafici: 8, 12, 16, 24, 26 px. Padding: 0, 16, 20, 24, 28, 32 px |
| C-02 | HIGH | Vetro (`backdrop-filter: blur(40px)` + gradiente bianco→nero + ombra interna) su 48 file / ≈ 170 card; direzione di design non è "piatto" ma "vetro", contro il brief |
| C-03 | MEDIUM | Cornici lime a 2 px con alone su Potenziale & Progressi / Biomeccanica; barre colorate laterali (funzionale in `TrainingGrid`: non toccato) |
| C-04 | MEDIUM | Card dentro card: KPI tile con blur proprio dentro una card con blur; tile con bordo dentro pannello con bordo |
| C-05 | MEDIUM | 14 implementazioni locali del guscio (elenco in §3): ogni correzione andrebbe fatta 14 volte |

### D · Assi, griglia, margini, altezze

| ID | Sev | Evidenza |
|---|---|---|
| D-01 | HIGH | Colore della griglia: 12 valori diversi (`#1A1A1A`, `#1E293B`, `#2A2A2A`, `#252528`, `rgba(192,255,0,.08)`…); tratteggio: 7 varianti (`3 3`, `2 4`, `2 6`, `3 6`, `1 0`…); verticali presenti o no senza criterio |
| D-02 | HIGH | Margini **negativi** (`left`/`right`: -10 … -20) in 40 grafici di 15 file per recuperare spazio: tagliano le etichette dell'asse Y (visibile: `Biologia & Futuro V2` mostra "i1.6", "i0.4"; `Matrice degli Sforzi` mostra "8:59" mozzo) |
| D-03 | MEDIUM | Margini del plot: 12 combinazioni; `CHART_SHAPE.margin` esiste e non è usato |
| D-04 | MEDIUM | Altezze: ≈ 20 valori distinti dichiarati (24, 36, 48, 64, 72, 80, 120, 140, 160, 180, 190, 200, 220, 240, 260, 280, 312, 320, 360, 420) senza relazione con la famiglia di grafico |
| D-05 | MEDIUM | Spessore linee: 1, 1.4, 1.5, 1.75, 1.8, 2, 2.2, 2.5, 3 senza significato; `dot` fissi a r 4–5 in alcune linee e nascosti in altre |

### E · Tooltip, legende, selettori, stati

| ID | Sev | Evidenza |
|---|---|---|
| E-01 | HIGH | 19 componenti tooltip + 35 `contentStyle` + 45 `content` custom; corpi 9–12 px; sfondi `#111`, `#141414`, `#0F172A`; bordi e raggi diversi |
| E-02 | MEDIUM | Legende: `div` locali a 9 px; il campione è sempre un pallino, mai il tratto (misurato, previsto e scenario non si distinguono nella legenda) |
| E-03 | MEDIUM | ≥ 7 selettori di intervallo con etichette (`1M`/`1m`/`7D`/`7d`), dimensioni e stato attivo diversi; nella stessa card di Carico & Forma ce ne sono tre |
| E-04 | MEDIUM | Stato vuoto: 8 × "Dati insufficienti", 4 × "non disponibile", "Nessun dato", "Dati non disponibili", ognuno con tipografia propria; nessuno stato di caricamento a tema nei grafici (`Skeleton` esiste e non è usato qui) |
| E-05 | LOW | KPI: corpo da `text-xl` a `text-4xl`, delta con solo colore verde/rosso |

### F · Responsive

| ID | Sev | Evidenza |
|---|---|---|
| F-01 | HIGH | `CaricoFormaV2` usa `grid grid-cols-2` senza breakpoint: a 390 px la card km e la card zone stanno affiancate in 160 px, selettori `7D` fuori dal bordo (screenshot baseline 390×844) |
| F-02 | HIGH | FitnessMultiChart è un SVG con `viewBox 1000×300` ridimensionato: a 390 px i tick (10 px) diventano ~3.5 px reali, illeggibili, e sotto resta un vuoto (`min-h-[260px]`) |
| F-03 | MEDIUM | `StatisticsView` e altre viste fissano altezze in px sul contenitore invece che per famiglia; sotto i 768 px i grafici non riducono i tick |
| F-04 | MEDIUM | Nessun controllo di overflow orizzontale interno ai contenitori scorrevoli nei test esistenti (l'overflow del documento è 0 a tutti i viewport: lo scorrimento è interno) |

### G · Natura del dato (misurato / derivato / previsto)

| ID | Sev | Evidenza |
|---|---|---|
| G-01 | MEDIUM | Il tratteggio è usato per scopi diversi: ATL tratteggiata in un grafico, previsioni continue in un altro, riferimenti tratteggiati ovunque. Manca la convenzione "continuo = misurato, tratteggio = previsto" |
| G-02 | MEDIUM | Zone di intensità: Z2 `#34D399` e `#10B981`, Z3 `#C0FF00`, Z5 `#F43F5E`/`#EF4444`: la rampa c'è ma è riscritta in ogni file |

### H · CSS globale, movimento, accessibilità

| ID | Sev | Evidenza |
|---|---|---|
| U-01 | MEDIUM | `html[data-theme="dark"] svg * { transition-property: none !important; }` blocca le transizioni di tutti gli SVG dell'app, incluso ciò che vorrebbe animare |
| U-02 | MEDIUM | `animate-in fade-in slide-in-from-bottom-4 duration-700` su ogni scheda (22 usi, 34 `duration-700`): fuori dal registro product (150–250 ms) e senza il plugin Tailwind che li definirebbe, quindi probabilmente inerti |
| U-03 | HIGH | FitnessMultiChart e altri SVG custom reagiscono solo al puntatore (`onPointerMove`): nessun accesso da tastiera; Recharts 3 ha `accessibilityLayer` attivo di default, quindi i grafici Recharts sì |
| U-04 | MEDIUM | Quasi nessun `role`/`aria-label` sui grafici (1 file su 30 in `statistics/`); nessun riassunto testuale dell'andamento |
| U-05 | MEDIUM | `prefers-reduced-motion` rispettato solo in poche regole CSS; GSAP/Motion in 7 file senza guardia coerente |
| U-06 | LOW | Colore rosso/verde come unico segnale di delta in più KPI; verificato che rosa `#F43F5E` e verde `#22C55E` hanno ΔE 8 sotto deuteranopia |

## 7 · Componenti condivisibili vs specializzati

**Condivisibili (duplicazione reale, eliminabile):** guscio di card + testata (14 copie), tooltip (19), selettore di intervallo (7), legenda, tile KPI e riga di statistiche (`StatCell` e simili), stato vuoto/caricamento/errore, preset di assi/griglia/cursore/margini, scala tipografica, altezze per famiglia.

**Specializzati (restano propri, usano solo il tema):** FitnessMultiChart (ribbon con `clipPath`), radar di prontezza, gauge e anelli, curve del Pace Lab, traiettoria di Race Lab, GoalCone, heatmap del profilo, mappe e 3D. Un radar resta un radar: cambiano font, colori, spessori, legenda, non la geometria.

## 8 · Rischi di regressione

| Rischio | Mitigazione |
|---|---|
| Passare i tick da 9–10 px a 12 px sovrappone le etichette | `minTickGap` e `interval="preserveStartEnd"` nei preset; verifica a 5 viewport su ogni scheda migrata |
| Margini sinistri negativi rimossi → il plot si restringe e i domini "cambiano aspetto" | I domini non si toccano: cambia solo la larghezza dell'asse Y, da `width` esplicita |
| Cambiare il colore di un concetto (es. tipi di seduta in Carico km) | Mappa dichiarata in `theme.ts`, test di parità con `tokens.css`, elenco delle eccezioni in `04-MIGRATION-LOG.md` |
| Modificare l'ordine/direzione dell'asse del passo | Vietato: asse `reversed`, `domain` e `tickFormatter` si lasciano esattamente com'erano |
| Gradienti con `id` duplicati quando due card montano insieme | `useId()` per gli `id` nei componenti nuovi; verifica a mano di quelli esistenti |
| Regressioni invisibili (non c'è visual-regression nei test) | Confronto prima/dopo con lo stesso script e gli stessi dati registrati; metriche semantiche (corpo tick, contrasto, overflow, errori console) oltre ai pixel |
| Perdere grafici nascosti (`{false && …}`) | Non vengono migrati; sono elencati come debito |

## 9 · Piano per rotta

Ordine: token → tema → componenti → **pilota `/statistics` Carico & Forma** → altre schede di `/statistics` → dashboard e widget → altre rotte con SVG propri.

| Rotta | Contenuto grafico | Famiglia prevalente | Priorità |
|---|---|---|---|
| `/statistics` Carico & Forma | SVG custom + Bar ×2 + Scatter + barre HTML | Temporale · Distribuzione · Relazione | **Pilota** |
| `/statistics` Potenziale & Progressi | Area ×4, Radar, gauge, 14 grafici in `AnalyticsV2` (la maggior parte nascosta) | Temporale · Composizione | 1 |
| `/statistics` Potenziale & Progressi V2 | Composed, RadialBar, Bar, Scatter (già su `chartTheme`) | Temporale · Composizione · Relazione | 1 |
| `/statistics` Biomeccanica & Efficienza | Line ×6, Area, Scatter ×2 + SVG | Temporale · Relazione | 2 |
| `/statistics` Biologia & Futuro | Area + `MainChart`, `AnaerobicThreshold`, `FitnessFreshness`, `SupercompensationChart` | Temporale · Previsione | 2 |
| `/statistics` Clima & Ritmo | Composed (Actual vs STP) | Temporale | 2 |
| `/statistics` Detraining | Composed (taper vs detraining) + anelli | Previsione & Scenario | 2 |
| `/statistics` Biologia & Futuro V2 | Line ×2, Bar, Area (già su `chartTheme`) | Previsione & Scenario | 2 |
| `/` Dashboard | `WeeklyKmChart`, `VO2MaxChart`, `RacePredictions`, `TopStats`, widget SVG | tutte | 3 |
| `/training`, `/ranking`, `/activities/:id` | pochi grafici, card proprie | Distribuzione · Composizione | 3 |
| `/pace-lab`, `/race-lab`, `/gamification-v1`, `/runner-dna` | SVG proprietari | Previsione · Composizione (specializzati) | 4 (solo proprietà visuali) |
| `/badges`, `/profile`, `/activities` | nessun grafico Recharts | — | fuori ambito (verificate solo come non-regressione) |
