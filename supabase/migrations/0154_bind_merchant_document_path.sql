-- 0154_bind_merchant_document_path.sql
-- Security fix: merchant_document_register accepted an arbitrary p_storage_path.
-- A merchant could register a document row on their own application pointing at
-- another tenant's private KYC object, and the signed-URL route (which checks
-- can_view on the application, not the object) would sign that key with the
-- service role. Bind the path to the application's own tenant folder.

create or replace function public.merchant_document_register(
  p_application_id uuid,
  p_doc_type text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns public.merchant_application_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.merchant_application_documents;
  a public.merchant_applications;
  v_previous text;
  v_prefix text;
  v_remainder text;
begin
  if not public.merchant_application_can_manage(p_application_id) then
    raise exception 'not_authorized';
  end if;

  select * into a from public.merchant_applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found';
  end if;
  if a.status in ('submitted', 'under_review', 'approved', 'active') then
    raise exception 'application_locked';
  end if;

  if p_doc_type is null or p_doc_type = '' then
    raise exception 'invalid_doc_type';
  end if;
  if not (p_doc_type = any (public.merchant_required_doc_types(a.business_type))) then
    raise exception 'unexpected_doc_type';
  end if;

  -- The storage key must live in this application's own tenant folder and be a
  -- single filename segment. The web action builds exactly this shape.
  v_prefix := a.owner_type || '/' || coalesce(a.vendor_id::text, a.partner_id::text, 'unknown') || '/' || p_application_id::text || '/';
  if p_storage_path is null or not starts_with(p_storage_path, v_prefix) then
    raise exception 'invalid_storage_path';
  end if;
  v_remainder := substr(p_storage_path, length(v_prefix) + 1);
  if v_remainder = ''
     or position('/' in v_remainder) > 0
     or position(chr(92) in v_remainder) > 0
     or position('..' in v_remainder) > 0 then
    raise exception 'invalid_storage_path';
  end if;

  select storage_path into v_previous
  from public.merchant_application_documents
  where application_id = p_application_id and doc_type = p_doc_type;

  insert into public.merchant_application_documents
    (application_id, doc_type, storage_path, file_name, mime_type, size_bytes,
     status, rejection_reason, uploaded_by)
  values
    (p_application_id, p_doc_type, p_storage_path, p_file_name, p_mime_type, p_size_bytes,
     'pending_review', null, auth.uid())
  on conflict (application_id, doc_type) do update
  set storage_path = excluded.storage_path,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      status = 'pending_review',
      rejection_reason = null,
      uploaded_by = auth.uid(),
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  returning * into d;

  perform public.merchant_refresh_status(p_application_id);
  perform public.merchant_log_event(p_application_id, 'document_uploaded', p_doc_type);
  perform public.merchant_notify_admins(
    'merchant',
    'New payment document uploaded',
    'A merchant uploaded or replaced a document for review.',
    jsonb_build_object('application_id', p_application_id, 'doc_type', p_doc_type)
  );

  return d;
end;
$$;
