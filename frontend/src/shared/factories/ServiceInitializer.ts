import type { ConversationControllerConfig } from '../../features/voice/conversation/types/config'
import type { MediaReference } from '../types'
import { ConversationEventEmitter } from '../services/ConversationEventEmitter'
import { ConversationStateManager } from '../services/ConversationStateManager'
import { AudioStreamManager } from '../services/AudioStreamManager'
import {
  BackendSocketManager,
  type BackendSocketClient,
  type SocketConfig,
  type SocketEventHandlers,
  type TranscriptData,
  type TranscriptErrorData,
  type CatchupData,
} from '../services/BackendSocketManager'
import { TranscriptCoordinator } from '../services/TranscriptCoordinator'
import { TranscriptEngine } from '../transcript/TranscriptEngine'
import { EndpointingManager } from '../endpointing/EndpointingManager'
import { WebRTCConnectionManager } from '../services/WebRTCConnectionManager'
import { SessionLifecycleManager } from '../managers/SessionLifecycleManager'
import { VoiceConfigurationManager } from '../managers/VoiceConfigurationManager'
import { MicrophoneControlManager } from '../managers/MicrophoneControlManager'
import { ConnectionOrchestrator } from '../managers/ConnectionOrchestrator'
import { TranscriptHandler } from '../handlers/TranscriptHandler'
import { ConnectionHandlers } from '../handlers/ConnectionHandlers'
import { EventDispatcher } from '../dispatchers/EventDispatcher'
import { DataChannelConfigurator } from '../configurators/DataChannelConfigurator'
import { BackendIntegration } from '../integration/BackendIntegration'
import {
  resolveAdaptiveVadDebug,
  resolveAdaptiveVadEnabled,
  resolveBargeIn,
  resolveDebug,
  resolveIceServers,
} from '../../features/voice/conversation/config/flags'
import {
  createInstructionSyncManager,
  type InstructionSyncManager,
} from '../../features/voice/conversation/instructions/instructionSync'
import {
  createSessionReadyManager,
  type SessionReadyManager,
} from '../../features/voice/conversation/connection/sessionReady'
import {
  createSessionReuseHandlers,
  type SessionReuseHandlers,
} from '../../features/voice/conversation/connection/reuseGuard'
import { createSpeechEventHandlers, type SpeechEventHandlers } from '../../features/voice/conversation/events/speechEvents'
import {
  createTranscriptionEventHandlers,
  type TranscriptionEventHandlers,
} from '../../features/voice/conversation/events/transcriptionEvents'
import {
  createAssistantStreamHandlers,
  type AssistantStreamHandlers,
} from '../../features/voice/conversation/events/assistantEvents'
import {
  createConversationItemHandlers,
  type ConversationItemHandlers,
} from '../../features/voice/conversation/events/conversationItemEvents'

/**
 * All services and managers created by ServiceInitializer
 * 
 * This interface defines the complete set of services that make up a ConversationController.
 * By centralizing initialization, we achieve:
 * - **Cleaner Constructor:** ConversationController constructor becomes simple delegation
 * - **Testability:** Can mock entire service set or individual services
 * - **Maintainability:** All initialization logic in one place
 * - **Clarity:** Explicit declaration of all dependencies
 */
export interface ConversationServices {
  // Core managers
  sessionLifecycle: SessionLifecycleManager
  voiceConfig: VoiceConfigurationManager
  micControl: MicrophoneControlManager
  connectionOrchestrator: ConnectionOrchestrator
  
  // Configuration
  remoteAudioElement: HTMLAudioElement | null
  debugEnabled: boolean
  bargeInEnabled: boolean
  iceServers: RTCIceServer[] | undefined
  backendTranscriptMode: boolean
  scenarioMedia: MediaReference[]
  
  // Core services
  transcriptCoordinator: TranscriptCoordinator
  transcriptEngine: TranscriptEngine
  endpointing: EndpointingManager
  eventEmitter: ConversationEventEmitter
  stateManager: ConversationStateManager
  audioManager: AudioStreamManager
  socketManager: BackendSocketClient
  webrtcManager: WebRTCConnectionManager
  
  // Handlers and integration
  connectionHandlers: ConnectionHandlers
  backendIntegration: BackendIntegration
  transcriptHandler: TranscriptHandler
  eventDispatcher: EventDispatcher
  
  // Managers
  instructionSyncManager: InstructionSyncManager
  sessionReadyManager: SessionReadyManager
  sessionReuseHandlers: SessionReuseHandlers
  
  // Event handlers
  speechHandlers: SpeechEventHandlers
  transcriptionHandlers: TranscriptionEventHandlers
  assistantHandlers: AssistantStreamHandlers
  conversationItemHandlers: ConversationItemHandlers
  
  // Mutable state fields
  pingInterval: ReturnType<typeof setInterval> | null
  sessionAckTimeout: ReturnType<typeof setTimeout> | null
  sessionReused: boolean
  dropNextAssistantResponse: boolean
  initialAssistantAutoPauseActive: boolean
  initialAssistantGuardUsed: boolean
  userHasSpoken: boolean
  remoteVolumeBeforeGuard: number | null
  lastRelayedItemId: string | null
}

/**
 * Callbacks required by ServiceInitializer
 * 
 * These are the "this" method references that services need to call back to the controller.
 * By using dependency injection, we keep ServiceInitializer testable and decoupled.
 */
export interface ServiceInitializerCallbacks {
  attemptConnection: (op: number) => Promise<void>
  cleanup: () => void
  handleMessage: (data: string) => void
  handleUserTranscript: (text: string, isFinal: boolean, timings: any) => void
  handleAssistantTranscript: (text: string, isFinal: boolean, timings: any) => void
  refreshInstructions: (reason?: string, options?: any) => Promise<void>
  ensureSessionAckTimeout: () => void
  drainPendingInstructionSync: (trigger: string) => void
  markSessionReady: (trigger: string) => void
  setAutoMicPaused: (reason: string, paused: boolean) => void
  releaseInitialAssistantAutoPause: (reason: string) => void
  scheduleInitialAssistantRelease: (reason: string, delayMs?: number) => void
  logDebug: (...args: unknown[]) => void
  
  // Getters for mutable state
  getPingInterval: () => ReturnType<typeof setInterval> | null
  getSessionAckTimeout: () => ReturnType<typeof setTimeout> | null
  getSessionReused: () => boolean
  getDropNextAssistantResponse: () => boolean
  getInitialAssistantAutoPauseActive: () => boolean
  getInitialAssistantGuardUsed: () => boolean
  getUserHasSpoken: () => boolean
  getRemoteVolumeBeforeGuard: () => number | null
  getRemoteAudioElement: () => HTMLAudioElement | null
  getLastRelayedItemId: () => string | null
  
  // Setters for mutable state
  setPingInterval: (value: ReturnType<typeof setInterval> | null) => void
  setSessionAckTimeout: (value: ReturnType<typeof setTimeout> | null) => void
  setSessionReused: (value: boolean) => void
  setDropNextAssistantResponse: (value: boolean) => void
  setInitialAssistantAutoPauseActive: (value: boolean) => void
  setInitialAssistantGuardUsed: (value: boolean) => void
  setUserHasSpoken: (value: boolean) => void
  setRemoteVolumeBeforeGuard: (value: number | null) => void
  setLastRelayedItemId: (value: string | null) => void
}

/**
 * ServiceInitializer - Centralized service initialization for ConversationController
 * 
 * This class handles all the complex initialization logic that was previously in the
 * ConversationController constructor (411 lines). By extracting this into a dedicated
 * initializer, we achieve:
 * 
 * **Benefits:**
 * - ✅ **Reduced Constructor Size:** ConversationController constructor becomes ~20 lines
 * - ✅ **Single Responsibility:** ServiceInitializer ONLY handles initialization
 * - ✅ **Testability:** Can test initialization logic in isolation
 * - ✅ **Maintainability:** All wiring logic in one place
 * - ✅ **Clarity:** Clear separation between initialization and behavior
 * 
 * **Responsibilities:**
 * - Initialize all managers (session, voice, mic, connection)
 * - Configure all services (events, state, audio, socket, WebRTC)
 * - Set up all handlers (transcript, connection, speech, assistant)
 * - Wire all callbacks and dependencies
 * - Return complete service set
 * 
 * **Architecture:**
 * ```
 * ConversationController
 *     ↓ (delegates initialization)
 * ServiceInitializer.initialize(config, callbacks)
 *     ↓ (creates all services)
 * ConversationServices (complete service set)
 *     ↓ (assigned to controller)
 * ConversationController (ready to use)
 * ```
 * 
 * **Usage Example:**
 * ```typescript
 * // In ConversationController constructor:
 * const services = ServiceInitializer.initialize(config, {
 *   attemptConnection: op => this.attemptConnection(op),
 *   cleanup: () => this.cleanup(),
 *   // ... other callbacks
 * })
 * 
 * // Assign all services
 * Object.assign(this, services)
 * ```
 * 
 * **Why This Exists:**
 * - **Constructor Too Large:** Original 411-line constructor was 36% of entire file
 * - **Difficult to Test:** Initialization mixed with behavior
 * - **Hard to Maintain:** Changes required scrolling through 400+ lines
 * - **Violates SRP:** Constructor should delegate, not implement
 */
export class ServiceInitializer {
  /**
   * Initialize all services for ConversationController
   * 
   * This is the main entry point for service initialization. It creates all managers,
   * services, handlers, and event processors, wires them together with callbacks,
   * and returns a complete set of initialized services.
   * 
   * @param config - Configuration from ConversationController constructor
   * @param callbacks - Controller method references for callbacks
   * @returns Complete set of initialized services
   * 
   * @example
   * ```typescript
   * const services = ServiceInitializer.initialize(config, {
   *   attemptConnection: op => this.attemptConnection(op),
   *   cleanup: () => this.cleanup(),
   *   handleMessage: data => this.handleMessage(data),
   *   // ... other callbacks
   * })
   * ```
   */
  static initialize(
    config: ConversationControllerConfig,
    callbacks: ServiceInitializerCallbacks
  ): ConversationServices {
    // Phase 1: Initialize managers
    const sessionLifecycle = new SessionLifecycleManager({
      personaId: config.personaId,
      scenarioId: config.scenarioId,
      sessionId: config.sessionId,
    })

    const voiceConfig = new VoiceConfigurationManager({
      voiceOverride: config.voiceOverride,
      inputLanguage: config.inputLanguage,
      replyLanguage: config.replyLanguage,
      model: config.model,
      transcriptionModel: config.transcriptionModel,
    })

    // Initialize state manager first (needed by many other services)
    const stateManager = new ConversationStateManager()
    
    // Initialize event emitter
    const debugEnabled = config.debugEnabled ?? resolveDebug()
    const eventEmitter = new ConversationEventEmitter(debugEnabled)

    const micControl = new MicrophoneControlManager({
      callbacks: {
        onMicPauseChange: (paused, source, reason) => {
          const msg = paused
            ? source === 'user'
              ? 'paused'
              : 'paused.auto'
            : source === 'user'
              ? 'resumed'
              : 'resumed.auto'

          eventEmitter.emitDebug({
            t: new Date().toISOString(),
            kind: 'info',
            src: 'mic',
            msg,
            data: reason ? { reason } : undefined,
          })

          eventEmitter.emit({ type: 'pause', paused })
        },
        onMicLevelZero: () => {
          eventEmitter.emit({ type: 'mic-level', level: 0 })
        },
      },
    })

    const connectionOrchestrator = new ConnectionOrchestrator({
      maxRetries: 3,
      callbacks: {
        onStart: async op => {
          await callbacks.attemptConnection(op)
        },
        onCleanup: () => {
          callbacks.cleanup()
        },
        onStatusUpdate: (status, error) => {
          stateManager.updateStatus(status, error)
        },
      },
    })

    // Phase 2: Extract configuration
    const remoteAudioElement = config.remoteAudioElement ?? null
    const bargeInEnabled = config.bargeInEnabled ?? resolveBargeIn()
    const iceServers = config.iceServers ?? resolveIceServers()
    const backendTranscriptMode = Boolean(config.backendTranscriptMode)
    const scenarioMedia = config.scenarioMedia ?? []

    // Configure STT timeouts
    const defaultFallback = 800
    const defaultExtended = Math.max(defaultFallback + 700, 2500)
    const sttFallbackMs =
      Number.isFinite(config.sttFallbackMs as any) && (config.sttFallbackMs as number) >= 0
        ? (config.sttFallbackMs as number)
        : defaultFallback
    const sttExtendedMs =
      Number.isFinite(config.sttExtendedMs as any) && (config.sttExtendedMs as number) >= 0
        ? (config.sttExtendedMs as number)
        : defaultExtended

    // Phase 3: Initialize core services
    const transcriptCoordinator = new TranscriptCoordinator(
      {
        onUserTranscript: (text, isFinal, timings) => callbacks.handleUserTranscript(text, isFinal, timings),
        onAssistantTranscript: (text, isFinal, timings) => callbacks.handleAssistantTranscript(text, isFinal, timings),
      },
      bargeInEnabled
    )
    transcriptCoordinator.setScenarioMedia(scenarioMedia as any)
    const transcriptEngine = transcriptCoordinator.getEngine()

    const endpointing = new EndpointingManager({
      sttFallbackMs,
      sttExtendedMs,
      adaptiveEnabled: resolveAdaptiveVadEnabled(),
      adaptiveDebug: resolveAdaptiveVadDebug(),
    })

    // Register status change listener
    stateManager.onStatusChange((status, error) => {
      eventEmitter.emit({ type: 'status', status, error })
    })

    // Register session change listener
    sessionLifecycle.onSessionChange((sessionId) => {
      eventEmitter.emit({ type: 'session', sessionId })
    })

    const audioManager = new AudioStreamManager()
    audioManager.attachRemoteAudioElement(remoteAudioElement)

    // Phase 4: Initialize backend socket with handlers
    const socketHandlers: SocketEventHandlers = {
      onConnect: (sessionId: string) => {
        callbacks.logDebug('[BackendSocket] Connected to session:', sessionId)
      },
      onDisconnect: (reason: string) => {
        callbacks.logDebug('[BackendSocket] Disconnected:', reason)
      },
      onTranscript: (data: TranscriptData) => {
        if (!backendTranscriptMode) {
          console.warn('⚠️ [ConversationController] backendTranscriptMode is disabled, ignoring transcript')
          return
        }

        const emittedAtMs = typeof data.emittedAtMs === 'number' ? data.emittedAtMs : data.timestamp
        const finalizedAtMs =
          typeof data.finalizedAtMs === 'number' ? data.finalizedAtMs : data.isFinal ? data.timestamp : undefined
        const startedAtMs = typeof data.startedAtMs === 'number' ? data.startedAtMs : null
        const eventTimestamp = finalizedAtMs ?? emittedAtMs

        const { cleanText, media } =
          data.role === 'assistant'
            ? transcriptCoordinator.parseMediaMarker(data.text)
            : { cleanText: data.text, media: undefined }

        eventEmitter.emit({
          type: 'transcript',
          role: data.role,
          text: cleanText,
          isFinal: data.isFinal,
          timestamp: eventTimestamp,
          media: media ?? data.media,
          timings: {
            startedAtMs,
            emittedAtMs,
            finalizedAtMs,
          },
        })
      },
      onTranscriptError: (data: TranscriptErrorData) => {
        console.error('[BackendSocket] Transcript error:', data)
      },
      onReconnect: (lastTimestamp: number) => {
        callbacks.logDebug('[BackendSocket] Reconnected, last timestamp:', lastTimestamp)
      },
      onCatchup: (data: CatchupData) => {
        callbacks.logDebug('[BackendSocket] Caught up', data.transcripts.length, 'transcripts')
        data.transcripts.forEach(t => {
          const emittedAtMs = typeof t.emittedAtMs === 'number' ? t.emittedAtMs : t.timestamp
          const finalizedAtMs =
            typeof t.finalizedAtMs === 'number' ? t.finalizedAtMs : t.isFinal ? t.timestamp : undefined
          const startedAtMs = typeof t.startedAtMs === 'number' ? t.startedAtMs : null
          const eventTimestamp = finalizedAtMs ?? emittedAtMs
          eventEmitter.emit({
            type: 'transcript',
            role: t.role,
            text: t.text,
            isFinal: t.isFinal,
            timestamp: eventTimestamp,
            timings: {
              startedAtMs,
              emittedAtMs,
              finalizedAtMs,
            },
          })
        })
      },
      onFailure: (label: string, error: unknown, failureCount: number) => {
        console.error('[BackendSocket] Failure:', label, error, 'count:', failureCount)
      },
      onMaxFailures: (failureCount: number) => {
        console.error('[BackendSocket] Max failures reached:', failureCount)
      },
    }

    const socketConfig: SocketConfig = {
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
      maxFailures: 3,
      enabled: backendTranscriptMode,
    }

    const socketManager: BackendSocketClient = config.socketFactory
      ? config.socketFactory({ config: socketConfig, handlers: socketHandlers })
      : (() => {
          if (import.meta.env.DEV) {
            console.warn('[ServiceInitializer] Falling back to BackendSocketManager. Prefer providing a socketFactory (e.g., via useVoiceSession) to use the React hook-based socket.');
          }
          return new BackendSocketManager(socketConfig, socketHandlers)
        })()

    // Phase 5: Initialize WebRTC and connection handlers
    const webrtcManager = new WebRTCConnectionManager()

    const connectionHandlers = new ConnectionHandlers({
      eventEmitter,
      stateManager,
      webrtcManager,
    })

    webrtcManager.setConnectionStateCallbacks({
      onIceConnectionStateChange: state => connectionHandlers.handleIceConnectionStateChange(state),
      onConnectionStateChange: state => connectionHandlers.handleConnectionStateChange(state),
      onRemoteStream: stream => audioManager.handleRemoteStream(stream),
    })

    // Configure data channel callbacks
    const dataChannelConfigurator = new DataChannelConfigurator({
      eventEmitter,
      pingInterval: callbacks.getPingInterval() as number | null,
      setPingInterval: interval => callbacks.setPingInterval(interval as ReturnType<typeof setInterval> | null),
      refreshInstructions: reason => callbacks.refreshInstructions(reason),
      ensureSessionAckTimeout: () => callbacks.ensureSessionAckTimeout(),
      handleMessage: data => callbacks.handleMessage(data),
      logDebug: (...args) => callbacks.logDebug(...args),
    })

    webrtcManager.setDataChannelCallbacks(dataChannelConfigurator.createDataChannelCallbacks())

    // Phase 6: Initialize managers
    const instructionSyncManager = createInstructionSyncManager({
      stateManager,
      getSessionId: () => sessionLifecycle.getSessionId(),
      getActiveChannel: () => webrtcManager.getActiveChannel(),
      isActiveChannelOpen: () => webrtcManager.isActiveChannelOpen(),
      emit: event => eventEmitter.emit(event),
      emitDebug: event => eventEmitter.emitDebug(event),
    })

    const sessionReadyManager = createSessionReadyManager({
      getSessionAckTimeout: () => callbacks.getSessionAckTimeout(),
      setSessionAckTimeout: timer => callbacks.setSessionAckTimeout(timer),
      stateManager,
      webrtcManager,
      emit: event => eventEmitter.emit(event),
      emitDebug: event => eventEmitter.emitDebug(event),
      drainPendingInstructionSync: trigger => callbacks.drainPendingInstructionSync(trigger),
    })

    const sessionReuseHandlers = createSessionReuseHandlers({
      getSessionReused: () => callbacks.getSessionReused(),
      setSessionReused: value => callbacks.setSessionReused(value),
      getDropNextAssistantResponse: () => callbacks.getDropNextAssistantResponse(),
      setDropNextAssistantResponse: value => callbacks.setDropNextAssistantResponse(value),
      getInitialAssistantAutoPauseActive: () => micControl.getInitialAssistantAutoPauseActive(),
      setInitialAssistantAutoPauseActive: value => micControl.setInitialAssistantAutoPauseActive(value),
      getInitialAssistantGuardUsed: () => micControl.getInitialAssistantGuardUsed(),
      setInitialAssistantGuardUsed: value => micControl.setInitialAssistantGuardUsed(value),
      getUserHasSpoken: () => callbacks.getUserHasSpoken(),
      setUserHasSpoken: value => callbacks.setUserHasSpoken(value),
      getRemoteAudioElement: () => callbacks.getRemoteAudioElement(),
      getRemoteVolumeBeforeGuard: () => micControl.getRemoteVolumeBeforeGuard(),
      setRemoteVolumeBeforeGuard: value => micControl.setRemoteVolumeBeforeGuard(value),
      getInitialAssistantReleaseTimer: () => micControl.getInitialAssistantReleaseTimer(),
      setInitialAssistantReleaseTimer: timer => micControl.setInitialAssistantReleaseTimer(timer),
      hasAutoMicPauseReason: reason => micControl.hasAutoMicPauseReason(reason),
      setAutoMicPaused: (reason, paused) => callbacks.setAutoMicPaused(reason, paused),
      emitDebug: event => eventEmitter.emitDebug(event),
    })

    // Phase 7: Initialize event handlers
    const speechHandlers = createSpeechEventHandlers({
      logDebug: (...args) => callbacks.logDebug(...args),
      endpointing,
      transcriptEngine,
      sessionReuse: {
        getUserHasSpoken: () => callbacks.getUserHasSpoken(),
        setUserHasSpoken: value => callbacks.setUserHasSpoken(value),
        getInitialAssistantAutoPauseActive: () => micControl.getInitialAssistantAutoPauseActive(),
        releaseInitialAssistantAutoPause: reason => callbacks.releaseInitialAssistantAutoPause(reason),
        getDropNextAssistantResponse: () => callbacks.getDropNextAssistantResponse(),
        setDropNextAssistantResponse: value => callbacks.setDropNextAssistantResponse(value),
      },
      emit: event => eventEmitter.emit(event),
    })

    // Initialize backend integration first (needed by transcription handlers)
    const backendIntegration = new BackendIntegration({
      socketManager,
      getSessionId: () => sessionLifecycle.getSessionId(),
      isBackendMode: () => backendTranscriptMode,
      logDebug: (...args) => callbacks.logDebug(...args),
    })

    const transcriptionHandlers = createTranscriptionEventHandlers({
      logDebug: (...args) => callbacks.logDebug(...args),
      backendTranscriptMode,
      endpointing,
      transcriptEngine,
      transcriptCoordinator,
      relay: {
        getLastRelayedItemId: () => callbacks.getLastRelayedItemId(),
        setLastRelayedItemId: id => callbacks.setLastRelayedItemId(id),
        relayTranscriptToBackend: (role, text, isFinal, timestamp, timings, itemId) =>
          backendIntegration.relayTranscriptToBackend(role, text, isFinal, timestamp, timings as any, itemId),
      },
      emit: event => eventEmitter.emit(event),
    })

    const assistantHandlers = createAssistantStreamHandlers({
      logDebug: (...args) => callbacks.logDebug(...args),
      sessionReuse: {
        getDropNextAssistantResponse: () => callbacks.getDropNextAssistantResponse(),
        setDropNextAssistantResponse: value => callbacks.setDropNextAssistantResponse(value),
        getSessionReused: () => callbacks.getSessionReused(),
        getUserHasSpoken: () => callbacks.getUserHasSpoken(),
        getInitialAssistantGuardUsed: () => callbacks.getInitialAssistantGuardUsed(),
        setInitialAssistantGuardUsed: value => callbacks.setInitialAssistantGuardUsed(value),
        getInitialAssistantAutoPauseActive: () => callbacks.getInitialAssistantAutoPauseActive(),
        setInitialAssistantAutoPauseActive: value => callbacks.setInitialAssistantAutoPauseActive(value),
        releaseInitialAssistantAutoPause: reason => callbacks.releaseInitialAssistantAutoPause(reason),
        scheduleInitialAssistantRelease: reason => callbacks.scheduleInitialAssistantRelease(reason),
        setAutoMicPaused: (reason, paused) => callbacks.setAutoMicPaused(reason, paused),
        getRemoteAudioElement: () => callbacks.getRemoteAudioElement(),
        getRemoteVolumeBeforeGuard: () => callbacks.getRemoteVolumeBeforeGuard(),
        setRemoteVolumeBeforeGuard: value => callbacks.setRemoteVolumeBeforeGuard(value),
      },
      endpointing,
      transcriptEngine,
      transcriptCoordinator,
      emitDebug: event => eventEmitter.emitDebug(event),
    })

    const conversationItemHandlers = createConversationItemHandlers({
      endpointing,
      transcriptEngine,
      transcriptCoordinator,
      relay: {
        getLastRelayedItemId: () => callbacks.getLastRelayedItemId(),
        setLastRelayedItemId: id => callbacks.setLastRelayedItemId(id),
      },
      emit: event => eventEmitter.emit(event),
    })

    // Phase 8: Initialize handlers that depend on backend integration
    const transcriptHandler = new TranscriptHandler({
      transcriptCoordinator,
      eventEmitter,
      logDebug: (...args) => callbacks.logDebug(...args),
      relayTranscriptToBackend: (role, text, isFinal, timestamp, timings) =>
        backendIntegration.relayTranscriptToBackend(role, text, isFinal, timestamp, timings),
      isBackendMode: () => backendTranscriptMode,
    })

    const eventDispatcher = new EventDispatcher({
      speechHandlers,
      transcriptionHandlers,
      assistantHandlers,
      conversationItemHandlers,
      sessionHandlers: {
        logDebug: (...args) => callbacks.logDebug(...args),
        stateManager,
        ensureSessionAckTimeout: () => callbacks.ensureSessionAckTimeout(),
        refreshInstructions: reason => callbacks.refreshInstructions(reason),
        getActiveChannel: () => webrtcManager.getActiveChannel(),
        isActiveChannelOpen: () => webrtcManager.isActiveChannelOpen(),
        markSessionReady: trigger => callbacks.markSessionReady(trigger),
      },
      eventEmitter,
      webrtcManager,
      debugEnabled,
      onRealtimeEvent: null, // Will be set later by controller
    })

    // Return all initialized services
    return {
      // Managers
      sessionLifecycle,
      voiceConfig,
      micControl,
      connectionOrchestrator,
      
      // Configuration
      remoteAudioElement,
      debugEnabled,
      bargeInEnabled,
      iceServers,
      backendTranscriptMode,
      scenarioMedia,
      
      // Core services
      transcriptCoordinator,
      transcriptEngine,
      endpointing,
      eventEmitter,
      stateManager,
      audioManager,
      socketManager,
      webrtcManager,
      
      // Handlers and integration
      connectionHandlers,
      backendIntegration,
      transcriptHandler,
      eventDispatcher,
      
      // Managers
      instructionSyncManager,
      sessionReadyManager,
      sessionReuseHandlers,
      
      // Event handlers
      speechHandlers,
      transcriptionHandlers,
      assistantHandlers,
      conversationItemHandlers,
      
      // Mutable state fields (initialized to default values)
      pingInterval: null,
      sessionAckTimeout: null,
      sessionReused: false,
      dropNextAssistantResponse: false,
      initialAssistantAutoPauseActive: false,
      initialAssistantGuardUsed: false,
      userHasSpoken: false,
      remoteVolumeBeforeGuard: null,
      lastRelayedItemId: null,
    }
  }
}
