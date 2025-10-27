import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    log?: import('pino').Logger;
  }
}

/**
 * Attaches a correlation/request ID to each request and exposes a child logger.
 * - Reads from X-Request-Id / X-Correlation-Id if provided; otherwise generates one.
 * - Sets response header X-Request-Id so clients can trace.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const hdrId = req.get('x-request-id') || req.get('x-correlation-id');
  const requestId = (hdrId && hdrId.trim()) || randomUUID();

  // Attach to request and response for downstream use
  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  // Attach a child logger scoped to this request
  req.log = logger.child({ requestId, method: req.method, url: req.originalUrl });

  next();
}

export default correlationMiddleware;
