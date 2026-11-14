-- 0054_support_tickets.sql
-- Support tickets from every surface.
--
-- 1. `support_requests.customer_id` only referenced `auth.users`, so PostgREST
--    could not embed the submitter's profile (`profiles(...)`) and the admin
--    support page failed with:
--      "Could not find a relationship between 'support_requests' and 'profiles'"
--    A second foreign key to `public.profiles` fixes the embed. The row is
--    still tied to the auth user, so deleting an account keeps the ticket and
--    clears the reference.
--
-- 2. The original `kind` check only allowed the five customer kinds, but the
--    public website inserts `enterprise_enquiry` and `launch_list`, so those
--    submissions were rejected. The constraint is widened to every kind the
--    platform actually writes.
--
-- 3. Tickets can now come from a vendor, an enterprise partner, a business
--    (bulk buyer) or a signed-out visitor, and each ticket records which
--    organisation it came from so the admin can triage it.

-- ---------------------------------------------------------------------------
-- 1. Let PostgREST embed the submitter's profile
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_requests_customer_profile_fkey'
      and conrelid = 'public.support_requests'::regclass
  ) then
    alter table public.support_requests
      add constraint support_requests_customer_profile_fkey
      foreign key (customer_id) references public.profiles (id)
      on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Every kind the platform writes
-- ---------------------------------------------------------------------------
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.support_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.support_requests drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.support_requests
  add constraint support_requests_kind_check
  check (
    kind in (
      'contact',
      'support',
      'report',
      'report_gift',
      'refund',
      'chat',
      'enterprise_enquiry',
      'launch_list'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Who opened the ticket, and for which organisation
-- ---------------------------------------------------------------------------
alter table public.support_requests
  add column if not exists requester_kind text not null default 'customer';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_requests_requester_kind_check'
      and conrelid = 'public.support_requests'::regclass
  ) then
    alter table public.support_requests
      add constraint support_requests_requester_kind_check
      check (requester_kind in ('customer', 'vendor', 'enterprise', 'business', 'admin', 'visitor'));
  end if;
end $$;

alter table public.support_requests
  add column if not exists organization_name text;

alter table public.support_requests
  add column if not exists organization_id uuid;

-- Rows that predate the column, and the website forms that have no account.
update public.support_requests
set requester_kind = 'visitor'
where customer_id is null
  and requester_kind = 'customer';

update public.support_requests
set requester_kind = 'visitor'
where kind in ('enterprise_enquiry', 'launch_list');

-- ---------------------------------------------------------------------------
-- 4. Indexes for the admin inbox
-- ---------------------------------------------------------------------------
create index if not exists support_requests_status_idx
  on public.support_requests (status, created_at desc);

create index if not exists support_requests_requester_idx
  on public.support_requests (requester_kind, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Tell PostgREST to pick up the new relationship immediately
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
