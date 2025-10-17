import type { ConversationEvent } from '../../../../shared/types'
import type { TranscriptRole } from '../types/transcript'

export interface SpeechEventDependencies {
  logDebug: (...args: unknown[]) => void
  endpointing: {
    handleSpeechStarted(timestamp: number): 'continue-active-turn' | 'new-turn' | 'start-new-turn'
    handleSpeechStopped(timestamp: number): void
  }
  transcriptEngine: {
    startUserTranscript(): void
  }
  sessionReuse: {
    getUserHasSpoken(): boolean
    setUserHasSpoken(value: boolean): void
    getInitialAssistantAutoPauseActive(): boolean
    releaseInitialAssistantAutoPause(reason: string): void
    getDropNextAssistantResponse(): boolean
    setDropNextAssistantResponse(value: boolean): void
  }
  emit(event: ConversationEvent): void
}

export interface SpeechEventHandlers {
  handleSpeechEvent(type: string, payload: unknown): boolean
}

/**
 * Creates handlers for speech detection events (input_audio_buffer.speech_started/stopped/committed).
 * Manages turn boundaries, endpointing coordination, and initial transcript emission.
 */
export function createSpeechEventHandlers(deps: SpeechEventDependencies): SpeechEventHandlers {
  function handleSpeechEvent(type: string, _payload: unknown): boolean {
    // speech_started: initiate new user turn
    if (type === 'input_audio_buffer.speech_started' || type.endsWith('input_audio_buffer.speech_started')) {
      const result = deps.endpointing.handleSpeechStarted(Date.now())
      if (result === 'continue-active-turn') {
        deps.logDebug('[SpeechEventHandlers] 🔄 Continuing active turn (brief pause detected, not starting new bubble)')
        return true
      }
      // Handle both 'new-turn' and 'start-new-turn' (legacy API variations)
      if (result !== 'new-turn' && result !== 'start-new-turn') {
        return true
      }

      if (!deps.sessionReuse.getUserHasSpoken()) {
        deps.sessionReuse.setUserHasSpoken(true)
      }
      if (deps.sessionReuse.getInitialAssistantAutoPauseActive()) {
        deps.sessionReuse.releaseInitialAssistantAutoPause('speech-started')
      }
      deps.sessionReuse.setDropNextAssistantResponse(false)

      deps.logDebug('[SpeechEventHandlers] 🎤 User speech started - initializing new turn')
      deps.transcriptEngine.startUserTranscript()
      const speechStartedAt = Date.now()
      deps.emit({
        type: 'transcript',
        role: 'user' as TranscriptRole,
        text: '',
        isFinal: false,
        timestamp: speechStartedAt,
        timings: {
          startedAtMs: speechStartedAt,
          emittedAtMs: speechStartedAt,
        },
      })
      return true
    }

    // speech_stopped: mark audio captured, transcription incoming
    if (type === 'input_audio_buffer.speech_stopped' || type.endsWith('input_audio_buffer.speech_stopped')) {
      deps.logDebug('[SpeechEventHandlers] 🛑 User speech stopped')
      deps.endpointing.handleSpeechStopped(Date.now())
      deps.logDebug('🔧 Set userSpeechPending = true (audio captured, transcription incoming)')
      return true
    }

    return false
  }

  return { handleSpeechEvent }
}
