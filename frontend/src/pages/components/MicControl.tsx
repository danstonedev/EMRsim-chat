import { useState } from 'react'
import MicIcon from '@mui/icons-material/Mic'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'

interface MicControlProps {
  voiceStatus: 'idle' | 'connecting' | 'connected' | 'error'
  micPaused: boolean
  disabled: boolean
  locked: boolean
  tooltip?: string
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onPostStop: () => void
}

/**
 * Microphone control button with popover menu for pause/resume/stop actions.
 * Handles voice session state and provides user controls for voice chat.
 */
export function MicControl({
  voiceStatus,
  micPaused,
  disabled,
  locked,
  tooltip,
  onStart,
  onPause,
  onResume,
  onStop,
  onPostStop,
}: MicControlProps) {
  const [micActionsOpen, setMicActionsOpen] = useState(false)

  const handleMainButtonClick = () => {
    if (locked) return
    
    if (voiceStatus === 'connected') {
      if (!micPaused) {
        try { onPause() } catch {}
      }
      setMicActionsOpen(true)
    } else {
      if (import.meta.env.DEV) {
        console.debug('[MicControl] Starting voice session')
      }
      onStart()
    }
  }

  const handlePauseResume = () => {
    if (micPaused) {
      onResume()
    } else {
      onPause()
    }
    setMicActionsOpen(false)
  }

  const handleStop = () => {
    setMicActionsOpen(false)
    try {
      onStop()
    } finally {
      onPostStop()
    }
  }

  return (
    <div className="mic-popover-container">
      <button
        type="button"
        className="icon-btn"
        data-voice-connected={voiceStatus === 'connected'}
        data-voice-ready={!disabled && voiceStatus !== 'connected'}
        disabled={disabled}
        onClick={handleMainButtonClick}
        aria-label={
          voiceStatus === 'connected'
            ? micPaused
              ? 'Show resume/end options'
              : 'Pause and show options'
            : 'Start voice chat'
        }
        title={tooltip}
        aria-haspopup="menu"
      >
        {voiceStatus === 'connected' && micPaused ? (
          <PauseIcon fontSize="small" />
        ) : (
          <MicIcon fontSize="small" />
        )}
      </button>
      
      {micActionsOpen && voiceStatus === 'connected' && (
        <div className="mic-popover-menu" role="menu" aria-label="Recording options">
          <button
            type="button"
            className="mic-popover-item"
            role="menuitem"
            onClick={handlePauseResume}
            title={micPaused ? 'Resume speaking' : 'Pause microphone'}
          >
            <PlayArrowIcon fontSize="small" />
            <span>{micPaused ? 'Resume speaking' : 'Pause mic'}</span>
          </button>
          
          <button
            type="button"
            className="mic-popover-item mic-popover-item--danger"
            role="menuitem"
            onClick={handleStop}
            title="End encounter recording"
          >
            <StopIcon fontSize="small" />
            <span>End encounter</span>
          </button>
        </div>
      )}
    </div>
  )
}
