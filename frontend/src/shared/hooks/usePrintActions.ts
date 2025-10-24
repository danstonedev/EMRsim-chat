import { useCallback, useEffect } from 'react'
import { api } from '../api'

interface UsePrintActionsOptions {
  personaId: string | null
  scenarioId: string
  sessionId: string | null
  printDropdownOpen: boolean
  closePrintDropdown: () => void
}

/**
 * Custom hook to manage print/export actions for scenarios and transcripts.
 * Handles opening SPS exports and transcript exports via API.
 * Also manages the print dropdown outside-click behavior.
 *
 * @param options - Configuration object containing IDs and dropdown state
 * @returns Object containing print action handlers
 */
export function usePrintActions(options: UsePrintActionsOptions) {
  const { personaId, scenarioId, sessionId, printDropdownOpen, closePrintDropdown } = options

  // Handle printing/exporting scenario
  const handlePrintScenario = useCallback(() => {
    if (!personaId || !scenarioId) return false
    api.openSpsExport(personaId, scenarioId)
    return true
  }, [personaId, scenarioId])

  // Handle printing/exporting transcript (Word document)
  const handlePrintTranscript = useCallback(() => {
    if (!sessionId) return false
    // Open backend-generated Word document export of the transcript
    // Uses existing API helper which handles popup-blocker fallback
    api.openTranscriptExport(sessionId)
    return true
  }, [sessionId])

  // Handle viewing transcript page in new tab
  const handleViewTranscriptPage = useCallback(() => {
    if (!sessionId) return false
    // Open transcript page in new tab
    window.open(`/transcript/${sessionId}`, '_blank', 'noopener,noreferrer')
    return true
  }, [sessionId])

  // Async version with readiness polling and UI integration
  const handlePrintTranscriptAsync = useCallback(async () => {
    if (!sessionId) return false
    // Wait briefly for backend to finalize if needed; then open
    try {
      const ready = await api.waitForTranscriptReady(sessionId, { timeoutMs: 10000, pollMs: 700 })
      // Open transcript page in new tab instead of Word export
      window.open(`/transcript/${sessionId}`, '_blank', 'noopener,noreferrer')
      return ready
    } catch {
      // As a fallback, try to open anyway
      window.open(`/transcript/${sessionId}`, '_blank', 'noopener,noreferrer')
      // Close the bar optimistically; transcript page will show progress or content
      return true
    }
  }, [sessionId])

  // Open the Faculty Key printable export (audience=faculty)
  const handleOpenFacultyKey = useCallback(() => {
    if (!personaId || !scenarioId) return false
    api.openSpsExportWithAudience(personaId, scenarioId, 'faculty')
    return true
  }, [personaId, scenarioId])

  // Close print dropdown when clicking outside
  useEffect(() => {
    if (!printDropdownOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.print-dropdown-container')) {
        closePrintDropdown()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [printDropdownOpen, closePrintDropdown])

  return {
    handlePrintScenario,
    handlePrintTranscript,
    handleViewTranscriptPage,
    handlePrintTranscriptAsync,
    handleOpenFacultyKey,
  }
}
