import { z } from 'zod';

/**
 * Zod schemas for all external input. The API validates incoming requests with
 * these before any business logic runs; the worker validates job payloads.
 */

/** Single line item in a create-order request. */
export const createOrderItemSchema = z.object({
  sku: z.string().min(1, 'sku is required'),
  quantity: z.number().int().positive('quantity must be a positive integer'),
});
export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>;

/** Create-order input (GraphQL mutation). */
export const createOrderSchema = z.object({
  customerEmail: z.string().email('a valid customer email is required'),
  items: z.array(createOrderItemSchema).min(1, 'at least one item is required'),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Payment webhook payload (REST POST /webhooks/payment). */
export const paymentWebhookSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  orderId: z.string().min(1, 'orderId is required'),
  type: z.literal('payment.succeeded'),
  amount: z.number().int().nonnegative('amount must be a non-negative integer'),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  correlationId: z.string().min(1, 'correlationId is required'),
});
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;

/** New-account registration input. */
export const registerSchema = z.object({
  email: z.string().email('a valid email is required'),
  // bcrypt only uses the first 72 bytes, so cap length to avoid silent truncation.
  password: z.string().min(8, 'password must be at least 8 characters').max(72),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Login input. */
export const loginSchema = z.object({
  email: z.string().email('a valid email is required'),
  password: z.string().min(1, 'password is required').max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Fulfillment job payload enqueued onto BullMQ. */
export const fulfillmentJobDataSchema = z.object({
  orderId: z.string().min(1),
  correlationId: z.string().min(1),
});
export type FulfillmentJobData = z.infer<typeof fulfillmentJobDataSchema>;
