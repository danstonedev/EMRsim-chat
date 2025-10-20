import { memo } from 'react'
import type { Message, MediaReference } from '../../chatShared'
import { getYouTubeThumbnail } from './MediaModal'
import ChatAnimationInlinePreview from '../viewer/ChatAnimationInlinePreview'

type MessageItemProps = {
  message: Message
  onMediaClick?: (media: MediaReference) => void
  onImageLoad?: () => void
  isMediaOpenInModal?: boolean
}

function MessageItemComponent({ message, onMediaClick, onImageLoad, isMediaOpenInModal }: MessageItemProps) {
  const { role, pending, timestamp, text, media } = message
  const isUser = role === 'user'
  const isPending = Boolean(pending)

  // Optional diagnostics: allow rendering pending messages when enabled
  const showPending = (() => {
    try {
      const env = (import.meta as any)?.env?.VITE_DEBUG_SHOW_PENDING
      const ls = typeof window !== 'undefined' ? window.localStorage?.getItem('DEBUG_SHOW_PENDING') : null
      return Boolean((env && String(env).toLowerCase() !== 'false') || ls === '1' || ls === 'true')
    } catch { return false }
  })()

  // Simplified: only show finalized messages, no intermediate states
  if (isPending && !showPending) {
    return null
  }

  const messageClass = [
    'message',
    isUser ? 'message--user' : 'message--assistant',
    isPending ? 'message--pending' : '',
  ].filter(Boolean).join(' ')

  const displayText = text || ''
  const hasText = displayText.trim().length > 0

  return (
    <div className={messageClass}>
      {hasText && (
        <div
          className="message__bubble"
          title={new Date(timestamp).toLocaleTimeString()}
          data-role={role}
        >
          <div className="message__text">{displayText}</div>
        </div>
      )}
      
      {media && !isPending && onMediaClick && (
        media.type === 'animation' ? (
          // For animations, do NOT make the wrapper clickable. Only the explicit Expand button opens the modal.
          // Hide the inline preview when the modal is open to prevent model conflicts
          !isMediaOpenInModal && (
            <div className="message__media-preview" aria-label={media.caption}>
              <ChatAnimationInlinePreview
                animationId={media.animationId}
                onExpand={() => onMediaClick(media)}
              />
            </div>
          )
        ) : (
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
            <>
              <img 
                src={
                  media.type === 'youtube' 
                    ? (media.thumbnail || getYouTubeThumbnail(media.url))
                    : (media.thumbnail || media.url)
                }
                alt={media.caption}
                onLoad={onImageLoad}
              />
              <span className="message__media-badge" aria-hidden="true">
                {media.type === 'youtube' ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.8 4.8c-.2-1-.8-1.7-1.6-1.9C12.7 2.5 8 2.5 8 2.5s-4.7 0-6.2.4c-.8.2-1.4.9-1.6 1.9C0 6.1 0 8 0 8s0 1.9.2 3.2c.2 1 .8 1.7 1.6 1.9 1.5.4 6.2.4 6.2.4s4.7 0 6.2-.4c.8-.2 1.4-.9 1.6-1.9.2-1.3.2-3.2.2-3.2s0-1.9-.2-3.2zM6.4 10.5V5.5L10.6 8l-4.2 2.5z"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
              </span>
            </>
          </div>
        )
      )}
    </div>
  )
}

export const MessageItem = memo(MessageItemComponent)
