/**
 * AudioStreamManager
 *
 * Manages audio streams, audio context, volume level monitoring, and remote audio playback.
 *
 * Responsibilities:
 * - Manage microphone stream lifecycle
 * - Create and manage AudioContext for analysis
 * - Monitor audio levels with RMS calculation
 * - Manage remote audio element for playback
 * - Apply fade-in effects to remote audio
 * - Provide audio level callbacks
 * - Clean up audio resources
 *
 * Extracted from ConversationController.ts as part of refactoring to reduce
 * main file complexity and improve testability.
 */

export interface AudioLevelCallback {
  (level: number): void;
}

export interface AudioAnalysisData {
  rms: number;
  timestamp: number;
}

export interface AudioStreamSnapshot {
  hasMicStream: boolean;
  hasAudioContext: boolean;
  hasRemoteAudioElement: boolean;
  currentMicLevel: number;
  isMonitoring: boolean;
  remoteAudioVolume: number | null;
  remoteAudioPaused: boolean | null;
}

export class AudioStreamManager {
  private micStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;

  private micLevel: number = 0;
  private monitoringActive: boolean = false;
  private monitoringRaf: number | null = null;
  private remoteFadeRaf: number | null = null;

  private audioLevelCallback: AudioLevelCallback | null = null;

  constructor() {
    // Empty constructor - configuration set separately
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Set callback for audio level updates
   */
  setAudioLevelCallback(callback: AudioLevelCallback | null): void {
    this.audioLevelCallback = callback;
  }

  /**
   * Attach remote audio element for playback
   */
  attachRemoteAudioElement(element: HTMLAudioElement | null): void {
    this.remoteAudioElement = element;
  }

  /**
   * Get the attached remote audio element
   */
  getRemoteAudioElement(): HTMLAudioElement | null {
    return this.remoteAudioElement;
  }

  // ============================================
  // Microphone Stream Management
  // ============================================

  /**
   * Get the current microphone stream
   */
  getMicStream(): MediaStream | null {
    return this.micStream;
  }

  /**
   * Set the microphone stream
   */
  setMicStream(stream: MediaStream | null): void {
    this.micStream = stream;
  }

  /**
   * Check if microphone stream exists
   */
  hasMicStream(): boolean {
    return this.micStream !== null;
  }

  // ============================================
  // Audio Level Monitoring
  // ============================================

  /**
   * Get current microphone level (0-1)
   */
  getMicLevel(): number {
    return this.micLevel;
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring(): boolean {
    return this.monitoringActive;
  }

  /**
   * Start monitoring audio levels from stream
   * Creates AudioContext and analyser for RMS calculation
   */
  startMeter(stream: MediaStream, analysisCallback?: (data: AudioAnalysisData) => void): void {
    if (this.monitoringActive) {
      this.stopMeter();
    }

    try {
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      this.audioContext = audioCtx;
      this.monitoringActive = true;

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!this.monitoringActive) return;

        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.min(1, Math.sqrt(sum / data.length));
        this.micLevel = rms;

        // Notify callback
        if (this.audioLevelCallback) {
          this.audioLevelCallback(rms);
        }

        // Provide analysis data to external callback
        if (analysisCallback) {
          analysisCallback({ rms, timestamp: Date.now() });
        }

        this.monitoringRaf = requestAnimationFrame(tick);
      };

      this.monitoringRaf = requestAnimationFrame(tick);
    } catch (err) {
      console.error('[AudioStreamManager] Failed to start audio meter:', err);
      this.monitoringActive = false;
    }
  }

  /**
   * Stop monitoring audio levels
   */
  stopMeter(): void {
    this.monitoringActive = false;

    if (this.monitoringRaf !== null) {
      cancelAnimationFrame(this.monitoringRaf);
      this.monitoringRaf = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.micLevel = 0;
    if (this.audioLevelCallback) {
      this.audioLevelCallback(0);
    }
  }

  // ============================================
  // Remote Audio Playback
  // ============================================

  /**
   * Handle remote stream by attaching to audio element and playing
   */
  handleRemoteStream(remoteStream: MediaStream): void {
    if (import.meta.env.DEV) {
      console.debug('[AudioStreamManager] handleRemoteStream called', {
        hasElement: !!this.remoteAudioElement,
        streamActive: remoteStream.active,
        audioTracks: remoteStream.getAudioTracks().length
      });
    }
    
    if (!this.remoteAudioElement) {
      console.error('[AudioStreamManager] No remote audio element attached!');
      return;
    }

    this.remoteAudioElement.srcObject = remoteStream;
    if (import.meta.env.DEV) {
      console.debug('[AudioStreamManager] Set srcObject on audio element');
    }
    this.applyRemoteFadeIn(this.remoteAudioElement);

    const el = this.remoteAudioElement;
    const play = () => el.play().catch(() => {});

    if (el.readyState >= 2) {
      play();
    } else {
      const handler = () => {
        el.removeEventListener('canplay', handler);
        play();
      };
      el.addEventListener('canplay', handler);
    }
  }

  /**
   * Apply fade-in effect to remote audio element
   * Smoothly ramps volume from 0 to target over 240ms
   */
  applyRemoteFadeIn(element: HTMLAudioElement): void {
    const target = Math.min(1, Math.max(0.2, element.volume || 1));
    element.volume = 0.0001;

    // Cancel any existing fade
    if (this.remoteFadeRaf !== null) {
      try {
        cancelAnimationFrame(this.remoteFadeRaf);
      } catch {}
      this.remoteFadeRaf = null;
    }

    const fadeDurationMs = 240;
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / fadeDurationMs);
      const eased = progress < 1 ? (1 - Math.cos(progress * Math.PI)) / 2 : 1;
      element.volume = Math.min(target, target * eased);

      if (progress < 1) {
        this.remoteFadeRaf = requestAnimationFrame(step);
      } else {
        this.remoteFadeRaf = null;
        element.volume = target;
      }
    };

    this.remoteFadeRaf = requestAnimationFrame(step);
  }

  /**
   * Cancel any active remote audio fade
   */
  cancelRemoteFade(): void {
    if (this.remoteFadeRaf !== null) {
      try {
        cancelAnimationFrame(this.remoteFadeRaf);
      } catch {}
      this.remoteFadeRaf = null;
    }
  }

  // ============================================
  // Snapshot
  // ============================================

  /**
   * Get a snapshot of current audio state
   */
  getSnapshot(): AudioStreamSnapshot {
    return {
      hasMicStream: this.micStream !== null,
      hasAudioContext: this.audioContext !== null,
      hasRemoteAudioElement: this.remoteAudioElement !== null,
      currentMicLevel: this.micLevel,
      isMonitoring: this.monitoringActive,
      remoteAudioVolume: this.remoteAudioElement?.volume ?? null,
      remoteAudioPaused: this.remoteAudioElement?.paused ?? null,
    };
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Stop monitoring and clean up audio resources
   */
  cleanup(): void {
    // Stop monitoring
    this.stopMeter();

    // Cancel remote fade
    this.cancelRemoteFade();

    // Clean up microphone stream
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      this.micStream = null;
    }

    // Clean up remote audio
    if (this.remoteAudioElement) {
      try {
        this.remoteAudioElement.pause();
        this.remoteAudioElement.srcObject = null;
      } catch {}
    }

    this.micLevel = 0;
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.cleanup();
  }
}
