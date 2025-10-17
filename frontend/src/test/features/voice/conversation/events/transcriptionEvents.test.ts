import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createTranscriptionEventHandlers,
  type TranscriptionEventDependencies,
} from '../../../../../features/voice/conversation/events/transcriptionEvents'

describe('transcriptionEvents', () => {
  let mockDeps: TranscriptionEventDependencies

  beforeEach(() => {
    mockDeps = {
      logDebug: vi.fn(),
      backendTranscriptMode: true,
      endpointing: {
        getUserFinalized: vi.fn(() => false),
        handleTranscriptionCompleted: vi.fn(() => true),
        markTurnFinalized: vi.fn(),
        clearCommitTimer: vi.fn(),
        handleAudioCommitted: vi.fn(() => 3000),
        handleTranscriptionFailed: vi.fn(),
        handleTranscriptionDelta: vi.fn(() => ({ restarted: false })),
        recordWordCount: vi.fn(),
      },
      transcriptEngine: {
        finalizeUser: vi.fn(),
        getUserBuffer: vi.fn(() => 'test transcript'),
        pushUserDelta: vi.fn(),
        startUserTranscript: vi.fn(),
      },
      transcriptCoordinator: {
        finalizeUser: vi.fn(),
        clearUserPartial: vi.fn(),
      },
      relay: {
        getLastRelayedItemId: vi.fn(() => null),
        setLastRelayedItemId: vi.fn(),
        relayTranscriptToBackend: vi.fn().mockResolvedValue(undefined),
      },
      emit: vi.fn(),
    }
  })

  describe('transcription completion', () => {
    it('should finalize user transcript on completion', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { transcript: 'Hello world', item_id: 'item_123' }

      const result = handlers.handleTranscriptionEvent('input_transcription.completed', payload)

      expect(result).toBe(true)
      expect(mockDeps.endpointing.handleTranscriptionCompleted).toHaveBeenCalled()
      expect(mockDeps.transcriptCoordinator.finalizeUser).toHaveBeenCalledWith({ transcript: 'Hello world' })
      expect(mockDeps.endpointing.clearCommitTimer).toHaveBeenCalled()
    })

    it('should skip empty transcript completions', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { transcript: '', item_id: 'item_123' }

      const result = handlers.handleTranscriptionEvent('input_transcription.completed', payload)

      expect(result).toBe(true)
      expect(mockDeps.transcriptCoordinator.finalizeUser).not.toHaveBeenCalled()
    })

    it('should skip whitespace-only transcript completions', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { transcript: '   ', item_id: 'item_123' }

      const result = handlers.handleTranscriptionEvent('input_transcription.completed', payload)

      expect(result).toBe(true)
      expect(mockDeps.transcriptCoordinator.finalizeUser).not.toHaveBeenCalled()
    })

    it('should relay transcript to backend when enabled', async () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { transcript: 'Hello world', item_id: 'item_123' }

      handlers.handleTranscriptionEvent('input_transcription.completed', payload)

      await new Promise(resolve => setTimeout(resolve, 0))
      expect(mockDeps.relay.relayTranscriptToBackend).toHaveBeenCalledWith(
        'user',
        'Hello world',
        true,
        expect.any(Number),
        undefined,
        'item_123'
      )
      expect(mockDeps.relay.setLastRelayedItemId).toHaveBeenCalledWith('item_123')
    })

    it('should skip relay if item_id already relayed', () => {
      mockDeps.relay.getLastRelayedItemId = vi.fn(() => 'item_123')
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { transcript: 'Hello world', item_id: 'item_123' }

      handlers.handleTranscriptionEvent('input_transcription.completed', payload)

      expect(mockDeps.relay.relayTranscriptToBackend).not.toHaveBeenCalled()
    })

    it('should not relay when backendTranscriptMode is disabled', () => {
      mockDeps.backendTranscriptMode = false
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { transcript: 'Hello world', item_id: 'item_123' }

      handlers.handleTranscriptionEvent('input_transcription.completed', payload)

      expect(mockDeps.relay.relayTranscriptToBackend).not.toHaveBeenCalled()
    })

    it('should record word count for smart patience detection', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { transcript: 'Hello world this is a test', item_id: 'item_123' }

      handlers.handleTranscriptionEvent('input_transcription.completed', payload)

      expect(mockDeps.endpointing.recordWordCount).toHaveBeenCalledWith(6)
    })

    it('should skip finalization if already finalized', () => {
      mockDeps.endpointing.handleTranscriptionCompleted = vi.fn(() => false)
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { transcript: 'Hello world', item_id: 'item_123' }

      handlers.handleTranscriptionEvent('input_transcription.completed', payload)

      expect(mockDeps.transcriptCoordinator.finalizeUser).not.toHaveBeenCalled()
    })
  })

  describe('transcription deltas', () => {
    it('should handle transcription delta updates', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { delta: 'Hello', transcript: 'Hello' }

      const result = handlers.handleTranscriptionEvent('input_audio_transcription.delta', payload)

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.pushUserDelta).toHaveBeenCalledWith(payload)
      expect(mockDeps.endpointing.handleTranscriptionDelta).toHaveBeenCalled()
    })

    it('should restart transcript when delta indicates restart', () => {
      mockDeps.endpointing.handleTranscriptionDelta = vi.fn(() => ({ restarted: true }))
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { delta: 'Hello', transcript: 'Hello' }

      handlers.handleTranscriptionEvent('input_audio_transcription.delta', payload)

      expect(mockDeps.transcriptEngine.startUserTranscript).toHaveBeenCalled()
    })
  })

  describe('text input handling', () => {
    it('should finalize on input_text.done', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { text: 'Typed message' }

      const result = handlers.handleTranscriptionEvent('input_text.done', payload)

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.finalizeUser).toHaveBeenCalledWith(payload)
      expect(mockDeps.transcriptCoordinator.clearUserPartial).toHaveBeenCalled()
      expect(mockDeps.endpointing.markTurnFinalized).toHaveBeenCalled()
    })

    it('should skip finalization if already finalized', () => {
      mockDeps.endpointing.getUserFinalized = vi.fn(() => true)
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { text: 'Typed message' }

      handlers.handleTranscriptionEvent('input_text.done', payload)

      expect(mockDeps.transcriptEngine.finalizeUser).not.toHaveBeenCalled()
    })
  })

  describe('audio buffer commit', () => {
    it('should schedule STT fallback timeout on commit', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)

      const result = handlers.handleTranscriptionEvent('input_audio_buffer.committed', {})

      expect(result).toBe(true)
      expect(mockDeps.endpointing.handleAudioCommitted).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Function)
      )
    })

    it('should execute fallback if transcription never arrives', () => {
      let fallbackCallback: (() => void) | null = null
  mockDeps.endpointing.handleAudioCommitted = vi.fn((_timestamp, callback) => {
        fallbackCallback = callback
        return 3000
      })

      const handlers = createTranscriptionEventHandlers(mockDeps)
      handlers.handleTranscriptionEvent('input_audio_buffer.committed', {})

      expect(fallbackCallback).not.toBeNull()
      fallbackCallback!()

      expect(mockDeps.transcriptEngine.finalizeUser).toHaveBeenCalledWith({})
      expect(mockDeps.transcriptCoordinator.clearUserPartial).toHaveBeenCalled()
      expect(mockDeps.endpointing.markTurnFinalized).toHaveBeenCalled()
    })

    it('should not execute fallback if already finalized', () => {
      let fallbackCallback: (() => void) | null = null
  mockDeps.endpointing.handleAudioCommitted = vi.fn((_timestamp, callback) => {
        fallbackCallback = callback
        return 3000
      })
      mockDeps.endpointing.getUserFinalized = vi.fn(() => true)

      const handlers = createTranscriptionEventHandlers(mockDeps)
      handlers.handleTranscriptionEvent('input_audio_buffer.committed', {})

      fallbackCallback!()

      expect(mockDeps.transcriptEngine.finalizeUser).not.toHaveBeenCalled()
    })
  })

  describe('transcription failures', () => {
    it('should handle transcription failure', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { error: { message: 'Transcription failed' } }

      const result = handlers.handleTranscriptionEvent('input_audio_transcription.failed', payload)

      expect(result).toBe(true)
      expect(mockDeps.endpointing.handleTranscriptionFailed).toHaveBeenCalled()
    })

    it('should finalize with fallback text on failure if not already finalized', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { error: { message: 'Transcription failed' } }

      handlers.handleTranscriptionEvent('input_audio_transcription.failed', payload)

      expect(mockDeps.transcriptEngine.finalizeUser).toHaveBeenCalledWith({
        transcript: '[Speech not transcribed]',
      })
      expect(mockDeps.transcriptCoordinator.clearUserPartial).toHaveBeenCalled()
      expect(mockDeps.endpointing.handleTranscriptionFailed).toHaveBeenCalled()
    })

    it('should detect rate limit errors (429)', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { error: { message: 'Error 429: Too Many Requests' } }

      handlers.handleTranscriptionEvent('input_audio_transcription.failed', payload)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('RATE LIMIT ERROR'),
        expect.any(String)
      )
      consoleSpy.mockRestore()
    })

    it('should skip finalization on failure if already finalized', () => {
      mockDeps.endpointing.getUserFinalized = vi.fn(() => true)
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { error: { message: 'Transcription failed' } }

      handlers.handleTranscriptionEvent('input_audio_transcription.failed', payload)

      expect(mockDeps.transcriptCoordinator.finalizeUser).not.toHaveBeenCalled()
    })
  })

  describe('event type matching', () => {
    it('should match input_audio_transcription.completed', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { transcript: 'test', item_id: 'item_1' }

      const result = handlers.handleTranscriptionEvent('input_audio_transcription.completed', payload)

      expect(result).toBe(true)
    })

    it('should match conversation.item.input_audio_transcription.completed', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)
      const payload = { transcript: 'test', item_id: 'item_1' }

      const result = handlers.handleTranscriptionEvent(
        'conversation.item.input_audio_transcription.completed',
        payload
      )

      expect(result).toBe(true)
    })

    it('should return false for unhandled event types', () => {
      const handlers = createTranscriptionEventHandlers(mockDeps)

      const result = handlers.handleTranscriptionEvent('unknown.event', {})

      expect(result).toBe(false)
    })
  })
})
