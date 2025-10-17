import { extractPayloadTexts, mergeDelta, normalizeFullCandidate } from '../transcriptText'
import type { TranscriptEmitter, TranscriptLogger } from '../types'

export class UserTranscriptChannel {
  private buffer = ''
  private lastFinal = ''
  private pendingFinalization = false
  private transcriptionPending = false
  private turnStartedAt: number | null = null

  constructor(
    private readonly emitTranscript: TranscriptEmitter,
    private readonly logger: TranscriptLogger
  ) {}

  getBuffer(): string {
    return this.buffer
  }

  isTranscriptionPending(): boolean {
    return this.transcriptionPending
  }

  startTurn(): void {
    // Don't reset turnStartedAt if already set (preserve first timestamp for ordering)
    if (!this.turnStartedAt) {
      this.turnStartedAt = Date.now()
      this.logger.log('[TranscriptEngine] 🎤 User turn started, timestamp:', this.turnStartedAt)
    }
    this.pendingFinalization = false
    this.transcriptionPending = true
    this.buffer = ''
  }

  handleDelta(payload: any): void {
    const { fullText, deltaText } = extractPayloadTexts(payload)
    const emittedAt = Date.now()

    if (fullText) {
      if (fullText !== this.buffer) {
        this.logger.log('[TranscriptEngine] 📝 User delta (full):', {
          prev: this.buffer.slice(0, 30),
          new: fullText.slice(0, 30),
          length: fullText.length,
        })
        this.buffer = fullText
        this.emitTranscript(this.buffer, false, {
          startedAtMs: this.turnStartedAt,
          emittedAtMs: emittedAt,
        })
      }
      return
    }

    if (!deltaText) return

    const next = mergeDelta(this.buffer, deltaText)
    if (next !== this.buffer) {
      this.logger.log('[TranscriptEngine] ➕ User delta (merge):', {
        delta: deltaText.slice(0, 20),
        bufferLen: this.buffer.length,
        newLen: next.length,
      })
      this.buffer = next
      this.emitTranscript(this.buffer, false, {
        startedAtMs: this.turnStartedAt,
        emittedAtMs: emittedAt,
      })
    }
  }

  finalize(payload: any): boolean {
    if (this.pendingFinalization) {
      this.logger.warn('[TranscriptEngine] ⚠️ Prevented duplicate user finalization')
      return false
    }

    this.pendingFinalization = true

    const { fullText } = extractPayloadTexts(payload)
    const candidate = fullText ?? this.buffer
    const finalText = normalizeFullCandidate(candidate)
    const finalizedAt = Date.now()

    if (finalText && finalText !== this.lastFinal) {
      this.logger.log('[TranscriptEngine] ✅ User finalized:', {
        length: finalText.length,
        preview: finalText.slice(0, 50),
        timestamp: finalizedAt,
      })
      this.emitTranscript(finalText, true, {
        startedAtMs: this.turnStartedAt,
        emittedAtMs: finalizedAt,
        finalizedAtMs: finalizedAt,
      })
      this.lastFinal = finalText
    } else if (finalText === this.lastFinal) {
      this.logger.log('[TranscriptEngine] ⏭️ Skipped duplicate user final (matches last):', finalText.slice(0, 50))
    } else if (!finalText) {
      this.logger.warn('[TranscriptEngine] ⚠️ User finalized with empty text - check transcription')
    }

    this.buffer = ''
    this.transcriptionPending = false
    this.turnStartedAt = null

    return true
  }

  reset(): void {
    this.buffer = ''
    this.lastFinal = ''
    this.pendingFinalization = false
    this.transcriptionPending = false
    this.turnStartedAt = null
  }
}
