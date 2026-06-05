import { OrderStatus } from '@manifest/shared';
import { InvalidOrderTransitionError } from './errors.js';

/**
 * Order lifecycle state machine.
 *
 *   PENDING ─▶ PAID ─▶ FULFILLING ─▶ FULFILLED
 *                          │
 *                          ▼
 *                        FAILED ─▶ FULFILLING   (manual retry)
 *
 * FAILED → FULFILLING exists so a failed order can be retried. Every other
 * transition not listed here is rejected with an InvalidOrderTransitionError.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID],
  [OrderStatus.PAID]: [OrderStatus.FULFILLING],
  [OrderStatus.FULFILLING]: [OrderStatus.FULFILLED, OrderStatus.FAILED],
  [OrderStatus.FAILED]: [OrderStatus.FULFILLING],
  [OrderStatus.FULFILLED]: [],
};

/** Returns true if the order may move directly from `from` to `to`. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Asserts the transition is allowed, returning the target status for convenient
 * inline use. Throws InvalidOrderTransitionError otherwise.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): OrderStatus {
  if (!canTransition(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
  return to;
}
