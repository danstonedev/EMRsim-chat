# Program Execution Plan (Agent-Ready)

Last Updated: 2025-10-17

This is the single progress log for both LLM agent teams working in parallel. Append your entries at the TOP of your team section.

## How to log progress

- Format: `- YYYY-MM-DD HH:mm (TZ): <Task ID/Name> — Outcome (✅/⚠️/❌). Notes: <1-2 lines>. Commands: <short list>.`
- If blocked, add `BLOCKED:` with the reason and leave a code comment near the target: `// AGENT: BLOCKED - <reason>`.
- Link to PRs and paste key command outputs in the PR description.

Example entry:

- 2025-10-17 14:12 (CT): A2 Redis token store — ✅ Tests green. Replaced in-memory map; added `services/redisClient.ts`. Commands: `cd backend; npm test`.

## Mandatory pre-flight for every task (PowerShell)

- Ensure dependencies:
  - Backend
    - `cd backend`
    - `if (!(Test-Path node_modules)) { npm i }`
  - Frontend
    - `cd frontend`
    - `if (!(Test-Path node_modules)) { npm i }`
- Before commit, always run:
  - Backend: `cd backend; npm run -s test`
  - Frontend: `cd frontend; npm run -s type-check; npm run -s test`
- Prefer VS Code tasks where provided (Terminal > Run Task).

## Acceptance checklist for PRs

- Code + tests + docs updated
- Command outputs pasted into PR description
- No new lint/type errors
- Backend API changes: OpenAPI updated + contract tests green
- UI performance changes: render metrics snapshot added/updated in `docs/perf/`

---

## Team Atlas Progress (Backend/Platform)

- (add newest entries here)

## Team Nova Progress (Frontend/Voice UX)

- (add newest entries here)

---

## Coordination Gates

- Contract/API changes must include OpenAPI updates and passing contract tests before Nova consumes.
- Nova can remove legacy implementations only after replacement passes unit + integration tests and Playwright smoke.
- Nightly CI must be green (lint, unit, contract, soak, Playwright) before tagging milestones.
