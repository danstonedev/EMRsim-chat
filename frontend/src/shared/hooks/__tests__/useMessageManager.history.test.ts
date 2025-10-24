import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useState } from 'react'

// IMPORTANT: mock the same module id that the hook resolves at runtime
vi.mock('../../api', () => {
  return {
    api: {
      getSessionTurns: vi.fn().mockResolvedValue([]),
    },
  }
})

// eslint-disable-next-line import/first
import { useMessageManager } from '../useMessageManager'
// eslint-disable-next-line import/first
import { api } from '../../api'

describe('useMessageManager - historical turns loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads historical turns once per session and does not loop on rerenders', async () => {
    const getSessionTurns = vi
      .spyOn(api, 'getSessionTurns')
      .mockResolvedValueOnce([
        { role: 'assistant', text: 'Welcome back.', timestamp: Date.now() },
      ] as any)

    function useHarness() {
      const [messages, setMessages] = useState<any[]>([])
      const queueMessageUpdate = (fn: () => void) => fn()
      const updateVoiceMessage = vi.fn()
      const voiceUserStartTimeRef = { current: null as number | null }
      const onPersistenceError = vi.fn()

      const mm = useMessageManager({
        messages,
        setMessages,
        sessionId: 'session-1',
        queueMessageUpdate,
        updateVoiceMessage,
        voiceUserStartTimeRef,
        onPersistenceError,
      })
      return mm
    }

    const { rerender, result } = renderHook(() => useHarness())

  // Initial fetch invoked once; loader should settle to false after applying historical turns
    await waitFor(() => {
      expect(getSessionTurns).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(result.current.isInitialHistoryLoading).toBe(false)
    })

    // Rerender the hook without changing sessionId
    rerender()

    // Ensure no additional fetches occur on simple rerender without session change
    await waitFor(() => {
      expect(getSessionTurns).toHaveBeenCalledTimes(1)
    })
  })

  it('skips historical fetch when messages already exist', async () => {
    const getSessionTurns = vi.spyOn(api, 'getSessionTurns').mockResolvedValue([])

    function useHarnessWithMessages() {
      const [messages, setMessages] = useState<any[]>([
        { id: 'm1', role: 'user', channel: 'text', text: 'hi', pending: false, timestamp: Date.now(), sequenceId: 1 },
      ])
      const queueMessageUpdate = (fn: () => void) => fn()
      const updateVoiceMessage = vi.fn()
      const voiceUserStartTimeRef = { current: null as number | null }
      const onPersistenceError = vi.fn()

      const mm = useMessageManager({
        messages,
        setMessages,
        sessionId: 'session-2',
        queueMessageUpdate,
        updateVoiceMessage,
        voiceUserStartTimeRef,
        onPersistenceError,
      })
      return mm
    }

    const { result } = renderHook(() => useHarnessWithMessages())

    // Should immediately skip fetch and mark loading false
    await waitFor(() => {
      expect(result.current.isInitialHistoryLoading).toBe(false)
      expect(getSessionTurns).not.toHaveBeenCalled()
    })
  })
})
