import { api } from '../api'
import { RealtimeTransport, TransportLoggerEntry } from '../transport/RealtimeTransport'
import type { ConversationEvent, VoiceDebugEvent, VoiceStatus } from '../ConversationController'

export interface ConnectionFlowContext {
  iceServers?: RTCIceServer[]
  backendTranscriptMode: boolean
  maxRetries: number
  getConnectRetryCount(): number
  setConnectRetryCount(value: number): void

  getSessionId(): string | null
  setSessionId(id: string | null): void
  getExternalSessionId(): string | null

  getMicStream(): MediaStream | null
  setMicStream(stream: MediaStream | null): void

  getTransport(): RealtimeTransport | null
  setTransport(transport: RealtimeTransport | null): void

  getPeerConnection(): RTCPeerConnection | null
  setPeerConnection(pc: RTCPeerConnection | null): void

  setServerChannel(channel: RTCDataChannel | null): void
  setClientChannel(channel: RTCDataChannel | null): void
  attachDataChannelHandlers(channel: RTCDataChannel): void

  getConnectStartMs(): number
  setConnectStartMs(ms: number): void

  initializeBackendSocket(sessionId: string): void
  updateStatus(status: VoiceStatus, error: string | null): void
  emit(event: ConversationEvent): void
  emitDebug(event: VoiceDebugEvent): void
  startMeter(stream: MediaStream): void
  logTransport(entry: TransportLoggerEntry): void
  handleRemoteStream(stream: MediaStream): void
  handleIceConnectionStateChange(state: RTCIceConnectionState): void
  handleConnectionStateChange(state: RTCPeerConnectionState): void
  createSessionWithLogging(): Promise<{ session_id: string; reused: boolean }>
  cleanup(): void
  isOpStale(op: number): boolean
  scheduleRetry(delayMs: number): void
  handleSessionReuse(reused: boolean): void

  voiceOverride: string | null
  inputLanguage: 'auto' | string
  replyLanguage: 'default' | string
  model: string | null
  transcriptionModel: string | null
}

const SUPPORTED_LANGS = new Set([
  'af','ar','az','be','bg','bs','ca','cs','cy','da','de','el','en','es','et','fa','fi','fr','gl','he','hi','hr','hu','hy','id','is','it','ja','kk','kn','ko','lt','lv','mi','mk','mr','ms','ne','nl','no','pl','pt','ro','ru','sk','sl','sr','sv','sw','ta','th','tl','tr','uk','ur','vi','zh'
])

const ALIAS_MAP: Record<string, string> = {
  iw: 'he',
  ji: 'yi',
  nb: 'no',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
}

function normalizeLang(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const raw = String(value).trim().toLowerCase()
  if (!raw || raw === 'default' || raw === 'auto') return undefined
  const base = raw.includes('-') ? raw.split('-')[0] : raw
  const maybeAliased = ALIAS_MAP[raw] || ALIAS_MAP[base] || base
  return SUPPORTED_LANGS.has(maybeAliased) ? maybeAliased : undefined
}

export async function runConnectionFlow(context: ConnectionFlowContext, myOp: number): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    context.updateStatus('error', 'no_microphone_support')
    context.emitDebug({ t: new Date().toISOString(), kind: 'error', src: 'mic', msg: 'no microphone support' })
    throw new Error('no_microphone_support')
  }

  context.updateStatus('connecting', null)
  const connectStart = Date.now()
  context.setConnectStartMs(connectStart)
  context.emit({ type: 'connection-progress', step: 'mic', progress: 0, estimatedMs: 1000 })

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 24000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    if (context.isOpStale(myOp)) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    context.setMicStream(stream)
    context.emitDebug({
      t: new Date().toISOString(),
      kind: 'info',
      src: 'mic',
      msg: 'mic stream acquired',
      data: { tracks: stream.getAudioTracks().length, elapsed_ms: Date.now() - connectStart },
    })
    context.emit({ type: 'connection-progress', step: 'mic', progress: 25 })
    context.startMeter(stream)

    const transport = new RealtimeTransport({
      iceServers: context.iceServers,
      log: (entry) => context.logTransport(entry),
      callbacks: {
        onDataChannel: (channel, origin) => {
          if (context.isOpStale(myOp)) return
          if (origin === 'client') {
            context.setClientChannel(channel)
          } else {
            context.setServerChannel(channel)
          }
          context.attachDataChannelHandlers(channel)
        },
        onRemoteStream: (remoteStream) => context.handleRemoteStream(remoteStream),
        onIceConnectionStateChange: (state) => context.handleIceConnectionStateChange(state),
        onConnectionStateChange: (state) => context.handleConnectionStateChange(state),
      },
    })

    context.setTransport(transport)

    const disposeIfStale = (): boolean => {
      if (!context.isOpStale(myOp)) return false
      transport.dispose()
      if (context.getTransport() === transport) {
        context.setTransport(null)
      }
      return true
    }

    const transportInitPromise = transport.initialize(stream).then((result) => {
      context.setPeerConnection(transport.getPeerConnection())
      return result
    })

    context.emit({ type: 'connection-progress', step: 'session', progress: 35, estimatedMs: 800 })

    let currentSessionId = context.getSessionId() ?? context.getExternalSessionId()
    const sessionPromise = currentSessionId
      ? Promise.resolve({ session_id: currentSessionId, reused: true })
      : context.createSessionWithLogging()

    const sessionResult = await sessionPromise
    if (disposeIfStale()) return
    currentSessionId = sessionResult.session_id

  context.handleSessionReuse(sessionResult.reused)

  if (!sessionResult.reused) {
      context.setSessionId(currentSessionId)
      context.emit({ type: 'session', sessionId: currentSessionId })
      context.emitDebug({
        t: new Date().toISOString(),
        kind: 'info',
        src: 'api',
        msg: 'session created',
        data: { sessionId: currentSessionId, elapsed_ms: Date.now() - connectStart },
      })
    } else {
      context.emitDebug({
        t: new Date().toISOString(),
        kind: 'info',
        src: 'api',
        msg: 'session reused',
        data: { sessionId: currentSessionId },
      })
    }

    if (context.backendTranscriptMode && currentSessionId) {
      context.initializeBackendSocket(currentSessionId)
    }

    context.emit({ type: 'connection-progress', step: 'token', progress: 55, estimatedMs: 600 })

    if (!currentSessionId) throw new Error('session_unavailable')

    const tokenStart = Date.now()
    const [token, transportInit] = await Promise.all([
      api.getVoiceToken(currentSessionId, {
        voice: context.voiceOverride || undefined,
        input_language: normalizeLang(context.inputLanguage),
        model: context.model || undefined,
        transcription_model: context.transcriptionModel || undefined,
        reply_language: normalizeLang(context.replyLanguage) ?? 'en',
      }),
      transportInitPromise,
    ])

    if (disposeIfStale()) return

    context.emitDebug({
      t: new Date().toISOString(),
      kind: 'info',
      src: 'api',
      msg: 'voice token received',
      data: {
        model: token.model,
        elapsed_ms: Date.now() - tokenStart,
        total_ms: Date.now() - connectStart,
      },
    })
    context.emit({ type: 'connection-progress', step: 'webrtc', progress: 80, estimatedMs: 400 })

    context.emitDebug({
      t: new Date().toISOString(),
      kind: 'info',
      src: 'pc',
      msg: 'local description ready',
      data: {
        ice_wait_ms: transportInit.iceGatheringMs,
        total_ms: Date.now() - connectStart,
        ice_state: context.getPeerConnection()?.iceGatheringState,
      },
    })

    const sdpStart = Date.now()
    const answer = await api.postVoiceSdp(currentSessionId, transportInit.localDescription.sdp || '')
    if (disposeIfStale()) return

    context.emitDebug({
      t: new Date().toISOString(),
      kind: 'info',
      src: 'api',
      msg: 'received SDP answer',
      data: {
        bytes: answer?.length || 0,
        elapsed_ms: Date.now() - sdpStart,
        total_ms: Date.now() - connectStart,
      },
    })

    await transport.applyAnswer(answer)
    if (context.getTransport() !== transport) return
  } catch (err: any) {
    if (!context.isOpStale(myOp)) {
      const currentRetry = context.getConnectRetryCount()
      const shouldRetry = currentRetry < context.maxRetries &&
        (err?.message?.includes('network') || err?.message?.includes('timeout') || err?.message?.includes('ice'))

      if (shouldRetry) {
        const nextRetry = currentRetry + 1
        context.setConnectRetryCount(nextRetry)
        context.emitDebug({
          t: new Date().toISOString(),
          kind: 'warn',
          src: 'app',
          msg: `connection attempt ${nextRetry} failed, retrying...`,
          data: { error: err?.message },
        })
        context.cleanup()
        const delay = 1000 * Math.pow(2, nextRetry - 1)
        context.scheduleRetry(delay)
        return
      }

      context.cleanup()
      context.updateStatus('error', err instanceof Error ? err.message : String(err))
    }
    throw err
  }
}
