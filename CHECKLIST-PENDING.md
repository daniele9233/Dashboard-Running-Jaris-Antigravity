# CHECKLIST PUNTI MANCANTI

Stato al **2026-04-30** dopo round 1-8 di fix. Audit originale = 35 punti.

> **Per stato dettagliato post round 8 vedi [`MISSING-PIECES.md`](./MISSING-PIECES.md)**.

**Eseguiti completi**: 26 (round 1-7).
**Pattern proven (parziali)**: 5 (round 5+8 → #3, #14, #15, #1 scaffold, #21).
**Deploy hardening**: 3 (Render import fix, CORS fix, CI gate BLOCKING).
**Mancanti completi**: 6 punti.

### Riepilogo round 5-8 (post-audit fix work)

| Punto | Status post round 8 | Dettaglio |
|---|---|---|
| #3 Math → backend | 🟡 PATTERN+ | thresholdPace + bestPbTime + injuryRisk done. detraining/runnerDna restano sprint. |
| #14 DashboardView split | 🟡 PATTERN+ | **-41% (1775→1041)**, 4 widget extracted. StatusOfForm + Status of Form gauge restano. |
| #15 server.py split | 🟡 PATTERN+ | 9/55 endpoint estratti (16%): health, profile, runs. 46 endpoint restano. |
| #17 SSE | ✅ DONE | event bus + 5 event types + frontend hook + auto-cache-invalidate. CORS y63x verificato. |
| #21 i18n | 🟡 PATTERN | 4 namespace nuovi (IT+EN). FirstRunOnboarding + ErrorBoundary i18n-ed. ~150 stringhe restano. |
| #1 Auth | 🟡 SCAFFOLD | `backend/auth.py` + `AuthContext.tsx` pronti, NON attivi. 8-step activation documentato. |
| **Deploy** | ✅ FIX | Render import error (round 7) + CORS y63x (round 7) + CI gate (round 7). Backend live `6351fc9`. |
| **Observability** | ✅ READY | Sentry SDK wired (manca solo DSN env var Render). Render alerts: `OPS-SETUP.md` 30 min utente. |

> Legenda priorità:
> - 🔴 **P0 — Bloccante prima di prod commerciale**
> - 🟠 **P1 — Importante, fattibile in sprint dedicato**
> - 🟡 **P2 — Polish, slot-based**
> - ⚪ **P3 — Nice-to-have / informativo**

---

## 🔴 P0 — Bloccanti per prodotto commerciale

### ☐ #1 — Auth + sessione utente multi-tenant

**Costo stimato**: 1-2 settimane.
**Stato attuale**: single-tenant. Backend ha 1 athlete_id derivato da `_get_athlete_id()` che legge l'ultimo Strava token. Tutti i dati sono "globali".

**Perché va implementata**:
- Senza auth NON si può vendere come SaaS (zero isolamento dati).
- Il file `userEmail` in `MEMORY.md` cabla l'identità a livello locale: chiunque acceda al backend vede gli stessi dati.
- Strava token salvato senza isolamento per user → secondo utente sovrascrive il primo.
- Compliance GDPR impossibile (no diritto all'oblio = no DELETE per user).

**Implementazione consigliata**:
1. Scegliere provider: **Clerk** (managed, fast) o **Supabase Auth** (open + Postgres incluso) o **JWT custom + bcrypt** (controllo totale, più lavoro).
2. Schema Mongo: aggiungere `user_id: str` a TUTTE le collection (`runs`, `garmin_csv_data`, `analytics_cache`, `runner_dna_cache`, `strava_tokens`, `training_plan`, `gct_analysis`, `user_layout`).
3. Backend middleware: estrarre `user_id` da JWT/cookie e fare scope filtering automatico in helper `_user_scope()`.
4. Migration script: assegnare tutti i record esistenti a un `user_id="legacy"` per non perderli.
5. Frontend: `<AuthProvider>`, `LoginPage`, redirect logic, hook `useAuth()`.
6. Strava OAuth: associare token a user attivo, non più "ultimo".

**Rischio se non fatto**: progetto resta demo personale. Zero monetizzazione.

---

### ☐ #3 — Math pesante client-side residua

**Costo stimato**: 1-3 giorni a modulo (totale ~2 settimane per tutti).
**Stato attuale**: round 2 ha estratto `racePredictions`, `paceFormat`, `cardiacDrift`. **Round 5 ha migrato `thresholdPace` come pattern proven** (vedi REPORT-TECNICO #3 round 5). 5 moduli restano client-side.

**Perché va implementata**:
- Regola architetturale "client = view, backend = compute" violata.
- Browser scarso (mobile entry-level) impiega secondi a calcolare → freeze UI percepito.
- Ogni componente ricalcola gli stessi aggregati invece di fetcharli pre-computati e cachati.
- Cambi formula richiedono deploy frontend (catena lunga) invece di solo backend.

**Moduli da migrare** (in ordine di dolore decrescente):

| Modulo | LOC | Endpoint backend proposto | Note |
|---|---|---|---|
| `runnerDnaModel.ts` | ~700 | `GET /api/dna/scores` | Più grosso, scoring DNA |
| `detrainingModel.ts` | ~250 | `GET /api/detraining/projection` | Modello giorno-per-giorno |
| `BadgesGrid.buildContext` (round 4 ridotto a Passerotto) | ~50 | `GET /api/badges/computed` | Già minimale post-round 4 |
| `bestPbTime` proiezione PB | ~80 | Già in `analytics.race_predictions`? Verificare |
| `injuryRisk` ACWR | ~60 | `GET /api/injury-risk` | ACWR proper formula |
| `thresholdPace` (Daniels T-pace + override) | ~40 | `GET /api/training-paces` (esiste? estendere) | |

**Pattern di migrazione**:
1. Endpoint backend con stessa logica.
2. Test unit Python per parità (es. `test_detraining.py` con dataset noto).
3. Frontend: sostituire chiamata `model.compute(...)` con `useApi(getDetrainingProjection, { cacheKey: ... })`.
4. Rimuovere file modulo client.

**Rischio se non fatto**: scaling impossibile. Mobile UX pessima. Bug-fix duplicati (client+server divergono).

---

### ☐ #14 — DashboardView (god component, ora 1215 righe)

**Costo stimato residuo**: 1.5-2 giorni (era 3).
**Stato attuale**: **Round 5 ha estratto FitnessChart, HRZones, NextOptimalSessionWidget** in `src/components/dashboard/widgets/` come pattern proven. Da 1775 → 1215 righe (-560). Pattern stabilito (vedi REPORT-TECNICO #14 round 5).

**Perché va implementata**:
- File irrimediabilmente difficile da leggere/modificare.
- Test impossibili: troppe dipendenze hooks non isolate.
- Onboarding nuovo dev = lettura di 30+ minuti per capire dove tocchi.
- Conflicting merge frequent — più persone non possono lavorarci in parallelo.

**Plan**:
1. Creare `src/components/dashboard/widgets/` directory.
2. Estrarre 1 widget alla volta (FitnessChart, HRZones, NextOptimalSession, MainChart inline copy, …).
3. Ogni widget: `Widget.tsx` (presentational) + `Widget.derived.ts` (memoized computed) + `Widget.test.ts` (vitest).
4. DashboardView ridotta a orchestrazione + layout + grid drag/drop.
5. Target: < 800 righe.

**Rischio se non fatto**: ogni feature aggiunta peggiora il problema. Già fatto round 1 fix #11 (extract racePredictions/paceFormat) — 1764 → ?. Round 2 ha tagliato 121 righe. Restano ~1700 da affrontare.

---

### ☐ #15 — server.py 7521 righe (God File backend)

**Costo stimato residuo**: 2 giorni (era 2-3, ora pattern + DI helpers già pronti).
**Stato attuale**: **Round 5 ha estratto `health` router + creato `backend/deps.py`** per dependency injection. Pattern + tooling pronti (vedi REPORT-TECNICO #15 round 5). 53/55 endpoint restano in server.py.

**Perché va implementata**:
- Stessi motivi di #14 ma backend.
- Worse: senza test backend (#4 non copre Python), refactor è russian roulette.
- Hot reload uvicorn con 7500 righe è lento.
- Diff su PR illegibili.

**Plan FastAPI router-based**:
```
backend/
  server.py              # solo app + lifespan + middleware (200 righe max)
  routers/
    auth.py              # quando arriva #1
    runs.py              # GET /api/runs, POST /api/runs/import
    profile.py           # GET/PATCH /api/profile, /api/user/layout
    training.py          # /api/training-plan/*
    analytics.py         # /api/dashboard, /api/analytics, /api/best-efforts
    integrations/
      strava.py          # /api/strava/*
      garmin.py          # /api/garmin/*
    ai.py                # /api/jarvis/chat, /api/ai/analyze-run
  services/              # business logic separata da HTTP
    sync.py
    fitness_freshness.py
    training_plan.py
  models/                # Pydantic
  db/                    # Mongo helpers
```

**Pre-requisito**: aggiungere pytest minimo (es. test smoke su 10 endpoint principali) **prima** del refactor, per detect regressioni.

**Rischio se non fatto**: il backend diventa intoccabile. Bug-fix richiedono 30 min solo a navigare il file.

---

## 🟠 P1 — Importanti, fattibili in sprint dedicato

### ☐ #16 — Sync queue background (Celery / RQ / arq)

**Costo stimato**: 2 settimane.
**Stato attuale**: Strava OAuth callback chiama `syncStrava()` sincrono. Se l'utente ha 1000+ corse, l'OAuth callback timeout → UI bloccata, possibile sync parziale.

**Perché va implementata**:
- UX broken su utenti con storia lunga.
- Render free tier ha 30s timeout su HTTP → sync fallisce silenziosamente.
- Garmin 429 documentato in `MEMORY.md → garmin_ratelimit.md`: sblocco manuale richiesto. Una queue con retry+backoff lo risolverebbe automaticamente.

**Implementazione** (consigliata: `arq` — async-native, integra con FastAPI):
1. Worker process separato (`backend/worker.py`).
2. Broker: Redis (Render addon o Upstash free tier).
3. Endpoint `POST /api/strava/sync` ritorna `task_id` immediato.
4. Endpoint `GET /api/sync/status/:task_id` per UI poll.
5. Worker: retry exponential backoff su 429/5xx.
6. Frontend: loading toast con poll ogni 2s, mostra progress.

**Rischio se non fatto**: utente fa sync, vede pagina bianca per 30s, esce, dati sync incompleti.

---

### ✅ #17 — WebSocket / SSE per live update — DONE round 5

**Stato**: implementazione SSE completa. `GET /api/events/stream` server-side
con event bus async; `useServerEvents()` hook frontend con auto-cache-invalidate
su `sync_complete`. 5 event types (connected/sync_started/sync_complete/sync_error/training_adapted).
Vedi REPORT-TECNICO #17 round 5.

**TODO residuo minore**:
- Hook su Garmin sync (oggi solo Strava + adapt).
- Toast UI ("✓ N nuove corse importate") — manca toast component.

**Perché va implementata**:
- Pattern moderno: server-push notification "sync complete / training adapted / new PB".
- Migliora UX: utente vede toast "✓ 12 nuove corse importate" invece di scoprirlo cliccando.
- Necessario insieme a #16: la queue completa async, deve notificare.

**Implementazione** (FastAPI ha SSE built-in, molto più semplice di WS):
- Endpoint `GET /api/events/:user_id` (text/event-stream).
- Frontend: `EventSource` nel `LayoutContext` o `AppContent`.
- Eventi: `{ type: 'sync_complete', count: 12 }`, `{ type: 'pb_detected', distance: '5K', time: '19:42' }`.
- On event: `invalidateCache(API_CACHE.RUNS)` + toast.

**Rischio se non fatto**: UX feel "statica", utente deve refreshare.

---

### ☐ #21 — i18n stringhe IT hardcoded (parziale)

**Costo stimato residuo**: 0.5-1 giorno.
**Stato attuale**: **Round 5 ha aggiunto namespace `onboarding`/`errors`/`widgets`/`sync`** (IT+EN, ~30 nuove keys). FirstRunOnboarding + ErrorBoundary 100% i18n-ed. ~150 stringhe restano nei widget (DashboardView, StatisticsView, ProfileView, ecc.).

**Perché va implementata**:
- Utente che switcha a EN vede ~50% UI in IT → look unprofessional.
- Onboarding utenti non-italiani impossibile.
- Bloccante per espansione internazionale.

**Plan**:
1. Audit con `grep -rE 'text-(white|gray)"\s*>\s*[A-Z]' src/components/` (heuristica: stringhe ASCII dentro span/p/div).
2. Estrarre in `src/i18n/locales/{it,en}.json` con namespacing per file.
3. Sostituire ogni hardcoded con `t('namespace.key')`.
4. Pre-commit hook (eslint custom rule) che blocca nuove stringhe hardcoded.

**Rischio se non fatto**: prodotto NON internazionalizzabile.

---

### ☐ #6 (parziale) — Onboarding flow EXTENDED

**Costo stimato**: 2-3 giorni.
**Stato attuale**: round 4 ha aggiunto `<FirstRunOnboarding />` come gate per dashboard vuota. MA è solo lo step 1.

**Cosa manca**:
- Tutorial guidato post-prima-corsa: "Eccoti il tuo VDOT, questo è il tuo Race Prediction, …" con highlights.
- Profile completion: utente può iniziare senza FC max / soglia / peso → onboarding chiede questi dati graduali.
- Empty states **migliori** sui widget (es. VO2MaxChart con 1 sola corsa: spiegare perché non basta, mostrare quante ne servono).

**Perché va implementata**:
- Utenti senza coaching abbandonano dashboard percepita come incomprensibile.
- Conversion rate prima-corsa → utente attivo dipende da onboarding.

---

## 🟡 P2 — Polish, slot-based

### ☐ #12 — Componenti V2/V3/V4/V5 dead-code cleanup

**Costo stimato**: 1 giorno (+ 30 min product decision per ogni famiglia).
**Stato attuale**: convivono `AnalyticsV2`, `AnalyticsV3`, `AnalyticsV4`, `AnalyticsV5`, `BiologyFutureV2`, `BiologyFutureLab`, `RunnerDna` (con redirect da `/runner-dna-v2`).

**Perché va implementata**:
- Indica codice sperimentale lasciato in produzione → debt accumula.
- Bundle size gonfiato: ogni V importa Recharts + math.
- Onboarding nuovo dev confuso: "qual è quello giusto?".

**Plan**:
1. **Decisione product**: per ogni famiglia, scegliere il "winner" (probabilmente il più recente).
2. Cancellare gli altri.
3. Aggiornare `repo-map.md` (auto-rigenera con `npm run context:update`).

**Rischio se non fatto**: bundle resterà inutilmente grande. Confusione cresce con ogni esperimento.

---

### ☐ #22 — Mobile responsive

**Costo stimato**: 2-3 giorni.
**Stato attuale**: `react-grid-layout` ha breakpoint xs/xxs ma probabilmente cattivo render. Sidebar fissa 220px → su 375px occupa 60% schermo. TopBar 7 voci → overflow.

**Perché va implementata**:
- Runner consultano dashboard PRINCIPALMENTE da mobile post-allenamento.
- Mancato supporto mobile = -50% utenti potenziali.

**Plan**:
1. Sidebar → drawer pattern (collapse default su < 768px, hamburger button).
2. TopBar → overflow-x-scroll OR collapse in dropdown su < 768px.
3. Test fisico con 375px (iPhone SE) e 414px (iPhone Pro Max).
4. `useMediaQuery("(max-width: 767px)")` già in DashboardView → estendere convenzione.
5. Charts: forzare height fissa < 250px per non rubare schermo.

**Rischio se non fatto**: utenti mobile abbandonano dopo 1 visita.

---

### ☐ #23 — Accessibility (a11y)

**Costo stimato**: 1 settimana.
**Stato attuale**: zero `aria-label` sui bottoni icon-only (eccetto avatar in round 4). Charts SVG senza testo descrittivo. Color contrast probabilmente non WCAG AA. Niente keyboard nav testata.

**Perché va implementata**:
- Compliance legale in vari paesi (Europa: EAA 2025).
- Lighthouse score basso → SEO penalty.
- Tastiera-only users esclusi.

**Plan**:
1. Audit con `axe-core` (browser ext) + Lighthouse a11y score.
2. `aria-label` su tutti i bottoni icon-only.
3. Charts: aggiungere `<title>` + `<desc>` + `role="img"`.
4. Color contrast check con `tailwindcss-accessibility-contrast` o manuale: testi `var(--app-text-muted)` ricalibrare se < 4.5:1.
5. `Tab` order check: focus visible su tutti gli elementi interattivi.
6. Skip-to-content link.

**Rischio se non fatto**: esclusione utenti disabili. In EU: rischio legale.

---

### ☐ #24 — Loading states inconsistenti

**Costo stimato**: 1 giorno.
**Stato attuale**: convivono 3 pattern:
- Skeleton animato (`<div className="bg-white/5 animate-pulse" />`)
- Spinner (`<Loader2 className="animate-spin" />`)
- Niente / placeholder `—`

**Perché va implementata**:
- Visivo inconsistente percepito come "pasticciato".
- Skeleton + spinner sulla stessa pagina è confuso.

**Plan**:
1. Convention: **skeleton sempre** per loading dati. **Spinner** solo per azioni utente (es. "Sincronizzando...").
2. Estrarre `<Skeleton />` component shared.
3. Sostituire 30+ pattern con `<Skeleton />` o `<ActionSpinner />`.
4. Linting (eslint custom): warning su `animate-pulse` o `animate-spin` raw nel JSX.

**Rischio se non fatto**: percepibile come MVP non finito.

---

### ☐ #13 — DRIFT_START_KM hardcoded

**Costo stimato**: 30 min.
**Stato attuale**: `DRIFT_START_KM = '8'` constant in `src/components/CardiacDrift.tsx` come fallback per chart.

**Perché va implementata**:
- Magic number visibile in chart UI.
- Andrebbe derivata dalla run reale (es. stabilizzazione HR a metà corsa).

**Plan**:
- Calcolare `driftStart` come 50% della corsa o min(8, distance / 2).
- Fallback a 8 solo se la corsa è < 16km e non c'è altro segnale.

---

## ⚪ P3 — Nice-to-have / informativo

### ☐ #18 — Dependency drift audit

**Costo stimato**: 0 (informativo) / 4-8 ore (pin manuale + test).
**Stato attuale**: React 19 + react-router 7 + motion 12 + tailwind v4 — bleeding edge ma dichiarato in package.json. `engines` field assente.

**Cosa fare** (opzionale):
- Aggiungere `"engines": { "node": ">=20", "npm": ">=10" }` in package.json.
- Audit manuale: per ogni dep major (vite 6, react 19, tailwind 4) verificare se versione "stable enough" o RC.
- Renovate / Dependabot config per PR automatici di aggiornamento.

**Note**: stack scelto consciously bleeding-edge dal proprietario. Non fix per default.

---

## Riepilogo costi per priorità (post round 5)

| Priorità | Punti | Stima residua |
|---|---|---|
| 🔴 P0 (4 punti) | #1 (1-2w), #3 parziale (1.5w), #14 parziale (1.5d), #15 parziale (2d) | ~3-4 settimane |
| 🟠 P1 (3 punti) | #6 ext (2-3d), #16 (2w), #21 parziale (0.5-1d) | ~2-3 settimane |
| 🟡 P2 (5 punti) | #12, #13 (30min), #22, #23, #24 | ~2-3 settimane |
| ⚪ P3 (1 punto) | #18 | < 1 giorno |
| ✅ DONE round 5 | #17 SSE | – |
| **Totale residuo** | **11 punti** | **~7-10 settimane** (era 10-13) |

---

## Suggerimento ordine d'attacco

**Sprint 1 (2 settimane)**: #1 Auth + setup pytest backend smoke test (necessario per #15).
**Sprint 2 (1 settimana)**: #14 DashboardView split + #13 DRIFT_START_KM.
**Sprint 3 (1 settimana)**: #15 server.py split (con i test del Sprint 1).
**Sprint 4 (2 settimane)**: #16 + #17 sync queue + SSE.
**Sprint 5 (1 settimana)**: #21 i18n complete.
**Sprint 6 (1 settimana)**: #6 onboarding extended + #24 loading states.
**Sprint 7 (1 settimana)**: #22 mobile.
**Sprint 8 (1 settimana)**: #23 a11y full audit + fix.
**Sprint 9 (~2 settimane)**: #3 math heavy → backend (uno alla volta).
**Sprint 10**: #12 V2/V3/V4/V5 cleanup (con product owner).

Ordine ottimizzato per:
- **#1 first** = sblocca tutto il resto del lavoro multi-utente.
- **Test backend prima di #15** = de-risk refactor.
- **#16+#17 insieme** = la queue ha senso solo con notification UI.
- **#3 in fondo** = beneficia di backend già splittato (#15).
