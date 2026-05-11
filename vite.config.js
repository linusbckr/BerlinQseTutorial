import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // Required for GitHub Pages deployment in a sub-directory repo
  base: './',

  server: {
    headers: {
      // Prevent stale Arrow/GeoJSON files from being served from browser cache
      'Cache-Control': 'no-cache',
    },
  },

  optimizeDeps: {
    // Pre-bundle Arrow so Vite doesn't choke on its ESM exports
    include: ['apache-arrow'],
    esbuildOptions: {
      target: 'esnext',  // Arrow uses BigInt64Array
    },
  },

  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'deck-gl':  ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/react'],
          'maplibre': ['maplibre-gl', 'react-map-gl'],
          'arrow':    ['apache-arrow'],
          'radix':    [
            '@radix-ui/react-select',
            '@radix-ui/react-slider',
            '@radix-ui/react-tooltip',
          ],
        },
      },
    },
  },
});
