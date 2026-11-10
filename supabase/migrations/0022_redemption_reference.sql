-- 0022_redemption_reference.sql
-- pgcrypto lives in the `extensions` schema on Supabase, so the random bytes
-- helper has to be called with its schema.

create or replace function public.make_redemption_reference()
returns text
language sql
volatile
as $$
  select 'RDM-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
$$;
