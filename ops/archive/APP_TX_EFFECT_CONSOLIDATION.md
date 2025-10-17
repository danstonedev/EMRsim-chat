# App.tsx Effect Consolidation Analysis

**Date:** October 16, 2025  
**Status:** In Progress  
**Goal:** Consolidate 6 useEffect blocks following Phase 3 proven pattern

---

## Current State - 6 Effects

### Effect 1: Persona Change (Line 145)
```tsx
useEffect(() => {
  resetAllTrackingState({ clearQueue: true, resetFirstDelta: true });
}, [personaId, resetAllTrackingState]);
```
**Trigger:** personaId changes  
**Purpose:** Reset tracking state when persona changes  
**Domain:** Selection Lifecycle

### Effect 2: Session Change (Line 149)
```tsx
useEffect(() => {
  resetAllTrackingState({ clearQueue: true, resetFirstDelta: true });
  setTtftMs(null);
}, [sessionId, resetAllTrackingState, setTtftMs]);
```
**Trigger:** sessionId changes  
**Purpose:** Reset tracking state + TTFT when session changes  
**Domain:** Selection Lifecycle

### Effect 3: Auto-Scroll (Line 156)
```tsx
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
}, [sortedMessages, messagesEndRef]);
```
**Trigger:** sortedMessages changes  
**Purpose:** Scroll to bottom when new messages arrive  
**Domain:** UI/UX (independent concern) ✅ Keep Separate

### Effect 4: Encounter Reset on Selection (Line 258)
```tsx
useEffect(() => {
  setSessionId(null);
  setMessages([]);
  setSpsError(null);
  setLatestInstructions('');
  updateEncounterStateRef({ phase: null, gate: null }, 'encounter.reset.selection');
}, [personaId, scenarioId, runtimeFeatures.spsEnabled, updateEncounterStateRef, setMessages]);
```
**Trigger:** personaId OR scenarioId changes  
**Purpose:** Reset encounter state when selection changes  
**Domain:** Selection Lifecycle

### Effect 5: Auto-Compose Encounter (Line 300)
```tsx
useEffect(() => {
  if (!personaId || !scenarioId || !runtimeFeatures.spsEnabled) return;
  if (sessionId || isComposing) return; // Don't create if already have session or composing

  // Small delay to prevent rapid re-creation when switching selections
  const timer = setTimeout(() => {
    void composeEncounter();
  }, 300);

  return () => clearTimeout(timer);
}, [personaId, scenarioId, runtimeFeatures.spsEnabled, sessionId, isComposing, composeEncounter]);
```
**Trigger:** personaId/scenarioId/spsEnabled changes  
**Purpose:** Auto-create session when selections complete  
**Domain:** Selection Lifecycle (but conditional, has debounce)

### Effect 6: Dev Mode Logging (Line 339)
```tsx
useEffect(() => {
  if (import.meta.env.DEV) {
    console.debug('[voice] feature flag VOICE_ENABLED =', runtimeFeatures.voiceEnabled);
    console.debug('[voice] feature flag SPS_ENABLED =', runtimeFeatures.spsEnabled);
    console.debug('[voice] raw VITE_VOICE_ENABLED =', import.meta.env.VITE_VOICE_ENABLED);
    console.debug('[voice] FLAGS.VOICE_ENABLED =', FLAGS.VOICE_ENABLED);
  }
}, [runtimeFeatures.voiceEnabled, runtimeFeatures.spsEnabled]);
```
**Trigger:** runtime feature flags change  
**Purpose:** Log voice feature flags in dev mode  
**Domain:** Debug/Development (independent concern) ✅ Keep Separate

---

## Analysis

### Effects to Consolidate: 1, 2, 4, 5 (Selection Lifecycle)

**Common Triggers:**
- `personaId` changes
- `scenarioId` changes  
- `sessionId` changes
- `runtimeFeatures.spsEnabled` changes

**Current Problems:**
1. **Cascading executions:** Effect 4 runs → sets sessionId to null → Effect 2 runs
2. **Duplicate resets:** Effects 1, 2, 4 all call reset functions
3. **Scattered logic:** Selection change handling split across 4 effects
4. **Race conditions:** Effect 5 may fire before Effect 4 completes

### Effects to Keep Separate: 3, 6

**Effect 3 (Auto-Scroll):**
- Completely independent domain (UI/UX)
- Triggered by message changes, not selections
- No interaction with other effects
- ✅ Keep as-is

**Effect 6 (Dev Logging):**
- Dev-only debugging
- No side effects on app state
- Independent trigger (feature flags)
- ✅ Keep as-is

---

## Consolidation Strategy

### Option A: Single Unified Selection Effect (Recommended)

```tsx
// Unified selection lifecycle effect
useEffect(() => {
  // 1. Reset all state when persona/scenario changes
  setSessionId(null);
  setMessages([]);
  setSpsError(null);
  setTtftMs(null);
  setLatestInstructions('');
  resetAllTrackingState({ clearQueue: true, resetFirstDelta: true });
  updateEncounterStateRef({ phase: null, gate: null }, 'encounter.reset.selection');

  // 2. Auto-compose new encounter if both selected and SPS enabled
  if (!personaId || !scenarioId || !runtimeFeatures.spsEnabled) return;
  if (isComposing) return; // Don't create if already composing

  // Debounce to prevent rapid re-creation when switching selections
  const timer = setTimeout(() => {
    void composeEncounter();
  }, 300);

  return () => clearTimeout(timer);
}, [
  personaId,
  scenarioId,
  runtimeFeatures.spsEnabled,
  isComposing,
  resetAllTrackingState,
  updateEncounterStateRef,
  composeEncounter,
  setTtftMs,
  setMessages,
]);
```

**Benefits:**
- ✅ 4 effects → 1 effect (75% reduction)
- ✅ No cascading executions
- ✅ Atomic state updates
- ✅ Clear selection lifecycle logic
- ✅ Debounce built-in

**Risks:**
- ⚠️ sessionId-specific reset logic removed (was in Effect 2)
  - **Mitigation:** sessionId changes when composeEncounter() completes, which already handles reset
  - **Verification Needed:** Check if separate sessionId effect is needed

### Option B: Two-Effect Pattern (Conservative)

**Effect A: Selection Reset**
```tsx
// Reset state when selections change
useEffect(() => {
  setSessionId(null);
  setMessages([]);
  setSpsError(null);
  setTtftMs(null);
  setLatestInstructions('');
  resetAllTrackingState({ clearQueue: true, resetFirstDelta: true });
  updateEncounterStateRef({ phase: null, gate: null }, 'encounter.reset.selection');
}, [personaId, scenarioId, runtimeFeatures.spsEnabled, resetAllTrackingState, updateEncounterStateRef, setTtftMs, setMessages]);
```

**Effect B: Auto-Compose (Keep as-is)**
```tsx
// Auto-compose encounter when ready
useEffect(() => {
  if (!personaId || !scenarioId || !runtimeFeatures.spsEnabled) return;
  if (sessionId || isComposing) return;

  const timer = setTimeout(() => {
    void composeEncounter();
  }, 300);

  return () => clearTimeout(timer);
}, [personaId, scenarioId, runtimeFeatures.spsEnabled, sessionId, isComposing, composeEncounter]);
```

**Benefits:**
- ✅ 4 effects → 2 effects (50% reduction)
- ✅ Separate concerns (reset vs compose)
- ✅ Lower risk (smaller change)

**Tradeoffs:**
- ⚠️ Still have cascading execution (Effect A sets sessionId → Effect B reacts)
- ⚠️ Less consolidation benefit

---

## Decision: Option A (Recommended)

**Rationale:**
1. **Maximum consolidation:** 75% effect reduction
2. **Proven pattern:** Follows Phase 3 approach (single lifecycle effect)
3. **Clearer intent:** All selection change logic in one place
4. **Atomic updates:** No cascading between effects

**Verification Plan:**
1. Test persona changes → encounter resets → auto-composes
2. Test scenario changes → encounter resets → auto-composes
3. Test rapid selection changes → debounce works
4. Test sessionId external changes → verify behavior

---

## Final Result

**Before:** 6 effects (4 consolidated, 2 kept)
**After:** 3 effects (1 unified selection, 1 auto-scroll, 1 dev logging)
**Reduction:** 50% overall effect count

**Test Checklist:**
- [ ] Persona change resets state correctly
- [ ] Scenario change resets state correctly
- [ ] Both selections trigger auto-compose
- [ ] Debounce prevents rapid re-creation
- [ ] Auto-scroll still works for messages
- [ ] Dev logging still works
- [ ] No regressions in encounter flow

---

## Implementation Notes

### Careful with sessionId Dependency

**Original Effect 2:**
```tsx
useEffect(() => {
  resetAllTrackingState({ clearQueue: true, resetFirstDelta: true });
  setTtftMs(null);
}, [sessionId, resetAllTrackingState, setTtftMs]);
```

This effect had `sessionId` as a trigger, meaning it would reset tracking when sessionId changed **for any reason** (not just persona/scenario changes).

**Question:** Do we need a separate sessionId effect?

**Answer:** Likely NO, because:
1. sessionId only changes when composeEncounter() succeeds
2. composeEncounter() is only called from our consolidated effect
3. The reset happens BEFORE compose, so state is already clean

**But we should verify:** Are there other places that set sessionId externally?
- `resetEncounter()` sets sessionId to null → but also calls resetAllTrackingState
- No other external setSessionId calls found

**Conclusion:** Safe to remove separate sessionId effect.
