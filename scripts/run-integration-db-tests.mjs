/**
 * Runs the integration database tests against a real Supabase database.
 *
 * The repository's .env already holds SUPABASE_PROJECT_REF and
 * SUPABASE_DB_PASSWORD. This script builds the connection string from those
 * values, optionally applies migrations 0174/0175, and then runs only the
 * integration DB test file.
 *
 *   node scripts/run-integration-db-tests.mjs
 *   node scripts/run-integration-db-tests.mjs --apply-migrations
 *
 * WARNING: --apply-migrations changes the schema of the target database.
 * Use a branch/staging database if one is available. The tests themselves
 * run inside transactions that are always rolled back.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';

const root = process.cwd();
const applyMigrations = process.argv.includes('--apply-migrations');
const runAll = process.argv.includes('--all');

function readEnv(file) {
  const result = {};
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return result;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    result[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return result;
}

const env = { ...readEnv('.env'), ...readEnv('.env.local') };
const ref = env.SUPABASE_PROJECT_REF;
const password = env.SUPABASE_DB_PASSWORD;

if (!ref || !password) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD in .env');
  process.exit(2);
}

const connectionString =
  'postgresql://postgres:' + encodeURIComponent(password) + '@db.' + ref + '.supabase.co:5432/postgres';

async function ensureMigrations() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120000,
  });

  await client.connect();
  try {
    const { rows } = await client.query('show server_version');
    console.log('Connected to Postgres', rows[0].server_version);

    const applied = await client
      .query('select version from supabase_migrations.schema_migrations')
      .catch(() => ({ rows: [] }));
    const versions = new Set(applied.rows.map((row) => String(row.version)));

    const files = [
      'supabase/migrations/0174_integration_identity.sql',
      'supabase/migrations/0175_integration_redemption.sql',
    ];

    for (const file of files) {
      const number = path.basename(file).split('_')[0];
      if (versions.has(number)) {
        console.log(file, 'already applied');
        continue;
      }
      if (!applyMigrations) {
        console.error(file, 'is NOT applied. Re-run with --apply-migrations.');
        process.exitCode = 3;
        return;
      }

      const sql = fs.readFileSync(path.join(root, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          'insert into supabase_migrations.schema_migrations (version) values ($1) on conflict (version) do nothing',
          [number],
        );
        await client.query('commit');
        console.log(file, 'applied');
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

try {
  await ensureMigrations();
  if (process.exitCode) process.exit(process.exitCode);

  const args = runAll ? ['test'] : ['test', '--', 'tests/db/integrations.test.ts'];
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_DATABASE_URL: connectionString,
      TEST_DATABASE_SSL: 'require',
    },
  });
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error('Live database check failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
