# ADR 002: GraphQL for the dashboard, REST for the webhook

## Status

Accepted.

## Context

The system has two very different kinds of clients:

1. The **dashboard**, which reads varied, nested data (orders with items, payment,
   invoice, jobs, and an event timeline) and issues a couple of mutations.
2. A **payment provider**, which posts a single fixed webhook payload.

These have opposite shapes, so forcing both through one API style would compromise
one of them.

## Decision

Use **GraphQL** for the dashboard and **REST** for the webhook, served from one
Fastify process.

- GraphQL (GraphQL Yoga) lets the frontend ask for exactly the nested fields it
  needs in a single round-trip, which suits an order-detail page well, and gives a
  typed schema plus an in-browser explorer (GraphiQL) in development.
- REST (`POST /webhooks/payment`) matches how real payment providers integrate:
  a simple, stable, versionable HTTP endpoint with a fixed JSON body. Providers do
  not speak GraphQL.

Yoga is mounted as an encapsulated Fastify plugin so its request-body handling does
not collide with the REST routes' JSON parsing.

## Consequences

- Each client gets the interface that fits it; neither is contorted.
- One server, one port, one deployment, no microservice overhead.
- Slightly more setup than a single API style, but the boundary is clean and the
  webhook stays trivially callable with `curl`.
