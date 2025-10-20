import { useCallback, useEffect, useRef, useState, Dispatch, SetStateAction } from 'react'
import { api } from '../api'
import { FLAGS } from '../flags'

interface RuntimeFeatures {
  voiceEnabled: boolean
  spsEnabled: boolean
  voiceDebug: boolean
}

interface UseSessionLifecycleOptions {
  personaId: string | null
  scenarioId: string
  runtimeFeatures: RuntimeFeatures
  updateEncounterStateRef: (state: { phase: string | null; gate: Record<string, unknown> | null }, reason: string) => void
  setMessages: Dispatch<SetStateAction<any[]>>
  setSpsError: Dispatch<SetStateAction<string | null>>
  setLatestInstructions: Dispatch<SetStateAction<string>>
  setTtftMs: (ms: number | null) => void
  firstDeltaRef: React.MutableRefObject<number | null>
  resetAllTrackingState: (options?: { clearQueue?: boolean; resetFirstDelta?: boolean }) => void
  voiceSessionStart: () => Promise<void>
  voiceSessionStatus: 'idle' | 'connecting' | 'connected' | 'error'
  settings: { autostart?: boolean }
}

/**
 * Manages SPS session lifecycle including composition, auto-creation, reset, and auto-start.
 * Handles the complex logic of creating encounters when persona/scenario are selected.
 */
export function useSessionLifecycle({
  personaId,
  scenarioId,
  runtimeFeatures,
  updateEncounterStateRef,
  setMessages,
  setSpsError,
  setLatestInstructions,
  setTtftMs,
  firstDeltaRef,
  resetAllTrackingState,
  voiceSessionStart,
  voiceSessionStatus,
  settings,
}: UseSessionLifecycleOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isComposing, setIsComposing] = useState(false)

  // Auto-start state tracking
  const autostartStateRef = useRef<{ 
    timer: number | null
    retries: number
    attemptedFor: string | null 
  }>({ 
    timer: null, 
    retries: 0, 
    attemptedFor: null 
  })

  /**
   * Compose/create an SPS encounter session
   */
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
    setSpsError(null)
    setMessages([])
    setTtftMs(null)
    setLatestInstructions('')
    firstDeltaRef.current = null

    try {
      const result = await api.createSession(personaId, scenarioId)
      setSessionId(result.session_id)
      
      const nextPhase = typeof result.phase === 'string' ? result.phase : null
      const nextGate = (result && typeof result.gate === 'object' && result.gate !== null) 
        ? result.gate as Record<string, unknown> 
        : null
      
      updateEncounterStateRef({ phase: nextPhase, gate: nextGate }, 'encounter.composed')
      // Keep loading state until first message arrives
    } catch (err) {
      setSessionId(null)
      setSpsError(err instanceof Error ? err.message : String(err))
      updateEncounterStateRef({ phase: null, gate: null }, 'encounter.composed.error')
    } finally {
      setIsComposing(false)
    }
  }, [
    personaId, 
    scenarioId, 
    runtimeFeatures.spsEnabled, 
    updateEncounterStateRef, 
    setMessages, 
    setTtftMs,
    setSpsError, 
    setLatestInstructions, 
    firstDeltaRef
  ])
  
  /**
   * Reset the current encounter and create a new one with the same persona/scenario
   */
  const resetEncounter = useCallback(async () => {
    // Reset all state
    setSessionId(null)
    setMessages([])
    setSpsError(null)
    setTtftMs(null)
    setLatestInstructions('')
    firstDeltaRef.current = null
    resetAllTrackingState({ clearQueue: true, resetFirstDelta: true })
    
    // Create a new session with the same persona and scenario
    if (personaId && scenarioId && runtimeFeatures.spsEnabled) {
      await composeEncounter()
    } else {
      updateEncounterStateRef({ phase: null, gate: null }, 'encounter.reset')
    }
  }, [
    personaId,
    scenarioId,
    runtimeFeatures.spsEnabled,
    resetAllTrackingState,
    composeEncounter,
    updateEncounterStateRef,
    setMessages,
    setSpsError,
    setTtftMs,
    setLatestInstructions,
    firstDeltaRef,
  ])

  // Reset encounter state when persona or scenario selection changes
  useEffect(() => {
    setSessionId(null)
    setMessages([])
    setSpsError(null)
    setLatestInstructions('')
    updateEncounterStateRef({ phase: null, gate: null }, 'encounter.reset.selection')
  }, [personaId, scenarioId, runtimeFeatures.spsEnabled, updateEncounterStateRef, setMessages, setSpsError, setLatestInstructions])

  // Auto-create encounter when both persona and scenario are selected
  useEffect(() => {
    if (!personaId || !scenarioId || !runtimeFeatures.spsEnabled) return
    if (sessionId || isComposing) return // Don't create if already have session or composing
    
    // Small delay to prevent rapid re-creation when switching selections
    const timer = setTimeout(() => { void composeEncounter() }, 300)
    
    return () => clearTimeout(timer)
  }, [personaId, scenarioId, runtimeFeatures.spsEnabled, sessionId, isComposing, composeEncounter])

  // Auto-start Live Chat after an encounter is created
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
    if (voiceSessionStatus === 'connected' || voiceSessionStatus === 'connecting') return

  const localAuto = autostartStateRef.current
  if (localAuto.attemptedFor === sessionId) return
  localAuto.attemptedFor = sessionId
  localAuto.retries = 0

    const delay = Number((import.meta as any)?.env?.VITE_VOICE_AUTOSTART_DELAY_MS) || 250
    const retryMs = Number((import.meta as any)?.env?.VITE_VOICE_AUTOSTART_RETRY_MS) || 500
    const maxRetries = Number((import.meta as any)?.env?.VITE_VOICE_AUTOSTART_MAX_RETRIES) || 2

    const tryStart = async (): Promise<void> => {
      try {
        await voiceSessionStart()
      } catch {
        if (localAuto.retries < maxRetries) {
          localAuto.retries += 1
          localAuto.timer = window.setTimeout(() => { void tryStart() }, retryMs) as unknown as number
        }
      }
    }

    localAuto.timer = window.setTimeout(() => { void tryStart() }, delay) as unknown as number

    return () => {
      if (localAuto.timer != null) {
        try { window.clearTimeout(localAuto.timer) } catch { }
        localAuto.timer = null
      }
    }
  }, [
    runtimeFeatures.voiceEnabled, 
    runtimeFeatures.spsEnabled, 
    sessionId, 
    isComposing, 
    voiceSessionStatus, 
    voiceSessionStart, 
    settings.autostart
  ])

  return {
    sessionId,
    isComposing,
    composeEncounter,
    resetEncounter,
  }
}
