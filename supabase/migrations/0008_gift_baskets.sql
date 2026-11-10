-- 0008_gift_baskets.sql
-- Collaborative gift baskets: a shared basket of gift cards that several
-- people contribute to. Money stays in bigint minor units. Every table has
-- RLS, realtime is enabled for live updates, and invite codes resolve through
-- a narrow security-definer function so a shared link can preview a basket.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.basket_status as enum ('open', 'ready', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.basket_activity_kind as enum (
    'created', 'joined', 'item_added', 'ready', 'completed'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- gift_baskets
-- ---------------------------------------------------------------------------
create table if not exists public.gift_baskets (
  id uuid primary key default gen_random_uuid(),
  -- Invite code, e.g. GIFT-8F3K2. Unique so a link always identifies one basket.
  code text not null unique check (code ~ '^GIFT-[A-Z0-9]{5}$'),
  name text not null,
  recipient_name text not null,
  occasion text not null default 'birthday',
  creator_id uuid not null references public.profiles (id) on delete cascade,
  creator_name text not null,
  target_minor bigint not null default 0 check (target_minor >= 0),
  status public.basket_status not null default 'open',
  note text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists gift_baskets_creator_idx on public.gift_baskets (creator_id);
create index if not exists gift_baskets_status_idx on public.gift_baskets (status);

-- ---------------------------------------------------------------------------
-- gift_basket_participants
-- ---------------------------------------------------------------------------
create table if not exists public.gift_basket_participants (
  basket_id uuid not null references public.gift_baskets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  is_owner boolean not null default false,
  tone text not null default 'teal' check (tone in ('teal', 'pink', 'lavender', 'gold')),
  joined_at timestamptz not null default now(),
  primary key (basket_id, user_id)
);

create index if not exists gift_basket_participants_user_idx
  on public.gift_basket_participants (user_id);

-- ---------------------------------------------------------------------------
-- gift_basket_items (the vouchers inside the basket)
-- ---------------------------------------------------------------------------
create table if not exists public.gift_basket_items (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references public.gift_baskets (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  vendor_name text not null,
  title text not null,
  amount_minor bigint not null check (amount_minor > 0),
  emoji text,
  tone text check (tone in ('teal', 'pink', 'lavender', 'gold', 'sky')),
  logo_url text,
  banner_url text,
  -- Attribution is mandatory: every card belongs to the person who added it.
  added_by uuid not null references public.profiles (id) on delete restrict,
  added_by_name text not null,
  added_at timestamptz not null default now()
);

create index if not exists gift_basket_items_basket_idx
  on public.gift_basket_items (basket_id);
create index if not exists gift_basket_items_added_by_idx
  on public.gift_basket_items (added_by);

-- ---------------------------------------------------------------------------
-- gift_basket_activity (live feed)
-- ---------------------------------------------------------------------------
create table if not exists public.gift_basket_activity (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references public.gift_baskets (id) on delete cascade,
  kind public.basket_activity_kind not null,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null,
  item_title text,
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  created_at timestamptz not null default now()
);

create index if not exists gift_basket_activity_basket_idx
  on public.gift_basket_activity (basket_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers (security definer avoids recursive RLS checks)
-- ---------------------------------------------------------------------------
create or replace function public.is_basket_participant(p_basket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gift_basket_participants p
    where p.basket_id = p_basket_id and p.user_id = auth.uid()
  );
$$;

create or replace function public.basket_is_open(p_basket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gift_baskets b
    where b.id = p_basket_id and b.status = 'open'
  );
$$;

revoke all on function public.is_basket_participant(uuid) from public;
revoke all on function public.basket_is_open(uuid) from public;
grant execute on function public.is_basket_participant(uuid) to authenticated;
grant execute on function public.basket_is_open(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Creator automatically becomes the first participant and owner.
-- ---------------------------------------------------------------------------
create or replace function public.add_basket_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.gift_basket_participants (basket_id, user_id, name, is_owner)
  values (new.id, new.creator_id, new.creator_name, true)
  on conflict (basket_id, user_id) do nothing;

  insert into public.gift_basket_activity (basket_id, kind, actor_id, actor_name)
  values (new.id, 'created', new.creator_id, new.creator_name);

  return new;
end;
$$;

drop trigger if exists gift_baskets_add_owner on public.gift_baskets;
create trigger gift_baskets_add_owner
  after insert on public.gift_baskets
  for each row execute function public.add_basket_owner();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.gift_baskets enable row level security;
alter table public.gift_basket_participants enable row level security;
alter table public.gift_basket_items enable row level security;
alter table public.gift_basket_activity enable row level security;

-- Baskets: visible to the creator and everyone who joined.
drop policy if exists gift_baskets_select on public.gift_baskets;
create policy gift_baskets_select on public.gift_baskets
  for select using (
    creator_id = auth.uid()
    or public.is_basket_participant(id)
    or public.is_admin()
  );

drop policy if exists gift_baskets_insert on public.gift_baskets;
create policy gift_baskets_insert on public.gift_baskets
  for insert with check (creator_id = auth.uid());

drop policy if exists gift_baskets_update_owner on public.gift_baskets;
create policy gift_baskets_update_owner on public.gift_baskets
  for update using (creator_id = auth.uid() or public.is_admin())
  with check (creator_id = auth.uid() or public.is_admin());

drop policy if exists gift_baskets_delete_owner on public.gift_baskets;
create policy gift_baskets_delete_owner on public.gift_baskets
  for delete using (creator_id = auth.uid() or public.is_admin());

-- Participants: visible to the whole basket; users may only add themselves.
drop policy if exists gift_basket_participants_select on public.gift_basket_participants;
create policy gift_basket_participants_select on public.gift_basket_participants
  for select using (
    public.is_basket_participant(basket_id)
    or exists (
      select 1 from public.gift_baskets b
      where b.id = basket_id and b.creator_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists gift_basket_participants_insert_self on public.gift_basket_participants;
create policy gift_basket_participants_insert_self on public.gift_basket_participants
  for insert with check (
    user_id = auth.uid() and public.basket_is_open(basket_id)
  );

drop policy if exists gift_basket_participants_delete on public.gift_basket_participants;
create policy gift_basket_participants_delete on public.gift_basket_participants
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.gift_baskets b
      where b.id = basket_id and b.creator_id = auth.uid()
    )
    or public.is_admin()
  );

-- Items: only participants contribute, and only while the basket is open.
drop policy if exists gift_basket_items_select on public.gift_basket_items;
create policy gift_basket_items_select on public.gift_basket_items
  for select using (
    public.is_basket_participant(basket_id) or public.is_admin()
  );

drop policy if exists gift_basket_items_insert on public.gift_basket_items;
create policy gift_basket_items_insert on public.gift_basket_items
  for insert with check (
    added_by = auth.uid()
    and public.is_basket_participant(basket_id)
    and public.basket_is_open(basket_id)
  );

drop policy if exists gift_basket_items_delete on public.gift_basket_items;
create policy gift_basket_items_delete on public.gift_basket_items
  for delete using (
    added_by = auth.uid()
    or exists (
      select 1 from public.gift_baskets b
      where b.id = basket_id and b.creator_id = auth.uid()
    )
    or public.is_admin()
  );

-- Activity: readable by participants, appended by the acting participant.
drop policy if exists gift_basket_activity_select on public.gift_basket_activity;
create policy gift_basket_activity_select on public.gift_basket_activity
  for select using (
    public.is_basket_participant(basket_id) or public.is_admin()
  );

drop policy if exists gift_basket_activity_insert on public.gift_basket_activity;
create policy gift_basket_activity_insert on public.gift_basket_activity
  for insert with check (
    actor_id = auth.uid() and public.is_basket_participant(basket_id)
  );

-- ---------------------------------------------------------------------------
-- Invite lookup. Anyone holding the code can preview the basket before joining.
-- Returns the basket with its items, participants and recent activity as JSON.
-- ---------------------------------------------------------------------------
create or replace function public.get_basket_by_code(p_code text)
returns table (
  id uuid,
  code text,
  name text,
  recipient_name text,
  occasion text,
  creator_id uuid,
  creator_name text,
  target_minor bigint,
  status public.basket_status,
  note text,
  created_at timestamptz,
  completed_at timestamptz,
  items jsonb,
  participants jsonb,
  activity jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.code,
    b.name,
    b.recipient_name,
    b.occasion,
    b.creator_id,
    b.creator_name,
    b.target_minor,
    b.status,
    b.note,
    b.created_at,
    b.completed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'offer_id', i.offer_id,
        'vendor_id', i.vendor_id,
        'vendor_name', i.vendor_name,
        'title', i.title,
        'amount_minor', i.amount_minor,
        'emoji', i.emoji,
        'tone', i.tone,
        'logo_url', i.logo_url,
        'banner_url', i.banner_url,
        'added_by_id', i.added_by,
        'added_by_name', i.added_by_name,
        'added_at', i.added_at
      ) order by i.added_at)
      from public.gift_basket_items i
      where i.basket_id = b.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.user_id,
        'name', p.name,
        'is_owner', p.is_owner,
        'joined_at', p.joined_at,
        'tone', p.tone
      ) order by p.joined_at)
      from public.gift_basket_participants p
      where p.basket_id = b.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'kind', a.kind,
        'actor_name', a.actor_name,
        'item_title', a.item_title,
        'amount_minor', a.amount_minor,
        'created_at', a.created_at
      ) order by a.created_at desc)
      from (
        select * from public.gift_basket_activity x
        where x.basket_id = b.id
        order by x.created_at desc
        limit 20
      ) a
    ), '[]'::jsonb)
  from public.gift_baskets b
  where upper(b.code) = upper(trim(p_code));
$$;

revoke all on function public.get_basket_by_code(text) from public;
grant execute on function public.get_basket_by_code(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: broadcast basket changes so every participant sees them live.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.gift_baskets;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.gift_basket_items;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.gift_basket_participants;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.gift_basket_activity;
    exception when duplicate_object then null; end;
  end if;
end $$;
