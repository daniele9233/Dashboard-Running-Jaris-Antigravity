---
name: METIC LAB · Elite Analytics
description: Cruscotto scuro di analisi della corsa — numeri in mono tabulare, un solo accento lime, il colore significa una cosa sola.
colors:
  volt-lime: "#C0FF00"
  ink: "#050505"
  surface-1: "#0E0E0E"
  surface-2: "#141414"
  surface-3: "#1A1A1A"
  hairline: "#1E1E1E"
  hairline-strong: "#2A2A2A"
  text-primary: "#FFFFFF"
  text-muted: "#A0A0A0"
  text-axis: "#8A8A8A"
  text-faint: "#666666"
  aerobic-cyan: "#22D3EE"
  structure-violet: "#A78BFA"
  threshold-amber: "#F59E0B"
  risk-rose: "#F43F5E"
  recovery-green: "#22C55E"
  projection-indigo: "#818CF8"
typography:
  kpi:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "36px"
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "24px"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.06em"
  axis:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    fontFeature: "tnum"
rounded:
  control: "8px"
  tile: "12px"
  card: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  card: "20px"
  xl: "24px"
  xxl: "32px"
components:
  chart-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "20px"
  kpi-tile:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.tile}"
    padding: "12px 16px"
  range-selector-active:
    backgroundColor: "{colors.volt-lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "4px 12px"
  tooltip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.tile}"
    padding: "10px 14px"
---

# Design System: METIC LAB · Elite Analytics

## Overview

**Creative North Star: "The Instrument Panel"**

Un cruscotto di strumentazione scientifica, non una dashboard da template. Ogni grafico è uno strumento di misura: si legge, non si ammira. I numeri stanno in monospazio tabulare così le cifre non ballano sotto il cursore; il nero è stratificato in livelli tonali piatti (nessun vetro, nessun alone); il lime è l'unica voce di marca e indica la metrica primaria. Tutto il resto del colore ha un significato fisso: lo stesso concetto ha lo stesso colore in ogni rotta.

La densità è alta ma calma. Un atleta evoluto deve poter confrontare Carico & Forma con Biomeccanica passando da una scheda all'altra e riconoscere subito la stessa mano: stessa card, stessa testata, stessi assi, stessa legenda, stesso tooltip. I grafici hanno forme diverse (serie temporale, barre, dispersione, radar) ma la stessa identità.

**Key Characteristics:**
- Un solo accento di marca (lime) e una palette semantica chiusa: il colore indica il ruolo della metrica, mai il capriccio del file.
- Superfici piatte e tonali; profondità data dal livello di nero e da un filo di bordo, non da blur o gradienti decorativi.
- Cifre sempre in JetBrains Mono con `tabular-nums`; testo informativo mai sotto i 12 px.
- Misurato, derivato e previsto si distinguono sempre per tratto (continuo, continuo sottile con area, tratteggiato), mai per solo colore.
- Nessuna decorazione che non serva alla lettura: niente glow, niente gradienti su testo, niente card dentro card.

## Colors

Nero stratificato più un accento chirurgico; sei colori di metrica con significato fisso.

### Primary
- **Volt Lime** (#C0FF00): marchio e metrica primaria (valore attuale, selezione, serie principale). Contrasto 16:1 su `surface-1`. Va usato per l'informazione che conta di più nella schermata, non per riempire.

### Secondary (metriche)
- **Aerobic Cyan** (#22D3EE): confronto, seconda serie, lavoro aerobico, zona 1.
- **Threshold Amber** (#F59E0B): carico, soglia, attenzione, zona 4.
- **Risk Rose** (#F43F5E): rischio, fatica, deriva, frequenza cardiaca, zona 5.
- **Recovery Green** (#22C55E): recupero, progresso positivo, forma fresca, obiettivo raggiunto.
- **Structure Violet** (#A78BFA): biomeccanica e struttura (cadenza, contatto al suolo), terza serie categorica.
- **Projection Indigo** (#818CF8): dato modellato o scenario ipotetico; sempre tratteggiato. È il tono 400 di indigo, scelto perché il tono 500 non raggiunge 4.5:1 come testo.

### Neutral
- **Ink** (#050505): fondo dell'app.
- **Surface 1** (#0E0E0E): card di grafico e di sezione.
- **Surface 2** (#141414): tile KPI, tooltip, controlli segmentati: un livello sopra la card.
- **Surface 3** (#1A1A1A): hover e popover: due livelli sopra la card.
- **Hairline** (#1E1E1E) e **Hairline Strong** (#2A2A2A): bordi, griglia, cursore.
- **Text Primary** (#FFFFFF, 19:1), **Text Muted** (#A0A0A0, 7.4:1), **Text Axis** (#8A8A8A, 5.6:1), **Text Faint** (#666666, 3.4:1: solo decorativo, mai informativo).

### Named Rules
**The One Meaning Rule.** Un colore, un significato, in tutte le rotte. Il lime non è mai "positivo", il verde non è mai "serie primaria". Un'eccezione si documenta nel file in cui nasce.

**The Not-Color-Alone Rule.** Rischio, miglioramento e peggioramento si leggono anche senza colore: segno (+/−), icona o etichetta di testo, e per più di tre serie anche tratteggio e marcatore.

**The Zone Ramp Rule.** Le zone di intensità Z1→Z5 usano una rampa propria (cyan → verde → lime → ambra → rosa-rosso) e non si mescolano con i colori di metrica.

## Typography

**UI Font:** Inter (con system-ui)
**Data Font:** JetBrains Mono (con ui-monospace)

**Character:** Inter porta titoli, descrizioni e controlli; JetBrains Mono porta ogni numero, asse e unità. Il contrasto fra le due famiglie dice "questo è testo / questa è misura".

### Hierarchy
- **KPI** (mono 700, 32 px, 36 lh, -0.02em, tabular): il valore principale di un indicatore. Variante grande 40 px per il KPI di sezione, piccola 24 px per i tile affiancati.
- **Title** (Inter 700, 18 px, 24 lh): titolo di card. Mai in corsivo, mai in nero 900, mai in maiuscolo.
- **Body** (Inter 400, 14 px, 20 lh): descrizioni, note, interpretazioni.
- **Label** (Inter 600, 12 px, 16 lh, 0.06em, maiuscolo): etichette di KPI e di gruppo.
- **Axis / Caption** (mono 400, 12 px, 16 lh, tabular): tick degli assi, legende, unità, note del grafico.

### Named Rules
**The Twelve Floor Rule.** Nessun testo informativo sotto 12 px. Gli 8, 9, 10 e 11 px che oggi popolano assi e etichette non hanno posto nel sistema.

**The Tabular Rule.** Ogni numero che cambia (KPI, tick, tooltip, delta) usa `font-variant-numeric: tabular-nums`.

## Layout

Griglia a 4 px con ritmo a 8: 4 micro, 8 minimo, 12 compatto, 16 standard, 20 padding di card, 24 fra blocchi interni e fra card, 32 separazione maggiore. Una card di grafico ha sempre la stessa struttura verticale: testata, KPI opzionali, area del grafico, legenda, nota interpretativa; fra i blocchi 16 px.

L'area del grafico ha classi di altezza per famiglia, non altezze fisse globali: compact 160, standard 240, tall 320, hero 360 (ridotte di circa 15% sotto i 768 px). I grafici non si comprimono sotto 240 px di larghezza utile: su telefono le card di grafico passano a colonna singola e le legende vanno a capo.

Responsive strutturale: da 4 colonne a 2 a 1; la barra delle schede di sezione scorre in orizzontale con frecce; nessuno scroll orizzontale di pagina.

## Elevation & Depth

Piatto per scelta. La profondità è tonale: ink → surface-1 → surface-2 → surface-3, separati da un filo di bordo da 1 px. Nessun `backdrop-filter`, nessun gradiente bianco→nero sulle card, nessun alone colorato a offset zero. Un'ombra compare solo sugli overlay che si staccano dalla pagina (tooltip, popover) e ha offset e sfocatura reali.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 8px 24px rgba(0,0,0,0.5)`): tooltip e popover.

### Named Rules
**The Flat-By-Default Rule.** A riposo le superfici sono piatte. Lo stato (hover, focus, selezione) si comunica con bordo e colore, non con luce.

## Shapes

Tre raggi soltanto: 16 px per le card, 12 px per tile e tooltip, 8 px per controlli e chip; le pillole completamente tonde sono riservate ai badge di stato. Le barre dei grafici hanno raggio superiore 4 px. Linee: tratto 2.5 px per la serie misurata, 2 px per la derivata, 1.5 px per i riferimenti; terminali arrotondati. Nessun bordo colorato spesso su un solo lato.

## Components

### Chart Card
- **Corner Style:** 16 px
- **Background:** surface-1, bordo 1 px hairline
- **Internal Padding:** 20 px (16 px sotto 768 px)
- **Struttura:** testata (titolo, descrizione opzionale, azioni, selettore di intervallo) → KPI → plot → legenda → nota. Mai una card dentro la card: i KPI sono tile surface-2 senza bordo proprio ridondante.

### KPI Tile
- **Style:** surface-2, raggio 12 px, padding 12×16, valore in mono tabulare, etichetta label sotto, delta con segno e colore.
- **State:** selezionabile (filtra le serie) con bordo del colore della serie.

### Range Selector
- **Style:** controllo segmentato surface-2 raggio 8 px; voce attiva lime con testo ink.
- **Focus:** anello lime 2 px con offset 2 px.

### Tooltip
- **Style:** surface-2, bordo hairline-strong, raggio 12 px, ombra overlay. Titolo (contesto: data, km) in label, righe con pallino del colore della serie, nome a sinistra, valore mono tabulare a destra.

### Legend
- **Style:** riga di voci, ciascuna con campione che riproduce il tratto della serie (linea, tratteggio, quadrato per barre, punto per dispersione) e nome in 12 px.

### Empty / Loading / Error
- Stesso rettangolo del plot; testo a una riga che dice cosa manca e come recuperare; skeleton a tono surface-2 durante il caricamento.

## Do's and Don'ts

### Do:
- **Do** usare i token (`--ea-*` in CSS, `chartTheme` in TypeScript) per ogni colore, misura e tratto di un grafico.
- **Do** tenere ogni numero in JetBrains Mono tabulare e ogni tick a 12 px o più.
- **Do** distinguere misurato (continuo), derivato (continuo con area), previsto (tratteggio `6 4`), scenario (puntinato `2 4`).
- **Do** mostrare l'intervallo di incertezza solo quando il dato lo fornisce.
- **Do** lasciare i domini, le unità, le scale e la direzione degli assi (passo in min/km invertito) esattamente come li impone il dato.

### Don't:
- **Don't** usare vetro, blur, gradienti bianco→nero o aloni colorati come decorazione di card.
- **Don't** annidare card dentro card.
- **Don't** usare il colore come unico segnale di rischio o miglioramento.
- **Don't** introdurre un tooltip, una legenda o un selettore di intervallo locale per differenze solo estetiche.
- **Don't** scrivere un esadecimale in un componente di grafico: ogni colore passa dal tema.
- **Don't** usare titoli in corsivo nero maiuscolo o etichette sopra il titolo ("kicker") come grammatica di card.
