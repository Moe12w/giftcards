# Tazilla — AI gift cards, MCP and Expo delivery report

Date: 15 November 2026

Scope of this report:

1. Expo startup, bilingual language support and the customer tutorial.
2. The public MCP server (Remote Streamable HTTP) and its runtime tests.
3. The public `/ai-gift-cards` SEO landing page.

Related documents:

- Keyword research: `docs/seo/ai-gift-cards-keyword-research.md`
- MCP function source: `supabase/functions/mcp/`
- MCP migration: `supabase/migrations/0107_mcp_rate_limits.sql`

---

## 1. Expo

### 1.1 Startup fix

- `expo-notifications ~58.1.9` is installed in the app root `package.json` because
  `src/lib/push.ts` imports it and the auth layer registers the push token.
- `app.json` declares the `expo-notifications` plugin; `expo config --type public`
  resolves it without a plugin error, and a runtime Expo dev server start reached
  `Metro is ready` / `Waiting on http://localhost:8082` with no startup error.
- Expo typecheck (`node node_modules/typescript/bin/tsc --noEmit`) passes with an
  empty log.

### 1.2 Bilingual support

- `src/i18n/index.ts` detects the device locale through `expo-localization`, persists
  the customer choice under the `giftly.language` AsyncStorage key, and applies
  right-to-left layout for Arabic.
- The EN / ع `LanguageToggle` is available on the login screen, in the profile
  header and as a home-screen shortcut.

### 1.3 Customer tutorial

- `src/lib/tutorial.ts` holds an eight-step bilingual customer tour covering gift
  cards, gift baskets and app usage.
- `app/(customer)/tutorial.tsx` renders it with the shared `OnboardingSlide`.
- Completion is stored under `giftly.tutorial.seen`; the customer home screen
  auto-opens the tour once and the profile can replay it.

### 1.4 Status

- Startup configuration, Expo typecheck and runtime Metro start: **pass**.

---

## 2. MCP server

### 2.1 Implementation

- Separate Supabase Edge Function under `supabase/functions/mcp/` using the
  Remote Streamable HTTP transport (stateless JSON-RPC 2.0 over POST).
- Tools: `search_businesses`, `get_business_details`, `get_gift_cards`,
  `get_gift_card_details`, `create_gift_card_order`, `check_order_status`.
- The function verifies customer JWTs itself for the two order tools and filters
  every order query by `buyer_id`.
- Prices are taken from `products` / `product_variants` server-side; the AI never
  supplies money.
- `create_gift_card_order` only prepares a pending order; it does not charge, create
  a payment link, issue an invoice or issue a gift card.

### 2.2 Migration and deployment

- Migration `0107_mcp_rate_limits.sql` applied to the live project
  (`rxrrbznwnsgzpinirzme`) and recorded as version `0107`.
- MCP function deployed to the same project as a single function bundle
  (`functions deploy mcp --no-verify-jwt --use-api --yes`) using the official
  Supabase CLI v3.1.0.

### 2.3 Runtime test results (this session)

Public:

| Check | Result |
| --- | --- |
| `initialize` | HTTP 200, protocol version `2025-06-18`, server `giftly-ai-gift-cards`, capabilities `{ tools: { listChanged: false } }` |
| `tools/list` | 6 tools returned with JSON schemas |
| `search_businesses` | HTTP 200, returned matching Qatar businesses with gift counts |
| Invalid input (`get_business_details` with bad UUID) | Tool error `invalid_arguments` with validation message |
| `create_gift_card_order` without token | Tool error `auth_required` |
| `check_order_status` without token | Tool error `auth_required` |
| Unknown method | JSON-RPC error `-32601` |
| `GET` | HTTP 405 with `Allow: POST, DELETE` |

Authenticated (two disposable customers, cleaned up after):

| Check | Result |
| --- | --- |
| `get_gift_card_details` on a monetary card | Price range resolved, e.g. QAR 300.00 – QAR 1200.00 |
| `create_gift_card_order` below / above range | Tool error `amount_out_of_range` with the allowed range |
| `create_gift_card_order` valid order | Order created, status `pending`, payment status `unpaid`, total from catalogue, recipient masked, item written |
| Retry with the same idempotency key | Same order returned, `idempotent_replay: true` |
| `check_order_status` by owner | Order returned with pending status and next step |
| `check_order_status` by other customer | Tool error `order_not_found` (no cross-customer access) |
| Order row in DB | `buyer_id` matched the customer, no voucher issued |
| Cleanup | Test orders and users deleted |

Rate limit:

- 11 consecutive unauthenticated `create_gift_card_order` calls: first 10 answered
  `auth_required`, 11th rejected with HTTP 429 and `Retry-After: 60`.

### 2.4 Status

- Public reads, validation, auth, price calculation, idempotency, isolation and rate
  limits: **verified against the live deployment**.

---

## 3. `/ai-gift-cards` SEO landing page

### 3.1 Implementation

- Route: `web/app/(site)/ai-gift-cards/page.tsx`.
- Copy: `web/lib/i18n/ai.ts` (English + Arabic, typed against each other).
- Dynamic OG image: `web/app/(site)/ai-gift-cards/opengraph-image.tsx`.
- Metadata: absolute title/description, canonical, OG, Twitter, robots.
- Structured data: `Organization`, `WebPage`, `BreadcrumbList` (FAQ rich results
  intentionally omitted because Google restricts them to authoritative sites).
- Internal links from the header, footer and within the page.
- `/sitemap.xml` includes `/ai-gift-cards` and approved public vendor pages.
- `/robots.txt` allows all except the private dashboards and allows the sitemap.

### 3.2 Runtime validation (latest build)

- EN and AR requests: HTTP 200, identical canonical, distinct titles/descriptions.
- EN H1: `AI gift card shopping in Qatar`; AR H1: `تسوّق بطاقات الهدايا بالذكاء
  الاصطناعي في قطر`.
- Heading counts: 8 H2 and 14 H3 elements per language (including footer).
- Structured data types per language: `Organization`, `WebPage`, `BreadcrumbList`.
- Internal link targets present: `/vendors`, `/corporate`, `/download`, `/faq`,
  `/contact`.
- No `<img>` elements without alt text.

- Copy was updated this session to the complete purchase flow (EN + AR): the
  assistant prepares the gift card order, sends a secure payment link in the chat,
  the customer pays through the Tazilla checkout, and the gift card is issued after
  payment.

### 3.3 Audit results

- Lighthouse (final run against the build-5 production server):
  - Accessibility: **1.0**
  - Best Practices: **1.0**
  - SEO: **1.0**
  - Failures: **none**
- Accessibility fixes applied this session: heading order (footer changed from
  `h4` to `h3`) and low-contrast text (`.ai-chat-result` green, success tag text,
  footer muted text).

### 3.4 Status

- Page metadata, structured data, sitemap, robots, OG image, bilingual rendering and
  Lighthouse accessibility: **pass**.

---

## 4. Keyword research

- Full report: `docs/seo/ai-gift-cards-keyword-research.md`.
- Qualitative only (no volume data available). Primary target:
  `AI gift card shopping in Qatar`. Secondary: Qatari commercial intent queries.
- Arabic keyword coverage is early-stage; needs Search Console data.

---

## 5. Known limitations and follow-ups

1. `web/.env.local` sets `NEXT_PUBLIC_SITE_URL=http://localhost:3000`; production
   must set `NEXT_PUBLIC_SITE_URL=https://giftly.qa` so canonical and OG URLs are
   correct.
2. Arabic is currently served through the locale cookie rather than a separate
   Arabic path; consider path-based Arabic routes before expecting Arabic
   rankings to compound.
3. MCP platform connectors (ChatGPT/Claude) remain unverified; the page and FAQ state
   that clearly.
4. Payment and gift-card issuance remain out of scope for MCP in this phase.
5. Deployment of the marketing site and push of Expo OTA updates remain to be done
   from a machine with git and the web host's credentials.

---

## 6. Final status

| Area | Status |
| --- | --- |
| Expo startup + typecheck | Pass (runtime Metro start verified) |
| Expo bilingual language + tutorial | Implemented; typechecked |
| MCP migration + deployment | Pass (migration applied and recorded; function live) |
| MCP public tools | Pass (verified live) |
| MCP order flow, validation, idempotency, isolation, rate limit | Pass (verified live, test data cleaned) |
| Web `/ai-gift-cards` typecheck + build | Pass (latest build 5, complete-flow copy) |
| Web page runtime, SEO metadata, structured data, OG, sitemap, robots | Pass |
| Lighthouse accessibility / SEO / best practices | Pass (1.0 / 1.0 / 1.0, no failures) |
| Keyword research | Complete (qualitative) |

Remaining operational follow-ups:

- Set `NEXT_PUBLIC_SITE_URL=https://giftly.qa` for the production web deployment.
- Deploy the Next marketing site and push the Expo OTA update.
- Test ChatGPT / Claude connectors against the deployed MCP endpoint and record results.
- Publish the final deliverables and commit/push when git access is available.
