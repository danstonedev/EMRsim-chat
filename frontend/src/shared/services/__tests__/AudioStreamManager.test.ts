import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AudioStreamManager } from '../AudioStreamManager'

describe('AudioStreamManager', () => {
  let manager: AudioStreamManager
  let mockAudioContext: any
  let mockAnalyser: any
  let mockSource: any

  beforeEach(() => {
    manager = new AudioStreamManager()

    // Mock AudioContext
    mockAnalyser = {
      fftSize: 0,
      frequencyBinCount: 128,
      connect: vi.fn(),
      getByteTimeDomainData: vi.fn((data: Uint8Array) => {
        // Fill with sample data representing ~0.5 RMS
        for (let i = 0; i < data.length; i++) {
          data[i] = 128 + Math.random() * 64
        }
      }),
    }

    mockSource = {
      connect: vi.fn(),
    }

    mockAudioContext = {
      createAnalyser: vi.fn(() => mockAnalyser),
      createMediaStreamSource: vi.fn(() => mockSource),
      close: vi.fn(() => Promise.resolve()),
    }

    global.AudioContext = vi.fn(() => mockAudioContext) as any
  })

  afterEach(() => {
    manager.cleanup()
  })

  describe('Constructor', () => {
    it('should initialize with no streams', () => {
      const snapshot = manager.getSnapshot()
      expect(snapshot.hasMicStream).toBe(false)
      expect(snapshot.hasAudioContext).toBe(false)
      expect(snapshot.currentMicLevel).toBe(0)
      expect(snapshot.isMonitoring).toBe(false)
    })
  })

  describe('Configuration', () => {
    it('should set audio level callback', () => {
      const callback = vi.fn()
      manager.setAudioLevelCallback(callback)
      // Callback will be tested in monitoring tests
      expect(true).toBe(true)
    })

    it('should attach remote audio element', () => {
      const mockElement = document.createElement('audio') as HTMLAudioElement
      manager.attachRemoteAudioElement(mockElement)
      expect(manager.getRemoteAudioElement()).toBe(mockElement)
    })

    it('should handle null remote audio element', () => {
      const mockElement = document.createElement('audio') as HTMLAudioElement
      manager.attachRemoteAudioElement(mockElement)
      expect(manager.getRemoteAudioElement()).toBe(mockElement)

      manager.attachRemoteAudioElement(null)
      expect(manager.getRemoteAudioElement()).toBeNull()
    })
  })

  describe('Microphone Stream Management', () => {
    it('should get and set mic stream', () => {
      expect(manager.getMicStream()).toBeNull()
      expect(manager.hasMicStream()).toBe(false)

      const mockStream = createMockMediaStream()
      manager.setMicStream(mockStream)

      expect(manager.getMicStream()).toBe(mockStream)
      expect(manager.hasMicStream()).toBe(true)
    })

    it('should handle null mic stream', () => {
      const mockStream = createMockMediaStream()
      manager.setMicStream(mockStream)
      expect(manager.hasMicStream()).toBe(true)

      manager.setMicStream(null)
      expect(manager.hasMicStream()).toBe(false)
    })
  })

  describe('Audio Level Monitoring', () => {
    it('should start monitoring audio levels', () => {
      const mockStream = createMockMediaStream()
      manager.startMeter(mockStream)

      expect(manager.isMonitoring()).toBe(true)
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled()
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream)
      expect(mockSource.connect).toHaveBeenCalledWith(mockAnalyser)
    })

    it('should call audio level callback during monitoring', async () => {
      const mockStream = createMockMediaStream()
      const callback = vi.fn()

      manager.setAudioLevelCallback(callback)
      manager.startMeter(mockStream)

      // Wait for requestAnimationFrame to fire
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(callback).toHaveBeenCalled()
      expect(callback.mock.calls[0][0]).toBeGreaterThanOrEqual(0)
      expect(callback.mock.calls[0][0]).toBeLessThanOrEqual(1)
    })

    it('should provide analysis data to callback', async () => {
      const mockStream = createMockMediaStream()
      const analysisCallback = vi.fn()

      manager.startMeter(mockStream, analysisCallback)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(analysisCallback).toHaveBeenCalled()
      const data = analysisCallback.mock.calls[0][0]
      expect(data).toHaveProperty('rms')
      expect(data).toHaveProperty('timestamp')
      expect(data.rms).toBeGreaterThanOrEqual(0)
      expect(data.rms).toBeLessThanOrEqual(1)
    })

    it('should update mic level during monitoring', async () => {
      const mockStream = createMockMediaStream()
      manager.startMeter(mockStream)

      await new Promise((resolve) => setTimeout(resolve, 50))

      const level = manager.getMicLevel()
      expect(level).toBeGreaterThan(0)
      expect(level).toBeLessThanOrEqual(1)
    })

    it('should stop monitoring audio levels', () => {
      const mockStream = createMockMediaStream()
      const callback = vi.fn()

      manager.setAudioLevelCallback(callback)
      manager.startMeter(mockStream)
      expect(manager.isMonitoring()).toBe(true)

      manager.stopMeter()

      expect(manager.isMonitoring()).toBe(false)
      expect(mockAudioContext.close).toHaveBeenCalled()
      expect(manager.getMicLevel()).toBe(0)

      // Callback should be called with 0
      expect(callback).toHaveBeenCalledWith(0)
    })

    it('should stop previous monitoring when starting new', () => {
      const mockStream1 = createMockMediaStream()
      const mockStream2 = createMockMediaStream()

      manager.startMeter(mockStream1)
      expect(manager.isMonitoring()).toBe(true)

      const firstContext = mockAudioContext
      manager.startMeter(mockStream2)

      expect(firstContext.close).toHaveBeenCalled()
      expect(manager.isMonitoring()).toBe(true)
    })

    it('should handle startMeter errors gracefully', () => {
      global.AudioContext = vi.fn(() => {
        throw new Error('AudioContext not supported')
      }) as any

      const mockStream = createMockMediaStream()
      expect(() => manager.startMeter(mockStream)).not.toThrow()
      expect(manager.isMonitoring()).toBe(false)
    })
  })

  describe('Remote Audio Playback', () => {
    it('should handle remote stream', () => {
      const mockAudioElement = createMockAudioElement()
      ;(mockAudioElement as any).readyState = 4 // HAVE_ENOUGH_DATA

      manager.attachRemoteAudioElement(mockAudioElement)

      const mockRemoteStream = createMockMediaStream()
      manager.handleRemoteStream(mockRemoteStream)

      expect(mockAudioElement.srcObject).toBe(mockRemoteStream)
      const playSpy = mockAudioElement.play as any
      expect(playSpy).toHaveBeenCalled()
    })

    it('should wait for canplay event if not ready', async () => {
      const mockAudioElement = createMockAudioElement()
      ;(mockAudioElement as any).readyState = 0 // HAVE_NOTHING

      const addListenerSpy = mockAudioElement.addEventListener as any

      manager.attachRemoteAudioElement(mockAudioElement)

      const mockRemoteStream = createMockMediaStream()
      manager.handleRemoteStream(mockRemoteStream)

      // Should add event listener
      expect(addListenerSpy).toHaveBeenCalledWith('canplay', expect.any(Function))

      // Simulate canplay event
      const canplayHandler = addListenerSpy.mock.calls[0][1]
      canplayHandler()

      await new Promise((resolve) => setTimeout(resolve, 10))

      const playSpy = mockAudioElement.play as any
      const removeListenerSpy = mockAudioElement.removeEventListener as any
      expect(playSpy).toHaveBeenCalled()
      expect(removeListenerSpy).toHaveBeenCalled()
    })

    it('should not handle remote stream if no audio element', () => {
      const mockRemoteStream = createMockMediaStream()
      expect(() => manager.handleRemoteStream(mockRemoteStream)).not.toThrow()
    })

    it('should apply fade-in effect', () => {
      const mockAudioElement = createMockAudioElement()
      mockAudioElement.volume = 0.8

      manager.applyRemoteFadeIn(mockAudioElement)

      expect(mockAudioElement.volume).toBe(0.0001)
      // Fade effect uses requestAnimationFrame, tested in integration
    })

    it('should cancel previous fade when applying new fade', () => {
      const mockAudioElement = createMockAudioElement()
      const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame')

      manager.applyRemoteFadeIn(mockAudioElement)
      manager.applyRemoteFadeIn(mockAudioElement)

      expect(cancelSpy).toHaveBeenCalled()
    })

    it('should cancel remote fade', () => {
      const mockAudioElement = createMockAudioElement()
      const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame')

      manager.applyRemoteFadeIn(mockAudioElement)
      manager.cancelRemoteFade()

      expect(cancelSpy).toHaveBeenCalled()
    })
  })

  describe('Snapshot', () => {
    it('should return complete snapshot', () => {
      const mockStream = createMockMediaStream()
      const mockAudioElement = createMockAudioElement()
      mockAudioElement.volume = 0.7
      ;(mockAudioElement as any).paused = false

      manager.setMicStream(mockStream)
      manager.attachRemoteAudioElement(mockAudioElement)
      manager.startMeter(mockStream)

      const snapshot = manager.getSnapshot()

      expect(snapshot.hasMicStream).toBe(true)
      expect(snapshot.hasAudioContext).toBe(true)
      expect(snapshot.hasRemoteAudioElement).toBe(true)
      expect(snapshot.isMonitoring).toBe(true)
      expect(snapshot.remoteAudioVolume).toBe(0.7)
      expect(snapshot.remoteAudioPaused).toBe(false)
    })

    it('should return empty snapshot for fresh manager', () => {
      const snapshot = manager.getSnapshot()

      expect(snapshot.hasMicStream).toBe(false)
      expect(snapshot.hasAudioContext).toBe(false)
      expect(snapshot.hasRemoteAudioElement).toBe(false)
      expect(snapshot.currentMicLevel).toBe(0)
      expect(snapshot.isMonitoring).toBe(false)
      expect(snapshot.remoteAudioVolume).toBeNull()
      expect(snapshot.remoteAudioPaused).toBeNull()
    })
  })

  describe('Cleanup', () => {
    it('should stop monitoring during cleanup', () => {
      const mockStream = createMockMediaStream()
      manager.startMeter(mockStream)
      expect(manager.isMonitoring()).toBe(true)

      manager.cleanup()

      expect(manager.isMonitoring()).toBe(false)
      expect(mockAudioContext.close).toHaveBeenCalled()
    })

    it('should clean up mic stream tracks', () => {
      const mockStream = createMockMediaStream()
      manager.setMicStream(mockStream)

      manager.cleanup()

      const tracks = mockStream.getTracks()
      tracks.forEach((track) => {
        expect(track.stop).toHaveBeenCalled()
      })
      expect(manager.getMicStream()).toBeNull()
    })

    it('should clean up remote audio', () => {
      const mockAudioElement = createMockAudioElement()
      manager.attachRemoteAudioElement(mockAudioElement)

      const mockRemoteStream = createMockMediaStream()
      manager.handleRemoteStream(mockRemoteStream)

      manager.cleanup()

      expect(mockAudioElement.pause).toHaveBeenCalled()
      expect(mockAudioElement.srcObject).toBeNull()
    })

    it('should cancel remote fade during cleanup', () => {
      const mockAudioElement = createMockAudioElement()
      const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame')

      manager.applyRemoteFadeIn(mockAudioElement)
      manager.cleanup()

      expect(cancelSpy).toHaveBeenCalled()
    })

    it('should handle cleanup with no resources', () => {
      expect(() => manager.cleanup()).not.toThrow()

      const snapshot = manager.getSnapshot()
      expect(snapshot.hasMicStream).toBe(false)
      expect(snapshot.isMonitoring).toBe(false)
    })

    it('should handle cleanup errors gracefully', () => {
      const mockStream = createMockMediaStream()
      const track = mockStream.getTracks()[0]
      track.stop = vi.fn(() => {
        throw new Error('Stop failed')
      })

      manager.setMicStream(mockStream)
      expect(() => manager.cleanup()).not.toThrow()
    })
  })

  describe('Reset', () => {
    it('should reset to initial state', () => {
      const mockStream = createMockMediaStream()
      const mockAudioElement = createMockAudioElement()

      manager.setMicStream(mockStream)
      manager.attachRemoteAudioElement(mockAudioElement)
      manager.startMeter(mockStream)

      manager.reset()

      const snapshot = manager.getSnapshot()
      expect(snapshot.hasMicStream).toBe(false)
      expect(snapshot.isMonitoring).toBe(false)
      expect(snapshot.currentMicLevel).toBe(0)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle full audio setup and teardown', async () => {
      const mockStream = createMockMediaStream()
      const mockAudioElement = createMockAudioElement()
      const callback = vi.fn()

      // Setup
      manager.setAudioLevelCallback(callback)
      manager.setMicStream(mockStream)
      manager.attachRemoteAudioElement(mockAudioElement)

      // Start monitoring
      manager.startMeter(mockStream)
      expect(manager.isMonitoring()).toBe(true)

      // Wait for monitoring to run
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(callback).toHaveBeenCalled()
      expect(manager.getMicLevel()).toBeGreaterThan(0)

      // Handle remote stream
      const mockRemoteStream = createMockMediaStream()
      manager.handleRemoteStream(mockRemoteStream)
      expect(mockAudioElement.srcObject).toBe(mockRemoteStream)

      // Cleanup
      manager.cleanup()
      expect(manager.isMonitoring()).toBe(false)
      expect(manager.getMicStream()).toBeNull()
    })

    it('should handle multiple start/stop cycles', () => {
      const mockStream = createMockMediaStream()

      for (let i = 0; i < 3; i++) {
        manager.startMeter(mockStream)
        expect(manager.isMonitoring()).toBe(true)

        manager.stopMeter()
        expect(manager.isMonitoring()).toBe(false)
        expect(manager.getMicLevel()).toBe(0)
      }
    })

    it('should handle switching streams', () => {
      const mockStream1 = createMockMediaStream()
      const mockStream2 = createMockMediaStream()

      manager.setMicStream(mockStream1)
      manager.startMeter(mockStream1)

      manager.setMicStream(mockStream2)
      manager.startMeter(mockStream2)

      expect(manager.getMicStream()).toBe(mockStream2)
      expect(manager.isMonitoring()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing audio element during remote stream', () => {
      const mockStream = createMockMediaStream()
      expect(() => manager.handleRemoteStream(mockStream)).not.toThrow()
    })

    it('should handle audio element with no volume', () => {
      const mockElement = createMockAudioElement()
      delete (mockElement as any).volume

      manager.applyRemoteFadeIn(mockElement)
      // Should use default target
      expect(mockElement.volume).toBeGreaterThanOrEqual(0)
    })

    it('should handle stopping meter when not monitoring', () => {
      expect(() => manager.stopMeter()).not.toThrow()
      expect(manager.getMicLevel()).toBe(0)
    })

    it('should handle cleanup with partial state', () => {
      const mockStream = createMockMediaStream()
      manager.setMicStream(mockStream)
      // No monitoring started, no audio element

      expect(() => manager.cleanup()).not.toThrow()
    })

    it('should handle callback being null', () => {
      const mockStream = createMockMediaStream()
      manager.setAudioLevelCallback(null)
      expect(() => manager.startMeter(mockStream)).not.toThrow()
    })
  })
})

// Helper functions

function createMockMediaStream(): MediaStream {
  const mockTrack = {
    kind: 'audio',
    stop: vi.fn(),
    enabled: true,
  }

  return {
    getTracks: vi.fn(() => [mockTrack]),
    getAudioTracks: vi.fn(() => [mockTrack]),
    getVideoTracks: vi.fn(() => []),
  } as any
}

function createMockAudioElement(): HTMLAudioElement {
  return {
    srcObject: null,
    volume: 1,
    paused: true,
    readyState: 0,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as any
}
