'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { buildSignedAgreementPdf } from '@/lib/agreement-signature';
import { createAdminClient } from '@/lib/supabase/admin';
import { callSupplierFunction } from '@/lib/myfatoorah-supplier';
import { merchantErrorMessage } from '@/lib/merchant';

const BUCKET = 'merchant-documents';
const MAX_AGREEMENT_BYTES = 5 * 1024 * 1024;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function back(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

export async function adminReviewMerchantDocument(formData: FormData) {
  const ctx = await requireAdmin();
  const documentId = str(formData, 'document_id');
  const applicationId = str(formData, 'application_id');
  const status = str(formData, 'status');
  const reason = str(formData, 'reason');
  const path = `/admin/merchant-onboarding/${applicationId}`;

  if (!['pending_review', 'approved', 'rejected', 'replacement_required'].includes(status)) {
    back(path, 'That document status is not allowed.');
  }
  if ((status === 'rejected' || status === 'replacement_required') && !reason) {
    back(path, 'Explain why the document needs replacing.');
  }

  const { error } = await ctx.supabase.rpc('merchant_document_review', {
    p_document_id: documentId,
    p_status: status,
    p_reason: reason || null,
  });
  if (error) back(path, merchantErrorMessage(error.message));

  revalidatePath(path);
  revalidatePath('/admin/merchant-onboarding');
  redirect(`${path}?reviewed=1`);
}

export async function adminReviewMerchantApplication(formData: FormData) {
  const ctx = await requireAdmin();
  const applicationId = str(formData, 'application_id');
  const status = str(formData, 'status');
  const note = str(formData, 'note');
  const path = `/admin/merchant-onboarding/${applicationId}`;

  const { data: application, error } = await ctx.supabase.rpc('merchant_application_review', {
    p_application_id: applicationId,
    p_status: status,
    p_note: note || null,
  });
  if (error) back(path, merchantErrorMessage(error.message));

  // Approving used to stop at an internal decision, so vendors finished
  // onboarding with no MyFatoorah supplier. Create it here, idempotently; the
  // edge function refuses duplicates and reuses an in-progress claim.
  if (status === 'approved' || status === 'active') {
    const owner = application as { vendor_id?: string | null; partner_id?: string | null } | null;
    const body = owner?.vendor_id ? { vendorId: owner.vendor_id } : { partnerId: owner?.partner_id };
    if (owner?.vendor_id || owner?.partner_id) {
      const result = await callSupplierFunction('supplier-onboard', body);
      if (!result.ok) {
        const reason = result.skipped
          ? 'the supplier service is not configured'
          : (result.error ?? 'the provider request failed');
        back(
          path,
          `Application approved, but the MyFatoorah supplier was not created because ${reason}. Use the supplier panel to retry.`,
        );
      }
    }
  }

  revalidatePath(path);
  revalidatePath('/admin/merchant-onboarding');
  revalidatePath('/admin/vendors');
  revalidatePath('/admin/enterprise');
  redirect(`${path}?decided=1`);
}

export async function adminAddMerchantNote(formData: FormData) {
  const ctx = await requireAdmin();
  const applicationId = str(formData, 'application_id');
  const note = str(formData, 'note');
  const path = `/admin/merchant-onboarding/${applicationId}`;

  if (!note) back(path, 'Write a note first.');

  const { error } = await ctx.supabase.rpc('merchant_application_note', {
    p_application_id: applicationId,
    p_note: note,
  });
  if (error) back(path, merchantErrorMessage(error.message));

  revalidatePath(path);
  redirect(`${path}?noted=1`);
}

export async function adminPublishAgreement(formData: FormData) {
  const ctx = await requireAdmin();
  const version = str(formData, 'version');
  const title = str(formData, 'title');
  const file = formData.get('file');

  if (!version || !title) back('/admin/merchant-onboarding/agreements', 'Enter a version and a title.');
  if (!(file instanceof File) || file.size === 0) {
    back('/admin/merchant-onboarding/agreements', 'Choose the agreement PDF.');
  }
  if (file.size > MAX_AGREEMENT_BYTES) {
    back('/admin/merchant-onboarding/agreements', 'That PDF is too large. Keep it under 5 MB.');
  }
  if ((file.type || '').toLowerCase() !== 'application/pdf') {
    back('/admin/merchant-onboarding/agreements', 'Upload the agreement as a PDF.');
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    back('/admin/merchant-onboarding/agreements', 'Storage is not configured.');
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const digest = createHash('sha256').update(bytes).digest('hex');
  const path = `agreements/${version.replace(/[^A-Za-z0-9._-]/g, '-')}-${Date.now()}.pdf`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: false });
  if (uploadError) {
    back('/admin/merchant-onboarding/agreements', 'We could not store that file. Please try again.');
  }

  const { error } = await ctx.supabase.rpc('merchant_agreement_publish', {
    p_version: version,
    p_title: title,
    p_storage_path: path,
    p_file_name: file.name || 'agreement.pdf',
    p_file_size: file.size,
    p_content_sha256: digest,
  });

  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    back('/admin/merchant-onboarding/agreements', merchantErrorMessage(error.message));
  }

  revalidatePath('/admin/merchant-onboarding/agreements');
  revalidatePath('/admin/merchant-onboarding');
  revalidatePath('/vendor/payments/agreement');
  revalidatePath('/enterprise/payments/agreement');
  redirect('/admin/merchant-onboarding/agreements?published=1');
}

export async function adminDeactivateAgreement(formData: FormData) {
  const ctx = await requireAdmin();
  const agreementId = str(formData, 'agreement_id');

  const { error } = await ctx.supabase.rpc('merchant_agreement_deactivate', {
    p_agreement_id: agreementId,
  });
  if (error) back('/admin/merchant-onboarding/agreements', merchantErrorMessage(error.message));

  revalidatePath('/admin/merchant-onboarding/agreements');
  redirect('/admin/merchant-onboarding/agreements?deactivated=1');
}

/** Generates the stamped agreement and submits it as MyFatoorah FileType 26. */
export async function adminSendSignedContract(formData: FormData) {
  const ctx = await requireAdmin();
  const signatureId = str(formData, 'signature_id');
  const applicationId = str(formData, 'application_id');
  const requestedReturn = str(formData, 'return_to');
  const returnPath = requestedReturn.startsWith('/admin/')
    ? requestedReturn
    : '/admin/merchant-onboarding';

  if (!signatureId || !applicationId) back(returnPath, 'Signature not found.');

  const admin = createAdminClient();
  const { data: signature } = await admin
    .from('merchant_agreement_signatures')
    .select('*')
    .eq('id', signatureId)
    .eq('application_id', applicationId)
    .maybeSingle();
  if (!signature?.signature_data) back(returnPath, 'This signature has no stored image.');

  const { data: agreement } = await admin
    .from('merchant_agreements')
    .select('id, version, storage_path')
    .eq('id', signature.agreement_id)
    .maybeSingle();
  if (!agreement) back(returnPath, 'Agreement not found.');

  const { data: application } = await admin
    .from('merchant_applications')
    .select('id, vendor_id, partner_id')
    .eq('id', applicationId)
    .maybeSingle();
  if (!application) back(returnPath, 'Application not found.');
  const ownerType = application.vendor_id ? 'vendor' : 'partner';
  const ownerId = application.vendor_id ?? application.partner_id;
  if (!ownerId) back(returnPath, 'Application has no owner.');

  const { data: base, error: downloadError } = await admin.storage
    .from(BUCKET)
    .download(agreement.storage_path);
  if (downloadError || !base) back(returnPath, 'Agreement file unavailable.');

  const pdf = await buildSignedAgreementPdf({
    basePdf: new Uint8Array(await base.arrayBuffer()),
    signatureData: signature.signature_data,
    signatoryName: signature.signatory_name,
    signatoryRole: signature.signatory_role,
    signedAt: signature.signed_at,
  });
  const bytes = Buffer.from(pdf);
  const storagePath = `${ownerType}/${ownerId}/${applicationId}/three-parties-contract-${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });
  if (uploadError) back(returnPath, uploadError.message);

  const { data: document, error: documentError } = await admin
    .from('merchant_application_documents')
    .insert({
      application_id: applicationId,
      doc_type: 'three_parties_contract',
      storage_path: storagePath,
      file_name: `signed-agreement-${agreement.version}.pdf`,
      mime_type: 'application/pdf',
      size_bytes: bytes.byteLength,
      status: 'approved',
      uploaded_by: ctx.user.id,
    })
    .select('id')
    .single();
  if (documentError) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    back(returnPath, documentError.message);
  }

  const submission = await callSupplierFunction('upload-supplier-document', {
    documentId: document.id,
  });
  if (!submission.ok && !submission.skipped) {
    back(returnPath, submission.error ?? 'MyFatoorah submission failed.');
  }

  revalidatePath(returnPath);
  if (application.vendor_id) revalidatePath(`/admin/vendors/${application.vendor_id}`);
  if (application.partner_id) revalidatePath(`/admin/enterprise/${application.partner_id}`);
  redirect(`${returnPath}?contract_submitted=1`);
}
