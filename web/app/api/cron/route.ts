import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cronSecret, cronSecretFromRequest, cronSecretMatches } from '@/lib/cron';

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
 *
 * Both are idempotent, so a scheduler running more often than necessary is
 * harmless. Auth is the cron secret: Vercel Cron sends `CRON_SECRET` as a
 * bearer token, and any other scheduler can send it in `Authorization` or
 * `x-cron-secret`.
 *
 * Point a scheduler at GET or POST /api/cron. `web/vercel.json` registers it
 * with Vercel; the same URL works from cron-job.org, GitHub Actions or a
 * Supabase scheduled function.
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

    const [gifts, advertising] = await Promise.all([
      admin.rpc('deliver_scheduled_gifts', { p_limit: 200 }),
      admin.rpc('advertising_run_maintenance'),
    ]);

    // A failure in one job must not hide the other one's result.
    if (gifts.error || advertising.error) {
      console.error('Scheduled work failed', {
        gifts: gifts.error?.message ?? null,
        advertising: advertising.error?.message ?? null,
      });
    }

    const ok = !gifts.error && !advertising.error;

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
