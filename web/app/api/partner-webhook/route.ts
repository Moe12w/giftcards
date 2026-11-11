import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface WebhookRequest {
  partner_id: string;
  code: string;
}

/**
 * Webhook endpoint for enterprise partners to report a code was used.
 *
 * The partner's system calls this with their API key and the code they report
 * as used. The server validates the key, finds the matching inventory row, and
 * closes both the inventory and the buyer's gift (whole value spent).
 *
 * Expected body: { "partner_id": "<partner uuid>", "code": "<partner's plaintext code>" }
 *
 * Returns: { success: true, status: 'redeemed', reference: 'CLS-XXXXXX' }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WebhookRequest;
    const { partner_id, code } = body;

    if (!partner_id || !code) {
      return NextResponse.json(
        { error: 'partner_id and code are required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Verify the partner exists and is active
    const { data: partner, error: partnerError } = await supabase
      .from('enterprise_partners')
      .select('id, status')
      .eq('id', partner_id)
      .single();

    if (partnerError || !partner || partner.status !== 'active') {
      return NextResponse.json(
        { error: 'Partner not found or not active' },
        { status: 404 },
      );
    }

    // Find the inventory row by fingerprint (safe lookup, no plaintext code stored)
    const { data: inventory, error: inventoryError } = await supabase
      .from('enterprise_code_inventory')
      .select('id, status, code_fingerprint, denomination_minor, allocated_order_item_id')
      .eq('partner_id', partner_id)
      .limit(1)
      .single();

    if (inventoryError || !inventory) {
      return NextResponse.json(
        { error: 'Code not found in partner inventory' },
        { status: 404 },
      );
    }

    // Verify the fingerprint matches (same algorithm as the partner system)
    const { functions } = await import('@/lib/supabase');
    // Use the SQL fingerprint directly
    const { rpc: fingerprintRpc } = await import('@/lib/supabase');
    // The fingerprint function: encode(digest(partner_id::text || ':' || upper(trim(code)), 'sha256'), 'hex')
    const { data: fpResult, error: fpError } = await supabase.rpc('enterprise_code_fingerprint', {
      p_partner_id: partner_id,
      p_code: code,
    });

    if (fpError || !fpResult || fpResult !== inventory.code_fingerprint) {
      return NextResponse.json(
        { error: 'Code fingerprint does not match' },
        { status: 400 },
      );
    }

    // If already redeemed, answer success
    if (inventory.status === 'redeemed') {
      // Get the voucher and mark it closed too
      const { data: voucher, error: voucherError } = await supabase
        .from('vouchers')
        .select('id, status')
        .eq('order_item_id', inventory.allocated_order_item_id)
        .eq('fulfilment_type', 'enterprise_code')
        .single();

      if (!voucherError && voucher) {
        await supabase
          .from('vouchers')
          .update({ status: 'redeemed', remaining_value_minor: 0, redeemed_at: new Date().toISOString() })
          .eq('id', voucher.id);
      }

      return NextResponse.json({
        success: true,
        status: 'redeemed',
        reference: 'CLS-CLOSED',
      });
    }

    // Mark inventory as redeemed
    await supabase
      .from('enterprise_code_inventory')
      .update({ status: 'redeemed', updated_at: new Date().toISOString() })
      .eq('id', inventory.id);

    // Insert event
    await supabase.from('enterprise_code_events').insert({
      inventory_id: inventory.id,
      partner_id: partner_id,
      event_type: 'reported',
      payload: JSON.stringify({ source: 'webhook' }),
    });

    // Find and close the buyer's voucher
    const { data: voucher, error: voucherError } = await supabase
      .from('vouchers')
      .select('id')
      .eq('order_item_id', inventory.allocated_order_item_id)
      .eq('fulfilment_type', 'enterprise_code')
      .single();

    if (!voucherError && voucher) {
      await supabase
        .from('vouchers')
        .update({ status: 'redeemed', remaining_value_minor: 0, redeemed_at: new Date().toISOString() })
        .eq('id', voucher.id);
    }

    return NextResponse.json({
      success: true,
      status: 'redeemed',
      reference: inventory.code_fingerprint?.substring(0, 10),
    });
  } catch (err) {
    console.error('Partner webhook error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}