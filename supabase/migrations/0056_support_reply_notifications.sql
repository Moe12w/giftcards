-- 0056_support_reply_notifications.sql
-- An admin reply creates an in-app notification for the requester.
--
-- The trigger runs as the table owner, so it writes the notification even
-- though the admin is the one inserting the reply. Requesters only see their
-- own notifications through the existing RLS policy on `notifications`.
--
-- The email is sent by the admin reply action (web/lib/actions/admin.ts); this
-- trigger only covers the in-app inbox, which is the part that must not be
-- skippable by any surface.

create or replace function public.notify_on_support_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_subject text;
begin
  -- Only the team's answers notify the requester. A customer replying to
  -- their own ticket must not ping them.
  if new.author_role <> 'admin' then
    return new;
  end if;

  select r.customer_id, coalesce(r.subject, 'Support request')
    into v_customer_id, v_subject
  from public.support_requests r
  where r.id = new.request_id;

  if v_customer_id is null then
    return new;
  end if;

  insert into public.notifications (user_id, kind, title_key, body_key, payload)
  values (
    v_customer_id,
    'support',
    'notifications.supportReply',
    'notifications.supportReplyBody',
    jsonb_build_object(
      'support_request_id', new.request_id,
      'subject', v_subject,
      'message_id', new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists support_messages_notify on public.support_ticket_messages;
create trigger support_messages_notify
  after insert on public.support_ticket_messages
  for each row execute function public.notify_on_support_reply();

notify pgrst, 'reload schema';
