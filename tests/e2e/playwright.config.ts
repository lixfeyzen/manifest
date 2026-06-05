import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Assumes the full stack is already running:
 *   docker compose up -d   (Postgres + Redis)
 *   pnpm dev               (web on 3001, api on 4100, worker)
 *
 * The web server is reused if already up. API + worker must be running for the
 * payment/fulfillment flow to complete.
 */
const WEB_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @manifest/web dev',
    url: WEB_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
