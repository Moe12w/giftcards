'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
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

  const { error } = await ctx.supabase.rpc('merchant_application_review', {
    p_application_id: applicationId,
    p_status: status,
    p_note: note || null,
  });
  if (error) back(path, merchantErrorMessage(error.message));

  revalidatePath(path);
  revalidatePath('/admin/merchant-onboarding');
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
