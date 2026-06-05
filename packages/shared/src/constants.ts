/**
 * Canonical enum-like constants shared across api, worker, web, and domain.
 *
 * These string values are mirrored exactly by the Prisma enums in
 * `packages/db/prisma/schema.prisma`. Keeping them as plain const objects (rather
 * than importing Prisma's generated enums) lets the domain layer stay free of any
 * database dependency while remaining type-compatible with Prisma at the boundaries.
 */

export const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FULFILLING: 'FULFILLING',
  FULFILLED: 'FULFILLED',
  FAILED: 'FAILED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const InvoiceStatus = {
  ISSUED: 'ISSUED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const FulfillmentJobStatus = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type FulfillmentJobStatus =
  (typeof FulfillmentJobStatus)[keyof typeof FulfillmentJobStatus];

export const ProcessedEventStatus = {
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;
export type ProcessedEventStatus =
  (typeof ProcessedEventStatus)[keyof typeof ProcessedEventStatus];

/**
 * Order event types written to the OrderEvent timeline.
 */
export const OrderEventType = {
  ORDER_CREATED: 'order.created',
  PAYMENT_WEBHOOK_RECEIVED: 'payment.webhook.received',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  DUPLICATE_EVENT_IGNORED: 'duplicate_event.ignored',
  FULFILLMENT_QUEUED: 'fulfillment.queued',
  FULFILLMENT_STARTED: 'fulfillment.started',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVOICE_GENERATED: 'invoice.generated',
  ORDER_FULFILLED: 'order.fulfilled',
  ORDER_FAILED: 'order.failed',
  FULFILLMENT_RETRY_REQUESTED: 'fulfillment.retry_requested',
} as const;
export type OrderEventType = (typeof OrderEventType)[keyof typeof OrderEventType];

/** BullMQ queue name for fulfillment jobs. */
export const FULFILLMENT_QUEUE_NAME = 'fulfillment';

/** Retry policy for fulfillment jobs. */
export const FULFILLMENT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
} as const;

/**
 * Deterministic BullMQ job id for an order's first fulfillment attempt.
 * Note: BullMQ disallows ':' in custom job ids, so we use '-' as the separator.
 */
export const fulfillmentJobId = (orderId: string): string => `fulfillment-${orderId}`;
