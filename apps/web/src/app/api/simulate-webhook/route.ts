import { createHmac } from 'node:crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? 'dev-webhook-secret-change-me';

/**
 * Stands in for the payment provider. Runs on the Next server (so the signing
 * secret never reaches the browser): it builds the webhook payload, HMAC-signs
 * it, and forwards it to the API's /webhooks/payment endpoint. The browser's
 * "Simulate" buttons call this route, mirroring how a real provider would sign
 * and POST a webhook to us.
 */
export async function POST(request: Request): Promise<Response> {
  const { orderId, amount, duplicate } = (await request.json()) as {
    orderId: string;
    amount: number;
    duplicate?: boolean;
  };

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
