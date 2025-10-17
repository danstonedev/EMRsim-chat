import type { ConversationEvent } from '../../../../shared/types'

export interface SessionEventDependencies {
  logDebug: (...args: unknown[]) => void
  stateManager: {
    setAwaitingSessionAck(value: boolean): void
    setSessionReady(value: boolean, trigger?: string): void
    isFullyReady(): boolean
    setFullyReady(value: boolean): void
  }
  ensureSessionAckTimeout(): void
  refreshInstructions(reason: string): Promise<void>
  getActiveChannel(): RTCDataChannel | null
  isActiveChannelOpen(): boolean
  emit(event: ConversationEvent): void
  markSessionReady(trigger: string): void
}

export function handleSessionEvent(type: string, payload: unknown, deps: SessionEventDependencies): boolean {
  if (type === 'session.created') {
    deps.logDebug('[ConversationController] 🎯 session.created received, enabling transcription')
    deps.stateManager.setAwaitingSessionAck(true)
    deps.stateManager.setSessionReady(false)
    deps.ensureSessionAckTimeout()
    deps.refreshInstructions('session.created').catch(() => {})

    const activeChannel = deps.getActiveChannel()
    if (deps.isActiveChannelOpen() && activeChannel) {
      try {
        const updateMsg = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
          },
        }
        deps.logDebug('[ConversationController] 📤 Sending session.update:', updateMsg)
        activeChannel.send(JSON.stringify(updateMsg))
        deps.logDebug('[ConversationController] ✅ session.update sent successfully')
      } catch (err) {
        console.error('[ConversationController] ❌ FAILED to send session.update:', err)
      }
    } else {
      console.warn('[ConversationController] ⚠️ Cannot send session.update - channel not ready:', {
        hasChannel: Boolean(activeChannel),
        readyState: activeChannel?.readyState,
      })
    }

    return true
  }

  if (type === 'session.updated') {
    const data =
      typeof payload === 'object' && payload !== null ? (payload as { session?: Record<string, unknown> }) : {}

    deps.logDebug('[ConversationController] 🎉 session.updated received from server:', data)
    deps.markSessionReady('session.updated')

    const transcriptionConfig = data.session?.input_audio_transcription
    if (transcriptionConfig) {
      deps.logDebug('[ConversationController] ✅ Transcription confirmed enabled:', transcriptionConfig)
      if (!deps.stateManager.isFullyReady()) {
        deps.stateManager.setFullyReady(true)
        deps.emit({ type: 'connection-progress', step: 'complete', progress: 100 })
        deps.emit({ type: 'voice-ready' })
      }
    } else {
      console.warn('[ConversationController] ⚠️ Transcription NOT in session config:', data.session)
    }

    return true
  }

  // session.failed: handle session establishment failures
  if (type === 'session.failed') {
    const errorData = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
    const rawError = errorData.error || errorData.message
    const errorMsg = typeof rawError === 'string' ? rawError : 'Session failed to establish'
    deps.logDebug('[ConversationController] ❌ session.failed received:', errorMsg)

    // Clear acknowledgment timeout if running
    deps.stateManager.setAwaitingSessionAck(false)
    deps.stateManager.setSessionReady(false)
    deps.stateManager.setFullyReady(false)

    // Log error via console (connection-error event type doesn't exist in current schema)
    console.error('[sessionEvents] Session failed:', errorMsg)

    return true
  }

  // session.expired: session timed out or was terminated
  if (type === 'session.expired') {
    deps.logDebug('[ConversationController] ⏰ session.expired received - session terminated')

    deps.stateManager.setSessionReady(false)
    deps.stateManager.setFullyReady(false)

    // Log via console (session-expired event type doesn't exist in current schema)
    console.warn('[sessionEvents] Session expired')

    return true
  }

  return false
}
