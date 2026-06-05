import { execSync } from 'node:child_process';

/** Ensure the test database schema is up to date before the worker test suite. */
export default function setup(): void {
  execSync('pnpm --filter @manifest/db exec prisma migrate deploy', {
    stdio: 'inherit',
  });
}
