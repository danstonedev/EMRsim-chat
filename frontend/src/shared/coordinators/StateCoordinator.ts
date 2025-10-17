import type { ConnectionOrchestrator } from '../managers/ConnectionOrchestrator'
import type { MicrophoneControlManager } from '../managers/MicrophoneControlManager'
import type { AudioStreamManager } from '../services/AudioStreamManager'
import type { SessionReuseHandlers } from '../../features/voice/conversation/connection/reuseGuard'

/**
 * StateCoordinator - Phase 9 Module
 *
 * Centralizes state management helper methods that coordinate across multiple managers.
 * Extracts delegation logic for:
 * - Operation epoch validation (stale operation checks)
 * - Initial assistant guard reset and release coordination
 * - Session reuse handling
 * - Microphone pause state application
 *
 * This coordinator acts as a thin orchestration layer for state-related operations
 * that involve multiple services, keeping the ConversationController focused on
 * high-level flow control.
 *
 * Dependencies:
 * - ConnectionOrchestrator: Operation epoch management
 * - MicrophoneControlManager: Mic pause state
 * - AudioStreamManager: Access to mic stream
 * - SessionReuseHandlers: Guard reset/release logic
 */

export interface StateCoordinatorDeps {
  connectionOrchestrator: ConnectionOrchestrator
  micControl: MicrophoneControlManager
  audioManager: AudioStreamManager
  sessionReuseHandlers: SessionReuseHandlers
}

export class StateCoordinator {
  constructor(private deps: StateCoordinatorDeps) {}

  /**
   * Check if an operation number is stale (invalidated by newer connection attempts)
   */
  isOpStale(op: number): boolean {
    return this.deps.connectionOrchestrator.isOpStale(op)
  }

  /**
   * Invalidate all current operations (increment epoch)
   */
  invalidateOps(): void {
    this.deps.connectionOrchestrator.invalidateOps()
  }

  /**
   * Reset initial assistant guards across both mic control and session reuse handlers
   */
  resetInitialAssistantGuards(): void {
    this.deps.micControl.resetInitialAssistantGuards()
    this.deps.sessionReuseHandlers.resetInitialAssistantGuards()
  }

  /**
   * Schedule delayed release of initial assistant auto-pause
   */
  scheduleInitialAssistantRelease(trigger: string, delayMs = 350): void {
    this.deps.sessionReuseHandlers.scheduleInitialAssistantRelease(trigger, delayMs)
  }

  /**
   * Immediately release initial assistant auto-pause
   */
  releaseInitialAssistantAutoPause(trigger: string): void {
    this.deps.sessionReuseHandlers.releaseInitialAssistantAutoPause(trigger)
  }

  /**
   * Handle session reuse event
   */
  handleSessionReuse(reused: boolean): void {
    this.deps.sessionReuseHandlers.handleSessionReuse(reused)
  }

  /**
   * Set auto mic pause state and apply to mic stream
   */
  setAutoMicPaused(reason: string, paused: boolean): void {
    this.deps.micControl.setAutoMicPaused(reason, paused)
    this.applyMicPausedState('auto', reason)
  }

  /**
   * Apply mic paused state to the mic stream
   */
  applyMicPausedState(source: 'user' | 'auto', reason?: string): void {
    const micStream = this.deps.audioManager.getMicStream()
    this.deps.micControl.applyMicPausedState(source, reason, micStream)
  }
}
