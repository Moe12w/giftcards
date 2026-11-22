-- 0160_account_deletion_requests.sql
-- Google Play requires a public web resource where users can *request* account
-- deletion, separate from the in-app path. Those requests are stored with the
-- other support requests so the team already has one queue and one admin view,
-- but under their own kind so they cannot be mistaken for an ordinary ticket
-- or lost among contact messages.
--
-- No new table and no new policy: 0027 already lets a signed-out visitor
-- insert a request with a null customer_id, which is exactly what the public
-- form does. Only the kind check needs to admit the new value.
--
-- Every earlier kind is kept, because rows already use them.

alter table public.support_requests
  drop constraint if exists support_requests_kind_check;

alter table public.support_requests
  add constraint support_requests_kind_check
  check (
    kind in (
      'contact',
      'support',
      'report',
      'report_gift',
      'refund',
      'chat',
      'enterprise_enquiry',
      'launch_list',
      'account_deletion'
    )
  );

comment on column public.support_requests.kind is
  'Request type. account_deletion comes from the public /account-deletion page and must be actioned against auth.users.';
