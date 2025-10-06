import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Canonical test directory
    include: ["tests/**/*.test.ts"],
    environment: 'node',
    silent: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'tests/**',
        'dist/**',
        'node_modules/**',
        '*.config.js',
        '*.config.mjs',
        'src/sps/data/**',
        'src/**/*.test.ts',
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
  },
});
