import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// We keep the existing assets/ folder untouched and serve it as the public dir.
// Files in assets/ are served at the URL root (e.g. /img/logo.png).
export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, 'assets'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
