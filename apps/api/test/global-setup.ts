import { execSync } from 'node:child_process';

/**
 * Runs once before the integration test suite: make sure the test database has
 * the latest schema. DATABASE_URL is already set to the test DB by the dotenv
 * wrapper in the `test` script.
 */
export default function setup(): void {
  execSync('pnpm --filter @manifest/db exec prisma migrate deploy', {
    stdio: 'inherit',
  });
}
