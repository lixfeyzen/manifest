import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@manifest/shared';
import { canBeFulfilled, decideFulfillment } from './fulfillment.js';
import { OrderNotFulfillableError } from './errors.js';

describe('decideFulfillment', () => {
  it('returns a no-op for an already fulfilled order (idempotent re-run)', () => {
    expect(decideFulfillment(OrderStatus.FULFILLED)).toEqual({
      kind: 'noop',
      reason: 'already_fulfilled',
    });
  });

  it('starts fulfillment for a paid order', () => {
    expect(decideFulfillment(OrderStatus.PAID)).toEqual({
      kind: 'start',
      from: OrderStatus.PAID,
    });
  });

  it('restarts fulfillment for a previously failed order (retry)', () => {
    expect(decideFulfillment(OrderStatus.FAILED)).toEqual({
      kind: 'start',
      from: OrderStatus.FAILED,
    });
  });

  it('continues an in-progress fulfillment', () => {
    expect(decideFulfillment(OrderStatus.FULFILLING)).toEqual({ kind: 'continue' });
  });

  it('refuses to fulfill an unpaid (PENDING) order', () => {
    expect(() => decideFulfillment(OrderStatus.PENDING)).toThrow(OrderNotFulfillableError);
  });
});

describe('canBeFulfilled', () => {
  it('is false for unpaid orders', () => {
    expect(canBeFulfilled(OrderStatus.PENDING)).toBe(false);
  });

  it('is true once an order is paid', () => {
    expect(canBeFulfilled(OrderStatus.PAID)).toBe(true);
  });
});
