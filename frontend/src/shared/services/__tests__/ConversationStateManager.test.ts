import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConversationStateManager } from '../ConversationStateManager'

describe('ConversationStateManager', () => {
  let stateManager: ConversationStateManager

  beforeEach(() => {
    stateManager = new ConversationStateManager()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('initializes with idle status and cleared flags', () => {
    expect(stateManager.getStatus()).toBe('idle')
    expect(stateManager.getError()).toBeNull()
    expect(stateManager.isConnected()).toBe(false)
    expect(stateManager.isSessionReady()).toBe(false)
    expect(stateManager.isFullyReady()).toBe(false)
    expect(stateManager.isAwaitingSessionAck()).toBe(false)
  })

  it('allows valid state transitions and updates connected flag', () => {
    expect(stateManager.updateStatus('connecting', null)).toBe(true)
    expect(stateManager.getStatus()).toBe('connecting')
    expect(stateManager.isConnected()).toBe(false)

    expect(stateManager.updateStatus('connected', null)).toBe(true)
    expect(stateManager.getStatus()).toBe('connected')
    expect(stateManager.isConnected()).toBe(true)

    expect(stateManager.updateStatus('idle', null)).toBe(true)
    expect(stateManager.getStatus()).toBe('idle')
    expect(stateManager.isConnected()).toBe(false)
  })

  it('rejects invalid transitions', () => {
    expect(stateManager.updateStatus('connected', null)).toBe(false)
    expect(stateManager.getStatus()).toBe('idle')
  })

  it('notifies subscribers on status changes and supports unsubscribe', () => {
    const callback = vi.fn()
    const unsubscribe = stateManager.onStatusChange(callback)

    expect(callback).toHaveBeenCalledWith('idle', null)
    callback.mockClear()

    stateManager.updateStatus('connecting', null)
    expect(callback).toHaveBeenCalledWith('connecting', null)

    callback.mockClear()
    stateManager.updateStatus('error', 'Connection failed')
    expect(callback).toHaveBeenCalledWith('error', 'Connection failed')

    callback.mockClear()
    unsubscribe()
    stateManager.updateStatus('idle', null)
    expect(callback).not.toHaveBeenCalled()
  })

  it('setConnected synchronises status and connectivity flag', () => {
    stateManager.updateStatus('connecting', null)

    stateManager.setConnected(true)
    expect(stateManager.isConnected()).toBe(true)
    expect(stateManager.getStatus()).toBe('connected')

    stateManager.setConnected(false)
    expect(stateManager.isConnected()).toBe(false)
    expect(stateManager.getStatus()).toBe('connecting')
  })

  it('setFullyReady toggles readiness flag', () => {
    expect(stateManager.isFullyReady()).toBe(false)
    stateManager.setFullyReady(true)
    expect(stateManager.isFullyReady()).toBe(true)
    stateManager.setFullyReady(false)
    expect(stateManager.isFullyReady()).toBe(false)
  })

  it('setAwaitingSessionAck triggers timeout callback and clears flag', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()

    stateManager.setAwaitingSessionAck(true, 1000, onTimeout)
    expect(stateManager.isAwaitingSessionAck()).toBe(true)

    vi.advanceTimersByTime(1000)

    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(stateManager.isAwaitingSessionAck()).toBe(false)
  })

  it('setSessionReady marks readiness and cancels pending ack timeout', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()

    stateManager.setAwaitingSessionAck(true, 1000, onTimeout)
    stateManager.setSessionReady(true)

    expect(stateManager.isSessionReady()).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('reset clears state and notifies listeners of idle status', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    stateManager.onStatusChange(callback)
    callback.mockClear()

    stateManager.updateStatus('error', 'boom')
    stateManager.setSessionReady(true)
    stateManager.setConnected(true)
    stateManager.setFullyReady(true)
    const ackCallback = vi.fn()
    stateManager.setAwaitingSessionAck(true, 1000, ackCallback)

    stateManager.reset()

    expect(stateManager.getStatus()).toBe('idle')
    expect(stateManager.getError()).toBeNull()
    expect(stateManager.isSessionReady()).toBe(false)
    expect(stateManager.isConnected()).toBe(false)
    expect(stateManager.isFullyReady()).toBe(false)
    expect(stateManager.isAwaitingSessionAck()).toBe(false)
    expect(callback).toHaveBeenCalledWith('idle', null)
  })

  it('getSnapshot returns the current state', () => {
    stateManager.updateStatus('connecting', 'oops')
    stateManager.setSessionReady(true)
    stateManager.setFullyReady(true)
    stateManager.setAwaitingSessionAck(true)

    const snapshot = stateManager.getSnapshot()

    expect(snapshot).toEqual({
      status: 'connecting',
      error: 'oops',
      sessionReady: true,
      connected: false,
      fullyReady: true,
      awaitingSessionAck: true,
    })
  })
})
