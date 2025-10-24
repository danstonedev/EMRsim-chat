import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import StopIcon from '@mui/icons-material/Stop'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

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
  mode?: 'all' | 'mic-only' | 'transport-only' | 'playpause-only' | 'restart-stop-only'
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
  openPostStop,
  mode = 'all',
}: VoiceControlsProps) {
  const isConnected = status === 'connected'
  const isMicActive = isConnected && !micPaused

  // Button class helpers
  const iconBtn = 'icon-btn'
  const micBtnClass = [iconBtn, isMicActive ? 'mic-btn--active' : 'icon-btn--muted'].filter(Boolean).join(' ')
  const transportBtnClass = iconBtn

  const handlePlayPause = async () => {
    if (voiceLocked) return
    if (!isConnected) {
      // Start a new voice session
      await start().catch(() => {})
      return
    }
    // Connected: toggle pause/resume
    if (micPaused) {
      resume()
    } else {
      pause()
    }
  }

  const handleStop = async () => {
    if (!isConnected || voiceLocked) return
    const confirmStop = typeof window !== 'undefined' ? window.confirm('End encounter? This will stop the current session.') : true
    if (!confirmStop) return
    try {
      await Promise.resolve(stop())
    } finally {
      // Show post-stop UI
      openPostStop()
    }
  }

  const handleRestart = async () => {
    if (voiceLocked) return
    // If connected, stop first (without opening post-stop), then start again
    const ok = typeof window !== 'undefined' ? window.confirm('Restart encounter? Current session will be stopped and restarted.') : true
    if (!ok) return
    if (isConnected) await Promise.resolve(stop())
    await start().catch(() => {})
  }

  const playPauseButton = (
    <button
      type="button"
      className={transportBtnClass}
      data-voice-connected={isConnected}
      data-voice-ready={!voiceButtonDisabled && status !== 'connected'}
      disabled={voiceButtonDisabled}
      onClick={handlePlayPause}
      aria-label={!isConnected ? 'Start voice chat' : micPaused ? 'Resume listening' : 'Pause listening'}
      title={voiceButtonTooltip}
    >
      {!isConnected ? (
        <PlayArrowIcon fontSize="small" />
      ) : micPaused ? (
        <PlayArrowIcon fontSize="small" />
      ) : (
        <PauseIcon fontSize="small" />
      )}
    </button>
  )

  const restartButton = (
    <button
      type="button"
      className={transportBtnClass}
      disabled={voiceButtonDisabled}
      onClick={handleRestart}
      aria-label={isConnected ? 'Restart encounter' : 'Start encounter'}
      title={isConnected ? 'Restart encounter' : 'Start encounter'}
    >
      <RestartAltIcon fontSize="small" />
    </button>
  )

  const stopButton = (
    <button
      type="button"
      className={transportBtnClass}
      disabled={!isConnected || voiceButtonDisabled}
      onClick={handleStop}
      aria-label="End encounter"
      title="End encounter"
    >
      <StopIcon fontSize="small" />
    </button>
  )

  const transportControls = <>{playPauseButton}{restartButton}{stopButton}</>

  const micButton = (
    <button
      type="button"
      className={micBtnClass}
      data-voice-connected={isConnected}
      disabled={!isConnected || voiceButtonDisabled}
      onClick={() => {
        if (!isConnected || voiceLocked) return
        if (micPaused) {
          resume()
        } else {
          pause()
        }
      }}
      aria-label={isConnected ? (micPaused ? 'Unmute microphone' : 'Mute microphone') : 'Microphone disabled until connected'}
      title={isConnected ? (micPaused ? 'Unmute mic' : 'Mute mic') : 'Connect to enable mic'}
    >
      {isConnected ? (micPaused ? <MicOffIcon fontSize="small" /> : <MicIcon fontSize="small" />) : <MicOffIcon fontSize="small" />}
    </button>
  )

  // Return bare buttons for slot rendering (no wrapper containers)
  // The RecordingPill provides the container context
  if (mode === 'mic-only') {
    return micButton
  }
  if (mode === 'transport-only') {
    return transportControls
  }
  if (mode === 'playpause-only') {
    return playPauseButton
  }
  if (mode === 'restart-stop-only') {
    return <>{restartButton}{stopButton}</>
  }

  // For standalone usage (not in pill slots), wrap in container
  return <div className="mic-popover-container">{transportControls}{micButton}</div>
}
