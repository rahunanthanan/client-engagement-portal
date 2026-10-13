import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite build for the main application.
 *
 * - Heavy, rarely used libraries (bpmn-js, dmn-js, form-js) are split into their own
 *   chunks and are only loaded by lazily imported routes/components.
 * - `pnpm analyze` builds with mode "analyze" and then prints a gzip size table
 *   (scripts/report-bundle-size.mjs) so optimisation starts from measurements.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    sourcemap: mode === 'analyze' ? true : 'hidden',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](bpmn-js|diagram-js|bpmn-moddle|moddle)[\\/]/.test(id)) return 'vendor-bpmn';
          if (/[\\/](dmn-js[^\\/]*|dmn-moddle|table-js)[\\/]/.test(id)) return 'vendor-dmn';
          if (/[\\/]@bpmn-io[\\/]form-js/.test(id)) return 'vendor-formjs';
          if (/[\\/](@mui|@emotion)[\\/]/.test(id)) return 'vendor-mui';
          if (/[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
}));
