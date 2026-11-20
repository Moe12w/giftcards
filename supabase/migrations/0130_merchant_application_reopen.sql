-- 0130_merchant_application_reopen.sql
-- Lets a merchant return a submitted/rejected payment application to draft so
-- they can correct details (for example the banking IBAN) and resubmit.
-- Approved/live applications stay locked and must be changed by an admin.

create or replace function public.merchant_application_reopen(p_application_id uuid)
returns public.merchant_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.merchant_applications;
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;
  if not public.merchant_application_can_manage(p_application_id) then
    raise exception 'not_authorized';
  end if;

  select * into a from public.merchant_applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found';
  end if;

  if a.status not in ('submitted', 'under_review', 'approved', 'rejected') then
    raise exception 'status_not_editable';
  end if;

  update public.merchant_applications
  set status = 'draft',
      step = least(step, 5),
      submitted_at = null,
      submitted_by = null,
      updated_at = now()
  where id = a.id
  returning * into a;

  perform public.merchant_log_event(a.id, 'reopened', null);
  perform public.write_audit('merchant.application.reopen', 'merchant_application', a.id::text, null, null);

  return a;
end;
$$;

revoke all on function public.merchant_application_reopen(uuid) from public, anon;
grant execute on function public.merchant_application_reopen(uuid) to authenticated;
