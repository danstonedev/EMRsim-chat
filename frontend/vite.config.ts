import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isWindows = Boolean((globalThis as any)?.process?.platform === 'win32');

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    watch: isWindows
      ? {
          usePolling: true,
          interval: 750,
          ignored: [
            '**/src/**/*.jsx',
            '**/src/**/main.jsx',
            '**/src/**/App.jsx',
            '**/src/**/api.js',
            '**/src/**/flags.js',
          ],
        }
      : undefined,
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      timeout: 30000,
    },
  },
});
