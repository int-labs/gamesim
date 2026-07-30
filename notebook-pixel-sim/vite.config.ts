import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// assets/ is Vite's publicDir (served at URL root). The game — including the
// FinLit engine under src/engine/finlit — is entirely browser-side; the only
// server contact is the gamesim REST API via src/gamesim/client.ts.
export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, 'assets'),
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }],
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
  },
});
