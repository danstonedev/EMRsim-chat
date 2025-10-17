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

  // Handle printing/exporting transcript
  const handlePrintTranscript = useCallback(() => {
    if (!sessionId) return false
    api.openTranscriptExport(sessionId)
    return true
  }, [sessionId])

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
  }
}
