import { useEffect, useMemo, useRef } from 'react'
import type { Message } from '../../pages/chatShared'
import type { MediaReference } from '../types'
import { matchAnimation } from '../../pages/components/viewer/animations/keywords'
import { featureFlags } from '../flags'
import { animationDebug } from '../utils/animationLogging'

export type UseAnimationAutoTriggerArgs = {
  sortedMessages: Message[]
  onInsertAssistantMedia: (media: MediaReference) => void
  // onOpenMedia removed to avoid auto-opening modal; user expands explicitly
}

export function useAnimationAutoTrigger({ sortedMessages, onInsertAssistantMedia }: UseAnimationAutoTriggerArgs) {
  const enabled = featureFlags.chatAnimationsEnabled
  const processedIds = useRef<Set<string>>(new Set())
  const pending = useRef<null | { userId: string; userTs: number; match: ReturnType<typeof matchAnimation>, timer?: ReturnType<typeof setTimeout> | null }>(null)

  const lastUserMessage = useMemo(() => {
    for (let i = sortedMessages.length - 1; i >= 0; i--) {
      const m = sortedMessages[i]
      if (m.role === 'user' && !m.pending) return m
    }
    return null
  }, [sortedMessages])

  // Detect a new finalized user message that asks for an animation; queue it
  useEffect(() => {
    if (!enabled) return
    if (!lastUserMessage) return
    if (processedIds.current.has(lastUserMessage.id)) return

    const match = matchAnimation(lastUserMessage.text)
    processedIds.current.add(lastUserMessage.id)
    if (!match) return

    // Queue request; prefer inserting after the next assistant message.
    // Also set a fallback timer to insert if no assistant reply arrives within a short window.
    // This helps voice-only or delayed-text scenarios.
    const entry = { userId: lastUserMessage.id, userTs: lastUserMessage.timestamp, match, timer: null as ReturnType<typeof setTimeout> | null }
    // Fallback after 6s if no assistant message detected
    entry.timer = setTimeout(() => {
      if (!pending.current || pending.current.userId !== entry.userId) return
      const media: MediaReference = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        type: 'animation',
        url: '',
        thumbnail: undefined,
        caption: entry.match?.caption || '3D Demonstration',
        animationId: entry.match?.id,
        options: undefined,
      }
      onInsertAssistantMedia(media)
      animationDebug('Inserted 3D preview via timeout fallback (no assistant reply)', {
        animationId: entry.match?.id,
      })
      try { if (entry.timer) clearTimeout(entry.timer) } catch {}
      pending.current = null
    }, 6000)

    pending.current = entry
    animationDebug('Queued animation preview until assistant reply (with timeout fallback)', {
      userId: lastUserMessage.id,
      match,
    })
  }, [enabled, lastUserMessage, onInsertAssistantMedia])

  // When an assistant finalized text arrives after the triggering user message, insert the preview right after
  useEffect(() => {
    if (!enabled) return
    const p = pending.current
    if (!p) return

    // Find the first assistant message that is after the user message and has text
    const assistant = [...sortedMessages].find(m => m.role === 'assistant' && !m.pending && m.timestamp >= p.userTs)
    if (!assistant) return

    const media: MediaReference = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      type: 'animation',
      url: '',
      thumbnail: undefined,
      caption: p.match?.caption || '3D Demonstration',
      animationId: p.match?.id,
      options: undefined,
    }
    onInsertAssistantMedia(media)
    animationDebug('Inserted 3D preview after assistant message', {
      animationId: p.match?.id,
    })
    try { if (p.timer) clearTimeout(p.timer) } catch {}
    pending.current = null
  }, [enabled, sortedMessages, onInsertAssistantMedia])
}
