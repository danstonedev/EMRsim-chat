type MessageVoiceIndicatorProps = {
  isAssistant: boolean
  elapsedSeconds?: number
}

export function MessageVoiceIndicator({ isAssistant, elapsedSeconds }: MessageVoiceIndicatorProps) {
  const indicatorClass = [
    'message__voice-indicator',
    isAssistant ? 'message__voice-indicator--assistant' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={indicatorClass} aria-hidden="true">
      <span className="message__voice-indicator-dot" />
      Transcribing…
      {typeof elapsedSeconds === 'number' && elapsedSeconds > 0 && (
        <span className="message__voice-indicator-elapsed"> {elapsedSeconds}s</span>
      )}
    </div>
  )
}
