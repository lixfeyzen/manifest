import { InsufficientStockError } from './errors.js';

/**
 * Pure stock arithmetic. The worker performs the actual DB decrement inside a
 * transaction, but the "can we reserve this?" and "what's the new stock?" rules
 * live here so they are unit-tested and impossible to get wrong at the call site.
 */

/** True if `available` stock can satisfy `requested` quantity. */
export function hasSufficientStock(available: number, requested: number): boolean {
  return requested >= 0 && available >= requested;
}

/**
 * Computes the new stock level after reserving `requested` units, asserting it
 * never drops below zero. Throws InsufficientStockError otherwise.
 */
export function reserveStock(sku: string, available: number, requested: number): number {
  if (!hasSufficientStock(available, requested)) {
    throw new InsufficientStockError(sku, requested, available);
  }
  return available - requested;
}

/** True when a reservation already exists for this order+sku (retry guard). */
export function isAlreadyReserved(existingReservedSkus: ReadonlySet<string>, sku: string): boolean {
  return existingReservedSkus.has(sku);
}
