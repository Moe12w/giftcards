-- 0121_vendor_settlements.sql
--
-- Manual settlement records for the provider-managed MyFatoorah deposit
-- arrangement. A settlement moves money that is already in the vendor ledger;
-- it must therefore never create a second earnings entry.
--
-- Writes go through an admin-only SECURITY DEFINER RPC. The table is
-- select-only under RLS.

create table if not exists public.vendor_settlements (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  supplier_code text,
  settlement_reference text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'QAR',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  settlement_date timestamptz,
  notes text,
  provider_response jsonb default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vendor_settlements_reference_key
  on public.vendor_settlements (settlement_reference);

create index if not exists vendor_settlements_vendor_date_idx
  on public.vendor_settlements (vendor_id, settlement_date desc);

drop trigger if exists vendor_settlements_touch on public.vendor_settlements;
create trigger vendor_settlements_touch
  before update on public.vendor_settlements
  for each row execute function public.touch_updated_at();

alter table public.vendor_settlements enable row level security;

drop policy if exists vendor_settlements_select on public.vendor_settlements;
create policy vendor_settlements_select on public.vendor_settlements
  for select to authenticated using (
    public.is_admin() or public.is_vendor_member(vendor_id)
  );

grant select on public.vendor_settlements to authenticated;

-- Admin writes only. Idempotent on the provider/bank reference.
create or replace function public.admin_record_vendor_settlement(
  p_vendor_id uuid,
  p_settlement_reference text,
  p_amount_minor bigint,
  p_status text default 'pending',
  p_settlement_date timestamptz default null,
  p_supplier_code text default null,
  p_notes text default null,
  p_provider_response jsonb default null
)
returns public.vendor_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.vendor_settlements;
  v_status text := lower(btrim(coalesce(p_status, 'pending')));
  v_ref text := nullif(btrim(coalesce(p_settlement_reference, '')), '');
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  if v_ref is null then raise exception 'settlement_reference_required'; end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_settlement_amount';
  end if;
  if v_status not in ('pending', 'completed', 'failed') then
    raise exception 'invalid_settlement_status';
  end if;
  if not exists (select 1 from public.vendors where id = p_vendor_id) then
    raise exception 'vendor_not_found';
  end if;

  insert into public.vendor_settlements
    (vendor_id, settlement_reference, amount_minor, status, settlement_date,
     supplier_code, notes, provider_response, created_by)
  values
    (p_vendor_id, v_ref, p_amount_minor, v_status,
     coalesce(p_settlement_date, case when v_status = 'completed' then now() else null end),
     nullif(btrim(coalesce(p_supplier_code, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''),
     coalesce(p_provider_response, '{}'::jsonb), auth.uid())
  on conflict (settlement_reference) do update
  set amount_minor = excluded.amount_minor,
      status = excluded.status,
      settlement_date = excluded.settlement_date,
      supplier_code = excluded.supplier_code,
      notes = excluded.notes,
      provider_response = excluded.provider_response,
      updated_at = now()
  returning * into s;

  perform public.write_audit(
    'myfatoorah.settlement.recorded', 'vendor', p_vendor_id::text, null,
    jsonb_build_object(
      'reference', v_ref,
      'amount_minor', p_amount_minor,
      'status', v_status
    )
  );
  return s;
end;
$$;

revoke all on function public.admin_record_vendor_settlement(uuid, text, bigint, text, timestamptz, text, text, jsonb)
  from public, anon;
grant execute on function public.admin_record_vendor_settlement(uuid, text, bigint, text, timestamptz, text, text, jsonb)
  to authenticated;
