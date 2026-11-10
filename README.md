# Giftly — Gift Card Marketplace

A gift card marketplace built with Expo + React Native + Expo Router and Supabase.
This repository currently focuses on the **customer app**, with the database
schema and payment/wallet Edge Functions scaffolded.

Read `PROJECT_BRIEF.md` first — it is the source of truth for rules and scope.

## What works today

- Customer app shell: Home, offer detail + buy flow, My cards, card detail with
  a large QR code, Orders, Account.
- English + Arabic strings with device-locale detection and RTL support.
- Shared design system in `src/theme.ts` and `src/components/`.
- Money helpers that only use integer minor units (fils).
- **Demo mode**: the app runs with sample offers and cards before Supabase is
  connected. Any valid email + 8-character password "signs in".
- Database migrations (schema, RLS, append-only ledger, atomic redemption).
- Edge Function scaffolds for payment creation, webhook, claim, and wallet pass.
- Vitest tests for the money rules.

Vendor and admin areas are placeholders for the next phase.

## Prerequisites

- Node.js 20+ and npm.
- The **Expo Go** app on your phone (iOS/Android), or a browser for web.

## Run the app (no credentials needed)

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go, or press `w` for web.

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
