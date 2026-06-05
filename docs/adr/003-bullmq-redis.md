# ADR 003: BullMQ + Redis instead of Kafka

## Status
Accepted.

## Context
Fulfillment must happen **asynchronously** after payment so the webhook can return
immediately, and it must be **retryable** with backoff. That calls for a job queue.
The obvious "big" option is Kafka; the question is whether its complexity is
justified here.

## Decision
Use **BullMQ on Redis**.

For this system's needs — a single fulfillment job type, retries with exponential
backoff, deterministic job ids for deduplication, and modest throughput — BullMQ
provides everything out of the box:
- `attempts` + exponential `backoff` for transient failures
- `UnrecoverableError` to stop retrying permanent failures
- custom job ids for idempotent enqueueing
- a tiny operational footprint (one Redis container, already needed for nothing
  else heavy)

## Why not Kafka
Kafka is a distributed event log built for high-throughput streaming, multiple
consumer groups, long retention, and replay. None of those are requirements here.
It would add Zookeeper/KRaft, topic and partition management, and significant
operational and conceptual overhead for a single-queue workload — complexity that
would distract from the actual point of the project (idempotency and retry-safety).

## Consequences
- Minimal infrastructure: Postgres + Redis, both via Docker Compose.
- Retry/backoff and dedup are handled by the library, keeping the worker code small.
- If requirements ever grew to true event-streaming (multiple consumers, replay,
  high fan-out), revisiting Kafka or a managed equivalent would be warranted.
