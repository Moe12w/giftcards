// supabase/functions/sync-myfatoorah-suppliers/index.ts
// Pulls the provider's supplier list (GetSuppliers) and applies real statuses
// to matching vendor records. Safe to run repeatedly.
//
// x-internal-key: <SUPABASE_SERVICE_ROLE_KEY>
// No body required.
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { getSuppliers, logProviderError } from '../_shared/myfatoorah.ts';

function internalRequest(req: Request): boolean {
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const provided = req.headers.get('x-internal-key') ?? '';
  return Boolean(expected && provided && provided === expected);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405);
  }
  if (!internalRequest(req)) return json({ error: 'unauthorized' }, 401);

  try {
    const admin = adminClient();
    const suppliers = await getSuppliers();

    const codes = suppliers
      .map((s) => String(s.SupplierCode ?? '').trim())
      .filter((code) => code && code !== '0');
    if (codes.length === 0) {
      return json({ synced: 0, unmatched: [], total: 0 });
    }

    const { data: vendors, error: vendorError } = await admin
      .from('vendors')
      .select('id, myfatoorah_supplier_code, myfatoorah_supplier_status')
      .in('myfatoorah_supplier_code', codes);
    if (vendorError) throw vendorError;

    const byCode = new Map<string, any>();
    for (const vendor of vendors ?? []) {
      byCode.set(String(vendor.myfatoorah_supplier_code), vendor);
    }

    let synced = 0;
    const unmatched: string[] = [];
    const errors: Array<{ supplierCode: string; error: string }> = [];

    for (const supplier of suppliers) {
      const code = String(supplier.SupplierCode ?? '').trim();
      const vendor = byCode.get(code);
      if (!vendor) {
        unmatched.push(code);
        continue;
      }

      const { error } = await admin.rpc('myfatoorah_supplier_synced', {
        p_vendor_id: vendor.id,
        p_status: String(supplier.SupplierStatus ?? 'Pending'),
        p_comment: supplier.Comment ? String(supplier.Comment) : null,
        p_deposit_terms: supplier.DepositTerms ? String(supplier.DepositTerms) : null,
        p_commission_percentage: toNumber(supplier.CommissionPercentage),
        p_commission_value: toNumber(supplier.CommissionValue),
        p_raw: supplier,
      });
      if (error) {
        errors.push({ supplierCode: code, error: error.message });
      } else {
        synced += 1;
      }
    }

    return json({ synced, unmatched, errors, total: suppliers.length });
  } catch (error) {
    logProviderError('sync-myfatoorah-suppliers failed', error);
    return json({ error: 'server_error' }, 500);
  }
});
