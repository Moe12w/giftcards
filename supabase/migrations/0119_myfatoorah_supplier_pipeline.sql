-- 0119_myfatoorah_supplier_pipeline.sql
--
-- Phase 1 of the MyFatoorah multi-vendor integration.
--
-- Connects the merchant-onboarding application we already have to the live
-- MyFatoorah supplier lifecycle:
--   1. a permanent SupplierCode on the vendor record, with a provider status;
--   2. document FileType mapping and submission receipts on the existing
--      merchant_application_documents table (internal review stays separate);
--   3. status synchronization from GetSuppliers;
--   4. an admin-controlled payment-eligibility switch.
--
-- Financial model: provider-managed commission only. We never send
-- ProposedShare / ProposedDepositShare and never invent or deduct a platform
-- commission. Provider commission values returned by MyFatoorah are recorded
-- for reporting only.
--
-- All writes go through SECURITY DEFINER RPCs. Merchant tables keep their
-- select-only RLS policies; vendor supplier fields are protected from direct
-- updates by a trigger.

-- ---------------------------------------------------------------------------
-- Vendor supplier profile (extends the existing vendor record)
-- ---------------------------------------------------------------------------

alter table public.vendors
  add column if not exists myfatoorah_supplier_status text,
  add column if not exists myfatoorah_supplier_created_at timestamptz,
  add column if not exists myfatoorah_supplier_email text,
  add column if not exists myfatoorah_last_synced_at timestamptz,
  add column if not exists myfatoorah_last_error text,
  add column if not exists myfatoorah_rejection_comment text,
  add column if not exists myfatoorah_deposit_terms text,
  add column if not exists myfatoorah_commission_percentage numeric(10, 4),
  add column if not exists myfatoorah_commission_value numeric(12, 2),
  add column if not exists myfatoorah_raw_supplier jsonb default '{}'::jsonb,
  add column if not exists myfatoorah_creation_claimed_at timestamptz,
  add column if not exists payment_eligibility boolean not null default false,
  add column if not exists payment_eligibility_note text,
  add column if not exists payment_eligibility_at timestamptz,
  add column if not exists payment_eligibility_by uuid;

-- One MyFatoorah supplier is permanently linked to exactly one vendor.
create unique index if not exists vendors_myfatoorah_supplier_code_key
  on public.vendors (myfatoorah_supplier_code)
  where myfatoorah_supplier_code is not null;

create index if not exists vendors_myfatoorah_supplier_status_idx
  on public.vendors (myfatoorah_supplier_status);

-- ---------------------------------------------------------------------------
-- Document submission receipts on the existing document table
-- ---------------------------------------------------------------------------

alter table public.merchant_application_documents
  add column if not exists myfatoorah_file_type integer,
  add column if not exists provider_submission_status text not null default 'not_submitted',
  add column if not exists provider_submitted_at timestamptz,
  add column if not exists provider_fingerprint text,
  add column if not exists provider_response jsonb,
  add column if not exists provider_document_status text,
  add column if not exists provider_last_error text,
  add column if not exists provider_attempts integer not null default 0;

create index if not exists merchant_documents_provider_status_idx
  on public.merchant_application_documents (provider_submission_status);

-- ---------------------------------------------------------------------------
-- Internal document type -> documented MyFatoorah FileType.
-- 1 Civil Id, 2 Commercial License, 5 Others, 6 Civil Id Back,
-- 17 Civil Id of Manager, 20 Commercial Register, 21 Bank Account Letter,
-- 25 Website. Types without a dedicated provider value use 5 (Others).
-- ---------------------------------------------------------------------------

create or replace function public.myfatoorah_file_type(p_doc_type text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_doc_type
    when 'owner_id_front' then 1
    when 'commercial_license' then 2
    when 'establishment_card' then 5
    when 'logo' then 5
    when 'owner_id_back' then 6
    when 'manager_civil_id_back' then 5
    when 'manager_civil_id_front' then 17
    when 'commercial_register' then 20
    when 'bank_account_letter' then 21
    when 'website_screenshot' then 25
    else 5
  end;
$$;

-- ---------------------------------------------------------------------------
-- Write-through RPCs (service role only unless stated otherwise)
-- ---------------------------------------------------------------------------

/** Reserve the right to create a supplier. Returns false if one already exists. */
create or replace function public.myfatoorah_supplier_claim(p_vendor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vendors;
begin
  perform set_config('mf.internal', '1', true);
  select * into v from public.vendors where id = p_vendor_id for update;
  if not found then
    raise exception 'vendor_not_found';
  end if;
  if v.myfatoorah_supplier_code is not null then
    return false;
  end if;
  if v.myfatoorah_creation_claimed_at is not null
     and v.myfatoorah_creation_claimed_at > now() - interval '10 minutes' then
    raise exception 'supplier_creation_in_progress';
  end if;

  update public.vendors
  set myfatoorah_creation_claimed_at = now(),
      myfatoorah_last_error = null
  where id = p_vendor_id;
  return true;
end;
$$;

/** Store a newly created SupplierCode. Never overwrite a different code. */
create or replace function public.myfatoorah_supplier_created(
  p_vendor_id uuid,
  p_supplier_code text,
  p_supplier_email text default null,
  p_provider_date text default null,
  p_raw jsonb default null
)
returns public.vendors
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vendors;
  v_code text := nullif(btrim(coalesce(p_supplier_code, '')), '');
begin
  if v_code is null then
    raise exception 'supplier_code_required';
  end if;

  perform set_config('mf.internal', '1', true);
  select * into v from public.vendors where id = p_vendor_id for update;
  if not found then
    raise exception 'vendor_not_found';
  end if;

  if v.myfatoorah_supplier_code is not null
     and v.myfatoorah_supplier_code <> v_code then
    raise exception 'supplier_code_conflict';
  end if;

  update public.vendors
  set myfatoorah_supplier_code = v_code,
      myfatoorah_supplier_status = coalesce(v.myfatoorah_supplier_status, 'Pending'),
      myfatoorah_supplier_created_at = coalesce(v.myfatoorah_supplier_created_at, now()),
      myfatoorah_supplier_email = coalesce(nullif(btrim(coalesce(p_supplier_email, '')), ''), v.myfatoorah_supplier_email),
      myfatoorah_last_error = null,
      myfatoorah_creation_claimed_at = null,
      myfatoorah_raw_supplier = coalesce(p_raw, v.myfatoorah_raw_supplier, '{}'::jsonb),
      updated_at = now()
  where id = p_vendor_id
  returning * into v;

  perform public.write_audit(
    'myfatoorah.supplier.created', 'vendor', p_vendor_id::text,
    null, jsonb_build_object('supplier_code', v_code, 'provider_date', p_provider_date)
  );
  return v;
end;
$$;

/** Record a failed (including timed-out) supplier creation attempt. */
create or replace function public.myfatoorah_supplier_failed(
  p_vendor_id uuid,
  p_error text,
  p_timeout boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('mf.internal', '1', true);
  update public.vendors
  set myfatoorah_last_error = left(coalesce(p_error, 'supplier_creation_failed'), 1000),
      myfatoorah_creation_claimed_at = null
  where id = p_vendor_id;

  perform public.write_audit(
    case when p_timeout then 'myfatoorah.supplier.timeout' else 'myfatoorah.supplier.failed' end,
    'vendor', p_vendor_id::text, null,
    jsonb_build_object('error', left(coalesce(p_error, ''), 500))
  );
end;
$$;

/** Apply a supplier status from GetSuppliers or the KYC webhook. */
create or replace function public.myfatoorah_supplier_synced(
  p_vendor_id uuid,
  p_status text,
  p_comment text default null,
  p_deposit_terms text default null,
  p_commission_percentage numeric default null,
  p_commission_value numeric default null,
  p_raw jsonb default null
)
returns public.vendors
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vendors;
  v_status text := lower(btrim(coalesce(p_status, '')));
begin
  if v_status not in ('active', 'pending', 'rejected', 'closed', 'dormant') then
    raise exception 'invalid_supplier_status';
  end if;

  perform set_config('mf.internal', '1', true);
  select * into v from public.vendors where id = p_vendor_id for update;
  if not found then
    raise exception 'vendor_not_found';
  end if;
  if v.myfatoorah_supplier_code is null then
    raise exception 'vendor_has_no_supplier';
  end if;

  update public.vendors
  set myfatoorah_supplier_status = v_status,
      myfatoorah_rejection_comment = case when v_status = 'rejected' then p_comment else null end,
      myfatoorah_deposit_terms = coalesce(p_deposit_terms, v.myfatoorah_deposit_terms),
      myfatoorah_commission_percentage = coalesce(p_commission_percentage, v.myfatoorah_commission_percentage),
      myfatoorah_commission_value = coalesce(p_commission_value, v.myfatoorah_commission_value),
      myfatoorah_last_synced_at = now(),
      myfatoorah_last_error = null,
      myfatoorah_raw_supplier = coalesce(p_raw, v.myfatoorah_raw_supplier, '{}'::jsonb),
      updated_at = now()
  where id = p_vendor_id
  returning * into v;

  -- An inactive supplier must never remain eligible for live payments.
  if v_status <> 'active' and v.payment_eligibility then
    update public.vendors
    set payment_eligibility = false,
        payment_eligibility_note = 'Automatically disabled: MyFatoorah supplier is not Active.',
        payment_eligibility_at = now()
    where id = p_vendor_id
    returning * into v;
  end if;

  perform public.write_audit(
    'myfatoorah.supplier.synced', 'vendor', p_vendor_id::text, null,
    jsonb_build_object('status', v_status, 'comment', left(coalesce(p_comment, ''), 500))
  );
  return v;
end;
$$;

/** Record an accepted document submission. Submission is NOT KYC approval. */
create or replace function public.myfatoorah_document_submitted(
  p_document_id uuid,
  p_file_type integer,
  p_fingerprint text,
  p_response jsonb default null
)
returns public.merchant_application_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.merchant_application_documents;
begin
  select * into d from public.merchant_application_documents where id = p_document_id for update;
  if not found then
    raise exception 'document_not_found';
  end if;
  if p_file_type is null or p_file_type < 1 then
    raise exception 'invalid_file_type';
  end if;

  if d.provider_submission_status = 'submitted'
     and d.provider_fingerprint = p_fingerprint then
    return d; -- identical bytes were already submitted: no duplicate upload
  end if;

  update public.merchant_application_documents
  set myfatoorah_file_type = p_file_type,
      provider_submission_status = 'submitted',
      provider_submitted_at = now(),
      provider_fingerprint = p_fingerprint,
      provider_response = coalesce(p_response, d.provider_response),
      provider_last_error = null,
      provider_document_status = null
  where id = p_document_id
  returning * into d;

  perform public.write_audit(
    'myfatoorah.document.submitted', 'merchant_document', p_document_id::text,
    null, jsonb_build_object('file_type', p_file_type, 'application_id', d.application_id)
  );
  return d;
end;
$$;

/** Record a rejected submission attempt, keeping the internal review untouched. */
create or replace function public.myfatoorah_document_submission_failed(
  p_document_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.merchant_application_documents
  set provider_submission_status = 'failed',
      provider_last_error = left(coalesce(p_error, 'document_upload_failed'), 1000),
      provider_attempts = provider_attempts + 1
  where id = p_document_id;
end;
$$;

/**
 * Admin-controlled platform gate. Enabling requires a real Active supplier,
 * an approved/active application, complete banking and all required documents
 * approved internally. Disabling is always allowed (suspension).
 */
create or replace function public.myfatoorah_supplier_set_eligibility(
  p_vendor_id uuid,
  p_eligible boolean,
  p_note text default null
)
returns public.vendors
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vendors;
  a public.merchant_applications;
  v_required text[];
  v_approved integer;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v from public.vendors where id = p_vendor_id for update;
  if not found then
    raise exception 'vendor_not_found';
  end if;

  if p_eligible then
    if v.myfatoorah_supplier_code is null
       or lower(coalesce(v.myfatoorah_supplier_status, '')) <> 'active' then
      raise exception 'supplier_not_active';
    end if;
    select * into a from public.merchant_applications
    where vendor_id = p_vendor_id order by created_at desc limit 1;
    if not found or a.status not in ('approved', 'active') then
      raise exception 'application_not_approved';
    end if;
    if a.bank_name is null or a.bank_account_name is null then
      raise exception 'banking_incomplete';
    end if;
    v_required := public.merchant_required_doc_types(a.business_type);
    select count(*) into v_approved
    from public.merchant_application_documents
    where application_id = a.id
      and doc_type = any (v_required)
      and status = 'approved';
    if v_approved < coalesce(array_length(v_required, 1), 0) then
      raise exception 'documents_not_approved';
    end if;
  end if;

  perform set_config('mf.internal', '1', true);
  update public.vendors
  set payment_eligibility = p_eligible,
      payment_eligibility_note = nullif(btrim(coalesce(p_note, '')), ''),
      payment_eligibility_at = now(),
      payment_eligibility_by = auth.uid()
  where id = p_vendor_id
  returning * into v;
  perform set_config('mf.internal', '', true);

  perform public.write_audit(
    case when p_eligible then 'myfatoorah.eligibility.enabled' else 'myfatoorah.eligibility.disabled' end,
    'vendor', p_vendor_id::text, null,
    jsonb_build_object('note', p_note)
  );
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Protect provider-owned fields from direct client writes.
-- ---------------------------------------------------------------------------

create or replace function public.myfatoorah_protect_vendor_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('mf.internal', true) = '1'
     or current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;

  if new.myfatoorah_supplier_code is distinct from old.myfatoorah_supplier_code
     or new.myfatoorah_supplier_status is distinct from old.myfatoorah_supplier_status
     or new.myfatoorah_supplier_created_at is distinct from old.myfatoorah_supplier_created_at
     or new.myfatoorah_supplier_email is distinct from old.myfatoorah_supplier_email
     or new.myfatoorah_last_synced_at is distinct from old.myfatoorah_last_synced_at
     or new.myfatoorah_last_error is distinct from old.myfatoorah_last_error
     or new.myfatoorah_rejection_comment is distinct from old.myfatoorah_rejection_comment
     or new.myfatoorah_deposit_terms is distinct from old.myfatoorah_deposit_terms
     or new.myfatoorah_commission_percentage is distinct from old.myfatoorah_commission_percentage
     or new.myfatoorah_commission_value is distinct from old.myfatoorah_commission_value
     or new.myfatoorah_raw_supplier is distinct from old.myfatoorah_raw_supplier
     or new.myfatoorah_creation_claimed_at is distinct from old.myfatoorah_creation_claimed_at
     or new.payment_eligibility is distinct from old.payment_eligibility
     or new.payment_eligibility_note is distinct from old.payment_eligibility_note
     or new.payment_eligibility_at is distinct from old.payment_eligibility_at
     or new.payment_eligibility_by is distinct from old.payment_eligibility_by then
    raise exception 'myfatoorah_fields_are_read_only';
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_myfatoorah_protect on public.vendors;
create trigger vendors_myfatoorah_protect
  before update on public.vendors
  for each row execute function public.myfatoorah_protect_vendor_fields();

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

revoke all on function public.myfatoorah_supplier_claim(uuid) from public, anon, authenticated;
revoke all on function public.myfatoorah_supplier_created(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.myfatoorah_supplier_failed(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.myfatoorah_supplier_synced(uuid, text, text, text, numeric, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.myfatoorah_document_submitted(uuid, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.myfatoorah_document_submission_failed(uuid, text) from public, anon, authenticated;

grant execute on function public.myfatoorah_supplier_claim(uuid) to service_role;
grant execute on function public.myfatoorah_supplier_created(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.myfatoorah_supplier_failed(uuid, text, boolean) to service_role;
grant execute on function public.myfatoorah_supplier_synced(uuid, text, text, text, numeric, numeric, jsonb) to service_role;
grant execute on function public.myfatoorah_document_submitted(uuid, integer, text, jsonb) to service_role;
grant execute on function public.myfatoorah_document_submission_failed(uuid, text) to service_role;

revoke all on function public.myfatoorah_supplier_set_eligibility(uuid, boolean, text) from public, anon;
grant execute on function public.myfatoorah_supplier_set_eligibility(uuid, boolean, text) to authenticated;

revoke all on function public.myfatoorah_file_type(text) from public, anon;
grant execute on function public.myfatoorah_file_type(text) to authenticated;
