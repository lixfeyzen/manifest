import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
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
  const app = Fastify({ logger: opts.logger ?? true });

  // Credentialed CORS: the browser sends the session cookie cross-origin, so the
  // allowed origin must be the exact web origin (never `*`) and credentials on.
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });

  // Signed cookies (the session id is stored in a signed httpOnly `sid` cookie).
  await app.register(cookie, { secret: env.SESSION_SECRET });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(webhookRoutes);
  await app.register(graphqlPlugin);

  return app;
}
