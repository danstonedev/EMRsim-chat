import { api } from '../api';
import { RealtimeTransport, TransportLoggerEntry } from '../transport/RealtimeTransport';
import type { ConversationEvent, VoiceDebugEvent, VoiceStatus } from '../types';
import { voiceDebug, voiceWarn } from '../utils/voiceLogging';

export interface ConnectionFlowContext {
  iceServers?: RTCIceServer[];
  backendTranscriptMode: boolean;
  maxRetries: number;
  getConnectRetryCount(): number;
  setConnectRetryCount(value: number): void;

  getSessionId(): string | null;
  setSessionId(id: string | null): void;
  getExternalSessionId(): string | null;

  getMicStream(): MediaStream | null;
  setMicStream(stream: MediaStream | null): void;

  getTransport(): RealtimeTransport | null;
  setTransport(transport: RealtimeTransport | null): void;

  getPeerConnection(): RTCPeerConnection | null;
  setPeerConnection(pc: RTCPeerConnection | null): void;

  setServerChannel(channel: RTCDataChannel | null): void;
  setClientChannel(channel: RTCDataChannel | null): void;
  attachDataChannelHandlers(channel: RTCDataChannel): void;

  getConnectStartMs(): number;
  setConnectStartMs(ms: number): void;

  initializeBackendSocket(sessionId: string): void;
  updateStatus(status: VoiceStatus, error: string | null): void;
  emit(event: ConversationEvent): void;
  emitDebug(event: VoiceDebugEvent): void;
  startMeter(stream: MediaStream): void;
  logTransport(entry: TransportLoggerEntry): void;
  handleRemoteStream(stream: MediaStream): void;
  handleIceConnectionStateChange(state: RTCIceConnectionState): void;
  handleConnectionStateChange(state: RTCPeerConnectionState): void;
  createSessionWithLogging(): Promise<{ session_id: string; reused: boolean }>;
  cleanup(): void;
  isOpStale(op: number): boolean;
  scheduleRetry(delayMs: number): void;
  handleSessionReuse(reused: boolean): void;

  voiceOverride: string | null;
  inputLanguage: string;
  replyLanguage: string;
  model: string | null;
  transcriptionModel: string | null;
}

const SUPPORTED_LANGS = new Set([
  'af',
  'ar',
  'az',
  'be',
  'bg',
  'bs',
  'ca',
  'cs',
  'cy',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'fa',
  'fi',
  'fr',
  'gl',
  'he',
  'hi',
  'hr',
  'hu',
  'hy',
  'id',
  'is',
  'it',
  'ja',
  'kk',
  'kn',
  'ko',
  'lt',
  'lv',
  'mi',
  'mk',
  'mr',
  'ms',
  'ne',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sr',
  'sv',
  'sw',
  'ta',
  'th',
  'tl',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh',
]);

const ALIAS_MAP: Record<string, string> = {
  iw: 'he',
  ji: 'yi',
  nb: 'no',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
};

function normalizeLang(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const raw = String(value).trim().toLowerCase();
  if (!raw || raw === 'default' || raw === 'auto') return undefined;
  const base = raw.includes('-') ? raw.split('-')[0] : raw;
  const maybeAliased = ALIAS_MAP[raw] || ALIAS_MAP[base] || base;
  return SUPPORTED_LANGS.has(maybeAliased) ? maybeAliased : undefined;
}

export async function runConnectionFlow(context: ConnectionFlowContext, myOp: number): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    context.updateStatus('error', 'no_microphone_support');
    context.emitDebug({ t: new Date().toISOString(), kind: 'error', src: 'mic', msg: 'no microphone support' });
    throw new Error('no_microphone_support');
  }

  context.updateStatus('connecting', null);
  const connectStart = Date.now();
  context.setConnectStartMs(connectStart);
  context.emit({ type: 'connection-progress', step: 'mic', progress: 0, estimatedMs: 1000 });

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 24000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    if (context.isOpStale(myOp)) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    context.setMicStream(stream);
    context.emitDebug({
      t: new Date().toISOString(),
      kind: 'info',
      src: 'mic',
      msg: 'mic stream acquired',
      data: { tracks: stream.getAudioTracks().length, elapsed_ms: Date.now() - connectStart },
    });
    context.emit({ type: 'connection-progress', step: 'mic', progress: 25 });
    context.startMeter(stream);

    const transport = new RealtimeTransport({
      iceServers: context.iceServers,
      log: entry => context.logTransport(entry),
      callbacks: {
        onDataChannel: (channel, origin) => {
          if (context.isOpStale(myOp)) return;
          if (origin === 'client') {
            context.setClientChannel(channel);
          } else {
            context.setServerChannel(channel);
          }
          context.attachDataChannelHandlers(channel);
        },
        onRemoteStream: remoteStream => context.handleRemoteStream(remoteStream),
        onIceConnectionStateChange: state => context.handleIceConnectionStateChange(state),
        onConnectionStateChange: state => context.handleConnectionStateChange(state),
      },
    });

    context.setTransport(transport);

    const disposeIfStale = (): boolean => {
      if (!context.isOpStale(myOp)) return false;
      transport.dispose();
      if (context.getTransport() === transport) {
        context.setTransport(null);
      }
      return true;
    };

    const transportInitPromise = transport.initialize(stream).then(result => {
      context.setPeerConnection(transport.getPeerConnection());
      return result;
    });

    context.emit({ type: 'connection-progress', step: 'session', progress: 35, estimatedMs: 800 });

    let currentSessionId = context.getSessionId() ?? context.getExternalSessionId();

    const ensureSessionReady = async (forceNew = false): Promise<string | null> => {
      if (forceNew) {
        currentSessionId = null;
        context.setSessionId(null);
      }

      if (!currentSessionId) {
        const sessionResult = await context.createSessionWithLogging();
        if (disposeIfStale()) return null;
        currentSessionId = sessionResult.session_id;
        context.handleSessionReuse(false);
        context.setSessionId(currentSessionId);
        context.emit({ type: 'session', sessionId: currentSessionId });
        context.emitDebug({
          t: new Date().toISOString(),
          kind: 'info',
          src: 'api',
          msg: forceNew ? 'session recreated' : 'session created',
          data: { sessionId: currentSessionId, elapsed_ms: Date.now() - connectStart },
        });
      } else {
        context.handleSessionReuse(true);
        context.emitDebug({
          t: new Date().toISOString(),
          kind: 'info',
          src: 'api',
          msg: 'session reused',
          data: { sessionId: currentSessionId },
        });
      }

      const settleDelayMs = forceNew ? 900 : 1500;
      await new Promise(resolve => setTimeout(resolve, settleDelayMs));

      try {
        context.emitDebug({
          t: new Date().toISOString(),
          kind: 'info',
          src: 'api',
          msg: 'verifying session readiness',
          data: { sessionId: currentSessionId },
        });

        const verifyStart = Date.now();
        await api.getHealth();

        context.emitDebug({
          t: new Date().toISOString(),
          kind: 'info',
          src: 'api',
          msg: 'session verified ready',
          data: {
            sessionId: currentSessionId,
            verification_ms: Date.now() - verifyStart,
          },
        });
      } catch (err) {
        context.emitDebug({
          t: new Date().toISOString(),
          kind: 'warn',
          src: 'api',
          msg: 'session verification failed, proceeding anyway',
          data: { error: String(err) },
        });
      }

      voiceDebug('[runConnectionFlow] Checking backend socket init:', {
        backendTranscriptMode: context.backendTranscriptMode,
        currentSessionId,
        willInitialize: Boolean(context.backendTranscriptMode && currentSessionId),
      });

      if (context.backendTranscriptMode && currentSessionId) {
        context.initializeBackendSocket(currentSessionId);
      } else {
        voiceWarn('[runConnectionFlow] Skipping backend socket init:', {
          backendTranscriptMode: context.backendTranscriptMode,
          hasSessionId: !!currentSessionId,
        });
      }

      return currentSessionId;
    };

    const ensuredSessionId = await ensureSessionReady(false);
    if (!ensuredSessionId) return;

    context.emit({ type: 'connection-progress', step: 'token', progress: 55, estimatedMs: 600 });

    if (!currentSessionId) throw new Error('session_unavailable');

    const tokenStart = Date.now();

    const maxAttempts = 4;
    const baseDelay = 1000;

    let token;
    let transportInit;
    let attempts = 0;
    let lastError: unknown;

    const shouldRefreshSession = (error: unknown) => {
      if (!(error instanceof Error)) return false;
      const message = error.message ?? '';
      return (
        message.includes('session_not_found') ||
        message.includes('session_unavailable') ||
        message.includes('sps_context_unavailable')
      );
    };

    while (attempts < maxAttempts) {
      try {
        if (attempts === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const [nextToken, nextTransportInit] = await Promise.all([
          api.getVoiceToken(currentSessionId, {
            voice: context.voiceOverride || undefined,
            input_language: normalizeLang(context.inputLanguage),
            model: context.model || undefined,
            transcription_model: context.transcriptionModel || undefined,
            reply_language: normalizeLang(context.replyLanguage) ?? 'en',
          }),
          transportInitPromise,
        ]);

        token = nextToken;
        transportInit = nextTransportInit;

        if (token && token.model) {
          context.emitDebug({
            t: new Date().toISOString(),
            kind: 'info',
            src: 'api',
            msg: 'voice token validated',
            data: { model: token.model, attempt: attempts + 1 },
          });
          break;
        }

        throw new Error('Invalid token received');
      } catch (err) {
        attempts += 1;
        lastError = err;

        const message = err instanceof Error ? err.message : String(err);
        const needsSessionRefresh = shouldRefreshSession(err);

        if (needsSessionRefresh && attempts < maxAttempts) {
          context.emitDebug({
            t: new Date().toISOString(),
            kind: 'warn',
            src: 'api',
            msg: 'session unavailable, recreating before retry',
            data: {
              attempt: attempts,
              max_attempts: maxAttempts,
              error: message,
            },
          });

          const refreshedSessionId = await ensureSessionReady(true);
          if (!refreshedSessionId) return;
          currentSessionId = refreshedSessionId;
          continue;
        }

        const isRetriableError =
          err instanceof Error &&
          (message.includes('network') ||
            message.includes('timeout') ||
            message.includes('503') ||
            message.includes('502'));

        if (isRetriableError && attempts < maxAttempts) {
          const delay = baseDelay * Math.pow(1.5, attempts - 1);
          context.emitDebug({
            t: new Date().toISOString(),
            kind: 'warn',
            src: 'api',
            msg: `token fetch failed, retrying (${attempts}/${maxAttempts})...`,
            data: {
              error: message,
              next_retry_ms: delay,
            },
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw err;
      }
    }

    if (!token || !transportInit) {
      const error = lastError instanceof Error
        ? lastError
        : new Error('Failed to get voice token after multiple attempts');
      context.emitDebug({
        t: new Date().toISOString(),
        kind: 'error',
        src: 'api',
        msg: 'Failed to establish voice connection',
        data: {
          attempts,
          final_error: error.message,
        },
      });
      throw error;
    }

    if (disposeIfStale()) return;

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
    });
    context.emit({ type: 'connection-progress', step: 'webrtc', progress: 80, estimatedMs: 400 });

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
    });

    const sdpStart = Date.now();

    // Add retry for SDP exchange as well
    let sdpAttempts = 0;
    let answer: string | null = null;

    while (sdpAttempts < 3) {
      try {
        answer = await api.postVoiceSdp(currentSessionId, transportInit.localDescription.sdp || '');
        if (answer) break;
        throw new Error('Empty SDP answer received');
      } catch (err) {
        sdpAttempts++;
        if (sdpAttempts < 3) {
          context.emitDebug({
            t: new Date().toISOString(),
            kind: 'warn',
            src: 'api',
            msg: `SDP exchange failed, retrying (${sdpAttempts}/3)...`,
            data: { error: String(err) },
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw err;
        }
      }
    }

    if (disposeIfStale()) return;

    if (!answer) {
      throw new Error('Failed to obtain SDP answer after retries');
    }

    context.emitDebug({
      t: new Date().toISOString(),
      kind: 'info',
      src: 'api',
      msg: 'received SDP answer',
      data: {
        bytes: answer.length || 0,
        elapsed_ms: Date.now() - sdpStart,
        total_ms: Date.now() - connectStart,
      },
    });

    await transport.applyAnswer(answer);
    if (context.getTransport() !== transport) return;

    // Final verification that connection is established
    context.emitDebug({
      t: new Date().toISOString(),
      kind: 'info',
      src: 'pc',
      msg: 'connection flow completed successfully',
      data: {
        total_ms: Date.now() - connectStart,
        connection_state: context.getPeerConnection()?.connectionState,
        ice_state: context.getPeerConnection()?.iceConnectionState,
      },
    });
  } catch (err: any) {
    if (!context.isOpStale(myOp)) {
      const currentRetry = context.getConnectRetryCount();
      const shouldRetry =
        currentRetry < context.maxRetries &&
        (err?.message?.includes('network') ||
          err?.message?.includes('timeout') ||
          err?.message?.includes('ice') ||
          err?.message?.includes('session_not_found'));

      if (shouldRetry) {
        const nextRetry = currentRetry + 1;
        context.setConnectRetryCount(nextRetry);
        context.emitDebug({
          t: new Date().toISOString(),
          kind: 'warn',
          src: 'app',
          msg: `connection attempt ${nextRetry} failed, retrying...`,
          data: { error: err?.message },
        });
        context.cleanup();
        const delay = Math.min(1000 * Math.pow(2, nextRetry - 1), 8000); // Cap at 8 seconds
        context.scheduleRetry(delay);
        return;
      }

      context.cleanup();
      context.updateStatus('error', err instanceof Error ? err.message : String(err));
    }
    throw err;
  }
}
