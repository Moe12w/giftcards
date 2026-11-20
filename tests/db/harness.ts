import { randomUUID, createHash } from 'node:crypto';
import type { Client } from 'pg';
import { Client as PgClient } from 'pg';

/**
 * Database tests need a real Postgres with this project's migrations applied —
 * the money path lives in SQL, so mocking it proves nothing. Point
 * TEST_DATABASE_URL at a disposable/staging database (or, at a pinch, a
 * production database: every test runs inside a transaction that is always
 * rolled back). Set TEST_DATABASE_SSL=disable for a local server.
 */
export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

export function connect(): Client {
  return new PgClient({
    connectionString: process.env.TEST_DATABASE_URL,
    ssl: process.env.TEST_DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
    statement_timeout: 30_000,
  });
}

/**
 * Runs `fn` inside a transaction that is rolled back unconditionally. Fixtures
 * and money movements are therefore never left behind, even when an assertion
 * fails.
 */
export async function inRolledBackTransaction(fn: (client: Client) => Promise<void>): Promise<void> {
  const client = connect();
  await client.connect();
  try {
    await client.query('begin');
    try {
      await fn(client);
    } finally {
      await client.query('rollback').catch(() => undefined);
    }
  } finally {
    await client.end();
  }
}

/** Runs `fn` as a signed-in user, the way PostgREST would: role plus JWT claims. */
export async function actAs<T>(client: Client, userId: string, fn: () => Promise<T>): Promise<T> {
  await client.query('set local role authenticated');
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  try {
    return await fn();
  } finally {
    // A failed statement aborts the transaction, so these can themselves fail;
    // swallowing that keeps the original database error visible to the test.
    await client.query("select set_config('request.jwt.claims', '', true)").catch(() => undefined);
    await client.query('reset role').catch(() => undefined);
  }
}

let savepointCounter = 0;

/**
 * Asserts that a statement is refused, restoring the transaction afterwards so
 * the test can keep inspecting state. A rejection aborts the whole transaction
 * in Postgres, which would otherwise make every later query fail with
 * "current transaction is aborted" instead of the expected error.
 */
export async function rejectionMessage(client: Client, fn: () => Promise<unknown>): Promise<string> {
  const savepoint = `expect_rejection_${++savepointCounter}`;
  await client.query(`savepoint ${savepoint}`);
  let message = '';
  try {
    await fn();
    message = 'the statement unexpectedly succeeded';
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  await client.query(`rollback to savepoint ${savepoint}`);
  await client.query(`release savepoint ${savepoint}`).catch(() => undefined);
  return message;
}

export type MoneyPathFixture = {
  vendorId: string;
  otherVendorId: string;
  productId: string;
  buyerId: string;
  otherBuyerId: string;
  staffId: string;
  otherStaffId: string;
  orderId: string;
  orderItemId: string;
  invoiceId: string;
  amountMinor: number;
  claimTokenHash: string;
  cardCodeHash: string;
};

async function createUser(client: Client): Promise<string> {
  const { rows } = await client.query(
    `insert into auth.users (id, instance_id, aud, role, email)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1)
     returning id`,
    [`money-path-${randomUUID()}@example.test`],
  );
  return rows[0].id as string;
}

async function createVendor(client: Client, ownerId: string): Promise<string> {
  const { rows } = await client.query(
    `insert into public.vendors (owner_id, name, slug, status, commission_bps)
     values ($1, $2, $3, 'approved', 1000)
     returning id`,
    [ownerId, `Test vendor ${randomUUID().slice(0, 8)}`, `test-vendor-${randomUUID()}`],
  );
  const vendorId = rows[0].id as string;
  await client.query(
    `insert into public.vendor_members (vendor_id, user_id, role, active)
     values ($1, $2, 'owner', true)`,
    [vendorId, ownerId],
  );
  return vendorId;
}

/**
 * One vendor, one product, one pending order with one line, and the pending
 * MyFatoorah payment row the webhook would have created. Deliberately built with
 * the same columns the checkout path writes so the RPCs see a realistic order.
 */
export async function createMoneyPathFixture(
  client: Client,
  options: { amountMinor?: number } = {},
): Promise<MoneyPathFixture> {
  const amountMinor = options.amountMinor ?? 7500;

  const staffId = await createUser(client);
  const otherStaffId = await createUser(client);
  const buyerId = await createUser(client);
  const otherBuyerId = await createUser(client);

  const vendorId = await createVendor(client, staffId);
  const otherVendorId = await createVendor(client, otherStaffId);

  const { rows: productRows } = await client.query(
    `insert into public.products (vendor_id, title, min_amount_minor, max_amount_minor, currency,
                                  fulfilment_type, status, is_active)
     values ($1, 'Test gift card', $2, $2, 'KWD', 'monetary', 'published', true)
     returning id`,
    [vendorId, amountMinor],
  );
  const productId = productRows[0].id as string;

  const invoiceId = `test-inv-${randomUUID()}`;
  const { rows: orderRows } = await client.query(
    `insert into public.orders (buyer_id, status, payment_status, payment_reference, provider_invoice_id,
                                payment_provider, currency, subtotal_minor, total_minor)
     values ($1, 'pending', 'pending', $2, $3, 'myfatoorah', 'KWD', $4, $4)
     returning id`,
    [buyerId, `test-ref-${randomUUID()}`, invoiceId, amountMinor],
  );
  const orderId = orderRows[0].id as string;

  const { rows: itemRows } = await client.query(
    `insert into public.order_items (order_id, product_id, vendor_id, quantity,
                                     unit_price_minor, total_minor, currency)
     values ($1, $2, $3, 1, $4, $4, 'KWD')
     returning id`,
    [orderId, productId, vendorId, amountMinor],
  );

  await client.query(
    `insert into public.myfatoorah_payments (order_id, vendor_id, invoice_id, amount_minor, currency, payment_status)
     values ($1, $2, $3, $4, 'KWD', 'pending')`,
    [orderId, vendorId, invoiceId, amountMinor],
  );

  // The app generates these, not the database: a claim token whose plaintext the
  // buyer keeps, and a card code hash the vendor's scan matches.
  const claimTokenHash = createHash('sha256').update(`claim-${randomUUID()}`).digest('hex');
  const cardCodeHash = createHash('sha256').update(`card-${randomUUID()}`).digest('hex');

  return {
    vendorId,
    otherVendorId,
    productId,
    buyerId,
    otherBuyerId,
    staffId,
    otherStaffId,
    orderId,
    orderItemId: itemRows[0].id as string,
    invoiceId,
    amountMinor,
    claimTokenHash,
    cardCodeHash,
  };
}
