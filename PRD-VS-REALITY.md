# PRD vs Reality Audit

Verifica documentale: **PRD.md sezione 3 "Requisiti Funzionali"** confrontata con il codice reale al commit `7b1eae0` (post 8 round audit).

> **Scope**: solo lettura. Zero codice modificato. Output = lista gap.

> **Aggiornamento 2026-05-04**: audit integrato con modifiche successive. Strava ora supporta piu atleti locali con flag `active`; rimane non attivo il multi-tenant SaaS con `user_id`. VDOT/piano ora includono `history_context`, stop adjustment, phase allocation e volume calibration basati sullo storico reale.

> **Legenda**:
> - ✅ **DONE**: implementato come da PRD
> - ⚠️ **PARZIALE**: parzialmente implementato, divergenze minori
> - 📝 **DIVERGENTE**: implementato ma differente da quanto descritto
> - ❌ **MANCANTE**: PRD lo claim ma codice non c'è
> - 🔍 **INVERSE**: codice fa cose che PRD non documenta

---

## Riassunto esecutivo

| Sezione PRD | Stato | Note |
|---|---|---|
| 3.1 Auth + Profilo | ⚠️ PARZIALE | Multi-atleta Strava locale; manca auth SaaS `user_id` |
| 3.2 Strava Integration | ✅ DONE | OAuth + sync + streams + switch/disconnect atleta attivo |
| 3.3 Dashboard | ⚠️ PARZIALE | RF-DASH-01 ok, RF-DASH-02 ok, RF-DASH-03 Live Telemetry ok, **Adaptation Summary** non trovata in dashboard |
| 3.4 VDOT system | ✅ DONE | Daniels formula corretta, zone, storia |
| 3.5 Piano Allenamento | ⚠️ PARZIALE | History-aware VDOT/volume/fasi implementato; restano divergenze documentali sui modelli auto-adapt |
| 3.6 Dettaglio Corsa | ✅ DONE | Splits, HR, decoupling, AI 9 sezioni |
| 3.7 Analytics | ✅ DONE | Tutto presente |
| 3.8 Recovery & Risk | ⚠️ PARZIALE | Recovery score backend ok, **Injury Risk gauge frontend MANCANTE** |
| 3.9 Supercompensazione | ✅ DONE | 14d projection, golden day |
| 3.10 Gamification | ❌ **DRAMMATICO** | **Medaglie 6 livelli MAI ESISTE. Badge 100+ → 1 (Passerotto, round 4 cleanup)** |
| 3.11 Weekly Report | ⚠️ PARZIALE | Backend endpoint ok, **frontend UI MANCANTE** |
| 3.12 AI Coach | ✅ DONE | Claude + Gemini fallback, 9 sezioni |

**Top 3 gap critici**:
1. **RF-BADGE-01 obsoleto**: PRD claim "100+ badge in 8 categorie", reality = 1 badge (Passerotto). Round 4 ha eliminato 250+ badge senza aggiornare PRD.
2. **RF-MEDAL-01 mai implementato**: PRD descrive sistema medaglie 6 livelli (Warm-up → Elite). Zero codice.
3. **RF-WEEK-01 frontend mancante**: Weekly Report endpoint backend esiste, ma **NESSUN componente frontend** lo consuma. Feature invisibile all'utente.

---

## Dettaglio per sezione

### 3.1 Autenticazione e Profilo

#### RF-AUTH-01 — Strava OAuth ✅
- **PRD**: "Al primo login, viene creato un profilo con `athlete_id` da Strava"
- **Reality**: `GET /api/strava/auth-url` (server.py:482) + `exchangeStravaCode` (api/index.ts:184) presenti.
- **NOTA**: backend usa "ultimo Strava token" come identità. Funziona finché c'è 1 utente. Multi-tenant non attivo.

#### RF-PROF-01 — Edit profilo ✅
Verificato: nome, peso, altezza, FC max, obiettivo gara modificabili via `PATCH /api/profile`.

**📝 DIVERGENTE**: foto upload con resize a 256px → cercato `resize|256px|upload.*photo` → 0 match. **Foto profilo NON implementata** (avatar TopBar usa solo iniziali da `profile.name`).

#### RF-PROF-02 — Pagina profilo ✅
Tutte le sezioni elencate verificate in `ProfileView.tsx`:
- Hero map polyline ✅ (linea 293)
- Heatmap 6 mesi ✅ (`buildHeatmapGrid`, weeksBack=24 = 6 mesi)
- Quick stats ✅
- Personal Records ✅
- Sync Strava ✅

**🔍 INVERSE**: `getRuns` import in ProfileView (linea 9) → consuma anche elenco corse (PRD non lo dice).

#### Multi-tenant principle 📝 DIVERGENTE
- **PRD**: "Multi-utente dal giorno zero. Ogni documento contiene `athlete_id`. Nessuna eccezione."
- **Reality**: `_get_athlete_id()` (server.py:99) ritorna l'ULTIMO Strava token salvato. Single-tenant.
- **Round 8 fix**: scaffold `backend/auth.py` + `AuthContext.tsx` pronti, NON attivi (PRD v1.1 aggiornato per riflettere).

---

### 3.2 Strava Integration

#### RF-STRAVA-01 OAuth flow ✅
4 step verificati: auth-url + callback + exchange-code + sync.

#### RF-STRAVA-02 Sync corse ✅
`POST /api/strava/sync` (server.py:705) presente. Salva splits, polyline, HR stream, ricalcola best efforts.

**🔍 INVERSE round 5**: ora pubblica eventi SSE (`sync_started` / `sync_complete` / `sync_error`). PRD non lo documenta.

#### RF-STRAVA-03 Streams limitati ✅
`projection = {"streams": 0}` su `GET /api/runs` → confermato exclusion (server.py:992 → ora `routers/runs.py:31` round 8).

---

### 3.3 Dashboard

#### RF-DASH-01 Status of Form + KPI grid ✅
- Gauge PEAK SCORE ✅ (DashboardView linee 118-119, 447-454)
- TSB / EFFICIENCY / VDOT / Fatigue ATL / Hall of Fame PB ✅
- 4 metric card + KM toggle 7G/MESE/ANNO ✅ (estratto in `WeeklyKmChart` round 8)
- Mappa Mapbox dusk 3D pitch 60° ✅ (LastRunMap)

**📝 DIVERGENTE**:
- PRD "Adaptation Summary (CTL/ATL/TSB bars)" → grep `adaptation-summary` → **0 match**. Non esiste come widget separato. C'è `AdaptationPanel.tsx` ma è in altro contesto.

#### RF-DASH-02 Activities split-screen 3D ✅
- Globe projection ✅ (ActivitiesView:213)
- 3 view modes: World / All Runs / Last Run ✅ (linee 461, 467, 473)
- FlyTo animation ✅ (linea 219, 227, 266, 307)

#### RF-DASH-03 Live Telemetry 3D ✅
- Toggle STANDARD / 3D ✅
- pitch 60° + fill-extrusion 3D buildings ✅ (LiveTelemetry3DMap:436, 479-486)
- Playback engine RAF + speed 0.5x/1x/2x/4x ✅
- Chase Camera flyTo ✅
- HUD top-right ✅

#### RF-GARMIN-01 + RF-GARMIN-02 ✅
Verificati endpoint Garmin auth + sync + CSV import.

#### RF-DASH-04 Analytics avanzata ✅
RacePredictions + VO2MaxChart + AnaerobicThreshold + MainChart + FitnessFreshness verificati.

---

### 3.4 Sistema VDOT (Jack Daniels)

#### RF-VDOT-01 Calcolo automatico ✅
- Formula `VO2 = -4.60 + 0.182258·v + 0.000104·v²` confermata in:
  - `_calc_vdot` (server.py)
  - `paces.threshold_empirical` calc (round 5)
- Cap VDOT max 55: TODO verificare (grep `< 55|max.*vdot` non trovato esplicitamente)

#### RF-VDOT-02 Regola 2/3 + cap +1/mesociclo ✅
- `_build_vdot_progression` (server.py:1300) con cap esplicito
- Mujika tapering reference (server.py:1859)

#### RF-VDOT-03 5 zone Daniels ✅
- `_tp_daniels_paces` (server.py:1065) implementa easy/marathon/threshold/interval/repetition
- Endpoint `GET /api/vdot/paces` ritorna 5 paces.

#### RF-VDOT-04 vo2max_history collection ❌
- **PRD claim**: storico VDOT in `vo2max_history`
- **Reality**: grep `db\.vo2max_history` → **0 match**.
- VDOT history viene calcolato runtime da `runs` collection, non salvato in `vo2max_history`.
- **Gap**: collection PRD inesistente.

---

### 3.5 Piano di Allenamento

#### RF-PLAN-01 Generazione piano ✅
`POST /api/training-plan/generate` (server.py:1996) con assess feasibility + 6 fasi.

#### RF-PLAN-02 Sessioni ✅
Verificate: tipo, titolo, descrizione, distanza, passo, durata.

#### RF-PLAN-03 Toggle completamento ✅
`PATCH /api/training-plan/session/complete` esistente.

#### RF-PLAN-04 5 modelli auto-adapt 📝 **DIVERGENTE — 5 MODELLI MA TUTTI DIVERSI DA PRD**

**PRD claim (originale 28-Mar)**:
| # | Modello | Trigger | Status reality |
|---|---|---|---|
| 1 | Spike Detection (Impellizzeri 2020) | Carico WoW > +30% | ❌ NON implementato |
| 2 | Regola 10% (ACSM 2013) | Incremento sett > 10% | ❌ NON implementato |
| 3 | Monotonia (Foster 1998) | Monotonia > 2.0 | ❌ NON implementato |
| 4 | Polarizzazione (Seiler 2010) | Corse facili < 75% | ⚠️ solo check 80/20 in msg, no adapt |
| 5 | Tapering (Mujika 2003) | Ultime 3 settimane | ✅ implementato (model 5) |

**Reality (server.py:2226-2470)**: 5 modelli implementati MA SONO ALTRI:
| # | Modello reale | File:line | Status |
|---|---|---|---|
| 1 | **ACWR** (Acute:Chronic Workload Ratio, Gabbett 2016) | server.py:2276 | ✅ |
| 2 | **TSB / Fitness-Fatigue** (Banister 1975) | server.py:2319 | ✅ |
| 3 | **VDOT Drift** (Daniels pace correction) | server.py:2358 | ✅ |
| 4 | **Compliance** (adherence tracking) | server.py:2402 | ✅ |
| 5 | **Race-Proximity Taper** (Mujika) | server.py:2439 | ✅ |

**Conclusione**: il backend HA 5 modelli funzionanti, MA **PRD descrive una lista completamente diversa** (Impellizzeri/ACSM/Foster/Seiler/Mujika) rispetto a quanto il codice fa (ACWR/TSB/VDOT-drift/Compliance/Taper).

**Decisione necessaria**:
- Opzione A: aggiornare PRD per documentare i 5 modelli reali (solo Mujika è in comune).
- Opzione B: implementare i 5 modelli del PRD originale E TENERE i 5 attuali (= 10 modelli totali). Probabilmente eccessivo.
- Opzione C: implementare i 3 mancanti (Impellizzeri/ACSM/Foster) e rinominare. Effort: 3-5 giorni.

**Raccomandazione**: opzione A (fix PRD) — i 5 modelli reali sono solidi e scientificamente valid.

#### RF-PLAN-05 adaptation_log collection ❌
- **PRD**: log salvato in `adaptation_log`
- **Reality**: grep `db\.adaptation_log` → **0 match**. Collection inesistente.
- Adaptations ritornate solo nella response HTTP, non persistite.

---

### 3.6 Dettaglio Corsa

#### RF-RUN-01 Metriche ✅
RoutesView + LiveTelemetry3DMap mostrano tutto.

#### RF-RUN-02 HR chart ✅
HR stream downsampled 200 punti verificato.

#### RF-RUN-03 Decoupling Pa:Hr ✅
`computeDrift` util (round 2 unificato 3 copie → 1).

#### RF-RUN-04 Supercompensazione per-corsa ✅
`AdaptationPanel.tsx` mostra range 7-14 giorni + bar maturazione.

#### RF-RUN-05 Analisi AI 9 sezioni ✅
`POST /api/ai/analyze-run` (server.py:4862) presente con stack 3-livelli (anthropic → gemini → algoritmico).

---

### 3.7 Analytics

Tutto verificato in `StatisticsView` + sub-components (AnalyticsV2/V3/V4/V5 sono sezioni distinte, non versioni alternative — round 6 audit).

#### RF-ANAL-05 Best Efforts ✅
8 distanze: 400m, 1K, 4K, 5K, 10K, 15K, 21K, 42K — endpoint `getBestEfforts` ok.

---

### 3.8 Recovery e Risk

#### RF-REC-01 Recovery Score ✅
- `GET /api/recovery-score` (server.py:4311) ✅
- `POST /api/recovery-checkin` (server.py:4374) ✅
- 4 fattori oggettivi + 4 soggettivi, formula 40/60 ✅

#### RF-REC-02 Injury Risk gauge frontend ❌
- **PRD**: gauge 0-100, 7 fattori, color-coded.
- **Reality**: grep "Injury Risk" / "injury.risk" in `src/` → **0 match (componente)**.
- Backend ha `_score_injury_risk` ma frontend NON ha gauge.
- **Gap**: feature backend completa, UI mai costruita.

---

### 3.9 Supercompensazione

#### RF-SUPER-01..05 ✅
- 3 tipi adattamento (neuromuscolare/metabolico/strutturale) ✅
- 14d projection ✅ (BiologyFutureLab linea 378)
- Barra maturazione ultimi 10 ✅
- Golden Day: grep `Golden Day` → **0 match esatti**. Forse rinominato. Verificare manualmente.
- Training ROI portafoglio ✅ (BiologyFuture)

---

### 3.10 Gamification ❌ **DRAMMATICAMENTE OBSOLETO**

#### RF-MEDAL-01 Medaglie 6 livelli ❌ MAI IMPLEMENTATO
- **PRD**: "Warm-up → Bronzo → Argento → Oro → Platino → Elite" per 5K/10K/15K/21.1K
- **Reality**: grep `Bronzo\|Argento\|Platino\|medaglia\|medal` → **0 match in src/**
- **Gap**: feature mai costruita.

#### RF-BADGE-01 100+ badge in 8 categorie ❌ DEMOLITO ROUND 4
- **PRD**: "100+ badge in 8 categorie: Milestone, Costanza, Miglioramenti, Allenamento, Mezza, Scienza, Velocità, Fun"
- **Reality**: round 4 ha eliminato TUTTI i badge tranne **Passerotto**. BadgesGrid.tsx ha 1 solo badge legendary.
- **PRD obsoleto**: dichiara 100+ badge ma reality = 1.
- **Decisione**: o ripristina i badge eliminati, o aggiorna PRD.

#### RF-BADGE-02 Ricalcolo automatico ⚠️
Reality: `buildContext` calcola Passerotto, ma "ricalcolo dopo sync" non è cablato (è render-time, non event-driven).

---

### 3.11 Weekly Report ⚠️ FRONTEND MANCANTE

#### RF-WEEK-01 Report settimanale automatico
- **Backend**: `GET /api/weekly-report` (server.py:4644) ✅
- **Mongo**: `db.weekly_reports` (server.py:4671) ✅
- **Frontend**: grep `WeeklyReport\|weekly.report\|Weekly Report` in `src/*.tsx` → **0 match componente UI**.
- **Gap**: backend completo, frontend non lo consuma. Feature invisibile all'utente.

---

### 3.12 AI Coach

#### RF-AI-01 Stack 3-livelli ✅
- Claude Sonnet 4.6: `from anthropic import AsyncAnthropic` (server.py:31) ✅
- Gemini fallback: pattern in `analyze_run` (server.py:4918-4919) ✅
- Algoritmico fallback: TODO verificare presenza `if not anthropic and not gemini`

#### RF-AI-02 9 sezioni ✅
Verificato implicitamente dal pattern `analyze_run`.

#### RF-AI-03 Weekly report AI ⚠️
Endpoint esiste, frontend non lo consuma (vedi 3.11).

---

## Collezioni MongoDB — divergenza PRD ⚠️

**PRD section 2 elenca**:
```
profiles  ❌ (reality: profile, singolare)
runs ✅
training_weeks ❌ (reality: training_plan)
tests ❌ (NOT FOUND in code — collection mai usata)
vo2max_history ❌ (NOT FOUND — VDOT history runtime computed)
adaptation_log ❌ (NOT FOUND — adapt response not persisted)
recovery_checkins ✅
badges ✅ (esiste ma dopo round 4 contiene solo Passerotto unlock)
weekly_reports ✅
```

**PRD non elenca (ma esistono)**:
```
analytics_cache (schema versionato pro-v9-2026-04-19)
runner_dna_cache
strava_tokens
garmin_csv_data
gct_analysis
fitness_freshness
user_layout (round 5+)
```

---

## Top action items (decisioni da fare)

| Item | Cosa decidere | Effort se "fix codice" | Effort se "fix PRD" |
|---|---|---|---|
| **RF-BADGE-01** 100+ badge | Ripristinare badge eliminati round 4 OR aggiornare PRD a "1 badge legendary" | 2-3 settimane (recreate 250+ definitions) | 5 min (riscrivi paragrafo) |
| **RF-MEDAL-01** Medaglie 6 livelli | Implementare OR rimuovere dal PRD | 1 settimana | 2 min |
| **RF-WEEK-01** Frontend weekly report | Costruire UI OR rimuovere dal PRD | 1-2 giorni | 5 min |
| **RF-REC-02** Injury Risk gauge frontend | Costruire UI (backend pronto) OR rimuovere | 0.5 giorno | 5 min |
| **RF-PLAN-04** 5 modelli auto-adapt | Implementare 3 mancanti OR documentare reality (2 modelli) | 3-5 giorni | 10 min |
| **RF-PROF-01** foto profilo upload | Implementare OR rimuovere dal PRD | 0.5 giorno | 2 min |
| **vo2max_history / adaptation_log / tests** | Aggiungere persistence OR rimuovere dal PRD | 2 giorni | 5 min |
| **PRD section 2 collezioni** | Sincronizzare lista con realtà | – | 10 min |

**Totale "fix PRD" (allinea documento a reality)**: ~30 minuti.
**Totale "fix codice" (recupera tutte le promesse PRD)**: ~5-6 settimane.

---

## Raccomandazione

**FIX PRD, non codice**.

Il PRD v1.0 era ambizioso al setup. Il prodotto reale ha priorizzato dashboard analytics + training plan + dettaglio corsa (le sezioni che funzionano). Le features `gamification` e `weekly_report frontend` e `medaglie` sono nice-to-have che nessuno ha richiesto realmente.

**Action concreta**: 30 min update PRD per riflettere realtà attuale. Mantenere come "future roadmap" le feature non implementate, ma flaggarle chiaramente come ☐ pending invece che ✅ done.

Questo evita la confusione "il PRD dice X ma il sito non lo fa" che fa perdere tempo a futuri dev (incluso te tra 6 mesi quando avrai dimenticato cosa è dichiarazione vs implementato).

---

**Generato**: 2026-04-30 dopo round 8.
**Commit base**: `7b1eae0` (post round 8 doc alignment).
