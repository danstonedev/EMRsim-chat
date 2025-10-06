import { api, API_BASE_URL } from './api'
import { io, Socket } from 'socket.io-client'
import type { RealtimeTransport, TransportLoggerEntry } from './transport/RealtimeTransport'
import { TranscriptEngine, TranscriptTimings } from './transcript/TranscriptEngine'
import { EndpointingManager } from './endpointing/EndpointingManager'
import { runConnectionFlow, type ConnectionFlowContext } from './realtime/runConnectionFlow'

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type VoiceDebugEvent =
  | { t: string; kind: 'info' | 'warn' | 'error'; src: 'pc' | 'dc' | 'mic' | 'api' | 'app'; msg: string; data?: any }
  | { t: string; kind: 'event'; src: 'dc' | 'pc' | 'app'; msg: string; data?: any }

export interface MediaReference {
  id: string
  type: 'image' | 'video'
  url: string
  thumbnail?: string
  caption: string
}

export type ConversationEvent =
  | { type: 'status'; status: VoiceStatus; error: string | null }
  | { type: 'session'; sessionId: string | null }
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string; isFinal: boolean; timestamp: number; media?: MediaReference; timings?: TranscriptTimings }
  | { type: 'partial'; role: 'user' | 'assistant'; text: string }
  | { type: 'mic-level'; level: number }
  | { type: 'pause'; paused: boolean }
  | { type: 'connection-progress'; step: 'mic' | 'session' | 'token' | 'webrtc' | 'complete'; progress: number; estimatedMs?: number }
  | { type: 'instructions'; instructions: string; phase?: string | null; outstandingGate?: string[] }
  | { type: 'voice-ready' }

export type ConversationListener = (event: ConversationEvent) => void
export type ConversationDebugListener = (event: VoiceDebugEvent) => void

export interface ConversationControllerConfig {
  personaId?: string | null
  scenarioId?: string | null
  sessionId?: string | null
  remoteAudioElement?: HTMLAudioElement | null
  sttFallbackMs?: number
  sttExtendedMs?: number
  debugEnabled?: boolean
  bargeInEnabled?: boolean
  iceServers?: RTCIceServer[]
  voiceOverride?: string | null
  inputLanguage?: 'auto' | string
  replyLanguage?: 'default' | string
  model?: string | null
  transcriptionModel?: string | null
  backendTranscriptMode?: boolean
  scenarioMedia?: MediaReference[]
}

export interface InstructionRefreshOptions {
  phase?: string
  gate?: Record<string, unknown>
}

const enum TranscriptRole {
  User = 'user',
  Assistant = 'assistant',
}

function resolveDebug(): boolean {
  try {
    const envValue = ((import.meta as any)?.env?.VITE_VOICE_DEBUG ?? '') as string
    if (typeof envValue === 'string' && ['1', 'true', 'yes', 'on'].includes(envValue.toLowerCase())) {
      return true
    }
    if (typeof window !== 'undefined') {
      const fromStorage = window.localStorage?.getItem('voice.debug')
      if (fromStorage && ['1', 'true', 'yes', 'on'].includes(fromStorage.toLowerCase())) {
        return true
      }
      const fromWindow = (window as any).__VOICE_DEBUG
      if (typeof fromWindow === 'boolean') return fromWindow
      if (typeof fromWindow === 'string' && ['1', 'true', 'yes', 'on'].includes(fromWindow.toLowerCase())) {
        return true
      }
    }
  } catch {}
  return false
}

function resolveBargeIn(): boolean {
  try {
    const raw = ((import.meta as any)?.env?.VITE_VOICE_BARGE_IN || '').toString().toLowerCase()
    if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(raw)) return true
  } catch {}
  return false
}

function resolveIceServers(): RTCIceServer[] | undefined {
  try {
    const raw = ((import.meta as any)?.env?.VITE_ICE_SERVERS_JSON ?? '') as string
    if (!raw) {
      return [
        { urls: 'stun:stun.l.google.com:19302' },
      ]
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as RTCIceServer[]
  } catch {}
  return undefined
}

function resolveAdaptiveVadEnabled(): boolean {
  try {
    const raw = ((import.meta as any)?.env?.VITE_ADAPTIVE_VAD ?? 'true').toString().toLowerCase()
    return ['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(raw)
  } catch {
    return true
  }
}

function resolveAdaptiveVadDebug(): boolean {
  try {
    const raw = ((import.meta as any)?.env?.VITE_ADAPTIVE_VAD_DEBUG ?? '').toString().toLowerCase()
    return ['1', 'true', 'yes', 'on'].includes(raw)
  } catch {
    return false
  }
}


export interface ConversationSnapshot {
  status: VoiceStatus
  error: string | null
  sessionId: string | null
  userPartial: string
  assistantPartial: string
  micLevel: number
  debugEnabled: boolean
  micPaused: boolean
}

export class ConversationController {
  private static readonly BACKEND_SOCKET_MAX_FAILURES = 3

  private status: VoiceStatus = 'idle'
  private error: string | null = null
  private sessionId: string | null
  private personaId: string | null
  private scenarioId: string | null
  private externalSessionId: string | null

  private readonly listeners = new Set<ConversationListener>()
  private readonly debugListeners = new Set<ConversationDebugListener>()
  private debugBacklog: VoiceDebugEvent[] = []
  private debugBacklogDeliveredUntil: number = 0
  private readonly maxDebugBacklog = 500 // Prevent memory leaks and align with backlog trimming logic

  private remoteAudioElement: HTMLAudioElement | null
  private debugEnabled: boolean
  private readonly bargeInEnabled: boolean
  private readonly iceServers?: RTCIceServer[]

  private transport: RealtimeTransport | null = null
  private pc: RTCPeerConnection | null = null
  private serverChannel: RTCDataChannel | null = null
  private clientChannel: RTCDataChannel | null = null
  private activeChannel: RTCDataChannel | null = null
  private micStream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private rafId: number | null = null
  private pingInterval: number | null = null
  private onRealtimeEvent: ((payload: unknown) => void) | null = null

  private sessionReady = false
  private connected = false
  private opEpoch = 0
  private connectRetryCount = 0
  private readonly maxRetries = 3

  private readonly endpointing: EndpointingManager
  private lastRelayedItemId: string | null = null // Track item_id to prevent duplicate relays

  private userPartial = ''
  private assistantPartial = ''
  private micLevel = 0
  private remoteFadeRaf: number | null = null

  private transcriptEngine: TranscriptEngine

  private voiceOverride: string | null = null
  private inputLanguage: 'auto' | string = 'auto'
  private replyLanguage: 'default' | string = 'default'
  private model: string | null = null
  private transcriptionModel: string | null = null
  private micPaused = false
  private userMicPaused = false
  private autoMicPauseReasons = new Set<string>()
  private initialAssistantAutoPauseActive = false
  private initialAssistantGuardUsed = false
  private initialAssistantReleaseTimer: ReturnType<typeof setTimeout> | null = null
  private userHasSpoken = false
  private sessionReused = false
  private dropNextAssistantResponse = false
  private remoteVolumeBeforeGuard: number | null = null
  private connectStartMs: number = 0
  private instructionSyncInFlight = false
  private instructionSyncPending: { reason: string; options?: InstructionRefreshOptions } | null = null
  private lastInstructionPayload: string | null = null
  private instructionRefreshSeq = 0
  private encounterPhase: string | null = null
  private encounterGate: Record<string, unknown> | null = null
  private outstandingGate: string[] = []
  // Marks when all realtime pre-reqs are satisfied (ICE connected, DC open, session.updated with transcription enabled)
  private fullyReady: boolean = false
  private awaitingSessionAck: boolean = false
  private sessionAckTimeout: ReturnType<typeof setTimeout> | null = null
  
  // WebSocket for unified transcript broadcast from backend
  private socket: Socket | null = null
  private backendTranscriptMode: boolean
  private backendSocketFailureCount = 0
  private lastReceivedTranscriptTimestamp = 0 // Track last transcript for catch-up

  private scenarioMedia: MediaReference[] = []

  constructor(config: ConversationControllerConfig = {}) {
    this.personaId = config.personaId ?? null
    this.scenarioId = config.scenarioId ?? null
    this.externalSessionId = config.sessionId ?? null
    this.sessionId = config.sessionId ?? null
    this.remoteAudioElement = config.remoteAudioElement ?? null
    this.debugEnabled = config.debugEnabled ?? resolveDebug()
    this.bargeInEnabled = config.bargeInEnabled ?? resolveBargeIn()
    this.iceServers = config.iceServers ?? resolveIceServers()
    this.voiceOverride = config.voiceOverride ?? null
    this.inputLanguage = config.inputLanguage ?? 'auto'
    this.replyLanguage = config.replyLanguage ?? 'default'
    this.model = config.model ?? null
    this.transcriptionModel = config.transcriptionModel ?? null
    this.backendTranscriptMode = Boolean(config.backendTranscriptMode)
    this.scenarioMedia = config.scenarioMedia ?? []

    // Configure STT timeouts; defaults align with flags.ts but allow per-instance override
    const defaultFallback = 800
    // Extended timeout increased to 2500ms to allow gpt-4o-mini-transcribe full processing time
    const defaultExtended = Math.max(defaultFallback + 700, 2500)
    const sttFallbackMs = Number.isFinite(config.sttFallbackMs as any) && (config.sttFallbackMs as number) >= 0
      ? (config.sttFallbackMs as number)
      : defaultFallback
    const sttExtendedMs = Number.isFinite(config.sttExtendedMs as any) && (config.sttExtendedMs as number) >= 0
      ? (config.sttExtendedMs as number)
      : defaultExtended

    this.transcriptEngine = new TranscriptEngine(
      (text, isFinal, timings) => this.handleUserTranscript(text, isFinal, timings),
      (text, isFinal, timings) => this.handleAssistantTranscript(text, isFinal, timings),
      this.bargeInEnabled
    )

    this.endpointing = new EndpointingManager({
      sttFallbackMs,
      sttExtendedMs,
      adaptiveEnabled: resolveAdaptiveVadEnabled(),
      adaptiveDebug: resolveAdaptiveVadDebug(),
    })
  }

  getSnapshot(): ConversationSnapshot {
    return {
      status: this.status,
      error: this.error,
      sessionId: this.sessionId,
      userPartial: this.userPartial,
      assistantPartial: this.assistantPartial,
      micLevel: this.micLevel,
      debugEnabled: this.debugEnabled,
      micPaused: this.micPaused,
    }
  }

  /**
   * Parse media markers from AI response text and resolve media reference
   * Format: [MEDIA:media_id] anywhere in text
   * Returns { cleanText, media }
   */
  private parseMediaMarker(text: string): { cleanText: string; media: MediaReference | undefined } {
    const mediaMatch = text.match(/\[MEDIA:([^\]]+)\]/)
    if (!mediaMatch) {
      return { cleanText: text, media: undefined }
    }

    const mediaId = mediaMatch[1]
    const cleanText = text.replace(mediaMatch[0], '').trim()
    
    // Find media by ID in scenario media library
    const media = this.scenarioMedia.find(m => m.id === mediaId)
    
    return { cleanText, media }
  }

  isDebugEnabled(): boolean {
    return this.debugEnabled
  }

  setDebugEnabled(enabled: boolean): void {
    if (this.debugEnabled === enabled) return
    this.debugEnabled = enabled
    if (enabled) {
      // When enabling, flush any backlog accumulated while disabled so existing listeners see early events
      if (this.debugListeners.size > 0) {
        const pending = this.debugBacklog.slice(this.debugBacklogDeliveredUntil)
        if (pending.length) {
          this.debugListeners.forEach((listener) => {
            try {
              pending.forEach((ev) => listener(ev))
            } catch {}
          })
          this.debugBacklogDeliveredUntil = this.debugBacklog.length
        }
      }
      this.emitDebug({ t: new Date().toISOString(), kind: 'info', src: 'app', msg: 'debug enabled' })
      // If mic is already active and meter wasn't started, start it now
      if (this.micStream && !this.audioCtx) {
        this.startMeter(this.micStream)
      }
    } else {
      // Turning debug off: stop meter updates to avoid unnecessary work
      if (this.rafId != null) {
        try { cancelAnimationFrame(this.rafId) } catch {}
        this.rafId = null
      }
      if (this.audioCtx) {
        try { this.audioCtx.close() } catch {}
        this.audioCtx = null
      }
      this.micLevel = 0
      this.emit({ type: 'mic-level', level: 0 })
    }
  }

  setRealtimeEventListener(listener: ((payload: unknown) => void) | null): void {
    this.onRealtimeEvent = listener
  }

  addListener(listener: ConversationListener): () => void {
    this.listeners.add(listener)
    listener({ type: 'status', status: this.status, error: this.error })
    listener({ type: 'session', sessionId: this.sessionId })
    if (this.userPartial) listener({ type: 'partial', role: 'user', text: this.userPartial })
    if (this.assistantPartial) listener({ type: 'partial', role: 'assistant', text: this.assistantPartial })
    if (this.micLevel) listener({ type: 'mic-level', level: this.micLevel })
    return () => this.listeners.delete(listener)
  }

  /**
   * @deprecated Use addListener instead.
   */
  on(listener: ConversationListener): () => void {
    try {
      console.warn('[ConversationController] on() is deprecated; use addListener() instead.')
    } catch {}
    return this.addListener(listener)
  }

  addDebugListener(listener: ConversationDebugListener): () => void {
    this.debugListeners.add(listener)
    // If debug is currently enabled, immediately backfill the backlog to this new listener
    if (this.debugEnabled && this.debugBacklog.length) {
      try {
        this.debugBacklog.forEach((ev) => listener(ev))
      } catch {}
    }
    return () => this.debugListeners.delete(listener)
  }

  setPersonaId(personaId: string | null): void {
    if (this.personaId === personaId) return
    this.personaId = personaId
    this.invalidateOps()
    this.resetTranscripts()
    if (this.pc || this.micStream) {
      this.cleanup()
      this.updateStatus('idle', null)
    }
    this.sessionId = null
    this.emit({ type: 'session', sessionId: null })
  }

  setScenarioId(scenarioId: string | null): void {
    if (this.scenarioId === scenarioId) return
    this.scenarioId = scenarioId
    this.invalidateOps()
    this.resetTranscripts()
    if (this.pc || this.micStream) {
      this.cleanup()
      this.updateStatus('idle', null)
    }
  }

  setExternalSessionId(sessionId: string | null): void {
    if (this.externalSessionId === sessionId) return
    this.externalSessionId = sessionId
    this.sessionId = sessionId
    this.emit({ type: 'session', sessionId: this.sessionId })
    this.sessionReady = false
    this.resetTranscripts()
    if (this.pc || this.micStream) {
      this.invalidateOps()
      this.cleanup()
      this.updateStatus('idle', null)
    }
  }

  getEncounterState(): { phase: string | null; gate: Record<string, unknown> | null; outstandingGate: string[] } {
    return {
      phase: this.encounterPhase,
      gate: this.encounterGate ? { ...this.encounterGate } : null,
      outstandingGate: [...this.outstandingGate],
    }
  }

  updateEncounterState(state: { phase?: string | null; gate?: Record<string, unknown> | null }, reason = 'state.update'): void {
    let dirty = false
    if (state && Object.prototype.hasOwnProperty.call(state, 'phase')) {
      const nextPhase = this.normalizePhase(state.phase)
      if (this.encounterPhase !== nextPhase) {
        this.encounterPhase = nextPhase
        dirty = true
      }
    }
    if (state && Object.prototype.hasOwnProperty.call(state, 'gate')) {
      const nextGate = state.gate ? { ...state.gate } : null
      if (!this.areGatesEqual(this.encounterGate, nextGate)) {
        this.encounterGate = nextGate
        dirty = true
      }
    }
    if (!dirty) return

    const options: InstructionRefreshOptions = {}
    if (this.encounterPhase) options.phase = this.encounterPhase
    if (this.encounterGate) options.gate = this.encounterGate

    const effective = Object.keys(options).length ? options : undefined
    this.refreshInstructions(reason, effective).catch(() => {})
  }

  private normalizePhase(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }

  private areGatesEqual(a: Record<string, unknown> | null, b: Record<string, unknown> | null): boolean {
    if (a === b) return true
    if (!a || !b) return !a && !b
    const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
    for (const key of keys) {
      if (a[key] !== b[key]) return false
    }
    return true
  }

  private prepareInstructionOptions = (options?: InstructionRefreshOptions): InstructionRefreshOptions | undefined => {
    let nextPhase = this.encounterPhase
    let nextGate = this.encounterGate

    if (options && Object.prototype.hasOwnProperty.call(options, 'phase')) {
      nextPhase = this.normalizePhase(options?.phase)
    }
    if (options && Object.prototype.hasOwnProperty.call(options, 'gate')) {
      nextGate = options?.gate ? { ...options.gate } : null
    }

    this.encounterPhase = nextPhase
    this.encounterGate = nextGate

    const result: InstructionRefreshOptions = {}
    if (nextPhase) result.phase = nextPhase
    if (nextGate) result.gate = nextGate
    return Object.keys(result).length ? result : undefined
  }

  attachRemoteAudioElement(element: HTMLAudioElement | null): void {
    this.remoteAudioElement = element
    if (!element) return
    // If a remote track already exists, attach its stream to the element immediately
    try {
      if (this.pc) {
        const streams: MediaStream[] = []
        // Prefer event-attached streams if present
        const senders = this.pc.getReceivers?.() ?? []
        const tracks = senders.map((r) => r.track).filter(Boolean) as MediaStreamTrack[]
        if (tracks.length) {
          const stream = new MediaStream()
          tracks.forEach((t) => stream.addTrack(t))
          streams.push(stream)
        }
        if (streams.length) {
          element.srcObject = streams[0]
        }
      }
    } catch {}
  }

  getRemoteAudioElement(): HTMLAudioElement | null {
    return this.remoteAudioElement
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  getStatus(): VoiceStatus {
    return this.status
  }

  getMicStream(): MediaStream | null {
    return this.micStream
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.pc
  }

  /**
   * Initialize WebSocket connection to backend for unified transcript broadcast
   */
  private resolveBackendSocketEndpoint(): { origin: string; path: string } {
    const fallback = { origin: 'http://localhost:3002', path: '/socket.io/' }
    try {
      const url = new URL(API_BASE_URL)
      const trimmedPath = url.pathname.replace(/\/+$/, '')
      const basePath = trimmedPath && trimmedPath !== '/' ? trimmedPath : ''
      let socketPath = `${basePath}/socket.io/`.replace(/\/{2,}/g, '/').replace(/\/+$/, '/')
      if (!socketPath.startsWith('/')) socketPath = `/${socketPath}`
      return { origin: `${url.protocol}//${url.host}`, path: socketPath }
    } catch (error) {
      console.warn('[ConversationController] ⚠️ Failed to parse API_BASE_URL for socket connection:', error)
      return fallback
    }
  }

  private initializeBackendSocket(sessionId: string): void {
    if (!this.backendTranscriptMode) {
      console.log('[ConversationController] Backend transcript mode disabled, skipping socket init')
      return
    }

    if (this.socket?.connected) {
      console.log('[ConversationController] Socket already connected, joining session:', sessionId)
      this.socket.emit('join-session', sessionId)
      return
    }

    if (this.backendSocketFailureCount >= ConversationController.BACKEND_SOCKET_MAX_FAILURES) {
      console.warn('[ConversationController] 🚫 Max backend socket failures reached, disabling backend transcript mode')
      this.backendTranscriptMode = false
      return
    }

    const { origin, path } = this.resolveBackendSocketEndpoint()
    console.log('[ConversationController] Initializing WebSocket connection to:', { origin, path })

    if (this.socket) {
      try { this.socket.removeAllListeners(); this.socket.disconnect() } catch {}
      this.socket = null
    }

    this.socket = io(origin, {
      path,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 8000,
      withCredentials: true,
    })

    this.socket.on('connect', () => {
      console.log('[ConversationController] ✅ WebSocket connected, joining session:', sessionId)
      this.backendSocketFailureCount = 0
      this.socket?.emit('join-session', sessionId)
    })

    this.socket.on('transcript', (data: {
      role: 'user' | 'assistant'
      text: string
      isFinal: boolean
      timestamp: number
      source: string
      startedAtMs?: number | null
      finalizedAtMs?: number | null
      emittedAtMs?: number | null
      media?: MediaReference
    }) => {
      if (!this.backendTranscriptMode) return
      
      console.log('[ConversationController] 📡 Backend transcript received:', {
        role: data.role,
        textLength: data.text.length,
        preview: data.text.slice(0, 50),
        isFinal: data.isFinal,
        source: data.source,
        timings: {
          startedAtMs: data.startedAtMs,
          emittedAtMs: data.emittedAtMs,
          finalizedAtMs: data.finalizedAtMs,
        },
      })

      const emittedAtMs = typeof data.emittedAtMs === 'number' ? data.emittedAtMs : data.timestamp
      const finalizedAtMs = typeof data.finalizedAtMs === 'number' ? data.finalizedAtMs : (data.isFinal ? data.timestamp : undefined)
      const startedAtMs = typeof data.startedAtMs === 'number' ? data.startedAtMs : null
      const eventTimestamp = finalizedAtMs ?? emittedAtMs

      // Track last received timestamp for catch-up
      this.lastReceivedTranscriptTimestamp = Math.max(this.lastReceivedTranscriptTimestamp, eventTimestamp)

      // Parse media markers from assistant responses
      const { cleanText, media } = data.role === 'assistant' 
        ? this.parseMediaMarker(data.text)
        : { cleanText: data.text, media: undefined }

      // Emit transcript event to UI listeners (bypassing OpenAI event processing)
      this.emit({ 
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
    })

    this.socket.on('transcript-error', (data: { error: string; timestamp: number }) => {
      console.error('[ConversationController] ❌ Backend transcript error:', data.error)
      this.emitDebug({ 
        t: new Date().toISOString(), 
        kind: 'error', 
        src: 'api', 
        msg: 'Transcript error from backend', 
        data 
      })
    })

    this.socket.on('disconnect', (reason) => {
      // Normal disconnection when stopping voice session - not an error
      console.log('[ConversationController] 🔌 WebSocket disconnected:', reason)
    })

    const handleSocketFailure = (label: string, error: unknown) => {
      this.backendSocketFailureCount += 1
      const failureCount = this.backendSocketFailureCount
      console.error(`[ConversationController] ❌ WebSocket ${label}:`, error, 'failureCount=', failureCount)
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'error',
        src: 'api',
        msg: `backend socket ${label}`,
        data: { failureCount, error: error instanceof Error ? error.message : String(error) },
      })

      if (failureCount >= ConversationController.BACKEND_SOCKET_MAX_FAILURES) {
        console.warn('[ConversationController] 🔕 Disabling backend transcript mode after repeated socket failures')
        this.backendTranscriptMode = false
        try { this.socket?.disconnect() } catch {}
        this.socket = null
        this.emitDebug({
          t: new Date().toISOString(),
          kind: 'warn',
          src: 'api',
          msg: 'backend socket disabled after repeated failures',
          data: { failureCount },
        })
      }
    }

    this.socket.on('connect_error', (error) => handleSocketFailure('connect_error', error))
    this.socket.on('error', (error) => handleSocketFailure('error', error))
    this.socket.io.on('reconnect_error', (error) => handleSocketFailure('reconnect_error', error))
    this.socket.io.on('reconnect_failed', () => handleSocketFailure('reconnect_failed', 'max retries exceeded'))

    // Handle reconnection - request catch-up for missed transcripts
    this.socket.io.on('reconnect', () => {
      console.log('[ConversationController] 🔄 Reconnected, requesting transcript catch-up')
      // Request transcripts since last received timestamp
      const lastTimestamp = this.lastReceivedTranscriptTimestamp || Date.now() - 60000 // Last 1 min fallback
      this.socket?.emit('request-catchup', { sessionId, since: lastTimestamp })
    })

    // Listen for catch-up transcripts
    this.socket.on('catchup-transcripts', (data: { transcripts: Array<{ role: 'user' | 'assistant'; text: string; isFinal: boolean; timestamp: number; startedAtMs?: number | null; finalizedAtMs?: number | null; emittedAtMs?: number | null }> }) => {
      console.log('[ConversationController] 📦 Received catch-up transcripts:', data.transcripts.length)
      data.transcripts.forEach(t => {
        const emittedAtMs = typeof t.emittedAtMs === 'number' ? t.emittedAtMs : t.timestamp
        const finalizedAtMs = typeof t.finalizedAtMs === 'number' ? t.finalizedAtMs : (t.isFinal ? t.timestamp : undefined)
        const startedAtMs = typeof t.startedAtMs === 'number' ? t.startedAtMs : null
        const eventTimestamp = finalizedAtMs ?? emittedAtMs
        this.emit({ 
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
        this.lastReceivedTranscriptTimestamp = Math.max(this.lastReceivedTranscriptTimestamp, eventTimestamp)
      })
    })
  }

  /**
   * Relay transcript event from OpenAI to backend for broadcast
   */
  private async relayTranscriptToBackend(
    role: 'user' | 'assistant',
    text: string,
    isFinal: boolean,
    timestamp: number,
    timings?: TranscriptTimings,
    itemId?: string
  ): Promise<void> {
    if (!this.sessionId) {
      console.error('[ConversationController] ❌ Cannot relay - no sessionId!')
      return
    }
    
    console.log('[ConversationController] 📤 Relaying transcript to backend:', {
      sessionId: this.sessionId.slice(-6),
      fullSessionId: this.sessionId,
      role,
      isFinal,
      textLength: text.length,
      preview: text.slice(0, 50),
      itemId: itemId?.slice(-8),
      url: `http://localhost:3002/api/transcript/relay/${this.sessionId}`,
      timings,
    })
    
    try {
      const result = await api.relayTranscript(this.sessionId, {
        role,
        text,
        isFinal,
        timestamp,
        startedAt: timings?.startedAtMs ?? undefined,
        finalizedAt: timings?.finalizedAtMs ?? (isFinal ? timestamp : undefined),
        emittedAt: timings?.emittedAtMs ?? timestamp,
        itemId
      })
      console.log('[ConversationController] ✅ Relay successful:', result)
    } catch (error) {
      console.error('[ConversationController] ❌ Relay failed:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        sessionId: this.sessionId
      })
      throw error
    }
  }

  async startVoice(): Promise<void> {
    this.resetInitialAssistantGuards()
    const myOp = this.nextOp()
    if (!this.personaId) {
      this.updateStatus('error', 'select_persona')
      this.emitDebug({ t: new Date().toISOString(), kind: 'warn', src: 'app', msg: 'start requested without persona' })
      throw new Error('select_persona')
    }
    if (!this.externalSessionId && !this.scenarioId) {
      this.updateStatus('error', 'select_scenario')
      this.emitDebug({ t: new Date().toISOString(), kind: 'warn', src: 'app', msg: 'start requested without scenario (SPS-only)' })
      throw new Error('select_scenario')
    }
    if (this.status === 'connecting' || this.status === 'connected') return

    // Reset retry count on new connection attempt
    this.connectRetryCount = 0
    return this.attemptConnection(myOp)
  }

  private async attemptConnection(myOp: number): Promise<void> {
    const context = this.createConnectionContext(myOp)
    await runConnectionFlow(context, myOp)
  }

  private createConnectionContext(myOp: number): ConnectionFlowContext {
    return {
      iceServers: this.iceServers,
      backendTranscriptMode: this.backendTranscriptMode,
      maxRetries: this.maxRetries,
      getConnectRetryCount: () => this.connectRetryCount,
      setConnectRetryCount: (value) => {
        this.connectRetryCount = value
      },
      getSessionId: () => this.sessionId,
      setSessionId: (id) => {
        this.sessionId = id
      },
      getExternalSessionId: () => this.externalSessionId,
      getMicStream: () => this.micStream,
      setMicStream: (stream) => {
        this.micStream = stream
      },
      getTransport: () => this.transport,
      setTransport: (transport) => {
        this.transport = transport
      },
      getPeerConnection: () => this.pc,
      setPeerConnection: (pc) => {
        this.pc = pc
      },
      setServerChannel: (channel) => {
        this.serverChannel = channel
      },
      setClientChannel: (channel) => {
        this.clientChannel = channel
      },
      attachDataChannelHandlers: (channel) => this.attachDataChannelHandlers(channel),
      getConnectStartMs: () => this.connectStartMs,
      setConnectStartMs: (ms) => {
        this.connectStartMs = ms
      },
      initializeBackendSocket: (sessionId) => this.initializeBackendSocket(sessionId),
      updateStatus: (status, error) => this.updateStatus(status, error),
      emit: (event) => this.emit(event),
      emitDebug: (event) => this.emitDebug(event),
      startMeter: (stream) => this.startMeter(stream),
      logTransport: (entry) => this.logTransport(entry),
      handleRemoteStream: (remoteStream) => this.handleRemoteStream(remoteStream),
      handleIceConnectionStateChange: (state) => this.handleIceConnectionStateChange(state),
      handleConnectionStateChange: (state) => this.handleConnectionStateChange(state),
      createSessionWithLogging: () => this.createSessionWithLogging(),
      cleanup: () => this.cleanup(),
      isOpStale: (op) => this.isOpStale(op),
      scheduleRetry: (delayMs) => {
        setTimeout(() => this.attemptConnection(myOp), delayMs)
      },
      handleSessionReuse: (reused) => this.handleSessionReuse(reused),
      voiceOverride: this.voiceOverride,
      inputLanguage: this.inputLanguage,
      replyLanguage: this.replyLanguage,
      model: this.model,
      transcriptionModel: this.transcriptionModel,
    }
  }

  stopVoice(): void {
    this.invalidateOps()
    this.cleanup()
    this.updateStatus('idle', null)
  }

  isMicPaused(): boolean {
    return this.micPaused
  }

  setMicPaused(paused: boolean): void {
    if (this.userMicPaused === paused) return
    this.userMicPaused = paused
    this.applyMicPausedState('user', 'manual')
  }

  private setAutoMicPaused(reason: string, paused: boolean): void {
    const hasReason = this.autoMicPauseReasons.has(reason)
    if (paused) {
      if (!hasReason) {
        this.autoMicPauseReasons.add(reason)
      }
    } else if (hasReason) {
      this.autoMicPauseReasons.delete(reason)
    }
    this.applyMicPausedState('auto', reason)
  }

  private applyMicPausedState(source: 'user' | 'auto', reason?: string): void {
    const shouldPause = this.userMicPaused || this.autoMicPauseReasons.size > 0
    if (this.micPaused === shouldPause) return
    this.micPaused = shouldPause

    try {
      if (this.micStream) {
        this.micStream.getAudioTracks().forEach((track) => {
          try { track.enabled = !shouldPause } catch {}
        })
      }
    } catch {}

    if (shouldPause) {
      this.micLevel = 0
      this.emit({ type: 'mic-level', level: 0 })
    }

    const msg = shouldPause
      ? source === 'user' ? 'paused' : 'paused.auto'
      : source === 'user' ? 'resumed' : 'resumed.auto'

    this.emitDebug({
      t: new Date().toISOString(),
      kind: 'info',
      src: 'mic',
      msg,
      data: reason ? { reason } : undefined,
    })

    this.emit({ type: 'pause', paused: shouldPause })
  }

  private handleSessionReuse(reused: boolean): void {
    this.sessionReused = reused
    if (reused) {
      this.dropNextAssistantResponse = true
      this.initialAssistantAutoPauseActive = false
      this.initialAssistantGuardUsed = false
      this.userHasSpoken = false
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'app',
        msg: 'session.reuse.detected',
        data: { reused: true },
      })
    } else {
      this.dropNextAssistantResponse = false
      if (this.initialAssistantAutoPauseActive) {
        this.releaseInitialAssistantAutoPause('session-reuse-reset')
      }
      this.resetInitialAssistantGuards()
    }
  }

  private resetInitialAssistantGuards(): void {
    if (this.initialAssistantReleaseTimer != null) {
      try { clearTimeout(this.initialAssistantReleaseTimer) } catch {}
      this.initialAssistantReleaseTimer = null
    }
    this.initialAssistantAutoPauseActive = false
    this.initialAssistantGuardUsed = false
    this.userHasSpoken = false
    this.sessionReused = false
    this.dropNextAssistantResponse = false
    if (this.remoteAudioElement) {
      this.remoteAudioElement.muted = false
      if (this.remoteVolumeBeforeGuard != null) {
        this.remoteAudioElement.volume = this.remoteVolumeBeforeGuard
      }
    }
    this.remoteVolumeBeforeGuard = null
    this.setAutoMicPaused('initial-assistant', false)
  }

  private scheduleInitialAssistantRelease(trigger: string, delayMs = 350): void {
    if (!this.initialAssistantAutoPauseActive || !this.autoMicPauseReasons.has('initial-assistant')) return
    if (this.initialAssistantReleaseTimer != null) {
      try { clearTimeout(this.initialAssistantReleaseTimer) } catch {}
    }
    this.initialAssistantReleaseTimer = setTimeout(() => {
      this.initialAssistantReleaseTimer = null
      this.releaseInitialAssistantAutoPause(trigger)
    }, delayMs)
  }

  private releaseInitialAssistantAutoPause(trigger: string): void {
    if (!this.initialAssistantAutoPauseActive && !this.autoMicPauseReasons.has('initial-assistant')) return
    if (this.initialAssistantReleaseTimer != null) {
      try { clearTimeout(this.initialAssistantReleaseTimer) } catch {}
      this.initialAssistantReleaseTimer = null
    }
    this.initialAssistantAutoPauseActive = false
    this.dropNextAssistantResponse = false
    this.sessionReused = false
    this.setAutoMicPaused('initial-assistant', false)
    if (this.remoteAudioElement) {
      this.remoteAudioElement.muted = false
      if (this.remoteVolumeBeforeGuard != null) {
        this.remoteAudioElement.volume = this.remoteVolumeBeforeGuard
      }
    }
    this.remoteVolumeBeforeGuard = null
    this.emitDebug({
      t: new Date().toISOString(),
      kind: 'info',
      src: 'mic',
      msg: 'auto-unpaused',
      data: { trigger },
    })
  }

  dispose(): void {
    this.stopVoice()
    this.listeners.clear()
    this.debugListeners.clear()
  }

  async sendText(text: string): Promise<void> {
    const channel = this.activeChannel
    if (!channel || channel.readyState !== 'open') {
      throw new Error('dc_not_ready')
    }
    const payload = String(text || '')
    if (!payload.trim()) return
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
  channel.send(JSON.stringify({ type: 'response.create', response: { conversation: 'auto', modalities: ['text', 'audio'] } }))
      this.emitDebug({ t: new Date().toISOString(), kind: 'info', src: 'dc', msg: 'sent input_text.append + done + response.create' })
    } catch (err) {
      this.emitDebug({ t: new Date().toISOString(), kind: 'error', src: 'dc', msg: 'sendText failed', data: String(err) })
      throw err
    }
  }

  private emit(event: ConversationEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event)
      } catch {}
    })
  }

  private emitDebug(event: VoiceDebugEvent): void {
    // Always record to backlog
    this.debugBacklog.push(event)
    // Trim backlog if over capacity and adjust delivered pointer
    if (this.debugBacklog.length > this.maxDebugBacklog) {
      const overflow = this.debugBacklog.length - this.maxDebugBacklog
      this.debugBacklog.splice(0, overflow)
      this.debugBacklogDeliveredUntil = Math.max(0, this.debugBacklogDeliveredUntil - overflow)
    }
    // Only emit to listeners when enabled
    if (!this.debugEnabled) return
    this.debugListeners.forEach((listener) => {
      try {
        listener(event)
      } catch {}
    })
    // Mark everything delivered up to current end
    this.debugBacklogDeliveredUntil = this.debugBacklog.length
  }

  private logTransport(entry: TransportLoggerEntry): void {
    const timestamp = new Date().toISOString()
    const mappedSrc = entry.src === 'pc' ? 'pc' : entry.src === 'dc' ? 'dc' : 'app'
    if (entry.kind === 'event') {
      this.emitDebug({ t: timestamp, kind: 'event', src: mappedSrc, msg: entry.msg, data: entry.data })
    } else {
      this.emitDebug({ t: timestamp, kind: entry.kind, src: mappedSrc, msg: entry.msg, data: entry.data })
    }
  }

  private updateStatus(status: VoiceStatus, error: string | null): void {
    this.status = status
    this.error = error
    this.emit({ type: 'status', status, error })
  }

  private resetTranscripts(): void {
    this.transcriptEngine.reset()
    this.userPartial = ''
    this.assistantPartial = ''
    this.emit({ type: 'partial', role: 'user', text: '' })
    this.emit({ type: 'partial', role: 'assistant', text: '' })
    this.endpointing.resetAll()
    // reset any per-turn timers/metrics here if needed
  }

  private cleanup(): void {
    if (this.transport) {
      try { this.transport.dispose() } catch {}
      this.transport = null
    }
    // Disconnect WebSocket
    if (this.socket) {
      try { 
        this.socket.disconnect() 
        console.log('[ConversationController] WebSocket disconnected')
      } catch {}
      this.socket = null
    }
    
    if (this.serverChannel) {
      try { this.serverChannel.close() } catch {}
      this.serverChannel = null
    }
    if (this.clientChannel) {
      try { this.clientChannel.close() } catch {}
      this.clientChannel = null
    }
    if (this.pc) {
      try { this.pc.close() } catch {}
      this.pc = null
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop())
      this.micStream = null
    }
    if (this.remoteAudioElement) {
      const el = this.remoteAudioElement
      if (el.srcObject) {
        const mediaStream = el.srcObject as MediaStream
        mediaStream.getTracks().forEach((track) => track.stop())
      }
      el.srcObject = null
      el.volume = 1
    }
    if (this.rafId != null) {
      try { cancelAnimationFrame(this.rafId) } catch {}
      this.rafId = null
    }
    this.endpointing.dispose()
    if (this.pingInterval != null) {
      try { clearInterval(this.pingInterval) } catch {}
      this.pingInterval = null
    }
    if (this.audioCtx) {
      try { this.audioCtx.close() } catch {}
      this.audioCtx = null
    }
    this.micLevel = 0
    this.emit({ type: 'mic-level', level: 0 })
    this.connected = false
    this.activeChannel = null
    this.resetTranscripts()
    if (!this.externalSessionId && this.sessionId !== null) {
      this.sessionId = null
      this.emit({ type: 'session', sessionId: null })
    }
    if (this.remoteFadeRaf != null) {
      try { cancelAnimationFrame(this.remoteFadeRaf) } catch {}
      this.remoteFadeRaf = null
    }
    this.sessionReady = false
    this.fullyReady = false
    this.awaitingSessionAck = false
    if (this.sessionAckTimeout != null) {
      try { clearTimeout(this.sessionAckTimeout) } catch {}
      this.sessionAckTimeout = null
    }
    this.resetInitialAssistantGuards()
    this.autoMicPauseReasons.clear()
    this.userMicPaused = false
    this.applyMicPausedState('auto', 'cleanup')
    this.lastInstructionPayload = null
    this.instructionSyncPending = null
    this.instructionSyncInFlight = false
    this.instructionRefreshSeq += 1
    this.backendSocketFailureCount = 0
  }

  private startMeter(stream: MediaStream): void {
    try {
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)
  this.audioCtx = audioCtx
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.min(1, Math.sqrt(sum / data.length))
        this.micLevel = rms
        const channelReady = !!this.activeChannel && this.activeChannel.readyState === 'open'
        const adaptiveUpdate = this.endpointing.observeRms(rms, Date.now(), channelReady)
        if (adaptiveUpdate && channelReady && this.activeChannel) {
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
              this.emitDebug({
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
            this.activeChannel.send(JSON.stringify(updateMsg))
          } catch (err) {
            this.emitDebug({
              t: new Date().toISOString(),
              kind: 'warn',
              src: 'dc',
              msg: 'adaptive.vad.update.failed',
              data: String(err),
            })
          }
        }
        this.emit({ type: 'mic-level', level: rms })
        this.rafId = requestAnimationFrame(tick)
      }
      this.rafId = requestAnimationFrame(tick)
    } catch (err) {
      this.emitDebug({ t: new Date().toISOString(), kind: 'warn', src: 'mic', msg: 'meter setup failed', data: String(err) })
    }
  }

  getAdaptiveSnapshot(): { enabled: boolean; status: 'quiet' | 'noisy' | 'very-noisy'; noise: number; snr: number; threshold: number | null; silenceMs: number | null } {
    return this.endpointing.getAdaptiveSnapshot()
  }

  private handleMessage(raw: string): void {
    try {
      const payload = JSON.parse(raw)
      this.onRealtimeEvent?.(payload)
      const type: string = (payload?.type || '').toLowerCase()
      // Classify and log exactly once: if server indicates error/warning, mark as error, otherwise as a generic event
      const hasProblem = type.includes('error') || type.includes('warning')
      const brief = hasProblem
        ? (payload?.error && (payload?.error?.message || payload?.error?.code || payload?.error?.type)) || payload?.message || payload?.reason || ''
        : ''
      const msg = hasProblem && brief ? `${type}: ${String(brief)}` : type
      const ev: VoiceDebugEvent = this.debugEnabled
        ? { t: new Date().toISOString(), kind: hasProblem ? 'error' : 'event', src: 'dc', msg, data: payload }
        : { t: new Date().toISOString(), kind: hasProblem ? 'error' : 'event', src: 'dc', msg }
      this.emitDebug(ev)

      if (type === 'session.created') {
        console.log('[ConversationController] 🎯 session.created received, enabling transcription')
        this.awaitingSessionAck = true
        this.sessionReady = false
        this.ensureSessionAckTimeout()
        this.refreshInstructions('session.created').catch(() => {})
        
        // For gpt-realtime-2025-08-28, configure transcription AND audio modalities via session.update after connection
        // This enables input_audio_transcription which the model requires be set post-connect
        if (this.activeChannel && this.activeChannel.readyState === 'open') {
          try {
            const updateMsg = {
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],  // Ensure audio responses are enabled
                // Note: Transcription model is configured by backend via token request
              }
            }
            console.log('[ConversationController] 📤 Sending session.update:', updateMsg)
            this.activeChannel.send(JSON.stringify(updateMsg))
            console.log('[ConversationController] ✅ session.update sent successfully')
          } catch (err) {
            console.error('[ConversationController] ❌ FAILED to send session.update:', err)
          }
        } else {
          console.warn('[ConversationController] ⚠️ Cannot send session.update - channel not ready:', {
            hasChannel: !!this.activeChannel,
            readyState: this.activeChannel?.readyState
          })
        }
        return
      }
      
      // Log session.updated confirmation from server
      if (type === 'session.updated') {
        console.log('[ConversationController] 🎉 session.updated received from server:', payload)
        this.markSessionReady('session.updated')
        if (payload?.session?.input_audio_transcription) {
          console.log('[ConversationController] ✅ Transcription confirmed enabled:', payload.session.input_audio_transcription)
          // Mark fully ready once session has confirmed transcription settings
          if (!this.fullyReady) {
            this.fullyReady = true
            // Only emit complete once everything is ready
            this.emit({ type: 'connection-progress', step: 'complete', progress: 100 })
            // Emit voice-ready event to notify UI that user can start speaking
            this.emit({ type: 'voice-ready' })
          }
        } else {
          console.warn('[ConversationController] ⚠️ Transcription NOT in session config:', payload?.session)
        }
        return
      }
      if (type === 'input_audio_buffer.speech_started' || type.endsWith('input_audio_buffer.speech_started')) {
        const result = this.endpointing.handleSpeechStarted(Date.now())
        if (result === 'continue-active-turn') {
          console.log('[ConversationController] 🔄 Continuing active turn (brief pause detected, not starting new bubble)')
          return
        }

        if (!this.userHasSpoken) {
          this.userHasSpoken = true
        }
        if (this.initialAssistantAutoPauseActive) {
          this.releaseInitialAssistantAutoPause('speech-started')
        }
        this.dropNextAssistantResponse = false

        console.log('[ConversationController] 🎤 User speech started - initializing new turn')
        this.transcriptEngine.startUserTranscript()
        const speechStartedAt = Date.now()
        this.emit({
          type: 'transcript',
          role: 'user',
          text: '',
          isFinal: false,
          timestamp: speechStartedAt,
          timings: {
            startedAtMs: speechStartedAt,
            emittedAtMs: speechStartedAt,
          },
        })
        return
      }
      if (type === 'input_audio_buffer.speech_stopped' || type.endsWith('input_audio_buffer.speech_stopped')) {
        console.log('[ConversationController] 🛑 User speech stopped')
        this.endpointing.handleSpeechStopped(Date.now())
        console.log('🔧 Set userSpeechPending = true (audio captured, transcription incoming)')
        return
      }
      // Handle transcription completion events - wait for actual transcript
      if (
        type.endsWith('input_transcription.completed') ||
        type.endsWith('input_audio_transcription.completed') ||
        type.includes('conversation.item.input_audio_transcription.completed')
      ) {
        const transcript = payload.transcript || payload.text || ''
        const previouslyFinalized = this.endpointing.getUserFinalized()
        console.log('[ConversationController] ✅ TRANSCRIPTION COMPLETED:', {
          transcriptLength: transcript.length,
          preview: transcript.slice(0, 100),
          userFinalized: previouslyFinalized,
        })
        
        // CRITICAL FIX: Don't finalize with empty transcript!
        // Sometimes completion event fires with empty string before deltas arrive
        if (!transcript || transcript.trim().length === 0) {
          console.warn('[ConversationController] ⚠️ Ignoring empty transcription completion - waiting for deltas or next event')
          return
        }
        
        // Always relay from completion event (single source of truth)
        const itemId = payload.item_id
        if (this.backendTranscriptMode) {
          if (!itemId) {
            console.error('[ConversationController] ❌ Missing item_id in completion event - cannot relay!', payload)
            // Continue with finalization below, but transcript won't be broadcast
          } else if (this.lastRelayedItemId === itemId) {
            console.log('[ConversationController] ⏭️ Skipping relay - item_id already relayed:', itemId)
          } else {
            console.log('[ConversationController] 📡 Relaying user transcript from completion event:', transcript.slice(0, 50), 'item_id:', itemId)
            this.relayTranscriptToBackend('user', transcript, true, Date.now(), undefined, itemId).catch(err => {
              console.error('[ConversationController] Failed to relay user transcript:', err)
            })
            this.lastRelayedItemId = itemId
          }
        }
        
        // Update word count for smart patience detection
        if (transcript) {
          const wordCount = transcript.trim().split(/\s+/).length
          this.endpointing.recordWordCount(wordCount)
        }
        
        // Finalize transcript engine state (only if not already finalized to avoid duplicate calls)
        const newlyFinalized = this.endpointing.handleTranscriptionCompleted()
        if (newlyFinalized) {
          console.log('[ConversationController] 🎯 Calling transcriptEngine.finalizeUser with transcript:', transcript.slice(0, 100))
          this.transcriptEngine.finalizeUser({ transcript })
          this.userPartial = ''
          console.log('[ConversationController] ✅ transcriptEngine.finalizeUser completed')
        } else {
          console.log('[ConversationController] ⚠️ Skipped finalizeUser - already finalized (from force finalization)')
        }
        this.endpointing.clearCommitTimer()
        return
      }

      // Handle text input completion (non-voice)
      if (
        type.endsWith('input_text.done') ||
        type.endsWith('input_text.completed') ||
        type.endsWith('input_text.commit')
      ) {
        if (!this.endpointing.getUserFinalized()) {
          this.transcriptEngine.finalizeUser(payload)
          this.userPartial = ''
          this.endpointing.markTurnFinalized()
        }
        this.endpointing.clearCommitTimer()
        return
      }

      // Handle audio buffer committed - DON'T finalize yet, wait for transcription
      if (type === 'input_audio_buffer.committed') {
        console.log('[ConversationController] Audio buffer committed, waiting for transcription...')
        const fallbackMs = this.endpointing.handleAudioCommitted(Date.now(), () => {
          if (!this.endpointing.getUserFinalized()) {
            console.warn('[ConversationController] ⏱️ STT fallback (no events after commit) - force finalizing user')
            this.transcriptEngine.finalizeUser({})
            this.userPartial = ''
            this.endpointing.markTurnFinalized()
          }
        })
        console.log('[ConversationController] ⏳ Scheduled STT fallback timeout (ms):', fallbackMs)
        // DON'T finalize here - wait for transcription.completed event
        return
      }
      // Handle transcription failures - finalize with fallback to prevent blocking
      if (
        type.includes('transcription.failed') ||
        type.includes('input_audio_transcription.failed')
      ) {
        // Check if this is a rate limit error (429)
        const errorMsg = payload?.error?.message || ''
        const is429 = errorMsg.includes('429') || errorMsg.includes('Too Many Requests')
        
        if (is429) {
          console.error('[ConversationController] 🚫 RATE LIMIT ERROR (429):', errorMsg)
          console.error('[ConversationController] 💡 Solution: Upgrade OpenAI account at https://platform.openai.com/settings/organization/billing')
        } else {
          console.error('[ConversationController] ⚠️ TRANSCRIPTION FAILED EVENT:', { type, payload })
        }
        
        if (!this.endpointing.getUserFinalized()) {
          // Finalize with placeholder text if we have no transcript
          const fallbackText = is429 ? '[Rate limit exceeded - upgrade OpenAI account]' : '[Speech not transcribed]'
          this.transcriptEngine.finalizeUser({ transcript: fallbackText })
          this.userPartial = ''
        }
        this.endpointing.handleTranscriptionFailed()
        return
      }
      
      // Log successful transcription events
      if (type.includes('input_audio_transcription.completed')) {
        console.log('[ConversationController] ✅ TRANSCRIPTION COMPLETED:', payload)
      }
      if (type.includes('input_audio_transcription.delta')) {
        console.log('[ConversationController] 📝 TRANSCRIPTION DELTA:', payload)
      }
      
      if (
        (type.includes('input') && type.includes('transcription.delta')) ||
        type.endsWith('input_transcription.delta') ||
        type.endsWith('input_audio_transcription.delta') ||
        type.includes('conversation.item.input_audio_transcription.delta') ||
        type.endsWith('input_text.delta')
      ) {
        const { restarted } = this.endpointing.handleTranscriptionDelta(Date.now(), () => {
          if (!this.endpointing.getUserFinalized()) {
            console.warn('[ConversationController] ⏱️ STT extended timeout reached - force finalizing user from buffered deltas')
            const bufferedText = this.transcriptEngine.getUserBuffer()
            this.transcriptEngine.finalizeUser({ transcript: bufferedText })
            this.userPartial = ''
            this.endpointing.markTurnFinalized()

            if (this.backendTranscriptMode && bufferedText && bufferedText.trim()) {
              console.log('[ConversationController] 📡 Relaying buffered user transcript from timeout:', bufferedText.slice(0, 50))
              this.relayTranscriptToBackend('user', bufferedText, true, Date.now(), undefined).catch((err) => {
                console.error('[ConversationController] Failed to relay buffered user transcript:', err)
              })
            }
          }
        })

        if (restarted) {
          this.transcriptEngine.startUserTranscript()
          const deltaRestartedAt = Date.now()
          this.emit({
            type: 'transcript',
            role: TranscriptRole.User,
            text: '',
            isFinal: false,
            timestamp: deltaRestartedAt,
            timings: {
              startedAtMs: deltaRestartedAt,
              emittedAtMs: deltaRestartedAt,
            },
          })
        }

        this.transcriptEngine.pushUserDelta(payload)
        return
      }
      // Track when assistant response begins
      if (type === 'response.created' || type.endsWith('response.created')) {
        const shouldEngageGuard = this.dropNextAssistantResponse && this.sessionReused && !this.userHasSpoken
        if (shouldEngageGuard) {
          this.dropNextAssistantResponse = false
          this.initialAssistantGuardUsed = true
          this.initialAssistantAutoPauseActive = true
          this.setAutoMicPaused('initial-assistant', true)
          if (this.remoteAudioElement) {
            if (this.remoteVolumeBeforeGuard == null) {
              this.remoteVolumeBeforeGuard = this.remoteAudioElement.volume
            }
            this.remoteAudioElement.muted = true
          }
          this.emitDebug({
            t: new Date().toISOString(),
            kind: 'event',
            src: 'app',
            msg: 'assistant.initial.guard.engaged',
            data: { trigger: type, reuse: true },
          })
          this.scheduleInitialAssistantRelease('guard-timeout')
        } else if (this.initialAssistantAutoPauseActive) {
          this.releaseInitialAssistantAutoPause('assistant-response')
        }

        console.log('[ConversationController] 🤖 Assistant response starting')
        const action = this.endpointing.prepareAssistantResponseStart()
        this.emitDebug({
          t: new Date().toISOString(),
          kind: 'info',
          src: 'app',
          msg: 'assistant.response.start',
          data: {
            action,
            userFinalized: this.endpointing.getUserFinalized(),
            userHasDelta: this.endpointing.getUserHasDelta(),
            userSpeechPending: this.endpointing.getUserSpeechPending(),
          },
        })
        switch (action) {
          case 'finalize-from-deltas':
            console.log('[ConversationController] ⚠️ Force finalizing pending user transcript before assistant response (from deltas)')
            this.transcriptEngine.finalizeUser({})
            this.userPartial = ''
            this.endpointing.markTurnFinalized()
            break
          case 'wait-for-pending':
            console.log('[ConversationController] ⏳ User speech pending - waiting for transcription (speech_stopped → response.created race)')
            break
          case 'wait-for-commit':
            console.log('[ConversationController] ⏳ Waiting for transcription to complete (audio committed, no deltas yet)')
            break
          case 'finalize-empty':
            console.log('[ConversationController] ℹ️ Assistant starting without prior user input (initial greeting or follow-up)')
            this.transcriptEngine.finalizeUser({})
            this.userPartial = ''
            this.endpointing.markTurnFinalized()
            break
          case 'none':
          default:
            break
        }

        this.transcriptEngine.startAssistantResponse()
        return
      }
      if (type.includes('content_part.added') || type.endsWith('response.content_part.delta')) {
        this.transcriptEngine.pushAssistantDelta(payload, false)
        return
      }
      if (type.includes('content_part.done') || type.endsWith('response.content_part.done')) {
        this.transcriptEngine.finalizeAssistant(payload, false)
        this.assistantPartial = ''
        return
      }
      if (type.includes('audio_transcript.delta') || type.endsWith('response.audio_transcript.delta')) {
        this.transcriptEngine.pushAssistantDelta(payload, true)
        return
      }
      if (type.includes('output_text.delta') || type === 'response.delta' || type.endsWith('response.output_text.delta')) {
        this.transcriptEngine.pushAssistantDelta(payload, false)
        return
      }
      if (type.includes('audio_transcript.done') || type.endsWith('response.audio_transcript.done')) {
        this.transcriptEngine.finalizeAssistant(payload, true)
        this.assistantPartial = ''
        return
      }
      if (
        type.includes('output_text.done') ||
        type.endsWith('response.output_text.done') ||
        type === 'response.completed' ||
        type === 'response.done'
      ) {
        this.transcriptEngine.finalizeAssistant(payload, false)
        this.assistantPartial = ''
        return
      }
      if (type === 'conversation.item.created') {
        const role = String(payload?.item?.role || '').toLowerCase()
        if (role === TranscriptRole.User) {
          const restarted = this.endpointing.handleBackendUserItem(Date.now())
          if (restarted) {
            this.lastRelayedItemId = null
            this.transcriptEngine.startUserTranscript()
            const backendRestartAt = Date.now()
            this.emit({
              type: 'transcript',
              role: TranscriptRole.User,
              text: '',
              isFinal: false,
              timestamp: backendRestartAt,
              timings: {
                startedAtMs: backendRestartAt,
                emittedAtMs: backendRestartAt,
              },
            })
          }
          return
        }
        if (role === TranscriptRole.Assistant) {
          this.transcriptEngine.startAssistantResponse()
          return
        }
        return
      }
      if (type === 'conversation.item.truncated' || type.endsWith('conversation.item.truncated')) {
        this.transcriptEngine.finalizeAssistant({}, true)
        this.assistantPartial = ''
        return
      }
    } catch (err) {
      console.warn('[conversation-controller] failed to parse payload', err)
    }
  }

  private handleIceConnectionStateChange(state: RTCIceConnectionState): void {
    this.emitDebug({ t: new Date().toISOString(), kind: 'event', src: 'pc', msg: `iceconnectionstatechange:${state}` })

    if (state === 'connected' || state === 'completed') {
      if (!this.connected) {
        this.connected = true
        this.updateStatus('connected', null)
        setTimeout(() => {
          const channels = [this.serverChannel, this.clientChannel]
          const anyOpen = channels.some((ch) => ch?.readyState === 'open')
          if (!anyOpen) {
            this.emitDebug({ t: new Date().toISOString(), kind: 'warn', src: 'dc', msg: 'datachannel not open within 2s after ICE connected' })
          }
        }, 2000)
      }
    } else if (state === 'disconnected' || state === 'failed') {
      this.emitDebug({ t: new Date().toISOString(), kind: 'warn', src: 'pc', msg: `connection degraded: ${state}` })
      if (state === 'failed') {
        this.updateStatus('error', `connection_failed_${state}`)
      }
    }
  }

  private handleConnectionStateChange(state: RTCPeerConnectionState): void {
    this.emitDebug({ t: new Date().toISOString(), kind: 'event', src: 'pc', msg: `connectionstatechange:${state}` })
    if (state === 'failed' || state === 'disconnected') {
      this.updateStatus('error', state)
    }
  }

  private handleRemoteStream(remoteStream: MediaStream): void {
    if (!this.remoteAudioElement) return
    this.remoteAudioElement.srcObject = remoteStream
    this.applyRemoteFadeIn(this.remoteAudioElement)
    const el = this.remoteAudioElement
    const play = () => el.play().catch(() => {})
    if (el.readyState >= 2) play()
    else {
      const handler = () => {
        el.removeEventListener('canplay', handler)
        play()
      }
      el.addEventListener('canplay', handler)
    }
  }

  private applyRemoteFadeIn(element: HTMLAudioElement): void {
    const target = Math.min(1, Math.max(0.2, element.volume || 1))
    element.volume = 0.0001
    if (this.remoteFadeRaf != null) {
      try { cancelAnimationFrame(this.remoteFadeRaf) } catch {}
      this.remoteFadeRaf = null
    }
    const fadeDurationMs = 240
    const start = performance.now()
    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / fadeDurationMs)
      const eased = progress < 1 ? (1 - Math.cos(progress * Math.PI)) / 2 : 1
      element.volume = Math.min(target, target * eased)
      if (progress < 1) {
        this.remoteFadeRaf = requestAnimationFrame(step)
      } else {
        this.remoteFadeRaf = null
        element.volume = target
      }
    }
    this.remoteFadeRaf = requestAnimationFrame(step)
  }

  async refreshInstructions(reason = 'manual', options?: InstructionRefreshOptions): Promise<void> {
    const effectiveOptions = this.prepareInstructionOptions(options)
    await this.syncRealtimeInstructions(reason, effectiveOptions)
  }

  private async syncRealtimeInstructions(reason: string, options?: InstructionRefreshOptions): Promise<void> {
    if (!this.sessionReady || !this.sessionId || this.awaitingSessionAck) {
      this.instructionSyncPending = { reason, options }
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'dc',
        msg: 'instructions.refresh.deferred',
        data: {
          reason,
          hasSession: Boolean(this.sessionId),
          sessionReady: this.sessionReady,
          awaitingAck: this.awaitingSessionAck,
        },
      })
      return
    }

    const channel = this.activeChannel
    if (!channel || channel.readyState !== 'open') {
      this.instructionSyncPending = { reason, options }
      return
    }

    if (this.instructionSyncInFlight) {
      this.instructionSyncPending = { reason, options }
      return
    }

    this.instructionSyncPending = null
    this.instructionSyncInFlight = true
    const seq = ++this.instructionRefreshSeq
    this.emitDebug({
      t: new Date().toISOString(),
      kind: 'event',
      src: 'dc',
      msg: 'instructions.refresh.request',
      data: { reason, options },
    })

    try {
      const { instructions, phase: returnedPhase, outstanding_gate: outstandingGate } = await api.getVoiceInstructions(this.sessionId, options)
      if (seq !== this.instructionRefreshSeq) return
      const normalized = typeof instructions === 'string' ? instructions.trim() : ''
      if (!normalized) {
        this.emitDebug({
          t: new Date().toISOString(),
          kind: 'warn',
          src: 'dc',
          msg: 'instructions.refresh.empty',
          data: { reason },
        })
        return
      }
      let phaseChanged = false
      if (returnedPhase !== undefined) {
        const normalizedPhase = this.normalizePhase(returnedPhase)
        if (normalizedPhase !== this.encounterPhase) {
          this.encounterPhase = normalizedPhase
          phaseChanged = true
        }
      }

      const nextOutstanding = Array.isArray(outstandingGate) ? [...outstandingGate] : []
      const outstandingChanged = this.outstandingGate.length !== nextOutstanding.length || this.outstandingGate.some((value, idx) => value !== nextOutstanding[idx])
      this.outstandingGate = nextOutstanding

      const signature = JSON.stringify({
        instructions: normalized,
        phase: this.encounterPhase,
        outstanding: this.outstandingGate,
      })
      if (signature === this.lastInstructionPayload) {
        this.emitDebug({
          t: new Date().toISOString(),
          kind: 'info',
          src: 'dc',
          msg: 'instructions.refresh.skipped',
          data: { reason, length: normalized.length, phaseChanged, outstandingChanged },
        })
        return
      }

      if (channel.readyState !== 'open') {
        this.instructionSyncPending = { reason, options }
        return
      }

      const payload = {
        type: 'session.update',
        session: {
          instructions: normalized,
        },
      }
      channel.send(JSON.stringify(payload))
      this.lastInstructionPayload = signature
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'info',
        src: 'dc',
        msg: 'instructions.refresh.applied',
        data: {
          reason,
          length: normalized.length,
          phase: this.encounterPhase,
          outstanding: this.outstandingGate,
        },
      })
      this.emit({
        type: 'instructions',
        instructions: normalized,
        phase: this.encounterPhase,
        outstandingGate: this.outstandingGate.length ? [...this.outstandingGate] : undefined,
      })
    } catch (err) {
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'warn',
        src: 'dc',
        msg: 'instructions.refresh.error',
        data: { reason, error: err instanceof Error ? err.message : String(err) },
      })
    } finally {
      this.instructionSyncInFlight = false
      if (this.instructionSyncPending) {
        const pending = this.instructionSyncPending
        this.instructionSyncPending = null
        setTimeout(() => {
          void this.syncRealtimeInstructions(pending.reason, pending.options)
        }, 0)
      }
    }
  }

  private drainPendingInstructionSync(trigger: string): void {
    if (!this.sessionReady || !this.sessionId) return
    if (!this.instructionSyncPending) return
    if (this.instructionSyncInFlight) return

    const pending = this.instructionSyncPending
    this.instructionSyncPending = null
    this.emitDebug({
      t: new Date().toISOString(),
      kind: 'event',
      src: 'dc',
      msg: 'instructions.refresh.flush',
      data: { trigger, reason: pending.reason },
    })
    void this.syncRealtimeInstructions(pending.reason, pending.options)
  }

  private markSessionReady(trigger: string): void {
    if (this.sessionAckTimeout != null) {
      try { clearTimeout(this.sessionAckTimeout) } catch {}
      this.sessionAckTimeout = null
    }

    const wasAwaiting = this.awaitingSessionAck
    this.awaitingSessionAck = false
    const wasReady = this.sessionReady
    this.sessionReady = true

    this.emitDebug({
      t: new Date().toISOString(),
      kind: 'event',
      src: 'dc',
      msg: wasReady ? 'session.ready.duplicate' : 'session.ready',
      data: { trigger, wasAwaiting },
    })

    this.drainPendingInstructionSync(trigger)
  }

  private ensureSessionAckTimeout(): void {
    if (this.sessionAckTimeout != null) {
      try { clearTimeout(this.sessionAckTimeout) } catch {}
    }

    if (!this.sessionReady) {
      this.awaitingSessionAck = true
    }

    const warnDelayMs = 2500
    const forceDelayMs = 4000

    const scheduleForcedReady = () => {
      this.sessionAckTimeout = setTimeout(() => {
        this.sessionAckTimeout = null
        if (this.sessionReady) return
        this.emitDebug({
          t: new Date().toISOString(),
          kind: 'warn',
          src: 'dc',
          msg: 'session.updated.timeout',
          data: { trigger: 'timeout-force' },
        })
        this.markSessionReady('session.updated.timeout')
        if (!this.fullyReady && (this.connected || (this.pc && (this.pc.iceConnectionState === 'connected' || this.pc.iceConnectionState === 'completed')))) {
          this.emitDebug({
            t: new Date().toISOString(),
            kind: 'warn',
            src: 'dc',
            msg: 'connection-progress.fallback',
            data: { trigger: 'session.updated.timeout' },
          })
          this.fullyReady = true
          this.emit({ type: 'connection-progress', step: 'complete', progress: 100 })
          this.emit({ type: 'voice-ready' })
        }
      }, forceDelayMs)
    }

    this.sessionAckTimeout = setTimeout(() => {
      if (this.sessionReady) {
        this.sessionAckTimeout = null
        return
      }
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'warn',
        src: 'dc',
        msg: 'session.updated.waiting',
        data: { trigger: 'timeout-warning' },
      })
      scheduleForcedReady()
    }, warnDelayMs)
  }

  private attachDataChannelHandlers(channel: RTCDataChannel): void {
    channel.addEventListener('open', () => {
      this.emitDebug({ t: new Date().toISOString(), kind: 'event', src: 'dc', msg: 'open' })
      this.activeChannel = channel
      if (this.pingInterval != null) {
        clearInterval(this.pingInterval)
        this.pingInterval = null
      }
      this.refreshInstructions('datachannel.open').catch(() => {})
      this.ensureSessionAckTimeout()
      
      // Send session.update to enable transcription AND audio modalities immediately when channel opens
      // This handles both new sessions and reused sessions
      console.log('[ConversationController] Data channel opened, sending session.update for transcription & audio')
      try {
        const updateMsg = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],  // Ensure audio responses are enabled
            // Note: Transcription model is configured by backend via token request
          }
        }
        channel.send(JSON.stringify(updateMsg))
        console.log('[ConversationController] Transcription & audio modalities enabled via session.update on channel open')
      } catch (err) {
        console.error('[ConversationController] Failed to enable transcription on channel open:', err)
      }
    })
    channel.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        this.handleMessage(event.data)
      }
    })
    channel.addEventListener('error', (event) => {
      const desc = `error rs=${channel.readyState} buf=${channel.bufferedAmount} label=${channel.label}`
      const kind: 'warn' | 'error' = channel.readyState === 'open' ? 'warn' : 'error'
      this.emitDebug({ t: new Date().toISOString(), kind, src: 'dc', msg: desc, data: {
        readyState: channel.readyState,
        bufferedAmount: channel.bufferedAmount,
        label: channel.label,
        event,
      } })
    })
    channel.addEventListener('close', () => {
      this.emitDebug({ t: new Date().toISOString(), kind: 'warn', src: 'dc', msg: `close:${channel.label}:${channel.readyState}` })
      if (this.pingInterval != null) {
        clearInterval(this.pingInterval)
        this.pingInterval = null
      }
    })
  }


  private handleUserTranscript(text: string, isFinal: boolean, timings: TranscriptTimings): void {
    const startedAtMs = typeof timings?.startedAtMs === 'number' ? timings.startedAtMs : null
    const emittedAtMs = typeof timings?.emittedAtMs === 'number' ? timings.emittedAtMs : Date.now()
    const finalizedAtMs = typeof timings?.finalizedAtMs === 'number' ? timings.finalizedAtMs : (isFinal ? emittedAtMs : null)
    const eventTimestamp = isFinal ? (finalizedAtMs ?? emittedAtMs) : (startedAtMs ?? emittedAtMs)

    console.log('[ConversationController] 📤 handleUserTranscript called:', {
      isFinal,
      textLength: text.length,
      preview: text.slice(0, 50),
      listenerCount: this.listeners.size,
      backendMode: this.backendTranscriptMode,
      timings: { startedAtMs, emittedAtMs, finalizedAtMs },
      eventTimestamp,
    })

    // In backend mode: emit partials for typing animation, but skip finals (backend will broadcast those)
    if (this.backendTranscriptMode) {
      console.log('[ConversationController] 🔄 Backend mode enabled - emitting partial, finals come from backend')
      if (isFinal) {
        this.userPartial = ''
        return
      } else {
        this.userPartial = text
        this.emit({ type: 'transcript', role: TranscriptRole.User, text, isFinal, timestamp: eventTimestamp, timings })
        return
      }
    }

    if (isFinal) {
      this.userPartial = ''
      console.log('[ConversationController] 🎯 EMITTING FINAL USER TRANSCRIPT:', text.slice(0, 100))
      this.emit({ type: 'transcript', role: TranscriptRole.User, text, isFinal, timestamp: eventTimestamp, timings })
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'app',
        msg: 'transcript.user.final',
        data: {
          length: text.length,
          preview: text.length > 120 ? `${text.slice(0, 117)}...` : text,
        },
      })
    } else {
      this.userPartial = text
      this.emit({ type: 'partial', role: TranscriptRole.User, text })
      this.emit({ type: 'transcript', role: TranscriptRole.User, text, isFinal, timestamp: eventTimestamp, timings })
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'app',
        msg: 'transcript.user.delta',
        data: {
          length: text.length,
          preview: text.length > 120 ? `${text.slice(0, 117)}...` : text,
        },
      })
    }
  }

  private handleAssistantTranscript(text: string, isFinal: boolean, timings: TranscriptTimings): void {
    const startedAtMs = typeof timings?.startedAtMs === 'number' ? timings.startedAtMs : null
    const emittedAtMs = typeof timings?.emittedAtMs === 'number' ? timings.emittedAtMs : Date.now()
    const finalizedAtMs = typeof timings?.finalizedAtMs === 'number' ? timings.finalizedAtMs : (isFinal ? emittedAtMs : null)
    const eventTimestamp = isFinal ? (finalizedAtMs ?? emittedAtMs) : (startedAtMs ?? emittedAtMs)

    // In backend mode, transcripts are broadcast from backend - skip local emission
    // But still relay final transcripts to backend
    if (this.backendTranscriptMode) {
      // Update internal state
      if (isFinal) {
        this.assistantPartial = ''
        // Relay final assistant transcript to backend for unified broadcast
        this.relayTranscriptToBackend('assistant', text, true, eventTimestamp, timings).catch(err => {
          console.error('[ConversationController] Failed to relay assistant transcript:', err)
        })
      } else {
        this.assistantPartial = text
      }
      return
    }
    
    // Parse media markers from assistant responses
    const { cleanText, media } = this.parseMediaMarker(text)
    
    if (isFinal) {
      this.assistantPartial = ''
      this.emit({ type: 'transcript', role: TranscriptRole.Assistant, text: cleanText, isFinal, timestamp: eventTimestamp, media, timings })
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'app',
        msg: 'transcript.assistant.final',
        data: {
          length: cleanText.length,
          preview: cleanText.length > 120 ? `${cleanText.slice(0, 117)}...` : cleanText,
          hasMedia: Boolean(media),
        },
      })
    } else {
      this.assistantPartial = cleanText
      this.emit({ type: 'partial', role: TranscriptRole.Assistant, text: cleanText })
      this.emit({ type: 'transcript', role: TranscriptRole.Assistant, text: cleanText, isFinal, timestamp: eventTimestamp, media, timings })
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'app',
        msg: 'transcript.assistant.delta',
        data: {
          length: cleanText.length,
          preview: cleanText.length > 120 ? `${cleanText.slice(0, 117)}...` : cleanText,
          hasMedia: Boolean(media),
        },
      })
    }
  }

  private nextOp(): number {
    return ++this.opEpoch
  }

  private isOpStale(op: number): boolean {
    return this.opEpoch !== op
  }

  private invalidateOps(): void {
    this.opEpoch += 1
  }

  private async createSessionWithLogging(): Promise<{ session_id: string; reused: boolean }> {
    this.emitDebug({ t: new Date().toISOString(), kind: 'info', src: 'api', msg: 'creating session' })
    if (!this.personaId) throw new Error('personaId is required before creating a session')
    if (!this.scenarioId) throw new Error('scenarioId is required before creating a session')
    const created = await api.createSession(this.personaId, this.scenarioId)
    return { session_id: created.session_id, reused: false }
  }

  // Settings setters (single definitions)
  setVoiceOverride(v: string | null): void { this.voiceOverride = v }
  setInputLanguage(l: 'auto' | string): void { this.inputLanguage = l || 'auto' }
  setReplyLanguage(l: 'default' | string): void { this.replyLanguage = l || 'default' }
  setModel(m: string | null): void { this.model = m }
  setTranscriptionModel(m: string | null): void { this.transcriptionModel = m }
}
