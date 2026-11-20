import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MerchantAgreement,
  MerchantApplication,
  MerchantDocument,
  MerchantSignature,
} from '@/lib/merchant';

export interface MerchantSupplierStatus {
  supplierCode: string | null;
  supplierStatus: string | null;
  supplierCreatedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  rejectionComment: string | null;
  depositTerms: string | null;
  paymentEligibility: boolean;
  paymentEligibilityNote: string | null;
}

export interface MerchantBundle {
  application: MerchantApplication | null;
  documents: MerchantDocument[];
  signature: MerchantSignature | null;
  agreement: MerchantAgreement | null;
  /** Provider + platform status of the business's MyFatoorah supplier. */
  supplier: MerchantSupplierStatus | null;
  /** True when the viewer may edit the application (owner/manager, not an analyst). */
  canManage: boolean;
  error: string | null;
}

/**
 * Loads everything the payment screens need, creating the application on first
 * visit. Read-only members (e.g. enterprise analysts) can still see an existing
 * application; they simply cannot create or edit one.
 */
export async function loadMerchantBundle(
  supabase: SupabaseClient,
  ownerType: 'vendor' | 'partner',
  ownerId: string,
): Promise<MerchantBundle> {
  const ownerColumn = ownerType === 'vendor' ? 'vendor_id' : 'partner_id';
  const supplierColumns =
    'myfatoorah_supplier_code, myfatoorah_supplier_status, myfatoorah_supplier_created_at, myfatoorah_last_synced_at, myfatoorah_last_error, myfatoorah_rejection_comment, myfatoorah_deposit_terms, payment_eligibility, payment_eligibility_note';

  // These three reads do not depend on the application, so fetch them together.
  const [existingResult, agreementResult, supplierResult] = await Promise.all([
    supabase
      .from('merchant_applications')
      .select('*')
      .eq(ownerColumn, ownerId)
      .maybeSingle(),
    supabase.from('merchant_agreements').select('*').eq('is_active', true).maybeSingle(),
    ownerType === 'vendor'
      ? supabase.from('vendors').select(supplierColumns).eq('id', ownerId).maybeSingle()
      : supabase.from('enterprise_partners').select(supplierColumns).eq('id', ownerId).maybeSingle(),
  ]);

  const existingError = existingResult.error;
  if (existingError) {
    return {
      application: null,
      documents: [],
      signature: null,
      agreement: null,
      supplier: null,
      canManage: false,
      error: existingError.message,
    };
  }

  let application = (existingResult.data as MerchantApplication | null) ?? null;

  if (!application) {
    const { data: created, error: createError } = await supabase.rpc('merchant_application_create', {
      p_owner_type: ownerType,
      p_vendor_id: ownerType === 'vendor' ? ownerId : null,
      p_partner_id: ownerType === 'partner' ? ownerId : null,
    });

    if (createError || !created) {
      const notAuthorized = (createError?.message ?? '').includes('not_authorized');
      return {
        application: null,
        documents: [],
        signature: null,
        agreement: null,
        supplier: null,
        canManage: false,
        error: notAuthorized
          ? 'No payment application has been started yet. An owner or manager needs to open Online Payments first.'
          : (createError?.message ?? 'Could not open the payment application.'),
      };
    }
    application = created as MerchantApplication;
  }

  const [documentsResult, signatureResult, canManageResult] = await Promise.all([
    supabase
      .from('merchant_application_documents')
      .select('*')
      .eq('application_id', application.id)
      .order('doc_type', { ascending: true }),
    supabase
      .from('merchant_agreement_signatures')
      .select('id, application_id, agreement_id, agreement_version, signatory_name, signatory_role, signed_at')
      .eq('application_id', application.id)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc('merchant_application_can_manage', { p_application_id: application.id }),
  ]);

  const supplierRow = supplierResult.data as Record<string, any> | null;

  return {
    application,
    documents: (documentsResult.data ?? []) as MerchantDocument[],
    signature: (signatureResult.data as MerchantSignature | null) ?? null,
    agreement: (agreementResult.data as MerchantAgreement | null) ?? null,
    supplier: supplierRow
      ? {
          supplierCode: supplierRow.myfatoorah_supplier_code ?? null,
          supplierStatus: supplierRow.myfatoorah_supplier_status ?? null,
          supplierCreatedAt: supplierRow.myfatoorah_supplier_created_at ?? null,
          lastSyncedAt: supplierRow.myfatoorah_last_synced_at ?? null,
          lastError: supplierRow.myfatoorah_last_error ?? null,
          rejectionComment: supplierRow.myfatoorah_rejection_comment ?? null,
          depositTerms: supplierRow.myfatoorah_deposit_terms ?? null,
          paymentEligibility: Boolean(supplierRow.payment_eligibility),
          paymentEligibilityNote: supplierRow.payment_eligibility_note ?? null,
        }
      : null,
    canManage: canManageResult.data === true,
    error: null,
  };
}

/** Request-scoped cache so a page and its children share one bundle load. */
export const loadMerchantBundleCached = cache(loadMerchantBundle);


