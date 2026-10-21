import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHART_SERIES,
  CHART_SERIES_ORDER,
  CHART_STATUS,
  CHART_SURFACE,
  CHART_TEXT,
  CHART_WORKOUT,
  CHART_ZONES,
  PLOT_HEIGHT,
  chartAxis,
  chartGrid,
  chartYAxis,
  contrastRatio,
  seriesDash,
  seriesStroke,
} from './theme';

const css = readFileSync(resolve(__dirname, '../../design/tokens.css'), 'utf8');
const cssToken = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} non trovato in tokens.css`);
  return m[1].toUpperCase();
};

describe('theme ↔ tokens.css', () => {
  it('le superfici coincidono', () => {
    expect(CHART_SURFACE.ink).toBe(cssToken('color-ea-ink'));
    expect(CHART_SURFACE.panel).toBe(cssToken('color-ea-surface-1'));
    expect(CHART_SURFACE.panelSoft).toBe(cssToken('color-ea-surface-2'));
    expect(CHART_SURFACE.raised).toBe(cssToken('color-ea-surface-3'));
    expect(CHART_SURFACE.border).toBe(cssToken('color-ea-hairline'));
    expect(CHART_SURFACE.borderStrong).toBe(cssToken('color-ea-hairline-strong'));
    expect(CHART_SURFACE.grid).toBe(cssToken('color-ea-grid'));
  });

  it('il testo coincide', () => {
    expect(CHART_TEXT.primary).toBe(cssToken('color-ea-text'));
    expect(CHART_TEXT.muted).toBe(cssToken('color-ea-text-muted'));
    expect(CHART_TEXT.axis).toBe(cssToken('color-ea-text-axis'));
    expect(CHART_TEXT.faint).toBe(cssToken('color-ea-text-faint'));
  });

  it('le serie coincidono', () => {
    expect(CHART_SERIES.primary).toBe(cssToken('color-ea-lime'));
    expect(CHART_SERIES.compare).toBe(cssToken('color-ea-cyan'));
    expect(CHART_SERIES.tertiary).toBe(cssToken('color-ea-violet'));
    expect(CHART_SERIES.load).toBe(cssToken('color-ea-amber'));
    expect(CHART_SERIES.risk).toBe(cssToken('color-ea-rose'));
    expect(CHART_SERIES.positive).toBe(cssToken('color-ea-green'));
    expect(CHART_SERIES.projected).toBe(cssToken('color-ea-indigo'));
  });

  it('zone, tipi di seduta e stati coincidono', () => {
    CHART_ZONES.forEach((c, i) => expect(c).toBe(cssToken(`color-ea-zone-${i + 1}`)));
    (Object.keys(CHART_WORKOUT) as (keyof typeof CHART_WORKOUT)[]).forEach((k) =>
      expect(CHART_WORKOUT[k]).toBe(cssToken(`color-ea-workout-${k}`)),
    );
    (Object.keys(CHART_STATUS) as (keyof typeof CHART_STATUS)[]).forEach((k) =>
      expect(CHART_STATUS[k]).toBe(cssToken(`color-ea-status-${k}`)),
    );
  });

  it("le altezze di plot coincidono con le variabili CSS", () => {
    (Object.keys(PLOT_HEIGHT) as (keyof typeof PLOT_HEIGHT)[]).forEach((k) => {
      const m = css.match(new RegExp(`--ea-plot-${k}:\\s*(\\d+)px`));
      expect(Number(m?.[1])).toBe(PLOT_HEIGHT[k]);
    });
  });
});

describe('contrasto (WCAG 2.1)', () => {
  const panel = CHART_SURFACE.panel;

  it('il testo informativo supera 4.5:1 su card e su tile', () => {
    for (const bg of [CHART_SURFACE.panel, CHART_SURFACE.panelSoft]) {
      expect(contrastRatio(CHART_TEXT.primary, bg)).toBeGreaterThan(15);
      expect(contrastRatio(CHART_TEXT.muted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(CHART_TEXT.axis, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('il testo "faint" resta decorativo (sotto 4.5:1) e non è usato per gli assi', () => {
    expect(contrastRatio(CHART_TEXT.faint, panel)).toBeLessThan(4.5);
    expect(chartAxis.tick.fill).toBe(CHART_TEXT.axis);
  });

  it('ogni colore di serie è un grafico leggibile (≥3:1) e un testo leggibile (≥4.5:1)', () => {
    Object.entries(CHART_SERIES).forEach(([name, c]) => {
      expect(contrastRatio(c, panel), name).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('la griglia è discreta: percepibile ma molto sotto i dati', () => {
    expect(contrastRatio(CHART_SURFACE.grid, panel)).toBeLessThan(1.5);
  });
});

/* Simulazione dei deficit della visione dei colori (Machado et al., 2009, severità 1.0). */
const MACHADO: Record<string, number[][]> = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const toLinear = (h: string) =>
  [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
const toLab = ([r, g, b]: number[]): number[] => {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const simulate = (hex: string, mode?: string) => {
  const lin = toLinear(hex);
  if (!mode) return toLab(lin);
  const m = MACHADO[mode];
  return toLab(m.map((row) => row.reduce((s, k, j) => s + k * lin[j], 0)));
};
const deltaE = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('palette e daltonismo', () => {
  const modes = [undefined, 'deuteranopia', 'protanopia', 'tritanopia'];

  it('le prime quattro serie categoriche restano distinguibili in ogni visione', () => {
    const first = CHART_SERIES_ORDER.slice(0, 4);
    for (const mode of modes) {
      for (let i = 0; i < first.length; i++) {
        for (let j = i + 1; j < first.length; j++) {
          const d = deltaE(simulate(first[i], mode), simulate(first[j], mode));
          expect(d, `${first[i]} vs ${first[j]} (${mode ?? 'normale'})`).toBeGreaterThanOrEqual(25);
        }
      }
    }
  });

  it('dalla quinta serie il tratteggio rinforza il colore', () => {
    expect(seriesDash(0)).toBeUndefined();
    expect(seriesDash(3)).toBeUndefined();
    expect(seriesDash(4)).toBeTruthy();
    expect(seriesDash(5)).not.toBe(seriesDash(4));
  });

  it('rosso e verde non sono mai l\'unico segnale: sono vicini per chi ha la deuteranopia', () => {
    // Documenta il vincolo: rischio/miglioramento portano sempre segno o etichetta.
    const d = deltaE(simulate(CHART_SERIES.risk, 'deuteranopia'), simulate(CHART_SERIES.positive, 'deuteranopia'));
    expect(d).toBeLessThan(25);
  });
});

describe('preset Recharts', () => {
  it('assi e griglia leggono dal tema, mai da esadecimali locali', () => {
    expect(chartGrid.stroke).toBe(CHART_SURFACE.grid);
    expect(chartAxis.tick.fontSize).toBeGreaterThanOrEqual(12);
    expect(chartAxis.axisLine).toBe(false);
    expect(chartYAxis.width).toBeGreaterThan(0);
  });

  it('misurato è continuo; previsto e scenario sono tratteggiati e diversi fra loro', () => {
    const obs = seriesStroke('#fff', 'observed');
    const der = seriesStroke('#fff', 'derived');
    const prj = seriesStroke('#fff', 'projected');
    const scn = seriesStroke('#fff', 'scenario');
    expect('strokeDasharray' in obs).toBe(false);
    expect('strokeDasharray' in der).toBe(false);
    expect(obs.strokeWidth).toBeGreaterThan(der.strokeWidth);
    expect((prj as { strokeDasharray: string }).strokeDasharray).toBeTruthy();
    expect((scn as { strokeDasharray: string }).strokeDasharray).toBeTruthy();
    expect((prj as { strokeDasharray: string }).strokeDasharray).not.toBe(
      (scn as { strokeDasharray: string }).strokeDasharray,
    );
  });
});
