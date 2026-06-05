import { describe, expect, it } from 'vitest';
import { buildInvoiceNumber, shortOrderId, shouldCreateInvoice } from './invoice.js';

describe('buildInvoiceNumber', () => {
  it('formats as INV-YYYYMMDD-<shortOrderId>', () => {
    const orderId = '11112222-3333-4444-5555-66667777aaaa';
    const issuedAt = new Date(Date.UTC(2026, 5, 5)); // 2026-06-05
    const number = buildInvoiceNumber(orderId, issuedAt);
    expect(number).toBe(`INV-20260605-${shortOrderId(orderId)}`);
    expect(number).toMatch(/^INV-\d{8}-[0-9A-Z]{8}$/);
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
