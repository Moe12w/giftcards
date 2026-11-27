# Phase 2 — Universal integration architecture

**Status:** approved. Phases 3–5 (identity, redemption engine and HTTP gateway)
are implemented in `supabase/migrations/0174_integration_identity.sql`,
`supabase/migrations/0175_integration_redemption.sql` and
`web/app/(app)/api/integrations/v1/**`. They have not been applied to a live or
test database and have no DB/gateway tests, so the Level 1 evidence gate is not
yet met.
**Foundation:** `01-codebase-audit.md`.
**Design rule:** extend the existing gift-card engine; never replace or duplicate
it.

---

## 1. Goals and non-goals

### Goals

1. Let a customer pay with a Tazella gift card inside an authorized external
   checkout, without leaving that checkout.
2. Keep Tazella as the only source of truth for ownership, balance, validity,
   redemption, refunds and transactions.
3. Prevent double-spend across simultaneous external checkouts and staff
   redemptions.
4. Make a new platform a connector + mapping exercise, not a core rewrite.
5. Give platform engineering teams a real SDK, API contract, sandbox and
   documentation.
6. Keep every existing marketplace flow working unchanged.

### Non-goals (for the first implementation)

- No second gift-card system, balance store or ledger.
- No fake Snoonu/Talabat/Keeta integration. Connectors stay disabled until
  written platform approval and credentials exist.
- No bypass of a platform's checkout restrictions.
- No automatic currency conversion.
- No customer account creation on external platforms.

---

## 2. Logical architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│ External platform checkout (Snoonu / Talabat / Keeta / mock)          │
│  - shows "Tazella gift card" as a payment method                      │
│  - hosts the checkout component or implements the API server-side     │
└───────────────┬──────────────────────────────────────────────────────┘
                │  signed server-to-server HTTPS
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Integration gateway  (Next.js route handlers, web/app/(app)/api/...)  │
│  identify platform → authenticate → rate limit → resolve mapping →    │
│  validate payload → idempotency → call RPC → standard response → log  │
└───────────────┬──────────────────────────────────────────────────────┘
                │  SECURITY DEFINER RPCs only
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Central redemption engine (Postgres)                                  │
│  validate · preview · reserve · capture · release · refund · status   │
│  uses: vouchers · ledger_entries · redemptions · audit_log            │
│  adds: integration_reservations · integration_refunds · ...           │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Existing marketplace (single source of truth)                         │
│  vendors · vendor_locations · vouchers · ledger_entries · redemptions │
│  financial_ledger · audit_log · RLS · dashboards                      │
└──────────────────────────────────────────────────────────────────────┘

Separate, parallel products:
  - Checkout SDK package (packages/checkout-sdk)
  - Sandbox + mock ordering platform (separate environment)
  - Per-platform connectors (web/lib/integrations/connectors/<code>)
  - Admin + vendor dashboards (reuse DashShell / existing pages)
```

**Separation rule:** the gateway contains no balance logic. All money decisions
are in Postgres RPCs. Connectors contain no balance logic. The SDK contains no
balance logic.

---

## 3. Data model (additive only)

All new tables are prefixed `integration_`. Existing tables gain only nullable
or defaulted columns. No column, table, function or route is deleted.

### 3.1 Platform registry

```sql
create table public.integration_platforms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- 'snoonu', 'talabat', 'keeta', 'mock'
  name text not null,
  status text not null default 'draft'
    check (status in ('draft','active','suspended','retired')),
  -- capability flags are declared AND separately verified; see §7.2
  capabilities jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb, -- non-secret: ttl, currency, checkout mode
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`capabilities` shape (example):

```json
{
  "vendor_identification": { "supported": true,  "verified": false },
  "order_api":             { "supported": true,  "verified": false },
  "checkout_extension":    { "supported": false, "verified": false },
  "partial_payment":       { "supported": false, "verified": false },
  "reservation":           { "supported": true,  "verified": true  },
  "capture_confirmation":  { "supported": false, "verified": false },
  "cancellation_events":   { "supported": false, "verified": false },
  "refund_events":         { "supported": false, "verified": false }
}
```

### 3.2 Platform credentials

```sql
create table public.integration_platform_credentials (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete cascade,
  environment text not null check (environment in ('sandbox','production')),
  label text not null,
  key_prefix text not null,                  -- display only, e.g. 'tz_live_ab12'
  key_hash text not null unique,             -- sha256 of the bearer key
  -- HMAC secret is encrypted at rest with a key from system_settings
  -- ('integrations.signing_key'), mirroring enterprise_code_key().
  signing_secret_ciphertext text,
  status text not null default 'active' check (status in ('active','revoked')),
  last_used_at timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (platform_id, environment, label)
);
```

- The plaintext key is shown once at creation and never stored.
- Production and sandbox credentials are separate rows and cannot address each
  other's data.
- Rotation creates a new row and revokes the old one after an overlap window.

### 3.3 External vendor / branch mappings

```sql
create table public.integration_vendor_mappings (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete cascade,
  business_kind text not null default 'vendor' check (business_kind in ('vendor','partner')),
  vendor_id uuid references public.vendors (id) on delete cascade,
  partner_id uuid references public.enterprise_partners (id) on delete cascade,
  external_vendor_id text not null,
  external_vendor_name text,
  external_branch_id text not null default '', -- '' = vendor-level mapping
  external_branch_name text,
  internal_location_id uuid references public.vendor_locations (id) on delete set null,
  status text not null default 'pending_verification'
    check (status in ('pending_verification','verified','active','suspended','disconnected','rejected')),
  verification_method text
    check (verification_method in ('platform_api','platform_confirmation','documented_evidence','manual')),
  verification_evidence jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  suspended_at timestamptz,
  disconnected_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_mapping_one_business
    check (num_nonnulls(vendor_id, partner_id) = 1)
);

-- One external identity may belong to only one live business.
create unique index integration_mapping_identity_live
  on public.integration_vendor_mappings (platform_id, external_vendor_id, external_branch_id)
  where status not in ('disconnected','rejected');

create index integration_mapping_vendor_idx
  on public.integration_vendor_mappings (vendor_id, platform_id, status);
```

**Resolution rule:** exact `(platform, external_vendor_id, external_branch_id)`
first, then `(platform, external_vendor_id, '')` as a vendor-level fallback. The
resolved `vendor_id` is compared to `vouchers.vendor_id`; a mismatch is rejected
with the same generic error as an unknown card.

**Verification rule:** a manually entered vendor id is **never** proof of
ownership. Manual mappings stay `pending_verification` and require either a
verified platform API response, a written platform confirmation, or documented
evidence plus a second admin approval. `verified_by` must differ from
`created_by` for manual evidence.

### 3.4 Mapping history

```sql
create table public.integration_mapping_events (
  id bigint generated always as identity primary key,
  mapping_id uuid not null references public.integration_vendor_mappings (id) on delete cascade,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
```

Append-only. Mirrors `audit_log` but is scoped to a mapping.

### 3.5 Reservations

```sql
create table public.integration_reservations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,             -- 'RSV-XXXXXXXXXX'
  platform_id uuid not null references public.integration_platforms (id) on delete restrict,
  mapping_id uuid not null references public.integration_vendor_mappings (id) on delete restrict,
  voucher_id uuid not null references public.vouchers (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  external_order_id text not null,
  external_branch_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  status text not null default 'active'
    check (status in ('active','captured','released','expired','reconciliation')),
  idempotency_key text not null,
  expires_at timestamptz not null,
  capture_started_at timestamptz,
  captured_at timestamptz,
  released_at timestamptz,
  release_reason text,
  redemption_id uuid references public.redemptions (id) on delete set null,
  external_payment_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_id, idempotency_key)
);

create unique index integration_reservation_one_active
  on public.integration_reservations (platform_id, external_order_id, voucher_id)
  where status = 'active';

create index integration_reservation_voucher_idx
  on public.integration_reservations (voucher_id, status);
create index integration_reservation_expiry_idx
  on public.integration_reservations (status, expires_at);
```

**Available balance** (the only correct definition):

```text
ledger_balance(voucher) = sum(ledger_entries.amount_minor)
active_reserved(voucher) = sum(integration_reservations.amount_minor
                                where status = 'active')
available(voucher) = ledger_balance(voucher) - active_reserved(voucher)
```

Expired-but-not-yet-released rows remain `active` until the expiry job or the
next reservation attempt transitions them, so an ambiguous checkout can never
free the same money twice.

### 3.6 Idempotency and operation replay

```sql
create table public.integration_operations (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete cascade,
  operation text not null,                    -- validate|preview|reserve|capture|release|refund|status
  idempotency_key text not null,
  request_hash text not null,
  response_status integer not null,
  response_body jsonb not null,
  resource_type text,
  resource_id uuid,
  created_at timestamptz not null default now(),
  unique (platform_id, operation, idempotency_key)
);
```

- Same key + same request hash → return the stored response, no second effect.
- Same key + different request hash → `409 IDEMPOTENCY_CONFLICT`.
- Financial RPCs also enforce their own uniqueness so a gateway bug cannot
  duplicate money.

### 3.7 External orders and reconciliation

```sql
create table public.integration_external_orders (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete cascade,
  mapping_id uuid references public.integration_vendor_mappings (id) on delete set null,
  external_order_id text not null,
  external_branch_id text,
  currency text not null,
  order_amount_minor bigint not null check (order_amount_minor >= 0),
  eligible_amount_minor bigint not null default 0 check (eligible_amount_minor >= 0),
  status text not null default 'initiated'
    check (status in ('initiated','pending_payment','paid','cancelled','refunded','unknown')),
  payment_status text,
  reservation_id uuid references public.integration_reservations (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_id, external_order_id)
);

create table public.integration_reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete cascade,
  reservation_id uuid references public.integration_reservations (id) on delete set null,
  external_order_id text,
  reason text not null,
  status text not null default 'open'
    check (status in ('open','resolved_captured','resolved_released','resolved_refunded','ignored')),
  evidence jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
```

### 3.8 Redemption refunds (reversals)

```sql
create table public.integration_refunds (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete restrict,
  reservation_id uuid references public.integration_reservations (id) on delete set null,
  redemption_id uuid not null references public.redemptions (id) on delete restrict,
  voucher_id uuid not null references public.vouchers (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  external_order_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  status text not null default 'completed' check (status in ('completed','failed','reconciliation')),
  idempotency_key text not null,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (platform_id, idempotency_key)
);
```

### 3.9 Existing table changes (nullable/defaulted only)

```sql
alter table public.redemptions
  add column if not exists channel text not null default 'staff'
    check (channel in ('staff','external_platform','admin','system')),
  add column if not exists platform_id uuid references public.integration_platforms (id) on delete set null,
  add column if not exists external_order_id text,
  add column if not exists external_branch_id text,
  add column if not exists reservation_id uuid references public.integration_reservations (id) on delete set null,
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
```

Existing rows become `channel = 'staff'`. No existing query changes meaning.
Customer history can join `redemptions` through `ledger_entries.redemption_id`
to show the channel.

No changes to `vouchers`, `ledger_entries`, `orders`, `order_items`,
`financial_ledger`, `vendors` or `vendor_locations` are required. The mapping
table holds external branch ids; `vendor_locations` stays the internal branch
model.

### 3.10 RLS

- `integration_platforms`: readable by authenticated admins; writable by admins.
- `integration_platform_credentials`: admin-only; `key_hash` and ciphertext are
  never selected by browser roles. Gateway uses service role.
- `integration_vendor_mappings`: admins manage; vendor owners/managers can read
  their own mappings (`vendor_id = ctx.vendor.id`), never write verified fields.
- `integration_reservations`, `integration_external_orders`,
  `integration_refunds`: admins read all; vendors read rows for their
  `vendor_id`; no browser writes. All writes through RPCs.
- `integration_operations`: admin read only; service role writes.
- `integration_mapping_events`: admin read; vendor read own mapping events.
- `integration_reconciliation_cases`: admin only.

---

## 4. Central redemption engine extensions

### 4.1 Extract, don't duplicate

Refactor `redeem_monetary` into two functions:

```sql
-- Internal: no auth.uid() check; caller must be the verified vendor.
create or replace function public.redeem_monetary_internal(
  p_voucher_id uuid,
  p_amount_minor bigint,
  p_vendor_id uuid,                 -- verified business, never client-supplied
  p_notes text,
  p_channel text,
  p_platform_id uuid,
  p_external_order_id text,
  p_external_branch_id text,
  p_reservation_id uuid,
  p_idempotency_key text
) returns table (redemption_id uuid, redemption_reference text,
                 new_balance_minor bigint, new_status public.voucher_status)
language plpgsql security definer set search_path = public
as $$ ... $$;

revoke all on function public.redeem_monetary_internal(...)
  from public, anon, authenticated;
grant execute on function public.redeem_monetary_internal(...) to service_role;
```

`redeem_monetary(voucher_id, amount, notes)` becomes:

1. `for update` the voucher.
2. `can_redeem_for(v_voucher.vendor_id)` exactly as today.
3. Call `redeem_monetary_internal(..., p_vendor_id = v_voucher.vendor_id,
   p_channel = 'staff', ...)`.

Existing callers see identical behaviour when no external reservation exists.

`redeem_monetary_internal` performs the existing steps 1–14 but:

- rejects if `v_voucher.vendor_id <> p_vendor_id` with the generic error;
- computes `available = ledger_balance - active_reserved`, excluding the
  reservation being captured (`p_reservation_id`), and rejects if
  `p_amount_minor > available`;
- writes `channel`, `platform_id`, `external_order_id`, `external_branch_id`,
  `reservation_id`, `idempotency_key`, `metadata` on the `redemptions` row;
- keeps the same `redemption_items`, `ledger_entries` and cached-counter
  updates;
- keeps `write_audit`.

This is the single place where gift-card value leaves the ledger. External
capture calls it; staff redemption calls it; nothing else writes `redeem`
entries.

### 4.2 Validate / preview

Read-only, safe responses only:

```text
{
  valid: true,
  card: { masked_code: "GFT-••••CD34EF", vendor_name: "The Coffee House" },
  currency: "QAR",
  balance_minor: 50000,
  reserved_minor: 15000,
  available_minor: 35000,
  expires_at: "2027-11-11T...",
  restrictions: { monetary_only: true, partial_allowed: true }
}
```

Never return buyer id, claimed_by, order id, internal voucher id, full code,
card hash, or another business's name.

### 4.3 Reserve

`integration_reserve(...)` in one transaction:

1. Resolve active mapping; verify platform active.
2. Lock the voucher row `for update`.
3. Re-validate status, expiry, currency, business match.
4. Expire stale active reservations for this voucher **except** rows with
   `capture_started_at is not null`.
5. Compute `available`.
6. `amount = least(requested, available, order_amount)`.
7. Reject `amount <= 0` with `INSUFFICIENT_BALANCE`.
8. Insert reservation with `expires_at = now() + ttl` (default 10 minutes,
   platform-configurable, max 30).
9. Insert/return idempotency response.
10. Audit.

Concurrent reserves serialise on the voucher row, so a QAR 500 card can never
reserve 400 + 300.

### 4.4 Capture

`integration_capture(...)`:

1. Lock reservation `for update`; verify platform and status.
2. If `captured` → return the original result (idempotent).
3. If `released`/`expired` → `409 RESERVATION_NOT_CAPTURABLE`.
4. Set `capture_started_at = now()`.
5. Lock voucher `for update`; verify balance ≥ reserved amount.
6. Call `redeem_monetary_internal(..., p_reservation_id = reservation.id)`.
7. Mark reservation `captured`, store `redemption_id`, `captured_at`.
8. Mark external order `paid` only if the verified event says so.
9. Audit + operation response.

If step 5/6 fails because the balance was spent elsewhere, do **not** release:
set `status = 'reconciliation'`, open a reconciliation case, return
`RECONCILIATION_REQUIRED`.

Capture is allowed at most `amount_minor`. A larger capture is rejected.

**Expired reservation grace:** a capture that arrives after `expires_at` but
with a verified platform `order.paid` event and within a configured grace window
(default 15 minutes) is allowed. Beyond that, it becomes a reconciliation case.
The exact rule is configurable per platform and documented in the connector.

### 4.5 Release

`integration_release(...)`:

- Lock reservation; if `active` → `released` with reason.
- If already `released`/`expired` → return the same result.
- If `captured` → `409 RESERVATION_ALREADY_CAPTURED` (never release captured).
- If `reconciliation` → `409 RECONCILIATION_REQUIRED`.
- No ledger write.

### 4.6 Refund (redemption reversal)

`integration_refund(...)`:

1. Lock the original redemption and voucher.
2. Verify the redemption belongs to the mapping's vendor and the platform.
3. `already_refunded = sum(integration_refunds.amount_minor where redemption_id
   = original and status = 'completed')`.
4. Reject if `amount > redemption.amount_minor - already_refunded`.
5. Insert `integration_refunds` row (idempotency unique).
6. Insert `ledger_entries` (`entry_type = 'refund'`, positive `amount_minor`,
   `voucher_id`, `redemption_id = original`).
7. Restore `vouchers.remaining_value_minor`; if balance becomes 0 → keep
   `redeemed`; if `0 < balance < initial` → `partially_redeemed`; if balance =
   initial → `active`. Clear `redeemed_at` when balance > 0.
8. Mark original redemption `status = 'reversed'` only when fully refunded.
9. Audit as a separate event.

This is separate from the purchase-refund trigger in `0135`; that trigger only
reacts to negative `financial_ledger` refunds and is untouched.

### 4.7 Reservation expiry and reconciliation

- `/api/cron` (existing, `CRON_SECRET`) calls
  `integration_expire_reservations(p_limit)` (wired into the scheduled route).
  A missing RPC is non-fatal until the migration is applied.
- A row is released only if `status = 'active'`, `expires_at < now()`, and
  `capture_started_at is null`.
- If the external order state is `unknown` or a capture was requested, the row
  becomes `reconciliation`, not `released`.
- Reconciliation resolves only from verified platform evidence; every decision
  is recorded.

---

## 5. Standardized external API

### 5.1 Placement

Use Next.js route handlers, matching the existing web API convention:

```text
web/app/(app)/api/integrations/v1/
  health/route.ts                       GET    implemented
  gift-cards/validate/route.ts          POST   implemented
  gift-cards/preview/route.ts           POST   implemented
  reservations/route.ts                 POST   implemented
  reservations/[reference]/route.ts     GET    implemented
  reservations/[reference]/capture/route.ts  POST implemented
  reservations/[reference]/release/route.ts  POST implemented
  redemptions/[id]/refund/route.ts      POST   implemented
  orders/events/route.ts                POST   implemented
  webhooks/[platform]/route.ts          not implemented (needs a real connector)
```

Shared plumbing lives in `web/lib/integrations/gateway.ts`.

All handlers:

1. Read the raw body once.
2. Authenticate the platform credential.
3. Verify the HMAC signature and timestamp.
4. Apply the rate limit.
5. Validate the payload (a small hand-written validator or `zod` if the team
   accepts one new dependency; no schema library exists today).
6. Resolve the mapping.
7. Enforce idempotency.
8. Call one RPC.
9. Return the standard envelope.
10. Log the request (without secrets or full card codes).

### 5.2 Authentication

```http
Authorization: Bearer tz_live_<random>
X-Platform-Code: talabat
X-Environment: production
X-Timestamp: 1790000000
X-Signature: hex(hmac_sha256(signing_secret, timestamp + "." + raw_body))
X-Idempotency-Key: <platform-generated uuid>
Content-Type: application/json
```

- Bearer key identifies the credential row (SHA-256 lookup). The key also
  determines the platform and environment; `X-Platform-Code` and
  `X-Environment` are optional and, when supplied, must match the credential.
- HMAC proves body integrity and replay resistance.
- Reject timestamp skew > 300 seconds.
- Reject if `X-Platform-Code` does not match the credential's platform.
- Production credential + `X-Environment: sandbox` → `403`.
- Every platform has its own credentials and scopes.

If a platform cannot sign requests, the connector declares
`auth: 'bearer_only'`; this is recorded as a verified capability and requires
explicit risk acceptance.

### 5.3 Operations

| Operation | Method / path | Effect |
|---|---|---|
| Health | `GET /health` | Platform/credential status, no money |
| Validate | `POST /gift-cards/validate` | Read-only card + merchant check |
| Preview | `POST /gift-cards/preview` | Read-only eligible amount |
| Reserve | `POST /reservations` | Creates a hold |
| Status | `GET /reservations/{reference}` | Reservation state |
| Capture | `POST /reservations/{reference}/capture` | Finalises redemption |
| Release | `POST /reservations/{reference}/release` | Cancels a hold |
| Refund | `POST /redemptions/{id}/refund` | Audited reversal |
| Order event | `POST /orders/events` | Verified lifecycle event |
| Platform webhook | `POST /webhooks/{platform}` | Raw connector webhook |

### 5.4 Request examples

**Validate**

```json
{
  "external_vendor_id": "55671",
  "external_branch_id": "55671-02",
  "card_code": "GFT-AB12CD34EF",
  "currency": "QAR"
}
```

**Preview**

```json
{
  "external_vendor_id": "55671",
  "external_branch_id": "55671-02",
  "external_order_id": "TLB-998877",
  "card_code": "GFT-AB12CD34EF",
  "order_amount_minor": 20000,
  "requested_amount_minor": 15000,
  "currency": "QAR"
}
```

**Reserve**

```json
{
  "external_vendor_id": "55671",
  "external_branch_id": "55671-02",
  "external_order_id": "TLB-998877",
  "card_code": "GFT-AB12CD34EF",
  "order_amount_minor": 20000,
  "requested_amount_minor": 15000,
  "currency": "QAR",
  "ttl_seconds": 600
}
```

**Capture** (`POST /reservations/{reference}/capture`)

```json
{
  "external_vendor_id": "55671",
  "external_branch_id": "55671-02",
  "external_payment_reference": "TLB-PAY-12345",
  "confirmed_order_amount_minor": 20000,
  "currency": "QAR"
}
```

**Release** (`POST /reservations/{reference}/release`)

```json
{
  "external_vendor_id": "55671",
  "external_branch_id": "55671-02",
  "reason": "customer_cancelled"
}
```

**Refund** (`POST /redemptions/{id}/refund`)

```json
{
  "external_vendor_id": "55671",
  "external_branch_id": "55671-02",
  "amount_minor": 15000,
  "reason": "order.refunded"
}
```

**Order event**

```json
{
  "event_id": "evt_01J...",
  "event_type": "order.paid",
  "external_order_id": "TLB-998877",
  "reservation_reference": "RSV-AB12CD34EF",
  "amount_minor": 20000,
  "currency": "QAR",
  "occurred_at": "2026-11-27T12:00:00Z"
}
```

### 5.5 Response envelope

```json
{
  "ok": true,
  "request_id": "req_01J...",
  "data": {
    "operation": "reserve",
    "status": "active",
    "reservation_reference": "RSV-AB12CD34EF",
    "currency": "QAR",
    "card": { "masked_code": "GFT-••••CD34EF", "vendor_name": "The Coffee House" },
    "balance_minor": 50000,
    "reserved_minor": 15000,
    "available_minor": 35000,
    "applied_amount_minor": 15000,
    "remaining_order_amount_minor": 5000,
    "expires_at": "2026-11-27T12:10:00Z"
  }
}
```

Error:

```json
{
  "ok": false,
  "request_id": "req_01J...",
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "This gift card does not have enough available balance.",
    "retryable": false
  }
}
```

**Error codes:** `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN_SCOPE`,
`PLATFORM_NOT_ACTIVE`, `MAPPING_NOT_FOUND`, `MAPPING_NOT_ACTIVE`,
`CARD_NOT_FOUND`, `CARD_INACTIVE`, `CARD_EXPIRED`, `CARD_WRONG_BUSINESS`,
`CURRENCY_MISMATCH`, `INSUFFICIENT_BALANCE`, `RESERVATION_NOT_FOUND`,
`RESERVATION_EXPIRED`, `RESERVATION_ALREADY_CAPTURED`,
`RESERVATION_NOT_CAPTURABLE`, `AMOUNT_EXCEEDS_RESERVATION`,
`IDEMPOTENCY_CONFLICT`, `IDEMPOTENCY_IN_PROGRESS`, `REDEMPTION_NOT_FOUND`,
`RATE_LIMITED`, `RECONCILIATION_REQUIRED`, `PLATFORM_UNAVAILABLE`,
`INTERNAL_ERROR`.

Customer-facing messages are safe and generic. `CARD_NOT_FOUND` and
`CARD_WRONG_BUSINESS` may share the same public message to avoid an existence
oracle, while the internal log records the precise reason.

### 5.6 Idempotency

- Required on reserve, capture, release, refund and order events.
- `integration_operations` stores the response keyed by
  `(platform_id, operation, idempotency_key)`.
- Same key + same hash → replay.
- Same key + different hash → `409`.
- RPCs also enforce uniqueness on reservations/refunds.
- Webhooks use `webhook_events` unique `(provider, event_id)`.

### 5.7 Rate limits

- Per credential and per operation, e.g. 120 requests/minute, burst 20.
- Card validation is stricter: 10 attempts per card per 10 minutes and 60 per
  credential per 10 minutes, to prevent code enumeration.
- Reuse the `auth_attempts` pattern via a new
  `integration_rate_limit(key, max, window)` helper.
- `429 RATE_LIMITED` with `Retry-After`.

### 5.8 Implementation notes (Phases 3–5)

- `validate` returns HTTP 200 with `{ valid, reason }` for card-state failures;
  `wrong_business` is reported as `not_found` so the API is not an existence
  oracle. Other read endpoints return 4xx errors.
- `capture`, `release` and `refund` require `external_vendor_id` (and optional
  `external_branch_id`) so the RPC can verify the reservation/redemption vendor
  against an active mapping.
- Only the per-credential, per-operation 120/minute bucket is implemented. The
  stricter per-card validation bucket and the `Retry-After` header are still
  open work; do not claim card-enumeration protection until they exist.
- Health and reservation status are bearer-authenticated but not HMAC-signed
  (read-only, no money). POST operations require HMAC when the credential has a
  signing secret; bearer-only credentials are restricted to sandbox.
- A capture that cannot be completed safely leaves the reservation in
  `reconciliation` and returns `409 RECONCILIATION_REQUIRED`; no ledger entry is
  written in that case.
- The two migrations have not been applied to a database. Apply them to a
  sandbox database before any integration testing.

---

## 6. Platform connector architecture

### 6.1 Contract

```ts
// web/lib/integrations/connectors/types.ts
export type CapabilityState = {
  supported: boolean;
  verified: boolean;
  verifiedAt?: string;
  notes?: string;
};

export type PlatformCapabilities = {
  vendorIdentification: CapabilityState;
  orderApi: CapabilityState;
  checkoutExtension: CapabilityState;
  partialPayment: CapabilityState;
  reservation: CapabilityState;
  captureConfirmation: CapabilityState;
  cancellationEvents: CapabilityState;
  refundEvents: CapabilityState;
};

export type CheckoutMode =
  | 'native_payment_method'
  | 'checkout_extension'
  | 'embedded_sdk'
  | 'server_to_server'
  | 'partner_mediated'
  | 'unknown';

export interface VerifiedWebhook {
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload: unknown;
  rawBody: string;
}

export interface NormalizedEvent {
  eventId: string;
  type: 'order.paid' | 'order.cancelled' | 'order.refunded'
      | 'payment.failed' | 'payment.unknown';
  externalOrderId: string;
  reservationReference?: string;
  amountMinor?: number;
  currency?: string;
  occurredAt: string;
}

export interface PlatformConnector {
  readonly code: string;
  readonly checkoutMode: CheckoutMode;
  readonly capabilities: PlatformCapabilities;

  verifyWebhook(input: {
    rawBody: string;
    headers: Headers;
  }): Promise<VerifiedWebhook>;

  normalizeEvent(event: VerifiedWebhook): Promise<NormalizedEvent>;

  /** Only implemented when vendor identification is verified. */
  resolveVendorIdentity?(input: {
    authorizationCode?: string;
    merchantId?: string;
  }): Promise<{ externalVendorId: string; name?: string } | null>;

  healthCheck?(): Promise<{ ok: boolean; detail?: string }>;
}
```

Every method for an unverified capability throws
`CapabilityNotVerifiedError`. No connector returns fabricated data.

### 6.2 Registry and capability gating

- `web/lib/integrations/connectors/index.ts` maps `code → connector`.
- The gateway refuses an operation if the platform row is not `active` or the
  required capability is not `supported && verified`.
- A connector can be deployed while `draft`; it is simply not routable.

### 6.3 Status vocabulary (do not collapse into "connected")

```text
platform_not_connected
pending_authorization
connected
vendor_verification_pending
vendor_verified
order_api_connected
checkout_integration_pending
checkout_integration_verified
payment_lifecycle_verified
suspended
disconnected
```

A platform with only an order API is **partially integrated**, never
"checkout complete".

---

## 7. Checkout SDK and component

### 7.1 Packaging decision

The repo has no workspace tooling. Create a self-contained package:

```text
packages/checkout-sdk/
  package.json          @tazella/checkout-sdk, ESM source, zero runtime deps
  tsconfig.json
  src/
    index.ts
    types.ts
    controller.ts       framework-agnostic state machine
    transport.ts        host-backend adapter interface
    errors.ts
    react/
      GiftCardPaymentMethod.tsx   optional React component (peer dep)
      useGiftCardCheckout.ts
  examples/
    react-checkout.tsx
    vanilla.ts
    node-server.ts
  README.md
  CHANGELOG.md
```

Do not add a second redundant package. The same package serves web and React
Native consumers; the React component is optional. The 0.x package is shipped
as typed ESM source; `npm run build` emits ESM plus declarations into `dist/`
for a private-registry release. Compiled CJS output is added when the API
contract is frozen at 1.0.

### 7.2 Trust boundary

The SDK **never** holds a platform secret and **never** calls a financial
operation directly with credentials. Two supported modes:

1. **Host-backend proxy (default):** the platform backend implements the
   `GiftCardTransport` interface and calls Tazella with its secret. The SDK only
   talks to the host backend.
2. **Short-lived session token:** the platform backend mints a scoped,
   short-lived token; the SDK may call Tazella's public checkout endpoints with
   it. The token cannot capture, refund or exceed the session's order scope.

The SDK cannot change balances, capture, refund or override amounts. Those are
backend decisions.

### 7.3 Controller state machine

```text
idle
  → validating            (code submitted)
  → invalid               (safe error, retry)
  → valid                 (balance shown)
  → applying              (reserve)
  → applied               (amount locked, expiry shown)
  → removing              (release)
  → idle
  → error                 (network / platform / reconciliation)
```

Rules:

- One in-flight request at a time; duplicate submits are ignored.
- The applied amount is the backend's `applied_amount_minor`, not a client
  calculation.
- Removing an applied card calls release; if capture already happened, the UI
  shows "payment completed" and offers no removal.
- Expiry countdown uses the backend `expires_at`; on expiry the SDK refreshes
  status and shows a retry.
- Network errors preserve the last confirmed state and offer retry.

### 7.4 UI requirements

- Gift-card option rendered alongside the host's payment methods.
- Code input, validate, balance, available amount, apply, remove/replace.
- Partial payment: show applied amount and remaining payable.
- Loading, success, failure, expired, insufficient, wrong-business messages.
- Accessibility labels, keyboard flow, RTL support (Arabic), and host design
  tokens via CSS variables / props.
- No forced visual identity; the host's design system wins.

### 7.5 Distribution and versioning

- `0.x` until the API contract is frozen; then `1.0`.
- Document the compatible API version in the package README and expose
  `SDK_VERSION` / `API_VERSION`.
- Publishable to a private registry or delivered as a tarball; no public npm
  publish without approval.

### 7.6 WordPress / WooCommerce

WordPress sites are another host platform, not a separate gift-card system.
`packages/wordpress/tazella-gift-cards/` contains a PHP client (credential,
HMAC signing, idempotency, safe error mapping) and a `WC_Payment_Gateway`
scaffold. The browser only submits the card code; the plugin backend signs and
forwards every gateway call.

WooCommerce's own checkout submission is treated as the verified payment event
for this self-hosted gateway: reserve, then capture with the confirmed order
amount, then `$order->payment_complete()`. Cancellation of an uncaptured order
calls `release`; a WooCommerce refund calls the audited `refund` endpoint.
Currency must match exactly and the external store identity must be verified by
Tazella. The scaffold has not been run against WordPress or a sandbox.

---

## 8. Sandbox and mock platform

### 8.1 Isolation

**Recommended:** a separate Supabase project (or separate schema) for sandbox,
with the same migrations. Sandbox credentials cannot reach production rows, and
production credentials cannot reach sandbox rows.

Defense in depth:

- `integration_platform_credentials.environment` (`sandbox` | `production`).
- Sandbox-only platform rows and mappings.
- Sandbox vouchers are created only by the sandbox seed, never by real purchase
  or fulfilment.
- The gateway rejects cross-environment access before any RPC.

### 8.2 Seed scenarios

`supabase/sandbox/seed.sql` creates:

| Scenario | Data |
|---|---|
| Active business | Sandbox Restaurant, approved vendor |
| Branch | Sandbox Branch 01 |
| Mapping | mock platform vendor `SBX-1001`, branch `SBX-1001-01`, verified + active |
| QAR 500 card | full/partial redemption |
| QAR 200 card | exact-order payment |
| QAR 0 card | insufficient balance |
| Expired card | expiry rejection |
| Suspended card | status rejection |
| Wrong-business card | ownership rejection |
| Concurrent test | two reservations racing for the same balance |

### 8.3 Mock platform

`web/app/(app)/sandbox/mock-platform/` (admin-gated, env-gated by
`INTEGRATIONS_SANDBOX_ENABLED`) demonstrates:

1. Cart total.
2. Gift-card payment option.
3. Code entry + validation.
4. Balance + eligible amount.
5. Apply/reserve.
6. Simulated remaining payment.
7. Success → capture.
8. Failure → release.
9. Refund.
10. Expiry and duplicate-request scenarios.

The page is visibly labelled **"Mock platform — for testing only. Not a real
Snoonu/Talabat/Keeta integration."** It must never be presented to merchants or
customers as a live platform.

### 8.4 Certification checklist

Before a real platform goes live:

- authentication and replay protection
- vendor mapping verified
- checkout rendering
- validation, partial and full payment
- reservation, capture, release
- refund and partial refund
- duplicate request/webhook protection
- reconciliation
- customer balance sync
- business reporting
- currency and eligible-component rules
- sandbox → production credential separation

---

## 9. Administration dashboard

Add a new admin section, reusing `DashShell`, `PageHead`, `StatusTag`, `Notice`
and server actions.

```text
/admin/integrations
  overview            platform cards + capability states + health
  /platforms/[code]   credentials, capabilities, checkout mode, webhook config
  /mappings           create, verify, activate, suspend, disconnect, history
  /reservations       active, expired, captured, reconciliation
  /transactions       external redemptions, filters, drill-down
  /reconciliation     open cases + evidence + resolution
  /webhooks           failed/duplicate webhook events
```

Required actions:

- enable/disable a platform
- rotate/revoke credentials
- create a mapping (platform + external vendor/branch + internal business)
- verify a mapping with evidence
- activate/suspend/disconnect
- search by business, platform, vendor, gift card, external order
- inspect reservation and redemption timelines
- resolve reconciliation cases

Every state change writes `audit_log` and `integration_mapping_events`.

---

## 10. Business dashboard

Add `/vendor/(dashboard)/integrations`:

- connected platforms and external vendor accounts
- branch mappings and status
- total external redemptions
- individual redemptions with date, amount, external order reference, status
- refunds/reversals
- connection health

All figures come from `redemptions` + `integration_*` tables. No separate
reporting ledger.

Vendor self-service may initiate authorization only if the platform supports it;
verified identities and credentials remain admin-controlled.

---

## 11. Customer experience

- No new account, no redirect.
- After capture, the existing balance updates because it is the same ledger.
- `src/lib/data.ts` `listRedemptionsFor()` joins `redemptions` via
  `ledger_entries.redemption_id` and maps `channel`, `platform_name`,
  `external_order_ref`.
- `app/(customer)/gifts/transactions.tsx` shows "Paid at Talabat · order
  TLB-998877" where available.
- The card detail screen shows the same remaining balance.
- A card only works at the business that issued it; the mapping check enforces
  this.

---

## 12. Security and financial invariants

| # | Invariant | Enforcement |
|---|---|---|
| 1 | Balance never negative | Ledger sum + available check under `FOR UPDATE` |
| 2 | No duplicate deduction | Reservation state + idempotency + unique keys |
| 3 | Card only at its business | Mapping `vendor_id = voucher.vendor_id` |
| 4 | Never trust client business id | Mapping resolved server-side from platform + external vendor |
| 5 | Never trust client order status | Capture only from signed/verified platform event or verified API |
| 6 | Never capture unverified order | Reservation + verified event + amount match |
| 7 | Never capture above reservation | `amount <= reservation.amount_minor` |
| 8 | Never release captured | State machine rejects |
| 9 | Refund once | `integration_refunds` unique + sum check |
| 10 | No cross-platform data | Credential/platform scoping + RLS |
| 11 | No secret in client | SDK transport boundary + server-only admin client |
| 12 | Sandbox isolation | Separate environment + credential check |
| 13 | No silent currency conversion | Currency equality check |
| 14 | Full audit trail | `audit_log`, `integration_mapping_events`, `integration_operations` |

Additional protections:

- HMAC + timestamp replay protection.
- Rate limiting and card-enumeration throttling.
- Credential rotation with overlap.
- Generic public errors; precise internal logs.
- No full card codes in logs or analytics.
- Service-role only on the server.

---

## 13. Eligible order amounts and currency

The eligible amount is configurable per platform/business agreement:

```json
{
  "eligible_components": ["subtotal", "taxes"],
  "excluded_components": ["delivery_fee", "service_fee", "tip"],
  "max_share_bps": 10000,
  "currency": "QAR"
}
```

- The platform sends the order amount and, where supported, the component
  breakdown.
- The gateway computes eligible = min(requested, available, eligible order
  amount).
- Gift cards are a **payment contribution**, never a discount code. If a
  platform only supports discount vouchers, that is a commercial/accounting
  change requiring written approval and a separate connector mode; it must not
  be silently implemented as a discount.
- Currency must match exactly. No conversion. A QAR card cannot pay a non-QAR
  order.

---

## 14. Testing plan

### 14.1 Unit

- SDK controller state machine and error mapping.
- Gateway payload validation, signature verification, idempotency replay.
- Connector capability gating (unverified capability refuses).
- Error-code mapping.

### 14.2 Database (rolled-back transactions, like `tests/db`)

- validate: active, expired, suspended, wrong business, currency mismatch.
- preview: available = ledger − active reservations.
- reserve: success, insufficient, idempotent replay, conflicting key.
- concurrency: two reserves for QAR 400 + QAR 300 on QAR 500 → exactly one
  succeeds.
- capture: success, duplicate, expired, above reservation, released.
- release: success, duplicate, captured refusal.
- refund: full, partial, over-refund, duplicate, captured-only.
- staff vs external: staff redemption cannot spend reserved funds.
- expiry job: releases only safe rows; ambiguous → reconciliation.
- balance cache consistency (`verify_voucher_balances`).
- RLS: vendor A cannot read vendor B's mappings/reservations.

### 14.3 End-to-end

- Mock platform: full payment, partial payment, failed remaining payment,
  cancellation, refund, duplicate submit, duplicate webhook, expiry.
- Regression: the existing 112 tests plus the 8 DB tests with
  `TEST_DATABASE_URL`.

### 14.4 Critical acceptance tests

- QAR 500 card, simultaneous QAR 400 + QAR 300 → total captured ≤ QAR 500.
- ABC Restaurant vendor cannot redeem XYZ Restaurant card, even with a
  manipulated request.
- QAR 200 order: 200/0, 150/50, 50/150, 0/200, failed remaining payment,
  duplicate checkout.
- Customer balance and central ledger agree after every scenario.

---

## 15. Implementation phases and gates

| Phase | Work | Gate |
|---|---|---|
| 1 | Codebase audit | **Done** (`01-codebase-audit.md`) |
| 2 | Architecture design | **This document** — approval required |
| 3 | Platform registry, credentials, mappings, history, RLS | Migration review + tests |
| 4 | Reservation, capture, release, refund, idempotency, internal redemption extraction | DB tests green, existing suite green |
| 5 | Gateway route handlers + auth + rate limit + errors | API contract review |
| 6 | Checkout SDK + React component + examples | SDK tests + review |
| 7 | Sandbox + mock platform | End-to-end mock scenarios green |
| 8 | Snoonu/Talabat/Keeta capability investigations | Written platform evidence; no code |
| 9 | Platform connectors | Only after Phase 8 approval |
| 10 | Admin integration console | Admin review |
| 11 | Vendor integration reporting | Vendor review |
| 12 | End-to-end + regression | All tests green |
| 13 | Controlled rollout | Feature flag per platform/business; monitoring |

**Stop points:** approval after Phase 2; approval before applying migrations;
approval before any connector is enabled in production.

---

## 16. Production readiness levels

| Level | Meaning | Evidence required |
|---|---|---|
| 1 — Internal infrastructure | APIs, mappings, redemption lifecycle, security implemented | migrations + DB tests + gateway tests |
| 2 — Developer package | SDK, docs, API contract, sandbox available | package + examples + sandbox |
| 3 — Mock platform verified | Full lifecycle tested against the mock | E2E report |
| 4 — External platform connected | Official credentials + authorized API connectivity | signed agreement + credential record + health check |
| 5 — Checkout integration verified | Payment method appears and works in the real checkout | platform UAT evidence |
| 6 — Financial lifecycle verified | Partial payment, capture, release, refund, reconciliation tested | reconciliation report + platform sign-off |
| 7 — Production activated | Real merchants/customers | feature flag + monitoring + rollback plan |

Internal API + mock platform success is **Level 3**, never production-ready.

---

## 17. Backward compatibility and risk register

### Guarantees

- No table/column/function/route deletion or rename.
- `redeem_monetary` keeps its signature and authorisation behaviour.
- Purchase, fulfilment, webhook and refund flows are untouched.
- New columns are nullable or defaulted.
- New tables are invisible to existing queries.
- Feature flags: `integrations.enabled` (global), platform `status`, per-mapping
  `status`.
- The only behavioural change to staff redemption is that it cannot spend money
  already reserved by an external checkout. With no reservations, behaviour is
  identical.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Migration applied to production without review | Migration files only; apply via Supabase Management API after approval |
| Reservation leak (never released) | Cron expiry + reconciliation dashboard + alerts |
| Capture/release race | Row locks + state machine + `capture_started_at` |
| Staff redemption vs external hold | Available = ledger − active reservations in the single internal function |
| Idempotency table growth | Retention job (e.g. 90 days for completed operations) |
| Card code enumeration | Strict validation rate limits + generic errors |
| Connector over-claim | Capability flags + separate verification states |
| Platform policy violation | Written approval gate; only official mechanisms |
| Sandbox contamination | Separate project/environment + credential scoping |
| Refund double-spend | Unique idempotency + sum-of-refunds check |

---

## 18. Open decisions for approval

1. **Sandbox isolation:** separate Supabase project (recommended) or
   `environment`-scoped rows in the same project?
2. **Gateway runtime:** Next.js route handlers (recommended, matches existing
   API/webhook code) or Supabase Edge Functions?
3. **Validation dependency:** hand-written validators (zero new deps) or add
   `zod` to `web/`?
4. **SDK distribution:** private registry, tarball, or repository-only package
   for now?
5. **Reservation TTL defaults:** 10 minutes with a 15-minute verified-capture
   grace window?
6. **Eligible components:** which order components may a gift card pay for per
   platform/business? This is a commercial decision.
7. **Refund policy:** full reversal only, or partial reversals per order line?
8. **Manual mapping approval:** require two admins for manual evidence
   (recommended) or one admin plus platform confirmation?

No implementation should begin until these are confirmed.
