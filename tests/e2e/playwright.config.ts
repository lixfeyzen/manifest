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
  retries: 0,
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
    command: 'pnpm --filter @manifest/web dev',
    url: WEB_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
