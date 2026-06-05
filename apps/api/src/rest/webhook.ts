import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { paymentWebhookSchema } from '@manifest/shared';
import { env } from '../env.js';
import { OrderNotFoundError, processPaymentWebhook } from '../services/webhook-service.js';

/**
 * Verify the `x-manifest-signature` header is a valid HMAC-SHA256 of the raw
 * request body using the shared secret — i.e. the event genuinely came from our
 * "payment provider" and was not forged or tampered with. Timing-safe compare.
 */
function hasValidSignature(req: FastifyRequest): boolean {
  const provided = req.headers['x-manifest-signature'];
  const raw = (req as { rawBody?: string }).rawBody ?? '';
  if (typeof provided !== 'string' || !provided) return false;
  const expected = createHmac('sha256', env.WEBHOOK_SECRET).update(raw).digest('hex');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * REST endpoint for the payment webhook.
 *
 * This handler is intentionally THIN: validate the input, delegate to the
 * service, map errors to HTTP status codes. All business/idempotency logic lives
 * in webhook-service so it can be unit/integration tested without HTTP.
 */
export const webhookRoutes: FastifyPluginAsync = async (app) => {
  // Scoped to this plugin only: parse JSON but keep the raw body string so the
  // HMAC signature can be verified over the exact bytes the sender signed.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as { rawBody?: string }).rawBody = body as string;
    if (!body) return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch {
      const err = new Error('Invalid JSON') as Error & { statusCode?: number };
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  app.post('/webhooks/payment', async (req, reply) => {
    if (!hasValidSignature(req)) {
      return reply.status(401).send({ error: 'Invalid or missing webhook signature' });
    }

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
