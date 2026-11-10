-- 0004_payment_columns.sql
-- Extra columns needed to reconcile MyFatoorah invoices and redemption codes.
-- Added as a new migration because migrations are never edited after they run.

alter table public.orders
  add column if not exists provider_invoice_id text;

create unique index if not exists orders_provider_invoice_idx
  on public.orders (provider_invoice_id)
  where provider_invoice_id is not null;

-- Store only the hash of the redemption code. The raw code is shown once.
alter table public.gift_cards
  add column if not exists card_code_hash text;

create unique index if not exists gift_cards_card_code_hash_idx
  on public.gift_cards (card_code_hash)
  where card_code_hash is not null;

-- Snapshot of the offer/vendor at purchase time, so later edits don't rewrite
-- history.
alter table public.orders
  add column if not exists offer_snapshot jsonb;
