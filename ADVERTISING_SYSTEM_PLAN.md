ADVERTISING & PROMOTIONS — CURRENT STATE

=== Model ===
- Slot-based rentals replaced rotation, auctions and frequency caps.
- Each placement has numbered slots (8 for the homepage hero and every
  category/collection carousel; existing smaller surfaces keep their own
  counts). Slot 1 is seen first and is priced highest.
- A rental runs between 6 and 72 hours. There is no auto-renew anywhere.
- Prices are fixed per slot, set by admin in minor units. A campaign keeps the
  price snapshot it paid; later price changes only affect new bookings.
- A paid + approved campaign takes its slot at the start time and releases it
  at the end time. If the slot is still occupied, the campaign is queued and
  activates when the slot clears. Activation re-checks the calendar, so a
  reservation made when the draft was created can never be promoted into a
  slot another campaign has since booked. Empty slots render fewer ads, never
  a broken container.
- Payment is always verified on the server. A browser success flag is never
  trusted. Promotional credit and manual bank-transfer verification work today.

=== Per-category and per-collection carousels ===
- One placement per category: `category_<slug>` (9 categories).
- One placement per collection: `collection_<slug>` (14 collections, including
  popular gift cards, trending gifts, featured businesses and new arrivals).
- The generic `marketplace_category_position`, `homepage_featured_category` and
  `discovery_placement` placements are retired.
- Each carousel is rendered at the top of its page, under the header, exactly
  like the search page.
- The categories index page shows no sponsored strip.
- Existing seed campaigns were moved into concrete placements and every slot
  was seeded so all 23 carousels are full for demo purposes.

=== Automatic catalog sync ===
- `advertising_ensure_carousel_placement(kind, slug, name, name_ar, sort_order)`
  creates/updates an 8-slot placement and its fixed pricing row.
- A trigger on `categories` calls it for every insert/update, deactivates the
  carousel when a category is deactivated, and retires the old key on rename.
- Collections are app-side constants; `advertising_ensure_collection_placement`
  exposes the same helper for the migration that introduces a new collection.

=== Dashboards ===
- Vendor and enterprise: overview, four-step wizard (surface tabs → placement →
  creative → schedule/slot → checkout), campaign detail, edit, pause/resume,
  duplicate/renew, delivery stats and notifications.
- The wizard filters pricing models per placement and shows live slot state:
  "Available", "Free now · booked later", or "Filled until <time>". Choosing a
  filled slot moves the start time to the moment it frees up.
- Gift-card surfaces (featured gift card, sponsored card, search, bulk deals,
  category and collection carousels) ask for one of the advertiser's own gift
  cards instead of an image. Banner/carousel formats ask for uploaded images.
- Admin: overview, campaigns + detail, placements/pricing (including per-slot
  price lists), slot inventory with occupancy and free-up times, advertisers,
  rules, finance and the separate advertising ledger.
- Advertising tutorials exist for admin, vendor and enterprise, with EN/AR copy,
  tips and deep links.

=== Migrations ===
0044 schema + RLS
0045 lifecycle core
0046 delivery + tracking
0047 payments + ledger
0048 vendor campaign RPCs
0049 admin operations
0050 enterprise partner → vendor link
0051 bulk_deals_ranking enum
0052 bulk_deals_ranking seed
0053 per-placement allowed pricing models
0057 slot-based rentals, 6–72h, availability RPCs, delivery by slot
0058 category/collection placement kinds
0059 21 category/collection placements + moved seed campaigns
0060 featured-businesses and new-arrivals collections
0061 advertising_slot_map() for wizard/admin availability
0062 carousel auto-creation helper + categories trigger
0063 create-campaign duration fix (hours only for slotted placements)
0064 update-campaign slot validation + reservation sync
0065 duplicate/renew keeps the slot and queues for the next free window
0066 retired the unrendered homepage-business and old trending placements
0067 slot conflict guard: activation re-checks the calendar; delivery picks one winner
0068 create-campaign fix: uuid destination cast, active creative, slot price snapshot

=== Verification ===
- Web tsc: pass
- Mobile tsc: pass
- Next build: pass
- All 23 category/collection placements have 8 live seeded campaigns.
- Slot conflict guard tested with two drafts on one slot: the first paid
  campaign activates, the second queues as `capacity_full`, and delivery stays
  with the activated campaign. Legacy double-active states deliver from the
  earlier-activated campaign only.
- End-to-end booking tested on a throwaway carousel: slot 3 quoted at 30000,
  draft reserved the slot, submit produced the payment reference, manual
  confirmation moved it to `pending_approval`, admin approval activated it,
  delivery returned the ad, and the slot map reported slot 3 as occupied.
- Edit flow tested: creative/name/window updates work, an overlapping edit is
  rejected with `slot_unavailable`, and renewal/duplicate keep the slot and
  queue behind the blocking campaign.

=== Remaining env gaps ===
- `ADVERTISING_PAYMENT_WEBHOOK_SECRET` for signed webhook
- `ADVERTISING_MAINTENANCE_SECRET` (or Vercel `CRON_SECRET`)
- `RESEND_API_KEY` (real email sending)
- No advertising payment-gateway secret; manual admin verification and
  promotional credit work today.
