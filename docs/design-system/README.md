# Elite Analytics — design system (METIC LAB)

Refactoring di coerenza visiva dei grafici e delle viste analitiche. Branch: `design/elite-analytics-design-system` (da `main` a `791fb974`).

| Documento | Contenuto |
|---|---|
| [`../../PRODUCT.md`](../../PRODUCT.md) | verità di prodotto (utenti, scopo, vincoli) — Impeccable `init` |
| [`../../DESIGN.md`](../../DESIGN.md) | il sistema: North Star "The Instrument Panel", colori, tipografia, forme, componenti, regole — Impeccable `document`. Lo spec dell'intro hero è ora in [`../hero-page/DESIGN-HERO.md`](../hero-page/DESIGN-HERO.md) |
| [`01-AUDIT.md`](./01-AUDIT.md) | audit (Fase 0–1): metodo, numeri, matrice delle incoerenze per causa e severità, rischi, piano per rotta |
| [`INVENTORY-baseline.md`](./INVENTORY-baseline.md) | inventario riga per riga dei grafici (misurato nel browser + estratto dal sorgente) prima delle modifiche |
| [`02-TOKENS.md`](./02-TOKENS.md) | token: colori, testo, tipografia, spaziatura, forme, altezze, movimento; decisione sulla palette proposta |
| [`03-CHART-CONTRACT.md`](./03-CHART-CONTRACT.md) | contratto del grafico, componenti, preset Recharts, famiglie, regole SVG, accessibilità, responsive, anti-pattern |
| [`04-MIGRATION-LOG.md`](./04-MIGRATION-LOG.md) | rotte migrate, eccezioni, decisioni aperte, debito residuo |
| [`05-VERIFICATION.md`](./05-VERIFICATION.md) | build, test, controlli statici, prima/dopo misurato, responsive, quality gate con esito |

Skill per Claude: `.agents/skills/elite-analytics-charts/` (tracciata; collegamento locale in `.claude/skills/`, vedi `04`).

Codice: `src/design/` (token e classi CSS) · `src/components/charts/` (tema, componenti, test) · `scripts/design-codemod.py`, `scripts/prune-imports.py`, `scripts/design-check.ts` (+ `npm run design:check`).

## Screenshot

`docs/design-system/screenshots/{baseline,after}/` contengono 114 immagini ciascuna (19 pagine × 6 viewport: 1920×1080, 1440×900, 1280×800, 768×1024, 390×844, 360×800) e le metriche di pagina (`_metrics_*.json`).
**Sono in `.gitignore`**: mostrano dati personali reali (nome, corse, percorsi) e il repository è pubblico. Dati registrati dal backend locale e riprodotti, orologio fisso al 2026-10-21 10:00 Europe/Rome, animazioni spente, mappe bloccate: il confronto prima/dopo è riproducibile. Gli script di cattura stanno fuori dal repository (usano `playwright-core` + Chrome).
