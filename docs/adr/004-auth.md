# ADR 004: Cookie-session authentication

## Status

Accepted. (Revises the original "no auth" non-goal.)

## Context

Manifest is presented as a real internal operations console. Such a tool would
realistically sit behind a staff login, and demonstrating authentication adds
fullstack credibility. The original spec listed auth as a non-goal; as the
stakeholder we consciously revised that, keeping scope tight.

## Decision

Add **email + password** auth with a database-backed, opaque-token session
delivered via a signed, httpOnly cookie.

- Passwords hashed with **bcryptjs** (pure-JS, which avoids native build issues on
  Windows/pnpm), cost 12, input capped at 72 bytes (bcrypt's limit).
- On login/register a `Session` row is created (256-bit random token,
  `expiresAt = now + 7d`); the token rides in a signed `sid` cookie
  (`httpOnly`, `SameSite=Lax`, `Secure` in production). Expiry is checked on every
  read; expired rows are pruned opportunistically.
- Login is **constant-time and non-enumerating**: it always runs a bcrypt compare
  (against a dummy hash when the email is unknown) and returns one generic
  `401 "Invalid email or password"`.
- **REST** `/auth/{register,login,logout,me}` (cookie handling is cleaner over
  REST, like the webhook). **GraphQL is guarded**; `/health` and
  `/webhooks/payment` stay public (an external provider can't authenticate).
- The Next.js app forwards the cookie from Server Components (via `next/headers`)
  and uses `credentials: 'include'` in the browser; CORS echoes the exact web
  origin with credentials enabled. A middleware redirects unauthenticated users
  to `/login` (UX gate only, the API does the real validation).

## Why cookie session over JWT

A server-side session is trivial to **revoke** (delete the row = instant logout),
needs no token-rotation dance, and suits a single server-rendered app. JWT's
stateless scaling buys nothing here and complicates revocation, the same
"simplest thing that's correct" reasoning as choosing BullMQ over Kafka.

## Out of scope

RBAC, OAuth/social login, email verification, password reset. Deliberately
excluded to keep the project focused on its core (event-driven reliability).

## Consequences

- The dashboard and GraphQL API are protected; a seeded dev-only demo account
  (`demo@manifest.dev`) lets reviewers try it instantly.
- New env vars: `SESSION_SECRET` (cookie signing) and `WEB_ORIGIN` (credentialed
  CORS). Cross-origin cookies in production require `SameSite=None; Secure`.
