// supabase/functions/supplier-onboard/index.ts
// Creates a MyFatoorah supplier for a vendor whose merchant application is
// complete. NEVER creates twice: an existing SupplierCode short-circuits.
//
// Called server-to-server by the Next.js admin action with:
//   x-internal-key: <SUPABASE_SERVICE_ROLE_KEY>
//   { vendorId }
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import {
  createSupplier,
  getSuppliers,
  logProviderError,
  MyFatoorahError,
  type SupplierInput,
} from '../_shared/myfatoorah.ts';

function internalRequest(req: Request): boolean {
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const provided = req.headers.get('x-internal-key') ?? '';
  return Boolean(expected && provided && provided === expected);
}

function digits(value: unknown): string {
  return String(value ?? '').replace(/\D+/g, '');
}

function qatarMobile(value: unknown): string {
  const raw = digits(value);
  if (!raw) return '';
  if (raw.startsWith('974')) return raw;
  if (raw.startsWith('00974')) return raw.slice(2);
  if (raw.startsWith('0')) return `974${raw.slice(1)}`;
  return `974${raw}`;
}

function holderName(value: unknown): string {
  // Provider rejects special characters and numbers in the holder name.
  return String(value ?? '').replace(/[^A-Za-z ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function num(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!internalRequest(req)) return json({ error: 'unauthorized' }, 401);

  try {
    const body = (await req.json()) as { vendorId?: string };
    const vendorId = String(body.vendorId ?? '').trim();
    if (!vendorId) return json({ error: 'invalid_request' }, 400);

    const admin = adminClient();

    const { data: vendor, error: vendorError } = await admin
      .from('vendors')
      .select(
        'id, name, status, owner_id, myfatoorah_supplier_code, myfatoorah_supplier_status, myfatoorah_supplier_email',
      )
      .eq('id', vendorId)
      .maybeSingle();
    if (vendorError) throw vendorError;
    if (!vendor) return json({ error: 'vendor_not_found' }, 404);

    // Idempotency: a SupplierCode is permanent. Never create a second one.
    if (vendor.myfatoorah_supplier_code) {
      return json({
        created: false,
        status: 'existing',
        supplierCode: vendor.myfatoorah_supplier_code,
        supplierStatus: vendor.myfatoorah_supplier_status,
      });
    }

    const { data: application, error: appError } = await admin
      .from('merchant_applications')
      .select(
        'id, status, contact_name, business_name, business_email, business_phone, business_type, bank_name, bank_account_name, bank_account_number, bank_iban',
      )
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (appError) throw appError;
    if (!application) return json({ error: 'application_not_found' }, 409);

    const email = String(application.business_email ?? '').trim();
    const mobile = qatarMobile(application.business_phone);
    if (!email || !mobile) {
      return json({ error: 'supplier_contact_incomplete' }, 409);
    }

    const { data: claimed, error: claimError } = await admin.rpc('myfatoorah_supplier_claim', {
      p_vendor_id: vendorId,
    });
    if (claimError) {
      const message = String(claimError.message ?? '');
      if (message.includes('supplier_creation_in_progress')) {
        return json({ error: 'supplier_creation_in_progress' }, 409);
      }
      throw claimError;
    }
    if (!claimed) {
      // Another request won the race and stored a code in the meantime.
      const { data: refreshed } = await admin
        .from('vendors')
        .select('myfatoorah_supplier_code, myfatoorah_supplier_status')
        .eq('id', vendorId)
        .maybeSingle();
      return json({
        created: false,
        status: 'existing',
        supplierCode: refreshed?.myfatoorah_supplier_code ?? null,
        supplierStatus: refreshed?.myfatoorah_supplier_status ?? null,
      });
    }

    const input: SupplierInput = {
      SupplierName: String(application.business_name || vendor.name || '').slice(0, 100),
      Mobile: mobile,
      Email: email,
      // 1 = Home Business, 2 = Company (documented CreateSupplier values).
      BusinessType: application.business_type === 'company' ? 2 : 1,
      BusinessName: String(application.business_name || vendor.name || '').slice(0, 100),
    };

    const holder = holderName(application.bank_account_name);
    if (holder) input.BankAccountHolderName = holder;

    const account = digits(application.bank_account_number);
    if (account) input.BankAccount = account;

    const iban = String(application.bank_iban ?? '').replace(/[\s-]/g, '').toUpperCase();
    if (/^QA\d{2}[A-Z0-9]{11,30}$/.test(iban)) input.Iban = iban;

    // CommissionValue / CommissionPercentage / DepositTerms are intentionally
    // omitted: they come from the account's provider-side commercial arrangement.

    try {
      const supplier = await createSupplier(input);
      const { data: saved, error: saveError } = await admin.rpc('myfatoorah_supplier_created', {
        p_vendor_id: vendorId,
        p_supplier_code: supplier.supplierCode,
        p_supplier_email: supplier.supplierEmail,
        p_provider_date: supplier.date,
        p_raw: supplier.raw,
      });
      if (saveError) throw saveError;

      await notifyOwner(admin, vendor.owner_id, 'Your MyFatoorah supplier was created. KYC verification is next.');

      return json({
        created: true,
        status: 'created',
        supplierCode: supplier.supplierCode,
        supplierStatus: saved?.myfatoorah_supplier_status ?? 'Pending',
      });
    } catch (error) {
      logProviderError('supplier-onboard failed', error);

      // A timeout is ambiguous: the supplier may exist. Check before retrying.
      if (error instanceof MyFatoorahError && error.timeout) {
        try {
          const suppliers = await getSuppliers();
          const match = suppliers.find(
            (s) =>
              String(s.SupplierCode) === String(vendor.myfatoorah_supplier_code ?? '') ||
              String(s.Email ?? '').toLowerCase() === email.toLowerCase() ||
              String(s.SupplierName ?? '').toLowerCase() === String(input.SupplierName).toLowerCase(),
          );
          if (match) {
            const { data: saved } = await admin.rpc('myfatoorah_supplier_created', {
              p_vendor_id: vendorId,
              p_supplier_code: String(match.SupplierCode),
              p_supplier_email: String(match.Email ?? email),
              p_provider_date: null,
              p_raw: match,
            });
            return json({
              created: true,
              status: 'recovered_after_timeout',
              supplierCode: String(match.SupplierCode),
              supplierStatus: saved?.myfatoorah_supplier_status ?? match.SupplierStatus ?? 'Pending',
            });
          }
        } catch (lookupError) {
          logProviderError('supplier-onboard recovery lookup failed', lookupError);
        }
      }

      const detail = error instanceof MyFatoorahError ? error.message : 'supplier_creation_failed';
      await admin.rpc('myfatoorah_supplier_failed', {
        p_vendor_id: vendorId,
        p_error: detail,
        p_timeout: error instanceof MyFatoorahError && error.timeout,
      });
      return json({ error: detail, retryable: true }, error instanceof MyFatoorahError ? error.status : 502);
    }
  } catch (error) {
    logProviderError('supplier-onboard crashed', error);
    return json({ error: 'server_error' }, 500);
  }
});

async function notifyOwner(admin: ReturnType<typeof adminClient>, ownerId: string | null, message: string) {
  if (!ownerId) return;
  await admin.from('notifications').insert({
    user_id: ownerId,
    kind: 'merchant',
    title_key: 'MyFatoorah supplier created',
    body_key: message,
    payload: {},
  });
}
