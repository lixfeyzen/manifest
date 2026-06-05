/**
 * Invoice numbering and uniqueness rules.
 *
 * Business rule: one order has at most one invoice. Retried fulfillment must not
 * create a second invoice. The DB enforces this with a unique constraint on
 * `Invoice.orderId`; this module produces the deterministic invoice number and
 * exposes the "should we create one?" decision for testing.
 */

/** Short, human-friendly order suffix used in the invoice number. */
export function shortOrderId(orderId: string): string {
  return orderId.replace(/-/g, '').slice(-8).toUpperCase();
}

/**
 * Builds an invoice number of the form `INV-YYYYMMDD-XXXXXXXX`.
 * The date is passed in (not read from the clock) so the function stays pure
 * and testable.
 */
export function buildInvoiceNumber(orderId: string, issuedAt: Date): string {
  const yyyy = issuedAt.getUTCFullYear();
  const mm = String(issuedAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(issuedAt.getUTCDate()).padStart(2, '0');
  return `INV-${yyyy}${mm}${dd}-${shortOrderId(orderId)}`;
}

/** Decide whether a new invoice should be created for an order. */
export function shouldCreateInvoice(existingInvoiceId: string | null | undefined): boolean {
  return !existingInvoiceId;
}
