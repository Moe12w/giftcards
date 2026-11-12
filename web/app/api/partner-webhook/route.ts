import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface WebhookRequest {
  partner_id?: string;
  code?: string;
}

interface UsageResult {
  success: boolean;
  status?: string;
  voucher_id?: string | null;
  reference?: string;
  error?: string;
}

/**
 * Webhook endpoint for enterprise partners to report a code was used.
 *
 * The partner's system calls this with its API key and the code it accepted.
 * The key identifies the partner, so the request can never close another
 * partner's codes. The database function then closes the inventory row and the
 * buyer's gift in one transaction.
 *
 * Expected headers: `x-api-key: gft_...` (or `Authorization: Bearer gft_...`)
 * Expected body:    { "partner_id": "<partner uuid>", "code": "<code>" }
 *
 * Returns: { success: true, status: 'redeemed', reference: 'CLS-XXXXXX' }
 */
export async function POST(request: Request) {
  try {
    const apiKey =
      request.headers.get('x-api-key') ??
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    const body = (await request.json()) as WebhookRequest;
    const code = body.code?.trim();
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: keyHash, error: hashError } = await admin.rpc('hash_enterprise_api_key', {
      p_key: apiKey,
    });
    if (hashError || !keyHash) {
      return NextResponse.json({ error: 'Could not verify API key' }, { status: 500 });
    }

    const { data: keyRow, error: keyError } = await admin
      .from('enterprise_api_keys')
      .select('id, partner_id')
      .eq('key_hash', keyHash as string)
      .is('revoked_at', null)
      .maybeSingle();
    if (keyError) {
      return NextResponse.json({ error: 'Could not verify API key' }, { status: 500 });
    }
    if (!keyRow) {
      return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 });
    }

    if (body.partner_id && body.partner_id !== keyRow.partner_id) {
      return NextResponse.json(
        { error: 'This API key belongs to a different partner' },
        { status: 403 },
      );
    }

    await admin
      .from('enterprise_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id);

    const { data, error } = await admin.rpc('report_enterprise_code_usage', {
      p_partner_id: keyRow.partner_id,
      p_code: code,
    });
    if (error) {
      console.error('Partner webhook error:', error);
      return NextResponse.json({ error: 'Could not report code usage' }, { status: 500 });
    }

    const result = data as UsageResult | null;
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error ?? 'Code not found in partner inventory' },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Partner webhook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
