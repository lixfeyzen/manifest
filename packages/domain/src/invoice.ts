/**
 * Invoice numbering and uniqueness rules.
 *
 * Business rule: one order has at most one invoice. Retried fulfillment must not
 * create a second invoice. The DB enforces this with a unique constraint on
 * `Invoice.orderId`; this module produces the deterministic invoice number and
 * exposes the "should we create one?" decision for testing.
 */

/**
 * The order-derived token used in the invoice number: the FULL order UUID, dashless
 * and uppercased. Using the whole id (not a truncation) means two DIFFERENT orders
 * can never derive the same invoice number, so the `@unique(invoiceNumber)` constraint
 * is only ever hit by the SAME order retrying — the intended idempotent no-op — never a
 * cross-order same-day collision. (A prior version sliced the last 8 hex chars = 32 bits,
 * which collides at a few thousand same-day fulfillments and would permanently fail a
 * paid order.)
 */
export function orderIdToken(orderId: string): string {
  return orderId.replace(/-/g, '').toUpperCase();
}

/**
 * Builds an invoice number of the form `INV-YYYYMMDD-<orderIdToken>`.
 * The date is passed in (not read from the clock) so the function stays pure
 * and testable.
 */
export function buildInvoiceNumber(orderId: string, issuedAt: Date): string {
  const yyyy = issuedAt.getUTCFullYear();
  const mm = String(issuedAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(issuedAt.getUTCDate()).padStart(2, '0');
  return `INV-${yyyy}${mm}${dd}-${orderIdToken(orderId)}`;
}

/** Decide whether a new invoice should be created for an order. */
export function shouldCreateInvoice(existingInvoiceId: string | null | undefined): boolean {
  return !existingInvoiceId;
}
