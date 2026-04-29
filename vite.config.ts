import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const plugins: any[] = [react(), tailwindcss()];

  // Bundle analyzer attivo solo con `vite build --mode analyze`.
  // Output → dist/stats.html (apri con browser).
  // Per attivare: npm i -D rollup-plugin-visualizer
  if (mode === 'analyze') {
    try {
      const { visualizer } = await import('rollup-plugin-visualizer');
      plugins.push(
        visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
          template: 'treemap',
        }) as any,
      );
    } catch {
      console.warn('[vite] rollup-plugin-visualizer non installato. `npm i -D rollup-plugin-visualizer`');
    }
  }

  return {
    plugins,
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      // Code splitting manuale per chunk vendor pesanti.
      // Riduce il chunk principale isolando librerie che cambiano raramente.
      rollupOptions: {
        output: {
          manualChunks: {
            // 3D / mappe: lazy-loaded solo dove servono
            'vendor-three': ['three'],
            'vendor-mapbox': ['mapbox-gl', 'maplibre-gl', 'react-map-gl/mapbox', 'react-map-gl/maplibre', '@mapbox/polyline'],
            // Charting
            'vendor-charts': ['recharts'],
            // Animazioni
            'vendor-motion': ['motion', 'gsap'],
            // i18n
            'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            // AI SDK (~grosso)
            'vendor-genai': ['@google/genai'],
            // React core
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
      // Avviso se chunk supera 600 kB (default 500). Sotto questa soglia: OK.
      chunkSizeWarningLimit: 600,
    },
  };
});
