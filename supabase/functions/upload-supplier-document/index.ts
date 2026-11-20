// supabase/functions/upload-supplier-document/index.ts
// Submits one stored merchant document to MyFatoorah with the documented
// FileType. The file bytes always come from our private bucket via the service
// role; the browser never sees a public URL.
//
// x-internal-key: <SUPABASE_SERVICE_ROLE_KEY>
// { documentId }
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { logProviderError, uploadSupplierDocument } from '../_shared/myfatoorah.ts';

const BUCKET = 'merchant-documents';
const MAX_BYTES = 5 * 1024 * 1024;

// Mirrors public.myfatoorah_file_type in migration 0119.
const FILE_TYPES: Record<string, number> = {
  owner_id_front: 16, // Civil Ids Of All Owners
  owner_id_back: 16,
  commercial_license: 2,
  establishment_card: 4, // Signature Authorization
  logo: 5,
  manager_civil_id_back: 17, // Civil Id Of Manager
  manager_civil_id_front: 17,
  commercial_register: 20,
  bank_account_letter: 21,
  website_screenshot: 25,
  three_parties_contract: 26, // 3-parties contract/ agreement
};

// MyFatoorah's documented upload formats. WebP is accepted by our bucket but
// not by the provider, so it is rejected here with an actionable error.
const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

function internalRequest(req: Request): boolean {
  const expected = Deno.env.get('INTERNAL_API_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const provided = req.headers.get('x-internal-key') ?? '';
  return Boolean(expected && provided && provided === expected);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!internalRequest(req)) return json({ error: 'unauthorized' }, 401);

  try {
    const body = (await req.json()) as { documentId?: string };
    const documentId = String(body.documentId ?? '').trim();
    if (!documentId) return json({ error: 'invalid_request' }, 400);

    const admin = adminClient();

    const { data: document, error: documentError } = await admin
      .from('merchant_application_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!document) return json({ error: 'document_not_found' }, 404);

    const { data: application, error: applicationError } = await admin
      .from('merchant_applications')
      .select('vendor_id, partner_id')
      .eq('id', document.application_id)
      .maybeSingle();
    if (applicationError) throw applicationError;
    if (!application) return json({ error: 'application_not_found' }, 404);

    let supplierCode: string | null = null;
    if (application.vendor_id) {
      const { data: vendor, error: vendorError } = await admin
        .from('vendors')
        .select('myfatoorah_supplier_code')
        .eq('id', application.vendor_id)
        .maybeSingle();
      if (vendorError) throw vendorError;
      supplierCode = vendor?.myfatoorah_supplier_code ?? null;
    } else if (application.partner_id) {
      const { data: partner, error: partnerError } = await admin
        .from('enterprise_partners')
        .select('myfatoorah_supplier_code')
        .eq('id', application.partner_id)
        .maybeSingle();
      if (partnerError) throw partnerError;
      supplierCode = partner?.myfatoorah_supplier_code ?? null;
    }
    if (!supplierCode) {
      return json({ error: 'supplier_not_ready' }, 409);
    }

    const fileType = FILE_TYPES[document.doc_type] ?? 5;
    const fingerprint = `${document.storage_path}:${document.size_bytes}:${document.updated_at}`;
    if (document.provider_submission_status === 'submitted' && document.provider_fingerprint === fingerprint) {
      return json({ submitted: false, status: 'already_submitted', documentId });
    }

    const mime = String(document.mime_type ?? '').toLowerCase();
    const extension = ALLOWED_MIME[mime];
    if (!extension) {
      const detail = 'unsupported_provider_format: MyFatoorah accepts PDF, PNG and JPG for these documents.';
      await admin.rpc('myfatoorah_document_submission_failed', { p_document_id: documentId, p_error: detail });
      return json({ error: detail, retryable: true }, 400);
    }

    const size = Number(document.size_bytes ?? 0);
    if (!size || size > MAX_BYTES) {
      const detail = 'invalid_document_size';
      await admin.rpc('myfatoorah_document_submission_failed', { p_document_id: documentId, p_error: detail });
      return json({ error: detail }, 400);
    }

    const { data: file, error: downloadError } = await admin.storage
      .from(BUCKET)
      .download(document.storage_path);
    if (downloadError || !file) {
      throw downloadError ?? new Error('document_download_failed');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      const detail = 'invalid_document_size';
      await admin.rpc('myfatoorah_document_submission_failed', { p_document_id: documentId, p_error: detail });
      return json({ error: detail }, 400);
    }

    const fileName = String(document.file_name || `${document.doc_type}.${extension}`)
      .replace(/[^\w.\- ]/g, '_')
      .slice(0, 120);

    try {
      const response = await uploadSupplierDocument({
        FileName: fileName,
        MediaType: mime,
        Buffer: bytes,
        FileType: fileType,
        SupplierCode: Number(supplierCode),
      });

      // A success response confirms SUBMISSION only, never KYC approval.
      const { data: saved, error: saveError } = await admin.rpc('myfatoorah_document_submitted', {
        p_document_id: documentId,
        p_file_type: fileType,
        p_fingerprint: fingerprint,
        p_response: { message: String(response?.Message ?? ''), at: new Date().toISOString() },
      });
      if (saveError) throw saveError;

      return json({
        submitted: true,
        status: 'submitted',
        documentId,
        fileType,
        providerStatus: saved?.provider_document_status ?? null,
      });
    } catch (error) {
      logProviderError('upload-supplier-document failed', error);
      const detail = error instanceof Error ? error.message : 'document_upload_failed';
      await admin.rpc('myfatoorah_document_submission_failed', {
        p_document_id: documentId,
        p_error: detail,
      });
      return json({ error: detail, retryable: true }, 502);
    }
  } catch (error) {
    logProviderError('upload-supplier-document crashed', error);
    return json({ error: 'server_error' }, 500);
  }
});
