import type { ConversationEventEmitter } from '../services/ConversationEventEmitter'

/**
 * Dependencies required by DataChannelConfigurator
 */
export interface DataChannelConfiguratorDependencies {
  eventEmitter: ConversationEventEmitter
  pingInterval: number | null
  setPingInterval: (interval: number | null) => void
  refreshInstructions: (reason: string) => Promise<void>
  ensureSessionAckTimeout: () => void
  handleMessage: (data: string) => void
  logDebug: (...args: unknown[]) => void
}

/**
 * DataChannelConfigurator - Configures WebRTC data channel event callbacks
 * 
 * Responsibilities:
 * - Configure onOpen callback (enable transcription, refresh instructions)
 * - Configure onMessage callback (delegate to message handler)
 * - Configure onError callback (emit debug events)
 * - Configure onClose callback (cleanup ping interval)
 * 
 * Benefits of extraction:
 * - Isolates data channel configuration logic from constructor
 * - Easier to test data channel behavior
 * - Clear separation of concerns (configuration vs initialization)
 * - Reduces ConversationController constructor complexity
 * 
 * Example usage:
 * ```typescript
 * const configurator = new DataChannelConfigurator({
 *   eventEmitter: this.eventEmitter,
 *   pingInterval: this.pingInterval,
 *   setPingInterval: (interval) => { this.pingInterval = interval },
 *   refreshInstructions: (reason) => this.refreshInstructions(reason),
 *   ensureSessionAckTimeout: () => this.ensureSessionAckTimeout(),
 *   handleMessage: (data) => this.handleMessage(data),
 *   logDebug: (...args) => this.logDebug(...args),
 * })
 * 
 * this.webrtcManager.setDataChannelCallbacks(
 *   configurator.createDataChannelCallbacks()
 * )
 * ```
 */
export class DataChannelConfigurator {
  constructor(private readonly deps: DataChannelConfiguratorDependencies) {}

  /**
   * Create data channel event callbacks for WebRTCConnectionManager
   * 
   * Returns callbacks object with:
   * - onOpen: Enable transcription & audio modalities, refresh instructions
   * - onMessage: Delegate to event dispatcher
   * - onError: Emit debug events with channel state
   * - onClose: Cleanup ping interval, emit debug event
   */
  createDataChannelCallbacks(): {
    onOpen: (channel: RTCDataChannel) => void
    onMessage: (data: string) => void
    onError: (channel: RTCDataChannel, event: Event) => void
    onClose: (channel: RTCDataChannel) => void
  } {
    return {
      onOpen: channel => this.handleOpen(channel),
      onMessage: data => this.handleMessage(data),
      onError: (channel, event) => this.handleError(channel, event),
      onClose: channel => this.handleClose(channel),
    }
  }

  /**
   * Handle data channel open event
   * 
   * Actions:
   * 1. Emit debug event
   * 2. Clear ping interval if exists
   * 3. Refresh instructions (datachannel.open trigger)
   * 4. Ensure session ack timeout
   * 5. Send session.update to enable transcription & audio modalities
   * 
   * @param channel - The opened data channel
   */
  private handleOpen(channel: RTCDataChannel): void {
    this.deps.eventEmitter.emitDebug({
      t: new Date().toISOString(),
      kind: 'event',
      src: 'dc',
      msg: 'open',
    })

    // Clear existing ping interval
    if (this.deps.pingInterval != null) {
      clearInterval(this.deps.pingInterval)
      this.deps.setPingInterval(null)
    }

    // Refresh instructions and ensure session ack timeout
    this.deps.refreshInstructions('datachannel.open').catch(() => {})
    this.deps.ensureSessionAckTimeout()

    // Enable transcription and audio modalities
    this.enableTranscriptionAndAudio(channel)
  }

  /**
   * Send session.update to enable transcription AND audio modalities
   * 
   * This is critical for ensuring the OpenAI Realtime API provides both:
   * - Audio responses (for playback)
   * - Text transcriptions (for chat UI)
   * 
   * @param channel - The data channel to send update through
   */
  private enableTranscriptionAndAudio(channel: RTCDataChannel): void {
    this.deps.logDebug(
      '[DataChannelConfigurator] Data channel opened, sending session.update for transcription & audio'
    )

    try {
      const updateMsg = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
        },
      }
      channel.send(JSON.stringify(updateMsg))
      this.deps.logDebug(
        '[DataChannelConfigurator] Transcription & audio modalities enabled via session.update on channel open'
      )
    } catch (err) {
      console.error('[DataChannelConfigurator] Failed to enable transcription on channel open:', err)
    }
  }

  /**
   * Handle incoming data channel message
   * Delegates to EventDispatcher via handleMessage callback
   * 
   * @param data - Raw JSON string from data channel
   */
  private handleMessage(data: string): void {
    this.deps.handleMessage(data)
  }

  /**
   * Handle data channel error event
   * Emits debug event with channel state details
   * 
   * @param channel - The data channel that errored
   * @param event - The error event
   */
  private handleError(channel: RTCDataChannel, event: Event): void {
    const desc = `error rs=${channel.readyState} buf=${channel.bufferedAmount} label=${channel.label}`
    const kind: 'warn' | 'error' = channel.readyState === 'open' ? 'warn' : 'error'

    this.deps.eventEmitter.emitDebug({
      t: new Date().toISOString(),
      kind,
      src: 'dc',
      msg: desc,
      data: {
        readyState: channel.readyState,
        bufferedAmount: channel.bufferedAmount,
        label: channel.label,
        event,
      },
    })
  }

  /**
   * Handle data channel close event
   * Clears ping interval and emits debug event
   * 
   * @param channel - The closed data channel
   */
  private handleClose(channel: RTCDataChannel): void {
    this.deps.eventEmitter.emitDebug({
      t: new Date().toISOString(),
      kind: 'warn',
      src: 'dc',
      msg: `close:${channel.label}:${channel.readyState}`,
    })

    // Clear ping interval when channel closes
    if (this.deps.pingInterval != null) {
      clearInterval(this.deps.pingInterval)
      this.deps.setPingInterval(null)
    }
  }
}
