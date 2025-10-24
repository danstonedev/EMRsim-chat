import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  minify: false,
  bundle: true,
  splitting: false,
  treeshake: true,
  dts: false,
  // Don't bundle Node.js built-ins or problematic dependencies
  external: [
    'better-sqlite3',
    'dotenv',
    'fs',
    'path',
    'http',
    'https',
    'crypto',
    'stream',
    'util',
    'url',
    'zlib',
    'events',
    'os',
    'net',
  ],
  noExternal: [],
});
