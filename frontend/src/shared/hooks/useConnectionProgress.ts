import { useState, useCallback } from 'react'

export interface ConnectionProgress {
  step: 'mic' | 'session' | 'token' | 'webrtc' | 'complete'
  progress: number
  estimatedMs?: number
}

/**
 * Manages voice connection progress tracking and voice ready toast notifications.
 * Provides a clean interface for displaying connection state to users.
 */
export function useConnectionProgress() {
  const [connectionProgress, setConnectionProgress] = useState<ConnectionProgress | null>(null)
  const [showVoiceReadyToast, setShowVoiceReadyToast] = useState(false)

  const clearConnectionProgress = useCallback(() => {
    setConnectionProgress(null)
  }, [])

  const updateConnectionProgress = useCallback((progress: ConnectionProgress | null) => {
    setConnectionProgress(progress)
  }, [])

  const dismissVoiceReadyToast = useCallback(() => {
    setShowVoiceReadyToast(false)
  }, [])

  const showVoiceReady = useCallback(() => {
    setShowVoiceReadyToast(true)
  }, [])

  return {
    connectionProgress,
    setConnectionProgress: updateConnectionProgress,
    clearConnectionProgress,
    showVoiceReadyToast,
    setShowVoiceReadyToast,
    dismissVoiceReadyToast,
    showVoiceReady,
  }
}
