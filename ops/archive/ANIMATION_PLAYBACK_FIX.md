# Animation Playback Fix - In Progress

## Real Problem Identified

The animation selector UI is working correctly (state flows properly), but the 3D model **isn't visually animating**. The figure stays in idle standing pose regardless of selection.

### Console Evidence
```
✅ HumanFigure: Switching to animation: Walk.glb
Playing animation: Walk.glb
```

State flow is correct, but animations have **zero duration**:
```
Prepared animations: [{duration: 0.00}, {duration: 0.00}, ...]
⚠️ Animation 'Standing.glb' has zero duration or tracks
```

## Root Cause

**Animation Retargeting Failure**: The separate animation GLB files cannot be retargeted to the base model skeleton because:

1. **Base model**: `human-figure.glb` (38MB) - Full character with skeleton
2. **Animation files**: `Standing.glb`, `Walk.glb`, etc. (1.5-2MB each) - Downloaded "without skin"
3. **Bone name mismatch**: Animation bones don't match base model bones

### Two Possible Solutions

#### Option A: Use Base Model's Embedded Animations (RECOMMENDED)
The 38MB `human-figure.glb` likely contains all animations already. The 1.2MB backup suggests the current file is different.

**Implementation**: Modified `useAnimationClips.ts` to:
1. Check if base model has animations
2. Use those directly (no retargeting needed)
3. Map them to the manifest spec names

**Status**: ✅ Code updated, awaiting browser test

#### Option B: Fix Retargeting
Make bone name mapping work between separate files.

**Challenges**:
- Need to debug bone name differences
- Complex skeleton mapping
- Might not work if skeletons are fundamentally different

## Files Modified

### `frontend/src/pages/components/viewer/hooks/useAnimationClips.ts`

Added logic to prioritize base model animations:
```typescript
// First, try to use animations from the base model itself
if (baseGltf.animations && baseGltf.animations.length > 0) {
  console.log('✅ Using animations from base model')
  baseGltf.animations.forEach((clip, idx) => {
    const cloned = clip.clone()
    const spec = ANIMATIONS[idx]
    if (spec) {
      cloned.name = spec.id
    }
    out.push(cloned)
  })
  return out
}
```

Added enhanced debugging:
- Log base model animation count
- Log bone names from both models
- Log retargeting results
- Log remapping results

## Next Steps

1. **Check browser console** for new debug output:
   - Does base model have animations?
   - If yes, how many?
   - What are their names?

2. **If base model HAS animations**:
   - ✅ Should work automatically with new code
   - Verify animations play correctly
   - Clean up debug logs

3. **If base model DOESN'T have animations**:
   - Need to fix retargeting logic
   - Or replace `human-figure.glb` with version that includes animations
   - Check if backup file `human-figure.glb.backup` is the correct one

## Expected Console Output (Success Case)

```
🎬 Base model info: { animations: 5, animationNames: ['Standing', 'Walk', ...] }
✅ Using animations from base model: ['Standing', 'Walk', 'Jump', 'Sitting', 'Sit-to-Stand']
Prepared animations: [{duration: 2.50}, {duration: 1.33}, ...]
Playing animation: Walk.glb
```

## Expected Console Output (Failure Case - Need Retargeting Fix)

```
🎬 Base model info: { animations: 0, animationNames: [] }
⚠️ No animations in base model, attempting to load from separate files...
🔧 Processing animation 'Walk.glb': { srcDuration: 1.33, srcTracks: 65 }
🦴 Base skeleton bones: ['mixamorig:Hips', 'mixamorig:Spine', ...]
🦴 Source skeleton bones: ['mixamorig1:Hips', 'mixamorig1:Spine', ...]
❌ Retarget failed for 'Walk.glb': [error details]
🔄 Remapped 'Walk.glb': { duration: 0, tracks: 0 }
```

## Testing Checklist

- [ ] Check console for base model animation count
- [ ] If animations exist, verify they play
- [ ] Test all 5 animations (Standing, Walk, Jump, Sitting, Sit-to-Stand)
- [ ] Verify smooth transitions
- [ ] Check animation durations are > 0
- [ ] Verify selector updates visually

## Fallback Plan

If current approach doesn't work:
1. Swap `human-figure.glb` with `human-figure.glb.backup`
2. Or download fresh Mixamo model WITH animations embedded
3. Or fix bone name mapping in retargeting logic
