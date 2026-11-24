# Advertising

This document explains the advertising product in plain English. It replaces the older `ADVERTISING_SYSTEM_PLAN.md`, which is stale.

## What advertising is

Advertising is **slot rental**, not bidding and not an auction.

Tazilla owns advertising areas called **placements** — for example the homepage hero carousel, a carousel for a category, a carousel for a collection, search results, and gift-card pages. Each placement has numbered **slots**. Slot 1 is the best position and costs more.

An advertiser chooses:
- a placement,
- a slot number,
- a number of consecutive **6-hour periods** (1–120),
- a creative (headline, image, destination).

The price is `slot price × number of periods`. The ad appears in exactly that slot during exactly that window. Empty slots simply show fewer ads — nothing rotates automatically.

Advertising money is kept in its own ledger. It never mixes with gift-card sales or vendor balances.

## Who can advertise

| User | How it works |
|---|---|
| Vendor | Advertising is enabled by default (`vendors.advertising_enabled`). Owner/manager can create campaigns. |
| Enterprise partner | A hidden "shell vendor" is created automatically on first use (`slug = adv_<partner-slug>`). All advertising code still uses a `vendor_id`. |
| Admin | Sets placements and prices, approves campaigns, suspends advertisers, grants credits, handles refunds and configures MyFatoorah. |

There is no advertiser signup. There are no Expo screens for managing ads — the mobile app only **renders** ads returned by the delivery function.

## Lifecycle

1. **Draft** — the campaign wizard saves a draft with placement, pricing, name and creative (`advertising_save_draft`).
2. **Book a window** — `advertising_update_campaign` chooses a slot and periods using `advertising_next_slot_window`. A 2-minute hold prevents two people paying for the same slot.
3. **Approval** — admin reviews the campaign (`advertising_review_campaign`). By default approval is required.
4. **Payment** — MyFatoorah card payment (primary) or promotional credit (admin-granted). Manual bank transfer is disabled.
5. **Confirmation** — callback and webhook both re-query MyFatoorah, then call the idempotent `advertising_confirm_payment`.
6. **Activation** — `advertising_try_activate` checks payment, approval, vendor status, creative, placement and slot availability. It becomes `active` or `scheduled`.
7. **Delivery** — `advertising_deliver` returns ads ordered by slot number and records impressions. Clicks and conversions are tracked separately.
8. **Maintenance** — a daily job cancels unpaid campaigns, completes ended ones, exhausts budgets, resumes paused ones and activates scheduled ones.
9. **Refund** — admin-only, capped at the campaign quote; posts a refund transaction and ledger debit.

Auto-renew exists in the database but the UI never enables it. CPC/CPM exist in old enums and tables but are unused; all real pricing is fixed per slot.

## Web pages

### Vendor and enterprise (same structure)

| Route | Purpose |
|---|---|
| `/vendor/advertising` or `/enterprise/advertising` | Overview, KPIs, notifications, tutorial, new campaign button |
| `.../new` | Four-step campaign wizard |
| `.../campaigns` | Campaign list |
| `.../campaigns/[id]` | Detail, stats, pause/resume/duplicate/renew |
| `.../campaigns/[id]/edit` | Re-open the wizard for a draft |
| `.../checkout/[id]` | Order summary, 2-minute countdown, pay by card or credit |

Enterprise pages use the same code path via `requireAdvertiser()`, which resolves a partner to its shell vendor.

### Admin

| Route | Purpose |
|---|---|
| `/admin/advertising` | Revenue overview, pending approvals, run maintenance |
| `/admin/advertising/campaigns` | All campaigns |
| `/admin/advertising/campaigns/[id]` | Approve/reject and overrides (pause, resume, extend, refund, credit, feature) |
| `/admin/advertising/placements` | Placements, slot prices, allowed models, config |
| `/admin/advertising/advertisers` | Enable/suspend advertising, grant promotional credit |
| `/admin/advertising/rules` | Edit live rules (approval requirement, expiry hours, etc.) |
| `/admin/advertising/finance` | Advertising transactions and ledger only |
| `/admin/advertising/payments` | MyFatoorah API key, webhook secret, app URL |

## Money flow

- `payAdvertisingWithMyFatoorah` reads `quote_amount_minor` from the database — never from the form.
- `createMyFatoorahInvoice` (in `web/lib/myfatoorah.ts`) creates a v2 invoice with `CustomerReference = campaign.id`.
- `advertising_start_checkout` creates a pending `advertising_transactions` row and refreshes the hold.
- Confirmation re-queries `GetPaymentStatus`; a browser redirect alone never marks a campaign paid.
- `advertising_confirm_payment` is idempotent: already-paid campaigns short-circuit, a provider reference can only settle one campaign, and ledger entries dedupe on `entry_key`.
- Ledger entries: `payment_received` (credit) and `fixed_placement_charge` (debit).

### Differences from gift-card payments

| | Advertising | Gift cards |
|---|---|---|
| Webhook | Next.js API route | Supabase Edge Function |
| Dedupe table | `payment_events` | `webhook_events` |
| Settings key | `advertising.myfatoorah` | `payments.myfatoorah` |
| Money table | `advertising_transactions` + ledger | `myfatoorah_payments` + allocations |
| Supplier split | None | One allocation per vendor/partner |
| Wallet | Not touched | Interacts with orders/vouchers |

## Important tables

| Table | Purpose |
|---|---|
| `advertising_placements` | Surfaces, slot count, slot prices |
| `advertising_pricing` | Versioned pricing rules |
| `advertising_campaigns` | Campaign header, status, payment status, slot, window |
| `advertising_creatives` | Ad content and destination |
| `advertising_campaign_budgets` | Budgets and spend (mostly legacy) |
| `advertising_transactions` | Payments, charges, credits, refunds |
| `advertising_ledger_entries` | Running balance for advertising only |
| `advertising_impressions`, `clicks`, `conversions` | Tracking |
| `advertising_inventory` | Slot occupancy |
| `advertising_promotional_credits` | Admin-granted free credit |
| `advertising_rules` | Live configuration flags |
| `advertising_notifications`, `advertising_audit_logs`, `advertising_daily_stats` | UI notifications, audit, reporting |

## Campaign statuses

`draft`, `pending_payment`, `pending_approval`, `scheduled`, `active`, `paused`, `budget_exhausted`, `completed`, `rejected`, `cancelled`, `refunded`.

A campaign has both `status` (lifecycle) and `payment_status` (`unpaid`, `pending`, `paid`, `failed`, `refunded`).

## Maintenance

`advertising_run_maintenance` is called:
- daily by `/api/cron` at 00:05 UTC,
- inline by delivery so expired campaigns are never served.

It cancels unpaid campaigns after `payment_expiry_hours` (default 48), completes ended campaigns, exhausts budgets, resumes paused ones and activates scheduled ones.

## Permissions

- `requireAdvertiser()` allows vendor owner/manager or enterprise partner owner/manager.
- `requireAdmin()` guards all admin pages and actions.
- `advertising_can_manage_vendor` in SQL is the database-level equivalent.
- Delivery and tracking helpers are callable without a login so the public website/mobile app can show ads.

## Gotchas for the new developer

1. **Read the highest-numbered migration.** `advertising_update_campaign` was rewritten many times. `0114` is current.
2. `ADVERTISING_SYSTEM_PLAN.md` is stale — manual bank transfer is disabled.
3. `0114_...sql` and `0115_...sql` have wrong header comments.
4. `advertising_create_campaign` is dead; the wizard uses `save_draft` + `update_campaign`.
5. `advertising_submit_campaign` is a stub that raises `manual_payment_disabled`.
6. CPC/CPM code is legacy; all active placements are fixed price.
7. The comment in `0057` saying "index 0 = slot 1" is wrong. Code uses 1-based `slot_number`.
8. Two MyFatoorah settings exist: advertising uses `advertising.myfatoorah` (Next.js webhook); gift cards use `payments.myfatoorah` (Edge Function webhook). Don't mix them.
9. Old docs say "6–72 hours"; current code books N × 6-hour periods.

## Glossary

- **Placement** — an advertising area.
- **Slot** — numbered position inside a placement; slot 1 is premium.
- **Period** — one 6-hour block.
- **Hold** — 2-minute reservation during checkout.
- **Campaign** — one paid rental: placement + slot + window + creative.
- **Creative** — the ad content and where it links.
- **Inventory** — occupancy record for a slot/window.
- **Impression / click / conversion** — tracking events.
- **Promotional credit** — admin-granted free balance.
- **Shell vendor** — hidden vendor row representing an enterprise partner in the ad system.
