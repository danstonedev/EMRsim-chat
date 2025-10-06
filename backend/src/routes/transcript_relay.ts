import { Request, Response } from 'express';
import { broadcastUserTranscript, broadcastAssistantTranscript } from '../services/transcript_broadcast.ts';

/**
 * Relays a transcript from a client to all other clients in the same session.
 * This is used to synchronize transcripts between multiple browser tabs or devices
 * without sending the audio to the backend again.
 */
export function relayTranscript(req: Request, res: Response): Response | void {
  const { sessionId } = req.params;
  const { role, text, isFinal, timestamp, itemId } = req.body;

  if (!sessionId || !role || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing required fields: sessionId, role, text' });
  }

  const payload = { text, isFinal, timestamp, itemId };

  if (role === 'user') {
    broadcastUserTranscript(sessionId, payload);
  } else if (role === 'assistant') {
    broadcastAssistantTranscript(sessionId, payload);
  } else {
    return res.status(400).json({ error: 'Invalid role specified' });
  }

  res.status(204).send();
}
