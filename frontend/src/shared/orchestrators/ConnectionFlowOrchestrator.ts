/**
 * ConnectionFlowOrchestrator
 * 
 * Builds the complete ConnectionFlowContext for the connection flow.
 * This orchestrator centralizes all context creation logic, making it easier
 * to test and maintain the complex object passed to runConnectionAttempt.
 * 
 * Previously this ~100 line method was embedded directly in ConversationController,
 * making it difficult to test and understand.
 */

import type { ConnectionFlowContext } from '../realtime/runConnectionFlow'
import type { SessionLifecycleManager } from '../managers/SessionLifecycleManager'
import type { VoiceConfigurationManager } from '../managers/VoiceConfigurationManager'
import type { ConnectionOrchestrator } from '../managers/ConnectionOrchestrator'
import type { AudioStreamManager } from '../services/AudioStreamManager'
import type { WebRTCConnectionManager } from '../services/WebRTCConnectionManager'
import type { ConversationEventEmitter } from '../services/ConversationEventEmitter'
import type { ConversationStateManager } from '../services/ConversationStateManager'
import type { BackendIntegration } from '../integration/BackendIntegration'
import type { ConnectionHandlers } from '../handlers/ConnectionHandlers'
import type { TranscriptCoordinator } from '../services/TranscriptCoordinator'
import type { RealtimeTransport } from '../transport/RealtimeTransport'
import { api } from '../api'

/**
 * Dependencies required to build ConnectionFlowContext
 */
export interface ConnectionFlowOrchestratorDeps {
  // Managers
  sessionLifecycle: SessionLifecycleManager
  voiceConfig: VoiceConfigurationManager
  connectionOrchestrator: ConnectionOrchestrator
  
  // Services
  audioManager: AudioStreamManager
  webrtcManager: WebRTCConnectionManager
  eventEmitter: ConversationEventEmitter
  stateManager: ConversationStateManager
  transcriptCoordinator: TranscriptCoordinator
  
  // Integration & Handlers
  backendIntegration: BackendIntegration
  connectionHandlers: ConnectionHandlers
  
  // Config
  iceServers?: RTCIceServer[]
  backendTranscriptMode: boolean
  
  // Mutable state
  getTransport: () => RealtimeTransport | null
  setTransport: (transport: RealtimeTransport | null) => void
  getConnectStartMs: () => number
  setConnectStartMs: (ms: number) => void
  
  // Controller method references
  attachDataChannelHandlers: (channel: RTCDataChannel) => void
  cleanup: () => void
  isOpStale: (op: number) => boolean
  attemptConnection: (op: number) => Promise<void>
  handleSessionReuse: (reused: boolean) => void
  startMeter: (stream: MediaStream) => void
}

/**
 * Orchestrates creation of ConnectionFlowContext with all necessary dependencies
 */
export class ConnectionFlowOrchestrator {
  constructor(private deps: ConnectionFlowOrchestratorDeps) {}

  /**
   * Builds complete ConnectionFlowContext for the given operation number.
   * This context contains all state accessors, callbacks, and configuration
   * needed by the connection flow logic.
   */
  createContext(_myOp: number): ConnectionFlowContext {
    const {
      sessionLifecycle,
      voiceConfig,
      connectionOrchestrator,
      audioManager,
      webrtcManager,
      eventEmitter,
      stateManager,
      backendIntegration,
      connectionHandlers,
      iceServers,
      backendTranscriptMode,
      getTransport,
      setTransport,
      getConnectStartMs,
      setConnectStartMs,
      attachDataChannelHandlers,
      cleanup,
      isOpStale,
      attemptConnection,
      handleSessionReuse,
      startMeter,
    } = this.deps

    return {
      // Configuration
      iceServers,
      backendTranscriptMode,
      maxRetries: connectionOrchestrator.getMaxRetries(),
      
      // Retry count management
      getConnectRetryCount: () => connectionOrchestrator.getConnectRetryCount(),
      setConnectRetryCount: value => {
        connectionOrchestrator.setConnectRetryCount(value)
      },
      
      // Session ID management
      getSessionId: () => sessionLifecycle.getSessionId(),
      setSessionId: id => {
        sessionLifecycle.setSessionId(id)
      },
      getExternalSessionId: () => sessionLifecycle.getExternalSessionId(),
      
      // Mic stream management
      getMicStream: () => audioManager.getMicStream(),
      setMicStream: stream => {
        audioManager.setMicStream(stream)
      },
      
      // Transport management
      getTransport,
      setTransport,
      
      // WebRTC connection management
      getPeerConnection: () => webrtcManager.getPeerConnection(),
      setPeerConnection: pc => {
        webrtcManager.setPeerConnection(pc)
      },
      
      // Data channel management
      setServerChannel: channel => {
        webrtcManager.setServerChannel(channel)
      },
      setClientChannel: channel => {
        webrtcManager.setClientChannel(channel)
      },
      attachDataChannelHandlers,
      
      // Connection timing
      getConnectStartMs,
      setConnectStartMs,
      
      // Backend integration
      initializeBackendSocket: sessionId => backendIntegration.initializeBackendSocket(sessionId),
      
      // Event emission
      updateStatus: (status, error) => stateManager.updateStatus(status, error),
      emit: event => eventEmitter.emit(event),
      emitDebug: event => eventEmitter.emitDebug(event),
      
      // Audio & monitoring
      startMeter,
      handleRemoteStream: remoteStream => audioManager.handleRemoteStream(remoteStream),
      
      // Connection handlers
      handleIceConnectionStateChange: state => connectionHandlers.handleIceConnectionStateChange(state),
      handleConnectionStateChange: state => connectionHandlers.handleConnectionStateChange(state),
      logTransport: entry => connectionHandlers.logTransport(entry),
      
      // Session creation
      createSessionWithLogging: () => this.createSessionWithLogging(),
      
      // Cleanup & lifecycle
      cleanup,
      isOpStale,
      scheduleRetry: (delayMs: number) => {
        setTimeout(() => {
          void attemptConnection(_myOp)
        }, delayMs)
      },
      
      // Session reuse handling
      handleSessionReuse,
      
      // Voice configuration (spread session config from VoiceConfigurationManager)
      ...voiceConfig.buildSessionConfig(),
    }
  }

  /**
   * Creates a new session via API with debug logging
   */
  private async createSessionWithLogging(): Promise<{ session_id: string; reused: boolean }> {
    const { sessionLifecycle, eventEmitter } = this.deps
    
    eventEmitter.emitDebug({ 
      t: new Date().toISOString(), 
      kind: 'info', 
      src: 'api', 
      msg: 'creating session' 
    })
    
    const personaId = sessionLifecycle.getPersonaId()
    const scenarioId = sessionLifecycle.getScenarioId()
    
    if (!personaId) throw new Error('personaId is required before creating a session')
    if (!scenarioId) throw new Error('scenarioId is required before creating a session')
    
    const created = await api.createSession(personaId, scenarioId)
    return { session_id: created.session_id, reused: false }
  }
}
