-- 0055_support_ticket_threads.sql
-- Replies on a support ticket.
--
-- The first message of a ticket stays on `support_requests.body`; every reply
-- is a row here. Keeping replies separate means the thread is append-only and
-- the admin and the requester read exactly the same rows.
--
-- The author's name is stored on the row (snapshot), so the thread keeps its
-- history even if a profile is renamed or an account is deleted. No join is
-- needed to render a reply, which also keeps PostgREST out of the way.

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_role text not null check (author_role in ('requester', 'admin')),
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_request_idx
  on public.support_ticket_messages (request_id, created_at);

alter table public.support_ticket_messages enable row level security;

-- A requester reads the whole thread of their own ticket. An admin reads every
-- thread in the queue.
drop policy if exists support_ticket_messages_select on public.support_ticket_messages;
create policy support_ticket_messages_select on public.support_ticket_messages
  for select using (
    public.is_admin()
    or exists (
      select 1
      from public.support_requests r
      where r.id = support_ticket_messages.request_id
        and r.customer_id = auth.uid()
    )
  );

-- A requester can only append to their own ticket, and only as themselves.
-- An admin can append to any ticket.
drop policy if exists support_ticket_messages_insert on public.support_ticket_messages;
create policy support_ticket_messages_insert on public.support_ticket_messages
  for insert with check (
    public.is_admin()
    or (
      author_role = 'requester'
      and exists (
        select 1
        from public.support_requests r
        where r.id = support_ticket_messages.request_id
          and r.customer_id = auth.uid()
      )
    )
  );

-- Replies are never edited or deleted from the app; only an admin may remove
-- one while moderating a thread.
drop policy if exists support_ticket_messages_delete_admin on public.support_ticket_messages;
create policy support_ticket_messages_delete_admin on public.support_ticket_messages
  for delete using (public.is_admin());

notify pgrst, 'reload schema';
