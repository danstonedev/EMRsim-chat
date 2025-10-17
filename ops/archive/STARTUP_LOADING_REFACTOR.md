# Startup Loading Refactor Plan

## Problem Summary
Multiple unnecessary re-renders and state updates during app initialization causing:
- 4x "Setting scenario media" logs (3 empty, 1 with data)
- Race conditions in media loading
- Unnecessary voice session reconfigurations
- Verbose console output masking real issues

## Root Causes Identified

### 1. **Eager State Reset in `useScenarioMedia`**
**File:** `frontend/src/shared/hooks/useScenarioMedia.ts` (lines 36-42)

**Problem:**
```typescript
useEffect(() => {
  setScenarioMedia([])  // ❌ Immediate reset triggers downstream updates
  closeMedia()
  // ... async load later
}, [scenarioId])
```

**Impact:** Creates 3 empty state propagations before actual data loads

### 2. **Verbose Logging in Production Code**
**File:** `frontend/src/shared/useVoiceSession.ts` (line 122)

**Problem:** Console.log in useEffect fires on every scenarioMedia change
```typescript
console.log('[useVoiceSession] Setting scenario media:', {
  mediaCount: media.length,
  mediaIds: media.map(m => m.id)
});
```

### 3. **Cascading Effect Dependencies**
**Chain:**
```
App.tsx:138-142 → useScenarioMedia(scenarioId)
  ↓ (resets scenarioMedia to [])
App.tsx:170-183 → useVoiceSession({ scenarioMedia })
  ↓ (receives [])
useVoiceSession.ts:117-126 → useEffect on scenarioMedia
  ↓ (logs and updates)
```

This chain repeats 3-4 times during initialization.

---

## Modular Refactoring Strategy

### Phase 1: Optimize Media Loading Hook ⭐ **High Priority**

#### **File:** `frontend/src/shared/hooks/useScenarioMedia.ts`

**Changes:**
1. **Defer state reset** until after cancellation check
2. Add loading state to prevent intermediate updates
3. Use ref to track if initial load completed

```typescript
// Proposed refactoring:
export function useScenarioMedia({
  scenarioId,
  closeMedia,
}: UseScenarioMediaOptions) {
  const [scenarioMedia, setScenarioMedia] = useState<MediaReference[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const scenarioMediaRequestIdRef = useRef(0)
  const hasLoadedRef = useRef<string | null>(null) // Track loaded scenario

  useEffect(() => {
    // Don't reset immediately - check if we need to reload first
    if (hasLoadedRef.current === scenarioId && scenarioMedia.length > 0) {
      return // Already loaded this scenario
    }

    const requestId = ++scenarioMediaRequestIdRef.current
    
    if (!scenarioId) {
      // Only reset if we had data before
      if (scenarioMedia.length > 0) {
        setScenarioMedia([])
        closeMedia()
      }
      hasLoadedRef.current = null
      return
    }

    setIsLoading(true)

    const loadScenarioMedia = async () => {
      try {
        const scenario = await api.getSpsScenarioById(scenarioId)
        
        // Check if request is still valid
        if (scenarioMediaRequestIdRef.current !== requestId) return

        const assets = Array.isArray(scenario?.media_library)
          ? (scenario.media_library as ScenarioMediaAsset[])
          : []

        const mapped: MediaReference[] = assets
          .filter((asset): asset is ScenarioMediaAsset => 
            Boolean(asset && asset.id && asset.url))
          .map((asset) => ({
            id: asset.id,
            type: asset.type === 'video' ? 'video' : 
                  asset.type === 'youtube' ? 'youtube' : 'image',
            url: asset.url,
            thumbnail: asset.thumbnail || undefined,
            caption: asset.caption?.trim() || 
                     asset.clinical_context?.[0] || 
                     asset.id,
          }))

        // Only update state if still valid
        if (scenarioMediaRequestIdRef.current === requestId) {
          setScenarioMedia(mapped)
          hasLoadedRef.current = scenarioId
          setIsLoading(false)
          
          if (import.meta.env.DEV) {
            console.debug('[useScenarioMedia] Loaded media:', {
              scenarioId,
              count: mapped.length,
              ids: mapped.map(m => m.id)
            })
          }
        }
      } catch (error) {
        console.error('[useScenarioMedia] Failed to load scenario media', error)
        if (scenarioMediaRequestIdRef.current === requestId) {
          setScenarioMedia([])
          hasLoadedRef.current = null
          setIsLoading(false)
        }
      }
    }

    void loadScenarioMedia()
  }, [scenarioId, closeMedia])

  return { scenarioMedia, isLoading }
}
```

**Benefits:**
- ✅ Eliminates 3 unnecessary empty updates
- ✅ Adds cache to prevent reloading same scenario
- ✅ Moves log to dev-only debug mode
- ✅ Exposes loading state for UI feedback

---

### Phase 2: Reduce Logging Verbosity 🔇

#### **File:** `frontend/src/shared/useVoiceSession.ts` (line 122)

**Change:**
```typescript
// BEFORE:
console.log('[useVoiceSession] Setting scenario media:', {
  mediaCount: media.length,
  mediaIds: media.map(m => m.id)
});

// AFTER:
if (import.meta.env.DEV && media.length > 0) {
  console.debug('[useVoiceSession] Scenario media updated:', {
    count: media.length,
    ids: media.map(m => m.id)
  });
}
```

**Benefits:**
- Only logs when there's actual data
- Uses `console.debug` (filterable in DevTools)
- Dev-only (stripped in production builds)

---

### Phase 3: Consolidate Voice Session Configuration 🔧

#### **File:** `frontend/src/shared/useVoiceSession.ts` (lines 109-132)

**Problem:** Three separate useEffect calls fire independently:
```typescript
useEffect(() => {
  controller.setScenarioId(options.scenarioId ?? null);
}, [controller, options.scenarioId]);

useEffect(() => {
  const media = options.scenarioMedia ?? [];
  console.log('[useVoiceSession] Setting scenario media:', ...);
  controller.setScenarioMedia?.(media);
}, [controller, options.scenarioMedia]);

useEffect(() => {
  controller.setExternalSessionId(options.sessionId ?? null);
  setSessionId(options.sessionId ?? null);
}, [controller, options.sessionId]);
```

**Proposed Consolidation:**
```typescript
// Consolidate related configuration updates
useEffect(() => {
  const config = {
    scenarioId: options.scenarioId ?? null,
    scenarioMedia: options.scenarioMedia ?? [],
    sessionId: options.sessionId ?? null,
  }

  // Batch controller updates
  controller.setScenarioId(config.scenarioId)
  controller.setScenarioMedia?.(config.scenarioMedia)
  controller.setExternalSessionId(config.sessionId)
  setSessionId(config.sessionId)

  if (import.meta.env.DEV) {
    console.debug('[useVoiceSession] Configuration updated:', {
      scenarioId: config.scenarioId,
      mediaCount: config.scenarioMedia.length,
      sessionId: config.sessionId,
    })
  }
}, [
  controller,
  options.scenarioId,
  options.scenarioMedia,
  options.sessionId,
])
```

**Benefits:**
- ✅ Single configuration update instead of 3 separate ones
- ✅ Reduces effect execution overhead
- ✅ Centralized logging
- ✅ Easier to reason about state flow

---

## Implementation Order

### Step 1: Quick Wins (Low Risk)
1. ✅ Update logging in `useVoiceSession.ts` to use `console.debug` + dev-only
2. ✅ Move scenario media log to only fire when `media.length > 0`

**Estimated Time:** 5 minutes  
**Risk:** Very Low  
**Impact:** Immediate clarity in console

---

### Step 2: Media Loading Optimization (Medium Risk)
1. ✅ Add `hasLoadedRef` cache to `useScenarioMedia`
2. ✅ Defer state reset until after cancellation check
3. ✅ Add `isLoading` state
4. ✅ Update `App.tsx` to use loading state (optional UI enhancement)

**Estimated Time:** 20 minutes  
**Risk:** Medium (test thoroughly)  
**Impact:** Eliminates 3 unnecessary renders

---

### Step 3: Effect Consolidation (Higher Risk)
1. ✅ Consolidate 3 separate effects in `useVoiceSession`
2. ⚠️ Test with different scenario transitions
3. ⚠️ Verify no regression in voice session lifecycle

**Estimated Time:** 30 minutes  
**Risk:** Medium-High (affects core voice logic)  
**Impact:** Cleaner code, slightly better performance

---

## Testing Strategy

### Unit Tests
- Test `useScenarioMedia` with rapid scenario changes
- Verify cancellation logic works correctly
- Test cache behavior

### Integration Tests
- Load app → select scenario → verify only 1 media load log
- Change scenario → verify cache invalidation
- Rapid scenario switching → verify no race conditions

### Visual Verification
```
✅ Expected console output after refactor:
[vite] connected.
[voice] feature flag VOICE_ENABLED = true
[voice] feature flag SPS_ENABLED = true
[BackendSocketManager] ✅ Connected
[useScenarioMedia] Loaded media: {scenarioId: 'abc', count: 2}
[useVoiceSession] Configuration updated: {scenarioId: 'abc', mediaCount: 2}
```

**Before:** 15+ startup logs  
**After:** 5-7 focused logs

---

## Rollback Plan

If issues arise:
1. Git revert individual commits (modular approach)
2. Feature flag for new media loading logic
3. A/B test consolidated effects vs. separate

---

## Success Metrics

✅ **Console Clarity:** < 10 startup logs  
✅ **Render Count:** 1 media update instead of 4  
✅ **Performance:** No measurable impact (already fast)  
✅ **Maintainability:** Easier to debug initialization issues

---

## Next Steps

1. Review this plan with team
2. Implement Step 1 (quick wins) immediately
3. Create feature branch for Step 2
4. Test thoroughly before merging Step 3

---

**Questions? Concerns?**  
This refactor is designed to be **incremental and safe**. Each phase can be deployed independently.
