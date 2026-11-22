-- 0161_submit_account_deletion_request.sql
-- The deletion form on /account-deletion works signed out, and inserts through
-- the public anon key hit a row-level security wall: the INSERT policy on
-- support_requests has always rejected a null customer_id in this project, which
-- is also why the public contact form fails for signed-out visitors.
--
-- Rather than widen that policy, the form calls this one-purpose function. It is
-- SECURITY DEFINER, takes only what the form collects, and derives the rest
-- itself, so a caller cannot choose their customer_id, the kind, the status or
-- the reference prefix. The email is validated here as well, because the RPC is
-- publicly executable.

create or replace function public.submit_account_deletion_request(
  p_email text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_reference text;
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;

  if length(coalesce(v_note, '')) > 2000 then
    raise exception 'note_too_long';
  end if;

  v_reference := 'DELETE-' || upper(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
  );

  insert into public.support_requests (
    customer_id,
    requester_kind,
    kind,
    subject,
    body,
    reference,
    status
  )
  values (
    auth.uid(),
    case when auth.uid() is null then 'visitor' else 'customer' end,
    'account_deletion',
    'Account deletion request — ' || v_email,
    concat_ws(E'\n', 'Account email: ' || v_email, v_note),
    v_reference,
    'open'
  );

  return v_reference;
end;
$$;

comment on function public.submit_account_deletion_request(text, text) is
  'Public form on /account-deletion. Stores an account_deletion support request; never deletes anything itself.';

revoke all on function public.submit_account_deletion_request(text, text) from public;
grant execute on function public.submit_account_deletion_request(text, text) to anon, authenticated;
