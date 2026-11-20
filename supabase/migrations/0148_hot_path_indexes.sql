-- 0148_hot_path_indexes.sql
-- Indexes for the filters used by cron, ad dedupe and dashboard/voucher lists.
-- All are IF NOT EXISTS so the migration is safe to re-run.
create index if not exists notifications_kind_read_created_idx
  on public.notifications (kind, read_at, created_at desc);

create index if not exists advertising_clicks_request_id_idx
  on public.advertising_clicks (request_id);

create index if not exists advertising_conversions_request_id_idx
  on public.advertising_conversions (request_id);

create index if not exists advertising_impressions_request_id_idx
  on public.advertising_impressions (request_id);

create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

create index if not exists vouchers_vendor_created_idx
  on public.vouchers (vendor_id, created_at desc);

create index if not exists vouchers_status_created_idx
  on public.vouchers (status, created_at desc);
