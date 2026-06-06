import { prisma } from '@manifest/db';
import { env } from './env.js';
import { logger } from './logger.js';
import { fulfillmentQueue, redisConnection } from './queue.js';
import { buildServer } from './server.js';

/** Boot the API server. */
async function main(): Promise<void> {
  const app = await buildServer();
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  logger.info(`Manifest API ready:`);
  logger.info(`  REST    -> http://localhost:${env.API_PORT}/health`);
  logger.info(`  Webhook -> http://localhost:${env.API_PORT}/webhooks/payment`);
  logger.info(`  GraphQL -> http://localhost:${env.API_PORT}/graphql`);

  // Graceful shutdown: drain in-flight requests and close connections cleanly so a
  // container restart (Kubernetes/Fly/Render send SIGTERM) doesn't drop requests or
  // leak the DB / Redis (BullMQ producer) connections. Mirrors apps/worker.
  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutting down API');
    await app.close();
    await fulfillmentQueue.close();
    await redisConnection.quit();
    await prisma.$disconnect();
    process.exit(0);
  }
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// Last-resort process guards so a stray rejection / exception is logged rather than
// failing silently (a real deployment would also forward these to error monitoring).
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception');
  process.exit(1);
});

main().catch((error) => {
  logger.error({ err: error }, 'Failed to start API');
  process.exit(1);
});
