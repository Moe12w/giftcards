import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { describe, expect, it } from 'vitest';

import {
  actAs,
  createMoneyPathFixture,
  hasTestDatabase,
  inRolledBackTransaction,
  rejectionMessage,
} from './harness';

const describeDb = hasTestDatabase ? describe : describe.skip;

type IntegrationFixture = {
  vendorId: string;
  otherVendorId: string;
  staffId: string;
  productId: string;
  orderId: string;
  platformId: string;
  credentialId: string;
  mappingId: string;
  voucherId: string;
  voucherCode: string;
  otherVoucherCode: string;
  currency: string;
};

function randomCode(prefix: string) {
  return prefix + randomBytes(6).toString('hex').toUpperCase();
}

async function asService<T>(client: Client, fn: () => Promise<T>): Promise<T> {
  await client.query('set local role service_role');
  try {
    return await fn();
  } finally {
    await client.query('reset role').catch(() => undefined);
  }
}

async function createVoucher(
  client: Client,
  input: { productId: string; vendorId: string; code: string; balanceMinor: number },
) {
  const { rows } = await client.query(
    `insert into public.vouchers (
       product_id, vendor_id, fulfilment_type, currency, status,
       initial_value_minor, remaining_value_minor, voucher_code
     )
     values ($1, $2, 'monetary', 'KWD', 'active', $3, $3, $4)
     returning id`,
    [input.productId, input.vendorId, input.balanceMinor, input.code],
  );
  const voucherId = rows[0].id as string;
  await client.query(
    `insert into public.ledger_entries (voucher_id, entry_type, amount_minor)
     values ($1, 'issue', $2)`,
    [voucherId, input.balanceMinor],
  );
  return voucherId;
}

async function createIntegrationFixture(client: Client): Promise<IntegrationFixture> {
  const base = await createMoneyPathFixture(client, { amountMinor: 50000 });

  const platform = await client.query(
    `update public.integration_platforms set status = 'active', updated_at = now()
     where code = 'mock' returning id`,
  );
  const platformId = platform.rows[0].id as string;

  const credential = await client.query(
    `insert into public.integration_platform_credentials
       (platform_id, environment, label, key_prefix, key_hash)
     values ($1, 'sandbox', $2, 'tz_test', $2) returning id`,
    [platformId, randomCode('hash_')],
  );
  const credentialId = credential.rows[0].id as string;

  const otherProduct = await client.query(
    `insert into public.products
       (vendor_id, title, min_amount_minor, max_amount_minor, currency, fulfilment_type, status, is_active)
     values ($1, 'Other vendor card', 1000, 100000, 'KWD', 'monetary', 'published', true)
     returning id`,
    [base.otherVendorId],
  );

  const voucherCode = randomCode('GFT-');
  const voucherId = await createVoucher(client, {
    productId: base.productId,
    vendorId: base.vendorId,
    code: voucherCode,
    balanceMinor: 50000,
  });
  const otherVoucherCode = randomCode('GFT-');
  await createVoucher(client, {
    productId: otherProduct.rows[0].id as string,
    vendorId: base.otherVendorId,
    code: otherVoucherCode,
    balanceMinor: 50000,
  });

  const mapping = await client.query(
    `insert into public.integration_vendor_mappings (
       platform_id, business_kind, vendor_id, external_vendor_id, external_branch_id,
       status, verification_method, verification_evidence, verified_at, activated_at
     )
     values ($1, 'vendor', $2, $3, 'branch-01', 'active', 'documented_evidence',
             '{"source":"db_test"}'::jsonb, now(), now())
     returning id`,
    [platformId, base.vendorId, randomCode('EXT-')],
  );

  return {
    vendorId: base.vendorId,
    otherVendorId: base.otherVendorId,
    staffId: base.staffId,
    productId: base.productId,
    orderId: base.orderId,
    platformId,
    credentialId,
    mappingId: mapping.rows[0].id as string,
    voucherId,
    voucherCode,
    otherVoucherCode,
    currency: 'KWD',
  };
}

function cardState(client: Client, fixture: IntegrationFixture, code: string, currency: string | null) {
  return asService(client, async () => {
    const { rows } = await client.query(
      'select * from public.integration_card_state($1, $2, $3, $4)',
      [fixture.platformId, fixture.mappingId, code, currency],
    );
    return rows[0];
  });
}

function reserve(
  client: Client,
  fixture: IntegrationFixture,
  input: {
    code: string;
    orderId?: string;
    requestedMinor?: number | null;
    amountMinor?: number;
    key: string;
    ttlSeconds?: number | null;
  },
) {
  return asService(client, async () => {
    const { rows } = await client.query(
      `select * from public.integration_reserve(
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
       )`,
      [
        fixture.platformId,
        fixture.mappingId,
        input.code,
        input.orderId ?? fixture.orderId,
        'branch-01',
        input.amountMinor ?? 20000,
        input.requestedMinor ?? null,
        fixture.currency,
        input.ttlSeconds ?? null,
        input.key,
      ],
    );
    return rows[0];
  });
}

function capture(client: Client, fixture: IntegrationFixture, reference: string, key: string) {
  return asService(client, async () => {
    const { rows } = await client.query(
      `select * from public.integration_capture($1, $2, $3, $4, $5, $6, $7)`,
      [
        fixture.platformId,
        reference,
        'pay_db_test',
        20000,
        fixture.currency,
        key,
        fixture.mappingId,
      ],
    );
    return rows[0];
  });
}

function release(client: Client, fixture: IntegrationFixture, reference: string, key: string) {
  return asService(client, async () => {
    const { rows } = await client.query(
      `select * from public.integration_release($1, $2, $3, $4, $5)`,
      [fixture.platformId, reference, 'customer_cancelled', key, fixture.mappingId],
    );
    return rows[0];
  });
}

function refund(
  client: Client,
  fixture: IntegrationFixture,
  redemptionId: string,
  amountMinor: number,
  key: string,
) {
  return asService(client, async () => {
    const { rows } = await client.query(
      `select * from public.integration_refund($1, $2, $3, $4, $5, $6)`,
      [fixture.platformId, redemptionId, amountMinor, 'order.refunded', key, fixture.mappingId],
    );
    return rows[0];
  });
}

async function ledgerBalance(client: Client, voucherId: string) {
  const { rows } = await client.query(
    `select coalesce(sum(amount_minor), 0)::bigint as balance
     from public.ledger_entries where voucher_id = $1`,
    [voucherId],
  );
  return Number(rows[0].balance);
}

async function ledgerCount(client: Client, voucherId: string, entryType: string) {
  const { rows } = await client.query(
    `select count(*)::int as n from public.ledger_entries
     where voucher_id = $1 and entry_type = $2`,
    [voucherId, entryType],
  );
  return Number(rows[0].n);
}

describeDb('integration redemption engine (real database, rolled back)', { timeout: 120_000 }, () => {
  it('grants financial RPCs only to service_role', async () => {
    await inRolledBackTransaction(async (client) => {
      const signature = 'public.redeem_monetary_internal(uuid,bigint,uuid,text,text,uuid,text,text,uuid,text,jsonb)';
      const { rows } = await client.query(
        `select has_function_privilege('authenticated', $1, 'EXECUTE') as auth_can,
                has_function_privilege('service_role', $1, 'EXECUTE') as service_can`,
        [signature],
      );
      expect(rows[0].auth_can).toBe(false);
      expect(rows[0].service_can).toBe(true);
    });
  });

  it('validates only a card belonging to the mapped business and currency', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createIntegrationFixture(client);

      const active = await cardState(client, fixture, fixture.voucherCode, fixture.currency);
      expect(active.found).toBe(true);
      expect(active.valid).toBe(true);
      expect(Number(active.balance_minor)).toBe(50000);
      expect(Number(active.available_minor)).toBe(50000);
      expect(active.masked_code).toContain('••••');

      const missing = await cardState(client, fixture, 'GFT-DOESNOTEXIST', fixture.currency);
      expect(missing.found).toBe(false);

      const wrongBusiness = await cardState(client, fixture, fixture.otherVoucherCode, fixture.currency);
      expect(wrongBusiness.found).toBe(true);
      expect(wrongBusiness.valid).toBe(false);
      expect(wrongBusiness.reason).toBe('wrong_business');

      const wrongCurrency = await cardState(client, fixture, fixture.voucherCode, 'USD');
      expect(wrongCurrency.valid).toBe(false);
      expect(wrongCurrency.reason).toBe('currency_mismatch');
    });
  });

  it('preview subtracts active reservations from the ledger balance', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createIntegrationFixture(client);
      const reservation = await reserve(client, fixture, {
        code: fixture.voucherCode,
        requestedMinor: 15000,
        key: 'db_preview_key',
      });

      expect(reservation.status).toBe('active');
      expect(Number(reservation.amount_minor)).toBe(15000);

      const preview = await asService(client, async () => {
        const { rows } = await client.query(
          `select * from public.integration_preview($1, $2, $3, $4, $5, $6)`,
          [fixture.platformId, fixture.mappingId, fixture.voucherCode, 20000, 15000, fixture.currency],
        );
        return rows[0];
      });

      expect(Number(preview.balance_minor)).toBe(50000);
      expect(Number(preview.reserved_minor)).toBe(15000);
      expect(Number(preview.available_minor)).toBe(35000);
      expect(Number(preview.applied_amount_minor)).toBe(15000);
      expect(Number(preview.remaining_order_amount_minor)).toBe(5000);
    });
  });

  it('reserves once per active order and never double-spends a card', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createIntegrationFixture(client);

      const first = await reserve(client, fixture, {
        code: fixture.voucherCode,
        requestedMinor: 15000,
        key: 'db_reserve_1',
      });
      const replay = await reserve(client, fixture, {
        code: fixture.voucherCode,
        requestedMinor: 15000,
        key: 'db_reserve_2',
      });
      expect(replay.reservation_reference).toBe(first.reservation_reference);

      const { rows } = await client.query(
        `select count(*)::int as n from public.integration_reservations
         where voucher_id = $1 and status = 'active'`,
        [fixture.voucherId],
      );
      expect(Number(rows[0].n)).toBe(1);

      const drain = await reserve(client, fixture, {
        code: fixture.voucherCode,
        orderId: 'db-order-2',
        requestedMinor: 50000,
        amountMinor: 50000,
        key: 'db_reserve_3',
      });
      expect(Number(drain.amount_minor)).toBe(35000);

      const refused = await rejectionMessage(client, () =>
        reserve(client, fixture, {
          code: fixture.voucherCode,
          orderId: 'db-order-3',
          requestedMinor: 50000,
          amountMinor: 50000,
          key: 'db_reserve_4',
        }),
      );
      expect(refused).toMatch(/insufficient balance/);
    });
  });

  it('captures once, writes the shared ledger, and is idempotent', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createIntegrationFixture(client);
      const reservation = await reserve(client, fixture, {
        code: fixture.voucherCode,
        requestedMinor: 15000,
        key: 'db_capture_reserve',
      });

      const captured = await capture(client, fixture, reservation.reservation_reference, 'db_capture_1');
      expect(captured.status).toBe('captured');

      const { rows: redemptionRows } = await client.query(
        `select * from public.redemptions where reservation_id = $1`,
        [reservation.reservation_id],
      );
      expect(redemptionRows).toHaveLength(1);
      expect(redemptionRows[0].channel).toBe('external_platform');
      expect(redemptionRows[0].platform_id).toBe(fixture.platformId);
      expect(Number(redemptionRows[0].amount_minor)).toBe(15000);
      expect(await ledgerBalance(client, fixture.voucherId)).toBe(35000);

      const replay = await capture(client, fixture, reservation.reservation_reference, 'db_capture_1');
      expect(replay.redemption_id).toBe(captured.redemption_id);
      expect(await ledgerCount(client, fixture.voucherId, 'redeem')).toBe(1);

      const { rows: voucherRows } = await client.query(
        'select status, remaining_value_minor from public.vouchers where id = $1',
        [fixture.voucherId],
      );
      expect(voucherRows[0].status).toBe('partially_redeemed');
      expect(Number(voucherRows[0].remaining_value_minor)).toBe(35000);
    });
  });

  it('releases a hold without touching the ledger and never releases a captured hold', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createIntegrationFixture(client);
      const reservation = await reserve(client, fixture, {
        code: fixture.voucherCode,
        requestedMinor: 12000,
        key: 'db_release_reserve',
      });

      const released = await release(client, fixture, reservation.reservation_reference, 'db_release_1');
      expect(released.status).toBe('released');
      expect(await ledgerCount(client, fixture.voucherId, 'redeem')).toBe(0);
      expect(await ledgerBalance(client, fixture.voucherId)).toBe(50000);

      const capturedReservation = await reserve(client, fixture, {
        code: fixture.voucherCode,
        requestedMinor: 12000,
        key: 'db_release_reserve_2',
        orderId: 'db-order-release',
      });
      await capture(client, fixture, capturedReservation.reservation_reference, 'db_release_capture');

      const refused = await rejectionMessage(client, () =>
        release(client, fixture, capturedReservation.reservation_reference, 'db_release_2'),
      );
      expect(refused).toMatch(/reservation already captured/);
    });
  });

  it('reverses a redemption with a positive refund entry and marks it reversed', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createIntegrationFixture(client);
      const reservation = await reserve(client, fixture, {
        code: fixture.voucherCode,
        requestedMinor: 20000,
        key: 'db_refund_reserve',
      });
      const captured = await capture(client, fixture, reservation.reservation_reference, 'db_refund_capture');

      const partial = await refund(client, fixture, captured.redemption_id, 5000, 'db_refund_1');
      expect(Number(partial.amount_minor)).toBe(5000);
      expect(await ledgerBalance(client, fixture.voucherId)).toBe(35000);

      const replay = await refund(client, fixture, captured.redemption_id, 5000, 'db_refund_1');
      expect(replay.refund_id).toBe(partial.refund_id);
      expect(await ledgerCount(client, fixture.voucherId, 'refund')).toBe(1);

      const full = await refund(client, fixture, captured.redemption_id, 15000, 'db_refund_2');
      expect(full.fully_refunded).toBe(true);
      expect(await ledgerBalance(client, fixture.voucherId)).toBe(50000);

      const { rows } = await client.query(
        'select status from public.redemptions where id = $1',
        [captured.redemption_id],
      );
      expect(rows[0].status).toBe('reversed');
    });
  });

  it('expires stale holds and opens reconciliation for a started capture', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createIntegrationFixture(client);

      await client.query(
        `insert into public.integration_reservations (
           reference, platform_id, mapping_id, voucher_id, vendor_id, external_order_id,
           amount_minor, currency, status, idempotency_key, expires_at, capture_started_at
         )
         select 'RSV-EXPIRED-' || substr($3::text, 1, 8), $1::uuid, $2::uuid, $4::uuid, $5::uuid, 'db-expired',
                1000, 'KWD', 'active', $3, now() - interval '1 minute', null
         union all
         select 'RSV-STUCK-' || substr($3::text, 1, 8), $1::uuid, $2::uuid, $4::uuid, $5::uuid, 'db-stuck',
                1000, 'KWD', 'active', $6, now() - interval '1 minute', now() - interval '2 minutes'`,
        [fixture.platformId, fixture.mappingId, 'db_expired_key', fixture.voucherId, fixture.vendorId, 'db_stuck_key'],
      );

      const result = await asService(client, async () => {
        const { rows } = await client.query('select * from public.integration_expire_reservations(100)');
        return rows[0];
      });
      expect(Number(result.expired_count)).toBe(1);
      expect(Number(result.reconciliation_count)).toBe(1);

      const { rows } = await client.query(
        `select status from public.integration_reservations
         where reference in ('RSV-EXPIRED-' || substr($1, 1, 8), 'RSV-STUCK-' || substr($1, 1, 8))
         order by reference`,
        ['db_expired_key'],
      );
      expect(rows.map((row) => row.status).sort()).toEqual(['expired', 'reconciliation']);

      const cases = await client.query(
        `select count(*)::int as n from public.integration_reconciliation_cases
         where platform_id = $1 and reason = 'capture_started_then_expired'`,
        [fixture.platformId],
      );
      expect(Number(cases.rows[0].n)).toBe(1);
    });
  });

  it('keeps the staff redemption wrapper on the legacy path', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createIntegrationFixture(client);

      const result = await actAs(client, fixture.staffId, async () => {
        const { rows } = await client.query(
          'select * from public.redeem_monetary($1, $2, $3)',
          [fixture.voucherId, 2000, 'db staff redemption'],
        );
        return rows[0];
      });

      expect(Number(result.new_balance_minor)).toBe(48000);
      const { rows } = await client.query(
        `select channel, platform_id, reservation_id from public.redemptions where id = $1`,
        [result.redemption_id],
      );
      expect(rows[0].channel).toBe('staff');
      expect(rows[0].platform_id).toBeNull();
      expect(rows[0].reservation_id).toBeNull();
    });
  });
});
