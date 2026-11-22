-- 0162_submit_contact_request.sql
-- The public /contact form fails for signed-out visitors. The insert itself is
-- allowed — support_requests_insert accepts a null customer_id — but PostgREST
-- returns the new row, and support_requests_select only shows a row to the user
-- it belongs to. For a visitor that row is invisible, so PostgREST rejects the
-- whole statement with "new row violates row-level security policy". The client
-- therefore never sees a success, even though a row was written.
--
-- Widening the select policy to public would expose every ticket to anyone, so
-- the form uses this one-purpose function instead, exactly like
-- submit_account_deletion_request (0161). It is SECURITY DEFINER, takes only
-- what the form collects, and derives the rest: the caller cannot choose their
-- customer_id, requester kind, status or reference prefix. Email and lengths are
-- validated here because the function is publicly executable.

create or replace function public.submit_contact_request(
  p_name text,
  p_email text,
  p_subject text default null,
  p_message text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
  v_message text := btrim(coalesce(p_message, ''));
  v_reference text;
begin
  if v_name = '' or length(v_name) > 120 then
    raise exception 'invalid_name';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;

  if v_message = '' or length(v_message) > 5000 then
    raise exception 'invalid_message';
  end if;

  if length(coalesce(v_subject, '')) > 200 then
    raise exception 'invalid_subject';
  end if;

  v_reference := 'CONTACT-' || upper(
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
    'contact',
    coalesce(v_subject, 'Website contact from ' || v_name),
    'From: ' || v_name || ' <' || v_email || '>' || E'\n\n' || v_message,
    v_reference,
    'open'
  );

  return v_reference;
end;
$$;

comment on function public.submit_contact_request(text, text, text, text) is
  'Public form on /contact. Stores a contact support request for a visitor who cannot read the returned row.';

revoke all on function public.submit_contact_request(text, text, text, text) from public;
grant execute on function public.submit_contact_request(text, text, text, text) to anon, authenticated;
