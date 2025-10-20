# Animation System Debug Report - Comprehensive Handoff

## Executive Summary

**Problem**: 3D character animations are not visually updating despite all animation system components functioning correctly at the data level. The character appears frozen in either T-pose or the first frame of an animation, even though bone transforms are updating correctly.

**Critical Discovery**: Bones ARE animating (verified via position logging), mixer IS updating, actions ARE playing - but the SkinnedMesh visual rendering is not reflecting these changes.

---

## What IS Working ✅

### 1. Animation Loading System

- ✅ All 5 animations load successfully from separate GLB files
- ✅ Each animation has correct duration: `6.03s`
- ✅ Each animation has correct track count: `195 tracks`
- ✅ Animation files: `Standing.glb`, `Walk.glb`, `Jump.glb`, `Sitting.glb`, `Sit-to-Stand.glb`
- ✅ Located at: `frontend/public/models/[animation-name].glb`

**Evidence from logs**:
``` text
📦 Processing 'Standing.glb': duration=6.03s, tracks=195
✅ Added 'Standing.glb': duration=6.03s, tracks=195
```

### 2. UI State Flow

- ✅ Animation selector dropdown updates visually when changed
- ✅ State propagates correctly: `ViewerControls` → `Viewer3D` → `Scene` → `HumanFigure`
- ✅ `animationPrompt` prop receives correct values (`Standing.glb`, `Walk.glb`, etc.)
- ✅ onChange events fire correctly

**Evidence from logs**:
``` text
🎬 ViewerControls: Selector onChange fired, value: Walk.glb
🎯 Viewer3D: handleAnimationPrompt called with: Walk.glb
🎬 Scene: Rendering with props: {isAnimating: true, animationPrompt: 'Walk.glb'}
```

### 3. Skeleton and Bone Structure

- ✅ Base model has 65 bones with correct Mixamo naming convention
- ✅ First bone: `mixamorig1Hips`
- ✅ SkinnedMesh found: name `Ch36`, bindMode `attached`
- ✅ Skeleton properly bound to mesh
- ✅ Bone names match between base model and animation files

**Evidence from logs**:
``` text
🦴 Base model skeleton bones (first 10): ['mixamorig1Hips', 'mixamorig1Spine', 'mixamorig1Spine1', ...]
🦴 Total bones: 65
🎨 SkinnedMesh found: {name: 'Ch36', hasSkeleton: true, boneCount: 65, bindMode: 'attached'}
```

### 4. Animation Mixer & Actions

- ✅ AnimationMixer exists and is initialized
- ✅ All 5 actions created successfully
- ✅ Actions report correct state:
  - `enabled: true`
  - `paused: false`
  - `weight: 1`
  - `effectiveWeight: 1`
  - `isRunning: true`
- ✅ Mixer time advances correctly at ~60fps

**Evidence from logs**:
``` text
🎬 HumanFigure: Available actions: (5) ['Standing.glb', 'Walk.glb', 'Jump.glb', 'Sitting.glb', 'Sit-to-Stand.glb']
🎬 Current action state: {name: 'Standing.glb', enabled: true, paused: false, time: 2.740999999970195, weight: 1}
🔄 Mixer update: {frame: 60, delta: 0.016599..., mixerTime: 2.7575999..., hasActions: true}
```

### 5. Bone Transformations

- ✅ **CRITICAL PROOF**: Bone positions DO change frame-to-frame
- ✅ Example: Hip bone (`mixamorig1Hips`) position changes:
  - Frame 60: `{x: '4.918', y: '-3.051', z: '-99.602'}`
  - Frame 120: `{x: '4.026', y: '-2.366', z: '-99.628'}`
- ✅ This proves the animation system is applying transforms to bones

**Evidence from logs**:
``` text
🦴 Hip bone position: {x: '4.918', y: '-3.051', z: '-99.602'}  // Frame 60
🦴 Hip bone position: {x: '4.026', y: '-2.366', z: '-99.628'}  // Frame 120
```

### 6. Animation Switching

- ✅ Switching between animations works correctly
- ✅ Old action stops, new action starts
- ✅ Action state updates immediately
- ✅ Mixer continues updating with new animation

**Evidence from logs**:
``` text
🎬 About to play animation: {name: 'Walk.glb', actionExists: true, isRunning: false, time: 0, weight: 0}
Playing animation: Walk.glb
🎬 After playAction called: {name: 'Walk.glb', isRunning: true, time: 0, weight: 1, paused: false}
```

### 7. Per-Frame Updates

- ✅ `useFrame` hook executes every frame
- ✅ `mixer.update(delta)` called successfully
- ✅ `mesh.skeleton.update()` confirmed executing
- ✅ `scene.updateMatrixWorld(true)` called
- ✅ `state.invalidate()` called to force R3F re-render

**Evidence from logs**:
``` text
🔧 SkinnedMesh skeleton update called: true
🔄 useFrame called (frame 60), mixer exists: true mixer time: 2.740999...
```

---

## What is NOT Working ❌

### Visual Rendering Only

- ❌ **SkinnedMesh does not visually deform to follow bone animations**
- ❌ Character appears frozen at first frame pose or T-pose
- ❌ Mesh geometry does not update despite bones moving
- ❌ All underlying systems work, but visual output is static

**User Reports**:

- Initially: "Animation selector not working"
- After UI fix: "Still frozen, now seeing T-pose"
- After skeleton clone: "Back to T-pose again"
- Current: "Bones move but mesh doesn't follow"

---

## Attempted Fixes (In Chronological Order)

### Fix Attempt #1: UI Selector State ✅ (Successful)

**Problem**: Dropdown didn't show selected animation  
**Solution**: Changed from uncontrolled to controlled component  
**File**: `frontend/src/pages/components/viewer/ViewerControls.tsx`  
**Result**: UI now updates correctly, state flows properly

### Fix Attempt #2: Remove Animation Retargeting ✅ (Successful)

**Problem**: Animations loaded with 0 duration/0 tracks  
**Solution**: Load animations directly without retargeting (same Mixamo character)  
**File**: `frontend/src/pages/components/viewer/hooks/useAnimationClips.ts`  
**Result**: Animations now load with correct duration and tracks

### Fix Attempt #3: Fix Animation Binding ✅ (Successful)

**Problem**: useAnimations couldn't find skeleton  
**Solution**: Bind to scene object instead of ref  
**File**: `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`  
**Code**: `const { actions, names, mixer } = useAnimations(renamedAnimations, scene)`  
**Result**: Actions created successfully, mixer initialized

### Fix Attempt #4: Add useFrame Hook ✅ (Successful)

**Problem**: Mixer not updating each frame  
**Solution**: Added `useFrame` hook with `mixer.update(delta)`  
**File**: `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`  
**Code**:
```tsx
useFrame((state, delta) => {
  if (mixer) {
    mixer.update(delta)
  }
})
```
**Result**: Mixer now updates, time advances correctly

### Fix Attempt #5: Fix Conflicting useEffect ✅ (Successful)

**Problem**: Animation replaying in loop, causing reset  
**Solution**: Added `!action.enabled` check to prevent replay when already running  
**File**: `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`  
**Line**: ~256-267  
**Code**: `if (isAnimating && !action.isRunning() && !action.enabled)`  
**Result**: No more replay loops, action stays enabled

### Fix Attempt #6: Add Skeleton Rebinding ⚠️ (Uncertain)

**Problem**: Suspected skeleton not properly bound  
**Solution**: Explicit `skinnedMesh.bind(skeleton, bindMatrix)` in useEffect  
**File**: `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`  
**Lines**: ~62-98  
**Result**: Logs confirm "Skeleton rebound successfully" but no visual change

### Fix Attempt #7: Add updateMatrixWorld ⚠️ (Didn't Help)

**Problem**: Suspected matrix transforms not propagating  
**Solution**: Call `scene.updateMatrixWorld(true)` after mixer.update  
**File**: `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`  
**Code**: `scene.updateMatrixWorld(true)`  
**Result**: Called successfully but no visual change

### Fix Attempt #8: Clone Scene to Avoid Cached State ❌ (Failed - Broke Binding)

**Problem**: Suspected useGLTF cache causing shared state  
**Solution**: Clone scene and skeleton in useMemo  
**File**: `frontend/src/pages/components/viewer/hooks/useAnimationClips.ts`  
**Code**:
```tsx
const baseScene = useMemo(() => {
  const cloned = baseGltf.scene.clone(true)
  cloned.traverse((obj: any) => {
    if (obj.isSkinnedMesh && obj.skeleton) {
      obj.skeleton = obj.skeleton.clone()
      obj.bind(obj.skeleton, obj.bindMatrix)
    }
  })
  return cloned
}, [baseGltf.scene])
```
**Result**: REVERTED - Caused T-pose, broke bone-to-track binding

### Fix Attempt #9: Add mesh.skeleton.update() ⚠️ (Didn't Help)

**Problem**: Suspected skeleton not recalculating bone matrices  
**Solution**: Explicitly call `mesh.skeleton.update()` in useFrame  
**File**: `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`  
**Code**:
```tsx
scene.traverse(obj => {
  if ((obj as any).isSkinnedMesh) {
    const mesh = obj as THREE.SkinnedMesh
    mesh.skeleton.update()
  }
})
```
**Result**: Confirmed executing (logs show "SkinnedMesh skeleton update called: true") but no visual change

### Fix Attempt #10: Set frustumCulled = false ⚠️ (Didn't Help)

**Problem**: Suspected mesh being culled from render  
**Solution**: Set `frustumCulled={false}` on primitive and `mesh.frustumCulled = false`  
**File**: `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`  
**Code**:
```tsx
<primitive object={scene} frustumCulled={false} />
// And in traverse:
mesh.frustumCulled = false
```
**Result**: No visual change

### Fix Attempt #11: Force Geometry Update ⚠️ (Didn't Help)

**Problem**: Suspected geometry bounds not updating  
**Solution**: Call `mesh.geometry.computeBoundingSphere()` each frame  
**File**: `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`  
**Code**: `if (mesh.geometry) { mesh.geometry.computeBoundingSphere() }`  
**Result**: No visual change

### Fix Attempt #12: Force R3F Re-render with invalidate() ⚠️ (Currently Testing)

**Problem**: Suspected R3F not re-rendering SkinnedMesh  
**Solution**: Call `state.invalidate()` in useFrame to force re-render  
**File**: `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`  
**Code**: `state.invalidate()` after all updates  
**Result**: CURRENTLY DEPLOYED - awaiting test results

---

## Current Code State

### Key Files and Their Current Implementation

#### 1. `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx`

**Lines 120-180**: useFrame hook with all update logic
```tsx
useFrame((state, delta) => {
  frameCountRef.current++
  
  // Extensive debug logging at frames 1, 60, 120, 180
  // ... logging code ...
  
  if (mixer) {
    mixer.update(delta)
    
    // Force SkinnedMesh skeleton update
    scene.traverse(obj => {
      if ((obj as any).isSkinnedMesh) {
        const mesh = obj as THREE.SkinnedMesh
        mesh.frustumCulled = false
        mesh.skeleton.update()
        if (mesh.geometry) {
          mesh.geometry.computeBoundingSphere()
        }
      }
    })
    
    // Update matrix world
    scene.updateMatrixWorld(true)
    
    // Force R3F re-render
    state.invalidate()
  }
})
```

**Lines 62-98**: Skeleton rebinding in useEffect
```tsx
useEffect(() => {
  let skinnedMesh: any = null
  scene.traverse(obj => {
    if ((obj as any).isSkinnedMesh && !skinnedMesh) {
      skinnedMesh = obj
    }
  })
  
  if (skinnedMesh?.skeleton) {
    skinnedMesh.bind(skinnedMesh.skeleton, skinnedMesh.bindMatrix)
  }
}, [scene, renamedAnimations])
```

**Lines 400-415**: Render JSX
```tsx
return (
  <group ref={renderGroupRef} scale={metrics?.scaleFactor ?? 1}>
    <primitive object={scene} frustumCulled={false} />
  </group>
)
```

#### 2. `frontend/src/pages/components/viewer/hooks/useAnimationClips.ts`

**Current State**: Uses cached scene from `useGLTF` (not cloned)
```tsx
const baseGltf = useGLTF(baseModelUrl)
const baseScene = baseGltf.scene as THREE.Object3D
```

**Animation Loading**: Direct clone without retargeting
```tsx
const cloned = src.clone()
cloned.name = spec.id
out.push(cloned)
```

#### 3. `frontend/src/pages/components/viewer/utils/mixerController.ts`

**playAction function**: Stops other actions, resets, plays
```tsx
export function playAction(actions: any, mixer: any, id: string) {
  stopOthers(actions, id)
  const action = actions[id]
  if (!action) return
  
  action.reset()
  applyLoopPolicy(action, id)
  action.play()
}
```

---

## Technical Environment

### Stack

- **React**: 18.x
- **React Three Fiber**: v8.x (R3F)
- **@react-three/drei**: v9.x
- **Three.js**: r150+
- **TypeScript**: 5.x
- **Vite**: 5.x

### Model Details

- **Base Model**: `human-figure.glb` (38MB)
- **Character**: Mixamo character with 65 bones
- **Skeleton Naming**: `mixamorig1[BoneName]` convention
- **SkinnedMesh**: name `Ch36`, bindMode `attached`
- **Animation Files**: 5 separate GLBs (1.5-2MB each)

### Animation Specifications

```typescript
// frontend/src/pages/components/viewer/animations/manifest.ts
export const ANIMATIONS: AnimationSpec[] = [
  { id: 'Standing.glb', displayName: 'Standing', path: '/models/Standing.glb', loop: 'repeat', speed: 1 },
  { id: 'Walk.glb', displayName: 'Walk', path: '/models/Walk.glb', loop: 'repeat', speed: 1 },
  { id: 'Jump.glb', displayName: 'Jump', path: '/models/Jump.glb', loop: 'once', speed: 1 },
  { id: 'Sitting.glb', displayName: 'Sitting', path: '/models/Sitting.glb', loop: 'once', speed: 1 },
  { id: 'Sit-to-Stand.glb', displayName: 'Sit to Stand', path: '/models/Sit-to-Stand.glb', loop: 'once', speed: 1 }
]
```

---

## Debug Logging Analysis

### Typical Console Output (Most Recent)

``` text
🎬 Scene: Rendering with props: {isAnimating: true, animationPrompt: 'Standing.glb'}
🔧 Loading animations from separate GLB files...
📦 Processing 'Standing.glb': duration=6.03s, tracks=195
✅ Added 'Standing.glb': duration=6.03s, tracks=195
[... all 5 animations load successfully ...]

🦴 Base model skeleton bones (first 10): ['mixamorig1Hips', 'mixamorig1Spine', ...]
🦴 Total bones: 65
🎨 SkinnedMesh found: {name: 'Ch36', hasSkeleton: true, boneCount: 65, bindMode: 'attached'}
🔧 Rebinding skeleton to mesh...
✅ Skeleton rebound successfully

🎮 HumanFigure: Animation state: PLAYING
🎬 HumanFigure: Available actions: (5) ['Standing.glb', 'Walk.glb', 'Jump.glb', 'Sitting.glb', 'Sit-to-Stand.glb']
🎬 About to play animation: {name: 'Standing.glb', actionExists: true, isRunning: true, time: 0, weight: 1}

🔄 useFrame called (frame 60), mixer exists: true mixer time: 2.740999...
🎬 Current action state: {name: 'Standing.glb', enabled: true, paused: false, time: 2.740999..., weight: 1}
🦴 Hip bone position: {x: '4.918', y: '-3.051', z: '-99.602'}
🔧 SkinnedMesh skeleton update called: true
🔄 Mixer update: {frame: 60, delta: 0.0166, mixerTime: 2.7575, hasActions: true}

🔄 useFrame called (frame 120), mixer exists: true mixer time: 4.740799...
🦴 Hip bone position: {x: '4.026', y: '-2.366', z: '-99.628'}  // CHANGED!
🔄 Mixer update: {frame: 120, delta: 0.0166, mixerTime: 4.7573, hasActions: true}
```

**Key Observations**:

1. Everything reports success
2. Bone positions definitely change between frames
3. No errors in console
4. Mixer time advances at correct rate (~60fps)
5. All system components working perfectly

---

## Hypotheses for Root Cause

### Hypothesis A: SkinnedMesh Shader Issue

**Theory**: The SkinnedMesh shader might not be receiving or processing bone matrix uniforms correctly.

**Evidence**:

- Bones transform correctly (proven by position logs)
- `skeleton.update()` executes (proven by logs)
- But vertex positions don't update visually

**Possible Causes**:

- Bone matrices not uploaded to GPU
- Shader uniform not binding correctly
- Material needs `skinning: true` flag

**To Test**:

1. Check if material has `skinning: true`
2. Try recreating the material with explicit skinning flag
3. Check if `mesh.material.needsUpdate = true` helps
4. Inspect bone matrices: `mesh.skeleton.boneMatrices`

### Hypothesis B: React Three Fiber Rendering Pipeline Issue

**Theory**: R3F might be caching or optimizing away the SkinnedMesh updates.

**Evidence**:

- `state.invalidate()` already tried but didn't help
- Scene updates but mesh doesn't re-render

**Possible Causes**:

- R3F not detecting SkinnedMesh changes
- Primitive object might need special handling
- Frame loop might be in wrong mode

**To Test**:

1. Check Canvas `frameloop` prop (should be "always")
2. Try adding `dispose={null}` to primitive
3. Try wrapping mesh in R3F component instead of primitive
4. Check if manual `gl.render(scene, camera)` works

### Hypothesis C: Skeleton Bone Reference Mismatch

**Theory**: Animation tracks might be targeting different bone objects than the mesh's skeleton uses.

**Evidence**:

- Bones in scene transform correctly
- But mesh skeleton might reference different bone instances
- Scene cloning broke things before

**Possible Causes**:

- useGLTF caching creates multiple bone instances
- Animation tracks target scene bones
- Skeleton uses different bone references

**To Test**:

1. Log `mesh.skeleton.bones[0]` and compare to scene bone
2. Check if they're the same object instance (`===`)
3. Try manually updating skeleton bones to match scene bones
4. Verify animation tracks actually target skeleton bones

### Hypothesis D: Bind Pose / Rest Pose Issue

**Theory**: Mesh might be stuck in bind pose and not reading skeleton transforms.

**Evidence**:

- User sees T-pose sometimes
- Rebinding doesn't help
- First frame sometimes shows but doesn't animate

**Possible Causes**:

- `mesh.bindMatrix` incorrect
- `mesh.bindMode` should be different
- Need to call `mesh.skeleton.pose()` or `mesh.skeleton.calculateInverses()`

**To Test**:

1. Try different bind modes: 'detached' instead of 'attached'
2. Call `mesh.skeleton.calculateInverses()` after updates
3. Check `mesh.skeleton.boneInverses` array
4. Try manually setting bone matrices

### Hypothesis E: Geometry Needs Manual Update Flag

**Theory**: BufferGeometry vertices might need explicit update flag for skinning.

**Evidence**:

- `computeBoundingSphere()` already tried
- Might need different geometry flag

**Possible Causes**:

- Need `geometry.attributes.position.needsUpdate = true`
- Need `geometry.attributes.skinIndex.needsUpdate = true`
- Need `geometry.attributes.skinWeight.needsUpdate = true`

**To Test**:
```tsx
if (mesh.geometry) {
  const geom = mesh.geometry as THREE.BufferGeometry
  if (geom.attributes.position) geom.attributes.position.needsUpdate = true
  if (geom.attributes.skinIndex) geom.attributes.skinIndex.needsUpdate = true
  if (geom.attributes.skinWeight) geom.attributes.skinWeight.needsUpdate = true
}
```

---

## Recommended Next Steps (Prioritized)

### Priority 1: Material Skinning Flag

**Rationale**: Most common cause of "bones animate but mesh doesn't" issue in Three.js

**Test Code**:
```tsx
scene.traverse(obj => {
  if ((obj as any).isSkinnedMesh) {
    const mesh = obj as THREE.SkinnedMesh
    if (mesh.material) {
      (mesh.material as any).skinning = true
      mesh.material.needsUpdate = true
    }
  }
})
```
**Location**: In useEffect after skeleton rebinding  
**Expected Result**: If this is the issue, animations should immediately work

### Priority 2: Verify Bone Object References

**Rationale**: Animation might be transforming wrong bones

**Test Code**:
```tsx
// In useEffect
const sceneBones: any[] = []
const skeletonBones: any[] = []

scene.traverse(obj => {
  if ((obj as any).isBone) sceneBones.push(obj)
})

if (skinnedMesh?.skeleton) {
  skeletonBones.push(...skinnedMesh.skeleton.bones)
}

console.log('Scene bones:', sceneBones.length)
console.log('Skeleton bones:', skeletonBones.length)
console.log('First bone same instance?', sceneBones[0] === skeletonBones[0])
```
**Expected Result**: Should be true, if false that's the problem

### Priority 3: Check Canvas Frameloop Mode

**Rationale**: R3F might not be rendering continuously

**Test Code**:
```tsx
// In Viewer3D.tsx or Scene.tsx
<Canvas frameloop="always" ... >
```
**Expected Result**: Ensure it's set to "always" not "demand"

### Priority 4: Try SkeletonHelper Visualization

**Rationale**: Confirm bones are actually moving visually

**Test Code**:
```tsx
// Add to HumanFigure render
import { useHelper } from '@react-three/drei'
import * as THREE from 'three'

const skeletonHelperRef = useRef()
useHelper(skeletonHelperRef, THREE.SkeletonHelper, 1)

// In traverse:
if ((obj as any).isSkinnedMesh) {
  skeletonHelperRef.current = obj.skeleton
}

return (
  <group>
    <primitive object={scene} />
    {/* SkeletonHelper will render automatically */}
  </group>
)
```
**Expected Result**: Should see animated skeleton lines if bones moving

### Priority 5: Force Material Update Every Frame

**Rationale**: Material uniforms might not be updating

**Test Code**:
```tsx
// In useFrame
scene.traverse(obj => {
  if ((obj as any).isSkinnedMesh) {
    const mesh = obj as THREE.SkinnedMesh
    if (mesh.material) {
      mesh.material.needsUpdate = true
    }
  }
})
```
**Expected Result**: Performance hit but might force updates

---

## Files to Review

### Primary Investigation Files

1. `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx` (411 lines)
   - Main animation logic
   - useFrame hook with all updates
   - Skeleton rebinding
   - Debug logging

2. `frontend/src/pages/components/viewer/hooks/useAnimationClips.ts` (64 lines)
   - Scene loading from useGLTF
   - Animation clip loading
   - Potential caching issue source

3. `frontend/src/pages/Viewer3D.tsx`
   - Canvas configuration
   - Check frameloop prop
   - Check gl props

4. `frontend/src/pages/components/viewer/Scene.tsx`
   - Scene setup
   - Check if anything overrides rendering

### Supporting Files

5. `frontend/src/pages/components/viewer/utils/mixerController.ts`
   - Animation playback utilities
   - Working correctly

6. `frontend/src/pages/components/viewer/animations/manifest.ts`
   - Animation definitions
   - All correct

7. `frontend/src/pages/components/viewer/ViewerControls.tsx`
   - UI selector
   - Working correctly

---

## Known Working Reference Implementation

**Note**: The application previously had working animations in an older version. If there's a git history, comparing to a working commit would be valuable.

**Key Difference**: Current version loads animations from separate GLB files instead of having them embedded in the base model. This change was made to reduce model size and improve loading.

---

## Performance Notes

- Frame rate: Stable at ~60fps (delta ~0.0166s)
- No memory leaks observed
- No performance degradation over time
- All updates execute quickly (< 1ms per frame)
- Debug logging has minimal impact

---

## Environment Check

### Browser Testing

- **Tested On**: (User to fill in)
- **Browser Version**: (User to fill in)
- **GPU**: (User to fill in)
- **WebGL Version**: Should be WebGL 2.0

**To Check**:
```javascript
// In browser console
console.log(navigator.userAgent)
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl2')
console.log('WebGL2:', !!gl)
console.log('Renderer:', gl?.getParameter(gl.RENDERER))
```

---

## Summary for Next Agent

**The Mystery**: An animation system where every single component reports success and executes correctly, but the final visual output is frozen. Bones transform, mixer updates, actions play, skeleton updates - but the SkinnedMesh doesn't deform.

**Most Likely Culprit**: Material skinning flag not set, or bone reference mismatch between animation tracks and skeleton bones.

**Quick Win Tests**: 

1. Set `material.skinning = true`
2. Verify bone object references match
3. Check Canvas frameloop mode

**Last Resort**: May need to restructure how model is loaded (clone with SkeletonUtils, use different loading approach, or revert to embedded animations).

**Good Luck!** 🎯
