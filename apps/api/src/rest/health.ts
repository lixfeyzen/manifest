import type { FastifyPluginAsync } from 'fastify';

/** Liveness probe. Returns 200 with a small JSON body when the API is up. */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ status: 'ok', service: 'manifest-api' }));
};
