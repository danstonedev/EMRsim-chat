import { describe, expect, it, vi } from 'vitest'

import { TranscriptEngine } from '../TranscriptEngine'
import type { TranscriptLogger } from '../types'

interface TranscriptEvent {
  text: string
  isFinal: boolean
}

const createSilentLogger = (): TranscriptLogger => ({
  log: vi.fn(),
  warn: vi.fn(),
})

const captureEvents = () => {
  const events: TranscriptEvent[] = []
  const handler = (text: string, isFinal: boolean) => {
    events.push({ text, isFinal })
  }
  return { events, handler }
}

describe('TranscriptEngine', () => {
  it('buffers assistant events until user finalization', () => {
    const { events: userEvents, handler: onUser } = captureEvents()
    const { events: assistantEvents, handler: onAssistant } = captureEvents()
    const logger = createSilentLogger()

    const engine = new TranscriptEngine(onUser, onAssistant, false, { logger })

    engine.startUserTranscript()
    engine.startAssistantResponse()

    engine.pushAssistantDelta({ delta_text: 'hello' })
    expect(assistantEvents).toHaveLength(0)

    engine.pushUserDelta({ delta_text: 'hi' })
    expect(userEvents).toHaveLength(1)
    expect(userEvents[0]).toMatchObject({ text: 'hi', isFinal: false })

    engine.finalizeUser({ fullText: 'hi there' })
    expect(userEvents[userEvents.length - 1]).toMatchObject({ text: 'hi there', isFinal: true })

    expect(assistantEvents).toHaveLength(1)
    expect(assistantEvents[0]).toMatchObject({ text: 'hello', isFinal: false })

    engine.finalizeAssistant({ fullText: 'hello!' })
    expect(assistantEvents[assistantEvents.length - 1]).toMatchObject({ text: 'hello!', isFinal: true })
  })

  it('prevents duplicate user finalization', () => {
    const { events: userEvents, handler: onUser } = captureEvents()
    const { handler: onAssistant } = captureEvents()
    const logger = createSilentLogger()

    const engine = new TranscriptEngine(onUser, onAssistant, false, { logger })

    engine.startUserTranscript()
    engine.pushUserDelta({ delta_text: 'alpha' })
    engine.finalizeUser({ fullText: 'alpha' })

    expect(userEvents.filter(event => event.isFinal)).toHaveLength(1)

    engine.finalizeUser({ fullText: 'alpha' })
    expect(userEvents.filter(event => event.isFinal)).toHaveLength(1)
    expect(logger.warn).toHaveBeenCalledWith('[TranscriptEngine] ⚠️ Prevented duplicate user finalization')
  })

  it('suppresses audio finalization after textual final', () => {
    const { events: userEvents, handler: onUser } = captureEvents()
    const { events: assistantEvents, handler: onAssistant } = captureEvents()
    const logger = createSilentLogger()

    const engine = new TranscriptEngine(onUser, onAssistant, false, { logger })

    engine.startUserTranscript()
    engine.pushUserDelta({ delta_text: 'question' })
    engine.finalizeUser({ fullText: 'question' })

    engine.startAssistantResponse()
    engine.pushAssistantDelta({ fullText: 'answer preview' })

    engine.finalizeAssistant({ fullText: 'answer final' }, false)
    const emittedCount = assistantEvents.length
    expect(assistantEvents[assistantEvents.length - 1]).toMatchObject({ text: 'answer final', isFinal: true })

    engine.finalizeAssistant({ fullText: 'answer final (audio)' }, true)
    expect(assistantEvents.length).toBe(emittedCount)
    expect(logger.warn).not.toHaveBeenCalledWith('[TranscriptEngine] ⚠️ Prevented duplicate user finalization')
    expect(userEvents.filter(event => event.isFinal)).toHaveLength(1)
  })
})
