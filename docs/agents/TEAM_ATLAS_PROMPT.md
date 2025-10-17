# Team Atlas Prompt (Backend/Platform)

Use Windows PowerShell. Work in `backend/` unless specified. Follow PROGRAM_EXECUTION_PLAN.md logging rules.

## Non-negotiables

- Before and after edits, run:
  - `cd backend`
  - `if (!(Test-Path node_modules)) { npm i }`
  - `npm run -s test`
- For API changes, update OpenAPI and add/keep passing contract tests.
- Replace `console.*` with `logger.*` from `src/utils/logger.ts`.
- When blocked, add `// AGENT: BLOCKED - <reason>` and log in the plan.

## Sprint A

### Task A1 — Docker Compose: Redis & Postgres

- Files:
  - `docker-compose.dev.yml` (add `redis`, `postgres` services)
  - `backend/.env.example` (add `REDIS_URL`, `DATABASE_URL`)
  - `docs/PROGRAM_EXECUTION_PLAN.md` (log steps)
- Commands:
  - `docker compose up -d redis postgres`
  - `docker compose ps`
- Acceptance:
  - Compose services healthy, env samples updated, plan updated.

### Task A2 — Redis token store for Realtime

- Files:
  - `backend/src/services/redisClient.ts` (new)
  - `backend/src/index.ts` (connect/disconnect on boot/shutdown)
  - `backend/src/routes/voice.ts` (replace in-memory token Map with Redis setEx/get)
  - Tests: `backend/tests/voice.redis.test.ts` (add)
- Commands:
  - `cd backend; npm run -s test`
- Acceptance:
  - All tests pass; token persistence works with TTL; no regressions when REDIS_URL absent.

## Sprint B

### Task A3 — Introduce ORM and migrations

- Files:
  - `backend/prisma/schema.prisma` or `src/db/schema.ts` (Drizzle)
  - Migration scripts; seed script
  - Adapt `backend/src/db.ts` to use Postgres
- Commands:
  - `cd backend; npm run -s test`
- Acceptance:
  - DB-backed sessions/personas/scenarios; migrations re-runnable; tests green.

### Task A4 — Integration tests for DB paths

- Files:
  - `backend/tests/sessions.integration.test.ts`
- Acceptance:
  - Create session → persist → fetch turns works against Postgres (or mocked layer for CI).

## Sprint C

### Task A5 — Auth & Security

- Files:
  - `backend/src/middleware/auth.ts` (JWT verify)
  - `backend/src/app.ts` (tight CORS; enable CSP with nonce)
- Acceptance:
  - Protected routes require JWT; CSP enabled without breaking docs.

### Task A6 — Logging standardization

- Replace `console.*` with `logger.*` across routes and services.
- Acceptance:
  - No direct console calls remain (except process-level fatal fallback).

## Sprint D

### Task A7 — OpenAPI contract

- Files:
  - `ops/docs/api/openapi.yaml`
  - Generated types if desired
- Acceptance:
  - Contract tests pass against live app.

### Task A8 — Contract tests

- Files:
  - `backend/tests/contract.test.ts`
- Commands:
  - `cd backend; npm run -s test`
- Acceptance:
  - Validates representative endpoints; green in CI.

## Sprint E

### Task A9 — CI workflow

- Files:
  - `.github/workflows/backend-ci.yml`
- Pipeline:
  - Lint (if configured), unit, contract, soak (optional gated)
- Acceptance:
  - Workflow runs and passes on PRs.

### Task A10 — Soak test

- Files:
  - `backend/tests/soak.test.ts`
- Acceptance:
  - 15–30 min stability scenario available (can be skipped locally).
