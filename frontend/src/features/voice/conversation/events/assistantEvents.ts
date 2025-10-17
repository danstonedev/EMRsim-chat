import type { VoiceDebugEvent } from '../../../../shared/types'

export interface AssistantStreamDependencies {
  logDebug: (...args: unknown[]) => void
  sessionReuse: {
    getDropNextAssistantResponse(): boolean
    setDropNextAssistantResponse(value: boolean): void
    getSessionReused(): boolean
    getUserHasSpoken(): boolean
    getInitialAssistantGuardUsed(): boolean
    setInitialAssistantGuardUsed(value: boolean): void
    getInitialAssistantAutoPauseActive(): boolean
    setInitialAssistantAutoPauseActive(value: boolean): void
    releaseInitialAssistantAutoPause(reason: string): void
    scheduleInitialAssistantRelease(reason: string): void
    setAutoMicPaused(reason: string, paused: boolean): void
    getRemoteAudioElement(): HTMLAudioElement | null
    getRemoteVolumeBeforeGuard(): number | null
    setRemoteVolumeBeforeGuard(value: number | null): void
  }
  endpointing: {
    prepareAssistantResponseStart():
      | 'finalize-from-deltas'
      | 'wait-for-pending'
      | 'wait-for-commit'
      | 'finalize-empty'
      | 'none'
    getUserFinalized(): boolean
    getUserHasDelta(): boolean
    getUserSpeechPending(): boolean
    markTurnFinalized(): void
  }
  transcriptEngine: {
    startAssistantResponse(): void
    pushAssistantDelta(payload: unknown, isAudio: boolean): void
    finalizeAssistant(payload: unknown, isAudio: boolean): void
    finalizeUser(payload: unknown): void
  }
  transcriptCoordinator: {
    clearUserPartial(): void
    clearAssistantPartial(): void
  }
  emitDebug(event: VoiceDebugEvent): void
}

export interface AssistantStreamHandlers {
  handleAssistantEvent(type: string, payload: unknown): boolean
}

/**
 * Creates handlers for assistant response events (streaming text/audio, response lifecycle).
 * Manages delta aggregation, media markers, mic guard release, and response finalization.
 */
export function createAssistantStreamHandlers(deps: AssistantStreamDependencies): AssistantStreamHandlers {
  function handleAssistantEvent(type: string, payload: unknown): boolean {
    // response.created: assistant response begins
    if (type === 'response.created' || type.endsWith('response.created')) {
      const shouldEngageGuard =
        deps.sessionReuse.getDropNextAssistantResponse() &&
        deps.sessionReuse.getSessionReused() &&
        !deps.sessionReuse.getUserHasSpoken() &&
        !deps.sessionReuse.getInitialAssistantGuardUsed()

      if (shouldEngageGuard) {
        deps.sessionReuse.setDropNextAssistantResponse(false)
        deps.sessionReuse.setInitialAssistantGuardUsed(true)
        deps.sessionReuse.setInitialAssistantAutoPauseActive(true)
        deps.sessionReuse.setAutoMicPaused('initial-assistant', true)

        const remoteAudioElement = deps.sessionReuse.getRemoteAudioElement()
        if (remoteAudioElement) {
          if (deps.sessionReuse.getRemoteVolumeBeforeGuard() == null) {
            deps.sessionReuse.setRemoteVolumeBeforeGuard(remoteAudioElement.volume)
          }
          remoteAudioElement.muted = true
        }

        deps.emitDebug({
          t: new Date().toISOString(),
          kind: 'event',
          src: 'app',
          msg: 'assistant.initial.guard.engaged',
          data: { trigger: type, reuse: true },
        })
        deps.sessionReuse.scheduleInitialAssistantRelease('guard-timeout')
      } else if (deps.sessionReuse.getInitialAssistantAutoPauseActive()) {
        deps.sessionReuse.releaseInitialAssistantAutoPause('assistant-response')
      }

      deps.logDebug('[AssistantStreamHandlers] 🤖 Assistant response starting')
      const action = deps.endpointing.prepareAssistantResponseStart()
      deps.emitDebug({
        t: new Date().toISOString(),
        kind: 'info',
        src: 'app',
        msg: 'assistant.response.start',
        data: {
          action,
          userFinalized: deps.endpointing.getUserFinalized(),
          userHasDelta: deps.endpointing.getUserHasDelta(),
          userSpeechPending: deps.endpointing.getUserSpeechPending(),
        },
      })

      switch (action) {
        case 'finalize-from-deltas':
          deps.logDebug(
            '[AssistantStreamHandlers] ⚠️ Force finalizing pending user transcript before assistant response (from deltas)'
          )
          deps.transcriptEngine.finalizeUser({})
          deps.transcriptCoordinator.clearUserPartial()
          deps.endpointing.markTurnFinalized()
          break
        case 'wait-for-pending':
          deps.logDebug(
            '[AssistantStreamHandlers] ⏳ User speech pending - waiting for transcription (speech_stopped → response.created race)'
          )
          break
        case 'wait-for-commit':
          deps.logDebug(
            '[AssistantStreamHandlers] ⏳ Waiting for transcription to complete (audio committed, no deltas yet)'
          )
          break
        case 'finalize-empty':
          deps.logDebug(
            '[AssistantStreamHandlers] ℹ️ Assistant starting without prior user input (initial greeting or follow-up)'
          )
          deps.transcriptEngine.finalizeUser({})
          deps.transcriptCoordinator.clearUserPartial()
          deps.endpointing.markTurnFinalized()
          break
        case 'none':
        default:
          break
      }

      deps.transcriptEngine.startAssistantResponse()
      return true
    }

    // Assistant text deltas
    if (type.includes('content_part.added') || type.endsWith('response.content_part.delta')) {
      deps.transcriptEngine.pushAssistantDelta(payload, false)
      return true
    }

    if (
      type.includes('output_text.delta') ||
      type === 'response.delta' ||
      type.endsWith('response.output_text.delta')
    ) {
      deps.transcriptEngine.pushAssistantDelta(payload, false)
      return true
    }

    // Assistant audio transcript deltas
    if (type.includes('audio_transcript.delta') || type.endsWith('response.audio_transcript.delta')) {
      deps.transcriptEngine.pushAssistantDelta(payload, true)
      return true
    }

    // Assistant text finalization
    if (type.includes('content_part.done') || type.endsWith('response.content_part.done')) {
      deps.transcriptEngine.finalizeAssistant(payload, false)
      deps.transcriptCoordinator.clearAssistantPartial()
      return true
    }

    if (
      type.includes('output_text.done') ||
      type.endsWith('response.output_text.done') ||
      type === 'response.completed' ||
      type === 'response.done'
    ) {
      deps.transcriptEngine.finalizeAssistant(payload, false)
      deps.transcriptCoordinator.clearAssistantPartial()
      return true
    }

    // Assistant audio transcript finalization
    if (type.includes('audio_transcript.done') || type.endsWith('response.audio_transcript.done')) {
      deps.transcriptEngine.finalizeAssistant(payload, true)
      deps.transcriptCoordinator.clearAssistantPartial()
      return true
    }

    return false
  }

  return { handleAssistantEvent }
}
