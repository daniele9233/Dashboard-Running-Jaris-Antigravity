import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  AnalyticsChartCard,
  ChartCard,
  ChartHeader,
  ChartKpi,
  ChartKpiStrip,
  ChartLegend,
  ChartPlot,
  ChartRangeSelector,
  ChartStat,
  ChartStats,
  ChartTooltip,
  ChartTooltipContent,
  entryColor,
  formatDelta,
} from './index';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('AnalyticsChartCard', () => {
  it('compone testata, KPI, plot, legenda, statistiche e nota nell\'ordine del contratto', () => {
    const out = html(
      <AnalyticsChartCard
        title="Carico settimanale"
        description="Ultimi 90 giorni"
        actions={<span>azioni</span>}
        kpis={<span>kpi</span>}
        legend={<span>legenda</span>}
        stats={<span>stat</span>}
        insight="Come si legge"
        size="tall"
      >
        <svg data-testid="grafico" />
      </AnalyticsChartCard>,
    );
    const order = ['Carico settimanale', 'azioni', 'kpi', 'grafico', 'legenda', 'stat', 'Come si legge'].map((s) => out.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(out).toContain('ea-plot--tall');
    expect(out).toContain('ea-card');
  });

  it('la card è etichettata dal suo titolo (aria-labelledby → id dell\'heading)', () => {
    const out = html(<AnalyticsChartCard title="VO₂max">x</AnalyticsChartCard>);
    const labelled = out.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelled).toBeTruthy();
    expect(out).toContain(`id="${labelled}"`);
    expect(out).toMatch(/<h3[^>]*class="ea-title"/);
  });

  it('gli stati occupano il plot al posto del grafico', () => {
    const empty = html(<AnalyticsChartCard title="t" status="empty" statusMessage="Nessuna corsa">grafico</AnalyticsChartCard>);
    expect(empty).toContain('Dati insufficienti');
    expect(empty).toContain('Nessuna corsa');
    expect(empty).not.toContain('>grafico<');
    const err = html(<AnalyticsChartCard title="t" status="error" statusMessage="Rete assente">grafico</AnalyticsChartCard>);
    expect(err).toContain('role="alert"');
    const load = html(<AnalyticsChartCard title="t" status="loading">grafico</AnalyticsChartCard>);
    expect(load).toContain('aria-busy="true"');
  });

  it('il riassunto testuale è raggiungibile dal plot', () => {
    const out = html(
      <ChartPlot label="Andamento CTL" summary="La condizione sale da 30 a 38 in 90 giorni">
        <i />
      </ChartPlot>,
    );
    const describedBy = out.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    expect(out).toContain(`id="${describedBy}"`);
    expect(out).toContain('sr-only');
    expect(out).toContain('role="group"');
  });

  it('ChartCard e ChartHeader si usano anche da soli (heatmap, mappe)', () => {
    const out = html(
      <ChartCard flush as="div">
        <ChartHeader title="Heatmap" as="h2" />
      </ChartCard>,
    );
    expect(out).toContain('ea-card--flush');
    expect(out).toContain('<h2');
  });
});

describe('ChartKpi', () => {
  it('senza onClick è un tile; con onClick è un pulsante a due stati', () => {
    expect(html(<ChartKpi label="Forma" value="9.5" />)).toMatch(/^<div class="ea-kpi"/);
    const btn = html(<ChartKpi label="Forma" value="9.5" onClick={() => {}} active />);
    expect(btn).toMatch(/^<button/);
    expect(btn).toContain('aria-pressed="true"');
  });

  it('il colore della serie passa come variabile CSS, non come stile del valore', () => {
    const out = html(<ChartKpi label="Condizione" value="38.1" color="#F59E0B" />);
    expect(out).toContain('--ea-kpi-accent:#F59E0B');
  });

  it('il delta porta il segno nel testo e la direzione come attributo', () => {
    expect(formatDelta(1.44)).toEqual({ text: '+1.4', trend: 'up' });
    expect(formatDelta(-19.1)).toEqual({ text: '-19.1', trend: 'down' });
    expect(formatDelta(0.04)).toEqual({ text: '0.0', trend: 'flat' });
    const out = html(<ChartKpi label="Forma" value="9.5" delta="+17.7" trend="up" />);
    expect(out).toContain('data-trend="up"');
    expect(out).toContain('+17.7');
  });

  it('striscia e statistiche di sintesi', () => {
    expect(html(<ChartKpiStrip><i /></ChartKpiStrip>)).toContain('ea-kpis');
    expect(html(<ChartStats><ChartStat label="Passo medio" value="5:43" /></ChartStats>)).toContain('ea-stats');
  });
});

describe('ChartLegend', () => {
  const items = [
    { key: 'a', label: 'Misurato', color: '#C0FF00', kind: 'line' as const },
    { key: 'b', label: 'Previsione', color: '#818CF8', kind: 'dashed' as const },
    { key: 'c', label: 'Corse', color: '#22D3EE', kind: 'dot' as const },
  ];

  it('il campione riproduce il tratto: il tratteggio c\'è nel markup', () => {
    const out = html(<ChartLegend items={items} />);
    expect(out).toContain('stroke-dasharray="5 3"');
    expect(out).toContain('border-radius:999px');
    expect(out).toContain('aria-label="Legenda"');
  });

  it('con onToggle le voci sono pulsanti e la voce nascosta è aria-pressed=false', () => {
    const out = html(<ChartLegend items={[{ ...items[0], active: false }, items[1]]} onToggle={vi.fn()} />);
    expect(out).toContain('aria-pressed="false"');
    expect(out).toContain('aria-pressed="true"');
    expect(out.match(/<button/g)?.length).toBe(2);
  });
});

describe('ChartRangeSelector', () => {
  it('segna solo l\'intervallo attivo', () => {
    const out = html(
      <ChartRangeSelector value="3m" options={[{ value: '1m', label: '1M' }, { value: '3m', label: '3M' }, { value: '6m', label: '6M' }]} onChange={() => {}} />,
    );
    expect(out.match(/aria-pressed="true"/g)?.length).toBe(1);
    expect(out.match(/aria-pressed="false"/g)?.length).toBe(2);
    expect(out).toContain('role="group"');
  });

  it('accetta anche una lista semplice di valori (etichetta in maiuscolo)', () => {
    const out = html(<ChartRangeSelector value="90d" options={['7d', '30d', '90d']} onChange={() => {}} />);
    expect(out).toContain('>90D<');
  });
});

describe('ChartTooltip', () => {
  it('non disegna nulla senza righe', () => {
    expect(html(<ChartTooltip title="x" rows={[]} />)).toBe('');
  });

  it('titolo, pallino di serie, nome e valore in mono tabulare', () => {
    const out = html(<ChartTooltip title="21 ott" rows={[{ label: 'CTL', value: '38.1', color: '#F59E0B' }]} />);
    expect(out).toContain('21 ott');
    expect(out).toContain('background:#F59E0B');
    expect(out).toContain('ea-tooltip__value');
  });

  it('l\'adattatore Recharts scarta i valori nulli e ignora i gradienti come colore', () => {
    const payload = [
      { name: 'CTL', value: 38.1, stroke: '#F59E0B', dataKey: 'ctl' },
      { name: 'ATL', value: null, stroke: '#F43F5E', dataKey: 'atl' },
      { name: 'Barre', value: 3, fill: 'url(#grad)', dataKey: 'b' },
    ] as never;
    const out = html(<ChartTooltipContent active payload={payload} label="12 set" valueFormatter={(v) => `${v} u`} />);
    expect(out).toContain('CTL');
    expect(out).not.toContain('ATL');
    expect(out).toContain('38.1 u');
    expect(out.match(/ea-tooltip__dot/g)?.length).toBe(1);
    expect(entryColor({ fill: 'url(#grad)' } as never)).toBeUndefined();
  });

  it('inattivo o senza payload: nulla', () => {
    expect(html(<ChartTooltipContent active={false} payload={[]} />)).toBe('');
  });

  it('la funzione `row` riscrive o nasconde le righe', () => {
    const payload = [{ name: 'a', value: 1 }, { name: 'b', value: 2 }] as never;
    const out = html(<ChartTooltipContent active payload={payload} row={(e) => (e.name === 'a' ? null : { label: 'B!', value: 'due' })} />);
    expect(out).toContain('B!');
    expect(out).not.toContain('>a<');
  });
});
