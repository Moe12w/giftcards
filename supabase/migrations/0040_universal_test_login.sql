-- 0040_universal_test_login.sql
-- One login for every dashboard.
--
-- The email in auth.users is unique, so a single account carries every role:
-- it is the platform admin, the owner of two vendors and the owner of the
-- RetailPlus partner. Logging in as test@test.com therefore opens the admin,
-- vendor and enterprise dashboards without switching accounts.
--
-- The seeded per-role accounts stay in place (they are how the individual
-- roles are tested), but every test account now shares one password.

-- ---------------------------------------------------------------------------
-- 1. The universal account
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data, aud, role,
  confirmation_token, recovery_token, email_change_token_new, email_change, phone_change
)
values (
  '99999999-9999-4999-8999-999999999999'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'test@test.com',
  extensions.crypt('test12345', extensions.gen_salt('bf', 10)),
  now(), now(), now(),
  jsonb_build_object(
    'sub', '99999999-9999-4999-8999-999999999999'::uuid,
    'email', 'test@test.com',
    'full_name', 'Test Account',
    'email_verified', true
  ),
  '{"provider":"email","providers":["email"]}'::jsonb,
  'authenticated', 'authenticated',
  '', '', '', '', ''
)
on conflict (id) do update
  set email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
      updated_at = now();

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), id, id::text, jsonb_build_object('sub', id, 'email', 'test@test.com'), 'email', now(), now(), now()
from auth.users
where id = '99999999-9999-4999-8999-999999999999'::uuid
  and not exists (
    select 1 from auth.identities i
    where i.user_id = '99999999-9999-4999-8999-999999999999'::uuid and i.provider = 'email'
  );

-- The insert above fires handle_new_user(), which makes a profile and a
-- 'customer' role row. Both are corrected here.
insert into public.profiles (id, full_name, email, preferred_language)
values ('99999999-9999-4999-8999-999999999999'::uuid, 'Test Account', 'test@test.com', 'en')
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);

insert into public.user_roles (user_id, role)
values ('99999999-9999-4999-8999-999999999999'::uuid, 'admin')
on conflict (user_id) do update set role = excluded.role;

-- The admin role row is enough: is_admin() reads user_roles first. The
-- profiles.is_admin flag stays untouched so the guard trigger is not tripped.

-- Vendor access: The Coffee House and Dune Spa, both as owner.
insert into public.vendor_members (vendor_id, user_id, role, active)
values
  ('58852d5f-8486-42fa-a423-b199925159b0'::uuid, '99999999-9999-4999-8999-999999999999'::uuid, 'owner', true),
  ('2533ec89-f5b1-4409-9273-c87bf133d095'::uuid, '99999999-9999-4999-8999-999999999999'::uuid, 'owner', true)
on conflict (vendor_id, user_id) do update
  set role = excluded.role,
      active = true;

-- Enterprise access: RetailPlus Rewards, as owner.
insert into public.enterprise_members (partner_id, user_id, role, active)
values (
  '96d72e91-21e8-47bd-8298-8f991a2ca84e'::uuid,
  '99999999-9999-4999-8999-999999999999'::uuid,
  'owner',
  true
)
on conflict (partner_id, user_id) do update
  set role = excluded.role,
      active = true;

-- ---------------------------------------------------------------------------
-- 2. One password for every seeded test account
-- ---------------------------------------------------------------------------
update auth.users
set encrypted_password = extensions.crypt('test12345', extensions.gen_salt('bf', 10)),
    updated_at = now()
where email like '%@giftly.test';

-- ---------------------------------------------------------------------------
-- 3. Business contact records point at the universal account
-- ---------------------------------------------------------------------------
update public.enterprise_partners
set contact_email = 'test@test.com'
where contact_email = 'partner@giftly.test';

update public.vendor_applications
set business_email = 'test@test.com'
where business_email = 'owner@giftly.test';
