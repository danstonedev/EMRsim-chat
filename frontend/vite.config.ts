import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const isWindows = Boolean((globalThis as any)?.process?.platform === 'win32');

export default defineConfig({
  plugins: [
    react(),
    // Dev-only plugin: rescan animations folder and regenerate manifest on file changes
    (function scanAnimationsPlugin(): Plugin {
      const animsRel = ['public','models','animations']
      const outRel = ['src','pages','components','viewer','animations','manifest.generated.json']
      let root = ''
      function scanAndWrite(server?: any) {
        try {
          const animsDir = join(root, ...animsRel)
          const outFile = join(root, ...outRel)
          const files = readdirSync(animsDir)
            .filter(f => f.toLowerCase().endsWith('.glb'))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
          const json = { files }
          writeFileSync(outFile, JSON.stringify(json, null, 2), 'utf8')
          server?.ws?.send?.({ type: 'full-reload' })
          // eslint-disable-next-line no-console
          console.log(`[vite:scan-animations] updated ${outFile} with ${files.length} files`)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[vite:scan-animations] scan failed:', err)
        }
      }
      return {
        name: 'scan-animations',
        apply: 'serve',
        configureServer(server) {
          root = server.config.root || process.cwd()
          // initial scan on dev startup
          scanAndWrite(server)
          // watch for changes in animations dir
          const toWatch = join(root, ...animsRel)
          server.watcher.add(toWatch)
          server.watcher.on('add', (file) => { if (file.includes('models\\animations') || file.includes('models/animations')) scanAndWrite(server) })
          server.watcher.on('unlink', (file) => { if (file.includes('models\\animations') || file.includes('models/animations')) scanAndWrite(server) })
          server.watcher.on('change', (file) => { if (file.endsWith('.glb') && (file.includes('models\\animations') || file.includes('models/animations'))) scanAndWrite(server) })
        },
      }
    })(),
  ],
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
      overlay: true, // Show error overlay
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['three/examples/jsm/controls/OrbitControls'],
  },
});
