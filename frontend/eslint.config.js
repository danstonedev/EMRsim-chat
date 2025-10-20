import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import prettierPlugin from 'eslint-plugin-prettier'
import globals from 'globals'

const typescriptConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  // Include TS not only under src but also root config files and TS-based scripts
  files: ['src/**/*.{ts,tsx}', 'vite.config.ts', 'playwright.config.ts', 'scripts/**/*.ts'],
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...config.languageOptions?.parserOptions,
  project: ['./tsconfig.eslint.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
}))

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
  },
  js.configs.recommended,
  ...typescriptConfigs,
  // Node script overrides (.mjs / .cjs / .js in scripts)
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts', 'playwright.config.ts', 'scripts/**/*.ts'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
  // Disable Prettier lint errors; rely on Prettier config/formatter instead
  'prettier/prettier': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Triage: reduce false positives/noise while we incrementally fix
      'no-empty': ['warn', { allowEmptyCatch: true }],
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-floating-promises': ['warn', { ignoreVoid: true, ignoreIIFE: true }],
      '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/unbound-method': 'warn',
      'no-control-regex': 'off',
    },
  },
  // Test overrides (Vitest): relax strict rules inside tests
  {
    files: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      'src/**/__tests__/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
]
