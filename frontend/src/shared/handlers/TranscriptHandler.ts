import type { TranscriptRole, TranscriptTimings } from '../../features/voice/conversation/types/transcript'
import type { ConversationEventEmitter } from '../services/ConversationEventEmitter'
import type { TranscriptCoordinator } from '../services/TranscriptCoordinator'
import type { MediaReference } from '../types'

/**
 * Dependencies required by TranscriptHandler
 */
export interface TranscriptHandlerDependencies {
  /** Coordinates transcript state and media parsing */
  transcriptCoordinator: TranscriptCoordinator

  /** Emits transcript events to UI listeners */
  eventEmitter: ConversationEventEmitter

  /** Debug logging function */
  logDebug: (...args: unknown[]) => void

  /** Backend relay function for unified transcript broadcast */
  relayTranscriptToBackend: (
    role: 'user' | 'assistant',
    text: string,
    isFinal: boolean,
    timestamp: number,
    timings?: TranscriptTimings,
    itemId?: string,
    options?: { media?: MediaReference | null; source?: string }
  ) => Promise<void>

  /** Whether backend transcript mode is enabled */
  isBackendMode: () => boolean

  /** Optional hook to detect active socket connectivity */
  isSocketConnected?: () => boolean

  /** Optional registry hook to record locally emitted (fallback) transcripts for dedupe */
  registerLocalEmission?: (entry: {
    role: 'user' | 'assistant'
    text: string
    isFinal: boolean
    timestamp: number
    startedAtMs?: number | null
    itemId?: string | null
  }) => void
}

/**
 * TranscriptHandler
 *
 * Handles user and assistant transcript processing, including:
 * - Timestamp resolution (user start time vs assistant finalized time)
 * - Backend relay coordination
 * - Event emission to UI listeners
 * - Media marker parsing for assistant responses
 * - Partial/final state management
 *
 * Extracted from ConversationController.ts to improve debuggability and testability.
 *
 * @example
 * ```typescript
 * const handler = new TranscriptHandler({
 *   transcriptCoordinator,
 *   eventEmitter,
 *   logDebug: (...args) => console.log('[Debug]', ...args),
 *   relayTranscriptToBackend: async (role, text, isFinal, ts, timings) => {
 *     await fetch('/api/relay', { method: 'POST', body: JSON.stringify({ role, text, isFinal, ts, timings }) })
 *   },
 *   isBackendMode: () => true
 * })
 *
 * // Handle user transcript
 * handler.handleUserTranscript('Hello doctor', true, {
 *   startedAtMs: Date.now() - 1000,
 *   emittedAtMs: Date.now(),
 *   finalizedAtMs: Date.now()
 * })
 * ```
 */
export class TranscriptHandler {
  constructor(private readonly deps: TranscriptHandlerDependencies) {}

  /**
   * Handle user transcript (student/clinician speaking)
   *
   * Behavior:
   * - Backend mode + final: Clears partial, returns (backend will broadcast)
   * - Backend mode + partial: Emits partial for typing animation
   * - Non-backend mode: Emits all transcripts locally
   *
   * Timestamp logic:
   * - Always use startedAtMs (when user STARTED speaking) for correct chronological ordering
   * - This ensures messages appear in order they were spoken, not finalized
   *
   * @param text - Transcript text
   * @param isFinal - Whether transcript is finalized
   * @param timings - Timestamp metadata (startedAtMs, emittedAtMs, finalizedAtMs)
   */
  handleUserTranscript(text: string, isFinal: boolean, timings: TranscriptTimings): void {
    const { transcriptCoordinator, eventEmitter, logDebug, isBackendMode, isSocketConnected, registerLocalEmission } = this.deps

    // Resolve timestamps - ALWAYS use startedAtMs for user transcripts (when mic detected words)
    const startedAtMs = typeof timings?.startedAtMs === 'number' ? timings.startedAtMs : null
    const emittedAtMs = typeof timings?.emittedAtMs === 'number' ? timings.emittedAtMs : Date.now()
    const finalizedAtMs =
      typeof timings?.finalizedAtMs === 'number' ? timings.finalizedAtMs : isFinal ? emittedAtMs : null
    const eventTimestamp = startedAtMs ?? emittedAtMs
    const socketConnected = typeof isSocketConnected === 'function' ? isSocketConnected() : true
    const backendMode = isBackendMode()

    logDebug('[TranscriptHandler] handleUserTranscript:', {
      isFinal,
      textLength: text.length,
      preview: text.slice(0, 50),
      listenerCount: eventEmitter.getListenerCount(),
      backendMode,
      socketConnected,
      timings: { startedAtMs, emittedAtMs, finalizedAtMs },
      eventTimestamp,
    })

    // Backend mode: relay finals to backend, emit partials locally for typing animation
    if (backendMode) {
      logDebug('[TranscriptHandler] Backend mode - emitting partial, finals come from backend')
      if (isFinal) {
        transcriptCoordinator.clearUserPartial()
        if (!socketConnected) {
          logDebug('[TranscriptHandler] Socket disconnected - emitting user final locally as fallback')
          eventEmitter.emit({
            type: 'transcript',
            role: 'user' as TranscriptRole,
            text,
            isFinal,
            timestamp: eventTimestamp,
            timings,
          })
          // Register local emission for dedupe
          try {
            registerLocalEmission?.({
              role: 'user',
              text,
              isFinal: true,
              timestamp: eventTimestamp,
              startedAtMs,
              itemId: null,
            })
          } catch {}
          eventEmitter.emitDebug({
            t: new Date().toISOString(),
            kind: 'event',
            src: 'app',
            msg: 'transcript.user.final.fallback',
            data: {
              length: text.length,
              preview: text.length > 120 ? `${text.slice(0, 117)}...` : text,
            },
          })
        }
        return // Backend will broadcast final transcript (or fallback did)
      } else {
        transcriptCoordinator.setUserPartial(text)
        eventEmitter.emit({
          type: 'transcript',
          role: 'user' as TranscriptRole,
          text,
          isFinal,
          timestamp: eventTimestamp,
          timings,
        })
        return
      }
    }

    // Non-backend mode: emit all transcripts locally
    if (isFinal) {
      transcriptCoordinator.clearUserPartial()
      logDebug('[TranscriptHandler] EMITTING FINAL USER TRANSCRIPT:', text.slice(0, 100))
      eventEmitter.emit({
        type: 'transcript',
        role: 'user' as TranscriptRole,
        text,
        isFinal,
        timestamp: eventTimestamp,
        timings,
      })
      eventEmitter.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'app',
        msg: 'transcript.user.final',
        data: {
          length: text.length,
          preview: text.length > 120 ? `${text.slice(0, 117)}...` : text,
        },
      })
    } else {
      transcriptCoordinator.setUserPartial(text)
      eventEmitter.emit({ type: 'partial', role: 'user' as TranscriptRole, text })
      eventEmitter.emit({
        type: 'transcript',
        role: 'user' as TranscriptRole,
        text,
        isFinal,
        timestamp: eventTimestamp,
        timings,
      })
      eventEmitter.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'app',
        msg: 'transcript.user.delta',
        data: {
          length: text.length,
          preview: text.length > 120 ? `${text.slice(0, 117)}...` : text,
        },
      })
    }
  }

  /**
   * Handle assistant transcript (AI/patient responding)
   *
   * Behavior:
   * - Backend mode + final: Relays to backend for broadcast
   * - Backend mode + partial: Updates internal state only
   * - Non-backend mode: Parses media markers, emits all transcripts locally
   *
   * Timestamp logic:
   * - Always use startedAtMs (when AI STARTED speaking/audio playback began) for correct chronological ordering
   * - This ensures messages appear in order they started, not when finalized
   *
   * @param text - Transcript text (may contain media markers like [[MEDIA:123]])
   * @param isFinal - Whether transcript is finalized
   * @param timings - Timestamp metadata
   */
  handleAssistantTranscript(text: string, isFinal: boolean, timings: TranscriptTimings): void {
    const {
      transcriptCoordinator,
      eventEmitter,
      relayTranscriptToBackend,
      isBackendMode,
      logDebug,
      isSocketConnected,
      registerLocalEmission,
    } = this.deps

    // Resolve timestamps - ALWAYS use startedAtMs for assistant transcripts (when speakers started)
    const startedAtMs = typeof timings?.startedAtMs === 'number' ? timings.startedAtMs : null
    const emittedAtMs = typeof timings?.emittedAtMs === 'number' ? timings.emittedAtMs : Date.now()
    // finalizedAtMs is computed for completeness in timings object, even though eventTimestamp uses startedAtMs
    const finalizedAtMs =
      typeof timings?.finalizedAtMs === 'number' ? timings.finalizedAtMs : isFinal ? emittedAtMs : null
    const eventTimestamp = startedAtMs ?? emittedAtMs
    const socketConnected = typeof isSocketConnected === 'function' ? isSocketConnected() : true
    const backendMode = isBackendMode()
    const backendFallback = backendMode && !socketConnected

    // Suppress lint warning: finalizedAtMs is used in timings object passed to relay/events
    void finalizedAtMs

    // Backend mode: transcripts are broadcast from backend, skip local emission
    if (backendMode) {
      if (isFinal) {
        transcriptCoordinator.clearAssistantPartial()
        // Relay final assistant transcript to backend for unified broadcast
        // Parse media to include a structured reference while preserving marker in text
        const parsed = transcriptCoordinator.parseMediaMarker(text)
        relayTranscriptToBackend('assistant', text, true, eventTimestamp, timings, undefined, {
          media: parsed.media ?? null,
          source: 'frontend',
        }).catch(err => {
          console.error('[TranscriptHandler] Failed to relay assistant transcript:', err)
        })
        if (socketConnected) {
          return
        }
        logDebug('[TranscriptHandler] Socket disconnected - emitting assistant final locally as fallback')
        // Register local emission for dedupe
        try {
          registerLocalEmission?.({
            role: 'assistant',
            text,
            isFinal: true,
            timestamp: eventTimestamp,
            startedAtMs,
            itemId: null,
          })
        } catch {}
      } else {
        transcriptCoordinator.setAssistantPartial(text)
        if (socketConnected) {
          return
        }
        logDebug('[TranscriptHandler] Socket disconnected - emitting assistant partial locally as fallback')
      }
    }

    // Non-backend mode: parse media markers and emit locally
    const { cleanText, media } = transcriptCoordinator.parseMediaMarker(text)

    if (isFinal) {
      transcriptCoordinator.clearAssistantPartial()
      eventEmitter.emit({
        type: 'transcript',
        role: 'assistant' as TranscriptRole,
        text: cleanText,
        isFinal,
        timestamp: eventTimestamp,
        media: media as MediaReference | undefined,
        timings,
      })
      eventEmitter.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'app',
        msg: backendFallback ? 'transcript.assistant.final.fallback' : 'transcript.assistant.final',
        data: {
          length: cleanText.length,
          preview: cleanText.length > 120 ? `${cleanText.slice(0, 117)}...` : cleanText,
          hasMedia: Boolean(media),
        },
      })
    } else {
      transcriptCoordinator.setAssistantPartial(cleanText)
      eventEmitter.emit({ type: 'partial', role: 'assistant' as TranscriptRole, text: cleanText })
      eventEmitter.emit({
        type: 'transcript',
        role: 'assistant' as TranscriptRole,
        text: cleanText,
        isFinal,
        timestamp: eventTimestamp,
        media: media as MediaReference | undefined,
        timings,
      })
      eventEmitter.emitDebug({
        t: new Date().toISOString(),
        kind: 'event',
        src: 'app',
        msg: backendFallback ? 'transcript.assistant.delta.fallback' : 'transcript.assistant.delta',
        data: {
          length: cleanText.length,
          preview: cleanText.length > 120 ? `${cleanText.slice(0, 117)}...` : cleanText,
          hasMedia: Boolean(media),
        },
      })
    }
  }
}
