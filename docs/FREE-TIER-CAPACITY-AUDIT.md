# Free-Tier Capacity Audit & Optimization Plan

**Date:** 20 November 2026
**Scope:** full repository — Expo app (`app/`, `src/`), Next.js web (`web/`), Supabase (`supabase/`), CI.
**Goal:** maximise concurrent users on **Vercel Hobby** and **Supabase Free** without spending money.
**Mode:** read-only audit + plan. No source files were changed by this audit.

---

## 1. Executive summary

The system is **not** limited by API request counts. Supabase Free includes unlimited API requests and 50,000 MAU; Vercel Hobby includes 1M function invocations. The real free-tier ceilings are:

| Resource | Free limit | What consumes it here |
|---|---:|---|
| Vercel **Fluid Active CPU** | **4 CPU-hours / month** | Every page renders on the server, including public marketing pages, because the root layout reads cookies |
| Vercel **Fast Origin Transfer** | **10 GB / month** | Dynamic HTML on every request; large client bundles; unoptimised images |
| Vercel **Image Transformations** | **5,000 / month** | Remote images through `next/image`; ad creatives currently bypass it |
| Vercel **Function Invocations** | 1M / month | Proxy on every route + dynamic SSR + server actions |
| Supabase **Database size** | **500 MB** | Append-only tables with **no retention** (ledger, notifications, impressions, audit, webhook events) |
| Supabase **Egress** | **5 GB / month** | Full product catalogue (200 rows, all columns + relations) sent to every mobile launch |
| Supabase **Storage** | **1 GB** | Public vendor media + uploaded KYC PDFs, no lifecycle rules |
| Supabase **Realtime peak connections** | **200** | Every signed-in mobile user opens always-on wallet + basket channels |
| Supabase **Edge invocations** | **500k / month** | Payment functions, claim preview, supplier sync |

The single highest-leverage fix is **making public pages static and stopping the proxy from running on them**. Today an anonymous visit to the marketing site costs a middleware function invocation *and* a full dynamic server render. On Hobby that is the dominant CPU burn.

The second is **reducing mobile backend amplification**: a signed-in user currently makes ~17–18 backend calls between launch and first home view, opens two realtime channels, and polls payment status every 2.5 s. That multiplies Supabase egress, edge invocations and realtime connections per user.

The third is **data retention**: without it, the 500 MB database fills up from append-only event tables regardless of traffic optimisation.

---

## 2. What is already good (protect these)

- `web/lib/public-cache.ts` — `unstable_cache` + React `cache()` with 300 s revalidation for public catalogue queries; public pages avoid DB hits even though they re-render.
- `web/lib/auth.ts` — all `require*` guards wrapped in React `cache()`.
- `supabase/functions/_shared/myfatoorah.ts` — 60 s per-isolate config cache; `web/lib/myfatoorah.ts` — 30 s cache.
- `supabase/migrations/0146_marketplace_businesses_gift_count.sql` — replaced per-row COUNT subqueries with a grouped CTE.
- `src/lib/cache.ts` — correct stale-while-revalidate with in-flight dedupe on mobile.
- Next image config — AVIF/WebP, 24 h `minimumCacheTTL`.
- CI already gates web lint/typecheck, DB money-path tests, and mobile lint/typecheck/tests.

Do not regress these while optimising.

---

## 3. Vercel Hobby — findings

### V0. Every page is dynamic SSR (critical)
- `web/app/layout.tsx:44` and `:16` call `getLocale()`.
- `web/lib/i18n/server.ts:11-14` calls `await cookies()`.
- Because the **root layout** reads cookies, every route under it is dynamic. The build manifest contains only 4 prerendered routes despite 121 `page.tsx` files.
- Result: `Cache-Control: no-store` on public HTML; every anonymous hit invokes a function and burns Active CPU.

### V1. Proxy runs on everything (critical)
- `web/proxy.ts:8-11` matcher excludes only `_next/static`, `_next/image`, favicon and image extensions.
- `web/lib/supabase/proxy.ts:15-34` creates a Supabase client and calls `auth.getClaims()` on **every** matched request.
- Login/register pages also call `getUser()` for anonymous visitors (`web/app/{vendor,admin,enterprise,business}/login/page.tsx`, `register/page.tsx`), which is a network call to Supabase Auth.

### V2. Heavy authenticated handlers
- `web/app/api/admin/vendors/files/route.ts` — sequential per-app DB/storage downloads, `buildSignedAgreementPdf()` per signature, synchronous `zipSync(files, {level:6})`, whole ZIP buffered in memory.
- `web/app/api/merchant-agreements/[id]/signed/route.ts:53-66` — N+1 `merchant_application_can_view` RPC calls.
- `web/lib/merchant-server.ts:76-98` — `merchant_application_create` RPC on **GET render** across 10 dashboard pages (write-on-read).
- `web/app/vendor/(dashboard)/page.tsx:39-80` — 10 DB/RPC calls; `admin/(dashboard)/page.tsx:31-77` — 11 calls (well parallelised, but still a floor).

### V3. Bandwidth / bundle
- `web/components/SiteHeader.tsx:11` imports the client-side `site.ts` dictionary (**both locales, ~66 KB**) into every public page.
- `web/app/layout.tsx:2` imports a 4,696-line global CSS file (~87 KB) on every route; `:1` uses a blocking Google Fonts `@import`.
- `web/components/AdvertisingCreativeImage.tsx:113-121` uses raw `<img>` for ad creatives, bypassing the optimiser and CDN cache.
- `web/next.config.ts:36-42` raises Server Action body limit to 8 MB.

---

## 4. Supabase Free — findings

### S0. Realtime is a hard concurrency ceiling
- `src/lib/cards.tsx:167-194` opens `wallet:${userId}` with two `postgres_changes` listeners on every launch.
- `src/lib/baskets.tsx:266-294` opens `gift-baskets` with four listeners on every launch.
- Supabase Free includes **200 concurrent peak Realtime connections**. Even with one multiplexed socket per client, that caps concurrent connected mobile users around 200 regardless of any other optimisation. Each realtime event also triggers a full `load()` refetch (vouchers+ledger or unbounded baskets).

### S1. Database growth has no retention
Append-only tables with no partition, archival or pg_cron:
`ledger_entries`, `financial_ledger`, `notifications`, `advertising_impressions`, `advertising_clicks`, `advertising_conversions`, `webhook_events`, `auth_attempts`, `claim_attempts`, `audit_log`, `admin_actions`, `enterprise_code_events`, `bulk_email_outbox`, `support_ticket_messages`.
The 500 MB cap is reached by data volume, not by concurrent requests.

### S2. Hot-path DB cost
- `0032_fix_voucher_notification_trigger.sql:63-65` — one notification INSERT per voucher row; bulk fulfilment issues 1,000 vouchers one by one → 1,000 notification inserts, digests and row locks.
- `supabase/functions/create-payment/index.ts:58-167` — 8 sequential DB reads, vendor row fetched 3×.
- `supabase/functions/sync-myfatoorah-suppliers/index.ts:66-92` — N+1 RPC loop, one HTTP round-trip per supplier.
- `0021_fulfilment_aware_balances.sql:17-35,40-82` — full ledger recomputation and 4 correlated sums per voucher on hot wallet reads.
- `0127_dashboard_aggregates.sql` — full table scans for dashboard totals on every load.
- RLS helper chains (`0010` L344-398, `0030` L16-53, `0044` L536-549) run `is_admin()` + membership lookups per row on orders/ads reads.
- Missing indexes: `notifications(kind, read_at, created_at)` for cron, advertising `request_id` for dedupe, `orders(status)`, `vouchers(vendor_id, created_at)`.

### S3. Storage & egress
- `vendor-media` bucket is public with a basic CDN; `merchant-documents` is private and served via 120 s signed URLs (correct).
- Mobile bootstrap prefetches 14 remote images on every launch; `FeaturedBusinessCard` falls back to a remote placeholder image.
- `listActiveOffers()` downloads up to 200 products with all columns + variants; home displays ~11.

---

## 5. Mobile — findings

### M0. ~17–18 backend calls from launch to first home view
- Bootstrap (`src/lib/bootstrap.ts:78-86`) = 5 queries catalog/businesses/categories/app-config/public-settings. **`getPublicSettings()` is dead — nothing reads `settings:public`.**
- `warmProfile` = 1; Auth session + `push_tokens` upsert = 2; `CardProvider` = 2 (vouchers + ledger); `BasketProvider` = 1 unbounded baskets query.
- Home mount = 3 duplicate catalogue queries (cache may absorb), 2 uncached focus queries (`countUnreadNotifications`, `refreshConfig` which bypasses cache), 4 ad calls (2 per placement: deliver RPC + placement config).
- Derived shelves `offers:popular` and `businesses:featured` are primed in bootstrap but **never read** anywhere.

### M1. Polling and cache bypass
- `app/(customer)/checkout/processing.tsx:23-76` polls `myfatoorah_payment_status` every 2.5 s for up to 5 min → **up to ~120 RPC calls per checkout**.
- `src/lib/app-config.ts:278-292` `refreshAppConfig()` bypasses the cache on every home focus.
- Catalog/business/categories/app-config TTLs are 60 s; stale-while-revalidate means a refresh on every expired visit.

### M2. Payload and bundle
- `PAGE_SIZE.catalog = 200`, `businesses = 100`, `vouchers = 100`, `redemptions = 200` (`src/lib/data.ts:172-184`).
- Full catalogue downloaded and filtered/sorted in JS (`src/lib/catalog.ts:181-216`) for home, search, category, collection and basket pick.
- `src/lib/mock-data.ts` (~70 KB) statically imported by `data.ts`; legal JSON (~185 KB) statically imported and both locales parsed at startup; glyph registry imports ~282 Lucide icons.

---

## 6. Optimization plan

### Phase P0 — low risk, high value (do first)

| # | Action | Where | Effect |
|---|---|---|---|
| 1 | Narrow proxy matcher to `/admin/:path*`, `/vendor/:path*`, `/enterprise/:path*`, `/business/:path*`, `/auth/:path*` only | `web/proxy.ts:8-11` | Public pages stop paying proxy invocations and JWT work |
| 2 | Remove the unused `getPublicSettings()` bootstrap query | `src/lib/bootstrap.ts:84,100` | −1 query every launch |
| 3 | Gate `refreshConfig()` on `peekCache('app:config')` age (5–15 min) and cache unread count 5 min | `app/(customer)/(tabs)/index.tsx:129-137`, `src/lib/app-config.ts:278-292` | −1–N queries per session |
| 4 | Raise merchandising TTLs 60 s → 15–60 min (`offers:active`, `businesses:all`, `categories:app`, `businesses:ids:*`, `app:config`) | `src/lib/data.ts:378,398,452,578`; `app-config.ts:258` | Removes almost all repeat catalog fetches |
| 5 | Stop creating the payment application on GET; create on explicit submit | `web/lib/merchant-server.ts:76-98` | Removes a DB write from 10 page renders |
| 6 | Cache MyFatoorah config across Vercel instances with `unstable_cache` | `web/lib/myfatoorah.ts:56-76` | Fewer settings reads per cold start |
| 7 | Add missing indexes | new migration | Cuts seq scans on cron, ads dedupe, orders/vouchers |
| 8 | Replace supplier sync N+1 with one `jsonb` RPC | `sync-myfatoorah-suppliers/index.ts:66-92` | Daily cron: 1 call instead of N |
| 9 | Batch bulk-fulfilment notification inserts (one set per bulk order) | `0032` trigger + bulk fulfillment | −999 notification writes per 1,000-card order |

**Expected:** Vercel Active CPU and invocations drop materially for anonymous traffic; mobile launch calls drop from ~17 to ~11; DB writes from bulk orders drop by orders of magnitude.

### Phase P1 — medium risk, largest structural wins

| # | Action | Effect |
|---|---|---|
| 10 | Make public site static/ISR via a `[locale]` segment with `generateStaticParams(['en','ar'])`; move locale out of root layout | **Removes function invocation + SSR for every anonymous visit** — the biggest Hobby CPU win |
| 11 | Server-side shelves (`home_trending`, `home_featured`, `category`, `collection`, `search`) and reduce catalog/business page sizes 200/100 → 50 | Cuts Supabase egress and mobile parse; removes full-catalog filtering |
| 12 | Paginate `BASKET_SELECT`; scope realtime channels to screens that need them; debounce/batch channel events | Raises realtime connection headroom and cuts unbounded payloads |
| 13 | Checkout: poll every 5 s with exponential backoff, stop immediately on success, or use a targeted realtime channel | Up to 120 RPC calls → ~20 |
| 14 | Stream/cache admin ZIP and signed PDFs; return Supabase signed URLs instead of proxying bytes | Prevents Hobby timeouts/OOM on heavy admin exports |
| 15 | Collapse `create-payment`'s 8 serial reads into 1–2 joined queries; parallelise independent reads; fetch vendor once | Lower edge duration and DB round-trips per purchase |
| 16 | Pass only required nav strings from server layout to `SiteHeader`; self-host font with `next/font`; split site vs dashboard CSS | Lower client bundle and transfer per request |
| 17 | Route ad creatives through `OptimizedImage`/`next/image` so CDN/AVIF caching applies | Fewer origin bytes; watch the 5k transformation quota |

### Phase P2 — protect the free tier long-term

| # | Action | Why |
|---|---|---|
| 18 | Retention/archival for append tables: monthly partitions for impressions/clicks/conversions/notifications/audit/webhook events, drop old partitions | 500 MB cap is otherwise inevitable |
| 19 | Materialised/trigger-maintained dashboard counters instead of full scans | Keeps admin pages cheap as data grows |
| 20 | Cache `is_admin()` via JWT claim / request setting; denormalize membership lookups | Reduces RLS CPU on every order/ad row |
| 21 | Lazy-load legal JSON, make mock-data dynamic or build-flagged, trim unused glyphs | Faster mobile startup, smaller OTA bundles |
| 22 | Storage lifecycle rules / upload caps for `vendor-media`; monitor 1 GB bucket | Prevents free storage exhaustion |

---

## 7. Rough capacity model (assumptions, not guarantees)

| Metric | Current | After P0 | After P0+P1 |
|---|---:|---:|---:|
| Backend calls, launch → home (signed-in) | ~17–18 | ~11–12 | ~6–8 |
| Realtime channels per user | 2 always-on | 2 | 1 on-demand |
| Checkout status RPCs | up to ~120 | ~60 | ~20 |
| Vercel function invocation per anonymous page view | 2 (proxy + SSR) | 1 (SSR) | **0 (CDN)** |
| Supabase egress per mobile session | full 200-product catalogue | same | ~50 products + shelves |
| DB writes per 1,000-card bulk order | ~1,000 notifications + ledger | batched | batched |

Supabase Free's **200 realtime connections** remains the hard ceiling for *simultaneously connected* mobile users. If you need more concurrent users than that, the only free-tier-compatible path is to stop holding realtime channels open for every user (use focus-time fetches with short TTLs) and keep realtime only on the couple of screens that truly need it (wallet QR scan detection, active basket).

---

## 8. Monitoring plan (free tier has no paid alerting)

- **Vercel dashboard → Usage**: watch *Fluid Active CPU*, *Fast Origin Transfer*, *Image Transformations*, *Function Invocations* weekly. Hobby has hard caps and a 30-day pause if exceeded.
- **Supabase dashboard → Usage**: watch database size (500 MB), egress (5 GB), storage (1 GB), Realtime peak connections (200), Edge invocations (500k).
- SQL checks (monthly):
  - `select relname, n_live_tup from pg_stat_user_tables order by n_live_tup desc;` — find fastest-growing tables.
  - `select indexrelname, idx_scan from pg_stat_user_indexes order by idx_scan;` — find unused/duplicate indexes.
- Keep CI gates from regressing: `mobile.yml`, `web.yml`, `db.yml` already run on every PR.

---

## 9. What NOT to do

- Don't add a paid tier yet; the free limits are generous once duplication is removed.
- Don't weaken RLS to save CPU — the membership helper chains are security boundaries.
- Don't rewrite applied migrations for cleanup; use new migrations (precedent: `0146`, `0147`).
- Don't force dynamic/server rendering on authenticated dashboards — they must stay fresh.
- Don't add a nonce-based CSP without also solving the cookie-in-root-layout problem; it would force every page dynamic.
- Don't cache vouchers, ledger, orders or notifications on the client — money state must stay fresh (wallet already uses realtime).

---

## 10. Recommended sequence

1. **Week 1:** P0 items 1–9 (all low risk). Measure Vercel Active CPU and mobile calls again.
2. **Week 2:** P0 item 10 — static public site. This is the single biggest Hobby win.
3. **Week 3:** P1 items 11–14 (payload sizes, realtime scoping, heavy handlers).
4. **Week 4:** P1 items 15–17 and P2 item 18 (retention) — retention is urgent once data starts growing.
5. **Ongoing:** monitoring plan above; revisit P2 remaining items as usage grows.

If you only do three things: **static public pages**, **stop always-on realtime for every user**, and **add retention for append-only tables**.
