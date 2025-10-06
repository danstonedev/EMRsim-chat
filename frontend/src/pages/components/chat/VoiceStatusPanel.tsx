import { memo, type ReactElement } from 'react'
import RecordingPill from '../RecordingPill'
import type { VoiceSessionHandle } from '../../../shared/useVoiceSession'

type VoiceStatusPanelProps = {
  voiceSession: VoiceSessionHandle
  renderMicControl: () => ReactElement
}

const shouldShowAdaptiveBadge = () => {
  try {
    const env = (import.meta as any)?.env
    const badge = (env?.VITE_ADAPTIVE_VAD_BADGE ?? '').toString().toLowerCase()
    const debug = (env?.VITE_ADAPTIVE_VAD_DEBUG ?? '').toString().toLowerCase()
    const truthy = ['1', 'true', 'yes', 'on']
    return truthy.some((v) => badge === v) || truthy.some((v) => debug === v)
  } catch {
    return false
  }
}

export const VoiceStatusPanel = memo(function VoiceStatusPanel({
  voiceSession,
  renderMicControl,
}: VoiceStatusPanelProps) {
  if (voiceSession.status !== 'connected') {
    return null
  }

  const showBadge = shouldShowAdaptiveBadge() && Boolean(voiceSession.adaptive?.enabled)
  const adaptive = voiceSession.adaptive
  const label = adaptive?.status === 'very-noisy' ? 'Very Noisy' : adaptive?.status === 'noisy' ? 'Noisy' : 'Quiet'
  const title = adaptive
    ? `Adaptive VAD: ${label} (noise=${adaptive.noise.toFixed(3)}, snr=${adaptive.snr.toFixed(2)}, thr=${adaptive.threshold == null ? '—' : adaptive.threshold.toFixed(2)}, silence=${adaptive.silenceMs == null ? '—' : adaptive.silenceMs}ms)`
    : undefined

  return (
    <div className="voice-status-panel">
      <div className="voice-status-panel__audio">
        {showBadge && adaptive && (
          <div className="voice-status-panel__badge">
            <span className={`adaptive-badge adaptive-badge--${adaptive.status}`} aria-live="polite" title={title}>
              {label}
            </span>
          </div>
        )}
        <RecordingPill
          className="voice-status-panel__recording-pill"
          isRecording={!voiceSession.micPaused}
          showTimer
          maxSeconds={3600}
          waveformSource={voiceSession.micStream}
          levelSmoothing={0.4}
          bars={22}
          mode="passive"
          endSlot={renderMicControl()}
        />
      </div>
    </div>
  )
})
