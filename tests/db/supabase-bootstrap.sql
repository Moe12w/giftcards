-- tests/db/supabase-bootstrap.sql
--
-- The migrations are written for Supabase, which creates furniture before the
-- first one runs: the anon/authenticated/service_role roles, the auth schema
-- with its JWT helpers and user tables, the storage schema the bucket policies
-- sit on, and the grants behind RLS. A bare Postgres has none of it, so this
-- file builds exactly that much and nothing more.
--
-- It is test scaffolding, not schema. CI applies a plain `postgres:17` and runs
-- this first; production gets the same objects from Supabase itself. Anything a
-- migration needs beyond this belongs in a migration, not here.

-- Roles. Supabase ships them NOLOGIN; bypassrls on service_role is what lets
-- the service client read around RLS the way it does in production. Roles are
-- cluster-wide, so they survive a dropped database and are created only if
-- missing — rerunning this file against the same server must not fail.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- Extensions live in their own schema in Supabase, and the migrations call
-- extensions.digest, extensions.gen_random_bytes and extensions.gen_salt.
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Supabase keeps `extensions` on the search_path, which is why the migrations
-- call gen_random_bytes() and digest() unqualified. Connections opened after
-- this file inherit it; the session applying the migrations sets it itself.
do $$
begin
  execute format('alter database %I set search_path to "$user", public, extensions', current_database());
end
$$;

create schema auth;
create schema storage;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;

-- auth.users: only the columns these migrations touch — the 0040 seed insert,
-- the handle_new_user trigger, and the foreign keys from public tables.
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  is_super_admin boolean default false,
  confirmation_token text default '',
  recovery_token text default '',
  email_change_token_new text default '',
  email_change text default '',
  phone_change text default '',
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text,
  identity_data jsonb default '{}'::jsonb,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- The helpers every policy calls. Supabase reads the claims PostgREST puts on
-- the connection; the tests act as a user with `set local role` plus
-- request.jwt.claims, so these read the same settings.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

-- storage.buckets and storage.objects are what the migrations insert bucket
-- rows into and hang policies on; foldername() is how those policies scope a
-- path to one vendor.
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  path_tokens text[],
  version text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- 0129 adds vouchers to this publication unconditionally; 0008 only if it
-- already exists. Supabase creates it, so the tests do too.
create publication supabase_realtime;

-- Supabase grants the API roles full access to public and lets RLS decide who
-- sees what. Without the table grants the tests' `set local role authenticated`
-- fails with permission denied before any policy is evaluated, which would make
-- the RLS tests pass for the wrong reason.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
