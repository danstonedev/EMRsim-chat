import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

import { useVoiceTranscripts } from '../useVoiceTranscripts'
import type { Message } from '../../../pages/chatShared'

// Mock API calls used by the hook to avoid network
vi.mock('../../api', () => ({
  api: {
    saveSpsTurns: vi.fn().mockResolvedValue({ saved: 1, duplicates: 0 }),
  },
}))

describe('useVoiceTranscripts - finalization robustness', () => {
  it('applies final updates even if the queued partial would be dropped', async () => {
    const updates: Array<(fn: () => void) => void> = []

    // queueMessageUpdate collects updates but doesn't run them to simulate a dropped queue
    const fakeQueue = (fn: () => void) => { updates.push(fn) }

    function Harness() {
      const [messages, setMessages] = useState<Message[]>([])
      const { updateVoiceMessage } = useVoiceTranscripts({
        sessionId: 's1',
        queueMessageUpdate: fakeQueue,
        setMessages,
        setPersistenceError: () => {},
      })
      return { messages, setMessages, updateVoiceMessage }
    }

    const { result } = renderHook(() => Harness())

    // 1) Emit a partial (should be queued, not applied yet)
    act(() => {
      result.current.updateVoiceMessage('assistant', 'Hello', false, Date.now())
    })

    // Simulate queue being cleared (dropped) by not executing the queued functions

    // 2) Emit a final - should apply synchronously regardless of queue state
    act(() => {
      result.current.updateVoiceMessage('assistant', 'Hello', true, Date.now())
    })

    // Assert we have a visible, finalized message
    expect(result.current.messages.length).toBe(1)
    const msg = result.current.messages[0]
    expect(msg.text).toBe('Hello')
    expect(msg.pending).toBe(false)
    expect(msg.role).toBe('assistant')
    expect(msg.channel).toBe('voice')
  })
})
