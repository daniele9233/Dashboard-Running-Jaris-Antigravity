# MISSING PIECES — checklist finale post round 8

Stato al **2026-04-30** dopo 8 round di fix.

> 🔗 Ultima commit live: [`6351fc9`](https://github.com/daniele9233/Dashboard-Running-Jaris-Antigravity/commit/6351fc9)
> 🌐 Backend live: https://dani-backend-ea0s.onrender.com — `version: 6351fc9` ✓
> 🌐 Frontend live: https://dani-frontend-y63x.onrender.com — last build 30 Apr 07:12 ✓
> 🛡️ CI gate attivo: `pytest backend/test_smoke.py` 6/6 BLOCKING su PR
> 📊 DashboardView: 1775→1041 (-41%) — 4 widget extracted
> 📦 server.py: 9/55 endpoint estratti in routers/

---

## ✅ Cosa è stato fatto (round 1-5)

### Round 1 — UI dead-code & dup math (3 fix)
- [x] CardiacDrift: rimossa terza copia `computeDrift` divergente → util canonico
- [x] AnalyticsV2: rimossi 3 blocchi dead code (pmcV2, paceTrendV2, driftV2 con `Math.random()`)
- [x] App.tsx + Sidebar: rimosse icone fake (Settings dup, Bell badge statico)

### Round 2 — Architecture (4 fix)
- [x] `useApi` global cache layer + dedup in-flight + subscribe pattern
- [x] Sidebar/TopBar nav dedup (TopBar = single source of truth)
- [x] Empty-state audit dei widget chart/map
- [x] DashboardView math estratto a `utils/{paceFormat,racePredictions,cardiacDrift}` (1885→1764 righe)

### Round 3 — Security & Dev Experience (8 fix)
- [x] **#27** CORS env-driven `ALLOWED_ORIGINS` whitelist (no `*`)
- [x] **#28** Rate limiting via `slowapi` (graceful no-op se non installato)
- [x] **#29** Audit secrets — `.env*` correttamente in `.gitignore`, solo `.env.example` committato
- [x] **#30** NoSQL injection audit — zero `$where`/`$regex` user-input
- [x] **#31** Nuovo README.md esecutivo (5-min onboarding) + ROADMAP.md split
- [x] **#32** Doc index canonico (PRD/REPORT/ROADMAP/MEMORY)
- [x] **#33** ESLint flat config v9 + react-hooks + react-refresh
- [x] **#34** Prettier config + `.prettierignore`
- [x] **#35** Bundle analyzer + manualChunks vendor + React.lazy 8 routes

### Round 4 — Production-readiness (12 fix)
- [x] **#2** Fix 2 TS errors pre-esistenti (RunnerDnaView, EnvironmentalNormalizerView)
- [x] **#4** Vitest setup + 18 test verdi (paceFormat, racePredictions)
- [x] **#5** GitHub Actions CI (frontend + backend)
- [x] **#6** FirstRunOnboarding gate (CTA Strava/Garmin se runs vuoti)
- [x] **#7** WidgetBoundary granulare (crash widget non abbatte dashboard)
- [x] **#8** Telemetry stub (`utils/telemetry.ts`, Sentry-ready)
- [x] **#9** Cache localStorage persist + SWR + cross-tab sync
- [x] **#10** + **#11** Rimossi Sidebar bottom + TopBar Search/Bell disabled
- [x] **#20** Cross-tab `storage` event in Theme + Layout + cache
- [x] **#25** Avatar dinamico da `profile.name`
- [x] **#26** JarvisOverlay `lazy()` on enable
- [x] Eliminati tutti i badge tranne **Passerotto** (BadgesGrid 1582 → 110 righe)

### Round 5 — Architecture patterns (5 fix parziali + 1 done)
- [x] **#17 DONE** SSE event bus + `useServerEvents` hook + auto-cache-invalidate
- [x] **#21 PATTERN** i18n: 4 namespace nuovi (IT+EN), FirstRunOnboarding + ErrorBoundary
- [x] **#14 PATTERN** DashboardView -560 righe (3 widget extracted in `dashboard/widgets/`)
- [x] **#15 PATTERN** server.py: router `health` extracted + `deps.py` per DI
- [x] **#3 PATTERN** thresholdPace migrato client → backend (`paces.threshold_empirical`)

### Round 6 — Polish + a11y + mobile + scaffolds (10 fix)
- [x] **#13 DONE** DRIFT_START_KM derivato da corsa reale (half-clamp [4,8])
- [x] **#18 DONE** `engines: { node>=20, npm>=10 }` + name fix `metic-lab`
- [x] **#12 PARTIAL** Audit V2/V3/V4/V5 (nessuna è "alternativa", sono sezioni distinte). `StatsRisk.tsx` dead code eliminato (-216 righe).
- [x] **#23 PATTERN** a11y: `role="img"` + `<title>` + `<desc>` + `aria-label` su 3 widget chart
- [x] **#24 PATTERN** `Skeleton` component shared (variant block/text/card/circle + aria-busy)
- [x] **#22 DONE** Mobile: Sidebar drawer pattern <768px (hamburger + backdrop + ESC), TopBar overflow-x-scroll, logo hidden mobile
- [x] **#6 ext PATTERN** VO2MaxChart empty state migliorato (spiega perché + quante corse servono)
- [x] **#3 PARTIAL** `bestPbTime` rimosso (dead code), DashboardView -16 righe
- [x] **#14 PARTIAL** `InfoTooltip` extracted (-44 righe). DashboardView 1775 → 1155 (-35% cumulato round 5+6)
- [x] **#16 SCAFFOLD** `backend/worker.py` stub + plan completo arq+Redis activation

### Round 7 — Production observability triad (3 fix)
- [x] **CI #1 DONE** Backend pytest smoke `backend/test_smoke.py` 6/6 verdi BLOCKING (catturerebbe il bug che ha rotto round 5 deploy 24h)
- [x] **Sentry #2 DONE** `@sentry/react` installato + telemetry.ts riscritto con Sentry.captureException + setUser + addBreadcrumb (DSN env-driven, no-op se assente)
- [x] **OPS #3 DONE** `OPS-SETUP.md` (250 righe) — guida click-only Render alerts + Sentry signup + UptimeRobot
- [x] **DEPLOY FIX** `from backend.X` import error con `rootDir: backend` Render → try/except layout-resilient
- [x] **CORS FIX** Frontend prod URL reale `dani-frontend-y63x` (Render generato suffix random) → whitelist updated. Da round 3 a round 7 il frontend prod chiamava backend BLOCCATO da CORS, vedeva solo cache stale

### Round 8 — P0 advancements (4 fix parziali)
- [x] **#14 PARTIAL** `WeeklyKmChart` extracted in `dashboard/widgets/`. Cumulato round 5+6+8: 1775→1041 (**-41%**). 4 widget estratti.
- [x] **#15 PATTERN++** 2 router nuovi: `routers/profile.py` (4 endpoint) + `routers/runs.py` (3 endpoint). Cumulato 9/55 (16%). Pattern Depends DI provato.
- [x] **#3 PARTIAL** `injuryRisk` verificato già backend (POST /api/training-plan/adapt → ACWR model). `detraining` (371 righe TS): SKIP sprint dedicato.
- [x] **#1 SCAFFOLD** `backend/auth.py` (135 righe — `AUTH_ENABLED` flag + `get_current_user_id` Depends + migration script). `src/context/AuthContext.tsx` (115 righe — AuthProvider + `useAuth` + `withAuthHeader` + Sentry user identification). 8-step activation path documentato. **NON attivo** — single-tenant invariato.

---

## ❌ Cosa MANCA (priorità) — post round 6

### 🔴 P0 — Bloccanti per prodotto commerciale (~3-4 settimane)

#### ☐ #1 Auth multi-tenant (1-2 settimane)

**Cosa**: trasformare single-tenant → SaaS multi-utente.

**Sub-tasks**:
- [ ] Scegliere provider: **Clerk** (managed, fast) / Supabase Auth / JWT custom
- [ ] Schema Mongo: aggiungere `user_id: str` a TUTTE le collection
  - [ ] `runs`, `garmin_csv_data`, `analytics_cache`, `runner_dna_cache`
  - [ ] `strava_tokens`, `training_plan`, `gct_analysis`, `user_layout`, `recovery_checkins`
- [ ] Backend middleware FastAPI auth → estrarre `user_id` da JWT/cookie
- [ ] Helper `_user_scope()` filtering automatico in tutti gli endpoint
- [ ] Migration script: assegnare record esistenti a `user_id="legacy"`
- [ ] Frontend: `<AuthProvider>`, `LoginPage`, redirect logic, hook `useAuth()`
- [ ] Strava OAuth: associare token a user attivo

**Why bloccante**: senza auth, NON si può vendere come SaaS. Secondo utente sovrascrive il primo.

---

#### ☐ #3 Math heavy → backend (~1.5 settimane residue)

**Cosa**: 5 moduli math ancora client-side, browser scarsi freezano.

**Pattern già stabilito** (round 5: `thresholdPace`). Da migrare:

- [ ] **`runnerDnaModel.ts`** (~700 righe) → `GET /api/dna/scores` (5 giorni)
- [ ] **`detrainingModel.ts`** (~250 righe) → `GET /api/detraining/projection` (3 giorni)
- [ ] **`injuryRisk` ACWR** (~60 righe) → `GET /api/injury-risk` (1 giorno)
- [ ] **`bestPbTime` projector** (~15 righe DashboardView) → `GET /api/best-pb-times` (4 ore)
- [ ] Test backend per parità (Python pytest con dataset noto)

---

#### ☐ #14 DashboardView split (~1-1.5 giorni residue)

**Cosa**: god component a 1155 righe (era 1775, -620 cumulati round 5+6). Pattern stabilito.

**Da estrarre** (in `src/components/dashboard/widgets/`):
- [ ] `bestPbTime` helper + `timeUntil` helper
- [ ] Race-prediction grid (~200 righe)
- [ ] Status of Form gauge (~150 righe)
- [ ] Weekly KM card (~100 righe)
- [ ] Adaptation summary (~80 righe)
- [ ] Session logs table (~100 righe)

**Target**: DashboardView < 500 righe (orchestrazione + grid).

---

#### ☐ #15 server.py split (~2 giorni residue)

**Cosa**: 7521 righe, 53/55 endpoint da migrare a `backend/routers/`.

**Pattern stabilito** (round 5: `routers/health.py` + `deps.py`).

- [ ] `routers/strava.py` — auth-url, callback, exchange-code, sync (4 endpoint)
- [ ] `routers/garmin.py` — login, sync, csv-import, csv-link (8 endpoint)
- [ ] `routers/profile.py` — get/patch profile, get/put layout (4 endpoint)
- [ ] `routers/runs.py` — list, get, splits (3 endpoint)
- [ ] `routers/training.py` — plan, current, complete, generate, evaluate, adapt (6)
- [ ] `routers/analytics.py` — dashboard, vdot, best-efforts, heatmap (5+)
- [ ] `routers/ai.py` — analyze-run, jarvis-chat (2)
- [ ] `routers/admin.py` — runner-dna cache, backfill (3)

**Pre-requisito**: aggiungere pytest backend smoke test PRIMA del refactor.

**Target**: server.py < 300 righe.

---

### 🟠 P1 — Importanti (~2-3 settimane)

#### ☐ #16 Sync queue background (Celery / RQ / arq) — 2 settimane

**Stato post round 6**: scaffold + plan creato in `backend/worker.py`. Provider scelto = arq.

- [x] Stub `backend/worker.py` con 3 task placeholder + WorkerSettings commentato
- [ ] Aggiungere Redis su Render (addon o Upstash free)
- [ ] `pip install arq` + decommentare WorkerSettings
- [ ] Creare `routers/sync.py` con `enqueue` + `status` endpoint
- [ ] Sostituire chiamate inline con enqueue
- [ ] Avviare worker process (Render second service)
- [ ] Frontend `useSyncStatus(taskId)` hook + toast progress

**Why**: Strava OAuth callback timeout su utenti con storia >1000 corse.

---

#### ☐ #6 ext Onboarding flow esteso (2-3 giorni)

- [ ] Tutorial guidato post-prima-corsa con highlights "Eccoti il tuo VDOT, …"
- [ ] Profile completion graduale (FC max / soglia / peso)
- [ ] Empty states migliori sui widget (es. VO2MaxChart con 1 sola corsa)

---

#### ☐ #21 i18n completare (~0.5-1 giorno residuo)

**Pattern stabilito round 5**. ~150 stringhe IT hardcoded restano:

- [ ] DashboardView (~30 stringhe)
- [ ] StatisticsView (~25 stringhe)
- [ ] ProfileView (~20 stringhe)
- [ ] AnaerobicThreshold, CardiacDrift, RecentActivities (~15 ciascuno)
- [ ] BadgesGrid, RankingView, RunnerDnaView (~10 ciascuno)
- [ ] ESLint custom rule per bloccare nuove hardcoded
- [ ] Audit grep `grep -rE 'text-\w+"\s*>\s*[A-Z][a-z]'`

---

### 🟡 P2 — Polish (~1-2 settimane residue)

#### ✅ #12 V2/V3/V4/V5 audit — DONE round 6 (parziale)

Audit completato: nessuna è "versione alternativa" — sono sezioni distinte
di StatisticsView. `StatsRisk.tsx` dead code eliminato (-216 righe). Nessuna
ulteriore eliminazione possibile senza decisione prodotto su rinaming.

#### ✅ #13 DRIFT_START_KM — DONE round 6

Derivato da `Math.max(4, Math.min(8, Math.round(distance/2)))`. Magic number
`'8'` rimosso.

#### ✅ #22 Mobile responsive — DONE round 6 (base)

- [x] Sidebar drawer < 768px (hamburger + backdrop + ESC)
- [x] TopBar overflow-x-scroll + logo hidden mobile
- [ ] Test fisico 375px (iPhone SE) + 414px → DA FARE manualmente
- [ ] Charts forzare height fissa < 250px su mobile

#### ☐ #23 a11y residuo (~3-4 giorni)

**Round 6 fatto**: 3 widget con `role="img"` + `<title>` + `<desc>`. Avatar `aria-label`. Hamburger menu `aria-label`. Tooltip `role="tooltip"`. InfoTooltip `aria-label`. Sidebar `role="dialog"`.

- [ ] Estendere `role="img"` agli altri 8+ chart SVG (VO2MaxChart, MainChart, FitnessFreshness, CardiacDrift, AnaerobicThreshold, BadgesGrid donut, ecc.)
- [ ] Audit con `axe-core` + Lighthouse a11y score
- [ ] Color contrast: testi `var(--app-text-muted)` ricalibrare se < 4.5:1
- [ ] Tab order check + focus visible
- [ ] Skip-to-content link

#### ☐ #24 Loading states — Skeleton creato, da diffondere (~0.5 giorno)

**Round 6**: `<Skeleton variant="block|text|card|circle" />` componente creato.

- [ ] Sostituire 30+ pattern raw `animate-pulse` / `animate-spin` con `<Skeleton />`
- [ ] Creare `<ActionSpinner />` per azioni utente
- [ ] ESLint warning custom su raw `animate-(pulse|spin)`

---

### ✅ P3 — Nice-to-have — DONE round 6

#### ✅ #18 engines + name fix — DONE

`"engines": { "node": ">=20", "npm": ">=10" }` aggiunto. Renamed `react-example` → `metic-lab`.

- [ ] Audit per ogni major dep (vite 6, react 19, tailwind 4) — opzionale
- [ ] Renovate / Dependabot config — opzionale

---

## 🔁 Round 5 TODO residui minori

### #17 SSE — completamento minore
- [ ] Hook `publish_event` su Garmin sync (oggi solo Strava + adapt)
- [ ] Toast UI component per visualizzare `sync_complete` etc.
  - Manca toast component nel codebase — creare `src/components/Toast.tsx`

### #21 i18n — ESLint rule custom
- [ ] Custom rule che warna su stringa hardcoded ≥ 5 chars dentro JSX text node

---

## 📊 Costi finali — post round 6

| Priorità | Punti aperti | Stima residua |
|---|---|---|
| 🔴 P0 | #1 (1-2w), #3 parziale (1.5w), #14 parziale (1d), #15 parziale (2d) | ~3-4 settimane |
| 🟠 P1 | #16 (2w worker activation), #6 ext widgets (1d), #21 parziale (0.5-1d) | ~2 settimane |
| 🟡 P2 | #23 residuo (3-4d), #24 diffusione (0.5d), #22 mobile testing (0.5d) | ~1 settimana |
| ✅ DONE round 5+6 | #17 SSE, #13 DRIFT, #18 engines, #12 audit, #22 base, #6 base, #14 partial, #15 partial, #3 partial, #16 scaffold, #23 base, #24 base | – |
| **Totale residuo** | **7 punti** (P0 + P1 + a11y/loading polish) | **~6-7 settimane** (era 7-10 pre-round 6) |

---

## 🚀 Deploy status (post-push `b749d00`)

| Componente | Stato | URL |
|---|---|---|
| GitHub `main` | ✅ pushed | `https://github.com/daniele9233/Dashboard-Running-Jaris-Antigravity/commit/b749d00` |
| Backend Render | 🟡 building | https://dani-backend-ea0s.onrender.com |
| Frontend Render | 🟡 building | https://dani-frontend-y63x.onrender.com |
| GitHub Actions CI | 🟡 first run | `.github/workflows/ci.yml` |

**Auto-deploy**: Render rileva push su `main` e ricrea entrambi i servizi.
Tempo stimato free tier: ~3-5 min backend (`pip install`), ~2-3 min frontend
(`npm install && npm run build`).

**Verifica deploy completato** (esegui dopo qualche minuto):

```bash
curl https://dani-backend-ea0s.onrender.com/api/version
# Quando il deploy nuovo è live, vedrai:
#   - "version": "<sha b749d00...>" (oggi diverso da 4a9b806...)
#   - presence di "timestamp" field (aggiunto in routers/health.py round 5)
```

**Endpoint nuovi disponibili dopo deploy**:
- `GET /api/events/stream` — SSE per live notifications (#17)
- `GET /api/vdot/paces` ora restituisce anche `paces.threshold_empirical` (#3)

---

## 📚 Documenti correlati

| File | Scopo |
|---|---|
| [`README.md`](./README.md) | Quick start 5 min, comandi, env-var |
| [`PRD.md`](./PRD.md) | Product requirements |
| [`REPORT-TECNICO.md`](./REPORT-TECNICO.md) | Architettura tecnica + 5 round CHANGELOG |
| [`ROADMAP.md`](./ROADMAP.md) | Roadmap product |
| [`CHECKLIST-PENDING.md`](./CHECKLIST-PENDING.md) | Audit originale 35 punti, dettagliato |
| **`MISSING-PIECES.md`** (questo file) | Checklist finale post round 5 |
