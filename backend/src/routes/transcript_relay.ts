import { Request, Response } from 'express';
import { broadcastUserTranscript, broadcastAssistantTranscript } from '../services/transcript_broadcast.js';
import { insertTurn } from '../db.js';

/**
 * Relays a transcript from a client to all other clients in the same session.
 * This is used to synchronize transcripts between multiple browser tabs or devices
 * without sending the audio to the backend again.
 *
 * PHASE 1.2: Now also persists final transcripts to database for transcript completeness.
 */
export function relayTranscript(req: Request, res: Response): Response | void {
  const { sessionId } = req.params;
  const { role, text, isFinal, timestamp, itemId, media, startedAt, finalizedAt, emittedAt, source } = req.body;

  if (!sessionId || !role || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing required fields: sessionId, role, text' });
  }

  const payload = {
    text,
    isFinal,
    timestamp,
    itemId,
    media,
    // Normalize timing field names from frontend to backend payload
    startedAtMs: typeof startedAt === 'number' ? startedAt : undefined,
    finalizedAtMs: typeof finalizedAt === 'number' ? finalizedAt : undefined,
    emittedAtMs: typeof emittedAt === 'number' ? emittedAt : undefined,
    source: typeof source === 'string' ? source : undefined,
  } as any;

  // Broadcast to WebSocket clients (dedupe-aware; returns true if broadcasted)
  let broadcasted = false;
  if (role === 'user') {
    broadcasted = Boolean(broadcastUserTranscript(sessionId, payload));
  } else if (role === 'assistant') {
    broadcasted = Boolean(broadcastAssistantTranscript(sessionId, payload));
  } else {
    return res.status(400).json({ error: 'Invalid role specified' });
  }

  // PHASE 1.2: Persist final transcripts to database
  // This ensures transcripts are not lost even if clients disconnect before viewing
  if (broadcasted && isFinal && text.trim()) {
    try {
      insertTurn(sessionId, role, text.trim(), {
        channel: 'audio',
        timestamp_ms: finalizedAt || emittedAt || timestamp || Date.now(),
        started_timestamp_ms: startedAt,
        finalized_timestamp_ms: finalizedAt,
        emitted_timestamp_ms: emittedAt,
        item_id: itemId,
        source,
      });
      console.log('[transcript_relay] Persisted final transcript:', {
        sessionId: sessionId.slice(-6),
        role,
        textLength: text.length,
        itemId: itemId?.slice(-8),
      });
    } catch (error) {
      // Log but don't fail the request - broadcast already succeeded
      console.error('[transcript_relay] Failed to persist transcript:', error);
    }
  }

  res.status(204).send();
}
