import type {
  ConversationListener,
  ConversationDebugListener,
  VoiceStatus,
  MediaReference,
} from '../types'

/**
 * Dependencies required by PublicAPI
 * 
 * This interface defines all external dependencies that PublicAPI needs to function.
 * By using dependency injection, we achieve:
 * - **Testability:** Can mock dependencies in unit tests
 * - **Flexibility:** Can swap implementations without changing PublicAPI
 * - **Clarity:** Explicit declaration of all dependencies
 */
export interface PublicAPIDependencies {
  // Voice control
  startVoice: () => Promise<void>
  stopVoice: () => void
  
  // Text messaging
  sendText: (text: string) => Promise<void>
  
  // Session management
  dispose: () => void
  
  // Listener management
  addListener: (listener: ConversationListener) => () => void
  addDebugListener: (listener: ConversationDebugListener) => () => void
  setRealtimeEventListener: (listener: ((payload: unknown) => void) | null) => void
  
  // Configuration setters
  setPersonaId: (personaId: string | null) => void
  setScenarioId: (scenarioId: string | null) => void
  setExternalSessionId: (sessionId: string | null) => void
  setScenarioMedia: (media: MediaReference[]) => void
  
  // Voice/model settings
  setVoiceOverride: (voice: string | null) => void
  setInputLanguage: (language: string) => void
  setReplyLanguage: (language: string) => void
  setModel: (model: string | null) => void
  setTranscriptionModel: (model: string | null) => void
  
  // Microphone control
  isMicPaused: () => boolean
  setMicPaused: (paused: boolean) => void
  
  // State getters
  getSessionId: () => string | null
  getStatus: () => VoiceStatus
  getMicStream: () => MediaStream | null
  getPeerConnection: () => RTCPeerConnection | null
  getRemoteAudioElement: () => HTMLAudioElement | null
  getAdaptiveSnapshot: () => {
    enabled: boolean
    status: 'quiet' | 'noisy' | 'very-noisy'
    noise: number
    snr: number
    threshold: number | null
    silenceMs: number | null
  }
  
  // Audio element management
  attachRemoteAudioElement: (element: HTMLAudioElement | null) => void
  
  // Encounter state management
  getEncounterState: () => { phase: string | null; gate: Record<string, unknown> | null; outstandingGate: string[] }
  updateEncounterState: (state: { phase?: string | null; gate?: Record<string, unknown> | null }, reason?: string) => void
  
  // Instruction management
  refreshInstructions: (reason?: string, options?: any) => Promise<void>
  
  // Debugging
  setDebugMode: (enabled: boolean) => void
}

/**
 * PublicAPI - Facade for ConversationController public methods
 * 
 * This class provides a clean, documented public API for the ConversationController.
 * It acts as a facade that delegates all operations to the underlying controller implementation.
 * 
 * **Responsibilities:**
 * - Provide clear, well-documented public interface
 * - Delegate all operations to controller methods
 * - Maintain backward compatibility
 * - Group related methods into logical categories
 * 
 * **Key Features:**
 * - ✅ **Voice Control:** Start/stop voice conversations
 * - ✅ **Messaging:** Send text messages to assistant
 * - ✅ **Listener Management:** Subscribe to conversation events
 * - ✅ **Configuration:** Set persona, scenario, voice settings
 * - ✅ **State Access:** Get session ID, status, streams, connections
 * - ✅ **Microphone Control:** Pause/resume microphone
 * - ✅ **Audio Management:** Attach/detach remote audio elements
 * - ✅ **Encounter State:** Manage simulation phase and gates
 * - ✅ **Instructions:** Refresh AI instructions dynamically
 * - ✅ **Debugging:** Enable debug logging and adaptive snapshots
 * 
 * **Architecture:**
 * ```
 * UI Components
 *     ↓
 * PublicAPI (facade)
 *     ↓
 * ConversationController (orchestration)
 *     ↓
 * Specialized Modules (handlers, managers, integration)
 * ```
 * 
 * **Usage Example:**
 * ```typescript
 * const api = new PublicAPI({
 *   startVoice: () => controller.startVoice(),
 *   stopVoice: () => controller.stopVoice(),
 *   // ... other dependencies
 * })
 * 
 * // Voice control
 * await api.startVoice()
 * api.stopVoice()
 * 
 * // Messaging
 * await api.sendText('Hello, assistant!')
 * 
 * // Listeners
 * const unsubscribe = api.addListener(event => {
 *   console.log('Event:', event)
 * })
 * 
 * // Configuration
 * api.setPersonaId('persona_123')
 * api.setScenarioId('scenario_456')
 * 
 * // State access
 * const sessionId = api.getSessionId()
 * const status = api.getStatus()
 * ```
 * 
 * **Why This Exists:**
 * - **Separation of Concerns:** Public API separate from internal implementation
 * - **Easier Refactoring:** Can change internals without breaking public API
 * - **Better Documentation:** Single place for all public method docs
 * - **Type Safety:** Explicit interface for external consumers
 */
export class PublicAPI {
  constructor(private readonly deps: PublicAPIDependencies) {}

  // ============================================================================
  // VOICE CONTROL
  // ============================================================================

  /**
   * Start a voice conversation
   * 
   * Initializes WebRTC connection, establishes data channels, and begins voice communication.
   * Requires persona and scenario to be set first.
   * 
   * @throws {Error} 'select_persona' if persona not set
   * @throws {Error} 'select_scenario' if scenario not set (SPS mode only)
   * @throws {Error} 'dc_not_ready' if connection fails
   * 
   * @example
   * ```typescript
   * api.setPersonaId('persona_123')
   * api.setScenarioId('scenario_456')
   * await api.startVoice()
   * ```
   */
  async startVoice(): Promise<void> {
    return this.deps.startVoice()
  }

  /**
   * Stop the voice conversation
   * 
   * Closes WebRTC connection, cleans up streams, and resets state.
   * Safe to call even if not connected.
   * 
   * @example
   * ```typescript
   * api.stopVoice()
   * ```
   */
  stopVoice(): void {
    this.deps.stopVoice()
  }

  // ============================================================================
  // MESSAGING
  // ============================================================================

  /**
   * Send a text message to the assistant
   * 
   * Sends text input through the data channel. Triggers assistant response.
   * 
   * @param text - The message to send
   * @throws {Error} 'dc_not_ready' if data channel not open
   * 
   * @example
   * ```typescript
   * await api.sendText('Tell me about this patient')
   * ```
   */
  async sendText(text: string): Promise<void> {
    return this.deps.sendText(text)
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Dispose of all resources
   * 
   * Stops voice connection, cleans up listeners, and releases all resources.
   * Should be called when unmounting component or destroying controller.
   * 
   * @example
   * ```typescript
   * // In React cleanup
   * useEffect(() => {
   *   return () => api.dispose()
   * }, [])
   * ```
   */
  dispose(): void {
    this.deps.dispose()
  }

  // ============================================================================
  // LISTENER MANAGEMENT
  // ============================================================================

  /**
   * Add a listener for conversation events
   * 
   * Listener receives all conversation events (status changes, transcripts, etc.).
   * Returns an unsubscribe function to remove the listener.
   * 
   * **Event Types:**
   * - `status` - Connection status changes
   * - `session` - Session ID updates
   * - `partial` - Partial transcript updates
   * - `final` - Final transcript text
   * - `mic-level` - Microphone level updates
   * 
   * @param listener - Function to receive events
   * @returns Unsubscribe function
   * 
   * @example
   * ```typescript
   * const unsubscribe = api.addListener(event => {
   *   if (event.type === 'status') {
   *     console.log('Status:', event.status)
   *   } else if (event.type === 'final') {
   *     console.log('Final transcript:', event.role, event.text)
   *   }
   * })
   * 
   * // Later: remove listener
   * unsubscribe()
   * ```
   */
  addListener(listener: ConversationListener): () => void {
    return this.deps.addListener(listener)
  }

  /**
   * Add a debug listener for low-level events
   * 
   * Debug listeners receive internal diagnostic events. Useful for monitoring,
   * logging, and troubleshooting.
   * 
   * @param listener - Function to receive debug events
   * @returns Unsubscribe function
   * 
   * @example
   * ```typescript
   * const unsubscribe = api.addDebugListener(event => {
   *   console.log('[DEBUG]', event.kind, event.src, event.msg, event.data)
   * })
   * ```
   */
  addDebugListener(listener: ConversationDebugListener): () => void {
    return this.deps.addDebugListener(listener)
  }

  /**
   * Set a listener for raw OpenAI Realtime events
   * 
   * Receives raw event payloads from OpenAI Realtime API.
   * Useful for advanced debugging or custom event handling.
   * 
   * @param listener - Function to receive raw events, or null to remove
   * 
   * @example
   * ```typescript
   * api.setRealtimeEventListener(payload => {
   *   console.log('Raw OpenAI event:', payload)
   * })
   * 
   * // Remove listener
   * api.setRealtimeEventListener(null)
   * ```
   */
  setRealtimeEventListener(listener: ((payload: unknown) => void) | null): void {
    this.deps.setRealtimeEventListener(listener)
  }

  // ============================================================================
  // CONFIGURATION SETTERS
  // ============================================================================

  /**
   * Set the persona ID
   * 
   * Changes the AI personality/role. Clears session and resets transcripts.
   * 
   * @param personaId - Persona ID or null to clear
   * 
   * @example
   * ```typescript
   * api.setPersonaId('persona_123')
   * ```
   */
  setPersonaId(personaId: string | null): void {
    this.deps.setPersonaId(personaId)
  }

  /**
   * Set the scenario ID
   * 
   * Changes the simulation scenario. Clears session and resets transcripts.
   * 
   * @param scenarioId - Scenario ID or null to clear
   * 
   * @example
   * ```typescript
   * api.setScenarioId('scenario_456')
   * ```
   */
  setScenarioId(scenarioId: string | null): void {
    this.deps.setScenarioId(scenarioId)
  }

  /**
   * Set an external session ID
   * 
   * Use an existing session instead of creating a new one.
   * Useful for joining ongoing conversations.
   * 
   * @param sessionId - External session ID or null to clear
   * 
   * @example
   * ```typescript
   * api.setExternalSessionId('session_789')
   * ```
   */
  setExternalSessionId(sessionId: string | null): void {
    this.deps.setExternalSessionId(sessionId)
  }

  /**
   * Set scenario media references
   * 
   * Provides media context (images, videos, documents) to the assistant.
   * 
   * @param media - Array of media references
   * 
   * @example
   * ```typescript
   * api.setScenarioMedia([
   *   { type: 'image', url: 'https://...', description: 'X-ray' }
   * ])
   * ```
   */
  setScenarioMedia(media: MediaReference[]): void {
    this.deps.setScenarioMedia(media)
  }

  /**
   * Set voice override
   * 
   * Override the default voice for the assistant.
   * 
   * @param voice - Voice ID or null for default
   * 
   * @example
   * ```typescript
   * api.setVoiceOverride('alloy')
   * ```
   */
  setVoiceOverride(voice: string | null): void {
    this.deps.setVoiceOverride(voice)
  }

  /**
   * Set input language
   * 
   * Language for speech recognition.
   * 
   * @param language - Language code (e.g., 'en', 'es') or 'auto'
   * 
   * @example
   * ```typescript
   * api.setInputLanguage('en')
   * ```
   */
  setInputLanguage(language: string): void {
    this.deps.setInputLanguage(language)
  }

  /**
   * Set reply language
   * 
   * Language for assistant responses.
   * 
   * @param language - Language code or 'default'
   * 
   * @example
   * ```typescript
   * api.setReplyLanguage('en')
   * ```
   */
  setReplyLanguage(language: string): void {
    this.deps.setReplyLanguage(language)
  }

  /**
   * Set AI model
   * 
   * Override the default AI model.
   * 
   * @param model - Model name or null for default
   * 
   * @example
   * ```typescript
   * api.setModel('gpt-4o-realtime-preview-2024-12-17')
   * ```
   */
  setModel(model: string | null): void {
    this.deps.setModel(model)
  }

  /**
   * Set transcription model
   * 
   * Override the default speech recognition model.
   * 
   * @param model - Model name or null for default
   * 
   * @example
   * ```typescript
   * api.setTranscriptionModel('whisper-1')
   * ```
   */
  setTranscriptionModel(model: string | null): void {
    this.deps.setTranscriptionModel(model)
  }

  // ============================================================================
  // MICROPHONE CONTROL
  // ============================================================================

  /**
   * Check if microphone is paused
   * 
   * @returns True if microphone is paused (user or auto-pause)
   * 
   * @example
   * ```typescript
   * const paused = api.isMicPaused()
   * ```
   */
  isMicPaused(): boolean {
    return this.deps.isMicPaused()
  }

  /**
   * Pause or resume microphone
   * 
   * @param paused - True to pause, false to resume
   * 
   * @example
   * ```typescript
   * api.setMicPaused(true)  // Mute mic
   * api.setMicPaused(false) // Unmute mic
   * ```
   */
  setMicPaused(paused: boolean): void {
    this.deps.setMicPaused(paused)
  }

  // ============================================================================
  // STATE GETTERS
  // ============================================================================

  /**
   * Get current session ID
   * 
   * @returns Session ID or null if no session
   * 
   * @example
   * ```typescript
   * const sessionId = api.getSessionId()
   * ```
   */
  getSessionId(): string | null {
    return this.deps.getSessionId()
  }

  /**
   * Get current connection status
   * 
   * **Possible Values:**
   * - `'idle'` - Not connected
   * - `'connecting'` - Establishing connection
   * - `'connected'` - Connected and ready
   * - `'error'` - Connection failed
   * 
   * @returns Current status
   * 
   * @example
   * ```typescript
   * const status = api.getStatus()
   * if (status === 'connected') {
   *   // Ready for conversation
   * }
   * ```
   */
  getStatus(): VoiceStatus {
    return this.deps.getStatus()
  }

  /**
   * Get microphone MediaStream
   * 
   * @returns Microphone stream or null if not started
   * 
   * @example
   * ```typescript
   * const stream = api.getMicStream()
   * if (stream) {
   *   // Attach to audio visualizer
   * }
   * ```
   */
  getMicStream(): MediaStream | null {
    return this.deps.getMicStream()
  }

  /**
   * Get WebRTC peer connection
   * 
   * @returns RTCPeerConnection or null if not connected
   * 
   * @example
   * ```typescript
   * const pc = api.getPeerConnection()
   * if (pc) {
   *   console.log('Connection state:', pc.connectionState)
   * }
   * ```
   */
  getPeerConnection(): RTCPeerConnection | null {
    return this.deps.getPeerConnection()
  }

  /**
   * Get remote audio element
   * 
   * @returns HTMLAudioElement or null if not attached
   * 
   * @example
   * ```typescript
   * const audio = api.getRemoteAudioElement()
   * ```
   */
  getRemoteAudioElement(): HTMLAudioElement | null {
    return this.deps.getRemoteAudioElement()
  }

  /**
   * Get adaptive VAD snapshot
   * 
   * Returns current state of adaptive Voice Activity Detection.
   * 
   * @returns Adaptive VAD snapshot
   * 
   * @example
   * ```typescript
   * const snapshot = api.getAdaptiveSnapshot()
   * console.log('Noise level:', snapshot.noise)
   * console.log('SNR:', snapshot.snr)
   * console.log('Status:', snapshot.status) // 'quiet', 'noisy', 'very-noisy'
   * ```
   */
  getAdaptiveSnapshot(): {
    enabled: boolean
    status: 'quiet' | 'noisy' | 'very-noisy'
    noise: number
    snr: number
    threshold: number | null
    silenceMs: number | null
  } {
    return this.deps.getAdaptiveSnapshot()
  }

  // ============================================================================
  // AUDIO ELEMENT MANAGEMENT
  // ============================================================================

  /**
   * Attach remote audio element
   * 
   * Connects assistant voice output to an HTMLAudioElement for playback.
   * 
   * @param element - HTMLAudioElement or null to detach
   * 
   * @example
   * ```typescript
   * const audioEl = document.createElement('audio')
   * audioEl.autoplay = true
   * api.attachRemoteAudioElement(audioEl)
   * ```
   */
  attachRemoteAudioElement(element: HTMLAudioElement | null): void {
    this.deps.attachRemoteAudioElement(element)
  }

  // ============================================================================
  // ENCOUNTER STATE MANAGEMENT
  // ============================================================================

  /**
   * Get current encounter state
   * 
   * Returns simulation phase and gate status.
   * 
   * @returns Encounter state
   * 
   * @example
   * ```typescript
   * const state = api.getEncounterState()
   * console.log('Phase:', state.phase)
   * console.log('Gates:', state.gate)
   * console.log('Outstanding:', state.outstandingGate)
   * ```
   */
  getEncounterState(): { phase: string | null; gate: Record<string, unknown> | null; outstandingGate: string[] } {
    return this.deps.getEncounterState()
  }

  /**
   * Update encounter state
   * 
   * Changes simulation phase or gate status. Triggers instruction refresh.
   * 
   * @param state - New state values
   * @param reason - Reason for update (for logging)
   * 
   * @example
   * ```typescript
   * api.updateEncounterState({ phase: 'assessment' })
   * api.updateEncounterState({ gate: { vitals: true } })
   * ```
   */
  updateEncounterState(
    state: { phase?: string | null; gate?: Record<string, unknown> | null },
    reason = 'state.update'
  ): void {
    this.deps.updateEncounterState(state, reason)
  }

  // ============================================================================
  // INSTRUCTION MANAGEMENT
  // ============================================================================

  /**
   * Refresh AI instructions
   * 
   * Re-sends instructions to OpenAI. Useful when persona, scenario, or
   * encounter state changes.
   * 
   * @param reason - Reason for refresh (for logging)
   * @param options - Refresh options
   * 
   * @example
   * ```typescript
   * await api.refreshInstructions('persona-changed')
   * ```
   */
  async refreshInstructions(reason = 'manual', options?: any): Promise<void> {
    return this.deps.refreshInstructions(reason, options)
  }

  // ============================================================================
  // DEBUGGING
  // ============================================================================

  /**
   * Enable or disable debug mode
   * 
   * When enabled, emits detailed debug events and starts mic level metering.
   * 
   * @param enabled - True to enable debug mode
   * 
   * @example
   * ```typescript
   * api.setDebugMode(true)
   * ```
   */
  setDebugMode(enabled: boolean): void {
    this.deps.setDebugMode(enabled)
  }
}
