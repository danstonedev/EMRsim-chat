# Voice/Realtime System Migration Plan

## Overview
This plan outlines a systematic approach to migrate from the current problematic architecture to a clean, maintainable system. The migration is designed to be incremental, allowing the system to remain functional throughout the process.

## Current Critical Issues
1. **"Hi." Response Loop** - AI gets stuck in greeting mode
2. **Session Race Conditions** - Multiple session types not synchronized
3. **Duplicate Transcripts** - Same messages processed multiple times
4. **Memory Leaks** - Resources not properly cleaned up
5. **Monolithic Controller** - ConversationController doing too much

## Migration Phases

### Phase 0: Immediate Stabilization (Days 1-3)
**Goal**: Fix critical bugs without major refactoring

#### Day 1: Session Synchronization Fix
```
Tasks:
1. Add session readiness checks before WebRTC connection
2. Implement session state validator
3. Add proper session cleanup on disconnect
4. Fix race condition in App.tsx session creation

Files to modify:
- frontend/src/pages/App.tsx
- frontend/src/modules/voice/runConnectionFlow.ts
- frontend/src/modules/voice/ConversationController.ts
```

#### Day 2: Transcript Deduplication
```
Tasks:
1. Centralize all duplicate detection in TranscriptEngine
2. Remove duplicate detection from useVoiceTranscripts
3. Add message ID tracking to prevent duplicates
4. Fix the "Hi." loop by clearing OpenAI context properly

Files to modify:
- frontend/src/modules/voice/TranscriptEngine.ts
- frontend/src/shared/hooks/useVoiceTranscripts.ts
- frontend/src/modules/voice/ConversationController.ts
```

#### Day 3: Memory Leak Fixes
```
Tasks:
1. Add proper cleanup in useEffect hooks
2. Clear event listeners on unmount
3. Fix WebRTC resource cleanup
4. Remove circular references

Files to modify:
- frontend/src/shared/hooks/useVoiceSession.ts
- frontend/src/shared/hooks/useResponseMonitor.ts
- frontend/src/modules/voice/ConversationController.ts
```

### Phase 1: Foundation Building (Days 4-8)
**Goal**: Create new architecture components alongside existing code

#### Day 4-5: Core Infrastructure
```
Create new files:
- frontend/src/modules/voice/v2/EventBus.ts
- frontend/src/modules/voice/v2/StateStore.ts
- frontend/src/modules/voice/v2/types.ts

Implementation:
1. Typed event system with discriminated unions
2. Centralized state store with subscriptions
3. Common types and interfaces
```

#### Day 6-7: State Machines
```
Create new files:
- frontend/src/modules/voice/v2/ConnectionStateMachine.ts
- frontend/src/modules/voice/v2/TranscriptStateMachine.ts
- frontend/src/modules/voice/v2/StateMachineBase.ts

Implementation:
1. Base state machine class with transition validation
2. Connection state machine with proper states
3. Transcript state machine with deduplication
```

#### Day 8: Session Coordinator
```
Create new files:
- frontend/src/modules/voice/v2/SessionCoordinator.ts
- frontend/src/modules/voice/v2/BackendClient.ts

Implementation:
1. Unified session management
2. Coordination between state machines
3. Clean backend communication layer
```

### Phase 2: Gradual Migration (Days 9-15)
**Goal**: Route existing functionality through new architecture

#### Day 9-10: WebRTC Management
```
Create new files:
- frontend/src/modules/voice/v2/WebRTCManager.ts
- frontend/src/modules/voice/v2/OpenAIClient.ts

Tasks:
1. Extract WebRTC logic from ConversationController
2. Create clean OpenAI client interface
3. Route connection through ConnectionStateMachine
```

#### Day 11-12: Transcript Processing
```
Tasks:
1. Route all transcripts through TranscriptStateMachine
2. Replace direct TranscriptEngine usage
3. Connect to EventBus for unified events
4. Update UI hooks to use EventBus
```

#### Day 13-14: Session Management
```
Create new file:
- frontend/src/modules/voice/v2/VoiceSessionManager.ts

Tasks:
1. Replace useVoiceSession internals with VoiceSessionManager
2. Route all session operations through SessionCoordinator
3. Update App.tsx to use new session system
```

#### Day 15: Integration Testing
```
Tasks:
1. Test all voice flows with new architecture
2. Verify no regressions
3. Performance testing
4. Fix any integration issues
```

### Phase 3: Cleanup (Days 16-18)
**Goal**: Remove old code and consolidate

#### Day 16: Remove Old Controllers
```
Tasks:
1. Remove old ConversationController code
2. Remove old runConnectionFlow
3. Clean up unused imports and dependencies
```

#### Day 17: Consolidate Hooks
```
Tasks:
1. Simplify useVoiceSession
2. Remove useResponseMonitor (replaced by EventBus)
3. Simplify useVoiceTranscripts
```

#### Day 18: Documentation
```
Tasks:
1. Update API documentation
2. Create component diagrams
3. Document event flows
4. Update README
```

### Phase 4: Optimization (Days 19-21)
**Goal**: Performance and reliability improvements

#### Day 19: Performance
```
Tasks:
1. Add event batching to EventBus
2. Optimize transcript deduplication
3. Add connection pooling
4. Profile and fix bottlenecks
```

#### Day 20: Error Recovery
```
Tasks:
1. Implement exponential backoff
2. Add circuit breaker pattern
3. Improve error messages
4. Add telemetry
```

#### Day 21: Final Testing
```
Tasks:
1. End-to-end testing
2. Load testing
3. Error scenario testing
4. User acceptance testing
```

## File Structure (New)

```
frontend/src/modules/voice/
├── v2/                           # New architecture
│   ├── core/
│   │   ├── EventBus.ts          # Central event system
│   │   ├── StateStore.ts        # State management
│   │   └── types.ts             # Shared types
│   ├── state/
│   │   ├── StateMachineBase.ts  # Base class
│   │   ├── ConnectionStateMachine.ts
│   │   └── TranscriptStateMachine.ts
│   ├── session/
│   │   ├── SessionCoordinator.ts
│   │   └── VoiceSessionManager.ts
│   ├── infrastructure/
│   │   ├── WebRTCManager.ts
│   │   ├── BackendClient.ts
│   │   └── OpenAIClient.ts
│   └── index.ts                 # Public API
├── legacy/                       # Old code (to be removed)
│   ├── ConversationController.ts
│   ├── runConnectionFlow.ts
│   └── TranscriptEngine.ts
└── index.ts                     # Facade during migration
```

## Success Metrics

### Technical Metrics
- [ ] No "Hi." response loops for 24 hours
- [ ] Zero duplicate transcripts in production
- [ ] Session creation success rate > 99%
- [ ] Memory usage stable over 1-hour sessions
- [ ] Connection retry success rate > 95%

### Code Quality Metrics
- [ ] Each module < 300 lines of code
- [ ] Test coverage > 80%
- [ ] Zero circular dependencies
- [ ] All state transitions explicit
- [ ] Single responsibility per module

### Performance Metrics
- [ ] Session creation < 2 seconds
- [ ] Transcript processing < 50ms
- [ ] Event propagation < 10ms
- [ ] Memory growth < 10MB per hour

## Risk Mitigation

### Feature Flags
```typescript
const FEATURE_FLAGS = {
  USE_NEW_SESSION_MANAGER: false,
  USE_NEW_TRANSCRIPT_FLOW: false,
  USE_EVENT_BUS: false,
  USE_STATE_MACHINES: false,
};
```

### Rollback Plan
1. Each phase can be rolled back independently
2. Feature flags control new vs old code paths
3. Old code kept in legacy/ folder until Phase 3
4. Database migrations are backward compatible

### Testing Strategy
1. Unit tests for each new module
2. Integration tests for each phase
3. A/B testing in production with feature flags
4. Canary deployment to subset of users

## Implementation Order

### Week 1: Stabilization & Foundation
- Days 1-3: Critical fixes (Phase 0)
- Days 4-8: Build new components (Phase 1)

### Week 2: Migration
- Days 9-15: Gradual migration (Phase 2)

### Week 3: Cleanup & Optimization
- Days 16-18: Remove old code (Phase 3)
- Days 19-21: Optimize and test (Phase 4)

## Next Steps

1. **Immediate Action** (Today):
   - Fix session race condition in App.tsx
   - Add session readiness check in runConnectionFlow
   - Clear OpenAI context on session start

2. **Tomorrow**:
   - Centralize duplicate detection in TranscriptEngine
   - Add message ID tracking
   - Fix the "Hi." loop issue

3. **This Week**:
   - Complete Phase 0 stabilization
   - Begin Phase 1 foundation building
   - Set up feature flags

## Team Responsibilities

### Frontend Team
- Own the migration implementation
- Create new v2 modules
- Maintain backward compatibility

### Backend Team
- Ensure API stability
- Add session validation endpoints
- Support new event patterns

### QA Team
- Create comprehensive test suite
- Monitor production metrics
- Validate each phase

## Communication Plan

### Daily Standup Topics
- Migration progress
- Blockers and risks
- Metrics review
- Next 24-hour plan

### Weekly Reviews
- Phase completion status
- Metric trends
- Architecture decisions
- Timeline adjustments

## Conclusion

This migration plan provides a clear path from the current problematic architecture to a clean, maintainable system. By following this systematic approach, we can fix immediate issues while building a solid foundation for the future.

The key principles:
1. **Incremental**: Each phase builds on the previous
2. **Reversible**: Can roll back at any point
3. **Testable**: Each component tested in isolation
4. **Measurable**: Clear success metrics
5. **Pragmatic**: Fix critical issues first

Expected outcome: A stable, maintainable voice system with clear architecture, no duplicate messages, proper session management, and reliable AI responses.
