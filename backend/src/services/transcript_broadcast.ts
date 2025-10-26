/**
 * Transcript Broadcast Service
 *
 * Single source of truth for transcripts. All transcript events from OpenAI
 * are received here and broadcast to connected clients via WebSocket.
 * This ensures chat bubbles and print transcript page use the same data.
 */

import type { Server as SocketIOServer } from 'socket.io';
import { getSessionTurns } from '../db.ts';
import { isRedisAvailable, setNxWithTTL } from './redisClient.ts';

type TranscriptRole = 'user' | 'assistant';

// Minimal media reference passed through from frontend
export interface MediaRef {
  id: string;
  url?: string | null;
  type?: string | null;
  title?: string | null;
}

export interface TranscriptHistoryEntry {
  role: TranscriptRole;
  text: string;
  isFinal: boolean;
  timestamp: number;
  startedAtMs?: number | null;
  finalizedAtMs?: number | null;
  emittedAtMs?: number | null;
  itemId?: string;
  media?: MediaRef | null;
  source?: string;
}

let io: SocketIOServer | null = null;
const transcriptHistory = new Map<string, TranscriptHistoryEntry[]>();
const MAX_HISTORY_PER_SESSION = 200;

// === Dedupe settings (configurable via env) ===
type DedupeMode = 'off' | 'memory' | 'redis';
const envMode = (process.env.TRANSCRIPT_DEDUPE_MODE || 'memory').toLowerCase();
let DEDUPE_MODE: DedupeMode = envMode === 'off' ? 'off' : envMode === 'redis' ? 'redis' : 'memory';
let DEDUPE_TTL_SECONDS = Math.max(1, Number(process.env.TRANSCRIPT_DEDUPE_TTL_SECONDS || 30) || 30);

// In-memory dedupe store: key => lastSeenEpochMs
const seenMap = new Map<string, number>();

// Lightweight counters for observability
const counters = {
  broadcasted: { user: 0, assistant: 0 },
  dedupeDrops: { user: 0, assistant: 0 },
};

export function getTranscriptMetrics() {
  return {
    mode: DEDUPE_MODE,
    ttlSeconds: DEDUPE_TTL_SECONDS,
    broadcasted: { ...counters.broadcasted },
    dedupeDrops: { ...counters.dedupeDrops },
    cacheSize: seenMap.size,
  } as const;
}

// Small, fast text hash (FNV-1a 32-bit)
function hashText(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

function buildDedupeKey(sessionId: string, role: TranscriptRole, payload: TranscriptPayload): string | null {
  if (!payload?.isFinal) return null; // only dedupe finals
  const text = (payload.text || '').trim();
  if (!text) return null; // nothing to dedupe
  const item = (payload.itemId || '').trim();
  if (item) return `${sessionId}|${role}|item|${item}`;
  const started =
    Number.isFinite(payload.startedAtMs as number) && payload.startedAtMs != null
      ? String(payload.startedAtMs)
      : String(payload.timestamp || Date.now());
  const sig = `${role}|${started}|${hashText(text.toLowerCase())}|${text.length}`;
  return `${sessionId}|sig|${sig}`;
}

async function isDuplicate(sessionId: string, role: TranscriptRole, payload: TranscriptPayload): Promise<boolean> {
  if (DEDUPE_MODE === 'off') return false;
  const key = buildDedupeKey(sessionId, role, payload);
  if (!key) return false;
  const now = Date.now();
  const ttlMs = DEDUPE_TTL_SECONDS * 1000;

  // Redis (cross-instance) takes precedence when enabled and available
  if (DEDUPE_MODE === 'redis' && isRedisAvailable()) {
    // We cannot check existence without setting in a single op, so rely on SET NX during markSeen
    // Here we fall back to memory-only existence check as a hint
    const last = seenMap.get(key);
    return typeof last === 'number' && now - last <= ttlMs;
  }

  const last = seenMap.get(key);
  return typeof last === 'number' && now - last <= ttlMs;
}

async function markSeen(sessionId: string, role: TranscriptRole, payload: TranscriptPayload): Promise<void> {
  const key = buildDedupeKey(sessionId, role, payload);
  if (!key) return;
  const now = Date.now();
  seenMap.set(key, now);
  // Best effort Redis marker for cross-instance dedupe
  if (DEDUPE_MODE === 'redis' && isRedisAvailable()) {
    try {
      await setNxWithTTL(`dedupe:${key}`, String(now), DEDUPE_TTL_SECONDS);
    } catch {
      // ignore
    }
  }
}

// Test helpers (no-op in prod)
export function __resetTranscriptDedupeForTests(): void {
  seenMap.clear();
}
export function __setTranscriptDedupeOptionsForTests(options: { mode?: DedupeMode; ttlSeconds?: number }): void {
  if (options.mode) DEDUPE_MODE = options.mode;
  if (typeof options.ttlSeconds === 'number' && options.ttlSeconds > 0) DEDUPE_TTL_SECONDS = options.ttlSeconds;
}

export async function isDuplicateTranscript(
  sessionId: string,
  role: TranscriptRole,
  payload: TranscriptPayload
): Promise<boolean> {
  return isDuplicate(sessionId, role, payload);
}

export interface TranscriptPayload {
  text: string;
  isFinal: boolean;
  timestamp: number;
  itemId?: string;
  startedAtMs?: number | null;
  finalizedAtMs?: number | null;
  emittedAtMs?: number | null;
  media?: MediaRef | null;
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
    media: payload.media ?? null,
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
export function broadcastUserTranscript(sessionId: string, payload: TranscriptPayload): boolean | void {
  if (!io) {
    console.warn('[transcript-broadcast] not initialized, skipping broadcast');
    return false;
  }

  const { text, isFinal, itemId } = payload;
  const fallbackTimestamp = Number.isFinite(payload.timestamp) ? Number(payload.timestamp) : Date.now();
  const finalizedAt = Number.isFinite(payload.finalizedAtMs ?? undefined)
    ? Number(payload.finalizedAtMs)
    : fallbackTimestamp;
  const emittedAt = Number.isFinite(payload.emittedAtMs ?? undefined) ? Number(payload.emittedAtMs) : fallbackTimestamp;
  const startedAt = Number.isFinite(payload.startedAtMs ?? undefined) ? Number(payload.startedAtMs) : null;

  // Dedupe guard (finals only)
  if (isFinal && text.trim()) {
    // Note: isDuplicate is async; we use a sync hint via seenMap and then mark after emitting
    const now = Date.now();
    const key = buildDedupeKey(sessionId, 'user', payload);
    const ttlMs = DEDUPE_TTL_SECONDS * 1000;
    if (key) {
      const last = seenMap.get(key);
      if (typeof last === 'number' && now - last <= ttlMs) {
        console.log('[transcript-broadcast] ⏭️ dedupe drop (user)', {
          sessionId: sessionId.slice(-6),
          itemId: itemId?.slice?.(-8),
        });
        counters.dedupeDrops.user++;
        return false;
      }
    }
  }

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
    media: payload.media ?? null,
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
    media: payload.media ?? null,
    source: 'backend',
  });

  // Mark seen after successful broadcast
  if (isFinal && text.trim()) {
    // fire-and-forget
    void markSeen(sessionId, 'user', payload);
  }
  counters.broadcasted.user++;
  return true;
}

/**
 * Broadcast assistant transcript event to all clients in a session
 *
 * @param sessionId - Session identifier
 * @param payload - Transcript payload
 */
export function broadcastAssistantTranscript(sessionId: string, payload: TranscriptPayload): boolean | void {
  if (!io) {
    console.warn('[transcript-broadcast] not initialized, skipping broadcast');
    return false;
  }

  const { text, isFinal, itemId } = payload;
  const fallbackTimestamp = Number.isFinite(payload.timestamp) ? Number(payload.timestamp) : Date.now();
  const finalizedAt = Number.isFinite(payload.finalizedAtMs ?? undefined)
    ? Number(payload.finalizedAtMs)
    : fallbackTimestamp;
  const emittedAt = Number.isFinite(payload.emittedAtMs ?? undefined) ? Number(payload.emittedAtMs) : fallbackTimestamp;
  const startedAt = Number.isFinite(payload.startedAtMs ?? undefined) ? Number(payload.startedAtMs) : null;

  if (isFinal && text.trim()) {
    const now = Date.now();
    const key = buildDedupeKey(sessionId, 'assistant', payload);
    const ttlMs = DEDUPE_TTL_SECONDS * 1000;
    if (key) {
      const last = seenMap.get(key);
      if (typeof last === 'number' && now - last <= ttlMs) {
        console.log('[transcript-broadcast] ⏭️ dedupe drop (assistant)', {
          sessionId: sessionId.slice(-6),
          itemId: itemId?.slice?.(-8),
        });
        counters.dedupeDrops.assistant++;
        return false;
      }
    }
  }

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
    media: payload.media ?? null,
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
    media: payload.media ?? null,
  });

  if (isFinal && text.trim()) {
    void markSeen(sessionId, 'assistant', payload);
  }
  counters.broadcasted.assistant++;
  return true;
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
