-- 0164_disable_universal_test_login.sql
-- Retires the account 0040 used to create with a published password.
--
-- 0040 (before this change) inserted test@test.com with password test12345,
-- the platform admin role, and owner membership of two vendors and one
-- enterprise partner. Any database that applied it has that account, so this
-- migration disables it there:
--
--   1. replaces the password with a random value nobody knows,
--   2. blocks sign-in and token refresh where the auth schema supports it,
--   3. removes the admin role and every membership 0040 granted.
--
-- The auth.users row is kept because 0059 and 0060 own demo advertising rows
-- through it; deleting it would cascade into those. A row that cannot
-- authenticate and holds no role is inert, which is what we want.
--
-- Demo logins remain in supabase/seed.sql, which is local-only and never
-- pushed to production.

do $$
declare
  v_user uuid := '99999999-9999-4999-8999-999999999999';
  v_random text;
begin
  if not exists (select 1 from auth.users where id = v_user) then
    return;
  end if;

  v_random := encode(extensions.gen_random_bytes(32), 'hex');

  update auth.users
  set encrypted_password = extensions.crypt(v_random, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = v_user;

  -- Hosted Supabase has banned_until; the test bootstrap does not.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'banned_until'
  ) then
    execute 'update auth.users set banned_until = ''infinity'' where id = $1' using v_user;
  end if;

  delete from public.user_roles where user_id = v_user;

  if to_regclass('public.vendor_members') is not null then
    delete from public.vendor_members where user_id = v_user;
  end if;

  if to_regclass('public.enterprise_members') is not null then
    delete from public.enterprise_members where user_id = v_user;
  end if;

  if to_regclass('public.business_members') is not null then
    delete from public.business_members where user_id = v_user;
  end if;
end $$;
