import { NextResponse } from 'next/server';

import { apiAdmin, apiUser } from '@/lib/api-auth';

/**
 * Streams a merchant KYC document to an authorised viewer through a
 * two-minute signed URL. The bucket is private and has no storage policies, so
 * this route is the only way a browser can reach the bytes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = await apiUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { data: document } = await supabase
    .from('merchant_application_documents')
    .select('id, application_id, storage_path')
    .eq('id', id)
    .maybeSingle();

  if (!document) return new NextResponse('Not found', { status: 404 });

  const { data: canView } = await supabase.rpc('merchant_application_can_view', {
    p_application_id: document.application_id,
  });
  if (canView !== true) return new NextResponse('Not found', { status: 404 });

  // Authorize the object as well as the application: a stored path outside the
  // application's own tenant folder must never be signed by the service role.
  const { data: application } = await supabase
    .from('merchant_applications')
    .select('owner_type, vendor_id, partner_id')
    .eq('id', document.application_id)
    .maybeSingle();
  const expectedPrefix = application
    ? `${application.owner_type}/${application.vendor_id ?? application.partner_id ?? 'unknown'}/${document.application_id}/`
    : null;
  if (!expectedPrefix || !document.storage_path.startsWith(expectedPrefix)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const adminResult = apiAdmin();
  if (!adminResult.ok) return adminResult.response;

  const { data: signed, error } = await adminResult.admin.storage
    .from('merchant-documents')
    .createSignedUrl(document.storage_path, 120);

  if (error || !signed?.signedUrl) {
    return new NextResponse('Document unavailable', { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
