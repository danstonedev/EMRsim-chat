import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.ts';
import { getSessionById } from '../db.ts';
import { spsRegistry } from '../sps/core/registry.ts';
import { sessions as spsSessions } from '../sps/runtime/store.js';
import { composeRealtimeInstructions, normalizeGate, computeOutstandingGate } from '../sps/runtime/sps.service.ts';
import { broadcastUserTranscript, broadcastAssistantTranscript, broadcastTranscriptError } from '../services/transcript_broadcast.ts';
import { relayTranscript } from './transcript_relay.ts';

// In-memory store for realtime RTC tokens keyed by session id (dev/demo only)
const rtcTokenStore = new Map<string, string>();

// Rate limiter for voice token requests
const voiceTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 voice tokens per 15 minutes per IP
  message: 'Too many voice session requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for transcript relay (protects against transcript spam)
const transcriptRelayLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // Max 120 transcript relays per minute per IP (allows ~2/sec during active conversation)
  message: 'Too many transcript requests from this IP, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});
let languageDisplayNames: Intl.DisplayNames | undefined;

const LANGUAGE_OVERRIDES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  'pt-br': 'Portuguese (Brazil)',
  'pt-pt': 'Portuguese (Portugal)',
  zh: 'Chinese',
  'zh-cn': 'Chinese (Simplified)',
  'zh-tw': 'Chinese (Traditional)',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
  ar: 'Arabic',
};

export const router = Router();

router.post('/token', voiceTokenLimiter, async (req: Request, res: Response) => {
  if (!config.VOICE_ENABLED) return res.status(403).json({ error: 'voice_disabled' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'no_openai_key' });
  const { session_id: sessionId, voice: voiceOverride, input_language: inputLanguage, model: modelOverride, transcription_model: transcriptionModelOverride, reply_language: replyLanguage } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'missing_session_id' });
  const session = getSessionById(sessionId);
  if (!session) return res.status(404).json({ error: 'session_not_found' });
  // SPS-only: only allow realtime tokens for SPS sessions
  if (session.mode !== 'sps') return res.status(409).json({ error: 'sps_only' });
  const model = (modelOverride && typeof modelOverride === 'string' && modelOverride.trim()) || process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2025-08-28';
  const allowedVoices = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar']);
  let instructions: string | undefined;
  let personaPayload: any;
  let voiceContext: any;

  // SPS-only mode: resolve context from SPS registry
  const spsContext = resolveSpsRealtimeContext(session);
  if (!spsContext) return res.status(404).json({ error: 'sps_context_unavailable' });
  instructions = composeRealtimeInstructions(spsContext);
  personaPayload = buildSpsPersonaPayload(spsContext.activeCase?.persona, session.persona_id);
  voiceContext = { phase: spsContext.phase };

  const configuredVoice = (process.env.OPENAI_TTS_VOICE || '').toLowerCase();
  const preferredVoice = (personaPayload?.voice_id || '').toLowerCase();
  const override = (voiceOverride || '').toLowerCase();
  const voice = override && allowedVoices.has(override) ? override : chooseVoice(allowedVoices, configuredVoice, preferredVoice);
  // Helpers to coerce env overrides for VAD / STT tuning
  const toNum = (v: any, def: number): number => {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? n : def;
  };
  const vadThreshold = Math.min(1, Math.max(0, toNum(process.env.REALTIME_VAD_THRESHOLD, 0.35)));
  const vadPrefixMs = Math.max(0, Math.floor(toNum(process.env.REALTIME_VAD_PREFIX_MS, 120)));
  const vadSilenceMs = Math.max(0, Math.floor(toNum(process.env.REALTIME_VAD_SILENCE_MS, 250)));
  const transcriptionModel = (transcriptionModelOverride && typeof transcriptionModelOverride === 'string' && transcriptionModelOverride.trim()) || process.env.OPENAI_TRANSCRIPTION_MODEL;
  
  // Fail loudly if transcription model is not configured
  if (!transcriptionModel || !transcriptionModel.trim()) {
    console.error('[voice] ❌ OPENAI_TRANSCRIPTION_MODEL is not configured in .env');
    return res.status(500).json({ error: 'transcription_model_not_configured', message: 'OPENAI_TRANSCRIPTION_MODEL must be set in backend/.env' });
  }

  try {
    const t0 = Date.now();
    console.log('[voice] Requesting token with config:', { model, voice, transcriptionModel, inputLanguage: inputLanguage || 'auto' });
    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1',
      },
      body: JSON.stringify({
        model,
        voice,
        instructions: withReplyLanguage(instructions, replyLanguage) || undefined,
        modalities: ['text', 'audio'],
        // Enable transcription with configured model (gpt-4o-mini-transcribe for low-latency)
        input_audio_transcription: {
          model: transcriptionModel,
          language: inputLanguage && inputLanguage !== 'auto' ? inputLanguage : null,
        },
        // Turn detection tuning; defaults can be overridden by env:
        //   REALTIME_VAD_THRESHOLD (0.0-1.0), REALTIME_VAD_PREFIX_MS, REALTIME_VAD_SILENCE_MS
        turn_detection: {
          type: 'server_vad',
          threshold: vadThreshold,
          prefix_padding_ms: vadPrefixMs,
          silence_duration_ms: vadSilenceMs,
        },
      }),
    });
    const t1 = Date.now();
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('[voice] OpenAI Realtime API error:', { status: r.status, body: txt, model, transcriptionModel, ms: (t1 - t0) });
      return res.status(502).json({ error: 'upstream_error', status: r.status, body: txt });
    }
    const json = await r.json();
    const rtcToken = json?.client_secret?.value;
    const expiresAt = json?.client_secret?.expires_at;
    if (!rtcToken) return res.status(502).json({ error: 'no_token' });
    // Save token so server can relay SDP without exposing CORS issues
    rtcTokenStore.set(sessionId, rtcToken);
    const t2 = Date.now();
    console.log('[voice] Token acquired', { model, ms: (t1 - t0), parse_ms: (t2 - t1) });
    return res.json({
      rtc_token: rtcToken,
      model,
      tts_voice: voice,
      persona: personaPayload,
      context: voiceContext,
      opts: { expires_at: expiresAt },
    });
  } catch (e) {
    return res.status(500).json({ error: 'token_error', details: String(e) });
  }
});

router.post('/instructions', (req: Request, res: Response) => {
  try {
    const { session_id: sessionId, phase: phaseOverride, gate: gateOverride } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'missing_session_id' });
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json({ error: 'session_not_found' });
    if (session.mode !== 'sps') return res.status(409).json({ error: 'sps_only' });

    const spsContext = resolveSpsRealtimeContext(session);
    if (!spsContext) return res.status(404).json({ error: 'sps_context_unavailable' });

    const gate = gateOverride && typeof gateOverride === 'object'
      ? normalizeGate({ ...spsContext.gate, ...gateOverride })
      : spsContext.gate;

    const phase = typeof phaseOverride === 'string' && phaseOverride.length
      ? phaseOverride
      : spsContext.phase;

    const outstanding = computeOutstandingGate(gate);
    const instructions = composeRealtimeInstructions({
      activeCase: spsContext.activeCase,
      phase,
      gate,
      outstandingGate: outstanding,
    });

    return res.json({ instructions, phase, outstanding_gate: outstanding });
  } catch (err) {
    console.error('[voice][instructions][error]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// SDP relay: exchange local SDP offer for remote SDP answer with OpenAI using stored token
router.post('/sdp', async (req: Request, res: Response) => {
  if (!config.VOICE_ENABLED) return res.status(403).json({ error: 'voice_disabled' });
  const { session_id: sessionId, sdp } = req.body || {};
  if (!sessionId || !sdp) return res.status(400).json({ error: 'missing_params' });
  const session = getSessionById(sessionId);
  if (!session) return res.status(404).json({ error: 'session_not_found' });
  // SPS-only: only allow SDP relay for SPS sessions
  if (session.mode !== 'sps') return res.status(409).json({ error: 'sps_only' });
  const rtcToken = rtcTokenStore.get(sessionId);
  if (!rtcToken) return res.status(412).json({ error: 'no_rtc_token' });
  const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2025-08-28';
  try {
    const t0 = Date.now();
    console.log('[voice] SDP relay start', { sessionId: String(sessionId).slice(-6), offerBytes: (sdp?.length || 0) });
    const r = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${rtcToken}`,
        'Content-Type': 'application/sdp',
        'OpenAI-Beta': 'realtime=v1',
      },
      body: sdp,
    });
    const t1 = Date.now();
    const answer = await r.text().catch(() => '');
    const t2 = Date.now();
    console.log('[voice] SDP relay upstream', { status: r.status, answerBytes: (answer?.length || 0), ms: (t1 - t0), read_ms: (t2 - t1) });
    if (!r.ok) return res.status(502).json({ error: 'upstream_error', status: r.status, body: answer });
    // Return plain text SDP answer
    res.setHeader('Content-Type', 'application/sdp');
    return res.send(answer);
  } catch (e) {
    console.warn('[voice] SDP relay error', e);
    return res.status(500).json({ error: 'sdp_exchange_error', details: String(e) });
  }
});

// Public list of supported voices (kept in sync with allowed set above)
router.get('/voices', (req: Request, res: Response) => {
  const voices = ['alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar'];
  return res.json({ voices });
});

router.post('/transcript/relay/:sessionId', transcriptRelayLimiter, relayTranscript);

function chooseVoice(allowedVoices: Set<string>, configuredVoice: string, preferredVoice: string): string {
  if (preferredVoice && allowedVoices.has(preferredVoice)) return preferredVoice;
  if (configuredVoice && allowedVoices.has(configuredVoice)) return configuredVoice;
  return 'alloy';
}

function resolveLanguageLabel(code: string): string | null {
  if (!code || typeof code !== 'string') return null;
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  if (LANGUAGE_OVERRIDES[normalized]) return LANGUAGE_OVERRIDES[normalized];

  if (normalized.length === 2 && LANGUAGE_OVERRIDES[normalized]) {
    return LANGUAGE_OVERRIDES[normalized];
  }

  try {
    if (!languageDisplayNames && typeof Intl?.DisplayNames === 'function') {
      languageDisplayNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'code' });
    }
    const label = languageDisplayNames?.of(normalized);
    if (label && label !== normalized) {
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  } catch {}

  if (normalized.length === 2) return normalized.toUpperCase();
  return normalized;
}

function withReplyLanguage(instructions: string | undefined, replyLanguage: string): string | undefined {
  if (!replyLanguage || typeof replyLanguage !== 'string') return instructions;
  const trimmed = replyLanguage.trim();
  if (!trimmed || trimmed.toLowerCase() === 'default') return instructions;
  const root = trimmed.toLowerCase().split(/[-_]/)[0];
  if (root === 'en') return instructions;
  const label = resolveLanguageLabel(trimmed);
  if (!label) return instructions;
  const addendum = `\n\nReply in ${label}.`;
  if (!instructions) return addendum.trim();
  return String(instructions) + addendum;
}

function resolveSpsRealtimeContext(session: any): any {
  if (session.mode !== 'sps' || !session.sps_session_id) return null;

  const existing = session.sps_session_id ? spsSessions.get(session.sps_session_id) : null;
  if (existing?.activeCase) {
    const gate = normalizeGate(existing.gate);
    return {
      activeCase: existing.activeCase,
      gate,
      phase: existing.phase || session.sps_phase || 'subjective',
    };
  }

  const personaId = session.persona_id;
  const scenarioId = session.sps_scenario_id;
  if (!personaId || !scenarioId) return null;
  try {
    const activeCase = spsRegistry.composeActiveCase(personaId, scenarioId);
    const gate = normalizeGate(parseGate(session.sps_gate_json));
    const phase = session.sps_phase || 'subjective';
    return {
      activeCase,
      gate,
      phase,
    };
  } catch (err) {
    console.warn('[voice][sps] unable to compose active case for realtime session', {
      personaId,
      scenarioId,
      error: String(err),
    });
    return null;
  }
}

function parseGate(raw: any): any {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw;
  return null;
}

function buildSpsPersonaPayload(persona: any, fallbackId: string): any {
  const demographics = persona?.demographics || {};
  const display = demographics.preferred_name || demographics.name || fallbackId || 'Patient';
  return {
    id: persona?.patient_id || fallbackId || 'sps_patient',
    display_name: display,
    speaking_rate: persona?.dialogue_style?.speaking_rate || persona?.speaking_rate || null,
    voice_id: persona?.dialogue_style?.voice_id || persona?.voice_id || null,
  };
}

/**
 * Transcript relay endpoint
 * Frontend sends OpenAI Realtime transcript events here for broadcast to all session clients
 */
router.post('/transcript', transcriptRelayLimiter, (req: Request, res: Response) => {
  try {
    const { session_id, role, text, is_final, timestamp, item_id } = req.body || {};
    
    // Validate required fields
    if (!session_id) {
      return res.status(400).json({ error: 'missing_session_id' });
    }
    if (!role || !['user', 'assistant'].includes(role)) {
      return res.status(400).json({ error: 'invalid_role' });
    }
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'invalid_text' });
    }
    
    const payload = {
      text,
      isFinal: Boolean(is_final),
      timestamp: timestamp || Date.now(),
      itemId: item_id
    };
    
    // Broadcast to all clients in this session
    if (role === 'user') {
      broadcastUserTranscript(session_id, payload);
    } else {
      broadcastAssistantTranscript(session_id, payload);
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[voice] transcript relay error:', error);
    return res.status(500).json({ error: 'relay_failed', details: String(error) });
  }
});

/**
 * Transcript error relay endpoint
 */
router.post('/transcript-error', transcriptRelayLimiter, (req: Request, res: Response) => {
  try {
    const { session_id, error } = req.body || {};
    
    if (!session_id) {
      return res.status(400).json({ error: 'missing_session_id' });
    }
    
    const errorMessage = error || 'Unknown transcription error';
    broadcastTranscriptError(session_id, new Error(String(errorMessage)));
    
    return res.json({ success: true });
  } catch (err) {
    console.error('[voice] transcript error relay failed:', err);
    return res.status(500).json({ error: 'relay_failed' });
  }
});
