# 🎓 Modern React Best Practices Research (2025)

**Research Date:** October 16, 2025  
**Context:** Modernization guidance for EMRsim-chat refactoring  
**Sources:** React.dev official docs, current codebase patterns

---

## 📚 Key Findings

### 1. **Hooks Architecture (Official React Guidance)**

#### ✅ What React.dev Recommends (2025)

**Core Principles:**
- Hooks must be called at the top level (not in loops/conditions)
- Extract new component if conditional hooks needed
- Custom hooks for reusable logic composition
- useState for simple state, useReducer for complex state
- useContext for shared data (avoids prop drilling)

**Modern Patterns from React.dev:**

```typescript
// ✅ GOOD: Lifting state up for shared data
function Parent() {
  const [count, setCount] = useState(0)
  return (
    <>
      <Child1 count={count} onClick={() => setCount(c => c + 1)} />
      <Child2 count={count} onClick={() => setCount(c => c + 1)} />
    </>
  )
}

// ✅ GOOD: Custom hooks for reusable logic
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    // Logic here
  }, [])
  return size
}
```

**React's Official Hook Rules:**
1. **Components and Hooks must be pure** - Same inputs = same outputs
2. **React calls Components and Hooks** - Don't call them yourself
3. **Hooks can only be called at top level** - No conditions, loops, nested functions

---

### 2. **State Management Evolution**

#### Current Industry Standards (2025):

| Pattern | Best For | When to Use |
|---------|----------|-------------|
| **useState** | Simple component state | 1-5 related values |
| **useReducer** | Complex state logic | 10+ useState or complex transitions |
| **Context API** | Shared state tree | Avoid prop drilling 2+ levels |
| **Zustand** | Global client state | App-wide state, persistence |
| **TanStack Query** | Server state | Data fetching, caching, sync |
| **Jotai/Recoil** | Atomic state | Fine-grained reactivity needs |

#### ⚠️ Anti-Patterns to Avoid:

```typescript
// ❌ BAD: Too many useState
function Component() {
  const [a, setA] = useState()
  const [b, setB] = useState()
  const [c, setC] = useState()
  // ... 10 more
  // 🚨 Use useReducer instead!
}

// ❌ BAD: Prop drilling 3+ levels
<Parent>
  <Child1 data={data} onUpdate={onUpdate}>
    <Child2 data={data} onUpdate={onUpdate}>
      <Child3 data={data} onUpdate={onUpdate} />
    </Child2>
  </Child1>
</Parent>
// 🚨 Use Context instead!

// ❌ BAD: Context for frequently changing values
const ThemeContext = createContext()
// Every consumer re-renders on ANY theme property change
// 🚨 Use context selector or split contexts!
```

---

### 3. **Effect Management Best Practices**

#### Modern useEffect Guidelines:

**✅ DO:**
```typescript
// Consolidate related effects
useEffect(() => {
  // All config updates in one effect
  controller.setPersonaId(personaId)
  controller.setScenarioId(scenarioId)
  controller.setVoice(voice)
}, [controller, personaId, scenarioId, voice])

// Use refs for non-reactive values
const latestCallback = useRef(callback)
useEffect(() => { latestCallback.current = callback }, [callback])
useEffect(() => {
  // Use latestCallback.current (always fresh, no dep)
}, []) // Stable dependencies

// Proper cleanup
useEffect(() => {
  const controller = new AbortController()
  fetchData(controller.signal)
  return () => controller.abort() // Cleanup!
}, [])
```

**❌ DON'T:**
```typescript
// Multiple effects for same concern
useEffect(() => { /* update A */ }, [dep])
useEffect(() => { /* update B */ }, [dep])
useEffect(() => { /* update C */ }, [dep])
// 🚨 Consolidate into one effect!

// Missing dependencies
useEffect(() => {
  doSomething(prop)
}, []) // 🚨 Missing 'prop' in deps!

// Effect cascades
useEffect(() => { setA(x) }, [x])
useEffect(() => { setB(a) }, [a]) // Cascade!
useEffect(() => { setC(b) }, [b]) // Cascade!
// 🚨 Consolidate or use derived state!
```

---

### 4. **Performance Optimization Hierarchy**

**React's Recommended Priority:**

1. **First: Profile before optimizing** (React DevTools Profiler)
2. **Second: Reduce re-renders** (proper memo, keys, state structure)
3. **Third: Optimize expensive calculations** (useMemo)
4. **Fourth: Optimize callbacks** (useCallback)
5. **Last: Code splitting** (lazy, Suspense)

**Modern Memoization Rules (2025):**

```typescript
// ✅ GOOD: Memo for expensive components
const ExpensiveList = memo(function ExpensiveList({ items }) {
  return items.map(item => <ExpensiveItem key={item.id} {...item} />)
})

// ✅ GOOD: useMemo for expensive calculations
const sortedItems = useMemo(() => 
  items.sort((a, b) => heavyComputation(a, b)),
  [items]
)

// ❌ BAD: Premature memoization
const onClick = useCallback(() => setCount(c => c + 1), [])
// 🚨 Simple function, not worth memoization!

// ✅ GOOD: useCallback when passing to memo'd children
const ExpensiveChild = memo(function ExpensiveChild({ onClick }) {
  return <button onClick={onClick}>Click</button>
})
function Parent() {
  const onClick = useCallback(() => { /* ... */ }, [])
  return <ExpensiveChild onClick={onClick} />
}
```

---

### 5. **Custom Hooks Design Patterns**

#### Best Practices from React.dev + Industry:

**✅ Single Responsibility:**
```typescript
// ✅ GOOD: One concern per hook
function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  })
  
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  
  return [value, setValue]
}

// ❌ BAD: God hook doing everything
function useEverything() {
  // 200 lines of mixed concerns
}
```

**✅ Composable:**
```typescript
// ✅ GOOD: Hooks that compose
function useAuth() { /* ... */ }
function useUserProfile(userId) {
  const { token } = useAuth() // Composing!
  // ... fetch profile with token
}
```

**✅ Return Stable References:**
```typescript
// ✅ GOOD: Stable callback references
function useController() {
  const [state, setState] = useState(initial)
  
  const update = useCallback((partial) => {
    setState(prev => ({ ...prev, ...partial }))
  }, []) // Stable!
  
  return { state, update }
}
```

---

### 6. **Context Optimization Patterns**

#### Problem: Context Re-render Cascade

```typescript
// ❌ BAD: Single context with all state
const AppContext = createContext({ user, theme, settings, messages })

function Component() {
  const { theme } = useContext(AppContext)
  // Re-renders when user/settings/messages change! 😱
}
```

#### Solution: Split Contexts by Change Frequency

```typescript
// ✅ GOOD: Separate contexts
const UserContext = createContext()     // Changes rarely
const ThemeContext = createContext()    // Changes occasionally
const MessagesContext = createContext() // Changes frequently

// Components only subscribe to what they need
function Component() {
  const theme = useContext(ThemeContext) // Only re-renders on theme change ✅
}
```

#### Advanced: Context Selector Pattern

```typescript
// ✅ BETTER: Fine-grained subscriptions
import { createContext, useContextSelector } from 'use-context-selector'

const AppContext = createContext(null)

function Component() {
  // Only re-renders when theme.dark changes!
  const isDark = useContextSelector(AppContext, ctx => ctx.theme.dark)
}
```

**Recommendation for EMRsim-chat:**
- Split `SettingsContext` into `ViewerSettingsContext`, `AudioSettingsContext`, `DebugSettingsContext`
- OR: Use `use-context-selector` library for fine-grained updates

---

### 7. **Class vs Hooks Migration**

#### Why Migrate Classes to Hooks?

**Benefits:**
- ✅ Less boilerplate (no constructor, bind, etc.)
- ✅ Easier to extract/reuse logic (custom hooks)
- ✅ Better tree-shaking (no class instances)
- ✅ Easier to test (plain functions)
- ✅ Official React direction (hooks are future)

**Migration Pattern:**
```typescript
// ❌ OLD: Class component
class BackendSocketManager {
  constructor(config) {
    this.socket = null
    this.state = {}
  }
  
  connect() { /* ... */ }
  disconnect() { /* ... */ }
}

// ✅ NEW: Hook
function useBackendSocket(config) {
  const [state, setState] = useState({})
  const socketRef = useRef(null)
  
  useEffect(() => {
    // Connection logic
    return () => { /* cleanup */ }
  }, [config])
  
  return { state, connect, disconnect }
}
```

**For EMRsim-chat:**
- `BackendSocketManager` → `useBackendSocket` (HIGH priority)
- Eliminates polling, provides reactive state
- Follows React patterns

---

### 8. **Testing Modern Hooks**

#### Best Practices (2025):

```typescript
// ✅ GOOD: Test hooks in isolation
import { renderHook, act } from '@testing-library/react'

test('useCounter increments', () => {
  const { result } = renderHook(() => useCounter())
  
  act(() => {
    result.current.increment()
  })
  
  expect(result.current.count).toBe(1)
})

// ✅ GOOD: Test hooks with providers
test('useAuth provides token', () => {
  const wrapper = ({ children }) => (
    <AuthProvider>{children}</AuthProvider>
  )
  
  const { result } = renderHook(() => useAuth(), { wrapper })
  expect(result.current.token).toBeDefined()
})
```

---

## 🎯 Recommendations for EMRsim-chat

### Priority 1: State Management Modernization

**Current Issues:**
1. `useVoiceSession`: 15 separate `useState` (state sprawl)
2. `BackendSocketManager`: Class-based (not React-friendly)
3. Multiple effects for same concerns (cascades)

**Recommended Solutions:**

#### A. useState → useReducer Migration
```typescript
// For useVoiceSession (15 useState → 1 useReducer)
type State = {
  status: VoiceStatus
  error: string | null
  sessionId: string | null
  // ... all 15 fields
}

type Action = 
  | { type: 'SNAPSHOT_UPDATED'; snapshot: Snapshot }
  | { type: 'STREAM_UPDATED'; stream: MediaStream }
  // ... other actions

function reducer(state: State, action: Action): State {
  // Atomic updates, easier to debug, testable
}

function useVoiceSession(options) {
  const [state, dispatch] = useReducer(reducer, initialState)
  // Much cleaner!
}
```

**Benefits:**
- ✅ Atomic state updates (all-or-nothing)
- ✅ Easier debugging (action logs)
- ✅ Testable reducer (pure function)
- ✅ Better performance (fewer re-renders)

#### B. Class → Hook Migration
```typescript
// BackendSocketManager → useBackendSocket
function useBackendSocket(config) {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  
  // Reactive state, automatic cleanup, React-friendly
  useEffect(() => {
    const socket = io(config.url)
    socket.on('connect', () => setIsConnected(true))
    socketRef.current = socket
    return () => socket.disconnect()
  }, [config.url])
  
  return { isConnected, socket: socketRef.current }
}
```

**Benefits:**
- ✅ No polling needed (reactive state)
- ✅ Automatic cleanup (useEffect)
- ✅ Fresh handlers (refs)
- ✅ Testable with `@testing-library/react-hooks`

---

### Priority 2: Context Optimization

**Current Issue:**
- `SettingsContext` causes full re-renders for all consumers

**Solution Options:**

**Option A: Split Contexts** (Easiest)
```typescript
// Separate by change frequency
const ViewerSettingsContext = createContext()
const AudioSettingsContext = createContext()
const DebugSettingsContext = createContext()
```

**Option B: Context Selectors** (Most Optimal)
```typescript
import { createContext, useContextSelector } from 'use-context-selector'

const SettingsContext = createContext()

// Only re-renders when showDebug changes
function Component() {
  const showDebug = useContextSelector(
    SettingsContext,
    ctx => ctx.settings.showDebug
  )
}
```

**Recommendation:** Start with Option A (simpler), migrate to Option B if needed.

---

### Priority 3: Effect Consolidation

**Pattern from Phase 3 (already proven):**
```typescript
// ✅ GOOD: Consolidated configuration effect
useEffect(() => {
  const config = {
    personaId: options.personaId ?? null,
    scenarioId: options.scenarioId ?? null,
    // ... all config
  }
  
  // Batch all updates
  controller.setPersonaId(config.personaId)
  controller.setScenarioId(config.scenarioId)
  // ...
  
  if (import.meta.env.DEV) {
    console.debug('[Component] Config updated:', config)
  }
}, [/* all deps */])
```

**Apply to:**
- App.tsx remaining 6 effects
- v2/hooks.ts usePlayback (4 effects → 2)
- Any component with 3+ related effects

---

## 📊 Success Metrics (Industry Standards)

| Metric | Poor | Good | Excellent | EMRsim Target |
|--------|------|------|-----------|---------------|
| useEffect count per component | >10 | 5-10 | <5 | <5 |
| useState count per component | >10 | 5-10 | <5 | <8 |
| Context re-render frequency | Every change | Batched | Selective | Selective |
| Custom hook usage | <40% | 60% | 80%+ | 85% |
| Class-based components | >10% | <5% | 0% | 0% |
| Effect consolidation | <20% | 40% | 60%+ | 50%+ |

---

## 🚀 Implementation Roadmap

### Phase 1: Quick Wins (1 week)
1. ✅ Effect consolidations (App.tsx, v2/hooks)
2. ✅ Extract RAF hook (PlaybackModal)
3. ✅ Scene.tsx use existing hooks

**Rationale:** Low risk, immediate improvement, builds momentum

### Phase 2: Strategic Improvements (2 weeks)
4. 🔥 BackendSocketManager → useBackendSocket
5. 🔥 useVoiceSession → useReducer pattern
6. 🔥 App.tsx remaining effects consolidation

**Rationale:** High impact, proven patterns, moderate risk

### Phase 3: Optimization (1 week)
7. 🟡 SettingsContext split or selector
8. 🟡 Performance profiling & targeted memo
9. 🟡 Testing coverage for new hooks

**Rationale:** Polish, performance, maintainability

---

## 📚 Additional Resources

### Official React Docs (react.dev)
- [Rules of React](https://react.dev/reference/rules)
- [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [Managing State](https://react.dev/learn/managing-state)
- [Escape Hatches](https://react.dev/learn/escape-hatches)
- [useReducer](https://react.dev/reference/react/useReducer)
- [useContext](https://react.dev/reference/react/useContext)

### Modern Libraries to Consider
- **use-context-selector** - Fine-grained context subscriptions
- **TanStack Query** - Server state management
- **Zustand** - Lightweight global state
- **Jotai** - Atomic state management

### Testing Resources
- **@testing-library/react** - Component testing
- **@testing-library/react-hooks** - Hook testing
- **Vitest** - Fast unit test runner (already in use)

---

## ✅ Key Takeaways

1. **Hooks are the future** - Classes are legacy, migrate to hooks
2. **useReducer for complex state** - 10+ useState = reducer candidate
3. **Consolidate related effects** - Fewer effects = better performance
4. **Context optimization matters** - Split or use selectors
5. **Custom hooks for reuse** - Extract, compose, test
6. **Profile before optimizing** - Measure, don't guess
7. **Follow React's rules** - Pure functions, top-level hooks only
8. **Test in isolation** - Hooks should be unit-testable

---

**Prepared by:** Development Team  
**Status:** Ready for Implementation  
**Next Step:** Update REFACTORING_OPPORTUNITIES.md with progress tracking
