import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deliverClaimLinks } from '@/lib/merchant-payment-delivery';

export const dynamic = 'force-dynamic';

/**
 * Server-to-server claim-link delivery, called by the payment webhook after a
 * gift card has been issued. The raw claim token never enters the database.
 */
export async function POST(request: Request) {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const provided = request.headers.get('x-internal-key') ?? '';
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { orderId?: string; claimToken?: string };
    const orderId = String(body.orderId ?? '');
    const claimToken = String(body.claimToken ?? '');
    if (!orderId || !claimToken) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const result = await deliverClaimLinks(orderId, claimToken);
    if (!result.delivered && result.reason === 'email_provider_unavailable') {
      return NextResponse.json({ error: result.reason }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('[merchant-payment] claim delivery failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
