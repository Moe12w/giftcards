-- 0169_gift_cover_and_media.sql
-- Gift covers and sender media used to live only in the phone's draft: the
-- recipient saw the written message but never the card art. This migration
-- gives the art a home on the server:
--
--   * two storage buckets — gift covers (admin managed) and gift media
--     (uploaded by the sender), both public because a claim link is a bearer
--     link and the preview is deliberately public;
--   * a gift_covers catalogue so admins can add cover art by uploading an
--     image instead of shipping new code;
--   * gift_cover_id / gift_wrapping / gift_media columns on orders' items and
--     vouchers, copied by myfatoorah_fulfill_order and exposed by claim_preview.
--
-- Idempotent: every statement is additive or uses if-not-exists / drop-if-exists.

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gift-covers',
  'gift-covers',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gift-media',
  'gift-media',
  true,
  26214400,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/x-m4a'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Covers and gift media are meant to be seen by whoever holds a claim link,
-- so reads are public. Writes are restricted to the signed-in sender's own
-- folder; cover art is written by admins through a service-role server action.
drop policy if exists "gift covers read" on storage.objects;
create policy "gift covers read" on storage.objects
  for select to public
  using (bucket_id = 'gift-covers');

-- Admins manage the catalogue from the dashboard through their own session.
drop policy if exists "gift covers admin write" on storage.objects;
create policy "gift covers admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'gift-covers' and public.is_admin())
  with check (bucket_id = 'gift-covers' and public.is_admin());

drop policy if exists "gift media read" on storage.objects;
create policy "gift media read" on storage.objects
  for select to public
  using (bucket_id = 'gift-media');

drop policy if exists "gift media upload" on storage.objects;
create policy "gift media upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gift-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "gift media delete" on storage.objects;
create policy "gift media delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gift-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Admin-managed cover catalogue
-- ---------------------------------------------------------------------------
create table if not exists public.gift_covers (
  id text primary key,
  name text not null,
  name_ar text,
  image_url text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gift_covers_active_order_idx
  on public.gift_covers (active, sort_order, id);

alter table public.gift_covers enable row level security;
grant select on public.gift_covers to anon, authenticated;

drop policy if exists "gift covers are public" on public.gift_covers;
create policy "gift covers are public" on public.gift_covers
  for select to public
  using (active);

drop policy if exists "gift covers admin write" on public.gift_covers;
create policy "gift covers admin write" on public.gift_covers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Carry the chosen art from checkout to the voucher
-- ---------------------------------------------------------------------------
alter table public.order_items
  add column if not exists gift_cover_id text,
  add column if not exists gift_wrapping text,
  add column if not exists gift_media jsonb;

alter table public.vouchers
  add column if not exists gift_cover_id text,
  add column if not exists gift_wrapping text,
  add column if not exists gift_media jsonb;

-- Restated in full because the voucher update inside the loop changes. This is
-- the current definition from 0168, with the gift-art columns added.
create or replace function public.myfatoorah_fulfill_order(
  p_provider_invoice_id text,
  p_hashes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  n integer := 0;
  i integer := 0;
  item record;
  h jsonb;
  v_card_id uuid;
  v_cards uuid[] := '{}';
begin
  perform set_config('mf.internal', '1', true);
  select * into o from public.orders where provider_invoice_id = p_provider_invoice_id for update;
  if not found then raise exception 'order_not_found'; end if;
  -- Idempotency is based on actual vouchers: confirming the payment marks the
  -- order paid, but that must not trick us into skipping issuance.
  select array_agg(id) into v_cards from public.vouchers where order_id = o.id;
  if coalesce(array_length(v_cards, 1), 0) > 0 then
    return jsonb_build_object('already_fulfilled', true, 'voucher_ids', to_jsonb(v_cards));
  end if;
  if o.payment_status <> 'paid' then raise exception 'payment_not_confirmed'; end if;

  select count(*) into n from public.order_items where order_id = o.id;
  if n = 0 then raise exception 'order_has_no_items'; end if;
  if jsonb_typeof(p_hashes) <> 'array' or jsonb_array_length(p_hashes) <> n then
    raise exception 'invalid_signature_array';
  end if;

  for item in
    select oi.*, pr.fulfilment_type as item_fulfilment_type,
           row_number() over (order by oi.created_at, oi.id) as rn
    from public.order_items oi
    join public.products pr on pr.id = oi.product_id
    where oi.order_id = o.id
  loop
    i := i + 1;
    h := p_hashes -> (i - 1);
    -- Partner codes are issued by the existing paid-order trigger
    -- (issue_enterprise_code). Do not create a Tazella voucher for them.
    if item.item_fulfilment_type = 'enterprise_code' then
      continue;
    end if;
    if h->>'claim_token_hash' is null or h->>'card_code_hash' is null then
      raise exception 'invalid_signature_array';
    end if;

    if item.item_fulfilment_type = 'experience' then
      select public.issue_session_card(
        item.product_id, o.id, o.buyer_id, item.total_minor,
        h->>'claim_token_hash', item.recipient_name, item.recipient_email, item.recipient_phone, o.scheduled_for
      ) into v_card_id;
    else
      select public.issue_gift_card(
        item.product_id, o.id, o.buyer_id, item.total_minor,
        h->>'claim_token_hash', item.recipient_name, item.recipient_email, item.recipient_phone, o.scheduled_for
      ) into v_card_id;
    end if;

    update public.vouchers
    set order_item_id = item.id,
        card_code_hash = h->>'card_code_hash',
        currency = coalesce(currency, o.currency),
        gift_message = coalesce(gift_message, item.gift_message),
        gift_cover_id = coalesce(gift_cover_id, item.gift_cover_id),
        gift_wrapping = coalesce(gift_wrapping, item.gift_wrapping),
        gift_media = coalesce(gift_media, item.gift_media)
    where id = v_card_id;

    v_cards := v_cards || v_card_id;
  end loop;

  return jsonb_build_object('already_fulfilled', false, 'voucher_ids', to_jsonb(v_cards));
end;
$$;

-- Restated in full from 0155 with the gift-art fields added to the result. The
-- block on the voucher code is unchanged: preview stays read-only.
drop function if exists public.claim_preview(text, text);

create or replace function public.claim_preview(p_token text, p_source text default null)
returns table (
  voucher_id uuid,
  vendor_name text,
  product_title text,
  amount_minor bigint,
  remaining_value_minor bigint,
  total_sessions integer,
  remaining_sessions integer,
  sender_name text,
  gift_message text,
  gift_cover_id text,
  gift_wrapping text,
  gift_media jsonb,
  expires_at timestamptz,
  status public.voucher_status,
  fulfilment_type public.fulfilment_type
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_source text;
  v_voucher public.vouchers%rowtype;
  v_product public.products%rowtype;
  v_vendor public.vendors%rowtype;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'invalid token';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- One link cannot be polled indefinitely.
  perform public.claim_rate_limit('claim-token:' || v_hash, 30, 600);

  v_source := nullif(btrim(coalesce(p_source, '')), '');
  if v_source is null or length(v_source) > 64 then
    v_source := public.request_client_ip();
  else
    v_source := left(v_source, 64);
  end if;

  if v_source is not null then
    perform public.claim_rate_limit('claim-ip:' || v_source, 120, 600);
  end if;

  select * into v_voucher
  from public.vouchers
  where claim_token_hash = v_hash;

  if not found then
    return;
  end if;

  select * into v_product from public.products where id = v_voucher.product_id;
  select * into v_vendor from public.vendors where id = v_voucher.vendor_id;

  return query
  select
    v_voucher.id,
    v_vendor.name,
    v_product.title,
    v_voucher.initial_value_minor,
    v_voucher.remaining_value_minor,
    v_voucher.total_sessions,
    v_voucher.remaining_sessions,
    v_voucher.recipient_name,
    v_voucher.gift_message,
    v_voucher.gift_cover_id,
    v_voucher.gift_wrapping,
    v_voucher.gift_media,
    v_voucher.expires_at,
    v_voucher.status,
    v_voucher.fulfilment_type;
end;
$$;

revoke all on function public.claim_preview(text, text) from public, anon, authenticated;
grant execute on function public.claim_preview(text, text) to service_role;
