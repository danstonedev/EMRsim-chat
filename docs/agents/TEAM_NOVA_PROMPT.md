# Team Nova Prompt (Frontend/Voice UX)

Use Windows PowerShell. Work in `frontend/` unless specified. Follow PROGRAM_EXECUTION_PLAN.md logging rules.

## Non-negotiables

- Before and after edits, run:
  - `cd frontend`
  - `if (!(Test-Path node_modules)) { npm i }`
  - `npm run -s type-check; npm run -s test`
- For perf changes, capture render metrics before/after in `docs/perf/`.
- When blocked, add `// AGENT: BLOCKED - <reason>` and log in the plan.

## Sprint A

### Task N1 — Render metrics baseline tooling

- Files:
  - `frontend/package.json` (add `perf:baseline` script)
  - `frontend/scripts/render-metrics-baseline.mjs` (new)
  - `docs/perf/metrics-baseline.md` (new)
- Commands:
  - `cd frontend; npm run -s type-check; npx vitest run src/shared/utils/renderProfiler.test.tsx`
  - `npm run -s perf:baseline`
- Acceptance:
  - Baseline script produces a markdown table with commit counts per instrumented component.

### Task N2 — Adopt useBackendSocket everywhere

- Files:
  - Replace `BackendSocketManager` class usages with `useBackendSocket` in relevant consumers (search repo)
  - Remove class if fully unused
  - Update tests accordingly
- Commands:
  - `cd frontend; npm run -s type-check; npx vitest run src/shared/hooks/useBackendSocket.test.ts`
- Acceptance:
  - Typecheck passes; hook tests pass; no regressions in socket integration tests.

## Sprint B

### Task N3 — Integration validation for voice flows

- Files:
  - `src/shared/__tests__/ConversationController.voice.test.ts` (ensure reconnection scenarios are covered after hook swap)
- Commands:
  - `cd frontend; npx vitest run src/shared/__tests__/ConversationController.voice.test.ts`
- Acceptance:
  - Voice reconnection scenarios green.

### Task N4 — Render optimization per metrics

- Files:
  - Apply memoization/Suspense/transition to hot spots (ChatView, MessagesList, Viewer3D)
  - Update/extend tests to assert commit ceilings
- Commands:
  - `cd frontend; npm run -s type-check; npm run -s test`
- Acceptance:
  - Measurable reduction in commits in updated baseline; tests enforce ceilings.

## Sprint C

### Task N5 — Accessibility & Three.js hygiene

- Files:
  - Add ARIA/focus improvements; centralize Three.js import to avoid duplicate warnings
- Commands:
  - `cd frontend; npm run -s lint; npm run -s test`
- Acceptance:
  - No duplicate Three.js warnings in tests; a11y lint passes.

### Task N6 — CI wiring for frontend

- Files:
  - `.github/workflows/frontend-ci.yml`
- Pipeline:
  - type-check, vitest, (optional) Playwright smoke
- Acceptance:
  - Workflow runs and passes on PRs.
