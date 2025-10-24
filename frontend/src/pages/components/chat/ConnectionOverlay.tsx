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
  // Handle all possible states that should NOT show any UI
  // 1. If we're not composing AND not connecting to voice with progress
  // 2. If we're at the "complete" step
  // 3. If we're composing but not actively connecting yet (prevents dots flash)
  if (
    (!isComposing && (!isVoiceConnecting || !progress)) || 
    (progress?.step === 'complete') ||
    (isComposing && !isVoiceConnecting)
  ) {
    return null
  }

  // Use a local state variable to avoid race conditions in parent component
  const showVoiceProgress = isVoiceConnecting && Boolean(progress)

  return (
    <div
      className="connection-overlay"
      role="dialog"
      aria-label={isComposing ? 'Setting up encounter' : 'Connecting to voice chat'}
    >
      <div className="connection-overlay__card">
        {showVoiceProgress && (
          <ConnectionProgressIndicator
            step={progress?.step ?? 'mic'}
            progress={progress?.progress ?? 12}
            estimatedMs={progress?.estimatedMs}
            placeholder={!progress}
          />
        )}
      </div>
    </div>
  )
})
