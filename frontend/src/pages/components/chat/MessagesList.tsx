import type { MutableRefObject } from 'react'
import type { Message, MediaReference } from '../../chatShared'
import RenderProfiler from '../../../shared/utils/renderProfiler'

import { MessageItem } from './MessageItem'

type MessagesListProps = {
  messages: Message[]
  messagesContainerRef: MutableRefObject<HTMLDivElement | null>
  messagesEndRef: MutableRefObject<HTMLDivElement | null>
  onMediaClick?: (media: MediaReference) => void
  onImageLoad?: () => void
  selectedMedia?: MediaReference | null
  endText?: string
}

export function MessagesList({
  messages,
  messagesContainerRef,
  messagesEndRef,
  onMediaClick,
  onImageLoad,
  selectedMedia,
  endText,
}: MessagesListProps) {
  return (
    <RenderProfiler id="MessagesList">
      <div className="messages" ref={messagesContainerRef}>
      {messages.map((message) => {
        // Check if this message's media is currently open in the modal
        const isMediaOpenInModal = Boolean(
          selectedMedia &&
          message.media &&
          selectedMedia.type === 'animation' &&
          message.media.type === 'animation' &&
          selectedMedia.animationId === message.media.animationId
        )

        return (
          <MessageItem
            key={message.id}
            message={message}
            onMediaClick={onMediaClick}
            onImageLoad={onImageLoad}
            isMediaOpenInModal={isMediaOpenInModal}
          />
        )
      })}
      {endText && messages.length > 0 && (
        <div className="messages-end-marker" role="note" aria-label={endText}>
          {endText}
        </div>
      )}
      <div ref={messagesEndRef} className="messages-scroll-anchor" />
      </div>
    </RenderProfiler>
  )
}
