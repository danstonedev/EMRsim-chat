import { AsyncLocalStorage } from 'node:async_hooks';
import type pino from 'pino';
import { logger } from './logger.ts';
import type { Request, Response, NextFunction } from 'express';

export interface RequestContext {
  requestId?: string;
  log: pino.Logger;
}

const als = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

export function getRequestLogger(): pino.Logger {
  return als.getStore()?.log ?? logger;
}

export function getRequestId(): string | undefined {
  return als.getStore()?.requestId;
}

/**
 * Middleware to bind a per-request context (logger + requestId) to AsyncLocalStorage
 * so services can retrieve it without changing function signatures.
 *
 * Must be registered AFTER correlationMiddleware.
 */
export function requestContextMiddleware(
  req: Request & { requestId?: string; log?: pino.Logger },
  _res: Response,
  next: NextFunction
) {
  const reqId: string | undefined = req.requestId;
  const reqLog: pino.Logger = req.log ?? logger.child({ requestId: reqId, method: req.method, url: req.originalUrl });

  const ctx: RequestContext = { requestId: reqId, log: reqLog };
  als.run(ctx, () => next());
}

export default {
  getRequestContext,
  getRequestLogger,
  getRequestId,
  requestContextMiddleware,
};
