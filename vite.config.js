import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite builds the React SPA into `dist/`, which Vercel serves as static assets.
// During local development, `/api` requests are proxied to the Express server
// (run `npm run server` alongside `npm run dev`).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
