import { ProcessedEventStatus } from '@manifest/shared';

/**
 * Helpers describing how to react to a previously-seen (or new) webhook event,
 * based on its ProcessedEvent record. The actual DB read/write happens in the
 * API service; this keeps the decision logic pure and unit-tested.
 */

export type IdempotencyDecision =
  | { kind: 'process' } // never seen before, process it
  | { kind: 'ignore'; reason: 'already_processed' } // completed earlier, ignore safely
  | { kind: 'ignore'; reason: 'in_progress' }; // concurrent duplicate, ignore safely

/**
 * Given the status of an existing ProcessedEvent (or null if none exists),
 * decide whether to process the incoming event or ignore it as a duplicate.
 */
export function decideIdempotency(
  existingStatus: ProcessedEventStatus | null | undefined,
): IdempotencyDecision {
  if (existingStatus == null) {
    return { kind: 'process' };
  }
  if (existingStatus === ProcessedEventStatus.PROCESSED) {
    return { kind: 'ignore', reason: 'already_processed' };
  }
  if (existingStatus === ProcessedEventStatus.PROCESSING) {
    return { kind: 'ignore', reason: 'in_progress' };
  }
  // FAILED is never written today (the API writes PROCESSING then PROCESSED, and the
  // worker sweep advances PROCESSING to PROCESSED), so any other status is treated as
  // already handled rather than reprocessed (a reprocess would hit the unique key anyway).
  return { kind: 'ignore', reason: 'already_processed' };
}

/** Standard response body returned by the webhook endpoint. */
export interface WebhookResult {
  status: 'processed' | 'ignored';
  message: string;
}

export const WEBHOOK_PROCESSED: WebhookResult = {
  status: 'processed',
  message: 'Payment event processed successfully',
};

export const WEBHOOK_IGNORED: WebhookResult = {
  status: 'ignored',
  message: 'Duplicate event ignored safely',
};
