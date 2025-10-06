# Changelog

## Unreleased

- Unified SPS encounter UI: merged previous SPS drawer into main sidebar. Persona & scenario selection, gate/phase controls, instructions, and SPS mini-chat now coexist with persona picker. Eliminates drawer fetch timing conflicts and simplifies workflow.
- SPS data model: optional `subjective_catalog` added to `ClinicalScenario` (with `SubjectiveItem` schema) to streamline authoring a comprehensive subjective exam without breaking existing flows. Runtime now matches student prompts against `subjective_catalog` after specials/screening.
- Authoring aids: new templates `subjective.template.json` and `objective_tests.template.json`; `scenario.template.json` updated with sample `subjective_catalog` entries; template README updated.
- Removed conversation gating controls: gate state now always reports `UNLOCKED`, realtime instructions no longer nudge on gate completion, and identity assists respond without locked-state messaging.
- Removed legacy SPS text chat endpoints (`/api/sps/compose`, `/api/sps/turn`, `/api/sps/phase`) and frontend helpers; all encounters now create sessions via `/api/sessions` and persist turns through `/api/sessions/:id/sps/turns`.

## v0.2.1 (Persistence, Telemetry, Test Harness)

Enhancements:

- Opt-in SPS session persistence (`SPS_PERSIST=1`) to `backend/data/sps-sessions.json` (debounced 250ms after mutations).
- Structured NDJSON telemetry logging (`SPS_TELEMETRY=1`) to `backend/logs/sps-events.ndjson` capturing `compose`, `turn`, `phase` events.
- MSW-powered frontend test harness with scenario compose, greeting turn, phase advancement coverage.
- Refactored drawer message append logic (avoid duplicate student echo) for cleaner transcript semantics.

Operational Notes:

- Persistence restore skips sessions whose persona/scenario no longer exist.
- Telemetry writes are best-effort; failures are silent to avoid impacting request latency.
- Event fields: `ts`, `type`, plus contextual fields (e.g. `gateState`, `signal`, `text_len`).

## v0.2.0 (SPS Engine API)

- Added Standardized Patient Simulator (SPS) TypeScript core (domain types, zod schemas, registry, gating, objective guardrails)
- Loaded clinical scenarios (hip OA, GTPS, FAI/labral, femoral stress, ACL sprain) with screening & special question banks
- Added in-memory SPS session management with gating heuristic auto-detection
- New endpoints under `/api/sps` (legacy, replaced in vNext by `/api/sessions`):
  - `POST /api/sps/compose` (start encounter)
  - `POST /api/sps/turn` (submit student turn → patient reply + gate state)
  - `POST /api/sps/phase` (advance encounter phase)
  - `GET /api/sps/instructions` (gold standard conduct instructions)
  - `GET /api/sps/scenarios` (scenarios catalog metadata)
- Objective phase consent enforcement & impact test refusal guardrails
- Console telemetry logs for compose, turn, phase actions
- Updated server bootstrap to dynamically load SPS content (personas, challenges, specials, scenarios)
- Frontend: SPS Drawer UI (scenario + persona selection, gating indicators, phase advancement, instructions viewer)
- Added backend route tests (supertest) and frontend component test (Testing Library) for core SPS flows

## v0.1.0 (Walking Skeleton - Text Only)

- Backend: Express server with `/api/health`, `/api/personas`, `/api/sessions` (create, streamed message, end)
- SQLite (WAL) with `personas`, `sessions`, `turns`; seeded 2 personas
- Frontend: Vite + React single page (Chat, PersonaPicker, TTFT MetricsChip)
- Streaming text via fetch ReadableStream emitting `delta` and `done` events
- UND brand tokens via CSS variables; WCAG AA focus visible
- CORS restricted to localhost dev
