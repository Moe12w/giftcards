import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

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

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return new NextResponse('Storage unavailable', { status: 503 });
  }

  const { data: signed, error } = await admin.storage
    .from('merchant-documents')
    .createSignedUrl(document.storage_path, 120);

  if (error || !signed?.signedUrl) {
    return new NextResponse('Document unavailable', { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
