#!/usr/bin/env node
/**
 * Builds the database the money-path tests need: the Supabase stand-ins from
 * supabase-bootstrap.sql, then every supabase/migrations/*.sql in filename
 * order, stopping at the first file that fails.
 *
 * Uses `pg`, which the tests already depend on, instead of psql so the job needs
 * no PostgreSQL client installed and behaves the same locally and in CI.
 *
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres \
 *   TEST_DATABASE_SSL=disable node tests/db/apply-migrations.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error('Set TEST_DATABASE_URL to the database to build.');
  process.exit(1);
}

const migrationsDir = path.resolve(import.meta.dirname, '../../supabase/migrations');

const migrations = (await readdir(migrationsDir))
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (migrations.length === 0) {
  console.error(`No migrations found in ${migrationsDir}.`);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  // Same default as tests/db/harness.ts: a local server has no TLS, so CI sets
  // TEST_DATABASE_SSL=disable rather than guessing here.
  ssl: process.env.TEST_DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
  statement_timeout: 120_000,
});

await client.connect();

async function applyFile(file) {
  const sql = await readFile(file, 'utf8');
  try {
    // One query per file, so a file that half-applies is not left behind: the
    // simple-query protocol runs the whole string in one implicit transaction.
    await client.query(sql);
  } catch (error) {
    console.error(`Failed applying ${path.relative(process.cwd(), file)}:`);
    console.error(error instanceof Error ? error.message : error);
    await client.end();
    process.exit(1);
  }
}

await applyFile(path.resolve(import.meta.dirname, 'supabase-bootstrap.sql'));

// The bootstrap sets this for new connections; this one predates it. Without it
// the unqualified gen_random_bytes() and digest() calls in the migrations fail.
await client.query(`set search_path to "$user", public, extensions`);

for (const name of migrations) {
  await applyFile(path.join(migrationsDir, name));
}

await client.end();
console.log(`Applied the bootstrap and ${migrations.length} migrations.`);
