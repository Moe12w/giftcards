import { NextResponse } from 'next/server';

import { apiAdmin, apiUser } from '@/lib/api-auth';

/**
 * Serves a payment-processing agreement PDF. Active agreements are readable by
 * any signed-in business; older versions only by admins (they remain preserved
 * for audit but are not offered for signing).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = await apiUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const { data: agreement } = await supabase
    .from('merchant_agreements')
    .select('id, storage_path, is_active')
    .eq('id', id)
    .maybeSingle();

  if (!agreement) return new NextResponse('Not found', { status: 404 });

  if (!agreement.is_active) {
    // A merchant may still download the exact version they signed, even after a
    // newer version has been published. RLS limits the signature lookup to
    // applications the caller can view, so this leaks nothing.
    const { data: signature } = await supabase
      .from('merchant_agreement_signatures')
      .select('id')
      .eq('agreement_id', id)
      .limit(1)
      .maybeSingle();

    if (!signature) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      const isAdmin = Boolean(profile?.is_admin) || role?.role === 'admin';
      if (!isAdmin) return new NextResponse('Not found', { status: 404 });
    }
  }

  const adminResult = apiAdmin();
  if (!adminResult.ok) return adminResult.response;

  const { data: signed, error } = await adminResult.admin.storage
    .from('merchant-documents')
    .createSignedUrl(agreement.storage_path, 120);

  if (error || !signed?.signedUrl) {
    return new NextResponse('Agreement unavailable', { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
