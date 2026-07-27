# Checklist — 5 punti (luglio 2026)

Stato verificato sul codice e sui dati reali (`runs.json`, 500 corse).

---

## 1. Attività — parziali su tutte le ripetute + PBP

**Diagnosi: il problema è nei DATI, non nella UI.** La UI c'è già.

Verificato su 500 corse:

| Metrica | Valore |
|---|---|
| Corse totali | 500 |
| `run_type: "intervals"` | **98** |
| Corse con `laps.length > 1` | **9** |
| Sedute ripetute CON laps | **3 su 98** |
| Corse con `splits` | 57 |
| Corse con `gap_pace_sec` | 24 |

[RoutesView.tsx:180](src/components/RoutesView.tsx:180) fa `showLaps = laps.length >= 2` → il **97% delle sedute di ripetute non mostra nessun parziale**.
Il PBP (Minetti) è già implementato a [RoutesView.tsx:158](src/components/RoutesView.tsx:158) ma solo per lap, quindi eredita lo stesso buco.

> **Correzione alla diagnosi iniziale.** I numeri sopra venivano da `runs.json`,
> uno snapshot vecchio. Sul database vivo: **1021 corse totali fra due atleti
> collegati**, di cui 540 dell'atleta attivo con **108 sedute di ripetute**, e
> solo 7 avevano i giri.

### Backend — recupero dati — ✅ COMPLETATO
- [x] Verificato: il sync **chiama già** il detailed endpoint e salva i laps. La causa vera è a [server.py:1319](backend/server.py:1319) — `if existing: continue` salta le corse già in DB, quindi tutto lo storico importato prima non li ha mai avuti
- [x] Nuovo endpoint `POST /api/runs/backfill-laps` con batch, gestione 429 e riclassificazione automatica
- [x] **Backfill eseguito**: 99 sedute aggiornate, 1 fallita, 0 rate-limit
- [x] `gap_pace_sec` ricalcolato dove mancava: da 24 a **85** corse
- [x] Backfill limitato all'atleta attivo (senza filtro avrebbe lavorato anche sulle 481 corse del secondo atleta, bruciando rate limit Strava)

### Fallback quando i laps non esistono — ✅ COMPLETATO
- [x] Nuovo modulo [backend/intervals.py](backend/intervals.py): segmentazione lavoro/recupero dagli streams con 2-means sul passo, fusione dei micro-blocchi, FC e dislivello per segmento
- [x] Catena di fonti `laps → streams → splits`, con `source` restituito e **mostrato all'utente**
- [x] Split di coda sotto i 150 m scartati (Strava chiude sempre con un residuo, a volte di 12 m)
- [x] **Guardrail contro i falsi positivi**: senza tetto sul passo di lavoro, una corsa facile con due soste veniva presentata come "3 ripetute @ 6:19/km". Ora servono contrasto ≥1.30, passo di lavoro ≤5:30/km e ripetute fra 150 m e 5 km

### PBP — ✅ COMPLETATO
- [x] **Unificato il modello**: RoutesView usava una formula moltiplicativa simmetrica al 3.3%, il backend una Minetti asimmetrica (salita 12.5 s/km per 1%, discesa 7 con attenuazione oltre l'-8%). Due PBP diversi per la stessa corsa. Ora la fonte è una sola, quella del backend
- [x] PBP su ogni riga di parziale, mostrato solo se sposta il passo di ≥2 sec/km
- [x] PBP medio delle ripetute nel riepilogo
- [x] **Dislivello netto invece del guadagno cumulato**: i laps Strava portano solo `total_elevation_gain`, che su un giro che sale e ridiscende è >0 anche con netto zero e gonfiava il PBP. Ora il netto si legge dall'altimetria degli streams

### UI — ✅ COMPLETATO
- [x] Riepilogo in testa: `4 × 1000 m @ 3:56/km · rec 3:00` + PBP + km di lavoro + tenuta + deriva FC
- [x] Ripetute evidenziate con bordo accento, recuperi in trasparenza
- [x] Colonna FC per segmento + deriva fra prima e ultima ripetuta
- [x] Ripetute numerate 1..N, recuperi senza numero (prima una seduta di 7×400 arrivava a numerare fino a 13)
- [x] Etichetta di provenienza: `giri orologio` / `ricavati dai dati` / `split per km`

### Risultato misurato
| | prima | dopo |
|---|---|---|
| Sedute ripetute con parziali | 13/108 | **93/108** |
| Di cui dai giri veri | 7 | **92** |
| Con riepilogo ripetute leggibile | 6 | **16** |
| Corse con `gap_pace_sec` | 24 | **85** |

- [x] 20 test in [backend/test_intervals.py](backend/test_intervals.py), tutti verdi (metà sui falsi positivi)
- [x] Verificato a schermo su tre casi: giri veri, segmentazione da streams, fallback split

### Non fatto (fuori portata del punto)
- [ ] PBP a livello corsa nella lista attività — il dato ora c'è su 85 corse, manca solo di mostrarlo
- [ ] Le 15 sedute ancora senza parziali non hanno né giri né streams su Strava: recuperabili solo re-importando gli streams (chiamata pesante, va valutata a parte)

---

## 2. Dashboard — widget "Impatto Meteo" vuoto

**Diagnosi: causa radice certa.**

[WeatherNormalizerWidget.tsx:71](src/components/dashboard/widgets/WeatherNormalizerWidget.tsx:71) filtra:

```ts
.filter((r) => !r.is_treadmill && r.start_latlng && (r.temperature ?? 0) > 5)
```

Ma **il campo `temperature` non esiste nei documenti run** — verificato su runs.json: `undefined`. Quindi `0 > 5` è falso per tutte le corse → `analysis === null` → empty state permanente.

Problemi collegati:
- `run.weather` viene letto come umidità con `parseFloat` ([riga 44](src/components/dashboard/widgets/WeatherNormalizerWidget.tsx:44)) ma nel type è `string | null` (descrizione, non numero)
- Gli endpoint `GET/POST /api/runs/{id}/weather` sono stati creati nello stesso commit ma **il widget non li chiama mai**
- `getRunWeather` / `postRunWeather` esistono in [src/api/index.ts](src/api/index.ts) e sono **codice morto**
- Nei dati esiste `device_temp_c` (temperatura sensore orologio, poco affidabile)

**La logica corretta esiste già** in [EnvironmentalNormalizerView.tsx:125](src/components/statistics/EnvironmentalNormalizerView.tsx:125): open-meteo, archive API per corse vecchie + forecast API per corse < 9 giorni, media sulle ore effettivamente coperte dalla corsa.

### Fix — ✅ COMPLETATO
- [x] Estratto `fetchWeatherForRun` + cache in [src/utils/weather.ts](src/utils/weather.ts) (condiviso)
- [x] Widget consuma il modulo condiviso invece di `run.temperature`
- [x] Persistenza collegata: nuovo `POST /api/runs/weather/bulk` (una chiamata per N corse invece di N GET) + `POST` per salvare gli snapshot risolti
- [x] Rimosso il parsing errato di `run.weather` come umidità
- [x] Fetch limitata alle ultime 30 corse GPS, a gruppi di 6 in parallelo
- [x] Empty state distinti: nessuna corsa GPS / caricamento / meteo non recuperabile / servizio irraggiungibile
- [x] Punto di rugiada con formula Magnus-Tetens (prima: `T - (100-RH)/5`, sbagliata di gradi sotto il 50% RH)
- [x] Modello di penalità unificato fra widget e vista Statistiche (prima erano due formule diverse per lo stesso dato)
- [x] Verificato a schermo: **9.9 sec/km · 23° · 67% RH · 16° DEW · 20/30 giorni caldi**, zero errori console
- [x] Verificata la persistenza: al secondo load **zero chiamate open-meteo**, dati serviti da Mongo

---

## 3. Statistics — Calcolatore da ristrutturare

Attuale: [PaceCalculator.tsx](src/components/statistics/PaceCalculator.tsx), 3 input (distanza, tempo, passo) + `lastEdited` ([riga 115](src/components/statistics/PaceCalculator.tsx:115)).

**Richiesta esplicita: scrivo il passo → il tempo si aggiorna da solo.**

### Fix — ✅ COMPLETATO
- [x] Modello a **ordine di edit**: i due campi toccati più di recente sono input, il terzo si calcola. Scrivere nel campo calcolato lo promuove a input — nessun campo è mai bloccato
- [x] **Digitare il passo aggiorna il tempo**: verificato 4:30 → 4:00 su 10 km, tempo passa da 45:00 a **40:00**
- [x] Ricalcolo on-change immediato (niente debounce: il campo derivato è output, non input — il debounce darebbe solo lag)
- [x] Parser tollerante verificato a schermo: `345` → 3:45 (37:30), `4.15` → 4:15 (42:30), `4,05` → 4:05 (40:50), più `1:30:00` e `13000`
- [x] Campo calcolato marcato con badge **AUTO** + bordo/colore accento; select-all al focus per riscrivere al volo
- [x] Preset distanze 1K / 5K / 10K / Mezza / Maratona
- [x] Zone VDOT (easy / maratona / soglia / interval / repetition)
- [x] **Tempi di passaggio** per km al ritmo impostato, checkpoint adattivi (ogni 1/2/5 km secondo la distanza) + riga ARRIVO
- [x] Equivalenze Riegel su 14 distanze
- [x] Passo in min/miglio se lingua EN, altrimenti km/h come dato secondario

### Bug preesistenti trovati e corretti
- [x] **Modalità "deriva la distanza" irraggiungibile**: `setLastEdited("time-pace")` non veniva mai chiamato. Ora funziona — verificato: 1:20:00 @ 4:00/km → **20.0 km**
- [x] **Zone VDOT sbagliate di un fattore 60**: `vdotToPace` restituiva minuti/km mentre `fmtPace` si aspettava secondi/km → a schermo usciva `0:06 /km`. Ora VDOT 45.3 dà easy 5:52 · maratona 4:58 · soglia 4:36 · interval 4:13 · repetition 4:00
- [x] **Prop `vdot` era codice morto**: ora mostra il confronto fra VDOT calcolato e VDOT attuale dell'atleta (es. `45.3 vs 54.4 · -9.1`)

---

## 4. Statistics — Confronto da rifare da zero

Attuale: [PeriodComparison.tsx](src/components/statistics/PeriodComparison.tsx) confronta **mese vs mese** con due `<select>` e un BarChart. Non confronta corse.

**Richiesta: confrontare le CORSE, con ipotesi schermo diviso e due mappe come in attività.**

### Realizzato — ✅ COMPLETATO
Nuovo [RunComparison.tsx](src/components/statistics/RunComparison.tsx), split 50/50 con corsa A a sinistra e B a destra.

- [x] **Selettore per lato** con ricerca su nome, data e tipo di seduta
- [x] **Due mappe affiancate** su MapLibre — non `LastRunMap`, che usa Mapbox a consumo: due mappe per vista avrebbero raddoppiato i map load fatturati
- [x] **Stessa scala metrica** (toggle): entrambe le mappe usano la finestra geografica più larga fra le due, così un 3 km non sembra lungo quanto un 15 km. Preferito al pan/zoom accoppiato, inutile quando i due percorsi sono in posti diversi
- [x] **KPI a specchio** con delta al centro: distanza, tempo, passo, PBP, passo normalizzato, FC, dislivello, temperatura
- [x] **Grafico passo per km sovrapposto**, due linee sullo stesso asse
- [x] **Normalizzazione meteo** riusando il modulo del punto 2: avviso automatico quando fra le due giornate ci sono ≥3°C di differenza
- [x] Preset: `ultime due` · `migliore vs ultima` · `stessa distanza`
- [x] Pulsante scambia A/B
- [x] Empty state onesto per le corse senza tracciato GPS
- [x] Responsive: sotto `md` le due colonne si impilano
- [x] Costanti recharts a livello di modulo (stessa trappola del loop infinito già vista in `WeeklyKmChart`)

### Decisioni prese
- **Corsa vs corsa** come vista principale, che è quanto chiesto ("confrontare le mie corse")
- **Il confronto mensile non è stato buttato**: resta come sotto-tab `PERIODI` accanto a `CORSE`. Funzionava, e cancellarlo sarebbe stato distruggere lavoro utile
- Il confronto gruppo-vs-gruppo non è stato fatto: lo copre già la sotto-tab Periodi

### Bug trovato durante la verifica
- [x] Il preset "migliore vs ultima" pescava una corsa da **0.1 km a 2:31/km** — un artefatto GPS, non una prestazione. Aggiunta una soglia minima di 3 km

### Non fatto
- [ ] Modalità "stesso percorso" con confronto per segmento: richiede il matching geometrico dei due tracciati, è un lavoro a sé
- [ ] Confronto per lap allineati: ha senso solo se entrambe le corse sono ripetute con la stessa struttura, caso raro

---

## 5. Training — piano `kikkoSub20` (10 settimane)

Seguire il pattern esistente di [src/data/sub20Plan.ts](src/data/sub20Plan.ts) (`SUB20_META`, `SLOT_TYPE`, `SLOT_OFFSET`, funzione `mk()`).

### Parametri
- [ ] Nome piano: `kikkoSub20`, 10 settimane
- [ ] Volume settimana 1: **32 km**
- [ ] Progressione **+10%/settimana** con settimane di scarico
- [ ] Ritmo gara 5K (RG5K) = **4:00/km** (obiettivo 19:58, coerente con VDOT attuale ~54)
- [ ] **Solo 2 sessioni intense a settimana.** Tutti gli altri giorni easy, a supporto dei lavori duri

### Volume proposto (10% con scarico ogni 4ª settimana)

| Sett | Km | Note |
|---|---|---|
| 1 | 32 | base |
| 2 | 35 | +10% |
| 3 | 38.5 | +10% |
| 4 | 30 | scarico |
| 5 | 42 | |
| 6 | 46 | |
| 7 | 50 | picco |
| 8 | 39 | scarico |
| 9 | 52 | picco finale |
| 10 | 22 | **taper −58%** |

- [ ] Confermare il picco: 10% composto puro da 32 km porterebbe a ~75 km in settimana 10, troppo. Le settimane di scarico sono necessarie

### Sessione 1 — Intervalli brevi (progressione 6×600 → 10×800 @ RG5K)

| Sett | Lavoro | Recupero |
|---|---|---|
| 1 | 6×600m | 2:00 |
| 2 | 7×600m | 2:00 |
| 3 | 8×600m | 1:50 |
| 4 | 6×600m (scarico) | 2:00 |
| 5 | 6×800m | 2:15 |
| 6 | 7×800m | 2:10 |
| 7 | 8×800m | 2:00 |
| 8 | 6×800m (scarico) | 2:15 |
| 9 | **10×800m** | 2:00 |
| 10 | 5×800m (taper) | 2:30 |

- [ ] Tutte le ripetute a RG5K = 4:00/km
- [ ] Riscaldamento 15-20 min + defaticamento 10 min su ogni seduta

### Sessione 2 — Resistenza, settimane alterne (3×2km @ RG5K)

Settimane A = 1, 3, 5, 7, 9. Recupero che si accorcia ogni 14 giorni:

| Sett | Lavoro | Recupero |
|---|---|---|
| 1 | 3×2km | 3:00 |
| 3 | 3×2km | 2:30 |
| 5 | 3×2km | 2:15 |
| 7 | 3×2km | 2:00 |
| 9 | 3×2km | 1:45 |

- [ ] **Decisione richiesta:** nelle settimane pari (2, 4, 6, 8) la seconda seduta intensa cosa diventa? Il vincolo "2 intense/settimana" e "resistenza a settimane alterne" sono in tensione. Proposta di default: **tempo run alla soglia** (20-30 min @ ~4:15/km), che sostiene la 5K senza aggiungere stress da VO2max

### Taper (ultimi 7-10 giorni = settimana 10)
- [ ] Volume ridotto del **41-60%** rispetto al picco (52 km → 22 km, −58%)
- [ ] **Intensità mantenuta** a ritmo gara, ma molte meno ripetizioni
- [ ] Non azzerare la corsa: giorni easy corti fino a 2 giorni prima
- [ ] Ultimo lavoro di qualità: 4-5 giorni prima della gara
- [ ] Giorno −1: riposo o 20 min molto facili + 3 allunghi

### Implementazione — ✅ COMPLETATO
- [x] Creato [src/data/kikkoSub20Plan.ts](src/data/kikkoSub20Plan.ts) seguendo la struttura di `sub20Plan.ts`
- [x] Registrato nel **nuovo selettore piani** in [TrainingGrid.tsx](src/components/TrainingGrid.tsx): GENERATO / SUB-20 / KIKKOSUB20
- [x] `startDate` configurabile via date-picker + "RICALCOLA", non hardcoded
- [x] Slot settimanali: lun facile · mar INTENSA 1 · mer facile · gio INTENSA 2 · ven facile · sab riposo · dom lungo
- [x] Volumi verificati: somma sedute == volume dichiarato su tutte e 10 le settimane
- [x] Suite di test [kikkoSub20Plan.test.ts](src/data/kikkoSub20Plan.test.ts) — **14 test verdi**, suite completa 34/34
- [x] Verificato a schermo: sett. 1 renderizza `Facile 3 km` · `6×600 m @ 4:00` · `Facile 4 km` · `3×2 km @ 4:00 rec 3:00` · `Facile 3 km`, gara **2026-10-04**

### Bug preesistente trovato e corretto
- [x] **La macchina Sub-20 era irraggiungibile**: `const [showSub20] = useState(false)` senza setter, quindi legenda, adattamento RPE, esiti sedute e `recalcSub20FromDraft` erano tutti codice morto. Ora `activePlan` è un vero selettore e riattiva anche il piano Sub-20 esistente

### Decisioni prese (da confermare)
- **Settimane pari** (2, 4, 6, 8): seconda seduta intensa = soglia 20-25′ @ 4:18/km. I 3×2 km restano a settimane alterne come richiesto, ma il vincolo "2 intense a settimana" richiedeva qualcosa nelle altre. La soglia sostiene il ritmo gara senza un secondo stimolo VO2max da recuperare
- **Sabato a riposo**: 6 giorni di corsa su 7. La richiesta diceva "tutti gli altri giorni corse facili", ma 7/7 senza riposo a questi volumi è aggressivo per un master. Basta sostituire il `null` del sabato con `easy(n)` per passare a 7 giorni

---

## Ordine di esecuzione consigliato

1. **Punto 2** — mezza giornata, causa radice nota, sblocca un widget morto
2. **Punto 3** — mezza giornata, richiesta chiusa e ben definita
3. **Punto 5** — 1 giorno, pattern già esistente da seguire
4. **Punto 1** — 2-3 giorni, richiede backfill dati + rate limit Strava
5. **Punto 4** — 2-3 giorni, va deciso il design prima di scrivere codice
