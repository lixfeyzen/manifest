import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { graphqlPlugin } from './graphql/yoga-plugin.js';
import { healthRoutes } from './rest/health.js';
import { webhookRoutes } from './rest/webhook.js';

/**
 * Build the Fastify application: REST routes (health + webhook) in the root scope
 * with normal JSON parsing, and GraphQL Yoga mounted as an encapsulated plugin.
 * Returning the instance (instead of listening here) keeps it easy to spin up in
 * integration tests via `app.inject()` without binding a port.
 */
export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // The frontend (localhost:3000) calls this API directly from the browser.
  await app.register(cors, { origin: true });

  await app.register(healthRoutes);
  await app.register(webhookRoutes);
  await app.register(graphqlPlugin);

  return app;
}
