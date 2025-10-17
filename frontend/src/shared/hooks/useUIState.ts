import { useState, useCallback } from 'react'
import type { MediaReference } from '../../shared/types'

/**
 * Manages UI state for drawers, dropdowns, modals, and other transient UI elements.
 * Centralizes all the various open/close state management in one place.
 */
export function useUIState() {
  const [logOpen, setLogOpen] = useState(false)
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false)
  const [micActionsOpen, setMicActionsOpen] = useState(false)
  const [postStopOpen, setPostStopOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<MediaReference | null>(null)
  const [viewerOverlay, setViewerOverlay] = useState<{ open: boolean; animationId?: string }>(() => ({ open: false }))
  const [persistenceError, setPersistenceError] = useState<{ message: string; timestamp: number } | null>(null)

  const openLog = useCallback(() => setLogOpen(true), [])
  const closeLog = useCallback(() => setLogOpen(false), [])
  
  const togglePrintDropdown = useCallback(() => setPrintDropdownOpen(prev => !prev), [])
  const closePrintDropdown = useCallback(() => setPrintDropdownOpen(false), [])
  
  const openMicActions = useCallback(() => setMicActionsOpen(true), [])
  const closeMicActions = useCallback(() => setMicActionsOpen(false), [])
  
  const openPostStop = useCallback(() => setPostStopOpen(true), [])
  const closePostStop = useCallback(() => setPostStopOpen(false), [])
  
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  
  const handleMediaClick = useCallback((media: MediaReference) => {
    setSelectedMedia(media)
  }, [])
  
  const closeMedia = useCallback(() => {
    setSelectedMedia(null)
  }, [])

  const openViewerOverlay = useCallback((animationId?: string) => {
    setViewerOverlay({ open: true, animationId })
  }, [])

  const closeViewerOverlay = useCallback(() => {
    setViewerOverlay({ open: false })
  }, [])

  const showPersistenceError = useCallback((message: string) => {
    setPersistenceError({ message, timestamp: Date.now() })
  }, [])

  const clearPersistenceError = useCallback(() => {
    setPersistenceError(null)
  }, [])

  return {
    // Log/Diagnostics drawer
    logOpen,
    openLog,
    closeLog,
    setLogOpen,
    
    // Print dropdown
    printDropdownOpen,
    togglePrintDropdown,
    closePrintDropdown,
    setPrintDropdownOpen,
    
    // Mic actions popover
    micActionsOpen,
    openMicActions,
    closeMicActions,
    setMicActionsOpen,
    
    // Post-stop dialog
    postStopOpen,
    openPostStop,
    closePostStop,
    setPostStopOpen,
    
    // Settings drawer
    settingsOpen,
    openSettings,
    closeSettings,
    setSettingsOpen,
    
    // Media modal
    selectedMedia,
    handleMediaClick,
    closeMedia,
    setSelectedMedia,

  // Full-screen 3D overlay
  viewerOverlay,
  openViewerOverlay,
  closeViewerOverlay,
    
    // Persistence error toast
    persistenceError,
    showPersistenceError,
    clearPersistenceError,
    setPersistenceError,
  }
}
