-- 0019_favourites_keys.sql
-- The favourites table used a composite primary key over (customer_id,
-- vendor_id, product_id). In Postgres every primary key column is NOT NULL,
-- which made "favourites a product, not a vendor" impossible. It gets a
-- surrogate key and two partial unique indexes instead.

alter table public.favourites drop constraint if exists favourites_pkey;

-- Dropping a primary key does not remove the NOT NULL it implied, so it is
-- dropped explicitly.
alter table public.favourites alter column vendor_id drop not null;
alter table public.favourites alter column product_id drop not null;

alter table public.favourites
  add column if not exists id uuid default gen_random_uuid();

update public.favourites set id = gen_random_uuid() where id is null;

alter table public.favourites
  alter column id set not null;

alter table public.favourites
  add constraint favourites_pkey primary key (id);

-- One favourite per product and per vendor, without the NULL problem.
drop index if exists public.favourites_customer_id_vendor_id_product_id_key;
create unique index if not exists favourites_customer_product_idx
  on public.favourites (customer_id, product_id)
  where product_id is not null;
create unique index if not exists favourites_customer_vendor_idx
  on public.favourites (customer_id, vendor_id)
  where vendor_id is not null;
