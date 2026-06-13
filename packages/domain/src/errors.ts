/**
 * Typed domain errors. These represent violations of business rules and are
 * intentionally distinct from infrastructure errors (DB, network) so callers can
 * decide whether a failure is retryable.
 */

export class DomainError extends Error {
  /** Stable machine-readable code for logging and API responses. */
  readonly code: string;
  /** Whether retrying the operation could plausibly succeed. */
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.retryable = retryable;
  }
}

/** Thrown when an order status transition is not allowed by the state machine. */
export class InvalidOrderTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('INVALID_ORDER_TRANSITION', `Cannot transition order from ${from} to ${to}`, false);
    this.name = 'InvalidOrderTransitionError';
  }
}

/** Thrown when fulfillment is attempted on an order that is not in a fulfillable state. */
export class OrderNotFulfillableError extends DomainError {
  constructor(status: string) {
    super('ORDER_NOT_FULFILLABLE', `Order in status ${status} cannot be fulfilled`, false);
    this.name = 'OrderNotFulfillableError';
  }
}

/** Thrown when there is not enough stock to reserve a requested quantity. */
export class InsufficientStockError extends DomainError {
  constructor(sku: string, requested: number, available: number) {
    super(
      'INSUFFICIENT_STOCK',
      `Insufficient stock for ${sku}: requested ${requested}, available ${available}`,
      false,
    );
    this.name = 'InsufficientStockError';
  }
}

/** Thrown when an order references a SKU that does not exist in inventory. */
export class UnknownSkuError extends DomainError {
  constructor(sku: string) {
    super('UNKNOWN_SKU', `Unknown SKU: ${sku}`, false);
    this.name = 'UnknownSkuError';
  }
}

/** Thrown when an operation references an order id that does not exist. */
export class OrderNotFoundError extends DomainError {
  constructor(orderId: string) {
    super('ORDER_NOT_FOUND', `Order not found: ${orderId}`, false);
    this.name = 'OrderNotFoundError';
  }
}

/** Thrown when a payment webhook's amount does not cover the order's total. */
export class PaymentAmountMismatchError extends DomainError {
  constructor(paid: number, expected: number) {
    super(
      'PAYMENT_AMOUNT_MISMATCH',
      `Payment amount ${paid} does not cover order total ${expected}`,
      false,
    );
    this.name = 'PaymentAmountMismatchError';
  }
}
