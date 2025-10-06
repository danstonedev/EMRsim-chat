import pino from 'pino';
import type { Request, Response, NextFunction } from 'express';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Centralized logger using Pino for structured logging.
 * 
 * Usage:
 *   logger.info('Simple message');
 *   logger.info({ userId: 123 }, 'User logged in');
 *   logger.error({ err, sessionId }, 'Failed to create session');
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  // Pretty print in development for better readability
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  // Add base fields to all logs
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});

/**
 * Express middleware for request logging.
 * Logs all incoming requests with method, URL, and response time.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const { method, url, ip } = req;

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;

    const logData = {
      method,
      url,
      statusCode,
      duration,
      ip: ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    // Log level based on status code
    if (statusCode >= 500) {
      logger.error(logData, 'Request failed');
    } else if (statusCode >= 400) {
      logger.warn(logData, 'Request error');
    } else {
      logger.info(logData, 'Request completed');
    }
  });

  next();
};

/**
 * Create a child logger with additional context.
 * Useful for adding consistent fields like sessionId, userId, etc.
 */
export const createChildLogger = (bindings: Record<string, unknown>) => {
  return logger.child(bindings);
};

export default logger;
