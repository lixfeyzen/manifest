import { PaymentAmountMismatchError } from './errors.js';

/**
 * A payment must at least cover the server-priced order total. Orders are priced
 * from inventory at creation time, so the client/provider never controls the price;
 * this guard stops an underpaid (or zero-amount) webhook from shipping full goods
 * and booking a full-value invoice. Overpayment is allowed — a real provider may
 * round up or add fees — so the rule is "covers", not "equals".
 */
export function assertPaymentCoversOrder(paidAmount: number, orderTotal: number): void {
  if (paidAmount < orderTotal) {
    throw new PaymentAmountMismatchError(paidAmount, orderTotal);
  }
}
