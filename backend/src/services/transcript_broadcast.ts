/**
 * Transcript Broadcast Service
 *
 * Single source of truth for transcripts. All transcript events from OpenAI
 * are received here and broadcast to connected clients via WebSocket.
 * This ensures chat bubbles and print transcript page use the same data.
 */

import type { Server as SocketIOServer } from 'socket.io';
import { getSessionTurns } from '../db.ts';

type TranscriptRole = 'user' | 'assistant';

export interface TranscriptHistoryEntry {
  role: TranscriptRole;
  text: string;
  isFinal: boolean;
  timestamp: number;
  startedAtMs?: number | null;
  finalizedAtMs?: number | null;
  emittedAtMs?: number | null;
  itemId?: string;
  source?: string;
}

let io: SocketIOServer | null = null;
const transcriptHistory = new Map<string, TranscriptHistoryEntry[]>();
const MAX_HISTORY_PER_SESSION = 200;

export interface TranscriptPayload {
  text: string;
  isFinal: boolean;
  timestamp: number;
  itemId?: string;
  startedAtMs?: number | null;
  finalizedAtMs?: number | null;
  emittedAtMs?: number | null;
}

function appendTranscriptHistory(sessionId: string, role: TranscriptRole, payload: TranscriptPayload): void {
  const bucket = transcriptHistory.get(sessionId) ?? [];
  const fallbackTimestamp = Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now();
  const finalizedAt = Number.isFinite(payload.finalizedAtMs ?? undefined)
    ? Number(payload.finalizedAtMs)
    : fallbackTimestamp;
  const emittedAt = Number.isFinite(payload.emittedAtMs ?? undefined) ? Number(payload.emittedAtMs) : fallbackTimestamp;
  const startedAt = Number.isFinite(payload.startedAtMs ?? undefined) ? Number(payload.startedAtMs) : null;

  bucket.push({
    role,
    text: payload.text,
    isFinal: payload.isFinal,
    timestamp: finalizedAt,
    startedAtMs: startedAt,
    finalizedAtMs: finalizedAt,
    emittedAtMs: emittedAt,
    itemId: payload.itemId,
    source: 'backend',
  });
  if (bucket.length > MAX_HISTORY_PER_SESSION) {
    bucket.splice(0, bucket.length - MAX_HISTORY_PER_SESSION);
  }
  transcriptHistory.set(sessionId, bucket);
}

export function getTranscriptHistory(sessionId: string): TranscriptHistoryEntry[] {
  // First check in-memory cache (for recent real-time transcripts)
  const memoryHistory = transcriptHistory.get(sessionId);
  if (memoryHistory && memoryHistory.length > 0) {
    return memoryHistory;
  }

  // If not in memory, load from database
  try {
    const turns = getSessionTurns(sessionId);
    return turns.map(turn => {
      const timestamp = turn.created_at ? new Date(turn.created_at).getTime() : Date.now();
      return {
        role: turn.role as TranscriptRole,
        text: turn.text,
        isFinal: true,
        timestamp,
        source: 'database',
      };
    });
  } catch (error) {
    console.error('[transcript-broadcast] Failed to load history from database:', error);
    return [];
  }
}

/**
 * Initialize the broadcast service with Socket.IO instance
 */
export function initTranscriptBroadcast(socketIO: SocketIOServer): void {
  io = socketIO;
  console.log('[transcript-broadcast] service initialized');
}

/**
 * Get the Socket.IO instance
 * @returns Socket.IO instance or null if not initialized
 */
export function getSocket(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast user transcript event to all clients in a session
 *
 * @param sessionId - Session identifier
 * @param payload - Transcript payload
 */
export function broadcastUserTranscript(sessionId: string, payload: TranscriptPayload): void {
  if (!io) {
    console.warn('[transcript-broadcast] not initialized, skipping broadcast');
    return;
  }

  const { text, isFinal, itemId } = payload;
  const fallbackTimestamp = Number.isFinite(payload.timestamp) ? Number(payload.timestamp) : Date.now();
  const finalizedAt = Number.isFinite(payload.finalizedAtMs ?? undefined)
    ? Number(payload.finalizedAtMs)
    : fallbackTimestamp;
  const emittedAt = Number.isFinite(payload.emittedAtMs ?? undefined) ? Number(payload.emittedAtMs) : fallbackTimestamp;
  const startedAt = Number.isFinite(payload.startedAtMs ?? undefined) ? Number(payload.startedAtMs) : null;

  console.log('[transcript-broadcast] broadcasting user transcript:', {
    sessionId,
    textLength: text.length,
    preview: text.slice(0, 50),
    isFinal,
    timestamp: finalizedAt,
    startedAt,
    emittedAt,
  });

  appendTranscriptHistory(sessionId, 'user', {
    text,
    isFinal,
    timestamp: finalizedAt,
    startedAtMs: startedAt,
    finalizedAtMs: finalizedAt,
    emittedAtMs: emittedAt,
    itemId,
  });

  io.to(`session:${sessionId}`).emit('transcript', {
    role: 'user',
    text,
    isFinal,
    timestamp: finalizedAt,
    startedAtMs: startedAt ?? undefined,
    finalizedAtMs: finalizedAt,
    emittedAtMs: emittedAt,
    itemId,
    source: 'backend',
  });
}

/**
 * Broadcast assistant transcript event to all clients in a session
 *
 * @param sessionId - Session identifier
 * @param payload - Transcript payload
 */
export function broadcastAssistantTranscript(sessionId: string, payload: TranscriptPayload): void {
  if (!io) {
    console.warn('[transcript-broadcast] not initialized, skipping broadcast');
    return;
  }

  const { text, isFinal, itemId } = payload;
  const fallbackTimestamp = Number.isFinite(payload.timestamp) ? Number(payload.timestamp) : Date.now();
  const finalizedAt = Number.isFinite(payload.finalizedAtMs ?? undefined)
    ? Number(payload.finalizedAtMs)
    : fallbackTimestamp;
  const emittedAt = Number.isFinite(payload.emittedAtMs ?? undefined) ? Number(payload.emittedAtMs) : fallbackTimestamp;
  const startedAt = Number.isFinite(payload.startedAtMs ?? undefined) ? Number(payload.startedAtMs) : null;

  console.log('[transcript-broadcast] broadcasting assistant transcript:', {
    sessionId,
    textLength: text.length,
    preview: text.slice(0, 50),
    isFinal,
    timestamp: finalizedAt,
    startedAt,
    emittedAt,
  });

  io.to(`session:${sessionId}`).emit('transcript', {
    role: 'assistant',
    text,
    isFinal,
    timestamp: finalizedAt,
    startedAtMs: startedAt ?? undefined,
    finalizedAtMs: finalizedAt,
    emittedAtMs: emittedAt,
    itemId,
    source: 'backend',
  });

  appendTranscriptHistory(sessionId, 'assistant', {
    text,
    isFinal,
    timestamp: finalizedAt,
    startedAtMs: startedAt,
    finalizedAtMs: finalizedAt,
    emittedAtMs: emittedAt,
    itemId,
  });
}

/**
 * Broadcast transcription error to clients in a session
 *
 * @param sessionId - Session identifier
 * @param error - Error details
 */
export function broadcastTranscriptError(sessionId: string, error: Error | string): void {
  if (!io) {
    console.warn('[transcript-broadcast] not initialized, skipping error broadcast');
    return;
  }

  console.error('[transcript-broadcast] broadcasting error:', {
    sessionId,
    error: typeof error === 'string' ? error : error.message,
  });

  io.to(`session:${sessionId}`).emit('transcript-error', {
    error: typeof error === 'string' ? error : error.message,
    timestamp: Date.now(),
  });
}
