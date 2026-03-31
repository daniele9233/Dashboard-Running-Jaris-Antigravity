# METIC LAB — Running Training Dashboard

Dashboard web completa per il monitoraggio e la pianificazione dell'allenamento running, con integrazione Strava e analisi scientifica basata su Jack Daniels VDOT.

Basata sulla logica scientifica dell'app [CORRALEJO 2026](https://github.com/daniele9233/CORRALEJO-2026), adattata per il web e scalata per N utenti.

---

## Checklist di Sviluppo

### ✅ COMPLETATO

#### Infrastruttura & Base
- [x] Strava OAuth 2.0 — connect, exchange code, refresh token automatico
- [x] Sync corse da Strava (paginato, con splits, streams, polyline)
- [x] Multi-utente base — `athlete_id` su tutti i documenti e query MongoDB
- [x] Memory fix Render — streams esclusi da endpoint lista `/runs`
- [x] `useApi` hook — gestione loading/error/refetch tipizzata

#### Dashboard (FASE 1.1)
- [x] TopStats — km settimana, avg pace mensile, elevation gain, % variazione
- [x] RecentActivities — ultime corse raggruppate per giorno, dati reali
- [x] MainChart — volume 12 settimane stacked per tipo (easy/tempo/intervals/long)
- [x] AnaerobicThreshold — stima soglia da corse threshold/tempo, grafico SVG
- [x] FitnessFreshness — CTL/ATL/TSB Banister reali dal backend
- [x] Tooltip hover su tutti i grafici, selettore periodo (1S/4S/8S/12S/6M/1A/Tutto)
- [x] Click corsa → navigazione a pagina mappa dettaglio

#### Profile
- [x] Hero Map — MapLibre con polyline ultima corsa
- [x] Foto upload — canvas resize → base64 → MongoDB
- [x] Running Consistency heatmap GitHub-style (6 mesi, dati reali)
- [x] Progressione del Passo — grafico SVG, tooltip hover, distribuzione distanze
- [x] Training Zones — 5 zone HR con dati reali
- [x] Regola 80/20 — periodi 7/14 giorni, bottoni funzionanti
- [x] Personal Records — click naviga alla corsa su Strava
- [x] Best Efforts — splits-based per 1K/4K/5K/10K/15K/21K/42K, filtro GPS glitch

#### Fitness & Freshness (FASE 2.1)
- [x] TRIMP Lucia scientifico — `duration × hr_reserve × (0.64 × e^(1.92 × hr_reserve))`
- [x] CTL (EMA 42gg), ATL (EMA 7gg), TSB = CTL − ATL
- [x] Classificazione TSB: Fresco / Neutro / Affaticato / Sovrallenamento
- [x] Ricalcolo automatico ad ogni sync Strava
- [x] Grafico SVG custom interattivo con tooltip

#### VDOT Dinamico (FASE 1.2)
- [x] Formula Daniels: `VO2 = -4.60 + 0.182258·v + 0.000104·v²` (v in m/min)
- [x] Validazioni: distanza 4–21 km, passo 2:30–9:00/km, HR ≥ 85% FCmax, durata ≥ 5 min
- [x] **Finestra 8 settimane** — riflette forma attuale, non picco storico pre-infortunio
  - Pass 1: ultime 8 sett (forma attuale)
  - Pass 2: ultime 16 sett (fallback medio termine)
  - Pass 3: storico completo (last resort)
- [x] Cap VDOT a 55 (runner amatoriale)
- [x] 5 zone Daniels — E (65%), M (80%), T (88%), I (98%), R (110%)
- [x] Previsioni gara iterative (5K/10K/HM/Marathon) con solver Newton
- [x] StatisticsView — gauge VDOT dinamico, zone allenamento, previsioni gara reali
- [x] Time in Zones dal dataset HR reale (Z1–Z5 per % FCmax)

#### Training Plan Generatore (FASE 1.3)
- [x] `POST /api/training-plan/generate` — piano goal-driven con tempo obiettivo
- [x] `_time_to_vdot()` — inversione Daniels: tempo gara → VDOT necessario
- [x] `_assess_feasibility()` — valuta raggiungibilità gap VDOT (0.5 VDOT/mesociclo)
  - `realistic` ≤0.5/meso → 80% confidence
  - `challenging` ≤0.8/meso → 55% confidence
  - `unrealistic` → ricalibra automaticamente il target
- [x] `_build_vdot_progression()` — progressione VDOT non-lineare per fase:
  - Base Aerobica 10% · Sviluppo 20% · Intensità 35% · Specifico 20% · Taper 0%
- [x] Ogni settimana ha il suo VDOT target e i suoi passi Daniels calcolati
- [x] Periodizzazione 6 fasi: Base Aerobica → Sviluppo → Intensità → Specifico → Taper → Gara
- [x] Pattern carico 3:1 (ogni 4a settimana = recupero −35%)
- [x] Sessioni qualità per fase: Aerobica / Soglia / VO₂max intervals / Race Pace / Strides
- [x] Volume progressivo +8%/settimana (Bompa periodization), taper −40/60% (Mujika 2003)
- [x] `athlete_id` filter su tutti gli endpoint GET/POST training plan
- [x] TrainingGrid — sessionMap reale da MongoDB, 4 viste (Day/Week/Month/Year)
- [x] Modal "Genera Piano" — input tempo obiettivo, VDOT attuale vs target, feasibility bar, previsioni
- [x] Header badge: progressione VDOT `48.2 → 52.1`, obiettivo gara + tempo
- [x] TrainingSidebar — km settimanali reali (chart), weekly menu live, VDOT target settimana corrente

#### Training Plan Auto-Adapt (FASE 1.4)
- [x] `POST /api/training-plan/adapt` — 5 modelli scientifici on-demand
- [x] Modello 1 ACWR (Gabbett 2016): ACWR >1.5 → volume −20% + qualità→facile; >1.3 → −10%
- [x] Modello 2 TSB/Banister: TSB <−15 → sessione qualità → recupero attivo; <−10 → −20%
- [x] Modello 3 VDOT Drift (Daniels): drift ≥10s/km → aggiorna passi di tutte le sett. future
- [x] Modello 4 Compliance: <50% sessioni completate (14gg) → −15% volume + semplifica qualità
- [x] Modello 5 Taper prossimità gara (Mujika): ≤14gg → 65/40% del volume massimo
- [x] Modal "Adatta Piano" — card colorata per severità (🔴 critical / 🟡 warning / 🔵 info)
- [x] **Auto-adapt su ogni Strava sync** — `_auto_adapt_on_sync()`:
  - Ricalcola VDOT reale post-sync
  - Confronta con VDOT atteso per la settimana corrente
  - Se |delta| ≥ 0.5: ricalibrare automaticamente tutte le settimane future
  - Runner **più veloce** del previsto → alza i passi
  - Runner **più lento** → abbassa i passi

---

### ⏳ DA FARE

#### FASE 1.5 — Dettaglio Corsa
- [ ] Pagina dettaglio corsa con splits per km
- [ ] Grafici HR, passo, cadenza, altimetria (da streams)
- [ ] Confronto vs sessione pianificata (deviazione passo/distanza, verdetto)
- [ ] Analisi AI Claude — 9 sezioni (classificazione, utilità obiettivo, voto /10)
- [ ] Click su grafico splits → zoom sul segmento mappa

#### FASE 1.6 — Analytics Completa
- [ ] VO2max gauge con trend storico (grafico linea nel tempo)
- [ ] Best efforts con record personali per distanza e navigazione alla corsa
- [ ] Volume per zona (pie chart da dati HR reali)
- [ ] Soglia anaerobica — stima da corse threshold, trend storico
- [ ] Storico VDOT settimana per settimana (grafico progressione)

#### FASE 2 — Advanced Analytics
- [ ] Recovery Score — 4 fattori oggettivi + check-in mattutino (energia, sonno, dolori, umore)
- [ ] Injury Risk — 7 fattori ponderati: ACWR, WoW, intensità, recupero, Foster Monotony, ACSM 10%
- [ ] Supercompensazione — curva maturazione, proiezione 14gg, golden day, training ROI
- [ ] Decoupling Cardiaco — Pa:Hr trend, efficienza aerobica settimanale
- [ ] Cadence history — trend cadenza, obiettivo 180 spm

#### Runner DNA — Identità Atletica AI (COMPLETATO)
- [x] Endpoint `/api/runner-dna` riscritto — Claude Sonnet 4.6 (modello corretto)
- [x] Prompt olimpico esteso: età, sesso, best efforts, VDOT delta 6 mesi, polarizzazione 80/20
- [x] Schema AI a 14 campi: archetype_description, coach_verdict, strengths[3], gaps[3], unlock_message
- [x] 4 DNA dimension scores algoritmici: aerobic_engine, biomechanics, consistency, load_capacity
- [x] ATL + current_predictions + potential_pct nel payload
- [x] Frontend completamente riscritto — layout epico multi-sezione:
  - DNA double helix SVG animato con glow
  - VDOT circular gauge animato (current vs ceiling)
  - Badge livello + archetipo + trend colorati
  - 4 strand bars animati con gradiente
  - 6 core metrics (passo, FC, cadenza, CTL, ATL, TSB colorato)
  - Zone distribution stacked bar + insight polarizzazione 80/20
  - Coach Verdict card con citazione AI
  - Strengths vs Gaps a due colonne
  - Race prediction table: Attuale vs Potenziale vs Delta
  - Pulsante "Rigenera DNA" con endpoint DELETE cache
- [x] `api.delete` aggiunto al client HTTP
- [x] `clearRunnerDnaCache()` esposta in api/index.ts
- [x] Sezione **Running Dynamics** nel DNA — oscillazione verticale, rapporto verticale, contatto suolo, lunghezza falcata (colori elite/good/poor)

#### Garmin Connect — Running Dynamics (COMPLETATO)
- [x] `garminconnect` + `garth` aggiunti a `requirements.txt`
- [x] `_garmin_login()` — autenticazione con salvataggio token OAuth su MongoDB (no re-login)
- [x] `GET /api/garmin/status` — verifica se le credenziali sono configurate
- [x] `POST /api/garmin/sync?limit=N` — scarica FIT da Garmin, incrocia con corse Strava per data+distanza (±10%), estrae biomeccanica con `_extract_fit_dynamics`, aggiorna MongoDB
- [x] `POST /api/garmin/sync-all` — stessa cosa, storico completo (limit=1000)
- [x] FIT parser two-pass: `session` frame per FR265 averages (vertical oscillation, GCT, stride, ratio)
- [x] Pulsante **Garmin Sync** in Activities — stato idle/loading/done/error, mostra `+N dynamics` al completamento
- [x] `syncGarmin()` e `syncGarminAll()` aggiunte a `api/index.ts`
- [x] `garth_generate_token.py` — script one-shot per sblocco Garmin 429 (via hotspot diverso IP)
- [x] `POST /api/garmin/save-token` — salva token garth manualmente su MongoDB

#### JARVIS — Voice Assistant AI (COMPLETATO)
- [x] Three.js particle orb fullscreen: 2000 particelle, connection lines, AdditiveBlending
- [x] Colori: lime `#C0FF00` (idle/listening) · teal `#00FFAA` (thinking/speaking)
- [x] Web Speech API: riconoscimento vocale `it-IT` continuo, wake word `"Jarvis"`
- [x] 18 comandi vocali in italiano (6 nav · 9 dati · 3 azioni) mostrati bottom-left
- [x] Silence timer 1.5s — invia comando dopo pausa naturale
- [x] Backend `POST /api/jarvis/chat`: contesto atleta (VDOT, TSB, last run, weekly km) + Gemini 2.5 Flash Native Audio
- [x] State machine: fullscreen intro → mini bubble dopo navigazione → fullscreen su wake word/click
- [x] Azioni: navigate, show_data, sync_strava, sync_garmin, regenerate_dna
- [x] Zero-latency: audio generato nativamente da Gemini (senza servizi TTS esterni)

#### FASE 3 — Gamification & Reports
- [ ] Medaglie 6 livelli per distanza (5K, 10K, 15K, 21K): Warm-up → Bronzo → Argento → Oro → Platino → Elite
- [ ] Badge 100+ in 8 categorie (milestone, costanza, miglioramenti, allenamento, mezza, scienza, velocità, fun)
- [ ] Weekly Report AI — report settimanale automatico con analisi Claude e preview prossima settimana
- [ ] DNA della Corsa — heatmap annuale 52×7 con TRIMP, zona HR, streak, mutazioni

#### FASE 4 — Scalabilità & Produzione
- [ ] **JWT Auth** (CRITICO per multi-utente) — sessioni sicure per N utenti con refresh token
- [ ] Indici MongoDB — `athlete_id + date` su tutte le collection per performance
- [ ] Paginazione API — tutte le liste con limit/offset
- [ ] Rate Limiting — per-utente per proteggere il backend
- [ ] Onboarding Flow — setup primo accesso: obiettivo, livello, FC max, test VDOT
- [ ] Cache Layer — Redis/in-memory per calcoli pesanti (VDOT, analytics)
- [ ] Mobile Responsive — layout ottimizzato per smartphone
- [ ] Upgrade Render — piano starter ($7/mese) per produzione senza sleep

---

## Stack Tecnologico

### Frontend
| Tecnologia | Ruolo |
|---|---|
| React 18 | UI library |
| TypeScript | Tipizzazione statica |
| Vite | Build tool e dev server |
| Tailwind CSS | Utility-first styling |
| MapLibre GL | Mappe (hero map, heatmap) |
| Recharts | Grafici bar/line |
| Three.js | Particle orb JARVIS (2000 particelle) |
| Lucide React | Icone |
| SVG custom | Grafici interattivi (pace, fitness & freshness) |

### Backend
| Tecnologia | Ruolo |
|---|---|
| Python 3.11 | Runtime |
| FastAPI | Web framework async |
| Uvicorn | ASGI server |
| Motor 3.x | MongoDB async driver |
| httpx | HTTP client (Strava API) |
| google-genai | JARVIS AI — Gemini 2.5 Flash Native Voice |
| garminconnect + garth | Garmin Connect sync + OAuth token |
| fitdecode | Parser FIT files (running dynamics FR265) |
| python-dotenv | Env variables |

### Database & Hosting
| Servizio | Piano | Ruolo |
|---|---|---|
| MongoDB Atlas | M0 Free | Database cloud NoSQL |
| Render.com | Free | Backend hosting |

---

## Repository

| Campo | Valore |
|---|---|
| **Repository** | https://github.com/daniele9233/Dashboard-Running-UI-AiStudio-.git |
| **Branch** | `main` |
| **Backend URL** | https://dani-backend-ea0s.onrender.com |
| **Frontend locale** | http://localhost:3000 |

---

## Architettura

```
┌──────────────┐     HTTPS/JSON     ┌──────────────────┐     Motor     ┌─────────────┐
│  Web App     │ ◄─────────────────► │  FastAPI Backend  │ ◄───────────► │ MongoDB Atlas│
│  (React/Vite)│                    │  (Render.com)     │              │  (M0 Free)  │
└──────────────┘                    └──────────────────┘              └─────────────┘
                                            │
                                            │ httpx
                                            ▼
                                    ┌──────────────────┐
                                    │   Strava API v3  │
                                    │   Anthropic API  │
                                    └──────────────────┘
```

---

## Sistema VDOT (Jack Daniels)

### Formula
```
VO2     = -4.60 + 0.182258·v + 0.000104·v²    (v in m/min)
%max    = 0.8 + 0.1894393·e^(−0.012778·t) + 0.2989558·e^(−0.1932605·t)
VDOT    = VO2 / %max
```

### Finestra Temporale
Il VDOT usa un sistema a 3 pass per riflettere la forma **attuale**, non il picco storico:
1. **Ultime 8 settimane** — forma attuale (post-infortunio, post-pausa)
2. **Ultime 16 settimane** — fallback medio termine
3. **Storico completo** — last resort

### Zone di Allenamento
| Zona | % VO2max | Uso |
|---|---|---|
| Easy (E) | 65% | Corsa lenta, lungo |
| Marathon (M) | 80% | Ritmo gara maratona |
| Threshold (T) | 88% | Progressivo, corse a soglia |
| Interval (I) | 98% | Intervalli VO2max |
| Repetition (R) | 110% | Sprint brevi |

---

## Piano di Allenamento Goal-Driven

### Flusso di Generazione
1. Utente inserisce: **gara obiettivo** (5K/10K/HM/Marathon) + **tempo obiettivo** (es. `19:50`) + **settimane**
2. Backend calcola **VDOT attuale** (ultime 8 sett) e **VDOT necessario** per il tempo obiettivo
3. Valuta **feasibility** del gap (0.5 VDOT per mesociclo = standard Daniels)
4. Costruisce **progressione VDOT non-lineare** settimana per settimana
5. Ogni settimana ha i suoi **passi Daniels** calcolati dal VDOT di quella settimana
6. Se il gap è irraggiungibile → **ricalibra automaticamente** il tempo obiettivo realistico

### Progressione VDOT per Fase
| Fase | % del gap | Perché |
|---|---|---|
| Base Aerobica | 10% | Adattamenti mitocondriali e capillari (lenti) |
| Sviluppo | 20% | Soglia lattacida in salita (media) |
| Intensità | 35% | Massimo stimolo VO2max (rapido) |
| Specifico | 20% | Consolidamento race-pace |
| Taper / Gara | 0% | Supercompensazione, nessun nuovo stimolo |

### Auto-Adattamento su Sync Strava
Dopo ogni sync, `_auto_adapt_on_sync()` confronta il VDOT reale con quello atteso:
- **Delta ≥ +0.5**: runner più veloce → alza i passi delle settimane future
- **Delta ≤ −0.5**: runner più lento → abbassa i passi delle settimane future
- **|Delta| < 0.5**: varianza normale → nessuna modifica

### Modelli di Auto-Adattamento (on-demand)
| Modello | Riferimento | Trigger | Azione |
|---|---|---|---|
| ACWR | Gabbett (2016) | >1.5 | Volume −20%, qualità → facile |
| TSB/Banister | Banister (1975) | TSB <−15 | Sessione qualità → recupero attivo |
| VDOT Drift | Daniels (2013) | Drift ≥10s/km | Ricalcola passi future sett. |
| Compliance | — | <50% (14gg) | Volume −15%, semplifica qualità |
| Taper | Mujika & Padilla (2003) | ≤14gg alla gara | Volume 65%→40% del max |

---

## API Endpoints

Base URL: `https://dani-backend-ea0s.onrender.com/api`

### Attivi
| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/profile` | Profilo utente |
| PATCH | `/profile` | Aggiorna profilo |
| GET | `/dashboard` | Dati dashboard completi |
| GET | `/runs` | Corse (senza streams) |
| GET | `/runs/{id}` | Singola corsa con streams |
| GET | `/training-plan` | Piano completo |
| GET | `/training-plan/current` | Settimana corrente |
| POST | `/training-plan/generate` | Genera piano goal-driven con tempo obiettivo |
| POST | `/training-plan/adapt` | Auto-adatta piano (5 modelli scientifici) |
| PATCH | `/training-plan/session/complete` | Segna sessione completata |
| GET | `/fitness-freshness` | CTL/ATL/TSB con TRIMP Lucia |
| POST | `/fitness-freshness/recalculate` | Ricalcola da zero |
| GET | `/analytics` | VDOT, previsioni gara, zone distribuzione |
| GET | `/vdot/paces` | VDOT + 5 passi Daniels + previsioni |
| GET | `/recovery-score` | Recovery Score |
| POST | `/recovery-checkin` | Check-in mattutino |
| GET | `/injury-risk` | Injury Risk ACWR |
| GET | `/supercompensation` | Supercompensazione |
| GET | `/badges` | Badge e trofei |
| GET | `/best-efforts` | Personal Records |
| GET | `/heatmap` | Heatmap attività |
| GET | `/strava/auth-url` | URL OAuth Strava |
| POST | `/strava/exchange-code` | Scambia codice auth |
| POST | `/strava/sync` | Sync corse + auto-adapt piano |
| POST | `/ai/analyze-run` | Analisi AI corsa (Claude) |
| GET | `/garmin/status` | Verifica credenziali Garmin configurate |
| POST | `/garmin/sync` | Sync FIT Garmin → running dynamics (limit=N) |
| POST | `/garmin/sync-all` | Sync storico completo Garmin (limit=1000) |
| GET | `/runner-dna` | Identità atletica AI + biomeccanica |
| DELETE | `/runner-dna/cache` | Forza re-analisi AI DNA |
| POST | `/jarvis/chat` | JARVIS AI — processa trascrizione vocale, restituisce risposta + azione |
| POST | `/garmin/save-token` | Salva token garth manualmente (sblocco 429) |

---

## Architettura Multi-Utente

> ⚠️ **FASE 4.1 JWT Auth non ancora implementata.** Con un solo utente funziona perfettamente. Per multi-utente è necessario implementare JWT prima di aggiungere altri atleti.

Ogni documento MongoDB contiene `athlete_id` (da Strava). Tutte le query filtrano per `athlete_id`. La funzione `_get_athlete_id()` legge dall'ultimo token Strava inserito — da sostituire con lettura dal JWT header nella FASE 4.1.

---

## Deploy

### Backend (Render.com)
- **Root Directory**: `backend`
- **Build**: `pip install -r requirements.txt`
- **Start**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- **Auto-deploy**: su push a `main`

> Il piano Free va in sleep dopo 15 minuti. Prima richiesta ~30–50s.

### Variabili d'Ambiente (Render)
| Variabile | Descrizione |
|---|---|
| `MONGO_URL` | Connection string MongoDB Atlas |
| `DB_NAME` | Nome database (es. `DANIDB`) |
| `STRAVA_CLIENT_ID` | Client ID app Strava |
| `STRAVA_CLIENT_SECRET` | Client Secret app Strava |
| `ANTHROPIC_API_KEY` | API key Claude Sonnet 4.6 |
| `GEMINI_API_KEY` | API key Gemini (fallback AI generico) |
| `JARVIS_GEMINI_KEY` | API key Gemini dedicata a JARVIS (Gemini 2.5 Flash Native Audio) |
| `GARMIN_EMAIL` | Email account Garmin Connect |
| `GARMIN_PASSWORD` | Password account Garmin Connect |
| `BACKEND_URL` | URL pubblico del backend (es. `https://dani-backend-ea0s.onrender.com`) |

---

## Come Avviare in Locale

```bash
# Frontend
npm install
npm run dev
# → http://localhost:3000

# Backend
cd backend
pip install -r requirements.txt
# Crea .env con le variabili
uvicorn server:app --reload --port 8000
```

---

## Changelog

### v1.2.0 — Marzo 2026
- **JARVIS Voice Assistant**: orb Three.js fullscreen, 18 comandi vocali in italiano
- **Gemini 2.5 Native Audio**: migrazione a output multimodale (audio nativo senza TTS esterno)
- **Fix microfono**: rimosso doppio getUserMedia, delay 300ms riavvio SpeechRecognition

### v1.1.0 — Marzo 2026
- **Garmin Connect**: sync FIT files per running dynamics (oscillazione verticale, GCT, lunghezza falcata, rapporto verticale)
- **FIT parser FR265**: two-pass strategy — session frame per dynamics, record frame per HR-Pro
- **Runner DNA Biomeccanica**: sezione dedicata nel DNA con metriche colorate elite/good/poor
- **Pulsante Garmin Sync** in Activities con feedback visivo live
- **garth token persistence**: OAuth token su MongoDB, nessun re-login

### v1.0.0 — Marzo 2026
- **Training Plan Goal-Driven**: piano costruito sul gap VDOT tra forma attuale e tempo obiettivo
- **VDOT finestra 8 settimane**: riflette forma attuale, non picco storico pre-infortunio
- **Auto-adapt su Strava sync**: ricalibra piani futuri automaticamente dopo ogni corsa
- **Feasibility check**: valuta se il tempo obiettivo è raggiungibile e ricalibra se necessario

### v0.9.0 — Marzo 2026
- **FASE 1.4**: 5 modelli auto-adattamento (ACWR, TSB, VDOT Drift, Compliance, Taper)
- Modal "Adatta Piano" con report colorato per severità

### v0.8.0 — Marzo 2026
- **FASE 1.3**: Training Plan generatore con periodizzazione 6 fasi
- TrainingGrid con dati reali da MongoDB, modal "Genera Piano"
- TrainingSidebar con km settimanali reali e weekly menu live

### v0.7.0 — Marzo 2026
- **FASE 1.2**: VDOT dinamico con validazioni Daniels, 5 zone, previsioni gara iterative
- StatisticsView collegata a dati reali (gauge, zone, previsioni)

### v0.6.0 — Marzo 2026
- **FASE 2.1**: Fitness & Freshness TRIMP Lucia, grafico SVG custom interattivo

### v0.5.0 — Marzo 2026
- **FASE 1.1**: Dashboard dati reali — tutti i widget collegati a MongoDB

### v0.4.0 — Febbraio 2026
- Multi-utente base, best efforts splits-based, profile completo
