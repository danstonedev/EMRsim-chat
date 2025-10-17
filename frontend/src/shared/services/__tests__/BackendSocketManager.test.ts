import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { BackendSocketManager } from '../BackendSocketManager'
import type { SocketEventHandlers, SocketConfig } from '../BackendSocketManager'

// Mock socket.io-client
const mockSocket = {
  connected: false,
  emit: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
  disconnect: vi.fn(),
  io: {
    on: vi.fn(),
  },
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

describe('BackendSocketManager', () => {
  let manager: BackendSocketManager
  let handlers: SocketEventHandlers
  let config: SocketConfig

  beforeEach(() => {
    // Reset mock
    mockSocket.connected = false
    mockSocket.emit.mockClear()
    mockSocket.on.mockClear()
    mockSocket.removeAllListeners.mockClear()
    mockSocket.disconnect.mockClear()
    mockSocket.io.on.mockClear()

    // Setup handlers
    handlers = {
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      onTranscript: vi.fn(),
      onTranscriptError: vi.fn(),
      onReconnect: vi.fn(),
      onCatchup: vi.fn(),
      onFailure: vi.fn(),
      onMaxFailures: vi.fn(),
    }

    // Setup config
    config = {
      apiBaseUrl: 'http://localhost:3002',
      maxFailures: 3,
      enabled: true,
    }

    manager = new BackendSocketManager(config, handlers)
  })

  afterEach(() => {
    manager.reset()
  })

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      expect(manager.isEnabled()).toBe(true)
      expect(manager.getFailureCount()).toBe(0)
      expect(manager.getLastReceivedTimestamp()).toBe(0)
      expect(manager.isConnected()).toBe(false)
    })

    it('should initialize with custom config', () => {
      const customConfig = {
        apiBaseUrl: 'http://example.com',
        maxFailures: 5,
        enabled: false,
      }
      const customManager = new BackendSocketManager(customConfig)
      expect(customManager.isEnabled()).toBe(false)
      expect(customManager.isConnected()).toBe(false)
    })
  })

  describe('Connection Management', () => {
    it('should connect to backend socket', () => {
      const sessionId = 'test-session-123'
      manager.connect(sessionId)

      expect(manager.getCurrentSessionId()).toBe(sessionId)
    })

    it('should not connect when disabled', () => {
      manager.setEnabled(false)
      manager.connect('test-session')

      expect(manager.isConnected()).toBe(false)
    })

    it('should join existing session if already connected', () => {
      // First connect to establish socket
      manager.connect('initial-session')
      mockSocket.emit.mockClear()
      handlers.onConnect = vi.fn()
      
      // Simulate already connected
      mockSocket.connected = true
      const sessionId = 'test-session-456'

      manager.connect(sessionId)

      expect(mockSocket.emit).toHaveBeenCalledWith('join-session', sessionId)
      expect(handlers.onConnect).toHaveBeenCalledWith(sessionId)
    })

    it('should not connect if max failures reached', () => {
      // Simulate max failures
      for (let i = 0; i < 3; i++) {
        manager['handleFailure']('test', new Error('Test error'))
      }

      manager.connect('test-session')
      expect(manager.isEnabled()).toBe(false)
    })

    it('should disconnect socket', () => {
      manager.connect('test-session')
      manager.disconnect()

      expect(mockSocket.removeAllListeners).toHaveBeenCalled()
      expect(mockSocket.disconnect).toHaveBeenCalled()
      expect(manager.getCurrentSessionId()).toBeNull()
    })

    it('should handle disconnect errors gracefully', () => {
      mockSocket.disconnect.mockImplementation(() => {
        throw new Error('Disconnect error')
      })

      expect(() => manager.disconnect()).not.toThrow()
    })
  })

  describe('Endpoint Resolution', () => {
    it('should resolve correct endpoint from API base URL', () => {
      const testConfig = {
        apiBaseUrl: 'http://example.com:8080/api/v1',
        enabled: true,
      }
      const testManager = new BackendSocketManager(testConfig)
      const endpoint = testManager['resolveEndpoint']()

      expect(endpoint.origin).toBe('http://example.com:8080')
      expect(endpoint.path).toBe('/api/v1/socket.io/')
    })

    it('should use fallback for invalid URL', () => {
      const testConfig = {
        apiBaseUrl: 'invalid-url',
        enabled: true,
      }
      const testManager = new BackendSocketManager(testConfig)
      const endpoint = testManager['resolveEndpoint']()

      expect(endpoint.origin).toBe('http://localhost:3002')
      expect(endpoint.path).toBe('/socket.io/')
    })

    it('should handle root path correctly', () => {
      const testConfig = {
        apiBaseUrl: 'http://example.com/',
        enabled: true,
      }
      const testManager = new BackendSocketManager(testConfig)
      const endpoint = testManager['resolveEndpoint']()

      expect(endpoint.path).toBe('/socket.io/')
    })
  })

  describe('Session Management', () => {
    it('should join a session', () => {
      // First connect to establish socket
      manager.connect('initial-session')
      mockSocket.connected = true
      mockSocket.emit.mockClear()
      
      const sessionId = 'new-session-789'

      manager.joinSession(sessionId)

      expect(mockSocket.emit).toHaveBeenCalledWith('join-session', sessionId)
      expect(manager.getCurrentSessionId()).toBe(sessionId)
    })

    it('should not emit if not connected', () => {
      mockSocket.connected = false
      manager.joinSession('test-session')

      expect(mockSocket.emit).not.toHaveBeenCalled()
    })
  })

  describe('Timestamp Management', () => {
    it('should update last received timestamp', () => {
      const timestamp = Date.now()
      manager.updateLastReceivedTimestamp(timestamp)

      expect(manager.getLastReceivedTimestamp()).toBe(timestamp)
    })

    it('should only update to higher timestamp', () => {
      manager.updateLastReceivedTimestamp(1000)
      manager.updateLastReceivedTimestamp(500)

      expect(manager.getLastReceivedTimestamp()).toBe(1000)
    })

    it('should update to higher timestamp', () => {
      manager.updateLastReceivedTimestamp(1000)
      manager.updateLastReceivedTimestamp(1500)

      expect(manager.getLastReceivedTimestamp()).toBe(1500)
    })
  })

  describe('Catch-up Functionality', () => {
    it('should request catch-up with specific timestamp', () => {
      // First connect to establish socket
      manager.connect('initial-session')
      mockSocket.connected = true
      mockSocket.emit.mockClear()
      
      const sessionId = 'test-session'
      const since = Date.now() - 30000

      manager.requestCatchup(sessionId, since)

      expect(mockSocket.emit).toHaveBeenCalledWith('request-catchup', { sessionId, since })
    })

    it('should use last received timestamp if no since provided', () => {
      // First connect to establish socket
      manager.connect('initial-session')
      mockSocket.connected = true
      mockSocket.emit.mockClear()
      
      const sessionId = 'test-session'
      const lastTimestamp = Date.now() - 10000
      manager.updateLastReceivedTimestamp(lastTimestamp)

      manager.requestCatchup(sessionId)

      expect(mockSocket.emit).toHaveBeenCalledWith('request-catchup', {
        sessionId,
        since: lastTimestamp,
      })
    })

    it('should not request catch-up if not connected', () => {
      mockSocket.connected = false
      manager.requestCatchup('test-session')

      expect(mockSocket.emit).not.toHaveBeenCalled()
    })
  })

  describe('Failure Handling', () => {
    it('should increment failure count on error', () => {
      expect(manager.getFailureCount()).toBe(0)

      manager['handleFailure']('test-error', new Error('Test'))

      expect(manager.getFailureCount()).toBe(1)
      expect(handlers.onFailure).toHaveBeenCalledWith('test-error', expect.any(Error), 1)
    })

    it('should disable after max failures', () => {
      for (let i = 0; i < 3; i++) {
        manager['handleFailure']('test-error', new Error('Test'))
      }

      expect(manager.isEnabled()).toBe(false)
      expect(handlers.onMaxFailures).toHaveBeenCalledWith(3)
    })

    it('should reset failure count', () => {
      manager['handleFailure']('test', new Error('Test'))
      expect(manager.getFailureCount()).toBe(1)

      manager.resetFailureCount()
      expect(manager.getFailureCount()).toBe(0)
    })
  })

  describe('Event Emission', () => {
    it('should emit events when connected', () => {
      // First connect to establish socket
      manager.connect('initial-session')
      mockSocket.connected = true
      mockSocket.emit.mockClear()
      
      manager.emit('custom-event', { data: 'test' })

      expect(mockSocket.emit).toHaveBeenCalledWith('custom-event', { data: 'test' })
    })

    it('should not emit when not connected', () => {
      mockSocket.connected = false
      manager.emit('custom-event', { data: 'test' })

      expect(mockSocket.emit).not.toHaveBeenCalled()
    })
  })

  describe('State Management', () => {
    it('should enable and disable', () => {
      expect(manager.isEnabled()).toBe(true)

      manager.setEnabled(false)
      expect(manager.isEnabled()).toBe(false)

      manager.setEnabled(true)
      expect(manager.isEnabled()).toBe(true)
    })

    it('should disconnect when disabled', () => {
      manager.connect('test-session')
      manager.setEnabled(false)

      expect(mockSocket.disconnect).toHaveBeenCalled()
    })

    it('should reset all state', () => {
      manager.connect('test-session')
      manager.updateLastReceivedTimestamp(Date.now())
      manager['handleFailure']('test', new Error('Test'))

      manager.reset()

      expect(manager.getFailureCount()).toBe(0)
      expect(manager.getLastReceivedTimestamp()).toBe(0)
      expect(manager.getCurrentSessionId()).toBeNull()
    })
  })

  describe('Snapshot', () => {
    it('should return complete snapshot', () => {
      mockSocket.connected = true
      manager.connect('test-session')
      manager.updateLastReceivedTimestamp(12345)

      const snapshot = manager.getSnapshot()

      expect(snapshot.isConnected).toBe(true)
      expect(snapshot.isEnabled).toBe(true)
      expect(snapshot.failureCount).toBe(0)
      expect(snapshot.lastReceivedTimestamp).toBe(12345)
      expect(snapshot.hasSocket).toBe(true)
      expect(snapshot.currentSessionId).toBe('test-session')
    })

    it('should return empty snapshot for fresh manager', () => {
      const snapshot = manager.getSnapshot()

      expect(snapshot.isConnected).toBe(false)
      expect(snapshot.isEnabled).toBe(true)
      expect(snapshot.failureCount).toBe(0)
      expect(snapshot.lastReceivedTimestamp).toBe(0)
      expect(snapshot.hasSocket).toBe(false)
      expect(snapshot.currentSessionId).toBeNull()
    })
  })

  describe('Event Handlers Setup', () => {
    it('should call onConnect handler when connected', () => {
      manager.connect('test-session')

      // Simulate connect event
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      expect(connectHandler).toBeDefined()

      connectHandler?.()

      expect(handlers.onConnect).toHaveBeenCalledWith('test-session')
      expect(manager.getFailureCount()).toBe(0)
    })

    it('should call onDisconnect handler when disconnected', () => {
      manager.connect('test-session')

      const disconnectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'disconnect')?.[1]
      expect(disconnectHandler).toBeDefined()

      disconnectHandler?.('transport close')

      expect(handlers.onDisconnect).toHaveBeenCalledWith('transport close')
    })

    it('should call onTranscript handler for transcript events', () => {
      manager.connect('test-session')

      const transcriptHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'transcript')?.[1]
      expect(transcriptHandler).toBeDefined()

      const transcriptData = {
        role: 'user' as const,
        text: 'Hello',
        isFinal: true,
        timestamp: Date.now(),
      }
      transcriptHandler?.(transcriptData)

      expect(handlers.onTranscript).toHaveBeenCalledWith(transcriptData)
    })

    it('should call onTranscriptError handler for errors', () => {
      manager.connect('test-session')

      const errorHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'transcript-error')?.[1]
      expect(errorHandler).toBeDefined()

      const errorData = { error: 'Test error', timestamp: Date.now() }
      errorHandler?.(errorData)

      expect(handlers.onTranscriptError).toHaveBeenCalledWith(errorData)
    })

    it('should call onCatchup handler for catch-up data', () => {
      manager.connect('test-session')

      const catchupHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'catchup-transcripts')?.[1]
      expect(catchupHandler).toBeDefined()

      const catchupData = {
        transcripts: [
          { role: 'user' as const, text: 'Test', isFinal: true, timestamp: Date.now() },
        ],
      }
      catchupHandler?.(catchupData)

      expect(handlers.onCatchup).toHaveBeenCalledWith(catchupData)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle full connection lifecycle', () => {
      const sessionId = 'full-test-session'

      // Connect
      manager.connect(sessionId)
      expect(manager.getCurrentSessionId()).toBe(sessionId)

      // Simulate connect event
      mockSocket.connected = true
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      connectHandler?.()
      expect(handlers.onConnect).toHaveBeenCalled()

      // Update timestamp
      manager.updateLastReceivedTimestamp(Date.now())

      // Disconnect
      manager.disconnect()
      expect(manager.getCurrentSessionId()).toBeNull()
    })

    it('should handle failure and recovery', () => {
      manager.connect('test-session')

      // Simulate failures
      manager['handleFailure']('error1', new Error('Error 1'))
      expect(manager.isEnabled()).toBe(true)

      manager['handleFailure']('error2', new Error('Error 2'))
      expect(manager.isEnabled()).toBe(true)

      manager['handleFailure']('error3', new Error('Error 3'))
      expect(manager.isEnabled()).toBe(false)
      expect(handlers.onMaxFailures).toHaveBeenCalled()

      // Reset and try again
      manager.reset()
      expect(manager.getFailureCount()).toBe(0)
      expect(manager.isEnabled()).toBe(false) // Still disabled after reset
    })

    it('should handle reconnection with catch-up', () => {
      const sessionId = 'reconnect-session'
      manager.connect(sessionId)
      manager.updateLastReceivedTimestamp(1000)

      // Simulate reconnect
      const reconnectHandler = mockSocket.io.on.mock.calls.find((call) => call[0] === 'reconnect')?.[1]
      expect(reconnectHandler).toBeDefined()

      reconnectHandler?.()

      expect(handlers.onReconnect).toHaveBeenCalledWith(1000)
      expect(mockSocket.emit).toHaveBeenCalledWith('request-catchup', {
        sessionId,
        since: 1000,
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle null handlers gracefully', () => {
      const managerNoHandlers = new BackendSocketManager(config)
      expect(() => managerNoHandlers.connect('test')).not.toThrow()
    })

    it('should handle emit with multiple arguments', () => {
      // First connect to establish socket
      manager.connect('initial-session')
      mockSocket.connected = true
      mockSocket.emit.mockClear()
      
      manager.emit('multi-arg-event', 'arg1', 'arg2', { key: 'value' })

      expect(mockSocket.emit).toHaveBeenCalledWith('multi-arg-event', 'arg1', 'arg2', { key: 'value' })
    })

    it('should handle timestamp updates with zero', () => {
      manager.updateLastReceivedTimestamp(0)
      expect(manager.getLastReceivedTimestamp()).toBe(0)

      manager.updateLastReceivedTimestamp(100)
      expect(manager.getLastReceivedTimestamp()).toBe(100)
    })

    it('should handle connect when already connecting', () => {
      manager.connect('session-1')
      manager.connect('session-2')

      expect(manager.getCurrentSessionId()).toBe('session-2')
    })
  })
})
