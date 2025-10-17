# v2/hooks.ts usePlayback Effect Consolidation Analysis

**Date:** October 16, 2025  
**Priority:** 🟡 MEDIUM  
**Status:** 🚧 In Progress  
**Context:** Sprint 1 Quick Wins - Effect consolidation pattern

---

## 📋 Current State Analysis

### usePlayback Hook - 3 useEffect blocks identified

**Location:** `frontend/src/pages/v2/hooks.ts` lines 91-130

---

## 🔍 Effect Breakdown

### Effect 1: Default Selection (Lines 91-105)
```typescript
useEffect(() => {
  if (!actions || names.length === 0 || currentRef.current) return
  const def = pickDefaultId(names as string[]) || names[0]
  if (def && actions[def]) {
    if (lastPoseForId.current !== def) applyRestPoseFor(def)
    playAction(actions as any, mixer as any, def)
    currentRef.current = def
    onActiveChange?.(def)
    // Always start the action so the mixer has a bound target, then pause if needed
    if (!isAnimating) setPaused(actions[def], true)
    if (log) console.info('[v2] Default animation selected:', def)
  }
}, [actions, names, mixer, isAnimating, onActiveChange, log, applyRestPoseFor])
```

**Trigger:** actions, names, mixer, isAnimating, onActiveChange, log, applyRestPoseFor  
**Purpose:** Initialize first animation when actions become available  
**Domain:** Initialization lifecycle  
**Guards:** Only runs if currentRef.current is null (one-time initialization)

**Key Behaviors:**
- Picks default animation ID from names
- Applies rest pose if needed
- Plays animation
- Updates currentRef
- Pauses if not animating
- Calls onActiveChange callback

---

### Effect 2: Play/Pause Control (Lines 107-111)
```typescript
useEffect(() => {
  const id = currentRef.current
  if (!id || !actions) return
  setPaused(actions[id], !isAnimating)
}, [isAnimating, actions])
```

**Trigger:** isAnimating, actions  
**Purpose:** Control play/pause state of current animation  
**Domain:** Playback control  
**Guards:** Requires currentRef.current to be set

**Key Behaviors:**
- Gets current animation ID from ref
- Sets paused state based on isAnimating flag
- Simple toggle behavior

---

### Effect 3: Finished Event Handler (Lines 113-127)
```typescript
useEffect(() => {
  if (!mixer || !actions) return
  const onFinished = () => {
    const id = currentRef.current
    if (!id) return
    const firstRepeat = (names as string[]).find(n => ANIMATIONS.find(a => a.id === n && a.loop === 'repeat'))
    if (firstRepeat && actions[firstRepeat]) {
      if (lastPoseForId.current !== firstRepeat) applyRestPoseFor(firstRepeat)
      playAction(actions as any, mixer as any, firstRepeat)
      currentRef.current = firstRepeat
      onActiveChange?.(firstRepeat)
      if (log) console.info('[v2] One-shot finished, fallback to:', firstRepeat)
    }
  }
  ;(mixer as any).addEventListener?.('finished', onFinished)
  return () => { try { (mixer as any).removeEventListener?.('finished', onFinished) } catch { /* noop */ } }
}, [mixer, actions, names, onActiveChange, log, applyRestPoseFor])
```

**Trigger:** mixer, actions, names, onActiveChange, log, applyRestPoseFor  
**Purpose:** Handle animation completion, fallback to looping animation  
**Domain:** Event handling / lifecycle  
**Guards:** Requires mixer and actions

**Key Behaviors:**
- Registers 'finished' event listener on mixer
- When animation finishes, finds first repeating animation
- Applies rest pose and switches to fallback animation
- Updates currentRef and calls onActiveChange
- Cleanup: removes event listener

---

## 🤔 Consolidation Analysis

### Challenges

**1. Different Lifecycle Concerns**
- **Effect 1:** Initialization (one-time, runs when actions first available)
- **Effect 2:** Reactive control (runs on every isAnimating change)
- **Effect 3:** Event subscription (runs when mixer/actions change, persistent listener)

**2. Different Trigger Patterns**
- Effect 1: Complex dependencies including isAnimating (for initial pause state)
- Effect 2: Simple dependencies (isAnimating, actions)
- Effect 3: Event handler with cleanup (mixer lifecycle)

**3. Guard Conditions**
- Effect 1 has explicit guard: `currentRef.current` must be null
- Effect 2 has simple guard: needs current ID
- Effect 3 has no guard beyond null checks

**4. Cleanup Requirements**
- Effect 1: No cleanup
- Effect 2: No cleanup
- Effect 3: **Critical cleanup** - must remove event listener

### Overlap Analysis

❌ **No significant overlap detected**

- Effect 1: One-time initialization logic
- Effect 2: Continuous reactive play/pause
- Effect 3: Event subscription with cleanup

These are fundamentally different concerns:
1. **Initialization** - runs once to set up
2. **State synchronization** - runs on every toggle
3. **Event handling** - persistent subscription

---

## 💡 Consolidation Options

### Option A: Keep Separate (Recommended ✅)

**Rationale:**
- Each effect serves a distinct purpose with different lifecycles
- Effect 2 needs to run frequently (on every play/pause)
- Effect 3 needs cleanup (event listener management)
- Effect 1 is one-time initialization with complex guard
- Consolidating would create a complex mega-effect with multiple responsibilities

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Easy to understand each effect's purpose
- ✅ Proper cleanup handling (Effect 3)
- ✅ Efficient re-runs (Effect 2 doesn't need mixer/names dependencies)
- ✅ Follows React best practices (one effect per concern)

**Assessment:** These effects are **already well-structured** ✨

---

### Option B: Partial Consolidation (Effects 1 & 3)

**Rationale:**
Effects 1 and 3 both:
- Share dependencies: mixer, actions, names, onActiveChange, log, applyRestPoseFor
- Handle animation transitions (start vs. fallback)
- Update currentRef and call onActiveChange

**Could consolidate:**
```typescript
useEffect(() => {
  // Initialization
  if (!currentRef.current && actions && names.length > 0) {
    const def = pickDefaultId(names as string[]) || names[0]
    if (def && actions[def]) {
      if (lastPoseForId.current !== def) applyRestPoseFor(def)
      playAction(actions as any, mixer as any, def)
      currentRef.current = def
      onActiveChange?.(def)
      if (!isAnimating) setPaused(actions[def], true)
      if (log) console.info('[v2] Default animation selected:', def)
    }
  }

  // Event handler
  if (!mixer || !actions) return
  const onFinished = () => {
    const id = currentRef.current
    if (!id) return
    const firstRepeat = (names as string[]).find(n => ANIMATIONS.find(a => a.id === n && a.loop === 'repeat'))
    if (firstRepeat && actions[firstRepeat]) {
      if (lastPoseForId.current !== firstRepeat) applyRestPoseFor(firstRepeat)
      playAction(actions as any, mixer as any, firstRepeat)
      currentRef.current = firstRepeat
      onActiveChange?.(firstRepeat)
      if (log) console.info('[v2] One-shot finished, fallback to:', firstRepeat)
    }
  }
  mixer.addEventListener?.('finished', onFinished)
  return () => { try { mixer.removeEventListener?.('finished', onFinished) } catch { /* noop */ } }
}, [mixer, actions, names, isAnimating, onActiveChange, log, applyRestPoseFor])
```

**Issues:**
- ❌ Adds `isAnimating` to dependencies → event listener re-registers on every play/pause
- ❌ Initialization code runs on every effect re-run (must rely on guard)
- ❌ Mixed concerns (initialization + event handling)
- ❌ Less efficient (more re-runs than necessary)

**Assessment:** Creates more problems than it solves

---

### Option C: All Three Effects (Anti-pattern ⛔)

Consolidating all three would result in:
- Massive dependency array
- Mixed initialization, reactive state, and event handling
- Inefficient re-runs
- Harder to debug
- Violates single responsibility principle

**Assessment:** Clear anti-pattern, do not pursue

---

## 🎯 Recommendation

### ✅ Keep Current Structure (No Consolidation)

**Decision:** The current 3-effect structure is **optimal** and follows React best practices.

**Reasoning:**

1. **Separation of Concerns**
   - Effect 1: Initialization (one-time setup)
   - Effect 2: State sync (reactive control)
   - Effect 3: Event management (persistent subscription)

2. **Efficient Re-runs**
   - Effect 2 only re-runs on isAnimating/actions changes (frequent)
   - Effect 3 only re-runs on mixer/actions changes (rare)
   - Effect 1 only runs when guard conditions met (once)

3. **Clear Intent**
   - Each effect has a clear, single purpose
   - Easy to understand and maintain
   - Follows React.dev documentation patterns

4. **Proper Cleanup**
   - Effect 3 has critical event listener cleanup
   - Consolidation would complicate cleanup logic

5. **Not Like App.tsx**
   - App.tsx had cascading effects with duplicate logic
   - usePlayback effects have distinct purposes, no cascades
   - No duplicate reset logic or state synchronization issues

---

## 📊 Comparison: App.tsx vs. usePlayback

| Aspect | App.tsx (Needed Consolidation) | usePlayback (Already Optimal) |
|--------|--------------------------------|-------------------------------|
| **Effect Count** | 6 effects → 3 after consolidation | 3 effects (optimal) |
| **Overlapping Logic** | ✅ Yes - multiple reset calls | ❌ No - distinct purposes |
| **Cascading Triggers** | ✅ Yes - sessionId changes trigger multiple effects | ❌ No - independent triggers |
| **Duplicate Code** | ✅ Yes - resetAllTrackingState called 3 times | ❌ No duplication |
| **Mixed Concerns** | ✅ Yes - selection logic scattered | ❌ No - clear separation |
| **Consolidation Benefit** | 🎯 HIGH - 75% reduction, atomic updates | 🚫 NONE - would add complexity |

---

## ✅ Conclusion

**Status:** ⏭️ SKIP - No refactoring needed

The `usePlayback` hook is **already well-structured** and follows React best practices. The three effects serve distinct purposes with different lifecycles, dependencies, and cleanup requirements. 

Consolidating these effects would:
- Reduce code clarity
- Create inefficient re-runs
- Mix unrelated concerns
- Complicate cleanup logic

**Recommendation:** Mark this opportunity as **COMPLETE** ✅ with status "No changes needed - already optimal structure"

---

## 📚 Learning

This analysis reinforces an important principle:

> **Not all multiple effects need consolidation.**
> 
> Consolidate when effects have:
> - Overlapping logic (duplicate code)
> - Cascading triggers (one effect's setState triggers another)
> - Shared domain concerns (selection, session, etc.)
> 
> Keep separate when effects have:
> - Different lifecycles (initialization vs. reactive vs. event)
> - Different purposes (distinct concerns)
> - Different cleanup needs
> - Different dependency patterns

The goal is **clarity and maintainability**, not just **fewer effects**.
