import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Integration tests need a real database: run them with `npm run test:integration`
    exclude: ['**/node_modules/**', '**/dist/**', 'src/__integration__/**'],
  },
});
