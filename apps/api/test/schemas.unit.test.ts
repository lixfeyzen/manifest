import { describe, expect, it } from 'vitest';
import {
  createOrderSchema,
  paymentWebhookSchema,
  registerSchema,
  loginSchema,
} from '@manifest/shared';

describe('createOrderSchema', () => {
  it('accepts a valid order', () => {
    const result = createOrderSchema.safeParse({
      customerEmail: 'buyer@example.com',
      items: [{ sku: 'SKU-COFFEE', quantity: 2 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty items array', () => {
    const result = createOrderSchema.safeParse({
      customerEmail: 'buyer@example.com',
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive quantity', () => {
    const result = createOrderSchema.safeParse({
      customerEmail: 'buyer@example.com',
      items: [{ sku: 'SKU-COFFEE', quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing customerEmail', () => {
    const result = createOrderSchema.safeParse({
      items: [{ sku: 'SKU-COFFEE', quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid customerEmail', () => {
    const result = createOrderSchema.safeParse({
      customerEmail: 'not-an-email',
      items: [{ sku: 'SKU-COFFEE', quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer quantity', () => {
    const result = createOrderSchema.safeParse({
      customerEmail: 'buyer@example.com',
      items: [{ sku: 'SKU-COFFEE', quantity: 1.5 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('paymentWebhookSchema', () => {
  const valid = {
    eventId: 'evt_1',
    orderId: 'order_1',
    type: 'payment.succeeded' as const,
    amount: 120000,
    idempotencyKey: 'payment_order_1_demo',
    correlationId: 'corr_1',
  };

  it('accepts a valid webhook payload', () => {
    const result = paymentWebhookSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects a missing idempotencyKey', () => {
    const { idempotencyKey: _omit, ...rest } = valid;
    const result = paymentWebhookSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects a non-number amount', () => {
    const result = paymentWebhookSchema.safeParse({ ...valid, amount: '120000' });
    expect(result.success).toBe(false);
  });

  it('rejects a wrong event type', () => {
    const result = paymentWebhookSchema.safeParse({ ...valid, type: 'payment.failed' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative amount', () => {
    const result = paymentWebhookSchema.safeParse({ ...valid, amount: -1 });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const result = registerSchema.safeParse({
      email: 'new@example.com',
      password: 'supersecret',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      email: 'new@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password longer than 72 characters', () => {
    const result = registerSchema.safeParse({
      email: 'new@example.com',
      password: 'a'.repeat(73),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'supersecret',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'whatever',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing password field', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing email field', () => {
    const result = loginSchema.safeParse({ password: 'whatever' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});
