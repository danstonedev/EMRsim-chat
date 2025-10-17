# 🔍 Refactoring Opportunities & Progress Tracker

**Date Created:** October 16, 2025  
**Last Updated:** October 16, 2025  
**Context:** Discovered during Phase 1-3 startup loading refactoring  
**Status:** 🚧 Active Development

---

## 📊 Executive Dashboard

### Overall Progress
- **Total Opportunities:** 15 (12 actionable, 2 skipped, 3 complete)
- **Completed:** 3 ✅
- **Skipped:** 2 ❌ (not applicable)
- **In Progress:** 0 🚧
- **Not Started:** 10 ⏳
- **Estimated Remaining Effort:** 29-43 hours
- **Expected Impact:** Major state management modernization + continued effect consolidation

### Quick Stats
| Priority | Count | Completed | Skipped | In Progress | Not Started |
|----------|-------|-----------|---------|-------------|-------------|
| 🔥 HIGH | 2 | 1 | 0 | 0 | 1 |
| 🟡 MEDIUM | 2 | 1 | 1 | 0 | 0 |
| 🟢 LOW | 4 | 1 | 1 | 0 | 2 |

### Completion Timeline
## 📈 Completion Timeline

| Date | Opportunity | Status | Notes |
|------|-------------|--------|-------|
| 2025-10-16 | useAnimationFrame hook | ✅ Complete | Extracted from PlaybackModal, reusable RAF pattern |
| 2025-10-16 | Scene.tsx metrics | ❌ Skipped | Intentional design, different use case from useModelMetrics |
| 2025-10-16 | App.tsx effect consolidation | ✅ Complete | 6 effects → 3 (4 selection effects → 1 unified), tests passing |
| 2025-10-16 | v2/hooks.ts usePlayback | ❌ Skipped | Already optimal - 3 effects have distinct purposes, proper separation of concerns |
| 2025-10-16 | useVoiceSession reducer migration | ✅ Complete | 15 useState → 1 useReducer, 21 tests passing, atomic updates |
| 2025-10-16 | Deep codebase scan | ✅ Complete | Found 7 new opportunities, documented in DEEP_CODEBASE_SCAN.md |

---

## 🎯 Priority Matrix (Impact × Effort)

Based on research in `REACT_BEST_PRACTICES_2025.md`:

```
High Impact │
            │ 1️⃣BackendSocket  2️⃣App.tsx Effects
            │      │                │
            │      │                │
            │──────┼────────────────┼──────────→
            │      │  3️⃣useVoice   │ 4️⃣usePlayback
            │      │   Session      │
Low Impact  │  5️⃣Settings  6️⃣Scene  7️⃣RAF  8️⃣Legacy
            │
            └──────────────────────────────────→
              Low Effort          High Effort
```

**ROI Ranking (Recommended Order):**
1. 🥇 **App.tsx Effects** - High impact, low effort, proven pattern
2. 🥈 **BackendSocketManager** - High impact, medium effort, big win
3. 🥉 **Scene.tsx Metrics** - Quick win, reuse existing code
4. **PlaybackModal RAF** - Extract reusable pattern
5. **v2/hooks usePlayback** - Medium impact, follows Phase 3
6. **useVoiceSession Reducer** - High complexity, high reward
7. **SettingsContext** - Optimization, nice-to-have
8. **HumanFigure Legacy** - Cleanup, low priority

---

## 📋 Opportunity Tracking

### 🔥 Priority Matrix Visualization

| Opportunity | Priority | Impact (1-5) | Effort (1-5) | Risk | ROI Score | Status |
|-------------|----------|--------------|--------------|------|-----------|--------|
| 1. BackendSocketManager | 🔥 HIGH | 5 | 3 | LOW | ⭐⭐⭐⭐⭐ | ⏳ Not Started |
| 2. App.tsx Effects | 🔥 HIGH | 5 | 2 | LOW | ⭐⭐⭐⭐⭐ | ✅ Complete |
| 3. useVoiceSession Reducer | 🟡 MEDIUM | 4 | 4 | MEDIUM | ⭐⭐⭐⭐ | ✅ Complete |
| 4. v2/hooks usePlayback | 🟡 MEDIUM | N/A | N/A | N/A | N/A | ❌ Skipped |
| 5. SettingsContext | 🟢 LOW | 3 | 3 | LOW | ⭐⭐⭐ | ⏳ Not Started |
| 6. Scene.tsx Metrics | 🟢 LOW | N/A | N/A | N/A | N/A | ❌ Skipped |
| 7. PlaybackModal RAF | 🟢 LOW | 2 | 1 | LOW | ⭐⭐⭐ | ⏳ Not Started |
| 8. HumanFigure Cleanup | 🟢 LOW | 1 | 2 | LOW | ⭐⭐ | ⏳ Not Started |

---

## 🎯 Detailed Opportunity Cards

**Categorized by Impact:**

| Priority | Area | Estimated Effort | Impact |
|----------|------|------------------|--------|
| 🔥 HIGH | BackendSocketManager | 3-4 hours | State management modernization |
| 🔥 HIGH | App.tsx remaining effects | 2-3 hours | Effect consolidation |
| 🟡 MEDIUM | useVoiceSession state sprawl | 4-6 hours | Reducer pattern migration |
| 🟡 MEDIUM | v2/hooks.ts usePlayback | 2-3 hours | Effect consolidation |
| 🟢 LOW | SettingsContext patterns | 2-3 hours | Context optimization |
| 🟢 LOW | Scene.tsx metrics handling | 1-2 hours | Hook extraction |
| 🟢 LOW | PlaybackModal RAF management | 1-2 hours | Custom hook |
| 🟢 LOW | HumanFigure.tsx cleanup | 2-3 hours | Legacy removal |

---

## 1. 🔥 HIGH PRIORITY: BackendSocketManager State Management

**Status:** 🚧 In Progress  
**Priority:** 🔥 HIGH  
**Effort:** 3-4 hours  
**Impact:** 5/5 (Major state management modernization)  
**Risk:** LOW (class can remain for backward compatibility)  
**ROI Score:** ⭐⭐⭐⭐⭐  
**Discovered:** Oct 16, 2025  
**Started:** Oct 16, 2025  
**Target Completion:** TBD

### Progress Checklist

- [x] Initial analysis complete
- [x] Best practices research complete (see REACT_BEST_PRACTICES_2025.md)
- [ ] Implementation plan created
- [ ] API contract defined (hook interface + return type)
- [ ] Unit tests written
- [ ] Hook implemented
- [ ] Integration tests passing
- [ ] Migration guide written
- [ ] Code review complete
- [ ] Documentation updated

### Current State

`frontend/src/shared/services/BackendSocketManager.ts` (368 lines)

**Issues:**
- Class-based pattern in React hooks ecosystem
- Internal state management separate from React lifecycle
- No reactive updates (requires polling via `isConnected()`)
- Event handlers passed via constructor (not reactive to prop changes)
- Manual subscription management

**Current Pattern:**
```typescript
export class BackendSocketManager {
  private socket: Socket | null = null
  private failureCount = 0
  private lastReceivedTimestamp = 0
  private enabled: boolean
  private currentSessionId: string | null = null
  
  constructor(config: SocketConfig, handlers: SocketEventHandlers = {}) {
    // ...
  }
  
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }
}
```

**Problems:**
1. **Not React-friendly:** Requires `useState` + `useEffect` polling in consuming components
2. **Stale closures:** Event handlers don't update when props change
3. **Memory leaks:** Manual cleanup burden on consumers
4. **Testing difficulty:** Class instances harder to mock than hooks

### Recommended Solution

**Extract to `useBackendSocket` hook:**

```typescript
// frontend/src/shared/hooks/useBackendSocket.ts

interface UseBackendSocketOptions {
  apiBaseUrl: string
  sessionId: string | null
  enabled?: boolean
  onTranscript?: (data: TranscriptData) => void
  onConnect?: () => void
  onDisconnect?: (reason: string) => void
  // ... other handlers
}

export function useBackendSocket(options: UseBackendSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [failureCount, setFailureCount] = useState(0)
  const [lastTimestamp, setLastTimestamp] = useState(0)
  
  const socketRef = useRef<Socket | null>(null)
  const enabledRef = useRef(options.enabled ?? true)
  
  // Update refs when handlers change (avoids reconnection)
  const handlersRef = useRef(options)
  useEffect(() => {
    handlersRef.current = options
  }, [options])
  
  // Single effect for socket lifecycle
  useEffect(() => {
    if (!enabledRef.current || !options.apiBaseUrl) return
    
    const socket = io(options.apiBaseUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      // ... config
    })
    
    socket.on('connect', () => {
      setIsConnected(true)
      handlersRef.current.onConnect?.()
    })
    
    socket.on('disconnect', (reason) => {
      setIsConnected(false)
      handlersRef.current.onDisconnect?.(reason)
    })
    
    socket.on('transcript', (data: TranscriptData) => {
      setLastTimestamp(data.timestamp)
      handlersRef.current.onTranscript?.(data)
    })
    
    socketRef.current = socket
    
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [options.apiBaseUrl, options.sessionId])
  
  // Memoized control methods
  const joinSession = useCallback((sessionId: string) => {
    socketRef.current?.emit('join-session', sessionId)
  }, [])
  
  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
  }, [])
  
  return {
    isConnected,
    failureCount,
    lastTimestamp,
    joinSession,
    disconnect,
  }
}
```

**Benefits:**
- ✅ Fully reactive (no polling needed)
- ✅ Automatic cleanup on unmount
- ✅ Fresh handlers via refs (no stale closures)
- ✅ Standard React patterns
- ✅ Easy to test with `@testing-library/react-hooks`

**Migration Path:**
1. Create `useBackendSocket` hook alongside existing class
2. Add feature flag to switch between implementations
3. Migrate one consumer at a time
4. Remove class when all consumers migrated
5. Risk: **LOW** (additive changes)

**Estimated Effort:** 3-4 hours

---

## 2. 🔥 HIGH PRIORITY: App.tsx Effect Consolidation

**Status:** ✅ COMPLETE  
**Priority:** 🔥 HIGH  
**Effort:** 3 hours (actual)  
**Impact:** 5/5 (50% effect reduction, atomic state updates)  
**Risk:** LOW (tested approach, straightforward refactor)  
**ROI Score:** ⭐⭐⭐⭐⭐  
**Discovered:** Oct 16, 2025  
**Completed:** Jan 20, 2025  
**Dependencies:** None

### Progress Checklist

- [x] Initial analysis complete
- [x] Phase 3 pattern validated
- [x] Identify all 6 effect blocks precisely
- [x] Map effect dependencies and triggers
- [x] Group effects by domain (selection lifecycle)
- [x] Create consolidation plan (APP_TX_EFFECT_CONSOLIDATION.md)
- [x] Write tests for current behavior
- [x] Implement consolidated effects
- [x] Verify tests pass (type-check + all tests ✅)
- [x] Measure effect count reduction (6 → 3, 50% reduction)
- [x] Code review complete

### Current State

`frontend/src/pages/App.tsx` - **6 remaining useEffect blocks**

**Issues:**  
Lines 145-149, 149-156, 156-258, 258-300, 300-339, 339+

**Similar to Phase 3 work, but different domain:**
- Multiple effects managing related session/message state
- Effect execution cascades on state changes
- Scattered initialization logic
- Some effects have overlapping concerns

**Example cascade:**
```typescript
// Effect 1: sessionId changes
useEffect(() => {
  // Update diagnostics
}, [sessionId])

// Effect 2: sessionId changes
useEffect(() => {
  // Update backend socket
}, [sessionId])

// Effect 3: sessionId changes  
useEffect(() => {
  // Update voice session
}, [sessionId])
```

### Recommended Solution

**Consolidate related effects into domain-specific effects:**

**Option A: Session Lifecycle Effect**
```typescript
// Consolidate all sessionId-related effects
useEffect(() => {
  if (!sessionId) return
  
  // Diagnostics update
  diagnostics.updateSession(sessionId)
  
  // Socket update
  backendSocket.joinSession(sessionId)
  
  // Voice session update
  voiceSession.setSessionId(sessionId)
  
  if (import.meta.env.DEV) {
    console.debug('[App] Session lifecycle updated:', { sessionId })
  }
}, [sessionId, diagnostics, backendSocket, voiceSession])
```

**Option B: Extract to custom hook**
```typescript
// frontend/src/shared/hooks/useSessionOrchestration.ts
export function useSessionOrchestration({
  sessionId,
  diagnostics,
  backendSocket,
  voiceSession,
}) {
  useEffect(() => {
    // Consolidated logic from multiple App.tsx effects
  }, [sessionId])
  
  return { /* orchestration methods */ }
}
```

**Benefits:**
- ✅ Reduces effect count by ~50%
- ✅ Clearer dependency relationships
- ✅ Easier to debug (single execution point)
- ✅ Follows Phase 3 pattern

**Estimated Effort:** 2-3 hours

---

## 3. 🟡 MEDIUM PRIORITY: useVoiceSession State Sprawl

**Status:** ✅ COMPLETE  
**Priority:** 🟡 MEDIUM  
**Effort:** 5 hours (actual)  
**Impact:** 4/5 (Significant complexity reduction, 15 useState → 1 useReducer)  
**Risk:** MEDIUM (complex hook, many dependencies, high test coverage needed)  
**ROI Score:** ⭐⭐⭐⭐  
**Discovered:** Oct 16, 2025  
**Completed:** Oct 16, 2025  
**Dependencies:** None  
**Result:** Successfully migrated to reducer pattern with comprehensive test coverage

### Progress Checklist

- [x] Initial analysis complete
- [x] useReducer pattern research complete
- [x] Map all 15 state variables to domain groups
- [x] Design state shape (normalized structure)
- [x] Define action types (enum or const)
- [x] Create reducer with action handlers
- [x] Write reducer unit tests (pure function) - 21 tests passing ✅
- [x] Migrate useState calls to useReducer
- [x] Update all 7 effects to dispatch actions
- [x] Integration tests passing
- [x] Build successful (no type errors)
- [x] Documentation complete

### Current State

`frontend/src/shared/useVoiceSession.ts` - **15 separate useState calls**

**Lines 86-99:**
```typescript
const [status, setStatus] = useState<VoiceStatus>(...)
const [error, setError] = useState<string | null>(...)
const [sessionId, setSessionId] = useState<string | null>(...)
const [userPartial, setUserPartial] = useState(...)
const [assistantPartial, setAssistantPartial] = useState(...)
const [micLevel, setMicLevel] = useState(...)
const [debugEnabled, setDebugEnabled] = useState(...)
const [micPaused, setMicPaused] = useState(...)
const [micStream, setMicStream] = useState<MediaStream | null>(...)
const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(...)
const [encounterPhase, setEncounterPhase] = useState<string | null>(...)
const [encounterGate, setEncounterGate] = useState<Record<string, unknown> | null>(...)
const [outstandingGate, setOutstandingGate] = useState<string[]>(...)
const [adaptive, setAdaptive] = useState(...)
// Plus 2 more refs
```

**Issues:**
1. **State updates scattered** across 7 different useEffect blocks
2. **No atomic updates** - related state changes happen in separate renders
3. **Debugging nightmare** - hard to trace which effect changed what
4. **Testing complexity** - need to mock 15+ state setters

### Recommended Solution

**Migrate to useReducer pattern:**

```typescript
// frontend/src/shared/useVoiceSession/reducer.ts

type VoiceSessionState = {
  status: VoiceStatus
  error: string | null
  sessionId: string | null
  userPartial: string
  assistantPartial: string
  micLevel: number
  debugEnabled: boolean
  micPaused: boolean
  micStream: MediaStream | null
  peerConnection: RTCPeerConnection | null
  encounter: {
    phase: string | null
    gate: Record<string, unknown> | null
    outstandingGate: string[]
  }
  adaptive: AdaptiveSnapshot
}

type VoiceSessionAction =
  | { type: 'SNAPSHOT_UPDATED'; snapshot: Snapshot }
  | { type: 'ENCOUNTER_UPDATED'; encounter: EncounterState }
  | { type: 'STREAM_UPDATED'; stream: MediaStream | null }
  | { type: 'PEER_CONNECTION_UPDATED'; connection: RTCPeerConnection | null }
  | { type: 'DEBUG_TOGGLED'; enabled: boolean }
  | { type: 'MIC_PAUSED'; paused: boolean }
  | { type: 'ADAPTIVE_UPDATED'; adaptive: AdaptiveSnapshot }
  | { type: 'RESET' }

function voiceSessionReducer(
  state: VoiceSessionState,
  action: VoiceSessionAction
): VoiceSessionState {
  switch (action.type) {
    case 'SNAPSHOT_UPDATED':
      return {
        ...state,
        status: action.snapshot.status,
        error: action.snapshot.error,
        sessionId: action.snapshot.sessionId,
        userPartial: action.snapshot.userPartial,
        assistantPartial: action.snapshot.assistantPartial,
        micLevel: action.snapshot.micLevel,
      }
    
    case 'ENCOUNTER_UPDATED':
      return {
        ...state,
        encounter: {
          phase: action.encounter.phase,
          gate: action.encounter.gate,
          outstandingGate: action.encounter.outstandingGate,
        },
      }
    
    // ... other cases
    
    default:
      return state
  }
}

// In useVoiceSession.ts
export function useVoiceSession(options: VoiceSessionOptions) {
  const [state, dispatch] = useReducer(
    voiceSessionReducer,
    undefined,
    () => getInitialState(controller)
  )
  
  // Single effect for snapshot subscription
  useEffect(() => {
    return controller.subscribe((snapshot) => {
      dispatch({ type: 'SNAPSHOT_UPDATED', snapshot })
    })
  }, [controller])
  
  // Single effect for encounter subscription
  useEffect(() => {
    return controller.subscribeEncounter((encounter) => {
      dispatch({ type: 'ENCOUNTER_UPDATED', encounter })
    })
  }, [controller])
  
  return {
    ...state,
    // ... methods
  }
}
```

**Benefits:**
- ✅ **Atomic updates:** All related state changes in single render
- ✅ **Predictable:** State transitions explicit and testable
- ✅ **Debuggable:** Single reducer to trace all state changes
- ✅ **Performant:** Fewer re-renders (batch updates)
- ✅ **Testable:** Reducer is pure function (easy to unit test)

**Migration Strategy:**
1. Create reducer in separate file
2. Test reducer in isolation
3. Gradually migrate useState → useReducer
4. Keep both patterns during transition (feature flag)
5. Remove old useState once verified

**Estimated Effort:** 4-6 hours

**Risk:** MEDIUM (touches core voice session logic)

---

## 4. 🟡 MEDIUM PRIORITY: v2/hooks.ts usePlayback Effect Consolidation

**Status:** ⏳ Not Started  
**Priority:** 🟡 MEDIUM  
**Effort:** 2-3 hours  
**Impact:** 3/5 (Effect consolidation, follows Phase 3 pattern)  
**Risk:** LOW (proven approach, localized changes)  
**ROI Score:** ⭐⭐⭐⭐  
**Discovered:** Oct 16, 2025  
**Dependencies:** None (can run in parallel with other work)  
**Target Completion:** TBD

### Progress Checklist

- [x] Initial analysis complete
- [ ] Identify all 4 effect blocks precisely
- [ ] Map effect dependencies and triggers
- [ ] Design consolidated effect structure
- [ ] Write tests for current behavior
- [ ] Implement consolidation (4→2 effects)
- [ ] Verify tests pass
- [ ] Measure effect reduction
- [ ] Code review complete

### Current State

`frontend/src/pages/v2/hooks.ts` - **usePlayback has 4 useEffect blocks**

**Lines 82-103:**
```typescript
export function usePlayback(params: { ... }) {
  // Effect 1: Default selection
  useEffect(() => {
    if (!actions || names.length === 0 || currentRef.current) return
    const def = pickDefaultId(names as string[]) || names[0]
    // ...
  }, [names, actions, /* ... */])
  
  // Effect 2: Pause/resume based on isAnimating
  useEffect(() => {
    const id = currentRef.current
    if (!id || !actions) return
    setPaused(actions[id], !isAnimating)
  }, [isAnimating, actions])
  
  // Effect 3: Finished animation fallback
  useEffect(() => {
    if (!mixer || !actions) return
    const onFinished = () => { /* ... */ }
    mixer.addEventListener('finished', onFinished)
    return () => mixer.removeEventListener('finished', onFinished)
  }, [mixer, actions, names])
  
  // Effect 4: Actions changed (line 25)
  useEffect(() => {
    if (!actions) {
      lastActionsRef.current = null
      return
    }
    // ...
  }, [actions, /* ... */])
}
```

**Similar to Phase 3, but smaller scope**

### Recommended Solution

**Consolidate into 2 strategic effects:**

```typescript
export function usePlayback(params: { ... }) {
  const currentRef = useRef<string | null>(null)
  const lastPoseForId = useRef<string | null>(null)
  const lastActionsRef = useRef<any>(null)
  
  // Effect 1: Animation state management (initialization + switching)
  useEffect(() => {
    if (!actions || names.length === 0) {
      lastActionsRef.current = null
      return
    }
    
    // Check if actions changed
    const actionsChanged = lastActionsRef.current !== actions
    lastActionsRef.current = actions
    
    // Default selection on first load
    if (!currentRef.current) {
      const def = pickDefaultId(names as string[]) || names[0]
      if (def && actions[def]) {
        currentRef.current = def
        playAction(actions, mixer, def)
        onActiveChange?.(def)
      }
      return
    }
    
    // Handle actions change
    if (actionsChanged && currentRef.current) {
      if (lastPoseForId.current !== currentRef.current) {
        applyRestPoseFor(currentRef.current)
      }
      playAction(actions, mixer, currentRef.current)
    }
    
    if (log) {
      console.debug('[v2/usePlayback] Animation state updated:', {
        current: currentRef.current,
        actionsChanged,
        namesCount: names.length,
      })
    }
  }, [actions, mixer, names, onActiveChange, log, applyRestPoseFor])
  
  // Effect 2: Runtime controls (pause/resume + finished handler)
  useEffect(() => {
    if (!mixer || !actions) return
    
    // Pause/resume current animation
    const currentId = currentRef.current
    if (currentId && actions[currentId]) {
      setPaused(actions[currentId], !isAnimating)
    }
    
    // Finished handler (fallback to repeat animation)
    const onFinished = () => {
      const id = currentRef.current
      if (!id) return
      
      const firstRepeat = names.find(n => 
        ANIMATIONS.find(a => a.id === n && a.loop === 'repeat')
      )
      
      if (firstRepeat && actions[firstRepeat]) {
        playAction(actions, mixer, firstRepeat)
        currentRef.current = firstRepeat
        onActiveChange?.(firstRepeat)
      }
    }
    
    mixer.addEventListener('finished', onFinished)
    return () => mixer.removeEventListener('finished', onFinished)
  }, [mixer, actions, isAnimating, names, onActiveChange])
  
  // ... rest of hook
}
```

**Benefits:**
- ✅ 4 effects → 2 effects (50% reduction)
- ✅ Clear separation: initialization vs runtime controls
- ✅ Centralized logging
- ✅ Fewer re-executions

**Estimated Effort:** 2-3 hours

---

## 5. 🟢 LOW PRIORITY: SettingsContext Optimization

**Status:** ⏳ Not Started  
**Priority:** 🟢 LOW  
**Effort:** 2-3 hours  
**Impact:** 3/5 (Performance optimization, reduces re-renders)  
**Risk:** LOW (additive change, can keep existing pattern)  
**ROI Score:** ⭐⭐⭐  
**Discovered:** Oct 16, 2025  
**Dependencies:** None (optimization only)  
**Note:** Nice-to-have, not critical  
**Target Completion:** TBD

### Progress Checklist

- [x] Initial analysis complete
- [x] Context optimization research complete
- [ ] Profile current re-render behavior
- [ ] Choose optimization strategy (split vs selector)
- [ ] Implement chosen solution
- [ ] Measure performance improvement
- [ ] Update documentation
- [ ] Code review complete

### Current State

`frontend/src/shared/settingsContext.tsx` - Lines 50-70

**Pattern:**
```typescript
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AdvancedSettings>(() => 
    (typeof window === 'undefined' ? defaultSettings : load())
  )

  useEffect(() => { 
    if (typeof window !== 'undefined') persist(settings) 
  }, [settings])

  const update = useCallback((partial: Partial<AdvancedSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  const reset = useCallback(() => setSettings(defaultSettings), [])

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, update, reset }), 
    [settings, update, reset]
  )

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}
```

**Issues:**
1. Every setting change triggers full context re-render
2. All consumers re-render even if they only use subset of settings
3. No optimization for frequent updates

### Recommended Solution

**Split into granular contexts or use context selector pattern:**

**Option A: Granular Contexts**
```typescript
// Split settings into logical groups
const ViewerSettingsContext = createContext<ViewerSettings | null>(null)
const AudioSettingsContext = createContext<AudioSettings | null>(null)
const DebugSettingsContext = createContext<DebugSettings | null>(null)
```

**Option B: Context Selector (modern approach)**
```typescript
import { createContext, useContextSelector } from 'use-context-selector'

// Consumer only re-renders when specific setting changes
function MyComponent() {
  const showDebug = useContextSelector(
    SettingsContext, 
    (ctx) => ctx.settings.showDebug
  )
  // Only re-renders when showDebug changes, not other settings
}
```

**Benefits:**
- ✅ Fewer unnecessary re-renders
- ✅ Better performance with many consumers
- ✅ More granular control

**Estimated Effort:** 2-3 hours

---

## 6. 🟢 LOW PRIORITY: Scene.tsx Metrics Handling

**Status:** ❌ SKIPPED (Not Applicable)  
**Priority:** 🟢 LOW  
**Effort:** N/A  
**Impact:** N/A  
**Risk:** N/A  
**ROI Score:** N/A  
**Discovered:** Oct 16, 2025  
**Resolved:** Oct 16, 2025  
**Dependencies:** None  
**Note:** After analysis, NOT duplication - intentionally designed pattern  
**Reason:** Scene.tsx receives metrics via callback from V2Model (different use case than useModelMetrics which calculates from scene). Pattern prevents infinite loop bug (see 3D_VIEWER_BUG_FIX.md). This is a solved problem, not a refactoring opportunity.

### Progress Checklist

- [x] Initial analysis complete
- [x] Existing useModelMetrics hook identified
- [x] Deep analysis shows different use cases
- [x] Verified intentional design (bug fix documentation)
- [x] Marked as not applicable

### Current State

`frontend/src/pages/components/viewer/Scene.tsx` - Lines 71-95

**Pattern:**
```typescript
const [metrics, setMetrics] = useState<{ ... } | null>(null)
const metricsReceivedRef = useRef(false)

const handleMetrics = useCallback((newMetrics) => {
  if (!metricsReceivedRef.current) {
    metricsReceivedRef.current = true
    setMetrics(newMetrics)
  }
}, [])

useEffect(() => {
  // Camera positioning based on metrics
}, [metrics, /* ... */])
```

**Similar pattern repeated in multiple viewer components**

### Recommended Solution

**Extract to `useModelMetrics` hook** (already exists in viewer/hooks but not used here):

```typescript
// Use existing hook from 3D refactoring
import { useModelMetrics } from './viewer/hooks/useModelMetrics'

function Scene({ ... }) {
  const metrics = useModelMetrics({
    scene: figureRef.current?.scene,
    desiredHeight: 1.8,
    onMetrics: handleMetrics,
    debug: false,
  })
  
  // Auto-handled: only updates once, camera positioning, etc.
}
```

**Benefits:**
- ✅ Reuse existing modular hook
- ✅ Consistent pattern across all viewers
- ✅ Less code duplication

**Estimated Effort:** 1-2 hours (mostly find-replace)

---

## 7. 🟢 LOW PRIORITY: PlaybackModal RAF Management

**Status:** ✅ COMPLETE  
**Priority:** 🟢 LOW  
**Effort:** 1 hour (actual)  
**Impact:** 2/5 (Reusable pattern extraction)  
**Risk:** LOW (standard RAF cleanup pattern)  
**ROI Score:** ⭐⭐⭐  
**Discovered:** Oct 16, 2025  
**Completed:** Oct 16, 2025  
**Dependencies:** None  
**Note:** Extracted reusable hook, migrated PlaybackModal  
**Result:** Created `useAnimationFrame` hook, PlaybackModal refactored, tests passing ✅

### Progress Checklist

- [x] Initial analysis complete
- [x] Design useAnimationFrame API
- [x] Implement hook with cleanup
- [x] Replace RAF usage in PlaybackModal
- [x] Find other RAF patterns (RecordingPill not suitable - complex coupling)
- [x] Tests passing (viewer smoke tests ✅)
- [x] Code review complete

### Current State

`frontend/src/pages/components/viewer/PlaybackModal.tsx` - Lines 21-40

**Pattern:**
```typescript
const [localTime, setLocalTime] = useState(0)
const [dragging, setDragging] = useState(false)
const rafRef = useRef<number | null>(null)

useEffect(() => {
  if (!api || dragging) return
  
  const loop = () => {
    const t = api.getCurrentTime?.() ?? 0
    setLocalTime(t)
    rafRef.current = requestAnimationFrame(loop)
  }
  
  rafRef.current = requestAnimationFrame(loop)
  return () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
  }
}, [api, dragging])
```

**Common pattern for animation loops**

### Recommended Solution

**Extract to `useAnimationFrame` hook:**

```typescript
// frontend/src/shared/hooks/useAnimationFrame.ts
export function useAnimationFrame(
  callback: (time: number) => void,
  deps: React.DependencyList,
  enabled: boolean = true
) {
  const rafRef = useRef<number | null>(null)
  const callbackRef = useRef(callback)
  
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])
  
  useEffect(() => {
    if (!enabled) return
    
    const loop = (time: number) => {
      callbackRef.current(time)
      rafRef.current = requestAnimationFrame(loop)
    }
    
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [...deps, enabled])
}

// Usage in PlaybackModal
useAnimationFrame(
  () => {
    const t = api?.getCurrentTime?.() ?? 0
    setLocalTime(t)
  },
  [api],
  !dragging
)
```

**Benefits:**
- ✅ Reusable across all RAF needs
- ✅ Standard pattern for animation loops
- ✅ Fewer bugs (centralized cleanup logic)

**Estimated Effort:** 1-2 hours

---

## 8. 🟢 LOW PRIORITY: HumanFigure.tsx Legacy Cleanup

**Status:** ⏳ Not Started  
**Priority:** 🟢 LOW  
**Effort:** 2-3 hours (if keeping) or 30 minutes (if removing)  
**Impact:** 1/5 (Legacy code cleanup)  
**Risk:** LOW (old system, may be unused)  
**ROI Score:** ⭐⭐  
**Discovered:** Oct 16, 2025  
**Dependencies:** None  
**Decision Required:** Keep vs Remove  
**Target Completion:** TBD

### Progress Checklist

- [x] Initial analysis complete
- [ ] Verify if HumanFigure.tsx is still used in production
- [ ] Check git history for last usage
- [ ] **Decision:** Remove entirely OR modernize
- [ ] If removing: Delete file + update imports
- [ ] If keeping: Apply modularization patterns
- [ ] Update documentation
- [ ] Code review complete

### Current State

`frontend/src/pages/components/viewer/HumanFigure.tsx` - 4 useEffect blocks

**Context:**

- This is the **OLD** procedural animation system
- `HumanFigure.fixed.tsx` is the **NEW** Mixamo-based system
- Old file still in codebase for reference/fallback

**Recommendation:**
Either:
1. **Deprecate completely** - Remove file if not used
2. **Apply same modularization** - Bring to same standard as `.fixed.tsx`

**If keeping, apply similar patterns:**
- Extract to `useProceduralAnimator` hook
- Extract to `useMovementController` hook
- Consolidate 4 effects → 2 effects

**Estimated Effort:** 2-3 hours (if keeping)

---

## Recommended Implementation Order

### Sprint 1: Quick Wins (1 week)
1. **Effect consolidations** (App.tsx, v2/hooks.ts) - 4-6 hours total
2. **Scene.tsx metrics** - Use existing hook - 1 hour
3. **PlaybackModal RAF** - Extract to hook - 1-2 hours

**Total:** ~8 hours, all LOW risk

### Sprint 2: Strategic Improvements (1 week)
4. **BackendSocketManager → useBackendSocket** - 3-4 hours (HIGH value)
5. **useVoiceSession reducer migration** - 4-6 hours (MEDIUM risk)

**Total:** ~10 hours, MEDIUM risk

### Sprint 3: Polish (optional)
6. **SettingsContext optimization** - 2-3 hours
7. **HumanFigure.tsx decision** - 2-3 hours or delete

**Total:** ~5 hours, LOW priority

---

## Testing Strategy

### For Each Refactoring:
1. **Unit tests** for extracted hooks
2. **Integration tests** for consumers
3. **Manual testing** of affected features
4. **Performance benchmarks** (before/after)

### Rollback Plan:
- Feature flags for new implementations
- Keep old code alongside new during migration
- Gradual rollout per component

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Total useEffect count | ~150+ | ~100 | Codebase scan |
| Effect consolidation | 0% | 40% | Consolidated/total |
| Custom hook usage | 60% | 85% | Hooks/components |
| Class-based patterns | 3 | 0 | Manual count |
| State sprawl (>10 useState) | 5 files | 2 files | Static analysis |

---

## 🔍 Newly Discovered Opportunities

**Instructions:** Add opportunities here as they are discovered during implementation work. Each opportunity should follow the same template as above (Status, Priority, Effort, Impact, Risk, ROI, Progress Checklist).

**Discovery Process:**

1. During code reviews, note patterns that appear multiple times
2. During testing, identify performance bottlenecks
3. During debugging, track effect dependency issues
4. During implementation, spot prop drilling (3+ levels)
5. During refactoring, find related consolidation opportunities

**Template for New Opportunities:**

```markdown
## X. [PRIORITY EMOJI] [PRIORITY]: [Opportunity Name]

**Status:** ⏳ Not Started  
**Priority:** [🔥 HIGH / 🟡 MEDIUM / 🟢 LOW]  
**Effort:** X-Y hours  
**Impact:** X/5 ([Description])  
**Risk:** [LOW / MEDIUM / HIGH] ([Reason])  
**ROI Score:** [⭐ ratings]  
**Discovered:** [Date]  
**Discovered By:** [Tool/Manual/Code Review]  
**Dependencies:** [List or None]  
**Target Completion:** TBD

### Progress Checklist
- [ ] Initial analysis complete
- [ ] Research complete
- [ ] Implementation plan created
- [ ] Tests written
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Code review complete
- [ ] Documentation updated

### Current State
[File path, line numbers, description]

### Issues
1. [Problem 1]
2. [Problem 2]

### Recommended Solution
[Proposed approach with code examples]

### Benefits
- ✅ [Benefit 1]
- ✅ [Benefit 2]

### Estimated Effort
X-Y hours

---
```

**Next Opportunities Added:**  
_None yet - will be discovered during Sprint 1-3 implementation_

---

## 📈 Implementation Timeline

**Week 1-2:** Sprint 1 (Quick Wins)  
**Week 3-4:** Sprint 2 (Strategic Improvements)  
**Week 5+:** Sprint 3 (Polish) + Newly Discovered

---

## 🔗 Related Documentation

- **REACT_BEST_PRACTICES_2025.md** - Research findings on modern React patterns
- **PHASE3_COMPLETE.md** - Effect consolidation proven pattern
- **3D_RENDERING_MODULARIZATION_COMPLETE.md** - Custom hooks extraction examples
- **REFACTORING_SUMMARY.md** - Previous refactoring work context
- **TESTING_GUIDE.md** - Testing strategies for refactored code

---

## Conclusion

**Priority 1 (Start Now):**

- BackendSocketManager → useBackendSocket (biggest bang for buck)
- App.tsx effect consolidation (follows Phase 3 pattern)

**Priority 2 (Next Month):**

- useVoiceSession reducer migration (highest complexity reduction)

**Living Document Reminder:**  
This document will be updated continuously as new opportunities are discovered during implementation. Check back regularly for new items in the "Newly Discovered Opportunities" section.

**Priority 3 (As Needed):**
- All other optimizations (quality of life improvements)

**Overall Impact:**
- Estimated **25-35 hours** for full implementation
- **~40% reduction in effects** across codebase
- **Significant improvement in maintainability**
- **Better performance** (fewer re-renders)
- **Easier testing** (more pure functions)

---

**Next Steps:**
1. Review this document with team
2. Prioritize based on current sprint goals
3. Create GitHub issues for each opportunity
4. Start with Quick Wins to build momentum
5. Apply learnings from Phase 1-3 refactoring

**Questions? See:**
- Phase 1-3 documentation for refactoring patterns
- `COMPLETE_REFACTORING_SUMMARY.md` for lessons learned
