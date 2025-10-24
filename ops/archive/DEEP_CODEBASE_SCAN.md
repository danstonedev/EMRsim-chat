# Deep Codebase Scan - Refactoring Opportunities Discovery

**Date:** October 16, 2025  
**Sprint:** TODO 3  
**Status:** 🚧 In Progress  
**Scope:** Systematic scan of frontend codebase for refactoring patterns

---

## 📊 Scan Summary

### Files Scanned

- **Total useEffect blocks:** 100+ instances
- **Total useState blocks:** 50+ instances
- **Context providers:** 1 (SettingsContext)
- **Class-based components:** 1 (BackendSocketManager)
- **Custom hooks:** 20+ existing

### Pattern Categories Identified

1. ✅ **useReducer Candidates** - Components with 10+ useState
2. ✅ **Effect Consolidation** - Components with 5+ related useEffect
3. ✅ **Custom Hook Extraction** - Repeated patterns across files
4. ✅ **Context Optimization** - Re-render performance concerns
5. ✅ **Class → Hook Migration** - Legacy class-based patterns
6. ⚠️ **Component Composition** - Prop drilling patterns

---

## 🎯 HIGH PRIORITY Discoveries

### 1. 🔥 useVoiceSession - useReducer Candidate

**Location:** `frontend/src/shared/useVoiceSession.ts`  
**Priority:** 🔥 HIGH  
**Impact:** 5/5 (Core voice functionality)  
**Effort:** 6-8 hours (Complex state machine)  
**Risk:** MEDIUM (Critical path, needs careful testing)

**Current State:** **11 useState** calls + **7 useEffect** blocks

```typescript
// Lines 86-99: 11 separate useState calls!
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
// + more...
```

**Issues:**

- 11 separate state setters = complex state management
- Multiple effects subscribing to controller events
- State sprawl makes reasoning difficult
- Potential for inconsistent state updates

**Recommendation: Migrate to useReducer**

```typescript
type VoiceState = {
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
  encounterPhase: string | null
  encounterGate: Record<string, unknown> | null
  outstandingGate: string[]
  adaptive: AdaptiveSnapshot
}

type VoiceAction =
  | { type: 'SNAPSHOT_UPDATE'; payload: Snapshot }
  | { type: 'STATUS_CHANGE'; payload: VoiceStatus }
  | { type: 'ERROR'; payload: string }
  | { type: 'MIC_LEVEL_UPDATE'; payload: number }
  | { type: 'ENCOUNTER_UPDATE'; payload: EncounterState }
  | { type: 'ADAPTIVE_UPDATE'; payload: AdaptiveSnapshot }
  // ... other actions

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case 'SNAPSHOT_UPDATE':
      return {
        ...state,
        status: action.payload.status,
        error: action.payload.error,
        sessionId: action.payload.sessionId,
        userPartial: action.payload.userPartial,
        assistantPartial: action.payload.assistantPartial,
        micLevel: action.payload.micLevel,
      }
    case 'STATUS_CHANGE':
      return { ...state, status: action.payload }
    // ... other cases
    default:
      return state
  }
}

// Usage
const [state, dispatch] = useReducer(voiceReducer, initialState)

// Single effect to subscribe to controller
useEffect(() => {
  const unsub = controller.subscribe((snapshot) => {
    dispatch({ type: 'SNAPSHOT_UPDATE', payload: snapshot })
  })
  return unsub
}, [controller])
```

**Benefits:**

- ✅ 11 useState → 1 useReducer (90% reduction)
- ✅ Atomic state updates (no intermediate states)
- ✅ Clear state transitions (action types)
- ✅ Easier to test (reducer is pure function)
- ✅ Better TypeScript safety (discriminated unions)
- ✅ Follows React best practices for complex state

**ROI Score:** ⭐⭐⭐⭐⭐

---

### 2. 🔥 BackendSocketManager → useBackendSocket Hook

**Location:** `frontend/src/shared/services/BackendSocketManager.ts`  
**Priority:** 🔥 HIGH  
**Impact:** 5/5 (Core backend communication)  
**Effort:** 4-5 hours  
**Risk:** LOW (Well-documented interface)

**Current State:** Class-based with imperative API

```typescript
export class BackendSocketManager {
  private socket: Socket | null = null
  private sessionId: string | null = null
  
  connect(config: SocketConfig) { /* ... */ }
  disconnect() { /* ... */ }
  isConnected(): boolean { /* ... */ }
  getSessionId(): string | null { /* ... */ }
  // ... 15+ methods
}
```

**Issues:**

- Class-based pattern in React hooks ecosystem
- Consumers must poll for state (`isConnected()`, `getSessionId()`)
- Not reactive (requires `useState` + `useEffect` polling)
- Harder to test with React Testing Library
- No automatic cleanup (manual `disconnect()` calls)

**Recommendation: Convert to Custom Hook**

```typescript
export function useBackendSocket(config: SocketConfig, handlers: SocketEventHandlers) {
  const [isConnected, setIsConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Connect on mount
  useEffect(() => {
    if (!config.enabled) return

    const socket = io(config.apiBaseUrl, {
      transports: config.transports ?? ['websocket'],
      reconnectionAttempts: config.reconnectionAttempts ?? 5,
      timeout: config.timeout ?? 20000,
    })

    socket.on('connect', () => {
      setIsConnected(true)
      const sid = socket.id ?? null
      setSessionId(sid)
      handlers.onConnect?.(sid)
    })

    socket.on('disconnect', (reason) => {
      setIsConnected(false)
      handlers.onDisconnect?.(reason)
    })

    socket.on('transcript', handlers.onTranscript)
    socket.on('transcriptError', handlers.onTranscriptError)
    // ... other handlers

    socketRef.current = socket

    // Automatic cleanup!
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [config.apiBaseUrl, config.enabled, /* ...deps */])

  // Emit functions
  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data)
  }, [])

  return {
    isConnected,   // Reactive state!
    sessionId,     // Reactive state!
    lastError,
    emit,
    socket: socketRef.current,
  }
}
```

**Benefits:**

- ✅ Fully reactive (no polling needed)
- ✅ Automatic cleanup (useEffect return)
- ✅ Fresh handlers (refs)
- ✅ Testable with `@testing-library/react-hooks`
- ✅ React-friendly API
- ✅ Simpler consumer code

**ROI Score:** ⭐⭐⭐⭐⭐

---

## 🟡 MEDIUM PRIORITY Discoveries

### 3. 🟡 RecordingPill - Multiple useState + Effects

**Location:** `frontend/src/pages/components/RecordingPill.tsx`  
**Priority:** 🟡 MEDIUM  
**Impact:** 3/5 (UI component)  
**Effort:** 3-4 hours  
**Risk:** LOW

**Current State:** 7 useEffect + 5 useState

```typescript
// 5 useState calls
const [level, setLevel] = useState(0)
const [internalRecording, setInternalRecording] = useState(defaultRecording)
const [isPaused, setIsPaused] = useState(false)
const [elapsedMs, setElapsedMs] = useState(0)
const [isSpeaking, setIsSpeaking] = useState(false)

// 7 useEffect blocks (lines 48, 171, 185, 199, 304, 359, 394)
```

**Recommendation:** Consolidate effects, potentially extract `useRecordingState` hook

---

### 4. 🟡 CaseBuilder - useState Sprawl

**Location:** `frontend/src/pages/CaseBuilder.tsx`  
**Priority:** 🟡 MEDIUM  
**Impact:** 3/5 (Admin feature)  
**Effort:** 2-3 hours  
**Risk:** LOW

**Current State:** 8 useState calls

```typescript
const [loading, setLoading] = useState(true)
const [search, setSearch] = useState('')
const [loadingPreview, setLoadingPreview] = useState(false)
const [showGenerateModal, setShowGenerateModal] = useState(false)
const [genPrompt, setGenPrompt] = useState(DEFAULT_PROMPT)
const [genResearch, setGenResearch] = useState(false)
const [generating, setGenerating] = useState(false)
const [saving, setSaving] = useState(false)
const [error, setError] = useState('')
const [status, setStatus] = useState('')
```

**Recommendation:** Group related state, potentially useReducer for form state

---

## 🟢 LOW PRIORITY Discoveries

### 5. 🟢 CaseSelectors - Duplicate Pattern

**Location:** `frontend/src/pages/components/CaseSelectors.tsx`  
**Lines:** 7-8 and 195-196  
**Priority:** 🟢 LOW  
**Effort:** 1 hour  
**Impact:** 2/5

**Issue:** Identical pattern repeated twice

```typescript
// Lines 7-8
const [searchTerm, setSearchTerm] = useState('')
const [isOpen, setIsOpen] = useState(false)

// Lines 195-196 (exact duplicate!)
const [searchTerm, setSearchTerm] = useState('')
const [isOpen, setIsOpen] = useState(false)
```

**Recommendation:** Extract to `useSearchableDropdown` custom hook

```typescript
function useSearchableDropdown() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(v => !v), [])
  const clearSearch = useCallback(() => setSearchTerm(''), [])
  
  return { searchTerm, setSearchTerm, isOpen, open, close, toggle, clearSearch }
}
```

---

### 6. 🟢 v2/Model.tsx - Effect Count

**Location:** `frontend/src/pages/v2/Model.tsx`  
**Priority:** 🟢 LOW  
**Effort:** 2 hours  
**Impact:** 2/5

**Current State:** 3 useEffect blocks (lines 93, 124, 137)

**Recommendation:** Analyze for consolidation after Phase 3 pattern analysis

---

### 7. 🟢 HumanFigure.tsx - Legacy Component

**Location:** `frontend/src/pages/components/viewer/HumanFigure.tsx`  
**Priority:** 🟢 LOW  
**Effort:** 1 hour (if deprecating)  
**Impact:** 1/5

**Current State:** 4 useEffect blocks, procedural animation system

**Status:** Legacy file, `HumanFigure.fixed.tsx` is the new version

**Recommendation:** 

- Option A: Deprecate completely (remove file)
- Option B: Apply modularization (if keeping for fallback)

---

## 📈 Pattern Analysis

### Effect Distribution by File

| File | useEffect Count | Priority | Status |
|------|----------------|----------|--------|
| useVoiceSession.ts | 7 | HIGH | Needs reducer |
| RecordingPill.tsx | 7 | MEDIUM | Consolidate |
| useAnimationController.ts | 3 | LOW | Review |
| useSessionLifecycle.ts | 3 | LOW | Review |
| useVoiceOrchestration.ts | 3 | LOW | Review |
| usePartialClearing.ts | 4 | LOW | Review |
| App.tsx | 3 | ✅ COMPLETE | Consolidated |
| v2/hooks.ts | 3 | ✅ SKIPPED | Already optimal |

### useState Distribution by File

| File | useState Count | Priority | Status |
|------|---------------|----------|--------|
| useVoiceSession.ts | 11 | HIGH | **Reducer candidate!** |
| CaseBuilder.tsx | 10 | MEDIUM | Group state |
| RecordingPill.tsx | 5 | MEDIUM | Extract hook |
| useUIState.ts | 5 | ✅ COMPLETE | Already modular |
| PlaybackModal.tsx | 4 | LOW | Acceptable |

---

## 🎯 Actionable Opportunities (New)

### NEW #1: useVoiceSession Reducer Migration

**Priority:** 🔥 HIGH  
**Effort:** 6-8 hours  
**Impact:** 5/5  
**ROI:** ⭐⭐⭐⭐⭐

**Task:**

1. Design VoiceState type and VoiceAction discriminated union
2. Implement voiceReducer with all state transitions
3. Replace 11 useState with single useReducer
4. Consolidate 7 effects into 2-3 effects
5. Update tests
6. Verify voice functionality

---

### NEW #2: BackendSocketManager → useBackendSocket

**Priority:** 🔥 HIGH  
**Effort:** 4-5 hours  
**Impact:** 5/5  
**ROI:** ⭐⭐⭐⭐⭐

**Task:**

1. Create `useBackendSocket.ts` hook
2. Implement reactive state (isConnected, sessionId)
3. Add automatic cleanup
4. Update all consumers (search for `BackendSocketManager` imports)
5. Deprecate class-based implementation
6. Update tests

---

### NEW #3: useSearchableDropdown Hook

**Priority:** 🟢 LOW  
**Effort:** 1 hour  
**Impact:** 2/5  
**ROI:** ⭐⭐⭐

**Task:**

1. Extract to `frontend/src/shared/hooks/useSearchableDropdown.ts`
2. Replace duplicate patterns in CaseSelectors.tsx
3. Add tests

---

### NEW #4: RecordingPill Effect Consolidation

**Priority:** 🟡 MEDIUM  
**Effort:** 3-4 hours  
**Impact:** 3/5  
**ROI:** ⭐⭐⭐

**Task:**

1. Analyze 7 useEffect blocks
2. Identify consolidation candidates
3. Extract `useRecordingState` hook if warranted
4. Consolidate related effects
5. Verify audio functionality

---

### NEW #5: CaseBuilder State Grouping

**Priority:** 🟡 MEDIUM  
**Effort:** 2-3 hours  
**Impact:** 3/5  
**ROI:** ⭐⭐⭐

**Task:**

1. Group form-related state (genPrompt, genResearch, generating, saving)
2. Consider useReducer for form state machine
3. Extract to `useCaseBuilderForm` hook
4. Simplify main component

---

## 🔬 Detailed Analysis: useVoiceSession

### Current Structure

**11 useState Calls:**

1. `status` - VoiceStatus enum
2. `error` - string | null
3. `sessionId` - string | null
4. `userPartial` - string
5. `assistantPartial` - string
6. `micLevel` - number
7. `debugEnabled` - boolean
8. `micPaused` - boolean
9. `micStream` - MediaStream | null
10. `peerConnection` - RTCPeerConnection | null
11. `encounterPhase` - string | null
12. `encounterGate` - Record<string, unknown> | null
13. `outstandingGate` - string[]
14. `adaptive` - AdaptiveSnapshot

**7 useEffect Blocks:**

- Lines 104, 108: Update callback refs
- Line 115: Consolidated configuration effect (Phase 3)
- Line 161: Subscribe to controller snapshot
- Line 168: Subscribe to encounter state
- Line 174: Subscribe to adaptive updates
- Line 180: Debug logging

### Proposed Reducer Structure

```typescript
// State type
type VoiceState = {
  // Connection state
  status: VoiceStatus
  error: string | null
  sessionId: string | null
  
  // Transcript state
  userPartial: string
  assistantPartial: string
  
  // Audio state
  micLevel: number
  micPaused: boolean
  micStream: MediaStream | null
  
  // Debug state
  debugEnabled: boolean
  
  // WebRTC state
  peerConnection: RTCPeerConnection | null
  
  // Encounter state
  encounterPhase: string | null
  encounterGate: Record<string, unknown> | null
  outstandingGate: string[]
  
  // Adaptive state
  adaptive: AdaptiveSnapshot
}

// Action types
type VoiceAction =
  | { type: 'CONTROLLER_SNAPSHOT'; payload: Snapshot }
  | { type: 'ENCOUNTER_UPDATE'; payload: EncounterState }
  | { type: 'ADAPTIVE_UPDATE'; payload: AdaptiveSnapshot }
  | { type: 'STATUS_CHANGE'; payload: VoiceStatus }
  | { type: 'ERROR'; payload: string | null }
  | { type: 'MIC_LEVEL'; payload: number }
  | { type: 'MIC_PAUSED'; payload: boolean }
  | { type: 'MIC_STREAM'; payload: MediaStream | null }
  | { type: 'DEBUG_TOGGLE'; payload: boolean }
  | { type: 'PEER_CONNECTION'; payload: RTCPeerConnection | null }
  | { type: 'RESET' }

// Reducer function
function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case 'CONTROLLER_SNAPSHOT':
      return {
        ...state,
        status: action.payload.status,
        error: action.payload.error,
        sessionId: action.payload.sessionId,
        userPartial: action.payload.userPartial,
        assistantPartial: action.payload.assistantPartial,
        micLevel: action.payload.micLevel,
      }
    
    case 'ENCOUNTER_UPDATE':
      return {
        ...state,
        encounterPhase: action.payload.phase,
        encounterGate: action.payload.gate,
        outstandingGate: action.payload.outstandingGate,
      }
    
    case 'ADAPTIVE_UPDATE':
      return {
        ...state,
        adaptive: action.payload,
      }
    
    case 'STATUS_CHANGE':
      return { ...state, status: action.payload }
    
    case 'ERROR':
      return { ...state, error: action.payload }
    
    case 'MIC_LEVEL':
      return { ...state, micLevel: action.payload }
    
    case 'MIC_PAUSED':
      return { ...state, micPaused: action.payload }
    
    case 'MIC_STREAM':
      return { ...state, micStream: action.payload }
    
    case 'DEBUG_TOGGLE':
      return { ...state, debugEnabled: action.payload }
    
    case 'PEER_CONNECTION':
      return { ...state, peerConnection: action.payload }
    
    case 'RESET':
      return initialState
    
    default:
      return state
  }
}
```

### Migration Steps

1. **Create reducer** (`voiceReducer.ts`)
2. **Replace useState with useReducer** in useVoiceSession
3. **Consolidate subscription effects:**
   - Snapshot subscription dispatches `CONTROLLER_SNAPSHOT`
   - Encounter subscription dispatches `ENCOUNTER_UPDATE`
   - Adaptive subscription dispatches `ADAPTIVE_UPDATE`
4. **Update all setState calls** to dispatch actions
5. **Test thoroughly** (voice functionality is critical)

### Benefits Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| useState calls | 14 | 1 | 93% reduction |
| useEffect blocks | 7 | 4-5 | 29-43% reduction |
| State update patterns | 14 setters | 1 dispatch | Single API |
| Type safety | Good | Excellent | Discriminated unions |
| Testability | Moderate | High | Pure reducer function |

---

## 📊 Success Metrics

### Target Improvements

- ✅ Reduce useState in useVoiceSession: 14 → 1 (93%)
- ✅ Convert BackendSocketManager to hook (reactive state)
- ✅ Extract useSearchableDropdown (eliminate duplication)
- ✅ Consolidate RecordingPill effects: 7 → 3-4 (40-50%)
- ✅ Document 5+ new refactoring opportunities

### Current Progress

- **Opportunities Identified:** 7 new opportunities
- **Priority Distribution:** 2 HIGH, 2 MEDIUM, 3 LOW
- **Estimated Total Effort:** 19-24 hours
- **Expected Impact:** Significant state management improvements

---

## 🎯 Recommended Implementation Order

### Phase 1: High-Impact Wins (12-13 hours)

1. **BackendSocketManager → useBackendSocket** (4-5 hours)
   - Clear interface, well-documented
   - Immediate reactive state benefits
   - Low risk

2. **useVoiceSession Reducer Migration** (6-8 hours)
   - Highest useState reduction
   - Critical path, needs careful testing
   - Significant maintainability win

### Phase 2: Medium Wins (5-7 hours)

3. **RecordingPill Consolidation** (3-4 hours)
   - Effect consolidation pattern
   - Proven approach from Phase 3

4. **CaseBuilder State Grouping** (2-3 hours)
   - Form state management
   - Lower priority (admin feature)

### Phase 3: Quick Wins (1-2 hours)

5. **useSearchableDropdown Extraction** (1 hour)
   - Simple duplication elimination
   - Quick win

6. **HumanFigure Deprecation Decision** (<1 hour)
   - Remove or modernize?

---

## ✅ Completion Checklist

### Discovery Phase ✅

- [x] Scan for useEffect patterns (100+ found)
- [x] Scan for useState patterns (50+ found)
- [x] Identify useReducer candidates (useVoiceSession)
- [x] Identify class → hook migrations (BackendSocketManager)
- [x] Find duplicate patterns (CaseSelectors)
- [x] Assess context usage (SettingsContext already documented)
- [x] Document all findings

### Next Steps

- [ ] Update REFACTORING_OPPORTUNITIES.md with new discoveries
- [ ] Create detailed implementation plans for top 2 priorities
- [ ] Get stakeholder approval for migration approach
- [ ] Begin Phase 1 implementation

---

**Scan Completed:** October 16, 2025  
**Opportunities Found:** 7 new (5 actionable, 2 review/deprecation)  
**Total Estimated Effort:** 19-24 hours  
**Next Action:** Present findings and get approval for Phase 1
