# Handover review — HISTORICAL SNAPSHOT

> This review describes an earlier state of the repository. Several issues it
> lists (legacy `create-payment`, `payment-webhook` reading `gift_cards`, missing
> `order_items`, test counts) have since been fixed. For current behavior read
> `docs/handover/00-START-HERE.md` and `docs/handover/02-payments.md`. The
> security note about the universal test account may still be relevant and must
> be checked against production before relying on this document.

Prepared for the developer taking over payments and onboarding. Read
`PROJECT_BRIEF.md` first — it is still the source of truth. This document lists
what is built, what is stubbed, and what is broken, with file references.

**How this was reviewed:** source review of `app/`, `src/`, `web/`, `supabase/`
(migrations, edge functions, seed); `tsc --noEmit` in both `web/` and the repo
root; `npm test` (Vitest). No database was available, so migrations were read,
not executed.

---

## 1. Payments — the purchase path is not connected

The mobile app is a complete UI with **no working purchase**. From
`app/(customer)/checkout/payment.tsx`, pressing Pay navigates to
`app/(customer)/checkout/processing.tsx`, which waits 1.6 s and always routes to
`success.tsx`. Nothing is written to the database: the app never inserts an
order, never issues a voucher and never calls an Edge Function (`functions.invoke`
appears nowhere in `src/` or `app/`).

`app/(customer)/checkout/summary.tsx` only pushes to the payment screen, and
`src/lib/gift-draft.tsx` keeps the draft in AsyncStorage. The success screen
renders that draft and resets it.

Card entry in `src/components/PaymentMethods.tsx` is a custom PAN/expiry/CVC
form. It validates the fields and discards them (`addPaymentMethod` is imported
but never called), and the Apple Pay / Google Pay buttons call the same
`onPay()`. **Do not keep collecting card numbers in-app** — PCI scope and a
store-review risk. Replace with a hosted page (MyFatoorah invoice URL) or the
provider's SDK, and drop the form.

### Edge Functions are written against the pre-0012 schema

| Function | Problem |
| --- | --- |
| `supabase/functions/create-payment` | Inserts `orders` with legacy `offer_id`/`amount_minor` and **never creates `order_items`**. `fulfill_order` (`supabase/migrations/0012_vouchers_and_orders.sql:614`) requires an order item and raises `order has no items`, so payment can succeed but no voucher is ever issued. It also sends `Suppliers[0].InvoiceShare` as the **full** amount, so the platform commission recorded on the order is never collected. `CallBackUrl` is `${APP_PUBLIC_URL}/payment/success`, which does not exist in `web/` (and `APP_PUBLIC_URL` defaults to `https://example.com`). `Idempotency-Key` is sent to the V2 `SendPayment` endpoint, which the code comment itself notes is unsupported. |
| `supabase/functions/payment-webhook` | Reads `gift_cards`, but that table was renamed to `vouchers` in `0012_vouchers_and_orders.sql:63` — the function fails after fulfilment and on every retry. `deliverClaimLink` is a stub (`// TODO: send the claim link by email`) so recipients never get their link. Signature verification is **skipped entirely when `MYFATOORAH_WEBHOOK_SECRET` is unset** (fails open). |
| `supabase/functions/wallet-pass` | Rewritten: reads `vouchers` (not the renamed `gift_cards`), signs Apple `.pkpass` files and creates Google Wallet objects. Correct but unconfigured until the certificate, service account and `WALLET_PASS_TOKEN_SECRET` are set as secrets — until then it answers `503 wallet_not_configured` and the app shows its "not available yet" copy. See `docs/wallet-pass-setup.md`. |
| `supabase/functions/claim-gift` | Calls `claim_card`, which does exist and is token-hash + rate-limit based. The mobile claim screens call the `claim_preview` / `claim_voucher` RPCs directly (`src/lib/claim.ts`), so this function is unused — keep it or delete it. |

There is no `/payment/success` or `/payment/error` route anywhere, and no
return-path handling on mobile. `web/` has a working manual-payment path
(`adminIssueManualVoucher` in `web/lib/actions/admin.ts:204`) that issues a real
order, voucher and ledger entry — useful as a reference and for testing.

**What "payments" actually requires here:** create `order_items`, call
MyFatoorah with the correct split, add a return route, make webhook verification
mandatory, create the claim-email delivery (Resend is already integrated in
`web/lib/email.ts` and configurable from admin settings), and cover duplicate
webhooks and refunds with tests.

---

## 2. Onboarding

- **Vendor registration and approval work**: `web/lib/actions/vendor.ts`
  (`submitVendorApplication`, `saveVendorProfile`, locations, staff invites) and
  `web/lib/actions/admin.ts:69` (`adminSetVendorStatus`). `register_vendor_account`
  and invites exist in the database.
- **Vendor documents cannot be uploaded.** `vendor_documents` is only read:
  `web/app/admin/(dashboard)/vendors/[id]/page.tsx:82` and
  `web/app/vendor/(dashboard)/settings/page.tsx:45`. There is no insert/upload
  action, no storage path and no admin review action. The onboarding checklist in
  `web/app/vendor/(dashboard)/onboarding/page.tsx` shows the step but it can
  never be completed. This is the biggest onboarding gap.
- **Enterprise partners have no self-serve signup**: `web/app/enterprise/` only
  has login, forgot-password and the dashboard. Partners are created by admins.
- **Business buyers** register at `/business/register`, are approved by admins,
  and support an "auto-approve" setting (`bulk_registration_requires_approval`).
- **Mobile has no vendor or admin area.** Only `app/(admin)/admin.tsx` exists and
  it is a placeholder ("built after the customer app").
  `PROJECT_BRIEF.md` puts vendors on the web, so this is consistent — but do not
  assume a mobile vendor app exists.

---

## 3. Features that exist only on paper

- **Statements**: `supabase/migrations/0100_create_statements_table.sql` and
  `statement-export-feature.md` exist, but nothing in `web/`, `src/` or `app/`
  reads or writes the `statements` table. Vendor CSV export
  (`/vendor/reports/export`) builds the file from orders directly, so the table
  is dead weight until the feature is built (or dropped).
- **Wallet passes**: implemented end to end — the buttons on
  `app/(customer)/card/[id]` call `src/lib/wallet-pass.ts`, which asks
  `supabase/functions/wallet-pass` for the links; the function signs the
  `.pkpass` and mints the Google save JWT. It stays dark until the Apple Pass
  Type ID certificate and the Google service account exist as secrets (see
  `docs/wallet-pass-setup.md`), so on a project without them the buttons still
  show the "not available yet" alert. What remains is credential setup and a
  real-device test, not code.
- **Purchase claim email**: not sent by the purchase path. Admin can send a claim
  link manually (`adminEmailClaimLink`, `web/lib/actions/admin.ts:293`) and bulk
  buyers have an outbox (`bulk_email_outbox`), but the consumer flow has no email.
- **Push notifications**: device registration (`src/lib/push.ts`) and a sender in
  `web/app/api/cron/route.ts` for "gift due" only. Other notification rows are
  in-app only.

---

## 4. Bugs and correctness issues

1. ~~Failing test~~ **Fixed** — the Arabic assertion in `src/lib/money.test.ts`
   now expects the app's deliberate Latin digits (`1,234.50 ر.ق`).
2. **Demo mode can leak into production** — without
   `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`, `src/lib/auth.tsx:37-44` signs the user
   in as `demo-user` and `src/lib/data.ts` serves `MOCK_*` data. Basket ownership
   checks fall back to `'demo-user'` (`app/(customer)/basket/[id].tsx:101`). A
   release build with missing env silently shows fake data instead of failing.
3. **Account deletion** — now implemented in migration
   `0109_account_deletion.sql` and wired through `deleteMyAccount()` in
   `src/lib/data.ts`. It deletes the auth user and personal rows, keeps orders
   and vouchers as financial records with the buyer link cleared, and blocks
   admin/vendor/enterprise/business accounts with a "contact support" message.
   Both `0108` and `0109` are applied on the production project.
4. **Scheduled gifts** — customers choose a delivery date, not a time, so one
   daily run is enough. `web/vercel.json` now runs `/api/cron` at `5 0 * * *`
   (00:05 UTC, 03:05 in Qatar — the same date) and the route/docs describe that
   date-based behaviour instead of implying hourly delivery.
5. **Hard-coded environment in `web/next.config.ts`** — the Supabase project ref
   for `images.remotePatterns` is baked in; a staging/prod split will break
   uploaded images.
6. **Repo hygiene** — `audit-tmp.cjs` (a one-off audit script) is committed at the
   repo root. `web/` has no lint script and no ESLint config; there are 22 `as
   any` casts and two suppressions repo-wide.
7. **No CI** — `.github/workflows` does not exist. Nothing runs typecheck, tests
   or migrations automatically.

---

## 5. Security / release blockers

1. **Known admin account created by a migration.**
   `supabase/migrations/0040_universal_test_login.sql` inserts
   `test@test.com` with password `test12345` as platform admin, vendor owner and
   enterprise owner, and resets every `%@tazella.test` password to the same value.
   Because it is a migration, `supabase db push` applies it to production. If the
   production project has had migrations applied, **that account exists there
   now**:
   - delete the `test@test.com` user (cascades to profile, roles, memberships) in
     the production project;
   - remove `0040_universal_test_login.sql` from the migration chain (or neuter
     it) and keep demo logins in `supabase/seed.sql` only, which is never pushed;
   - rotate any credentials that shared that password.
2. **Migrations applied — verify in the app.** `0108_tenant_isolation_hardening.sql`
   (cross-tenant holes in the advertising partner RPCs, voucher
   lookup/reconciliation, business-account self-approval, buyer writes on bulk
   orders and the `statements` policy) and `0109_account_deletion.sql` (real
   account deletion) are both applied on the production project, and the server
   migration history lists `0109`. What remains is a check on a real device:
   delete a customer account from Account → Delete account, then confirm that
   login no longer works while the vendor still sees the past order.
3. **Webhook fails open** without `MYFATOORAH_WEBHOOK_SECRET` (see §1). Make the
   secret required and return 500 when missing.
4. **Card data in the app** (see §1) — remove the PAN form.
5. **MCP endpoint** (`supabase/functions/mcp`) is documented to deploy with
   `--no-verify-jwt`; read tools are public by design and write tools verify the
   caller's JWT. Confirm the public tools only expose marketplace data, and note
   that its rate limiter is in-memory per isolate (`0107_mcp_rate_limits.sql`
   adds a database table — use it).

---

## 6. Store release readiness

`app.json` has **no `ios.bundleIdentifier`, no `android.package`, no
`extra.eas.projectId`**, and there is **no `eas.json`**. Consequences:

- `eas build` / `eas submit` cannot produce store builds yet;
- `src/lib/push.ts` needs `extra.eas.projectId` to obtain an Expo push token, so
  push registration cannot work in a release build;
- versioning (`1.0.0`) and icons/splash exist, but build profiles, credentials
  and store metadata do not.

Add identifiers, an EAS project id, `eas.json` (development/preview/production),
and the privacy manifest/store listing requirements, including the account
deletion path from §4.

---

## 7. Testing and quality baseline

- 3 test files, all in the mobile money/formatting layer
  (`src/lib/money.test.ts`, `tone.test.ts`, `sessions.test.ts`), 25 passing.
- **No tests** for the web app, RLS policies, RPCs, redemption, bulk orders or
  edge functions.
- No CI, no web lint, no DB tests. The tenant-isolation work in `0108` would be a
  good starting point for pgTAP-style tests.

---

## 8. Suggested order of work

1. Clean up: remove the universal test-login migration and delete the account in
   production; confirm migrations `0108`/`0109` on a real device (already
   applied); delete `audit-tmp.cjs`.
2. Store setup: bundle ids, EAS project, `eas.json`, then a TestFlight/internal
   build.
3. Payments: `order_items` creation → MyFatoorah split with commission → return
   route → mandatory webhook verification → claim email → duplicate/refund
   tests. Delete the in-app card form.
4. Onboarding: vendor document upload (storage + action + admin review) and the
   enterprise signup decision.
5. Wallet passes: set the credentials and test a real pass on iOS and Android
   (`docs/wallet-pass-setup.md`), then statements (or remove the dead table/doc).
6. Add CI: typecheck both apps, run tests, and a migration dry-run.

---

## 9. What was verified

- `web/`: `npm ci` then `npx tsc --noEmit` — passes.
- repo root: `npm ci` then `npx tsc --noEmit` — passes; `npm test` — 24 pass,
  1 fail (`formatMoney` Arabic digits).
- Migrations were read, not executed (no database or Supabase CLI in this
  environment).
