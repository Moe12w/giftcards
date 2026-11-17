import 'server-only';

/**
 * Server-to-server bridge to the supplier Edge Functions. The internal key is
 * the service-role key, which stays on the server; browsers never call these
 * functions directly.
 */
export interface SupplierCallResult<T = any> {
  ok: boolean;
  skipped?: boolean;
  data?: T;
  error?: string;
}

export async function callSupplierFunction<T = any>(
  name: 'supplier-onboard' | 'upload-supplier-document' | 'sync-myfatoorah-suppliers',
  body: Record<string, unknown> = {},
): Promise<SupplierCallResult<T>> {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    return { ok: false, skipped: true, error: 'Supplier service is not configured.' };
  }

  try {
    const response = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': key,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.error) {
      return { ok: false, error: String(data?.error ?? `HTTP ${response.status}`) };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'supplier_service_unavailable' };
  }
}
