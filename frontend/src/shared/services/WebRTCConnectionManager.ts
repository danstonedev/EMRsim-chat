/**
 * WebRTCConnectionManager
 *
 * Manages WebRTC peer connections, data channels, and connection state monitoring.
 *
 * Responsibilities:
 * - Manage RTCPeerConnection lifecycle
 * - Handle server and client data channels
 * - Monitor connection and ICE connection states
 * - Attach and manage data channel event handlers
 * - Track active channel for communication
 * - Provide connection state information
 *
 * Extracted from ConversationController.ts as part of refactoring to reduce
 * main file complexity and improve testability.
 */

export interface DataChannelCallbacks {
  onOpen: (channel: RTCDataChannel) => void;
  onMessage: (data: string) => void;
  onError: (channel: RTCDataChannel, event: Event) => void;
  onClose: (channel: RTCDataChannel) => void;
}

export interface ConnectionStateCallbacks {
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onRemoteStream: (stream: MediaStream) => void;
}

export interface WebRTCConnectionSnapshot {
  hasPeerConnection: boolean;
  hasServerChannel: boolean;
  hasClientChannel: boolean;
  hasActiveChannel: boolean;
  activeChannelState: RTCDataChannelState | null;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
}

export class WebRTCConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private serverChannel: RTCDataChannel | null = null;
  private clientChannel: RTCDataChannel | null = null;
  private activeChannel: RTCDataChannel | null = null;

  private dataChannelCallbacks: DataChannelCallbacks | null = null;
  private connectionStateCallbacks: ConnectionStateCallbacks | null = null;

  constructor() {
    // Empty constructor - callbacks set separately
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Set callbacks for data channel events
   */
  setDataChannelCallbacks(callbacks: DataChannelCallbacks): void {
    this.dataChannelCallbacks = callbacks;
  }

  /**
   * Set callbacks for connection state changes
   */
  setConnectionStateCallbacks(callbacks: ConnectionStateCallbacks): void {
    this.connectionStateCallbacks = callbacks;
  }

  // ============================================
  // Peer Connection Management
  // ============================================

  /**
   * Get the current peer connection
   */
  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  /**
   * Set the peer connection
   */
  setPeerConnection(pc: RTCPeerConnection | null): void {
    this.peerConnection = pc;
  }

  /**
   * Check if peer connection exists
   */
  hasPeerConnection(): boolean {
    return this.peerConnection !== null;
  }

  // ============================================
  // Data Channel Management
  // ============================================

  /**
   * Get the server data channel
   */
  getServerChannel(): RTCDataChannel | null {
    return this.serverChannel;
  }

  /**
   * Set the server data channel
   */
  setServerChannel(channel: RTCDataChannel | null): void {
    this.serverChannel = channel;
  }

  /**
   * Get the client data channel
   */
  getClientChannel(): RTCDataChannel | null {
    return this.clientChannel;
  }

  /**
   * Set the client data channel
   */
  setClientChannel(channel: RTCDataChannel | null): void {
    this.clientChannel = channel;
  }

  /**
   * Get the active data channel (currently in use)
   */
  getActiveChannel(): RTCDataChannel | null {
    return this.activeChannel;
  }

  /**
   * Set the active data channel
   */
  setActiveChannel(channel: RTCDataChannel | null): void {
    this.activeChannel = channel;
  }

  /**
   * Check if active channel is open and ready
   */
  isActiveChannelOpen(): boolean {
    return this.activeChannel?.readyState === 'open';
  }

  /**
   * Check if any data channel is open
   */
  hasOpenChannel(): boolean {
    const channels = [this.serverChannel, this.clientChannel];
    return channels.some(ch => ch?.readyState === 'open');
  }

  // ============================================
  // Data Channel Event Handlers
  // ============================================

  /**
   * Attach event handlers to a data channel
   */
  attachDataChannelHandlers(channel: RTCDataChannel): void {
    if (!this.dataChannelCallbacks) {
      throw new Error('Data channel callbacks not configured');
    }

    const callbacks = this.dataChannelCallbacks;

    channel.addEventListener('open', () => {
      this.activeChannel = channel;
      callbacks.onOpen(channel);
    });

    channel.addEventListener('message', event => {
      if (typeof event.data === 'string') {
        callbacks.onMessage(event.data);
      }
    });

    channel.addEventListener('error', event => {
      callbacks.onError(channel, event);
    });

    channel.addEventListener('close', () => {
      callbacks.onClose(channel);
    });
  }

  // ============================================
  // Connection State Monitoring
  // ============================================

  /**
   * Handle ICE connection state changes
   */
  handleIceConnectionStateChange(state: RTCIceConnectionState): void {
    if (this.connectionStateCallbacks) {
      this.connectionStateCallbacks.onIceConnectionStateChange(state);
    }
  }

  /**
   * Handle peer connection state changes
   */
  handleConnectionStateChange(state: RTCPeerConnectionState): void {
    if (this.connectionStateCallbacks) {
      this.connectionStateCallbacks.onConnectionStateChange(state);
    }
  }

  /**
   * Handle remote stream
   */
  handleRemoteStream(stream: MediaStream): void {
    if (this.connectionStateCallbacks) {
      this.connectionStateCallbacks.onRemoteStream(stream);
    }
  }

  // ============================================
  // Connection State Queries
  // ============================================

  /**
   * Get current connection state
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState ?? null;
  }

  /**
   * Get current ICE connection state
   */
  getIceConnectionState(): RTCIceConnectionState | null {
    return this.peerConnection?.iceConnectionState ?? null;
  }

  /**
   * Check if connection is established
   */
  isConnected(): boolean {
    const iceState = this.getIceConnectionState();
    return iceState === 'connected' || iceState === 'completed';
  }

  /**
   * Check if connection has failed
   */
  hasFailed(): boolean {
    const connState = this.getConnectionState();
    const iceState = this.getIceConnectionState();
    return connState === 'failed' || iceState === 'failed';
  }

  // ============================================
  // Snapshot
  // ============================================

  /**
   * Get a snapshot of current connection state
   */
  getSnapshot(): WebRTCConnectionSnapshot {
    return {
      hasPeerConnection: this.peerConnection !== null,
      hasServerChannel: this.serverChannel !== null,
      hasClientChannel: this.clientChannel !== null,
      hasActiveChannel: this.activeChannel !== null,
      activeChannelState: this.activeChannel?.readyState ?? null,
      connectionState: this.getConnectionState(),
      iceConnectionState: this.getIceConnectionState(),
    };
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Close and cleanup peer connection and data channels
   */
  cleanup(): void {
    // Close data channels
    if (this.serverChannel) {
      try {
        this.serverChannel.close();
      } catch {}
      this.serverChannel = null;
    }

    if (this.clientChannel) {
      try {
        this.clientChannel.close();
      } catch {}
      this.clientChannel = null;
    }

    this.activeChannel = null;

    // Close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.cleanup();
  }
}
