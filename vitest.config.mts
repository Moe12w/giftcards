import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '');

export default defineConfig({
  // Web files use "@/..." mapped to web/ (web/tsconfig.json); mobile files in
  // tests use relative imports, so this alias only affects web route tests.
  resolve: {
    alias: { '@': `${repoRoot}/web` },
  },
  test: {
    environment: 'node',
    // Intl initialization can exceed 5s when workers start in parallel.
    testTimeout: 10_000,
    include: [
      'src/**/*.test.ts',
      'supabase/**/*.test.ts',
      'web/lib/**/*.test.ts',
      'web/app/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    globals: true,
  },
});
