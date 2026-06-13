import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Integration tests share one test database: run files serially.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
