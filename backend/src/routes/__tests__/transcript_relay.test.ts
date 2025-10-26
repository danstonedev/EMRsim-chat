import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Server as SocketIOServer } from 'socket.io'
import { relayTranscript } from '../transcript_relay.js'
import { initTranscriptBroadcast, __resetTranscriptDedupeForTests } from '../../services/transcript_broadcast.js'

// Mock DB insertTurn
vi.mock('../../db.ts', () => {
  return {
    insertTurn: vi.fn(),
    getSessionTurns: vi.fn(() => []),
  }
})

import { insertTurn } from '../../db.js'

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

function mockReqRes(params: any, body: any) {
  const json = vi.fn()
  const status = vi.fn(() => ({ json })) as any
  const send = vi.fn()
  const res = { status, json, send } as any
  const req = { params, body } as any
  return { req, res, status, json, send }
}

describe('relayTranscript dedupe + persistence', () => {
  const sessionId = 'sess_route_1'

  beforeEach(() => {
    __resetTranscriptDedupeForTests()
    ;(insertTurn as any).mockClear()
    const io = new FakeIO()
    initTranscriptBroadcast(io as unknown as SocketIOServer)
  })

  it('persists only the first final and drops duplicate DB inserts', () => {
    const base = {
      role: 'user',
      text: 'Hello from route',
      isFinal: true,
      timestamp: Date.now(),
      itemId: 'route_item_1',
    }

    const { req: req1, res: res1 } = mockReqRes({ sessionId }, base)
    relayTranscript(req1, res1)

    const { req: req2, res: res2 } = mockReqRes({ sessionId }, base)
    relayTranscript(req2, res2)

    expect((insertTurn as any).mock.calls.length).toBe(1)
  })
})
