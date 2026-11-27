/**
 * Runs the signed gateway end-to-end tests against a running web server.
 *
 *   npm run dev            # in another terminal
 *   node scripts/run-integration-e2e.mjs
 *
 * Values come from environment variables first, then .env.local, then the
 * public sandbox seed defaults in supabase/sandbox/README.md.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function readEnv(file) {
  const result = {};
  if (!fs.existsSync(file)) return result;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) result[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return result;
}

const fileEnv = { ...readEnv('.env'), ...readEnv('.env.local') };
const defaults = {
  INTEGRATION_BASE_URL: 'http://localhost:3000/api/integrations/v1',
  INTEGRATION_API_KEY: 'tz_sandbox_mock_key_0123456789abcdef',
  INTEGRATION_SIGNING_SECRET: 'tz_sandbox_mock_secret_0123456789abcdef',
  INTEGRATION_PLATFORM_CODE: 'mock',
  INTEGRATION_ENVIRONMENT: 'sandbox',
  INTEGRATION_VENDOR_ID: 'SBX-1001',
  INTEGRATION_BRANCH_ID: 'SBX-1001-01',
  INTEGRATION_CARD_CODE: 'SBX-GOOD',
  INTEGRATION_EXPIRED_CARD: 'SBX-EXPIRED',
  INTEGRATION_CURRENCY: 'QAR',
};

const env = { ...process.env };
for (const [key, fallback] of Object.entries(defaults)) {
  if (!env[key] && fileEnv[key]) env[key] = fileEnv[key];
  if (!env[key]) env[key] = fallback;
}

// A WordPress credential in .env.local should not silently override the
// sandbox seed defaults unless the caller asks for it.
if (!process.env.INTEGRATION_API_KEY && fileEnv.TAZELLA_INTEGRATION_API_KEY) {
  env.INTEGRATION_API_KEY = fileEnv.TAZELLA_INTEGRATION_API_KEY;
  env.INTEGRATION_SIGNING_SECRET = fileEnv.TAZELLA_INTEGRATION_SIGNING_SECRET ?? '';
  env.INTEGRATION_PLATFORM_CODE = fileEnv.TAZELLA_INTEGRATION_PLATFORM_CODE ?? 'wordpress';
  env.INTEGRATION_ENVIRONMENT = fileEnv.TAZELLA_INTEGRATION_ENVIRONMENT ?? 'sandbox';
  env.INTEGRATION_VENDOR_ID = fileEnv.TAZELLA_INTEGRATION_VENDOR_ID ?? '';
  env.INTEGRATION_BRANCH_ID = fileEnv.TAZELLA_INTEGRATION_BRANCH_ID ?? '';
  env.INTEGRATION_CARD_CODE = fileEnv.TAZELLA_TEST_CARD_CODE ?? 'SBX-GOOD';
  env.INTEGRATION_CURRENCY = fileEnv.TAZELLA_TEST_CURRENCY ?? 'QAR';
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(
  npm,
  ['test', '--', 'tests/integrations/gateway.e2e.test.ts'],
  { cwd: process.cwd(), stdio: 'inherit', env, shell: process.platform === 'win32' },
);
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
