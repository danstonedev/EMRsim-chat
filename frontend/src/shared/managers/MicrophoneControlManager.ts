import { logControllerWarning } from '../../features/voice/conversation/config/safeInvoke'

/**
 * MicrophoneControlManager
 *
 * Manages microphone pause/resume state and initial assistant guard logic.
 * Extracted from ConversationController (Phase 3.3).
 *
 * Responsibilities:
 * - User-initiated mic pause/resume
 * - Auto mic pause reasons tracking
 * - Initial assistant guard (prevents barge-in during first response)
 * - Remote volume guard state
 * - Mic state event callbacks
 */

export interface MicrophoneStateCallbacks {
  onMicPauseChange?: (paused: boolean, source: 'user' | 'auto', reason?: string) => void
  onMicLevelZero?: () => void
}

export interface MicrophoneControlOptions {
  callbacks?: MicrophoneStateCallbacks
}

export class MicrophoneControlManager {
  // Mic pause state
  private micPaused = false
  private userMicPaused = false
  private autoMicPauseReasons = new Set<string>()

  // Initial assistant guard (prevents barge-in during first response)
  private initialAssistantAutoPauseActive = false
  private initialAssistantGuardUsed = false
  private initialAssistantReleaseTimer: ReturnType<typeof setTimeout> | null = null

  // Remote volume guard (preserves volume before guard)
  private remoteVolumeBeforeGuard: number | null = null

  // Callbacks
  private callbacks: MicrophoneStateCallbacks

  constructor(options: MicrophoneControlOptions = {}) {
    this.callbacks = options.callbacks ?? {}
  }

  // ===========================
  // Public API
  // ===========================

  isMicPaused(): boolean {
    return this.micPaused
  }

  setUserMicPaused(paused: boolean): void {
    if (this.userMicPaused === paused) return
    this.userMicPaused = paused
    this.applyMicPausedState('user', 'manual')
  }

  setAutoMicPaused(reason: string, paused: boolean): void {
    const hasReason = this.autoMicPauseReasons.has(reason)
    if (paused) {
      if (!hasReason) {
        this.autoMicPauseReasons.add(reason)
      }
    } else if (hasReason) {
      this.autoMicPauseReasons.delete(reason)
    }
    this.applyMicPausedState('auto', reason)
  }

  hasAutoMicPauseReason(reason: string): boolean {
    return this.autoMicPauseReasons.has(reason)
  }

  /**
   * Applies the mic pause state by toggling mic stream tracks.
   * Delegates to callback for actual track manipulation.
   */
  applyMicPausedState(
    source: 'user' | 'auto',
    reason?: string,
    micStream?: MediaStream | null
  ): void {
    const shouldPause = this.userMicPaused || this.autoMicPauseReasons.size > 0
    if (this.micPaused === shouldPause) return
    this.micPaused = shouldPause

    // Toggle mic stream tracks if provided
    if (micStream) {
      micStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
        try {
          track.enabled = !shouldPause
        } catch (err) {
          logControllerWarning('Failed to toggle track state during mic pause', err)
        }
      })
    }

    // Emit callbacks
    if (shouldPause && this.callbacks.onMicLevelZero) {
      this.callbacks.onMicLevelZero()
    }

    if (this.callbacks.onMicPauseChange) {
      this.callbacks.onMicPauseChange(shouldPause, source, reason)
    }
  }

  // ===========================
  // Initial Assistant Guard
  // ===========================

  getInitialAssistantAutoPauseActive(): boolean {
    return this.initialAssistantAutoPauseActive
  }

  setInitialAssistantAutoPauseActive(value: boolean): void {
    this.initialAssistantAutoPauseActive = value
  }

  getInitialAssistantGuardUsed(): boolean {
    return this.initialAssistantGuardUsed
  }

  setInitialAssistantGuardUsed(value: boolean): void {
    this.initialAssistantGuardUsed = value
  }

  getInitialAssistantReleaseTimer(): ReturnType<typeof setTimeout> | null {
    return this.initialAssistantReleaseTimer
  }

  setInitialAssistantReleaseTimer(timer: ReturnType<typeof setTimeout> | null): void {
    this.initialAssistantReleaseTimer = timer
  }

  clearInitialAssistantReleaseTimer(): void {
    if (this.initialAssistantReleaseTimer) {
      clearTimeout(this.initialAssistantReleaseTimer)
      this.initialAssistantReleaseTimer = null
    }
  }

  // ===========================
  // Remote Volume Guard
  // ===========================

  getRemoteVolumeBeforeGuard(): number | null {
    return this.remoteVolumeBeforeGuard
  }

  setRemoteVolumeBeforeGuard(value: number | null): void {
    this.remoteVolumeBeforeGuard = value
  }

  // ===========================
  // Reset/Cleanup
  // ===========================

  resetInitialAssistantGuards(): void {
    this.clearInitialAssistantReleaseTimer()
    this.initialAssistantAutoPauseActive = false
    this.initialAssistantGuardUsed = false
  }

  cleanup(): void {
    this.clearInitialAssistantReleaseTimer()
    this.autoMicPauseReasons.clear()
    this.userMicPaused = false
    this.micPaused = false
    this.initialAssistantAutoPauseActive = false
    this.initialAssistantGuardUsed = false
    this.remoteVolumeBeforeGuard = null
  }
}
