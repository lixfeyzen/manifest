# AI-assisted workflow

This project was built with AI assistance. That is normal in modern engineering —
what matters is that the generated code was **reviewed, type-checked, and tested**,
and that the author understands every decision. AI was a force multiplier, not a
substitute for judgement.

## AI was used for

- **Architecture brainstorming** — weighing options (e.g. queue vs. inline
  processing, GraphQL vs. REST per surface) before committing to a design.
- **Boilerplate acceleration** — scaffolding the monorepo, config files, Prisma
  schema, and repetitive UI components.
- **Test-case ideas** — enumerating edge cases (concurrent duplicate webhooks,
  interrupted fulfillment, insufficient stock rollback).
- **Edge-case review** — sanity-checking idempotency and retry paths.
- **Documentation drafting** — first drafts of this README and the docs.

## AI was NOT used for

- Blindly shipping code without reading it.
- Replacing understanding of how the system works.
- Skipping tests or treating green CI as the only proof.
- Making unreviewed architecture decisions — each significant choice is recorded
  as an ADR in `docs/adr/`.

## Validation process

Every change went through:
1. **TypeScript check** (`pnpm typecheck`, strict mode).
2. **Unit tests** for business rules.
3. **Integration tests** against a real database.
4. **Manual code review** — reading the diff and questioning each decision.
5. **Business-rule reasoning** — does this actually prevent the failure it claims to?

## A concrete example

An AI-generated first instinct is often to put payment processing **directly inside
the webhook controller** — parse the body, write the payment, update the order, all
in the route handler. This project deliberately avoids that:

- Input validation is isolated in Zod schemas (`packages/shared`).
- Idempotency and the payment/order transaction live in `webhook-service`.
- The "can this transition happen?" rules live in the tested `packages/domain`.

The route handler only validates and delegates. That separation is what makes the
idempotency and retry logic reviewable and unit-testable — and it is the difference
between "it ran once on my machine" and "I can prove it behaves correctly".

## A bug AI review caught in practice

During testing, the deterministic BullMQ job id used a `:` separator
(`fulfillment:<orderId>`). BullMQ rejects `:` in custom job ids, so the database
transaction committed but the enqueue threw. This was found by **actually running
the flow and reading the error**, not by trusting that the code "looked correct" —
a reminder that tests and real runs, not vibes, are the source of truth.
