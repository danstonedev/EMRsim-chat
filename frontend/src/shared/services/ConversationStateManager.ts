import { VoiceStatus } from '../types';

/**
 * Manages conversation state transitions and maintains current status
 * Handles state validation, ready flags, and status change notifications
 */
export class ConversationStateManager {
  private status: VoiceStatus = 'idle';
  private error: string | null = null;
  private sessionReady: boolean = false;
  private connected: boolean = false;
  private fullyReady: boolean = false;
  private awaitingSessionAck: boolean = false;
  private sessionAckTimeout: ReturnType<typeof setTimeout> | null = null;

  // Status change callbacks
  private statusChangeCallbacks: ((status: VoiceStatus, error: string | null) => void)[] = [];

  /**
   * Get the current conversation status
   */
  getStatus(): VoiceStatus {
    return this.status;
  }

  /**
   * Get the current error message if any
   */
  getError(): string | null {
    return this.error;
  }

  /**
   * Update the conversation status and error state
   * Validates transitions and notifies listeners
   *
   * @param status New status to set
   * @param error Error message or null if no error
   * @returns True if transition was valid and executed
   */
  updateStatus(status: VoiceStatus, error: string | null): boolean {
    if (!this.validateTransition(this.status, status)) {
      console.warn(`Invalid state transition: ${this.status} -> ${status}`);
      return false;
    }

    const previousStatus = this.status;
    this.status = status;
    this.error = error;

    // Update connected flag based on status
    if (status === 'connected') {
      this.connected = true;
    } else if (status === 'idle' || status === 'error') {
      this.connected = false;
    }

    // Notify listeners of the change
    if (previousStatus !== status || this.error !== error) {
      this.notifyStatusChange();
    }

    return true;
  }

  /**
   * Check if a state transition is valid
   *
   * @param from Current status
   * @param to Target status
   * @returns True if transition is valid
   */
  private validateTransition(from: VoiceStatus, to: VoiceStatus): boolean {
    // Self-transitions always allowed
    if (from === to) return true;

    // Valid transitions
    switch (from) {
      case 'idle':
        return to === 'connecting' || to === 'error';
      case 'connecting':
        return to === 'connected' || to === 'error' || to === 'idle';
      case 'connected':
        return to === 'connecting' || to === 'error' || to === 'idle';
      case 'error':
        return to === 'idle' || to === 'connecting';
    }

    return false;
  }

  /**
   * Check if the session is ready for communication
   */
  isSessionReady(): boolean {
    return this.sessionReady;
  }

  /**
   * Check if WebRTC connection is established
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Check if the conversation is fully ready (all prerequisites satisfied)
   */
  isFullyReady(): boolean {
    return this.fullyReady;
  }

  /**
   * Check if waiting for session acknowledgement
   */
  isAwaitingSessionAck(): boolean {
    return this.awaitingSessionAck;
  }

  /**
   * Mark the session as ready for communication
   *
   * @param ready Whether session is ready
   * @param trigger Optional string identifying what triggered the change
   */
  setSessionReady(ready: boolean, _trigger?: string): void {
    void _trigger;
    if (this.sessionReady === ready) return;
    this.sessionReady = ready;

    if (ready && this.sessionAckTimeout !== null) {
      clearTimeout(this.sessionAckTimeout);
      this.sessionAckTimeout = null;
    }
  }

  /**
   * Set the connected state
   *
   * @param connected Whether WebRTC connection is established
   */
  setConnected(connected: boolean): void {
    if (this.connected === connected) return;
    this.connected = connected;

    // Update status based on connection
    if (connected && this.status !== 'connected') {
      this.updateStatus('connected', null);
    } else if (!connected && this.status === 'connected') {
      this.updateStatus('connecting', null);
    }
  }

  /**
   * Set the fully ready state (all prerequisites satisfied)
   *
   * @param ready Whether system is fully ready
   */
  setFullyReady(ready: boolean): void {
    if (this.fullyReady === ready) return;
    this.fullyReady = ready;
  }

  /**
   * Set whether we're waiting for session acknowledgement
   * Optionally start a timeout that will auto-complete after specified delay
   *
   * @param awaiting Whether we're awaiting ack
   * @param timeoutMs Optional timeout in ms to auto-complete
   * @param onTimeout Function to call if timeout occurs
   */
  setAwaitingSessionAck(awaiting: boolean, timeoutMs?: number, onTimeout?: () => void): void {
    if (this.awaitingSessionAck === awaiting) return;
    this.awaitingSessionAck = awaiting;

    // Clear any existing timeout
    if (this.sessionAckTimeout !== null) {
      clearTimeout(this.sessionAckTimeout);
      this.sessionAckTimeout = null;
    }

    // Set new timeout if awaiting and timeout specified
    if (awaiting && timeoutMs && timeoutMs > 0 && onTimeout) {
      this.sessionAckTimeout = setTimeout(() => {
        this.sessionAckTimeout = null;
        this.awaitingSessionAck = false;
        onTimeout();
      }, timeoutMs);
    }
  }

  /**
   * Reset all state flags to initial values
   */
  reset(): void {
    // Cancel any pending timeout
    if (this.sessionAckTimeout !== null) {
      clearTimeout(this.sessionAckTimeout);
      this.sessionAckTimeout = null;
    }

    this.sessionReady = false;
    this.connected = false;
    this.fullyReady = false;
    this.awaitingSessionAck = false;
    this.status = 'idle';
    this.error = null;

    // Notify status change to idle
    this.notifyStatusChange();
  }

  /**
   * Register a callback for status changes
   *
   * @param callback Function to call on status change
   * @returns Function to unregister the callback
   */
  onStatusChange(callback: (status: VoiceStatus, error: string | null) => void): () => void {
    this.statusChangeCallbacks.push(callback);

    // Immediately notify with current status
    callback(this.status, this.error);

    // Return unsubscribe function
    return () => {
      this.statusChangeCallbacks = this.statusChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all status change listeners
   */
  private notifyStatusChange(): void {
    const { status, error } = this;
    this.statusChangeCallbacks.forEach(callback => {
      try {
        callback(status, error);
      } catch (err) {
        console.error('Error in status change callback:', err);
      }
    });
  }

  /**
   * Get a snapshot of the current state
   */
  getSnapshot(): {
    status: VoiceStatus;
    error: string | null;
    sessionReady: boolean;
    connected: boolean;
    fullyReady: boolean;
    awaitingSessionAck: boolean;
  } {
    return {
      status: this.status,
      error: this.error,
      sessionReady: this.sessionReady,
      connected: this.connected,
      fullyReady: this.fullyReady,
      awaitingSessionAck: this.awaitingSessionAck,
    };
  }
}
