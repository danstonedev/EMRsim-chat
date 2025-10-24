import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSpeechEventHandlers,
  type SpeechEventDependencies,
} from '../../../../../features/voice/conversation/events/speechEvents'

describe('speechEvents', () => {
  let mockDeps: SpeechEventDependencies

  beforeEach(() => {
    mockDeps = {
      endpointing: {
        handleSpeechStarted: vi.fn(() => 'continue-active-turn' as const),
        handleSpeechStopped: vi.fn(),
      },
      transcriptEngine: {
        startUserTranscript: vi.fn(),
      },
      sessionReuse: {
        getUserHasSpoken: vi.fn(() => false),
        setUserHasSpoken: vi.fn(),
        getInitialAssistantAutoPauseActive: vi.fn(() => false),
        releaseInitialAssistantAutoPause: vi.fn(),
        getDropNextAssistantResponse: vi.fn(() => false),
        setDropNextAssistantResponse: vi.fn(),
      },
      logDebug: vi.fn(),
      emit: vi.fn(),
    }
  })

  describe('handleSpeechEvent', () => {
    it('should handle input_audio_buffer.speech_started with continue-active-turn', () => {
      const handlers = createSpeechEventHandlers(mockDeps)
      const result = handlers.handleSpeechEvent('input_audio_buffer.speech_started', {})

      expect(result).toBe(true)
      expect(mockDeps.endpointing.handleSpeechStarted).toHaveBeenCalled()
      expect(mockDeps.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('Continuing active turn')
      )
      expect(mockDeps.transcriptEngine.startUserTranscript).not.toHaveBeenCalled()
    })

    it('should handle speech_started with new-turn action and start transcript', () => {
      mockDeps.endpointing.handleSpeechStarted = vi.fn(() => 'new-turn')
      
      const handlers = createSpeechEventHandlers(mockDeps)
      const result = handlers.handleSpeechEvent('input_audio_buffer.speech_started', {})

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.startUserTranscript).toHaveBeenCalled()
      expect(mockDeps.sessionReuse.setUserHasSpoken).toHaveBeenCalledWith(true)
      expect(mockDeps.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transcript',
          role: 'user',
          text: '',
          isFinal: false,
        })
      )
    })

    it('should handle speech_started with start-new-turn action', () => {
      mockDeps.endpointing.handleSpeechStarted = vi.fn(() => 'start-new-turn')
      
      const handlers = createSpeechEventHandlers(mockDeps)
      const result = handlers.handleSpeechEvent('input_audio_buffer.speech_started', {})

      expect(result).toBe(true)
      expect(mockDeps.transcriptEngine.startUserTranscript).toHaveBeenCalled()
      expect(mockDeps.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('User speech started')
      )
    })

    it('should handle input_audio_buffer.speech_stopped', () => {
      const handlers = createSpeechEventHandlers(mockDeps)
      const result = handlers.handleSpeechEvent('input_audio_buffer.speech_stopped', {})

      expect(result).toBe(true)
      expect(mockDeps.endpointing.handleSpeechStopped).toHaveBeenCalled()
      expect(mockDeps.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('User speech stopped')
      )
    })

    it('should return false for non-speech event types', () => {
      const handlers = createSpeechEventHandlers(mockDeps)
      const result = handlers.handleSpeechEvent('other_event', {})

      expect(result).toBe(false)
      expect(mockDeps.endpointing.handleSpeechStarted).not.toHaveBeenCalled()
      expect(mockDeps.endpointing.handleSpeechStopped).not.toHaveBeenCalled()
    })

    it('should mark user as having spoken on new turn', () => {
      mockDeps.endpointing.handleSpeechStarted = vi.fn(() => 'new-turn')
      mockDeps.sessionReuse.getUserHasSpoken = vi.fn(() => false)
      
      const handlers = createSpeechEventHandlers(mockDeps)
      handlers.handleSpeechEvent('input_audio_buffer.speech_started', {})

      expect(mockDeps.sessionReuse.setUserHasSpoken).toHaveBeenCalledWith(true)
    })

    it('should not mark user as spoken again if already tracked', () => {
      mockDeps.endpointing.handleSpeechStarted = vi.fn(() => 'new-turn')
      mockDeps.sessionReuse.getUserHasSpoken = vi.fn(() => true)
      
      const handlers = createSpeechEventHandlers(mockDeps)
      handlers.handleSpeechEvent('input_audio_buffer.speech_started', {})

      expect(mockDeps.sessionReuse.setUserHasSpoken).not.toHaveBeenCalled()
    })

    it('should release initial assistant auto-pause if active', () => {
      mockDeps.endpointing.handleSpeechStarted = vi.fn(() => 'new-turn')
      mockDeps.sessionReuse.getInitialAssistantAutoPauseActive = vi.fn(() => true)
      
      const handlers = createSpeechEventHandlers(mockDeps)
      handlers.handleSpeechEvent('input_audio_buffer.speech_started', {})

      expect(mockDeps.sessionReuse.releaseInitialAssistantAutoPause).toHaveBeenCalledWith('speech-started')
    })

    it('should clear drop-next-response flag on new turn', () => {
      mockDeps.endpointing.handleSpeechStarted = vi.fn(() => 'new-turn')
      
      const handlers = createSpeechEventHandlers(mockDeps)
      handlers.handleSpeechEvent('input_audio_buffer.speech_started', {})

      expect(mockDeps.sessionReuse.setDropNextAssistantResponse).toHaveBeenCalledWith(false)
    })
  })

  describe('endpointing coordination', () => {
    it('should call handle speech Started on endpointing', () => {
      const handlers = createSpeechEventHandlers(mockDeps)
      handlers.handleSpeechEvent('input_audio_buffer.speech_started', {})

      expect(mockDeps.endpointing.handleSpeechStarted).toHaveBeenCalledWith(expect.any(Number))
    })

    it('should call handleSpeechStopped on endpointing', () => {
      const handlers = createSpeechEventHandlers(mockDeps)
      handlers.handleSpeechEvent('input_audio_buffer.speech_stopped', {})

      expect(mockDeps.endpointing.handleSpeechStopped).toHaveBeenCalledWith(expect.any(Number))
    })
  })
})
