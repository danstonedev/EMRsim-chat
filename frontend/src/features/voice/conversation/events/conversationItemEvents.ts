import type { ConversationEvent } from '../../../../shared/types'
import type { TranscriptRole } from '../types/transcript'

export interface ConversationItemDependencies {
  endpointing: {
    handleBackendUserItem(timestamp: number): boolean
  }
  transcriptEngine: {
    startUserTranscript(): void
    startAssistantResponse(): void
    finalizeAssistant(payload: unknown, isAudio: boolean): void
  }
  transcriptCoordinator: {
    clearAssistantPartial(): void
  }
  relay: {
    getLastRelayedItemId(): string | null
    setLastRelayedItemId(id: string | null): void
  }
  emit(event: ConversationEvent): void
}

export interface ConversationItemHandlers {
  handleConversationItemEvent(type: string, payload: any): boolean
}

/**
 * Creates handlers for conversation.item.* events (created, truncated).
 * Manages conversation state, replay logic for reused sessions, and turn boundaries.
 */
export function createConversationItemHandlers(deps: ConversationItemDependencies): ConversationItemHandlers {
  function handleConversationItemEvent(type: string, payload: any): boolean {
    // conversation.item.created: track item creation and restart turns if needed
    if (type === 'conversation.item.created') {
      const role = String(payload?.item?.role || '').toLowerCase()

      if (role === 'user') {
        const restarted = deps.endpointing.handleBackendUserItem(Date.now())
        if (restarted) {
          deps.relay.setLastRelayedItemId(null)
          deps.transcriptEngine.startUserTranscript()
          const backendRestartAt = Date.now()
          deps.emit({
            type: 'transcript',
            role: 'user' as TranscriptRole,
            text: '',
            isFinal: false,
            timestamp: backendRestartAt,
            timings: {
              startedAtMs: backendRestartAt,
              emittedAtMs: backendRestartAt,
            },
          })
        }
        return true
      }

      if (role === 'assistant') {
        deps.transcriptEngine.startAssistantResponse()
        return true
      }

      return true
    }

    // conversation.item.truncated: assistant response interrupted
    if (type === 'conversation.item.truncated' || type.endsWith('conversation.item.truncated')) {
      deps.transcriptEngine.finalizeAssistant({}, true)
      deps.transcriptCoordinator.clearAssistantPartial()
      return true
    }

    return false
  }

  return { handleConversationItemEvent }
}
