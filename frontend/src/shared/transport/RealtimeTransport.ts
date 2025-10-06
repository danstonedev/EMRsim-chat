export interface TransportLoggerEntry {
  src: 'pc' | 'dc' | 'transport'
  kind: 'event' | 'info' | 'warn' | 'error'
  msg: string
  data?: unknown
}

export type TransportLogger = (entry: TransportLoggerEntry) => void

export interface RealtimeTransportCallbacks {
  onDataChannel(channel: RTCDataChannel, origin: 'client' | 'server'): void
  onRemoteStream?(stream: MediaStream): void
  onIceConnectionStateChange?(state: RTCIceConnectionState): void
  onConnectionStateChange?(state: RTCPeerConnectionState): void
}

export interface RealtimeTransportOptions {
  iceServers?: RTCIceServer[]
  log?: TransportLogger
  callbacks: RealtimeTransportCallbacks
}

export interface TransportInitializeResult {
  localDescription: RTCSessionDescriptionInit
  iceGatheringMs: number
}

export class RealtimeTransport {
  private pc: RTCPeerConnection | null = null
  private disposed = false
  private clientChannel: RTCDataChannel | null = null
  private serverChannels = new Set<RTCDataChannel>()

  constructor(private readonly options: RealtimeTransportOptions) {}

  async initialize(stream: MediaStream): Promise<TransportInitializeResult> {
    if (this.disposed) {
      throw new Error('RealtimeTransport has been disposed')
    }

    this.pc = new RTCPeerConnection({ iceServers: this.options.iceServers })
    const pc = this.pc

    pc.addEventListener('iceconnectionstatechange', () => {
      this.log('pc', 'event', `iceconnectionstatechange:${pc.iceConnectionState}`)
      this.options.callbacks.onIceConnectionStateChange?.(pc.iceConnectionState)
    })
    pc.addEventListener('connectionstatechange', () => {
      this.log('pc', 'event', `connectionstatechange:${pc.connectionState}`)
      this.options.callbacks.onConnectionStateChange?.(pc.connectionState)
    })
    pc.addEventListener('icegatheringstatechange', () => {
      this.log('pc', 'event', `icegatheringstatechange:${pc.iceGatheringState}`)
    })
    pc.addEventListener('signalingstatechange', () => {
      this.log('pc', 'event', `signalingstatechange:${pc.signalingState}`)
    })
    pc.addEventListener('datachannel', (event) => {
      const channel = event.channel
      this.serverChannels.add(channel)
      this.log('dc', 'event', `server datachannel received:${channel.label}`)
      this.options.callbacks.onDataChannel(channel, 'server')
    })
    pc.addEventListener('track', (event) => {
      const [stream] = event.streams
      if (stream) {
        this.options.callbacks.onRemoteStream?.(stream)
      }
    })

    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    try {
      this.clientChannel = pc.createDataChannel('oai-events')
      this.log('dc', 'event', 'client datachannel created:oai-events')
      this.options.callbacks.onDataChannel(this.clientChannel, 'client')
    } catch (err) {
      this.log('dc', 'warn', 'failed to create client datachannel', err)
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    const iceWaitStart = Date.now()
    await waitForIceGatheringComplete(pc)
    const iceGatheringMs = Date.now() - iceWaitStart
    const localDescription = pc.localDescription ?? offer

    return { localDescription, iceGatheringMs }
  }

  async applyAnswer(sdp: string): Promise<void> {
    const pc = this.ensurePeerConnection()
    await pc.setRemoteDescription({ type: 'answer', sdp })
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.pc
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    if (this.clientChannel) {
      try { this.clientChannel.close() } catch {}
      this.clientChannel = null
    }
    this.serverChannels.forEach((channel) => {
      try { channel.close() } catch {}
    })
    this.serverChannels.clear()

    if (this.pc) {
      try { this.pc.close() } catch {}
      this.pc = null
    }
  }

  private ensurePeerConnection(): RTCPeerConnection {
    if (!this.pc) {
      throw new Error('Peer connection not initialized')
    }
    return this.pc
  }

  private log(src: TransportLoggerEntry['src'], kind: TransportLoggerEntry['kind'], msg: string, data?: unknown): void {
    this.options.log?.({ src, kind, msg, data })
  }
}

export function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()

  const DEFAULT_TIMEOUT_MS = (() => {
    try {
      const raw = ((import.meta as any)?.env?.VITE_ICE_GATHER_TIMEOUT_MS ?? '').toString()
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? Math.min(8000, Math.max(500, n)) : 3000
    } catch {
      return 3000
    }
  })()

  return new Promise((resolve) => {
    let done = false
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        try { pc.removeEventListener('icegatheringstatechange', onChange) } catch {}
        if (!done) {
          done = true
          resolve()
        }
      }
    }

    try { pc.addEventListener('icegatheringstatechange', onChange) } catch {}

    const timer = setTimeout(() => {
      try { pc.removeEventListener('icegatheringstatechange', onChange) } catch {}
      if (!done) {
        done = true
        resolve()
      }
    }, DEFAULT_TIMEOUT_MS)

    try {
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'closed' || pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          try { clearTimeout(timer) } catch {}
        }
      })
    } catch {}
  })
}
