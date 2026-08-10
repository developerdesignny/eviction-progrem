import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Client dev server proxies /api to Express so dev is same-origin too —
// the httpOnly JWT cookie then works without any CORS configuration.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/public',
    emptyOutDir: true,
  },
});
