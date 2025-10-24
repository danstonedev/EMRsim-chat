import { useEffect, useRef } from 'react'
import type { Message } from '../../pages/chatShared'
import { sortMessages } from '../../pages/chatShared'

interface UsePartialClearingProps {
  userPartial: string
  assistantPartial: string
  queueMessageUpdate: (update: () => void) => void
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  finalizePendingMessages: () => void
  micPaused: boolean
  voiceStatus: 'idle' | 'connecting' | 'connected' | 'error'
}

/**
 * Handles finalization of pending voice messages when partial transcripts clear
 * 
 * This hook manages two key scenarios:
 * 1. When userPartial or assistantPartial clears (goes from non-empty to empty),
 *    marks the corresponding pending voice message as finalized (pending: false)
 * 2. When mic is paused or session disconnects, finalizes all pending messages
 * 
 * This ensures the UI correctly reflects when a voice transcript is "complete"
 * vs. still being actively transcribed.
 */
export function usePartialClearing({
  userPartial,
  assistantPartial,
  queueMessageUpdate,
  setMessages,
  finalizePendingMessages,
  micPaused,
  voiceStatus,
}: UsePartialClearingProps) {
  const prevUserPartialRef = useRef<string>('')
  const prevAssistantPartialRef = useRef<string>('')

  // Finalize user voice message when userPartial clears
  useEffect(() => {
    const prev = prevUserPartialRef.current
    prevUserPartialRef.current = userPartial
    const hadPartial = typeof prev === 'string' && prev.trim().length > 0
    const cleared = userPartial.trim().length === 0
    if (!hadPartial || !cleared) return

    queueMessageUpdate(() => {
      setMessages((prevMessages) => {
        let mutated = false
        const updated = prevMessages.map((msg) => {
          if (msg.role === 'user' && msg.channel === 'voice' && msg.pending) {
            mutated = true
            return { ...msg, pending: false }
          }
          return msg
        })
        return mutated ? sortMessages(updated) : prevMessages
      })
    })
  }, [queueMessageUpdate, userPartial, setMessages])

  // Finalize assistant voice message when assistantPartial clears
  useEffect(() => {
    const prev = prevAssistantPartialRef.current
    prevAssistantPartialRef.current = assistantPartial
    const hadPartial = typeof prev === 'string' && prev.trim().length > 0
    const cleared = assistantPartial.trim().length === 0
    if (!hadPartial || !cleared) return

    queueMessageUpdate(() => {
      setMessages((prevMessages) => {
        let mutated = false
        const updated = prevMessages.map((msg) => {
          if (msg.role === 'assistant' && msg.channel === 'voice' && msg.pending) {
            mutated = true
            return { ...msg, pending: false }
          }
          return msg
        })
        return mutated ? sortMessages(updated) : prevMessages
      })
    })
  }, [queueMessageUpdate, assistantPartial, setMessages])

  // Finalize when mic is paused
  useEffect(() => {
    if (micPaused) finalizePendingMessages()
  }, [micPaused, finalizePendingMessages])

  // Finalize when session is not connected (idle/error) — i.e., after end
  useEffect(() => {
    if (voiceStatus !== 'connected' && voiceStatus !== 'connecting') {
      finalizePendingMessages()
    }
  }, [voiceStatus, finalizePendingMessages])
}
