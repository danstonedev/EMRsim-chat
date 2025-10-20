import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type RefObject } from 'react'
import { api } from '../api'
import { Message, sortMessages, nextSequenceId } from '../../pages/chatShared'
import type { MediaReference } from '../../shared/types'
import { voiceDebug } from '../utils/voiceLogging'

interface UpdateAssistantTextMessageOptions {
  append?: boolean
  preserveOnFinalEmpty?: boolean
}

interface UseMessageManagerOptions {
  messages: Message[]
  setMessages: Dispatch<SetStateAction<Message[]>>
  sessionId: string | null
  queueMessageUpdate: (update: () => void) => void
  updateVoiceMessage: (role: 'user' | 'assistant', text: string, isFinal: boolean, timestamp: number, media?: MediaReference) => void
  voiceUserStartTimeRef: RefObject<number | null>
  onPersistenceError: (message: string) => void
}

interface UseMessageManagerReturn {
  // State
  sortedMessages: Message[]
  ttftMs: number | null
  setTtftMs: (ms: number | null) => void
  isInitialHistoryLoading: boolean
  
  // Refs
  messagesEndRef: RefObject<HTMLDivElement | null>
  messagesContainerRef: RefObject<HTMLDivElement | null>
  firstDeltaRef: RefObject<number | null>
  textAssistantIdRef: RefObject<string | null>
  textUserStartTimeRef: RefObject<number | null>
  
  // Functions
  updateAssistantTextMessage: (
    text: string,
    isFinal: boolean,
    timestamp: number,
    media?: MediaReference,
    opts?: UpdateAssistantTextMessageOptions
  ) => void
  finalizePendingMessages: () => void
  isNearBottom: () => boolean
  resetMessageState: () => void
}

/**
 * Custom hook to manage message state, refs, and operations.
 * Extracts all message-related logic from App.tsx for better organization and testability.
 * 
 * Responsibilities:
 * - Message state management (messages array, sorted messages)
 * - Message refs (scroll refs, timing refs, assistant ID refs)
 * - Message update operations (assistant text updates, finalization)
 * - Auto-scroll detection
 * - Message persistence to backend
 */
export function useMessageManager({
  messages,
  setMessages,
  sessionId,
  queueMessageUpdate,
  updateVoiceMessage,
  voiceUserStartTimeRef,
  onPersistenceError,
}: UseMessageManagerOptions): UseMessageManagerReturn {
  // State
  const [ttftMs, setTtftMs] = useState<number | null>(null)
  const [isInitialHistoryLoading, setIsInitialHistoryLoading] = useState(false)
  
  // Refs for scroll management
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  
  // Refs for message tracking
  const firstDeltaRef = useRef<number | null>(null)
  const textAssistantIdRef = useRef<string | null>(null)
  const textUserStartTimeRef = useRef<number | null>(null)
  
  // Memoized sorted messages
  const sortedMessages = useMemo(() => sortMessages(messages), [messages])

  // Stabilize effect dependencies via refs (to avoid re-running history load on every render)
  const queueMessageUpdateRef = useRef(queueMessageUpdate)
  useEffect(() => { queueMessageUpdateRef.current = queueMessageUpdate }, [queueMessageUpdate])
  const setMessagesRef = useRef(setMessages)
  useEffect(() => { setMessagesRef.current = setMessages }, [setMessages])
  const updateVoiceMessageRef = useRef(updateVoiceMessage)
  useEffect(() => { updateVoiceMessageRef.current = updateVoiceMessage }, [updateVoiceMessage])
  const onPersistenceErrorRef = useRef(onPersistenceError)
  useEffect(() => { onPersistenceErrorRef.current = onPersistenceError }, [onPersistenceError])
  const messagesLenRef = useRef<number>(messages.length)
  useEffect(() => { messagesLenRef.current = messages.length }, [messages.length])
  
  /**
   * Check if the user is scrolled near the bottom of the messages container.
   * Used to determine if auto-scroll should be applied.
   */
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return true // Default to scrolling if ref not set
    const threshold = 150 // pixels from bottom
    const position = container.scrollHeight - container.scrollTop - container.clientHeight
    return position < threshold
  }, [])
  
  /**
   * Update the assistant text message bubble created for typed input (DC transcripts or SSE deltas).
   * Handles both streaming updates and final messages.
   */
  const updateAssistantTextMessage = useCallback(
    (
      text: string,
      isFinal: boolean,
      timestamp: number,
      media?: MediaReference,
      opts?: UpdateAssistantTextMessageOptions
    ) => {
      const id = textAssistantIdRef.current
      if (!id) {
        // No pending typed assistant bubble; fall back to voice handling (covers audio transcript cases)
        updateVoiceMessage('assistant', text, isFinal, timestamp, media)
        return
      }
      
      queueMessageUpdate(() => {
        setMessages(prev => {
          let found = false
          const updated = prev.map(msg => {
            if (msg.id !== id) return msg
            found = true
            
            // Stamp timestamp/sequence on first delta
            const stampedTs = msg.timestamp && msg.timestamp > 0 ? msg.timestamp : timestamp
            const stampedSeq = msg.sequenceId && msg.sequenceId > 0 ? msg.sequenceId : nextSequenceId()
            
            let nextText = text
            if (opts?.append && !isFinal) {
              nextText = (msg.text || '') + (text || '')
            } else if (isFinal && opts?.preserveOnFinalEmpty && (!text || text.length === 0)) {
              nextText = msg.text || ''
            }
            
            const updatedMessage = {
              ...msg,
              text: nextText,
              pending: !isFinal,
              timestamp: stampedTs,
              sequenceId: stampedSeq,
            }
            
            if (media !== undefined) {
              return { ...updatedMessage, media: media ?? msg.media }
            }
            return { ...updatedMessage, media: msg.media }
          })
          return sortMessages(found ? updated : prev)
        })
      })
      
      // Track time to first token (TTFT)
      if (!isFinal && firstDeltaRef.current == null) {
        firstDeltaRef.current = timestamp
        // Prefer voice start time when in a voice session; fall back to typed user start.
        const voiceStart = voiceUserStartTimeRef.current
        const typedStart = textUserStartTimeRef.current
        const start = voiceStart != null ? voiceStart : typedStart
        if (start != null) setTtftMs(timestamp - start)
      }
      
      // Handle finalization
      if (isFinal) {
        textAssistantIdRef.current = null
        if (sessionId) {
          const payloadText = text && text.trim() ? text : messages.find(m => m.id === id)?.text || ''
          if (payloadText && payloadText.trim()) {
              voiceDebug('[useMessageManager] Persisting assistant text turn:', {
              channel: 'text',
              textLength: payloadText.length,
              timestamp,
            })
            api
              .saveSpsTurns(sessionId, [{ role: 'assistant', text: payloadText, channel: 'text', timestamp_ms: timestamp }])
              .then(res => {
                voiceDebug('[useMessageManager] Assistant turn persisted:', {
                  saved: res.saved,
                  duplicates: res.duplicates,
                })
              })
              .catch(err => {
                console.error('[useMessageManager] Assistant turn persist failed:', err)
                console.warn('[sps] save assistant turn failed', err)
                onPersistenceError('Failed to save transcript')
              })
          }
        }
      }
    },
    [sessionId, messages, queueMessageUpdate, updateVoiceMessage, voiceUserStartTimeRef, onPersistenceError, setMessages]
  )
  
  /**
   * Finalize all pending messages by marking them as not pending.
   * Called when mic is paused or session ends to clean up UI state.
   */
  const finalizePendingMessages = useCallback(() => {
    queueMessageUpdate(() => {
      setMessages(prevMessages => {
        let mutated = false
        const updated = prevMessages.map(msg => {
          if (msg.pending) {
            mutated = true
            return { ...msg, pending: false }
          }
          return msg
        })
        return mutated ? sortMessages(updated) : prevMessages
      })
    })
  }, [queueMessageUpdate, setMessages])
  
  /**
   * Reset all message-related state.
   * Used when starting a new encounter or changing scenarios.
   */
  const resetMessageState = useCallback(() => {
    setMessages([])
    setTtftMs(null)
    firstDeltaRef.current = null
    textAssistantIdRef.current = null
    textUserStartTimeRef.current = null
  }, [setMessages])

  type HistoricalLoadState = {
    sessionId: string | null
    attempts: number
    timer: ReturnType<typeof setTimeout> | null
    loaded: boolean
  }

  const historicalLoadStateRef = useRef<HistoricalLoadState>({
    sessionId: null,
    attempts: 0,
    timer: null,
    loaded: false,
  })
  
  /**
   * Load historical turns from backend when session starts.
   * This ensures messages are displayed even after page refresh.
   */
  useEffect(() => {
    if (!sessionId) {
      // Clear any pending retries if session is cleared
      const previous = historicalLoadStateRef.current
      if (previous.timer) {
        clearTimeout(previous.timer)
        previous.timer = null
      }
      historicalLoadStateRef.current.sessionId = null
      historicalLoadStateRef.current.attempts = 0
      historicalLoadStateRef.current.loaded = false
      setIsInitialHistoryLoading(false)
      return
    }

    const activeSessionId = sessionId // Preserve non-null session id for async usage
    let mounted = true
    const state = historicalLoadStateRef.current

    // If we already successfully loaded for this session, do nothing
    if (state.sessionId === activeSessionId && state.loaded) {
      return () => {
        mounted = false
      }
    }

    if (state.sessionId !== activeSessionId) {
      // Reset retry state when the session changes
      if (state.timer) {
        clearTimeout(state.timer)
        state.timer = null
      }
      state.sessionId = activeSessionId
      state.attempts = 0
      state.loaded = false
      setIsInitialHistoryLoading(true)
    } else if (state.attempts === 0) {
      setIsInitialHistoryLoading(true)
    }

    const MAX_ATTEMPTS = 5
    const dbgEnabled = (() => {
      try {
        const envVal = (import.meta as any)?.env?.VITE_DEBUG_HISTORY_FETCH
        const lsVal = typeof window !== 'undefined' ? window.localStorage?.getItem('DEBUG_HISTORY_FETCH') : null
        return Boolean((envVal && String(envVal).toLowerCase() !== 'false') || lsVal === '1' || lsVal === 'true')
      } catch {
        return false
      }
    })()
    const BASE_DELAY_MS = 500

    const scheduleRetry = (attempt: number) => {
      const clampedAttempt = Math.min(attempt, MAX_ATTEMPTS - 1)
      const delay = Math.min(BASE_DELAY_MS * Math.pow(2, clampedAttempt), 5000)
      if (dbgEnabled) {
        // eslint-disable-next-line no-console
        console.debug('[useMessageManager] scheduleRetry', { attempt, clampedAttempt, delay })
      }
      state.timer = setTimeout(() => {
        state.timer = null
        void loadHistoricalTurns()
      }, delay)
    }

    async function loadHistoricalTurns() {
      try {
        if (!mounted) return

        if (import.meta.env.DEV || dbgEnabled) {
          console.debug('[useMessageManager] Loading historical turns for session:', activeSessionId, 'attempt', state.attempts + 1)
        }

        // Fast-path: if any messages are already present, mark as loaded without fetching
        if (messagesLenRef.current > 0) {
          if (import.meta.env.DEV || dbgEnabled) {
            console.debug('[useMessageManager] Skipping historical fetch - messages already exist')
          }
          state.attempts = MAX_ATTEMPTS
          state.loaded = true
          setIsInitialHistoryLoading(false)
          return
        }

        const turns = await api.getSessionTurns(activeSessionId)

        if (!mounted) return

        state.attempts += 1

        if (turns.length > 0) {
          if (import.meta.env.DEV || dbgEnabled) {
            console.debug('[useMessageManager] Loaded historical turns:', turns.length)
          }

          queueMessageUpdateRef.current?.(() => {
            setMessagesRef.current?.(prev => {
              if (prev.length > 0) {
                console.debug('[useMessageManager] Skipping historical load - messages already exist')
                return prev
              }

              turns.forEach(turn => {
                updateVoiceMessageRef.current?.(turn.role as 'user' | 'assistant', turn.text, true, turn.timestamp)
              })

              // updateVoiceMessage will handle state updates; return previous array untouched
              return prev
            })
          })

          // Mark completion by setting attempts to max so retries do not reschedule
          state.attempts = MAX_ATTEMPTS
          state.loaded = true
          setIsInitialHistoryLoading(false)
        } else if (state.attempts < MAX_ATTEMPTS) {
          if (import.meta.env.DEV || dbgEnabled) {
            console.debug('[useMessageManager] Historical fetch returned no turns', {
              attempt: state.attempts,
              sessionId: activeSessionId,
            })
          }
          scheduleRetry(state.attempts)
        } else {
          setIsInitialHistoryLoading(false)
        }
      } catch (error) {
        if (!mounted) return
        const errorPayload =
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : { message: String(error) }
        const logFn = (import.meta.env.DEV || dbgEnabled) ? console.warn : console.error
        logFn('[useMessageManager] Failed to load historical turns:', {
          sessionId: activeSessionId,
          attempt: state.attempts + 1,
          error: errorPayload,
        })
        state.attempts += 1
        if (state.attempts < MAX_ATTEMPTS) {
          scheduleRetry(state.attempts)
        } else {
          onPersistenceErrorRef.current?.('Failed to load conversation history')
          setIsInitialHistoryLoading(false)
        }
      }
    }

    // If attempts already exhausted and marked loaded, avoid fetching again
    if (state.attempts >= MAX_ATTEMPTS && state.loaded) {
      setIsInitialHistoryLoading(false)
      return () => {
        mounted = false
        if (state.timer) {
          clearTimeout(state.timer)
          state.timer = null
        }
      }
    }

    void loadHistoricalTurns()

    return () => {
      mounted = false
      if (state.timer) {
        clearTimeout(state.timer)
        state.timer = null
      }
    }
  }, [sessionId])
  
  return {
    // State
    sortedMessages,
    ttftMs,
    setTtftMs,
    isInitialHistoryLoading,
    
    // Refs
    messagesEndRef,
    messagesContainerRef,
    firstDeltaRef,
    textAssistantIdRef,
    textUserStartTimeRef,
    
    // Functions
    updateAssistantTextMessage,
    finalizePendingMessages,
    isNearBottom,
    resetMessageState,
  }
}
