import { memo } from 'react'
import { ConnectionProgressIndicator } from '../ConnectionProgressIndicator'

export type ConnectionProgressState = {
  step: 'mic' | 'session' | 'token' | 'webrtc' | 'complete'
  progress: number
  estimatedMs?: number
}

type ConnectionOverlayProps = {
  isComposing: boolean
  isVoiceConnecting: boolean
  progress: ConnectionProgressState | null
}

export const ConnectionOverlay = memo(function ConnectionOverlay({
  isComposing,
  isVoiceConnecting,
  progress,
}: ConnectionOverlayProps) {
  if (!isComposing && !isVoiceConnecting && !progress) {
    return null
  }

  return (
    <div
      className="connection-overlay"
      role="dialog"
      aria-label={isComposing ? 'Setting up encounter' : 'Connecting to voice chat'}
    >
      <div className="connection-overlay__card">
        {progress ? (
          <ConnectionProgressIndicator
            step={progress.step}
            progress={progress.progress}
            estimatedMs={progress.estimatedMs}
          />
        ) : (
          <div className="voice-loading" aria-live="polite">
            <div className="voice-loading__dot" />
            <div className="voice-loading__dot" />
            <div className="voice-loading__dot" />
          </div>
        )}
      </div>
    </div>
  )
})
