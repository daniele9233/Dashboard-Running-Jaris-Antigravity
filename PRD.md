# PRD — METIC LAB Running Training Dashboard

## Documento dei Requisiti di Prodotto
**Versione:** 1.0
**Data:** 28 Marzo 2026
**Autore:** Daniele Pascolini
**Stato:** In sviluppo attivo

---

## 1. Visione del Prodotto

METIC LAB e una dashboard web per runner che integra dati Strava, analisi scientifica dell'allenamento e coaching AI per aiutare ogni utente a raggiungere i propri obiettivi di gara.

**Differenziatore chiave:** Non e un semplice tracker. E un sistema che applica modelli scientifici peer-reviewed (Daniels, Banister, Seiler, Foster, Mujika) per adattare automaticamente il piano di allenamento sulla base delle performance reali dell'atleta.

**Target utente:** Runner amatoriali/intermedi (VDOT 35-55) che vogliono allenarsi in modo scientifico per una gara specifica (5K, 10K, Mezza Maratona, Maratona).

---

## 2. Architettura Tecnica

### Stack
| Layer | Tecnologia | Motivazione |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | SPA veloce, tipizzazione, HMR |
| Styling | Tailwind CSS | Utility-first, dark theme nativo |
| Mappe | MapLibre GL JS | Open-source, no API key |
| Grafici | SVG custom + componenti React | Controllo totale, no dipendenze pesanti |
| Backend | FastAPI (Python 3.11) | Async nativo, validazione Pydantic, auto-docs |
| Database | MongoDB Atlas (Motor async) | Schema flessibile, free tier generoso |
| AI | Claude Sonnet 4.6 + Gemini (fallback) | Analisi personalizzate |
| Auth | Strava OAuth 2.0 (fase 1), JWT (fase 2) | Identificazione utente tramite athlete_id |
| Hosting | Render.com | Auto-deploy da GitHub |

### Principio architetturale: Multi-utente dal giorno zero
Ogni documento MongoDB contiene `athlete_id`. Ogni query filtra per `athlete_id`. Nessuna eccezione. Questo garantisce isolamento dei dati e scalabilita da 1 a 1000+ utenti senza refactoring.

### Collezioni MongoDB
```
profiles          — Un documento per utente
runs              — Corse (Strava + manuali)
training_weeks    — Piano allenamento per-utente
tests             — Test fisici
vo2max_history    — Storico VDOT
adaptation_log    — Log auto-adattamento piano
recovery_checkins — Check-in mattutini
badges            — Badge sbloccati
weekly_reports    — Report settimanali AI
```

---

## 3. Requisiti Funzionali

### 3.1 Autenticazione e Profilo

**RF-AUTH-01**: L'utente si autentica tramite Strava OAuth 2.0.
- Al primo login, viene creato un profilo con `athlete_id` da Strava
- Token di accesso salvato nel profilo per sync future

**RF-PROF-01**: L'utente puo modificare il suo profilo:
- Nome, foto (upload con resize a 256px), sesso, eta, peso, altezza, FC Max
- Obiettivo gara (distanza + tempo target)
- I dati del profilo influenzano tutti i calcoli (VDOT, zone, piano)

**RF-PROF-02**: La pagina profilo mostra:
- Hero map con polyline ultima corsa (MapLibre)
- Quick stats: km totali, corse, FC max, personal best
- Running Consistency: heatmap 6 mesi con stats (streak, giorno top, frequenza)
- Progressione del Passo: grafico SVG ultime 20 corse con trend
- Training Zones: 5 zone con valori bpm
- Regola 80/20: distribuzione lente vs veloci (7g/14g)
- Personal Records: click naviga a dettaglio corsa
- Connessione Strava + Sync

---

### 3.2 Strava Integration

**RF-STRAVA-01**: Flusso OAuth completo:
1. `GET /api/strava/auth-url` → URL di autorizzazione
2. Redirect a Strava → utente autorizza
3. Callback con `?code=XXX`
4. `POST /api/strava/exchange-code` → salva token, crea/aggiorna profilo

**RF-STRAVA-02**: Sync corse:
- `POST /api/strava/sync` recupera attivita recenti da Strava API v3
- Per ogni nuova Run: salva con `athlete_id`, splits, polyline, HR stream
- Calcola passo medio, HR media/max
- Aggiorna `total_km` nel profilo
- Trigger ricalcolo best efforts e VDOT

**RF-STRAVA-03**: Streams limitati:
- HR stream e distance stream scaricati solo per dettaglio singola corsa
- MAI caricare streams in endpoint lista (memory fix: 512MB Render)

---

### 3.3 Dashboard

**RF-DASH-01**: La dashboard mostra dati reali:
- Sessione di oggi (dal piano di allenamento)
- Stats rapide: km settimanali, km totali, passo target, VDOT
- Grafico km ultime 12 settimane (barre colorate per fase)
- Corse recenti (ultime 3-5)
- Countdown alla prossima gara
- Barra progresso settimana (sessioni completate / totale)

**RF-DASH-02**: Vista "Activities" con layout split-screen:
- Lista attività scrollabile indipendente (sinistra)
- Mappa Mapbox 3D fissa (destra) con stile `standard` (dusk, POI, edifici 3D)
- 3 visualizzazioni mappa: "World" (globo), "All Runs" (zoom cluster più denso), "Last Run" (zoom dettaglio corsa).
- FlyTo animation ed auto-rotazione su card click.

**RF-GARMIN-01**: Sync Running Dynamics da FIT files Garmin:
- `download_activity(ORIGINAL)` → ZIP archive → estrai .fit dentro → `fitdecode`
- Session frame: `avg_vertical_oscillation`, `avg_stance_time`, `avg_step_length`, `avg_vertical_ratio`
- Record frame fallback (HRM-Pro): media per-point values
- Skip run se `avg_vertical_oscillation` già presente nel documento
- Feedback frontend: mostra dynamics aggiornate o errore login leggibile

**RF-DASH-03**: Vista dettaglio corsa — Live Telemetry 3D:
- Toggle STANDARD / 3D TELEMETRY nella pagina dettaglio attività
- Mappa Mapbox GL dark-v11 con terreno DEM esagerato (1.5x), fog atmosferico, edifici 3D fill-extrusion (pitch 60°)
- Playback engine: RAF loop con velocità 0.5x/1x/2x/4x, progress bar seekable, ghost runner
- Chase Camera: `flyTo` con bearing interpolato sulla direzione di corsa
- Left panel 380px: 4 metric cards live (Dist/Pace/HR/Elev) + KM splits scrollabili
- Floating HUD in alto a destra (`top-6 right-6`): Pace/HR/Elev/Dist — visibile solo durante riproduzione, non si sovrappone al toggle STANDARD/3D

---

### 3.4 Sistema VDOT (Jack Daniels)

**RF-VDOT-01**: Calcolo automatico del VDOT:
- Input: migliore prestazione su distanze 4-21km
- Formula: `VO2 = -4.60 + 0.182258*v + 0.000104*v^2`
- Validazione: distanza >= 4km, FC >= 85% FCmax, passo 2:30-9:00/km
- Cap: VDOT max 55

**RF-VDOT-02**: Regole di aggiornamento:
- Regola dei 2/3 di Daniels: solo 67% del miglioramento viene applicato
- Cap +1 VDOT per mesociclo (4 settimane)
- In caso di regressione: riduzione integrale
- Ricalcolo dopo ogni sync Strava

**RF-VDOT-03**: 5 zone di allenamento derivate dal VDOT:
| Zona | % VO2max | Uso |
|---|---|---|
| Easy | ~65% | Corsa lenta, lungo |
| Marathon | ~79% | Ritmo gara maratona |
| Threshold | ~88% | Progressivo, ripetute medie |
| Interval | ~98% | Ripetute |
| Repetition | ~105% | Sprint |

**RF-VDOT-04**: Storico VDOT salvato in `vo2max_history` con data e valore.

---

### 3.5 Piano di Allenamento

**RF-PLAN-01**: Generazione piano personalizzato:
- Input: obiettivo gara (distanza + tempo), data gara, livello attuale, VDOT
- Output: N settimane con sessioni giornaliere
- 6 fasi: Ripresa → Base Aerobica → Sviluppo → Prep. Specifica → Picco → Tapering
- Settimane di recupero ogni 3-4 settimane (-30% volume)
- Passi derivati dal VDOT dell'utente

**RF-PLAN-02**: Sessioni del piano:
- Ogni sessione ha: tipo, titolo, descrizione, distanza target, passo target, durata target
- Tipi: Corsa Lenta, Lungo, Ripetute, Progressivo, Rinforzo, Riposo, Test

**RF-PLAN-03**: Toggle completamento:
- Utente puo segnare sessione come completata
- Auto-completamento quando sync Strava trova corsa corrispondente

**RF-PLAN-04**: Auto-adattamento (5 modelli scientifici):

| Modello | Trigger | Azione |
|---|---|---|
| Spike Detection (Impellizzeri 2020) | Carico WoW > +30% | Volume -15% |
| Regola 10% (ACSM 2013) | Incremento sett > 10% | Limita incremento |
| Monotonia (Foster 1998) | Monotonia > 2.0 | Volume -5% |
| Polarizzazione (Seiler 2010) | Corse facili < 75% | Avviso |
| Tapering (Mujika 2003) | Ultime 3 settimane | -20%/-40%/-55% |

**RF-PLAN-05**: Ogni decisione di adattamento viene salvata in `adaptation_log`.

---

### 3.6 Dettaglio Corsa

**RF-RUN-01**: Pagina dettaglio con:
- Metriche: distanza, passo, durata, FC media/max, cadenza, dislivello
- Splits per km: barre colorate con passo e HR
- Zone di passo: distribuzione %
- Confronto Piano vs Realta (se piano attivo)

**RF-RUN-02**: Grafico Frequenza Cardiaca:
- Area chart con HR stream (downsampled a 200 punti)
- Linea media, asse tempo, asse bpm

**RF-RUN-03**: Efficienza Aerobica (Decoupling Pa:Hr):
- Solo per corse a passo costante (CV < 10%)
- Confronto HR 1a meta vs 2a meta

**RF-RUN-04**: Supercompensazione per-corsa:
- Tipo adattamento (neuromuscolare 3-7gg / metabolico 7-14gg / strutturale 14-21gg)
- Barra maturazione con percentuale
- Data beneficio massimo

**RF-RUN-05**: Analisi AI:
- Claude Sonnet 4.6 (primario), Gemini (fallback), algoritmico (fallback offline)
- 9 sezioni: intro, dati, classificazione, utilita obiettivo, positivi, gap, reality check, consigli, voto/10
- Confronto con sessione pianificata, VDOT, settimane alla gara

---

### 3.7 Analytics

**RF-ANAL-01**: VO2max gauge: valore corrente vs target con trend.

**RF-ANAL-02**: Previsioni gara VDOT (NO Riegel):
- 5K, 10K, 21.1K, 42.2K
- Tabella storica mese per mese con VDOT e trend
- Filtri periodo (1M/3M/6M/Tutto)

**RF-ANAL-03**: Fitness & Freshness (Banister 1975):
- TRIMP (Lucia): `durata * HR_reserve * (0.64 * e^(1.92 * HR_reserve))`
- CTL: media mobile esponenziale 42 giorni
- ATL: media mobile esponenziale 7 giorni
- TSB: CTL - ATL
- Grafico con 3 linee + area sfumata

**RF-ANAL-04**: Soglia Anaerobica: stima da corse threshold, trend storico.

**RF-ANAL-05**: Best Efforts: migliori prestazioni per distanza (400m, 1K, 4K, 5K, 10K, 15K, 21K, 42K).

---

### 3.8 Recovery e Risk

**RF-REC-01**: Recovery Score (0-100):
- 4 fattori oggettivi: ore ultimo allenamento, carico 3gg/21gg, TSB, intensita HR%
- Check-in mattutino: energia, sonno, dolori, umore (1-5 ciascuno)
- Formula: senza check-in = 100% oggettivo; con = 40% ogg + 60% sogg
- Suggerimento allenamento basato sullo score

**RF-REC-02**: Injury Risk (0-100):
- 7 fattori: ACWR, WoW%, storico infortuni, intensita, recupero, monotonia, ACSM 10%
- Pesi: [0.25, 0.15, 0.15, 0.10, 0.10, 0.15, 0.10]
- Gauge con codice colore (verde/giallo/arancione/rosso)
- Raccomandazioni personalizzate

---

### 3.9 Supercompensazione

**RF-SUPER-01**: Curva educativa con 3 tipi adattamento.
**RF-SUPER-02**: Proiezione 14 giorni con picco evidenziato.
**RF-SUPER-03**: Barra maturazione ultimi 10 allenamenti.
**RF-SUPER-04**: Golden Day: data ottimale per gara/test.
**RF-SUPER-05**: Training ROI: portafoglio biologico.

---

### 3.10 Gamification

**RF-MEDAL-01**: Medaglie 6 livelli per distanza (5K, 10K, 15K, 21.1K):
Warm-up → Bronzo → Argento → Oro → Platino → Elite

**RF-BADGE-01**: 100+ badge in 8 categorie:
Milestone, Costanza, Miglioramenti, Allenamento, Mezza, Scienza, Velocita, Fun

**RF-BADGE-02**: Ricalcolo automatico dopo ogni sync Strava.

---

### 3.11 Weekly Report

**RF-WEEK-01**: Report settimanale automatico:
- KM effettivi vs target, aderenza piano %
- Stats: km, corse, passo medio, FC media, VDOT
- Trend volume ultime 5 settimane
- Analisi AI: verdetto, positivi, miglioramenti, focus, consiglio
- Preview prossima settimana

---

### 3.12 AI Coach

**RF-AI-01**: Stack AI a 3 livelli:
1. Claude Sonnet 4.6 (Anthropic) — primario, temperature 0.9
2. Google Gemini — fallback gratuito
3. Analisi algoritmica — fallback offline

**RF-AI-02**: Analisi corsa in 9 sezioni strutturate.
**RF-AI-03**: Weekly report AI personalizzato.

---

## 4. Requisiti Non-Funzionali

**RNF-01**: Tempo di caricamento pagina < 2 secondi (escluso cold start Render).
**RNF-02**: Memory usage backend < 450MB (Render free tier = 512MB).
**RNF-03**: Tutte le query MongoDB devono filtrare per `athlete_id`.
**RNF-04**: Nessun caricamento di `streams` in endpoint lista.
**RNF-05**: Dark theme con contrasto WCAG AA.
**RNF-06**: Responsive design (desktop, tablet, mobile).
**RNF-07**: Tutte le formule scientifiche implementate come funzioni pure deterministiche.
**RNF-08**: Ogni endpoint API deve gestire errori con codici HTTP appropriati.
**RNF-09**: Dati sensibili (token, chiavi API) mai nel codice — solo env vars.

---

## 5. Priorita di Implementazione

| Priorita | Feature | Motivazione |
|---|---|---|
| P0 | Auth + Profilo + Strava Sync | Senza dati non c'e nulla |
| P0 | Best Efforts + Personal Records | Feedback immediato all'utente |
| P1 | VDOT + Zone allenamento | Base per tutto il sistema |
| P1 | Dashboard dati reali | Homepage funzionale |
| P1 | Training Plan generatore | Core value proposition |
| P1 | Dettaglio Corsa + AI | Analisi approfondita |
| P2 | Training Plan auto-adapt | Differenziatore chiave |
| P2 | Analytics completa | Metriche avanzate |
| P2 | Fitness & Freshness | Monitoraggio forma |
| P2 | Recovery + Injury Risk | Prevenzione infortuni |
| P3 | Supercompensazione | Feature avanzata |
| P3 | Badge + Medaglie | Gamification |
| P3 | Weekly Report AI | Engagement |
| P4 | JWT Auth + Scalabilita | Produzione multi-utente |
| P4 | Mobile responsive | Audience piu ampia |

---

## 6. Metriche di Successo

| Metrica | Target |
|---|---|
| Corse sincronizzate con successo | > 99% |
| Tempo calcolo VDOT | < 500ms |
| Accuratezza previsioni gara | Entro 3% del tempo reale |
| Aderenza piano utente medio | > 70% |
| Recovery Score correlazione | > 0.7 con performance successiva |
| Uptime backend | > 99% (escluso sleep Render free) |

---

## 7. Vincoli e Limitazioni

- **Render Free Tier**: 512MB RAM, sleep dopo 15min, cold start ~50s
- **MongoDB Atlas M0**: 512MB storage, 100 connessioni
- **Strava API**: rate limit 100 richieste / 15 minuti per utente
- **Claude Sonnet 4.6**: costo variabile per utilizzo (Anthropic API)
- **Gemini**: gratuito ma con rate limit
