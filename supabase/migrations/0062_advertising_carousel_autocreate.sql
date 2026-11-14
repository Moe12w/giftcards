-- 0062_advertising_carousel_autocreate.sql
-- Keeps the sellable carousel inventory in sync with the catalog.
--
-- Categories live in the database, so a trigger creates or updates the matching
-- 8-slot placement automatically. Collections are app-side constants, so the
-- same helper is exposed as advertising_ensure_collection_placement() for the
-- migration that introduces a new collection.

create or replace function public.advertising_ensure_carousel_placement(
  p_kind public.advertising_placement_kind,
  p_slug text,
  p_name text,
  p_name_ar text default null,
  p_sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_id uuid;
  v_prefix text;
  v_prices bigint[] := ARRAY[40000, 35000, 30000, 25000, 20000, 18000, 15000, 12000]::bigint[];
begin
  if p_slug is null or length(trim(p_slug)) = 0 then
    raise exception 'A catalog slug is required';
  end if;

  v_prefix := case
    when p_kind = 'category_carousel' then 'category_'
    when p_kind = 'collection_carousel' then 'collection_'
    else null
  end;

  if v_prefix is null then
    raise exception 'Only category_carousel and collection_carousel are supported';
  end if;

  v_key := v_prefix || trim(p_slug);

  insert into public.advertising_placements
    (key, kind, name, name_ar, description, description_ar, format, supports_carousel,
     slot_count, max_active_campaigns, rotation_mode, auction_enabled, priority, sort_order,
     creative_width, creative_height, config, allowed_pricing_models, slot_prices_minor,
     is_active)
  values
    (v_key, p_kind, p_name, p_name_ar,
     'Sponsored strip at the top of the ' || p_name || ' page.',
     'شريط إعلاني أعلى صفحة ' || coalesce(p_name_ar, p_name) || '.',
     'native', false, 8, 8, 'fixed', false, 28, p_sort_order,
     800, 400, '{"max_per_vendor": 2, "auto_rotate_seconds": 15}'::jsonb,
     '{fixed}'::text[], v_prices, true)
  on conflict (key) do update
    set name = excluded.name,
        name_ar = excluded.name_ar,
        sort_order = excluded.sort_order,
        updated_at = now()
  returning id into v_id;

  insert into public.advertising_pricing
    (placement_id, pricing_model, fixed_price_minor, cpc_rate_minor, cpm_rate_minor,
     min_duration_days, max_duration_days, default_duration_days, min_budget_minor,
     version, is_active)
  select v_id, 'fixed'::public.advertising_pricing_model, v_prices[1], 0, 0,
         1, 3, 1, v_prices[8], 1, true
  where not exists (
    select 1 from public.advertising_pricing
    where placement_id = v_id and pricing_model = 'fixed' and is_active
  );

  return v_id;
end;
$$;

revoke execute on function public.advertising_ensure_carousel_placement(
  public.advertising_placement_kind, text, text, text, integer
) from public;
grant execute on function public.advertising_ensure_carousel_placement(
  public.advertising_placement_kind, text, text, text, integer
) to service_role;

create or replace function public.advertising_ensure_collection_placement(
  p_slug text,
  p_name text,
  p_name_ar text default null,
  p_sort_order integer default 0
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.advertising_ensure_carousel_placement(
    'collection_carousel'::public.advertising_placement_kind,
    p_slug, p_name, p_name_ar, p_sort_order
  );
$$;

revoke execute on function public.advertising_ensure_collection_placement(text, text, text, integer) from public;
grant execute on function public.advertising_ensure_collection_placement(text, text, text, integer) to service_role;

-- Keep the database-backed category catalog and the advertising inventory in
-- lockstep: new categories get a placement, renamed ones are relabelled, and
-- deactivating a category stops selling its carousel.
create or replace function public.advertising_sync_category_placement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.advertising_placements
    set is_active = false, updated_at = now()
    where key = 'category_' || old.slug;
    return old;
  end if;

  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    update public.advertising_placements
    set is_active = false, updated_at = now()
    where key = 'category_' || old.slug;
  end if;

  perform public.advertising_ensure_carousel_placement(
    'category_carousel'::public.advertising_placement_kind,
    new.slug,
    new.name || ' category carousel',
    coalesce(new.name_ar, new.name) || ' - كاروسيل الفئة',
    100 + coalesce(new.sort_order, 0)
  );

  if new.active then
    update public.advertising_placements
    set is_active = true, updated_at = now()
    where key = 'category_' || new.slug;
  else
    update public.advertising_placements
    set is_active = false, updated_at = now()
    where key = 'category_' || new.slug;
  end if;

  return new;
end;
$$;

drop trigger if exists advertising_sync_category_placement on public.categories;
create trigger advertising_sync_category_placement
after insert or update of slug, name, name_ar, sort_order, active or delete on public.categories
for each row execute function public.advertising_sync_category_placement();
