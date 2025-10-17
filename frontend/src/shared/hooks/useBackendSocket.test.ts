import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Socket } from 'socket.io-client'

import { useBackendSocket } from './useBackendSocket'

type MockSocketInstance = {
  socket: any
  trigger: (event: string, ...args: any[]) => void
  triggerIo: (event: string, ...args: any[]) => void
  setConnected: (connected: boolean) => void
}

vi.mock('socket.io-client', () => {
  type Handler = (...args: any[]) => void

  const createMockSocket = (): MockSocketInstance => {
    const eventHandlers = new Map<string, Handler[]>()
    const ioHandlers = new Map<string, Handler[]>()

    const socket: any = {
      connected: false,
      emit: vi.fn(),
      on: vi.fn((event: string, handler: Handler) => {
        const handlers = eventHandlers.get(event) ?? []
        handlers.push(handler)
        eventHandlers.set(event, handlers)
      }),
      removeAllListeners: vi.fn(() => {
        eventHandlers.clear()
        ioHandlers.clear()
      }),
      disconnect: vi.fn(() => {
        socket.connected = false
      }),
      io: {
        on: vi.fn((event: string, handler: Handler) => {
          const handlers = ioHandlers.get(event) ?? []
          handlers.push(handler)
          ioHandlers.set(event, handlers)
        }),
      },
    }

    return {
      socket,
      trigger: (event: string, ...args: any[]) => {
        const handlers = eventHandlers.get(event) ?? []
        handlers.forEach(handler => {
          handler(...args)
        })
      },
      triggerIo: (event: string, ...args: any[]) => {
        const handlers = ioHandlers.get(event) ?? []
        handlers.forEach(handler => {
          handler(...args)
        })
      },
      setConnected: (connected: boolean) => {
        socket.connected = connected
      },
    }
  }

  const mockSockets: MockSocketInstance[] = []

  const ioMock = vi.fn(() => {
    const instance = createMockSocket()
    mockSockets.push(instance)
    return instance.socket as unknown as Socket
  })

  return {
    io: ioMock,
    __mockSockets: mockSockets,
  }
})

const socketModule = await import('socket.io-client') as unknown as {
  io: ReturnType<typeof vi.fn>
  __mockSockets: MockSocketInstance[]
}

const getLatestSocket = () => socketModule.__mockSockets[socketModule.__mockSockets.length - 1]

describe('useBackendSocket', () => {
  afterEach(() => {
    socketModule.__mockSockets.length = 0
    vi.clearAllMocks()
  })

  it('connects to the backend and joins the session when provided a sessionId', () => {
    const onConnect = vi.fn()

    const { result } = renderHook(() =>
      useBackendSocket({
        sessionId: 'session-123',
        config: { apiBaseUrl: 'https://example.com' },
        handlers: { onConnect },
      })
    )

  const instance = getLatestSocket()
    expect(instance).toBeDefined()
    expect(socketModule.io).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ path: '/socket.io/' }))

    act(() => {
      instance!.setConnected(true)
      instance!.trigger('connect')
    })

    expect(result.current.isConnected).toBe(true)
    expect(result.current.currentSessionId).toBe('session-123')
    expect(onConnect).toHaveBeenCalledWith('session-123')
    expect(instance!.socket.emit).toHaveBeenCalledWith('join-session', 'session-123')
  })

  it('emits transcript events to handlers and tracks last timestamp', () => {
    const onTranscript = vi.fn()

    const { result } = renderHook(() =>
      useBackendSocket({
        sessionId: 'session-abc',
        config: { apiBaseUrl: 'http://localhost:3002' },
        handlers: { onTranscript },
      })
    )

  const instance = getLatestSocket()
    expect(instance).toBeDefined()

    act(() => {
      instance!.trigger('transcript', {
        role: 'assistant',
        text: 'Hello world',
        isFinal: true,
        timestamp: 1234,
      })
    })

    expect(onTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Hello world', timestamp: 1234 })
    )
    expect(result.current.lastReceivedTimestamp).toBe(1234)
  })

  it('tracks failures and disables the socket after reaching maxFailures', () => {
    const onFailure = vi.fn()
    const onMaxFailures = vi.fn()

    renderHook(() =>
      useBackendSocket({
        sessionId: 'session-failure',
        config: { apiBaseUrl: 'http://localhost:3002', maxFailures: 2 },
        handlers: { onFailure, onMaxFailures },
      })
    )

  const instance = getLatestSocket()
    expect(instance).toBeDefined()

    act(() => {
      instance!.trigger('connect_error', new Error('failed to connect'))
    })

    expect(onFailure).toHaveBeenCalledWith('connect_error', expect.any(Error), 1)

    act(() => {
      instance!.trigger('connect_error', new Error('still failing'))
    })

    expect(onFailure).toHaveBeenCalledWith('connect_error', expect.any(Error), 2)
    expect(onMaxFailures).toHaveBeenCalledWith(2)
  })
})
