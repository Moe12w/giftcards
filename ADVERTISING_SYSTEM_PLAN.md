FINAL STATUS — Enterprise Advertising + 3 outstanding requests

=== 1. Image upload instead of URL in wizard ===
- Component: web/components/AdvertisingCreativeImage.tsx
- Server action: web/lib/actions/advertising.ts → uploadAdvertisingCreativeImage()
- Uploads to Supabase bucket `vendor-media` under vendor-id path, resizes client-side
- Wizard conditionally renders it only for `format === 'banner' || format === 'carousel'`
- Gift-card placements (`homepage_featured_gift_card`, `marketplace_sponsored_card`) auto-switch to `destination_type='gift_card'` and show the gift card selector instead of an image upload

=== 2. Placement-conditional image uploads ===
- Image fields shown only for banner/carousel formats
- Hidden for card-format placements (featured business, category position, trending, discovery)
- Arabic/English copy throughout

=== 3. Bulk deals ranking placement ===
- Migration 0051: `alter type advertising_placement_kind add value 'bulk_deals_ranking'`
- Migration 0052: Seeds placement + pricing (fixed 30K / CPC 90 / CPM 4K per 1K)
- Placement: native, auction, 3 slots, 3 max active per vendor
- Deals page (`web/app/business/(portal)/deals/page.tsx`): Sponsored ranking campaigns push their promoted gift card to the top with a "Sponsored" tag
- i18n: `sponsored: 'Sponsored'` / `sponsored: 'مدعوم'`

=== Verification ===
- Web tsc: ✅ pass
- Next build: ✅ pass (includes new `/enterprise/advertising/*` routes, new placement, new bulk-deals ranking)
- Lifecycle suite: all 21 checks passed ✅
- Live runtime: enterprise advertising routes respond 307 → sign-in when unauthenticated ✅

=== Remaining env gaps ===
- `ADVERTISING_PAYMENT_WEBHOOK_SECRET` for signed webhook
- `ADVERTISING_MAINTENANCE_SECRET` (or Vercel `CRON_SECRET`)
- `RESEND_API_KEY` (real email sending)
- No advertising payment-gateway secret (manual admin verification + promotional credit checkout work today)