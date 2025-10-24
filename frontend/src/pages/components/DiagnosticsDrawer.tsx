import type { VoiceSessionHandle } from '../../shared/useVoiceSession'
import { NetworkQualityIndicator } from './NetworkQualityIndicator'

export interface DiagnosticsDrawerProps {
  open: boolean
  onClose: () => void
  onCopyLogs: () => void
  logItems: Array<{ t: string; kind: string; src: string; msg: string; data?: any }>
  runtimeFeatures: {
    voiceEnabled: boolean
    spsEnabled: boolean
    voiceDebug: boolean
  }
  voiceSession: VoiceSessionHandle
  ttftMs: number | null
  health: { ok: boolean; uptime_s: number; db: string; openai: 'ok' | 'err' } | null
  statusClass: string
  sessionPhase: string | null
  sessionOutstandingGate: string[]
  instructionsPreview: string
}

export function DiagnosticsDrawer({
  open,
  onClose,
  onCopyLogs,
  logItems,
  runtimeFeatures,
  voiceSession,
  ttftMs,
  health,
  statusClass,
  sessionPhase,
  sessionOutstandingGate,
  instructionsPreview,
}: DiagnosticsDrawerProps) {
  return (
    <div className={`right-drawer ${open ? 'open' : ''}`}>
      <header>
        <strong className="drawer-title">Diagnostics</strong>
        <div className="header-actions">
          <button type="button" className="btn" onClick={onCopyLogs}>
            Copy
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </header>
      <div className="drawer-metrics" aria-live="polite">

        <div className="metric-group">
          <div className="metric-label">Voice</div>
          <span className={statusClass}>
            {runtimeFeatures.voiceEnabled && runtimeFeatures.spsEnabled
              ? voiceSession.status === 'connected'
                ? voiceSession.micPaused
                  ? 'Paused'
                  : 'Listening/Speaking'
                : voiceSession.status === 'connecting'
                  ? 'Connecting…'
                  : 'Idle'
              : 'Voice Off'}
          </span>
        </div>
        <div className="metric-group">
          <div className="metric-label">TTFT</div>
          <span className="ttft-pill" title="Time To First Token">{ttftMs == null ? '—' : `${ttftMs} ms`}</span>
        </div>
        {voiceSession.peerConnection && (
          <div className="metric-group">
            <div className="metric-label">Network</div>
            <NetworkQualityIndicator peerConnection={voiceSession.peerConnection} updateInterval={3000} />
          </div>
        )}
        {health && (
          <div className="metric-group">
            <div className="metric-label">Health</div>
            <span className="health-pill" title={`Uptime ${health.uptime_s}s`}>
              DB {health.db} · OpenAI {health.openai}
            </span>
          </div>
        )}
        <div className="metric-group">
          <div className="metric-label">Phase</div>
          <span className="metrics-chip" aria-live="polite">{sessionPhase ?? '—'}</span>
        </div>
        <div className="metric-group">
          <div className="metric-label">Outstanding gates</div>
          <span className="metrics-chip" aria-live="polite">
            {sessionOutstandingGate.length > 0 ? sessionOutstandingGate.join(', ') : 'None'}
          </span>
        </div>
        {instructionsPreview && (
          <div className="metric-group">
            <div className="metric-label">Latest instructions</div>
            <div className="instructions-preview" aria-live="polite">{instructionsPreview}</div>
          </div>
        )}
      </div>
      <div className="body" aria-live="polite">
        {logItems.map((li, idx) => {
          const preview = typeof li.data?.preview === 'string'
            ? li.data.preview
            : typeof li.data?.text === 'string'
              ? li.data.text
              : typeof li.data?.transcript === 'string'
                ? li.data.transcript
                : typeof li.data?.delta === 'string'
                  ? li.data.delta
                  : ''
          return (
            <div className={`log-line log-${li.kind}`} key={idx}>
              <span className="log-time">{li.t.slice(11, 19)}</span>
              <span className="log-src">{li.src}</span>
              <span className="log-msg">
                {li.msg}
                {preview && <span className="log-msg__detail"> — {preview}</span>}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
