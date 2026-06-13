import { createHmac } from 'node:crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
// Never sign with a hardcoded secret in production. In dev we allow a throwaway default
// for convenience (the API independently refuses that constant in prod, see env.ts), but
// a production deploy missing WEBHOOK_SECRET must fail loudly rather than sign with a
// publicly-known value.
const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET ??
  (process.env.NODE_ENV === 'production' ? undefined : 'dev-webhook-secret-change-me');

/**
 * Stands in for the payment provider. Runs on the Next server (so the signing
 * secret never reaches the browser): it builds the webhook payload, HMAC-signs
 * it, and forwards it to the API's /webhooks/payment endpoint. The browser's
 * "Simulate" buttons call this route, mirroring how a real provider would sign
 * and POST a webhook to us.
 */
export async function POST(request: Request): Promise<Response> {
  // Only an authenticated operator may trigger a (signed) webhook. Without this
  // check the route would be an open signing oracle: anyone could forge a valid
  // "payment succeeded" webhook for any order id.
  const cookieHeader = request.headers.get('cookie') ?? '';
  const me = await fetch(`${API_URL}/auth/me`, { headers: { cookie: cookieHeader } });
  const meData = (await me.json().catch(() => ({}))) as { user?: unknown };
  if (!me.ok || !meData.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!WEBHOOK_SECRET) {
    return Response.json(
      { error: 'Server misconfigured: WEBHOOK_SECRET is not set' },
      { status: 500 },
    );
  }

  let parsed: { orderId?: unknown; amount?: unknown; duplicate?: unknown };
  try {
    parsed = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { orderId, amount, duplicate } = parsed;
  if (typeof orderId !== 'string' || !orderId || typeof amount !== 'number') {
    return Response.json(
      { error: 'orderId (string) and amount (number) are required' },
      { status: 400 },
    );
  }

  const payload = {
    eventId: `evt_${orderId}_demo`,
    orderId,
    type: 'payment.succeeded',
    amount,
    idempotencyKey: `payment_${orderId}_demo`,
    correlationId: `corr_${orderId}_${duplicate ? 'dup' : 'first'}`,
  };
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  const res = await fetch(`${API_URL}/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-manifest-signature': signature },
    body,
  });
  const data = await res.json().catch(() => ({}));
  return Response.json(data, { status: res.status });
}
