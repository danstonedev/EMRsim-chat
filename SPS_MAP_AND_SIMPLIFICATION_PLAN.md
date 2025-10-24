# SPS deep-dive: storage, loading, APIs, and Case Builder coupling

This document maps how SPS personas and scenarios are stored, loaded, exposed via APIs, and consumed by the frontend. It concludes with a concrete simplification plan to segregate authoring from runtime and reduce complexity.

## What lives where

- File-based content (loaded into the in-memory registry at boot):
  - Personas (realtime): `backend/src/sps/content/personas/realtime/realtime_personas.json`
  - Personas (scenario-linked/shared): `backend/src/sps/content/personas/shared/*.json`
  - Scenario bundles (V3 layout): `backend/src/sps/content/scenarios/bundles_src/<scenarioId>/`
    - `scenario.header.json` + linked files like `instructions.json`, `soap.subjective.json`, `soap.objective.json`, `soap.assessment.json`, `soap.plan.json`
  - Banks (special questions, challenges): `backend/src/sps/content/banks/**`

- In-memory registry (runtime catalog):
  - `backend/src/sps/core/registry.ts` exports `spsRegistry` holding:
    - `personas: Record<id, PatientPersona>`
    - `scenarios: Record<id, ClinicalScenario>`
    - helpers: `addPersonas`, `addScenarios`, `composeActiveCase`, etc.

- Optional DB (better-sqlite3; in dev defaults to memory unless dependency present):
  - Schema created in `backend/src/db.ts` by `migrate()`
  - Tables used here: `sessions`, `turns`, `scenarios` (authoring storage)
  - Storage mode surfaced by `getStorageMode()` as `sqlite` or `memory`
  - Path comes from `SQLITE_PATH` or `DATABASE_URL=file:...` in `backend/.env`

## How data loads and merges

1) Server boot (`backend/src/index.ts`):
   - Migrates DB if configured (optional; better-sqlite3 is an optional dep)
   - Dynamically imports `./sps/runtime/session.ts` and calls `loadSPSContent()`
   - `loadSPSContent()` (`backend/src/sps/runtime/content/loader.ts`):
     - Resolves base dir robustly; reads personas and scenarios from disk
     - Converts bundles with `convertPersonaBundle`/`convertScenarioBundle`
     - Populates `spsRegistry` (personas, scenarios, specials, challenges)
   - After loading registry from disk, any DB-backed scenarios are fetched via `getAllScenariosFull()` and added to the registry (DB wins on conflicts)

2) Route-level safety net:
   - `backend/src/routes/sps.ts` implements `ensureSPSLoaded()` and awaits it in listing endpoints. If the registry is empty (e.g., due to a hot-reload edge case), it re-invokes `loadSPSContent()` to self-heal.

3) Catalog merge for scenarios (`GET /api/sps/scenarios`):
   - Builds a lite list from the registry (file-based) and DB (`listScenariosLite()`); merges by `scenario_id` with DB taking precedence.

## API surface (relevant to personas/scenarios)

- Health/debug:
  - `GET /api/health` → uptime, storage mode, feature flags
  - `GET /api/sps/debug` → counts: registry vs DB vs merged; storage mode; endpoint hints

- Personas:
  - `GET /api/sps/personas` → lite list from `spsRegistry.personas`
  - `GET /api/sps/personas/:id` → full persona from registry

- Scenarios:
  - `GET /api/sps/scenarios` → merged lite list (registry + DB)
  - `GET /api/sps/scenarios/:id` → full scenario, preferring DB via `getScenarioByIdFull()` then falling back to registry
  - `POST /api/sps/scenarios` → save (upsert) a full scenario to DB; route also adds it to the registry for immediate availability
  - `POST /api/sps/generate` → AI-generate a scenario; `save` flag optionally persists and registers it

- Sessions (runtime use):
  - `POST /api/sessions` (SPS-only) → validates persona/scenario via `spsRegistry`, composes active case with `composeActiveCase`
  - `POST /api/sessions/:id/sps/turns` → persists deduped finalized turns (DB or memory)
  - `GET /api/sessions/:id/transcript` → printable transcript HTML; persona/scenario header pulled from `spsRegistry`

## Frontend coupling (Case Builder and chat)

- API client: `frontend/src/shared/api.ts`
  - Base URL from `VITE_API_BASE_URL` (dev default <http://localhost:3002>)
  - Catalog fetchers: `getSpsPersonas`, `listSpsScenarios`, `getSpsScenarioById`, `getSpsPersonaById`
  - Authoring ops: `generateSpsScenario`, `saveSpsScenario`
  - Runtime ops: `createSession`, `saveSpsTurns`, transcript export

- Case Builder UI: `frontend/src/pages/CaseBuilder.tsx`
  - On load: calls `api.listSpsScenarios()`, `api.getSpsPersonas()`, `api.getHealth()`, `/api/sps/debug`
  - Preview: `GET /api/sps/scenarios/:id` and `GET /api/sps/personas/:id`
  - Generate: `POST /api/sps/generate` (optional research), then `POST /api/sps/scenarios` to save
  - Shows runtime counts: merged/registry/db and storage mode (from health/debug)

## Current pain points and sources of confusion

1) Dual-source catalog: scenarios come from both files (registry) and DB; merges at request time; also DB scenarios are injected into the registry at boot and on save. This creates multi-path mental overhead and subtle precedence rules.

2) Persistence varies by environment: when `better-sqlite3` isn’t installed or `DATABASE_URL/SQLITE_PATH` is unset, storage falls back to memory. The UI warns, but it’s easy to miss and causes “lost after restart” confusion.

3) Authoring endpoints share namespace with runtime catalog: `/api/sps/*` serves both read-only runtime lists and authoring write ops; it’s not clear what’s a draft vs published scenario.

4) Boot vs hot-reload timing: rare cases left the registry empty; a lazy-load fix now mitigates, but the dual paths still complicate reasoning.

---

## Simplification plan: segregate authoring from runtime

Goal: make the runtime catalog predictable and read-only, and isolate authoring workflows and state. Provide a clear “publish” action instead of implicit side effects.

Option A — Authoring overlay with explicit publish (recommended)

1) Namespace split
   - Create `/api/author/*` routes for authoring (AI generation, save, list drafts, preview draft-by-id).
   - Keep `/api/sps/*` for runtime read models only (published library).

2) Storage model
   - DB is for authoring (drafts). Registry is for runtime (published). No automatic DB→registry injection at boot.
   - Introduce a `publish` route under `/api/author/scenarios/:id/publish` that materializes drafts into a runtime “overlay” file or to the compiled content folder.

3) Runtime source of truth
   - Loader reads from a single source: file-based published content + a small `overrides.published.json` overlay (generated by publish) for hot updates.
   - Remove route-time merging; `/api/sps/scenarios` returns published only.

4) UI changes
   - Case Builder points to `/api/author/*` for create/save/list/preview. Add a Publish button per scenario. Published items show a badge in the list.
   - Chat and persona/scenario pickers use only `/api/sps/*` (published).

5) “Publish” implementation detail
   - Minimal version: write the full scenario JSON into `backend/src/sps/content/scenarios/overrides/overrides.published.json` as a list keyed by `scenario_id`. Loader reads and merges this file after the static bundles.
   - Advanced: write/patch bundle directories under `bundles_src/` and re-run a content build, but keep this optional to avoid slow loops during dev.

Option B — DB as the single source of truth

1) Migrate all content to SQLite at boot (one-time seeding) and serve runtime solely from DB.
2) Authoring operates on the same DB; “publish” becomes simply a status flag; runtime queries filter `status = 'published'`.
3) Provide export tooling to write published scenarios back to files for version control as needed.

Trade-offs: Option B simplifies runtime vs authoring split but loses file-first versioning unless export is disciplined. Option A preserves file-first content while giving authoring a clear path to publish.

---

## Concrete, incremental steps

Phase 0 (now)

- Ensure persistence in dev to reduce confusion:
  - Set `DATABASE_URL=file:./dev.db` in `backend/.env` (already in `.env.example`).
  - Ensure `better-sqlite3` installs on your platform (run workspace task “Deps: Install All”).
  - Verify storage mode with `/api/health` or `/api/sps/debug` (should report `sqlite`).

Phase 1 — No behavioral change; clarify and guard

- Keep the current behavior, but:
  - Document in-code that `/api/sps/scenarios` merges DB + registry and that DB wins.
  - Add a header `X-Catalog-Source: merged` on `/api/sps/scenarios` and `X-Scenario-Source: db|registry` on `/api/sps/scenarios/:id` for traceability.
  - Add a health banner in Case Builder if storage is memory, with a link to setup instructions.

Phase 2 — Segregate authoring

- Add `/api/author` routes: `POST /generate`, `POST /scenarios`, `GET /scenarios`, `GET /scenarios/:id`, `POST /scenarios/:id/publish`.
- Move the current save/generate endpoints under authoring and keep `/api/sps/*` read-only.
- Implement a simple `overrides.published.json` overlay and have the loader read it after bundles.

Phase 3 — Deprecate merge

- Stop injecting DB scenarios into the registry at boot and remove the route-time merge. `/api/sps/scenarios` becomes purely published.
- Case Builder lists drafts from `/api/author/scenarios` and published from `/api/sps/scenarios` side-by-side.

Phase 4 — Optional: DB-first runtime

- If desired later, pivot to Option B (DB as source of truth) once the publish status/filters are in place.

---

## Quick reference: key files and symbols

- Loader and registry
  - `backend/src/sps/runtime/content/loader.ts` → `loadSPSContent()`
  - `backend/src/sps/core/registry.ts` → `spsRegistry`, `composeActiveCase()`

- Routes
  - `backend/src/routes/sps.ts` → personas/scenarios catalog, generate, save, debug
  - `backend/src/routes/sessions.ts` → creates SPS sessions and uses `composeActiveCase()`

- DB
  - `backend/src/db.ts` → `migrate`, `upsertScenario`, `listScenariosLite`, `getScenarioByIdFull`, `getStorageMode`

- Frontend
  - `frontend/src/shared/api.ts` → `getSpsPersonas`, `listSpsScenarios`, `generateSpsScenario`, `saveSpsScenario`, `createSession`
  - `frontend/src/pages/CaseBuilder.tsx`

---

## Verification checklist

- Backend dev up: `GET /api/health` returns `ok`, and `storage: sqlite` for persistence.
- `GET /api/sps/debug` shows non-zero registry counts and merged count ≥ registry count.
- Case Builder shows runtime counts and warns if in-memory.

## Notes

- The server now includes a lazy-load safety net in `routes/sps.ts` to recover from hot-reload hiccups where the registry might be empty.
- Windows developer machines may require Build Tools for `better-sqlite3` to install successfully. Use the workspace task “Deps: Install All”.
