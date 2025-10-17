# Contributing to EMRsim Chat

Thank you for contributing! This document spells out how Team NOVA and the parallel team work together, our quality gates, and how to get a PR merged smoothly.

## Operating principles

- Research-first: consult current best practices for the relevant layer (React/Vite/TS, Node/Express, testing) before coding.
- Small, incremental diffs with tests.
- Contracts up front per change (inputs/outputs/errors/success criteria).
- Observability-minded: meaningful logs, no noise; consistent error handling.
- Keep public APIs stable; document breaking changes with migration notes.

## Branching and commits

- Branches: `feature/<scope>-<short-desc>`, `fix/<scope>-<short-desc>`, `chore/<scope>`.
- Commits: Conventional style — `feat|fix|chore|docs|refactor|test|perf(scope): summary`.

## Quality gates (must pass)

- Typecheck: frontend + backend
- Unit tests: frontend + backend
- Lint + Prettier: staged via lint-staged; CI runs full repo
- E2E: critical flows (Playwright) for UX-impacting changes

## Definition of Done

- Tests updated/added (happy path + 1–2 edges)
- Env/docs updated if behavior or config changes
- No console errors/warnings for impacted areas
- Logs are structured and minimal; no sensitive data

## Change contract template

Document in the PR description:

- Inputs: files/APIs touched, data shapes, env vars
- Outputs: behavior change, UI/routes, types
- Error handling: expected failures + logging
- Success criteria: typecheck, unit/e2e passing; UX/perf acceptance if relevant

## Working with the parallel team

- Ownership boundaries
  - Frontend: UI, viewer/3D, sockets client, voice UI
  - Backend: API routes, persona/SPS tools, voice token
- Integration rhythm
  - Draft PRs early, daily micro-sync notes, small merges
- Interfaces
  - Versioned API contracts (Zod). Propose schema diffs + update typed client. Add Playwright coverage for cross-team flows.

## PR checklist

- [ ] Typecheck passes (frontend, backend)
- [ ] Unit tests updated/added and passing
- [ ] E2E tests updated/added for impacted flows (or N/A)
- [ ] Lint + Prettier clean
- [ ] Env/docs updated
- [ ] Logs/telemetry meaningful and not noisy
- [ ] Risk noted, rollout/rollback plan included if needed

## Running tests locally

- Frontend
  - Typecheck: `npm run type-check`
  - Unit: `npm test` or targeted suites like `npm run test:viewer`
- Backend
  - Unit/integration: `npm test`
- E2E (from repo root)
  - `npm run test:e2e`

## Troubleshooting

- New tests not discovered: confirm glob in `vitest.config.mjs`
- Flaky e2e: use test retries and diagnostics (video/trace) locally; minimize coupling
- Missing env: copy `.env.example` / `.env.local.example` and restart dev servers
