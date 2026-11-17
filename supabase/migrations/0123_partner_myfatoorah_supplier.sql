-- 0123_partner_myfatoorah_supplier.sql
--
-- Enterprise partners are treated exactly like vendors for payments:
--   own MyFatoorah SupplierCode, same document submission, same status sync,
--   same admin eligibility gate, same Suppliers[] invoice allocation.
--
-- Commission stays provider-managed: no ProposedShare / ProposedDepositShare
-- and no separate platform cut in the payment request.

alter table public.enterprise_partners
  add column if not exists myfatoorah_supplier_code text,
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

create unique index if not exists enterprise_partners_supplier_code_key
  on public.enterprise_partners (myfatoorah_supplier_code)
  where myfatoorah_supplier_code is not null;

-- ---------------------------------------------------------------------------
-- Write-through RPCs (service role only)
-- ---------------------------------------------------------------------------

create or replace function public.myfatoorah_partner_claim(p_partner_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.enterprise_partners;
begin
  perform set_config('mf.internal', '1', true);
  select * into p from public.enterprise_partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found'; end if;
  if p.myfatoorah_supplier_code is not null then return false; end if;
  if p.myfatoorah_creation_claimed_at is not null
     and p.myfatoorah_creation_claimed_at > now() - interval '10 minutes' then
    raise exception 'supplier_creation_in_progress';
  end if;
  update public.enterprise_partners
  set myfatoorah_creation_claimed_at = now(), myfatoorah_last_error = null
  where id = p_partner_id;
  return true;
end;
$$;

create or replace function public.myfatoorah_partner_created(
  p_partner_id uuid,
  p_supplier_code text,
  p_supplier_email text default null,
  p_provider_date text default null,
  p_raw jsonb default null
)
returns public.enterprise_partners
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.enterprise_partners;
  v_code text := nullif(btrim(coalesce(p_supplier_code, '')), '');
begin
  if v_code is null then raise exception 'supplier_code_required'; end if;
  perform set_config('mf.internal', '1', true);
  select * into p from public.enterprise_partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found'; end if;
  if p.myfatoorah_supplier_code is not null and p.myfatoorah_supplier_code <> v_code then
    raise exception 'supplier_code_conflict';
  end if;

  update public.enterprise_partners
  set myfatoorah_supplier_code = v_code,
      myfatoorah_supplier_status = coalesce(p.myfatoorah_supplier_status, 'Pending'),
      myfatoorah_supplier_created_at = coalesce(p.myfatoorah_supplier_created_at, now()),
      myfatoorah_supplier_email = coalesce(nullif(btrim(coalesce(p_supplier_email, '')), ''), p.myfatoorah_supplier_email),
      myfatoorah_last_error = null,
      myfatoorah_creation_claimed_at = null,
      myfatoorah_raw_supplier = coalesce(p_raw, p.myfatoorah_raw_supplier, '{}'::jsonb)
  where id = p_partner_id
  returning * into p;

  perform public.write_audit(
    'myfatoorah.partner_supplier.created', 'enterprise_partner', p_partner_id::text,
    null, jsonb_build_object('supplier_code', v_code, 'provider_date', p_provider_date)
  );
  return p;
end;
$$;

create or replace function public.myfatoorah_partner_failed(
  p_partner_id uuid,
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
  update public.enterprise_partners
  set myfatoorah_last_error = left(coalesce(p_error, 'supplier_creation_failed'), 1000),
      myfatoorah_creation_claimed_at = null
  where id = p_partner_id;
  perform public.write_audit(
    case when p_timeout then 'myfatoorah.partner_supplier.timeout' else 'myfatoorah.partner_supplier.failed' end,
    'enterprise_partner', p_partner_id::text, null,
    jsonb_build_object('error', left(coalesce(p_error, ''), 500))
  );
end;
$$;

create or replace function public.myfatoorah_partner_synced(
  p_partner_id uuid,
  p_status text,
  p_comment text default null,
  p_deposit_terms text default null,
  p_commission_percentage numeric default null,
  p_commission_value numeric default null,
  p_raw jsonb default null
)
returns public.enterprise_partners
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.enterprise_partners;
  v_status text := lower(btrim(coalesce(p_status, '')));
begin
  if v_status not in ('active', 'pending', 'rejected', 'closed', 'dormant') then
    raise exception 'invalid_supplier_status';
  end if;
  perform set_config('mf.internal', '1', true);
  select * into p from public.enterprise_partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found'; end if;
  if p.myfatoorah_supplier_code is null then raise exception 'partner_has_no_supplier'; end if;

  update public.enterprise_partners
  set myfatoorah_supplier_status = v_status,
      myfatoorah_rejection_comment = case when v_status = 'rejected' then p_comment else null end,
      myfatoorah_deposit_terms = coalesce(p_deposit_terms, p.myfatoorah_deposit_terms),
      myfatoorah_commission_percentage = coalesce(p_commission_percentage, p.myfatoorah_commission_percentage),
      myfatoorah_commission_value = coalesce(p_commission_value, p.myfatoorah_commission_value),
      myfatoorah_last_synced_at = now(),
      myfatoorah_last_error = null,
      myfatoorah_raw_supplier = coalesce(p_raw, p.myfatoorah_raw_supplier, '{}'::jsonb)
  where id = p_partner_id
  returning * into p;

  if v_status <> 'active' and p.payment_eligibility then
    update public.enterprise_partners
    set payment_eligibility = false,
        payment_eligibility_note = 'Automatically disabled: MyFatoorah supplier is not Active.',
        payment_eligibility_at = now()
    where id = p_partner_id
    returning * into p;
  end if;

  perform public.write_audit(
    'myfatoorah.partner_supplier.synced', 'enterprise_partner', p_partner_id::text, null,
    jsonb_build_object('status', v_status, 'comment', left(coalesce(p_comment, ''), 500))
  );
  return p;
end;
$$;

/** Admin gate: active partner + Active supplier + approved application + docs. */
create or replace function public.myfatoorah_partner_set_eligibility(
  p_partner_id uuid,
  p_eligible boolean,
  p_note text default null
)
returns public.enterprise_partners
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.enterprise_partners;
  a public.merchant_applications;
  v_required text[];
  v_approved integer;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  select * into p from public.enterprise_partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found'; end if;

  if p_eligible then
    if p.status <> 'active' then raise exception 'partner_not_active'; end if;
    if p.myfatoorah_supplier_code is null
       or lower(coalesce(p.myfatoorah_supplier_status, '')) <> 'active' then
      raise exception 'supplier_not_active';
    end if;
    select * into a from public.merchant_applications
    where partner_id = p_partner_id order by created_at desc limit 1;
    if not found or a.status not in ('approved', 'active') then
      raise exception 'application_not_approved';
    end if;
    if a.bank_name is null or a.bank_account_name is null then
      raise exception 'banking_incomplete';
    end if;
    v_required := public.merchant_required_doc_types(a.business_type);
    select count(*) into v_approved
    from public.merchant_application_documents
    where application_id = a.id and doc_type = any (v_required) and status = 'approved';
    if v_approved < coalesce(array_length(v_required, 1), 0) then
      raise exception 'documents_not_approved';
    end if;
  end if;

  perform set_config('mf.internal', '1', true);
  update public.enterprise_partners
  set payment_eligibility = p_eligible,
      payment_eligibility_note = nullif(btrim(coalesce(p_note, '')), ''),
      payment_eligibility_at = now(),
      payment_eligibility_by = auth.uid()
  where id = p_partner_id
  returning * into p;
  perform set_config('mf.internal', '', true);

  perform public.write_audit(
    case when p_eligible then 'myfatoorah.partner_eligibility.enabled' else 'myfatoorah.partner_eligibility.disabled' end,
    'enterprise_partner', p_partner_id::text, null,
    jsonb_build_object('note', p_note)
  );
  return p;
end;
$$;

-- Prevent direct client writes to provider-owned fields.
create or replace function public.myfatoorah_protect_partner_fields()
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

drop trigger if exists enterprise_partners_myfatoorah_protect on public.enterprise_partners;
create trigger enterprise_partners_myfatoorah_protect
  before update on public.enterprise_partners
  for each row execute function public.myfatoorah_protect_partner_fields();

-- Permissions
revoke all on function public.myfatoorah_partner_claim(uuid) from public, anon, authenticated;
revoke all on function public.myfatoorah_partner_created(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.myfatoorah_partner_failed(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.myfatoorah_partner_synced(uuid, text, text, text, numeric, numeric, jsonb) from public, anon, authenticated;

grant execute on function public.myfatoorah_partner_claim(uuid) to service_role;
grant execute on function public.myfatoorah_partner_created(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.myfatoorah_partner_failed(uuid, text, boolean) to service_role;
grant execute on function public.myfatoorah_partner_synced(uuid, text, text, text, numeric, numeric, jsonb) to service_role;

revoke all on function public.myfatoorah_partner_set_eligibility(uuid, boolean, text) from public, anon;
grant execute on function public.myfatoorah_partner_set_eligibility(uuid, boolean, text) to authenticated;
