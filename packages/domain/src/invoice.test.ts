import { describe, expect, it } from 'vitest';
import { buildInvoiceNumber, orderIdToken, shouldCreateInvoice } from './invoice.js';

describe('buildInvoiceNumber', () => {
  it('formats as INV-YYYYMMDD-<orderIdToken>', () => {
    const orderId = '11112222-3333-4444-5555-66667777aaaa';
    const issuedAt = new Date(Date.UTC(2026, 5, 5)); // 2026-06-05
    const number = buildInvoiceNumber(orderId, issuedAt);
    expect(number).toBe(`INV-20260605-${orderIdToken(orderId)}`);
    expect(number).toMatch(/^INV-\d{8}-[0-9A-Z]+$/);
  });

  it('derives a collision-free token from the FULL order id (not a truncation)', () => {
    // Two different orders that share their last 8 hex digits must NOT collide — the
    // exact same-day collision the old 32-bit suffix allowed.
    const a = orderIdToken('aaaaaaaa-0000-0000-0000-1111deadbeef');
    const b = orderIdToken('bbbbbbbb-0000-0000-0000-2222deadbeef');
    expect(a).not.toBe(b);
  });

  it('is deterministic for the same order and date', () => {
    const issuedAt = new Date(Date.UTC(2026, 0, 1));
    const a = buildInvoiceNumber('order-abc', issuedAt);
    const b = buildInvoiceNumber('order-abc', issuedAt);
    expect(a).toBe(b);
  });
});

describe('shouldCreateInvoice (uniqueness expectation)', () => {
  it('creates an invoice when none exists', () => {
    expect(shouldCreateInvoice(null)).toBe(true);
    expect(shouldCreateInvoice(undefined)).toBe(true);
  });

  it('does not create a second invoice when one already exists', () => {
    expect(shouldCreateInvoice('invoice-1')).toBe(false);
  });
});
