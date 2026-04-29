import { defineConfig } from 'vitest/config';

/**
 * Vitest config — test runner per util puri (paceFormat, racePredictions,
 * cardiacDrift, ecc.). Per attivare:
 *   npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
 *   npm test
 *
 * Convention: file `*.test.ts` accanto al modulo testato (es.
 * `src/utils/paceFormat.test.ts`). Niente `__tests__` folder.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // util puri = no DOM. Usa 'jsdom' per test componenti.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'backend', 'browser-tools-mcp', 'local-whisper'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/utils/**/*.ts', 'src/hooks/**/*.ts'],
      exclude: ['src/utils/telemetry.ts', '**/*.test.ts'],
    },
  },
});
