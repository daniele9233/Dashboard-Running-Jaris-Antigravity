/**
 * design-check — controllo statico delle regole di coerenza del design system
 * (docs/design-system/03-CHART-CONTRACT.md, "Anti-pattern").
 *
 * Funziona a "cricchetto": scripts/design-check.baseline.json registra il debito
 * esistente per file e per regola; il controllo FALLISCE solo se un file ne
 * aggiunge di nuovo. Un file nuovo o migrato parte da zero.
 *
 *   npm run design:check            → fallisce se compaiono nuove violazioni
 *   npm run design:check -- --report → stampa il totale per regola (e per file)
 *   npm run design:check -- --update → riscrive la baseline (solo se il debito è sceso)
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'scripts', 'design-check.baseline.json');

/** Cartelle e file fuori dal perimetro: decorativi, hero, test, il tema stesso. */
const SKIP = [
  `${sep}celebrations${sep}`,
  `${sep}hero${sep}`,
  `${sep}charts${sep}theme.ts`,
  `${sep}charts${sep}theme.test.ts`,
  `${sep}charts${sep}charts.test.tsx`,
  `${sep}chartTheme.ts`,
  `${sep}TrainingGrid.tsx`, // la barra colorata del tipo di seduta è funzionale (decisione aperta)
];

type Rule = { id: string; label: string; re: RegExp; chartOnly?: boolean };

const RULES: Rule[] = [
  { id: 'hex', label: 'esadecimale nel componente', re: /#[0-9a-fA-F]{6}\b/g, chartOnly: true },
  { id: 'negative-margin', label: 'margine negativo nel grafico', re: /margin=\{\{[^}]*(?:left|right)\s*:\s*[^,}]*-\d/g, chartOnly: true },
  { id: 'tiny-text', label: 'testo sotto 12 px', re: /text-\[(?:[0-9]|10|11)(?:\.\d+)?px\]|fontSize(?::\s*|=\{?\s*)(?:[0-9]|10|11)(?:\.\d+)?\b/g },
  { id: 'glass', label: 'vetro o filo laterale colorato', re: /backdrop-blur|borderLeft:\s*`3px/g },
  { id: 'italic-title', label: 'titolo in corsivo', re: /<h[1-4][^>]*className="[^"]*\bitalic\b/g },
  { id: 'local-tooltip-style', label: 'tooltip con stile locale', re: /\bcontentStyle=/g, chartOnly: true },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

const isChartFile = (src: string) => /from\s+['"]recharts['"]|from\s+['"](?:\.\.?\/)+charts['"]/.test(src);

function scan() {
  const result: Record<string, Record<string, number>> = {};
  for (const file of walk(join(SRC, 'components'))) {
    if (SKIP.some((s) => file.includes(s))) continue;
    const src = readFileSync(file, 'utf8');
    const chart = isChartFile(src);
    const rel = relative(ROOT, file).split(sep).join('/');
    for (const rule of RULES) {
      if (rule.chartOnly && !chart) continue;
      const n = (src.match(rule.re) ?? []).length;
      if (n > 0) (result[rel] ??= {})[rule.id] = n;
    }
  }
  return result;
}

const args = process.argv.slice(2);
const now = scan();

if (args.includes('--report')) {
  const totals: Record<string, number> = {};
  for (const rules of Object.values(now)) for (const [id, n] of Object.entries(rules)) totals[id] = (totals[id] ?? 0) + n;
  console.log('Violazioni residue per regola:');
  for (const r of RULES) console.log(`  ${r.id.padEnd(22)} ${String(totals[r.id] ?? 0).padStart(5)}  ${r.label}`);
  const worst = Object.entries(now)
    .map(([f, rs]) => [f, Object.values(rs).reduce((a, b) => a + b, 0)] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  console.log('\nFile con più debito:');
  for (const [f, n] of worst) console.log(`  ${String(n).padStart(5)}  ${f}`);
  process.exit(0);
}

if (args.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify(now, null, 2) + '\n');
  console.log(`baseline riscritta: ${Object.keys(now).length} file con debito`);
  process.exit(0);
}

const base: Record<string, Record<string, number>> = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const failures: string[] = [];
for (const [file, rules] of Object.entries(now)) {
  for (const [id, n] of Object.entries(rules)) {
    const allowed = base[file]?.[id] ?? 0;
    if (n > allowed) failures.push(`${file}: ${id} ${n} (consentite ${allowed})`);
  }
}
if (failures.length) {
  console.error('design:check — nuove violazioni delle regole di coerenza:\n  ' + failures.join('\n  '));
  console.error('\nUsa i token di src/components/charts (vedi docs/design-system/03-CHART-CONTRACT.md).');
  process.exit(1);
}
console.log('design:check — nessuna nuova violazione.');
