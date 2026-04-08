# METIC LAB — Roadmap

## Completati

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
