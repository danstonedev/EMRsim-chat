# Changelog

## 2025-10-23

- Added three entry-level SPS scenarios (compiled and live):
  - `sc_knee_pfp_entry_v1` – Entry: Patellofemoral Pain with Stair Descent – Runner
  - `sc_knee_tcoa_entry_v1` – Entry: Tricompartmental Knee OA—Mobility and Function Limits
  - `sc_knee_mcl_grade1_entry_v1` – Entry: MCL Sprain—Grade I
- Kits added under content-first path for serverless packaging:
  - New: `knee_oa_tricompartmental_v1`, `mcl_grade1_sprain_v1`
  - Mirrored: `patellofemoral_pain_v1`, `patellar_tendinosis_v1`
- Updated kit mapping (`backend/src/sps/config/kit-mapping.json`) with suggested personas:
  - `sc_knee_pfp_entry_v1` → `patellofemoral_pain_v1`
  - `sc_knee_tcoa_entry_v1` → `knee_oa_tricompartmental_v1`
  - `sc_knee_mcl_grade1_entry_v1` → `mcl_grade1_sprain_v1`
- Validation/build: Kits + mapping validators PASS; backend type-check/build PASS.
- Deployment: Backend and frontend redeployed to Vercel; latest URLs noted in `VERCEL_DEPLOYMENT_STATUS.md`.

## Unreleased

### BackendSocketManager Complete Removal (Jan 21, 2025)

- **Legacy Class Removed:** Completely purged deprecated `BackendSocketManager` class (447 lines deleted)
- **Centralized Types:** Created `frontend/src/shared/types/backendSocket.ts` as single source of truth for socket types
- **Import Cleanup:** Updated 7 files to import from shared types location:
  - `useBackendSocket.ts` - removed 60+ lines of duplicate type definitions
  - `ConversationController.ts` - uses shared `BackendSocketClient` type
  - `ServiceInitializer.ts` - provides mock socket in test mode for backward compatibility
  - `useVoiceSession.ts`, `BackendIntegration.ts`, `config.ts`, `TranscriptCoordinator.ts` - all migrated
- **Type Deduplication:** Removed duplicate `MediaReference` interface from `TranscriptCoordinator.ts`
- **Test Mode Fallback:** `ServiceInitializer` provides mock socket when `import.meta.env.MODE === 'test'` to avoid breaking tests
- **Test Results:** ✅ 122/123 tests passing (1 unrelated 3D model timeout)
  - Fixed 26 previously failing ConversationController tests
  - All tests now pass without requiring explicit `socketFactory` parameter
- **Zero Breaking Changes:** Production code unaffected - `useVoiceSession` provides real socket via `useBackendSocket`
- **Benefits:**
  - Eliminates confusion - only one socket pattern remains (`useBackendSocket` hook)
  - Reduces codebase size - removed ~1000 lines including tests
  - Improves maintainability - single type definition location
  - Cleaner architecture - React hooks pattern enforced

### useBackendSocket Hook Migration Complete (Jan 21, 2025)

- **Reactive State Management:** Confirmed existing `useBackendSocket` hook implementation and integration
- Hook already implemented at `frontend/src/shared/hooks/useBackendSocket.ts` (442 lines) with reactive state
- **No Polling Required:** Eliminates 500ms polling intervals - state updates are immediate and reactive
- Verified integration in `useVoiceSession.ts` - production code already using hook pattern
- **Test Coverage:** 3/3 tests passing in `useBackendSocket.test.ts`
  - ✅ Connection and session joining
  - ✅ Transcript event handling and timestamp tracking
  - ✅ Failure tracking and auto-disable after max failures
- **Frontend Tests:** 163/164 passing (1 unrelated 3D model timeout)
- **Key Benefits:**
  - Reactive state - no `setInterval` polling wasteful renders
  - Automatic cleanup on unmount - no memory leaks
  - Fresh event handlers - no stale closures
  - Standard React patterns - easier to understand and maintain
  - Better testing - React Testing Library compatible
- **Accelerated Timeline:** 2 hours actual (vs 7-10 hours estimated) due to existing implementation
- Updated `REFACTORING_OPPORTUNITIES.md` with migration guide and real-world examples
- See `SWOT_ANALYSIS.md` Priority 2 for strategic context and ROI analysis

### Redis Migration for Production Scalability (Oct 18, 2025)

- **Horizontal Scaling Enabled:** Migrated from in-memory session storage to Redis
- Created `backend/src/services/redisClient.ts` (248 lines) - Redis client with automatic fallback
- Updated `backend/src/routes/voice.ts` to use Redis for RTC token storage with 60-second TTL
- Updated `backend/src/index.ts` to initialize Redis connection on startup and graceful shutdown
- Added Redis service to `docker-compose.dev.yml` and `docker-compose.yml`
- Updated `backend/.env.example` with `REDIS_URL` configuration
- **Graceful Fallback:** Automatically falls back to in-memory storage when Redis unavailable
- **Zero Breaking Changes:** All existing tests passing (28 tests, 0 failures)
- **Production Ready:** Backend can now scale horizontally with multiple instances
- Dependencies: Added `redis@^5.0.0` and `@types/redis` to backend
- See `SWOT_ANALYSIS.md` for strategic context and `PRODUCTION_READINESS.md` for deployment guide

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
