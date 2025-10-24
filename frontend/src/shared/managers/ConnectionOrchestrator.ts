/**
 * ConnectionOrchestrator
 *
 * Manages voice connection lifecycle and operation invalidation.
 * Extracted from ConversationController (Phase 3.4).
 *
 * Responsibilities:
 * - Operation epoch management (prevents stale operations)
 * - Connection retry tracking
 * - Start/stop voice coordination
 * - Connection flow orchestration
 */

import type { VoiceStatus } from '../types'

export interface ConnectionCallbacks {
  onStart?: (op: number) => Promise<void>
  onStop?: () => void
  onCleanup?: () => void
  onStatusUpdate?: (status: VoiceStatus, error: string | null) => void
}

export interface ConnectionOrchestratorOptions {
  maxRetries?: number
  callbacks?: ConnectionCallbacks
}

export class ConnectionOrchestrator {
  private opEpoch = 0
  private connectRetryCount = 0
  private readonly maxRetries: number
  private callbacks: ConnectionCallbacks

  constructor(options: ConnectionOrchestratorOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3
    this.callbacks = options.callbacks ?? {}
  }

  // ===========================
  // Operation Epoch Management
  // ===========================

  /**
   * Generates the next operation ID.
   * Each call to startVoice gets a new op ID to prevent stale operations.
   */
  nextOp(): number {
    return ++this.opEpoch
  }

  /**
   * Checks if an operation is stale (has been superseded).
   */
  isOpStale(op: number): boolean {
    return this.opEpoch !== op
  }

  /**
   * Invalidates all pending operations.
   * Called when stopping voice or starting a new connection.
   */
  invalidateOps(): void {
    this.opEpoch += 1
  }

  // ===========================
  // Connection Retry Management
  // ===========================

  getConnectRetryCount(): number {
    return this.connectRetryCount
  }

  setConnectRetryCount(count: number): void {
    this.connectRetryCount = count
  }

  resetRetryCount(): void {
    this.connectRetryCount = 0
  }

  getMaxRetries(): number {
    return this.maxRetries
  }

  // ===========================
  // Connection Lifecycle
  // ===========================

  /**
   * Starts a new voice connection.
   * Returns the operation ID for this connection attempt.
   */
  async startConnection(): Promise<number> {
    const myOp = this.nextOp()
    this.resetRetryCount()

    if (this.callbacks.onStart) {
      await this.callbacks.onStart(myOp)
    }

    return myOp
  }

  /**
   * Stops the current voice connection.
   * Invalidates all pending operations and triggers cleanup.
   */
  stopConnection(): void {
    this.invalidateOps()

    if (this.callbacks.onCleanup) {
      this.callbacks.onCleanup()
    }

    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate('idle', null)
    }

    if (this.callbacks.onStop) {
      this.callbacks.onStop()
    }
  }

  /**
   * Schedules a connection retry after a delay.
   */
  scheduleRetry(op: number, delayMs: number, retryFn: (op: number) => Promise<void>): void {
    setTimeout(() => {
      void retryFn(op)
    }, delayMs)
  }
}
