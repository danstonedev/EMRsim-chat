import { useCallback, useRef, Dispatch, SetStateAction } from 'react'
import { Message, sortMessages, createMessage } from '../../pages/chatShared'
import type { MediaReference } from '../../pages/chatShared'
import { api } from '../api'
import { recordVoiceEvent } from '../telemetry'
import { voiceDebug } from '../utils/voiceLogging'
import { logDeduplication } from '../utils/transcriptMonitoring'

// Allow generous window so backend rebroadcasts (finalized vs started timestamps) don't create duplicates
const VOICE_DUPLICATE_WINDOW_MS = 15000
// Wider window for catchup messages to handle socket reconnection duplicates
const CATCHUP_DUPLICATE_WINDOW_MS = 30000

interface UseVoiceTranscriptsOptions {
  sessionId: string | null
  queueMessageUpdate: (updateFn: () => void) => void
  setMessages: Dispatch<SetStateAction<Message[]>>
  setPersistenceError: Dispatch<SetStateAction<{ message: string; timestamp: number } | null>>
}

interface VoiceMessageOptions {
  source?: 'live' | 'catchup'
}

/**
 * Manages voice transcript state including deduplication, timestamps, and persistence.
 * Handles the complex logic of tracking partial/final transcripts from both user and assistant.
 */
export function useVoiceTranscripts({
  sessionId,
  queueMessageUpdate,
  setMessages,
  setPersistenceError,
}: UseVoiceTranscriptsOptions) {
  // Voice message tracking refs
  const voiceUserIdRef = useRef<string | null>(null)
  const voiceAssistantIdRef = useRef<string | null>(null)

  // Timing ref for TTFT metrics (not used for message ordering - backend handles that)
  const voiceUserStartTimeRef = useRef<number | null>(null)

  // Deduplication tracking
  const lastVoiceFinalUserRef = useRef<string>('')
  const lastVoiceFinalAssistantRef = useRef<string>('')
  const lastVoiceFinalUserTsRef = useRef<number | null>(null)
  const lastVoiceFinalAssistantTsRef = useRef<number | null>(null)

  // Recent typed user text for duplicate prevention
  const recentTypedUserRef = useRef<{ text: string; ts: number } | null>(null)

  /**
   * Reset all voice tracking state (used when session/persona changes)
   */
  const resetVoiceTrackingState = useCallback(() => {
    voiceUserIdRef.current = null
    voiceAssistantIdRef.current = null
    voiceUserStartTimeRef.current = null
    recentTypedUserRef.current = null
    lastVoiceFinalUserRef.current = ''
    lastVoiceFinalAssistantRef.current = ''
    lastVoiceFinalUserTsRef.current = null
    lastVoiceFinalAssistantTsRef.current = null
  }, [])

  /**
   * Update or create a voice message bubble with deduplication logic
   */
  const updateVoiceMessage = useCallback((
    role: 'user' | 'assistant',
    text: string,
    isFinal: boolean,
    timestamp: number,
    media?: MediaReference,
    options?: VoiceMessageOptions
  ) => {
    voiceDebug('[useVoiceTranscripts] updateVoiceMessage invoked', {
      role,
      isFinal,
      textLength: text?.length ?? 0,
      timestamp,
      voiceUserId: voiceUserIdRef.current,
      voiceAssistantId: voiceAssistantIdRef.current,
      source: options?.source || 'live',
    })
    const ref = role === 'user' ? voiceUserIdRef : voiceAssistantIdRef
    const lastFinalRef = role === 'user' ? lastVoiceFinalUserRef : lastVoiceFinalAssistantRef
    const lastFinalTsRef = role === 'user' ? lastVoiceFinalUserTsRef : lastVoiceFinalAssistantTsRef
    const safeTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now()

    // Use wider window for catchup messages to handle reconnection duplicates
    const duplicateWindow = options?.source === 'catchup'
      ? CATCHUP_DUPLICATE_WINDOW_MS
      : VOICE_DUPLICATE_WINDOW_MS

    // Track if we actually processed this message (to avoid setting lastFinalRef on skipped duplicates)
    let messageProcessed = false
    // Helper to apply state update either synchronously (finals) or via queue (partials)
    const applyUpdate = (updateFn: (prev: Message[]) => Message[]) => {
      if (isFinal) {
        setMessages(prev => updateFn(prev))
      } else {
        queueMessageUpdate(() => {
          setMessages(prev => updateFn(prev))
        })
      }
    }

    applyUpdate((prev) => {
        const id = ref.current

        // If we don't have an active voice bubble for this role, create one
        if (!id) {
          // If a typed message was just submitted with the same timestamp, prefer the typed bubble
          if (role === 'user') {
            const nearTyped = prev.find(
              m => m.role === 'user' &&
                m.channel === 'text' &&
                Math.abs(m.timestamp - safeTimestamp) < 2000
            )
            if (nearTyped) {
              voiceDebug('[useVoiceTranscripts] skipped voice bubble - recent typed message nearby', {
                role,
                safeTimestamp,
                nearTypedId: nearTyped.id,
              })
              // Update the typed bubble instead of creating a competing voice bubble
              return sortMessages(
                prev.map(m =>
                  m.id === nearTyped.id
                    ? { ...m, text, pending: !isFinal }
                    : m
                )
              )
            }
          }

          // CRITICAL: Defer user bubble creation until final BEFORE duplicate checks
          // Otherwise the final message gets caught by duplicate detection before the bubble is created!
          if (role === 'user' && !isFinal) {
            // For user turns, defer bubble creation until final to avoid flicker
            voiceDebug('[useVoiceTranscripts] deferred user bubble until final', { role, safeTimestamp })
            return sortMessages(prev)
          }

          // Check if this exact message already exists in the array (backend mode double-delivery)
          if (isFinal) {
            const existingMessage = prev.find(
              m => m.role === role &&
                m.channel === 'voice' &&
                m.text === text &&
                !m.pending &&
                Math.abs(m.timestamp - safeTimestamp) <= duplicateWindow // Use dynamic window
            )
            if (existingMessage) {
              // Skip duplicate - message already exists
              voiceDebug('[useVoiceTranscripts] skipped final voice bubble - identical message already persisted', {
                role,
                safeTimestamp,
                existingMessageId: existingMessage.id,
                source: options?.source || 'live',
              })
              logDeduplication({
                role,
                text,
                source: options?.source || 'live',
                dedupeMethod: 'existingMessage',
                windowMs: duplicateWindow,
              })
              messageProcessed = false
              return sortMessages(prev)
            }
          }

          // Check for duplicate finals within a short time window
          if (isFinal && text && lastFinalRef.current && text === lastFinalRef.current) {
            const lastTs = lastFinalTsRef.current
            if (typeof lastTs === 'number' && Math.abs(safeTimestamp - lastTs) <= duplicateWindow) {
              // Skip duplicate - already processed this text recently
              voiceDebug('[useVoiceTranscripts] skipped final voice bubble - duplicate within window', {
                role,
                safeTimestamp,
                lastTimestamp: lastTs,
                source: options?.source || 'live',
              })
              logDeduplication({
                role,
                text,
                source: options?.source || 'live',
                dedupeMethod: 'lastFinal',
                windowMs: duplicateWindow,
              })
              messageProcessed = false
              return sortMessages(prev)
            }
          }

          // Check if the most recent message from this role (voice) already equals this text
          for (let i = prev.length - 1; i >= 0; i--) {
            const m = prev[i]
            if (m.role === role && m.channel === 'voice') {
              if (!m.pending && m.text === text && Math.abs(safeTimestamp - m.timestamp) <= VOICE_DUPLICATE_WINDOW_MS) {
                voiceDebug('updateVoiceMessage duplicate voice bubble skipped', {
                  role,
                  text,
                  timestamp: safeTimestamp,
                })
                return sortMessages(prev)
              }
              break
            }
          }

          // Create new voice message - backend will handle ordering via created_at timestamp
          const newMessage = createMessage(role, text, 'voice', {
            pending: !isFinal,
            timestamp: safeTimestamp,
            media: role === 'assistant' ? media : undefined,
          })

          // Set ref for streaming updates, but clear immediately if final (don't reuse for next turn)
          ref.current = isFinal ? null : newMessage.id
          voiceDebug('[useVoiceTranscripts] created new voice message', {
            role,
            messageId: newMessage.id,
            isFinal,
            pending: !isFinal,
            safeTimestamp,
          })
          messageProcessed = true
          return sortMessages([...prev, newMessage])
        }

        // Update existing streaming bubble
        const updated = prev.map(msg => {
          if (msg.id !== id) return msg
          // Guard: ignore empty, non-final updates that would overwrite visible text
          if (!isFinal && text === '' && msg.text && msg.text.length > 0) {
            voiceDebug('[useVoiceTranscripts] ignored empty non-final update for existing bubble', {
              role,
              messageId: msg.id,
            })
            return msg
          }
          if (role === 'assistant') {
            const nextMedia = media !== undefined ? (media ?? msg.media) : msg.media
            voiceDebug('[useVoiceTranscripts] updated assistant bubble text/media', {
              messageId: msg.id,
              isFinal,
              nextMediaPresent: Boolean(nextMedia),
            })
            return { ...msg, text, pending: !isFinal, media: nextMedia }
          }
          voiceDebug('[useVoiceTranscripts] updated user bubble text', {
            messageId: msg.id,
            isFinal,
          })
          return { ...msg, text, pending: !isFinal }
        })

        // Clear ref if finalizing (so next turn creates new bubble)
        if (isFinal) {
          voiceDebug('[useVoiceTranscripts] clearing streaming ref after final', {
            role,
            messageId: id,
          })
          ref.current = null
        }

        messageProcessed = true
        return sortMessages(updated)
      })

    // CRITICAL: Only set lastFinalRef if we actually processed the message (not skipped as duplicate)
    // Setting it before processing causes the first final to be skipped by its own duplicate check!
    if (isFinal && messageProcessed) {
      // Remember the last finalized line and clear the active id
      if (role === 'user') {
        lastVoiceFinalUserRef.current = text
        lastVoiceFinalUserTsRef.current = safeTimestamp
      } else {
        lastVoiceFinalAssistantRef.current = text
        lastVoiceFinalAssistantTsRef.current = safeTimestamp
      }
      voiceDebug('[useVoiceTranscripts] finalized voice message processed', {
        role,
        safeTimestamp,
        messageProcessed,
      })
      ref.current = null
    } else if (isFinal && !messageProcessed) {
      voiceDebug('[useVoiceTranscripts] finalized voice message skipped', {
        role,
        safeTimestamp,
        reason: 'duplicate-or-filtered',
      })
    }

    // Persist finalized voice turns to backend
    if (isFinal && text && text.trim() && sessionId) {
      const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
      if (role === 'user') {
        const recent = recentTypedUserRef.current
        if (recent && Date.now() - recent.ts < 3000 && norm(recent.text) === norm(text)) {
          if (import.meta.env.DEV) {
            console.debug('[useVoiceTranscripts] Skipped duplicate user turn (recently typed)')
          }
          return
        }
      }

      if (import.meta.env.DEV) {
        console.debug('[useVoiceTranscripts] Persisting voice turn:', {
          role,
          channel: 'audio',
          textLength: text.length,
          timestamp: safeTimestamp,
          note: 'timestamp is when speaking started (for correct chronological ordering)',
        })
      }

      // Persist with start time (when speaking began) for correct chronological ordering
      // safeTimestamp is now the startedAtMs from TranscriptHandler
      api.saveSpsTurns(sessionId, [{
        role,
        text,
        channel: 'audio',
        timestamp_ms: safeTimestamp
      }])
        .then(res => {
          if (import.meta.env.DEV) {
            console.debug('[useVoiceTranscripts] Turn persisted:', {
              role,
              saved: res.saved,
              duplicates: res.duplicates
            })
          }
          recordVoiceEvent({
            type: 'turn-persist',
            role,
            saved: res.saved ?? 0,
            duplicates: res.duplicates ?? 0,
            sessionId
          })
        })
        .catch(e => {
          console.error('[useVoiceTranscripts] Turn persist failed:', e)
          recordVoiceEvent({
            type: 'turn-persist-error',
            role,
            error: e instanceof Error ? e.message : String(e),
            sessionId
          })
          setPersistenceError({
            message: 'Failed to save transcript',
            timestamp: Date.now()
          })
        })
    }
  }, [sessionId, queueMessageUpdate, setMessages, setPersistenceError])

  return {
    updateVoiceMessage,
    resetVoiceTrackingState,
    voiceUserStartTimeRef, // For TTFT metrics only
    recentTypedUserRef,
  }
}
