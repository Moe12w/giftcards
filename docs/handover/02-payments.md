# Payments

This document explains every way money enters Giftly. Read it before changing anything in a payment path.

## The one rule

All gift-card and bulk MyFatoorah invoices are created by:

`supabase/functions/_shared/invoices.ts` → `createInvoiceForOrder()`

Do not write another `SendPayment` call in a page or action. The four entry points below are thin wrappers around this helper.

## Four entry points

| Entry point | Where | What it creates |
|---|---|---|
| Customer buys a gift card | Expo `app/(customer)/checkout/payment.tsx` → `create-payment` | `orders`, `order_items`, one MyFatoorah payment |
| Bulk buyer buys one offer | `web/components/BulkOfferPurchase.tsx` → `create-bulk-payment` | `bulk_orders`, shared `orders`, `order_items` |
| Bulk buyer checks out a basket | `web/components/BulkCart.tsx` → `create-bulk-payment` | one bulk order per vendor/partner, one invoice |
| AI assistant creates a link | MCP `create_payment_link` | `payment_links`, `myfatoorah_payments` |

## What the shared helper does

1. Reads `order_items` for the order.
2. For each item, finds the selling vendor or enterprise partner.
3. Checks the business is approved/active, has a MyFatoorah SupplierCode, provider status `Active`, and `payment_eligibility = true`.
4. Groups items by SupplierCode.
5. Builds the v2 `Suppliers[]` array with **`InvoiceShare` only**.
6. Calls `POST /v2/SendPayment`.
7. Stores the result with `myfatoorah_payment_recorded`.

Commission is **provider-managed only**. Never send `ProposedShare` or `ProposedDepositShare`, and never deduct a platform commission in code. This avoids charging twice.

## The complete payment lifecycle

```text
Customer confirms
  → order is prepared (pending, unpaid)
  → createInvoiceForOrder() creates a MyFatoorah invoice
  → customer is redirected to hosted checkout
  → MyFatoorah sends PAYMENT_STATUS_CHANGED webhook
  → payment-webhook Edge Function verifies signature and deduplicates
  → /api/merchant-payment/confirm re-queries MyFatoorah
  → myfatoorah_payment_confirmed marks the order paid and writes the ledger
  → myfatoorah_fulfill_order issues Giftly cards
     OR bulk_fulfill_from_payment issues bulk/partner codes
  → claim links are sent for ordinary gift cards
```

The browser return URL also re-queries the provider, but it is **not** the authority by itself.

## Idempotency

| Mechanism | Where | Purpose |
|---|---|---|
| Client idempotency key | Expo/bulk checkout | Prevents duplicate orders when a user double-taps |
| `webhook_events` unique `(provider, event_id)` | payment webhook | Prevents duplicate webhook processing |
| `payment_links` unique `(order_id, idempotency_key)` | MCP | Reuses an active link instead of a second invoice |
| `orders.payment_reference` unique | all flows | Business-level duplicate guard |
| `myfatoorah_payment_recorded` on-conflict | all flows | One payment record per order |
| `myfatoorah_fulfill_order` voucher check | confirmation | Never issues a second card for the same order |

## Important tables

| Table | Purpose |
|---|---|
| `orders`, `order_items` | Order header and purchased gift cards |
| `myfatoorah_payments` | Provider invoice/payment IDs and status |
| `myfatoorah_payment_allocations` | One row per SupplierCode; reconciles with invoice total |
| `myfatoorah_refunds` | Refund requests and provider responses |
| `financial_ledger` | Immutable money trail; vendor and partner columns |
| `vendor_financial_balances`, `partner_financial_balances` | Derived balances |
| `payment_links` | MCP-generated shareable links |
| `vendor_settlements` | Manually recorded provider deposits |
| `webhook_events` | Webhook deduplication |

## Supplier lifecycle

Vendors and enterprise partners use the same supplier model:

- `vendors.myfatoorah_*` (migration `0119`)
- `enterprise_partners.myfatoorah_*` (migration `0123`)
- Admin eligibility requires: platform active/approved, provider status `Active`, approved payment application, banking and approved documents.
- Uploaded documents are private. The FileType mapping lives in `0119`.
- Rejected documents can be replaced; internal review status and provider submission status are separate.

## Statuses a user sees

| Status | Meaning |
|---|---|
| Not started | No supplier created |
| Information required | Payment application incomplete |
| Documents pending | Documents not approved internally |
| Submitted to MyFatoorah | Supplier/application sent |
| Under verification | Provider KYC pending |
| Additional information required | Provider asked for more data |
| Approved / Active | Provider confirmed Active and Giftly enabled payments |
| Rejected | Provider rejected the supplier |
| Suspended | Platform suspended the business; separate from provider status |

## Advertising is different

Advertising payments do **not** use supplier allocation. They go through a separate Next.js webhook and their own ledger. See `03-advertising.md`.

## Testing checklist

Before enabling live payments, test in the MyFatoorah test environment:

1. Vendor registration and payment application.
2. Supplier creation and document upload.
3. KYC webhook → status sync.
4. Admin enable payments.
5. Customer purchase → webhook → gift-card issue.
6. Duplicate webhook replay.
7. Failed/abandoned payment.
8. Refund.
9. Multi-supplier basket reconciliation.
10. Provider API timeout/retry.
