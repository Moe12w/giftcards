-- 0105_delivery_method_whatsapp.sql
-- The customer app lets the buyer choose WhatsApp as the delivery method, but
-- `public.delivery_method` never had that value, so storing it would fail with
-- "invalid input value for enum delivery_method". Add it now.

alter type public.delivery_method add value if not exists 'whatsapp';
