import { io, Socket } from 'socket.io-client'
import { voiceDebug, voiceWarn } from '../utils/voiceLogging'

export interface TranscriptData {
  role: 'user' | 'assistant'
  text: string
  isFinal: boolean
  timestamp: number
  source?: string
  startedAtMs?: number | null
  finalizedAtMs?: number | null
  emittedAtMs?: number | null
  media?: any
}

export interface TranscriptErrorData {
  error: string
  timestamp: number
}

export interface CatchupData {
  transcripts: Array<{
    role: 'user' | 'assistant'
    text: string
    isFinal: boolean
    timestamp: number
    startedAtMs?: number | null
    finalizedAtMs?: number | null
    emittedAtMs?: number | null
  }>
}

export interface SocketEventHandlers {
  onConnect?: (sessionId: string) => void
  onDisconnect?: (reason: string) => void
  onTranscript?: (data: TranscriptData) => void
  onTranscriptError?: (data: TranscriptErrorData) => void
  onReconnect?: (lastTimestamp: number) => void
  onCatchup?: (data: CatchupData) => void
  onFailure?: (label: string, error: unknown, failureCount: number) => void
  onMaxFailures?: (failureCount: number) => void
}

export interface SocketConfig {
  apiBaseUrl: string
  maxFailures?: number
  enabled?: boolean
  transports?: ('websocket' | 'polling')[]
  reconnectionAttempts?: number
  reconnectionDelay?: number
  timeout?: number
  withCredentials?: boolean
}

export interface BackendSocketSnapshot {
  isConnected: boolean
  isEnabled: boolean
  failureCount: number
  lastReceivedTimestamp: number
  hasSocket: boolean
  currentSessionId: string | null
}

export interface BackendSocketClient {
  connect(sessionId: string): void
  disconnect(): void
  isEnabled(): boolean
  setEnabled?(enabled: boolean): void
  joinSession?(sessionId: string): void
  requestCatchup?(sessionId: string, since?: number): void
  resetFailureCount?(): void
  updateLastReceivedTimestamp?(timestamp: number): void
  getSnapshot?(): BackendSocketSnapshot
}

export type BackendSocketFactory = (options: {
  config: SocketConfig
  handlers: SocketEventHandlers
}) => BackendSocketClient

/**
 * Manages WebSocket connection to backend for unified transcript broadcast.
 * Handles connection lifecycle, event routing, reconnection logic, and failure tracking.
 * 
 * @deprecated **THIS CLASS IS DEPRECATED** - Do NOT use in new code!
 * 
 * **For React components:** Use the `useBackendSocket` hook instead:
 * ```typescript
 * import { useBackendSocket } from '../hooks/useBackendSocket';
 * 
 * const backendSocket = useBackendSocket({
 *   sessionId: currentSessionId,
 *   config: { apiBaseUrl: 'http://localhost:3002', maxFailures: 3 },
 *   handlers: {
 *     onTranscript: handleTranscript,
 *     onConnect: handleConnect,
 *     onDisconnect: handleDisconnect,
 *   },
 * });
 * 
 * // State is reactive - no polling needed!
 * if (backendSocket.isConnected) {
 *   backendSocket.joinSession(newSessionId);
 * }
 * ```
 * 
 * **Why migrate?**
 * - ✅ **Reactive state**: No polling with `useState` + `useEffect`
 * - ✅ **Automatic cleanup**: Hook handles lifecycle
 * - ✅ **Fresh handlers**: No stale closures
 * - ✅ **Easier testing**: Mock hooks instead of classes
 * - ✅ **Better integration**: Follows React patterns
 * 
 * **Migration guide:** See `REFACTORING_OPPORTUNITIES.md` for detailed migration steps
 * 
 * This class remains ONLY for backward compatibility with existing code (e.g., ConversationController's ServiceInitializer).
 * New code should use `useBackendSocket` hook.
 */
export class BackendSocketManager implements BackendSocketClient {
  private socket: Socket | null = null
  private failureCount = 0
  private lastReceivedTimestamp = 0
  private enabled: boolean
  private currentSessionId: string | null = null
  
  private readonly config: Required<SocketConfig>
  private readonly handlers: SocketEventHandlers

  constructor(config: SocketConfig, handlers: SocketEventHandlers = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl,
      maxFailures: config.maxFailures ?? 3,
      enabled: config.enabled ?? true,
      transports: config.transports ?? ['websocket', 'polling'],
      reconnectionAttempts: config.reconnectionAttempts ?? 5,
      reconnectionDelay: config.reconnectionDelay ?? 1000,
      timeout: config.timeout ?? 8000,
      withCredentials: config.withCredentials ?? true,
    }
    this.enabled = this.config.enabled
    this.handlers = handlers
  }

  /**
   * Get current connection state
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * Check if backend socket is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Set enabled state (used to disable after max failures)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled && this.socket) {
      this.disconnect()
    }
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failureCount
  }

  /**
   * Get last received transcript timestamp
   */
  getLastReceivedTimestamp(): number {
    return this.lastReceivedTimestamp
  }

  /**
   * Update last received timestamp (called when processing transcripts)
   */
  updateLastReceivedTimestamp(timestamp: number): void {
    this.lastReceivedTimestamp = Math.max(this.lastReceivedTimestamp, timestamp)
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }

  /**
   * Resolve backend socket endpoint from API base URL
   */
  private resolveEndpoint(): { origin: string; path: string } {
    const fallback = { origin: 'http://localhost:3002', path: '/socket.io/' }
    try {
      const url = new URL(this.config.apiBaseUrl)
      const origin = `${url.protocol}//${url.host}`

      // 1) Explicit override via env
      const socketPathEnv = (import.meta as any)?.env?.VITE_SOCKET_PATH as string | undefined
      if (socketPathEnv && typeof socketPathEnv === 'string') {
        let path = socketPathEnv.startsWith('/') ? socketPathEnv : `/${socketPathEnv}`
        if (!path.endsWith('/')) path = `${path}/`
        return { origin, path }
      }

      const trimmedPath = url.pathname.replace(/\/+$|^\/+/, '')
      // 2) If API base ends with /api, use root socket path
      if (trimmedPath && /(^|\/)api$/i.test(trimmedPath)) {
        if (import.meta.env.DEV) {
          voiceWarn("[BackendSocketManager] API base includes /api; using socket path '/socket.io/'. Set VITE_SOCKET_PATH to override if needed.", { apiBaseUrl: this.config.apiBaseUrl })
        }
        return { origin, path: '/socket.io/' }
      }

      // 3) Allow opting into nesting under base path
      const assumeUnderBase = String((import.meta as any)?.env?.VITE_ASSUME_SOCKET_UNDER_BASEPATH || '').toLowerCase()
      if (trimmedPath && (assumeUnderBase === '1' || assumeUnderBase === 'true' || assumeUnderBase === 'yes' || assumeUnderBase === 'on')) {
        const basePath = `/${trimmedPath}`
        let socketPath = `${basePath}/socket.io/`.replace(/\/{2,}/g, '/').replace(/\/+$/, '/')
        if (!socketPath.startsWith('/')) socketPath = `/${socketPath}`
        return { origin, path: socketPath }
      }

      // Default
      return { origin, path: '/socket.io/' }
    } catch (error) {
      voiceWarn('[BackendSocketManager] ⚠️ Failed to parse API_BASE_URL:', error)
      return fallback
    }
  }

  /**
   * Handle socket failure (connection error, reconnection error, etc.)
   */
  private handleFailure(label: string, error: unknown): void {
    this.failureCount += 1
    voiceWarn(`[BackendSocketManager] ❌ Socket ${label}:`, error, 'failureCount=', this.failureCount)

    this.handlers.onFailure?.(label, error, this.failureCount)

    if (this.failureCount >= this.config.maxFailures) {
      voiceWarn('[BackendSocketManager] 🔕 Disabling after repeated failures')
      this.enabled = false
      this.disconnect()
      this.handlers.onMaxFailures?.(this.failureCount)
    }
  }

  /**
   * Initialize and connect to backend socket
   */
  connect(sessionId: string): void {
    if (!this.enabled) {
      voiceDebug('[BackendSocketManager] Disabled, skipping connection')
      return
    }

    this.currentSessionId = sessionId

    // If already connected, just join the new session
    if (this.socket?.connected) {
  voiceDebug('[BackendSocketManager] Already connected, joining session:', sessionId)
      this.socket.emit('join-session', sessionId)
      this.handlers.onConnect?.(sessionId)
      return
    }

    // Check if we've hit max failures
    if (this.failureCount >= this.config.maxFailures) {
      voiceWarn('[BackendSocketManager] 🚫 Max failures reached, not connecting')
      this.enabled = false
      return
    }

    const { origin, path } = this.resolveEndpoint()
    if (import.meta.env.DEV) {
      voiceDebug('[BackendSocketManager] Connecting to:', { origin, path })
    }

    // Clean up existing socket
    if (this.socket) {
      try {
        this.socket.removeAllListeners()
        this.socket.disconnect()
      } catch (error) {
        console.debug('[BackendSocketManager] Ignored disconnect cleanup error', error)
      }
      this.socket = null
    }

    // Create new socket
    this.socket = io(origin, {
      path,
      transports: this.config.transports,
      reconnection: true,
      reconnectionAttempts: this.config.reconnectionAttempts,
      reconnectionDelay: this.config.reconnectionDelay,
      timeout: this.config.timeout,
      withCredentials: this.config.withCredentials,
    })

    // Setup event handlers
    this.setupEventHandlers(sessionId)
  }

  /**
   * Setup all socket event handlers
   */
  private setupEventHandlers(sessionId: string): void {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      if (import.meta.env.DEV) {
        voiceDebug('[BackendSocketManager] ✅ Connected, joining session:', sessionId)
      }
      this.failureCount = 0
      this.socket?.emit('join-session', sessionId)
      this.handlers.onConnect?.(sessionId)
    })

    this.socket.on('disconnect', (reason) => {
      if (import.meta.env.DEV) {
        voiceDebug('[BackendSocketManager] 🔌 Disconnected:', reason)
      }
      this.handlers.onDisconnect?.(reason)
    })

    // Transcript events
    this.socket.on('transcript', (data: TranscriptData) => {
      this.handlers.onTranscript?.(data)
    })

    this.socket.on('transcript-error', (data: TranscriptErrorData) => {
      voiceWarn('[BackendSocketManager] ❌ Transcript error:', data.error)
      this.handlers.onTranscriptError?.(data)
    })

    // Reconnection events
    this.socket.io.on('reconnect', () => {
      voiceDebug('[BackendSocketManager] 🔄 Reconnected, requesting catch-up')
      const lastTimestamp = this.lastReceivedTimestamp || Date.now() - 60000 // Last 1 min fallback
      this.socket?.emit('request-catchup', { sessionId, since: lastTimestamp })
      this.handlers.onReconnect?.(lastTimestamp)
    })

    // Catch-up events
    this.socket.on('catchup-transcripts', (data: CatchupData) => {
      voiceDebug('[BackendSocketManager] 📦 Received catch-up transcripts:', data.transcripts.length)
      this.handlers.onCatchup?.(data)
    })

    // Error events
    this.socket.on('connect_error', (error) => this.handleFailure('connect_error', error))
    this.socket.on('error', (error) => this.handleFailure('error', error))
    this.socket.io.on('reconnect_error', (error) => this.handleFailure('reconnect_error', error))
    this.socket.io.on('reconnect_failed', () => this.handleFailure('reconnect_failed', 'max retries exceeded'))
  }

  /**
   * Emit event to backend socket
   */
  emit(event: string, ...args: any[]): void {
    if (!this.socket?.connected) {
      voiceDebug('[BackendSocketManager] Cannot emit - not connected:', event)
      return
    }
    this.socket.emit(event, ...args)
  }

  /**
   * Join a session (used when switching sessions on existing connection)
   */
  joinSession(sessionId: string): void {
    this.currentSessionId = sessionId
    if (this.socket?.connected) {
      voiceDebug('[BackendSocketManager] Joining session:', sessionId)
      this.socket.emit('join-session', sessionId)
    }
  }

  /**
   * Request transcript catch-up since a specific timestamp
   */
  requestCatchup(sessionId: string, since?: number): void {
    const timestamp = since ?? this.lastReceivedTimestamp ?? Date.now() - 60000
    if (this.socket?.connected) {
      voiceDebug('[BackendSocketManager] Requesting catch-up since:', timestamp)
      this.socket.emit('request-catchup', { sessionId, since: timestamp })
    }
  }

  /**
   * Disconnect and cleanup socket
   */
  disconnect(): void {
    if (this.socket) {
      try {
        this.socket.removeAllListeners()
        this.socket.disconnect()
      } catch (err) {
  voiceWarn('[BackendSocketManager] Error during disconnect:', err)
      }
      this.socket = null
    }
    this.currentSessionId = null
  }

  /**
   * Reset failure count (used when starting new connection attempt)
   */
  resetFailureCount(): void {
    this.failureCount = 0
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.disconnect()
    this.failureCount = 0
    this.lastReceivedTimestamp = 0
    this.currentSessionId = null
  }

  /**
   * Get snapshot of current state for debugging
   */
  getSnapshot(): BackendSocketSnapshot {
    return {
      isConnected: this.isConnected(),
      isEnabled: this.enabled,
      failureCount: this.failureCount,
      lastReceivedTimestamp: this.lastReceivedTimestamp,
      hasSocket: this.socket !== null,
      currentSessionId: this.currentSessionId,
    }
  }
}
