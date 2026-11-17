import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MerchantAgreement,
  MerchantApplication,
  MerchantDocument,
  MerchantSignature,
} from '@/lib/merchant';

export interface MerchantBundle {
  application: MerchantApplication | null;
  documents: MerchantDocument[];
  signature: MerchantSignature | null;
  agreement: MerchantAgreement | null;
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

  const { data: existing, error: existingError } = await supabase
    .from('merchant_applications')
    .select('*')
    .eq(ownerColumn, ownerId)
    .maybeSingle();

  if (existingError) {
    return {
      application: null,
      documents: [],
      signature: null,
      agreement: null,
      canManage: false,
      error: existingError.message,
    };
  }

  let application = (existing as MerchantApplication | null) ?? null;

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
        canManage: false,
        error: notAuthorized
          ? 'No payment application has been started yet. An owner or manager needs to open Online Payments first.'
          : (createError?.message ?? 'Could not open the payment application.'),
      };
    }
    application = created as MerchantApplication;
  }

  const [documentsResult, signatureResult, agreementResult, canManageResult] = await Promise.all([
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
    supabase.from('merchant_agreements').select('*').eq('is_active', true).maybeSingle(),
    supabase.rpc('merchant_application_can_manage', { p_application_id: application.id }),
  ]);

  return {
    application,
    documents: (documentsResult.data ?? []) as MerchantDocument[],
    signature: (signatureResult.data as MerchantSignature | null) ?? null,
    agreement: (agreementResult.data as MerchantAgreement | null) ?? null,
    canManage: canManageResult.data === true,
    error: null,
  };
}

export function documentByType(documents: MerchantDocument[], docType: string): MerchantDocument | null {
  return documents.find((document) => document.doc_type === docType) ?? null;
}
