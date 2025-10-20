import type { RealtimeTransport } from './transport/RealtimeTransport'
import type {
  ConversationControllerConfig,
  InstructionRefreshOptions,
  PreferredString,
} from '../features/voice/conversation/types/config'
import type { TranscriptTimings } from '../features/voice/conversation/types/transcript'
import { safeInvoke } from '../features/voice/conversation/config/safeInvoke'
import { buildSnapshot as buildConversationSnapshot } from '../features/voice/conversation/state/snapshot'
import type { ConversationSnapshotData } from '../features/voice/conversation/state/snapshot'
import { EndpointingManager } from './endpointing/EndpointingManager'
import type { ConnectionFlowContext } from './realtime/runConnectionFlow'
import { attemptConnection as runConnectionAttempt } from '../features/voice/conversation/connection/connectionFlow'
import { type SessionReadyManager } from '../features/voice/conversation/connection/sessionReady'
import { type SessionReuseHandlers } from '../features/voice/conversation/connection/reuseGuard'
import { type InstructionSyncManager } from '../features/voice/conversation/instructions/instructionSync'

// Service imports
import { ConversationEventEmitter } from './services/ConversationEventEmitter'
import { ConversationStateManager } from './services/ConversationStateManager'
import { AudioStreamManager } from './services/AudioStreamManager'
import type { BackendSocketClient } from './types/backendSocket'
import { TranscriptCoordinator } from './services/TranscriptCoordinator'

// Handler imports
import { TranscriptHandler } from './handlers/TranscriptHandler'
import { ConnectionHandlers } from './handlers/ConnectionHandlers'

// Dispatcher imports
import { EventDispatcher } from './dispatchers/EventDispatcher'

// Integration imports
import { BackendIntegration } from './integration/BackendIntegration'

// Factory imports
import { ServiceInitializer, type ServiceInitializerCallbacks } from './factories/ServiceInitializer'

// Orchestrator imports
import { ConnectionFlowOrchestrator } from './orchestrators/ConnectionFlowOrchestrator'

// Coordinator imports
import { StateCoordinator } from './coordinators/StateCoordinator'

import type {
  VoiceStatus,
  ConversationListener,
  ConversationDebugListener,
  MediaReference,
} from './types'
import { WebRTCConnectionManager } from './services/WebRTCConnectionManager'
import { SessionLifecycleManager } from './managers/SessionLifecycleManager'
import { VoiceConfigurationManager } from './managers/VoiceConfigurationManager'
import { MicrophoneControlManager } from './managers/MicrophoneControlManager'
import { ConnectionOrchestrator } from './managers/ConnectionOrchestrator'
import { voiceDebug } from './utils/voiceLogging'

export type {
  ConversationControllerConfig,
  InstructionRefreshOptions,
  PreferredString,
} from '../features/voice/conversation/types/config'
export { TranscriptRole } from '../features/voice/conversation/types/transcript'
export type { TranscriptTimings } from '../features/voice/conversation/types/transcript'

export type ConversationSnapshot = ConversationSnapshotData

export class ConversationController {
  private sessionLifecycle!: SessionLifecycleManager
  // Legacy fields - delegate to sessionLifecycle
  private get sessionId(): string | null { return this.sessionLifecycle.getSessionId() }
  private set sessionId(value: string | null) { this.sessionLifecycle.setSessionId(value) }
  private get personaId(): string | null { return this.sessionLifecycle.getPersonaId() }
  private set personaId(value: string | null) { this.sessionLifecycle.setPersonaId(value) }
  private get scenarioId(): string | null { return this.sessionLifecycle.getScenarioId() }
  private set scenarioId(value: string | null) { this.sessionLifecycle.setScenarioId(value) }
  private get externalSessionId(): string | null { return this.sessionLifecycle.getExternalSessionId() }
  private set externalSessionId(value: string | null) { this.sessionLifecycle.setExternalSessionId(value) }

  private remoteAudioElement!: HTMLAudioElement | null
  private debugEnabled!: boolean
  private readonly iceServers?: RTCIceServer[]

  private transport: RealtimeTransport | null = null
  private pingInterval: ReturnType<typeof setInterval> | null = null

  private connectionOrchestrator!: ConnectionOrchestrator

  private readonly endpointing!: EndpointingManager
  private lastRelayedItemId: string | null = null // Track item_id to prevent duplicate relays

  private logDebug(...args: unknown[]): void {
    if (this.debugEnabled) {
      voiceDebug(...args)
    }
  }

  private voiceConfig!: VoiceConfigurationManager
  // Legacy fields - delegate to voiceConfig
  private get voiceOverride(): string | null { return this.voiceConfig.getVoiceOverride() }
  private set voiceOverride(value: string | null) { this.voiceConfig.setVoiceOverride(value) }
  private get inputLanguage(): PreferredString<'auto'> { return this.voiceConfig.getInputLanguage() }
  private set inputLanguage(value: PreferredString<'auto'>) { this.voiceConfig.setInputLanguage(value) }
  private get replyLanguage(): PreferredString<'default'> { return this.voiceConfig.getReplyLanguage() }
  private set replyLanguage(value: PreferredString<'default'>) { this.voiceConfig.setReplyLanguage(value) }
  private get model(): string | null { return this.voiceConfig.getModel() }
  private set model(value: string | null) { this.voiceConfig.setModel(value) }
  private get transcriptionModel(): string | null { return this.voiceConfig.getTranscriptionModel() }
  private set transcriptionModel(value: string | null) { this.voiceConfig.setTranscriptionModel(value) }

  private micControl!: MicrophoneControlManager
  // Legacy fields - delegate to micControl
  private get micPaused(): boolean { return this.micControl.isMicPaused() }
  // Deprecated proxies - remove unused getters to satisfy noUnusedLocals
  private get initialAssistantAutoPauseActive(): boolean {
    return this.micControl.getInitialAssistantAutoPauseActive()
  }
  private set initialAssistantAutoPauseActive(value: boolean) {
    this.micControl.setInitialAssistantAutoPauseActive(value)
  }
  // initialAssistantReleaseTimer proxied via MicrophoneControlManager when needed

  private userHasSpoken = false
  private sessionReused = false
  private dropNextAssistantResponse = false
  private connectStartMs: number = 0
  private sessionAckTimeout: ReturnType<typeof setTimeout> | null = null

  // WebSocket for unified transcript broadcast from backend
  private backendTranscriptMode!: boolean

  private scenarioMedia: MediaReference[] = []

  // Service instances (initialized via ServiceInitializer)
  private eventEmitter!: ConversationEventEmitter
  private stateManager!: ConversationStateManager
  private audioManager!: AudioStreamManager
  private socketManager!: BackendSocketClient
  private webrtcManager!: WebRTCConnectionManager
  private transcriptCoordinator!: TranscriptCoordinator
  private transcriptHandler!: TranscriptHandler
  private connectionHandlers!: ConnectionHandlers
  private backendIntegration!: BackendIntegration
  private eventDispatcher!: EventDispatcher
  private instructionSyncManager!: InstructionSyncManager
  private sessionReadyManager!: SessionReadyManager
  private sessionReuseHandlers!: SessionReuseHandlers
  
  // Orchestrators
  private connectionFlowOrchestrator!: ConnectionFlowOrchestrator
  
  // Coordinators
  private stateCoordinator!: StateCoordinator

  constructor(config: ConversationControllerConfig = {}) {
    // Initialize all services using the ServiceInitializer factory
    const callbacks: ServiceInitializerCallbacks = {
      attemptConnection: op => this.attemptConnection(op),
      cleanup: () => this.cleanup(),
      handleMessage: data => this.handleMessage(data),
      handleUserTranscript: (text, isFinal, timings) => this.handleUserTranscript(text, isFinal, timings),
      handleAssistantTranscript: (text, isFinal, timings) => this.handleAssistantTranscript(text, isFinal, timings),
      refreshInstructions: (reason, options) => this.refreshInstructions(reason, options),
      ensureSessionAckTimeout: () => this.ensureSessionAckTimeout(),
      drainPendingInstructionSync: trigger => this.drainPendingInstructionSync(trigger),
      markSessionReady: trigger => this.markSessionReady(trigger),
      setAutoMicPaused: (reason, paused) => this.setAutoMicPaused(reason, paused),
      releaseInitialAssistantAutoPause: reason => this.releaseInitialAssistantAutoPause(reason),
      scheduleInitialAssistantRelease: (reason, delayMs) => this.scheduleInitialAssistantRelease(reason, delayMs),
      logDebug: (...args) => this.logDebug(...args),
      
      // Getters for mutable state
      getPingInterval: () => this.pingInterval,
      getSessionAckTimeout: () => this.sessionAckTimeout,
      getSessionReused: () => this.sessionReused,
      getDropNextAssistantResponse: () => this.dropNextAssistantResponse,
      getInitialAssistantAutoPauseActive: () => this.micControl.getInitialAssistantAutoPauseActive(),
      getInitialAssistantGuardUsed: () => this.micControl.getInitialAssistantGuardUsed(),
      getUserHasSpoken: () => this.userHasSpoken,
      getRemoteVolumeBeforeGuard: () => this.micControl.getRemoteVolumeBeforeGuard(),
      getRemoteAudioElement: () => this.remoteAudioElement,
      getLastRelayedItemId: () => this.lastRelayedItemId,
      
      // Setters for mutable state
      setPingInterval: value => { this.pingInterval = value },
      setSessionAckTimeout: value => { this.sessionAckTimeout = value },
      setSessionReused: value => { this.sessionReused = value },
      setDropNextAssistantResponse: value => { this.dropNextAssistantResponse = value },
      setInitialAssistantAutoPauseActive: value => this.micControl.setInitialAssistantAutoPauseActive(value),
      setInitialAssistantGuardUsed: value => this.micControl.setInitialAssistantGuardUsed(value),
      setUserHasSpoken: value => { this.userHasSpoken = value },
      setRemoteVolumeBeforeGuard: value => this.micControl.setRemoteVolumeBeforeGuard(value),
      setLastRelayedItemId: value => { this.lastRelayedItemId = value },
    }
    
    // Initialize all services via factory
    const services = ServiceInitializer.initialize(config, callbacks)
    
    // Assign all services to this instance
    Object.assign(this, services)
    
    // Initialize orchestrators (requires services to be assigned first)
    this.connectionFlowOrchestrator = new ConnectionFlowOrchestrator({
      sessionLifecycle: this.sessionLifecycle,
      voiceConfig: this.voiceConfig,
      connectionOrchestrator: this.connectionOrchestrator,
      audioManager: this.audioManager,
      webrtcManager: this.webrtcManager,
      eventEmitter: this.eventEmitter,
      stateManager: this.stateManager,
      transcriptCoordinator: this.transcriptCoordinator,
      backendIntegration: this.backendIntegration,
      connectionHandlers: this.connectionHandlers,
      iceServers: this.iceServers,
      backendTranscriptMode: this.backendTranscriptMode,
      getTransport: () => this.transport,
      setTransport: transport => { this.transport = transport },
      getConnectStartMs: () => this.connectStartMs,
      setConnectStartMs: ms => { this.connectStartMs = ms },
      attachDataChannelHandlers: channel => this.attachDataChannelHandlers(channel),
      cleanup: () => this.cleanup(),
      isOpStale: op => this.isOpStale(op),
      attemptConnection: op => this.attemptConnection(op),
      handleSessionReuse: reused => this.handleSessionReuse(reused),
      startMeter: stream => this.startMeter(stream),
    })
    
    // Initialize StateCoordinator for helper method delegation
    this.stateCoordinator = new StateCoordinator({
      connectionOrchestrator: this.connectionOrchestrator,
      micControl: this.micControl,
      audioManager: this.audioManager,
      sessionReuseHandlers: this.sessionReuseHandlers,
    })
  }

  getSnapshot(): ConversationSnapshot {
    return buildConversationSnapshot({
      state: this.stateManager,
      transcript: this.transcriptCoordinator,
      audio: this.audioManager,
      sessionId: this.sessionId,
      debugEnabled: this.debugEnabled,
      micPaused: this.micPaused,
    })
  }

  isDebugEnabled(): boolean {
    return this.eventEmitter.isDebugEnabled()
  }

  setDebugEnabled(enabled: boolean): void {
    if (this.debugEnabled === enabled) return
    this.debugEnabled = enabled
    this.eventEmitter.enableDebug(enabled)

    if (enabled) {
      // If mic is already active and meter wasn't started, start it now
      const micStream = this.audioManager.getMicStream()
      if (micStream && !this.audioManager.isMonitoring()) {
        this.startMeter(micStream)
      }
      return
    }

    // Turning debug off: stop meter updates to avoid unnecessary work
    this.audioManager.stopMeter()
    this.eventEmitter.emit({ type: 'mic-level', level: 0 })
  }

  setRealtimeEventListener(): void {
    // Deprecated: onRealtimeEvent field removed after refactoring
    // This method now does nothing but is kept for backward compatibility
  }

  addListener(listener: ConversationListener): () => void {
    // Delegate to ConversationEventEmitter with current state
    const unsubscribe = this.eventEmitter.addListener(listener)
    // Send current state to new listener
    listener({ type: 'status', status: this.stateManager.getStatus(), error: this.stateManager.getError() })
    listener({ type: 'session', sessionId: this.sessionId })
    const userPartial = this.transcriptCoordinator.getUserPartial()
    const assistantPartial = this.transcriptCoordinator.getAssistantPartial()
    if (userPartial) listener({ type: 'partial', role: 'user', text: userPartial })
    if (assistantPartial) listener({ type: 'partial', role: 'assistant', text: assistantPartial })
    const micLevel = this.audioManager.getMicLevel()
    if (micLevel) listener({ type: 'mic-level', level: micLevel })
    return unsubscribe
  }

  addDebugListener(listener: ConversationDebugListener): () => void {
    // Delegate to ConversationEventEmitter (it handles backlog delivery)
    return this.eventEmitter.addDebugListener(listener)
  }

  setPersonaId(personaId: string | null): void {
    // Delegate to SessionLifecycleManager (it handles session clearing and event emission)
    const changed = this.sessionLifecycle.setPersonaId(personaId)
    if (!changed) return
    
    this.invalidateOps()
    this.resetTranscripts()
    if (this.webrtcManager.getPeerConnection() || this.audioManager.getMicStream()) {
      this.cleanup()
      this.stateManager.updateStatus('idle', null)
    }
  }

  setScenarioId(scenarioId: string | null): void {
    // Delegate to SessionLifecycleManager
    const changed = this.sessionLifecycle.setScenarioId(scenarioId)
    if (!changed) return
    
    this.invalidateOps()
    this.resetTranscripts()
    if (this.webrtcManager.getPeerConnection() || this.audioManager.getMicStream()) {
      this.cleanup()
      this.stateManager.updateStatus('idle', null)
    }
  }

  setScenarioMedia(media: MediaReference[]): void {
    this.scenarioMedia = media ?? []
    this.transcriptCoordinator.setScenarioMedia(this.scenarioMedia as any)
  }

  setExternalSessionId(sessionId: string | null): void {
    // Delegate to SessionLifecycleManager (it handles event emission)
    this.sessionLifecycle.setExternalSessionId(sessionId)
    this.stateManager.setSessionReady(false)
    this.resetTranscripts()
    if (this.webrtcManager.getPeerConnection() || this.audioManager.getMicStream()) {
      this.invalidateOps()
      this.cleanup()
      this.stateManager.updateStatus('idle', null)
    }
  }

  getEncounterState(): { phase: string | null; gate: Record<string, unknown> | null; outstandingGate: string[] } {
    return this.instructionSyncManager.getEncounterState()
  }

  updateEncounterState(
    state: { phase?: string | null; gate?: Record<string, unknown> | null },
    reason = 'state.update'
  ): void {
    this.instructionSyncManager.updateEncounterState(state, reason)
  }

  attachRemoteAudioElement(element: HTMLAudioElement | null): void {
    this.remoteAudioElement = element
    this.audioManager.attachRemoteAudioElement(element)
    if (!element) return
    // If a remote track already exists, attach its stream to the element immediately
    safeInvoke(() => {
      const pc = this.webrtcManager.getPeerConnection()
      if (!pc) return
      const streams: MediaStream[] = []
      // Prefer event-attached streams if present
      const receivers = pc.getReceivers?.() ?? []
      const tracks = receivers
        .map(receiver => receiver.track)
        .filter((track): track is MediaStreamTrack => track != null)
      if (tracks.length) {
        const stream = new MediaStream()
        tracks.forEach(t => stream.addTrack(t))
        streams.push(stream)
      }
      if (streams.length) {
        element.srcObject = streams[0]
      }
    }, 'Failed to attach existing remote tracks to new audio element')
  }

  getRemoteAudioElement(): HTMLAudioElement | null {
    return this.remoteAudioElement
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  getStatus(): VoiceStatus {
    return this.stateManager.getStatus()
  }

  getMicStream(): MediaStream | null {
    return this.audioManager.getMicStream()
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.webrtcManager.getPeerConnection()
  }

  /**
   * Initialize WebSocket connection to backend for unified transcript broadcast
   * Now delegated to BackendSocketManager service
   */

  async startVoice(): Promise<void> {
    this.resetInitialAssistantGuards()

    // Validation checks
    if (!this.personaId) {
      this.stateManager.updateStatus('error', 'select_persona')
      this.eventEmitter.emitDebug({
        t: new Date().toISOString(),
        kind: 'warn',
        src: 'app',
        msg: 'start requested without persona',
      })
      throw new Error('select_persona')
    }
    if (!this.externalSessionId && !this.scenarioId) {
      this.stateManager.updateStatus('error', 'select_scenario')
      this.eventEmitter.emitDebug({
        t: new Date().toISOString(),
        kind: 'warn',
        src: 'app',
        msg: 'start requested without scenario (SPS-only)',
      })
      throw new Error('select_scenario')
    }
    if (this.stateManager.getStatus() === 'connecting' || this.stateManager.getStatus() === 'connected') return

    // Start connection through orchestrator
    await this.connectionOrchestrator.startConnection()
  }

  private async attemptConnection(myOp: number): Promise<void> {
    await runConnectionAttempt({
      myOp,
      createContext: () => this.createConnectionContext(myOp),
    })
  }

  private createConnectionContext(myOp: number): ConnectionFlowContext {
    // Delegate to ConnectionFlowOrchestrator for clean, testable context creation
    return this.connectionFlowOrchestrator.createContext(myOp)
  }

  stopVoice(): void {
    // Delegate to connection orchestrator (handles invalidateOps, cleanup, status update)
    this.connectionOrchestrator.stopConnection()
  }

  isMicPaused(): boolean {
    return this.micControl.isMicPaused()
  }

  setMicPaused(paused: boolean): void {
    this.micControl.setUserMicPaused(paused)
    this.applyMicPausedState('user', 'manual')
  }

  private setAutoMicPaused(reason: string, paused: boolean): void {
    this.stateCoordinator.setAutoMicPaused(reason, paused)
  }

  private applyMicPausedState(source: 'user' | 'auto', reason?: string): void {
    this.stateCoordinator.applyMicPausedState(source, reason)
  }

  private handleSessionReuse(reused: boolean): void {
    this.stateCoordinator.handleSessionReuse(reused)
  }

  private resetInitialAssistantGuards(): void {
    this.stateCoordinator.resetInitialAssistantGuards()
  }

  private scheduleInitialAssistantRelease(trigger: string, delayMs = 350): void {
    this.stateCoordinator.scheduleInitialAssistantRelease(trigger, delayMs)
  }

  private releaseInitialAssistantAutoPause(trigger: string): void {
    this.stateCoordinator.releaseInitialAssistantAutoPause(trigger)
  }

  dispose(): void {
    this.stopVoice()
    this.eventEmitter.dispose()
  }

  sendText(text: string): Promise<void> {
    const channel = this.webrtcManager.getActiveChannel()
    if (!channel || channel.readyState !== 'open') {
      throw new Error('dc_not_ready')
    }
    const payload = String(text || '')
    if (!payload.trim()) return Promise.resolve()
    if (!this.userHasSpoken) {
      this.userHasSpoken = true
    }
    if (this.initialAssistantAutoPauseActive) {
      this.releaseInitialAssistantAutoPause('text-input')
    }
    this.dropNextAssistantResponse = false
    try {
      channel.send(JSON.stringify({ type: 'input_text.append', text: payload }))
      channel.send(JSON.stringify({ type: 'input_text.done' }))
      channel.send(
        JSON.stringify({ type: 'response.create', response: { conversation: 'auto', modalities: ['text', 'audio'] } })
      )
      this.eventEmitter.emitDebug({
        t: new Date().toISOString(),
        kind: 'info',
        src: 'dc',
        msg: 'sent input_text.append + done + response.create',
      })
    } catch (err) {
      this.eventEmitter.emitDebug({
        t: new Date().toISOString(),
        kind: 'error',
        src: 'dc',
        msg: 'sendText failed',
        data: String(err),
      })
      throw err
    }
    return Promise.resolve()
  }

  private resetTranscripts(): void {
    this.transcriptCoordinator.reset()
    this.eventEmitter.emit({ type: 'partial', role: 'user', text: '' })
    this.eventEmitter.emit({ type: 'partial', role: 'assistant', text: '' })
    this.endpointing.resetAll()
    // reset any per-turn timers/metrics here if needed
  }

  private cleanup(): void {
    if (this.transport) {
      safeInvoke(() => this.transport?.dispose(), 'Failed to dispose transport')
      this.transport = null
    }
    // Disconnect WebSocket (delegated to BackendSocketManager)
    this.socketManager.disconnect()

    // Cleanup WebRTC connections (delegated to WebRTCConnectionManager)
    this.webrtcManager.cleanup()
    
    // Cleanup audio streams (delegated to AudioStreamManager)
    this.audioManager.cleanup()
    
    if (this.remoteAudioElement) {
      const el = this.remoteAudioElement
      if (el.srcObject) {
        const mediaStream = el.srcObject as MediaStream
        mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      }
      el.srcObject = null
      el.volume = 1
    }
    
    this.endpointing.dispose()
    if (this.pingInterval != null) {
      const intervalId = this.pingInterval
      safeInvoke(() => clearInterval(intervalId), 'Failed to clear ping interval')
      this.pingInterval = null
    }
    this.eventEmitter.emit({ type: 'mic-level', level: 0 })
    this.stateManager.setConnected(false)
    // activeChannel is now managed by webrtcManager.cleanup()
    this.resetTranscripts()
    if (!this.externalSessionId && this.sessionId !== null) {
      this.sessionId = null
      this.eventEmitter.emit({ type: 'session', sessionId: null })
    }
    this.stateManager.setSessionReady(false)
    this.stateManager.setFullyReady(false)
    this.stateManager.setAwaitingSessionAck(false)
    if (this.sessionAckTimeout != null) {
      const timeoutId = this.sessionAckTimeout
      safeInvoke(() => clearTimeout(timeoutId), 'Failed to clear session ack timeout')
      this.sessionAckTimeout = null
    }
    this.micControl.cleanup()
    this.applyMicPausedState('auto', 'cleanup')
    this.instructionSyncManager.reset()
  }

  private startMeter(stream: MediaStream): void {
    this.audioManager.startMeter(stream, (data: { rms: number; timestamp: number }) => {
      const rms = data.rms
      const activeChannel = this.webrtcManager.getActiveChannel()
      const channelReady = this.webrtcManager.isActiveChannelOpen()
      const adaptiveUpdate = this.endpointing.observeRms(rms, Date.now(), channelReady)
      if (adaptiveUpdate && channelReady && activeChannel) {
        const updateMsg = {
          type: 'session.update',
          session: {
            turn_detection: {
              type: 'server_vad',
              threshold: adaptiveUpdate.threshold,
              prefix_padding_ms: 120,
              silence_duration_ms: adaptiveUpdate.silenceMs,
            },
          },
        }
        try {
          if (adaptiveUpdate.debug) {
            this.eventEmitter.emitDebug({
              t: new Date().toISOString(),
              kind: 'info',
              src: 'dc',
              msg: 'adaptive.vad.update',
              data: {
                category: adaptiveUpdate.debug.category,
                noise: adaptiveUpdate.debug.noise,
                snr: adaptiveUpdate.debug.snr,
                threshold: adaptiveUpdate.threshold,
                silence_ms: adaptiveUpdate.silenceMs,
              },
            })
          }
          activeChannel.send(JSON.stringify(updateMsg))
        } catch (err) {
          this.eventEmitter.emitDebug({
            t: new Date().toISOString(),
            kind: 'warn',
            src: 'dc',
            msg: 'adaptive.vad.update.failed',
            data: String(err),
          })
        }
      }
      this.eventEmitter.emit({ type: 'mic-level', level: rms })
    })
  }

  getAdaptiveSnapshot(): {
    enabled: boolean
    status: 'quiet' | 'noisy' | 'very-noisy'
    noise: number
    snr: number
    threshold: number | null
    silenceMs: number | null
  } {
    return this.endpointing.getAdaptiveSnapshot()
  }

  private handleMessage(raw: string): void {
    // Delegate to EventDispatcher for modular message routing and event classification
    this.eventDispatcher.handleMessage(raw)
  }

  async refreshInstructions(reason = 'manual', options?: InstructionRefreshOptions): Promise<void> {
    await this.instructionSyncManager.refreshInstructions(reason, options)
  }

  private drainPendingInstructionSync(trigger: string): void {
    this.instructionSyncManager.drainPendingInstructionSync(trigger)
  }

  private markSessionReady(trigger: string): void {
    this.sessionReadyManager.markSessionReady(trigger)
  }

  private ensureSessionAckTimeout(): void {
    this.sessionReadyManager.ensureSessionAckTimeout()
  }

  private attachDataChannelHandlers(channel: RTCDataChannel): void {
    // Delegate to WebRTCConnectionManager which handles all event wiring
    this.webrtcManager.attachDataChannelHandlers(channel)
  }

  private handleUserTranscript(text: string, isFinal: boolean, timings: TranscriptTimings): void {
    // Delegate to TranscriptHandler for modular, testable transcript processing
    this.transcriptHandler.handleUserTranscript(text, isFinal, timings)
  }

  private handleAssistantTranscript(text: string, isFinal: boolean, timings: TranscriptTimings): void {
    // Delegate to TranscriptHandler for modular, testable transcript processing
    this.transcriptHandler.handleAssistantTranscript(text, isFinal, timings)
  }

  // Operation epoch management delegated to StateCoordinator
  private isOpStale(op: number): boolean {
    return this.stateCoordinator.isOpStale(op)
  }

  private invalidateOps(): void {
    this.stateCoordinator.invalidateOps()
  }

  // Settings setters (single definitions)
  setVoiceOverride(v: string | null): void {
    this.voiceOverride = v
  }
  setInputLanguage(l: PreferredString<'auto'>): void {
    this.inputLanguage = l || 'auto'
  }
  setReplyLanguage(l: PreferredString<'default'>): void {
    this.replyLanguage = l || 'default'
  }
  setModel(m: string | null): void {
    this.model = m
  }
  setTranscriptionModel(m: string | null): void {
    this.transcriptionModel = m
  }
}
