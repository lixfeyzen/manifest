import { describe, expect, it } from 'vitest';
import { ProcessedEventStatus } from '@manifest/shared';
import { decideIdempotency } from './idempotency.js';

describe('decideIdempotency', () => {
  it('processes an event that has never been seen', () => {
    expect(decideIdempotency(null)).toEqual({ kind: 'process' });
    expect(decideIdempotency(undefined)).toEqual({ kind: 'process' });
  });

  it('ignores an event that was already fully processed', () => {
    expect(decideIdempotency(ProcessedEventStatus.PROCESSED)).toEqual({
      kind: 'ignore',
      reason: 'already_processed',
    });
  });

  it('ignores a concurrent in-progress duplicate', () => {
    expect(decideIdempotency(ProcessedEventStatus.PROCESSING)).toEqual({
      kind: 'ignore',
      reason: 'in_progress',
    });
  });

  it('ignores a previously failed event (FAILED is never written, so it is treated as handled)', () => {
    expect(decideIdempotency(ProcessedEventStatus.FAILED)).toEqual({
      kind: 'ignore',
      reason: 'already_processed',
    });
  });
});
