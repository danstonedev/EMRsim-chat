import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      three: path.resolve(__dirname, 'src/test/mocks/three.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: [
      './src/test/setup-jsdom-media.ts',
      './src/test/setup-msw.ts',
    ],
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'src/test/**',
        'dist/**',
        'node_modules/**',
        '*.config.ts',
        '*.config.js',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
      // Show uncovered lines in output
      all: true,
      clean: true,
    },
  }
});
