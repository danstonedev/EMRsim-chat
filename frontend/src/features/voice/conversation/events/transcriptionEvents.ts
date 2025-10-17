import type { ConversationEvent } from '../../../../shared/types'
import type { TranscriptRole } from '../types/transcript'

export interface TranscriptionEventDependencies {
  logDebug: (...args: unknown[]) => void
  backendTranscriptMode: boolean
  endpointing: {
    getUserFinalized(): boolean
    handleTranscriptionCompleted(): boolean
    markTurnFinalized(): void
    clearCommitTimer(): void
    handleAudioCommitted(timestamp: number, fallbackCallback: () => void): number
    handleTranscriptionFailed(): void
    handleTranscriptionDelta(timestamp: number, extendedCallback: () => void): { restarted: boolean }
    recordWordCount(count: number): void
  }
  transcriptEngine: {
    finalizeUser(payload: unknown): void
    getUserBuffer(): string
    pushUserDelta(payload: unknown): void
    startUserTranscript(): void
  }
  transcriptCoordinator: {
    finalizeUser(data: { transcript: string }): void
    clearUserPartial(): void
  }
  relay: {
    getLastRelayedItemId(): string | null
    setLastRelayedItemId(id: string | null): void
    relayTranscriptToBackend(
      role: 'user' | 'assistant',
      text: string,
      isFinal: boolean,
      timestamp: number,
      timings: unknown,
      itemId?: string
    ): Promise<void>
  }
  emit(event: ConversationEvent): void
}

export interface TranscriptionEventHandlers {
  handleTranscriptionEvent(type: string, payload: any): boolean
}

/**
 * Creates handlers for transcription events (deltas, completions, failures, audio buffer commits).
 * Manages user turn finalization, backend relays, and STT fallback timers.
 */
export function createTranscriptionEventHandlers(deps: TranscriptionEventDependencies): TranscriptionEventHandlers {
  function handleTranscriptionEvent(type: string, payload: any): boolean {
    // Transcription completion - finalize user turn
    if (
      type.endsWith('input_transcription.completed') ||
      type.endsWith('input_audio_transcription.completed') ||
      type.includes('conversation.item.input_audio_transcription.completed')
    ) {
      const transcript = payload.transcript || payload.text || ''
      const previouslyFinalized = deps.endpointing.getUserFinalized()
      deps.logDebug('[TranscriptionEventHandlers] ✅ TRANSCRIPTION COMPLETED:', {
        transcriptLength: transcript.length,
        preview: transcript.slice(0, 100),
        userFinalized: previouslyFinalized,
      })

      // CRITICAL FIX: Don't finalize with empty transcript!
      // Sometimes completion event fires with empty string before deltas arrive
      if (!transcript || transcript.trim().length === 0) {
        console.warn(
          '[TranscriptionEventHandlers] ⚠️ Ignoring empty transcription completion - waiting for deltas or next event'
        )
        return true
      }

      // Always relay from completion event (single source of truth)
      const itemId = payload.item_id
      if (deps.backendTranscriptMode) {
        if (!itemId) {
          console.error('[TranscriptionEventHandlers] ❌ Missing item_id in completion event - cannot relay!', payload)
        } else if (deps.relay.getLastRelayedItemId() === itemId) {
          deps.logDebug('[TranscriptionEventHandlers] ⏭️ Skipping relay - item_id already relayed:', itemId)
        } else {
          deps.logDebug(
            '[TranscriptionEventHandlers] 📡 Relaying user transcript from completion event:',
            transcript.slice(0, 50),
            'item_id:',
            itemId
          )
          deps.relay.relayTranscriptToBackend('user', transcript, true, Date.now(), undefined, itemId).catch(err => {
            console.error('[TranscriptionEventHandlers] Failed to relay user transcript:', err)
          })
          deps.relay.setLastRelayedItemId(itemId)
        }
      }

      // Update word count for smart patience detection
      if (transcript) {
        const wordCount = transcript.trim().split(/\s+/).length
        deps.endpointing.recordWordCount(wordCount)
      }

      // Finalize transcript engine state (only if not already finalized to avoid duplicate calls)
      const newlyFinalized = deps.endpointing.handleTranscriptionCompleted()
      if (newlyFinalized) {
        deps.logDebug(
          '[TranscriptionEventHandlers] 🎯 Calling transcriptCoordinator.finalizeUser with transcript:',
          transcript.slice(0, 100)
        )
        deps.transcriptCoordinator.finalizeUser({ transcript })
        deps.logDebug('[TranscriptionEventHandlers] ✅ transcriptCoordinator.finalizeUser completed')
      } else {
        deps.logDebug(
          '[TranscriptionEventHandlers] ⚠️ Skipped finalizeUser - already finalized (from force finalization)'
        )
      }
      deps.endpointing.clearCommitTimer()
      return true
    }

    // Handle text input completion (non-voice)
    if (
      type.endsWith('input_text.done') ||
      type.endsWith('input_text.completed') ||
      type.endsWith('input_text.commit')
    ) {
      if (!deps.endpointing.getUserFinalized()) {
        deps.transcriptEngine.finalizeUser(payload)
        deps.transcriptCoordinator.clearUserPartial()
        deps.endpointing.markTurnFinalized()
      }
      deps.endpointing.clearCommitTimer()
      return true
    }

    // Handle audio buffer committed - DON'T finalize yet, wait for transcription
    if (type === 'input_audio_buffer.committed') {
      deps.logDebug('[TranscriptionEventHandlers] Audio buffer committed, waiting for transcription...')
      const fallbackMs = deps.endpointing.handleAudioCommitted(Date.now(), () => {
        if (!deps.endpointing.getUserFinalized()) {
          console.warn('[TranscriptionEventHandlers] ⏱️ STT fallback (no events after commit) - force finalizing user')
          deps.transcriptEngine.finalizeUser({})
          deps.transcriptCoordinator.clearUserPartial()
          deps.endpointing.markTurnFinalized()
        }
      })
      deps.logDebug('[TranscriptionEventHandlers] ⏳ Scheduled STT fallback timeout (ms):', fallbackMs)
      return true
    }

    // Handle transcription failures - finalize with fallback to prevent blocking
    if (type.includes('transcription.failed') || type.includes('input_audio_transcription.failed')) {
      // Check if this is a rate limit error (429)
      const errorMsg = payload?.error?.message || ''
      const is429 = errorMsg.includes('429') || errorMsg.includes('Too Many Requests')

      if (is429) {
        console.error('[TranscriptionEventHandlers] 🚫 RATE LIMIT ERROR (429):', errorMsg)
        console.error(
          '[TranscriptionEventHandlers] 💡 Solution: Upgrade OpenAI account at https://platform.openai.com/settings/organization/billing'
        )
      } else {
        console.error('[TranscriptionEventHandlers] ⚠️ TRANSCRIPTION FAILED EVENT:', { type, payload })
      }

      if (!deps.endpointing.getUserFinalized()) {
        // Finalize with placeholder text if we have no transcript
        const fallbackText = is429 ? '[Rate limit exceeded - upgrade OpenAI account]' : '[Speech not transcribed]'
        deps.transcriptEngine.finalizeUser({ transcript: fallbackText })
        deps.transcriptCoordinator.clearUserPartial()
      }
      deps.endpointing.handleTranscriptionFailed()
      return true
    }

    // Log successful transcription events
    if (type.includes('input_audio_transcription.completed')) {
      deps.logDebug('[TranscriptionEventHandlers] ✅ TRANSCRIPTION COMPLETED:', payload)
    }
    if (type.includes('input_audio_transcription.delta')) {
      deps.logDebug('[TranscriptionEventHandlers] 📝 TRANSCRIPTION DELTA:', payload)
    }

    // Transcription deltas - accumulate partial transcripts
    if (
      (type.includes('input') && type.includes('transcription.delta')) ||
      type.endsWith('input_transcription.delta') ||
      type.endsWith('input_audio_transcription.delta') ||
      type.includes('conversation.item.input_audio_transcription.delta') ||
      type.endsWith('input_text.delta')
    ) {
      const { restarted } = deps.endpointing.handleTranscriptionDelta(Date.now(), () => {
        if (!deps.endpointing.getUserFinalized()) {
          console.warn(
            '[TranscriptionEventHandlers] ⏱️ STT extended timeout reached - force finalizing user from buffered deltas'
          )
          const bufferedText = deps.transcriptEngine.getUserBuffer()
          deps.transcriptEngine.finalizeUser({ transcript: bufferedText })
          deps.transcriptCoordinator.clearUserPartial()
          deps.endpointing.markTurnFinalized()

          if (deps.backendTranscriptMode && bufferedText && bufferedText.trim()) {
            deps.logDebug(
              '[TranscriptionEventHandlers] 📡 Relaying buffered user transcript from timeout:',
              bufferedText.slice(0, 50)
            )
            deps.relay.relayTranscriptToBackend('user', bufferedText, true, Date.now(), undefined).catch(err => {
              console.error('[TranscriptionEventHandlers] Failed to relay buffered user transcript:', err)
            })
          }
        }
      })

      if (restarted) {
        deps.transcriptEngine.startUserTranscript()
        const deltaRestartedAt = Date.now()
        deps.emit({
          type: 'transcript',
          role: 'user' as TranscriptRole,
          text: '',
          isFinal: false,
          timestamp: deltaRestartedAt,
          timings: {
            startedAtMs: deltaRestartedAt,
            emittedAtMs: deltaRestartedAt,
          },
        })
      }

      deps.transcriptEngine.pushUserDelta(payload)
      return true
    }

    return false
  }

  return { handleTranscriptionEvent }
}
