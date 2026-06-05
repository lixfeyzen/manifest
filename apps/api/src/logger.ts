import pino from 'pino';
import { env } from './env.js';

/**
 * Application logger. In development we pretty-print; in production we emit JSON
 * lines so a log aggregator can parse them. Every log line related to an order
 * flow should include a `correlationId` so a single request can be traced across
 * the API, the queue, and the worker.
 */
export const logger = pino({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
});

/** Create a child logger bound to a correlation id for request-scoped tracing. */
export const withCorrelation = (correlationId: string) => logger.child({ correlationId });
