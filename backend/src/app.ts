import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './utils/logger.ts';
import { resolveAllowedOrigins } from './utils/origin.ts';
import { swaggerSpec } from './config/swagger.ts';
import { performanceMiddleware, getMetrics, getPrometheusMetrics } from './middleware/performance.ts';
import { getTranscriptMetrics } from './services/transcript_broadcast.ts';
import { correlationMiddleware } from './middleware/correlation.ts';
import { requestContextMiddleware } from './utils/requestContext.ts';
import { router as healthRouter } from './routes/health.ts';
import { router as sessionsRouter } from './routes/sessions.ts';
import { router as voiceRouter } from './routes/voice.ts';
import { router as spsRouter, exportRouter as spsExportRouter } from './routes/sps.ts';
import { router as agentsRouter } from './routes/agents.ts';
import { transcriptRouter } from './routes/transcript.ts';

export function createApp(): Application {
  const app = express();

  // Trust proxy if running behind reverse proxy (for accurate IP-based rate limiting)
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  // Build metadata (helps verify which commit/branch is deployed)
  const BUILD_TIME = new Date().toISOString();
  const GIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '';
  const GIT_BRANCH = process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || '';
  const allowedOrigins = resolveAllowedOrigins();
  const ALLOWED_ORIGINS = new Set(allowedOrigins);
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow requests with no origin (like mobile apps, Postman, curl)
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
        // Allow Vercel deployment URLs (*.vercel.app)
        if (origin && origin.match(/^https:\/\/.*\.vercel\.app$/)) {
          console.log('[cors] Allowing Vercel deployment origin:', origin);
          return cb(null, true);
        }
        // Log rejected origins for debugging
        console.warn('[cors] Rejected origin:', origin);
        // Return error instead of false to properly reject with CORS headers
        return cb(new Error('Not allowed by CORS'));
      },
      credentials: true, // Allow credentials (cookies, authorization headers)
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
    })
  );
  console.log('[backend] CORS allowed origins:', [...ALLOWED_ORIGINS]);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for now to avoid breaking functionality
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(express.json({ limit: '1mb' }));

  // Correlation / request ID middleware – before perf+logger so IDs appear in logs
  app.use(correlationMiddleware);

  // Bind per-request logger/context to AsyncLocalStorage so services can access it
  app.use(requestContextMiddleware);

  // Rate limiting - disable entirely for local development to avoid interfering with historical turn loads
  if (process.env.NODE_ENV === 'production') {
    const limiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 500, // Limit each IP to 500 requests per minute (allows burst traffic during page loads)
      standardHeaders: true,
      message: 'Too many requests from this IP, please try again later.',
      skipSuccessfulRequests: false,
      skipFailedRequests: true, // Don't count failed requests (4xx/5xx) toward the limit
    });
    app.use('/api/', limiter);
  } else {
    console.warn('[backend] Rate limiting disabled for development environment');
  }

  // Performance tracking middleware (before request logger)
  app.use(performanceMiddleware);

  // Request logging middleware (after body parsers, before routes)
  app.use(requestLogger);

  // API Documentation (Swagger UI)
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'EMRsim Chat API Documentation',
    })
  );

  // Performance Metrics Endpoints
  app.get('/metrics', (_req: Request, res: Response) => {
    res.set('Content-Type', 'text/plain');
    const base = getPrometheusMetrics();
    const t = getTranscriptMetrics();
    const lines: string[] = [base.trimEnd()];
    // Append transcript metrics as a separate section
    lines.push('# HELP transcript_broadcasted_total Total number of transcript broadcasts by role');
    lines.push('# TYPE transcript_broadcasted_total counter');
    lines.push(`transcript_broadcasted_total{role="user"} ${t.broadcasted.user}`);
    lines.push(`transcript_broadcasted_total{role="assistant"} ${t.broadcasted.assistant}`);

    lines.push('# HELP transcript_dedupe_drops_total Total number of deduplicated (dropped) transcripts by role');
    lines.push('# TYPE transcript_dedupe_drops_total counter');
    lines.push(`transcript_dedupe_drops_total{role="user"} ${t.dedupeDrops.user}`);
    lines.push(`transcript_dedupe_drops_total{role="assistant"} ${t.dedupeDrops.assistant}`);

    lines.push('# HELP transcript_dedupe_cache_entries Current dedupe cache size');
    lines.push('# TYPE transcript_dedupe_cache_entries gauge');
    lines.push(`transcript_dedupe_cache_entries ${t.cacheSize}`);

    lines.push('# HELP transcript_dedupe_ttl_seconds Configured TTL for transcript dedupe');
    lines.push('# TYPE transcript_dedupe_ttl_seconds gauge');
    lines.push(`transcript_dedupe_ttl_seconds ${t.ttlSeconds}`);

    lines.push('# HELP transcript_dedupe_mode_info Dedupe mode as info metric (1=active)');
    lines.push('# TYPE transcript_dedupe_mode_info gauge');
    lines.push(`transcript_dedupe_mode_info{mode="off"} ${t.mode === 'off' ? 1 : 0}`);
    lines.push(`transcript_dedupe_mode_info{mode="memory"} ${t.mode === 'memory' ? 1 : 0}`);
    lines.push(`transcript_dedupe_mode_info{mode="redis"} ${t.mode === 'redis' ? 1 : 0}`);

    res.send(lines.join('\n') + '\n');
  });

  app.get('/api/metrics', (_req: Request, res: Response) => {
    const base = getMetrics();
    const transcripts = getTranscriptMetrics();
    res.json({ ...base, transcripts });
  });

  // Version and build info endpoint
  app.get('/api/version', (_req: Request, res: Response) => {
    res.json({
      buildTime: BUILD_TIME,
      gitSha: GIT_SHA,
      gitBranch: GIT_BRANCH,
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || '',
    });
  });

  app.use('/api/health', healthRouter);
  // Convenience alias for environments or checks expecting root /health
  app.use('/health', healthRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/voice', voiceRouter);
  app.use('/api/sps', spsRouter);
  app.use('/api/sps', spsExportRouter);
  app.use('/api', agentsRouter);
  app.use('/api', transcriptRouter);
  return app;
}
