# METIC LAB — Roadmap

## Completati

- [x] **Statistics — Deriva Cardiaca**: 2 grafici nel tab Performance — *Historical Drift* (trend storico con KPI + grafico colorato per zona) e *Single Run Drift* (split HR per km con filtro passo costante ±12%). Solo corse qualificate vengono analizzate.

- [x] **Activities — Drift per corsa**: colonne **DRIFT** e **1ª→2ª** aggiunte su ogni card corsa nell'elenco attività. Colorazione per zona (verde/blu/arancione/rosso). Solo per corse a passo costante con dati split HR.

## Todo

- [ ] **Training Plan — Test pre-piano**: prima di generare il piano, far eseguire un test di corsa (es. 3 km) per valutare il livello attuale reale. Usare il risultato del test per calibrare VDOT e costruire il piano di conseguenza. Rivedere tutta la logica di generazione piano.

- [ ] **Gamification — Badge & Trofei**: implementare sistema badge con 100+ trofei in 8 categorie: Milestone distanza, Costanza, Miglioramenti, Allenamento, Mezza maratona, Scienza, Velocità lampo, Fun & Speciali. Vedi specifica completa in chat.

- [ ] **Garmin Sync — Verifica dinamiche di corsa**: verificare su Activities che la sincronizzazione Garmin estragga correttamente i valori di Rapporto verticale medio, Oscillazione verticale media e Tempo medio di contatto con il suolo.
