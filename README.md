# Manifest

> Track every order from payment webhook to fulfillment.

**Manifest** is an event-driven fulfillment operations dashboard. It follows an order through its
full lifecycle — creation → payment webhook → async fulfillment → inventory reservation →
invoice generation → completion — and makes the messy, reliability-critical parts of that flow
(idempotency, retries, event timelines) visible and inspectable.

This is a portfolio project built to demonstrate fullstack engineering fundamentals: a real
event-driven architecture with a queue and worker, safe handling of duplicate payment webhooks,
retry-safe fulfillment, and a test suite that targets business rules rather than superficial UI.

---

## Why this project exists

Most CRUD demos hide the hard parts. Real fulfillment systems have to answer questions like:

- What happens when a payment provider sends the **same webhook twice**?
- What happens when fulfillment **fails halfway** and retries?
- How do you guarantee you never **double-charge inventory** or **issue two invoices** for one order?

Manifest is built around those questions. The interesting logic lives in a tested domain layer and
in clearly-separated services — not inside route handlers.

---

## Architecture summary

```
                 ┌─────────────┐      GraphQL (queries/mutations)
                 │  apps/web   │  ───────────────────────────────┐
                 │  Next.js    │      REST (simulate webhook)     │
                 └─────────────┘  ──────────────────────┐        │
                                                         ▼        ▼
                                              ┌──────────────────────────┐
                                              │         apps/api         │
                                              │  Fastify (REST webhook)  │
                                              │  GraphQL Yoga (/graphql) │
                                              └──────────────────────────┘
                                                   │            │
                                       enqueue job │            │ read/write
                                                   ▼            ▼
                                            ┌──────────┐  ┌──────────────┐
                                            │  Redis   │  │  PostgreSQL  │
                                            │ (BullMQ) │  │   (Prisma)   │
                                            └──────────┘  └──────────────┘
                                                   │            ▲
                                          consume  ▼            │ read/write
                                            ┌──────────────────────────┐
                                            │       apps/worker        │
                                            │   BullMQ fulfillment     │
                                            └──────────────────────────┘
```

See [docs/architecture.md](docs/architecture.md) for the full breakdown.

---

## Tech stack

| Layer        | Choice                                  |
| ------------ | --------------------------------------- |
| Language     | TypeScript (strict)                     |
| Monorepo     | pnpm workspaces + Turborepo             |
| Frontend     | Next.js (App Router), React, Tailwind   |
| REST API     | Fastify                                 |
| GraphQL API  | GraphQL Yoga                            |
| ORM          | Prisma                                  |
| Database     | PostgreSQL                              |
| Queue        | BullMQ on Redis                         |
| Validation   | Zod                                     |
| Logging      | Pino (with correlation IDs)             |
| Unit/Integration tests | Vitest                        |
| E2E tests    | Playwright                              |
| Infra (local)| Docker Compose (Postgres + Redis)       |
| CI           | GitHub Actions                          |

---

## Local setup

Prerequisites: **Node.js >= 20**, **pnpm >= 9**, **Docker**.

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables
cp .env.example .env

# 3. Start Postgres + Redis
docker compose up -d

# 4. Run database migrations
pnpm db:migrate

# 5. Seed inventory
pnpm db:seed

# 6. Start web + api + worker together
pnpm dev
```

- Web:     http://localhost:3000
- API:     http://localhost:4000
- GraphQL: http://localhost:4000/graphql

---

## Commands

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `pnpm dev`         | Run web, api, and worker concurrently (Turbo)    |
| `pnpm build`       | Build all packages and apps                      |
| `pnpm test`        | Run unit + integration tests (Vitest)            |
| `pnpm test:e2e`    | Run Playwright E2E tests                          |
| `pnpm lint`        | Lint all packages                                |
| `pnpm typecheck`   | TypeScript check across the monorepo             |
| `pnpm db:migrate`  | Apply Prisma migrations                          |
| `pnpm db:seed`     | Seed inventory items                             |
| `pnpm db:studio`   | Open Prisma Studio                               |

---

## Authentication

The dashboard sits behind a staff login (email + password, hashed with bcrypt;
an httpOnly **signed cookie session** stored in the database). The GraphQL API is
protected; the payment webhook stays public (a provider can't log in). See
[ADR 004](docs/adr/004-auth.md).

- **Demo account** (seeded in dev): `demo@manifest.dev` / `demo12345`
- Or create your own via **Register**.

## Demo flow

1. Open http://localhost:3000 and **sign in** (demo account above, or register).
2. Go to **Orders → New**, create an order using a seeded SKU.
3. Open the order detail page — status is `PENDING`.
4. Click **Simulate Payment Webhook** → order becomes `PAID`, a fulfillment job is queued.
5. The worker fulfills the order → `FULFILLING` → `FULFILLED`, inventory is reserved, invoice issued.
6. Click **Simulate Duplicate Webhook** → the event is safely ignored; no duplicate payment or invoice.
7. Watch the **event timeline** record every step with a correlation ID.

---

## Sample webhook curl

```bash
curl -X POST http://localhost:4000/webhooks/payment \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt_001",
    "orderId": "<ORDER_ID>",
    "type": "payment.succeeded",
    "amount": 120000,
    "idempotencyKey": "payment_<ORDER_ID>_demo",
    "correlationId": "corr_001"
  }'
```

Sending the same `idempotencyKey` twice returns `{"status":"ignored"}` and changes nothing.

---

## Key reliability features

- **Idempotent webhooks** — a `ProcessedEvent` record keyed by `idempotencyKey` guarantees each
  payment event is processed exactly once. ([ADR 001](docs/adr/001-idempotency.md))
- **Retry-safe fulfillment** — inventory reservations and invoices are uniquely constrained per
  order, so BullMQ retries never double-deduct stock or issue a second invoice.
- **Explicit state machine** — order status transitions are validated in the domain layer and
  invalid transitions throw typed domain errors.
- **Correlation IDs** — every order event carries a correlation ID for traceability.
- **Bounded retries** — fulfillment jobs retry 3× with exponential backoff before failing safely.

---

## Testing strategy

- **Unit tests** cover the domain layer: status transitions, fulfillment guards, stock rules,
  invoice uniqueness, idempotency helpers.
- **Integration tests** cover API behavior against a real database: order creation, first-time
  webhook processing, duplicate webhook handling, retry-safe reservation.
- **E2E tests** (Playwright) cover the critical user flow end to end.

See [docs/testing-strategy.md](docs/testing-strategy.md).

---

## Known limitations

- No real payment provider — payment is simulated via the REST webhook endpoint.
- Auth is intentionally minimal: email/password + cookie session, no RBAC, OAuth, email verification, or password reset.
- Invoices are records only; no PDF generation or email delivery.
- Single worker process; no horizontal scaling concerns addressed.

---

## AI-assisted workflow

This project was built with AI assistance, but every piece of generated code was reviewed,
type-checked, and tested. See [docs/ai-workflow.md](docs/ai-workflow.md) for the discipline applied.
