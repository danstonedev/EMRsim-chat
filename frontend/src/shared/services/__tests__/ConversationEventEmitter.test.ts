import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversationEventEmitter } from '../ConversationEventEmitter'
import type { ConversationEvent, VoiceDebugEvent } from '../../types'

const createStatusEvent = (
  overrides: Partial<Extract<ConversationEvent, { type: 'status' }>> = {}
): ConversationEvent => ({
  type: 'status',
  status: 'idle',
  error: null,
  ...overrides,
})

const createDebugEvent = (overrides: Partial<VoiceDebugEvent> = {}): VoiceDebugEvent => ({
  t: overrides.t ?? new Date().toISOString(),
  kind: 'info',
  src: 'app',
  msg: 'test',
  ...overrides,
})

describe('ConversationEventEmitter', () => {
  let emitter: ConversationEventEmitter

  beforeEach(() => {
    emitter = new ConversationEventEmitter(false, 5)
  })

  describe('conversation listeners', () => {
    it('delivers events to all registered listeners', () => {
      const listenerA = vi.fn()
      const listenerB = vi.fn()

      const unsubA = emitter.addListener(listenerA)
      emitter.addListener(listenerB)

      const event = createStatusEvent({ status: 'connected' })
      emitter.emit(event)

      expect(listenerA).toHaveBeenCalledWith(event)
      expect(listenerB).toHaveBeenCalledWith(event)

      unsubA()
      listenerA.mockClear()

      emitter.emit(createStatusEvent({ status: 'error', error: 'fail' }))

      expect(listenerA).not.toHaveBeenCalled()
      expect(listenerB).toHaveBeenCalledTimes(2)
    })

    it('swallows listener errors so other listeners still run', () => {
      const noisyListener = vi.fn(() => {
        throw new Error('listener boom')
      })
      const healthyListener = vi.fn()

      emitter.addListener(noisyListener)
      emitter.addListener(healthyListener)

      expect(() => emitter.emit(createStatusEvent())).not.toThrow()
      expect(noisyListener).toHaveBeenCalledTimes(1)
      expect(healthyListener).toHaveBeenCalledTimes(1)
    })

    it('tracks listener counts accurately', () => {
      expect(emitter.getListenerCount()).toBe(0)

      const unsub = emitter.addListener(vi.fn())
      expect(emitter.getListenerCount()).toBe(1)

      emitter.addListener(vi.fn())
      expect(emitter.getListenerCount()).toBe(2)

      unsub()
      expect(emitter.getListenerCount()).toBe(1)
    })
  })

  describe('debug listeners and backlog', () => {
    it('records debug events even when disabled', () => {
      const event = createDebugEvent({ msg: 'debug 1' })
      emitter.emitDebug(event)

      const backlog = emitter.getBacklog()
      expect(backlog).toHaveLength(1)
      expect(backlog[0]).toEqual(event)
    })

    it('does not notify listeners while disabled, but flushes once enabled', () => {
      const listener = vi.fn()
      emitter.addDebugListener(listener)

      const first = createDebugEvent({ msg: 'queued 1' })
      const second = createDebugEvent({ msg: 'queued 2' })

      emitter.emitDebug(first)
      emitter.emitDebug(second)

      expect(listener).not.toHaveBeenCalled()

      emitter.enableDebug(true)

      const calls = listener.mock.calls.map(call => call[0] as VoiceDebugEvent)
      expect(calls).toHaveLength(3)
      expect(calls[0]).toEqual(first)
      expect(calls[1]).toEqual(second)
      expect(calls[2]).toMatchObject({ msg: 'debug enabled' })
    })

    it('delivers events immediately once debug is enabled', () => {
      const listener = vi.fn()
      emitter.enableDebug(true)
      emitter.addDebugListener(listener)

      const event = createDebugEvent({ msg: 'live' })
      emitter.emitDebug(event)

      expect(listener).toHaveBeenCalledWith(event)
      expect(listener).toHaveBeenCalledTimes(2)
    })

    it('respects backlog maximum and adjusts pointer', () => {
      const listener = vi.fn()

      for (let i = 0; i < 12; i += 1) {
        emitter.emitDebug(createDebugEvent({ t: String(i) }))
      }

      expect(emitter.getBacklog().map(entry => entry.t)).toEqual(['7', '8', '9', '10', '11'])

      emitter.addDebugListener(listener)
      emitter.enableDebug(true)

      expect(listener.mock.calls.map(call => (call[0] as VoiceDebugEvent).t)).toEqual([
        '7',
        '8',
        '9',
        '10',
        '11',
        expect.any(String),
      ])
    })

    it('safely handles listener errors during backlog flush', () => {
      const badListener = vi.fn(() => {
        throw new Error('nope')
      })
      const goodListener = vi.fn()

      emitter.emitDebug(createDebugEvent({ msg: 'backlog' }))
      emitter.addDebugListener(badListener)
      emitter.addDebugListener(goodListener)

      expect(() => emitter.enableDebug(true)).not.toThrow()
      expect(goodListener).toHaveBeenCalled()
    })

    it('tracks debug listener counts and unsubscribe', () => {
      const unsub = emitter.addDebugListener(vi.fn())
      expect(emitter.getDebugListenerCount()).toBe(1)

      emitter.addDebugListener(vi.fn())
      expect(emitter.getDebugListenerCount()).toBe(2)

      unsub()
      expect(emitter.getDebugListenerCount()).toBe(1)
    })
  })

  describe('debug toggle', () => {
    it('reflects current debug state', () => {
      expect(emitter.isDebugEnabled()).toBe(false)
      emitter.enableDebug(true)
      expect(emitter.isDebugEnabled()).toBe(true)
      emitter.enableDebug(false)
      expect(emitter.isDebugEnabled()).toBe(false)
    })
  })

  describe('dispose', () => {
    it('clears all listeners', () => {
      emitter.addListener(vi.fn())
      emitter.addDebugListener(vi.fn())

      emitter.dispose()

      expect(emitter.getListenerCount()).toBe(0)
      expect(emitter.getDebugListenerCount()).toBe(0)
    })
  })
})
