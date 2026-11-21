import { createHash } from 'node:crypto';
import type { Client } from 'pg';
import { describe, expect, it } from 'vitest';

import {
  actAs,
  createMoneyPathFixture,
  hasTestDatabase,
  inRolledBackTransaction,
  rejectionMessage,
  type MoneyPathFixture,
} from './harness';

const describeDb = hasTestDatabase ? describe : describe.skip;

/** The RPC the confirm route calls: credit each seller, mark the order paid. */
async function confirmPayment(client: Client, fixture: MoneyPathFixture, paymentId = 'pay_test_1') {
  const { rows } = await client.query(
    'select * from public.myfatoorah_payment_confirmed($1, $2)',
    [fixture.orderId, paymentId],
  );
  return rows[0];
}

/** The RPC the confirm route calls after confirmation: issue one voucher per line. */
async function fulfilOrder(client: Client, fixture: MoneyPathFixture) {
  const { rows } = await client.query('select public.myfatoorah_fulfill_order($1, $2::jsonb) as result', [
    fixture.invoiceId,
    JSON.stringify([
      { claim_token_hash: fixture.claimTokenHash, card_code_hash: fixture.cardCodeHash },
    ]),
  ]);
  return rows[0].result as { already_fulfilled: boolean; voucher_ids: string[] };
}

async function voucherRow(client: Client, voucherId: string) {
  const { rows } = await client.query('select * from public.vouchers where id = $1', [voucherId]);
  return rows[0];
}

async function voucherBalanceMinor(client: Client, voucherId: string) {
  const { rows } = await client.query(
    'select coalesce(sum(amount_minor), 0)::bigint as balance from public.ledger_entries where voucher_id = $1',
    [voucherId],
  );
  return Number(rows[0].balance);
}

async function saleCredits(client: Client, orderId: string) {
  const { rows } = await client.query(
    `select vendor_id, sum(amount_minor)::bigint as amount, count(*)::int as entries
     from public.financial_ledger
     where order_id = $1 and entry_type = 'sale'
     group by vendor_id`,
    [orderId],
  );
  return rows;
}

describeDb('money path (real database, rolled back)', { timeout: 90_000 }, () => {
  it('credits the seller, issues a scannable voucher, and redeems it down to zero', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createMoneyPathFixture(client);

      await confirmPayment(client, fixture);

      const credits = await saleCredits(client, fixture.orderId);
      expect(credits).toHaveLength(1);
      expect(credits[0].vendor_id).toBe(fixture.vendorId);
      expect(Number(credits[0].amount)).toBe(fixture.amountMinor);

      const order = (await client.query('select status, payment_status from public.orders where id = $1', [
        fixture.orderId,
      ])).rows[0];
      expect(order.status).toBe('paid');
      expect(order.payment_status).toBe('paid');

      const fulfilment = await fulfilOrder(client, fixture);
      expect(fulfilment.already_fulfilled).toBe(false);
      expect(fulfilment.voucher_ids).toHaveLength(1);

      const voucher = await voucherRow(client, fulfilment.voucher_ids[0]);
      // 0131: a checkout voucher must carry a code the counter can type/scan.
      expect(voucher.voucher_code).toMatch(/^GFT-[0-9A-F]{10}$/);
      expect(voucher.card_code_hash).toBe(fixture.cardCodeHash);
      expect(voucher.status).toBe('issued');
      expect(Number(voucher.initial_value_minor)).toBe(fixture.amountMinor);
      expect(await voucherBalanceMinor(client, voucher.id)).toBe(fixture.amountMinor);

      // Redemption happens as the vendor's staff member, through RLS.
      const partial = await actAs(client, fixture.staffId, async () => {
        const { rows } = await client.query('select * from public.redeem_voucher_by_id($1, $2)', [
          voucher.id,
          2000,
        ]);
        return rows[0];
      });
      expect(partial.kind).toBe('monetary');
      expect(Number(partial.remaining_value_minor)).toBe(fixture.amountMinor - 2000);
      expect(partial.new_status).toBe('partially_redeemed');
      expect(await voucherBalanceMinor(client, voucher.id)).toBe(fixture.amountMinor - 2000);

      const rest = await actAs(client, fixture.staffId, async () => {
        const { rows } = await client.query('select * from public.redeem_voucher_by_id($1, $2)', [
          voucher.id,
          fixture.amountMinor - 2000,
        ]);
        return rows[0];
      });
      expect(Number(rest.remaining_value_minor)).toBe(0);
      expect(rest.new_status).toBe('redeemed');
      expect((await voucherRow(client, voucher.id)).redeemed_at).not.toBeNull();

      // A fully redeemed voucher cannot be spent again.
      const refusal = await rejectionMessage(client, () =>
        actAs(client, fixture.staffId, () =>
          client.query('select * from public.redeem_voucher_by_id($1, $2)', [voucher.id, 100]),
        ),
      );
      expect(refusal).toMatch(/voucher not redeemable|insufficient balance/);
    });
  });

  it('is idempotent when the webhook and fulfilment replay', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createMoneyPathFixture(client);

      await confirmPayment(client, fixture, 'pay_first');
      const first = await fulfilOrder(client, fixture);

      await confirmPayment(client, fixture, 'pay_replay');
      const replay = await fulfilOrder(client, fixture);

      expect(replay.already_fulfilled).toBe(true);
      expect(replay.voucher_ids).toEqual(first.voucher_ids);

      // One voucher, one credit, one issue entry — not a second of each.
      const vouchers = await client.query('select count(*)::int as n from public.vouchers where order_id = $1', [
        fixture.orderId,
      ]);
      expect(vouchers.rows[0].n).toBe(1);

      const credits = await saleCredits(client, fixture.orderId);
      expect(credits).toHaveLength(1);
      expect(Number(credits[0].amount)).toBe(fixture.amountMinor);

      const issues = await client.query(
        `select count(*)::int as n from public.ledger_entries
         where voucher_id = $1 and entry_type = 'issue'`,
        [first.voucher_ids[0]],
      );
      expect(issues.rows[0].n).toBe(1);
      expect(await voucherBalanceMinor(client, first.voucher_ids[0])).toBe(fixture.amountMinor);
    });
  });

  it('refuses a seller from redeeming another seller’s voucher', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createMoneyPathFixture(client);
      await confirmPayment(client, fixture);
      const { voucher_ids: voucherIds } = await fulfilOrder(client, fixture);
      const voucherId = voucherIds[0];

      const refusal = await rejectionMessage(client, () =>
        actAs(client, fixture.otherStaffId, () =>
          client.query('select * from public.redeem_voucher_by_id($1, $2)', [voucherId, 1000]),
        ),
      );
      expect(refusal).toMatch(/voucher not found or not allowed/);

      // The refusal left the card untouched.
      expect(await voucherBalanceMinor(client, voucherId)).toBe(fixture.amountMinor);
      expect((await voucherRow(client, voucherId)).status).toBe('issued');
    });
  });

  it('hides a voucher from other buyers and other sellers', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createMoneyPathFixture(client);
      await confirmPayment(client, fixture);
      const { voucher_ids: voucherIds } = await fulfilOrder(client, fixture);
      const voucherId = voucherIds[0];

      const countAs = (userId: string) =>
        actAs(client, userId, async () => {
          const { rows } = await client.query('select count(*)::int as n from public.vouchers where id = $1', [
            voucherId,
          ]);
          return rows[0].n;
        });

      expect(await countAs(fixture.buyerId)).toBe(1);
      expect(await countAs(fixture.staffId)).toBe(1);
      expect(await countAs(fixture.otherBuyerId)).toBe(0);
      expect(await countAs(fixture.otherStaffId)).toBe(0);
    });
  });

  it('fails the confirmation when a paid line belongs to no seller', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createMoneyPathFixture(client);

      // A line whose product has gone (product_id and vendor_id both null, which
      // is what ON DELETE SET NULL leaves behind): the money has nowhere to go,
      // so the confirmation must refuse rather than mark the order paid.
      await client.query(
        `insert into public.order_items (order_id, product_id, vendor_id, quantity,
                                         unit_price_minor, total_minor, currency)
         values ($1, null, null, 1, 2500, 2500, 'KWD')`,
        [fixture.orderId],
      );
      await client.query('update public.orders set total_minor = total_minor + 2500, subtotal_minor = subtotal_minor + 2500 where id = $1', [
        fixture.orderId,
      ]);

      const refusal = await rejectionMessage(client, () => confirmPayment(client, fixture));
      expect(refusal).toMatch(/ledger_allocation_mismatch/);

      const order = (await client.query('select status, payment_status from public.orders where id = $1', [
        fixture.orderId,
      ])).rows[0];
      expect(order.payment_status).not.toBe('paid');
      const credits = await saleCredits(client, fixture.orderId);
      expect(credits).toHaveLength(0);
    });
  });

  it('stores the vendor share the ledger expects for a single-seller order', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createMoneyPathFixture(client);
      await confirmPayment(client, fixture);
      const { rows } = await client.query(
        `select direction, balance_after_minor, currency
         from public.financial_ledger where order_id = $1 and entry_type = 'sale'`,
        [fixture.orderId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].direction).toBe('credit');
      expect(Number(rows[0].balance_after_minor)).toBe(fixture.amountMinor);
      expect(rows[0].currency).toBe('KWD');
    });
  });

  it('accepts a voucher code issued by checkout at the counter', async () => {
    await inRolledBackTransaction(async (client) => {
      const fixture = await createMoneyPathFixture(client);
      await confirmPayment(client, fixture);
      const { voucher_ids: voucherIds } = await fulfilOrder(client, fixture);
      const voucher = await voucherRow(client, voucherIds[0]);

      // The counter path: staff type the printed code instead of scanning.
      const redemption = await actAs(client, fixture.staffId, async () => {
        const { rows } = await client.query(
          'select * from public.redeem_voucher_by_code($1, $2)',
          [voucher.voucher_code, 1000],
        );
        return rows[0];
      });
      expect(redemption.kind).toBe('monetary');
      expect(Number(redemption.remaining_value_minor)).toBe(fixture.amountMinor - 1000);
      expect(await voucherBalanceMinor(client, voucher.id)).toBe(fixture.amountMinor - 1000);
    });
  });
});
