import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

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
  const expected = process.env.ADVERTISING_MAINTENANCE_SECRET ?? process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'Advertising maintenance is not configured' },
      { status: 503 },
    );
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const provided = bearer || request.headers.get('x-cron-secret') || '';
  if (!provided || !tokenMatches(provided, expected)) {
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
