-- 0147_drop_qr_payload.sql
-- qr_payload was written by demo seeds and selected by the wallet, but every QR
-- shown in the app is generated from the voucher id/code at render time. Remove
-- the dead column so there is one source of truth for redemption payloads.
alter table public.vouchers drop column if exists qr_payload;
