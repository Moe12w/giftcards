-- ---------------------------------------------------------------------------
-- One set of accent tones for the whole platform
--
-- The vendor dashboard let a vendor pick a colour from the website palette
-- (mint, coral), but the app only paints teal, pink, lavender, gold and sky.
-- An unknown colour reached the app as an unstyled card and took the screen
-- down, so the colours are now shared and the database refuses anything else.
-- ---------------------------------------------------------------------------

update public.products set tone = 'teal' where tone = 'mint';
update public.products set tone = 'pink' where tone = 'coral';

update public.gift_basket_items set tone = 'teal' where tone = 'mint';
update public.gift_basket_items set tone = 'pink' where tone = 'coral';

update public.gift_basket_participants set tone = 'teal' where tone = 'mint';
update public.gift_basket_participants set tone = 'pink' where tone = 'coral';

alter table public.products
  drop constraint if exists products_tone_check;

alter table public.products
  add constraint products_tone_check
  check (tone is null or tone in ('teal', 'pink', 'lavender', 'gold', 'sky'));

alter table public.gift_basket_items
  drop constraint if exists gift_basket_items_tone_check;

alter table public.gift_basket_items
  add constraint gift_basket_items_tone_check
  check (tone is null or tone in ('teal', 'pink', 'lavender', 'gold', 'sky'));

alter table public.gift_basket_participants
  drop constraint if exists gift_basket_participants_tone_check;

alter table public.gift_basket_participants
  add constraint gift_basket_participants_tone_check
  check (tone is null or tone in ('teal', 'pink', 'lavender', 'gold', 'sky'));
