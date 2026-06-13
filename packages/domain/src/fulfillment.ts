import { OrderStatus } from '@manifest/shared';
import { OrderNotFulfillableError } from './errors.js';

/**
 * Decides what the worker should do when it picks up a fulfillment job for an
 * order in a given status. This keeps the "is this order fulfillable?" rule out
 * of the worker's control flow and under unit test.
 */
export type FulfillmentAction =
  | { kind: 'noop'; reason: 'already_fulfilled' }
  | { kind: 'start'; from: OrderStatus } // needs PAID/FAILED -> FULFILLING transition
  | { kind: 'continue' }; // already FULFILLING, resume idempotently

export function decideFulfillment(status: OrderStatus): FulfillmentAction {
  switch (status) {
    case OrderStatus.FULFILLED:
      return { kind: 'noop', reason: 'already_fulfilled' };
    case OrderStatus.PAID:
    case OrderStatus.FAILED:
      return { kind: 'start', from: status };
    case OrderStatus.FULFILLING:
      return { kind: 'continue' };
    case OrderStatus.PENDING:
    default:
      throw new OrderNotFulfillableError(status);
  }
}
