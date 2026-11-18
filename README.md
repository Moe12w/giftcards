# Giftly — Gift Card Marketplace

Giftly is a Qatari gift-card marketplace with three apps in one repository:

- `app/` + `src/` — Expo / React Native **customer app**
- `web/` — Next.js **website and dashboards** for vendors, enterprise partners,
  bulk buyers and admins
- `supabase/` — database migrations and Edge Functions

**Start here:** `docs/handover/00-START-HERE.md`. It explains the product, where
each feature lives, how to make changes safely and which verification commands
to run. `PROJECT_BRIEF.md` is the original product brief, not the current
technical source of truth.

## What works today

- Customer app: gift discovery, checkout through MyFatoorah, claim/redemption,
  baskets, support and notifications.
- Web dashboards: vendor, enterprise, bulk buyer and admin, including payment
  applications, MyFatoorah supplier onboarding, advertising, team access and
  financial reporting.
- Multi-vendor payments: gift cards, bulk baskets and MCP payment links share
  one invoice helper and are confirmed by a signed webhook.
- English + Arabic bilingual web and app copy.
- Private document storage, RLS, audit log and append-only ledgers.
- 57 automated tests plus Expo and web typechecks.

Historical planning documents (`payment-processing-architecture.md`,
`ADVERTISING_SYSTEM_PLAN.md`, `docs/HANDOVER-REVIEW.md`) are kept for context but
should not be followed as current instructions.

## Prerequisites

- Node.js **22.13+** (22 LTS or 24 LTS) and npm. Expo 58 does not support Node 20.
- The **Expo Go** app on your phone (iOS/Android), or a browser for web.

## Run the app (no credentials needed)

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go, or press `w` for web.

Demo data (offers, cards, baskets and gift drafts) is stored on the device with
AsyncStorage. Nothing syncs between devices until Supabase is configured, so two
people running the repo see independent demo data.

- Customer home: `/`
- Login (demo): `/login`
- Claim page (demo token): `/claim/demo-token`

## Add Supabase later

1. Copy `.env.example` to `.env`.
2. Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from
   your Supabase project (Project Settings → API).
3. Restart the dev server.

When those values are present the app switches from demo data to real Supabase
queries and auth. Never put secret keys in `.env` — the anon key is public, the
service role key is not.

## Apply the database

The migrations are numbered and must run in order:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Never edit a migration that has already run — add a new numbered file instead.
Never run `supabase db reset` against the live project.

## Deploy Edge Functions

Secrets are set in Supabase, never in Git:

```bash
npx supabase secrets set MYFATOORAH_API_KEY=... MYFATOORAH_WEBHOOK_SECRET=... APP_PUBLIC_URL=...
npx supabase functions deploy create-payment payment-webhook claim-gift wallet-pass
```

## Tests and checks

```bash
npm test          # Vitest money-rule tests
npm run typecheck # TypeScript
```

## Project layout

```
app/(auth)/        login and sign up
app/(customer)/    customer tabs and detail screens
app/(vendor)/      vendor area (placeholder)
app/(admin)/       admin area (placeholder)
app/claim/         public gift claim page
src/lib/           Supabase client, auth, data, money helpers, types
src/components/    Button, TextField, Card, Badge, StatCard, EmptyState, Money, QRCode
src/theme.ts       design tokens
src/i18n/          en.json, ar.json
supabase/migrations/  numbered schema changes
supabase/functions/   payment, webhook, claim, wallet pass
docs/design/       visual references and NOTES.md
```

## Money rules (summary)

- All money is integer minor units (fils). QAR 100 = 10000.
- Balances are derived from `ledger_entries`, never stored or edited.
- `ledger_entries` is append-only (database trigger).
- Redemption locks the card row and is atomic.
- A card is `redeemed` only when its balance is exactly zero.
- Duplicate payment webhooks never issue duplicate cards.

## Notes / open questions

- Claiming without login: the claim page marks a card claimed and returns a
  wallet pass. Decide whether claiming should also attach the card to a new or
  existing account so it appears in "My cards".
- Wallet pass generation is scaffolded but returns `wallet_not_configured`
  until Apple/Google credentials are provided.
- The design theme is a placeholder until `docs/design/` references are added.
