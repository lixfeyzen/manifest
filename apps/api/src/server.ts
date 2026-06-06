import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { env } from './env.js';
import { graphqlPlugin } from './graphql/yoga-plugin.js';
import { authRoutes } from './rest/auth.js';
import { healthRoutes } from './rest/health.js';
import { webhookRoutes } from './rest/webhook.js';

/**
 * Build the Fastify application: REST routes (health, auth, webhook) in the root
 * scope, and GraphQL Yoga mounted as an encapsulated plugin. Returning the
 * instance (instead of listening here) keeps it easy to spin up in integration
 * tests via `app.inject()` without binding a port.
 */
export async function buildServer(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === false ? false : { base: { service: 'manifest-api' } },
    // Behind a load balancer / reverse proxy, trust X-Forwarded-* so req.ip is the
    // real client. Without this, rate limiting would key on the proxy's IP and the
    // brute-force protection would be a single shared (useless) bucket.
    trustProxy: true,
    // Adopt an inbound x-correlation-id as the request id (and log it as
    // `correlationId`) so access logs share one key with the domain logs.
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-correlation-id',
    requestIdLogLabel: 'correlationId',
  });

  // Credentialed CORS: the browser sends the session cookie cross-origin, so the
  // allowed origin must be the exact web origin (never `*`) and credentials on.
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });

  // Signed cookies (the session id is stored in a signed httpOnly `sid` cookie).
  await app.register(cookie, { secret: env.SESSION_SECRET });

  // Security response headers. The default CSP only matters for the dev-only
  // GraphiQL HTML, so enable it in production and disable just the CSP in dev so
  // the explorer's inline assets still load.
  await app.register(helmet, { contentSecurityPolicy: env.NODE_ENV === 'production' });

  // Rate limiting (brute-force / abuse protection). Skipped under test so the
  // integration suite can fire many requests from one IP without tripping it; the
  // stricter per-route limits on /auth live in rest/auth.ts.
  if (env.NODE_ENV !== 'test') {
    await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  }

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(webhookRoutes);
  await app.register(graphqlPlugin);

  return app;
}
