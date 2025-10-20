import MicIcon from '@mui/icons-material/Mic'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'

export interface VoiceControlsProps {
  status: string
  micPaused: boolean
  start: () => Promise<unknown>
  pause: () => void
  resume: () => void
  stop: () => void
  voiceLocked: boolean
  voiceButtonDisabled: boolean
  voiceButtonTooltip?: string
  micActionsOpen: boolean
  openMicActions: () => void
  closeMicActions: () => void
  openPostStop: () => void
}

export default function VoiceControls({
  status,
  micPaused,
  start,
  pause,
  resume,
  stop,
  voiceLocked,
  voiceButtonDisabled,
  voiceButtonTooltip,
  micActionsOpen,
  openMicActions,
  closeMicActions,
  openPostStop,
}: VoiceControlsProps) {
  return (
    <div className="mic-popover-container">
      <button
        type="button"
        className="icon-btn"
        data-voice-connected={status === 'connected'}
        data-voice-ready={!voiceButtonDisabled && status !== 'connected'}
        disabled={voiceButtonDisabled}
        onClick={() => {
          if (voiceLocked) return
          if (status === 'connected') {
            openMicActions()
          } else {
            // Start voice session
            start().catch(() => {})
          }
        }}
        aria-label={
          status === 'connected' ? (micPaused ? 'Show resume/end options' : 'Pause and show options') : 'Start voice chat'
        }
        title={voiceButtonTooltip}
        aria-haspopup="menu"
      >
        {status === 'connected' && micPaused ? <PauseIcon fontSize="small" /> : <MicIcon fontSize="small" />}
      </button>

      {micActionsOpen && status === 'connected' && (
        <div className="mic-popover-menu" role="menu" aria-label="Recording options">
          <button
            type="button"
            className="mic-popover-item"
            role="menuitem"
            onClick={() => {
              if (micPaused) resume()
              else pause()
              closeMicActions()
            }}
            title={micPaused ? 'Resume speaking' : 'Pause microphone'}
          >
            <PlayArrowIcon fontSize="small" />
            <span>{micPaused ? 'Resume speaking' : 'Pause mic'}</span>
          </button>
          <button
            type="button"
            className="mic-popover-item mic-popover-item--danger"
            role="menuitem"
            onClick={() => {
              closeMicActions()
              try {
                stop()
              } finally {
                openPostStop()
              }
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
}
