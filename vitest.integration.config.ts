import { defineConfig } from 'vitest/config';

// Runs against the real Postgres (docker compose `db`). Needs the migrations applied.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/__integration__/**/*.int.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
