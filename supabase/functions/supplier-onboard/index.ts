// supabase/functions/supplier-onboard/index.ts
// Creates a MyFatoorah supplier for a vendor OR an enterprise partner whose
// merchant application is complete. Both business types are treated identically.
//
// x-internal-key: <SUPABASE_SERVICE_ROLE_KEY>
// { vendorId } or { partnerId }
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
  // Supabase reserves SUPABASE_* env names and may inject a newer key format
  // there, so prefer our own secret that matches the web app's internal key.
  const expected = Deno.env.get('INTERNAL_API_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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
  return String(value ?? '').replace(/[^A-Za-z ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!internalRequest(req)) return json({ error: 'unauthorized' }, 401);

  try {
    const body = (await req.json()) as { vendorId?: string; partnerId?: string };
    const vendorId = String(body.vendorId ?? '').trim();
    const partnerId = String(body.partnerId ?? '').trim();
    if (Boolean(vendorId) === Boolean(partnerId)) {
      return json({ error: 'invalid_request' }, 400);
    }
    const ownerType = vendorId ? 'vendor' : 'partner';
    const ownerId = vendorId || partnerId;
    const admin = adminClient();

    const ownerTable = ownerType === 'vendor' ? 'vendors' : 'enterprise_partners';
    const ownerColumn = ownerType === 'vendor' ? 'vendor_id' : 'partner_id';
    const claimFn = ownerType === 'vendor' ? 'myfatoorah_supplier_claim' : 'myfatoorah_partner_claim';
    const createdFn = ownerType === 'vendor' ? 'myfatoorah_supplier_created' : 'myfatoorah_partner_created';
    const failedFn = ownerType === 'vendor' ? 'myfatoorah_supplier_failed' : 'myfatoorah_partner_failed';

    const { data: owner, error: ownerError } = await admin
      .from(ownerTable)
      .select('id, name, status, owner_id, myfatoorah_supplier_code, myfatoorah_supplier_status, myfatoorah_supplier_email')
      .eq('id', ownerId)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (!owner) return json({ error: 'business_not_found' }, 404);

    // A supplier code is permanent. Never create a second one.
    if (owner.myfatoorah_supplier_code) {
      return json({
        created: false,
        ownerType,
        status: 'existing',
        supplierCode: owner.myfatoorah_supplier_code,
        supplierStatus: owner.myfatoorah_supplier_status,
      });
    }

    const { data: application, error: appError } = await admin
      .from('merchant_applications')
      .select(
        'id, status, business_name, business_email, business_phone, business_type, bank_name, bank_account_name, bank_account_number, bank_iban',
      )
      .eq(ownerColumn, ownerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (appError) throw appError;
    if (!application) return json({ error: 'application_not_found' }, 409);

    const email = String(application.business_email ?? '').trim();
    const mobile = qatarMobile(application.business_phone);
    if (!email || !mobile) return json({ error: 'supplier_contact_incomplete' }, 409);

    const { data: claimed, error: claimError } = await admin.rpc(claimFn, {
      [ownerType === 'vendor' ? 'p_vendor_id' : 'p_partner_id']: ownerId,
    });
    if (claimError) {
      const message = String(claimError.message ?? '');
      if (message.includes('supplier_creation_in_progress')) {
        return json({ error: 'supplier_creation_in_progress' }, 409);
      }
      throw claimError;
    }
    if (!claimed) {
      const { data: refreshed } = await admin
        .from(ownerTable)
        .select('myfatoorah_supplier_code, myfatoorah_supplier_status')
        .eq('id', ownerId)
        .maybeSingle();
      return json({
        created: false,
        ownerType,
        status: 'existing',
        supplierCode: refreshed?.myfatoorah_supplier_code ?? null,
        supplierStatus: refreshed?.myfatoorah_supplier_status ?? null,
      });
    }

    const displayName = String(application.business_name || owner.name || '').slice(0, 100);
    const input: SupplierInput = {
      SupplierName: displayName,
      Mobile: mobile,
      Email: email,
      BusinessType: application.business_type === 'company' ? 2 : 1,
      BusinessName: displayName,
    };
    const holder = holderName(application.bank_account_name);
    if (holder) input.BankAccountHolderName = holder;
    const account = digits(application.bank_account_number);
    if (account) input.BankAccount = account;
    const iban = String(application.bank_iban ?? '').replace(/[\s-]/g, '').toUpperCase();
    if (iban) {
      if (!/^QA\d{2}[A-Z0-9]{22}$/.test(iban)) {
        return json(
          {
            error:
              'The business IBAN is not a valid Qatar IBAN (QA, two check digits and 22 letters or numbers). Update the banking details and retry.',
          },
          409,
        );
      }
      input.Iban = iban;
    }
    // Commission / deposit terms come from the provider's configuration.

    try {
      const supplier = await createSupplier(input);
      const { data: saved, error: saveError } = await admin.rpc(createdFn, {
        [ownerType === 'vendor' ? 'p_vendor_id' : 'p_partner_id']: ownerId,
        p_supplier_code: supplier.supplierCode,
        p_supplier_email: supplier.supplierEmail,
        p_provider_date: supplier.date,
        p_raw: supplier.raw,
      });
      if (saveError) throw saveError;

      await notifyOwner(admin, owner.owner_id, 'Your MyFatoorah supplier was created. KYC verification is next.');
      return json({
        created: true,
        ownerType,
        status: 'created',
        supplierCode: supplier.supplierCode,
        supplierStatus: saved?.myfatoorah_supplier_status ?? 'Pending',
      });
    } catch (error) {
      logProviderError('supplier-onboard failed', error);

      // A timeout is ambiguous: check whether the supplier was created first.
      if (error instanceof MyFatoorahError && error.timeout) {
        try {
          const suppliers = await getSuppliers();
          const match = suppliers.find(
            (s) =>
              String(s.Email ?? '').toLowerCase() === email.toLowerCase() ||
              String(s.SupplierName ?? '').toLowerCase() === displayName.toLowerCase(),
          );
          if (match) {
            const { data: saved } = await admin.rpc(createdFn, {
              [ownerType === 'vendor' ? 'p_vendor_id' : 'p_partner_id']: ownerId,
              p_supplier_code: String(match.SupplierCode),
              p_supplier_email: String(match.Email ?? email),
              p_provider_date: null,
              p_raw: match,
            });
            return json({
              created: true,
              ownerType,
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
      await admin.rpc(failedFn, {
        [ownerType === 'vendor' ? 'p_vendor_id' : 'p_partner_id']: ownerId,
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
