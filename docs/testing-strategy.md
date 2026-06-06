# Testing strategy

The test suite is deliberately weighted toward the parts that are easy to get
wrong and expensive to get wrong in production: business rules, idempotency, and
retry-safety. Tests run with `pnpm test` (Vitest); E2E runs with `pnpm test:e2e`
(Playwright).

## Unit tests, `packages/domain` (27 tests)

Pure functions, no database, run in milliseconds. They cover:

- valid and invalid order status transitions
- fulfillment guards (an unpaid order cannot be fulfilled; a fulfilled order is a no-op)
- stock math (never below zero) and the "already reserved" guard
- invoice numbering and the "create at most one invoice" rule
- idempotency decisions (process new / ignore processed / ignore in-progress)

Because this logic lives in a dependency-free package, it is trivial to test
exhaustively, which is the whole point of separating it from I/O.

## Integration tests, `apps/api` and `apps/worker` (33 tests)

Run against a **real, separate** PostgreSQL database (`manifest_test`) so they
exercise the actual SQL, transactions, and unique constraints, not mocks. The
`apps/api` package additionally holds 19 fast Zod schema-validation unit tests,
kept beside the API they guard.

API (via Fastify `app.inject`, no port binding):

- create an order through GraphQL (priced from inventory; `order.created` recorded)
- unknown SKU is rejected
- first webhook is processed (order PAID, one payment, one job, `ProcessedEvent` PROCESSED)
- duplicate webhook is ignored, with **no** second payment and no second job

Worker (calling the processor directly):

- fulfillment deducts stock once and issues exactly one invoice
- re-running on a FULFILLED order is a safe no-op
- resuming an interrupted (FULFILLING) order respects existing reservations, no double deduction
- insufficient stock fails permanently and rolls back stock

The test database is migrated automatically in a Vitest `globalSetup`, and test
files run serially because they share one database.

## E2E tests, `tests/e2e` (Playwright, 7 tests)

Real browser journeys against the running stack:

- sign-in: an unauthenticated visitor is redirected to login; the demo account reaches the dashboard
- create an order, send the test payment, and confirm it reaches FULFILLED with an invoice
- resend the same payment and confirm it is ignored and the invoice count stays at one
- dashboard loads with metrics
- accessibility (axe-core) on the login, dashboard, and orders pages, failing on serious or critical violations

## Why business-logic tests matter more than UI tests

A pixel-level UI test breaks every time a class name changes and proves little
about correctness. The questions that actually decide whether this system is
trustworthy (_can a duplicate webhook double-charge inventory? can a retry issue
two invoices?_) are answered by the domain and integration tests. The E2E suite
exists to prove the pieces are wired together (and accessible), not to re-test
logic the lower layers already cover.
