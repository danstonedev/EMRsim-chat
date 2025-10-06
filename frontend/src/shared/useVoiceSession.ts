import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConversationController, ConversationEvent, InstructionRefreshOptions, VoiceDebugEvent, VoiceStatus } from './ConversationController'
import type { TranscriptTimings } from './transcript/TranscriptEngine'
import { recordVoiceEvent } from './telemetry'

export interface VoiceSessionOptions {
  personaId: string | null
  sessionId?: string | null
  scenarioId?: string | null
  onUserTranscript?: (text: string, isFinal: boolean, timestamp: number, timings?: TranscriptTimings) => void
  onAssistantTranscript?: (text: string, isFinal: boolean, timestamp: number, timings?: TranscriptTimings) => void
  onEvent?: (payload: unknown) => void
  debugEnabled?: boolean
  voice?: string | null
  inputLanguage?: 'auto' | string
  replyLanguage?: 'default' | string
}

export interface VoiceSessionHandle {
  status: VoiceStatus
  error: string | null
  start: () => Promise<void>
  stop: () => void
  pause: () => void
  resume: () => void
  sendText?: (text: string) => Promise<void>
  refreshInstructions: (reason?: string, options?: InstructionRefreshOptions) => Promise<void>
  remoteAudioRef: MutableRefObject<HTMLAudioElement | null>
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
  adaptive: { enabled: boolean; status: 'quiet' | 'noisy' | 'very-noisy'; noise: number; snr: number; threshold: number | null; silenceMs: number | null }
  updateEncounterState: (state: { phase?: string | null; gate?: Record<string, unknown> | null }, reason?: string) => void
  addEventListener: (listener: (e: VoiceDebugEvent) => void) => () => void
  addConversationListener: (listener: (e: ConversationEvent) => void) => () => void
}

export function useVoiceSession(options: VoiceSessionOptions): VoiceSessionHandle {
  const controllerRef = useRef<ConversationController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = new ConversationController({
      personaId: options.personaId ?? null,
      scenarioId: options.scenarioId ?? null,
      sessionId: options.sessionId ?? null,
      debugEnabled: options.debugEnabled,
      backendTranscriptMode: true,
    })
  }
  const controller = controllerRef.current!

  const initialSnapshotRef = useRef(controller.getSnapshot())
  const initialEncounterRef = useRef(controller.getEncounterState())
  const [status, setStatus] = useState<VoiceStatus>(initialSnapshotRef.current.status)
  const [error, setError] = useState<string | null>(initialSnapshotRef.current.error)
  const [sessionId, setSessionId] = useState<string | null>(initialSnapshotRef.current.sessionId)
  const [userPartial, setUserPartial] = useState(initialSnapshotRef.current.userPartial)
  const [assistantPartial, setAssistantPartial] = useState(initialSnapshotRef.current.assistantPartial)
  const [micLevel, setMicLevel] = useState(initialSnapshotRef.current.micLevel)
  const [debugEnabled, setDebugEnabled] = useState(controller.isDebugEnabled())
  const [micPaused, setMicPaused] = useState(controller.isMicPaused?.() ?? false)
  const [micStream, setMicStream] = useState<MediaStream | null>(controller.getMicStream())
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(controller.getPeerConnection())
  const [encounterPhase, setEncounterPhase] = useState<string | null>(initialEncounterRef.current.phase)
  const [encounterGate, setEncounterGate] = useState<Record<string, unknown> | null>(initialEncounterRef.current.gate)
  const [outstandingGate, setOutstandingGate] = useState<string[]>(initialEncounterRef.current.outstandingGate)
  const [adaptive, setAdaptive] = useState(controller.getAdaptiveSnapshot())

  const onUserTranscriptRef = useRef<VoiceSessionOptions['onUserTranscript']>(options.onUserTranscript)
  const onAssistantTranscriptRef = useRef<VoiceSessionOptions['onAssistantTranscript']>(options.onAssistantTranscript)

  useEffect(() => {
    onUserTranscriptRef.current = options.onUserTranscript
  }, [options.onUserTranscript])

  useEffect(() => {
    onAssistantTranscriptRef.current = options.onAssistantTranscript
  }, [options.onAssistantTranscript])

  useEffect(() => {
    controller.setPersonaId(options.personaId ?? null)
  }, [controller, options.personaId])

  useEffect(() => {
    controller.setScenarioId(options.scenarioId ?? null)
  }, [controller, options.scenarioId])

  useEffect(() => {
    controller.setExternalSessionId(options.sessionId ?? null)
    setSessionId(options.sessionId ?? null)
  }, [controller, options.sessionId])

  // Advanced overrides
  useEffect(() => {
    controller.setVoiceOverride(options.voice ?? null)
  }, [controller, options.voice])
  useEffect(() => {
    controller.setInputLanguage(options.inputLanguage ?? 'en-US')
  }, [controller, options.inputLanguage])
  useEffect(() => {
    controller.setReplyLanguage(options.replyLanguage ?? 'en-US')
  }, [controller, options.replyLanguage])

  useEffect(() => {
    controller.setRealtimeEventListener(options.onEvent ?? null)
    return () => {
      controller.setRealtimeEventListener(null)
    }
  }, [controller, options.onEvent])

  useEffect(() => {
    if (options.debugEnabled === undefined) return
    controller.setDebugEnabled(Boolean(options.debugEnabled))
    setDebugEnabled(controller.isDebugEnabled())
  }, [controller, options.debugEnabled])

  useEffect(() => {
    return () => {
      controller.dispose()
    }
  }, [controller])

  useEffect(() => {
    const listener = (event: ConversationEvent) => {
      switch (event.type) {
        case 'status':
          setStatus(event.status)
          setError(event.error)
          // Update mic stream and peer connection when status changes
          setMicStream(controller.getMicStream())
          setPeerConnection(controller.getPeerConnection())
          recordVoiceEvent({ type: 'status', status: event.status, error: event.error, sessionId: controller.getSessionId() })
          break
        case 'session':
          setSessionId(event.sessionId)
          {
            const snapshot = controller.getEncounterState()
            setEncounterPhase(snapshot.phase)
            setEncounterGate(snapshot.gate)
            setOutstandingGate(snapshot.outstandingGate)
          }
          break
        case 'partial':
          if (event.role === 'user') setUserPartial(event.text)
          else setAssistantPartial(event.text)
          break
        case 'mic-level':
          setMicLevel(event.level)
          // Update adaptive on mic ticks to keep it fresh without extra events
          setAdaptive(controller.getAdaptiveSnapshot())
          break
        case 'pause':
          setMicPaused(event.paused)
          break
        case 'transcript':
          if (event.role === 'user' && event.isFinal) {
            setUserPartial('')
          }
          if (event.role === 'assistant' && event.isFinal) {
            setAssistantPartial('')
          }
          const callback = event.role === 'user' ? onUserTranscriptRef.current : onAssistantTranscriptRef.current
          callback?.(event.text, event.isFinal, event.timestamp, event.timings)
          if (event.isFinal) {
            recordVoiceEvent({
              type: 'transcript',
              role: event.role,
              text: event.text,
              isFinal: true,
              timestamp: event.timestamp,
              timings: event.timings,
              sessionId: controller.getSessionId(),
            })
          }
          break
        case 'instructions':
          setEncounterPhase(event.phase ?? null)
          setOutstandingGate(event.outstandingGate ?? [])
          break
      }
    }
    return controller.addListener(listener)
  }, [controller])

  const remoteAudioRef = useMemo<MutableRefObject<HTMLAudioElement | null>>(() => {
    const holder: { current: HTMLAudioElement | null } = { current: null }
    Object.defineProperty(holder, 'current', {
      get: () => controller.getRemoteAudioElement(),
      set: (value: HTMLAudioElement | null) => {
        controller.attachRemoteAudioElement(value)
      },
      configurable: true,
      enumerable: true,
    })
    return holder as MutableRefObject<HTMLAudioElement | null>
  }, [controller])

  const start = useCallback(async () => {
    recordVoiceEvent({ type: 'start-request', personaId: options.personaId, scenarioId: options.scenarioId })
    try {
      await controller.startVoice()
      recordVoiceEvent({ type: 'start-success', sessionId: controller.getSessionId() })
    } catch (err) {
      recordVoiceEvent({ type: 'start-error', error: err instanceof Error ? err.message : String(err), sessionId: controller.getSessionId() })
      throw err
    }
  }, [controller, options.personaId, options.scenarioId])

  const stop = useCallback(() => {
    recordVoiceEvent({ type: 'stop', sessionId: controller.getSessionId() })
    controller.stopVoice()
  }, [controller])

  const pause = useCallback(() => {
    controller.setMicPaused?.(true)
  }, [controller])
  const resume = useCallback(() => {
    controller.setMicPaused?.(false)
  }, [controller])

  const sendText = useCallback((text: string) => {
    recordVoiceEvent({ type: 'send-text', length: text.length, sessionId: controller.getSessionId() })
    return controller.sendText(text)
  }, [controller])

  const refreshInstructions = useCallback((reason?: string, options?: InstructionRefreshOptions) => {
    return controller.refreshInstructions(reason, options)
  }, [controller])

  const updateEncounterState = useCallback((state: { phase?: string | null; gate?: Record<string, unknown> | null }, reason?: string) => {
    if (state && Object.prototype.hasOwnProperty.call(state, 'phase')) {
      setEncounterPhase(state.phase ?? null)
    }
    if (state && Object.prototype.hasOwnProperty.call(state, 'gate')) {
      setEncounterGate(state.gate ? { ...state.gate } : null)
    }
    controller.updateEncounterState(state, reason)
  }, [controller])

  const addEventListener = useCallback((listener: (e: VoiceDebugEvent) => void) => {
    return controller.addDebugListener(listener)
  }, [controller])

  const addConversationListener = useCallback((listener: (e: ConversationEvent) => void) => {
    return controller.addListener(listener)
  }, [controller])

  return {
    status,
    error,
    start,
    stop,
    pause,
    resume,
    sendText,
    refreshInstructions,
    remoteAudioRef,
    sessionId,
    userPartial,
    assistantPartial,
    micLevel,
    debugEnabled,
    micPaused,
    micStream,
    peerConnection,
    encounterPhase,
    encounterGate,
    outstandingGate,
    adaptive,
    updateEncounterState,
    addEventListener,
    addConversationListener,
  }
}
