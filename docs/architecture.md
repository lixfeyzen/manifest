# Architecture

Manifest is a small but realistic event-driven system. It is split into three
deployable apps and three shared packages inside a pnpm + Turborepo monorepo.

```
apps/web (Next.js)
   │  GraphQL queries/mutations          REST: simulate webhook
   ▼                                      │
apps/api (Fastify + GraphQL Yoga) ◄───────┘
   │  enqueue job (BullMQ)        read/write (Prisma)
   ▼                                  │
 Redis  ─────────────► apps/worker ──┘──► PostgreSQL
                         (BullMQ consumer)
```

## Components

### apps/web — Next.js dashboard
App Router. Server Components fetch fresh data (`cache: 'no-store'`); small client
"islands" handle interactions (create order, simulate webhook, retry) and refresh
the view afterward. The web app keeps its own view types and a tiny GraphQL fetch
helper, so it never imports server-only code.

### apps/api — Fastify + GraphQL Yoga
One HTTP server exposing two surfaces:
- **REST** `POST /webhooks/payment` — receives payment events. `GET /health` for liveness.
- **GraphQL** `/graphql` — dashboard queries and the `createOrder` / `retryFulfillment` mutations.

GraphQL Yoga is mounted as an *encapsulated* Fastify plugin so its body parsing
does not interfere with the REST routes. All input is validated with Zod, and all
business logic lives in `src/services/*` — route handlers stay thin.

### apps/worker — BullMQ consumer
Consumes fulfillment jobs from Redis. For each job it reserves inventory, issues an
invoice, and advances the order to `FULFILLED`, writing an event at each step.

### packages/db — Prisma + PostgreSQL
The schema, migrations, seed, and a shared `PrismaClient`. Two database-level
unique constraints are load-bearing for correctness:
- `InventoryReservation(orderId, sku)` — one reservation per order/SKU.
- `Invoice(orderId)` — one invoice per order.

### packages/domain — pure business rules
No I/O. Order state machine, fulfillment guards, stock math, invoice numbering,
and idempotency decisions. This is the most heavily unit-tested package.

### packages/shared — contracts
Enums/constants (mirrored by the Prisma enums), Zod schemas, and queue constants —
a single source of truth shared by api, worker, and db.

## Idempotency

A payment webhook may arrive more than once. Before processing, the API checks a
`ProcessedEvent` row keyed by `idempotencyKey`. If it already exists, the event is
ignored. The row is created inside the same transaction as the payment, so its
unique constraint also resolves concurrent duplicates (the loser gets `P2002` and
is treated as a duplicate). See [ADR 001](adr/001-idempotency.md).

## Retry behavior

Fulfillment jobs retry 3× with exponential backoff (BullMQ). The worker is written
to be safe to run multiple times: each side effect checks whether it already
happened (reservation exists? invoice exists? order already FULFILLED?). Permanent
errors (insufficient stock) are wrapped in `UnrecoverableError` so BullMQ stops
retrying; the order is marked `FAILED` and stock is rolled back by the transaction.

## Correlation IDs

Every `OrderEvent` carries a `correlationId`, and logs are tagged with it, so a
single flow can be traced across the API, the queue, and the worker.

## Order lifecycle

```
PENDING ──pay──► PAID ──worker──► FULFILLING ──► FULFILLED
                                       │
                                       └──► FAILED ──retry──► FULFILLING
```
Invalid transitions throw a typed `InvalidOrderTransitionError`.
