# ADR 001: Idempotency key for the payment webhook

## Status
Accepted.

## Context
Payment providers deliver webhooks **at least once**, not exactly once. The same
`payment.succeeded` event can arrive multiple times (provider retries, network
timeouts, the user clicking twice in a demo). If we naïvely process every delivery,
we would create duplicate payments, enqueue duplicate fulfillment jobs, and
ultimately risk double-charging inventory and issuing duplicate invoices.

## Decision
Each webhook carries an `idempotencyKey`. Before processing, we look up a
`ProcessedEvent` row keyed by that value:
- **No row** → process the event, creating the `ProcessedEvent` (status PROCESSING)
  inside the same transaction as the `Payment` and the order update, then mark it
  PROCESSED.
- **Row exists** → ignore the event and return `{ status: "ignored" }`.

The `ProcessedEvent.idempotencyKey` column is `UNIQUE`. This does double duty: it
is the lookup key *and* the race guard. If two duplicate requests run concurrently,
both pass the initial lookup, but only one `INSERT` succeeds; the other fails with
Prisma `P2002` and is handled as a duplicate.

## Consequences
- Exactly-once processing of payment events, even under concurrency.
- No duplicate payments, jobs, or invoices from repeated deliveries.
- The decision logic (`decideIdempotency`) is a pure function and unit-tested
  independently of the database.
- Trade-off: the enqueue to BullMQ happens *after* the DB transaction commits. If
  the enqueue fails, the order is PAID but not yet queued; recovery is via the
  manual "Retry Fulfillment" action. A full transactional-outbox pattern was
  considered out of scope for this portfolio.
