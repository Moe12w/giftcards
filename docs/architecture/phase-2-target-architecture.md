# Phase 2 — Target architecture, database design and implementation plan

Companion to `phase-1-audit.md`. This is the proposal to approve before implementation begins.

---

## 1. Shape of the solution

```
┌──────────────────────┐   ┌──────────────────────────────────────────┐
│  Expo customer app   │   │        One Next.js web application        │
│  (existing, kept)    │   │                                          │
│  app/  src/          │   │  app/(public)     → company website       │
│                      │   │  app/vendor       → vendor dashboard       │
│  react-native        │   │  app/enterprise   → partner dashboard     │
│  + expo-router       │   │  app/admin        → admin dashboard       │
└──────────┬───────────┘   └──────────────────┬───────────────────────┘
           │                                  │
           │      Supabase Auth (one identity provider)                 │
           └──────────────┬───────────────────┘
                          │
                 ┌────────▼─────────┐
                 │   PostgreSQL     │  RLS on every table
                 │   + Edge Fn      │  append-only ledgers
                 │   + Realtime     │  atomic fulfilment functions
                 └──────────────────┘
```

**One website, one deployment, four route groups.** The vendor/enterprise/admin dashboards are
private sections of the company site, not separate sites. One repo, one Supabase project, one auth
provider.

### 1.1 Repository layout (existing Expo app stays exactly where it is)

```
gift-card-marketplace/
├── app/                     ← EXPO APP (unchanged location)
├── src/                     ← EXPO APP (unchanged location)
├── assets/  babel.config.js  app.json  package.json  tsconfig.json
│
├── web/                     ← NEW Next.js app (company site + 3 dashboards)
│   ├── app/
│   │   ├── (public)/        → /  /vendors  /enterprise  /faq  /contact  /download
│   │   ├── (auth)/          → /vendor/login  /vendor/register  /vendor/forgot-password
│   │   ├── vendor/          → /vendor/dashboard  /onboarding  /products  /orders
│   │   │                     /vouchers  /redeem  /staff  /analytics  /profile
│   │   ├── enterprise/      → /enterprise/dashboard  /products  /inventory
│   │   │                     /reports  /settings
│   │   └── admin/           → /admin/dashboard  /customers  /vendors  /enterprise
│   │                         /products  /orders  /vouchers  /promotions  /settings  /audit
│   ├── components/  lib/  middleware.ts
│   └── package.json
│
├── supabase/
│   ├── migrations/          ← 0001…0009 (existing) + 0010…0019 (new)
│   ├── seed.sql             ← test data for all three fulfilment types
│   └── functions/
│
├── docs/architecture/       ← this plan, schema reference, setup guide
└── packages/shared/         ← generated DB types + shared enums (used by web; mirrored into src/lib/types.ts)
```

The Expo app is **not** moved into a monorepo folder, so Metro, Expo Router and the existing
`@/` alias keep working untouched. `web/` is an independent npm project with its own
`package.json`, `tsconfig.json` and `next.config.ts`.

---

## 2. Database design

### 2.1 Principles

1. **One catalogue.** Every gift card — monetary, experience or enterprise code — is a `product`.
2. **Three fulfilment logics, three code paths.** `monetary`, `experience` and `enterprise_code`
   never share redemption logic. Constraints enforce the separation at the database level.
3. **Ledgers are append-only.** Balances and session counts are *derived*; the cached counter on a
   voucher exists only for query speed and is always written in the same transaction as the ledger row.
4. **Nothing overwritable without a transaction row.** Enforced by trigger, not convention.
5. **Every table is tenant-scoped or user-scoped**, and RLS is the enforcement mechanism.

### 2.2 Entity map

```
                       auth.users
                            │ 1:1
                     ┌──────▼───────┐
                     │   profiles   │  customer profile
                     └──────┬───────┘
                            │
      ┌─────────────────────┼──────────────────────┐
      │                     │                      │
┌─────▼──────┐      ┌───────▼────────┐     ┌───────▼────────┐
│ user_roles │      │ vendor_members │     │enterprise_mem… │
│ (platform) │      │ (vendor staff) │     │ (partner staff)│
└────────────┘      └───────┬────────┘     └───────┬────────┘
                             │                      │
                      ┌──────▼──────┐       ┌───────▼────────┐
                      │   vendors   │       │enterprise_partn│
                      │ (business)  │       │     ers        │
                      └──┬───┬───┬──┘       └───────┬────────┘
                         │   │   │                │
              ┌──────────┘   │   └────────┐  ┌────▼─────────────────┐
              │              │            │  │ enterprise_products  │
      ┌───────▼──────┐  ┌────▼─────┐  ┌──▼──────────────────┐     │
      │   products   │  │categories│  │ product_variants    │     │
      │ (catalogue)  │  │          │  │ (denominations /    │     │
      └──┬────────┬──┘  └──────────┘  │  session packages)  │     │
         │        │                    └──┬──────────────┬──┘     │
         │        │                       │              │        │
    ┌────▼─────┐  │              ┌───────▼──────┐ ┌─────▼──────┐ │
    │product_  │  │              │   vouchers   │ │enterprise_ │ │
    │media     │  │              │ (money +     │ │code_invent.│ │
    └──────────┘  │              │  experience) │ └─────┬──────┘ │
                  │              └───────┬──────┘       │        │
                  │                      │              │        │
                  │        ┌─────────────┼──────────────┤        │
                  │        │             │              │        │
           ┌──────▼────────▼──┐   ┌──────▼──────┐ ┌─────▼──────┐ │
           │      orders      │   │  ledger_    │ │enterprise_ │ │
           │  + order_items   │   │   entries   │ │code_events │ │
           └──────────────────┘   └──────┬──────┘ └────────────┘ │
                                          │                        │
                                   ┌──────▼───────────────────────▼──┐
                                   │          redemptions             │
                                   │ (monetary | session | code_event)│
                                   └──────────────────────────────────┘
```

### 2.3 Table catalogue

#### Core platform

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | Customer profile (extends `auth.users`) | `id` PK→auth.users, `full_name`, `phone`, `email`, `preferred_language`, `is_admin`, `status` (`active`/`suspended`), `created_at`, `updated_at` |
| `user_roles` | Platform-wide role assignment | `user_id` PK, `role` enum, `granted_by`, `granted_at` |
| `user_role_grants` | Extra per-role capabilities | `user_id`, `role`, `permission` text, `allowed` bool |
| `vendors` | Business account | `id`, `owner_id`, `name`, `name_ar`, `slug`, `description`, `logo_url`, `banner_url`, `cover_url`, `category_id`, `city`, `area`, `address`, `website`, `phone`, `email`, `social_handle`, `status` (`draft`/`pending`/`approved`/`rejected`/`suspended`), `commission_bps`, `max_unredeemed_minor`, `created_at`, `updated_at` |
| `vendor_members` | Vendor staff | `vendor_id`, `user_id`, `role` (`owner`/`manager`/`redemption_staff`), `permissions` jsonb, `invited_by`, `created_at`, `active` |
| `vendor_documents` | Business verification uploads | `vendor_id`, `doc_type`, `file_url`, `status`, `reviewed_by`, `reviewed_at` |
| `vendor_applications` | Onboarding wizard state (draft → review → decision) | `vendor_id`, `status` (`started`/`incomplete`/`pending_review`/`approved`/`rejected`/`suspended`), `step`, `payload` jsonb, `submitted_at`, `decided_at`, `decided_by`, `decision_note` |
| `enterprise_partners` | Enterprise partner profile | `id`, `name`, `slug`, `website`, `contact_name`, `contact_email`, `contact_phone`, `industry`, `expected_volume`, `status` (`draft`/`active`/`suspended`), `integration_config` jsonb, `settlement_terms` jsonb, `created_at`, `updated_at` |
| `enterprise_members` | Partner staff | `partner_id`, `user_id`, `role` (`owner`/`manager`/`analyst`), `active`, `created_at` |
| `categories` | Catalogue taxonomy | `id`, `slug`, `name`, `name_ar`, `icon`, `sort_order`, `active` |
| `product_media` | Images & media per product/vendor | `vendor_id`, `product_id`, `url`, `kind` (`logo`/`banner`/`cover`/`gallery`/`product`), `sort_order`, `alt_text` |
| `notifications` | In-app notifications | `id`, `user_id`, `kind`, `title_key`, `body_key`, `payload` jsonb, `read_at`, `created_at` |
| `system_settings` | Platform configuration | `key` PK, `value` jsonb, `description`, `updated_by`, `updated_at` |
| `audit_log` | Immutable change history | `id`, `actor_user_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `before` jsonb, `after` jsonb, `ip`, `created_at` |

#### Product catalogue

| Table | Purpose | Key columns |
|---|---|---|
| `products` | **The shared catalogue.** One row per gift card. | `id`, `vendor_id` **or** `enterprise_product_id`, `category_id`, `fulfilment_type` (`monetary`/`experience`/`enterprise_code`), `name`, `name_ar`, `slug`, `description`, `terms_and_conditions`, `redemption_instructions`, `booking_required` bool, `split_session_allowed` bool, `multi_session_per_visit` bool, `session_count` int, `min_amount_minor`, `max_amount_minor`, `currency`, `expiry_days`, `valid_until`, `published` bool, `featured` bool, `icon`, `tone`, `rating`, `location`, `occasions` text[], `status` (`draft`/`published`/`archived`), `created_at`, `updated_at` |
| `product_variants` | Sellable SKUs — denominations (monetary) or packages (experience). Avoids duplicating a product per price point. | `id`, `product_id`, `kind` (`denomination`/`package`), `label`, `amount_minor`, `session_count`, `price_minor`, `currency`, `terms_and_conditions`, `redemption_instructions`, `booking_required`, `split_session_allowed`, `multi_session_per_visit`, `expiry_days`, `valid_until`, `active`, `sort_order` |

> Why variants: a QAR 100 / 200 / 500 restaurant card is **one product with three denominations**,
> not three products. A 1 / 5 / 10 massage is **one experience product with three packages**.

#### Monetary + experience fulfilment

| Table | Purpose | Key columns |
|---|---|---|
| `vouchers` | Issued voucher instance (monetary **and** experience) | `id`, `voucher_code` (unique, human-readable), `code_hash`, `qr_payload`, `product_id`, `product_variant_id`, `vendor_id`, `order_item_id`, `customer_id`, `recipient_name`, `recipient_email`, `recipient_phone`, `fulfilment_type`, `status` (`issued`/`claimed`/`active`/`partially_redeemed`/`redeemed`/`expired`/`cancelled`/`void`), `initial_value_minor`, `remaining_value_minor`, `total_sessions`, `remaining_sessions`, `used_sessions`, `currency`, `expires_at`, `claimed_by`, `claimed_at`, `delivery_status` (`scheduled`/`delivered`/`opened`), `scheduled_for`, `gift_message`, `created_at`, `updated_at` |
| `ledger_entries` | **Append-only** monetary ledger (existing, extended) | `id`, `voucher_id`, `order_id`, `entry_type` (`issue`/`redeem`/`refund`/`void`/`adjust`), `amount_minor` signed, `sessions` signed, `redemption_id`, `staff_user_id`, `created_at` |
| `redemptions` | Unified redemption history for all types | `id`, `reference` unique, `voucher_id`, `vendor_id`, `staff_user_id`, `kind` (`monetary`/`session`/`enterprise_code`), `amount_minor`, `sessions` int, `quantity` int, `status` (`completed`/`reversed`), `notes`, `occurred_at`, `created_at` |
| `redemption_items` | Line items of one visit (multi-session redemption) | `id`, `redemption_id`, `voucher_id`, `sessions`, `amount_minor`, `service_label`, `staff_user_id` |

#### Enterprise partner + code inventory

| Table | Purpose | Key columns |
|---|---|---|
| `enterprise_products` | Partner-supplied product | `id`, `partner_id`, `name`, `external_ref`, `denomination_minor`, `currency`, `selling_price_minor`, `wholesale_cost_minor`, `commission_bps`, `is_active`, `created_at`, `updated_at` |
| `enterprise_code_inventory` | One row per imported code | `id`, `partner_id`, `enterprise_product_id`, `inventory_ref` unique, `code_ciphertext`, `code_fingerprint` unique (HMAC, for duplicate detection), `import_batch_id`, `denomination_minor`, `currency`, `status` (`available`/`reserved`/`sold`/`delivered`/`redeemed`/`expired`/`invalid`/`cancelled`/`quarantined`), `allocated_order_id`, `allocated_at`, `delivered_at`, `confirmed_redeemed_at`, `expires_at`, `invalid_reason`, `created_at` |
| `enterprise_import_batches` | Import run history | `id`, `partner_id`, `filename`, `source` (`csv`/`xlsx`), `total_rows`, `inserted_rows`, `duplicate_rows`, `invalid_rows`, `status` (`processing`/`completed`/`failed`), `error_report` jsonb, `created_by`, `created_at`, `completed_at` |
| `enterprise_code_events` | Every state change of an inventory code | `id`, `inventory_id`, `partner_id`, `event_type` (`imported`/`reserved`/`allocated`/`sold`/`delivered`/`confirmed_redeemed`/`expired`/`invalidated`/`cancelled`/`reported`), `order_id`, `actor_user_id`, `reason`, `payload` jsonb, `created_at` |

> **Encrypted at rest.** `code_ciphertext` is AES-256-GCM with a key that lives only in the server
> environment (Edge Function / service-role only). `code_fingerprint` = HMAC-SHA256 of the plaintext,
> used for duplicate detection without storing a readable code. Partner users never see the
> plaintext of a code that has been allocated.

#### Orders, gifts, recipients

| Table | Purpose | Key columns |
|---|---|---|
| `orders` | One order = one purchase, many products | `id`, `order_ref` unique, `customer_id`, `status` (`pending`/`paid`/`failed`/`refunded`/`cancelled`), `currency`, `subtotal_minor`, `discount_minor`, `fee_minor`, `total_minor`, `sender_name`, `gift_message`, `delivery_method` (`email`/`sms`/`link`/`in_app`), `scheduled_for`, `payment_status` (`unpaid`/`pending`/`paid`/`failed`/`refunded`), `payment_provider`, `provider_reference`, `paid_at`, `created_at`, `updated_at` |
| `order_items` | One line per product/variant | `id`, `order_id`, `product_id`, `product_variant_id`, `enterprise_product_id`, `quantity`, `unit_price_minor`, `total_minor`, `currency`, `gift_message`, `recipient_name`, `recipient_email`, `recipient_phone`, `delivery_method`, `scheduled_for` |
| `recipients` | Saved gift recipients | `id`, `customer_id`, `name`, `email`, `phone`, `relation`, `created_at` |
| `payment_methods` | Saved payment instruments (token refs only, no PAN) | `id`, `customer_id`, `provider`, `brand`, `last4`, `expiry`, `is_default`, `provider_token` |
| `favourites` | Customer favourites | `customer_id`, `vendor_id`, `product_id`, `created_at` |

#### Promotions & featured placements

| Table | Purpose |
|---|---|
| `campaigns` | `id`, `name`, `kind` (`banner`/`featured_vendor`/`featured_product`/`category_placement`/`homepage_placement`), `starts_at`, `ends_at`, `priority`, `status` (`draft`/`scheduled`/`live`/`ended`), `target_segment` jsonb, `clicks`, `impressions` |
| `campaign_placements` | `campaign_id`, `placement` (`homepage`/`category`/`vendor_page`/`search`), `entity_id`, `sort_order` |
| `banners` | `id`, `campaign_id`, `title`, `subtitle`, `image_url`, `cta_label`, `cta_url`, `active` |

#### Future-ready structures (created now, unused this phase)

`payment_transactions` · `refunds` · `vendor_commissions` · `platform_fees` · `partner_settlements` ·
`financial_ledger` · `webhook_events` · `vendor_invoices`.

Each is created with columns, constraints and RLS, but no application code writes to them.

---

### 2.4 Fulfilment-type enforcement (database-level)

The three fulfilment types are kept apart by **check constraints**, not by convention:

```sql
-- products
check (
  (fulfilment_type = 'monetary'      and session_count is null) or
  (fulfilment_type = 'experience'    and session_count > 0)   or
  (fulfilment_type = 'enterprise_code' and vendor_id is null)
)

-- vouchers
check (
  (fulfilment_type = 'monetary' and total_sessions is null
                          and remaining_sessions is null) or
  (fulfilment_type = 'experience' and total_sessions > 0
                          and remaining_sessions between 0 and total_sessions)
)

-- an experience voucher must never carry a monetary balance
check (remaining_value_minor is null or remaining_value_minor = 0)
```

The redemption functions are separate, so a session redemption can never touch money and a
monetary redemption can never touch sessions:

- `redeem_monetary(p_voucher_id, p_amount_minor)` → writes a `ledger_entries` row with a signed
  `amount_minor` and `sessions = 0`.
- `redeem_session(p_voucher_id, p_sessions, p_notes)` → writes a `ledger_entries` row with
  `sessions = -n` and `amount_minor = 0`.
- `confirm_enterprise_redemption(p_inventory_id)` → writes an `enterprise_code_events` row.
  **Sold/delivered never implies redeemed.**

All three take `for update` row locks, verify the caller is allowed to act on that vendor/partner,
verify the remaining balance/sessions, write the history row **and** update the cached counter in
the same transaction, and raise on insufficient balance / no sessions left.

---

### 2.5 Roles and access control

| Role | Scope | Can do |
|---|---|---|
| `customer` | own data | browse, buy, claim, manage own gift vouchers and orders, join baskets |
| `vendor_owner` | one vendor | everything the vendor can do, incl. staff, payout settings, delete vendor |
| `vendor_manager` | one vendor | products, orders, vouchers, redeem, staff invitations (not owner transfer / commission) |
| `vendor_redemption_staff` | one vendor | redeem vouchers only |
| `enterprise_user` | one partner | own products, inventory, imports, reports |
| `admin` | platform | everything, incl. approvals, promotions, audit, impersonation-free admin actions |

**Implementation:**

```sql
create type public.app_role as enum
  ('customer','vendor_owner','vendor_manager','vendor_redemption_staff',
   'enterprise_user','admin');

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now()
);
```

Helper functions used by every policy (all `security definer`, `stable`):

```sql
public.is_admin()                              -- already exists
public.has_role(r public.app_role)
public.is_vendor_member(p_vendor_id uuid, p_roles app_role[])
public.vendor_role(p_vendor_id uuid)          -- role of the caller in that vendor
public.can_redeem_for(p_vendor_id uuid)       -- owner | manager | redemption_staff
public.is_enterprise_member(p_partner_id uuid, p_roles app_role[])
```

**RLS rules by table family**

| Table family | Policy |
|---|---|
| `profiles` | select/update own; admin sees all |
| `vendors` | approved vendors are public-readable; a vendor updates only its own row; admin approves |
| `products` | published products public-readable; vendor writes only its own; `enterprise_code` products are read through the partner's published catalogue |
| `product_variants` | inherits product visibility |
| `vouchers` | customer sees own (buyer or recipient account); vendor sees only vouchers for **its own** vendor; admin sees all |
| `ledger_entries` | customer sees own voucher's history; vendor sees its own; **insert-only, append-only trigger** |
| `redemptions` | vendor sees its own; customer sees own voucher redemptions; admin sees all |
| `enterprise_code_inventory` | partner sees own rows; **plaintext code column is service-role only** — no select policy grants `code_ciphertext` to partner users, only masked metadata |
| `orders` / `order_items` | customer sees own; vendor sees items for its own products; admin sees all |
| `vendor_applications` | applicant + admin; vendor owner sees own once submitted |
| `audit_log` | admin only; insert-only |
| `system_settings` | admin write; public read for non-sensitive keys |

**Security requirements honoured**

- Vendor data isolation — every vendor-scoped table has `vendor_id` and a policy that resolves the
  caller's membership in that vendor.
- Enterprise isolation — every partner-scoped table has `partner_id` with the same pattern.
- Secure code storage — enterprise codes are AES-GCM encrypted; only the service role can decrypt.
- Server-side validation — redemption, allocation and issuance are `security definer` functions
  with `search_path = public` and `revoke execute from public`.
- Audit logs — trigger-based writes on every sensitive table + explicit `audit_log` table.
- Secrets never reach the app — only the anon key is in the client bundle; `service_role_key` lives
  in Edge Function secrets only.

---

## 3. Website and dashboard routes

### 3.1 Public company website — `(public)`

| Route | Content |
|---|---|
| `/` | Hero ("Gifts are better together"), how it works (buy → send → redeem), the three card types, business benefits, enterprise partnerships, app download links, FAQ teaser, contact |
| `/vendors` | Why join, how gift cards work, product management, redemption, monetary vs experience, CTA → `/vendor/register` |
| `/enterprise` | Bulk code model, how partnerships work, enquiry form (company, website, contact, industry, expected volumes, products/denominations, integration needs) |
| `/faq` · `/contact` · `/download` | Supporting pages |

### 3.2 Vendor auth — `(auth)`

`/vendor/login` · `/vendor/register` · `/vendor/forgot-password` · `/vendor/reset-password`
· `/vendor/onboarding` (7-step wizard: business → category → location → contact → media → legal →
review) · `/vendor/onboarding/status` (application status).

Registration creates a `vendor_applications` row in `started`/`incomplete`, so a vendor can save and
return. On submit → `pending_review`; only an **approved** vendor can publish products.

### 3.3 Vendor dashboard — `vendor/`

`/vendor/dashboard` (overview) · `/vendor/products` (+ `/vendor/products/new`,
`/vendor/products/[id]`) · `/vendor/orders` · `/vendor/vouchers` (+ `/vendor/vouchers/[id]`) ·
`/vendor/redeem` (QR scanner + manual entry) · `/vendor/staff` · `/vendor/analytics` ·
`/vendor/profile` · `/vendor/settings`.

### 3.4 Enterprise dashboard — `enterprise/`

`/enterprise/dashboard` · `/enterprise/products` · `/enterprise/inventory`
(+ `/enterprise/inventory/import`, `/enterprise/inventory/batches/[id]`) · `/enterprise/reports`
(+ redemption-report import) · `/enterprise/settings` · `/enterprise/login`.

### 3.5 Admin dashboard — `admin/`

`/admin/dashboard` · `/admin/customers` (+ `[id]`) · `/admin/vendors` (+ applications, `[id]`) ·
`/admin/enterprise` (+ partners, products, inventory, batches) · `/admin/products` (+ categories) ·
`/admin/orders` · `/admin/vouchers` · `/admin/promotions` (+ banners, placements) ·
`/admin/settings` · `/admin/audit` · `/admin/login`.

### 3.6 Route protection

Next.js middleware + per-layout server checks:

- `/vendor/*` → requires a `vendor_members` row for the vendor; owner/manager see staff screens.
- `/enterprise/*` → requires an `enterprise_members` row for the partner.
- `/admin/*` → requires `user_roles.role = 'admin'`.
- The Expo app stays the only customer surface; the website has no customer login in this phase
  (the brief only asks the website for vendor/enterprise/admin auth) — but the same Supabase
  Auth is used, so a customer account works if added later.

---

## 4. Implementation plan

Each stage ends with a working, testable increment and a report.

| # | Stage | Deliverables | Gate to pass next |
|---|---|---|---|
| **1** | ✅ Audit | `docs/architecture/phase-1-audit.md` | — |
| **2** | ⏳ This proposal | `phase-2-target-architecture.md` + this document | **Approval** |
| **3** | Schema migration 0010–0016 | New/changed tables, `products` catalogue, variants, vouchers, unified redemptions, enterprise inventory, roles, promotions, future-money tables, all RLS, all indexes | `supabase db reset` clean; RLS matrix test passes |
| **4** | Backend functions | `redeem_monetary`, `redeem_session` (atomic, staff-aware), `confirm_enterprise_redemption`, `allocate_enterprise_code`, `import_enterprise_codes`, `issue_voucher`, `fulfill_order` (extended), `audit` triggers, `verify_balances()` | pgTAP tests for atomicity, over-redemption prevention, duplicate allocation, permission matrix |
| **5** | Seed + test accounts | `supabase/seed.sql`: 12 vendors, ~50 products (monetary + experience), customers, enterprise partner with 500 codes, staff, orders, vouchers, redemptions | Every dashboard and the app show real rows |
| **6** | Company website | `web/` Next.js app, `(public)` routes, design system lifted from the Expo theme, responsive | Responsive review at 375/768/1440; Lighthouse ≥ 90 on public pages |
| **7** | Vendor registration + onboarding | register, login, password reset, 7-step wizard, application status | A vendor can register unaided and see "pending review" |
| **8** | Vendor dashboard | overview, profile, products CRUD + media upload, orders, vouchers, redemption (QR + manual + multi-session), staff, analytics | Vendor publishes a product → it appears in the app and website |
| **9** | Enterprise dashboard | products, CSV/XLSX import with validation + duplicate detection + failed-row report, inventory by status, batches, allocation, sales reports, redemption-report import, exports | Duplicate codes rejected; allocation is atomic; partner sees only own data |
| **10** | Admin dashboard | overview, customers, vendor applications approve/reject, enterprise management, products, orders, vouchers, promotions, settings, audit log | An admin can run the platform without touching SQL |
| **11** | Connect the Expo app | `data.ts` → `products`; real `cards.tsx` / `baskets.tsx` with Supabase; claim flow uses the real token; notifications, recipients, locations, favourites; realtime baskets | The app runs fully on live data with no mock import |
| **12** | End-to-end QA | SQL test suite, Vitest for shared rules, Playwright for web flows, manual device pass on iOS + Android | Test matrix in §6 green |

### 4.1 Key design decisions to confirm before coding

1. **`products` replaces `offers`** in the catalogue (a view `offers` keeps the legacy shape for
   backwards compatibility). The mobile app's `Offer` TypeScript type stays as-is; only the
   query in `data.ts` changes. *Alternative: keep the table named `offers`.*
2. **`web/` lives inside the existing repo** rather than a separate monorepo, to avoid touching the
   Expo Metro config.
3. **One Next.js deployment** serves the public site and all three dashboards, separated by route
   groups and role middleware.
4. **Enterprise codes are encrypted at rest** with AES-256-GCM; the partner dashboard shows only
   masked values (`••••1234`) for allocated codes.
5. **Payment processing, KYC and settlement stay structure-only** — no provider integration in
   this phase, as the brief requires.

---

## 5. Out of scope for this phase (per the brief)

Payment processing and provider integration · KYC / external verification · commission payouts and
partner settlement execution · enterprise redemption reconciliation webhooks/APIs (structure and
manual report import only) · wallet pass generation (structure exists, `.pkpass` build is TODO) ·
refunds and financial ledger execution (tables only).

---

## 6. Test matrix (Phase 8 of the brief)

| Area | Tests |
|---|---|
| Database | relationships; RLS isolation (customer/vendor/partner/admin); duplicate prevention; encrypted code storage; atomic redemption; audit rows |
| Monetary | create product → issue voucher → QR → partial redeem → full redeem → remaining balance correct → every step in the ledger |
| Experience | 1-session and 5-session products → issue → redeem 1 → redeem 3 in one visit → remaining correct → over-redemption rejected → fully-redeemed state |
| Enterprise | CSV/XLSX upload → duplicate detection → denomination validation → allocation → no double allocation → inventory statuses → redemption report import |
| Website | public pages, vendor register, onboarding, login, password recovery, application status, vendor permissions, product CRUD, browser QR redemption |
| Admin | approvals, vendor/partner/product/voucher management, promotions, audit visibility |
| Expo app | login, live marketplace, product detail, vendor profile updates, wallet updates, voucher status updates, order + gift history |

Execution roles: one customer, one vendor owner, one vendor manager, one redemption staff member,
one enterprise partner user, one admin.

---

## 7. Open questions for the user

1. **Supabase project** — do you already have a hosted project to use, or should the work target
   a local Supabase stack (Docker) first? A hosted project is needed for the public website and
   the app to share a live database.
2. **Deployment target for the website** — Vercel is the simplest fit for Next.js; any Node host
   works if you prefer something else.
3. **Catalogue naming** — `products` (proposed) vs keeping `offers`.
4. **Enterprise code visibility** — proposed: partners see masked codes only for allocated stock;
   confirm.
