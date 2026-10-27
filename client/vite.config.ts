import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The browser calls same-origin /api/v1/... and Vite forwards it to the Express
// backend, so the backend needs no CORS changes.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.CAMPUSHUB_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
