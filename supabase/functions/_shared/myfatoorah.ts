// supabase/functions/_shared/myfatoorah.ts
// Server-only MyFatoorah client shared by the supplier and payment functions.
//
// Configuration is read from the admin-editable `system_settings` row
// `payments.myfatoorah`, with Supabase Edge Function secrets as a fallback.
// Credentials never reach clients.
//
//   MYFATOORAH_API_KEY, MYFATOORAH_BASE_URL,
//   MYFATOORAH_WEBHOOK_SECRET, APP_PUBLIC_URL
//
// Financial model: provider-managed commission. We never send ProposedShare
// or ProposedDepositShare; MyFatoorah's supplier configuration owns commission
// and deposits.

import { adminClient } from './clients.ts';

export const PAYMENT_SETTINGS_KEY = 'payments.myfatoorah';
const DEFAULT_BASE_URL = 'https://apitest.myfatoorah.com';
const TIMEOUT_MS = 20_000;

export interface MFConfig {
  apiKey: string;
  baseUrl: string;
  webhookSecret: string;
  appPublicUrl: string;
  /** Where the active key came from, for the admin status panel. */
  source: 'database' | 'environment' | 'none';
}

async function storedConfig(): Promise<Partial<MFConfig>> {
  try {
    const admin = adminClient();
    const { data } = await admin
      .from('system_settings')
      .select('value')
      .eq('key', PAYMENT_SETTINGS_KEY)
      .maybeSingle();
    const value = (data?.value ?? {}) as Record<string, unknown>;
    const text = (input: unknown) => (typeof input === 'string' ? input.trim() : '');
    return {
      apiKey: text(value.api_key),
      baseUrl: text(value.base_url).replace(/\/+$/, ''),
      webhookSecret: text(value.webhook_secret),
      appPublicUrl: text(value.app_public_url).replace(/\/+$/, ''),
    };
  } catch (error) {
    console.error('[myfatoorah] could not read stored settings', String(error));
    return {};
  }
}

/** Admin settings win; environment secrets are the fallback. */
export async function mfConfig(): Promise<MFConfig> {
  const stored = await storedConfig();
  const envApiKey = Deno.env.get('MYFATOORAH_API_KEY')?.trim() ?? '';
  return {
    apiKey: stored.apiKey || envApiKey,
    baseUrl: stored.baseUrl || (Deno.env.get('MYFATOORAH_BASE_URL')?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    webhookSecret: stored.webhookSecret || Deno.env.get('MYFATOORAH_WEBHOOK_SECRET')?.trim() || '',
    appPublicUrl:
      stored.appPublicUrl || (Deno.env.get('APP_PUBLIC_URL')?.trim() || '').replace(/\/+$/, ''),
    source: stored.apiKey ? 'database' : envApiKey ? 'environment' : 'none',
  };
}

export class MyFatoorahError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly timeout = false,
    readonly providerMessage = '',
  ) {
    super(message);
    this.name = 'MyFatoorahError';
  }
}

function isSuccess(payload: any): boolean {
  if (!payload) return false;
  return payload.IsSuccess === true || String(payload.IsSuccess).toLowerCase() === 'true';
}

/** Provider messages are logged, but never contain credentials. */
function failureMessage(payload: any, status: number): string {
  const message = String(payload?.Message ?? '').trim();
  const validation = Array.isArray(payload?.ValidationErrors)
    ? payload.ValidationErrors.map((e: any) => `${e?.Name ?? ''}: ${e?.Error ?? ''}`).join('; ')
    : '';
  // CreateSupplier reports per-field problems in FieldsErrors while Message is
  // often just "Invalid data"; keep the detail so admins can fix the record.
  const fields = Array.isArray(payload?.FieldsErrors)
    ? payload.FieldsErrors.map((e: any) => `${e?.Name ?? ''}: ${e?.Error ?? ''}`).join('; ')
    : '';
  return (validation || fields || message || `HTTP ${status}`).slice(0, 500);
}

async function mfRequest(path: string, init: RequestInit = {}): Promise<any> {
  const { apiKey, baseUrl } = await mfConfig();
  if (!apiKey) {
    throw new MyFatoorahError('myfatoorah_not_configured', 503);
  }

  let timedOut = false;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const jsonHeaders: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };
    // Multipart uploads need the browser/Deno to set the boundary.
    if (!(typeof FormData !== 'undefined' && init.body instanceof FormData)) {
      jsonHeaders['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...jsonHeaders,
        ...(init.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !isSuccess(payload)) {
      throw new MyFatoorahError(
        failureMessage(payload, response.status),
        response.status,
        false,
        String(payload?.Message ?? ''),
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof MyFatoorahError) throw error;
    if (timedOut) {
      throw new MyFatoorahError('myfatoorah_timeout', 504, true);
    }
    throw new MyFatoorahError(`myfatoorah_request_failed: ${String(error)}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

/** Creates a hosted MyFatoorah invoice (v2 SendPayment). */
export async function sendPayment(payload: Record<string, unknown>): Promise<any> {
  const response = await mfRequest('/v2/SendPayment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.Data ?? response;
}

export interface SupplierInput {
  SupplierName: string;
  Mobile: string;
  Email: string;
  BusinessType: number;
  BusinessName?: string;
  BankAccountHolderName?: string;
  BankAccount?: string;
  Iban?: string;
}

export interface CreatedSupplier {
  supplierCode: string;
  supplierEmail: string | null;
  date: string | null;
  raw: any;
}

export async function createSupplier(input: SupplierInput): Promise<CreatedSupplier> {
  const payload = await mfRequest('/v2/CreateSupplier', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data = payload?.Data ?? {};
  const code = String(data?.SupplierCode ?? '').trim();
  if (!code || code === '0') {
    throw new MyFatoorahError('supplier_code_missing', 502);
  }
  return {
    supplierCode: code,
    supplierEmail: data?.SupplierEmail ? String(data.SupplierEmail) : null,
    date: data?.Date ? String(data.Date) : null,
    raw: data,
  };
}

export interface SupplierRecord {
  SupplierCode: number;
  SupplierName: string | null;
  Email: string | null;
  SupplierStatus: string | null;
  Comment: string | null;
  DepositTerms: string | null;
  CommissionPercentage: number | null;
  CommissionValue: number | null;
  [key: string]: unknown;
}

/** GetSuppliers returns a bare array, not the standard envelope. */
export async function getSuppliers(): Promise<SupplierRecord[]> {
  const { apiKey, baseUrl } = await mfConfig();
  if (!apiKey) throw new MyFatoorahError('myfatoorah_not_configured', 503);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/v2/GetSuppliers`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new MyFatoorahError(failureMessage(payload, response.status), response.status);
    }
    // Most accounts return an array; tolerate an enveloped list as well.
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.Data) ? payload.Data : null;
    if (!list) {
      throw new MyFatoorahError('unexpected_get_suppliers_response', 502);
    }
    return list as SupplierRecord[];
  } catch (error) {
    if (error instanceof MyFatoorahError) throw error;
    if (timedOut) throw new MyFatoorahError('myfatoorah_timeout', 504, true);
    throw new MyFatoorahError(`myfatoorah_request_failed: ${String(error)}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

export interface UploadDocumentInput {
  FileName: string;
  MediaType: string;
  Buffer: Uint8Array;
  FileType: number;
  SupplierCode: number;
}

export async function uploadSupplierDocument(input: UploadDocumentInput): Promise<any> {
  // UploadSupplierDocument is a multipart form, not a JSON body. The provider
  // binds a flat file part named `FileUpload`; a base64 Buffer or a nested
  // `SupplierFile.*` name fails with "The field File Upload is mandatory".
  const form = new FormData();
  form.append('SupplierCode', String(input.SupplierCode));
  form.append('FileType', String(input.FileType));
  form.append('FileName', input.FileName);
  form.append('MediaType', input.MediaType);
  form.append(
    'FileUpload',
    new Blob([input.Buffer as BlobPart], { type: input.MediaType }),
    input.FileName,
  );
  return mfRequest('/v2/UploadSupplierDocument', {
    method: 'PUT',
    body: form,
  });
}

/** Server-to-server payment status inquiry. Used to confirm webhooks. */
export async function getPaymentStatus(input: {
  key: string;
  keyType: 'PaymentId' | 'InvoiceId' | 'CustomerReference';
}): Promise<any> {
  const payload = await mfRequest('/v2/GetPaymentStatus', {
    method: 'POST',
    body: JSON.stringify({ Key: input.key, KeyType: input.keyType }),
  });
  return payload.Data ?? payload;
}

/** Log provider errors without credentials or document bytes. */
export function logProviderError(scope: string, error: unknown): void {
  if (error instanceof MyFatoorahError) {
    console.error(scope, {
      code: error.message,
      status: error.status,
      timeout: error.timeout,
      provider: error.providerMessage.slice(0, 200),
    });
    return;
  }
  console.error(scope, String(error));
}
