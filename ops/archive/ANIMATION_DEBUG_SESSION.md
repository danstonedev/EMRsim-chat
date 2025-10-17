# Animation Debugging Session 🔍

## Current Issues

Based on your report:
1. ❌ Page loads with **Walking** animation (but logs say "Starting Standing")
2. ❌ Pause snaps to **T-pose** instead of freezing current pose
3. ❌ Animation selector input not working

## Hypothesis

**The GLB files may be misnamed!**

When you downloaded from Mixamo, you might have:
- Downloaded "Walking" animation but saved it as "Standing.glb"
- Downloaded "Standing" but saved it as "Walk.glb"
- Or the exports got mixed up

## New Debugging Logs Added

The code now logs:
```
📁 Standing.glb animations: ['Armature|mixamo.com|Layer0']
📁 Walk.glb animations: ['Armature|mixamo.com|Layer0']
📁 Jump.glb animations: ['Armature|mixamo.com|Layer0']
📁 Squat.glb animations: ['Armature|mixamo.com|Layer0']
✏️ Renamed "Armature|mixamo.com|Layer0" → "Standing"
✏️ Renamed "Armature|mixamo.com|Layer0" → "Walking"
...
🎯 Current animation to control: Standing
📊 Action state: {isRunning: true, paused: false, time: 1.234, weight: 1}
⏸️ Before pause - time: 2.5 weight: 1
⏸️ After pause - time: 2.5 paused: true
```

## What To Check in Console

### 1. Which File Contains Which Animation?

**Refresh the page** and look for these logs right at the start:
```
📁 Standing.glb animations: [...]
📁 Walk.glb animations: [...]
```

The original Mixamo names won't tell us much, but...

### 2. Watch the Model!

**Visual inspection is key:**
- Does the mannequin start **walking** or **standing still**?
- If it's WALKING but logs say "Starting Standing", then **Standing.glb contains the walk animation!**

### 3. Pause Behavior

When you click Pause, check for:
```
🎯 Current animation to control: Standing (or null?)
⚠️ No current animation set or action not found!
```

If you see the warning, it means `currentAnimationRef.current` is `null`, which would cause a snap to T-pose.

## Likely Solutions

### Solution 1: Files Are Misnamed

If Standing.glb contains walking:

**Option A - Rename the files:**
```powershell
cd C:\Users\danst\EMRsim-chat\frontend\public\models\animations\

# Rename to temp names first
Rename-Item "Standing.glb" "Temp.glb"
Rename-Item "Walk.glb" "Standing.glb"
Rename-Item "Temp.glb" "Walk.glb"
```

**Option B - Fix the code:**
Change which file we use as the base model:
```typescript
// If Standing.glb actually has walking, use Walk.glb as base
const standingGltf = useGLTF(WALK_URL)  // Swap these!
const walkGltf = useGLTF(STANDING_URL)  // Swap these!
```

### Solution 2: Component Re-mounting

The logs show HumanFigure loading 5+ times. This resets `currentAnimationRef`.

**Check React StrictMode** in `main.tsx`:
```typescript
// Remove StrictMode temporarily to test
// <React.StrictMode>
  <App />
// </React.StrictMode>
```

StrictMode intentionally double-renders in development, which resets refs.

### Solution 3: Pause Not Working

If pause snaps to T-pose:
- `currentAnimationRef.current` is becoming `null`
- OR the action is being `.stop()` instead of `paused = true`
- OR React is re-creating the component

## Next Steps

1. **Refresh page** and copy console output (all of it!)
2. **Watch the mannequin** - Is it walking or standing?
3. **Click Pause** - Does it freeze or snap to T-pose?
4. **Copy the pause logs** - What does it say?

Then we'll know EXACTLY what's wrong! 🎯

## File Check Command

Run this to see file sizes (might help identify which is which):
```powershell
Get-ChildItem "C:\Users\danst\EMRsim-chat\frontend\public\models\animations\" | Format-Table Name, Length
```

Walking animations are usually larger than standing (more keyframes).
