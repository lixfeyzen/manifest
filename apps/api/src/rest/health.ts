import { prisma } from '@manifest/db';
import type { FastifyPluginAsync } from 'fastify';
import { redisConnection } from '../queue.js';

/**
 * Health endpoints.
 *  - /health  liveness: the process is up and serving.
 *  - /ready   readiness: the API can actually reach Postgres AND Redis, so an
 *             orchestrator won't route traffic to an instance that can't work.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ status: 'ok', service: 'manifest-api' }));

  app.get('/ready', async (req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redisConnection.ping();
      return { status: 'ready' };
    } catch (error) {
      // Log the detail server-side; return a generic body so we never leak DB/Redis
      // connection internals to an unauthenticated caller.
      req.log.error({ err: error }, 'readiness check failed');
      return reply.status(503).send({ status: 'unavailable' });
    }
  });
};
