# BackendSocketManager → useBackendSocket Migration Plan

**Date:** October 16, 2025  
**Priority:** 🔥 HIGH  
**Status:** 🚧 In Progress  
**Estimated Effort:** 4-5 hours

---

## 📋 Current State Analysis

### Class-Based Implementation
**Location:** `frontend/src/shared/services/BackendSocketManager.ts`  
**Lines:** 368 total

**Key Methods:**
- `connect(sessionId)` - Initialize socket connection
- `disconnect()` - Clean up connection
- `isConnected()` - Get connection status (polling)
- `isEnabled()` - Get enabled status (polling)
- `getFailureCount()` - Get failure count (polling)
- `getCurrentSessionId()` - Get session ID (polling)
- `emit(event, ...args)` - Send events
- `joinSession(sessionId)` - Switch sessions
- `requestCatchup(sessionId, since?)` - Request transcript catch-up
- `updateLastReceivedTimestamp(timestamp)` - Update last timestamp
- `resetFailureCount()` - Reset failures
- `reset()` - Reset all state
- `getSnapshot()` - Get state snapshot

### Current Usage
**Single consumer:** `ConversationController.ts`

**Usage pattern:**
```typescript
// Initialization (line 377)
this.socketManager = new BackendSocketManager(
  {
    apiBaseUrl: getApiBaseUrl(),
    enabled: true,
    maxFailures: 3,
  },
  {
    onConnect: (sessionId) => { /* ... */ },
    onDisconnect: (reason) => { /* ... */ },
    onTranscript: (data) => { /* ... */ },
    // ... other handlers
  }
)

// Usage (lines 754, 760, 1022)
if (!this.socketManager.isEnabled()) { /* ... */ }
this.socketManager.connect(sessionId)
this.socketManager.disconnect()
```

---

## 🎯 Migration Strategy

### Approach: Side-by-Side Implementation

1. ✅ Create new hook `useBackendSocket.ts` alongside existing class
2. ✅ Implement full feature parity
3. ✅ Add comprehensive tests
4. ⏳ Update ConversationController to use hook (if feasible)
5. ⏳ Deprecate class (mark as @deprecated)
6. ⏳ Remove class after verification period

**Note:** ConversationController is itself a class, so we may need to:
- Option A: Create a wrapper function that uses the hook
- Option B: Keep class for now, migrate ConversationController in future phase
- Option C: Extract socket logic to separate React component

---

## 🔧 Hook Design

### API Design

```typescript
interface UseBackendSocketOptions {
  config: SocketConfig
  handlers: SocketEventHandlers
  sessionId: string | null  // Current session to connect to
  enabled?: boolean         // Whether socket should be active
}

interface UseBackendSocketReturn {
  // Reactive state (no polling needed!)
  isConnected: boolean
  isEnabled: boolean
  failureCount: number
  lastReceivedTimestamp: number
  currentSessionId: string | null
  
  // Methods
  emit: (event: string, ...args: any[]) => void
  joinSession: (sessionId: string) => void
  requestCatchup: (sessionId: string, since?: number) => void
  updateLastReceivedTimestamp: (timestamp: number) => void
  resetFailureCount: () => void
  disconnect: () => void
  
  // Debug
  getSnapshot: () => BackendSocketSnapshot
}

function useBackendSocket(options: UseBackendSocketOptions): UseBackendSocketReturn
```

### Implementation Structure

```typescript
export function useBackendSocket(options: UseBackendSocketOptions) {
  // Reactive state
  const [isConnected, setIsConnected] = useState(false)
  const [isEnabled, setIsEnabled] = useState(options.enabled ?? true)
  const [failureCount, setFailureCount] = useState(0)
  const [lastReceivedTimestamp, setLastReceivedTimestamp] = useState(0)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  
  // Refs for stable references
  const socketRef = useRef<Socket | null>(null)
  const handlersRef = useRef(options.handlers)
  
  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = options.handlers
  }, [options.handlers])
  
  // Main connection effect
  useEffect(() => {
    if (!isEnabled || !options.sessionId) return
    
    // Connect logic...
    
    // Cleanup on unmount or when sessionId changes
    return () => {
      socketRef.current?.removeAllListeners()
      socketRef.current?.disconnect()
    }
  }, [isEnabled, options.sessionId, options.config])
  
  // Stable callback functions
  const emit = useCallback((event: string, ...args: any[]) => {
    socketRef.current?.emit(event, ...args)
  }, [])
  
  // ... other methods
  
  return {
    isConnected,
    isEnabled,
    failureCount,
    lastReceivedTimestamp,
    currentSessionId,
    emit,
    // ... other methods
  }
}
```

---

## ✅ Feature Parity Checklist

### State Management
- [ ] isConnected (reactive)
- [ ] isEnabled (reactive)
- [ ] failureCount (reactive)
- [ ] lastReceivedTimestamp (reactive)
- [ ] currentSessionId (reactive)

### Connection Management
- [ ] Auto-connect when sessionId provided
- [ ] Auto-disconnect on unmount
- [ ] Handle enabled/disabled state
- [ ] Max failure detection and auto-disable

### Socket Operations
- [ ] emit() - Send events
- [ ] joinSession() - Switch sessions
- [ ] requestCatchup() - Request transcripts
- [ ] disconnect() - Manual disconnect

### Event Handling
- [ ] onConnect callback
- [ ] onDisconnect callback
- [ ] onTranscript callback
- [ ] onTranscriptError callback
- [ ] onReconnect callback
- [ ] onCatchup callback
- [ ] onFailure callback
- [ ] onMaxFailures callback

### Utilities
- [ ] updateLastReceivedTimestamp()
- [ ] resetFailureCount()
- [ ] getSnapshot()

### Configuration
- [ ] apiBaseUrl parsing
- [ ] transports configuration
- [ ] reconnection settings
- [ ] timeout settings
- [ ] withCredentials flag

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe('useBackendSocket', () => {
  it('should not connect when disabled', () => { /* ... */ })
  it('should connect when sessionId provided', () => { /* ... */ })
  it('should auto-disconnect on unmount', () => { /* ... */ })
  it('should increment failure count on errors', () => { /* ... */ })
  it('should disable after max failures', () => { /* ... */ })
  it('should handle session switching', () => { /* ... */ })
  it('should request catchup on reconnect', () => { /* ... */ })
  it('should call handler callbacks', () => { /* ... */ })
})
```

### Integration Tests

- Test with ConversationController (if migrated)
- Test transcript flow end-to-end
- Test reconnection scenarios
- Test failure recovery

---

## 📊 Benefits Analysis

### Before (Class-Based)
```typescript
// Consumer must poll for state
const isConnected = socketManager.isConnected()

// Consumer needs useEffect + useState to track changes
const [connected, setConnected] = useState(false)
useEffect(() => {
  const interval = setInterval(() => {
    setConnected(socketManager.isConnected())
  }, 100)
  return () => clearInterval(interval)
}, [socketManager])
```

### After (Hook-Based)
```typescript
// Reactive state - no polling!
const { isConnected } = useBackendSocket({
  config,
  handlers,
  sessionId,
})

// Component re-renders automatically when connection changes
```

### Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| State access | Polling methods | Reactive state | 100% |
| Re-render efficiency | Manual intervals | Auto (React) | Optimal |
| Cleanup | Manual disconnect() calls | Auto (useEffect) | Safer |
| Testing | Class mocking | Hook testing lib | Simpler |
| TypeScript safety | Good | Excellent | Better inference |
| Consumer code | 10+ lines | 3 lines | 70% reduction |

---

## 🚀 Implementation Steps

### Phase 1: Create Hook ✅
1. [x] Create `frontend/src/shared/hooks/useBackendSocket.ts`
2. [ ] Implement reactive state
3. [ ] Implement connection logic
4. [ ] Implement event handlers
5. [ ] Implement all methods
6. [ ] Add JSDoc documentation

### Phase 2: Add Tests
1. [ ] Create test file
2. [ ] Write unit tests for all features
3. [ ] Test error scenarios
4. [ ] Test cleanup behavior
5. [ ] Verify 100% code coverage

### Phase 3: Migration Decision
**Option A:** ConversationController uses hook (requires larger refactor)
**Option B:** Keep class, document hook as alternative API
**Option C:** Create React wrapper component

### Phase 4: Documentation
1. [ ] Update CHANGELOG.md
2. [ ] Add migration guide
3. [ ] Update code examples
4. [ ] Mark class as @deprecated (if migrating)

---

## ⚠️ Risks & Mitigation

### Risk 1: ConversationController is class-based
**Impact:** Cannot use hooks directly in classes  
**Mitigation:**
- Option A: Extract socket logic to React component
- Option B: Provide both class and hook APIs
- Option C: Defer ConversationController migration

**Decision:** Start with Option B - provide hook as alternative API

### Risk 2: Breaking changes
**Impact:** Existing code depends on class API  
**Mitigation:**
- Keep class implementation
- Mark as @deprecated
- Gradual migration path

### Risk 3: Testing complexity
**Impact:** Socket testing is complex  
**Mitigation:**
- Use @testing-library/react-hooks
- Mock socket.io-client
- Comprehensive test coverage

---

## 📈 Success Criteria

- [ ] Hook implements 100% feature parity
- [ ] All tests passing
- [ ] No regressions in transcript functionality
- [ ] Documentation complete
- [ ] Performance verified (no polling overhead)
- [ ] TypeScript errors resolved
- [ ] Code review approved

---

## 🎯 Next Actions

1. **Implement useBackendSocket hook** (2-3 hours)
2. **Add comprehensive tests** (1 hour)
3. **Decide on migration strategy** (30 min)
4. **Update documentation** (30 min)
5. **Code review** (30 min)

---

**Status:** Ready to implement  
**Next:** Create `useBackendSocket.ts` with full implementation
