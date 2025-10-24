import { useEffect } from 'react'

interface UseUIEffectsProps {
  micActionsOpen: boolean
  postStopOpen: boolean
  closeMicActions: () => void
  closePostStop: () => void
  persistenceError: { message: string; timestamp: number } | null
  clearPersistenceError: () => void
}

/**
 * Handles UI-related side effects
 * 
 * - Auto-dismisses persistence error toast after 5 seconds
 * - Closes mic action popovers when clicking outside
 */
export function useUIEffects({
  micActionsOpen,
  postStopOpen,
  closeMicActions,
  closePostStop,
  persistenceError,
  clearPersistenceError,
}: UseUIEffectsProps) {
  // Auto-dismiss persistence error after 5 seconds
  useEffect(() => {
    if (!persistenceError) return
    const timeout = setTimeout(() => {
      clearPersistenceError()
    }, 5000)
    return () => clearTimeout(timeout)
  }, [persistenceError, clearPersistenceError])

  // Close mic popovers when clicking outside
  useEffect(() => {
    if (!micActionsOpen && !postStopOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (micActionsOpen && !target.closest('.mic-popover-container')) {
        closeMicActions()
      }
      if (postStopOpen && !target.closest('.mic-poststop-container')) {
        closePostStop()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [micActionsOpen, postStopOpen, closeMicActions, closePostStop])
}
