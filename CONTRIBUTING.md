# Contributing to Manifest

A short guide to working in this repo. It is a pnpm + Turborepo monorepo
(`apps/web`, `apps/api`, `apps/worker`, `packages/db`, `packages/domain`,
`packages/shared`).

## Dev loop

```bash
pnpm install
cp .env.example .env
docker compose up -d        # Postgres + Redis
pnpm db:migrate             # apply migrations
pnpm db:seed                # seed inventory + demo data
pnpm dev                    # web + api + worker together (Turbo)
```

- Web: http://localhost:3000, API: http://localhost:4000 (defaults; this machine
  uses 3001 / 4100 via a local `.env` because another project owns 3000 / 4000).
- Stop with `Ctrl + C`, then `docker compose down` to stop the database.

## Checks before pushing

```bash
pnpm lint        # eslint + prettier across the repo
pnpm typecheck   # tsc per package
pnpm test        # unit + integration (Vitest, against the test DB)
pnpm build       # build everything
```

`pnpm test` runs against a separate `manifest_test` database. Create it once and
apply migrations:

```bash
# one-time: create the test database, then
pnpm --filter @manifest/db migrate:test
```

End-to-end tests (Playwright) need the full stack running, then:

```bash
pnpm test:e2e
```

## Adding a database migration

1. Edit `packages/db/prisma/schema.prisma`.
2. Run `pnpm db:migrate` and give the migration a descriptive name. This writes a
   new folder under `packages/db/prisma/migrations` and applies it to your dev DB.
3. Apply it to the test DB with `pnpm --filter @manifest/db migrate:test`.
4. Commit the generated migration folder.

## Running one app or one test file

```bash
pnpm --filter @manifest/api dev          # just the API
pnpm --filter @manifest/worker test      # just the worker tests
pnpm --filter @manifest/api exec vitest run test/webhook.integration.test.ts
```

## Conventions

- Business rules go in `packages/domain` (pure, no database or network) so they
  stay unit-testable. Services in `apps/api` and `apps/worker` do the I/O.
- Validate external input with the Zod schemas in `packages/shared`.
- Keep route handlers thin: validate, delegate to a service, map errors.
- Enum values are mirrored between `packages/shared` and the Prisma schema; change
  both together.

See `docs/architecture.md` and `docs/adr/` for the bigger picture and the
decisions behind the design.
