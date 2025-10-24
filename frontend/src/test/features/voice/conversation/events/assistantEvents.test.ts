import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createAssistantStreamHandlers,
  type AssistantStreamDependencies,
} from '../../../../../features/voice/conversation/events/assistantEvents'

describe('assistantEvents', () => {
  let mockDeps: AssistantStreamDependencies
  let mockAudioElement: HTMLAudioElement

  beforeEach(() => {
    mockAudioElement = {
      volume: 1.0,
      muted: false,
    } as HTMLAudioElement

    mockDeps = {
      logDebug: vi.fn(),
      sessionReuse: {
        getDropNextAssistantResponse: vi.fn(() => false),
        setDropNextAssistantResponse: vi.fn(),
        getSessionReused: vi.fn(() => false),
        getUserHasSpoken: vi.fn(() => false),
        getInitialAssistantGuardUsed: vi.fn(() => false),
        setInitialAssistantGuardUsed: vi.fn(),
        getInitialAssistantAutoPauseActive: vi.fn(() => false),
        setInitialAssistantAutoPauseActive: vi.fn(),
        releaseInitialAssistantAutoPause: vi.fn(),
        scheduleInitialAssistantRelease: vi.fn(),
        setAutoMicPaused: vi.fn(),
        getRemoteAudioElement: vi.fn(() => mockAudioElement),
        getRemoteVolumeBeforeGuard: vi.fn(() => null),
        setRemoteVolumeBeforeGuard: vi.fn(),
      },
      endpointing: {
        prepareAssistantResponseStart: vi.fn(() => 'none'),
        getUserFinalized: vi.fn(() => true),
        getUserHasDelta: vi.fn(() => false),
        getUserSpeechPending: vi.fn(() => false),
        markTurnFinalized: vi.fn(),
      },
      transcriptEngine: {
        startAssistantResponse: vi.fn(),
        pushAssistantDelta: vi.fn(),
        finalizeAssistant: vi.fn(),
        finalizeUser: vi.fn(),
      },
      transcriptCoordinator: {
        clearUserPartial: vi.fn(),
        clearAssistantPartial: vi.fn(),
      },
      emitDebug: vi.fn(),
    }
  })

  describe('response.created', () => {
    it('should handle normal response.created without guard', () => {
      const handlers = createAssistantStreamHandlers(mockDeps)

      const result = handlers.handleAssistantEvent('response.created', {})

      expect(result).toBe(true)
      expect(mockDeps.sessionReuse.setInitialAssistantGuardUsed).not.toHaveBeenCalled()
    })

    it('should engage guard when conditions met', () => {
      mockDeps.sessionReuse.getDropNextAssistantResponse = vi.fn(() => true)
      mockDeps.sessionReuse.getSessionReused = vi.fn(() => true)
      mockDeps.sessionReuse.getUserHasSpoken = vi.fn(() => false)
      mockDeps.sessionReuse.getInitialAssistantGuardUsed = vi.fn(() => false)

      const handlers = createAssistantStreamHandlers(mockDeps)
      handlers.handleAssistantEvent('response.created', {})

      expect(mockDeps.sessionReuse.setDropNextAssistantResponse).toHaveBeenCalledWith(false)
      expect(mockDeps.sessionReuse.setInitialAssistantGuardUsed).toHaveBeenCalledWith(true)
      expect(mockDeps.sessionReuse.setInitialAssistantAutoPauseActive).toHaveBeenCalledWith(true)
      expect(mockDeps.sessionReuse.setAutoMicPaused).toHaveBeenCalledWith('initial-assistant', true)
    })

    it('should mute remote audio when engaging guard', () => {
      mockDeps.sessionReuse.getDropNextAssistantResponse = vi.fn(() => true)
      mockDeps.sessionReuse.getSessionReused = vi.fn(() => true)

      const handlers = createAssistantStreamHandlers(mockDeps)
      handlers.handleAssistantEvent('response.created', {})

      expect(mockAudioElement.muted).toBe(true)
      expect(mockDeps.sessionReuse.setRemoteVolumeBeforeGuard).toHaveBeenCalledWith(1.0)
    })

    it('should not engage guard if user has already spoken', () => {
      mockDeps.sessionReuse.getDropNextAssistantResponse = vi.fn(() => true)
      mockDeps.sessionReuse.getSessionReused = vi.fn(() => true)
      mockDeps.sessionReuse.getUserHasSpoken = vi.fn(() => true)

      const handlers = createAssistantStreamHandlers(mockDeps)
      handlers.handleAssistantEvent('response.created', {})

      expect(mockDeps.sessionReuse.setInitialAssistantGuardUsed).not.toHaveBeenCalled()
    })
  })

  describe('assistant response start (via response.created)', () => {
    it('should prepare for assistant response start', () => {
      mockDeps.endpointing.prepareAssistantResponseStart = vi.fn(() => 'none')
      const handlers = createAssistantStreamHandlers(mockDeps)

      handlers.handleAssistantEvent('response.created', {})

      expect(mockDeps.endpointing.prepareAssistantResponseStart).toHaveBeenCalled()
      expect(mockDeps.transcriptEngine.startAssistantResponse).toHaveBeenCalled()
    })

    it('should finalize user from deltas when action is finalize-from-deltas', () => {
      mockDeps.endpointing.prepareAssistantResponseStart = vi.fn(() => 'finalize-from-deltas')
      mockDeps.endpointing.getUserFinalized = vi.fn(() => false)

      const handlers = createAssistantStreamHandlers(mockDeps)
      handlers.handleAssistantEvent('response.created', {})

      expect(mockDeps.transcriptEngine.finalizeUser).toHaveBeenCalledWith({})
      expect(mockDeps.transcriptCoordinator.clearUserPartial).toHaveBeenCalled()
      expect(mockDeps.endpointing.markTurnFinalized).toHaveBeenCalled()
    })

    it('should finalize empty user when action is finalize-empty', () => {
      mockDeps.endpointing.prepareAssistantResponseStart = vi.fn(() => 'finalize-empty')
      mockDeps.endpointing.getUserFinalized = vi.fn(() => false)

      const handlers = createAssistantStreamHandlers(mockDeps)
      handlers.handleAssistantEvent('response.created', {})

      expect(mockDeps.transcriptEngine.finalizeUser).toHaveBeenCalledWith({})
      expect(mockDeps.transcriptCoordinator.clearUserPartial).toHaveBeenCalled()
      expect(mockDeps.endpointing.markTurnFinalized).toHaveBeenCalled()
    })

    it('should not finalize when action is wait-for-pending', () => {
      mockDeps.endpointing.prepareAssistantResponseStart = vi.fn(() => 'wait-for-pending')

      const handlers = createAssistantStreamHandlers(mockDeps)
      handlers.handleAssistantEvent('response.created', {})

      expect(mockDeps.transcriptEngine.finalizeUser).not.toHaveBeenCalled()
    })
  })

  describe('content_part.added (text delta)', () => {
    it('should push text delta to transcript engine', () => {
      const handlers = createAssistantStreamHandlers(mockDeps)
      const payload = { delta: 'Hello' }

      const result = handlers.handleAssistantEvent('response.content_part.added', payload)

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.pushAssistantDelta).toHaveBeenCalledWith(payload, false)
    })
  })

  describe('audio_transcript.delta', () => {
    it('should push audio delta to transcript engine', () => {
      const handlers = createAssistantStreamHandlers(mockDeps)
      const payload = { delta: 'Hello from audio' }

      const result = handlers.handleAssistantEvent('response.audio_transcript.delta', payload)

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.pushAssistantDelta).toHaveBeenCalledWith(payload, true)
    })
  })

  describe('content_part.done (text finalization)', () => {
    it('should finalize text response', () => {
      const handlers = createAssistantStreamHandlers(mockDeps)
      const payload = { text: 'Complete response' }

      const result = handlers.handleAssistantEvent('response.content_part.done', payload)

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.finalizeAssistant).toHaveBeenCalledWith(payload, false)
      expect(mockDeps.transcriptCoordinator.clearAssistantPartial).toHaveBeenCalled()
    })
  })

  describe('audio_transcript.done', () => {
    it('should finalize audio transcript response', () => {
      const handlers = createAssistantStreamHandlers(mockDeps)
      const payload = { transcript: 'Complete audio response' }

      const result = handlers.handleAssistantEvent('response.audio_transcript.done', payload)

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.finalizeAssistant).toHaveBeenCalledWith(payload, true)
      expect(mockDeps.transcriptCoordinator.clearAssistantPartial).toHaveBeenCalled()
    })
  })

  describe('response.done', () => {
    it('should finalize assistant response', () => {
      const handlers = createAssistantStreamHandlers(mockDeps)
      const payload = { text: 'Complete' }

      const result = handlers.handleAssistantEvent('response.done', payload)

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.finalizeAssistant).toHaveBeenCalledWith(payload, false)
    })
  })

  describe('event type matching', () => {
    it('should return false for unhandled event types', () => {
      const handlers = createAssistantStreamHandlers(mockDeps)

      const result = handlers.handleAssistantEvent('unknown.event', {})

      expect(result).toBe(false)
    })

    it('should handle events with prefixes', () => {
      const handlers = createAssistantStreamHandlers(mockDeps)

      const result = handlers.handleAssistantEvent('prefix.response.created', {})

      expect(result).toBe(true)
    })
  })

  describe('guard engagement logic', () => {
    it('should require all conditions to engage guard', () => {
      // Missing: dropNext
      mockDeps.sessionReuse.getDropNextAssistantResponse = vi.fn(() => false)
      mockDeps.sessionReuse.getSessionReused = vi.fn(() => true)

      const handlers = createAssistantStreamHandlers(mockDeps)
      handlers.handleAssistantEvent('response.created', {})

      expect(mockDeps.sessionReuse.setInitialAssistantGuardUsed).not.toHaveBeenCalled()
    })

    it('should not engage guard if already used', () => {
      mockDeps.sessionReuse.getDropNextAssistantResponse = vi.fn(() => true)
      mockDeps.sessionReuse.getSessionReused = vi.fn(() => true)
      mockDeps.sessionReuse.getInitialAssistantGuardUsed = vi.fn(() => true)

      const handlers = createAssistantStreamHandlers(mockDeps)
      handlers.handleAssistantEvent('response.created', {})

      expect(mockDeps.sessionReuse.setInitialAssistantAutoPauseActive).not.toHaveBeenCalled()
    })
  })
})
