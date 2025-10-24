import type { ConversationEvent, ConversationListener, VoiceDebugEvent, ConversationDebugListener } from '../types'

/**
 * Manages event emission and subscription for the conversation system
 * Handles both regular conversation events and debug events
 */
export class ConversationEventEmitter {
  private readonly listeners = new Set<ConversationListener>()
  private readonly debugListeners = new Set<ConversationDebugListener>()
  private debugBacklog: VoiceDebugEvent[] = []
  private debugBacklogDeliveredUntil: number = 0
  private readonly maxDebugBacklog: number
  private debugEnabled: boolean

  /**
   * Creates a new ConversationEventEmitter
   *
   * @param debugEnabled - Whether debug events should be emitted immediately
   * @param maxDebugBacklog - Maximum number of debug events to keep in backlog
   */
  constructor(debugEnabled = false, maxDebugBacklog = 500) {
    this.debugEnabled = debugEnabled
    this.maxDebugBacklog = maxDebugBacklog
  }

  /**
   * Emits a conversation event to all registered listeners
   *
   * @param event - The conversation event to emit
   */
  emit(event: ConversationEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in conversation event listener:', error)
      }
    })
  }

  /**
   * Emits a debug event to all registered debug listeners if debug is enabled
   * Always adds the event to the debug backlog
   *
   * @param event - The debug event to emit
   */
  emitDebug(event: VoiceDebugEvent): void {
    // Always record to backlog
    this.debugBacklog.push(event)

    // Trim backlog if over capacity and adjust delivered pointer
    if (this.debugBacklog.length > this.maxDebugBacklog) {
      const overflow = this.debugBacklog.length - this.maxDebugBacklog
      this.debugBacklog.splice(0, overflow)
      this.debugBacklogDeliveredUntil = Math.max(0, this.debugBacklogDeliveredUntil - overflow)
    }

    // Only emit to listeners when enabled
    if (!this.debugEnabled) return

    this.debugListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in debug event listener:', error)
      }
    })

    // Mark everything delivered up to current end
    this.debugBacklogDeliveredUntil = this.debugBacklog.length
  }

  /**
   * Adds a listener for conversation events
   * Immediately calls the listener with any current state events
   *
   * @param listener - The listener function to add
   * @returns A function to remove the listener
   */
  addListener(listener: ConversationListener): () => void {
    this.listeners.add(listener)

    return () => this.listeners.delete(listener)
  }

  /**
   * Adds a listener for debug events
   * If debug is enabled, immediately delivers the backlog to this listener
   *
   * @param listener - The debug listener function to add
   * @returns A function to remove the listener
   */
  addDebugListener(listener: ConversationDebugListener): () => void {
    this.debugListeners.add(listener)

    // If debug is currently enabled, immediately backfill the backlog to this new listener
    if (this.debugEnabled && this.debugBacklog.length > 0) {
      try {
        this.debugBacklog.forEach(ev => listener(ev))
      } catch (error) {
        console.error('Error delivering debug backlog to new listener:', error)
      }
    }

    return () => this.debugListeners.delete(listener)
  }

  /**
   * Enables or disables debug event emission
   * When enabling, delivers any backlogged events to listeners
   *
   * @param enabled - Whether debug events should be emitted
   */
  enableDebug(enabled: boolean): void {
    if (this.debugEnabled === enabled) return

    this.debugEnabled = enabled

    if (enabled) {
      // When enabling, flush any backlog accumulated while disabled
      if (this.debugListeners.size > 0) {
        const pending = this.debugBacklog.slice(this.debugBacklogDeliveredUntil)
        if (pending.length) {
          this.debugListeners.forEach(listener => {
            try {
              pending.forEach(ev => listener(ev))
            } catch (error) {
              console.error('Error delivering backlog on debug enable:', error)
            }
          })
          this.debugBacklogDeliveredUntil = this.debugBacklog.length
        }
      }

      // Emit a debug enabled event
      this.emitDebug({
        t: new Date().toISOString(),
        kind: 'info',
        src: 'app',
        msg: 'debug enabled',
      })
    }
  }

  /**
   * Returns whether debug is currently enabled
   *
   * @returns True if debug is enabled
   */
  isDebugEnabled(): boolean {
    return this.debugEnabled
  }

  /**
   * Gets a copy of the current debug event backlog
   *
   * @returns Array of debug events
   */
  getBacklog(): VoiceDebugEvent[] {
    return [...this.debugBacklog]
  }

  /**
   * Returns the number of active conversation listeners
   */
  getListenerCount(): number {
    return this.listeners.size
  }

  /**
   * Returns the number of active debug listeners
   */
  getDebugListenerCount(): number {
    return this.debugListeners.size
  }

  /**
   * Clears all listeners
   */
  dispose(): void {
    this.listeners.clear()
    this.debugListeners.clear()
  }
}
