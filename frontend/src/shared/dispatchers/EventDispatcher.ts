import type { VoiceDebugEvent } from '../types'
import { classifyEvent } from '../../features/voice/conversation/events/eventClassifier'
import { handleSessionEvent } from '../../features/voice/conversation/events/sessionEvents'
import type { ConversationEventEmitter } from '../services/ConversationEventEmitter'
import type { ConversationStateManager } from '../services/ConversationStateManager'
import type { WebRTCConnectionManager } from '../services/WebRTCConnectionManager'
import type { SpeechEventHandlers } from '../../features/voice/conversation/events/speechEvents'
import type { TranscriptionEventHandlers } from '../../features/voice/conversation/events/transcriptionEvents'
import type { AssistantStreamHandlers } from '../../features/voice/conversation/events/assistantEvents'
import type { ConversationItemHandlers } from '../../features/voice/conversation/events/conversationItemEvents'
import { voiceWarn } from '../utils/voiceLogging'

/**
 * Dependencies required by EventDispatcher for message routing and event handling
 */
export interface EventDispatcherDependencies {
  // Event handler families
  speechHandlers: SpeechEventHandlers
  transcriptionHandlers: TranscriptionEventHandlers
  assistantHandlers: AssistantStreamHandlers
  conversationItemHandlers: ConversationItemHandlers

  // Session event dependencies (passed to handleSessionEvent)
  sessionHandlers: {
    logDebug: (...args: unknown[]) => void
    stateManager: ConversationStateManager
    ensureSessionAckTimeout: () => void
    refreshInstructions: (reason: string) => Promise<void>
    getActiveChannel: () => RTCDataChannel | null
    isActiveChannelOpen: () => boolean
    markSessionReady: (trigger: string) => void
  }

  // Event emission and logging
  eventEmitter: ConversationEventEmitter
  webrtcManager: WebRTCConnectionManager
  debugEnabled: boolean
  onRealtimeEvent: ((payload: unknown) => void) | null
}

/**
 * EventDispatcher - Handles incoming WebRTC data channel messages
 *
 * Responsibilities:
 * - Parse incoming JSON messages from WebRTC data channel
 * - Classify events by family (session, speech, transcription, assistant, conversation-item)
 * - Route events to appropriate handler families
 * - Emit debug events for all messages (success and errors)
 * - Log unhandled event types for investigation
 *
 * Benefits of extraction:
 * - Isolates message routing logic from ConversationController
 * - Easier to test event classification and routing
 * - Clear separation of concerns (parsing vs handling)
 * - Reduces ConversationController complexity by ~100 lines
 *
 * Example usage:
 * ```typescript
 * const dispatcher = new EventDispatcher({
 *   speechHandlers,
 *   transcriptionHandlers,
 *   assistantHandlers,
 *   conversationItemHandlers,
 *   sessionHandlers: {
 *     logDebug: (...args) => console.log(...args),
 *     stateManager,
 *     // ... other session handler dependencies
 *   },
 *   eventEmitter,
 *   webrtcManager,
 *   debugEnabled: true,
 *   onRealtimeEvent: (payload) => console.log(payload),
 * })
 *
 * // Handle incoming data channel message
 * dispatcher.handleMessage(rawJsonString)
 * ```
 */
export class EventDispatcher {
  constructor(private readonly deps: EventDispatcherDependencies) {}

  /**
   * Parse and route incoming WebRTC data channel message
   *
   * Flow:
   * 1. Parse JSON payload
   * 2. Extract event type
   * 3. Emit debug event (with error detection)
   * 4. Classify event by family
   * 5. Route to appropriate handler
   * 6. Log unhandled events
   *
   * @param raw - Raw JSON string from data channel
   */
  handleMessage(raw: string): void {
    try {
      const payload = JSON.parse(raw)

      // Allow external listener to observe all realtime events
      this.deps.onRealtimeEvent?.(payload)

      const type: string = (payload?.type || '').toLowerCase()

      // Emit debug event with error detection
      this.emitDebugEvent(type, payload)

      // Classify event and route to handler
      this.routeEvent(type, payload)
    } catch (err) {
      voiceWarn('EventDispatcher failed to parse payload', err)
    }
  }

  /**
   * Emit debug event for incoming message
   * Detects errors/warnings and marks event kind accordingly
   *
   * @param type - Event type (e.g., 'session.created', 'error')
   * @param payload - Full event payload
   */
  private emitDebugEvent(type: string, payload: unknown): void {
    const hasProblem = type.includes('error') || type.includes('warning')

    // Extract error/warning details if present
    const brief = hasProblem
      ? ((payload as any)?.error &&
          ((payload as any)?.error?.message ||
            (payload as any)?.error?.code ||
            (payload as any)?.error?.type)) ||
        (payload as any)?.message ||
        (payload as any)?.reason ||
        ''
      : ''

    const msg = hasProblem && brief ? `${type}: ${String(brief)}` : type

    const ev: VoiceDebugEvent = this.deps.debugEnabled
      ? { t: new Date().toISOString(), kind: hasProblem ? 'error' : 'event', src: 'dc', msg, data: payload }
      : { t: new Date().toISOString(), kind: hasProblem ? 'error' : 'event', src: 'dc', msg }

    this.deps.eventEmitter.emitDebug(ev)
  }

  /**
   * Route event to appropriate handler family based on classification
   *
   * Event families:
   * - session: Session lifecycle events (created, updated)
   * - speech: User speech events (started, stopped)
   * - transcription: Transcription events (partial, final)
   * - assistant: Assistant response events (streaming, done)
   * - conversation-item: Conversation item events (created, truncated)
   * - error: Error events (logged, not handled)
   * - unknown: Unhandled event types (logged for investigation)
   *
   * @param type - Event type string
   * @param payload - Event payload
   */
  private routeEvent(type: string, payload: unknown): void {
    const classified = classifyEvent(type, payload)

    switch (classified.family) {
      case 'session': {
        const handled = this.handleSessionEvent(type, payload)
        if (handled) return
        break
      }

      case 'speech': {
        const handled = this.deps.speechHandlers.handleSpeechEvent(type, payload)
        if (handled) return
        break
      }

      case 'transcription': {
        const handled = this.deps.transcriptionHandlers.handleTranscriptionEvent(type, payload)
        if (handled) return
        break
      }

      case 'assistant': {
        const handled = this.deps.assistantHandlers.handleAssistantEvent(type, payload)
        if (handled) return
        break
      }

      case 'conversation-item': {
        const handled = this.deps.conversationItemHandlers.handleConversationItemEvent(type, payload)
        if (handled) return
        break
      }

      case 'error':
        // Already logged above via emitDebugEvent
        return

      case 'unknown':
        // Log unhandled event types for future investigation
        this.deps.sessionHandlers.logDebug('[EventDispatcher] Unhandled event type:', type)
        return
    }
  }

  /**
   * Handle session events by delegating to session event handler
   *
   * Session events include:
   * - session.created
   * - session.updated
   * - input_audio_buffer.committed
   * - input_audio_buffer.speech_started
   * - input_audio_buffer.speech_stopped
   *
   * @param type - Event type
   * @param payload - Event payload
   * @returns true if event was handled
   */
  private handleSessionEvent(type: string, payload: unknown): boolean {
    return handleSessionEvent(type, payload, {
      logDebug: this.deps.sessionHandlers.logDebug,
      stateManager: this.deps.sessionHandlers.stateManager,
      ensureSessionAckTimeout: this.deps.sessionHandlers.ensureSessionAckTimeout,
      refreshInstructions: this.deps.sessionHandlers.refreshInstructions,
      getActiveChannel: this.deps.sessionHandlers.getActiveChannel,
      isActiveChannelOpen: this.deps.sessionHandlers.isActiveChannelOpen,
      emit: event => this.deps.eventEmitter.emit(event),
      markSessionReady: this.deps.sessionHandlers.markSessionReady,
    })
  }
}
