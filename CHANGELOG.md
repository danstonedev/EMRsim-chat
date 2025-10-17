# Changelog

## Unreleased

### ConversationController Modularization - Phase 9 Complete (Oct 16, 2025)

- **StateCoordinator Extraction:** Coordinator pattern for state operations - 67-line reduction (-8.9%)
- Created `StateCoordinator.ts` (84 lines) - coordinator for state management across multiple managers
- Extracted 8 helper methods: `isOpStale`, `invalidateOps`, `resetInitialAssistantGuards`, `scheduleInitialAssistantRelease`, `releaseInitialAssistantAutoPause`, `handleSessionReuse`, `setAutoMicPaused`, `applyMicPausedState`
- ConversationController reduced from 750 lines → 683 lines (-67, -8.9% this phase)
- **Cumulative progress:** 58.8% total reduction from original 1473 lines (866 lines removed across 9 phases)
- Introduced Coordinator pattern for cross-cutting state concerns with clean dependency injection
- All TypeScript compilation, builds, and tests passing ✅
- **Mission Accomplished** - 9 focused modules created, all ≤300 lines, 8 architectural patterns demonstrated
- See `MODULARIZATION_PHASE9_COMPLETE.md` and `PHASE9_SUMMARY.md` for full details

### ConversationController Modularization - Phase 8 Complete (Oct 16, 2025)

- **ConnectionFlowOrchestrator Extraction:** Clean orchestrator pattern - 34-line reduction (-4.8%)
- Created `ConnectionFlowOrchestrator.ts` (202 lines) - orchestrator for connection flow context creation
- Reduced `createConnectionContext()` from 67 lines → 3 lines (-64 lines, -95.5% method simplification)
- Removed `createSessionWithLogging()` method (11 lines) - moved to orchestrator
- ConversationController reduced from 708 lines → 674 lines (-34, -4.8% this phase)
- **Cumulative progress:** 54.2% total reduction from original 1473 lines (799 lines removed across 8 phases)
- Demonstrated orchestrator pattern for complex object creation with dependency injection
- All TypeScript compilation, builds, and tests passing ✅
- **Modularization goal achieved** - clean architecture with excellent separation of concerns
- See `MODULARIZATION_PHASE8_COMPLETE.md` and `PHASE8_SUMMARY.md` for full details

### ConversationController Modularization - Phase 7 Complete (Oct 16, 2025)

- **ServiceInitializer Extraction:** Massive 438-line reduction (-38.2%) by extracting 411-line constructor into factory pattern
- Created `ServiceInitializer.ts` (672 lines) - centralized factory for all service initialization with 8-phase architecture
- Constructor reduced from 411 lines → 48 lines (-363 lines, -88.3% reduction)
- ConversationController reduced from 1146 lines → 708 lines (-38.2% this phase)
- **Cumulative progress:** 51.9% total reduction from original 1473 lines (765 lines removed across 7 phases)
- Implemented dependency injection pattern via `ServiceInitializerCallbacks` interface (40+ callbacks)
- Added definite assignment assertions (`!`) for factory-initialized properties
- Fixed timer types: `ReturnType<typeof setInterval>` and `ReturnType<typeof setTimeout>`
- All TypeScript compilation, builds, and tests passing ✅
- **Largest single-phase reduction achieved** - factory pattern demonstrates excellent separation of concerns
- See `MODULARIZATION_PHASE7_COMPLETE.md` and `PHASE7_SUMMARY.md` for full details

### Other Updates

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
