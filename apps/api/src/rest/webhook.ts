import type { FastifyPluginAsync } from 'fastify';
import { paymentWebhookSchema } from '@manifest/shared';
import { OrderNotFoundError, processPaymentWebhook } from '../services/webhook-service.js';

/**
 * REST endpoint for the payment webhook.
 *
 * This handler is intentionally THIN: validate the input, delegate to the
 * service, map errors to HTTP status codes. All business/idempotency logic lives
 * in webhook-service so it can be unit/integration tested without HTTP.
 */
export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/webhooks/payment', async (req, reply) => {
    const parsed = paymentWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid webhook payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await processPaymentWebhook(parsed.data);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof OrderNotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      req.log.error({ err: error }, 'Failed to process payment webhook');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};
