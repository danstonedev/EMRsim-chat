# Phase 3: ConversationController Refactor - Detailed Plan

**Date:** October 10, 2025  
**Target:** Break 1,428-line ConversationController into focused managers  
**Estimated Effort:** 1-2 weeks

---

## Current Architecture Analysis

### ConversationController.ts (1,428 lines)
**Already Using Services:**
- ✅ `ConversationEventEmitter` - Event coordination
- ✅ `ConversationStateManager` - Status/state management
- ✅ `AudioStreamManager` - Audio handling
- ✅ `BackendSocketManager` - WebSocket transcript relay
- ✅ `WebRTCConnectionManager` - WebRTC connection
- ✅ `TranscriptCoordinator` - Transcript processing

**Still Mixed Responsibilities in ConversationController:**
1. **Session Lifecycle** - Session creation, configuration, state tracking
2. **Connection Orchestration** - Coordinating all the managers during connect/disconnect
3. **Event Handling** - Complex event routing between transport, managers, and UI
4. **Instruction Management** - Syncing instructions with OpenAI Realtime API
5. **Microphone Control** - Pause/unpause logic with auto-pause reasons
6. **VAD/Endpointing** - Voice Activity Detection coordination
7. **Barge-in Logic** - Interruption handling
8. **Media Parsing** - Extracting media markers from transcripts
9. **Timing/Metrics** - Connection timing, retry logic

---

## Public API Surface (Must Preserve)

### Core Methods
```typescript
// Lifecycle
async startVoice(): Promise<void>
stopVoice(): void

// Configuration
setPersonaId(personaId: string | null): void
setScenarioId(scenarioId: string | null): void
setScenarioMedia(media: MediaReference[]): void
setExternalSessionId(sessionId: string | null): void
setVoiceOverride(v: string | null): void
setInputLanguage(l: PreferredString<'auto'>): void
setReplyLanguage(l: PreferredString<'default'>): void
setModel(m: string | null): void
setTranscriptionModel(m: string | null): void

// Control
setMicPaused(paused: boolean): void

// State Access
getSnapshot(): ConversationSnapshot
getEncounterState(): { phase, gate, outstandingGate }
getRemoteAudioElement(): HTMLAudioElement | null
getSessionId(): string | null
getStatus(): VoiceStatus
getMicStream(): MediaStream | null
getPeerConnection(): RTCPeerConnection | null
getAdaptiveSnapshot(): { ... }

// Events
addListener(listener: ConversationListener): () => void
addDebugListener(listener: ConversationDebugListener): () => void

// Debug
setDebugEnabled(enabled: boolean): void
setRealtimeEventListener(listener: ((payload: unknown) => void) | null): void

// Instructions
async refreshInstructions(opts?: InstructionRefreshOptions): Promise<void>
```

---

## Refactoring Strategy

### ⚠️ CRITICAL: Incremental Approach Required

Given the complexity and 1,428 lines, we **CANNOT** do a big-bang rewrite. Instead:

1. **Extract without breaking** - Create new classes alongside existing code
2. **Delegate gradually** - Move logic piece by piece into new managers
3. **Maintain compatibility** - Keep all tests passing at each step
4. **Verify continuously** - Test after each extraction

### Phase 3 will be broken into Sub-Phases:

#### **Phase 3.1: Session Lifecycle Extraction** (Day 1-2)
**Goal:** Extract session configuration and lifecycle management

**Create:** `SessionLifecycleManager.ts`
```typescript
class SessionLifecycleManager {
  private sessionId: string | null
  private personaId: string | null
  private scenarioId: string | null
  private externalSessionId: string | null
  
  // Configuration
  setPersonaId(id: string | null): void
  setScenarioId(id: string | null): void
  setExternalSessionId(id: string | null): void
  
  // Lifecycle
  async createSession(): Promise<string>
  async destroySession(): Promise<void>
  
  // State
  getSessionId(): string | null
  isActive(): boolean
}
```

**Steps:**
1. Create SessionLifecycleManager class
2. Move session-related properties
3. Move session creation logic from `startVoice()`
4. Update ConversationController to delegate to SessionLifecycleManager
5. Update tests to verify session creation still works

---

#### **Phase 3.2: Configuration Management** (Day 2-3)
**Goal:** Centralize all voice/model configuration

**Create:** `VoiceConfigurationManager.ts`
```typescript
class VoiceConfigurationManager {
  private voiceOverride: string | null
  private inputLanguage: PreferredString<'auto'>
  private replyLanguage: PreferredString<'default'>
  private model: string | null
  private transcriptionModel: string | null
  
  setVoiceOverride(v: string | null): void
  setInputLanguage(l: PreferredString<'auto'>): void
  setReplyLanguage(l: PreferredString<'default'>): void
  setModel(m: string | null): void
  setTranscriptionModel(m: string | null): void
  
  buildSessionConfig(): SessionConfig
  hasChanges(previous: SessionConfig): boolean
}
```

**Steps:**
1. Create VoiceConfigurationManager
2. Move all configuration properties
3. Move configuration setters
4. Create `buildSessionConfig()` method
5. Update ConversationController to use VoiceConfigurationManager

---

#### **Phase 3.3: Microphone Control Extraction** (Day 3-4)
**Goal:** Separate microphone pause logic

**Create:** `MicrophoneControlManager.ts`
```typescript
class MicrophoneControlManager {
  private micPaused: boolean
  private userMicPaused: boolean
  private autoMicPauseReasons: Set<string>
  
  setUserPaused(paused: boolean): void
  setAutoPaused(reason: string, paused: boolean): void
  
  isPaused(): boolean
  getReasons(): string[]
  getMicLevel(): number | null
}
```

**Steps:**
1. Create MicrophoneControlManager
2. Move mic pause state and logic
3. Move auto-pause reason tracking
4. Update ConversationController to delegate mic control

---

#### **Phase 3.4: Connection Orchestration** (Day 4-6)
**Goal:** Simplify the massive `startVoice()` and `stopVoice()` methods

**Create:** `ConnectionOrchestrator.ts`
```typescript
class ConnectionOrchestrator {
  constructor(
    private sessionManager: SessionLifecycleManager,
    private configManager: VoiceConfigurationManager,
    private webrtcManager: WebRTCConnectionManager,
    private audioManager: AudioStreamManager,
    private stateManager: ConversationStateManager,
    private eventEmitter: ConversationEventEmitter,
    private transcriptCoordinator: TranscriptCoordinator
  ) {}
  
  async connect(): Promise<void>
  disconnect(): void
  
  private async setupWebRTC(): Promise<void>
  private async setupAudio(): Promise<void>
  private teardownWebRTC(): void
  private teardownAudio(): void
}
```

**Steps:**
1. Create ConnectionOrchestrator
2. Move connection flow logic from `startVoice()`
3. Move disconnection logic from `stopVoice()`
4. Have ConversationController delegate to ConnectionOrchestrator
5. Simplify `startVoice()` to ~20 lines

---

#### **Phase 3.5: Create Thin VoiceSessionOrchestrator** (Day 6-7)
**Goal:** Replace ConversationController with a thin facade

**Create:** `VoiceSessionOrchestrator.ts`
```typescript
export class VoiceSessionOrchestrator {
  private sessionManager: SessionLifecycleManager
  private configManager: VoiceConfigurationManager
  private micManager: MicrophoneControlManager
  private connectionOrchestrator: ConnectionOrchestrator
  private eventEmitter: ConversationEventEmitter
  private stateManager: ConversationStateManager
  // ... other managers
  
  constructor(config: VoiceSessionConfig) {
    // Initialize all managers
    // Wire up inter-manager communication
  }
  
  // Public API methods delegate to appropriate managers
  async startVoice(): Promise<void> {
    return this.connectionOrchestrator.connect()
  }
  
  stopVoice(): void {
    this.connectionOrchestrator.disconnect()
  }
  
  setPersonaId(id: string | null): void {
    this.sessionManager.setPersonaId(id)
  }
  
  // ... delegate all other methods
}
```

**Steps:**
1. Create VoiceSessionOrchestrator skeleton
2. Wire all managers together
3. Delegate all public methods
4. Add backward compatibility export

---

#### **Phase 3.6: Update Consumers** (Day 7-8)
**Goal:** Update all usages to use new architecture

**Files to Update:**
- `frontend/src/shared/hooks/useVoiceSession.ts` (main consumer)
- `frontend/src/shared/__tests__/ConversationController.*.test.ts` (tests)
- Any direct imports of ConversationController

**Steps:**
1. Update useVoiceSession to import VoiceSessionOrchestrator
2. Ensure all method calls still work
3. Update test files to use VoiceSessionOrchestrator
4. Add backward compatibility: `export { VoiceSessionOrchestrator as ConversationController }`

---

#### **Phase 3.7: Test & Verify** (Day 8-10)
**Goal:** Comprehensive testing

**Steps:**
1. Run full frontend test suite
2. Run frontend build
3. Manual testing of voice session flow
4. Fix any issues found
5. Performance check (ensure no regressions)

---

## File Structure After Refactor

```
frontend/src/shared/
├── VoiceSessionOrchestrator.ts (NEW - thin facade, <200 lines)
├── ConversationController.ts (DEPRECATED - re-export for compatibility)
├── managers/
│   ├── SessionLifecycleManager.ts (NEW - session state)
│   ├── VoiceConfigurationManager.ts (NEW - config management)
│   ├── MicrophoneControlManager.ts (NEW - mic control)
│   └── ConnectionOrchestrator.ts (NEW - connection flow)
├── services/ (EXISTING - keep these)
│   ├── ConversationEventEmitter.ts
│   ├── ConversationStateManager.ts
│   ├── AudioStreamManager.ts
│   ├── BackendSocketManager.ts
│   ├── WebRTCConnectionManager.ts
│   └── TranscriptCoordinator.ts
```

---

## Success Criteria

✅ All tests pass  
✅ Frontend builds successfully  
✅ Voice session flow works in manual testing  
✅ No performance regressions  
✅ Code is more maintainable (each file < 400 lines)  
✅ Clear separation of concerns  
✅ Backward compatibility maintained via exports  

---

## Risks & Mitigations

### Risk 1: Breaking Complex Event Flows
**Mitigation:** Extract one manager at a time, test after each extraction

### Risk 2: Missing Edge Cases
**Mitigation:** Comprehensive test coverage, manual testing checklist

### Risk 3: Performance Regression
**Mitigation:** Keep existing managers as-is, only orchestrate differently

### Risk 4: Too Much Complexity
**Mitigation:** Stop if extraction creates more problems than it solves

---

## Decision: Proceed or Defer?

**Recommendation:** Proceed with **Phase 3.1 (Session Lifecycle) ONLY** for now.

**Rationale:**
- This is the safest extraction with minimal risk
- If it goes well, proceed to Phase 3.2
- If it's too complex, we can stop and document learnings

**Next Step:** Get approval to proceed with Phase 3.1 (Session Lifecycle Extraction)
