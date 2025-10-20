import { Request, Response } from 'express';
import { broadcastAssistantTranscript, broadcastUserTranscript } from '../services/transcript_broadcast.ts';

interface TranscriptRelayBody {
  role?: string;
  text?: string;
  isFinal?: boolean;
  timestamp?: number;
  startedAt?: number;
  started_at_ms?: number;
  finalizedAt?: number;
  finalized_at_ms?: number;
  emittedAt?: number;
  emitted_at_ms?: number;
  itemId?: string;
}

function toSafeMillis(value: unknown): number | null {
  const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
}

/**
 * Receive a transcript payload from the realtime client and broadcast it to
 * every listener joined to the session room. The frontend expects this
 * broadcast path to populate chat bubbles while `backendTranscriptMode`
 * suppresses local emission, so skipping the broadcast results in an empty UI.
 */
export function relayTranscript(
  req: Request<{ sessionId: string }, any, TranscriptRelayBody>,
  res: Response
): Response {
  const { sessionId } = req.params;
  const {
    role,
    text,
    isFinal,
    timestamp,
    itemId,
    startedAt,
    started_at_ms,
    finalizedAt,
    finalized_at_ms,
    emittedAt,
    emitted_at_ms,
  } = req.body ?? {};

  console.log('[TranscriptRelay] 📥 Received relay request:', {
    sessionId: sessionId?.slice(-6),
    role,
    isFinal,
    textLength: text?.length,
    preview: text?.slice(0, 50),
    itemId: itemId?.slice(-8),
    timestamp,
    startedAt,
    finalizedAt,
    emittedAt,
  });

  if (!sessionId) {
    console.error('[TranscriptRelay] ❌ Missing session_id');
    return res.status(400).json({ error: 'missing_session_id' });
  }

  if (role !== 'user' && role !== 'assistant') {
    console.error('[TranscriptRelay] ❌ Invalid role:', role);
    return res.status(400).json({ error: 'invalid_role' });
  }

  if (typeof text !== 'string') {
    console.error('[TranscriptRelay] ❌ Invalid text type:', typeof text);
    return res.status(400).json({ error: 'invalid_text' });
  }

  const safeStartedAt = toSafeMillis(startedAt ?? started_at_ms);
  const safeFinalizedAt = toSafeMillis(finalizedAt ?? finalized_at_ms ?? timestamp) ?? Date.now();
  const safeEmittedAt = toSafeMillis(emittedAt ?? emitted_at_ms ?? timestamp) ?? safeFinalizedAt;

  const payload = {
    text,
    isFinal: Boolean(isFinal),
    timestamp: safeFinalizedAt,
    startedAtMs: safeStartedAt ?? undefined,
    finalizedAtMs: safeFinalizedAt,
    emittedAtMs: safeEmittedAt,
    itemId,
  };

  console.log('[TranscriptRelay] 📡 Broadcasting to session:', {
    sessionId: sessionId.slice(-6),
    role,
    textLength: text.length,
    startedAt: safeStartedAt,
    finalizedAt: safeFinalizedAt,
    emittedAt: safeEmittedAt,
  });

  if (role === 'user') {
    broadcastUserTranscript(sessionId, payload);
  } else {
    broadcastAssistantTranscript(sessionId, payload);
  }

  console.log('[TranscriptRelay] ✅ Broadcast complete');
  return res.sendStatus(204);
}
