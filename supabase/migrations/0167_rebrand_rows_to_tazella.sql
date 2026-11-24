-- 0167_rebrand_rows_to_tazella.sql
-- The seed files and the migrations that created them now say Tazella, but those
-- only affect a fresh database. An environment seeded before the rebrand still
-- holds "Giftly" in account emails, demo copy, notifications and the bodies of
-- three functions, so this migration rewrites what is already stored.
--
-- Idempotent: every statement is scoped to rows that still carry the old value,
-- so it is safe to run on a database seeded after the rebrand.
--
-- Not touched on purpose:
--   * system_settings 'enterprise.code_encryption_key' — that value is key
--     material, not copy. Renaming it would make stored enterprise codes
--     undecryptable; rotating it is a separate, deliberate operation.
--   * vouchers carry no QR payload (column dropped in 0147); the `tazella:` /
--     `giftly:` prefixes only ever existed at generation time in code.

-- ---------------------------------------------------------------------------
-- Demo accounts and their email addresses
-- ---------------------------------------------------------------------------
-- The guards keep a database that was re-seeded after the rebrand (so it now
-- holds both the old and the new demo addresses) from colliding on the unique
-- email instead of failing the whole migration.
update auth.users u
set email = replace(u.email, '@giftly.test', '@tazella.test')
where u.email like '%@giftly.test'
  and not exists (
    select 1 from auth.users x
    where x.email = replace(u.email, '@giftly.test', '@tazella.test')
  );

update auth.identities i
set provider_id = replace(i.provider_id, '@giftly.test', '@tazella.test'),
    identity_data = jsonb_set(
      i.identity_data,
      '{email}',
      to_jsonb(replace(i.identity_data ->> 'email', '@giftly.test', '@tazella.test'))
    )
where i.provider_id like '%@giftly.test'
  and i.identity_data ? 'email'
  and not exists (
    select 1 from auth.identities x
    where x.provider_id = replace(i.provider_id, '@giftly.test', '@tazella.test')
  );

update public.profiles
set email = replace(email, '@giftly.test', '@tazella.test')
where email like '%@giftly.test';

update public.vendor_applications
set business_email = replace(business_email, '@giftly.test', '@tazella.test')
where business_email like '%@giftly.test';

update public.enterprise_partners
set contact_email = replace(contact_email, '@giftly.test', '@tazella.test')
where contact_email like '%@giftly.test';

-- Demo recipients on the sample vouchers and their order lines.
update public.vouchers
set recipient_email = replace(recipient_email, '@giftly.app', '@tazella.com.qa')
where recipient_email like '%@giftly.app';

update public.order_items
set recipient_email = replace(recipient_email, '@giftly.app', '@tazella.com.qa')
where recipient_email like '%@giftly.app';

-- ---------------------------------------------------------------------------
-- Demo copy and records created by earlier versions of the code
-- ---------------------------------------------------------------------------
update public.vendors
set description = replace(description, 'Giftly', 'Tazella')
where description like '%Giftly%';

update public.orders
set sender_name = 'Tazella (issued by an admin)'
where sender_name = 'Giftly (issued by an admin)';

update public.notifications
set title_key = replace(title_key, 'Giftly', 'Tazella')
where title_key like '%Giftly%';

update public.notifications
set body_key = replace(body_key, 'Giftly', 'Tazella')
where body_key like '%Giftly%';

update public.gift_basket_items
set vendor_name = 'Tazella'
where vendor_name = 'Giftly';

-- ---------------------------------------------------------------------------
-- Function bodies that still contain the old brand as a literal fallback or
-- notification title. Each of these is the only definition of its function in
-- the migration history, so replacing it does not revert a later fix.
-- ---------------------------------------------------------------------------

create or replace function public.admin_issue_manual_voucher(
  p_product_id uuid,
  p_amount_minor bigint default null,
  p_recipient_name text default null,
  p_recipient_email text default null,
  p_gift_message text default null,
  p_expires_at timestamptz default null,
  p_note text default null
)
returns table (
  voucher_id uuid,
  voucher_code text,
  claim_token text,
  order_id uuid,
  order_ref text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_vendor public.vendors%rowtype;
  v_amount bigint;
  v_variant_amount bigint;
  v_variant_expires timestamptz;
  v_commission bigint;
  v_share bigint;
  v_expires timestamptz;
  v_token text;
  v_hash text;
  v_code text;
  v_order_id uuid;
  v_order_ref text;
  v_item_id uuid;
  v_voucher_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'product not found';
  end if;

  -- Partner codes are allocated out of an enterprise inventory batch, so they
  -- cannot be invented here.
  if v_product.fulfilment_type not in ('monetary', 'experience') then
    raise exception 'only gift cards and experiences can be issued by hand';
  end if;

  select * into v_vendor from public.vendors where id = v_product.vendor_id;

  -- The cheapest live variant supplies the default value and expiry.
  select coalesce(pv.amount_minor, pv.price_minor), pv.valid_until
    into v_variant_amount, v_variant_expires
  from public.product_variants pv
  where pv.product_id = v_product.id
    and pv.active
  order by pv.price_minor
  limit 1;

  v_amount := coalesce(p_amount_minor, v_variant_amount);
  if v_amount is null or v_amount <= 0 then
    raise exception 'enter a value for this voucher';
  end if;

  -- Same split as a paid sale: the vendor's rate decides the commission.
  v_commission := round(v_amount * coalesce(v_vendor.commission_bps, 0) / 10000.0)::bigint;
  v_share := v_amount - v_commission;

  v_expires := coalesce(
    p_expires_at,
    v_variant_expires,
    now() + make_interval(days => coalesce(v_product.expiry_days, 365))
  );

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_code := 'MAN-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
  v_order_ref := 'MAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Inserted as paid: there is no provider event to wait for. The trigger that
  -- issues partner codes only listens for a status *change*, so nothing else
  -- fires here.
  insert into public.orders (
    buyer_id, status, payment_status, currency, subtotal_minor, discount_minor,
    fee_minor, total_minor, order_ref, payment_reference, payment_provider,
    sender_name, recipient_name, gift_message, paid_at
  )
  values (
    auth.uid(), 'paid', 'paid', coalesce(v_product.currency, 'QAR'),
    v_amount, 0, 0, v_amount, v_order_ref, 'manual-' || gen_random_uuid()::text,
    'manual', 'Tazella (issued by an admin)', p_recipient_name, p_gift_message, now()
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, vendor_id, quantity, unit_price_minor, total_minor,
    commission_minor, vendor_share_minor, currency, gift_message,
    recipient_name, recipient_email
  )
  values (
    v_order_id, v_product.id, v_product.vendor_id, 1, v_amount, v_amount,
    v_commission, v_share, coalesce(v_product.currency, 'QAR'), p_gift_message,
    p_recipient_name, p_recipient_email
  )
  returning id into v_item_id;

  v_voucher_id := public.issue_gift_card(
    v_product.id,
    v_order_id,
    auth.uid(),
    v_amount,
    v_hash,
    p_recipient_name,
    p_recipient_email,
    null,
    v_expires
  );

  update public.vouchers
  set voucher_code = v_code,
      card_code_hash = encode(extensions.digest(upper(v_code), 'sha256'), 'hex'),
      delivery_status = 'issued',
      gift_message = coalesce(p_gift_message, gift_message),
      order_item_id = v_item_id,
      updated_at = now()
  where id = v_voucher_id;

  perform public.record_admin_action(
    'voucher.manual_issue',
    'voucher',
    v_voucher_id,
    jsonb_build_object(
      'voucher_code', v_code,
      'order_id', v_order_id,
      'order_ref', v_order_ref,
      'product_id', v_product.id,
      'vendor_id', v_product.vendor_id,
      'amount_minor', v_amount,
      'commission_minor', v_commission,
      'vendor_share_minor', v_share,
      'expires_at', v_expires,
      'note', p_note
    )
  );

  return query select v_voucher_id, v_code, v_token, v_order_id, v_order_ref;
end;
$$;


create or replace function public.register_merchant_account(
  p_kind text,
  p_full_name text,
  p_business_name text,
  p_email text,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(trim(coalesce(p_business_name, '')), '');
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_slug text;
  v_vendor_id uuid;
  v_partner_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_name is null or length(v_name) < 2 then
    raise exception 'business_name_required';
  end if;

  -- Keep the profile display name in sync when the caller supplied one.
  if nullif(trim(coalesce(p_full_name, '')), '') is not null then
    update public.profiles set full_name = trim(p_full_name) where id = v_uid;
  end if;

  if p_kind = 'vendor' then
    -- Idempotent: a retried submit must not create a second business.
    select vendor_id into v_vendor_id
    from public.vendor_members
    where user_id = v_uid and active = true
    order by created_at
    limit 1;
    if v_vendor_id is not null then
      return v_vendor_id;
    end if;

    v_slug := lower(regexp_replace(v_name, '[^A-Za-z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    if v_slug = '' then
      v_slug := 'vendor';
    end if;
    v_slug := v_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);

    insert into public.vendors (owner_id, name, slug, email, phone, status)
    values (v_uid, v_name, v_slug, v_email, v_phone, 'pending')
    returning id into v_vendor_id;

    insert into public.vendor_members (vendor_id, user_id, role, active)
    values (v_vendor_id, v_uid, 'owner', true)
    on conflict (vendor_id, user_id) do update set active = true, role = 'owner';

    insert into public.vendor_applications
      (vendor_id, status, step, business_name, business_email, business_phone)
    values
      (v_vendor_id, 'started', 'business', v_name, v_email, v_phone);

    insert into public.user_roles (user_id, role)
    values (v_uid, 'vendor_owner')
    on conflict (user_id) do update set role = 'vendor_owner'
    where public.user_roles.role = 'customer';

    perform public.write_audit(
      'vendor.register', 'vendor', v_vendor_id::text, null,
      jsonb_build_object('name', v_name, 'self_serve', true)
    );
    perform public.merchant_notify_user(
      v_uid,
      'merchant',
      'Welcome to Tazella',
      'Your business account is ready. Finish your setup from the dashboard whenever you like.',
      jsonb_build_object('vendor_id', v_vendor_id)
    );
    perform public.merchant_notify_admins(
      'merchant',
      'New vendor registered',
      v_name || ' created a vendor account.',
      jsonb_build_object('vendor_id', v_vendor_id)
    );

    return v_vendor_id;
  end if;

  if p_kind = 'partner' then
    select partner_id into v_partner_id
    from public.enterprise_members
    where user_id = v_uid and active = true
    order by created_at
    limit 1;
    if v_partner_id is not null then
      return v_partner_id;
    end if;

    v_slug := lower(regexp_replace(v_name, '[^A-Za-z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    if v_slug = '' then
      v_slug := 'partner';
    end if;
    v_slug := v_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);

    insert into public.enterprise_partners
      (owner_id, name, slug, contact_name, contact_email, contact_phone, status)
    values
      (v_uid, v_name, v_slug, nullif(trim(coalesce(p_full_name, '')), ''), v_email, v_phone, 'draft')
    returning id into v_partner_id;

    insert into public.enterprise_members (partner_id, user_id, role, active)
    values (v_partner_id, v_uid, 'owner', true)
    on conflict (partner_id, user_id) do update set active = true, role = 'owner';

    insert into public.user_roles (user_id, role)
    values (v_uid, 'enterprise_user')
    on conflict (user_id) do update set role = 'enterprise_user'
    where public.user_roles.role = 'customer';

    perform public.write_audit(
      'partner.register', 'partner', v_partner_id::text, null,
      jsonb_build_object('name', v_name, 'self_serve', true)
    );
    perform public.merchant_notify_user(
      v_uid,
      'merchant',
      'Welcome to Tazella',
      'Your organisation account is ready. Finish your setup from the dashboard whenever you like.',
      jsonb_build_object('partner_id', v_partner_id)
    );
    perform public.merchant_notify_admins(
      'merchant',
      'New enterprise registered',
      v_name || ' created an enterprise account.',
      jsonb_build_object('partner_id', v_partner_id)
    );

    return v_partner_id;
  end if;

  raise exception 'invalid_kind';
end;
$$;


create or replace function public.basket_fulfill_from_payment(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  v_item record;
  v_name text;
  v_added integer := 0;
  v_row uuid;
begin
  perform set_config('mf.internal', '1', true);

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if o.basket_id is null then
    return jsonb_build_object('is_basket', false, 'added', 0);
  end if;
  if o.payment_status <> 'paid' then
    raise exception 'payment_not_confirmed';
  end if;

  -- The payer must belong to the basket they are adding to.
  if not exists (
    select 1 from public.gift_basket_participants p
    where p.basket_id = o.basket_id and p.user_id = o.buyer_id
  ) then
    raise exception 'not_a_participant';
  end if;

  select coalesce(nullif(full_name, ''), 'Tazella customer')
    into v_name
  from public.profiles
  where id = o.buyer_id;
  v_name := coalesce(v_name, 'Tazella customer');

  for v_item in
    select
      oi.id,
      oi.product_id,
      oi.vendor_id,
      oi.total_minor,
      pr.title,
      pr.icon,
      pr.tone,
      pr.image_url,
      coalesce(v.name, ep.name) as business_name,
      coalesce(v.logo_url, ep.logo_url) as logo_url,
      coalesce(v.banner_url, ep.banner_url) as banner_url
    from public.order_items oi
    left join public.products pr on pr.id = oi.product_id
    left join public.vendors v on v.id = oi.vendor_id
    left join public.enterprise_partners ep on ep.id = pr.partner_id
    where oi.order_id = o.id
    order by oi.created_at, oi.id
  loop
    v_row := null;

    insert into public.gift_basket_items (
      basket_id, offer_id, vendor_id, vendor_name, title, amount_minor,
      emoji, tone, logo_url, banner_url, added_by, added_by_name, order_item_id
    )
    values (
      o.basket_id, v_item.product_id, v_item.vendor_id,
      coalesce(v_item.business_name, 'Tazella'),
      coalesce(v_item.title, 'Gift card'),
      v_item.total_minor,
      v_item.icon, v_item.tone, v_item.logo_url, v_item.banner_url,
      o.buyer_id, v_name, v_item.id
    )
    on conflict (order_item_id) do nothing
    returning id into v_row;

    if v_row is not null then
      v_added := v_added + 1;

      insert into public.gift_basket_activity (
        basket_id, kind, actor_id, actor_name, item_title, amount_minor
      )
      values (
        o.basket_id, 'item_added', o.buyer_id, v_name,
        coalesce(v_item.title, 'Gift card'), v_item.total_minor
      );
    end if;
  end loop;

  return jsonb_build_object('is_basket', true, 'added', v_added);
end;
$$;

