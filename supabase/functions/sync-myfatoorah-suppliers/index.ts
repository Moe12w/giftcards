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
  const expected = Deno.env.get('INTERNAL_API_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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

    const [vendorsResult, partnersResult] = await Promise.all([
      admin
        .from('vendors')
        .select('id, myfatoorah_supplier_code')
        .in('myfatoorah_supplier_code', codes),
      admin
        .from('enterprise_partners')
        .select('id, myfatoorah_supplier_code')
        .in('myfatoorah_supplier_code', codes),
    ]);
    if (vendorsResult.error) throw vendorsResult.error;
    if (partnersResult.error) throw partnersResult.error;

    const byCode = new Map<string, { id: string; kind: 'vendor' | 'partner' }>();
    for (const vendor of vendorsResult.data ?? []) {
      byCode.set(String(vendor.myfatoorah_supplier_code), { id: vendor.id, kind: 'vendor' });
    }
    for (const partner of partnersResult.data ?? []) {
      byCode.set(String(partner.myfatoorah_supplier_code), { id: partner.id, kind: 'partner' });
    }

    let synced = 0;
    const unmatched: string[] = [];
    const errors: Array<{ supplierCode: string; error: string }> = [];
    const updates: Record<string, unknown>[] = [];
    const codeByOwner = new Map<string, string>();

    for (const supplier of suppliers) {
      const code = String(supplier.SupplierCode ?? '').trim();
      const vendor = byCode.get(code);
      if (!vendor) {
        unmatched.push(code);
        continue;
      }
      codeByOwner.set(vendor.id, code);
      updates.push({
        owner_type: vendor.kind,
        owner_id: vendor.id,
        status: String(supplier.SupplierStatus ?? 'Pending'),
        comment: supplier.Comment ? String(supplier.Comment) : null,
        deposit_terms: supplier.DepositTerms ? String(supplier.DepositTerms) : null,
        commission_percentage: toNumber(supplier.CommissionPercentage),
        commission_value: toNumber(supplier.CommissionValue),
        raw: supplier,
      });
    }

    if (updates.length > 0) {
      const { data: result, error } = await admin.rpc('myfatoorah_sync_statuses', {
        p_updates: updates,
      });
      if (error) throw error;
      synced = Number((result as { synced?: number } | null)?.synced ?? 0);
      for (const row of (((result as { errors?: unknown[] } | null)?.errors ?? []) as {
        owner_id?: string;
        error?: string;
      }[])) {
        errors.push({
          supplierCode: codeByOwner.get(String(row.owner_id ?? '')) ?? String(row.owner_id ?? 'unknown'),
          error: String(row.error ?? 'sync_failed'),
        });
      }
    }

    return json({ synced, unmatched, errors, total: suppliers.length });
  } catch (error) {
    logProviderError('sync-myfatoorah-suppliers failed', error);
    return json({ error: 'server_error' }, 500);
  }
});
