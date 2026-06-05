import { env } from './env.js';
import { logger } from './logger.js';
import { buildServer } from './server.js';

/** Boot the API server. */
async function main(): Promise<void> {
  const app = await buildServer();
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  logger.info(`Manifest API ready:`);
  logger.info(`  REST    → http://localhost:${env.API_PORT}/health`);
  logger.info(`  Webhook → http://localhost:${env.API_PORT}/webhooks/payment`);
  logger.info(`  GraphQL → http://localhost:${env.API_PORT}/graphql`);
}

main().catch((error) => {
  logger.error({ err: error }, 'Failed to start API');
  process.exit(1);
});
