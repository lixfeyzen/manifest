import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Assumes the full stack is already running:
 *   docker compose up -d   (Postgres + Redis)
 *   pnpm dev               (web on 3001, api on 4100, worker)
 *
 * Auth: a `setup` project logs in the seeded demo user and saves storageState;
 * the main `chromium` project reuses it so the fulfillment flow runs
 * authenticated. The `auth` project runs the login/redirect specs WITHOUT that
 * state.
 */
const WEB_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
const AUTH_FILE = 'playwright/.auth/user.json';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /auth\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
    },
  ],
  webServer: {
    // Locally we reuse the already-running `pnpm dev` stack. In CI nothing is
    // running, so boot the whole stack (web + api + worker) via Turbo.
    command: process.env.CI ? 'pnpm dev' : 'pnpm --filter @manifest/web dev',
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Surface the stack's boot logs in CI so a failed start is diagnosable
    // instead of an opaque "Exit code: N".
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
