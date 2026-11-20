'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { callSupplierFunction } from '@/lib/myfatoorah-supplier';
import { QATAR_IBAN_HINT, isValidQatarIban, normalizeIban } from '@/lib/iban';
import {
  DOCUMENT_MAX_BYTES,
  isPaymentMethodKey,
  merchantErrorMessage,
  type MerchantApplication,
  type MerchantOwnerType,
} from '@/lib/merchant';

const BUCKET = 'merchant-documents';

const DOC_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optional(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value || null;
}

function back(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

function paymentsPath(application: Pick<MerchantApplication, 'owner_type'>): string {
  return application.owner_type === 'vendor' ? '/vendor/payments' : '/enterprise/payments';
}

interface LoadedApplication {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  application: MerchantApplication;
}

async function loadApplication(applicationId: string): Promise<LoadedApplication | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('merchant_applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle();

  if (!data) return null;
  return { supabase, userId: user.id, application: data as MerchantApplication };
}

// ---------------------------------------------------------------------------
// Wizard steps
// ---------------------------------------------------------------------------

export async function saveMerchantStep(formData: FormData) {
  const applicationId = str(formData, 'application_id');
  const step = Number.parseInt(str(formData, 'step') || '1', 10);
  const loaded = await loadApplication(applicationId);
  if (!loaded) back('/vendor/payments', 'Application not found.');

  const { supabase, application } = loaded;

  const patch: Record<string, unknown> = { step };
  if (step === 1) {
    patch.contact_name = optional(formData, 'contact_name');
    patch.contact_role = optional(formData, 'contact_role');
    patch.business_name = optional(formData, 'business_name');
    patch.business_email = optional(formData, 'business_email');
    patch.business_phone = optional(formData, 'business_phone');
    patch.business_type = optional(formData, 'business_type');
    patch.cr_number = optional(formData, 'cr_number');
    patch.activity_name = optional(formData, 'activity_name');
    patch.activity_code = optional(formData, 'activity_code');
  }

  if (step === 2) {
    const methods = formData
      .getAll('payment_methods')
      .map((value) => String(value))
      .filter((value) => isPaymentMethodKey(value));
    if (methods.length === 0) {
      back(`${paymentsPath(application)}/application?step=2`, 'Choose at least one payment method.');
    }
    patch.payment_methods = methods;
  }

  if (step === 4) {
    const accountNumber = optional(formData, 'bank_account_number');
    const rawIban = optional(formData, 'bank_iban');
    const iban = rawIban ? normalizeIban(rawIban) : null;
    if (!accountNumber && !iban) {
      back(`${paymentsPath(application)}/application?step=4`, 'Enter an account number or IBAN.');
    }
    // A malformed IBAN is rejected by MyFatoorah with a generic "Invalid data",
    // so verify the format and the ISO 13616 check digits while it can be fixed.
    if (iban && !isValidQatarIban(iban)) {
      back(`${paymentsPath(application)}/application?step=4`, QATAR_IBAN_HINT);
    }
    patch.bank_name = optional(formData, 'bank_name');
    patch.bank_account_name = optional(formData, 'bank_account_name');
    patch.bank_account_number = accountNumber;
    patch.bank_iban = iban;
    patch.bank_currency = str(formData, 'bank_currency') || 'QAR';
  }

  const { error } = await supabase.rpc('merchant_application_save', {
    p_application_id: applicationId,
    p_patch: patch,
  });
  if (error) {
    back(`${paymentsPath(application)}/application?step=${step}`, merchantErrorMessage(error.message));
  }

  revalidatePath('/vendor/payments');
  revalidatePath('/vendor/payments/application');
  revalidatePath('/enterprise/payments');
  revalidatePath('/enterprise/payments/application');
  redirect(`${paymentsPath(application)}/application?step=${Math.min(step + 1, 5)}&saved=1`);
}

// ---------------------------------------------------------------------------
// Document uploads
// ---------------------------------------------------------------------------

export interface DocumentUploadResult {
  ok: boolean;
  error?: string;
}

export async function uploadMerchantDocument(formData: FormData): Promise<DocumentUploadResult> {
  const applicationId = str(formData, 'application_id');
  const docType = str(formData, 'doc_type');
  const file = formData.get('file');

  const loaded = await loadApplication(applicationId);
  if (!loaded) return { ok: false, error: 'Application not found.' };
  const { supabase, userId, application } = loaded;

  const { data: canManage } = await supabase.rpc('merchant_application_can_manage', {
    p_application_id: applicationId,
  });
  if (canManage !== true) {
    return { ok: false, error: 'Only the business owner or a manager can upload documents.' };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a file to upload.' };
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return { ok: false, error: 'That file is too large. Keep it under 5 MB.' };
  }

  const mime = (file.type || '').toLowerCase();
  const extension = DOC_EXTENSIONS[mime];
  if (!extension) {
    return { ok: false, error: 'Use a PDF, PNG, JPEG or WebP file.' };
  }
  if (docType === 'logo' && !IMAGE_MIME.has(mime)) {
    return { ok: false, error: 'The business logo must be a PNG, JPEG or WebP image.' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Document storage is not configured. Please contact support.' };
  }

  const ownerType = application.owner_type as MerchantOwnerType;
  const ownerId = application.vendor_id ?? application.partner_id ?? 'unknown';
  const path = `${ownerType}/${ownerId}/${applicationId}/${docType}-${Date.now()}.${extension}`;

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: mime,
    upsert: false,
  });
  if (uploadError) {
    return { ok: false, error: 'We could not store that file. Please try again.' };
  }

  const { data: previous } = await supabase
    .from('merchant_application_documents')
    .select('storage_path')
    .eq('application_id', applicationId)
    .eq('doc_type', docType)
    .maybeSingle();

  const { data: document, error } = await supabase.rpc('merchant_document_register', {
    p_application_id: applicationId,
    p_doc_type: docType,
    p_storage_path: path,
    p_file_name: file.name || `${docType}.${extension}`,
    p_mime_type: mime,
    p_size_bytes: file.size,
  });

  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    return { ok: false, error: merchantErrorMessage(error.message) };
  }

  if (previous?.storage_path && previous.storage_path !== path) {
    await admin.storage.from(BUCKET).remove([previous.storage_path]);
  }

  // Once a SupplierCode exists, submit the document to MyFatoorah immediately.
  // A failed provider submission is recorded on the document; it never changes
  // our internal review status and the merchant can retry.
  if (ownerType === 'vendor' && application.vendor_id && document?.id) {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('myfatoorah_supplier_code')
      .eq('id', application.vendor_id)
      .maybeSingle();
    if (vendor?.myfatoorah_supplier_code) {
      const submission = await callSupplierFunction('upload-supplier-document', {
        documentId: document.id,
      });
      if (!submission.ok && !submission.skipped) {
        console.error('[myfatoorah] document submission failed', submission.error);
      }
    }
  }

  revalidatePath(`${paymentsPath(application)}/application`);
  revalidatePath(paymentsPath(application));
  revalidatePath('/admin/merchant-onboarding');
  return { ok: true };
}

export async function removeMerchantDocument(formData: FormData) {
  const documentId = str(formData, 'document_id');
  const loaded = await loadApplication(str(formData, 'application_id'));
  if (!loaded) back('/vendor/payments', 'Application not found.');

  const { supabase, application } = loaded;

  const { data: document } = await supabase
    .from('merchant_application_documents')
    .select('id, storage_path')
    .eq('id', documentId)
    .maybeSingle();

  const { error } = await supabase.rpc('merchant_document_remove', { p_document_id: documentId });
  if (error) {
    back(`${paymentsPath(application)}/application?step=3`, merchantErrorMessage(error.message));
  }

  if (document?.storage_path) {
    try {
      const admin = createAdminClient();
      await admin.storage.from(BUCKET).remove([document.storage_path]);
    } catch {
      // The database row is gone; an orphaned object is harmless.
    }
  }

  revalidatePath(`${paymentsPath(application)}/application`);
  redirect(`${paymentsPath(application)}/application?step=3&saved=1`);
}

// ---------------------------------------------------------------------------
// Agreement signing
// ---------------------------------------------------------------------------

export async function signMerchantAgreement(formData: FormData) {
  const applicationId = str(formData, 'application_id');
  const loaded = await loadApplication(applicationId);
  if (!loaded) back('/vendor/payments', 'Application not found.');

  const { supabase, application } = loaded;
  const signature = str(formData, 'signature_data');
  const consent = str(formData, 'consent') === 'on';
  const signatoryName = str(formData, 'signatory_name');
  const signatoryRole = str(formData, 'signatory_role');
  const agreementPath = `${paymentsPath(application)}/agreement`;

  if (!signature.startsWith('data:image/png;base64,')) {
    back(agreementPath, 'Draw your signature before submitting.');
  }
  if (!consent) back(agreementPath, 'Tick the consent box to sign.');
  if (!signatoryName || !signatoryRole) {
    back(agreementPath, 'Enter the signatory name and role.');
  }

  const headerStore = await headers();
  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip') ||
    null;

  const { error } = await supabase.rpc('merchant_agreement_sign', {
    p_application_id: applicationId,
    p_signatory_name: signatoryName,
    p_signatory_role: signatoryRole,
    p_signature_data: signature,
    p_consent_text: str(formData, 'consent_text') || 'I agree to the payment processing agreement.',
    p_ip_address: ip,
    p_user_agent: headerStore.get('user-agent'),
  });

  if (error) back(agreementPath, merchantErrorMessage(error.message));

  revalidatePath(agreementPath);
  revalidatePath(paymentsPath(application));
  revalidatePath('/admin/merchant-onboarding');
  redirect(`${agreementPath}?signed=1`);
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

export async function submitMerchantApplication(formData: FormData) {
  const applicationId = str(formData, 'application_id');
  const loaded = await loadApplication(applicationId);
  if (!loaded) back('/vendor/payments', 'Application not found.');

  const { supabase, application } = loaded;
  const reviewPath = `${paymentsPath(application)}/review`;

  if (str(formData, 'confirm') !== 'on') {
    back(reviewPath, 'Tick the confirmation box to submit.');
  }

  const { error } = await supabase.rpc('merchant_application_submit', {
    p_application_id: applicationId,
  });
  if (error) back(reviewPath, merchantErrorMessage(error.message));

  revalidatePath(paymentsPath(application));
  revalidatePath(`${paymentsPath(application)}/review`);
  revalidatePath('/admin/merchant-onboarding');
  redirect(`${paymentsPath(application)}?submitted=1`);
}
