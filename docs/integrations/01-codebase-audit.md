# Phase 1 — Existing architecture audit

**Project:** universal external-platform gift-card payment integration
**Audit date:** 2026-11-27
**Scope:** the whole repository, with emphasis on gift cards, business identity,
payments, redemption, refunds, integrations, API conventions and tests.
**Rule observed:** no application code or database object was modified during
this phase. Only this documentation was created.

---

## 0. Executive summary

Tazella is a three-part monorepo:

| Part | Folder | Technology | Users |
|---|---|---|---|
| Customer mobile app | `app/`, `src/` | Expo SDK 58 / React Native 0.88 / Expo Router | Customers |
| Web app | `web/` | Next.js 16.4 (App Router), React 19 | Vendors, enterprise partners, bulk buyers, admins, public site |
| Backend | `supabase/` | Postgres + RLS + `SECURITY DEFINER` RPCs + Edge Functions | All |

The gift-card engine is **already suitable as the core of the integration
network**, with three gaps that must be filled additively:

1. **No reservation/hold concept.** Redemption is immediate. Concurrent external
   checkouts could overspend the same balance.
2. **No external identity layer.** There is no platform registry, vendor mapping
   or branch mapping.
3. **No standardized external API or SDK.** The existing RPCs are designed for
   authenticated vendor staff, not server-to-server platform callers.

Everything else — voucher records, ledger-derived balances, ownership, expiry,
partial/full redemption, refunds, audit log, webhook deduplication, rate
limiting and the admin/business dashboards — can be reused.

**Critical finding:** the existing redemption RPCs authorise the caller with
`auth.uid()` (`can_redeem_for(vendor_id)`). A service-role platform caller has no
`auth.uid()`, so external redemption cannot call `redeem_monetary()` unchanged.
The correct extension is to extract the ledger write into an internal
vendor-scoped function and keep `redeem_monetary()` as the authenticated wrapper,
preserving current behaviour for every existing caller.

---

## 1. Application architecture

### 1.1 Runtime layout

- **Mobile:** `app/` is the Expo Router route tree. Non-route code lives in
  `src/` (`src/lib/data.ts`, `src/lib/cards.tsx`, `src/lib/types.ts`).
- **Web:** `web/app/` uses route groups:
  - `web/app/(app)/admin/(dashboard)/` — admin portal
  - `web/app/(app)/vendor/(dashboard)/` — vendor portal
  - `web/app/(app)/enterprise/(dashboard)/` — partner portal
  - `web/app/(app)/business/(portal)/` — bulk buyer portal
  - `web/app/(app)/api/` — Next.js route handlers
  - `web/app/[locale]/(site)/` — public marketing site
- **Backend:** `supabase/migrations/` (0001–0173) and `supabase/functions/`
  (`create-payment`, `create-bulk-payment`, `create-basket-payment`,
  `payment-webhook`, `mcp`, `claim-preview`, `basket-claim-preview`,
  `wallet-pass`, `supplier-onboard`, `sync-myfatoorah-suppliers`,
  `upload-supplier-document`, `auth-gate`, `_shared/`).
- **No workspace/monorepo tooling.** Root `package.json` is the Expo app;
  `web/package.json` is separate. There is no `packages/` workspace yet.

### 1.2 Database conventions

- Money is **integer minor units** (`bigint`, fils). Never floats.
- Financial balances are **derived from append-only ledgers**, with cached
  counters kept in sync:
  - gift-card value: `ledger_entries` → `card_balances` view
  - cached: `vouchers.remaining_value_minor`, `vouchers.remaining_sessions`
  - seller money: `financial_ledger` → `vendor_financial_balances` /
    `partner_financial_balances`
- Financial writes happen in `SECURITY DEFINER` RPCs, not direct browser writes.
- `ledger_entries`, `financial_ledger` and `audit_log` are append-only
  (`prevent_ledger_mutation`, `prevent_audit_mutation` triggers).
- RLS is enabled on essentially every table. Service-role is used only in
  server-only route handlers/Edge Functions.
- Historical migrations are never edited; every change is a new numbered file.

### 1.3 Auth model

- Supabase Auth (`auth.users`) plus `profiles`.
- `user_roles` holds one platform role: `customer`, `vendor_owner`,
  `vendor_manager`, `vendor_redemption_staff`, `enterprise_user`, `admin`.
- Business membership:
  - `vendor_members (vendor_id, user_id, role, permissions, active)`
  - `enterprise_members (partner_id, user_id, role, active)`
- Permission helpers (`0010_core_platform.sql`):
  - `is_admin()`
  - `vendor_member_role(vendor_id)`, `is_vendor_member(vendor_id)`
  - `can_manage_vendor(vendor_id)` (owner/manager/admin)
  - `can_redeem_for(vendor_id)` (any active member/admin)
  - `enterprise_member_role`, `is_enterprise_member`, `can_manage_partner`

### 1.4 API conventions

- **Next.js route handlers** live under `web/app/(app)/api/...` and are used for
  webhooks and provider confirmation, e.g.:
  - `web/app/(app)/api/partner-webhook/route.ts`
  - `web/app/(app)/api/merchant-payment/confirm/route.ts`
  - `web/app/(app)/api/merchant-payment/callback/route.ts`
  - `web/app/(app)/api/advertising/myfatoorah/webhook/route.ts`
  - `web/app/(app)/api/cron/route.ts`
- **Supabase Edge Functions** are used for checkout invoice creation and
  provider onboarding, e.g. `create-payment`, `create-bulk-payment`.
- Route handlers use `createAdminClient()` (`web/lib/supabase/admin.ts`), a
  server-only service-role client. It must never be imported into client code.
- Authentication patterns already in use:
  - service-role or `INTERNAL_API_KEY` with constant-time comparison
    (`merchant-payment/confirm`)
  - hashed partner API keys (`enterprise_api_keys.key_hash`) with
    `x-api-key` / `Authorization: Bearer`
  - HMAC in wallet passes (`supabase/functions/_shared/wallet/token.ts`)
  - cron bearer secret (`CRON_SECRET`)
- Webhook deduplication: `webhook_events` with unique
  `(provider, event_id)` (`0015_promotions_and_finance.sql`).
- Rate limiting: `auth_attempts` + `claim_rate_limit(key, max, window)` and
  `request_client_ip()` (`0140_claim_preview_rate_limit.sql`).

---

## 2. Business and branch model

### 2.1 Two business kinds, one identity surface

| Kind | Table | Who issues the code | Gift cards |
|---|---|---|---|
| Vendor | `vendors` | Tazella | `vouchers` with `fulfilment_type = 'monetary'` or `'experience'` |
| Enterprise partner | `enterprise_partners` | The partner | partner code inventory, not Tazella vouchers |

`vendors` key columns (`0001_initial_schema.sql`, extended later):
`id`, `owner_id`, `name`, `name_ar`, `description`, `logo_url`, `banner_url`,
`status` (`pending|approved|rejected|suspended`), `commission_bps`,
`max_unredeemed_minor`, `myfatoorah_supplier_code`, `city`, `area`,
`category_id`, timestamps.

`enterprise_partners` key columns (`0010_core_platform.sql`):
`id`, `owner_id`, `name`, `slug`, `status` (`draft|active|suspended`),
`integration_config jsonb`, `settlement_terms jsonb`, `logo_url`,
`banner_url`, timestamps.

`marketplace_businesses` (`0036_partners_are_businesses.sql`) unions both for
public/catalogue use. It is a view, not a second identity table.

### 2.2 Branches

- `vendor_locations` (`0016_customer_data.sql`):
  `id`, `vendor_id`, `area`, `address`, `hours`, `latitude`, `longitude`,
  `is_primary`, `created_at`.
- Branches have their own UUID, but **no external identifier column**.
- Enterprise partners have no branch table.
- The mobile app reads branches through `listVendorLocations()` in
  `src/lib/data.ts`.

### 2.3 Ownership and permissions

- Vendor ownership is `vendors.owner_id` plus `vendor_members`.
- `can_redeem_for(vendor_id)` is the gate used by redemption.
- Business dashboards are gated by `requireVendor()` in `web/lib/auth.ts`.
- Admin dashboards are gated by `requireAdmin()`.

### 2.4 Existing external connection surface

There is **no vendor/platform mapping table** and **no platform registry**.

Existing adjacent structures:

| Object | What it does | Reusable? |
|---|---|---|
| `enterprise_partners.integration_config jsonb` | Reserved partner API/webhook config | No — partner-scoped, not a platform registry |
| `products.external_ref text` | Free-text partner product reference | No |
| `enterprise_api_keys` | Hashed keys for partner code-usage webhook | Pattern only |
| `webhook_events` | Provider webhook dedupe | Yes |
| `auth_attempts` + `claim_rate_limit` | Rate limiting | Yes (pattern) |
| `system_settings` | Runtime config, including encryption key | Yes |
| `audit_log` + `write_audit()` | Append-only audit | Yes |

`enterprise_api_keys` is still present, but its create/revoke RPCs were dropped
as dead code in `0125_remove_dead_features.sql`. The table and
`hash_enterprise_api_key()` are still used by the partner webhook route.

---

## 3. Gift-card lifecycle

### 3.1 Tables

**`vouchers`** (renamed from `gift_cards` in `0012_vouchers_and_orders.sql`):

| Column | Meaning |
|---|---|
| `id` | voucher UUID |
| `voucher_code` | human-readable code, e.g. `GFT-AB12CD34EF` (unique) |
| `card_code_hash` | SHA-256 of the code (unique where not null) |
| `product_id`, `product_variant_id` | catalogue origin |
| `order_id`, `order_item_id` | purchase origin |
| `buyer_id`, `claimed_by`, `claimed_at` | ownership |
| `vendor_id` | issuing business (canonical business id) |
| `fulfilment_type` | `monetary` or `experience` |
| `status` | `issued`, `claimed`, `active`, `partially_redeemed`, `redeemed`, `expired`, `cancelled`, `void` |
| `initial_value_minor` | face value |
| `remaining_value_minor` | cached balance (monetary only) |
| `total_sessions`, `remaining_sessions`, `used_sessions` | experience only |
| `currency` | default `QAR` |
| `expires_at` | validity |
| `claim_token_hash` | claim link token hash |
| `redeemed_at`, `created_at`, `updated_at` | timestamps |

Constraint `vouchers_fulfilment_shape` enforces money **or** sessions, never both.

**`ledger_entries`** (append-only; `0001` + `0013`):

| Column | Meaning |
|---|---|
| `voucher_id` | voucher |
| `order_id` | purchase order, when relevant |
| `entry_type` | `issue`, `redeem`, `refund`, `void` |
| `amount_minor` | signed minor units; positive increases balance |
| `sessions` | signed session count |
| `redemption_id` | link to `redemptions` |
| `staff_user_id` | actor, when a person |
| `created_at` | timestamp |

**`card_balances`** view: `sum(amount_minor)` and `sum(sessions)` per voucher.

### 3.2 Issuance

- Purchase path: `myfatoorah_fulfill_order()` → `issue_gift_card()` /
  `issue_session_card()`.
- `issue_gift_card()` generates a code with `generate_voucher_code()`, stores
  the code and its hash, inserts the voucher and an `issue` ledger entry.
- Admin manual issue: `0101_admin_manual_voucher.sql`.
- Bulk: `bulk_fulfill_from_payment` / `bulk_fulfill_order` (0042, 0138, 0150).
- Partner codes are a different product (`enterprise_code_inventory`), not
  Tazella vouchers.

### 3.3 Validity and status rules

A voucher is redeemable when:

```text
status in ('claimed','issued','active','partially_redeemed')
and (expires_at is null or expires_at > now())
and balance > 0            (monetary)
    or sessions > 0        (experience)
```

`voucher_for_redemption()` returns `can_redeem` and `blocked_reason`.
`0156_uniform_voucher_errors.sql` deliberately collapses "not found" and
"not allowed" into one message to prevent a cross-tenant existence oracle.

### 3.4 Expiry

- Enforced at redemption time by comparing `expires_at` with `now()`.
- No background job was found that flips `status` to `expired`.
- There is no reservation expiry because there are no reservations.

---

## 4. Existing redemption flow

### 4.1 Entry points

| Entry point | Function | Caller |
|---|---|---|
| Vendor types a code | `redeem_voucher_by_code(code, amount, sessions, notes)` | authenticated vendor staff |
| Vendor scans a QR/id | `redeem_voucher_by_id(voucher_id, amount, sessions, notes)` | authenticated vendor staff |
| Internal monetary | `redeem_monetary(voucher_id, amount, notes)` | authenticated staff/admin |
| Internal sessions | `redeem_sessions(voucher_id, sessions, notes, label)` | authenticated staff/admin |
| Convenience | `redeem_session(voucher_id)` | authenticated staff/admin |

### 4.2 `redeem_monetary()` step by step (`0013_redemptions.sql`)

1. Reject `amount <= 0`.
2. `select ... from vouchers where id = ... for update` — row lock.
3. Reject non-monetary vouchers.
4. Authorise: `can_redeem_for(v_voucher.vendor_id)` using `auth.uid()`.
5. Reject status not in the redeemable set.
6. Reject expired.
7. Sum `ledger_entries.amount_minor` for the voucher.
8. Reject zero balance and insufficient balance.
9. Generate `RDM-XXXXXXXXXX` reference.
10. Insert `redemptions` (kind `monetary`, amount, vendor, staff).
11. Insert `redemption_items`.
12. Insert `ledger_entries` (`entry_type = 'redeem'`, negative amount,
    `redemption_id`, `staff_user_id`).
13. Update `vouchers`: status `redeemed` + `redeemed_at` + cached zero, or
    `partially_redeemed` + cached new balance.
14. `write_audit('monetary_redemption', ...)`.
15. Return redemption id, reference, new balance, new status.

This is a single Postgres transaction. It is correct and safe for concurrent
spending because of the `FOR UPDATE` lock and the ledger sum.

### 4.3 What it does not do

- No reservation, hold or two-phase capture.
- No idempotency key. Repeating a call deducts twice.
- No external caller identity, channel or platform reference.
- No distinction between staff redemption and external checkout redemption.
- No partial-capture expiry semantics.

---

## 5. Refunds and reversals

Two different refund concepts exist and must not be confused:

### 5.1 Purchase refund (seller ledger)

- `myfatoorah_refunds` stores provider refund requests.
- Refund path writes a negative `financial_ledger` entry (`entry_type =
  'refund'`) per seller (`0134_refunds_per_seller.sql`).
- Trigger `financial_ledger_refund_vouchers` (`0135`) calls
  `reduce_voucher_value_for_refund(vendor_id, order_id, amount)`, which writes a
  negative `ledger_entries` entry (`entry_type = 'refund'`) against the cards
  bought on that order and voids a card reduced to zero.
- This is a **purchase refund**, not a reversal of a redemption.

### 5.2 Redemption reversal

There is currently **no redemption-reversal function**. No path credits a
voucher back after a completed redemption. External integration needs one, and
it must be a separate audited operation that writes a positive `refund` ledger
entry and never silently deletes the original redemption.

---

## 6. Payment architecture

### 6.1 Purchase vs redemption

| Flow | Trigger | Writes |
|---|---|---|
| Buy a gift card | Customer checkout / bulk / MCP link | `orders`, `order_items`, `myfatoorah_payments`, on webhook `myfatoorah_payment_confirmed` + `myfatoorah_fulfill_order` | 
| Redeem a gift card | Vendor staff | `redemptions`, `redemption_items`, `ledger_entries` |

They are completely separate. **External redemption must only use the second
path.** It must never create an `orders` row or a MyFatoorah invoice.

### 6.2 Purchase pipeline

- `supabase/functions/_shared/invoices.ts` → `createInvoiceForOrder()` is the
  single invoice helper. All four entry points are thin wrappers.
- `myfatoorah_payments`, `myfatoorah_payment_allocations`,
  `myfatoorah_refunds`.
- `payment-webhook` Edge Function verifies signature, deduplicates in
  `webhook_events`, then calls `POST /api/merchant-payment/confirm`.
- The confirm route **re-queries MyFatoorah**; a redirect alone never issues a
  card.
- `myfatoorah_payment_confirmed` marks the order paid and writes
  `financial_ledger`; `myfatoorah_fulfill_order` issues vouchers idempotently.
- Commission is provider-managed only; no `ProposedShare`/`ProposedDepositShare`.

### 6.3 Idempotency mechanisms that already exist

| Mechanism | Where |
|---|---|
| Client idempotency key | Expo/bulk checkout |
| `webhook_events` unique `(provider, event_id)` | payment webhook |
| `payment_links` unique `(order_id, idempotency_key)` | MCP |
| `orders.payment_reference` unique | all purchase flows |
| `myfatoorah_payment_recorded` on-conflict | all purchase flows |
| `myfatoorah_fulfill_order` voucher check | fulfilment |

There is **no idempotency for redemptions**. This is the single most important
gap for external checkout.

---

## 7. Existing integration surface (what can be extended)

| Capability | Existing object | Assessment |
|---|---|---|
| Platform registry | none | New table required |
| External vendor mapping | none | New table required |
| Branch mapping | none (`vendor_locations` has no external id) | New mapping table/column required |
| Hashed API keys | `enterprise_api_keys` + `hash_enterprise_api_key()` | Pattern reusable; table is partner-scoped, so new platform credentials table is cleaner |
| HMAC verification | wallet token code | Pattern reusable |
| Webhook dedupe | `webhook_events` | Reuse |
| Rate limiting | `auth_attempts` + `claim_rate_limit` | Reuse pattern; dedicated integration counter preferred |
| Audit | `audit_log` + `write_audit()` | Reuse |
| Runtime config | `system_settings` | Reuse |
| Encryption at rest | `enterprise_code_key()` + `pgp_sym_encrypt` | Reuse pattern for signing secrets |
| Cron | `web/app/(app)/api/cron/route.ts` + `CRON_SECRET` | Reuse for reservation expiry |
| Server-to-server HTTP | Next.js route handlers + admin client | Reuse |
| Dashboard shell | `DashShell`, `PageHead`, `StatusTag`, server actions | Reuse |

---

## 8. API, UI and reporting conventions

### 8.1 Admin

- Layout/nav: `web/app/(app)/admin/(dashboard)/layout.tsx`.
- Pages are server components using `requireAdmin()` and `ctx.supabase`.
- Shared UI: `web/components/ui.tsx` (`PageHead`, `StatusTag`, `Notice`,
  `EmptyState`).
- Server actions: `web/lib/actions/*.ts` (e.g. `admin.ts`).
- i18n: `web/lib/i18n/*` with `pick()` / `fill()`; English and Arabic mirrors.

### 8.2 Vendor

- Layout/nav: `web/app/(app)/vendor/(dashboard)/layout.tsx`.
- Pages use `requireVendor()` and scope queries by `ctx.vendor.id`.
- Vouchers page: `web/app/(app)/vendor/(dashboard)/vouchers/page.tsx`.
- Redemption page: `web/app/(app)/vendor/(dashboard)/redeem/`.

### 8.3 Customer mobile

- `src/lib/data.ts` → `listVouchersFor()` and `listRedemptionsFor()`.
- `listRedemptionsFor()` reads `ledger_entries` and currently hard-codes
  `actor: 'Tazella'`; it does not expose the redemption channel.
- `app/(customer)/gifts/transactions.tsx` renders those entries.
- `app/(customer)/card/[id].tsx` shows the card and balance.

To surface external redemptions, `ledger_entries.redemption_id` can be joined to
`redemptions`; no new customer ledger is needed.

---

## 9. Testing baseline

Commands run during this audit (read-only):

| Command | Result |
|---|---|
| `npm test` (root, vitest) | **112 passed, 8 skipped**, 18 files |
| `npx tsc --noEmit` (root) | pass |
| `npx tsc --noEmit --incremental false` (`web/`) | pass |

Notes:

- The 8 skipped tests are the real-database money-path tests in
  `tests/db/money-path.test.ts`; they require `TEST_DATABASE_URL` and are
  intentionally skipped when no disposable database is configured.
- `tests/db/harness.ts` runs every DB test inside a transaction that is always
  rolled back, so a staging database is safe.
- `tests/db/apply-migrations.mjs` applies migrations to a test database.
- The handover docs claim 57 tests; the current suite is 120 (112 run + 8 DB).
  The docs are stale, not the suite.

Regression surface to protect:

- gift-card purchase and fulfilment
- `redeem_monetary` / `redeem_sessions` / `redeem_voucher_by_code` /
  `redeem_voucher_by_id`
- partial and full redemption, balance cache consistency
- purchase refunds (`financial_ledger` trigger)
- vendor and admin dashboards
- customer gift history
- RLS: cross-tenant reads and writes must still fail

---

## 10. Reuse matrix (required deliverable)

| Capability | Required action | Existing foundation | Decision |
|---|---|---|---|
| Gift-card validation | Reuse or extend existing service | `voucher_for_redemption`, voucher status/expiry rules | **Extend** with a vendor-scoped internal validator that returns safe external fields |
| Balance retrieval | Reuse existing service | `ledger_entries` sum, `card_balances`, `remaining_value_minor` | **Reuse** |
| Balance deduction | Reuse or extend existing service | `redeem_monetary` | **Extend** by extracting the ledger write into an internal vendor-scoped function; keep the public wrapper |
| Transaction recording | Reuse existing ledger | `redemptions`, `redemption_items`, `ledger_entries` | **Reuse**; add nullable channel/platform/order/reservation columns |
| Business identification | Reuse existing business model | `vendors.id` | **Reuse** |
| Branch identification | Reuse existing branch model | `vendor_locations.id` | **Reuse**; add mapping table with external branch id |
| Authentication | Extend existing architecture | Supabase auth, hashed keys, HMAC, RLS | **Extend** with platform credentials + signed server-to-server requests |
| Refunds | Reuse or extend existing functionality | `financial_ledger` refunds (purchase), no redemption reversal | **Extend** with an audited redemption-reversal RPC |
| Audit logging | Reuse existing logging | `audit_log`, `write_audit()` | **Reuse** |
| Reservations | Determine whether functionality exists | **None** | **Build** transactionally on top of `vouchers` + `ledger_entries` |
| Webhook processing | Reuse existing infrastructure | `webhook_events`, route handlers | **Reuse** |
| API rate limiting | Reuse or extend existing infrastructure | `auth_attempts`, `claim_rate_limit` | **Extend** with an integration-specific counter |
| External integrations | Extend existing integration architecture if suitable | `enterprise_api_keys`, `integration_config` | **Extend in pattern, not in table**; build a platform registry and mapping layer |

---

## 11. Missing capabilities

1. Platform registry and platform credentials.
2. External vendor/branch mapping with verification, activation, suspension and
   history.
3. Reservation (hold) lifecycle with atomic overspend protection.
4. Capture/release with idempotency.
5. Redemption reversal (refund) with audit and partial-refund support.
6. Standardized external API (validate, preview, reserve, capture, release,
   refund, status, order events, health).
7. Server-to-server authentication and replay protection.
8. Checkout SDK and embeddable payment-method component.
9. Sandbox environment and mock ordering platform.
10. Admin integration console and business integration reporting.
11. Connector contract and per-platform capability declarations.
12. Reservation expiry and reconciliation job.

---

## 12. Risks and constraints

| Risk | Why it matters | Mitigation |
|---|---|---|
| Double-spend across platforms | Two simultaneous checkouts can consume the same balance | Reservation row + `FOR UPDATE` on the voucher + available = ledger − active reservations |
| Service-role bypasses `can_redeem_for` | Existing RPCs require `auth.uid()` | Internal vendor-scoped redemption function; never trust a caller-supplied vendor id |
| Duplicate requests/webhooks | External retries are normal | Idempotency table + unique keys + `webhook_events` |
| Capture on unverified status | Customer could fake success | Capture only on a signed, verified platform event; otherwise reconciliation |
| Releasing a captured redemption | Would create free money | State machine forbids it; separate audited refund only |
| Refund double-processing | Duplicate money | Unique idempotency key + sum-of-refunds check |
| Currency mismatch | Silent conversion loses money | Reject mismatched currency; no implicit conversion |
| Sandbox polluting production | Fake balances in real ledger | Separate sandbox project/environment and credentials; environment column |
| Connector over-claim | Order API ≠ payment integration | Capability flags with separate verification states |
| Platform policy violation | Account termination | Only officially supported integration mechanisms; written approval gate |

---

## 13. Recommended smallest safe change set

**Do not rewrite the engine.** The minimum additive set is:

1. New integration tables: platforms, credentials, vendor mappings, mapping
   history, reservations, operations/idempotency, external orders, refunds,
   reconciliation cases.
2. Nullable reporting columns on `redemptions` (`channel`, `platform_id`,
   `external_order_id`, `reservation_id`).
3. One internal redemption function extracted from `redeem_monetary`, with the
   public function preserved as a wrapper.
4. New `SECURITY DEFINER` RPCs for validate, preview, reserve, capture, release,
   refund and status.
5. Next.js route handlers under `web/app/(app)/api/integrations/v1/`.
6. Reservation expiry + reconciliation in the existing cron route.
7. Admin and vendor dashboard pages reusing existing shells.
8. A standalone checkout SDK package and a sandbox mock checkout page.
9. Connector interfaces with **declared but disabled** Snoonu/Talabat/Keeta
   capabilities until credentials and written approval exist.

No existing table, column, function or route needs to be deleted or renamed.

---

## 14. Audit conclusion

The existing application is a sound foundation. The gift-card ledger and
redemption rules are already correct for single-caller redemption; the work is
to add a **reservation layer**, an **external identity layer**, a **standardized
gateway**, and a **developer-facing checkout package**, without changing the
meaning of any existing table or RPC.

Proceed to `02-integration-architecture.md` for the proposed design.
