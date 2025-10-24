# Animation Naming Fix ✅

## The Problem (From Your Logs)

Your console showed:
``` text
🎬 Found animations: (10) ['Armature|mixamo.com|Layer0', 'Armature|mixamo.com|Layer0.001', ...]
```

**Issues:**

1. ❌ 10 duplicate animations with cryptic Mixamo names
2. ❌ No "Standing" animation found (looking for friendly names that don't exist)
3. ❌ Pause not logging "Pausing animation in place"
4. ❌ Code looking for "standing" in names but names were "Armature|mixamo.com|Layer0"

## Root Cause

**Mixamo exports use generic animation clip names:**

- All animations named `Armature|mixamo.com|Layer0` (or .001, .002, etc.)
- These names don't describe what the animation does
- Multiple files loaded = duplicate generic names
- Keyword matching fails because "standing" ≠ "Armature|mixamo.com|Layer0"

## The Fix

### 1. Rename Animations on Load

```typescript
// OLD (BROKEN) - Used generic Mixamo names
const animations = [
  ...(standingGltf.animations || []),
  ...(walkGltf.animations || []),
  // etc...
]
// Result: ['Armature|mixamo.com|Layer0', 'Armature|mixamo.com|Layer0', ...]

// NEW (FIXED) - Clone and rename each animation
const renamedAnimations: THREE.AnimationClip[] = []

if (standingGltf.animations?.[0]) {
  const anim = standingGltf.animations[0].clone()
  anim.name = 'Standing'  // 🎯 Friendly name!
  renamedAnimations.push(anim)
}

if (walkGltf.animations?.[0]) {
  const anim = walkGltf.animations[0].clone()
  anim.name = 'Walking'  // 🎯 Friendly name!
  renamedAnimations.push(anim)
}
// etc...

// Use renamed animations
const { actions, names } = useAnimations(renamedAnimations, groupRef)
```

### 2. Improved Pause Detection

```typescript
// OLD (BROKEN) - Only checked isRunning()
if (action.isRunning() || action.paused) {
  // Pause logic
}

// NEW (FIXED) - Check weight AND running state
const isActive = action.getEffectiveWeight() > 0

if (isActive || action.isRunning() || action.paused) {
  if (isAnimating) {
    action.paused = false
    if (!action.isRunning()) {
      action.play()
    }
  } else {
    console.log('⏸️ Pausing animation in place:', name)
    action.paused = true  // Freeze current frame
  }
}
```

### 3. Better Default Animation Selection

```typescript
// Look for exact match first, then partial match
const standingAnimation = names.find(n => n === 'Standing') || 
                          names.find(n => n.toLowerCase().includes('standing'))
const defaultAnimation = standingAnimation || names[0]

console.log('▶️ Starting default animation:', defaultAnimation)
console.log('📋 Available animations:', names)
```

## Expected Console Output (After Fix)

``` text
🔄 HumanFigure: Loading animations...
✅ HumanFigure: Model loaded
🎬 HumanFigure: Found animations: ['Standing', 'Walking', 'Jumping', 'Squatting']
🎮 HumanFigure: Animation state: PLAYING
🎬 HumanFigure: Available actions: ['Standing', 'Walking', 'Jumping', 'Squatting']
▶️ HumanFigure: Starting default animation: Standing
📋 Available animations: ['Standing', 'Walking', 'Jumping', 'Squatting']
```

When you click Pause:
``` text
🎮 HumanFigure: Animation state: PAUSED
⏸️ HumanFigure: Pausing animation in place: Standing
```

When you click Play:
``` text
🎮 HumanFigure: Animation state: PLAYING
▶️ HumanFigure: Resuming animation: Standing
```

## Why This Works

**Animation Clip Names:**

- Three.js AnimationClip objects have a mutable `name` property
- Cloning creates a new clip with same data but independent properties
- We can rename the clone without affecting the original file

**Weight Detection:**

- `action.getEffectiveWeight()` returns 0-1 indicating how much the animation affects the model
- Weight > 0 means the animation is actively blending/playing
- More reliable than just checking `isRunning()`

**Exact Name Matching:**

- `names.find(n => n === 'Standing')` looks for exact match first
- Fallback to `.includes('standing')` for partial match
- Ensures we find the right animation even if naming conventions change

## Testing Checklist

After refresh, verify:

- [ ] Console shows: `Found animations: ['Standing', 'Walking', 'Jumping', 'Squatting']`
- [ ] Mannequin appears in standing pose
- [ ] Standing animation plays by default
- [ ] Click Pause → Console shows "⏸️ Pausing animation in place: Standing"
- [ ] Mannequin freezes in current pose (not T-pose)
- [ ] Click Play → Console shows "▶️ Resuming animation: Standing"
- [ ] Type "walk" + Apply → Walks
- [ ] Pause mid-walk → Freezes with leg extended
- [ ] Type "jump" + Apply → Jumps
- [ ] Type "squat" + Apply → Squats

## Key Learnings

1. **Mixamo exports have generic names** - Always rename after loading
2. **Clone before renaming** - Don't mutate original animations
3. **Use getEffectiveWeight()** - More reliable than isRunning() alone
4. **Log available animations** - Helps debug naming issues
5. **Take only first animation** - Each GLB file has one primary animation

## File Structure Assumption

Each GLB file should contain:

- Character mesh (geometry + skeleton)
- ONE animation clip (the primary animation)

``` text
Standing.glb:
  ├── Geometry (shared character mesh)
  ├── Skeleton (bone structure)
  └── AnimationClip[0] (standing animation) ← Renamed to "Standing"

Walk.glb:
  ├── Geometry (same character, ignored - we use Standing's mesh)
  ├── Skeleton (same structure)
  └── AnimationClip[0] (walking animation) ← Renamed to "Walking"
```

We use Standing.glb's mesh and merge all animations with friendly names!
