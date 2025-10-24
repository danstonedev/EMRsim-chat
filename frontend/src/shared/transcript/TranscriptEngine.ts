import { AssistantTranscriptChannel } from './internal/AssistantTranscriptChannel'
import { AssistantEventBuffer, AssistantEventType } from './internal/AssistantEventBuffer'
import { UserTranscriptChannel } from './internal/UserTranscriptChannel'
import type { TranscriptEmitter, TranscriptLogger } from './types'

export interface TranscriptEngineOptions {
  logger?: TranscriptLogger
}

const isTestEnv = typeof process !== 'undefined' && !!process.env.VITEST

const defaultLogger: TranscriptLogger = {
  log: (...args: any[]) => {
    if (!isTestEnv && import.meta.env.DEV) {
      console.debug(...args)
    }
  },
  warn: (...args: any[]) => console.warn(...args),
}

export class TranscriptEngine {
  private readonly logger: TranscriptLogger
  private readonly userChannel: UserTranscriptChannel
  private readonly assistantChannel: AssistantTranscriptChannel
  private readonly assistantBuffer = new AssistantEventBuffer()

  constructor(
    onUserTranscript: TranscriptEmitter,
    onAssistantTranscript: TranscriptEmitter,
    private readonly bargeInEnabled: boolean,
    options: TranscriptEngineOptions = {}
  ) {
    this.logger = options.logger ?? defaultLogger
    this.userChannel = new UserTranscriptChannel(onUserTranscript, this.logger)
    this.assistantChannel = new AssistantTranscriptChannel(onAssistantTranscript, this.logger)
  }

  /** Get current user buffer (for timeout fallback relay) */
  getUserBuffer(): string {
    return this.userChannel.getBuffer()
  }

  startUserTranscript(): void {
    this.userChannel.startTurn()
    this.assistantBuffer.clear()
  }

  pushUserDelta(payload: any): void {
    this.userChannel.handleDelta(payload)
  }

  finalizeUser(payload: any): void {
    const processed = this.userChannel.finalize(payload)
    if (!processed) return

    this.logger.log('[TranscriptEngine] Flushing buffered events after user finalization')
    this.flushBufferedAssistantEvents()
  }

  startAssistantResponse(): void {
    this.assistantChannel.startTurn()
  }

  pushAssistantDelta(payload: any, isAudioTranscript = false): void {
    this.processAssistantEvent('delta', payload, isAudioTranscript, true)
  }

  finalizeAssistant(payload: any, isAudioTranscript = false): void {
    this.processAssistantEvent('finalize', payload, isAudioTranscript, true)
  }

  reset(): void {
    this.userChannel.reset()
    this.assistantChannel.reset()
    this.assistantBuffer.clear(true)
  }

  private shouldBufferAssistantEvent(): boolean {
    return this.userChannel.isTranscriptionPending() && !this.bargeInEnabled
  }

  private processAssistantEvent(
    type: AssistantEventType,
    payload: any,
    isAudioTranscript: boolean,
    allowBuffering: boolean
  ): void {
    if (allowBuffering && this.shouldBufferAssistantEvent()) {
      const { sequence, size } = this.assistantBuffer.buffer(type, payload, isAudioTranscript)
      const label = type === 'delta' ? 'delta' : 'finalize'
      this.logger.log(`[TranscriptEngine] Buffered assistant ${label} (waiting for user finalization):`, {
        seq: sequence,
        bufferSize: size,
        isAudio: isAudioTranscript,
      })
      return
    }

    if (type === 'delta') {
      this.assistantChannel.handleDelta(payload, isAudioTranscript)
    } else {
      this.assistantChannel.finalize(payload, isAudioTranscript)
    }
  }

  private flushBufferedAssistantEvents(): void {
    const { events, originalOrder } = this.assistantBuffer.drain()
    if (!events.length) return

    this.logger.log('[TranscriptEngine] Flushing buffered assistant events:', { count: events.length })

    const sortedOrder = events.map(event => event.sequence)
    if (JSON.stringify(originalOrder) !== JSON.stringify(sortedOrder)) {
      const firstTimestamp = events[0]?.timestamp ?? 0
      const lastTimestamp = events[events.length - 1]?.timestamp ?? firstTimestamp
      this.logger.warn('[TranscriptEngine] Event order changed during flush:', {
        original: originalOrder,
        sorted: sortedOrder,
        timespanMs: events.length > 1 ? lastTimestamp - firstTimestamp : 0,
      })
    }

    for (const event of events) {
      this.processAssistantEvent(event.type, event.payload, event.isAudioTranscript, false)
    }

    this.logger.log('[TranscriptEngine] Flush complete')
  }
}

export type { TranscriptTimings } from './types'
