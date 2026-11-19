import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The codebase uses `any` in a few hundred places (Supabase RPC payloads,
      // MyFatoorah responses, JSON columns). Keep the rule visible without
      // making every lint run fail on pre-existing code.
      '@typescript-eslint/no-explicit-any': 'warn',
      // These pages are async Server Components where `Date.now()` runs once per
      // request; the rule cannot tell them apart from client render bodies.
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
