import type { MediaReference } from '../types'

/**
 * Shared types for backend socket communication.
 * Used by both the useBackendSocket hook and ConversationController integration.
 */

export interface TranscriptData {
  role: 'user' | 'assistant'
  text: string
  isFinal: boolean
  timestamp: number
  source?: string
  startedAtMs?: number | null
  finalizedAtMs?: number | null
  emittedAtMs?: number | null
  media?: MediaReference
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

/**
 * Common interface for backend socket clients.
 * Implemented by useBackendSocket hook (recommended) and legacy BackendSocketManager.
 */
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

/**
 * Factory function type for creating backend socket clients.
 * Used by ServiceInitializer to allow custom socket implementations.
 */
export type BackendSocketFactory = (options: {
  config: SocketConfig
  handlers: SocketEventHandlers
}) => BackendSocketClient
