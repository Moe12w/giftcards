import { NextResponse } from 'next/server';

import { buildSignedAgreementPdf, resolveSignatureBox, safeFileName } from '@/lib/agreement-signature';
import { apiAdmin, apiUser } from '@/lib/api-auth';

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

/** Delivers the agreement with the signatory's drawn signature stamped on page 6. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const signatureId = new URL(request.url).searchParams.get('signature');

  const auth = await apiUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const adminResult = apiAdmin();
  if (!adminResult.ok) return adminResult.response;
  const { admin } = adminResult;

  const { data: adminCheck } = await supabase.rpc('is_admin');
  const isAdmin = adminCheck === true;

  const { data: agreement } = await admin
    .from('merchant_agreements')
    .select('id, storage_path, version, is_active')
    .eq('id', id)
    .maybeSingle();
  if (!agreement) return new NextResponse('Not found', { status: 404 });

  let signature: SignatureRow | null = null;
  if (signatureId) {
    const { data } = await admin
      .from('merchant_agreement_signatures')
      .select('*')
      .eq('id', signatureId)
      .eq('agreement_id', id)
      .maybeSingle();
    signature = (data as SignatureRow | null) ?? null;
  } else {
    const { data: rows } = await admin
      .from('merchant_agreement_signatures')
      .select('*')
      .eq('agreement_id', id)
      .order('signed_at', { ascending: false });
    for (const row of (rows ?? []) as SignatureRow[]) {
      const { data: canView } = await supabase.rpc('merchant_application_can_view', {
        p_application_id: row.application_id,
      });
      if (canView === true) {
        signature = row;
        break;
      }
    }
  }
  if (!signature) return new NextResponse('Not found', { status: 404 });

  if (!isAdmin) {
    const { data: canView } = await supabase.rpc('merchant_application_can_view', {
      p_application_id: signature.application_id,
    });
    if (canView !== true) return new NextResponse('Not found', { status: 404 });
  }

  const { data: file, error } = await admin.storage
    .from('merchant-documents')
    .download(agreement.storage_path);
  if (error || !file) return new NextResponse('Agreement unavailable', { status: 404 });

  const box = await resolveSignatureBox(admin);
  const pdf = await buildSignedAgreementPdf({
    basePdf: new Uint8Array(await file.arrayBuffer()),
    signatureData: signature.signature_data,
    signatoryName: signature.signatory_name,
    signatoryRole: signature.signatory_role,
    signedAt: signature.signed_at,
    box,
  });

  const name = `signed-agreement-${safeFileName(agreement.version)}-${safeFileName(signature.signatory_name)}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
