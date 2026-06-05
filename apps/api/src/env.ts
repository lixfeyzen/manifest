import { z } from 'zod';

/**
 * Validate environment variables at startup. If something required is missing or
 * malformed, the process exits immediately with a clear message instead of
 * failing mysteriously later when the value is first used.
 */
const DEV_SESSION_SECRET = 'dev-insecure-session-secret-change-me-please';
// Mirrored exactly by apps/web/src/app/api/simulate-webhook/route.ts (the signer).
export const DEV_WEBHOOK_SECRET = 'dev-webhook-secret-change-me';

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    API_PORT: z.coerce.number().int().positive().default(4000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // Secret used to sign the session cookie.
    SESSION_SECRET: z.string().min(16).default(DEV_SESSION_SECRET),
    // Exact browser origin allowed to send credentialed requests (CORS).
    WEB_ORIGIN: z.string().url().default('http://localhost:3001'),
    // Shared secret for HMAC-signing the payment webhook (the "provider" signs,
    // this API verifies). Mirrors how Stripe/Midtrans sign their webhooks.
    WEBHOOK_SECRET: z.string().min(8).default(DEV_WEBHOOK_SECRET),
  })
  // Never allow the throwaway dev secrets in production.
  .refine((e) => e.NODE_ENV !== 'production' || e.SESSION_SECRET !== DEV_SESSION_SECRET, {
    message: 'SESSION_SECRET must be set to a strong value in production',
    path: ['SESSION_SECRET'],
  })
  .refine((e) => e.NODE_ENV !== 'production' || e.WEBHOOK_SECRET !== DEV_WEBHOOK_SECRET, {
    message: 'WEBHOOK_SECRET must be set to a strong value in production',
    path: ['WEBHOOK_SECRET'],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
