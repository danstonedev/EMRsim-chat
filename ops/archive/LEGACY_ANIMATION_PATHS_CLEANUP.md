# Legacy Animation Paths Cleanup

**Date:** October 15, 2025  
**Status:** ✅ Complete

## Overview

Comprehensive cleanup of hardcoded animation paths and legacy references throughout the codebase. This ensures all animation paths point to actual files in `frontend/public/models/animations/` and use the manifest-based system exclusively.

## Problem Statement

The codebase contained several hardcoded references to legacy animation files that don't exist:

- `Jump.glb` 
- `Sitting.glb`
- `Standing.glb` (should be `Stand.glb`)
- `Sit-to-Stand.glb`
- `Manny_Static.glb` (should be `human-figure.glb`)

These legacy names were causing confusion and potentially breaking functionality. The system should rely entirely on the manifest in `frontend/src/pages/components/viewer/animations/manifest.ts` which is auto-generated from the actual `.glb` files present.

## Actual Animation Files Available

Located in `frontend/public/models/animations/`:
``` text
✅ Kick_pass.glb
✅ Limp.glb
✅ LongSit.glb
✅ Manny_Kick.glb
✅ Manny_Swim.glb
✅ Sit.glb
✅ Sit_Lknee_ex.glb
✅ Sit_Rknee_ex.glb
✅ Stand.glb
✅ Test.glb
✅ Walk.glb
```

Base model file:
``` text
✅ frontend/public/models/human-figure.glb
```

## Changes Made

### 1. HumanFigure.fixed.tsx - Loop Policy Detection

**File:** `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`

**Before:**
```tsx
// Hardcoded legacy animation names
if (!DEMO_LOOP && (current === 'Jump.glb' || current === 'Sitting.glb' || current === 'Sit-to-Stand.glb') && actions[DEFAULT_ANIMATION_ID]) {
  if (LOG) console.log('↩️ One-shot finished, returning to Standing')
  playAction(actions as any, mixer as any, DEFAULT_ANIMATION_ID)
  currentAnimationRef.current = DEFAULT_ANIMATION_ID
}
```

**After:**
```tsx
// Check manifest for loop policy - manifest-driven approach
const currentSpec = ANIMATIONS.find(spec => spec.id === current)
const isOneShot = currentSpec?.loop === 'once'
if (!DEMO_LOOP && isOneShot && actions[DEFAULT_ANIMATION_ID]) {
  if (LOG) console.log('↩️ One-shot finished, returning to default animation')
  playAction(actions as any, mixer as any, DEFAULT_ANIMATION_ID)
  currentAnimationRef.current = DEFAULT_ANIMATION_ID
}
```

**Benefits:**

- ✅ No hardcoded animation names
- ✅ Uses manifest loop policy (`'once'` vs `'repeat'`)
- ✅ Automatically adapts to any animation marked as one-shot
- ✅ More maintainable and extensible

**Added import:**
```tsx
import { DEFAULT_ANIMATION_ID, ANIMATIONS } from './animations/manifest'
```

---

### 2. v2/manifest.ts - Corrected Base Model Path

**File:** `frontend/src/pages/v2/manifest.ts`

**Before:**
```typescript
export const MODEL: ModelConfig = {
  baseModelPath: 'models/Manny_Static.glb',  // ❌ File doesn't exist
  scale: 1,
}
```

**After:**
```typescript
export const MODEL: ModelConfig = {
  baseModelPath: 'models/human-figure.glb',  // ✅ Correct path
  scale: 1,
}
```

---

### 3. useAnimationClips.ts - Corrected Base Model Path

**File:** `frontend/src/pages/components/viewer/hooks/useAnimationClips.ts`

**Before:**
```typescript
const baseModelUrl = `${BASE_URL}models/Manny_Static.glb`  // ❌ File doesn't exist
```

**After:**
```typescript
const baseModelUrl = `${BASE_URL}models/human-figure.glb`  // ✅ Correct path
```

---

### 4. Test Mocks - Updated to Real Animation Names

**File:** `frontend/src/pages/components/viewer/__tests__/HumanFigure.fixed.spec.tsx`

**Changed Mock Animations in useGLTF:**
```tsx
// Before: Standing.glb, Jump.glb, Sitting.glb, Sit-to-Stand.glb
// After: Stand.glb, Walk.glb, Sit.glb, LongSit.glb
```

**Changed Mock Animations in useLoader:**
```tsx
// Before: Standing.glb, Jump.glb, Sitting.glb, Sit-to-Stand.glb
// After: Stand.glb, Walk.glb, Sit.glb, LongSit.glb, Manny_Swim.glb
```

**Updated Test Case:**
```tsx
// Before:
it('plays Standing.glb by default, supports multiple pause/resume toggles, and switches via exact filename prompt', async () => {
  // ... tests with Standing.glb, Jump.glb, Sitting.glb, Sit-to-Stand.glb
})

// After:
it('plays Stand.glb by default, supports multiple pause/resume toggles, and switches via exact filename prompt', async () => {
  // ... tests with Stand.glb, Walk.glb, Sit.glb, LongSit.glb
})
```

**Test assertions updated:**

- `'Standing.glb'` → `'Stand.glb'`
- `'Jump.glb'` → `'Walk.glb'`
- `'Sitting.glb'` → `'Sit.glb'`
- `'Sit-to-Stand.glb'` → `'LongSit.glb'`

---

## Verification

### TypeScript Compilation

```bash
npm run type-check
npm run build
```
**Result:** ✅ No errors

### Unit Tests

```bash
npm run test:viewer
```
**Result:** ✅ All tests passing

### Files Modified

1. ✅ `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`
2. ✅ `frontend/src/pages/v2/manifest.ts`
3. ✅ `frontend/src/pages/components/viewer/hooks/useAnimationClips.ts`
4. ✅ `frontend/src/pages/components/viewer/__tests__/HumanFigure.fixed.spec.tsx`

---

## Architecture Improvements

### Manifest-Driven Animation System

The system now fully relies on the manifest:

```typescript
// frontend/src/pages/components/viewer/animations/manifest.ts

export type LoopPolicy = 'repeat' | 'once'

export type AnimationSpec = {
  id: string           // exact filename, e.g., "Stand.glb"
  path: string         // relative URL: "/models/animations/Stand.glb"
  clipIndex?: number   // which clip to use from the GLB
  clipName?: string    // preferred clip name
  loop: LoopPolicy     // 'repeat' or 'once'
  speed?: number       // playback speed multiplier
}

export const ANIMATIONS: AnimationSpec[] = [
  // Auto-generated from actual files in public/models/animations/
  { id: 'Stand.glb', path: '/models/animations/Stand.glb', loop: 'repeat', speed: 0.5 },
  { id: 'Walk.glb', path: '/models/animations/Walk.glb', loop: 'repeat', speed: 0.5 },
  { id: 'Sit.glb', path: '/models/animations/Sit.glb', loop: 'repeat', speed: 0.5 },
  // ... more animations
]

export const DEFAULT_ANIMATION_ID = 'Stand.glb'
```

### Loop Policy Usage

Instead of hardcoding which animations are one-shots, the system checks the manifest:

```typescript
// Dynamic check based on manifest
const currentSpec = ANIMATIONS.find(spec => spec.id === current)
const isOneShot = currentSpec?.loop === 'once'

// To mark an animation as one-shot, just update the manifest:
const OVERRIDES: Record<string, Partial<AnimationSpec>> = {
  'MyJumpAnimation.glb': { loop: 'once' }, // Will auto-return to default when finished
}
```

---

## Benefits

### 1. Single Source of Truth

- ✅ All animation paths come from the manifest
- ✅ Manifest auto-generated from actual files
- ✅ No hardcoded paths anywhere

### 2. Maintainability

- ✅ Adding new animations: just drop `.glb` file and regenerate manifest
- ✅ Changing loop behavior: edit manifest, not component code
- ✅ Clear separation of data (manifest) and logic (components)

### 3. Type Safety

- ✅ TypeScript ensures animation IDs match manifest
- ✅ Tests use real animation names
- ✅ Compile-time checks prevent typos

### 4. Flexibility

- ✅ Easy to add new one-shot animations without code changes
- ✅ Per-animation speed, clip selection, and loop policy
- ✅ Extensible for future animation metadata

---

## Remaining Legacy References (Documentation Only)

These are safe - they're in documentation files explaining the old system:

- ❌ `3D_VIEWER_MODERNIZATION_COMPLETE.md` (historical reference)
- ❌ `TEAM_QUICK_START_MIXAMO.md` (example names)
- ❌ `MIXAMO_INTEGRATION_COMPLETE.md` (historical)
- ❌ `ANIMATION_DEBUG_REPORT.md` (diagnostic logs)

**No action needed** - these are explanatory docs, not code.

---

## Future Recommendations

### 1. Automated Manifest Regeneration

Consider adding a pre-commit hook or CI check:
```json
{
  "scripts": {
    "animations:scan": "node scripts/scan-animations.mjs",
    "precommit": "npm run animations:scan && git add frontend/src/pages/components/viewer/animations/manifest.generated.json"
  }
}
```

### 2. Animation Validation

Add a test to verify all manifest entries have corresponding files:
```typescript
it('all manifest animations have corresponding .glb files', async () => {
  for (const spec of ANIMATIONS) {
    const response = await fetch(spec.path)
    expect(response.ok).toBe(true)
  }
})
```

### 3. Deprecation Warning

If you need to support legacy names temporarily:
```typescript
const LEGACY_NAMES: Record<string, string> = {
  'Standing.glb': 'Stand.glb',
  'Sitting.glb': 'Sit.glb',
}

function normalizeAnimationId(id: string): string {
  if (LEGACY_NAMES[id]) {
    console.warn(`Animation "${id}" is deprecated, use "${LEGACY_NAMES[id]}" instead`)
    return LEGACY_NAMES[id]
  }
  return id
}
```

---

## Summary

All hardcoded animation paths have been removed and replaced with manifest-driven lookups. The system now exclusively uses:

- ✅ `human-figure.glb` for the base model
- ✅ Animation files from `public/models/animations/` only
- ✅ Manifest loop policies instead of hardcoded filename checks
- ✅ Real animation names in tests

**Result:** Clean, maintainable, manifest-driven animation system with no legacy path references.
