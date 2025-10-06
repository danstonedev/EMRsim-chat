import 'dotenv/config';
import { env } from './env.ts'; // Validate environment variables first (fail fast)
import { Server } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createApp } from './app.ts';
import { migrate } from './db.ts';
import { restorePersistedSessions, isPersistenceEnabled, flushPersistence } from './sps/runtime/persistence.js';
import { sessions } from './sps/runtime/store.js';
import { logger } from './utils/logger.ts';
import { resolveAllowedOrigins } from './utils/origin.ts';

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
  logger.fatal({ err }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (e) => {
  console.error('[fatal] uncaughtException', e);
});

process.on('beforeExit', (code) => {
  console.log('[lifecycle] beforeExit code=', code, 'uptime_s=', Math.floor((Date.now() - bootStart) / 1000));
  try { flushPersistence(); } catch { }
});

process.on('exit', (code) => {
  console.log('[lifecycle] exit code=', code);
});

['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach(sig => {
  process.on(sig, () => {
    console.log('[lifecycle] signal', sig, 'received');
    try { flushPersistence(); } catch { }
    // Allow default behaviour for SIGINT/SIGTERM (process exit)
    if (sig === 'SIGUSR2') return; // nodemon / tsx reload
    process.exit(0);
  });
});

mark('start');

// SPS engine (TypeScript island) loader – dynamic import to avoid startup crash if TS build missing
let loadSPSContent: (() => any) | undefined; // function reference after dynamic import
const app = createApp();

// Initialize database (seed personas; setup sqlite if available)
(async () => {
  try {
    mark('before migrate');
    await migrate();
    mark('after migrate');
    console.log('[backend] database initialized');
  } catch (e) {
    mark('migrate failed');
    console.warn('[backend] database init failed (continuing with in-memory store):', e);
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
    // Also load any DB-persisted scenarios and register them
    try {
      const { getAllScenariosFull } = await import('./db.ts');
      const extra = getAllScenariosFull();
      if (Array.isArray(extra) && extra.length) {
        const { spsRegistry } = await import('./sps/core/registry.ts');
        spsRegistry.addScenarios(extra as any);
        counts.scenarios = Object.keys(spsRegistry.scenarios).length;
      }
    } catch (e) {
      console.warn('[sps] failed to load DB-backed scenarios', e);
    }
    if (isPersistenceEnabled()) {
      const { restored } = restorePersistedSessions(registry);
      console.log('[sps] content loaded', { ...counts, restored_sessions: restored });
    } else {
      console.log('[sps] content loaded', { ...counts, restored_sessions: 0 });
    }
  } catch (e) {
    mark('sps import failed');
    console.warn('[sps] failed to load SPS content:', e);
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

server.on('error', (err: Error) => {
  console.error('[backend] server error:', err);
});

// Setup Socket.IO for real-time transcript broadcasting
import { initTranscriptBroadcast, getTranscriptHistory } from './services/transcript_broadcast.ts';

const socketAllowedOrigins = resolveAllowedOrigins();
console.log('[socket.io] allowed origins:', socketAllowedOrigins);

const io = new SocketIOServer(server, {
  cors: {
    origin: socketAllowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling']
});

io.on('connection', (socket: Socket) => {
  console.log('[socket.io] client connected:', socket.id);

  // Join session-specific room for transcript isolation
  socket.on('join-session', (sessionId: string) => {
    if (sessionId) {
      socket.join(`session:${sessionId}`);
      console.log('[socket.io] socket', socket.id, 'joined session:', sessionId);

      try {
        const history = getTranscriptHistory(sessionId);
        if (history.length) {
          console.log('[socket.io] replaying transcript history to socket:', { socketId: socket.id, sessionId, count: history.length });
          history.forEach((entry) => {
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
      } catch (error) {
        console.error('[socket.io] failed to replay transcript history:', { sessionId, error });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('[socket.io] client disconnected:', socket.id);
  });
});

// Initialize transcript broadcast service
initTranscriptBroadcast(io);
mark('websocket initialized');

// Export io instance for use in routes/services
export { io };

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
    console.warn('[heartbeat][error]', e);
  }
}, HEARTBEAT_INTERVAL_MS);
hb.unref();
