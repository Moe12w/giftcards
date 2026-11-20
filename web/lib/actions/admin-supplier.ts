'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth';
import { callSupplierFunction } from '@/lib/myfatoorah-supplier';
import { str, back } from './_form';

type OwnerType = 'vendor' | 'partner';

function ownerContext(formData: FormData, owner: OwnerType) {
  const id = str(formData, `${owner}_id`);
  const base = owner === 'vendor' ? '/admin/vendors' : '/admin/enterprise';
  const path = id ? `${base}/${id}` : base;
  return { id, base, path, label: owner === 'vendor' ? 'Vendor' : 'Partner' };
}

function revalidateOwner(owner: OwnerType, id?: string) {
  const base = owner === 'vendor' ? '/admin/vendors' : '/admin/enterprise';
  revalidatePath(base);
  revalidatePath('/admin/merchant-onboarding');
  if (id) revalidatePath(`${base}/${id}`);
}

function providerError(result: { ok: boolean; skipped?: boolean; error?: string }, path: string, action: string): never {
  back(
    path,
    result.skipped
      ? 'Supplier service is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the web app.'
      : (result.error ?? `Supplier ${action} failed.`),
  );
}

async function createSupplier(formData: FormData, owner: OwnerType) {
  await requireAdmin();
  const { id, base, path, label } = ownerContext(formData, owner);
  if (!id) back(base, `${label} not found.`);

  const result = await callSupplierFunction('supplier-onboard', { [`${owner}Id`]: id });
  if (!result.ok) providerError(result, path, 'creation');
  revalidateOwner(owner, id);
  redirect(`${path}?supplier=1`);
}

async function syncSuppliers(formData: FormData, owner: OwnerType) {
  await requireAdmin();
  const { id, base, path } = ownerContext(formData, owner);

  const result = await callSupplierFunction('sync-myfatoorah-suppliers');
  if (!result.ok) providerError(result, path, 'sync');
  revalidateOwner(owner, id || undefined);
  redirect(`${path}?synced=1`);
}

async function setEligibility(formData: FormData, owner: OwnerType) {
  const ctx = await requireAdmin();
  const { id, base, path, label } = ownerContext(formData, owner);
  if (!id) back(base, `${label} not found.`);

  const { error } = await ctx.supabase.rpc(
    owner === 'vendor' ? 'myfatoorah_supplier_set_eligibility' : 'myfatoorah_partner_set_eligibility',
    owner === 'vendor'
      ? { p_vendor_id: id, p_eligible: str(formData, 'eligible') === 'true', p_note: str(formData, 'note') || null }
      : { p_partner_id: id, p_eligible: str(formData, 'eligible') === 'true', p_note: str(formData, 'note') || null },
  );
  if (error) back(path, error.message.replace(/_/g, ' '));
  revalidateOwner(owner, id);
  redirect(`${path}?eligibility=1`);
}

async function resubmitDocument(formData: FormData, owner: OwnerType) {
  await requireAdmin();
  const { id, path } = ownerContext(formData, owner);
  const documentId = str(formData, 'document_id');
  if (!documentId) back(path, 'Document not found.');

  const result = await callSupplierFunction('upload-supplier-document', { documentId });
  if (!result.ok && !result.skipped) back(path, result.error ?? 'Document submission failed.');
  revalidateOwner(owner, id || undefined);
  redirect(`${path}?document_submitted=1`);
}

/** Creates a supplier exactly once. Safe to press repeatedly. */
export async function adminCreateMyFatoorahSupplier(formData: FormData) {
  await createSupplier(formData, 'vendor');
}

/** Pulls real supplier statuses from MyFatoorah (GetSuppliers). */
export async function adminSyncMyFatoorahSuppliers(formData: FormData) {
  await syncSuppliers(formData, 'vendor');
}

/** Platform gate. MyFatoorah Active + internal checks are enforced by the RPC. */
export async function adminSetMyFatoorahEligibility(formData: FormData) {
  await setEligibility(formData, 'vendor');
}

/** Creates a supplier for a partner exactly once. */
export async function adminCreatePartnerSupplier(formData: FormData) {
  await createSupplier(formData, 'partner');
}

/** Synchronises supplier statuses for vendors and partners alike. */
export async function adminSyncPartnerSuppliers(formData: FormData) {
  await syncSuppliers(formData, 'partner');
}

/** Admin-only platform gate for a partner supplier. */
export async function adminSetPartnerPaymentEligibility(formData: FormData) {
  await setEligibility(formData, 'partner');
}

/** Retries a partner document submission after a provider failure. */
export async function adminResubmitPartnerDocument(formData: FormData) {
  await resubmitDocument(formData, 'partner');
}

/** Retries a document submission after a provider failure or replacement. */
export async function adminResubmitSupplierDocument(formData: FormData) {
  await resubmitDocument(formData, 'vendor');
}
