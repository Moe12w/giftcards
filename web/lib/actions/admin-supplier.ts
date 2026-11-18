'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { callSupplierFunction } from '@/lib/myfatoorah-supplier';

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function back(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

function revalidate(vendorId?: string) {
  revalidatePath('/admin/vendors');
  revalidatePath('/admin/merchant-onboarding');
  if (vendorId) revalidatePath(`/admin/vendors/${vendorId}`);
}

/** Creates a supplier exactly once. Safe to press repeatedly. */
export async function adminCreateMyFatoorahSupplier(formData: FormData) {
  await requireAdmin();
  const vendorId = str(formData, 'vendor_id');
  const path = `/admin/vendors/${vendorId}`;
  if (!vendorId) back('/admin/vendors', 'Vendor not found.');

  const result = await callSupplierFunction('supplier-onboard', { vendorId });
  if (!result.ok) {
    back(
      path,
      result.skipped
        ? 'Supplier service is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the web app.'
        : (result.error ?? 'Supplier creation failed.'),
    );
  }
  revalidate(vendorId);
  redirect(`${path}?supplier=1`);
}

/** Pulls real supplier statuses from MyFatoorah (GetSuppliers). */
export async function adminSyncMyFatoorahSuppliers(formData: FormData) {
  await requireAdmin();
  const vendorId = str(formData, 'vendor_id');
  const path = vendorId ? `/admin/vendors/${vendorId}` : '/admin/merchant-onboarding';

  const result = await callSupplierFunction('sync-myfatoorah-suppliers');
  if (!result.ok) {
    back(
      path,
      result.skipped
        ? 'Supplier service is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the web app.'
        : (result.error ?? 'Supplier sync failed.'),
    );
  }
  revalidate(vendorId);
  redirect(`${path}?synced=1`);
}

/** Platform gate. MyFatoorah Active + internal checks are enforced by the RPC. */
export async function adminSetMyFatoorahEligibility(formData: FormData) {
  const ctx = await requireAdmin();
  const vendorId = str(formData, 'vendor_id');
  const path = `/admin/vendors/${vendorId}`;
  if (!vendorId) back('/admin/vendors', 'Vendor not found.');

  const eligible = str(formData, 'eligible') === 'true';
  const { error } = await ctx.supabase.rpc('myfatoorah_supplier_set_eligibility', {
    p_vendor_id: vendorId,
    p_eligible: eligible,
    p_note: str(formData, 'note') || null,
  });
  if (error) back(path, error.message.replace(/_/g, ' '));
  revalidate(vendorId);
  redirect(`${path}?eligibility=1`);
}

// ---------------------------------------------------------------------------
// Enterprise partners use the identical supplier lifecycle.
// ---------------------------------------------------------------------------

/** Creates a supplier for a partner exactly once. */
export async function adminCreatePartnerSupplier(formData: FormData) {
  await requireAdmin();
  const partnerId = str(formData, 'partner_id');
  const path = `/admin/enterprise/${partnerId}`;
  if (!partnerId) back('/admin/enterprise', 'Partner not found.');

  const result = await callSupplierFunction('supplier-onboard', { partnerId });
  if (!result.ok) {
    back(
      path,
      result.skipped
        ? 'Supplier service is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the web app.'
        : (result.error ?? 'Supplier creation failed.'),
    );
  }
  revalidatePath(path);
  revalidatePath('/admin/merchant-onboarding');
  redirect(`${path}?supplier=1`);
}

/** Synchronises supplier statuses for vendors and partners alike. */
export async function adminSyncPartnerSuppliers(formData: FormData) {
  await requireAdmin();
  const partnerId = str(formData, 'partner_id');
  const path = partnerId ? `/admin/enterprise/${partnerId}` : '/admin/enterprise';

  const result = await callSupplierFunction('sync-myfatoorah-suppliers');
  if (!result.ok) {
    back(
      path,
      result.skipped
        ? 'Supplier service is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the web app.'
        : (result.error ?? 'Supplier sync failed.'),
    );
  }
  revalidate(path);
  redirect(`${path}?synced=1`);
}

/** Admin-only platform gate for a partner supplier. */
export async function adminSetPartnerPaymentEligibility(formData: FormData) {
  const ctx = await requireAdmin();
  const partnerId = str(formData, 'partner_id');
  const path = `/admin/enterprise/${partnerId}`;
  if (!partnerId) back('/admin/enterprise', 'Partner not found.');

  const { error } = await ctx.supabase.rpc('myfatoorah_partner_set_eligibility', {
    p_partner_id: partnerId,
    p_eligible: str(formData, 'eligible') === 'true',
    p_note: str(formData, 'note') || null,
  });
  if (error) back(path, error.message.replace(/_/g, ' '));
  revalidatePath(path);
  redirect(`${path}?eligibility=1`);
}

/** Retries a partner document submission after a provider failure. */
export async function adminResubmitPartnerDocument(formData: FormData) {
  await requireAdmin();
  const partnerId = str(formData, 'partner_id');
  const documentId = str(formData, 'document_id');
  const path = partnerId ? `/admin/enterprise/${partnerId}` : '/admin/merchant-onboarding';
  if (!documentId) back(path, 'Document not found.');

  const result = await callSupplierFunction('upload-supplier-document', { documentId });
  if (!result.ok && !result.skipped) back(path, result.error ?? 'Document submission failed.');
  revalidate(path);
  redirect(`${path}?document_submitted=1`);
}

/** Retries a document submission after a provider failure or replacement. */
export async function adminResubmitSupplierDocument(formData: FormData) {
  await requireAdmin();
  const vendorId = str(formData, 'vendor_id');
  const documentId = str(formData, 'document_id');
  const path = vendorId ? `/admin/vendors/${vendorId}` : '/admin/merchant-onboarding';
  if (!documentId) back(path, 'Document not found.');

  const result = await callSupplierFunction('upload-supplier-document', { documentId });
  if (!result.ok && !result.skipped) back(path, result.error ?? 'Document submission failed.');
  revalidate(vendorId);
  redirect(`${path}?document_submitted=1`);
}
