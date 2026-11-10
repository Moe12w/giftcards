# Phase 1 — Audit of the existing Expo application

Date: 2026-11-10
Scope: `gift-card-marketplace` (Expo SDK 58, Expo Router 58, React Native 0.88, React 19, Supabase JS 2.119)

This audit was produced by reading every route file (101), every shared component (31), every
file in `src/lib/` (18), all 9 SQL migrations and all 4 Edge Functions. No files were modified.

---

## 1. Executive summary

The customer app is **further along than the backend it targets**. The UI is polished and almost
entirely functional; the database is ~1,300 lines of well-designed schema that the app barely
touches. Three concrete consequences:

1. **The app cannot actually use the database today.** There is no `.env`, so `hasSupabaseConfig`
   is `false` and the app runs 100% in demo mode. But even with credentials configured, the
   Supabase path is broken: `src/lib/data.ts` selects `vendors.banner_url`, a column that **does
   not exist in any migration**, so every offer query would fail with a PostgREST error.
2. **The two most important stores are pure mocks.** `src/lib/cards.tsx` (wallet, My Gifts, card
   detail, vendor dashboard) and `src/lib/baskets.tsx` (baskets, invites, collaborative flow) are
   AsyncStorage-backed with **no Supabase code path at all**.
3. **No Edge Function is ever called.** `create-payment`, `payment-webhook`, `claim-gift` and
   `wallet-pass` exist and are well written, but a repo-wide grep for `functions/v1` /
   `.functions.invoke` returns zero hits.

Good news: the schema already has the hard parts right — append-only ledger, atomic row-locked
redemption, RLS, a session-based fulfilment mode (added in migration 0009), and gift baskets with
the realtime publication already configured. **The work is mostly "connect what exists" plus the
three new fulfilment systems the brief requires** (enterprise code inventory, vendor/enterprise/admin
web apps, and the web company site).

---

## 2. Application inventory

### 2.1 Structure

```
app/          101 route files (7 _layout.tsx + 94 screens)
src/components/  31 shared components
src/lib/      18 modules (data, auth, cards, baskets, catalog, sessions, money, glyphs, …)
src/i18n/     en.json + ar.json (827 keys each, full parity)
supabase/migrations/  9 files
supabase/functions/  4 Edge Functions + _shared
assets/       icons, fonts (Figtree, SpaceMono)
```

### 2.2 Navigation

| Level | Type | Notes |
|---|---|---|
| Root | Stack | `AuthProvider` → `CardProvider` |
| `(onboarding)` | Stack | 4 slides → `/login` |
| `(auth)` | Stack | login, sign-up, forgot/reset password, verify email/phone, profile setup, notifications permission |
| `(customer)` | Stack | `BasketProvider` → `GiftDraftProvider`; redirects to `/login` when Supabase is configured and no user exists |
| `(customer)/(tabs)` | Tabs | **4 visible tabs**: Explore, Gift Basket, My Gifts, Profile |
| `(vendor)` | Stack | 1 screen — the new session dashboard |
| `(admin)` | Stack | 1 placeholder screen |
| `claim/[token]` | root Stack | 10 public screens, no auth guard |

**Hidden legacy routes** (kept for deep links, `href: null` in the tab layout): `explore`, `send`,
`cards`, `orders`, `account`. Plus redirect shims at `/offer/:id` → `/gift/:id` and
`/send/join` → `/basket/join`.

**Deep links:** scheme `giftly`. `Linking.createURL` is called exactly once
(`app/(customer)/basket/[id].tsx:171`) for basket invite codes. Claim links are minted
server-side in `payment-webhook` (`randomToken(32)`, SHA-256 stored). No `Linking.addEventListener`
— URL handling is left entirely to Expo Router.

**Two URL collisions exist:** `/` is claimed by `app/index.tsx` and `app/(customer)/(tabs)/index.tsx`;
`/send` by `app/(onboarding)/send.tsx` and `app/(customer)/(tabs)/send.tsx`.

### 2.3 Orphan routes (routable, nothing navigates to them)

`/checkout/summary`, `/checkout/failed`, `/gift/:id/amount`, `/cards`, `/account`.

### 2.4 Components

All 31 are genuinely implemented — none are stubs. Two are unused: `StatCard` and `OfferTile`.
`GiftBox3D` is the standout: a 635-line dependency-free animated 3D gift box (perspective
`rotateY`, idle sway, tap-to-open spring, pan-to-rotate, confetti, vouchers flying in).

---

## 3. Placeholders and hard-coded content

### 3.1 Whole-screen placeholders

| Location | Evidence |
|---|---|
| `app/(admin)/admin.tsx:9,15` | "Admin area placeholder" — body is one `EmptyState` |
| `app/(customer)/states/[slug].tsx:34-39` | Screen body *is* an `EmptyState` |
| `app/(customer)/support/refund-status.tsx:19-27` | `Card` and `EmptyState` render identical copy |
| `app/(customer)/gift/[id]/redemption.tsx:37` | All 3 steps render the same i18n key |

### 3.2 Simulated work (`setTimeout` standing in for a real call)

`forgot-password.tsx:27` · `reset-password.tsx:29` · `verify-email.tsx:29` · `verify-phone.tsx:26`
· `notifications-permission.tsx:14` · `checkout/processing.tsx:12` · `basket/contribute.tsx:104`
· `basket/send.tsx:63` · `basket/[id].tsx:99` (fake friend contribution) · `support/chat.tsx:32`.

### 3.3 Mock data read directly by screens (24 sites, bypassing `data.ts`)

| Data | Consumers |
|---|---|
| `MOCK_NOTIFICATIONS` | `(tabs)/index.tsx` (unread bell count), `notifications/index.tsx`, `notifications/[id].tsx` |
| `MOCK_RECIPIENTS` | `send/recipient.tsx`, `send/contacts.tsx` (+2 inline contacts), `(tabs)/send.tsx`, `profile/recipients.tsx`, `gift/[id]/design.tsx` |
| `MOCK_PAYMENT_METHODS` | `profile/payment-methods.tsx`, **`src/components/PaymentMethods.tsx`** (shared checkout component) |
| `MOCK_LOCATIONS` | `business/[id].tsx` |
| `DEMO_CLAIM` | all four `claim/[token]` screens — the token param is ignored, the QR encodes a constant `GIFTLY-DEMO-2026` |
| `MOCK_CARDS` + `MOCK_VENDOR_CARDS` + `MOCK_REDEMPTIONS` | `src/lib/cards.tsx` (seed for the whole wallet + vendor dashboard) |
| `MOCK_BASKETS` + `MOCK_OFFERS` | `src/lib/baskets.tsx` (seed + simulated contribution offer pool) |
| hard-coded vendor list | `app/(vendor)/vendor.tsx:31-39` — 7 of 12 vendors |

### 3.4 Forms that submit nothing

`support/contact.tsx:37` · `support/report.tsx:37` · `support/report-gift.tsx:37` ·
`support/refund.tsx:37` · `profile/security.tsx:22-33` (password change) ·
`profile/delete.tsx:26-29` ("Delete account" only signs out) · `profile/addresses.tsx:24` (local
state, lost on unmount) · `profile/preferences.tsx`, `profile/privacy.tsx`,
`notifications/preferences.tsx` (local toggles) · `profile/favourites.tsx:22` (first three offers
stand in for favourites) · `checkout/summary.tsx:94` (fee hard-coded to "QAR 0.00", promo compares
against the literal `'GIFT10'`).

---

## 4. Authentication

`src/lib/env.ts` → demo mode is simply "no `EXPO_PUBLIC_SUPABASE_*`". **No `.env` exists**, so the
app always runs in demo mode.

`src/lib/auth.tsx` wraps Supabase Auth and injects a hard-coded `DEMO_USER`
(`id: 'demo-user'`) when unconfigured. `signIn`/`signUp`/`signOut` are no-ops in demo mode.
`src/lib/supabase.ts` creates a module-level singleton with AsyncStorage-backed persistence
(`sb-<ref>-auth-token`) and `detectSessionInUrl: false` — which **breaks Supabase email-confirmation
deep links**.

**Roles:** there is no role model. `profiles.is_admin` is a single boolean. `vendor_members`,
`user_roles`, `enterprise_members` — none exist.

---

## 5. Data layer

`src/lib/data.ts` is the only Supabase-querying module (5 functions). Demo mode returns mock arrays;
Supabase mode queries `offers`, `gift_cards`, `card_balances`, `orders`.

### 5.1 Critical schema mismatches (these break the Supabase path)

| # | Problem | Evidence |
|---|---|---|
| 1 | `vendors.banner_url` is selected but **no migration ever creates that column** → every offer query errors | `data.ts:18,31` vs `0001:43-58` |
| 2 | `Offer` presentation fields (`icon`, `tone`, `category`, `occasions`, `rating`, `location`) have **no DB columns** → category/occasion/collection pages return empty, vendor grouping collapses | `types.ts:76-87`, `catalog.ts:143-190` |
| 3 | `GiftCard` presentation fields (`vendor_id`, `vendor_name`, `offer_title`, `icon`, `tone`, `delivery_status`, `scheduled_for`, `message`) have **no DB columns** → the scheduled/delivered/opened gift filters are permanently empty | `types.ts:104-121`, `gifts/[filter].tsx:30-51` |
| 4 | `card_balances.sessions_remaining` exists in the 0009 view but is **never selected** → session cards show 0 remaining | `data.ts:53-59` vs `0009:64-72` |
| 5 | `cards.tsx` / `baskets.tsx` have no Supabase path; `myCards` filters `buyer_id === 'demo-user'` → wallet empty for any real user | `cards.tsx:123` |

### 5.2 Entities with **no table at all**

`Recipient` · `AppNotification` · `PaymentMethod` · `BusinessLocation`.

---

## 6. Local persistence

| Key | Contents |
|---|---|
| `giftly.cards.v1` | `{cards, entries}` — the whole mock ledger + in-app redemptions |
| `giftly.baskets.v1` | `GiftBasket[]` — baskets, items, participants, activity |
| `giftly.gift-draft` | the multi-step gift flow draft |
| `giftly.onboarding.seen` | `'1'` (defined twice: `src/lib/onboarding.ts` and `app/index.tsx`) |
| `sb-<ref>-auth-token` | Supabase session (only when configured) |

No `SecureStore`, no MMKV, no filesystem. The language choice is **not persisted**.

---

## 7. Realtime — none on the client

`grep` for `.channel(`, `postgres_changes`, `subscribe(`, `removeChannel` → **0 matches** in client
code (the one `subscribe(` hit is unsubscribing from `onAuthStateChange`).

The database side *is* ready: `0008:353-372` already adds `gift_baskets`,
`gift_basket_items`, `gift_basket_participants`, `gift_basket_activity` to the
`supabase_realtime` publication, with RLS in place and `get_basket_by_code(text)` granted to
`anon, authenticated` (`0008:264-351`). **The server-side surface for realtime baskets is built
and unused** — the app fakes liveness with `simulateContribution()` instead.

---

## 8. Existing database inventory

**Tables (15):** `profiles` · `vendors` · `vendor_documents` · `offers` · `orders` · `gift_cards` ·
`ledger_entries` · `payouts` · `payment_events` · `admin_actions` · `claim_attempts` ·
`gift_baskets` · `gift_basket_participants` · `gift_basket_items` · `gift_basket_activity`

**Functions (13):** `is_admin` · `current_vendor_id` · `handle_new_user` · `guard_vendor_admin_fields` ·
`guard_profile_admin` · `prevent_ledger_mutation` · `claim_card` · `redeem_card` · `redeem_session` ·
`issue_gift_card` · `issue_session_card` · `fulfill_order` · `record_admin_action` ·
`get_basket_by_code` · `card_by_code_hash` · `vendor_outstanding_minor`

**Views (2):** `card_balances` · `vendor_cards`

**RLS:** policies on 13 tables; vendor isolation via `current_vendor_id()`, admin via `is_admin()`.
The ledger is protected by an append-only trigger.

**Edge Functions (4):** `create-payment` · `payment-webhook` (issues the card, mints the claim
token, `deliverClaimLink` is a TODO) · `claim-gift` · `wallet-pass` (`.pkpass` + Google Wallet
object are TODOs).

---

## 9. Screen → required backend data map

| Screen group | Needs from the backend |
|---|---|
| Explore home | published products, vendor summaries, categories, collections, featured placements, unread notification count, active basket |
| Search / category / collection | products with category, occasions, rating, location, vendor, imagery, publication status |
| Business (vendor) page | vendor profile, banner/logo/gallery, locations, products, rating |
| Product detail | product, variants (denominations/packages), price range, terms, expiry, redemption instructions, session count for experience products |
| Compose / checkout | product + variant, price, recipient, delivery, message, **order + order_items + voucher issuance** |
| Wallet (My Gifts) | vouchers with monetary balance **or** remaining sessions, status, expiry, delivery status, vendor |
| Card detail | voucher + ledger history + redeem QR payload |
| Claim flow | claim token → voucher (must be token-scoped, not a constant) |
| Orders | orders + items + vouchers + payment status |
| Notifications | notification rows with type + read state + deep link |
| Profile | profile, saved recipients, addresses, favourites, payment methods (last two are future-phase) |
| Baskets | basket, items, participants, activity, share code — **with realtime** |
| Vendor dashboard | vendor products, vouchers by type, session balances, redemptions, staff, analytics |

---

## 10. What the audit changes about the plan

| Finding | Consequence for the plan |
|---|---|
| Schema is ahead of the app, but **incomplete** for the brief | Extend, don't rewrite. Keep the ledger/atomicity model and add fulfilment types. |
| `offers` lacks the presentation columns the app already selects | The new product schema must carry `icon`, `tone`, `category`, `rating`, `location`, `occasions` — this also fixes the broken Supabase path. |
| `vendors.banner_url` missing | Add the column (and gallery/cover media) in the next migration. |
| `cards.tsx` / `baskets.tsx` are mock-only | Both need real Supabase implementations behind the same hook API, so screens don't change. |
| No role model beyond `is_admin` | Roles are the single biggest new DB concern: `user_roles`, `vendor_members`, `enterprise_members` + helper functions + RLS. |
| Realtime publication already set up for baskets | Wire the client to it; no DB work needed for live baskets. |
| Enterprise code system is entirely absent | New tables + encrypted code storage + import pipeline. |
| Web apps don't exist | One Next.js app with four route groups (public / vendor / enterprise / admin) against the same DB. |
| Payment processing out of scope | Keep `payment_transactions`, `refunds`, `vendor_commissions`, `platform_fees`, `partner_settlements`, `webhook_events` as **structure only**. |
