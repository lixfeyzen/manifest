import { describe, expect, it } from 'vitest';
import { assertPaymentCoversOrder } from './payment.js';
import { PaymentAmountMismatchError } from './errors.js';

describe('assertPaymentCoversOrder', () => {
  it('accepts an exact payment', () => {
    expect(() => assertPaymentCoversOrder(50000, 50000)).not.toThrow();
  });

  it('accepts an overpayment (provider rounding / fees)', () => {
    expect(() => assertPaymentCoversOrder(60000, 50000)).not.toThrow();
  });

  it('rejects an underpayment', () => {
    expect(() => assertPaymentCoversOrder(49999, 50000)).toThrow(PaymentAmountMismatchError);
  });

  it('rejects a zero-amount payment', () => {
    expect(() => assertPaymentCoversOrder(0, 50000)).toThrow(PaymentAmountMismatchError);
  });
});
