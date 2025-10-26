import { describe, it, expect, beforeEach } from 'vitest'
import type { Server as SocketIOServer } from 'socket.io'
import {
  initTranscriptBroadcast,
  broadcastUserTranscript,
  broadcastAssistantTranscript,
  getTranscriptHistory,
  __resetTranscriptDedupeForTests,
  __setTranscriptDedupeOptionsForTests,
} from '../transcript_broadcast.js'

class FakeRoom {
  events: Array<{ event: string; data: any }> = []
  emit(event: string, data: any) {
    this.events.push({ event, data })
  }
}

class FakeIO implements Partial<SocketIOServer> {
  public rooms: Record<string, FakeRoom> = {}
  to(room: string) {
    if (!this.rooms[room]) this.rooms[room] = new FakeRoom()
    return this.rooms[room] as any
  }
}

describe('transcript_broadcast dedupe', () => {
  const sessionId = 'sess_test_123'
  let io: FakeIO

  beforeEach(() => {
    io = new FakeIO()
    initTranscriptBroadcast(io as unknown as SocketIOServer)
    __resetTranscriptDedupeForTests()
    __setTranscriptDedupeOptionsForTests({ mode: 'memory', ttlSeconds: 30 })
  })

  it('drops duplicate user finals by itemId', () => {
    const payload = {
      text: 'Hello World',
      isFinal: true,
      timestamp: Date.now(),
      itemId: 'item_1',
    }

    const r1 = broadcastUserTranscript(sessionId, payload)
    const r2 = broadcastUserTranscript(sessionId, payload)

    expect(r1).toBe(true)
    expect(r2).toBe(false)

    const room = io.rooms[`session:${sessionId}`]
    expect(room.events.filter(e => e.event === 'transcript').length).toBe(1)

    const history = getTranscriptHistory(sessionId)
    expect(history.length).toBe(1)
    expect(history[0].text).toBe('Hello World')
  })

  it('drops duplicate assistant finals by signature when no itemId', () => {
    const t = Date.now()
    const payload = {
      text: 'Same reply text',
      isFinal: true,
      timestamp: t + 50,
      startedAtMs: t,
    }

    const r1 = broadcastAssistantTranscript(sessionId, payload)
    const r2 = broadcastAssistantTranscript(sessionId, payload)

    expect(r1).toBe(true)
    expect(r2).toBe(false)

    const room = io.rooms[`session:${sessionId}`]
    expect(room.events.filter(e => e.event === 'transcript').length).toBe(1)

    const history = getTranscriptHistory(sessionId)
    expect(history.length).toBe(1)
    expect(history[0].role).toBe('assistant')
  })

  it('allows re-broadcast after TTL expiry', async () => {
    __setTranscriptDedupeOptionsForTests({ ttlSeconds: 1 })
    const payload = {
      text: 'Short TTL test',
      isFinal: true,
      timestamp: Date.now(),
      itemId: 'item_ttl',
    }

    const r1 = broadcastAssistantTranscript(sessionId, payload)
    expect(r1).toBe(true)

    // Wait > 1s
    await new Promise(res => setTimeout(res, 1100))

    const r2 = broadcastAssistantTranscript(sessionId, payload)
    expect(r2).toBe(true)

    const room = io.rooms[`session:${sessionId}`]
    expect(room.events.filter(e => e.event === 'transcript').length).toBe(2)

    const history = getTranscriptHistory(sessionId)
    expect(history.length).toBe(2)
  })
})
