import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const finlitSrc = path.resolve(__dirname, '../shared/finlit-engine/src');
const apiContractSrc = path.resolve(__dirname, '../shared/api-contract/src');

// assets/ is Vite's publicDir (served at URL root). Shared packages resolve to
// TypeScript source so player HMR picks up engine/contract edits without a
// separate package rebuild during `npm run dev:player`.
export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, 'assets'),
  resolve: {
    alias: [
      { find: '@gamesim/api-contract', replacement: apiContractSrc },
      { find: '@gamesim/finlit-engine/config', replacement: path.join(finlitSrc, 'config') },
      { find: '@gamesim/finlit-engine', replacement: finlitSrc },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
  },
});
