import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cronSecret, cronSecretFromRequest, cronSecretMatches } from '@/lib/cron';
import { callSupplierFunction } from '@/lib/myfatoorah-supplier';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

/**
 * The platform's scheduled work.
 *
 * Two jobs that used to wait for someone to press a button:
 *
 *  1. Scheduled gifts — a voucher whose `scheduled_for` has passed is marked
 *     delivered, which fires the buyer's notification through the existing
 *     trigger. The balance and ledger are untouched.
 *  2. Advertising — expiry, budget exhaustion, scheduled activation and
 *     auto-renewal for campaigns and their slots.
 *  3. Retention — a bounded batch delete of high-growth event/telemetry tables.
 *     Never touches money, ledger, orders or audit rows. Runs in dry-run mode
 *  4. External-platform reservations — expired holds are released, while a
 *     hold whose capture had started becomes a reconciliation case.
 *
 * All are idempotent, so a scheduler running more often than necessary is
 * harmless. Auth is the cron secret: Vercel Cron sends `CRON_SECRET` as a
 * bearer token, and any other scheduler can send it in `Authorization` or
 * `x-cron-secret`.
 *
 * Point a scheduler at GET or POST /api/cron. `web/vercel.json` registers it
 * with Vercel; the same URL works from cron-job.org, GitHub Actions or a
 * Supabase scheduled function.
 *
 * Customers choose a delivery date, never a time, so one run just after
 * midnight is enough: a gift scheduled for today is delivered on that day.
 * `web/vercel.json` uses `5 0 * * *` (00:05 UTC, which is 03:05 in Qatar — still
 * the same date). Vercel cron times are UTC. If this work ever needs to run
 * more often, point an external scheduler (cron-job.org, GitHub Actions or a
 * Supabase scheduled function) at the same endpoint.
 */
async function run(request: Request) {
  const expected = cronSecret();
  if (!expected) {
    return NextResponse.json(
      { error: 'Scheduled work is not configured. Set CRON_SECRET on the deployment.' },
      { status: 503 },
    );
  }

  const provided = cronSecretFromRequest(request);
  if (!provided || !cronSecretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();

    // Retention starts in dry-run mode; flip RETENTION_LIVE=1 only after the
    // first report has been inspected. The RPC itself is service-role only.
    const retentionDryRun = process.env.RETENTION_LIVE !== '1';

    const [gifts, advertising, retention, integrationExpiry] = await Promise.all([
      admin.rpc('deliver_scheduled_gifts', { p_limit: 200 }),
      admin.rpc('advertising_run_maintenance'),
      admin.rpc('app_retention_cleanup', {
        p_dry_run: retentionDryRun,
        p_max_rows_per_table: 5000,
      }),
      admin.rpc('integration_expire_reservations', { p_limit: 500 }),
    ]);

    // A failure in one job must not hide the other one's result.
    if (gifts.error || advertising.error) {
      console.error('Scheduled work failed', {
        gifts: gifts.error?.message ?? null,
        advertising: advertising.error?.message ?? null,
      });
    }

    // Retention is non-fatal: a missing RPC or a failed delete must not turn
    // the whole scheduled run into a 500 and hide the gift/advertising result.
    if (retention.error) {
      console.error('Retention cleanup failed', retention.error.message);
    }

    // Reservation expiry is non-fatal until the integration migrations are
    // applied. An expired hold is freed here; a hold whose capture had already
    // started becomes a reconciliation case instead of being released.
    if (integrationExpiry.error) {
      console.error('Integration reservation expiry failed', integrationExpiry.error.message);
    }

    // Supplier KYC statuses change in MyFatoorah without a guaranteed webhook,
    // so reconcile the provider list on every scheduled run. A provider failure
    // is reported but does not stop the other jobs.
    let supplierSync: { ok: boolean; synced: number; error: string | null } = {
      ok: true,
      synced: 0,
      error: null,
    };
    const sync = await callSupplierFunction('sync-myfatoorah-suppliers');
    if (!sync.ok && !sync.skipped) {
      supplierSync = { ok: false, synced: 0, error: sync.error ?? 'supplier_sync_failed' };
      console.error('Supplier status sync failed', supplierSync.error);
    } else {
      supplierSync = { ok: true, synced: Number(sync.data?.synced ?? 0), error: null };
    }

    const ok = !gifts.error && !advertising.error;

    // Best-effort push nudge for buyers with a gift due today. A gift that has
    // to be sent by hand (WhatsApp, SMS or a link) only reaches the recipient
    // if the buyer presses send, so poke them off-app as well as in-app.
    try {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: due } = await admin
        .from('notifications')
        .select('user_id')
        .eq('kind', 'due')
        .is('read_at', null)
        .gte('created_at', since);

      const userIds = [...new Set((due ?? []).map((row: { user_id: string }) => row.user_id))];
      if (userIds.length > 0) {
        const { data: tokenRows } = await admin
          .from('push_tokens')
          .select('token')
          .in('user_id', userIds);

        const messages = (tokenRows ?? [])
          .map((row: { token: string }) => row.token)
          .filter(Boolean)
          .map((to: string) => ({
            to,
            title: 'Gift due today',
            body: 'A scheduled gift is ready to send.',
            sound: 'default',
          }));

        if (messages.length > 0) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(messages),
          });
        }
      }
    } catch (pushError) {
      console.error('Push nudge failed', pushError);
    }

    return NextResponse.json(
      {
        ok,
        gifts: {
          delivered: typeof gifts.data === 'number' ? gifts.data : 0,
          error: gifts.error?.message ?? null,
        },
        advertising: {
          result: advertising.data ?? null,
          error: advertising.error?.message ?? null,
        },
        retention: {
          dry_run: retentionDryRun,
          result: retention.data ?? null,
          error: retention.error?.message ?? null,
        },
        integration_reservation_expiry: {
          result: integrationExpiry.data ?? null,
          error: integrationExpiry.error?.message ?? null,
        },
        suppliers: supplierSync,
      },
      { status: ok ? 200 : 500 },
    );
  } catch (error) {
    console.error('Scheduled work crashed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
