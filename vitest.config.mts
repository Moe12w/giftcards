import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Intl initialization can exceed 5s when workers start in parallel.
    testTimeout: 10_000,
    include: ['src/**/*.test.ts', 'supabase/**/*.test.ts', 'web/lib/**/*.test.ts'],
    globals: true,
  },
});
