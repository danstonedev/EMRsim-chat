import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './utils/logger.ts';
import { resolveAllowedOrigins } from './utils/origin.ts';
import { swaggerSpec } from './config/swagger.ts';
import { performanceMiddleware, getMetrics, getPrometheusMetrics } from './middleware/performance.ts';
import { router as healthRouter } from './routes/health.ts';
import { router as sessionsRouter } from './routes/sessions.ts';
import { router as voiceRouter } from './routes/voice.ts';
import { router as spsRouter, exportRouter as spsExportRouter } from './routes/sps.ts';
import { transcriptRouter } from './routes/transcript.ts';

export function createApp(): Application {
  const app = express();
  
  // Trust proxy if running behind reverse proxy (for accurate IP-based rate limiting)
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for now to avoid breaking functionality
    crossOriginEmbedderPolicy: false,
  }));
  
  // Rate limiting - more permissive for development, adjust for production
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per minute (allows burst traffic during page loads)
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests: false,
    skipFailedRequests: true, // Don't count failed requests (4xx/5xx) toward the limit
  });
  app.use('/api/', limiter);
  
  app.use(express.json({ limit: '1mb' }));
  const allowedOrigins = resolveAllowedOrigins();
  const ALLOWED_ORIGINS = new Set(allowedOrigins);
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
      // Return error instead of false to properly reject with CORS headers
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }));
  console.log('[backend] CORS allowed origins:', [...ALLOWED_ORIGINS]);

  // Performance tracking middleware (before request logger)
  app.use(performanceMiddleware);

  // Request logging middleware (after body parsers, before routes)
  app.use(requestLogger);

  // API Documentation (Swagger UI)
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EMRsim Chat API Documentation',
  }));

  // Performance Metrics Endpoints
  app.get('/metrics', (_req: Request, res: Response) => {
    res.set('Content-Type', 'text/plain');
    res.send(getPrometheusMetrics());
  });

  app.get('/api/metrics', (_req: Request, res: Response) => {
    res.json(getMetrics());
  });

  app.use('/api/health', healthRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/voice', voiceRouter);
  app.use('/api/sps', spsRouter);
  app.use('/api/sps', spsExportRouter);
  app.use('/api', transcriptRouter);
  return app;
}
