// Applies the two advertising migrations that the CLI cannot push because the
// remote project has unrelated migrations numbered 0111/0112.
//
// Each file runs inside a transaction, then the version is recorded in
// supabase_migrations.schema_migrations exactly like `supabase db push` does.
// Reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from the environment and
// never prints SQL or secrets.

import { readFile } from 'node:fs/promises';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');
  process.exit(1);
}

const migrations = [
  ['0114', 'advertising_slot_rebooking', 'supabase/migrations/0114_advertising_slot_rebooking.sql'],
  ['0115', 'advertising_manual_payment_off', 'supabase/migrations/0115_advertising_manual_payment_off.sql'],
];

async function runQuery(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`query failed (${response.status}): ${text.slice(0, 400)}`);
  return text;
}

for (const [version, name, path] of migrations) {
  const sql = await readFile(path, 'utf8');
  await runQuery(`begin;\n${sql}\ncommit;`);
  console.log(`applied ${version}_${name}`);
  await runQuery(
    `insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}') ` +
      `on conflict (version) do update set name = excluded.name;`,
  );
  console.log(`recorded ${version}`);
}
console.log('done');
