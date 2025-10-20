import { useEffect, useRef } from 'react'
import { FLAGS } from '../flags'

interface UseVoiceAutostartProps {
  voiceEnabled: boolean
  spsEnabled: boolean
  autostartSetting: boolean
  sessionId: string | null
  isComposing: boolean
  voiceStatus: 'idle' | 'connecting' | 'connected' | 'error'
  startVoiceSession: () => Promise<void>
}

/**
 * Automatically starts voice session after encounter creation
 *
 * Features:
 * - Waits for sessionId to exist (avoids "start requested without scenario" error)
 * - Configurable delay before first attempt
 * - Retry logic with configurable max retries
 * - Cleanup on unmount or when dependencies change
 *
 * Environment variables:
 * - VITE_VOICE_AUTOSTART_DELAY_MS: Initial delay (default 250ms)
 * - VITE_VOICE_AUTOSTART_RETRY_MS: Retry delay (default 500ms)
 * - VITE_VOICE_AUTOSTART_MAX_RETRIES: Max retry attempts (default 2)
 */
export function useVoiceAutostart({
  voiceEnabled,
  spsEnabled,
  autostartSetting,
  sessionId,
  isComposing,
  voiceStatus,
  startVoiceSession,
}: UseVoiceAutostartProps) {
  const autostartStateRef = useRef<{
    timer: number | null
    retries: number
    attemptedFor: string | null
  }>({
    timer: null,
    retries: 0,
    attemptedFor: null,
  })

  useEffect(() => {
    // Only auto-start when:
    // - Voice feature is enabled
    // - Autostart is explicitly enabled via flag or settings
    // - An SPS session exists (sessionId)
    // - We're not already connecting/connected
    // - We're not composing a new session
    if (!voiceEnabled || !spsEnabled) return
    if (!(autostartSetting || FLAGS.VOICE_AUTOSTART)) return
    if (!sessionId) return
    if (isComposing) return
    if (voiceStatus === 'connected' || voiceStatus === 'connecting') return

    // Avoid re-attempting for the same session
  const localAuto = autostartStateRef.current
  if (localAuto.attemptedFor === sessionId) return
  localAuto.attemptedFor = sessionId
  localAuto.retries = 0

    // Configuration from environment or defaults
    const delay = Number((import.meta as any)?.env?.VITE_VOICE_AUTOSTART_DELAY_MS) || 250
    const retryMs = Number((import.meta as any)?.env?.VITE_VOICE_AUTOSTART_RETRY_MS) || 500
    const maxRetries = Number((import.meta as any)?.env?.VITE_VOICE_AUTOSTART_MAX_RETRIES) || 2

    const tryStart = async (): Promise<void> => {
      try {
        await startVoiceSession()
      } catch {
        // Retry on failure up to maxRetries
        if (localAuto.retries < maxRetries) {
          localAuto.retries += 1
          localAuto.timer = window.setTimeout(() => { void tryStart() }, retryMs) as unknown as number
        }
      }
    }

    // Initial delayed start
  localAuto.timer = window.setTimeout(() => { void tryStart() }, delay) as unknown as number

    // Cleanup on unmount or dependency change
    return () => {
      const timerId = localAuto.timer
      if (timerId != null) {
        window.clearTimeout(timerId)
        localAuto.timer = null
      }
    }
  }, [voiceEnabled, spsEnabled, sessionId, isComposing, voiceStatus, startVoiceSession, autostartSetting])
}
