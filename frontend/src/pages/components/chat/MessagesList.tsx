import type { MutableRefObject } from 'react'
import type { Message, MediaReference } from '../../chatShared'
import type { VoiceSessionHandle } from '../../../shared/useVoiceSession'
import { MessageSkeleton } from './MessageSkeleton'
import { MessageItem } from './MessageItem'

type MessagesListProps = {
  messages: Message[]
  isLoadingInitialData: boolean
  messagesContainerRef: MutableRefObject<HTMLDivElement | null>
  messagesEndRef: MutableRefObject<HTMLDivElement | null>
  pendingElapsed: Record<string, number>
  voiceSession: VoiceSessionHandle
  onMediaClick?: (media: MediaReference) => void
}

export function MessagesList({
  messages,
  isLoadingInitialData,
  messagesContainerRef,
  messagesEndRef,
  pendingElapsed,
  voiceSession,
  onMediaClick,
}: MessagesListProps) {
  return (
    <div className="messages" ref={messagesContainerRef}>
      {isLoadingInitialData && <MessageSkeleton />}
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          voiceSession={voiceSession}
          elapsedSeconds={pendingElapsed[message.id]}
          onMediaClick={onMediaClick}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
