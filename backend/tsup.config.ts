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
  external: ['better-sqlite3'],
  noExternal: [/(.*)/],
});
