# Tazilla Payments Architecture — MyFatoorah Multi-Vendor

> **HISTORICAL PLANNING DOCUMENT — DO NOT USE AS CURRENT INSTRUCTION.**
> The migration numbers and proposed file names below do not match what was
> actually applied. For current behavior read `docs/handover/00-START-HERE.md`,
> `docs/handover/02-payments.md` and `docs/architecture/current-flows.md`.

*Implementation guide for supplier onboarding, payment routing, embedded checkout, and MCP payment links.*
*Version 2.0 · November 2026 · Replaces the earlier sub-merchant draft.*

---

## 0. How to read this document

This is a build plan, not a proposal. Every table, column, endpoint and payload below is written against what is actually in this repository today (migrations `0001`–`0109`, `supabase/functions/*`, the Expo app and `web/`), and against the MyFatoorah APIs that are live on your account (Invoice v3 + Multi-Vendors).

Anything marked **⚠ confirm** is a decision or an external detail that must be checked with the MyFatoorah account manager before coding; it is not a guess to be implemented blindly.

Sections:

1. What already exists (and what is broken)
2. Target design in one page
3. Data model changes (two migrations)
4. Supplier onboarding (vendor + enterprise dashboards)
5. Payment routing (one invoice, correct supplier split)
6. Webhooks and fulfilment
7. Payment links for the MCP server
8. Embedded checkout on the web dashboard
9. Payments inside the Expo app
10. Reconciliation, deposits and refunds
11. Security rules
12. Environments, secrets and deployment
13. Phased rollout (least breakage)
14. Test plan
15. Open questions

---

## 1. What already exists (and what is broken)

### 1.1 The money model that is live

| Concern | Reality in this repo |
| --- | --- |
| Money | `bigint` **minor units** (halalas) everywhere, `currency text default 'QAR'`. Never `numeric`, never floats. |
| Vendor | `public.vendors` — `owner_id`, `status vendor_status`, `commission_bps` (basis points), `max_unredeemed_minor`, `myfatoorah_supplier_code` |
| Enterprise partner | `public.enterprise_partners` — `owner_id`, `status partner_status`, `integration_config jsonb`, `settlement_terms jsonb` |
| Catalogue | `products`, `product_variants`, `enterprise_products` |
| Order | `public.orders` — `buyer_id`, `status order_status`, `payment_status payment_status`, `payment_reference` (unique), `provider_invoice_id`, `order_ref`, `subtotal_minor`/`discount_minor`/`fee_minor`/`total_minor`, `delivery_method`, `scheduled_for` |
| Order lines | `public.order_items` — per-vendor `quantity`, `unit_price_minor`, `total_minor`, `commission_minor`, `vendor_share_minor`, `vendor_id`, `product_id`, `product_variant_id` |
| Voucher | `public.vouchers` (renamed from `gift_cards` in `0012`) — `product_id`, `order_id`, `order_item_id`, `buyer_id`, `vendor_id`, `initial_value_minor`, `remaining_value_minor`, `status voucher_status`, `fulfilment_type`, `card_code_hash`, `claim_token_hash` |
| Ledger | `public.ledger_entries` (append-only, signed minor units) |
| Payout | `public.payouts` — `vendor_id`, `order_id`, `amount_minor`, `status pending|paid|failed`, `myfatoorah_ref` |
| Idempotency | `public.payment_events` — unique `event_id`, `payload jsonb`, `processed_at` |

The `offers` name in older code is now a compatibility view over `products`. `gift_cards` no longer exists as a table.

### 1.2 What is already correct

- `supabase/functions/create-payment/index.ts` already computes commission server-side from `vendor.commission_bps`, enforces the vendor exposure cap (`vendor_outstanding_minor` + `max_unredeemed_minor`), and sends `Suppliers[]` to MyFatoorah.
- `supabase/functions/mcp/tools.ts` already creates `orders` **and** `order_items` with `commission_minor` / `vendor_share_minor`, uses an idempotency hash as `payment_reference`, and never trusts client prices.
- `fulfill_order(...)` is idempotent (returns the existing voucher if the order is already `paid`).

### 1.3 What is broken or missing (fix before adding features)

| # | Problem | Where |
| --- | --- | --- |
| P1 | Webhook reads `gift_cards` (renamed to `vouchers` in `0012`). Throws on every PAID event after fulfilment, so retries repeat. | `supabase/functions/payment-webhook/index.ts` |
| P2 | Signature verification is skipped when `MYFATOORAH_WEBHOOK_SECRET` is unset — **fails open**. | same file |
| P3 | `create-payment` inserts legacy `orders` columns (`offer_id`, `amount_minor`, `commission_minor`, `vendor_share_minor`) that `0012` dropped, and calls v2 `SendPayment`. It cannot succeed against the current schema. | `supabase/functions/create-payment/index.ts` |
| P4 | `deliverClaimLink()` is a stub — the recipient never receives the claim link. | `payment-webhook` |
| P5 | Mobile checkout is simulated: `processing.tsx` waits 1.6 s and always succeeds; no `functions.invoke`, no order created. | `app/(customer)/checkout/*` |
| P6 | The platform share is never carved out of the MyFatoorah invoice: `Suppliers[].InvoiceShare` is the full amount, so MyFatoorah gives the **whole** payment to the supplier. | `create-payment` |
| P7 | MCP can prepare an order but cannot produce anything payable. | `supabase/functions/mcp` |

P1–P4 are part of Phase 0 and are prerequisites for everything else.

---

## 2. Target design in one page

```
Customer / AI assistant / dashboard
        │
        ▼
   Tazilla server (Edge Function or Next.js server action)
        │  1. create/read order + order_items (prices, commission, vendor share)
        │  2. POST /v3/payments  (or /v3/sessions for embedded)
        ▼
   MyFatoorah  ── Invoice ──►  PaymentURL  ──►  customer pays
        │                         │
        │                         └─► return URL (deep link / web page)
        │
        └─ PAYMENT_STATUS_CHANGED webhook
                 │
                 ▼
         verify signature → payment_events (idempotent)
                 │
                 ▼
         fulfill_order() → vouchers + ledger
                 │
                 ▼
         claim link / email / push
```

Money split, per supplier line on the invoice:

```
Order.Amount            = sum(order_items.total_minor) / 100        (major units, QAR)
Suppliers[i].InvoiceShare        = order_items[i].total_minor / 100
Suppliers[i].ProposedDepositShare = order_items[i].vendor_share_minor / 100
```

- `InvoiceShare` values **must add up to** `Order.Amount`.
- `ProposedDepositShare` is what the supplier actually receives; the remainder is the platform's commission. When it is set, MyFatoorah ignores any commission configured on the supplier, so the platform commission stays exactly what `order_items.commission_minor` says.
- Do **not** put a commission percentage on the supplier in MyFatoorah: commission varies per vendor and per product, and it is already stored in the database.

Enterprise partners are suppliers too — same fields, same flow, `Suppliers[]` entry uses their supplier code.

---

## 3. Data model changes

Two additive migrations. No table renames, no dropped columns, nothing that breaks the current app if it is deployed before the code.

### 3.1 `supabase/migrations/0110_supplier_accounts.sql`

```sql
-- Supplier state for vendors
alter table public.vendors
  add column if not exists myfatoorah_supplier_status text not null default 'none',
  add column if not exists myfatoorah_supplier_created_at timestamptz,
  add column if not exists myfatoorah_kyc_status text,
  add column if not exists myfatoorah_kyc_reason jsonb,
  add column if not exists supplier_synced_at timestamptz,
  add column if not exists supplier_deposit_terms text,
  add column if not exists supplier_bank_name text,
  add column if not exists supplier_bank_account_last4 text,
  add column if not exists supplier_iban_last4 text;

alter table public.vendors
  drop constraint if exists vendors_supplier_status_check;
alter table public.vendors
  add constraint vendors_supplier_status_check
  check (myfatoorah_supplier_status in ('none','creating','pending','approved','rejected','suspended'));

-- Same for enterprise partners
alter table public.enterprise_partners
  add column if not exists myfatoorah_supplier_code text,
  add column if not exists myfatoorah_supplier_status text not null default 'none',
  add column if not exists myfatoorah_supplier_created_at timestamptz,
  add column if not exists myfatoorah_kyc_status text,
  add column if not exists myfatoorah_kyc_reason jsonb,
  add column if not exists supplier_synced_at timestamptz,
  add column if not exists supplier_deposit_terms text,
  add column if not exists supplier_bank_name text,
  add column if not exists supplier_bank_account_last4 text,
  add column if not exists supplier_iban_last4 text;

alter table public.enterprise_partners
  drop constraint if exists enterprise_partners_supplier_status_check;
alter table public.enterprise_partners
  add constraint enterprise_partners_supplier_status_check
  check (myfatoorah_supplier_status in ('none','creating','pending','approved','rejected','suspended'));

-- KYC documents for either kind of supplier.
create table if not exists public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('vendor','partner')),
  owner_id uuid not null,
  doc_type text not null,               -- trade_license | civil_id | bank_letter | ...
  myfatoorah_file_type integer,         -- 1..26 per MyFatoorah UploadSupplierDocument
  storage_path text not null,           -- bucket path, never bytes in the DB
  file_url text not null,
  mime_type text,
  file_size integer,
  status text not null default 'pending'
    check (status in ('pending','uploaded','approved','rejected')),
  rejection_reason text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  uploaded_to_provider_at timestamptz
);

create index if not exists supplier_documents_owner_idx
  on public.supplier_documents (owner_type, owner_id, doc_type);

alter table public.supplier_documents enable row level security;

drop policy if exists supplier_documents_owner_read on public.supplier_documents;
create policy supplier_documents_owner_read on public.supplier_documents
  for select using (
    (owner_type = 'vendor' and exists (
      select 1 from public.vendors v
      where v.id = owner_id
        and (v.owner_id = auth.uid() or public.is_vendor_member(v.id))
    ))
    or (owner_type = 'partner' and exists (
      select 1 from public.enterprise_partners p
      where p.id = owner_id
        and (p.owner_id = auth.uid() or public.is_enterprise_member(p.id))
    ))
    or public.is_admin()
  );

-- Writes go through the Edge Function (service role) only.

-- Payment columns on the order (all additive; provider_invoice_id already exists)
alter table public.orders
  add column if not exists provider_payment_id text,
  add column if not exists payment_url text,
  add column if not exists payment_link_expires_at timestamptz,
  add column if not exists payment_provider text;  -- already exists in 0012, kept for clarity
```

> `payment_provider` is added by `0012`; the `add column if not exists` line is a no-op there and keeps this migration idempotent.

### 3.2 `supabase/migrations/0111_payment_links.sql`

One row per shareable link. Needed by MCP (and reused by WhatsApp/e-mail sending later).

```sql
create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  buyer_id uuid references public.profiles (id) on delete set null,
  provider text not null default 'myfatoorah',
  provider_invoice_id text,
  provider_payment_id text,
  payment_url text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'QAR',
  status text not null default 'active'
    check (status in ('active','paid','expired','cancelled','failed')),
  channel text not null default 'link'
    check (channel in ('link','email','sms','whatsapp','all')),
  sent_to text,                          -- masked recipient when MyFatoorah sends it
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  paid_at timestamptz,
  unique (provider_invoice_id)
);

create index if not exists payment_links_order_idx on public.payment_links (order_id);
create index if not exists payment_links_buyer_idx on public.payment_links (buyer_id, created_at desc);

alter table public.payment_links enable row level security;

-- A customer may read links for their own orders; MCP/dashboards use the
-- service role. No client writes.
drop policy if exists payment_links_buyer_read on public.payment_links;
create policy payment_links_buyer_read on public.payment_links
  for select using (
    buyer_id = auth.uid()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.buyer_id = auth.uid()
    )
    or public.is_admin()
  );
```

### 3.3 What is deliberately **not** created

- No `sub_merchants` table — `vendors` already is the supplier record (`myfatoorah_supplier_code` exists since `0001`). A parallel table would duplicate ownership, break `vendor_documents.vendor_id`, and split the commission model.
- No `transactions` table — `orders` + `order_items` + `payment_events` + `ledger_entries` already cover it, in minor units.
- No new `payouts` table — keep the existing one and treat it as a mirror of MyFatoorah deposits (§10).

---

## 4. Supplier onboarding

### 4.1 Who can do it

| Dashboard | Who sees the page | Supplier record |
| --- | --- | --- |
| Vendor dashboard (`/dashboard/business` or a new `/dashboard/payments`) | `vendors.owner_id`, vendor staff with `can_manage_vendor`, admin | `vendors` row |
| Enterprise dashboard (`/dashboard/enterprise`) | partner owner, `enterprise_members` with management role, admin | `enterprise_partners` row |
| Admin | always | both |

A vendor must be `status = 'approved'` and have a signed trade licence before supplier creation is allowed. Enterprise partners must be `status = 'active'` (the enum is `draft`, `active`, `suspended`).

### 4.2 The page (shared component)

A single `<SupplierSetup />` component used by both dashboards, four steps:

1. **Business details** — legal name, contact name, mobile (with country code), e-mail, business type (1 home / 2 company). Prefilled from the vendor/partner record; editing writes back to `vendors`/`enterprise_partners`, not only to MyFatoorah.
2. **Bank details** — bank (dropdown from `GET /v2/GetBanks`), account holder name, account number, IBAN, deposit terms (Daily / Weekly / Monthly / OnDemand) and deposit day.
3. **Documents** — file picker → Supabase Storage bucket `vendor-media` (public read) or a new private `supplier-documents` bucket; each file becomes a `supplier_documents` row. Mapping to MyFatoorah `FileType`:
   | Doc | FileType |
   | --- | --- |
   | Commercial licence / trade licence | 2 |
   | Civil ID (front) | 1 |
   | Civil ID (back) | 6 |
   | Articles of association | 3 |
   | Signature authorisation | 4 |
   | Bank account letter | 21 |
   | Commercial register | 20 |
   | Other | 5 |
4. **Status** — pending review, approved, rejected (with reasons from the KYC webhook), suspended.

Buttons: *Create supplier* (step 1 → `CreateSupplier`), *Upload documents*, *Refresh status* (`GetSupplierDashboard`), *Resubmit* after rejection (`EditSupplier` + `UploadSupplierDocument`).

Show the plain fact that **MyFatoorah's KYC team approves suppliers**, usually 1–3 business days, and that no money can be routed until `IsApproved && IsActive`.

### 4.3 Edge Function: `supplier-onboard`

One new function, `supabase/functions/supplier-onboard/index.ts`, service role + caller JWT verified. It owns every write to MyFatoorah and to the supplier columns, so the browser never talks to MyFatoorah with the API key.

Actions (`{ action: ... }`):

| Action | Body | Calls | Writes |
| --- | --- | --- | --- |
| `create` | `{ ownerType, ownerId }` | `POST /v2/CreateSupplier` | supplier code, status `pending`, timestamps |
| `upload_document` | `{ documentId }` | `PUT /v2/UploadSupplierDocument` (multipart) | `supplier_documents.status = 'uploaded'` |
| `refresh` | `{ ownerType, ownerId }` | `GET /v2/GetSupplierDashboard?SupplierCode=` | `IsApproved`/`IsActive` → status |
| `update_bank` | `{ ownerType, ownerId, ... }` | `POST /v2/EditSupplier` | local bank last4, status `pending` again |

`CreateSupplier` request (only these fields; omit commission on purpose):

```json
{
  "SupplierName": "Al Noor Trading",
  "Mobile": "33445566",
  "Email": "accounts@alnoor.qa",
  "DepositTerms": "Weekly",
  "DepositDay": "1",
  "BankId": 3,
  "BankAccountHolderName": "Al Noor Trading W.L.L.",
  "BankAccount": "1234567890",
  "Iban": "QA58DOHB00001234567890ABCDEFG",
  "IsActive": false,
  "DisplaySupplierDetails": true,
  "BusinessName": "Al Noor Trading",
  "BusinessType": 2
}
```

Response → `Data.SupplierCode` (integer). Store it in `vendors.myfatoorah_supplier_code` **as text** (the column is `text`), and send it as a number in invoices.

Guard rails in the function:

- Resolve `ownerId` from `ownerType`; verify the caller owns it (`owner_id = auth.uid()`, membership, or admin) — never accept a supplier code from the client.
- Refuse to create a second supplier: if `myfatoorah_supplier_code is not null`, return the existing one.
- Use a DB row lock (`select ... for update`) around status transitions so two clicks cannot create two suppliers.
- If MyFatoorah returns `IsSuccess=false`, store `FieldsErrors` in `myfatoorah_kyc_reason` and return a readable message.

### 4.4 KYC status webhook

MyFatoorah sends `SUPPLIER_STATUS_CHANGED` (Event.Code `4`) to the same webhook endpoint:

```json
{
  "Event": { "Code": 4, "Name": "SUPPLIER_STATUS_CHANGED", "Reference": "WH-128071" },
  "Data": {
    "Supplier": { "Code": 279, "Name": "…", "Mobile": "…", "Email": "…" },
    "KycDecision": {
      "Status": "APPROVED" | "REJECTED",
      "Comments": "",
      "RejectionReason": [{ "Code": "1", "Description": "Expired Company License" }]
    }
  }
}
```

Signature input for this event is exactly:

```
Supplier.Code=279,KycDecision.Status=APPROVED
```

Handler: verify HMAC with `MYFATOORAH_WEBHOOK_SECRET`, upsert into `payment_events` (`event_id = Event.Reference`), map `Supplier.Code` back to `vendors`/`enterprise_partners`, set `myfatoorah_kyc_status`, `myfatoorah_kyc_reason`, and status `approved` / `rejected`. Never trust the e-mail in the payload to identify the row; use the supplier code.

### 4.5 What the vendor sees afterwards

- Status card: *Pending KYC / Approved / Rejected (reason) / Suspended*.
- Commission: `commission_bps` from the vendor row, shown as a percentage ("Tazilla keeps 12.5%").
- Balance block, read from `GetSupplierDashboard`: `TotalAwaitingBalance`, `TotalAwaitingToTransfer`, `TotalDepositedAmount`, `TotalNumberOfTransactions`. These are MyFatoorah's figures; cache them in the DB only if you need history.
- A "Payments are live" flag = supplier `approved` **and** `IsActive`.

---

## 5. Payment routing

### 5.1 One function owns invoice creation

Create `supabase/functions/_shared/myfatoorah.ts` exporting:

```ts
export async function createInvoiceForOrder(
  admin: SupabaseClient,
  orderId: string,
  opts: {
    channel?: 'link' | 'email' | 'sms' | 'all';
    sendToEmail?: string;
    sendToPhone?: string;
    redirectionUrl: string;
    createdBy?: string;
  },
): Promise<{ paymentUrl: string; invoiceId: string; paymentId: string | null; expiresAt: string | null }>;
```

Responsibilities:

1. Load the order (`for update` semantics via a service-role RPC or a transaction) and its `order_items`, joining `vendors` and `enterprise_partners`.
2. Reject if `payment_status = 'paid'` or a live link already exists (return the existing one — idempotency).
3. Recompute totals from `order_items` and assert they equal `orders.total_minor`; never trust a client amount.
4. Build `Suppliers[]`:
   - vendor item → `vendors.myfatoorah_supplier_code`
   - enterprise item → `enterprise_partners.myfatoorah_supplier_code`
   - item whose supplier is missing/not approved → fail with `supplier_not_ready` (do not silently send the money to the platform).
5. Convert to major units with a single helper:

```ts
const major = (minor: bigint | number) => Number((Number(minor) / 100).toFixed(2));
```

6. Allocate rounding: `InvoiceShare` must sum exactly to `Order.Amount`. Give every item `major(total)`, then fix the residual (±0.01) on the largest line.
7. POST `/v3/payments` to `MYFATOORAH_BASE_URL` (Qatar live: `https://api-qa.myfatoorah.com`, test: `https://apitest.myfatoorah.com`).
8. Persist `provider_invoice_id`, `provider_payment_id`, `payment_url`, `payment_link_expires_at`, `payment_provider = 'myfatoorah'`.
9. Insert a `payment_links` row when `channel` is used.
10. Return the URL.

### 5.2 The invoice payload

```json
{
  "Order": {
    "Amount": 250.0,
    "Currency": "QAR",
    "ExternalIdentifier": "3f1c…order uuid"
  },
  "Customer": {
    "Name": "Sara A.",
    "Email": "sara@example.com",
    "Mobile": { "CountryCode": "+974", "Number": "33445566" }
  },
  "NotificationOption": "LINK",
  "IntegrationUrls": {
    "Redirection": "https://tazilla.com.qa/payment/return",
    "Webhook": "https://<project>.supabase.co/functions/v1/payment-webhook"
  },
  "Suppliers": [
    { "SupplierCode": 175, "InvoiceShare": 200.0, "ProposedDepositShare": 176.0 },
    { "SupplierCode": 181, "InvoiceShare": 50.0,  "ProposedDepositShare": 44.0 }
  ],
  "MetaData": { "UDF1": "order:3f1c…", "UDF2": "buyer:<uuid>" },
  "Language": "AR"
}
```

Rules that matter:

- `NotificationOption`: `LINK` returns `Data.PaymentURL` without contacting the customer; `EMAIL` / `SMS` / `ALL` additionally send it (then `Customer.Email` / `Customer.Mobile` are mandatory).
- `InvoiceShare` sum = `Order.Amount`.
- `ProposedDepositShare` ≤ `InvoiceShare`; it is the supplier's net. Platform keeps `InvoiceShare − ProposedDepositShare`.
- Use `Order.Currency: "QAR"`; never send minor units to MyFatoorah.
- Keep `PaymentMethod` unset on links so the page shows every method enabled on the account.

Response (v3):

```json
{ "IsSuccess": true,
  "Data": { "InvoiceId": "6389754", "PaymentId": "07077…", "PaymentURL": "https://qa.myfatoorah.com/…", "PaymentCompleted": false } }
```

### 5.3 Commission and fees

- Platform commission = `order_items.commission_minor` (already written by MCP; compute the same way in the app).
- `ProposedDepositShare` carries it: supplier gets `vendor_share_minor`, platform gets `commission_minor`.
- MyFatoorah's own transaction fee is taken from the platform side by default. Decide explicitly (⚠ confirm with the account manager) whether Tazilla absorbs it or passes it on; if passed on, adjust `ProposedDepositShare` down and record the difference in `orders.fee_minor`. Do not change `commission_minor` retroactively.
- Store the provider's own numbers from the webhook (`Amount.ServiceCharge`, `ReceivableAmount`) in `payment_events.payload`; do not try to recompute them.

### 5.4 Baskets with several businesses

`gift_basket_items` can hold gifts from different vendors/partners, and one order can contain several `order_items`. One invoice with several `Suppliers[]` entries is supported and is the correct model — do **not** create one invoice per vendor (the customer would pay several times and fees multiply).

Voucher issuance stays per item, as `fulfill_order` already does (⚠ it currently issues only the **first** item — extend it to loop over all `order_items`, one voucher per line, before enabling multi-vendor baskets in production).

### 5.5 Who calls it

| Client | How |
| --- | --- |
| Expo app | `supabase.functions.invoke('create-payment', { body: { orderId, channel: 'link' } })` with the user session; then open the returned URL. |
| Web dashboard / storefront | Next.js server action (user session) → same Edge Function, or a Route Handler that reuses the same shared module. |
| MCP | The function **does not** call itself over HTTP; it imports `createInvoiceForOrder` from `_shared/myfatoorah.ts` and passes the service-role client plus the verified `buyer_id`. |
| Admin | Same function with an admin JWT; `created_by` recorded. |

The Edge Function must verify the caller's JWT (as `create-payment` does today), then check `orders.buyer_id = auth.uid()` before creating anything. Admin/staff may create for any order in their scope.

---

## 6. Webhooks and fulfilment

### 6.1 Endpoint

`POST https://<project>.supabase.co/functions/v1/payment-webhook`
Deployed **with** JWT verification disabled (MyFatoorah cannot send a Supabase JWT), but it must verify the MyFatoorah signature itself.

### 6.2 Signature (must not fail open)

`MYFATOORAH_WEBHOOK_SECRET` is required. If it is missing, return `500` and log — never accept the event.

- Payment events: HMAC-SHA256 (base64) over the comma-joined list the current code builds:
  `Invoice.Id=…,Invoice.Status=…,Transaction.Status=…,Transaction.PaymentId=…,Invoice.ExternalIdentifier=…`
- Supplier events: `Supplier.Code=…,KycDecision.Status=…`
- Compare with a constant-time function.

### 6.3 Processing order

1. Parse, verify signature.
2. `insert into payment_events (event_id, payload) on conflict do nothing`; if it already existed **and** `processed_at` is set, return `200`.
3. Dispatch on `Event.Name`:
   - `PAYMENT_STATUS_CHANGED` → invoice/transaction rules below.
   - `SUPPLIER_STATUS_CHANGED` → §4.4.
   - Anything else → store and ignore.
4. For `PAID` + `SUCCESS`: call `fulfill_order(provider_invoice_id, claim_token_hash, card_code_hash)`, then update the order (`payment_status='paid'`, `paid_at`), `payment_links.status='paid'`, and deliver the claim link. Read the recipient from `vouchers` (fix P1 — `gift_cards` is gone).
5. For `REFUNDED` / failed: update `orders.payment_status`, `payment_links.status`, and write an audit row. Do not delete vouchers automatically; a refunded voucher is a business decision (void + ledger reversal via an RPC).
6. Mark `payment_events.processed_at`.

### 6.4 Making fulfilment multi-item safe

`fulfill_order` currently locks one order, reads the **first** `order_items` row, issues one voucher, and returns it. Change it to:

```sql
for v_item in
  select * from public.order_items where order_id = v_order.id order by created_at
loop
  v_card_id := public.issue_gift_card(
    v_item.product_id, v_order.id, v_order.buyer_id, v_item.total_minor,
    p_claim_token_hash, v_order.recipient_name, v_order.recipient_email,
    v_order.recipient_phone, v_expires
  );
  update public.vouchers
     set card_code_hash = p_card_code_hash, order_item_id = v_item.id
   where id = v_card_id;

  insert into public.issued_vouchers_log …   -- optional, one row per claim token
end loop;
```

Keep the "already paid → return existing" guard. Because claim tokens are per voucher, accept an array `p_claim_tokens jsonb` (or JSON of `{ order_item_id, claim_token_hash, card_code_hash }`) instead of the current three scalar arguments. This is the one signature change in the whole plan; the webhook and the RPC are the only callers.

Note: `issue_gift_card` still names its first argument `p_offer_id` even though it now holds a `products.id` (`0012`). Keep the positional call above, or rename it in the same migration for clarity — it is internal, so renaming is safe.

---

## 7. Payment links for the MCP server

### 7.1 Goal

An AI assistant (ChatGPT/Claude/other MCP client) can take a customer from "I want to send a 200 QAR spa gift to Sara" to a **payable MyFatoorah link**, then report when it has been paid — without ever touching card data or MyFatoorah keys.

### 7.2 New tools

Add to `supabase/functions/mcp/tools.ts` and the `TOOLS` array in `index.ts`:

| Tool | Auth | Purpose |
| --- | --- | --- |
| `create_payment_link` | customer JWT | Turn an existing pending order into a MyFatoorah link. Returns URL, amount, expiry, order ref. |
| `get_payment_link` | customer JWT | Status of one link / order: `active`, `paid`, `expired`, `cancelled`. |
| `send_payment_link` | customer JWT | Ask MyFatoorah to e-mail/SMS the link to the customer or recipient (`EMAIL` / `SMS` / `ALL`). |

`check_order_status` already exists and should keep working; `get_payment_link` is the payment-specific view.

### 7.3 Input/output contracts

`create_payment_link`

```json
{
  "order_id": "uuid (preferred) or order_ref",
  "channel": "link | email | sms | all",
  "send_to": "optional e-mail or +974 phone; defaults to the buyer's contact",
  "idempotency_key": "client-provided string"
}
```

Output:

```json
{
  "order_ref": "MCP-8F2C1A9D04",
  "status": "active",
  "amount_minor": 20000,
  "amount": "200.00 QAR",
  "payment_url": "https://qa.myfatoorah.com/…",
  "expires_at": "2026-11-20T12:00:00Z",
  "delivery": { "channel": "link", "sent_to": null }
}
```

Rules:

- The order must belong to the caller (`orders.buyer_id = auth.uid()`), be `payment_status = 'unpaid'`, and have `order_items`.
- Reuse an existing `active` link instead of creating a second invoice; key on `idempotency_key` + order id.
- If the buyer's supplier is not approved, return a tool error `supplier_not_ready` with a human explanation — never fall back to a platform-only invoice.
- Return the URL, not the invoice internals. Never expose `SupplierCode`, API responses, or secrets.
- Rate limit: 5 link creations/minute/user (extend `mcp_rate_limits`), 60 status reads/minute.
- Log an audit row (`payment_links.created_by`), because this is a money action initiated by an AI.

`send_payment_link`

- `channel: "email"` requires an e-mail; `"sms"` requires `MobileCountryCode` + number; `"all"` both.
- MyFatoorah sends the message; Tazilla stores `sent_to` **masked** (`s***@example.com`, `+974****566`).
- If you prefer Tazilla-branded e-mail, keep `channel: "link"` and send through your own provider (Resend/Supabase) instead. The MCP tool should default to `link` and only send through MyFatoorah when the caller explicitly asks.

`get_payment_link`

- Reads `payment_links` + `orders`; if `active` and older than 2 minutes since last check, optionally calls `GET /v3/payments/{paymentId}` to refresh (server-side), then persists the status.
- Never returns card data or the recipient's full contact details.

### 7.4 Why a table instead of putting the URL on the order

- One order may legitimately have several links over time (expired → reissued).
- The MCP needs an audit trail of who created/sent a link.
- Expiry and status are payment-level facts, not order-level.

`orders.payment_url` stays as a convenience cache for "the latest link".

### 7.5 MCP server notes

- The function stays stateless; no session storage.
- `create_payment_link` is a **write** tool, so it must require a JWT like `create_gift_card_order` does today; public read tools stay public.
- Keep prices from the database; the tool never accepts an amount.
- Extend the README tool table and the `INSTRUCTIONS` string so assistants know to call `create_gift_card_order` first, then `create_payment_link`, then share the URL.

---

## 8. Embedded checkout on the web dashboard

Two supported paths; pick embedded first, hosted as fallback.

### 8.1 Embedded (recommended for the dashboard)

1. Server: `POST /v3/sessions` with `PaymentMode: "COMPLETE_PAYMENT"`, `Order.Amount`, `Currency: "QAR"`, `Suppliers[]`, `IntegrationUrls.Redirection`, `Customer`. Response gives `SessionId`, `SessionExpiry`, `EncryptionKey`.
2. Client: load `https://qa.myfatoorah.com/sessions/v1/session.js` (Qatar live; `https://demo.myfatoorah.com/sessions/v1/session.js` for test), then:

```js
myfatoorah.init({
  sessionId,
  containerId: 'mf-embedded',
  callback: onPayment,
  shouldHandlePaymentUrl: true,
});
```

3. `onPayment(response)`:
   - `paymentCompleted: true` only means the flow finished — **not** that money arrived.
   - For card/Apple Pay/Google Pay/STC Pay, `paymentData` is encrypted with `EncryptionKey`; decrypt it **server-side** (Route Handler) and read the status.
   - For hosted methods, MyFatoorah redirects to `redirectionUrl?paymentId=…`; the server calls `GET /v3/payments/{paymentId}`.
4. The webhook remains the source of truth; the browser callback only drives UI.
5. Never expose `EncryptionKey` or the API key to the browser.

### 8.2 Hosted link

Redirect to `PaymentURL` (or render it in an iframe where allowed). Simplest, works everywhere, no extra JS. Use it as the fallback when the embedded script fails to load.

### 8.3 Where it lives

- Customer checkout page in `web/` (`/checkout`) — after the order is created.
- Admin "send payment request" screens — same component with an admin-created order.

---

## 9. Payments inside the Expo app

The app is Expo SDK 58 / React Native 0.88 with Expo Router. Three options, in the order they should be built.

### 9.1 Phase 1 — in-app browser + hosted link (no native modules)

Recommended first, because it works in Expo Go and needs no PCI scope:

```ts
import * as WebBrowser from 'expo-web-browser';

const { data, error } = await supabase.functions.invoke('create-payment', {
  body: { orderId, channel: 'link' },
});
if (error) throw error;

const result = await WebBrowser.openAuthSessionAsync(
  data.paymentUrl,
  'tazilla://payment/return',      // your deep link
);

// Regardless of result.type, ask the server — the browser result is not proof.
router.replace({ pathname: '/(customer)/checkout/processing', params: { orderId } });
```

- `processing.tsx` must **poll** `orders.payment_status` (via a small RPC or `supabase.from('orders').select('payment_status')`) every 2 s for ~90 s instead of the current 1.6 s fake timer.
- Set `IntegrationUrls.Redirection` to `https://tazilla.com.qa/payment/return`, and have that page (or a universal link) bounce to `tazilla://payment/return`.
- Add `scheme: "tazilla"` in `app.json` (check what exists) and the associated-domains/asset-links files if you want universal links.
- Show a "Pay in browser" state with a clear "return to app" instruction.

This replaces the simulated checkout with a real one and is the least risky change in the app.

### 9.2 Phase 2 — embedded card form via the React Native SDK

Package: `myfatoorah-reactnative` (latest 1.4.0, native module — **not** available in Expo Go).

- Requires `expo prebuild` / an EAS development build, because the package ships `ios/` + `android/` native code and no official Expo config plugin. Autolinking works with prebuild; do not hand-edit `ios/`/`android/`.
- Init once at app start (never in a screen): `MFSDK.init(apiKey, MFCountry.QATAR, MFEnvironment.LIVE)` — but the **API key must not ship in the app**. For a production app, proxy session creation through the Edge Function and use the SDK only for the card view / Apple Pay / Google Pay flows that require a session; if the SDK demands the key on-device, treat this as a blocking security decision (⚠ confirm with MyFatoorah whether a public/session-only key is supported).
- Flows available: `initiateSession` → `MFCardPaymentView.load(...)` → `pay(...)`; `MFApplePayButtonView`; `MFGooglePayButton`; `executeDirectPayment` for direct card payments (needs MyFatoorah approval).
- Apple Pay additionally needs the Apple merchant ID, the `merchant` entitlement, and a real device; Google Pay needs a Google merchant ID and production access.
- Every success callback returns an `invoiceId` — treat it as a hint and confirm with `GET /v3/payments/{paymentId}` or the webhook before showing success.

### 9.3 Phase 3 — embedded web session inside a WebView

`POST /v3/sessions` + the same `session.js` as §8, loaded in `react-native-webview` with a small local HTML bridge. Only worth it if you need the exact web checkout UX in-app; it is more moving parts than 9.1 and more fragile than 9.2.

### 9.4 Decision guide

| Need | Use |
| --- | --- |
| Ship payments this month, no native changes | 9.1 |
| Cards + Apple Pay/Google Pay inside the app, willing to prebuild | 9.2 |
| One checkout UI across web and app | 9.3 |

---

## 10. Reconciliation, deposits and refunds

### 10.1 Deposits

MyFatoorah pays suppliers on the `DepositTerms` set at creation (Daily / Weekly / Monthly / OnDemand). Tazilla does **not** initiate payouts. Therefore:

- Keep `payouts` as a local mirror: one row per deposit returned by `GET /v2/GetSupplierDeposits`, `status = 'paid'`, `myfatoorah_ref` = the provider reference, `amount_minor` = deposit × 100.
- `GET /v2/GetSupplierDashboard` gives `TotalAwaitingBalance`, `TotalAwaitingToTransfer`, `TotalDepositedAmount`, `TotalBalance` — use it for the vendor/partner "Earnings" page.
- `POST /v2/TransferBalance` exists for moving between awaiting and available balance. ⚠ Confirm with the account manager when it is allowed (refund clawbacks, manual corrections) before wiring a button.

### 10.2 Reconciliation job

New scheduled Edge Function `payment-reconcile` (or a `web/` cron route, matching whatever you already run):

1. Every 5 minutes: orders `payment_status = 'unpaid'` with `provider_payment_id` older than 10 minutes → `GET /v3/payments/{paymentId}`; if paid, run the same fulfilment path as the webhook (idempotent).
2. Every hour: mark `payment_links` expired when `expires_at < now()` and status still `active`.
3. Nightly: refresh supplier dashboards and deposits into `payouts` / a small `supplier_balances` snapshot (optional).
4. Never mark an order paid without a provider response or a verified webhook.

### 10.3 Refunds

- Initiate in the MyFatoorah portal or their refund API (⚠ confirm the endpoint available on your account).
- Locally: `orders.payment_status = 'refunded'`, `vouchers` voided through an RPC that writes a reversing `ledger_entries` row, `payment_links.status = 'cancelled'`.
- The supplier's share must be recovered: either via `TransferBalance` from their awaiting balance, or deducted from the next deposit. This is a finance policy decision, not something to automate blindly — record it in `admin_actions`.

---

## 11. Security rules

1. **Server-side amounts only.** The client sends `orderId`/`productId`/`variantId`/`quantity`; the server computes totals, commission and shares. The MCP already does this; the app and web must too.
2. **Ownership checks on every money action**: order belongs to the buyer; supplier belongs to the vendor/partner; admin actions are audited.
3. **Service role and MyFatoorah keys never leave Edge Functions.** No `NEXT_PUBLIC_`, no `EXPO_PUBLIC_` payment keys, no keys in the app bundle.
4. **Webhook**: required secret, constant-time compare, `payment_events` idempotency, no state change before verification.
5. **Never log** card numbers, tokens, claim tokens, or full API responses containing customer contact data. Store only hashes of claim codes (already done).
6. **No PAN in the app.** Remove the card form in the mobile payment screen; use hosted/SDK flows. This is a PCI requirement, not a preference.
7. **RLS**: new tables get explicit policies (see migrations). `payment_links` is read-only to the buyer; writes are service-role only.
8. **Rate limits**: supplier creation (3/hour/owner), link creation (5/min/user), status reads (60/min).
9. **Supplier code is not a secret**, but it must never be accepted from the client — always resolve it from the database row the caller owns.

---

## 12. Environments, secrets and deployment

| Secret | Where | Notes |
| --- | --- | --- |
| `MYFATOORAH_API_KEY` | Edge Function secrets | Never in the app or web client |
| `MYFATOORAH_BASE_URL` | Edge Function env | `https://apitest.myfatoorah.com` (test) / `https://api-qa.myfatoorah.com` (Qatar live) |
| `MYFATOORAH_WEBHOOK_SECRET` | Edge Function secrets | Required; function returns 500 without it |
| `APP_PUBLIC_URL` | Edge Function env | Used for return/error URLs |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Provided by runtime | Service role only inside functions |
| `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` | `web/` env | Unchanged |

Deployment:

```bash
supabase db push --remote            # 0110, 0111
supabase functions deploy supplier-onboard
supabase functions deploy create-payment
supabase functions deploy payment-webhook --no-verify-jwt
supabase functions deploy mcp --no-verify-jwt
```

Test environment: MyFatoorah test account, `apitest` base URL, the demo `session.js`. Live Qatar: `api-qa` base URL and `https://qa.myfatoorah.com/sessions/v1/session.js`.

---

## 13. Phased rollout (least breakage)

Each phase is shippable on its own and leaves the app working.

**Phase 0 — make the current pipeline honest (no new features)**
- Fix P1 (`vouchers`, not `gift_cards`), P2 (fail closed), P4 (real claim e-mail).
- Rewrite `create-payment` to v3 with the *existing* single-supplier behaviour but correct columns and `ProposedDepositShare`.
- Make `fulfill_order` multi-item safe.
- Turn the mobile `processing` screen into a real poller.
- Result: a real payment can complete end-to-end for a single vendor.

**Phase 1 — supplier onboarding**
- Migrations `0110`; `supplier-onboard`; dashboard pages for vendors and partners; KYC webhook; admin queue.
- Vendors without an approved supplier are visible in the admin dashboard with a "Payments not ready" badge.

**Phase 2 — routing to the right supplier**
- `_shared/myfatoorah.ts`; `Suppliers[]` with `ProposedDepositShare`; multi-item baskets.
- Orders are refused when the supplier is not ready (explicit error, not a silent platform-only invoice).

**Phase 3 — MCP payment links**
- Migration `0111`; `create_payment_link`, `get_payment_link`, `send_payment_link`; README/instructions update; rate limits.

**Phase 4 — web embedded checkout**
- `/v3/sessions` + `session.js` on the dashboard checkout; hosted link fallback.

**Phase 5 — native app payments**
- `myfatoorah-reactnative` with an EAS dev build, or the WebView session if the SDK key handling cannot be made safe.

**Phase 6 — operations**
- Reconciliation cron, deposits mirror, refund RPC, admin reporting.

---

## 14. Test plan

1. **Sandbox supplier**: create one with `CreateSupplier`, upload a licence, have it approved by the account manager, confirm `GetSupplierDashboard.IsApproved && IsActive`.
2. **Link**: create an order for 200 QAR, `create_payment_link`, open the URL, pay with the test cards from MyFatoorah's docs, confirm the webhook arrives, `payment_events` has one row, `orders.payment_status = 'paid'`, one voucher per item.
3. **Split**: in the MyFatoorah portal, confirm the supplier's `InvoiceShare` = item total and the deposit reflects `ProposedDepositShare` (platform keeps the commission).
4. **Idempotency**: replay the same webhook 5 times → still one voucher, one `payment_events` row, `processed_at` set once.
5. **Security**: invalid signature → 401; missing secret → 500; another customer's order id → 403/404; client-supplied amount ignored.
6. **Supplier rejection**: webhook with `KycDecision.Status = REJECTED` → status and reasons visible on the dashboard.
7. **Embedded**: `POST /v3/sessions` → card payment in the web checkout → callback + webhook both resolve to the same order.
8. **App**: deep link returns to the app, polling flips to success only after the webhook, and a cancelled payment shows a retry.
9. **Expiry**: link past `expires_at` → `expired`, `create_payment_link` reissues a new link for the same order.
10. **Regression**: existing voucher redemption, statements and admin manual vouchers still work.

---

## 15. Open questions (⚠ confirm before coding)

1. **Who absorbs MyFatoorah's transaction fee** — platform or supplier? It changes `ProposedDepositShare` maths.
2. **Refund/clawback path**: is `TransferBalance` allowed for this, or should refunds be handled by the account manager?
3. **Supplier deposits**: are the terms set per supplier at creation final, or can Tazilla change them later (`EditSupplier` review)?
4. **Enterprise partners**: are they expected to be MyFatoorah suppliers too, or does the partner settle with Tazilla outside MyFatoorah? The design above assumes supplier = yes; if not, partner items need a different split model.
5. **Qatar live base URL**: confirm `api-qa.myfatoorah.com` and `qa.myfatoorah.com/sessions/v1/session.js` for your account (the docs list them, but confirm with the account manager).
6. **React Native SDK key handling**: can the RN SDK run with a session-only credential, or does it require the secret API key on-device? If it requires the secret, Phase 5 must use the WebView option instead.
7. **Embedded `paymentData` decryption**: use MyFatoorah's sample for the exact algorithm; do not invent it.

---

## Appendix A — File map

| Concern | File |
| --- | --- |
| Invoice creation (shared) | `supabase/functions/_shared/myfatoorah.ts` *(new)* |
| HTTP entry for checkout | `supabase/functions/create-payment/index.ts` *(rewrite)* |
| Supplier onboarding | `supabase/functions/supplier-onboard/index.ts` *(new)* |
| Webhooks | `supabase/functions/payment-webhook/index.ts` *(fix + extend)* |
| MCP payment tools | `supabase/functions/mcp/tools.ts`, `index.ts` |
| Supplier columns / docs | `supabase/migrations/0110_supplier_accounts.sql` *(new)* |
| Payment links | `supabase/migrations/0111_payment_links.sql` *(new)* |
| Fulfilment | `supabase/migrations/0012_vouchers_and_orders.sql` (`fulfill_order`) → new migration |
| Vendor onboarding page | `web/app/(dashboard)/…/payments/supplier/page.tsx` *(new)* |
| Enterprise onboarding page | `web/app/(dashboard)/enterprise/…/supplier/page.tsx` *(new)* |
| Web checkout | `web/app/(customer)/checkout/…` *(new/extend)* |
| App checkout | `app/(customer)/checkout/payment.tsx`, `processing.tsx` |
| Money helpers | `src/lib/money.ts` (client) and a server-side minor-unit helper |

## Appendix B — Corrections to the previous draft

| Old draft | Reality |
| --- | --- |
| `sub_merchants` table with `settlement_percentage`, `kyc_status`, bank fields | `vendors` / `enterprise_partners` + `myfatoorah_supplier_code`, `commission_bps` |
| `transactions` table with `numeric(12,2)` and SAR | `orders` + `order_items` + `payment_events` + `ledger_entries`, `bigint` halalas, QAR |
| `payouts.vendor_id → sub_merchants`, `amount numeric` | `payouts.vendor_id → vendors`, `amount_minor bigint` |
| `POST /api/v2/transactions/charge` with a `sub_merchants` percentage array | `POST /v3/payments` (or `/v3/sessions`) with `Suppliers: [{SupplierCode, InvoiceShare, ProposedDepositShare}]` |
| `POST /transactions/payout` | No such endpoint; MyFatoorah deposits on `DepositTerms` |
| `supabase migration save` / `migration train` | `supabase migration new`, `supabase db push` |
| `0069_perfect_submerchant_schema.sql` | Does not exist (`0069` is advertising hourly pricing) |
| RLS `auth.uid() = vendor_id` | `vendor_id` references `vendors`, not a user |
| "Since no data exists yet" | Production has migrations `0001`–`0109` applied |
| `Timestamp` columns | `timestamptz` |
