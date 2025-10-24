import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  TranscriptData,
  TranscriptErrorData,
  CatchupData,
  SocketEventHandlers,
  SocketConfig,
  BackendSocketSnapshot,
} from '../types/backendSocket'
import { voiceDebug, voiceWarn } from '../utils/voiceLogging'

export type {
  TranscriptData,
  TranscriptErrorData,
  CatchupData,
  SocketEventHandlers,
  SocketConfig,
  BackendSocketSnapshot,
}

export interface UseBackendSocketOptions {
  sessionId: string | null
  config: SocketConfig
  handlers?: SocketEventHandlers
}

export interface UseBackendSocketReturn {
  isConnected: boolean
  isEnabled: boolean
  failureCount: number
  lastReceivedTimestamp: number
  currentSessionId: string | null
  connect: (sessionId: string) => void
  disconnect: () => void
  emit: (event: string, ...args: any[]) => void
  joinSession: (sessionId: string) => void
  requestCatchup: (sessionId: string, since?: number) => void
  resetFailureCount: () => void
  setEnabled: (enabled: boolean) => void
  updateLastReceivedTimestamp: (timestamp: number) => void
  getSnapshot: () => BackendSocketSnapshot
}

type ResolvedConfig = Required<SocketConfig>

interface InternalState {
  socket: Socket | null
  failureCount: number
  lastReceivedTimestamp: number
  currentSessionId: string | null
}

type ResolvedEndpoint = { origin: string; path: string }

const DEFAULT_CONFIG: Required<SocketConfig> = {
  apiBaseUrl: 'http://localhost:3002',
  maxFailures: 3,
  enabled: true,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 8000,
  withCredentials: true,
}

function resolveEndpoint(apiBaseUrl: string): ResolvedEndpoint {
  const fallback: ResolvedEndpoint = { origin: 'http://localhost:3002', path: '/socket.io/' }
  try {
    const url = new URL(apiBaseUrl)
    const origin = `${url.protocol}//${url.host}`

    // 1) Allow explicit override via env (best for proxies/custom paths)
    const socketPathEnv = (import.meta as any)?.env?.VITE_SOCKET_PATH as string | undefined
    if (socketPathEnv && typeof socketPathEnv === 'string') {
      let path = socketPathEnv.startsWith('/') ? socketPathEnv : `/${socketPathEnv}`
      if (!path.endsWith('/')) path = `${path}/`
      return { origin, path }
    }

    // 2) Smart default: use root '/socket.io/' to match backend default
    // Avoid nesting under '/api' when API base is 'http://host:port/api'
    const trimmedPath = url.pathname.replace(/\/+$|^\/+/, '')
    if (trimmedPath && /(^|\/)api$/i.test(trimmedPath)) {
      if (import.meta.env.DEV) {
        voiceWarn("[useBackendSocket] API base includes /api; using socket path '/socket.io/'. Set VITE_SOCKET_PATH to override if needed.", { apiBaseUrl })
      }
      return { origin, path: '/socket.io/' }
    }

    // 3) Optional: allow nesting under base path when explicitly requested
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
    voiceWarn('[useBackendSocket] Failed to parse apiBaseUrl', { apiBaseUrl, error })
    return fallback
  }
}

function mergeConfig(config: SocketConfig): ResolvedConfig {
  return {
    apiBaseUrl: config.apiBaseUrl,
    maxFailures: config.maxFailures ?? DEFAULT_CONFIG.maxFailures,
    enabled: config.enabled ?? DEFAULT_CONFIG.enabled,
    transports: config.transports ?? DEFAULT_CONFIG.transports,
    reconnectionAttempts: config.reconnectionAttempts ?? DEFAULT_CONFIG.reconnectionAttempts,
    reconnectionDelay: config.reconnectionDelay ?? DEFAULT_CONFIG.reconnectionDelay,
    timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
    withCredentials: config.withCredentials ?? DEFAULT_CONFIG.withCredentials,
  }
}

function createInitialState(): InternalState {
  return {
    socket: null,
    failureCount: 0,
    lastReceivedTimestamp: 0,
    currentSessionId: null,
  }
}

export function useBackendSocket({ sessionId, config, handlers = {} }: UseBackendSocketOptions): UseBackendSocketReturn {
  const {
    apiBaseUrl,
    maxFailures,
    enabled,
    transports,
    reconnectionAttempts,
    reconnectionDelay,
    timeout,
    withCredentials,
  } = config

  const resolvedConfig = useMemo(() => mergeConfig({
    apiBaseUrl,
    maxFailures,
    enabled,
    transports,
    reconnectionAttempts,
    reconnectionDelay,
    timeout,
    withCredentials,
  }), [
    apiBaseUrl,
    maxFailures,
    enabled,
    transports,
    reconnectionAttempts,
    reconnectionDelay,
    timeout,
    withCredentials,
  ])
  const handlersRef = useRef(handlers)
  const stateRef = useRef<InternalState>(createInitialState())
  const [isConnected, setIsConnected] = useState(false)
  const [isEnabled, setIsEnabled] = useState(resolvedConfig.enabled)
  const [failureCount, setFailureCount] = useState(0)
  const [lastReceivedTimestamp, setLastReceivedTimestamp] = useState(0)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId)

  useEffect(() => {
    setIsEnabled(resolvedConfig.enabled)
  }, [resolvedConfig.enabled])

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const updateFailureCount = useCallback((nextCount: number) => {
    setFailureCount(nextCount)
    stateRef.current.failureCount = nextCount
  }, [])

  const updateLastTimestamp = useCallback((timestamp: number) => {
    const next = Math.max(stateRef.current.lastReceivedTimestamp, timestamp)
    stateRef.current.lastReceivedTimestamp = next
    setLastReceivedTimestamp(next)
  }, [])

  const updateSessionId = useCallback((next: string | null) => {
    stateRef.current.currentSessionId = next
    setCurrentSessionId(next)
  }, [])

  const disconnect = useCallback(() => {
    const state = stateRef.current
    if (state.socket) {
      try {
        state.socket.removeAllListeners()
        state.socket.disconnect()
      } catch (error) {
      voiceWarn('[useBackendSocket] Error during disconnect', error)
      }
      state.socket = null
    }
    setIsConnected(false)
  }, [])

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled)
    if (!enabled) {
      disconnect()
    }
  }, [disconnect])

  const resetFailureCount = useCallback(() => {
    updateFailureCount(0)
  }, [updateFailureCount])

  const handleFailure = useCallback((label: string, error: unknown) => {
    const nextCount = stateRef.current.failureCount + 1
  voiceWarn('[useBackendSocket] Socket failure', { label, error, failureCount: nextCount })
    updateFailureCount(nextCount)
    handlersRef.current.onFailure?.(label, error, nextCount)

    if (nextCount >= resolvedConfig.maxFailures) {
    voiceWarn('[useBackendSocket] Disabling after repeated failures')
      setEnabled(false)
      handlersRef.current.onMaxFailures?.(nextCount)
    }
  }, [resolvedConfig.maxFailures, setEnabled, updateFailureCount])

  const setupEventHandlers = useCallback((socket: Socket, activeSession: string) => {
    socket.on('connect', () => {
      voiceDebug('[useBackendSocket] Connected, joining session', activeSession)
      resetFailureCount()
      setIsConnected(true)
      socket.emit('join-session', activeSession)
      handlersRef.current.onConnect?.(activeSession)
    })

    socket.on('disconnect', (reason) => {
      voiceDebug('[useBackendSocket] Disconnected', reason)
      setIsConnected(false)
      handlersRef.current.onDisconnect?.(reason)
    })

    socket.on('transcript', (data: TranscriptData) => {
      updateLastTimestamp(data.timestamp ?? 0)
      handlersRef.current.onTranscript?.(data)
    })

    socket.on('transcript-error', (data: TranscriptErrorData) => {
      voiceWarn('[useBackendSocket] Transcript error', data)
      handlersRef.current.onTranscriptError?.(data)
    })

    socket.io.on('reconnect', () => {
      const lastTimestamp = stateRef.current.lastReceivedTimestamp || Date.now() - 60000
      voiceDebug('[useBackendSocket] Reconnected, requesting catch-up', lastTimestamp)
      socket.emit('request-catchup', { sessionId: activeSession, since: lastTimestamp })
      handlersRef.current.onReconnect?.(lastTimestamp)
    })

    socket.on('catchup-transcripts', (data: CatchupData) => {
      const newest = Array.isArray(data?.transcripts)
        ? data.transcripts.reduce((max, t) => Math.max(max, t?.timestamp ?? 0), 0)
        : 0
      if (newest) updateLastTimestamp(newest)
      handlersRef.current.onCatchup?.(data)
    })

    socket.on('connect_error', (error) => handleFailure('connect_error', error))
    socket.on('error', (error) => handleFailure('error', error))
    socket.io.on('reconnect_error', (error) => handleFailure('reconnect_error', error))
    socket.io.on('reconnect_failed', () => handleFailure('reconnect_failed', 'max retries exceeded'))
  }, [handleFailure, resetFailureCount, updateLastTimestamp])

  const connect = useCallback((targetSessionId: string) => {
    if (!isEnabled) {
      voiceDebug('[useBackendSocket] Disabled, skipping connection')
      return
    }

    updateSessionId(targetSessionId)

    const existingSocket = stateRef.current.socket
    if (existingSocket?.connected) {
      voiceDebug('[useBackendSocket] Already connected, joining session', targetSessionId)
      existingSocket.emit('join-session', targetSessionId)
      handlersRef.current.onConnect?.(targetSessionId)
      return
    }

    if (stateRef.current.failureCount >= resolvedConfig.maxFailures) {
    voiceWarn('[useBackendSocket] Max failures reached, not connecting')
      setEnabled(false)
      return
    }

    const { origin, path } = resolveEndpoint(resolvedConfig.apiBaseUrl)
    voiceDebug('[useBackendSocket] Connecting to', { origin, path })

    if (existingSocket) {
      try {
        existingSocket.removeAllListeners()
        existingSocket.disconnect()
      } catch (error) {
  voiceWarn('[useBackendSocket] Failed to dispose existing socket before reconnect', error)
      }
    }

    const socket = io(origin, {
      path,
      transports: resolvedConfig.transports,
      reconnection: true,
      reconnectionAttempts: resolvedConfig.reconnectionAttempts,
      reconnectionDelay: resolvedConfig.reconnectionDelay,
      timeout: resolvedConfig.timeout,
      withCredentials: resolvedConfig.withCredentials,
    })

    stateRef.current.socket = socket
    setupEventHandlers(socket, targetSessionId)
  }, [isEnabled, resolvedConfig, setEnabled, setupEventHandlers, updateSessionId])

  const joinSession = useCallback((targetSessionId: string) => {
    updateSessionId(targetSessionId)
    const socket = stateRef.current.socket
    if (socket?.connected) {
      socket.emit('join-session', targetSessionId)
    }
  }, [updateSessionId])

  const emit = useCallback((event: string, ...args: any[]) => {
    const socket = stateRef.current.socket
    if (!socket?.connected) {
  voiceDebug('[useBackendSocket] Cannot emit, not connected', event)
      return
    }
    socket.emit(event, ...args)
  }, [])

  const requestCatchup = useCallback((targetSessionId: string, since?: number) => {
    const socket = stateRef.current.socket
    if (!socket?.connected) {
      return
    }
    const timestamp = since ?? stateRef.current.lastReceivedTimestamp ?? Date.now() - 60000
    socket.emit('request-catchup', { sessionId: targetSessionId, since: timestamp })
  }, [])

  const updateLastReceivedTimestamp = useCallback((timestamp: number) => {
    updateLastTimestamp(timestamp)
  }, [updateLastTimestamp])

  const getSnapshot = useCallback((): BackendSocketSnapshot => {
    const state = stateRef.current
    return {
      isConnected,
      isEnabled,
      failureCount: state.failureCount,
      lastReceivedTimestamp: state.lastReceivedTimestamp,
      hasSocket: state.socket !== null,
      currentSessionId: state.currentSessionId,
    }
  }, [isConnected, isEnabled])

  useEffect(() => {
    if (!sessionId) {
      disconnect()
      updateSessionId(null)
      return
    }

    connect(sessionId)

    return () => {
      disconnect()
    }
  }, [connect, disconnect, sessionId, updateSessionId])

  return {
    isConnected,
    isEnabled,
    failureCount,
    lastReceivedTimestamp,
    currentSessionId,
    connect,
    disconnect,
    emit,
    joinSession,
    requestCatchup,
    resetFailureCount,
    setEnabled,
    updateLastReceivedTimestamp,
    getSnapshot,
  }
}
