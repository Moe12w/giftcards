import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server-only MyFatoorah client for advertising checkout.
 *
 * Configuration is read from the admin-editable `system_settings` row
 * `advertising.myfatoorah` (Admin → Advertising → Payments), with environment
 * variables as a fallback for deployments that prefer secrets outside the
 * database. The API key never leaves the server.
 *
 * Invoice amounts are sent in major units (QAR); the database keeps minor units
 * everywhere, so conversion happens on this boundary only.
 */

export const MYFATOORAH_SETTINGS_KEY = 'advertising.myfatoorah';
/** Gift-card / supplier configuration, edited in Admin → Payment Management. */
export const GIFT_PAYMENTS_SETTINGS_KEY = 'payments.myfatoorah';
const DEFAULT_BASE_URL = 'https://apitest.myfatoorah.com';
const CACHE_TTL_MS = 30_000;

export interface MyFatoorahConfig {
  apiKey: string;
  baseUrl: string;
  webhookSecret: string;
  appPublicUrl: string;
  /** Where the active key came from, for the admin status panel. */
  source: 'database' | 'environment' | 'none';
}

interface StoredConfig {
  apiKey: string;
  baseUrl: string;
  webhookSecret: string;
  appPublicUrl: string;
}

const cached = new Map<string, { at: number; value: MyFatoorahConfig }>();

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function envConfig(): StoredConfig {
  return {
    apiKey: process.env.MYFATOORAH_API_KEY?.trim() ?? '',
    baseUrl: trimSlash(process.env.MYFATOORAH_BASE_URL?.trim() ?? ''),
    webhookSecret: process.env.MYFATOORAH_WEBHOOK_SECRET?.trim() ?? '',
    appPublicUrl: trimSlash(
      process.env.APP_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || '',
    ),
  };
}

async function storedConfig(settingsKey: string): Promise<StoredConfig> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('system_settings')
      .select('value')
      .eq('key', settingsKey)
      .maybeSingle();
    const value = (data?.value ?? {}) as Record<string, unknown>;
    const text = (input: unknown) => (typeof input === 'string' ? input.trim() : '');
    return {
      apiKey: text(value.api_key),
      baseUrl: trimSlash(text(value.base_url)),
      webhookSecret: text(value.webhook_secret),
      appPublicUrl: trimSlash(text(value.app_public_url)),
    };
  } catch (error) {
    console.error('[advertising] could not read MyFatoorah settings', error);
    return { apiKey: '', baseUrl: '', webhookSecret: '', appPublicUrl: '' };
  }
}

export async function getMyFatoorahConfig(
  settingsKey: string = MYFATOORAH_SETTINGS_KEY,
): Promise<MyFatoorahConfig> {
  const hit = cached.get(settingsKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const stored = await storedConfig(settingsKey);
  const env = envConfig();
  const value: MyFatoorahConfig = {
    apiKey: stored.apiKey || env.apiKey,
    baseUrl: stored.baseUrl || env.baseUrl || DEFAULT_BASE_URL,
    webhookSecret: stored.webhookSecret || env.webhookSecret,
    appPublicUrl: stored.appPublicUrl || env.appPublicUrl,
    source: stored.apiKey ? 'database' : env.apiKey ? 'environment' : 'none',
  };

  cached.set(settingsKey, { at: Date.now(), value });
  return value;
}

/** Configuration used by gift-card checkout, suppliers and webhooks. */
export async function getPaymentMyFatoorahConfig(): Promise<MyFatoorahConfig> {
  return getMyFatoorahConfig(GIFT_PAYMENTS_SETTINGS_KEY);
}

/** Call after saving settings so the next payment uses the new values. */
export function clearMyFatoorahConfigCache(settingsKey?: string): void {
  if (settingsKey) cached.delete(settingsKey);
  else cached.clear();
}

export async function isMyFatoorahConfigured(): Promise<boolean> {
  const config = await getMyFatoorahConfig();
  return config.apiKey.length > 0;
}

/** Public base URL of this app, without a trailing slash. */
export async function getAppPublicUrl(): Promise<string> {
  return (await getMyFatoorahConfig()).appPublicUrl;
}

/** 125000 fils → 1250 (major units). */
export function minorToMajor(minor: number): number {
  return Number((Number(minor) / 100).toFixed(2));
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

export interface CreateInvoiceInput {
  amountMinor: number;
  currency?: string;
  customerName: string;
  customerEmail?: string | null;
  /** Our own id, echoed back by MyFatoorah as Invoice.ExternalIdentifier. */
  reference: string;
  description: string;
  language?: 'en' | 'ar';
  callbackUrl: string;
  errorUrl: string;
  webhookUrl?: string;
}

export interface CreatedInvoice {
  invoiceId: string;
  invoiceUrl: string;
}

/** Creates a hosted MyFatoorah invoice and returns its payment URL. */
export async function createMyFatoorahInvoice(input: CreateInvoiceInput): Promise<CreatedInvoice> {
  const { apiKey, baseUrl } = await getMyFatoorahConfig();
  if (!apiKey) throw new Error('myfatoorah_invoice_failed: not configured');

  const payload: Record<string, unknown> = {
    CustomerName: input.customerName || 'Advertiser',
    NotificationOption: 'LNK',
    InvoiceValue: minorToMajor(input.amountMinor),
    DisplayCurrencyIso: input.currency || 'QAR',
    Language: input.language === 'ar' ? 'AR' : 'EN',
    CustomerReference: input.reference,
    UserDefinedField: input.reference,
    CallBackUrl: input.callbackUrl,
    ErrorUrl: input.errorUrl,
    InvoiceItems: [
      {
        ItemName: input.description.slice(0, 100) || 'Advertising booking',
        Quantity: 1,
        UnitPrice: minorToMajor(input.amountMinor),
      },
    ],
  };
  if (input.customerEmail) payload.CustomerEmail = input.customerEmail;
  if (input.webhookUrl) payload.WebhookUrl = input.webhookUrl;

  const response = await fetch(`${baseUrl}/v2/SendPayment`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const json = (await response.json().catch(() => null)) as any;
  const invoiceUrl = json?.Data?.InvoiceURL;
  if (!response.ok || !json?.IsSuccess || !invoiceUrl) {
    const detail = json?.Message || `HTTP ${response.status}`;
    throw new Error(`myfatoorah_invoice_failed: ${detail}`);
  }

  return {
    invoiceId: String(json.Data.InvoiceId),
    invoiceUrl: String(invoiceUrl),
  };
}

export interface MyFatoorahPaymentStatus {
  invoiceId: string;
  paymentId: string | null;
  paid: boolean;
  amountMinor: number;
  customerReference: string | null;
  invoiceStatus: string;
  transactionStatus: string | null;
  raw: unknown;
}

/**
 * Server-to-server status inquiry. This is the only thing allowed to make a
 * payment "real": a browser redirect alone never marks a campaign as paid.
 */
export async function getMyFatoorahPaymentStatus(
  input: {
    key: string;
    keyType: 'PaymentId' | 'InvoiceId' | 'CustomerReference';
  },
  config?: MyFatoorahConfig,
): Promise<MyFatoorahPaymentStatus> {
  const { apiKey, baseUrl } = config ?? (await getMyFatoorahConfig());
  if (!apiKey) throw new Error('myfatoorah_status_failed: not configured');

  const response = await fetch(`${baseUrl}/v2/GetPaymentStatus`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({ Key: input.key, KeyType: input.keyType }),
    cache: 'no-store',
  });

  const json = (await response.json().catch(() => null)) as any;
  if (!response.ok || !json?.IsSuccess || !json?.Data) {
    throw new Error(`myfatoorah_status_failed: ${json?.Message || `HTTP ${response.status}`}`);
  }

  const data = json.Data;
  const transactions: any[] = Array.isArray(data.InvoiceTransactions) ? data.InvoiceTransactions : [];
  const successTransaction = transactions.find((tx) =>
    ['success', 'succss', 'paid'].includes(String(tx?.TransactionStatus ?? '').toLowerCase()),
  );
  const invoiceStatus = String(data.InvoiceStatus ?? '');
  const paid =
    invoiceStatus.toLowerCase() === 'paid' && (successTransaction !== undefined || transactions.length === 0);

  return {
    invoiceId: String(data.InvoiceId ?? ''),
    paymentId: successTransaction?.PaymentId
      ? String(successTransaction.PaymentId)
      : data.PaymentId
        ? String(data.PaymentId)
        : null,
    paid,
    amountMinor: Math.round(Number(data.InvoiceValue ?? 0) * 100),
    customerReference: data.CustomerReference ? String(data.CustomerReference) : null,
    invoiceStatus,
    transactionStatus: successTransaction?.TransactionStatus
      ? String(successTransaction.TransactionStatus)
      : null,
    raw: data,
  };
}

/**
 * Webhook signature: HMAC-SHA256 (base64) over the documented PAYMENT_STATUS
 * fields, ordered exactly as MyFatoorah builds them. Empty for null values.
 */
export function myFatoorahSignaturePayload(data: any): string {
  const value = (input: unknown) => (input === null || input === undefined ? '' : String(input));
  return [
    `Invoice.Id=${value(data?.Invoice?.Id)}`,
    `Invoice.Status=${value(data?.Invoice?.Status)}`,
    `Transaction.Status=${value(data?.Transaction?.Status)}`,
    `Transaction.PaymentId=${value(data?.Transaction?.PaymentId)}`,
    `Invoice.ExternalIdentifier=${value(data?.Invoice?.ExternalIdentifier)}`,
  ].join(',');
}

export function verifyMyFatoorahWebhookSignature(
  data: any,
  header: string,
  secret: string,
): boolean {
  if (!secret || !header) return false;
  const expected = createHmac('sha256', secret)
    .update(myFatoorahSignaturePayload(data), 'utf8')
    .digest('base64');
  const providedBuffer = Buffer.from(header, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
