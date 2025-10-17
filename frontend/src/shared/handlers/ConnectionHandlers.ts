import type { ConversationEventEmitter } from '../services/ConversationEventEmitter'
import type { ConversationStateManager } from '../services/ConversationStateManager'
import type { WebRTCConnectionManager } from '../services/WebRTCConnectionManager'
import type { TransportLoggerEntry } from '../transport/RealtimeTransport'

/**
 * Dependencies required by ConnectionHandlers.
 */
export interface ConnectionHandlersDependencies {
  eventEmitter: ConversationEventEmitter
  stateManager: ConversationStateManager
  webrtcManager: WebRTCConnectionManager
}

/**
 * ConnectionHandlers
 *
 * Handles WebRTC connection state changes and transport logging for the ConversationController.
 * This module centralizes all connection state management logic, making it easier to test,
 * maintain, and understand connection lifecycle behavior.
 *
 * **Responsibilities:**
 * - Handle ICE connection state changes (connected, disconnected, failed, etc.)
 * - Handle peer connection state changes (failed, disconnected, etc.)
 * - Log transport events for debugging and monitoring
 * - Emit debug events for connection state transitions
 * - Update conversation state based on connection changes
 *
 * **Key Features:**
 * - ✅ **Connection Monitoring:** Tracks ICE and peer connection states
 * - ✅ **Error Detection:** Detects connection failures and degradation
 * - ✅ **Debug Logging:** Comprehensive debug events for troubleshooting
 * - ✅ **State Synchronization:** Updates ConversationStateManager on state changes
 * - ✅ **Data Channel Warning:** Warns if data channel doesn't open after ICE connection
 *
 * **Usage Example:**
 * ```typescript
 * const connectionHandlers = new ConnectionHandlers({
 *   eventEmitter: this.eventEmitter,
 *   stateManager: this.stateManager,
 *   webrtcManager: this.webrtcManager,
 * })
 *
 * // Use with WebRTCConnectionManager
 * this.webrtcManager.setConnectionStateCallbacks({
 *   onIceConnectionStateChange: state => connectionHandlers.handleIceConnectionStateChange(state),
 *   onConnectionStateChange: state => connectionHandlers.handleConnectionStateChange(state),
 *   onRemoteStream: stream => this.audioManager.handleRemoteStream(stream),
 * })
 *
 * // Use with RealtimeTransport
 * const transport = new SomeRealtimeTransport({
 *   logTransport: entry => connectionHandlers.logTransport(entry),
 *   // ... other config
 * })
 * ```
 *
 * **Connection State Flow:**
 * ```
 * ICE Connection States:
 *   new → checking → connected/completed → (disconnected) → (failed)
 *
 * Peer Connection States:
 *   new → connecting → connected → (disconnected) → (failed) → closed
 *
 * Handler Actions:
 *   connected/completed → Update state to 'connected', check data channel after 2s
 *   disconnected → Emit warning, monitor for recovery
 *   failed → Update state to 'error', connection_failed
 * ```
 *
 * **Debug Event Types:**
 * - `iceconnectionstatechange:{state}` - ICE connection state changed
 * - `connectionstatechange:{state}` - Peer connection state changed
 * - `connection degraded: {state}` - Warning for disconnected/failed ICE states
 * - `datachannel not open within 2s after ICE connected` - Data channel timeout warning
 *
 * @see ConversationController - Main orchestrator that uses this handler
 * @see WebRTCConnectionManager - Manages WebRTC connections and triggers callbacks
 * @see ConversationStateManager - Maintains conversation state (connected, error, etc.)
 */
export class ConnectionHandlers {
  constructor(private readonly deps: ConnectionHandlersDependencies) {}

  /**
   * Handle ICE connection state changes.
   *
   * ICE (Interactive Connectivity Establishment) is the protocol WebRTC uses to establish
   * peer-to-peer connections. This handler monitors ICE state transitions and updates
   * the conversation state accordingly.
   *
   * **State Transitions:**
   * - `new` → Initial state before ICE gathering starts
   * - `checking` → ICE candidates are being checked
   * - `connected` → At least one ICE candidate pair is working
   * - `completed` → All ICE candidate pairs have been checked (optimal connection found)
   * - `disconnected` → ICE connection lost, may recover automatically
   * - `failed` → ICE connection failed, cannot recover without restart
   * - `closed` → Connection closed intentionally
   *
   * **Actions Taken:**
   * - `connected` or `completed`:
   *   - Mark conversation as connected (if not already)
   *   - Update status to 'connected'
   *   - Schedule data channel check after 2 seconds (warn if not open)
   * - `disconnected`:
   *   - Emit warning (connection may recover)
   * - `failed`:
   *   - Emit warning
   *   - Update status to 'error' with reason 'connection_failed_{state}'
   *
   * @param state - ICE connection state from RTCPeerConnection
   */
  handleIceConnectionStateChange(state: RTCIceConnectionState): void {
    // Emit debug event for all ICE state changes
    this.deps.eventEmitter.emitDebug({
      t: new Date().toISOString(),
      kind: 'event',
      src: 'pc',
      msg: `iceconnectionstatechange:${state}`,
    })

    if (state === 'connected' || state === 'completed') {
      // Connection established successfully
      if (!this.deps.stateManager.isConnected()) {
        this.deps.stateManager.setConnected(true)
        this.deps.stateManager.updateStatus('connected', null)

        // Warn if data channel doesn't open within 2 seconds after ICE connection
        setTimeout(() => {
          const anyOpen = this.deps.webrtcManager.hasOpenChannel()
          if (!anyOpen) {
            this.deps.eventEmitter.emitDebug({
              t: new Date().toISOString(),
              kind: 'warn',
              src: 'dc',
              msg: 'datachannel not open within 2s after ICE connected',
            })
          }
        }, 2000)
      }
    } else if (state === 'disconnected' || state === 'failed') {
      // Connection degraded or failed
      this.deps.eventEmitter.emitDebug({
        t: new Date().toISOString(),
        kind: 'warn',
        src: 'pc',
        msg: `connection degraded: ${state}`,
      })

      if (state === 'failed') {
        // Connection failed permanently, update status to error
        this.deps.stateManager.updateStatus('error', `connection_failed_${state}`)
      }
    }
  }

  /**
   * Handle peer connection state changes.
   *
   * The RTCPeerConnection state represents the overall connection status, combining
   * ICE, DTLS, and signaling state. This is a higher-level state than ICE alone.
   *
   * **State Transitions:**
   * - `new` → Initial state, no connection attempt yet
   * - `connecting` → Connection negotiation in progress
   * - `connected` → Connection established and ready
   * - `disconnected` → Connection lost, may recover
   * - `failed` → Connection failed permanently
   * - `closed` → Connection closed intentionally
   *
   * **Actions Taken:**
   * - `failed` or `disconnected`:
   *   - Update conversation status to 'error' with the state as reason
   *   - Emit debug event
   *
   * @param state - Peer connection state from RTCPeerConnection
   */
  handleConnectionStateChange(state: RTCPeerConnectionState): void {
    // Emit debug event for all connection state changes
    this.deps.eventEmitter.emitDebug({
      t: new Date().toISOString(),
      kind: 'event',
      src: 'pc',
      msg: `connectionstatechange:${state}`,
    })

    if (state === 'failed' || state === 'disconnected') {
      // Connection failed or disconnected, update status
      this.deps.stateManager.updateStatus('error', state)
    }
  }

  /**
   * Log transport events for debugging and monitoring.
   *
   * RealtimeTransport implementations (WebRTC, WebSocket, etc.) emit log entries
   * for important events, errors, and state changes. This method converts transport
   * log entries into ConversationController debug events.
   *
   * **Transport Sources:**
   * - `pc` → Peer connection (RTCPeerConnection)
   * - `dc` → Data channel (RTCDataChannel)
   * - Other sources are mapped to `app`
   *
   * **Log Kinds:**
   * - `event` → Normal informational event
   * - `warn` → Warning (degraded state, potential issue)
   * - `error` → Error (connection failure, message failure, etc.)
   *
   * @param entry - Transport log entry with timestamp, kind, source, message, and optional data
   */
  logTransport(entry: TransportLoggerEntry): void {
    const timestamp = new Date().toISOString()
    const mappedSrc = entry.src === 'pc' ? 'pc' : entry.src === 'dc' ? 'dc' : 'app'

    if (entry.kind === 'event') {
      this.deps.eventEmitter.emitDebug({
        t: timestamp,
        kind: 'event',
        src: mappedSrc,
        msg: entry.msg,
        data: entry.data,
      })
    } else {
      this.deps.eventEmitter.emitDebug({
        t: timestamp,
        kind: entry.kind,
        src: mappedSrc,
        msg: entry.msg,
        data: entry.data,
      })
    }
  }
}
