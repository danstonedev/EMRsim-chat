import { memo, useMemo } from 'react'
import type { Message, MediaReference } from '../../chatShared'
import type { VoiceSessionHandle } from '../../../shared/useVoiceSession'
import { MessageVoiceIndicator } from './MessageVoiceIndicator'

type MessageItemProps = {
  message: Message
  voiceSession: VoiceSessionHandle
  elapsedSeconds?: number
  onMediaClick?: (media: MediaReference) => void
}

function MessageItemComponent({ message, voiceSession, elapsedSeconds, onMediaClick }: MessageItemProps) {
  const { role, channel, pending, timestamp, text, media } = message
  const isUser = role === 'user'
  const isVoice = channel === 'voice'
  const isPending = Boolean(pending)
  const isVoicePending = isVoice && isPending

  const classNames = useMemo(() => {
    const messageClass = [
      'message',
      isUser ? 'message--user' : 'message--assistant',
      isVoice ? 'message--voice' : 'message--text',
      isPending ? 'message--pending' : 'message--final',
    ]
      .filter(Boolean)
      .join(' ')

    const bubbleClass = [
      'message__bubble',
      isVoice ? 'message__bubble--voice' : '',
      isVoicePending ? 'message__bubble--voice-pending' : '',
      isUser && isVoice && !isPending ? 'message__bubble--voice-final' : '',
      !isUser && isVoice && !isPending ? 'message__bubble--assistant-voice-final' : '',
    ]
      .filter(Boolean)
      .join(' ')

    return { messageClass, bubbleClass }
  }, [isPending, isUser, isVoice, isVoicePending])

  const livePartial = isUser ? voiceSession.userPartial : voiceSession.assistantPartial
  const shouldShowLivePartial = !isUser && isVoicePending
  const pendingPreview = isVoicePending
    ? shouldShowLivePartial
      ? livePartial || text || 'Listening…'
      : 'Listening…'
    : null
  const displayText = isVoicePending ? pendingPreview || '' : text || (isPending ? '…' : '')

  return (
    <div className={classNames.messageClass}>
      <div
        className={classNames.bubbleClass}
        title={new Date(timestamp).toLocaleTimeString()}
        data-pending={isPending ? 'true' : 'false'}
        data-channel={channel}
        data-role={role}
      >
        {isVoicePending && (
          <MessageVoiceIndicator isAssistant={!isUser} elapsedSeconds={elapsedSeconds} />
        )}
        {isVoicePending ? (
          <div className="message__text" aria-live="polite">
            {displayText}
          </div>
        ) : (
          <div className="message__text">{displayText}</div>
        )}
        
        {media && !isPending && onMediaClick && (
          <div 
            className="message__media-preview" 
            onClick={() => onMediaClick(media)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onMediaClick(media)
              }
            }}
            aria-label={`View clinical observation: ${media.caption}`}
          >
            <img 
              src={media.thumbnail || media.url} 
              alt={media.caption}
            />
            <span className="message__media-badge">
              {media.type === 'video' ? '▶' : '🔍'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export const MessageItem = memo(MessageItemComponent)
