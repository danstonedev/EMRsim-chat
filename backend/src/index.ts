import 'dotenv/config';
import { env } from './env.js'; // Validate environment variables first (fail fast)
import { Server } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createApp } from './app.js';
import { migrate } from './db.js';
import { restorePersistedSessions, isPersistenceEnabled, flushPersistence } from './sps/runtime/persistence.js';
import { sessions } from './sps/runtime/store.js';
import { logger, createChildLogger } from './utils/logger.js';
import { resolveAllowedOrigins } from './utils/origin.js';
import { connectRedis, disconnectRedis, getRedisStatus } from './services/redisClient.js';
import type { SPSRegistry } from './sps/core/registry.js';

// Global type declaration for duplicate start detection
declare global {
  var __EMRSIM_BACKEND_STARTED: boolean | undefined;
}

// --- Boot diagnostics ---
const bootStart = Date.now();
if (globalThis.__EMRSIM_BACKEND_STARTED) {
  logger.warn('Duplicate start detected (file reloaded)');
} else {
  globalThis.__EMRSIM_BACKEND_STARTED = true;
}

function mark(label: string, extra?: string): void {
  const ms = String(Date.now() - bootStart).padStart(5, ' ');
  logger.info({ bootTimeMs: ms, extra }, label);
}

process.on('unhandledRejection', (err: unknown) => {
  logger.fatal({ err: String(err) }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (e: unknown) => {
  console.error('[fatal] uncaughtException', String(e));
});

process.on('beforeExit', code => {
  console.log('[lifecycle] beforeExit code=', code, 'uptime_s=', Math.floor((Date.now() - bootStart) / 1000));
  try {
    flushPersistence();
  } catch (err: unknown) {
    // swallow flush errors on shutdown
    console.warn('[lifecycle] flushPersistence error', String(err));
  }
});

process.on('exit', code => {
  console.log('[lifecycle] exit code=', code);
});

['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach(sig => {
  process.on(sig, async () => {
    console.log('[lifecycle] signal', sig, 'received');
    try {
      flushPersistence();
    } catch (err: unknown) {
      console.warn('[lifecycle] flushPersistence error', String(err));
    }
    
    // Graceful Redis shutdown
    try {
      await disconnectRedis();
    } catch (err: unknown) {
      console.warn('[lifecycle] Redis disconnect error', String(err));
    }
    
    // Allow default behaviour for SIGINT/SIGTERM (process exit)
    if (sig === 'SIGUSR2') return; // nodemon / tsx reload
    process.exit(0);
  });
});

mark('start');

// SPS engine (TypeScript island) loader – dynamic import to avoid startup crash if TS build missing
let loadSPSContent: (() => SPSRegistry) | undefined; // function reference after dynamic import
const app = createApp();

// Helper: extract a filesystem path from DATABASE_URL if it uses a file: scheme
function sqlitePathFromDatabaseUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    // Accept forms like file:./dev.db or file:C:\\path\\dev.db
    if (url.startsWith('file:')) {
      return url.replace(/^file:/, '');
    }
    return null;
  } catch {
    return null;
  }
}

// Initialize database (seed personas; setup sqlite if available)
(async () => {
  try {
    mark('before migrate');
    const dbPath =
      process.env.SQLITE_PATH || process.env.DB_PATH || sqlitePathFromDatabaseUrl(process.env.DATABASE_URL);
    if (dbPath && dbPath.trim()) {
      await migrate(dbPath.trim());
      console.log('[backend] database path configured:', dbPath.trim());
    } else {
      await migrate();
    }
    mark('after migrate');
    console.log('[backend] database initialized');
  } catch (e: unknown) {
    mark('migrate failed');
    console.warn('[backend] database init failed (continuing with in-memory store):', String(e));
  }
})();

// Initialize Redis connection (for session state in production)
(async () => {
  mark('before redis connect');
  try {
    await connectRedis();
    const status = getRedisStatus();
    if (status.connected) {
      console.log('[backend] ✅ Redis connected:', status.url);
    } else if (status.url) {
      console.warn('[backend] ⚠️  Redis configured but connection failed - using in-memory fallback');
    } else {
      console.log('[backend] ℹ️  Redis not configured - using in-memory session storage');
    }
    mark('after redis connect');
  } catch (e: unknown) {
    mark('redis connect failed');
    console.warn('[backend] Redis connection error (continuing with in-memory fallback):', String(e));
  }
})();

// Load SPS content (wrapped in async IIFE since top-level await not used here)
(async () => {
  mark('before sps import');
  try {
    // Preload catalogs in parallel with SPS import
    const catalogPromise = import('./services/catalogService.ts').then(mod => {
      mark('before catalog preload');
      return mod.catalogService.preloadAll();
    });

    const mod = await import('./sps/runtime/session.ts');
    mark('after sps import');
    loadSPSContent = mod.loadSPSContent;
    const registry = loadSPSContent();
    mark('after sps load');

    // Wait for catalogs to finish loading
    await catalogPromise;
    mark('after catalog preload');
    const counts = {
      screening: Object.keys(registry.screening).length,
      specials: Object.keys(registry.specials).length,
      personas: Object.keys(registry.personas).length,
      scenarios: Object.keys(registry.scenarios).length,
    };
    // Runtime catalog is single-source (file-based registry). DB-backed scenarios are no longer injected at boot.
    if (isPersistenceEnabled()) {
      const { restored } = restorePersistedSessions(registry);
      console.log('[sps] content loaded', { ...counts, restored_sessions: restored });
    } else {
      console.log('[sps] content loaded', { ...counts, restored_sessions: 0 });
    }
  } catch (e: unknown) {
    mark('sps import failed');
    console.warn('[sps] failed to load SPS content:', String(e));
  }
})();

// Log voice config for diagnostics
console.log('[backend] voice config', {
  VOICE_ENABLED: process.env.VOICE_ENABLED,
  OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL,
  OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE,
});

const host = process.env.HOST || env.HOST || '0.0.0.0';
const port = env.PORT;
const server: Server = app.listen(port, host, () => {
  mark('listening');
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`[backend] listening on http://${displayHost}:${port} (host=${host})`);
});

server.on('error', (err: unknown) => {
  console.error('[backend] server error:', String(err));
});

// Setup Socket.IO for real-time transcript broadcasting
import { initTranscriptBroadcast, getTranscriptHistory } from './services/transcript_broadcast.js';

const socketAllowedOrigins = resolveAllowedOrigins();
logger.info({ socketAllowedOrigins }, '[socket.io] allowed origins');

const io = new SocketIOServer(server, {
  cors: {
    origin: socketAllowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket: Socket) => {
  const socketLog = createChildLogger({ socketId: socket.id });
  socketLog.info('[socket.io] client connected');

  // Join session-specific room for transcript isolation
  socket.on('join-session', (sessionId: string) => {
    if (sessionId) {
      socket.join(`session:${sessionId}`);
      socketLog.info({ sessionId }, '[socket.io] joined session');

      try {
        const history = getTranscriptHistory(sessionId);
        if (history.length) {
          socketLog.info({ sessionId, count: history.length }, '[socket.io] replaying transcript history');
          history.forEach(entry => {
            socket.emit('transcript', {
              role: entry.role,
              text: entry.text,
              isFinal: entry.isFinal,
              timestamp: entry.timestamp,
              itemId: entry.itemId,
              source: entry.source ?? 'history',
            });
          });
        }
      } catch (error: unknown) {
        socketLog.error({ sessionId, error: String(error) }, '[socket.io] failed to replay transcript history');
      }
    }
  });

  socket.on('disconnect', () => {
    socketLog.info('[socket.io] client disconnected');
  });
});

// Initialize transcript broadcast service
initTranscriptBroadcast(io);
mark('websocket initialized');

// Export io instance for use in routes/services
export { io };

// Export createApp for Vercel serverless
export { createApp } from './app.js';

// Heartbeat (diagnostic) – logs every 15s by default, configurable via HEARTBEAT_INTERVAL_MS
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 15000);
const hb = setInterval(() => {
  try {
    const mem = process.memoryUsage();
    console.log('[heartbeat]', {
      uptime_s: Math.floor((Date.now() - bootStart) / 1000),
      sessions: sessions.size,
      rss_mb: (mem.rss / 1024 / 1024).toFixed(1),
      heap_mb: (mem.heapUsed / 1024 / 1024).toFixed(1),
    });
  } catch (e) {
    console.warn('[heartbeat][error]', String(e));
  }
}, HEARTBEAT_INTERVAL_MS);
hb.unref();
