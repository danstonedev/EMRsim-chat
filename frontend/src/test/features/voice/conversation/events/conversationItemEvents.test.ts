import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createConversationItemHandlers,
  type ConversationItemDependencies,
} from '../../../../../features/voice/conversation/events/conversationItemEvents'

describe('conversationItemEvents', () => {
  let mockDeps: ConversationItemDependencies

  beforeEach(() => {
    mockDeps = {
      endpointing: {
        handleBackendUserItem: vi.fn(() => false),
      },
      transcriptEngine: {
        startUserTranscript: vi.fn(),
        startAssistantResponse: vi.fn(),
        finalizeAssistant: vi.fn(),
      },
      transcriptCoordinator: {
        clearAssistantPartial: vi.fn(),
      },
      relay: {
        getLastRelayedItemId: vi.fn(() => null),
        setLastRelayedItemId: vi.fn(),
      },
      emit: vi.fn(),
    }
  })

  describe('conversation.item.created', () => {
    it('should handle user role item creation', () => {
      const handlers = createConversationItemHandlers(mockDeps)
      const payload = { item: { role: 'user' } }

      const result = handlers.handleConversationItemEvent('conversation.item.created', payload)

      expect(result).toBe(true)
      expect(mockDeps.endpointing.handleBackendUserItem).toHaveBeenCalledWith(expect.any(Number))
    })

    it('should restart user turn when backend indicates restart', () => {
      mockDeps.endpointing.handleBackendUserItem = vi.fn(() => true)
      const handlers = createConversationItemHandlers(mockDeps)
      const payload = { item: { role: 'user' } }

      handlers.handleConversationItemEvent('conversation.item.created', payload)

      expect(mockDeps.relay.setLastRelayedItemId).toHaveBeenCalledWith(null)
      expect(mockDeps.transcriptEngine.startUserTranscript).toHaveBeenCalled()
      expect(mockDeps.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transcript',
          role: 'user',
          text: '',
          isFinal: false,
        })
      )
    })

    it('should not restart turn when backend does not indicate restart', () => {
      mockDeps.endpointing.handleBackendUserItem = vi.fn(() => false)
      const handlers = createConversationItemHandlers(mockDeps)
      const payload = { item: { role: 'user' } }

      handlers.handleConversationItemEvent('conversation.item.created', payload)

      expect(mockDeps.relay.setLastRelayedItemId).not.toHaveBeenCalled()
      expect(mockDeps.transcriptEngine.startUserTranscript).not.toHaveBeenCalled()
      expect(mockDeps.emit).not.toHaveBeenCalled()
    })

    it('should handle assistant role item creation', () => {
      const handlers = createConversationItemHandlers(mockDeps)
      const payload = { item: { role: 'assistant' } }

      const result = handlers.handleConversationItemEvent('conversation.item.created', payload)

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.startAssistantResponse).toHaveBeenCalled()
    })

    it('should handle uppercase role values', () => {
      const handlers = createConversationItemHandlers(mockDeps)
      const payload = { item: { role: 'USER' } }

      const result = handlers.handleConversationItemEvent('conversation.item.created', payload)

      expect(result).toBe(true)
      expect(mockDeps.endpointing.handleBackendUserItem).toHaveBeenCalled()
    })

    it('should handle missing item payload', () => {
      const handlers = createConversationItemHandlers(mockDeps)
      const payload = {}

      const result = handlers.handleConversationItemEvent('conversation.item.created', payload)

      expect(result).toBe(true)
    })

    it('should handle missing role in item', () => {
      const handlers = createConversationItemHandlers(mockDeps)
      const payload = { item: {} }

      const result = handlers.handleConversationItemEvent('conversation.item.created', payload)

      expect(result).toBe(true)
    })
  })

  describe('conversation.item.truncated', () => {
    it('should finalize assistant response on truncation', () => {
      const handlers = createConversationItemHandlers(mockDeps)

      const result = handlers.handleConversationItemEvent('conversation.item.truncated', {})

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.finalizeAssistant).toHaveBeenCalledWith({}, true)
      expect(mockDeps.transcriptCoordinator.clearAssistantPartial).toHaveBeenCalled()
    })

    it('should handle truncated event with suffix', () => {
      const handlers = createConversationItemHandlers(mockDeps)

      const result = handlers.handleConversationItemEvent(
        'prefix.conversation.item.truncated',
        {}
      )

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.finalizeAssistant).toHaveBeenCalled()
    })
  })

  describe('event type matching', () => {
    it('should return false for unhandled event types', () => {
      const handlers = createConversationItemHandlers(mockDeps)

      const result = handlers.handleConversationItemEvent('unknown.event', {})

      expect(result).toBe(false)
    })

    it('should handle conversation.item.created variants', () => {
      const handlers = createConversationItemHandlers(mockDeps)
      const payload = { item: { role: 'user' } }

      const result = handlers.handleConversationItemEvent('conversation.item.created', payload)

      expect(result).toBe(true)
    })
  })

  describe('replay logic', () => {
    it('should clear relay tracking on backend restart', () => {
      mockDeps.endpointing.handleBackendUserItem = vi.fn(() => true)
      const handlers = createConversationItemHandlers(mockDeps)
      const payload = { item: { role: 'user' } }

      handlers.handleConversationItemEvent('conversation.item.created', payload)

      expect(mockDeps.relay.setLastRelayedItemId).toHaveBeenCalledWith(null)
    })

    it('should emit empty transcript event on restart', () => {
      mockDeps.endpointing.handleBackendUserItem = vi.fn(() => true)
      const handlers = createConversationItemHandlers(mockDeps)
      const payload = { item: { role: 'user' } }

      handlers.handleConversationItemEvent('conversation.item.created', payload)

      expect(mockDeps.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transcript',
          role: 'user',
          text: '',
          isFinal: false,
          timings: expect.objectContaining({
            startedAtMs: expect.any(Number),
            emittedAtMs: expect.any(Number),
          }),
        })
      )
    })
  })

  describe('role-based branching', () => {
    it('should call different handlers for user vs assistant', () => {
      const handlers = createConversationItemHandlers(mockDeps)

      handlers.handleConversationItemEvent('conversation.item.created', {
        item: { role: 'user' },
      })
      handlers.handleConversationItemEvent('conversation.item.created', {
        item: { role: 'assistant' },
      })

      expect(mockDeps.endpointing.handleBackendUserItem).toHaveBeenCalledTimes(1)
      expect(mockDeps.transcriptEngine.startAssistantResponse).toHaveBeenCalledTimes(1)
    })
  })
})
