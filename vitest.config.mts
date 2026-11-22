import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '');

export default defineConfig({
  // Web files use "@/..." mapped to web/ (web/tsconfig.json); mobile files in
  // tests use relative imports, so this alias only affects web route tests.
  // Edge Function code imports its packages with Deno specifiers, which Node
  // cannot resolve; map them to the dev-dependency copies of those versions so
  // the wallet pass test can run the real signing code.
  resolve: {
    alias: [
      { find: '@', replacement: `${repoRoot}/web` },
      { find: /^npm:node-forge@[\d.]+$/, replacement: 'node-forge' },
      { find: /^npm:fflate@[\d.]+$/, replacement: 'fflate' },
    ],
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
