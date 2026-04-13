# METIC LAB — Roadmap

## Completati

- [x] **Dashboard — CSS Grid Layout (v2)**: eliminata sidebar fissa `w-[300px]`. Layout ora CSS Grid `grid-cols-12` con `max-w-[1600px] mx-auto`. Status of Form `row-span-2`, HOF e Target integrati nella griglia principale. Nessun dead space laterale su schermi wide. Gap uniforme 24px.

- [x] **Dashboard — Chart KM fix**: `ResponsiveContainer` ora usa `height={240}` esplicito invece di `flex-1 + height="100%"` che causava altezza 0px su tutti i periodi (7G/MESE/ANNO).

- [x] **Dashboard — Map Dusk 3D**: mappa interattiva Mapbox standard + `lightPreset: dusk`, pitch 60°, zoom 17 sul punto di partenza. Placeholder no-GPS per corse tapis roulant.

- [x] **Dashboard — Metriche live**: EFFICIENCY (TSB-based), DERIVA CARDIACA (split HR), TE SCORE normalizzato (avg_hr_pct 0-100 → 0-1), countdown D/H/M alla gara, Next Optimal Session arc timer.

- [x] **Training Calendar — Giorni Forza**: colore sky-blue `#0EA5E9` per giorni riposo+forza. Picker data inizio piano. Esercizi periodizzati (Bulgarian Split Squat, Depth Jump, Pogo Jumps, etc.).

- [x] **Backend — Success Probability**: non più hardcoded 20%. Formula proporzionale `max(5, min(49, round(55 * max_optimistic / gap)))`.

- [x] **Statistics — Deriva Cardiaca**: 2 grafici nel tab Performance — *Historical Drift* (trend storico con KPI + grafico colorato per zona) e *Single Run Drift* (split HR per km con filtro passo costante ±12%). Solo corse qualificate vengono analizzate.

- [x] **Activities — Drift per corsa**: colonne **DRIFT** e **1ª→2ª** aggiunte su ogni card corsa nell'elenco attività. Colorazione per zona (verde/blu/arancione/rosso). Solo per corse a passo costante con dati split HR.

- [x] **Training Plan — Riscrittura completa**: logica scientifica riscritta da zero.
  - **VDOT con storia completa**: analisi picco storico + VDOT attuale + training age + volume settimanale.
  - **Recovery Mode**: se il target è dentro il picco storico, tassi accelerati (Mujika & Padilla 2000, muscle memory).
  - **Due opzioni**: se il goal non è fattibile, l'utente sceglie tra Piano Conservativo (0.5 VDOT/meso) e Piano Aggressivo (0.8 VDOT/meso) — nessun ricalcolo automatico.
  - **Test pre-piano**: input opzionale di distanza + tempo test per calibrare il VDOT con precisione.
  - **Esercizi forza/prehab/pliometrici**: ogni sessione include esercizi specifici per fase — clamshell, Nordic curl, A-skip, drop jump, eccentric heel drops, etc. (Beattie 2017, Lauersen 2014, Saunders 2006).
  - **Auto-adattamento**: il piano si aggiorna automaticamente ad ogni sync Strava (ACWR, TSB, VDOT drift, compliance, taper).
  - **Richiede deploy backend su Render** per essere attivo.

## Todo

- [ ] **Gamification — Badge & Trofei**: implementare sistema badge con 100+ trofei in 8 categorie: Milestone distanza, Costanza, Miglioramenti, Allenamento, Mezza maratona, Scienza, Velocità lampo, Fun & Speciali. Vedi specifica completa in chat.

- [ ] **Garmin Sync — Verifica dinamiche di corsa**: verificare su Activities che la sincronizzazione Garmin estragga correttamente i valori di Rapporto verticale medio, Oscillazione verticale media e Tempo medio di contatto con il suolo.
