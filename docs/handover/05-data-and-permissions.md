# Data and permissions

This is a plain-English map of the important tables and who can access them.

## Golden rules

1. Most tables have **Row Level Security (RLS)** enabled. A user can only see rows they own unless they are an admin.
2. Financial and merchant writes mostly go through `SECURITY DEFINER` RPCs in SQL, not direct table writes from the browser.
3. Never expose the service-role key to the browser.
4. Never put a secret in a logged message.
5. Historical migrations are not edited. Add a new migration file.

## Identity tables

| Table | What it holds |
|---|---|
| `auth.users` | Supabase login accounts (email, password hash) |
| `profiles` | Public user profile: name, email, language, status |
| `user_roles` | Platform role: customer, vendor_owner, vendor_manager, vendor_redemption_staff, enterprise_user, admin |
| `vendor_members` | Which user belongs to which vendor, with vendor role |
| `enterprise_members` | Which user belongs to which partner, with partner role (`owner`, `manager`, `analyst`) |

## Business tables

| Table | What it holds |
|---|---|
| `vendors` | Gift-card businesses, status, commission, supplier fields |
| `enterprise_partners` | Partners whose own codes are listed for sale (codes issued by the partner, not Marajukoo — not a reseller relationship), status, supplier fields |
| `vendor_locations` | Physical locations |
| `vendor_applications` | Platform onboarding (separate from payment approval) |
| `merchant_applications` | Payment processing application (vendor or partner) |
| `merchant_application_documents` | KYC documents, FileType mapping, provider submission status |
| `merchant_agreements`, `merchant_agreement_signatures` | Versioned agreement and e-signatures |

## Catalogue and gift cards

| Table | What it holds |
|---|---|
| `products`, `product_variants` | Gift cards for sale |
| `enterprise_products`, `enterprise_code_inventory` | Partner products and encrypted own codes |
| `orders`, `order_items` | Purchases and amounts |
| `vouchers` | Issued gift cards / partner codes |
| `ledger_entries` | Gift-card value movements; append-only |
| `redemptions` | Redemption history |

## Payment tables

| Table | What it holds |
|---|---|
| `myfatoorah_payments` | Provider invoice/payment IDs and status |
| `myfatoorah_payment_allocations` | One row per supplier code |
| `myfatoorah_refunds` | Refund records |
| `financial_ledger` | Vendor/partner money trail; append-only |
| `vendor_financial_balances`, `partner_financial_balances` | Derived balances |
| `vendor_settlements` | Manual settlement records |
| `payment_links` | MCP-generated links |
| `webhook_events`, `payment_events` | Webhook dedupe for gift cards and advertising |

## Advertising tables

See `03-advertising.md`. All names start with `advertising_`.

## Support tables

| Table | What it holds |
|---|---|
| `support_requests` | Tickets from website, app and dashboards |
| `support_ticket_messages` | Thread replies |
| `notifications` | In-app notifications |

Who can read:
- ticket owner (`customer_id = auth.uid()`),
- admins (all tickets).

## Storage

| Bucket | Contents |
|---|---|
| `merchant-documents` | Private KYC documents |
| Vendor image buckets | Logos and banners |

Documents are served only through authenticated route handlers using short-lived signed URLs. There are no public storage URLs for KYC files.

## Permission helpers

| Helper | Meaning |
|---|---|
| `is_admin()` | Admin by role or profile flag |
| `is_vendor_member(vendor_id)` | User belongs to vendor |
| `can_manage_vendor(vendor_id)` | Admin, vendor owner or manager |
| `is_enterprise_member(partner_id)` | User belongs to partner |
| `can_manage_partner(partner_id)` | Admin, partner owner or manager |
| `is_approved_business_buyer()` | Approved bulk buyer |

## Vendor vs partner

For payments they are deliberately identical:
- both have their own supplier code and status,
- both need admin eligibility,
- both appear in `Suppliers[]` in a payment,
- both have financial balances and ledger entries.

They differ only in the product they sell and their platform status values.
