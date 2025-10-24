import type { ConnectionFlowContext } from '../../../../shared/realtime/runConnectionFlow'
import type { RealtimeTransport, TransportLoggerEntry } from '../../../../shared/transport/RealtimeTransport'
import type { ConversationEvent, VoiceDebugEvent, VoiceStatus } from '../../../../shared/types'
import type { PreferredString } from '../types/config'

export interface ConnectionContextDependencies {
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
  scheduleRetry(op: number, delayMs: number): void
  handleSessionReuse(reused: boolean): void

  voiceOverride: string | null
  inputLanguage: PreferredString<'auto'>
  replyLanguage: PreferredString<'default'>
  model: string | null
  transcriptionModel: string | null
}

export function createConnectionContext(
	deps: ConnectionContextDependencies,
	myOp: number
): ConnectionFlowContext {
	const inputLanguage = deps.inputLanguage ?? 'auto'
	const replyLanguage = deps.replyLanguage ?? 'default'

	return {
		iceServers: deps.iceServers,
		backendTranscriptMode: deps.backendTranscriptMode,
		maxRetries: deps.maxRetries,
		getConnectRetryCount: () => deps.getConnectRetryCount(),
		setConnectRetryCount: value => deps.setConnectRetryCount(value),
		getSessionId: () => deps.getSessionId(),
		setSessionId: id => deps.setSessionId(id),
		getExternalSessionId: () => deps.getExternalSessionId(),
		getMicStream: () => deps.getMicStream(),
		setMicStream: stream => deps.setMicStream(stream),
		getTransport: () => deps.getTransport(),
		setTransport: transport => deps.setTransport(transport),
		getPeerConnection: () => deps.getPeerConnection(),
		setPeerConnection: pc => deps.setPeerConnection(pc),
		setServerChannel: channel => deps.setServerChannel(channel),
		setClientChannel: channel => deps.setClientChannel(channel),
		attachDataChannelHandlers: channel => deps.attachDataChannelHandlers(channel),
		getConnectStartMs: () => deps.getConnectStartMs(),
		setConnectStartMs: ms => deps.setConnectStartMs(ms),
		initializeBackendSocket: sessionId => deps.initializeBackendSocket(sessionId),
		updateStatus: (status, error) => deps.updateStatus(status, error),
		emit: event => deps.emit(event),
		emitDebug: event => deps.emitDebug(event),
		startMeter: stream => deps.startMeter(stream),
		logTransport: entry => deps.logTransport(entry),
		handleRemoteStream: stream => deps.handleRemoteStream(stream),
		handleIceConnectionStateChange: state => deps.handleIceConnectionStateChange(state),
		handleConnectionStateChange: state => deps.handleConnectionStateChange(state),
		createSessionWithLogging: () => deps.createSessionWithLogging(),
		cleanup: () => deps.cleanup(),
		isOpStale: op => deps.isOpStale(op),
		scheduleRetry: delayMs => deps.scheduleRetry(myOp, delayMs),
		handleSessionReuse: reused => deps.handleSessionReuse(reused),
		voiceOverride: deps.voiceOverride,
		inputLanguage,
		replyLanguage,
		model: deps.model,
		transcriptionModel: deps.transcriptionModel,
	}
}
