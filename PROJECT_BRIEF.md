# Gift Card Marketplace: Project Brief

## What we are building
A gift card marketplace. Small vendors join, get approved, and create gift card offers. Customers buy a gift card in a mobile app, send it to a friend or family member, and can add it to Apple Wallet or Google Wallet. Vendors redeem cards by scanning a QR code at the counter. A card can be spent in part (a QAR 100 card spent for QAR 10 leaves QAR 90) and stays valid until its balance reaches zero.

## Tech stack (do not change without asking me)
- Expo + React Native + Expo Router, TypeScript. One codebase for iPhone, Android, and web.
- Supabase for the database, login, file storage, and server functions (Edge Functions).
- MyFatoorah for payments, using its multi-vendor (submerchant) split.
- Apple Wallet (.pkpass) and Google Wallet passes, both showing a QR code.
- i18next + expo-localization for English and Arabic, with right-to-left layout for Arabic.
- Vitest for automated tests.

## Money model (critical)
- Each vendor is a MyFatoorah submerchant with its own account and its own relationship with MyFatoorah.
- Customers pay at purchase. MyFatoorah releases the vendor's share immediately, minus our commission. We never hold, reserve, or move customer money.
- All refunds and chargebacks are debited by MyFatoorah from the vendor's account. We do not build any recovery or deduction feature.
- Each vendor has an exposure limit (max_unredeemed_minor) set by an admin. This caps how much unredeemed value the vendor can have outstanding.
- Commission rate is stored per vendor in basis points (1000 = 10%).

## Money rules (never break these)
1. Money is stored as integers in minor units (fils), never decimals. QAR 100 = 10000.
2. Balances are never stored as a number that someone edits. Every change is a new row in ledger_entries, and a balance is calculated from those rows.
3. ledger_entries is append-only: no UPDATE or DELETE allowed, enforced by a database trigger.
4. A redemption runs inside one database transaction that locks the card row (SELECT ... FOR UPDATE), so two redemptions cannot run at once.
5. A card becomes "redeemed" only when its balance reaches exactly 0.
6. A payment webhook that arrives twice must never create cards twice. Check the order status first and use a unique payment reference.
7. Secret keys (MyFatoorah token, service role key, wallet certificates) live only in server functions and environment variables. Never in app code, never in Git.
8. Card codes are stored as hashes. The full code is shown once to the buyer and never logged.

## Gift card and claim rules
- Card statuses: issued, claimed, redeemed, expired, voided.
- Claim links use a random token of at least 32 characters. Only its hash is stored. A token can be used once.
- Claim attempts are rate-limited.
- Redemption QR codes are shown on a white background in light and dark mode.
- Wallet passes show vendor name, value, balance, expiry, and a QR code. The vendor's scan always reads the balance from the server, never from the phone.

## Screens and roles
- **Customer (phone app):** Home (active offers), offer detail and buy, My cards (balance, large QR code, add to wallet), Orders, Account (language, log out, delete account). Bottom tab bar: Home, My cards, Orders, Account.
- **Gift claim page (web, no login):** claim a gift, then add to wallet.
- **Vendor (web, works on phone and tablet):** onboarding and documents, dashboard (sales, redeemed, outstanding balance), offers, Redeem (scan QR, enter amount, confirm), transactions. On a phone, Redeem is the centre tab.
- **Admin (web, admin role only):** review and approve vendors, set commission and exposure limit, view orders and refunds, audit log.
- Every admin action is written to admin_actions. Non-admins are blocked at the database level, not only in the screen.

## Database tables (summary)
profiles, vendors, vendor_documents, offers, gift_cards, ledger_entries, orders, payouts, payment_events, admin_actions.
Every table has Row Level Security. Customers see only their own rows. Vendors see only their own vendor's rows. Only admins change vendor status.

## Design direction
- Visual references live in docs/design/, with notes in docs/design/NOTES.md. Match their mood, colours, and layout. Where they conflict, ask me before choosing.
- Use the theme file src/theme.ts for all colours, fonts, and spacing. Do not hard-code styles in screens.
- Use shared components from src/components/ (Button, TextField, Card, Badge, StatCard, EmptyState, Money).
- Do not copy other apps' logos, icons, or exact designs.
- Clear, plain language. Never show a raw error code or database message to a customer.

## Language
- Every visible string comes from src/i18n/en.json or src/i18n/ar.json. No text hard-coded in screens.
- Arabic is right-to-left. Arrows and back buttons flip. QR codes and barcodes do not flip.
- Money format: "QAR 1,234.50" in English, with the Arabic equivalent in Arabic. Currency is always QAR.

## Repository layout
- app/(auth)/ — login and sign up
- app/(customer)/ — customer screens
- app/(vendor)/ — vendor screens
- app/(admin)/ — admin screens
- app/claim/ — public claim page
- src/lib/ — Supabase client, money helpers
- src/components/ — shared components
- src/theme.ts — design tokens
- src/i18n/ — en.json, ar.json
- supabase/migrations/ — numbered database changes, never edited after they run
- supabase/functions/ — payment, webhook, and wallet pass functions
- docs/design/ — reference images and NOTES.md
- PROJECT_BRIEF.md — this file

## Working rules for the AI
- Read this brief before every task.
- Make the smallest change that completes the task.
- Explain each change in plain language before making it.
- After each change, list the exact steps a non-developer should run to test it.
- Never edit a migration that has already run. Write a new migration.
- Never delete working code without asking.
- Never run supabase db reset or any command with --force against the live project.
- Never write a secret into a file that Git can see.
- If something is unclear or conflicts with this brief, ask one question before writing code.
- Check the current official documentation for MyFatoorah, Supabase, Expo, and wallet APIs before writing integration code. Do not guess field names.
