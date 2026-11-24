# Start here

This is the first document to read if you have just been given this codebase.

## What the product is

Tazilla is a Qatari gift-card marketplace with three kinds of business:

| Type | Sells | How it is redeemed |
|---|---|---|
| **Vendor** | Tazilla-issued gift cards or experiences | Customer or staff scans/redeems in the Tazilla system |
| **Enterprise partner** | Codes the partner already issues itself (e.g. Sephora, H&M, Lulu Hypermarket) | Customer enters the code in the partner's own app or website |
| **Bulk buyer** | Buys many gift cards at once for staff or clients | Codes/links are sent to recipients |

The difference between the two sellers is who creates the code. For a **vendor**, Tazilla
issues the gift card and staff redeem it in the Tazilla system. For an **enterprise partner**,
the partner's own company generates the codes and redeems them in its own channel; Tazilla
lists and sells them but is **not a reseller** — the codes are not bought from the partner in
bulk and resold, and the partner's brand and redemption stay with the partner.

There are also **admins**, who approve businesses, manage payments and run the platform.

A customer uses the **Expo mobile app**. Businesses and admins use the **Next.js web app**. Supabase holds the database, authentication and server-side functions.

## The three apps

| Folder | What it is | Who uses it |
|---|---|---|
| `app/`, `src/` | Expo / React Native mobile app | Customers |
| `web/` | Next.js web app | Vendors, enterprise partners, bulk buyers, admins, public website |
| `supabase/` | Database migrations and Edge Functions | Backend |

## The most important rule

**Do not change money code casually.** Payments, ledgers, refunds and supplier allocations are security-sensitive. Read `02-payments.md` first.

When you change a payment path, use the shared helper in
`supabase/functions/_shared/invoices.ts` instead of writing a new MyFatoorah call.

## How to make a change safely

1. Find the page or function in the table below.
2. Read the relevant document in this folder.
3. Make the smallest possible change.
4. Run the checks:
   - `npm test` at the repository root (57 tests)
   - `cd web && npm run build`
   - `cd web && npx tsc --noEmit --incremental false`
5. Apply SQL migrations with the Supabase Management API, not by hand in the dashboard.
6. Deploy changed Edge Functions with `npx supabase functions deploy <name> ...`.
7. Deploy the web app with `vercel --prod --yes` from the repository root.

## Where things live

| Need to change... | Start here |
|---|---|
| Customer checkout | `app/(customer)/checkout/`, `supabase/functions/create-payment/` |
| Bulk buying | `web/app/business/(portal)/`, `web/components/BulkCart.tsx`, `create-bulk-payment` |
| Vendor/enterprise payment onboarding | `web/app/{vendor,enterprise}/(dashboard)/payments/` |
| MyFatoorah supplier lifecycle | `supabase/functions/supplier-onboard/`, `0119`/`0123` migrations |
| Admin payment settings | `web/app/admin/(dashboard)/payment-management/` |
| Advertising | `web/app/{vendor,enterprise,admin}/(dashboard)/advertising/`, `08-advertising.md` |
| Team access | `web/lib/actions/team.ts`, `web/lib/team-members.ts` |
| Support messages | `06-support-and-teams.md` |

## Documents in this folder

- `01-setup-and-deployment.md` — commands, secrets, deploy steps
- `02-payments.md` — all payment flows, idempotency, statuses
- `03-advertising.md` — the full advertising product
- `04-admin-operations.md` — day-to-day admin tasks
- `05-data-and-permissions.md` — tables and who can read/write them
- `06-support-and-teams.md` — support tickets and team accounts
- `07-troubleshooting.md` — common problems
- `08-glossary.md` — terms in plain English

Also see `docs/architecture/current-flows.md` for a compact entry-point → function → table map.

## Historical documents — read with care

- `payment-processing-architecture.md` is **old planning**. It proposes migration names that do not match what was applied. Use it for ideas only.
- `ADVERTISING_SYSTEM_PLAN.md` is **stale**. Manual bank transfer is disabled; `03-advertising.md` is current.
- For advertising payment setup, `docs/advertising-myfatoorah.md` is accurate but narrower than `03-advertising.md`.
