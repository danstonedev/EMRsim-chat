import { extractPayloadTexts, mergeDelta, normalizeFullCandidate } from '../transcriptText'
import type { TranscriptEmitter, TranscriptLogger } from '../types'

export class AssistantTranscriptChannel {
  private buffer = ''
  private lastFinal = ''
  private active = false
  private audioTranscriptMode = false
  private suppressAudioUntilNextResponse = false
  private turnStartedAt: number | null = null

  constructor(
    private readonly emitTranscript: TranscriptEmitter,
    private readonly logger: TranscriptLogger
  ) {}

  startTurn(): void {
    // Don't reset turnStartedAt if already set (preserve first timestamp for ordering)
    if (!this.turnStartedAt) {
      this.turnStartedAt = Date.now()
      this.logger.log('[TranscriptEngine] Assistant turn started, timestamp:', this.turnStartedAt)
    }
    this.active = true
    this.buffer = ''
    this.audioTranscriptMode = false
    this.suppressAudioUntilNextResponse = false
  }

  handleDelta(payload: any, isAudioTranscript = false): void {
    const { fullText, deltaText } = extractPayloadTexts(payload)
    const emittedAt = Date.now()

    if (!isAudioTranscript && (fullText || deltaText)) {
      if (this.audioTranscriptMode) {
        this.audioTranscriptMode = false
        this.suppressAudioUntilNextResponse = true
      }
      const nextText = fullText ?? mergeDelta(this.buffer, deltaText ?? '')
      if (nextText && nextText !== this.buffer) {
        this.buffer = nextText
        this.emitTranscript(this.buffer, false, {
          startedAtMs: this.turnStartedAt,
          emittedAtMs: emittedAt,
        })
      }
      return
    }

    if (isAudioTranscript) {
      if (this.suppressAudioUntilNextResponse) {
        return
      }
      this.audioTranscriptMode = true
    } else if (this.audioTranscriptMode) {
      return
    }

    if (fullText) {
      if (fullText !== this.buffer) {
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
      this.buffer = next
      this.emitTranscript(this.buffer, false, {
        startedAtMs: this.turnStartedAt,
        emittedAtMs: emittedAt,
      })
    }
  }

  finalize(payload: any, isAudioTranscript = false): void {
    if (isAudioTranscript && this.suppressAudioUntilNextResponse) {
      return
    }

    const { fullText } = extractPayloadTexts(payload)
    const candidate = fullText ?? this.buffer
    const finalText = normalizeFullCandidate(candidate)
    const finalizedAt = Date.now()
    const hasActiveTranscript = this.active || this.buffer.length > 0

    if (finalText && (finalText !== this.lastFinal || hasActiveTranscript)) {
      this.emitTranscript(finalText, true, {
        startedAtMs: this.turnStartedAt,
        emittedAtMs: finalizedAt,
        finalizedAtMs: finalizedAt,
      })
      this.lastFinal = finalText
    }

    this.buffer = ''
    this.active = false
    this.turnStartedAt = null
    if (!isAudioTranscript) {
      this.suppressAudioUntilNextResponse = true
    }
    this.audioTranscriptMode = false
  }

  reset(): void {
    this.buffer = ''
    this.lastFinal = ''
    this.active = false
    this.audioTranscriptMode = false
    this.suppressAudioUntilNextResponse = false
    this.turnStartedAt = null
  }
}
