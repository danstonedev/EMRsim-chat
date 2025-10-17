import { api } from '../api'
import type { BackendSocketClient } from '../services/BackendSocketManager'
import { voiceDebug, voiceWarn } from '../utils/voiceLogging'
import type { TranscriptTimings } from '../../features/voice/conversation/types/transcript'

/**
 * Dependencies required by BackendIntegration.
 */
export interface BackendIntegrationDependencies {
  socketManager: BackendSocketClient
  getSessionId: () => string | null
  isBackendMode: () => boolean
  logDebug: (...args: unknown[]) => void
}

/**
 * BackendIntegration
 *
 * Handles backend socket initialization and transcript relay for the ConversationController.
 * This module centralizes all backend communication logic, making it easier to test,
 * maintain, and understand the backend integration layer.
 *
 * **Responsibilities:**
 * - Initialize backend WebSocket connection with session ID
 * - Relay transcript events from OpenAI to backend for broadcast
 * - Validate backend mode and session state before operations
 * - Log backend communication for debugging and monitoring
 *
 * **Key Features:**
 * - ✅ **Session Management:** Initializes socket with correct session ID
 * - ✅ **Transcript Relay:** Forwards user and assistant transcripts to backend
 * - ✅ **Mode Validation:** Checks if backend mode is enabled before operations
 * - ✅ **Error Handling:** Catches and logs relay failures
 * - ✅ **Debug Logging:** Comprehensive logging for backend operations
 *
 * **Backend Architecture:**
 * ```
 * OpenAI Realtime API
 *     ↓ (transcript events)
 * ConversationController
 *     ↓ (relay via BackendIntegration)
 * Backend REST API (/api/transcript/relay/:sessionId)
 *     ↓ (broadcast via WebSocket)
 * Backend WebSocket Server
 *     ↓ (emit to all clients)
 * Connected Clients (Observers, Instructors, etc.)
 * ```
 *
 * **Usage Example:**
 * ```typescript
 * const backendIntegration = new BackendIntegration({
 *   socketManager: this.socketManager,
 *   getSessionId: () => this.sessionId,
 *   isBackendMode: () => this.backendTranscriptMode,
 *   logDebug: (...args) => this.logDebug(...args),
 * })
 *
 * // Initialize backend socket connection
 * backendIntegration.initializeBackendSocket(sessionId)
 *
 * // Relay transcript to backend
 * await backendIntegration.relayTranscriptToBackend(
 *   'user',
 *   'Hello, how are you?',
 *   true,
 *   Date.now(),
 *   { startedAtMs: 1000, finalizedAtMs: 2000, emittedAtMs: 2000 },
 *   'item_12345'
 * )
 * ```
 *
 * **Backend Mode:**
 * Backend mode is controlled by `backendTranscriptMode` configuration flag.
 * When enabled:
 * - Transcripts are relayed to backend via REST API
 * - Backend broadcasts transcripts to all connected WebSocket clients
 * - Enables real-time transcript monitoring for instructors/observers
 *
 * When disabled:
 * - Transcripts remain local to the conversation
 * - No backend communication occurs
 * - Socket initialization is skipped
 *
 * @see ConversationController - Main orchestrator that uses this integration
 * @see BackendSocketManager - Manages WebSocket connection to backend
 * @see api.relayTranscript - REST API method for relaying transcripts
 */
export class BackendIntegration {
  constructor(private readonly deps: BackendIntegrationDependencies) {}

  /**
   * Initialize backend WebSocket connection with session ID.
   *
   * This method establishes a WebSocket connection to the backend server for the given
   * session. The backend uses this connection to broadcast transcript events to all
   * connected clients (observers, instructors, etc.).
   *
   * **When to call:**
   * - After creating a new session (session.created event)
   * - After establishing WebRTC connection
   * - Before sending the first transcript
   *
   * **Backend mode check:**
   * If backend mode is disabled (`backendTranscriptMode: false`), this method does nothing.
   * This allows the same code to work in both backend-enabled and local-only modes.
   *
   * **Socket lifecycle:**
   * 1. Check if backend mode is enabled
   * 2. Call `socketManager.connect(sessionId)`
   * 3. BackendSocketManager establishes WebSocket connection
   * 4. Socket emits 'connect' event when ready
   * 5. Backend starts listening for transcript relay requests
   *
   * @param sessionId - OpenAI Realtime session ID (used for WebSocket room identification)
   */
  initializeBackendSocket(sessionId: string): void {
    voiceDebug('🔌 [BackendIntegration] initializeBackendSocket called:', {
      sessionId,
      isEnabled: this.deps.socketManager.isEnabled(),
      backendMode: this.deps.isBackendMode(),
    })

    if (!this.deps.socketManager.isEnabled()) {
      voiceDebug('[BackendIntegration] Backend transcript mode disabled, skipping socket init')
      return
    }

    this.deps.socketManager.connect(sessionId)
  }

  /**
   * Relay transcript event from OpenAI to backend for broadcast.
   *
   * This method sends transcript data to the backend REST API, which then broadcasts
   * it to all connected WebSocket clients. This enables real-time transcript monitoring
   * for observers, instructors, and other stakeholders.
   *
   * **Flow:**
   * ```
   * 1. OpenAI emits transcript event (transcription.delta, transcription.done, etc.)
   * 2. ConversationController processes event
   * 3. BackendIntegration.relayTranscriptToBackend() called
   * 4. POST /api/transcript/relay/:sessionId with transcript data
   * 5. Backend broadcasts transcript via WebSocket to all clients in session room
   * 6. Connected clients receive transcript update in real-time
   * ```
   *
   * **Validation:**
   * - Session ID must exist (cannot relay without session)
   * - Backend mode should be enabled (skipped if disabled)
   *
   * **Error Handling:**
   * - Logs detailed error information (message, stack, session ID)
   * - Throws error to allow caller to handle relay failures
   * - Does not retry automatically (caller can implement retry logic)
   *
   * **Timings:**
   * - `startedAtMs`: When user/assistant started speaking (VAD detect)
   * - `finalizedAtMs`: When transcript was finalized (transcription.done)
   * - `emittedAtMs`: When transcript was emitted to UI (may differ from finalized)
   *
   * @param role - 'user' or 'assistant' (who spoke)
   * @param text - Transcript text content
   * @param isFinal - Whether this is a final transcript (vs. partial/interim)
   * @param timestamp - Event timestamp (milliseconds since epoch)
   * @param timings - Optional timing information (started, finalized, emitted)
   * @param itemId - Optional OpenAI conversation item ID
   * @throws Error if relay fails (network error, backend error, etc.)
   */
  async relayTranscriptToBackend(
    role: 'user' | 'assistant',
    text: string,
    isFinal: boolean,
    timestamp: number,
    timings?: TranscriptTimings,
    itemId?: string
  ): Promise<void> {
    const sessionId = this.deps.getSessionId()

    if (!sessionId) {
      voiceWarn('[BackendIntegration] ❌ Cannot relay - no sessionId!')
      return
    }

    this.deps.logDebug('[BackendIntegration] 📤 Relaying transcript to backend:', {
      sessionId: sessionId.slice(-6),
      fullSessionId: sessionId,
      role,
      isFinal,
      textLength: text.length,
      preview: text.slice(0, 50),
      itemId: itemId?.slice(-8),
      url: `http://localhost:3002/api/transcript/relay/${sessionId}`,
      timings,
    })

    try {
      const result = await api.relayTranscript(sessionId, {
        role,
        text,
        isFinal,
        timestamp,
        startedAt: timings?.startedAtMs ?? undefined,
        finalizedAt: timings?.finalizedAtMs ?? (isFinal ? timestamp : undefined),
        emittedAt: timings?.emittedAtMs ?? timestamp,
        itemId,
      })
      this.deps.logDebug('[BackendIntegration] ✅ Relay successful:', result)
    } catch (error) {
      console.error('[BackendIntegration] ❌ Relay failed:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        sessionId,
      })
      throw error
    }
  }
}
