export type AssistantEventType = 'delta' | 'finalize'

export interface AssistantBufferedEvent {
  readonly type: AssistantEventType
  readonly payload: any
  readonly isAudioTranscript: boolean
  readonly timestamp: number
  readonly sequence: number
}

export class AssistantEventBuffer {
  private events: AssistantBufferedEvent[] = []
  private sequence = 0

  buffer(type: AssistantEventType, payload: any, isAudioTranscript: boolean): { sequence: number; size: number } {
    const event: AssistantBufferedEvent = {
      type,
      payload,
      isAudioTranscript,
      timestamp: Date.now(),
      sequence: ++this.sequence,
    }
    this.events.push(event)
    return { sequence: event.sequence, size: this.events.length }
  }

  drain(): { events: AssistantBufferedEvent[]; originalOrder: number[] } {
    if (!this.events.length) {
      return { events: [], originalOrder: [] }
    }

    const events = [...this.events]
    const originalOrder = events.map(event => event.sequence)
    this.events = []

    events.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp
      }
      return a.sequence - b.sequence
    })

    return { events, originalOrder }
  }

  clear(resetSequence = false): void {
    this.events = []
    if (resetSequence) {
      this.sequence = 0
    }
  }

  get size(): number {
    return this.events.length
  }

  get hasEvents(): boolean {
    return this.events.length > 0
  }
}
