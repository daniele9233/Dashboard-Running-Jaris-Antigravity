# Project instructions

<!-- kikko:memory:start -->
_Project memory — auto-maintained by kikkoCode. Last update: 2026-07-26 17:18. Do not edit inside the markers._

### Preferences
- Lingua: italiano per interazioni.
- Skill `graphify-windows` per analisi codebase → knowledge graph.
- Con taste/impeccable: analisi e critica, NON generare codice né riscrivere testi (salvo richiesta esplicita successiva).
- Progetto "Metic Lab" — dashboard atletica personale (corsa, Garmin).

### Commands
- `npm run dev` → FastAPI backend (:8000) + Vite frontend (:3000) in parallelo.
- `npm run lint` → `tsc --noEmit` typecheck.
- `npm run test` / `test:watch` / `test:coverage` → vitest.
- `npm run format` → prettier su `src/**/*.{ts,tsx,js,jsx,json,css,md}`.
- `npm run context:update` / `context:check` → aggiorna contesto AI da scripts.
- `graphify` v0.8.21 (Python 3.13); output in `graphify-out/` (graph.html, GRAPH_REPORT.md, graph.json, manifest.json, cache/).

### Decisions
- Stack: React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS 4 (frontend), FastAPI + MongoDB (backend), Recharts per grafici.
- Widget dashboard via `react-grid-layout`, layout drag-resize personalizzabile.
- Design token: accent primario `#C0FF00` (lime), `chartTheme` condiviso tra tutti i widget.
- Backend integra Garmin Connect via garth (auth OAuth/ticket-based, API reverse-engineered — rischio legale per commercializzazione).
- `AUTH_ENABLED` flag nel backend per toggle single/multi-tenant.
- Pipeline graphify: AST su tutti i file code; subagent semantici solo su non-code (doc+immagini).
- "Trasforma questo" → rebuild completo (non `--update` incrementale) per integrazione pulita.
- Community labeling via word-frequency sui label dei nodi (euristica per >200 community).
- `PaceCalculator.tsx`: calcolatore distanza/tempo/passo con preset 5K/10K/Mezza/Maratona, previsioni Riegel, zone VDOT.
- `PeriodComparison.tsx`: confronto periodi puro client-side.
- `EnvironmentalNormalizerView.tsx`: normalizzazione meteo (fetch Open-Meteo, penalità ambientale, grafico Actual vs STP).
- Weather normalizer integrato (FE + BE endpoint + MongoDB).
- Nessun file LICENSE nel repo → default "all rights reserved". Dipendenze tutte MIT-compatibili.

### Gotchas
- Windows: encoding cp1252 fallisce su stdout con path non-ASCII. Fix: scrivere JSON UTF-8 direttamente da Python, evitare `print` di path.
- Subagent general-purpose in questo runtime NON scrivono file su disco (task_result vuoto). Workaround: estrazione manuale via script Python.
- Corpus >200 file triggera soglia ma procedere comunque su tutto il progetto se richiesto esplicitamente.
- FC di soglia anaerobica hardcodata a 163 bpm in `DashboardView.tsx:149` (da rendere dinamica).

### Conventions
- Path alias `@/*` → `./*` (root project).
- i18n via i18next, theme dark/light via ThemeContext.
- File sensibili saltati automaticamente dal detect (es. secrets).
- `repo-map.md` e `graphify-out/` sono auto-generati — non modificare a mano.
<!-- kikko:memory:end -->
