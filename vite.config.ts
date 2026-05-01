import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // /api/* → backend (handles auth, catalogue, favorites/notes, agent SSE).
      // Use 127.0.0.1 explicitly: VS Code / Cursor's auto-forward listens on
      // ::1:8091 and would tunnel our calls to the production server.
      '/api': {
        target: 'http://127.0.0.1:8091',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
});
