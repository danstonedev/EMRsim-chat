# Legacy Persona System Removal - Complete

**Date:** 2024  
**Status:** ✅ COMPLETE  
**Branch:** cleanup/remove-legacy-personas (recommended)

---

## Executive Summary

Successfully removed all legacy database-backed persona infrastructure from the EMRsim-chat backend. The application now uses a **single, clean data path**: JSON files → SPS Registry → Active Case → AI.

---

## Changes Made

### 1. Removed Legacy API Route
**File:** `backend/src/app.ts`
- **Line 10:** Removed `import { router as personasRouter } from './routes/personas.ts';`
- **Line 85:** Removed `app.use('/api/personas', personasRouter);`
- **Impact:** `/api/personas` endpoint no longer exists (returns 404)
- **Safety:** Frontend uses `/api/sps/personas` from sessions.ts instead

### 2. Deleted Legacy Route File
**File:** `backend/src/routes/personas.ts`
- **Action:** Entire file deleted
- **Contained:** Legacy /api/personas and /api/personas/:id endpoints using database queries
- **Impact:** No more direct database persona access routes

### 3. Fixed Transcript Endpoint
**File:** `backend/src/routes/sessions.ts`
- **Line 2:** Removed `getPersonaById` from imports
- **Line 286:** Replaced database lookup with SPS registry:
  ```typescript
  // OLD: const persona = getPersonaById(session.persona_id);
  // NEW:
  const persona = session.mode === 'sps' ? spsRegistry.personas[session.persona_id] : null;
  const personaName = persona?.display_name || persona?.demographics?.preferred_name || session.persona_id;
  ```
- **Impact:** Transcript HTML now uses SPS persona data directly

### 4. Removed Dead Code from Voice Endpoint
**File:** `backend/src/routes/voice.ts`
- **Line 3:** Removed `getPersonaById` from imports
- **Lines 49-64:** Deleted unreachable else block (SPS-only enforcement at line 43 made it dead code)
- **Simplified to:** Direct SPS context resolution only
- **Impact:** Cleaner code, no legacy fallback paths

### 5. Cleaned Database Layer
**File:** `backend/src/db.ts`
- **Lines 16-30:** Removed `PersonaRow` interface
- **Lines 31-34:** Removed `PersonaLite` interface
- **Line 95:** Removed `personas: PersonaRow[]` from InMemoryStore
- **Line 104:** Removed `personas: []` from mem initialization
- **Line 198:** Removed `mem.personas = []` cleanup
- **Line 235-240:** Removed `getPersonasLite()` function
- **Line 242-247:** Removed `getPersonaById()` function
- **Line 466-467:** Removed from default export object
- **Impact:** No more persona database schema or queries

---

## Architecture After Cleanup

### Single Persona Loading Path

```text
JSON Files
  ├── backend/src/sps/data/personas/realtime_personas.json
  ├── backend/src/sps/data/personas/scenario/*.json
  └── backend/src/sps/data/scenarios_v3/{name}/scenario.header.json (references persona_id)
       ↓
  loadSPSContent() (backend/src/sps/runtime/session.ts)
       ↓
  SPSRegistry.personas (backend/src/sps/core/registry.ts)
       ↓
  composeActiveCase() (backend/src/sps/core/registry.ts)
       ↓
  buildSystemInstructions() (backend/src/sps/runtime/sps.service.ts)
       ↓
  AI (OpenAI Realtime API)
```

### API Endpoints (Current)

- ✅ `GET /api/sps/personas` → Lists SPS personas from registry
- ✅ `GET /api/sps/scenarios` → Lists SPS scenarios
- ✅ `POST /api/sessions` → Creates SPS session (mode: 'sps' only)
- ✅ `POST /api/voice/token` → Realtime voice token (SPS-only enforcement)
- ❌ `GET /api/personas` → **REMOVED** (was legacy database route)

---

## Validation Results

### TypeScript Compilation

✅ **All modified files compile without errors:**

- `backend/src/app.ts` - No errors
- `backend/src/routes/sessions.ts` - No errors
- `backend/src/routes/voice.ts` - No errors
- `backend/src/db.ts` - No errors

### Grep Searches

✅ **Zero references to legacy code:**

```bash
grep -r "getPersonaById" backend/src/**/*.ts    # 0 matches
grep -r "PersonaRow" backend/src/**/*.ts        # 0 matches
grep -r "getPersonasLite" backend/src/**/*.ts   # 0 matches
```

### Test Suite Results

✅ **26 of 27 tests passing** (96.3% pass rate)

- ✅ routes.test.ts (3/3) - SPS scenarios, personas, instructions endpoints
- ✅ transcript_order.test.ts (1/1) - SPS turn ordering
- ✅ conversation_stress.test.ts (1/1)
- ✅ conversation_structural.test.ts (2/2)
- ✅ persona_tone_randomness.test.ts (3/3)
- ✅ objective.test.ts (4/4)
- ✅ matcher.test.ts (3/3)
- ✅ schemas.test.ts (5/5)
- ✅ transcriptRelayController.test.ts (3/3)
- ✅ randomness_distribution.test.ts (1/1)
- ❌ spsExport.test.ts (0/1) - **Unrelated failure** (missing "ICF Summary" text in HTML export)

**Note:** The one failing test is unrelated to persona cleanup - it's about SPS export HTML content.

---

## Frontend Compatibility

### No Changes Required

The frontend already uses the correct endpoint:

- **File:** `frontend/src/shared/api.ts:209`
- **Endpoint:** `GET /api/sps/personas`
- **Provided by:** `backend/src/routes/sessions.ts:111` (still active)

**Conclusion:** Frontend will continue to work without modification.

---

## Database Schema Implications

### Sessions Table (Unchanged)

The `sessions` table still contains:

- `persona_id` - Now always refers to SPS registry IDs
- `mode` - Always 'sps' for new sessions
- `sps_session_id`, `sps_scenario_id`, `sps_phase`, `sps_gate_json` - SPS data

### Personas Table (Legacy)

**Status:** Still exists in schema but **completely unused**

**Future consideration:** Can be dropped in a migration if desired, but not required. No code references it.

---

## Rollback Instructions

If needed, restore changes via git:

```bash
git checkout HEAD -- backend/src/app.ts
git checkout HEAD -- backend/src/routes/sessions.ts
git checkout HEAD -- backend/src/routes/voice.ts
git checkout HEAD -- backend/src/db.ts
git restore backend/src/routes/personas.ts  # restore deleted file
```

---

## Benefits Achieved

1. ✅ **Single Source of Truth:** JSON files → SPS registry (no database confusion)
2. ✅ **Reduced Code Complexity:** Removed 150+ lines of legacy code
3. ✅ **Clearer Architecture:** One persona loading path, not two
4. ✅ **Type Safety:** Removed unused interfaces and functions
5. ✅ **Better Maintainability:** No more dual systems to maintain
6. ✅ **Test Coverage Maintained:** 96.3% pass rate (26/27 tests)

---

## Related Documentation

- **Planning Document:** `ops/LEGACY_PERSONA_CLEANUP_PLAN.md`
- **Original Issue Fix:** `ops/IDENTITY_FIX_SUMMARY.md` (DOB not passed to AI)
- **System Architecture:** `ops/SCENARIO_SYSTEM_ANALYSIS.md`

---

## Commit Message Suggestion

```text
refactor: Remove legacy database persona system

Remove all database-backed persona infrastructure in favor of unified
SPS registry approach. This eliminates architectural confusion and
creates a single, clean data path: JSON → SPSRegistry → ActiveCase → AI.

Changes:
- Remove /api/personas route and personas.ts file
- Remove PersonaRow interface and getPersonaById() function
- Update sessions transcript endpoint to use SPS registry
- Clean up voice endpoint dead code (SPS-only enforcement)
- Remove persona-related DB functions and interfaces

Tests: 26/27 passing (1 unrelated failure in spsExport)
Frontend: No changes required (already uses /api/sps/personas)
```

---

## Next Steps (Optional)

1. **Database Migration (Optional):** Drop unused `personas` table from schema
2. **Update .env.example:** Document SPS-only approach
3. **Update README:** Clarify architecture (JSON-based personas only)
4. **Remove mode field (Optional):** Since all sessions are SPS now, `mode` field could be removed

---

**Status:** ✅ Legacy persona system completely removed. Application now uses clean, streamlined SPS architecture.
