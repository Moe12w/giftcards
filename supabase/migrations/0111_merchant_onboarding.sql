-- 0111_merchant_onboarding.sql
--
-- Merchant onboarding for payment processing (MyFatoorah).
--
-- Two deliberately separate things live here:
--   1. Platform onboarding (vendors.status / vendor_applications / partner status)
--      already exists and is untouched.
--   2. This file adds the *payment processing* application: the MyFatoorah
--      merchant file, its documents, the signed processing agreement, and the
--      admin review trail.
--
-- A business can use its dashboard with (2) incomplete. Nothing in this file
-- gates dashboard access on the application being finished.
--
-- Security model:
--   * Every table has RLS enabled and no write policies. All writes go through
--     SECURITY DEFINER functions that re-check membership on every call.
--   * Documents live in the private `merchant-documents` bucket. There are no
--     storage policies for anon/authenticated, so only the service role (server
--     actions) can read or write them; users receive short-lived signed URLs.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.merchant_owner_type as enum ('vendor', 'partner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.merchant_application_status as enum (
    'not_started',
    'in_progress',
    'documents_required',
    'agreement_pending',
    'submitted',
    'under_review',
    'additional_information_required',
    'approved',
    'rejected',
    'active'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.merchant_document_status as enum (
    'pending_review',
    'approved',
    'rejected',
    'replacement_required'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Agreement versions (admin managed)
-- ---------------------------------------------------------------------------

create table if not exists public.merchant_agreements (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null default 0,
  content_sha256 text,
  is_active boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (version)
);

-- At most one active agreement at any time.
create unique index if not exists merchant_agreements_single_active
  on public.merchant_agreements ((is_active)) where is_active;

-- ---------------------------------------------------------------------------
-- Merchant (payment) applications
-- ---------------------------------------------------------------------------

create table if not exists public.merchant_applications (
  id uuid primary key default gen_random_uuid(),
  owner_type public.merchant_owner_type not null,
  vendor_id uuid references public.vendors(id) on delete cascade,
  partner_id uuid references public.enterprise_partners(id) on delete cascade,

  status public.merchant_application_status not null default 'not_started',
  step smallint not null default 1,

  -- Step 1: business and representative
  contact_name text,
  contact_role text,
  business_name text,
  business_email text,
  business_phone text,
  business_type text check (business_type is null or business_type in ('home', 'company')),
  cr_number text,
  activity_name text,
  activity_code text,

  -- Step 2: payment methods
  payment_methods text[] not null default '{}',

  -- Step 4: banking
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_iban text,
  bank_currency text not null default 'QAR',

  -- Step 5: agreement
  agreement_id uuid references public.merchant_agreements(id) on delete set null,
  agreement_signed_at timestamptz,

  -- Workflow
  submitted_at timestamptz,
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  decision_note text,
  activated_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint merchant_applications_owner_check check (
    (owner_type = 'vendor' and vendor_id is not null and partner_id is null)
    or (owner_type = 'partner' and partner_id is not null and vendor_id is null)
  )
);

create unique index if not exists merchant_applications_vendor_key
  on public.merchant_applications (vendor_id) where vendor_id is not null;
create unique index if not exists merchant_applications_partner_key
  on public.merchant_applications (partner_id) where partner_id is not null;
create index if not exists merchant_applications_status_idx
  on public.merchant_applications (status, updated_at desc);

-- ---------------------------------------------------------------------------
-- Application documents
-- ---------------------------------------------------------------------------

create table if not exists public.merchant_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.merchant_applications(id) on delete cascade,
  doc_type text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  status public.merchant_document_status not null default 'pending_review',
  rejection_reason text,
  uploaded_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, doc_type)
);

create index if not exists merchant_documents_application_idx
  on public.merchant_application_documents (application_id, doc_type);

-- ---------------------------------------------------------------------------
-- Signed agreements
-- ---------------------------------------------------------------------------

create table if not exists public.merchant_agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.merchant_applications(id) on delete cascade,
  agreement_id uuid not null references public.merchant_agreements(id) on delete restrict,
  agreement_version text not null,
  content_sha256 text,
  signatory_name text not null,
  signatory_role text not null,
  signature_method text not null default 'drawn',
  signature_data text not null,
  consent_text text not null,
  ip_address text,
  user_agent text,
  signed_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz not null default now(),
  unique (application_id, agreement_id)
);

create index if not exists merchant_signatures_application_idx
  on public.merchant_agreement_signatures (application_id, signed_at desc);

-- ---------------------------------------------------------------------------
-- Application history
-- ---------------------------------------------------------------------------

create table if not exists public.merchant_application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.merchant_applications(id) on delete cascade,
  kind text not null,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  created_at timestamptz not null default now()
);

create index if not exists merchant_events_application_idx
  on public.merchant_application_events (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Extra profile columns (business onboarding wizard)
-- ---------------------------------------------------------------------------

alter table public.vendors
  add column if not exists business_type text,
  add column if not exists intents text[] not null default '{}';

alter table public.vendor_applications
  add column if not exists business_type text,
  add column if not exists intents text[] not null default '{}';

alter table public.enterprise_partners
  add column if not exists legal_name text,
  add column if not exists contact_role text,
  add column if not exists company_size text,
  add column if not exists branches_count integer,
  add column if not exists country text not null default 'Qatar';

-- ---------------------------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------------------------

create or replace function public.merchant_application_can_view(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.merchant_applications a
    where a.id = p_application_id
      and (
        public.is_admin()
        or (a.vendor_id is not null and public.is_vendor_member(a.vendor_id))
        or (a.partner_id is not null and public.is_enterprise_member(a.partner_id))
      )
  );
$$;

create or replace function public.merchant_application_can_manage(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.merchant_applications a
    where a.id = p_application_id
      and (
        public.is_admin()
        or (a.vendor_id is not null and public.can_manage_vendor(a.vendor_id))
        or (a.partner_id is not null and public.can_manage_partner(a.partner_id))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Required document matrix
-- ---------------------------------------------------------------------------

create or replace function public.merchant_required_doc_types(p_business_type text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case
    when p_business_type = 'company' then array[
      'logo',
      'commercial_license',
      'commercial_register',
      'establishment_card',
      'owner_id_front',
      'owner_id_back',
      'manager_civil_id_front',
      'manager_civil_id_back',
      'bank_account_letter',
      'website_screenshot'
    ]::text[]
    else array[
      'logo',
      'commercial_license',
      'owner_id_front',
      'owner_id_back',
      'bank_account_letter',
      'website_screenshot'
    ]::text[]
  end;
$$;

-- ---------------------------------------------------------------------------
-- Notification helpers (reuse public.notifications)
-- ---------------------------------------------------------------------------

create or replace function public.merchant_notify_user(
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, kind, title_key, body_key, payload)
  values (p_user_id, p_kind, p_title, p_body, coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public.merchant_notify_admins(
  p_kind text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct uid from (
      select ur.user_id as uid from public.user_roles ur where ur.role = 'admin'
      union
      select p.id as uid from public.profiles p where p.is_admin = true
    ) admins
    where uid is not null
  loop
    perform public.merchant_notify_user(r.uid, p_kind, p_title, p_body, p_payload);
  end loop;
end;
$$;

create or replace function public.merchant_notify_application_owners(
  p_application_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  r record;
begin
  select * into a from public.merchant_applications where id = p_application_id;
  if not found then
    return;
  end if;

  if a.vendor_id is not null then
    for r in
      select user_id from public.vendor_members
      where vendor_id = a.vendor_id and active = true and role in ('owner', 'manager')
    loop
      perform public.merchant_notify_user(r.user_id, p_kind, p_title, p_body, p_payload);
    end loop;
  elsif a.partner_id is not null then
    for r in
      select user_id from public.enterprise_members
      where partner_id = a.partner_id and active = true and role in ('owner', 'manager')
    loop
      perform public.merchant_notify_user(r.user_id, p_kind, p_title, p_body, p_payload);
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Event log helper
-- ---------------------------------------------------------------------------

create or replace function public.merchant_log_event(
  p_application_id uuid,
  p_kind text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select ur.role::text into v_role from public.user_roles ur where ur.user_id = auth.uid();
  insert into public.merchant_application_events (application_id, kind, note, actor_id, actor_role)
  values (p_application_id, p_kind, p_note, auth.uid(), v_role);
end;
$$;

-- ---------------------------------------------------------------------------
-- Status refresh
-- ---------------------------------------------------------------------------
-- Recomputes the status for an application that has not been submitted yet.
-- Once an application is in the review pipeline the vendor can no longer move
-- it; only an admin decision changes it.

create or replace function public.merchant_refresh_status(p_application_id uuid)
returns public.merchant_application_status
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  v_required text[];
  v_have integer;
  v_next public.merchant_application_status;
begin
  select * into a from public.merchant_applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found';
  end if;

  if a.status in ('submitted', 'under_review', 'approved', 'rejected', 'active') then
    return a.status;
  end if;

  v_required := public.merchant_required_doc_types(a.business_type);

  select count(*) into v_have
  from public.merchant_application_documents d
  where d.application_id = a.id
    and d.doc_type = any (v_required)
    and d.status <> 'rejected';

  if a.contact_name is null or a.business_name is null or a.business_email is null
     or a.business_phone is null or a.business_type is null
     or (a.business_type = 'company' and a.cr_number is null) then
    v_next := (case when a.status = 'not_started' then 'not_started' else 'in_progress' end)::public.merchant_application_status;
  elsif v_have < coalesce(array_length(v_required, 1), 0) then
    v_next := 'documents_required';
  elsif a.agreement_signed_at is null then
    v_next := 'agreement_pending';
  else
    v_next := 'in_progress';
  end if;

  if v_next <> a.status then
    update public.merchant_applications
    set status = v_next, updated_at = now()
    where id = a.id;
  end if;

  return v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create / ensure an application
-- ---------------------------------------------------------------------------

create or replace function public.merchant_application_create(
  p_owner_type text,
  p_vendor_id uuid default null,
  p_partner_id uuid default null
)
returns public.merchant_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.merchant_applications;
  v_uid uuid := auth.uid();
begin
  if p_owner_type = 'vendor' then
    if p_vendor_id is null or not public.can_manage_vendor(p_vendor_id) then
      raise exception 'not_authorized';
    end if;
  elsif p_owner_type = 'partner' then
    if p_partner_id is null or not public.can_manage_partner(p_partner_id) then
      raise exception 'not_authorized';
    end if;
  else
    raise exception 'invalid_owner_type';
  end if;

  select * into a from public.merchant_applications
  where (p_owner_type = 'vendor' and vendor_id = p_vendor_id)
     or (p_owner_type = 'partner' and partner_id = p_partner_id)
  limit 1;

  if found then
    return a;
  end if;

  insert into public.merchant_applications (owner_type, vendor_id, partner_id, created_by)
  values (p_owner_type::public.merchant_owner_type, p_vendor_id, p_partner_id, v_uid)
  returning * into a;

  perform public.merchant_log_event(a.id, 'created', null);
  return a;
end;
$$;

-- ---------------------------------------------------------------------------
-- Save application fields (auto-save from the wizard)
-- ---------------------------------------------------------------------------

create or replace function public.merchant_application_save(
  p_application_id uuid,
  p_patch jsonb
)
returns public.merchant_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.merchant_applications;
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

  update public.merchant_applications
  set contact_name = coalesce(nullif(p_patch->>'contact_name', ''), contact_name),
      contact_role = coalesce(nullif(p_patch->>'contact_role', ''), contact_role),
      business_name = coalesce(nullif(p_patch->>'business_name', ''), business_name),
      business_email = coalesce(nullif(p_patch->>'business_email', ''), business_email),
      business_phone = coalesce(nullif(p_patch->>'business_phone', ''), business_phone),
      business_type = coalesce(nullif(p_patch->>'business_type', ''), business_type),
      cr_number = coalesce(nullif(p_patch->>'cr_number', ''), cr_number),
      activity_name = coalesce(nullif(p_patch->>'activity_name', ''), activity_name),
      activity_code = coalesce(nullif(p_patch->>'activity_code', ''), activity_code),
      bank_name = coalesce(nullif(p_patch->>'bank_name', ''), bank_name),
      bank_account_name = coalesce(nullif(p_patch->>'bank_account_name', ''), bank_account_name),
      bank_account_number = coalesce(nullif(p_patch->>'bank_account_number', ''), bank_account_number),
      bank_iban = coalesce(nullif(p_patch->>'bank_iban', ''), bank_iban),
      bank_currency = coalesce(nullif(p_patch->>'bank_currency', ''), bank_currency),
      payment_methods = case
        when p_patch ? 'payment_methods' and jsonb_typeof(p_patch->'payment_methods') = 'array'
          then array(select jsonb_array_elements_text(p_patch->'payment_methods'))
        else payment_methods
      end,
      step = greatest(step, coalesce((p_patch->>'step')::smallint, step)),
      updated_at = now()
  where id = a.id
  returning * into a;

  perform public.merchant_refresh_status(a.id);
  select * into a from public.merchant_applications where id = a.id;
  return a;
end;
$$;

-- ---------------------------------------------------------------------------
-- Documents: register / remove (the bytes are uploaded by the server action)
-- ---------------------------------------------------------------------------

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

create or replace function public.merchant_document_remove(
  p_document_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  select * into d from public.merchant_application_documents where id = p_document_id;
  if not found then
    raise exception 'document_not_found';
  end if;
  if not public.merchant_application_can_manage(d.application_id) then
    raise exception 'not_authorized';
  end if;

  delete from public.merchant_application_documents where id = p_document_id;
  perform public.merchant_refresh_status(d.application_id);
  perform public.merchant_log_event(d.application_id, 'document_removed', d.doc_type);
end;
$$;

-- ---------------------------------------------------------------------------
-- Agreement signing
-- ---------------------------------------------------------------------------

create or replace function public.merchant_agreement_sign(
  p_application_id uuid,
  p_signatory_name text,
  p_signatory_role text,
  p_signature_data text,
  p_consent_text text,
  p_ip_address text default null,
  p_user_agent text default null
)
returns public.merchant_agreement_signatures
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.merchant_applications;
  ag public.merchant_agreements;
  sig public.merchant_agreement_signatures;
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

  select * into ag from public.merchant_agreements where is_active = true;
  if not found then
    raise exception 'no_active_agreement';
  end if;

  if coalesce(trim(p_signatory_name), '') = '' or coalesce(trim(p_signatory_role), '') = '' then
    raise exception 'signatory_required';
  end if;
  if coalesce(p_signature_data, '') not like 'data:image/png;base64,%' then
    raise exception 'signature_required';
  end if;
  if coalesce(trim(p_consent_text), '') = '' then
    raise exception 'consent_required';
  end if;

  insert into public.merchant_agreement_signatures
    (application_id, agreement_id, agreement_version, content_sha256,
     signatory_name, signatory_role, signature_method, signature_data,
     consent_text, ip_address, user_agent, signed_by)
  values
    (p_application_id, ag.id, ag.version, ag.content_sha256,
     trim(p_signatory_name), trim(p_signatory_role), 'drawn', p_signature_data,
     p_consent_text, p_ip_address, p_user_agent, auth.uid())
  on conflict (application_id, agreement_id) do update
  set signatory_name = excluded.signatory_name,
      signatory_role = excluded.signatory_role,
      signature_data = excluded.signature_data,
      consent_text = excluded.consent_text,
      ip_address = excluded.ip_address,
      user_agent = excluded.user_agent,
      signed_by = excluded.signed_by,
      signed_at = now()
  returning * into sig;

  update public.merchant_applications
  set agreement_id = ag.id, agreement_signed_at = now(), updated_at = now()
  where id = p_application_id;

  perform public.merchant_refresh_status(p_application_id);
  perform public.merchant_log_event(p_application_id, 'agreement_signed', ag.version);
  perform public.write_audit(
    'merchant.agreement.sign', 'merchant_application', p_application_id::text, null,
    jsonb_build_object('agreement_version', ag.version, 'signatory_name', sig.signatory_name)
  );
  perform public.merchant_notify_admins(
    'merchant',
    'Payment agreement signed',
    'A merchant signed the payment processing agreement.',
    jsonb_build_object('application_id', p_application_id, 'agreement_version', ag.version)
  );

  return sig;
end;
$$;

-- ---------------------------------------------------------------------------
-- Submit for review
-- ---------------------------------------------------------------------------

create or replace function public.merchant_application_submit(p_application_id uuid)
returns public.merchant_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.merchant_applications;
  v_required text[];
  v_have integer;
begin
  if not public.merchant_application_can_manage(p_application_id) then
    raise exception 'not_authorized';
  end if;

  select * into a from public.merchant_applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found';
  end if;

  if a.status in ('submitted', 'under_review', 'approved', 'active') then
    -- Idempotent: never create a duplicate submission.
    return a;
  end if;

  if a.contact_name is null or a.business_name is null or a.business_email is null
     or a.business_phone is null or a.business_type is null
     or (a.business_type = 'company' and a.cr_number is null) then
    raise exception 'business_information_incomplete';
  end if;
  if coalesce(array_length(a.payment_methods, 1), 0) = 0 then
    raise exception 'payment_methods_required';
  end if;

  v_required := public.merchant_required_doc_types(a.business_type);
  select count(*) into v_have
  from public.merchant_application_documents d
  where d.application_id = a.id
    and d.doc_type = any (v_required)
    and d.status <> 'rejected';
  if v_have < coalesce(array_length(v_required, 1), 0) then
    raise exception 'documents_incomplete';
  end if;

  if a.bank_name is null or a.bank_account_name is null then
    raise exception 'banking_incomplete';
  end if;
  if a.agreement_signed_at is null then
    raise exception 'agreement_not_signed';
  end if;

  update public.merchant_applications
  set status = 'submitted',
      step = 6,
      submitted_at = now(),
      submitted_by = auth.uid(),
      updated_at = now()
  where id = a.id
  returning * into a;

  perform public.merchant_log_event(a.id, 'submitted', null);
  perform public.write_audit('merchant.application.submit', 'merchant_application', a.id::text, null, null);
  perform public.merchant_notify_application_owners(
    a.id,
    'merchant',
    'Payment application submitted',
    'We received your payment processing application and will review it shortly.',
    jsonb_build_object('application_id', a.id)
  );
  perform public.merchant_notify_admins(
    'merchant',
    'New payment application submitted',
    'A merchant submitted a payment processing application for review.',
    jsonb_build_object('application_id', a.id)
  );

  return a;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: document review
-- ---------------------------------------------------------------------------

create or replace function public.merchant_document_review(
  p_document_id uuid,
  p_status public.merchant_document_status,
  p_reason text default null
)
returns public.merchant_application_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.merchant_application_documents;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into d from public.merchant_application_documents where id = p_document_id for update;
  if not found then
    raise exception 'document_not_found';
  end if;

  if p_status in ('rejected', 'replacement_required') and coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required';
  end if;

  update public.merchant_application_documents
  set status = p_status,
      rejection_reason = case when p_status in ('rejected', 'replacement_required') then p_reason else null end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_document_id
  returning * into d;

  perform public.merchant_log_event(d.application_id, 'document_reviewed', d.doc_type || ':' || p_status::text);

  if p_status in ('rejected', 'replacement_required') then
    update public.merchant_applications
    set status = 'additional_information_required', updated_at = now()
    where id = d.application_id
      and status not in ('approved', 'active', 'rejected');

    perform public.merchant_notify_application_owners(
      d.application_id,
      'merchant',
      'A payment document needs replacing',
      'Please upload a replacement for ' || d.doc_type || '. Reason: ' || coalesce(p_reason, ''),
      jsonb_build_object('application_id', d.application_id, 'doc_type', d.doc_type)
    );
  end if;

  return d;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: application decision
-- ---------------------------------------------------------------------------

create or replace function public.merchant_application_review(
  p_application_id uuid,
  p_status public.merchant_application_status,
  p_note text default null
)
returns public.merchant_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.merchant_applications;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if p_status not in (
    'under_review', 'additional_information_required', 'approved', 'rejected', 'active'
  ) then
    raise exception 'invalid_status';
  end if;

  select * into a from public.merchant_applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found';
  end if;

  if p_status = 'rejected' and coalesce(trim(p_note), '') = '' then
    raise exception 'reason_required';
  end if;

  update public.merchant_applications
  set status = p_status,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      decision_note = coalesce(nullif(trim(p_note), ''), decision_note),
      activated_at = case when p_status = 'active' then now() else activated_at end,
      updated_at = now()
  where id = p_application_id
  returning * into a;

  perform public.merchant_log_event(p_application_id, 'status_' || p_status::text, p_note);
  perform public.write_audit(
    'merchant.application.' || p_status::text,
    'merchant_application',
    p_application_id::text,
    null,
    jsonb_build_object('note', p_note)
  );

  perform public.merchant_notify_application_owners(
    p_application_id,
    'merchant',
    case p_status
      when 'under_review' then 'Your payment application is under review'
      when 'additional_information_required' then 'More information is needed'
      when 'approved' then 'Your payment application was approved'
      when 'rejected' then 'Your payment application was not approved'
      else 'Your payments are active'
    end,
    coalesce(nullif(trim(p_note), ''), 'Open Online Payments to see the next step.'),
    jsonb_build_object('application_id', p_application_id, 'status', p_status::text)
  );

  return a;
end;
$$;

create or replace function public.merchant_application_note(
  p_application_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'note_required';
  end if;
  perform public.merchant_log_event(p_application_id, 'admin_note', p_note);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: agreement publishing
-- ---------------------------------------------------------------------------

create or replace function public.merchant_agreement_publish(
  p_version text,
  p_title text,
  p_storage_path text,
  p_file_name text,
  p_file_size bigint,
  p_content_sha256 text default null
)
returns public.merchant_agreements
language plpgsql
security definer
set search_path = public
as $$
declare
  ag public.merchant_agreements;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  if coalesce(trim(p_version), '') = '' or coalesce(trim(p_title), '') = '' then
    raise exception 'version_and_title_required';
  end if;
  if coalesce(trim(p_storage_path), '') = '' then
    raise exception 'file_required';
  end if;

  update public.merchant_agreements
  set is_active = false, deactivated_at = now()
  where is_active = true;

  insert into public.merchant_agreements
    (version, title, storage_path, file_name, file_size, content_sha256, is_active, uploaded_by)
  values
    (trim(p_version), trim(p_title), p_storage_path, p_file_name, coalesce(p_file_size, 0),
     p_content_sha256, true, auth.uid())
  on conflict (version) do update
  set title = excluded.title,
      storage_path = excluded.storage_path,
      file_name = excluded.file_name,
      file_size = excluded.file_size,
      content_sha256 = excluded.content_sha256,
      is_active = true,
      deactivated_at = null,
      uploaded_by = auth.uid()
  returning * into ag;

  perform public.write_audit(
    'merchant.agreement.publish', 'merchant_agreement', ag.id::text, null,
    jsonb_build_object('version', ag.version)
  );
  return ag;
end;
$$;

create or replace function public.merchant_agreement_deactivate(p_agreement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  update public.merchant_agreements
  set is_active = false, deactivated_at = now()
  where id = p_agreement_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.merchant_applications enable row level security;
alter table public.merchant_application_documents enable row level security;
alter table public.merchant_agreement_signatures enable row level security;
alter table public.merchant_application_events enable row level security;
alter table public.merchant_agreements enable row level security;

drop policy if exists merchant_applications_select on public.merchant_applications;
create policy merchant_applications_select on public.merchant_applications
  for select to authenticated
  using (public.merchant_application_can_view(id));

drop policy if exists merchant_documents_select on public.merchant_application_documents;
create policy merchant_documents_select on public.merchant_application_documents
  for select to authenticated
  using (public.merchant_application_can_view(application_id));

drop policy if exists merchant_signatures_select on public.merchant_agreement_signatures;
create policy merchant_signatures_select on public.merchant_agreement_signatures
  for select to authenticated
  using (public.merchant_application_can_view(application_id));

drop policy if exists merchant_events_select on public.merchant_application_events;
create policy merchant_events_select on public.merchant_application_events
  for select to authenticated
  using (public.merchant_application_can_view(application_id));

drop policy if exists merchant_agreements_select on public.merchant_agreements;
create policy merchant_agreements_select on public.merchant_agreements
  for select to authenticated
  using (is_active or public.is_admin());

-- No insert/update/delete policies: every write goes through the definer
-- functions above, which re-check membership and role.

grant select on public.merchant_applications to authenticated;
grant select on public.merchant_application_documents to authenticated;
grant select on public.merchant_agreement_signatures to authenticated;
grant select on public.merchant_application_events to authenticated;
grant select on public.merchant_agreements to authenticated;

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------

revoke all on function public.merchant_application_create(text, uuid, uuid) from public, anon;
revoke all on function public.merchant_application_save(uuid, jsonb) from public, anon;
revoke all on function public.merchant_document_register(uuid, text, text, text, text, bigint) from public, anon;
revoke all on function public.merchant_document_remove(uuid) from public, anon;
revoke all on function public.merchant_agreement_sign(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.merchant_application_submit(uuid) from public, anon;
revoke all on function public.merchant_document_review(uuid, public.merchant_document_status, text) from public, anon;
revoke all on function public.merchant_application_review(uuid, public.merchant_application_status, text) from public, anon;
revoke all on function public.merchant_application_note(uuid, text) from public, anon;
revoke all on function public.merchant_agreement_publish(text, text, text, text, bigint, text) from public, anon;
revoke all on function public.merchant_agreement_deactivate(uuid) from public, anon;

grant execute on function public.merchant_application_create(text, uuid, uuid) to authenticated;
grant execute on function public.merchant_application_save(uuid, jsonb) to authenticated;
grant execute on function public.merchant_document_register(uuid, text, text, text, text, bigint) to authenticated;
grant execute on function public.merchant_document_remove(uuid) to authenticated;
grant execute on function public.merchant_agreement_sign(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.merchant_application_submit(uuid) to authenticated;
grant execute on function public.merchant_document_review(uuid, public.merchant_document_status, text) to authenticated;
grant execute on function public.merchant_application_review(uuid, public.merchant_application_status, text) to authenticated;
grant execute on function public.merchant_application_note(uuid, text) to authenticated;
grant execute on function public.merchant_agreement_publish(text, text, text, text, bigint, text) to authenticated;
grant execute on function public.merchant_agreement_deactivate(uuid) to authenticated;

revoke all on function public.merchant_application_can_view(uuid) from public, anon;
revoke all on function public.merchant_application_can_manage(uuid) from public, anon;
grant execute on function public.merchant_application_can_view(uuid) to authenticated;
grant execute on function public.merchant_application_can_manage(uuid) to authenticated;

revoke all on function public.merchant_required_doc_types(text) from public, anon;
grant execute on function public.merchant_required_doc_types(text) to authenticated;

revoke all on function public.merchant_notify_user(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.merchant_notify_admins(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.merchant_notify_application_owners(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.merchant_log_event(uuid, text, text) from public, anon, authenticated;
revoke all on function public.merchant_refresh_status(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private document bucket
-- ---------------------------------------------------------------------------
-- 5 MB per file, as required by the MyFatoorah application form. PDFs and
-- images only. `public = false` plus no storage policies means the only way in
-- or out is a server action using the service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'merchant-documents',
  'merchant-documents',
  false,
  5242880,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists merchant_applications_touch on public.merchant_applications;
create trigger merchant_applications_touch
  before update on public.merchant_applications
  for each row execute function public.touch_updated_at();

drop trigger if exists merchant_documents_touch on public.merchant_application_documents;
create trigger merchant_documents_touch
  before update on public.merchant_application_documents
  for each row execute function public.touch_updated_at();
