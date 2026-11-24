-- 0112_merchant_registration.sql
--
-- Simplified self-serve registration for vendors and enterprise partners.
--
-- The old flow forced a prospect to fill in the whole business profile and
-- submit it for review before they could see a dashboard. This creates the
-- account and its business record immediately, leaves the platform application
-- in `started`, and lets the onboarding wizard fill in the rest from inside the
-- dashboard.
--
-- Payment processing is untouched here: it lives in merchant_applications and
-- is never a condition of dashboard access.

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

revoke all on function public.register_merchant_account(text, text, text, text, text) from public, anon;
grant execute on function public.register_merchant_account(text, text, text, text, text) to authenticated;

-- Onboarding wizard state for vendors: save a step and advance without
-- submitting for review.
create or replace function public.save_vendor_onboarding_step(
  p_vendor_id uuid,
  p_step text,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application_id uuid;
begin
  if not public.can_manage_vendor(p_vendor_id) then
    raise exception 'not_authorized';
  end if;

  update public.vendors
  set name = coalesce(nullif(p_patch->>'name', ''), name),
      name_ar = coalesce(p_patch->>'name_ar', name_ar),
      business_type = coalesce(nullif(p_patch->>'business_type', ''), business_type),
      category_id = case
        when p_patch ? 'category_id' and nullif(p_patch->>'category_id', '') is not null
          then (p_patch->>'category_id')::uuid
        else category_id
      end,
      phone = coalesce(nullif(p_patch->>'phone', ''), phone),
      email = coalesce(nullif(p_patch->>'email', ''), email),
      website = coalesce(nullif(p_patch->>'website', ''), website),
      social_handle = coalesce(nullif(p_patch->>'social_handle', ''), social_handle),
      city = coalesce(nullif(p_patch->>'city', ''), city),
      area = coalesce(nullif(p_patch->>'area', ''), area),
      address = coalesce(nullif(p_patch->>'address', ''), address),
      description = coalesce(nullif(p_patch->>'description', ''), description),
      intents = case
        when p_patch ? 'intents' and jsonb_typeof(p_patch->'intents') = 'array'
          then array(select jsonb_array_elements_text(p_patch->'intents'))
        else intents
      end,
      updated_at = now()
  where id = p_vendor_id;

  select id into v_application_id
  from public.vendor_applications
  where vendor_id = p_vendor_id
  order by created_at desc
  limit 1;

  if v_application_id is null then
    insert into public.vendor_applications (vendor_id, status, step, business_name)
    values (p_vendor_id, 'started', p_step, (select name from public.vendors where id = p_vendor_id))
    returning id into v_application_id;
  end if;

  update public.vendor_applications
  set step = p_step,
      status = case when status in ('started', 'incomplete') then 'incomplete' else status end,
      business_name = coalesce(nullif(p_patch->>'name', ''), business_name),
      business_category = coalesce(nullif(p_patch->>'category_name', ''), business_category),
      business_description = coalesce(nullif(p_patch->>'description', ''), business_description),
      business_email = coalesce(nullif(p_patch->>'email', ''), business_email),
      business_phone = coalesce(nullif(p_patch->>'phone', ''), business_phone),
      business_location = coalesce(nullif(p_patch->>'area', ''), business_location),
      business_website = coalesce(nullif(p_patch->>'website', ''), business_website),
      business_type = coalesce(nullif(p_patch->>'business_type', ''), business_type),
      intents = case
        when p_patch ? 'intents' and jsonb_typeof(p_patch->'intents') = 'array'
          then array(select jsonb_array_elements_text(p_patch->'intents'))
        else intents
      end,
      updated_at = now()
  where id = v_application_id;
end;
$$;

revoke all on function public.save_vendor_onboarding_step(uuid, text, jsonb) from public, anon;
grant execute on function public.save_vendor_onboarding_step(uuid, text, jsonb) to authenticated;

-- Enterprise onboarding: organisation profile, saved a step at a time.
create or replace function public.save_partner_onboarding_step(
  p_partner_id uuid,
  p_step text,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_partner(p_partner_id) then
    raise exception 'not_authorized';
  end if;

  update public.enterprise_partners
  set name = coalesce(nullif(p_patch->>'name', ''), name),
      legal_name = coalesce(nullif(p_patch->>'legal_name', ''), legal_name),
      website = coalesce(nullif(p_patch->>'website', ''), website),
      contact_name = coalesce(nullif(p_patch->>'contact_name', ''), contact_name),
      contact_role = coalesce(nullif(p_patch->>'contact_role', ''), contact_role),
      contact_email = coalesce(nullif(p_patch->>'contact_email', ''), contact_email),
      contact_phone = coalesce(nullif(p_patch->>'contact_phone', ''), contact_phone),
      industry = coalesce(nullif(p_patch->>'industry', ''), industry),
      company_size = coalesce(nullif(p_patch->>'company_size', ''), company_size),
      branches_count = case
        when p_patch ? 'branches_count' and nullif(p_patch->>'branches_count', '') is not null
          then (p_patch->>'branches_count')::integer
        else branches_count
      end,
      country = coalesce(nullif(p_patch->>'country', ''), country),
      notes = coalesce(p_patch->>'notes', notes),
      updated_at = now()
  where id = p_partner_id;

  perform public.write_audit(
    'partner.onboarding.' || p_step, 'partner', p_partner_id::text, null, p_patch
  );
end;
$$;

revoke all on function public.save_partner_onboarding_step(uuid, text, jsonb) from public, anon;
grant execute on function public.save_partner_onboarding_step(uuid, text, jsonb) to authenticated;
