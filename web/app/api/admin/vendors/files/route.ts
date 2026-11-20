import { NextResponse } from 'next/server';
import { zipSync } from 'fflate';

import { buildSignedAgreementPdf, resolveSignatureBox, safeFileName } from '@/lib/agreement-signature';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_FILES = 200;

type SignatureRow = {
  id: string;
  application_id: string;
  agreement_id: string;
  agreement_version: string;
  signatory_name: string;
  signatory_role: string | null;
  signature_data: string;
  signed_at: string;
};

type ApplicationRow = {
  id: string;
  vendor_id: string | null;
  vendor: { name: string; slug: string | null } | { name: string; slug: string | null }[] | null;
};

/**
 * Admin-only: zips every uploaded KYC document and stamped signed agreement
 * for one vendor (or all vendors) into a single download.
 */
export async function GET(request: Request) {
  await requireAdmin();
  const vendorId = new URL(request.url).searchParams.get('vendor');

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return new NextResponse('Storage unavailable', { status: 503 });
  }

  let appQuery = admin
    .from('merchant_applications')
    .select('id, vendor_id, vendor:vendors(name, slug)')
    .not('vendor_id', 'is', null);
  if (vendorId) appQuery = appQuery.eq('vendor_id', vendorId);
  const { data: applications, error: appError } = await appQuery.order('created_at', {
    ascending: false,
  });
  if (appError) return new NextResponse(appError.message, { status: 500 });

  const files: Record<string, Uint8Array> = {};
  const agreementPaths = new Map<string, string>();
  const signatures: (SignatureRow & { vendorName: string; vendorSlug: string })[] = [];

  for (const app of (applications ?? []) as ApplicationRow[]) {
    const vendor = Array.isArray(app.vendor) ? app.vendor[0] : app.vendor;
    const folder = safeFileName(vendor?.slug || vendor?.name || app.vendor_id || 'vendor');

    const { data: docs } = await admin
      .from('merchant_application_documents')
      .select('id, doc_type, storage_path, file_name')
      .eq('application_id', app.id);
    for (const doc of docs ?? []) {
      if (Object.keys(files).length >= MAX_FILES) break;
      const { data: blob } = await admin.storage
        .from('merchant-documents')
        .download(doc.storage_path);
      if (!blob) continue;
      const ext = doc.storage_path.split('.').pop()?.toLowerCase() || 'pdf';
      files[`${folder}/kyc-${safeFileName(doc.doc_type)}-${safeFileName(doc.id)}.${ext}`] =
        new Uint8Array(await blob.arrayBuffer());
    }

    const { data: publicDocs } = await admin
      .from('vendor_documents')
      .select('doc_type, file_url')
      .eq('vendor_id', app.vendor_id ?? '');
    for (const doc of publicDocs ?? []) {
      if (!doc.file_url || Object.keys(files).length >= MAX_FILES) continue;
      try {
        const response = await fetch(doc.file_url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) continue;
        files[`${folder}/upload-${safeFileName(doc.doc_type || 'document')}-${safeFileName(String(doc.file_url).slice(-12))}.pdf`] =
          new Uint8Array(await response.arrayBuffer());
      } catch {
        // A missing public file must not block the rest of the download.
      }
    }

    const { data: rows } = await admin
      .from('merchant_agreement_signatures')
      .select('*')
      .eq('application_id', app.id);
    for (const row of (rows ?? []) as SignatureRow[]) {
      signatures.push({
        ...row,
        vendorName: vendor?.name ?? 'Vendor',
        vendorSlug: folder,
      });
    }
  }

  if (signatures.length > 0) {
    const ids = [...new Set(signatures.map((row) => row.agreement_id))];
    const { data: agreements } = await admin
      .from('merchant_agreements')
      .select('id, storage_path')
      .in('id', ids);
    for (const agreement of agreements ?? []) {
      agreementPaths.set(agreement.id, agreement.storage_path);
    }

    const box = await resolveSignatureBox(admin);
    for (const signature of signatures) {
      if (Object.keys(files).length >= MAX_FILES) break;
      const storagePath = agreementPaths.get(signature.agreement_id);
      if (!storagePath) continue;
      const { data: blob } = await admin.storage
        .from('merchant-documents')
        .download(storagePath);
      if (!blob) continue;
      const pdf = await buildSignedAgreementPdf({
        basePdf: new Uint8Array(await blob.arrayBuffer()),
        signatureData: signature.signature_data,
        signatoryName: signature.signatory_name,
        signatoryRole: signature.signatory_role,
        signedAt: signature.signed_at,
        box,
      });
      files[
        `${signature.vendorSlug}/signed-agreement-${safeFileName(signature.agreement_version)}-${safeFileName(signature.signatory_name)}.pdf`
      ] = pdf;
    }
  }

  if (Object.keys(files).length === 0) {
    return new NextResponse('No files found', { status: 404 });
  }

  const zipped = zipSync(files, { level: 6 });
  const suffix = vendorId ? safeFileName(vendorId.slice(0, 8)) : 'all';
  const date = new Date().toISOString().slice(0, 10);
  return new Response(Buffer.from(zipped), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="giftly-vendor-files-${suffix}-${date}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
