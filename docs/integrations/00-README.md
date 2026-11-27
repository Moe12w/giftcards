# External platform integrations

This folder is the working home for the **universal gift-card payment integration
network**: making Tazella-issued gift cards usable as a payment method inside
third-party commerce apps (Snoonu, Talabat, Keeta, and later restaurant, retail
and POS systems).

## Read in this order

| Document | Purpose | Status |
|---|---|---|
| `01-codebase-audit.md` | Phase 1 audit of the existing marketplace, gift-card engine, business model, payments, APIs and tests | Complete |
| `02-integration-architecture.md` | Phase 2 architecture, data model, API contract, reservation lifecycle, SDK, sandbox and phased plan | Approved; implemented through Phase 5 (Level 1) |
| `03-platform-capability-assessments.md` | What is actually known about Snoonu, Talabat and Keeta, and what must be obtained before a connector is written | Investigation open |

## What is implemented now

| Phase | Status | Files |
|---|---|---|
| 1 — audit | Complete | `01-codebase-audit.md` |
| 2 — design | Approved | `02-integration-architecture.md` |
| 3 — identity | Implemented, not live-DB verified | `supabase/migrations/0174_integration_identity.sql` |
| 4 — redemption engine | Implemented, DB tests written but unrun (no `TEST_DATABASE_URL`) | `supabase/migrations/0175_integration_redemption.sql`, `0176_integration_authenticate_fix.sql`, `0177_integration_variable_conflict.sql`, `0178_integration_refund_conflict.sql`, `tests/db/integrations.test.ts` |
| 5 — gateway | Implemented; pure gateway tests pass, no end-to-end run | `web/lib/integrations/gateway.ts`, `web/lib/integrations/errors.ts`, `web/lib/integrations/errors.test.ts`, `web/app/(app)/api/integrations/v1/**`, `web/app/(app)/api/cron/route.ts` |
| 6 — checkout SDK | Implemented, unit-tested, no live-platform certification | `packages/checkout-sdk/` |
| WordPress / WooCommerce | Scaffold implemented, untested against WordPress | `packages/wordpress/tazella-gift-cards/` |
| 6–10 — sandbox, connectors, dashboards, release | Not started | — |

A public, bilingual information page lives at `/plug-in-integrations` and is
linked from the site footer (`web/components/SiteFooter.tsx`). It describes the
integration surface and platform status without claiming any live third-party
connection.

On the live database, `mock` remains the generic internal API test platform. A
separate `wordpress` platform row was added for the WooCommerce plugin, with its
own sandbox credential and verified mapping. Capabilities are marked supported
but **not yet verified** for checkout/payment lifecycle until a real WordPress
run is completed. WordPress credentials are **vendor-bound** (`mapping_id` on
the credential row): a site's key can only resolve its own verified mapping, so
it cannot point at another vendor's external ID. Platform-level credentials for
Snoonu/Talabat/Keeta remain unbound and resolve from the signed request.

The gateway endpoints are documented in `02-integration-architecture.md` §5.
Every platform capability remains declared `supported: false, verified: false`
until real documentation, credentials and platform approval exist. No connector
or production credential has been created.

## Running the integration DB tests

The tests in `tests/db/integrations.test.ts` need a real Postgres with the
migrations applied. A helper builds the connection string from the existing
`.env` (`SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`) without printing it:

```bash
node scripts/run-integration-db-tests.mjs              # verify migrations are present
node scripts/run-integration-db-tests.mjs --apply-migrations
```

`--apply-migrations` changes the schema of the target database; use a branch or
staging database where possible. The tests themselves always roll back. Do NOT
use the live database for WooCommerce end-to-end runs: those are separate HTTP
transactions and would permanently write orders and redemptions.

## Non-negotiable rules

1. **The marketplace remains the single source of truth.** No second balance
   store, ledger, business identity system or redemption engine.
2. **External redemptions are redemptions, not purchases.** They must never
   create an order, a MyFatoorah invoice, or trigger fulfilment.
3. **The backend decides money.** A checkout component can request an operation;
   it can never decide validity, ownership, balance or capture.
4. **No invented platform APIs.** A connector is only written against verified,
   authorized platform documentation and credentials. Until then it stays a
   declared, disabled capability.
5. **Additive, backward-compatible changes only.** Existing redemption,
   purchase, refund and dashboard behaviour must keep working unchanged.

## Current production readiness

The repository has **Level 1 infrastructure code written, but the Level 1
evidence gate is not met**: the migrations have not been applied to a live or
test database, and the new database tests in `tests/db/integrations.test.ts`
are skipped until `TEST_DATABASE_URL` is set. No
platform capability has been verified and no connector or production credential
exists, so this is not usable for production payment acceptance.

Read `02-integration-architecture.md` §16 for the Level 1–7 definitions and the
evidence required to claim each level.
