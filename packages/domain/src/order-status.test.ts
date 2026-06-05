import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@manifest/shared';
import { assertTransition, canTransition } from './order-status.js';
import { InvalidOrderTransitionError } from './errors.js';

describe('order status transitions', () => {
  it('allows the valid lifecycle transitions', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.PAID)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.FULFILLING)).toBe(true);
    expect(canTransition(OrderStatus.FULFILLING, OrderStatus.FULFILLED)).toBe(true);
    expect(canTransition(OrderStatus.FULFILLING, OrderStatus.FAILED)).toBe(true);
  });

  it('allows retrying a failed order back into fulfilling', () => {
    expect(canTransition(OrderStatus.FAILED, OrderStatus.FULFILLING)).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.FULFILLED)).toBe(false);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.FULFILLING)).toBe(false);
    expect(canTransition(OrderStatus.PAID, OrderStatus.FULFILLED)).toBe(false);
    expect(canTransition(OrderStatus.FULFILLED, OrderStatus.PENDING)).toBe(false);
    expect(canTransition(OrderStatus.FULFILLED, OrderStatus.FULFILLING)).toBe(false);
  });

  it('assertTransition returns the target on a valid move', () => {
    expect(assertTransition(OrderStatus.PENDING, OrderStatus.PAID)).toBe(OrderStatus.PAID);
  });

  it('assertTransition throws InvalidOrderTransitionError on an invalid move', () => {
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.FULFILLED)).toThrow(
      InvalidOrderTransitionError,
    );
  });
});
