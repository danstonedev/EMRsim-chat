# ConversationController Phase 2 Modularization Plan

**Target: Break 1341-line file into modules ≤300 lines each**

## Executive Summary

**Current State:** 1341 lines (after Phase 1: TranscriptHandler extraction)
**Target:** Core controller ≤300 lines, all modules ≤300 lines
**Estimated Reduction:** 1341 → ~280 lines (79% reduction)
**Timeline:** 6-8 hours over 4 phases

---

## Architecture Vision

### Before (Current):

``` text
ConversationController.ts (1341 lines)
├── Imports & Types (100 lines)
├── Field Declarations (80 lines)
├── Constructor & Initialization (500 lines)
├── Public API Methods (200 lines)
├── WebRTC Handlers (150 lines)
├── Message Routing (150 lines)
├── Utility Methods (161 lines)
└── Settings Setters (20 lines)
```

### After (Target):

``` text
ConversationController.ts (~280 lines)  ← Core orchestrator only
├── EventDispatcher.ts (~250 lines)     ← Message routing, event classification
├── ServiceRegistry.ts (~200 lines)     ← Service initialization & dependency injection
├── ConnectionHandlers.ts (~180 lines)  ← WebRTC state change handlers
├── BackendIntegration.ts (~150 lines)  ← Backend socket & relay logic
└── PublicAPI.ts (~280 lines)          ← Public methods facade
```

**Total:** ~1340 lines distributed across 6 files (avg 223 lines/file)

---

## Phase 2: Extract EventDispatcher & Message Router

**Lines Extracted:** ~250 lines
**Target File:** `frontend/src/shared/dispatchers/EventDispatcher.ts`
**Time:** 2 hours

### Responsibilities

1. **Event Classification:** Delegate to `classifyEvent()` (already modular)
2. **Message Routing:** Route events to handler families (session, speech, transcription, assistant, conversation-item)
3. **Error Handling:** Catch JSON parse failures, log unhandled events
4. **Debug Logging:** Emit debug events for all incoming messages

### Current Code Location

- Lines 1145-1228: `handleMessage()` method (83 lines)
- Lines 1176-1225: Event routing switch statement (49 lines)
- Additional routing logic scattered in constructor (event handler initialization)

### Extraction Strategy

#### 1. Create EventDispatcher.ts

```typescript
import type { VoiceDebugEvent } from '../types'
import { classifyEvent } from '../../features/voice/conversation/events/eventClassifier'
import { handleSessionEvent } from '../../features/voice/conversation/events/sessionEvents'

export interface EventDispatcherDependencies {
  // Event handlers
  speechHandlers: SpeechEventHandlers
  transcriptionHandlers: TranscriptionEventHandlers
  assistantHandlers: AssistantStreamHandlers
  conversationItemHandlers: ConversationItemHandlers
  
  // Session event dependencies
  sessionHandlers: {
    logDebug: (...args: unknown[]) => void
    stateManager: ConversationStateManager
    ensureSessionAckTimeout: () => void
    refreshInstructions: (reason: string) => Promise<void>
    getActiveChannel: () => RTCDataChannel | null
    isActiveChannelOpen: () => boolean
    markSessionReady: (trigger: string) => void
  }
  
  // Logging & debugging
  eventEmitter: ConversationEventEmitter
  debugEnabled: boolean
  onRealtimeEvent: ((payload: unknown) => void) | null
}

export class EventDispatcher {
  constructor(private readonly deps: EventDispatcherDependencies) {}
  
  /**
   * Parse and route incoming WebRTC data channel message
   * Delegates to appropriate handler family based on event type
   */
  handleMessage(raw: string): void {
    try {
      const payload = JSON.parse(raw)
      this.deps.onRealtimeEvent?.(payload)
      const type: string = (payload?.type || '').toLowerCase()

      // Emit debug event with error detection
      this.emitDebugEvent(type, payload)

      // Classify event and route to handler
      this.routeEvent(type, payload)
      
    } catch (err) {
      console.warn('[EventDispatcher] Failed to parse payload', err)
    }
  }
  
  private emitDebugEvent(type: string, payload: unknown): void {
    const hasProblem = type.includes('error') || type.includes('warning')
    const brief = hasProblem
      ? (payload?.error?.message || payload?.error?.code || payload?.message || '')
      : ''
    const msg = hasProblem && brief ? `${type}: ${String(brief)}` : type
    
    const ev: VoiceDebugEvent = this.deps.debugEnabled
      ? { t: new Date().toISOString(), kind: hasProblem ? 'error' : 'event', src: 'dc', msg, data: payload }
      : { t: new Date().toISOString(), kind: hasProblem ? 'error' : 'event', src: 'dc', msg }
      
    this.deps.eventEmitter.emitDebug(ev)
  }
  
  private routeEvent(type: string, payload: unknown): void {
    const classified = classifyEvent(type, payload)
    
    switch (classified.family) {
      case 'session':
        this.handleSessionEvent(type, payload)
        break
      case 'speech':
        this.deps.speechHandlers.handleSpeechEvent(type, payload)
        break
      case 'transcription':
        this.deps.transcriptionHandlers.handleTranscriptionEvent(type, payload)
        break
      case 'assistant':
        this.deps.assistantHandlers.handleAssistantEvent(type, payload)
        break
      case 'conversation-item':
        this.deps.conversationItemHandlers.handleConversationItemEvent(type, payload)
        break
      case 'error':
        // Already logged via emitDebugEvent
        break
      case 'unknown':
        this.deps.sessionHandlers.logDebug('[EventDispatcher] ⚠️ Unhandled event type:', type)
        break
    }
  }
  
  private handleSessionEvent(type: string, payload: unknown): void {
    handleSessionEvent(type, payload, {
      logDebug: this.deps.sessionHandlers.logDebug,
      stateManager: this.deps.sessionHandlers.stateManager,
      ensureSessionAckTimeout: this.deps.sessionHandlers.ensureSessionAckTimeout,
      refreshInstructions: this.deps.sessionHandlers.refreshInstructions,
      getActiveChannel: this.deps.sessionHandlers.getActiveChannel,
      isActiveChannelOpen: this.deps.sessionHandlers.isActiveChannelOpen,
      emit: (event) => this.deps.eventEmitter.emit(event),
      markSessionReady: this.deps.sessionHandlers.markSessionReady,
    })
  }
}
```

#### 2. Update ConversationController.ts

```typescript
// Add import
import { EventDispatcher } from './dispatchers/EventDispatcher'

// Add field
private eventDispatcher: EventDispatcher

// Initialize in constructor (after all event handlers)
this.eventDispatcher = new EventDispatcher({
  speechHandlers: this.speechHandlers,
  transcriptionHandlers: this.transcriptionHandlers,
  assistantHandlers: this.assistantHandlers,
  conversationItemHandlers: this.conversationItemHandlers,
  sessionHandlers: {
    logDebug: (...args) => this.logDebug(...args),
    stateManager: this.stateManager,
    ensureSessionAckTimeout: () => this.ensureSessionAckTimeout(),
    refreshInstructions: (reason) => this.refreshInstructions(reason),
    getActiveChannel: () => this.webrtcManager.getActiveChannel(),
    isActiveChannelOpen: () => this.webrtcManager.isActiveChannelOpen(),
    markSessionReady: (trigger) => this.markSessionReady(trigger),
  },
  eventEmitter: this.eventEmitter,
  debugEnabled: this.debugEnabled,
  onRealtimeEvent: this.onRealtimeEvent,
})

// Replace handleMessage method
private handleMessage(raw: string): void {
  this.eventDispatcher.handleMessage(raw)
}
```

### Benefits

- ✅ Isolates message parsing and routing logic
- ✅ Easier to test event classification
- ✅ Clear separation of concerns (routing vs handling)
- ✅ Reduces ConversationController by ~100 lines

---

## Phase 3: Extract ServiceRegistry & Dependency Injection

**Lines Extracted:** ~500 lines
**Target File:** `frontend/src/shared/registry/ServiceRegistry.ts`
**Time:** 2.5 hours

### Responsibilities

1. **Service Initialization:** Create all service instances (EventEmitter, StateManager, AudioManager, etc.)
2. **Event Handler Creation:** Initialize speech, transcription, assistant, conversation-item handlers
3. **Dependency Injection:** Wire up all inter-service dependencies
4. **Configuration Management:** Apply config to services

### Current Code Location

- Lines 187-596: Constructor service initialization (409 lines)
- Lines 270-596: Service instances & event handler setup

### Extraction Strategy

#### 1. Create ServiceRegistry.ts

```typescript
export interface ServiceRegistryConfig {
  // Core config
  debugEnabled: boolean
  bargeInEnabled: boolean
  backendTranscriptMode: boolean
  scenarioMedia: MediaReference[]
  sttFallbackMs: number
  sttExtendedMs: number
  remoteAudioElement: HTMLAudioElement | null
  
  // Managers (already initialized)
  sessionLifecycle: SessionLifecycleManager
  voiceConfig: VoiceConfigurationManager
  micControl: MicrophoneControlManager
  connectionOrchestrator: ConnectionOrchestrator
}

export interface ServiceRegistry {
  // Services
  eventEmitter: ConversationEventEmitter
  stateManager: ConversationStateManager
  audioManager: AudioStreamManager
  socketManager: BackendSocketManager
  webrtcManager: WebRTCConnectionManager
  transcriptCoordinator: TranscriptCoordinator
  transcriptEngine: TranscriptEngine
  endpointing: EndpointingManager
  
  // Event handlers
  speechHandlers: SpeechEventHandlers
  transcriptionHandlers: TranscriptionEventHandlers
  assistantHandlers: AssistantStreamHandlers
  conversationItemHandlers: ConversationItemHandlers
  
  // Lifecycle handlers
  instructionSyncManager: InstructionSyncManager
  sessionReadyManager: SessionReadyManager
  sessionReuseHandlers: SessionReuseHandlers
  
  // Custom handlers
  transcriptHandler: TranscriptHandler
}

export function createServiceRegistry(
  config: ServiceRegistryConfig,
  callbacks: {
    handleUserTranscript: (text: string, isFinal: boolean, timings: TranscriptTimings) => void
    handleAssistantTranscript: (text: string, isFinal: boolean, timings: TranscriptTimings) => void
    relayTranscriptToBackend: (role, text, isFinal, timestamp, timings?, itemId?) => Promise<void>
    handleIceConnectionStateChange: (state: RTCIceConnectionState) => void
    handleConnectionStateChange: (state: RTCPeerConnectionState) => void
    setAutoMicPaused: (reason: string, paused: boolean) => void
    releaseInitialAssistantAutoPause: (reason: string) => void
    scheduleInitialAssistantRelease: (reason: string, delayMs?: number) => void
    drainPendingInstructionSync: (trigger: string) => void
    markSessionReady: (trigger: string) => void
    ensureSessionAckTimeout: () => void
    refreshInstructions: (reason: string) => Promise<void>
    logDebug: (...args: unknown[]) => void
  }
): ServiceRegistry {
  // Initialize services in dependency order...
  const eventEmitter = new ConversationEventEmitter(config.debugEnabled)
  const stateManager = new ConversationStateManager()
  
  // ... (full initialization logic from constructor)
  
  return {
    eventEmitter,
    stateManager,
    audioManager,
    socketManager,
    webrtcManager,
    transcriptCoordinator,
    transcriptEngine,
    endpointing,
    speechHandlers,
    transcriptionHandlers,
    assistantHandlers,
    conversationItemHandlers,
    instructionSyncManager,
    sessionReadyManager,
    sessionReuseHandlers,
    transcriptHandler,
  }
}
```

#### 2. Update ConversationController.ts

```typescript
// Constructor becomes tiny
constructor(config: ConversationControllerConfig = {}) {
  // Initialize managers (100 lines - already extracted)
  this.sessionLifecycle = new SessionLifecycleManager(...)
  this.voiceConfig = new VoiceConfigurationManager(...)
  this.micControl = new MicrophoneControlManager(...)
  this.connectionOrchestrator = new ConnectionOrchestrator(...)
  
  // Initialize services via registry (1 line!)
  const services = createServiceRegistry(
    {
      debugEnabled: this.debugEnabled,
      bargeInEnabled: this.bargeInEnabled,
      backendTranscriptMode: this.backendTranscriptMode,
      scenarioMedia: this.scenarioMedia,
      sttFallbackMs,
      sttExtendedMs,
      remoteAudioElement: this.remoteAudioElement,
      sessionLifecycle: this.sessionLifecycle,
      voiceConfig: this.voiceConfig,
      micControl: this.micControl,
      connectionOrchestrator: this.connectionOrchestrator,
    },
    {
      handleUserTranscript: (text, isFinal, timings) => this.handleUserTranscript(text, isFinal, timings),
      handleAssistantTranscript: (text, isFinal, timings) => this.handleAssistantTranscript(text, isFinal, timings),
      relayTranscriptToBackend: (...args) => this.relayTranscriptToBackend(...args),
      // ... all other callbacks
    }
  )
  
  // Assign all services to instance
  Object.assign(this, services)
}
```

### Benefits

- ✅ Removes 400+ lines from constructor
- ✅ Testable in isolation (can inject mock services)
- ✅ Clear service lifecycle (initialization order visible)
- ✅ Easier to add new services (just update registry)

---

## Phase 4: Extract ConnectionHandlers

**Lines Extracted:** ~180 lines
**Target File:** `frontend/src/shared/handlers/ConnectionHandlers.ts`
**Time:** 1.5 hours

### Responsibilities

1. **ICE Connection State:** Handle WebRTC ICE connection state changes
2. **Peer Connection State:** Handle RTCPeerConnection state changes
3. **Data Channel Events:** Attachment, error handling, close events
4. **Transport Logging:** Centralized logging for transport events

### Current Code Location

- Lines 1230-1250: `handleIceConnectionStateChange()` (20 lines)
- Lines 1252-1263: `handleConnectionStateChange()` (11 lines)
- Lines 1285-1295: `attachDataChannelHandlers()` (10 lines)
- Lines 1028-1043: `logTransport()` (15 lines)
- Lines 388-455: Data channel callback setup (67 lines)

### Extraction Strategy

#### 1. Create ConnectionHandlers.ts

```typescript
export interface ConnectionHandlersDependencies {
  stateManager: ConversationStateManager
  webrtcManager: WebRTCConnectionManager
  eventEmitter: ConversationEventEmitter
}

export class ConnectionHandlers {
  constructor(private readonly deps: ConnectionHandlersDependencies) {}
  
  handleIceConnectionStateChange(state: RTCIceConnectionState): void {
    this.deps.eventEmitter.emitDebug({
      t: new Date().toISOString(),
      kind: 'event',
      src: 'pc',
      msg: `iceconnectionstatechange:${state}`,
    })

    if (state === 'connected' || state === 'completed') {
      if (!this.deps.stateManager.isConnected()) {
        this.deps.stateManager.setConnected(true)
        this.deps.stateManager.updateStatus('connected', null)
        setTimeout(() => {
          const anyOpen = this.deps.webrtcManager.hasOpenChannel()
          if (!anyOpen) {
            this.deps.eventEmitter.emitDebug({
              t: new Date().toISOString(),
              kind: 'warn',
              src: 'dc',
              msg: 'datachannel not open within 2s after ICE connected',
            })
          }
        }, 2000)
      }
    } else if (state === 'disconnected' || state === 'failed') {
      this.deps.eventEmitter.emitDebug({
        t: new Date().toISOString(),
        kind: 'warn',
        src: 'pc',
        msg: `connection degraded: ${state}`,
      })
      if (state === 'failed') {
        this.deps.stateManager.updateStatus('error', `connection_failed_${state}`)
      }
    }
  }
  
  handleConnectionStateChange(state: RTCPeerConnectionState): void {
    this.deps.eventEmitter.emitDebug({
      t: new Date().toISOString(),
      kind: 'event',
      src: 'pc',
      msg: `connectionstatechange:${state}`,
    })
    if (state === 'failed' || state === 'disconnected') {
      this.deps.stateManager.updateStatus('error', state)
    }
  }
  
  attachDataChannelHandlers(channel: RTCDataChannel): void {
    this.deps.webrtcManager.attachDataChannelHandlers(channel)
  }
  
  logTransport(entry: TransportLoggerEntry): void {
    const timestamp = new Date().toISOString()
    const mappedSrc = entry.src === 'pc' ? 'pc' : entry.src === 'dc' ? 'dc' : 'app'
    if (entry.kind === 'event') {
      this.deps.eventEmitter.emitDebug({ 
        t: timestamp, 
        kind: 'event', 
        src: mappedSrc, 
        msg: entry.msg, 
        data: entry.data 
      })
    } else {
      this.deps.eventEmitter.emitDebug({ 
        t: timestamp, 
        kind: entry.kind, 
        src: mappedSrc, 
        msg: entry.msg, 
        data: entry.data 
      })
    }
  }
}
```

#### 2. Update ConversationController.ts

```typescript
// Add field
private connectionHandlers: ConnectionHandlers

// Initialize in constructor
this.connectionHandlers = new ConnectionHandlers({
  stateManager: this.stateManager,
  webrtcManager: this.webrtcManager,
  eventEmitter: this.eventEmitter,
})

// Delegate methods (3 lines each)
private handleIceConnectionStateChange(state: RTCIceConnectionState): void {
  this.connectionHandlers.handleIceConnectionStateChange(state)
}

private handleConnectionStateChange(state: RTCPeerConnectionState): void {
  this.connectionHandlers.handleConnectionStateChange(state)
}

private logTransport(entry: TransportLoggerEntry): void {
  this.connectionHandlers.logTransport(entry)
}

private attachDataChannelHandlers(channel: RTCDataChannel): void {
  this.connectionHandlers.attachDataChannelHandlers(channel)
}
```

### Benefits

- ✅ Removes ~150 lines from ConversationController
- ✅ Isolates WebRTC connection logic
- ✅ Easier to test connection state transitions
- ✅ Clear responsibility boundary

---

## Phase 5: Extract BackendIntegration

**Lines Extracted:** ~150 lines
**Target File:** `frontend/src/shared/integration/BackendIntegration.ts`
**Time:** 1.5 hours

### Responsibilities

1. **Backend Socket Initialization:** WebSocket connection for unified transcript broadcast
2. **Transcript Relay:** Send transcripts to backend for persistence & broadcast
3. **Socket Event Handling:** Connect, disconnect, catchup, errors
4. **Logging:** Debug logging for backend integration

### Current Code Location

- Lines 762-779: `initializeBackendSocket()` (17 lines)
- Lines 781-838: `relayTranscriptToBackend()` (57 lines)
- Lines 307-380: Socket event handlers in constructor (73 lines)

### Extraction Strategy

#### 1. Create BackendIntegration.ts

```typescript
export interface BackendIntegrationDependencies {
  socketManager: BackendSocketManager
  eventEmitter: ConversationEventEmitter
  debugEnabled: boolean
}

export class BackendIntegration {
  constructor(private readonly deps: BackendIntegrationDependencies) {}
  
  initializeBackendSocket(sessionId: string): void {
    console.log('🔌 [BackendIntegration] initializeBackendSocket called:', {
      sessionId,
      isEnabled: this.deps.socketManager.isEnabled(),
    })
    
    if (!this.deps.socketManager.isEnabled()) {
      this.logDebug('[BackendIntegration] Backend transcript mode disabled, skipping socket init')
      return
    }

    this.deps.socketManager.connect(sessionId)
  }
  
  async relayTranscriptToBackend(
    sessionId: string,
    role: 'user' | 'assistant',
    text: string,
    isFinal: boolean,
    timestamp: number,
    timings?: TranscriptTimings,
    itemId?: string
  ): Promise<void> {
    if (!sessionId) {
      console.error('[BackendIntegration] ❌ Cannot relay - no sessionId!')
      return
    }

    this.logDebug('[BackendIntegration] 📤 Relaying transcript to backend:', {
      sessionId: sessionId.slice(-6),
      role,
      isFinal,
      textLength: text.length,
      preview: text.slice(0, 50),
      itemId: itemId?.slice(-8),
      timings,
    })

    try {
      const result = await api.relayTranscript(sessionId, {
        role,
        text,
        isFinal,
        timestamp,
        startedAt: timings?.startedAtMs ?? undefined,
        finalizedAt: timings?.finalizedAtMs ?? (isFinal ? timestamp : undefined),
        emittedAt: timings?.emittedAtMs ?? timestamp,
        itemId,
      })
      this.logDebug('[BackendIntegration] ✅ Relay successful:', result)
    } catch (error) {
      console.error('[BackendIntegration] ❌ Relay failed:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        sessionId,
      })
      throw error
    }
  }
  
  private logDebug(...args: unknown[]): void {
    if (this.deps.debugEnabled) {
      console.log(...args)
    }
  }
}
```

#### 2. Update ConversationController.ts

```typescript
// Add field
private backendIntegration: BackendIntegration

// Initialize in constructor
this.backendIntegration = new BackendIntegration({
  socketManager: this.socketManager,
  eventEmitter: this.eventEmitter,
  debugEnabled: this.debugEnabled,
})

// Delegate methods
private initializeBackendSocket(sessionId: string): void {
  this.backendIntegration.initializeBackendSocket(sessionId)
}

private async relayTranscriptToBackend(...args): Promise<void> {
  if (!this.sessionId) return
  await this.backendIntegration.relayTranscriptToBackend(this.sessionId, ...args)
}
```

### Benefits

- ✅ Removes ~150 lines from ConversationController
- ✅ Isolates backend-specific logic
- ✅ Easier to test relay failures
- ✅ Clear integration boundary

---

## Phase 6: Extract PublicAPI Facade

**Lines Extracted:** ~280 lines
**Target File:** `frontend/src/shared/facades/PublicAPI.ts`
**Time:** 1.5 hours

### Responsibilities

1. **Public Methods:** All public API methods (startVoice, stopVoice, sendText, etc.)
2. **Settings Setters:** Voice override, language, model settings
3. **Getters:** Session ID, status, mic stream, peer connection
4. **Lifecycle:** Dispose, cleanup delegation

### Current Code Location

- Lines 598-682: Public API methods (getSnapshot, setDebugEnabled, listeners, etc.) (~84 lines)
- Lines 684-708: Persona/Scenario/ExternalSession setters (~24 lines)
- Lines 710-717: EncounterState methods (~7 lines)
- Lines 719-756: Remote audio element methods (~37 lines)
- Lines 758-760: Getters (sessionId, status, etc.) (~2 lines each, ~20 total)
- Lines 840-874: startVoice() (~34 lines)
- Lines 934-937: stopVoice() (~3 lines)
- Lines 939-958: Mic pause methods (~19 lines)
- Lines 972-974: dispose() (~2 lines)
- Lines 976-1026: sendText() (~50 lines)
- Lines 1318-1341: Settings setters (~23 lines)

### Extraction Strategy

#### 1. Create PublicAPI.ts

```typescript
export class PublicAPI {
  constructor(private readonly controller: ConversationController) {}
  
  // Snapshot & Debug
  getSnapshot(): ConversationSnapshot {
    return buildConversationSnapshot({
      state: this.controller.stateManager,
      transcript: this.controller.transcriptCoordinator,
      audio: this.controller.audioManager,
      sessionId: this.controller.sessionId,
      debugEnabled: this.controller.debugEnabled,
      micPaused: this.controller.micPaused,
    })
  }
  
  isDebugEnabled(): boolean {
    return this.controller.eventEmitter.isDebugEnabled()
  }
  
  setDebugEnabled(enabled: boolean): void {
    // Implementation from current ConversationController
  }
  
  // Listeners
  addListener(listener: ConversationListener): () => void {
    // Implementation from current ConversationController
  }
  
  addDebugListener(listener: ConversationDebugListener): () => void {
    // Implementation from current ConversationController
  }
  
  // Session Management
  setPersonaId(personaId: string | null): void {
    // Implementation from current ConversationController
  }
  
  setScenarioId(scenarioId: string | null): void {
    // Implementation from current ConversationController
  }
  
  setExternalSessionId(sessionId: string | null): void {
    // Implementation from current ConversationController
  }
  
  // Voice Control
  async startVoice(): Promise<void> {
    // Implementation from current ConversationController
  }
  
  stopVoice(): void {
    // Implementation from current ConversationController
  }
  
  // Mic Control
  isMicPaused(): boolean {
    return this.controller.micControl.isMicPaused()
  }
  
  setMicPaused(paused: boolean): void {
    // Implementation from current ConversationController
  }
  
  // Text Input
  sendText(text: string): Promise<void> {
    // Implementation from current ConversationController
  }
  
  // Settings
  setVoiceOverride(v: string | null): void {
    this.controller.voiceConfig.setVoiceOverride(v)
  }
  
  setInputLanguage(l: PreferredString<'auto'>): void {
    this.controller.voiceConfig.setInputLanguage(l || 'auto')
  }
  
  // ... all other public methods
}
```

#### 2. Update ConversationController.ts

**Option A: Inherit from PublicAPI (cleaner)**
```typescript
export class ConversationController extends PublicAPI {
  constructor(config: ConversationControllerConfig = {}) {
    super() // Initialize facade
    // ... rest of constructor
  }
}
```

**Option B: Delegate to PublicAPI (more flexible)**
```typescript
export class ConversationController {
  private api: PublicAPI
  
  constructor(config: ConversationControllerConfig = {}) {
    // ... initialize all services
    this.api = new PublicAPI(this)
  }
  
  // Delegate all public methods
  getSnapshot(): ConversationSnapshot { return this.api.getSnapshot() }
  setDebugEnabled(enabled: boolean): void { this.api.setDebugEnabled(enabled) }
  // ... etc
}
```

**Recommendation:** Use Option B (delegation) to keep clear separation

### Benefits

- ✅ Removes ~280 lines from ConversationController
- ✅ Clear public API surface
- ✅ Easier to version/deprecate methods
- ✅ Testable without internal dependencies

---

## Final Architecture

### ConversationController.ts (~280 lines)

```typescript
export class ConversationController {
  // Field declarations (~80 lines)
  private sessionLifecycle: SessionLifecycleManager
  private voiceConfig: VoiceConfigurationManager
  private micControl: MicrophoneControlManager
  private connectionOrchestrator: ConnectionOrchestrator
  private eventDispatcher: EventDispatcher
  private connectionHandlers: ConnectionHandlers
  private backendIntegration: BackendIntegration
  private api: PublicAPI
  // ... service fields
  
  // Constructor (~150 lines)
  constructor(config: ConversationControllerConfig = {}) {
    // Initialize managers (40 lines)
    // Initialize services via registry (10 lines)
    // Initialize handlers (50 lines)
    // Initialize facade (10 lines)
  }
  
  // Private orchestration methods (~50 lines)
  private async attemptConnection(myOp: number): Promise<void>
  private createConnectionContext(myOp: number): ConnectionFlowContext
  private handleSessionReuse(reused: boolean): void
  private resetInitialAssistantGuards(): void
  private scheduleInitialAssistantRelease(trigger: string, delayMs?: number): void
  private releaseInitialAssistantAutoPause(trigger: string): void
  private startMeter(stream: MediaStream): void
  private resetTranscripts(): void
  private cleanup(): void
  
  // Public API delegation (~30 lines)
  getSnapshot(): ConversationSnapshot { return this.api.getSnapshot() }
  setDebugEnabled(enabled: boolean): void { this.api.setDebugEnabled(enabled) }
  // ... (1 line per method, ~30 methods)
}
```

---

## Migration Checklist

### Phase 2: EventDispatcher

- [ ] Create `frontend/src/shared/dispatchers/EventDispatcher.ts`
- [ ] Move `handleMessage()` logic to EventDispatcher
- [ ] Update ConversationController to delegate message handling
- [ ] Run TypeScript compilation (`npm run type-check`)
- [ ] Run unit tests (`npm test`)
- [ ] Verify frontend builds (`npm run build`)
- [ ] Test in dev environment (voice conversation flow)
- [ ] Document changes in PHASE2_COMPLETE.md

### Phase 3: ServiceRegistry

- [ ] Create `frontend/src/shared/registry/ServiceRegistry.ts`
- [ ] Move service initialization from constructor
- [ ] Update ConversationController to use registry
- [ ] Run TypeScript compilation
- [ ] Run unit tests
- [ ] Verify frontend builds
- [ ] Test in dev environment
- [ ] Document changes in PHASE3_COMPLETE.md

### Phase 4: ConnectionHandlers

- [ ] Create `frontend/src/shared/handlers/ConnectionHandlers.ts`
- [ ] Move WebRTC handler methods
- [ ] Update ConversationController to delegate
- [ ] Run TypeScript compilation
- [ ] Run unit tests
- [ ] Verify frontend builds
- [ ] Test WebRTC connection flow
- [ ] Document changes in PHASE4_COMPLETE.md

### Phase 5: BackendIntegration

- [ ] Create `frontend/src/shared/integration/BackendIntegration.ts`
- [ ] Move backend socket & relay logic
- [ ] Update ConversationController to delegate
- [ ] Run TypeScript compilation
- [ ] Run unit tests
- [ ] Verify frontend builds
- [ ] Test backend transcript relay
- [ ] Document changes in PHASE5_COMPLETE.md

### Phase 6: PublicAPI

- [ ] Create `frontend/src/shared/facades/PublicAPI.ts`
- [ ] Move all public methods to facade
- [ ] Update ConversationController to delegate
- [ ] Run TypeScript compilation
- [ ] Run unit tests
- [ ] Verify frontend builds
- [ ] Test public API methods
- [ ] Document changes in PHASE6_COMPLETE.md

---

## Success Metrics

### Line Count Targets

| File | Current | Target | Reduction |
|------|---------|--------|-----------|
| ConversationController.ts | 1341 | 280 | -79% |
| EventDispatcher.ts | 0 | 250 | +250 |
| ServiceRegistry.ts | 0 | 200 | +200 |
| ConnectionHandlers.ts | 0 | 180 | +180 |
| BackendIntegration.ts | 0 | 150 | +150 |
| PublicAPI.ts | 0 | 280 | +280 |
| **TOTAL** | **1341** | **1340** | **0%** |

### Code Quality Metrics

- ✅ **All modules ≤300 lines** (target met)
- ✅ **Single Responsibility Principle** (each module has one job)
- ✅ **Dependency Injection** (testable in isolation)
- ✅ **Clear Boundaries** (explicit interfaces between modules)
- ✅ **Zero Breaking Changes** (backward compatible)

### Testing Strategy

- **Unit Tests:** Each extracted module gets dedicated test file
- **Integration Tests:** Verify modules work together correctly
- **E2E Tests:** Existing viewer smoke tests must pass
- **Production Verification:** Console logs confirm functionality

---

## Timeline & Effort

| Phase | Module | Time | Complexity |
|-------|--------|------|------------|
| 2 | EventDispatcher | 2h | Medium |
| 3 | ServiceRegistry | 2.5h | High |
| 4 | ConnectionHandlers | 1.5h | Low |
| 5 | BackendIntegration | 1.5h | Low |
| 6 | PublicAPI | 1.5h | Medium |
| **TOTAL** | **All Modules** | **9h** | **Mixed** |

**Conservative Estimate:** 10-12 hours (includes buffer for unexpected issues)

---

## Next Steps

**Immediate Action:**

1. Review this plan with team/stakeholders
2. Choose phases to implement (can do incrementally)
3. Start with Phase 2 (EventDispatcher) as it's standalone

**Questions for User:**

1. Do you want to proceed with **all 5 phases** or start with Phase 2 only?
2. Prefer **sequential** (one phase at a time) or **parallel** (multiple phases simultaneously)?
3. Any concerns about specific extractions?

**Recommendation:**
Start with **Phase 2 (EventDispatcher)** as a proof-of-concept. If successful, proceed with Phase 3 (ServiceRegistry) which has the largest impact (removes 400+ lines from constructor).

---

## Appendix: Alternative Strategies

### Strategy A: Functional Decomposition (Current Plan)

- ✅ Extract by responsibility (routing, services, handlers, etc.)
- ✅ Clear module boundaries
- ✅ Easier to test
- ⚠️ More files to navigate

### Strategy B: Layer-Based Decomposition

- Extract by layer (presentation, business logic, data access)
- ❌ Less clear for this use case (not a traditional layered architecture)

### Strategy C: Feature-Based Decomposition

- Extract by feature (voice, transcripts, connection, etc.)
- ⚠️ Leads to circular dependencies (features interact heavily)

**Chosen:** Strategy A (Functional Decomposition) for clearest separation of concerns.
