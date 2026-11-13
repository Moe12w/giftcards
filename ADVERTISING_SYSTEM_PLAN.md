# Advertising & Promotions System — Build Plan and Handoff

> Status document for the advertising platform built on top of Giftly.
> Keep this file updated at the end of every phase so another engineer or AI can
> resume without re-reading the whole codebase.

Last updated: 2026-11-13

---

## 1. What is being built

A complete, admin-configurable advertising system on the existing Giftly
backend. It has three surfaces:

| Surface | Where | Purpose |
| --- | --- | --- |
| Customer app | Expo app, homepage and marketplace placements | Sponsored carousel/cards, click + impression tracking |
| Vendor dashboard | `web/app/vendor/advertising/*` | Campaign overview, 4-step creation, checkout, management, analytics |
| Admin dashboard | `web/app/admin/advertising/*` | Revenue, placements, pricing, approvals, advertisers, rules, inventory, finance, overrides |

All prices, durations, budgets, capacity and rules live in the database and are
editable by admins. No advertising values are hardcoded in the app.

---

## 2. Non-negotiable rules

1. **Payment is verified on the server.** A campaign can never become active
   because a browser said "paid". Activation happens only through the
   `advertising_confirm_payment` / `advertising_pay_with_credit` database
   functions.
2. **The advertising ledger is separate** from gift-card sales, vendor
   settlements and wallet balances. Every payment, charge, refund, credit and
   renewal writes to `advertising_ledger_entries` with a unique transaction ID.
3. **Everything is idempotent.** Payment references, impression IDs, click IDs,
   conversion IDs and charge idempotency keys are unique.
4. **Existing flows must not break.** Gift-card purchasing, vendor management,
   customer accounts and payments are untouched except for additive columns and
   new tables.
5. **Vendors only see their own data.** RLS is enabled on every advertising
   table.

---

## 3. Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Architecture inspection + this handoff document | ✅ Done |
| 1 | Database schema, enums, RLS, rules engine, lifecycle functions, seed data | ✅ Done (0044–0049) |
| 2 | Admin advertising dashboard + server actions + i18n | ✅ Done |
| 3 | Vendor Advertising & Promotions dashboard + 4-step creation + checkout | ✅ Done |
| 4 | Customer app dynamic carousel and featured placements + tracking | ✅ Done |
| 5 | End-to-end lifecycle tests, typecheck, production build | ✅ Done (21/21 lifecycle checks) |

Remaining deployment work is environment configuration, not code: set
`ADVERTISING_PAYMENT_WEBHOOK_SECRET` for the signed gateway webhook and
`ADVERTISING_MAINTENANCE_SECRET` (or Vercel `CRON_SECRET`) for the lifecycle
cron. Manual admin verification and promotional credit work today.

---

## 4. Database design (migrations 0044–0049)

- `0044_advertising_system.sql` — enums, vendor advertising columns, all
  advertising tables, indexes, RLS, grants, 10 seeded placements, 30 seeded
  pricing rows, 17 seeded rules.
- `0045_advertising_lifecycle_core.sql` — rule helpers, audit, notifications,
  daily stats, inventory release/capacity/assignment, CPC/CPM charging, creative
  and activation readiness.
- `0046_advertising_delivery.sql` — eligibility, activation, maintenance,
  auto-renew, `advertising_deliver`, stats triggers.
- `0047_advertising_tracking_payments.sql` — click/conversion tracking,
  `advertising_mark_paid`, `advertising_confirm_payment`,
  `advertising_submit_campaign`, `advertising_pay_with_credit`.
- `0048_advertising_vendor_campaigns.sql` — creative validation, create /
  update / duplicate / renew / pause / resume campaign RPCs.
- `0049_advertising_admin_operations.sql` — approval, admin overrides, credit
  grants, maintenance wrapper, function grants/revokes.

### Tables

| Table | Purpose |
| --- | --- |
| `advertising_placements` | Every sellable position (homepage carousel, featured business, featured gift card, search, etc.), its format, capacity, rotation mode and config |
| `advertising_pricing` | Versioned price rows per placement and pricing model (fixed / CPC / CPM). New purchases snapshot the row, so editing a price never changes an existing campaign |
| `advertising_campaigns` | Campaign header: vendor, placement, pricing snapshot, schedule, status, approval, payment, auto-renew, priority, frequency caps |
| `advertising_creatives` | Banner/native copy and destination. Multiple creatives per campaign; the active one is served |
| `advertising_campaign_budgets` | Total budget, daily budget, spend, daily spend and currency |
| `advertising_transactions` | Payment, CPC/CPM charge, refund, credit, renewal, adjustment. Unique provider reference + idempotency key |
| `advertising_ledger_entries` | Separate double-entry-style advertising ledger with signed amounts and balance after |
| `advertising_impressions` | One row per served ad. Only written by the delivery RPC, never by image preload |
| `advertising_clicks` | One row per click, linked to its impression |
| `advertising_conversions` | Attributed order/conversion within the configurable window |
| `advertising_approvals` | Approval history with reviewer, note and checklist |
| `advertising_rules` | Admin-configurable rule values (approval required, attribution window, caps, etc.) |
| `advertising_inventory` | Slot reservations for guaranteed fixed placements and capacity overrides |
| `advertising_promotional_credits` | Ad credits granted by admins, spent FIFO at checkout |
| `advertising_notifications` | Vendor and admin notifications for every lifecycle event |
| `advertising_audit_logs` | Every sensitive advertising action, with before/after payloads |
| `advertising_daily_stats` | Per-campaign daily rollup used by dashboards |

### Campaign states

`draft`, `pending_payment`, `pending_approval`, `scheduled`, `active`, `paused`,
`budget_exhausted`, `completed`, `rejected`, `cancelled`, `refunded`.

### Status automation

`advertising_run_maintenance()` is called by delivery and dashboard reads and can
also be called by an external cron endpoint. It:

- cancels unpaid campaigns after the configured payment window;
- activates scheduled campaigns when their start time arrives, payment is
  verified, approval is granted, the vendor is eligible and capacity exists;
- pauses campaigns that hit their daily budget and auto-resumes them the next
  day;
- marks campaigns `budget_exhausted` when the total budget is spent;
- completes campaigns at `ends_at` and releases inventory;
- pauses campaigns when the advertiser's ad privilege is suspended;
- creates a renewal campaign when `auto_renew` was explicitly authorised.

---

## 5. Payment model

The repository has MyFatoorah edge functions, but no payment provider secret is
configured in the web app. The advertising checkout therefore supports two
server-verified paths:

1. **Promotional credit** — if the vendor has enough ad credit, checkout
   deducts it and activates immediately through `advertising_pay_with_credit`.
2. **Manual / provider verification** — checkout creates a `pending_payment`
   campaign with a unique payment reference. An admin verifies the bank transfer
   or provider reference in the admin dashboard, which calls
   `advertising_confirm_payment`. The same RPC is used by the signed provider
   webhook at `web/app/api/advertising/payment-webhook/route.ts` (HMAC secret
   `ADVERTISING_PAYMENT_WEBHOOK_SECRET`), so a real gateway can be connected
   without changing the lifecycle.

A frontend "success" flag is never trusted.

---

## 6. Key files

### Mobile (Expo)
- `src/components/SponsoredCarousel.tsx` — `SponsoredCarousel` (hero, admin-set
  auto-rotate, manual paging, dots, Sponsored pill, click tracking) and
  `SponsoredStrip` (sponsored business / gift-card rows). Both render nothing
  when the backend returns no ads.
- `app/(customer)/(tabs)/index.tsx` — carousel under the search bar, sponsored
  business strip after featured businesses, sponsored gift-card strip before
  Trending.
- `src/lib/data.ts` — `getAdViewerKey`, `listSponsoredAds`, `trackSponsoredClick`,
  `trackSponsoredConversion`.
- `src/lib/types.ts` — `SponsoredAd`, `SponsoredPlacement`, `AdDestinationType`.
- `src/i18n/en.json` / `ar.json` — `discovery.sponsoredTitle`,
  `sponsoredBusinesses`, `sponsoredGiftCards`, `learnMore`.

### Web
- `web/app/admin/(dashboard)/advertising/*` — overview, campaigns list/detail,
  placements & pricing, advertisers, finance, rules.
- `web/app/vendor/(dashboard)/advertising/*` — overview, new campaign wizard,
  checkout, campaign detail, edit.
- `web/components/CampaignWizard.tsx` — 4-step placement → creative →
  schedule/budget → review, with quote preview and validation.
- `web/lib/actions/advertising.ts` — all vendor and admin server actions.
- `web/app/api/advertising/payment-webhook/route.ts` — signed gateway webhook.
- `web/app/api/advertising/maintenance/route.ts` — lifecycle cron.
- `web/lib/supabase/admin.ts` — service-role client for webhook/cron.
- `web/lib/i18n/admin.ts`, `vendor.ts` — bilingual copy (Arabic typed against
  English).

### Database
- `supabase/migrations/0044_advertising_system.sql` through
  `supabase/migrations/0049_advertising_admin_operations.sql`.

---

## 7. How to apply and verify

The Supabase CLI is not installed. Migrations are applied through the
Management API helper:

```powershell
node "C:\Users\User\AppData\Local\Temp\opencode\sql.mjs" "supabase\migrations\0044_advertising_system.sql"
node "C:\Users\User\AppData\Local\Temp\opencode\sql.mjs" "supabase\migrations\0045_advertising_lifecycle_core.sql"
node "C:\Users\User\AppData\Local\Temp\opencode\sql.mjs" "supabase\migrations\0046_advertising_delivery.sql"
node "C:\Users\User\AppData\Local\Temp\opencode\sql.mjs" "supabase\migrations\0047_advertising_tracking_payments.sql"
node "C:\Users\User\AppData\Local\Temp\opencode\sql.mjs" "supabase\migrations\0048_advertising_vendor_campaigns.sql"
node "C:\Users\User\AppData\Local\Temp\opencode\sql.mjs" "supabase\migrations\0049_advertising_admin_operations.sql"
```

Typecheck and build:

```powershell
# Expo app
node node_modules\typescript\bin\tsc --noEmit

# Web admin/vendor app
cd web
node node_modules\typescript\bin\tsc --noEmit
node node_modules\next\dist\bin\next build
```

`expo lint` currently cannot run because the checkout's `node_modules` is
incomplete (`es-abstract` is missing its package files). TypeScript and the
production build are the active gates until dependencies are reinstalled.

Test login: `test@test.com` / `test12345` (admin). Vendor test users use the
same password (`owner@giftly.test`, `manager@giftly.test`).

Environment variables still to add in the host:

| Variable | Purpose |
| --- | --- |
| `ADVERTISING_PAYMENT_WEBHOOK_SECRET` | HMAC secret for the signed payment webhook |
| `ADVERTISING_MAINTENANCE_SECRET` | Lifecycle cron bearer secret (Vercel `CRON_SECRET` also works) |
| `RESEND_API_KEY` | Real email sending (pre-existing bulk-card gap) |
| `SUPABASE_SERVICE_ROLE_KEY` | Needed in Vercel for the partner webhook |

---

## 8. Lifecycle test checklist (Phase 5)

All items below were verified against the live database on 2026-11-13 using the
transaction-wrapped suite
`C:\Users\User\AppData\Local\Temp\opencode\ad_lifecycle_tests.sql` (21 checks,
all passed). The suite creates test placements/campaigns and rolls everything
back, so it is safe to re-run.

- [x] Vendor approval flow: approval activates a paid campaign.
- [x] Rejection stops delivery, records the reason and notifies the vendor.
- [x] Future campaign stays `scheduled`, then activates at its start time.
- [x] Daily budget pause auto-resumes the next day.
- [x] Total budget exhaustion stops delivery and marks `budget_exhausted`.
- [x] A charge after exhaustion is rejected.
- [x] End date completion releases inventory and notifies the vendor.
- [x] Priority decides the first slot; competing campaigns still rotate.
- [x] Frequency cap and impression dedupe stop repeat delivery to one viewer.
- [x] Single-slot capacity queues a paid campaign and activates it when freed.
- [x] Duplicate payment confirmation does not double-charge or double-activate.
- [x] Full refund closes the campaign and reverses the ledger; over-refund is
      blocked.
- [x] Manual renewal and auto-renew both create an unpaid copy that still needs
      payment verification.
- [x] Suspending ad privileges pauses campaigns without suspending the vendor.
- [x] Empty inventory returns an empty ad list and the app falls back cleanly.
- [x] Live delivery returns the sponsored ad payload the mobile carousel
      expects (headline, image, Sponsored label, destination, pricing model).
- [x] Click tracking returns the canonical destination and charges CPC once.
- [x] Conversion attribution inside the window records a conversion and stats.
- [x] Web typecheck and production build pass; Expo typecheck passes.

Still worth covering manually or with added SQL:
- [ ] Vendor UI wizard validation errors for bad dates, budgets and destinations
      (backend validation is covered by `advertising_validate_creative`).
- [ ] CPM charging at 1,000-impression granularity (CPC path is covered).
- [ ] Conversion outside the attribution window is rejected.
- [ ] Direct RLS probes as an anonymous and a competing vendor user.

---

## 9. Current work log

- 2026-11-13: inspected mobile homepage, data layer, admin/vendor dashboards,
  payment edge functions, migrations 0010–0043. Confirmed there was no existing
  advertising schema beyond the unused `campaigns` / `banners` tables from 0015.
- 2026-11-13: created this document. Next: apply 0044 and 0045, then build the
  admin surface.
- 2026-11-13: applied and verified migrations 0044–0049. Added bilingual admin
  and vendor navigation groups.
- 2026-11-13: built `web/lib/actions/advertising.ts`, all admin advertising
  pages, the vendor Advertising & Promotions pages and the 4-step
  `CampaignWizard`.
- 2026-11-13: added the mobile ad delivery/tracking helpers, sponsored types and
  the `SponsoredCarousel` / `SponsoredStrip` components, wired into the
  homepage.
- 2026-11-13: added the signed payment webhook and lifecycle maintenance cron
  route. Fixed the stale `/admin/advertising/finances` revalidate path.
- 2026-11-13: live delivery check returned the expected sponsored payload; click
  and conversion tracking updated daily stats (2 impressions, 1 click,
  1 conversion).
- 2026-11-13: ran the 21-check transaction-wrapped lifecycle suite — all passed.
- 2026-11-13: Expo typecheck, web typecheck and `next build` all pass. Expo lint
  is blocked by the incomplete `node_modules` install noted above.
- 2026-11-13: runtime smoke test of the production server: signed payment
  webhook reached the database (404 for a non-existent campaign), unsigned
  webhook was rejected (401), unauthenticated maintenance was rejected (401),
  and authenticated maintenance ran successfully (200, all counters zero).

### Handoff notes

- Test admin login: `test@test.com` / `test12345`; admin user id
  `99999999-9999-4999-8999-999999999999`.
- Vendor "The Coffee House" id
  `58852d5f-8486-42fa-a423-b199925159b0`; owner user id
  `22222222-2222-4222-8222-222222222222`; manager id
  `33333333-3333-4333-8333-333333333333`.
- Live test campaign id `27fddfc2-3fc1-4caa-8d25-b72cd1c47c9d`
  ("Test Coffee Weekend", fixed, active, paid, approved).
- Existing `campaigns`, `campaign_placements` and `banners` tables from 0015 are
  unused legacy and were not modified.
- `advertising_confirm_payment` is callable only by an admin JWT or
  `service_role`; internal charge/activation/notify functions are revoked from
  browser roles.
- No advertising payment-gateway secret is configured. Manual admin
  verification is the working production path, and promotional-credit checkout
  is available for immediate activation.
