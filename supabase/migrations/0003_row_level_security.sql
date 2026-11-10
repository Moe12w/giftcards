-- 0003_row_level_security.sql
-- Every table has RLS. Customers see only their own rows; vendors see only
-- their own vendor's rows; only admins change vendor status.

-- Prevent non-admins from granting themselves admin.
create or replace function public.guard_profile_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    raise exception 'only admins may change admin role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_admin on public.profiles;
create trigger profiles_guard_admin
  before update on public.profiles
  for each row execute function public.guard_profile_admin();

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------------
alter table public.vendors enable row level security;

drop policy if exists vendors_select on public.vendors;
create policy vendors_select on public.vendors
  for select using (
    status = 'approved'
    or owner_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists vendors_insert_own on public.vendors;
create policy vendors_insert_own on public.vendors
  for insert with check (owner_id = auth.uid());

drop policy if exists vendors_update_own on public.vendors;
create policy vendors_update_own on public.vendors
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- vendor_documents
-- ---------------------------------------------------------------------------
alter table public.vendor_documents enable row level security;

drop policy if exists vendor_documents_select on public.vendor_documents;
create policy vendor_documents_select on public.vendor_documents
  for select using (
    vendor_id = public.current_vendor_id() or public.is_admin()
  );

drop policy if exists vendor_documents_insert on public.vendor_documents;
create policy vendor_documents_insert on public.vendor_documents
  for insert with check (vendor_id = public.current_vendor_id());

drop policy if exists vendor_documents_update_admin on public.vendor_documents;
create policy vendor_documents_update_admin on public.vendor_documents
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists vendor_documents_delete on public.vendor_documents;
create policy vendor_documents_delete on public.vendor_documents
  for delete using (vendor_id = public.current_vendor_id() or public.is_admin());

-- ---------------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------------
alter table public.offers enable row level security;

drop policy if exists offers_select_public on public.offers;
create policy offers_select_public on public.offers
  for select using (
    (
      is_active
      and exists (
        select 1 from public.vendors v
        where v.id = offers.vendor_id and v.status = 'approved'
      )
    )
    or vendor_id = public.current_vendor_id()
    or public.is_admin()
  );

drop policy if exists offers_insert_vendor on public.offers;
create policy offers_insert_vendor on public.offers
  for insert with check (vendor_id = public.current_vendor_id());

drop policy if exists offers_update_vendor on public.offers;
create policy offers_update_vendor on public.offers
  for update using (vendor_id = public.current_vendor_id() or public.is_admin())
  with check (vendor_id = public.current_vendor_id() or public.is_admin());

drop policy if exists offers_delete_vendor on public.offers;
create policy offers_delete_vendor on public.offers
  for delete using (vendor_id = public.current_vendor_id() or public.is_admin());

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (
    buyer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.offers o
      where o.id = orders.offer_id and o.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists orders_insert_buyer on public.orders;
create policy orders_insert_buyer on public.orders
  for insert with check (buyer_id = auth.uid());

-- Status changes (paid/refunded) come from the payment webhook via the
-- service role, which bypasses RLS. Clients cannot update orders.

-- ---------------------------------------------------------------------------
-- gift_cards
-- ---------------------------------------------------------------------------
alter table public.gift_cards enable row level security;

drop policy if exists gift_cards_select on public.gift_cards;
create policy gift_cards_select on public.gift_cards
  for select using (
    buyer_id = auth.uid()
    or claimed_by = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.offers o
      where o.id = gift_cards.offer_id and o.vendor_id = public.current_vendor_id()
    )
  );

-- Cards are issued only by the payment webhook (service role) through
-- public.issue_gift_card(). No client insert/update policies.

-- ---------------------------------------------------------------------------
-- ledger_entries
-- ---------------------------------------------------------------------------
alter table public.ledger_entries enable row level security;

drop policy if exists ledger_entries_select on public.ledger_entries;
create policy ledger_entries_select on public.ledger_entries
  for select using (
    exists (
      select 1 from public.gift_cards c
      where c.id = ledger_entries.card_id
        and (
          c.buyer_id = auth.uid()
          or c.claimed_by = auth.uid()
          or public.is_admin()
          or exists (
            select 1 from public.offers o
            where o.id = c.offer_id and o.vendor_id = public.current_vendor_id()
          )
        )
    )
  );

-- No insert/update/delete policies: writes happen only inside security-definer
-- functions. The append-only trigger also blocks update/delete.

-- ---------------------------------------------------------------------------
-- payouts
-- ---------------------------------------------------------------------------
alter table public.payouts enable row level security;

drop policy if exists payouts_select on public.payouts;
create policy payouts_select on public.payouts
  for select using (
    vendor_id = public.current_vendor_id() or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- payment_events
-- ---------------------------------------------------------------------------
alter table public.payment_events enable row level security;

drop policy if exists payment_events_select_admin on public.payment_events;
create policy payment_events_select_admin on public.payment_events
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- admin_actions
-- ---------------------------------------------------------------------------
alter table public.admin_actions enable row level security;

drop policy if exists admin_actions_select_admin on public.admin_actions;
create policy admin_actions_select_admin on public.admin_actions
  for select using (public.is_admin());

-- Inserts happen through public.record_admin_action().

-- ---------------------------------------------------------------------------
-- claim_attempts (server-only)
-- ---------------------------------------------------------------------------
alter table public.claim_attempts enable row level security;
