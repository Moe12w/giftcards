import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cronSecret, cronSecretFromRequest, cronSecretMatches } from '@/lib/cron';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Advertising lifecycle cron.
 *
 * Runs expiry, budget exhaustion, daily-budget resume, scheduled activation,
 * advertiser suspensions and optional auto-renewal. Delivery also runs
 * maintenance inline, so a missed cron never serves an expired campaign; this
 * endpoint keeps time-based transitions and notifications timely.
 *
 * Auth: `Authorization: Bearer $ADVERTISING_MAINTENANCE_SECRET` (Vercel Cron
 * uses CRON_SECRET automatically, so either name works) or `x-cron-secret`.
 */
async function run(request: Request) {
  const expected = cronSecret();
  if (!expected) {
    return NextResponse.json(
      { error: 'Advertising maintenance is not configured' },
      { status: 503 },
    );
  }

  const provided = cronSecretFromRequest(request);
  if (!provided || !cronSecretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('advertising_run_maintenance');
    if (error) {
      console.error('Advertising maintenance error:', error);
      return NextResponse.json({ error: 'Maintenance failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, result: data });
  } catch (err) {
    console.error('Advertising maintenance error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
