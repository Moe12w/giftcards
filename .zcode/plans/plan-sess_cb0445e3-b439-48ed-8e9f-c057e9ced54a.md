## Context

The accounting/statements feature is currently in the wrong places: it lives in the Expo app as a broken, unreachable screen (`app/(customer)/(tabs)/profile/statements.tsx` has syntax errors, placeholder Supabase URLs, missing i18n keys) plus a dead vendor screen and a Supabase edge function that depends on tables that were never created. Meanwhile the users who actually need it — vendors and enterprise customers — use the web dashboards. Enterprise already has it (`/enterprise/reports` + CSV export); vendors have nothing. The goal: **add a dedicated Reports page to the vendor web dashboard mirroring the enterprise one, and remove all statements/accounting code from the Expo app and the unused edge function.**

## Part 1 — Vendor Reports page (web, mirrors enterprise reports)

**New files:**

1. `web/app/vendor/(dashboard)/reports/page.tsx` — server component modeled on `web/app/enterprise/(dashboard)/reports/page.tsx`:
   - `requireVendor()` auth (pattern from `web/app/vendor/(dashboard)/analytics/page.tsx:33`), scoped by `ctx.vendor.id`
   - `?range=` searchParam with the same `RANGES` const (30/90/365) as analytics/reports
   - Query `order_items` (`id, total_minor, commission_minor, vendor_share_minor, created_at, products(title), orders(order_ref, status, created_at)`) filtered by `vendor_id` + `created_at >= since` — same query as `analytics/page.tsx:42-48`; filter to `status === 'paid'`
   - KPI grid via `<Kpi>` from `@/components/ui`: gross sales, platform commission, vendor share, paid order count
   - "Money" panel (gross / commission / your share cards) like enterprise `page.tsx:187-224`
   - Monthly sales breakdown with progress bars (copy the pattern from `analytics/page.tsx:102-113, 186-208`)
   - Paid orders table (order ref, product, date, total, your share) like `analytics/page.tsx:284-325`
   - Export button: `<a className="btn sm primary" href={`/vendor/reports/export?range=${range}`}>` (enterprise pattern, `page.tsx:149`)

2. `web/app/vendor/(dashboard)/reports/export/route.ts` — CSV export modeled exactly on `web/app/enterprise/(dashboard)/reports/export/route.ts` (reuse its `csvCell` + BOM + response-header pattern): `requireVendor()`, `range` param, query the same paid `order_items` as the page, columns: `order_ref, product, total_minor, commission_minor, vendor_share_minor, currency, created_at`, filename `tazilla-sales-${vendor.slug}-${date}.csv`.

**Modified files:**

3. `web/app/vendor/(dashboard)/layout.tsx` — add nav item after analytics (line 55): `{ href: '/vendor/reports', label: t.reports ?? 'Reports', icon: 'reports', hint: t.reportsHint ?? 'What to hand over to finance.' }` (fallback style matches existing lines 34, 42; `reports` icon already maps to FileBarChart in DashShell).

4. `web/lib/i18n/vendor.ts` — add `nav.reports` / `nav.reportsHint` and a new `reports` section (after `analytics`, both `en` and `ar` — Arabic is type-checked against `en`, so both are required) with keys: eyebrow, title, description, ranges{d30,d90,d12m}, dateRangeLabel, exportCsv, grossSales, commission, yourShare, money, priceAndCut, salesByMonth, noPaidSales, recentPaidOrders, order, noPaidOrders, emptyTitle, emptyBody, csvNote. Reuse `common.actions.apply`, `common.actions.export`, `common.labels.*` where available (common.ts already has `export`/`download` keys).

## Part 2 — Remove accounting from Expo app

1. Delete `app/(customer)/(tabs)/profile/statements.tsx` (broken route screen).
2. `app/(customer)/(tabs)/profile.tsx` — delete the statements `ListRow` (lines 140–145). Neighboring rows need no changes; the addresses row keeps its `last` prop.
3. Delete `src/screens/vendor/StatementsScreen.tsx` (unreachable dead code — no `(vendor)` route group exists).
4. Delete `src/lib/statementGenerator.ts` (only importers are the two deleted screens).
5. `src/lib/types.ts` — delete the trailing Statement types block (lines ~397–451: `StatementPeriod`, `StatementFormat`, `StatementEntry`, `StatementMetadata`, `StatementSummary`, `GenerateStatementResponse`); verified zero remaining usages.
6. Delete `supabase/functions/statement-export/` (edge function: placeholder URLs, depends on unshipped `sub_merchants`/`transactions` tables, no consumer after removal). Keep the `statements` table migration — dropping it via a new migration is out of scope unless it's pre-production (git history shows no deployed releases; if it's trivially safe I'll flag it rather than drop data).

## Verification

- Before removal, run a safety grep: `grep -rn "statementGenerator\|StatementsScreen\|StatementPeriod\|StatementEntry\|statement-export" app src --include="*.ts*"` — expect no hits after changes.
- Expo app: `npx tsc --noEmit` and `npx expo lint` from repo root.
- Web app: `npm run build` (or `npx tsc --noEmit` + lint) from `web/` — this catches the required Arabic i18n keys since `ar: VendorCopy` is type-checked.
- Manual: run the web app, log in as a vendor, verify `/vendor/reports` renders KPIs/money panel/table and the CSV export downloads with correct commission split columns.
