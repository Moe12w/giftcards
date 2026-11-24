# Current Tazella flow map

Last updated: 2026-11-18

For a full handover guide, start at `docs/handover/00-START-HERE.md`. This file is the compact technical map.

This is the map to read before changing anything that touches money or permissions.

## Entry points → Edge Functions

| Surface | Entry point | Edge Function | DB write |
|---|---|---|---|
| Expo gift checkout | `app/(customer)/checkout/payment.tsx` | `create-payment` | `orders`, `order_items`, `myfatoorah_payments` |
| Web bulk offer (single) | `web/components/BulkOfferPurchase.tsx` | `create-bulk-payment` | `bulk_orders`, `orders`, `order_items` |
| Web bulk basket | `web/components/BulkCart.tsx` | `create-bulk-payment` | same as above, one supplier per vendor/partner |
| MCP AI payment link | `create_payment_link` in `supabase/functions/mcp/tools.ts` | `mcp` | `payment_links`, `myfatoorah_payments` |

All four use **`_shared/invoices.ts` → `createInvoiceForOrder()`** for:
supplier resolution, readiness checks, `Suppliers[]` allocation, `SendPayment` v2 and `myfatoorah_payment_recorded`.

Do not reimplement invoice creation in an entry point.

## Confirmation and fulfilment

`POST /v2/SendPayment` → MyFatoorah webhook → `payment-webhook` Edge Function
→ `POST /api/merchant-payment/confirm` → re-query provider →
`myfatoorah_payment_confirmed` → `myfatoorah_fulfill_order` (Tazella cards) or
`bulk_fulfill_from_payment` (bulk codes / partner codes).

The return URL (`/api/merchant-payment/callback`) also re-queries the provider but is never the authority by itself.

## Supplier lifecycle

- Vendor: `vendors.myfatoorah_*` + `0119` RPCs.
- Enterprise partner: `enterprise_partners.myfatoorah_*` + `0123` RPCs. Same model, same gates.
- Admin eligibility requires: platform active/approved, provider `Active`, approved merchant application, banking and approved documents.
- Document uploads: `0119` `merchant_application_documents` FileType mapping; bytes stay in the private `merchant-documents` bucket.
- Status sync: `sync-myfatoorah-suppliers` and the `SUPPLIER_STATUS_CHANGED` webhook.

Commission is **provider-managed only**. Never send `ProposedShare`/`ProposedDepositShare` and never deduct a platform commission in code.

## Team access

Direct account creation (no invite token):
- `web/lib/team-members.ts` → `auth.admin.createUser({ email_confirm: true })`
- vendor: `vendorCreateStaff`; enterprise: `enterpriseCreateMember`; admin: `adminCreateTeamMember`
- Existing accounts are never overwritten.

The old `vendor_invites` table/RPCs remain in the database for historical rows but the UI and accept action are removed.

## Shared UI components

- `AdminSupplierPanel` — vendor and enterprise admin detail pages.
- `FinancialsView` — vendor and enterprise Financials pages.
- `BulkCart` / `BulkOfferPurchase` — bulk buying; basket state in localStorage (`tazella.bulk-basket`).

## Intentionally duplicated

- English/Arabic i18n mirrors.
- Historical SQL migrations (do not rewrite applied versions).
- Tests.
