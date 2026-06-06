# ADR 005: Authorization model (single-operator ops console)

## Status

Accepted.

## Context

The dashboard is protected by authentication (a staff login, see ADR 004). A
separate question is authorization: once someone is logged in, what are they
allowed to see and do? A security review flagged that any authenticated user can
read and act on every order, and asked whether that is a vulnerability.

Manifest models the operations side of order fulfillment. In that domain the
people who use the tool are warehouse and fulfillment staff working a shared
queue of orders. An order belongs to a customer, not to the staff member looking
at it, and every staff member is expected to see and act on the whole queue. This
is the same shape as an internal admin console, not a multi-tenant SaaS where
each user owns a private slice of the data.

## Decision

Treat Manifest as a single-tenant, single-operator (staff) ops console:
**authentication is authorization**. Any authenticated staff account may view and
act on all orders. We deliberately do not add per-user ownership of orders.

This is enforced simply: the GraphQL API requires a valid session for every
operation (the `preHandler` guard in `apps/api/src/graphql/yoga-plugin.ts`), and
there is no per-row owner check because there is no per-row owner in this domain.

## Consequences

- The "any logged-in user sees all orders" behaviour is intended, not a bug. It
  matches how a real fulfillment team works.
- It keeps the data model and the resolvers simple: no `Order.userId`, no
  per-query scoping, no ownership joins.
- A multi-tenant version (each customer or merchant sees only their own orders)
  would be a different product. If Manifest ever needed that, the change is
  well understood: add an owner relation to `Order`, thread the authenticated
  user through the GraphQL context, and scope every query and mutation to it.
- If finer-grained staff permissions were ever needed (for example, only some
  staff may retry or cancel), the natural next step is a role on `User`
  (ADMIN / STAFF) checked in the relevant resolvers. That is intentionally out
  of scope for now.
