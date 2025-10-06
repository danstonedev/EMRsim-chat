import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MicIcon from '@mui/icons-material/Mic'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import { api } from '../shared/api.ts'
import { featureFlags, FLAGS } from '../shared/flags.ts'
import { recordVoiceEvent } from '../shared/telemetry.ts'
import { useVoiceSession } from '../shared/useVoiceSession'
import CaseBuilder from './CaseBuilder'
import { Message, PersonaLite, ScenarioLite, createMessage, newId, nextSequenceId, sortMessages } from './chatShared'
import './App.css'
import { useAdvancedSettings } from '../shared/settingsContext'
import AdvancedSettingsDrawer from './components/AdvancedSettingsDrawer'
import { ChatView } from './components/ChatView'
import { DiagnosticsDrawer } from './components/DiagnosticsDrawer'
import { VoiceReadyToast } from './components/VoiceReadyToast'

const MAX_LOG_ITEMS = 200
const VOICE_DUPLICATE_WINDOW_MS = 4000

export default function App() {
  const [view, setView] = useState<'chat' | 'builder'>('chat')
  const [runtimeFeatures, setRuntimeFeatures] = useState(() => ({
    voiceEnabled: featureFlags.voiceEnabled,
    spsEnabled: featureFlags.spsEnabled,
    voiceDebug: featureFlags.voiceDebug,
  }))
  const [personas, setPersonas] = useState<PersonaLite[]>([])
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [ttftMs, setTtftMs] = useState<number | null>(null)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [health, setHealth] = useState<{ ok: boolean; uptime_s: number; db: string; openai: 'ok' | 'err' } | null>(null)
  const [logOpen, setLogOpen] = useState(featureFlags.voiceDebug)
  const [logItems, setLogItems] = useState<Array<{ t: string; kind: string; src: string; msg: string; data?: any }>>([])
  const [scenarios, setScenarios] = useState<ScenarioLite[]>([])
  const [scenarioId, setScenarioId] = useState<string>('')
  const [isComposing, setIsComposing] = useState(false)
  const [spsError, setSpsError] = useState<string | null>(null)
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false)
  const [micActionsOpen, setMicActionsOpen] = useState(false)
  const [postStopOpen, setPostStopOpen] = useState(false)
  const [latestInstructions, setLatestInstructions] = useState('')
  const [persistenceError, setPersistenceError] = useState<{ message: string; timestamp: number } | null>(null)
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(false)
  const [pendingElapsed, setPendingElapsed] = useState<Record<string, number>>({})
  const [showVoiceReadyToast, setShowVoiceReadyToast] = useState(false)
  
  // Connection progress state
  const [connectionProgress, setConnectionProgress] = useState<{
    step: 'mic' | 'session' | 'token' | 'webrtc' | 'complete'
    progress: number
    estimatedMs?: number
  } | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const firstDeltaRef = useRef<number | null>(null)
  const voiceUserIdRef = useRef<string | null>(null)
  const voiceAssistantIdRef = useRef<string | null>(null)
  const voiceUserStartTimeRef = useRef<number | null>(null)
  const voiceAssistantStartTimeRef = useRef<number | null>(null)
  const lastVoiceFinalUserRef = useRef<string>('')
  const lastVoiceFinalAssistantRef = useRef<string>('')
  const lastVoiceFinalUserTsRef = useRef<number | null>(null)
  const lastVoiceFinalAssistantTsRef = useRef<number | null>(null)
  const recentTypedUserRef = useRef<{ text: string; ts: number } | null>(null)
  const textAssistantIdRef = useRef<string | null>(null)
  const textUserStartTimeRef = useRef<number | null>(null)
  const updateQueueRef = useRef<(() => void)[]>([])
  const processingQueueRef = useRef(false)
  const queueGenerationRef = useRef(0)
  const prevUserPartialRef = useRef<string>('')
  const prevAssistantPartialRef = useRef<string>('')
  const prevVoiceStatusRef = useRef<'idle' | 'connecting' | 'connected' | 'error' | null>(null)

  const sortedMessages = useMemo(() => sortMessages(messages), [messages])
  const caseSetupIds = useMemo(() => ({
    section: `case-setup-${newId()}`,
    title: `case-setup-title-${newId()}`,
  }), [])

  const queueMessageUpdate = useCallback((updateFn: () => void) => {
    const generation = queueGenerationRef.current
    updateQueueRef.current.push(() => {
      if (queueGenerationRef.current !== generation) return
      updateFn()
    })
    if (processingQueueRef.current) return

    processingQueueRef.current = true
    setTimeout(() => {
      const queue = updateQueueRef.current
      updateQueueRef.current = []
      queue.forEach(fn => fn())
      processingQueueRef.current = false
    }, 0)
  }, [])

  const resetVoiceTrackingState = useCallback((options?: { clearQueue?: boolean; resetFirstDelta?: boolean }) => {
    voiceUserIdRef.current = null
    voiceAssistantIdRef.current = null
    voiceUserStartTimeRef.current = null
    voiceAssistantStartTimeRef.current = null
    textAssistantIdRef.current = null
    textUserStartTimeRef.current = null
    recentTypedUserRef.current = null
    lastVoiceFinalUserRef.current = ''
    lastVoiceFinalAssistantRef.current = ''
    lastVoiceFinalUserTsRef.current = null
    lastVoiceFinalAssistantTsRef.current = null
    prevUserPartialRef.current = ''
    prevAssistantPartialRef.current = ''
    if (options?.resetFirstDelta) {
      firstDeltaRef.current = null
    }
    if (options?.clearQueue) {
      queueGenerationRef.current += 1
      updateQueueRef.current = []
      processingQueueRef.current = false
    }
  }, [])

  useEffect(() => {
    resetVoiceTrackingState({ clearQueue: true, resetFirstDelta: true })
  }, [personaId, resetVoiceTrackingState])

  useEffect(() => {
    resetVoiceTrackingState({ clearQueue: true, resetFirstDelta: true })
    setTtftMs(null)
  }, [sessionId, resetVoiceTrackingState])

  // Smart auto-scroll: only scroll if user is near bottom (prevents interrupting review of older messages)
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return true // Default to scrolling if ref not set
    const threshold = 150 // pixels from bottom
    const position = container.scrollHeight - container.scrollTop - container.clientHeight
    return position < threshold
  }, [])

  useEffect(() => {
    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [sortedMessages, isNearBottom])

  const updateVoiceMessage = useCallback((role: 'user' | 'assistant', text: string, isFinal: boolean, timestamp: number) => {
    const ref = role === 'user' ? voiceUserIdRef : voiceAssistantIdRef
    const startTimeRef = role === 'user' ? voiceUserStartTimeRef : voiceAssistantStartTimeRef
    const lastFinalRef = role === 'user' ? lastVoiceFinalUserRef : lastVoiceFinalAssistantRef
    const lastFinalTsRef = role === 'user' ? lastVoiceFinalUserTsRef : lastVoiceFinalAssistantTsRef
    const safeTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now()

    queueMessageUpdate(() => {
      // Clear loading state when first message arrives
      setIsLoadingInitialData(false)
      
      setMessages(prev => {
        let id = ref.current

        // If we don't have an active voice bubble for this role, create one
        if (!id) {
          // If a typed message was just submitted with the same timestamp, prefer the typed bubble
          if (role === 'user') {
            const nearTyped = prev.find(m => m.role === 'user' && m.channel === 'text' && Math.abs(m.timestamp - safeTimestamp) < 2000)
            if (nearTyped) {
              // Do not create a competing voice bubble; just update the typed one if it's pending
              return sortMessages(prev.map(m => m.id === nearTyped.id ? { ...m, text, pending: !isFinal } : m))
            }
          }
          // Check for duplicate finals within a short time window
          if (text && lastFinalRef.current && text === lastFinalRef.current) {
            const lastTs = lastFinalTsRef.current
            if (typeof lastTs === 'number' && Math.abs(safeTimestamp - lastTs) <= VOICE_DUPLICATE_WINDOW_MS) {
              return sortMessages(prev)
            }
          }

          // Check if the most recent message from this role (voice) already equals this text and is final
          for (let i = prev.length - 1; i >= 0; i--) {
            const m = prev[i]
            if (m.role === role && m.channel === 'voice') {
              if (!m.pending && m.text === text && Math.abs(safeTimestamp - m.timestamp) <= VOICE_DUPLICATE_WINDOW_MS) {
                return sortMessages(prev)
              }
              break
            }
          }

          // Capture the timestamp when voice transcription first starts (not when it completes)
          // This ensures the message sorts by when the turn STARTED, not when the first event arrived
          if (!startTimeRef.current) {
            startTimeRef.current = safeTimestamp
          }

          if (role === 'user' && !isFinal) {
            // For user turns, defer bubble creation until the transcript is final to avoid flicker
            return sortMessages(prev)
          }

          // Create new voice message with the voice recording start timestamp
          id = newId()
          ref.current = id
          const newMessage = createMessage(role, text, 'voice', {
            pending: !isFinal,
            id,
            timestamp: startTimeRef.current  // Use turn start time for consistent ordering
          })

          // Add to messages and sort by timestamp for proper ordering
          return sortMessages([...prev, newMessage])
        }

        // Update existing streaming bubble
        // Guard: ignore empty, non-final updates (e.g., repeated speech_started) that would
        // otherwise overwrite visible text and render an ellipsis.
        const updated = prev.map(msg => {
          if (msg.id !== id) return msg
          if (!isFinal && text === '' && msg.text && msg.text.length > 0) {
            return msg
          }
          return { ...msg, text, pending: !isFinal }
        })

        return sortMessages(updated)
      })

      if (isFinal) {
        // Remember the last finalized line and clear the active id
        if (role === 'user') {
          lastVoiceFinalUserRef.current = text
          lastVoiceFinalUserTsRef.current = safeTimestamp
        } else {
          lastVoiceFinalAssistantRef.current = text
          lastVoiceFinalAssistantTsRef.current = safeTimestamp
        }
        ref.current = null
        startTimeRef.current = null
      }
    })

    // Persist finalized voice turns to backend (guard duplicates against recent typed input)
    if (isFinal && text && text.trim() && sessionId) {
      const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
      if (role === 'user') {
        const recent = recentTypedUserRef.current
        if (recent && Date.now() - recent.ts < 3000 && norm(recent.text) === norm(text)) {
          // Skip persisting duplicate: same content just typed moments ago
          console.log('[App] Skipped persisting duplicate user turn (recently typed):', { textPreview: text.slice(0, 50) })
          return
        }
      }
      // Fire-and-forget persistence; non-fatal on error
      console.log('[App] Persisting voice turn:', { 
        role, 
        channel: 'audio', 
        textLength: text.length, 
        timestamp: safeTimestamp,
        timestampDate: new Date(safeTimestamp).toISOString(),
        textPreview: text.slice(0, 50)
      })
      api.saveSpsTurns(sessionId, [{ role, text, channel: 'audio', timestamp_ms: safeTimestamp }])
        .then(res => {
          console.log('[App] Turn persisted:', { role, saved: res.saved, duplicates: res.duplicates })
          recordVoiceEvent({ type: 'turn-persist', role, saved: res.saved ?? 0, duplicates: res.duplicates ?? 0, sessionId })
        })
        .catch(e => {
          console.error('[App] Turn persist failed:', { role, error: e instanceof Error ? e.message : String(e) })
          recordVoiceEvent({ type: 'turn-persist-error', role, error: e instanceof Error ? e.message : String(e), sessionId })
          console.warn('[sps] save voice turn failed', e)
          setPersistenceError({ message: 'Failed to save transcript', timestamp: Date.now() })
        })
    }
  }, [queueMessageUpdate, sessionId])

  // Update the assistant text bubble created for typed input (DC transcripts or SSE deltas)
  const updateAssistantTextMessage = useCallback((text: string, isFinal: boolean, timestamp: number, opts?: { append?: boolean; preserveOnFinalEmpty?: boolean }) => {
    const id = textAssistantIdRef.current
    if (!id) {
      // No pending typed assistant bubble; fall back to voice handling (covers audio transcript cases)
      updateVoiceMessage('assistant', text, isFinal, timestamp)
      return
    }
    queueMessageUpdate(() => {
      setMessages(prev => {
        let found = false
        const updated = prev.map(msg => {
          if (msg.id !== id) return msg
          found = true
          // Stamp timestamp/sequence on first delta
          const stampedTs = msg.timestamp && msg.timestamp > 0 ? msg.timestamp : timestamp
          const stampedSeq = msg.sequenceId && msg.sequenceId > 0 ? msg.sequenceId : nextSequenceId()
          let nextText = text
          if (opts?.append && !isFinal) {
            nextText = (msg.text || '') + (text || '')
          } else if (isFinal && opts?.preserveOnFinalEmpty && (!text || text.length === 0)) {
            nextText = msg.text || ''
          }
          return { ...msg, text: nextText, pending: !isFinal, timestamp: stampedTs, sequenceId: stampedSeq }
        })
        return sortMessages(found ? updated : prev)
      })
    })
    if (!isFinal && firstDeltaRef.current == null) {
      firstDeltaRef.current = timestamp
      // Prefer voice start time when in a voice session; fall back to typed user start.
      const voiceStart = voiceUserStartTimeRef.current
      const typedStart = textUserStartTimeRef.current
      const start = (voiceStart != null ? voiceStart : typedStart)
      if (start != null) setTtftMs(timestamp - start)
    }
    if (isFinal) {
      textAssistantIdRef.current = null
      if (sessionId) {
        const payloadText = text && text.trim() ? text : (messages.find(m => m.id === id)?.text || '')
        if (payloadText && payloadText.trim()) {
          console.log('[App] Persisting assistant text turn:', { channel: 'text', textLength: payloadText.length, timestamp })
          api.saveSpsTurns(sessionId, [{ role: 'assistant', text: payloadText, channel: 'text', timestamp_ms: timestamp }])
            .then(res => {
              console.log('[App] Assistant turn persisted:', { saved: res.saved, duplicates: res.duplicates })
            })
            .catch(err => {
              console.error('[App] Assistant turn persist failed:', err)
              console.warn('[sps] save assistant turn failed', err)
              setPersistenceError({ message: 'Failed to save transcript', timestamp: Date.now() })
            })
        }
      }
    }
  }, [queueMessageUpdate, sessionId, messages, updateVoiceMessage])

  const handleUserTranscript = useCallback((text: string, isFinal: boolean, timestamp: number) => {
    updateVoiceMessage('user', text, isFinal, timestamp)
    // Dismiss voice ready toast when user starts speaking
    if (showVoiceReadyToast) {
      setShowVoiceReadyToast(false)
    }
  }, [updateVoiceMessage, showVoiceReadyToast])

  const handleAssistantTranscript = useCallback((text: string, isFinal: boolean, timestamp: number) => {
    updateAssistantTextMessage(text, isFinal, timestamp)
  }, [updateAssistantTextMessage])

  // Enable diagnostics based on flags; do not couple to drawer open state so logging can start before UI is opened.
  const diagnosticsEnabledFlag = runtimeFeatures.voiceDebug || featureFlags.voiceDebug

  // Settings integration
  const { settings } = useAdvancedSettings()

  const voiceSession = useVoiceSession({
    personaId,
    scenarioId: scenarioId || null,
    sessionId,
    onUserTranscript: handleUserTranscript,
    onAssistantTranscript: handleAssistantTranscript,
  // Enable debug either via flags or while the Diagnostics drawer is open; otherwise allow controller defaults
  debugEnabled: (diagnosticsEnabledFlag || logOpen) ? true : undefined,
    voice: settings.voice,
    inputLanguage: settings.inputLanguage,
    replyLanguage: settings.replyLanguage,
  })

  useEffect(() => {
    const prevStatus = prevVoiceStatusRef.current
    const currentStatus = voiceSession.status
    prevVoiceStatusRef.current = currentStatus

    const prevWasActive = prevStatus === 'connecting' || prevStatus === 'connected'
    const startingFresh = currentStatus === 'connecting' && !prevWasActive
    const endingSession = (currentStatus === 'idle' || currentStatus === 'error') && prevWasActive

    if (startingFresh) {
      resetVoiceTrackingState({ resetFirstDelta: true })
      setTtftMs(null)
    } else if (endingSession) {
      resetVoiceTrackingState({ clearQueue: true, resetFirstDelta: true })
    }
  }, [voiceSession.status, resetVoiceTrackingState])

  const {
    updateEncounterState: updateEncounterStateRef,
    encounterPhase: sessionPhase,
    outstandingGate: sessionOutstandingGate,
  } = voiceSession

  const instructionsPreview = useMemo(() => {
    const text = latestInstructions.trim()
    if (!text) return ''
    return text.length > 480 ? `${text.slice(0, 480)}…` : text
  }, [latestInstructions])

  useEffect(() => {
    const prev = prevUserPartialRef.current
    prevUserPartialRef.current = voiceSession.userPartial
    const hadPartial = typeof prev === 'string' && prev.trim().length > 0
    const cleared = voiceSession.userPartial.trim().length === 0
    if (!hadPartial || !cleared) return

    queueMessageUpdate(() => {
      setMessages(prevMessages => {
        let mutated = false
        const updated = prevMessages.map(msg => {
          if (msg.role === 'user' && msg.channel === 'voice' && msg.pending) {
            mutated = true
            return { ...msg, pending: false }
          }
          return msg
        })
        return mutated ? sortMessages(updated) : prevMessages
      })
    })
  }, [queueMessageUpdate, voiceSession.userPartial])

  useEffect(() => {
    const prev = prevAssistantPartialRef.current
    prevAssistantPartialRef.current = voiceSession.assistantPartial
    const hadPartial = typeof prev === 'string' && prev.trim().length > 0
    const cleared = voiceSession.assistantPartial.trim().length === 0
    if (!hadPartial || !cleared) return

    queueMessageUpdate(() => {
      setMessages(prevMessages => {
        let mutated = false
        const updated = prevMessages.map(msg => {
          if (msg.role === 'assistant' && msg.channel === 'voice' && msg.pending) {
            mutated = true
            return { ...msg, pending: false }
          }
          return msg
        })
        return mutated ? sortMessages(updated) : prevMessages
      })
    })
  }, [queueMessageUpdate, voiceSession.assistantPartial])

  // When mic is paused or session ends, finalize any pending bubbles so the UI doesn't look "in progress".
  const finalizePendingMessages = useCallback(() => {
    queueMessageUpdate(() => {
      setMessages(prevMessages => {
        let mutated = false
        const updated = prevMessages.map(msg => {
          if (msg.pending) {
            mutated = true
            return { ...msg, pending: false }
          }
          return msg
        })
        return mutated ? sortMessages(updated) : prevMessages
      })
    })
  }, [queueMessageUpdate])

  // Finalize when mic is paused
  useEffect(() => {
    if (voiceSession.micPaused) finalizePendingMessages()
  }, [voiceSession.micPaused, finalizePendingMessages])

  // Finalize when session is not connected (idle/error) — i.e., after end.
  useEffect(() => {
    const s = voiceSession.status
    if (s !== 'connected' && s !== 'connecting') finalizePendingMessages()
  }, [voiceSession.status, finalizePendingMessages])

  // Auto-dismiss persistence error after 5 seconds
  useEffect(() => {
    if (!persistenceError) return
    const timeout = setTimeout(() => {
      setPersistenceError(null)
    }, 5000)
    return () => clearTimeout(timeout)
  }, [persistenceError])

  // Track elapsed time for pending voice transcripts
  useEffect(() => {
    const pendingMessages = sortedMessages.filter(m => m.pending && m.channel === 'voice')
    if (pendingMessages.length === 0) {
      setPendingElapsed({})
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const newElapsed: Record<string, number> = {}
      
      pendingMessages.forEach(m => {
        const elapsedSeconds = Math.floor((now - m.timestamp) / 1000)
        if (elapsedSeconds >= 3) {
          newElapsed[m.id] = elapsedSeconds
        }
      })
      
      setPendingElapsed(newElapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [sortedMessages])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([api.getSpsPersonas(), api.getSpsScenarios(), api.getHealth()])
      .then(results => {
        if (cancelled) return
        const [personasRes, scenariosRes, healthRes] = results

        if (personasRes.status === 'fulfilled') {
          setPersonas(personasRes.value.map(p => ({
            id: p.id,
            display_name: p.display_name ?? p.id,
            headline: p.headline ?? null,
            age: typeof p.age === 'number' ? p.age : null,
            sex: typeof p.sex === 'string' ? p.sex : null,
            voice: typeof p.voice === 'string' && p.voice.trim() ? p.voice.trim() : null,
            tags: Array.isArray(p.tags) ? p.tags.filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0).map(tag => tag.trim()) : [],
          })))
        } else {
          setPersonas([])
        }

        if (scenariosRes.status === 'fulfilled') {
          const raw = Array.isArray(scenariosRes.value) ? scenariosRes.value : []
          setScenarios(raw.map((s: any) => ({
            scenario_id: s.scenario_id,
            title: s.title,
            region: s.region ?? null,
            difficulty: s.difficulty ?? null,
            setting: s.setting ?? null,
            tags: Array.isArray(s.tags) ? s.tags : [],
            persona_id: s.persona_id ?? null,
            persona_name: s.persona_name ?? null,
            persona_headline: s.persona_headline ?? null,
          })))
        } else {
          setScenarios([])
        }

        if (healthRes.status === 'fulfilled') {
          const healthPayload = healthRes.value
          setHealth(healthPayload)
          setBackendOk(true)
          const features = healthPayload.features ?? {}
          setRuntimeFeatures(() => ({
            voiceEnabled: features.voiceEnabled ?? featureFlags.voiceEnabled,
            spsEnabled: features.spsEnabled ?? featureFlags.spsEnabled,
            voiceDebug: features.voiceDebug ?? featureFlags.voiceDebug,
          }))
        } else {
          setBackendOk(false)
          setRuntimeFeatures(prev => ({
            voiceEnabled: false,
            spsEnabled: false,
            voiceDebug: prev.voiceDebug,
          }))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBackendOk(false)
          setPersonas([])
          setScenarios([])
          setRuntimeFeatures(prev => ({
            voiceEnabled: false,
            spsEnabled: false,
            voiceDebug: prev.voiceDebug,
          }))
        }
      })
    return () => { cancelled = true }
  }, [])

  // Reset encounter state when persona or scenario selection changes
  useEffect(() => {
    setSessionId(null)
    setMessages([])
    setSpsError(null)
    setLatestInstructions('')
    updateEncounterStateRef({ phase: null, gate: null }, 'encounter.reset.selection')
  }, [personaId, scenarioId, runtimeFeatures.spsEnabled, updateEncounterStateRef])

  const composeEncounter = useCallback(async () => {
    if (!personaId || !scenarioId) {
      setSpsError('Select both a persona and a scenario before starting an encounter.')
      return
    }
    if (!runtimeFeatures.spsEnabled) {
      setSpsError('SPS encounters are currently disabled by the backend. Please retry later.')
      return
    }
    setIsComposing(true)
    setIsLoadingInitialData(true)
    setSpsError(null)
    setMessages([])
    setTtftMs(null)
    setLatestInstructions('')
    firstDeltaRef.current = null
    try {
      const result = await api.createSession(personaId, scenarioId)
      setSessionId(result.session_id)
      const nextPhase = typeof result.phase === 'string' ? result.phase : null
      const nextGate = (result && typeof result.gate === 'object' && result.gate !== null) ? result.gate as Record<string, unknown> : null
      updateEncounterStateRef({ phase: nextPhase, gate: nextGate }, 'encounter.composed')
      // Keep loading state until first message arrives
    } catch (err) {
      setSessionId(null)
      setSpsError(err instanceof Error ? err.message : String(err))
      updateEncounterStateRef({ phase: null, gate: null }, 'encounter.composed.error')
      setIsLoadingInitialData(false)
    } finally {
      setIsComposing(false)
    }
  }, [personaId, scenarioId, runtimeFeatures.spsEnabled, updateEncounterStateRef])

  // Auto-create encounter when both persona and scenario are selected
  useEffect(() => {
    if (!personaId || !scenarioId || !runtimeFeatures.spsEnabled) return
    if (sessionId || isComposing) return // Don't create if already have session or composing
    
    // Small delay to prevent rapid re-creation when switching selections
    const timer = setTimeout(() => {
      composeEncounter()
    }, 300)
    
    return () => clearTimeout(timer)
  }, [personaId, scenarioId, runtimeFeatures.spsEnabled, sessionId, isComposing, composeEncounter])

  useEffect(() => {
    const off = voiceSession.addEventListener((e) => {
      if (e.msg === 'session.reuse.detected') {
        resetVoiceTrackingState({ clearQueue: true, resetFirstDelta: true })
        setTtftMs(null)
      }
      setLogItems(prev => {
        const next = [...prev, { t: e.t, kind: e.kind, src: e.src, msg: e.msg, data: e.data }]
        return next.slice(-MAX_LOG_ITEMS)
      })
    })
    return off
    // Intentionally subscribe once; addEventListener is stable and controller persists.
    // Re-subscribing on each render can create a feedback loop with frequent updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for conversation events (progress, stream ready, etc.)
  useEffect(() => {
    const off = voiceSession.addConversationListener((e) => {
      if (e.type === 'instructions') {
        setLatestInstructions(e.instructions ?? '')
        return
      }
      if (e.type === 'connection-progress') {
        setConnectionProgress({
          step: e.step,
          progress: e.progress,
          estimatedMs: e.estimatedMs
        })
      }
      
      // Clear progress only when controller reports step=complete
      if (e.type === 'connection-progress' && e.step === 'complete') {
        // small delay for nicer UX
        setTimeout(() => setConnectionProgress(null), 500)
      }
      
      // Show voice ready toast when connection is established
      if (e.type === 'voice-ready') {
        setShowVoiceReadyToast(true)
      }
      
      // Reset progress on error
      if (e.type === 'status' && e.status === 'error') {
        setConnectionProgress(null)
      }
    })
    return off
  }, [voiceSession])

  // Close print dropdown when clicking outside
  useEffect(() => {
    if (!printDropdownOpen) return
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.print-dropdown-container')) {
        setPrintDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [printDropdownOpen])

  // Close mic popovers when clicking outside
  useEffect(() => {
    if (!micActionsOpen && !postStopOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (micActionsOpen && !target.closest('.mic-popover-container')) setMicActionsOpen(false)
      if (postStopOpen && !target.closest('.mic-poststop-container')) setPostStopOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [micActionsOpen, postStopOpen])

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug('[voice] feature flag VOICE_ENABLED =', runtimeFeatures.voiceEnabled)
      console.debug('[voice] feature flag SPS_ENABLED =', runtimeFeatures.spsEnabled)
      console.debug('[voice] raw VITE_VOICE_ENABLED =', import.meta.env.VITE_VOICE_ENABLED)
      console.debug('[voice] FLAGS.VOICE_ENABLED =', FLAGS.VOICE_ENABLED)
    }
  }, [runtimeFeatures.voiceEnabled, runtimeFeatures.spsEnabled])

  // Auto-start Live Chat after an encounter is created, with a small buffer and limited retries.
  // This avoids "start requested without scenario (SPS-only)" by only starting once a sessionId exists.
  const autostartStateRef = useRef<{ timer: number | null; retries: number; attemptedFor: string | null }>({ timer: null, retries: 0, attemptedFor: null })
  useEffect(() => {
    // Only auto-start when:
    // - Voice feature is enabled
    // - Autostart is explicitly enabled via flag
    // - An SPS session exists (sessionId)
    // - We're not already connecting/connected
    // - We're not composing a new session
  if (!runtimeFeatures.voiceEnabled || !runtimeFeatures.spsEnabled) return
  if (!(settings.autostart || FLAGS.VOICE_AUTOSTART)) return
    if (!sessionId) return
    if (isComposing) return
    if (voiceSession.status === 'connected' || voiceSession.status === 'connecting') return

    if (autostartStateRef.current.attemptedFor === sessionId) return
    autostartStateRef.current.attemptedFor = sessionId
    autostartStateRef.current.retries = 0

    const delay = Number((import.meta as any)?.env?.VITE_VOICE_AUTOSTART_DELAY_MS) || 250
    const retryMs = Number((import.meta as any)?.env?.VITE_VOICE_AUTOSTART_RETRY_MS) || 500
    const maxRetries = Number((import.meta as any)?.env?.VITE_VOICE_AUTOSTART_MAX_RETRIES) || 2

    const tryStart = async () => {
      try {
        await voiceSession.start()
      } catch {
        if (autostartStateRef.current.retries < maxRetries) {
          autostartStateRef.current.retries += 1
          autostartStateRef.current.timer = window.setTimeout(tryStart, retryMs) as unknown as number
        }
      }
    }

    autostartStateRef.current.timer = window.setTimeout(tryStart, delay) as unknown as number

    return () => {
      if (autostartStateRef.current.timer != null) {
        try { window.clearTimeout(autostartStateRef.current.timer) } catch { }
        autostartStateRef.current.timer = null
      }
    }
  }, [runtimeFeatures.voiceEnabled, runtimeFeatures.spsEnabled, sessionId, isComposing, voiceSession.status, voiceSession.start, settings.autostart])

  const isVoiceConnecting = voiceSession.status === 'connecting'
  let voiceDisabledReason: string | null = null
  if (!runtimeFeatures.voiceEnabled) {
    voiceDisabledReason = 'Voice mode is disabled by configuration. Update VITE_VOICE_ENABLED or backend VOICE_ENABLED to re-enable.'
  } else if (!runtimeFeatures.spsEnabled) {
    voiceDisabledReason = 'Voice is currently unavailable for SPS encounters. Check backend health configuration.'
  } else if (isComposing) {
    voiceDisabledReason = 'We\'re composing the SPS encounter. Voice will unlock once the session is ready.'
  } else if (!sessionId) {
    voiceDisabledReason = 'Start the encounter to unlock realtime voice.'
  }

  const voiceLocked = Boolean(voiceDisabledReason)
  const voiceButtonDisabled =
    voiceLocked ||
    !sessionId ||
    isComposing ||
    isVoiceConnecting
  const voiceButtonTooltip = voiceLocked
    ? voiceDisabledReason ?? undefined
    : isVoiceConnecting
      ? 'Voice session is connecting…'
      : undefined

  let voiceErrorMessage: string | null = null
  if (!voiceLocked && voiceSession.error) {
    if (voiceSession.error === 'no_microphone_support') {
      voiceErrorMessage = 'Microphone access is unavailable. Try a supported browser or enable microphone permissions.'
    } else if (/token/i.test(voiceSession.error)) {
      voiceErrorMessage = 'Could not fetch a voice token. Check backend logs or retry shortly.'
    } else if (/sdp|handshake/i.test(voiceSession.error)) {
      voiceErrorMessage = 'Voice handshake failed. Please try again.'
    } else {
      voiceErrorMessage = `Voice session error: ${voiceSession.error}`
    }
  }

  const statusClass = voiceSession.status === 'connected'
    ? 'status-chip status-chip--speaking'
    : isVoiceConnecting
      ? 'status-chip status-chip--listening'
      : 'status-chip status-chip--idle'
  const selectedPersona = useMemo(() => personas.find(p => p.id === personaId) ?? null, [personas, personaId])
  const selectedScenario = useMemo(() => scenarios.find(s => s.scenario_id === scenarioId) ?? null, [scenarios, scenarioId])

  const handlePrintScenario = useCallback(() => {
    if (!personaId || !scenarioId) return false
    api.openSpsExport(personaId, scenarioId)
    return true
  }, [personaId, scenarioId])

  const handlePrintTranscript = useCallback(() => {
    if (!sessionId) return false
    api.openTranscriptExport(sessionId)
    return true
  }, [sessionId])

  const handleCopyLogs = useCallback(() => {
    try {
      const text = logItems.map(li => {
        const preview = typeof li.data?.preview === 'string' ? li.data.preview
          : typeof li.data?.text === 'string' ? li.data.text
          : typeof li.data?.transcript === 'string' ? li.data.transcript
          : typeof li.data?.delta === 'string' ? li.data.delta
          : ''
        const suffix = preview ? ` — ${preview}` : ''
        return `${li.t} ${li.kind.toUpperCase()} ${li.src}: ${li.msg}${suffix}`
      }).join('\n')
      navigator.clipboard?.writeText(text)
    } catch {
      // no-op: clipboard may be unavailable
    }
  }, [logItems])

  // Advanced settings drawer state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const requestReconnect = useCallback(() => {
    if (voiceSession.status === 'connected') {
      try { voiceSession.stop() } catch {}
      voiceSession.start().catch(() => {})
    }
  }, [voiceSession])

  const renderMicControl = () => (
    <div className="mic-popover-container">
      <button
        type="button"
        className="icon-btn"
        data-voice-connected={voiceSession.status === 'connected'}
        data-voice-ready={!voiceButtonDisabled && voiceSession.status !== 'connected'}
        disabled={voiceButtonDisabled}
        onClick={() => {
          if (voiceLocked) return
          if (voiceSession.status === 'connected') {
            if (!voiceSession.micPaused) {
              try { voiceSession.pause() } catch {}
            }
            setMicActionsOpen(true)
          } else {
            console.log('[DEBUG] Starting voice session')
            voiceSession.start().catch((error) => {
              console.error('[DEBUG] Voice session start failed:', error)
            })
          }
        }}
        aria-label={voiceSession.status === 'connected' ? (voiceSession.micPaused ? 'Show resume/end options' : 'Pause and show options') : 'Start voice chat'}
        title={voiceButtonTooltip}
        aria-haspopup="menu"
      >
        {voiceSession.status === 'connected' && voiceSession.micPaused
          ? <PauseIcon fontSize="small" />
          : <MicIcon fontSize="small" />}
      </button>
      {micActionsOpen && voiceSession.status === 'connected' && (
        <div className="mic-popover-menu" role="menu" aria-label="Recording options">
          <button
            type="button"
            className="mic-popover-item"
            role="menuitem"
            onClick={() => {
              if (voiceSession.micPaused) voiceSession.resume()
              else voiceSession.pause()
              setMicActionsOpen(false)
            }}
            title={voiceSession.micPaused ? 'Resume speaking' : 'Pause microphone'}
          >
            <PlayArrowIcon fontSize="small" />
            <span>{voiceSession.micPaused ? 'Resume speaking' : 'Pause mic'}</span>
          </button>
          <button
            type="button"
            className="mic-popover-item mic-popover-item--danger"
            role="menuitem"
            onClick={() => {
              setMicActionsOpen(false)
              try { voiceSession.stop() } finally { setPostStopOpen(true) }
            }}
            title="End encounter recording"
          >
            <StopIcon fontSize="small" />
            <span>End encounter</span>
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="app-root app-shell">
      <header className="header app-nav app-nav--dark" role="banner">
        <div className="nav-inner">
          <div className="nav-brand">
            <div className="title header__brand" aria-label="Application">UND Sim Patient</div>
          </div>
          <nav className="header-nav" aria-label="Primary">
            <ul className="nav-tabs">
              <li>
                <button
                  type="button"
                  className="nav-pill"
                  data-active={view === 'builder'}
                  onClick={() => setView(v => v === 'chat' ? 'builder' : 'chat')}
                  title={view === 'chat' ? 'Open Case Builder' : 'Back to Chat'}
                >
                  {view === 'chat' ? 'Case Builder' : 'Back to Chat'}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="nav-pill"
                  data-active={logOpen}
                  onClick={() => setLogOpen(true)}
                  aria-haspopup="dialog"
                >
                  Diagnostics
                </button>
              </li>
            </ul>
          </nav>
          <div className="nav-spacer" />
        </div>
      </header>
      <div className="app-body-row">
        <main className={`main ${view === 'chat' ? 'main--chat' : 'main--builder'}`}>
          {view === 'chat' ? (
            <>
              <ChatView
                isComposing={isComposing}
                isVoiceConnecting={isVoiceConnecting}
                connectionProgress={connectionProgress}
                messagesContainerRef={messagesContainerRef}
                messagesEndRef={messagesEndRef}
                isLoadingInitialData={isLoadingInitialData}
                sortedMessages={sortedMessages}
                voiceSession={voiceSession}
                pendingElapsed={pendingElapsed}
                voiceErrorMessage={voiceErrorMessage}
                runtimeFeatures={runtimeFeatures}
                renderMicControl={renderMicControl}
                personas={personas}
                personaId={personaId}
                selectedPersona={selectedPersona}
                setPersonaId={setPersonaId}
                scenarios={scenarios}
                scenarioId={scenarioId}
                selectedScenario={selectedScenario}
                setScenarioId={setScenarioId}
                setSettingsOpen={setSettingsOpen}
                printDropdownOpen={printDropdownOpen}
                setPrintDropdownOpen={setPrintDropdownOpen}
                onPrintScenario={handlePrintScenario}
                onPrintTranscript={handlePrintTranscript}
                postStopOpen={postStopOpen}
                setPostStopOpen={setPostStopOpen}
                sessionId={sessionId}
                spsError={spsError}
                backendOk={backendOk}
                caseSetupIds={caseSetupIds}
              />
              <AdvancedSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} onReconnectRequest={requestReconnect} />
            </>
          ) : (
            <CaseBuilder />
          )}
        </main>
      </div>

      <DiagnosticsDrawer
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onCopyLogs={handleCopyLogs}
        logItems={logItems}
        runtimeFeatures={runtimeFeatures}
        voiceSession={voiceSession}
        ttftMs={ttftMs}
        health={health}
        statusClass={statusClass}
        sessionPhase={sessionPhase}
        sessionOutstandingGate={sessionOutstandingGate}
        instructionsPreview={instructionsPreview}
      />

      {/* Persistence error toast */}
      {persistenceError && (
        <div className="toast toast--error toast--fixed">
          <span>⚠️ {persistenceError.message}</span>
          <button
            onClick={() => setPersistenceError(null)}
            className="toast__dismiss"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Voice ready notification */}
      <VoiceReadyToast 
        show={showVoiceReadyToast} 
        onDismiss={() => setShowVoiceReadyToast(false)} 
      />
    </div>
  )
}

