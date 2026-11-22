-- 0040_universal_test_login.sql
-- Fixture account for the advertising migrations, with no usable credential.
--
-- This used to create test@test.com with the published password test12345 and
-- grant it the platform admin role plus vendor and enterprise ownership. That
-- was a credential shipped in the migration chain, so it is gone now. Demo
-- logins live in supabase/seed.sql, which is never pushed to production.
--
-- The row stays because 0059 and 0060 use this id as the creator of the demo
-- advertising placements, and those columns reference auth.users. It is created
-- with a random password that nobody knows and cannot be reset by email, so it
-- can never be signed into. Privileges are no longer granted here.
--
-- Databases that already ran the old version are cleaned up by
-- 0164_disable_universal_test_login.sql.

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data, aud, role,
  confirmation_token, recovery_token, email_change_token_new, email_change, phone_change
)
values (
  '99999999-9999-4999-8999-999999999999'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'test@test.com',
  extensions.crypt(
    encode(extensions.gen_random_bytes(32), 'hex'),
    extensions.gen_salt('bf', 10)
  ),
  now(), now(), now(),
  jsonb_build_object(
    'sub', '99999999-9999-4999-8999-999999999999'::uuid,
    'email', 'test@test.com',
    'full_name', 'Fixture Account',
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
-- 'customer' role row. The profile is kept so the fixture looks like a user.
insert into public.profiles (id, full_name, email, preferred_language)
values ('99999999-9999-4999-8999-999999999999'::uuid, 'Fixture Account', 'test@test.com', 'en')
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);
