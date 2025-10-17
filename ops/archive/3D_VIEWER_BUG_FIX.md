# 3D Viewer Bug Fix - Root Cause Analysis

## Problem
3D mannequin model was not rendering - scene would appear briefly then crash/disappear.

## Root Causes Identified

### 1. **SkeletonUtils.clone() Breaking React Three Fiber** ❌
**Location:** `modelMetrics.ts` - `normalizeHumanModel()` function

**The Bug:**
```typescript
// OLD CODE (BROKEN):
const model = SkeletonUtils.clone(scene)  // ❌ This breaks R3F!
const root = new THREE.Group()
root.add(model)
return { root, metrics }
```

**Why it failed:**
- `SkeletonUtils.clone()` creates a deep copy of the GLTF scene
- React Three Fiber manages the original GLTF object lifecycle
- When we cloned it, R3F lost track of the object
- The cloned object wasn't properly integrated into R3F's reconciliation system
- Result: Scene crashes when trying to render the cloned/wrapped object

**The Fix:**
```typescript
// NEW CODE (WORKS):
// Don't clone! Just use the original scene with scale props
return <primitive object={scene} scale={scaleFactor} />
```

### 2. **Infinite Metrics Loop Causing Rapid Zooming** 🔄
**Location:** `Scene.tsx` - metrics callback

**The Bug:**
```typescript
// OLD CODE (BROKEN):
const handleMetrics = useCallback((newMetrics: ModelMetrics) => {
  setMetrics(newMetrics)  // ❌ Called every render!
}, [])
```

**Why it failed:**
- `useMemo` in HumanFigure recreated metrics object every render
- Each new metrics object triggered `setMetrics()`
- `setMetrics()` triggered `useEffect` with `frameCamera()`
- Camera framing caused re-render
- Loop continued infinitely → rapid zooming

**The Fix:**
```typescript
// NEW CODE (WORKS):
const metricsReceivedRef = useRef(false)
const handleMetrics = useCallback((newMetrics: ModelMetrics) => {
  if (!metricsReceivedRef.current) {  // ✅ Only once!
    metricsReceivedRef.current = true
    setMetrics(newMetrics)
  }
}, [])
```

### 3. **createElement() Instead of JSX** (Minor Issue)
**Location:** `Scene.tsx` - lights and meshes

**The Bug:**
```typescript
// OLD CODE (CONFUSING):
{createElement('ambientLight' as any, { intensity: 0.8 })}
```

**The Fix:**
```typescript
// NEW CODE (CLEANER):
<ambientLight intensity={0.8} />
```

This was working at runtime but caused TypeScript errors and was harder to read.

## Key Learnings

### ✅ DO:
1. **Use original GLTF scene directly** - Don't clone with SkeletonUtils
2. **Apply transformations via props** - `<primitive object={scene} scale={factor} />`
3. **Guard against infinite loops** - Use refs to track "first time" callbacks
4. **Use JSX for Three.js primitives** - Cleaner than createElement
5. **Let React Three Fiber manage object lifecycle** - Don't wrap in custom Groups

### ❌ DON'T:
1. **Don't clone GLTF scenes** - SkeletonUtils.clone breaks R3F reconciliation
2. **Don't recreate metrics objects** - Causes infinite re-render loops
3. **Don't wrap primitives unnecessarily** - Use primitive directly
4. **Don't modify original GLTF** - Apply transforms via props instead
5. **Don't use createElement for R3F elements** - Use JSX

## Migration Path

### Phase 1: ✅ COMPLETE
- [x] Identify root cause (SkeletonUtils.clone)
- [x] Create minimal working version
- [x] Fix metrics loop
- [x] Stabilize rendering

### Phase 2: 🔄 IN PROGRESS
- [ ] Port animation system to work without cloning
- [ ] Update ProceduralAnimator to use original scene
- [ ] Update MovementController to use original scene
- [ ] Test animations work with non-cloned model

### Phase 3: 📋 TODO
- [ ] Remove old HumanFigure.tsx
- [ ] Rename HumanFigure.minimal.tsx → HumanFigure.tsx
- [ ] Update modelMetrics.ts to remove cloning
- [ ] Clean up debug console logs
- [ ] Update documentation

## Testing Checklist

- [x] Model loads and displays
- [x] Scene remains stable (no disappearing)
- [x] Model is properly scaled
- [x] Camera frames model correctly
- [x] No rapid zooming
- [x] Grid stays visible
- [ ] Animations work
- [ ] Text-to-animation works
- [ ] Movement controller works
- [ ] Pose library works

## Files Modified

1. **HumanFigure.minimal.tsx** (new) - Working minimal version
2. **Scene.tsx** - Fixed metrics callback loop
3. **modelMetrics.ts** - (needs update) Remove cloning

## Next Steps

1. Port animation system to work with non-cloned scene
2. Test each animation feature incrementally
3. Replace old HumanFigure.tsx with working version
4. Clean up and document changes
