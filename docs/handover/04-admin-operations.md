# Admin operations

Plain-English guide to the day-to-day admin jobs.

## Where admin lives

Everything is under `/admin/*`. Navigation is grouped by task. The most used pages are:

| Task | Page |
|---|---|
| Approve businesses | `/admin/vendors`, `/admin/enterprise` |
| Approve payment applications and documents | `/admin/merchant-onboarding` |
| Manage vendor/partner suppliers | vendor or partner detail page |
| Configure MyFatoorah | `/admin/payment-management` |
| Record settlements | `/admin/settlements` |
| Review advertising | `/admin/advertising` |
| Create admin users | `/admin/team` |
| Read support messages | `/admin/support` |
| Audit log | `/admin/audit` |

## Approving a business

- **Vendor**: status goes from `pending` to `approved`. This controls marketplace visibility and payments.
- **Enterprise partner**: status goes from `draft` to `active`. Required before payment eligibility.

Suspending a business stops its ability to sell and receive payments. It is separate from the MyFatoorah supplier status.

## Payment applications

Admins review:
- business and contact information,
- payment methods,
- bank details,
- uploaded documents,
- signed processing agreement.

Per-document statuses: `pending_review`, `approved`, `rejected`, `replacement_required`.

Once approved, banking complete and documents approved, an admin can create the supplier and then enable payments.

## Supplier management

On a vendor or enterprise detail page:

1. **Create MyFatoorah supplier** — only once; the SupplierCode is permanent.
2. **Sync provider status** — pulls real status from GetSuppliers.
3. **Enable/Disable live payments** — requires provider status `Active`, approved application, approved documents and valid banking.
4. **Submit to MyFatoorah** — retries a failed document submission.

Rejection comments from MyFatoorah are displayed on the page.

## MyFatoorah settings

Admin → Payment management stores:
- API key,
- base URL (test or live Qatar),
- webhook secret,
- public app URL.

The page also shows the exact webhook URL and callback URL to paste into the MyFatoorah portal. Required webhook events: `PAYMENT_STATUS_CHANGED`, `SUPPLIER_STATUS_CHANGED`, `REFUND_STATUS_CHANGED`.

Use test environment first: `https://apitest.myfatoorah.com`.

Live Qatar: `https://api-qa.myfatoorah.com`.

## Refunds

Admins can initiate refunds from Payment management. The system:
- calls MyFatoorah's supplier refund endpoint,
- records the refund reference,
- updates the order,
- voids issued gift cards,
- writes a reversing ledger entry.

Do not assume MyFatoorah has already reversed a supplier deposit — check the provider portal.

## Settlements

MyFatoorah does not expose a settlement-reporting API for this account. Admins record deposits manually in `/admin/settlements`. Each record includes vendor, reference, amount, status, date and notes.

## Advertising admin

See `03-advertising.md`. In short:
- set placements, slot prices and rules,
- approve campaigns,
- suspend advertisers or grant credit,
- review finance and refunds,
- configure the separate advertising MyFatoorah settings.

## Team access

Admins can create other admin accounts at `/admin/team` with a chosen email and password. Existing accounts are never overwritten.

Vendors manage their own staff at `/vendor/staff`; enterprise managers add colleagues in `/enterprise/settings`. Both create real login accounts immediately.

## Audit

Sensitive actions are written to `audit_log` and shown at `/admin/audit`. Passwords and card data are never logged.
