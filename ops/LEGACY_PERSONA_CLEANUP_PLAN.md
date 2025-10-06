# Legacy Persona System Cleanup Plan

**Status:** Ready for execution  
**Created:** 2024 (continuation of identity fix work)  
**Goal:** Remove all database-backed persona infrastructure, leaving only clean SPS registry path

---

## Executive Summary

The application currently has **two competing persona systems**:

1. **✅ CURRENT (SPS Registry)**: JSON files → SPSRegistry → ActiveCase → AI
2. **❌ LEGACY (Database)**: personas table → PersonaRow → getPersonaById()

The **legacy system is unused by the frontend** and creates architectural confusion. This plan removes it completely.

---

## Architecture Comparison

### Current (Keep)
```
JSON Files (realtime_personas.json + scenario bundles)
    ↓
loadSPSContent() → spsRegistry
    ↓
composeActiveCase()
    ↓
buildSystemInstructions() → AI
    ↓
Frontend: GET /api/sps/personas
```

### Legacy (Remove)
```
Database (personas table)
    ↓
PersonaRow interface
    ↓
getPersonaById() / getPersonasLite()
    ↓
GET /api/personas (UNUSED by frontend)
```

---

## Files to Modify

### 1. **backend/src/app.ts** (Line 10, 85)
**Current:**
```typescript
import { router as personasRouter } from './routes/personas.ts';
// ...
app.use('/api/personas', personasRouter);
```

**Action:** Remove import and route mounting

**Risk:** LOW - frontend uses `/api/sps/personas` instead

---

### 2. **backend/src/routes/personas.ts** (ENTIRE FILE)
**Action:** DELETE file entirely

**Contains:**
- `/api/personas` GET endpoint (list all)
- `/api/personas/:id` GET endpoint (get one)
- Uses `getPersonasLite()`, `getPersonaById()` from db.ts

**Risk:** NONE - no frontend usage confirmed

---

### 3. **backend/src/routes/sessions.ts** (Line 2, 286)
**Current:**
```typescript
import { getPersonaById, createSession, getSessionById, ... } from '../db.ts';
// ...
const persona = getPersonaById(session.persona_id); // Line 286
```

**Action:** 
- Remove `getPersonaById` from import (line 2)
- Replace line 286 logic with SPS registry lookup

**Fix for line 286:**
```typescript
// OLD: const persona = getPersonaById(session.persona_id);
// NEW:
const persona = session.mode === 'sps' && session.sps_scenario_id
  ? spsRegistry.personas[session.persona_id]
  : null;
const personaName = persona?.display_name || persona?.demographics?.preferred_name || session.persona_id;
```

**Risk:** LOW - only affects transcript HTML display, SPS sessions will work correctly

---

### 4. **backend/src/routes/voice.js** (Line 3, 56)
**Current:**
```javascript
import { getPersonaById, ... } from '../db.ts';
// ...
const persona = getPersonaById(session.persona_id); // Line 56
```

**Action:**
- Remove `getPersonaById` from import
- Confirm line 56 is NOT in active code path (SPS uses `resolveSpsRealtimeContext()` instead)
- Delete or update fallback logic

**Analysis needed:** Read voice.js fully to confirm code paths

**Risk:** MEDIUM - need to verify voice flow doesn't use this path

---

### 5. **backend/src/db.ts** (Lines 16-30, ~242, schema)
**Action:**
- Remove `PersonaRow` interface (lines 16-30)
- Remove `getPersonaById()` function (~line 242)
- Remove `getPersonasLite()` function
- **Consider:** Remove `personas` table from schema (if safe)

**Risk:** MEDIUM - db.ts is foundational, must verify no other dependencies

---

## Removal Order (Safe Sequence)

### Phase 1: Remove External Dependencies
1. ✅ Remove `/api/personas` route from app.ts
2. ✅ Delete `backend/src/routes/personas.ts` file
3. ✅ Remove `getPersonaById` import from sessions.ts
4. ✅ Fix sessions.ts line 286 (transcript endpoint)

**Validation:** Run `npm test` in backend

---

### Phase 2: Remove voice.js Dependencies
5. 🔍 Read voice.js lines 1-100 to understand persona usage
6. ✅ Remove `getPersonaById` import from voice.js
7. ✅ Update/remove line 56 logic (if in dead code path)

**Validation:** Test voice endpoint manually or via routes.test

---

### Phase 3: Clean Database Layer
8. ✅ Remove `getPersonaById()` function from db.ts
9. ✅ Remove `getPersonasLite()` function from db.ts
10. ✅ Remove `PersonaRow` interface from db.ts
11. ⚠️ OPTIONAL: Remove `personas` table from schema (requires migration)

**Validation:** Run full test suite, check TypeScript compilation

---

## Verification Checklist

After each phase:

- [ ] `cd backend && npm test` passes
- [ ] `cd backend && npm run build` succeeds (TypeScript check)
- [ ] Grep for remaining references: `grep -r "getPersonaById" backend/src/`
- [ ] Grep for PersonaRow usage: `grep -r "PersonaRow" backend/src/`
- [ ] Frontend still loads personas: GET `/api/sps/personas` works
- [ ] Session creation works: POST `/api/sessions` with SPS mode
- [ ] Voice endpoint works: Test realtime voice session

---

## Code Audit Results

### Frontend Usage (✅ SAFE TO PROCEED)
```
frontend/src/shared/api.ts:209
  → const r = await fetchWithTimeout(`${BASE}/api/sps/personas`)

frontend/src/test/msw-handlers.ts:10
  → http.get('*/api/sps/personas', () => {
```

**Conclusion:** Frontend uses `/api/sps/personas` (provided by sessions.ts), NOT `/api/personas`

---

### Backend Imports of Legacy Route
```
backend/src/app.ts:10
  → import { router as personasRouter } from './routes/personas.ts';
backend/src/app.ts:85
  → app.use('/api/personas', personasRouter);
```

**Conclusion:** Only app.ts mounts this route

---

### getPersonaById Usage
```
backend/src/db.ts:242 (estimated)
  → export function getPersonaById(id: string) { ... }

backend/src/routes/sessions.ts:2
  → import { getPersonaById, ... } from '../db.ts';
backend/src/routes/sessions.ts:286
  → const persona = getPersonaById(session.persona_id);

backend/src/routes/voice.js:3
  → import { getPersonaById, ... } from '../db.ts';
backend/src/routes/voice.js:56 (estimated)
  → const persona = getPersonaById(session.persona_id);

backend/src/routes/personas.ts (entire file)
  → Uses getPersonaById for /api/personas/:id endpoint
```

---

## Success Criteria

After cleanup is complete:

1. ✅ `grep -r "getPersonaById" backend/src/` returns 0 results (except maybe in comments)
2. ✅ `grep -r "PersonaRow" backend/src/` returns 0 results (except in comments)
3. ✅ `/api/personas` route no longer exists (404 response)
4. ✅ `/api/sps/personas` still works correctly
5. ✅ All tests pass: `cd backend && npm test`
6. ✅ TypeScript compiles: `cd backend && npm run build`
7. ✅ Frontend loads personas and creates sessions successfully
8. ✅ Voice endpoint works with SPS sessions

---

## Rollback Plan

If issues arise:

1. **Git reset:** All changes are tracked, use `git checkout -- <file>` to restore
2. **Test-driven:** Run tests after each phase, rollback immediately if red
3. **No schema changes yet:** Database table remains intact until final verification

---

## Next Steps

**Recommended approach:**

1. Create a new branch: `git checkout -b cleanup/remove-legacy-personas`
2. Execute Phase 1 (remove personas.ts route)
3. Execute Phase 2 (fix voice.js)
4. Execute Phase 3 (clean db.ts)
5. Run full validation
6. Commit with clear message: "Remove legacy database persona system"

**Estimated time:** 15-30 minutes with testing

---

## Notes

- This cleanup was triggered after fixing the "identity sharing" bug (DOB not passed to AI)
- The identity fix is complete and working in `sps.service.ts` + `instructions.ts`
- This cleanup ensures no future confusion between two persona systems
- User's request: "completely reassess the entire case building pipeline and purge the 'old' way"

**Status:** Ready for execution. All legacy code paths identified and mapped.
