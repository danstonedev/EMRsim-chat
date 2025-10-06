import { extractPayloadTexts, mergeDelta, normalizeFullCandidate } from './transcriptText'

export interface TranscriptTimings {
  startedAtMs: number | null
  emittedAtMs: number
  finalizedAtMs?: number | null
}

export class TranscriptEngine {
  private userBuffer = ''
  private assistantBuffer = ''
  private audioTranscriptMode = false
  private lastUserFinal = ''
  private lastAssistantFinal = ''
  private userPendingFinalization = false
  private assistantActive = false
  private userTranscriptionPending = false
  private bufferedAssistantEvents: Array<{
    type: 'delta' | 'finalize'
    payload: any
    isAudioTranscript: boolean
    timestamp: number
    seq: number
  }> = []
  private eventSequence = 0
  private suppressAudioUntilNextResponse = false
  private userTurnStartTimestamp: number | null = null
  private assistantTurnStartTimestamp: number | null = null

  constructor(
    private onUserTranscript: (text: string, isFinal: boolean, timings: TranscriptTimings) => void,
    private onAssistantTranscript: (text: string, isFinal: boolean, timings: TranscriptTimings) => void,
    private readonly bargeInEnabled: boolean
  ) {}

  /** Get current user buffer (for timeout fallback relay) */
  getUserBuffer(): string {
    return this.userBuffer
  }

  startUserTranscript(): void {
    this.userPendingFinalization = false
    this.userBuffer = ''
    this.userTranscriptionPending = true
    this.userTurnStartTimestamp = Date.now() // Capture when user turn starts
    this.bufferedAssistantEvents = [] // Clear any buffered events from previous interaction

    console.log('[TranscriptEngine] 🎤 User turn started, timestamp:', this.userTurnStartTimestamp)
  }

  pushUserDelta(payload: any): void {
  const { fullText, deltaText } = extractPayloadTexts(payload)
  const emittedAt = Date.now()

    if (fullText) {
      // Full text replacement - use it if different
      if (fullText !== this.userBuffer) {
        console.log('[TranscriptEngine] 📝 User delta (full):', { prev: this.userBuffer.slice(0, 30), new: fullText.slice(0, 30), length: fullText.length })
        this.userBuffer = fullText
        this.onUserTranscript(this.userBuffer, false, {
          startedAtMs: this.userTurnStartTimestamp,
          emittedAtMs: emittedAt,
        })
      }
      return
    }

    if (!deltaText) return

    // Delta merge - append or intelligently merge
  const next = mergeDelta(this.userBuffer, deltaText)
    if (next !== this.userBuffer) {
      console.log('[TranscriptEngine] ➕ User delta (merge):', { delta: deltaText.slice(0, 20), bufferLen: this.userBuffer.length, newLen: next.length })
      this.userBuffer = next
      this.onUserTranscript(this.userBuffer, false, {
        startedAtMs: this.userTurnStartTimestamp,
        emittedAtMs: emittedAt,
      })
    }
  }

  finalizeUser(payload: any): void {
    if (this.userPendingFinalization) {
      console.warn('[TranscriptEngine] ⚠️ Prevented duplicate user finalization')
      return // Prevent duplicate finalization
    }

    // Set flag IMMEDIATELY to prevent race condition with rapid events
    this.userPendingFinalization = true

  const { fullText } = extractPayloadTexts(payload)
    const candidate = fullText ?? this.userBuffer
  const finalText = normalizeFullCandidate(candidate)
    const finalizedAt = Date.now()
    const startedAt = this.userTurnStartTimestamp

    if (finalText && finalText !== this.lastUserFinal) {
      console.log('[TranscriptEngine] ✅ User finalized:', { length: finalText.length, preview: finalText.slice(0, 50), timestamp: finalizedAt })
      this.onUserTranscript(finalText, true, {
        startedAtMs: startedAt,
        emittedAtMs: finalizedAt,
        finalizedAtMs: finalizedAt,
      })
      this.lastUserFinal = finalText
    } else if (finalText === this.lastUserFinal) {
      console.log('[TranscriptEngine] ⏭️ Skipped duplicate user final (matches last):', finalText.slice(0, 50))
    } else if (!finalText) {
      console.warn('[TranscriptEngine] ⚠️ User finalized with empty text - check transcription')
    }

    this.userBuffer = ''
    this.userTranscriptionPending = false
    this.userTurnStartTimestamp = null // Clear after finalization

    // CRITICAL: Flush any buffered assistant events now that user transcript is complete
    // This ensures proper chronological ordering: user speaks first, then AI responds
    console.log('[TranscriptEngine] 🔄 Flushing buffered events after user finalization')
    this.flushBufferedAssistantEvents()
  }

  private flushBufferedAssistantEvents(): void {
    const events = [...this.bufferedAssistantEvents]
    this.bufferedAssistantEvents = []

    if (events.length === 0) return

    console.log('[TranscriptEngine] Flushing buffered assistant events:', { count: events.length })

    // Sort by timestamp first, then sequence number to maintain proper order
    const originalOrder = events.map(e => e.seq)
    events.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp
      }
      return a.seq - b.seq
    })
    const sortedOrder = events.map(e => e.seq)

    // Log if ordering changed during sort (indicates potential reordering issue)
    if (JSON.stringify(originalOrder) !== JSON.stringify(sortedOrder)) {
      console.warn('[TranscriptEngine] Event order changed during flush:', {
        original: originalOrder,
        sorted: sortedOrder,
        timespanMs: events.length > 1 ? events[events.length - 1].timestamp - events[0].timestamp : 0
      })
    }

    for (const event of events) {
      if (event.type === 'delta') {
        this.pushAssistantDelta(event.payload, event.isAudioTranscript)
      } else if (event.type === 'finalize') {
        this.finalizeAssistant(event.payload, event.isAudioTranscript)
      }
    }

    console.log('[TranscriptEngine] Flush complete')
  }

  startAssistantResponse(): void {
    this.assistantActive = true
    this.assistantBuffer = ''
    this.audioTranscriptMode = false
    this.suppressAudioUntilNextResponse = false
    this.assistantTurnStartTimestamp = Date.now() // Capture when assistant turn starts

    console.log('[TranscriptEngine] 🤖 Assistant turn started, timestamp:', this.assistantTurnStartTimestamp, 'userPending:', this.userTranscriptionPending)
  }

  pushAssistantDelta(payload: any, isAudioTranscript = false): void {
    // Buffer assistant events if user transcription is still pending
    if (this.userTranscriptionPending && !this.bargeInEnabled) {
      const seq = ++this.eventSequence
      this.bufferedAssistantEvents.push({
        type: 'delta',
        payload,
        isAudioTranscript,
        timestamp: Date.now(),
        seq
      })
      console.log('[TranscriptEngine] Buffered assistant delta (waiting for user finalization):', { seq, bufferSize: this.bufferedAssistantEvents.length, isAudio: isAudioTranscript })
      return
    }

  const { fullText, deltaText } = extractPayloadTexts(payload)
  const emittedAt = Date.now()

    if (!isAudioTranscript && (fullText || deltaText)) {
      if (this.audioTranscriptMode) {
        this.audioTranscriptMode = false
        this.suppressAudioUntilNextResponse = true
      }
  const nextText = fullText ?? mergeDelta(this.assistantBuffer, deltaText ?? '')
      if (nextText && nextText !== this.assistantBuffer) {
        this.assistantBuffer = nextText
        this.onAssistantTranscript(this.assistantBuffer, false, {
          startedAtMs: this.assistantTurnStartTimestamp,
          emittedAtMs: emittedAt,
        })
      }
      return
    }

    if (isAudioTranscript && this.suppressAudioUntilNextResponse) {
      return
    }

    if (isAudioTranscript) {
      this.audioTranscriptMode = true
    }
    if (this.audioTranscriptMode && !isAudioTranscript) {
      return
    }
    if (fullText) {
      if (fullText !== this.assistantBuffer) {
        this.assistantBuffer = fullText
        this.onAssistantTranscript(this.assistantBuffer, false, {
          startedAtMs: this.assistantTurnStartTimestamp,
          emittedAtMs: emittedAt,
        })
      }
      return
    }
    if (!deltaText) return
  const next = mergeDelta(this.assistantBuffer, deltaText)
    if (next !== this.assistantBuffer) {
      this.assistantBuffer = next
      this.onAssistantTranscript(this.assistantBuffer, false, {
        startedAtMs: this.assistantTurnStartTimestamp,
        emittedAtMs: emittedAt,
      })
    }
  }

  finalizeAssistant(payload: any, isAudioTranscript = false): void {
    // Buffer assistant finalization if user transcription is still pending
    if (this.userTranscriptionPending && !this.bargeInEnabled) {
      const seq = ++this.eventSequence
      this.bufferedAssistantEvents.push({
        type: 'finalize',
        payload,
        isAudioTranscript,
        timestamp: Date.now(),
        seq
      })
      console.log('[TranscriptEngine] Buffered assistant finalize (waiting for user finalization):', { seq, bufferSize: this.bufferedAssistantEvents.length, isAudio: isAudioTranscript })
      return
    }

    if (isAudioTranscript && this.suppressAudioUntilNextResponse) {
      // The response already finalized via text content; avoid emitting a second, lower-quality final.
      return
    }
  const { fullText } = extractPayloadTexts(payload)
    const candidate = fullText ?? this.assistantBuffer
  const finalText = normalizeFullCandidate(candidate)
    const finalizedAt = Date.now()
    const startedAt = this.assistantTurnStartTimestamp
    const hasActiveTranscript = this.assistantActive || this.assistantBuffer.length > 0
    if (finalText && (finalText !== this.lastAssistantFinal || hasActiveTranscript)) {
      this.onAssistantTranscript(finalText, true, {
        startedAtMs: startedAt,
        emittedAtMs: finalizedAt,
        finalizedAtMs: finalizedAt,
      })
      this.lastAssistantFinal = finalText
    }
    this.assistantBuffer = ''
    this.assistantActive = false
    this.assistantTurnStartTimestamp = null // Clear after finalization
    if (!isAudioTranscript) {
      this.suppressAudioUntilNextResponse = true
    }
    // Reset audio transcript mode after any finalization to allow fresh start for next response
    this.audioTranscriptMode = false
  }

  reset(): void {
    this.userBuffer = ''
    this.assistantBuffer = ''
    this.audioTranscriptMode = false
    this.lastUserFinal = ''
    this.lastAssistantFinal = ''
    this.userPendingFinalization = false
    this.assistantActive = false
    this.userTranscriptionPending = false
    this.bufferedAssistantEvents = []
    this.eventSequence = 0
    this.suppressAudioUntilNextResponse = false
    this.userTurnStartTimestamp = null
    this.assistantTurnStartTimestamp = null
  }
}
