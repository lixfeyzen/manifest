import { describe, expect, it } from 'vitest';
import { hasSufficientStock, isAlreadyReserved, reserveStock } from './inventory.js';
import { InsufficientStockError } from './errors.js';

describe('reserveStock', () => {
  it('decrements stock when sufficient', () => {
    expect(reserveStock('SKU-COFFEE', 20, 3)).toBe(17);
  });

  it('allows reserving exactly the remaining stock down to zero', () => {
    expect(reserveStock('SKU-HOODIE', 5, 5)).toBe(0);
  });

  it('never lets stock go below zero', () => {
    expect(() => reserveStock('SKU-HOODIE', 5, 6)).toThrow(InsufficientStockError);
  });
});

describe('hasSufficientStock', () => {
  it('is true when available covers the request', () => {
    expect(hasSufficientStock(10, 10)).toBe(true);
  });

  it('is false when the request exceeds availability', () => {
    expect(hasSufficientStock(2, 3)).toBe(false);
  });
});

describe('isAlreadyReserved (retry-safe reservation guard)', () => {
  it('detects an existing reservation for the same sku', () => {
    const reserved = new Set(['SKU-COFFEE']);
    expect(isAlreadyReserved(reserved, 'SKU-COFFEE')).toBe(true);
  });

  it('returns false for a sku not yet reserved', () => {
    const reserved = new Set(['SKU-COFFEE']);
    expect(isAlreadyReserved(reserved, 'SKU-HOODIE')).toBe(false);
  });
});
