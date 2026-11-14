-- 0066_retire_unrendered_placements.sql
-- These two surfaces no longer exist in the customer app: the homepage
-- sponsored-business row was removed, and trending now has its own collection
-- carousel. Stop selling them so an advertiser cannot buy an invisible slot.

update public.advertising_placements
set is_active = false, updated_at = now()
where key in ('homepage_featured_business', 'trending_placement');

update public.advertising_pricing pr
set is_active = false, updated_at = now()
from public.advertising_placements p
where pr.placement_id = p.id
  and p.key in ('homepage_featured_business', 'trending_placement');
