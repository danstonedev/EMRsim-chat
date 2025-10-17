import { describe, it, expect, vi, beforeEach } from 'vitest'
import { relayTranscript } from '../src/controllers/transcriptRelayController.ts'

vi.mock('../src/services/transcript_broadcast.ts', () => ({
  broadcastUserTranscript: vi.fn(),
  broadcastAssistantTranscript: vi.fn(),
}))

const mockedBroadcast = await import('../src/services/transcript_broadcast.ts')

function createMockRes() {
  const res: any = {}
  res.status = vi.fn().mockImplementation(() => res)
  res.json = vi.fn().mockImplementation(() => res)
  res.sendStatus = vi.fn().mockImplementation(() => res)
  return res
}

describe('relayTranscript controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects missing session id', () => {
    const req: any = { params: {}, body: {} }
    const res = createMockRes()

    relayTranscript(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'missing_session_id' })
    expect(mockedBroadcast.broadcastUserTranscript).not.toHaveBeenCalled()
    expect(mockedBroadcast.broadcastAssistantTranscript).not.toHaveBeenCalled()
  })

  it('broadcasts user transcript payload', () => {
    const req: any = {
      params: { sessionId: 'abc123' },
      body: {
        role: 'user',
        text: 'Hello world',
        isFinal: false,
        timestamp: 123,
        itemId: 'item-1',
      },
    }
    const res = createMockRes()

    relayTranscript(req, res)

    expect(mockedBroadcast.broadcastUserTranscript).toHaveBeenCalledWith(
      'abc123',
      expect.objectContaining({
        text: 'Hello world',
        isFinal: false,
        timestamp: 123,
        finalizedAtMs: 123,
        emittedAtMs: 123,
        startedAtMs: undefined,
        itemId: 'item-1',
      })
    )
    expect(res.sendStatus).toHaveBeenCalledWith(204)
  })

  it('broadcasts assistant transcript payload and defaults timestamp', () => {
    const req: any = {
      params: { sessionId: 'abc123' },
      body: {
        role: 'assistant',
        text: 'Response',
        isFinal: true,
      },
    }
    const res = createMockRes()

    const before = Date.now()
    relayTranscript(req, res)
    const after = Date.now()

    expect(mockedBroadcast.broadcastAssistantTranscript).toHaveBeenCalled()
    const payload = (mockedBroadcast.broadcastAssistantTranscript as any).mock.calls[0][1]
    expect(payload.text).toBe('Response')
    expect(payload.isFinal).toBe(true)
    expect(payload.itemId).toBeUndefined()
    expect(payload.finalizedAtMs).toBe(payload.timestamp)
    expect(payload.emittedAtMs).toBeGreaterThanOrEqual(before)
    expect(payload.emittedAtMs).toBeLessThanOrEqual(after)
    if (payload.startedAtMs != null) {
      expect(payload.startedAtMs).toBeLessThanOrEqual(payload.finalizedAtMs)
    }
    expect(res.sendStatus).toHaveBeenCalledWith(204)
  })
})
